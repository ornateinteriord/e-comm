import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Order, IOrder } from '../models/order.model.js';
import {
  DeliveryAssignment,
  IDeliveryAssignment,
  sanitizeAssignmentForPartner,
} from '../models/delivery-assignment.model.js';
import {
  ACTIVE_DELIVERY_STATUSES,
  calculateHaversineKm,
  calculatePartnerPayoutPaise,
  canTransitionDelivery,
  generateDeliveryOtp,
  isDeliveryAssignmentStatus,
  nextDeliveryStatuses,
  resolveCodDetails,
} from '../domain/delivery-lifecycle.js';
import { canTransitionOrder } from '../domain/order-lifecycle.js';
import { distributeOrderCommissions } from '../utils/commission.js';
import { triggerInvoiceGeneration } from './order.controller.js';
import {
  triggerOrderDeliveredNotification,
  triggerOrderDispatchedNotification,
} from '../utils/notification.client.js';
import { createLogger } from '@ornate/logger';
import type {
  DeliveryAssignmentStatus,
  DeliveryGeoPoint,
  DeliveryStopLocation,
  OrderDeliveryDetails,
} from '@ornate/types';

const log = createLogger('delivery-controller');

interface PartnerDoc {
  _id: mongoose.Types.ObjectId;
  partnerId: string;
  name: string;
  mobileNumber: string;
  vehicleType?: 'bike' | 'scooter' | 'bicycle' | 'car' | 'van';
  vehicleNumber?: string;
  city?: string;
  pincode?: string;
  servicePincodes?: string[];
  status: string;
  isActive: boolean;
  kycStatus?: string;
  availabilityStatus?: string;
  rating?: number;
  totalDeliveries?: number;
  totalEarningsPaise?: number;
  cashInHandPaise?: number;
  currentLocation?: DeliveryGeoPoint;
}

function getAuthDb() {
  const conn = mongoose.connection as unknown as {
    getClient?: () => { db: (name: string) => mongoose.mongo.Db };
    client?: { db: (name: string) => mongoose.mongo.Db };
    useDb: (name: string) => { db?: mongoose.mongo.Db };
  };
  const dbName = process.env.AUTH_DB_NAME ?? 'ornate_auth';
  const client = typeof conn.getClient === 'function' ? conn.getClient() : conn.client;
  return client ? client.db(dbName) : conn.useDb(dbName).db!;
}

function getOrderQuery(idOrNumber: string | string[] | undefined) {
  const id = Array.isArray(idOrNumber) ? idOrNumber[0] : String(idOrNumber || '');
  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  return isObjectId ? { $or: [{ _id: new mongoose.Types.ObjectId(id) }, { orderNumber: id }] } : { orderNumber: id };
}

function getAssignmentQuery(idOrCode: string | string[] | undefined) {
  const id = Array.isArray(idOrCode) ? idOrCode[0] : String(idOrCode || '');
  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  return isObjectId
    ? { $or: [{ _id: new mongoose.Types.ObjectId(id) }, { assignmentCode: id }, { orderNumber: id }] }
    : { $or: [{ assignmentCode: id }, { orderNumber: id }] };
}

async function requireActiveDeliveryPartner(
  req: Request,
  res: Response,
): Promise<PartnerDoc | null> {
  if (!req.user || req.user.role !== 'delivery_partner') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Delivery partner account required.' },
    });
    return null;
  }

  const authDb = getAuthDb();
  const queries: Record<string, unknown>[] = [];
  if (mongoose.Types.ObjectId.isValid(req.user.userId)) {
    queries.push({ _id: new mongoose.Types.ObjectId(req.user.userId) });
  }
  if (req.user.deliveryPartnerId) {
    queries.push({ partnerId: req.user.deliveryPartnerId });
  }

  const partner = (await authDb
    .collection('delivery_partners')
    .findOne(queries.length > 0 ? { $or: queries } : { partnerId: req.user.userId })) as PartnerDoc | null;

  if (!partner) {
    res.status(404).json({
      success: false,
      error: { code: 'PARTNER_NOT_FOUND', message: 'Delivery partner profile not found.' },
    });
    return null;
  }

  if (partner.status !== 'active' || !partner.isActive) {
    res.status(403).json({
      success: false,
      error: {
        code: 'ACCOUNT_NOT_ACTIVE',
        message: 'Your delivery partner account is pending approval or suspended.',
      },
    });
    return null;
  }

  return partner;
}

function ensurePartnerReadyForDispatch(partner: PartnerDoc, res: Response): boolean {
  if (partner.kycStatus !== 'verified') {
    res.status(403).json({
      success: false,
      error: {
        code: 'KYC_NOT_VERIFIED',
        message: 'Complete KYC verification before claiming or accepting delivery orders.',
      },
    });
    return false;
  }

  if (partner.availabilityStatus === 'offline') {
    res.status(403).json({
      success: false,
      error: {
        code: 'RIDER_OFFLINE',
        message: 'Switch your duty status to Online with live GPS before accepting or claiming orders.',
      },
    });
    return false;
  }

  if (
    typeof partner.currentLocation?.lat !== 'number' ||
    typeof partner.currentLocation?.lng !== 'number'
  ) {
    res.status(422).json({
      success: false,
      error: {
        code: 'GPS_REQUIRED',
        message: 'Live GPS location is required to claim or accept delivery orders.',
      },
    });
    return false;
  }

  return true;
}

async function resolvePickupLocationForOrder(order: IOrder): Promise<DeliveryStopLocation> {
  const firstSellerId =
    order.items.find((it) => it.sellerId || it.storeId)?.sellerId ||
    order.items[0]?.storeId;

  let sellerDoc: Record<string, any> | null = null;
  if (firstSellerId) {
    try {
      const authDb = getAuthDb();
      sellerDoc = await authDb.collection('stores').findOne({
        $or: [
          { sellerId: firstSellerId },
          { storeId: firstSellerId },
          ...(mongoose.Types.ObjectId.isValid(firstSellerId)
            ? [{ _id: new mongoose.Types.ObjectId(firstSellerId) }]
            : []),
        ],
      });
    } catch (err) {
      log.warn({ err, firstSellerId }, 'Could not resolve seller pickup location');
    }
  }

  return {
    name: sellerDoc?.name || sellerDoc?.ownerName || process.env.SELLER_NAME || 'E-Shopy Fulfillment Hub',
    phone: sellerDoc?.mobileNumber || process.env.SELLER_PHONE || '9876543210',
    line1: sellerDoc?.address?.line1 || process.env.SELLER_ADDRESS || '42 Industrial Area, Sector 5',
    line2: sellerDoc?.address?.line2 || '',
    city: sellerDoc?.address?.city || 'Bengaluru',
    state: sellerDoc?.address?.state || 'Karnataka',
    pincode: sellerDoc?.address?.pincode || '560001',
    lat: typeof sellerDoc?.location?.lat === 'number' ? sellerDoc.location.lat : undefined,
    lng: typeof sellerDoc?.location?.lng === 'number' ? sellerDoc.location.lng : undefined,
  };
}

function buildDropLocationForOrder(order: IOrder): DeliveryStopLocation {
  return {
    name: order.shippingAddress?.name || order.customerName || 'Customer',
    phone: order.shippingAddress?.phone || '9999999999',
    line1: order.shippingAddress?.line1 || 'Customer Address',
    line2: order.shippingAddress?.line2 || '',
    city: order.shippingAddress?.city || '',
    state: order.shippingAddress?.state || '',
    pincode: order.shippingAddress?.pincode || '',
  };
}

function buildOrderDeliverySnapshot(assignment: IDeliveryAssignment): OrderDeliveryDetails {
  return {
    assignmentId: String(assignment._id),
    assignmentCode: assignment.assignmentCode,
    partnerId: assignment.partnerId,
    partnerName: assignment.partnerName,
    partnerPhone: assignment.partnerPhone,
    vehicleType: assignment.vehicleType,
    vehicleNumber: assignment.vehicleNumber,
    status: assignment.status,
    deliveryOtp: assignment.deliveryOtp,
    otpVerified: assignment.otpVerified,
    assignedAt: assignment.assignedAt?.toISOString(),
    acceptedAt: assignment.acceptedAt?.toISOString(),
    pickedUpAt: assignment.pickedUpAt?.toISOString(),
    deliveredAt: assignment.deliveredAt?.toISOString(),
    failedReason: assignment.failureReason,
    payoutPaise: assignment.payoutPaise,
    pod: assignment.otpVerified
      ? {
          otpVerified: assignment.otpVerified,
          photoUrl: assignment.podPhotoUrl,
          signatureDataUrl: assignment.podSignatureUrl,
          recipientName: assignment.podRecipientName,
          notes: assignment.podNotes,
          deliveredAt: assignment.deliveredAt?.toISOString(),
        }
      : undefined,
    cod: {
      isCod: assignment.isCod,
      expectedAmountPaise: assignment.codAmountPaise,
      collectedAmountPaise: assignment.codCollectedPaise,
      collectedAt: assignment.codCollectedPaise > 0 ? assignment.deliveredAt?.toISOString() : undefined,
      settled: assignment.codSettled,
    },
    lastKnownLocation: assignment.lastKnownLocation,
    trackingHistory: assignment.trackingHistory,
  };
}

function syncOrderDeliveryDetails(order: IOrder, assignment: IDeliveryAssignment): void {
  order.deliveryDetails = buildOrderDeliverySnapshot(assignment);
  order.markModified('deliveryDetails');
}

async function updatePartnerStats(
  partnerMongoId: string,
  setFields: Record<string, unknown>,
  incFields?: Record<string, number>,
): Promise<void> {
  try {
    const authDb = getAuthDb();
    const filter = mongoose.Types.ObjectId.isValid(partnerMongoId)
      ? { _id: new mongoose.Types.ObjectId(partnerMongoId) }
      : { partnerId: partnerMongoId };

    const updateDoc: Record<string, unknown> = {
      $set: { ...setFields, lastActiveAt: new Date() },
    };
    if (incFields && Object.keys(incFields).length > 0) {
      updateDoc.$inc = incFields;
    }

    await authDb.collection('delivery_partners').updateOne(filter, updateDoc);
  } catch (err) {
    log.warn({ err, partnerMongoId }, 'Non-blocking partner stats update failed');
  }
}

async function createAssignmentForOrder(params: {
  order: IOrder;
  partner: PartnerDoc;
  mode: 'admin_assigned' | 'self_claimed';
  actorLabel: string;
}): Promise<IDeliveryAssignment> {
  const { order, partner, mode, actorLabel } = params;
  const orderIdStr = String(order._id);

  const existingActive = await DeliveryAssignment.findOne({
    orderId: orderIdStr,
    status: { $in: [...ACTIVE_DELIVERY_STATUSES] },
  });
  if (existingActive) {
    const err = new Error(
      `Order ${order.orderNumber} already has an active delivery assignment (${existingActive.assignmentCode}).`,
    ) as Error & { statusCode?: number; code?: string };
    err.statusCode = 409;
    err.code = 'ALREADY_ASSIGNED';
    throw err;
  }

  const pickupLocation = await resolvePickupLocationForOrder(order);
  const dropLocation = buildDropLocationForOrder(order);
  const distanceKm = calculateHaversineKm(
    partner.currentLocation?.lat,
    partner.currentLocation?.lng,
    pickupLocation.lat,
    pickupLocation.lng,
  );
  const payoutPaise = calculatePartnerPayoutPaise(order.pricing, distanceKm);
  const { isCod, codAmountPaise } = resolveCodDetails(order);

  const now = new Date();
  const initialStatus: DeliveryAssignmentStatus = mode === 'self_claimed' ? 'accepted' : 'assigned';
  const assignmentCode = `DLV-ASG-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

  const trackingHistory = [
    {
      status: initialStatus,
      note:
        mode === 'self_claimed'
          ? `Claimed by delivery partner ${partner.name} (${partner.partnerId})`
          : `Assigned to delivery partner ${partner.name} (${partner.partnerId}) by ${actorLabel}`,
      changedBy: actorLabel,
      timestamp: now.toISOString(),
      lat: partner.currentLocation?.lat,
      lng: partner.currentLocation?.lng,
    },
  ];

  const assignment = new DeliveryAssignment({
    assignmentCode,
    orderId: orderIdStr,
    orderNumber: order.orderNumber,
    partnerId: partner.partnerId,
    partnerMongoId: String(partner._id),
    partnerName: partner.name,
    partnerPhone: partner.mobileNumber,
    vehicleType: partner.vehicleType || 'bike',
    vehicleNumber: partner.vehicleNumber,
    assignmentMode: mode,
    status: initialStatus,
    pickupLocation,
    dropLocation,
    itemsSummary: (order.items || []).map((it) => ({
      productId: it.productId,
      name: it.name,
      sku: it.sku,
      quantity: it.quantity,
      image: it.image,
    })),
    deliveryOtp: generateDeliveryOtp(),
    otpVerified: false,
    isCod,
    codAmountPaise,
    codCollectedPaise: 0,
    codSettled: false,
    payoutPaise,
    tipPaise: 0,
    distanceKm,
    lastKnownLocation: partner.currentLocation,
    trackingHistory,
    assignedAt: now,
    acceptedAt: mode === 'self_claimed' ? now : undefined,
  });

  await assignment.save();

  order.shippingProvider = 'E-Shopy Express';
  order.trackingNumber = assignmentCode;
  syncOrderDeliveryDetails(order, assignment);
  order.statusHistory.push({
    status: order.fulfilmentStatus,
    changedBy: actorLabel,
    changedAt: now.toISOString(),
    note:
      mode === 'self_claimed'
        ? `Delivery partner ${partner.name} (${partner.partnerId}) claimed order (${assignmentCode}).`
        : `Assigned to E-Shopy Delivery Partner ${partner.name} (${partner.partnerId}).`,
  });

  await order.save();

  if (mode === 'self_claimed') {
    await updatePartnerStats(String(partner._id), { availabilityStatus: 'on_delivery' });
  }

  return assignment;
}

// ==========================================
// DELIVERY PARTNER ENDPOINTS
// ==========================================

/**
 * GET /api/v1/delivery/orders/available
 * Lists seller-accepted orders ready for pickup with no active courier/partner assignment.
 */
export async function getAvailableOrdersForDelivery(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const partner = await requireActiveDeliveryPartner(req, res);
    if (!partner) return;

    const activeAssignments = await DeliveryAssignment.find({
      status: { $in: [...ACTIVE_DELIVERY_STATUSES] },
    }).select('orderId');

    const busyOrderIds = activeAssignments
      .map((a) => a.orderId)
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const candidateOrders = await Order.find({
      _id: { $nin: busyOrderIds },
      sellerAcceptanceStatus: 'accepted',
      fulfilmentStatus: { $in: ['confirmed', 'processing', 'packed'] },
      'shadowfaxDetails.awbNumber': { $exists: false },
    })
      .sort({ createdAt: -1 })
      .limit(40);

    const items = await Promise.all(
      candidateOrders.map(async (order) => {
        const pickupLocation = await resolvePickupLocationForOrder(order);
        const dropLocation = buildDropLocationForOrder(order);
        const distanceKm = calculateHaversineKm(
          partner.currentLocation?.lat,
          partner.currentLocation?.lng,
          pickupLocation.lat,
          pickupLocation.lng,
        );
        const { isCod, codAmountPaise } = resolveCodDetails(order);
        const estimatedPayoutPaise = calculatePartnerPayoutPaise(order.pricing, distanceKm);

        return {
          id: String(order._id),
          orderNumber: order.orderNumber,
          createdAt: order.createdAt.toISOString(),
          fulfilmentStatus: order.fulfilmentStatus,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          isCod,
          codAmountPaise,
          grandTotalPaise: order.pricing?.grandTotal || 0,
          estimatedPayoutPaise,
          estimatedDistanceKm: distanceKm,
          itemCount: (order.items || []).reduce((acc, it) => acc + Number(it.quantity || 1), 0),
          itemsSummary: (order.items || []).map((it) => ({
            productId: it.productId,
            name: it.name,
            sku: it.sku,
            quantity: it.quantity,
            image: it.image,
          })),
          pickupLocation,
          dropLocation,
        };
      }),
    );

    // Prioritize matching pincodes or nearest pickup if partner has location/pincodes
    const partnerPincodes = new Set(partner.servicePincodes || []);
    items.sort((a, b) => {
      const aMatch = partnerPincodes.has(a.dropLocation.pincode) || partnerPincodes.has(a.pickupLocation.pincode) ? 0 : 1;
      const bMatch = partnerPincodes.has(b.dropLocation.pincode) || partnerPincodes.has(b.pickupLocation.pincode) ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      if (a.estimatedDistanceKm !== undefined && b.estimatedDistanceKm !== undefined) {
        return a.estimatedDistanceKm - b.estimatedDistanceKm;
      }
      return 0;
    });

    res.json({ success: true, data: { items } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/delivery/orders/:orderId/claim
 * Hybrid self-claim: partner claims an available order.
 */
export async function claimAvailableOrder(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const partner = await requireActiveDeliveryPartner(req, res);
    if (!partner) return;
    if (!ensurePartnerReadyForDispatch(partner, res)) return;

    const order = await Order.findOne(getOrderQuery(req.params.orderId));
    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found.' } });
      return;
    }

    if (order.sellerAcceptanceStatus !== 'accepted') {
      res.status(400).json({
        success: false,
        error: { code: 'SELLER_NOT_READY', message: 'Order has not been accepted by seller yet.' },
      });
      return;
    }

    if (['cancelled', 'delivered', 'returned'].includes(order.fulfilmentStatus)) {
      res.status(409).json({
        success: false,
        error: { code: 'ORDER_CLOSED', message: `Order is already ${order.fulfilmentStatus}.` },
      });
      return;
    }

    if (order.shadowfaxDetails?.awbNumber) {
      res.status(409).json({
        success: false,
        error: { code: 'ALREADY_DISPATCHED', message: 'Order is already booked with Shadowfax.' },
      });
      return;
    }

    const assignment = await createAssignmentForOrder({
      order,
      partner,
      mode: 'self_claimed',
      actorLabel: `${partner.name} (${partner.partnerId})`,
    });

    res.status(201).json({
      success: true,
      data: sanitizeAssignmentForPartner(assignment),
      message: `Order #${order.orderNumber} claimed successfully.`,
    });
  } catch (err: unknown) {
    const statusErr = err as { statusCode?: number; code?: number | string; message?: string };
    if (statusErr?.statusCode === 409 || statusErr?.code === 11000) {
      res.status(409).json({
        success: false,
        error: { code: 'ALREADY_ASSIGNED', message: 'This order was just claimed by another partner.' },
      });
      return;
    }
    next(err);
  }
}

/**
 * GET /api/v1/delivery/assignments?scope=active|history
 */
export async function listMyAssignments(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const partner = await requireActiveDeliveryPartner(req, res);
    if (!partner) return;

    const scope = String(req.query.scope || 'active');
    const filter: Record<string, unknown> = {
      partnerId: partner.partnerId,
      status:
        scope === 'history'
          ? { $in: ['delivered', 'failed', 'cancelled'] }
          : { $in: [...ACTIVE_DELIVERY_STATUSES] },
    };

    const assignments = await DeliveryAssignment.find(filter).sort({ updatedAt: -1 }).limit(50);
    res.json({
      success: true,
      data: {
        items: assignments.map((a) => sanitizeAssignmentForPartner(a)),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/delivery/assignments/:id
 */
export async function getMyAssignmentById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const partner = await requireActiveDeliveryPartner(req, res);
    if (!partner) return;

    const assignment = await DeliveryAssignment.findOne({
      ...getAssignmentQuery(req.params.id),
      partnerId: partner.partnerId,
    });

    if (!assignment) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Assignment not found.' } });
      return;
    }

    res.json({ success: true, data: sanitizeAssignmentForPartner(assignment) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/delivery/assignments/:id/accept
 */
export async function acceptAssignedDelivery(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const partner = await requireActiveDeliveryPartner(req, res);
    if (!partner) return;
    if (!ensurePartnerReadyForDispatch(partner, res)) return;

    const assignment = await DeliveryAssignment.findOne({
      ...getAssignmentQuery(req.params.id),
      partnerId: partner.partnerId,
    });

    if (!assignment) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Assignment not found.' } });
      return;
    }

    if (!canTransitionDelivery(assignment.status, 'accepted')) {
      res.status(409).json({
        success: false,
        error: {
          code: 'INVALID_TRANSITION',
          message: `Cannot accept assignment in '${assignment.status}' status.`,
        },
      });
      return;
    }

    const now = new Date();
    assignment.status = 'accepted';
    assignment.acceptedAt = now;
    assignment.trackingHistory.push({
      status: 'accepted',
      note: `Accepted by ${partner.name} (${partner.partnerId})`,
      changedBy: partner.partnerId,
      timestamp: now.toISOString(),
    });
    await assignment.save();

    const order = await Order.findOne(getOrderQuery(assignment.orderId));
    if (order) {
      syncOrderDeliveryDetails(order, assignment);
      await order.save();
    }

    await updatePartnerStats(String(partner._id), { availabilityStatus: 'on_delivery' });

    res.json({
      success: true,
      data: sanitizeAssignmentForPartner(assignment),
      message: 'Delivery task accepted.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/delivery/assignments/:id/reject
 */
export async function rejectAssignedDelivery(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const partner = await requireActiveDeliveryPartner(req, res);
    if (!partner) return;

    const assignment = await DeliveryAssignment.findOne({
      ...getAssignmentQuery(req.params.id),
      partnerId: partner.partnerId,
    });

    if (!assignment) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Assignment not found.' } });
      return;
    }

    if (assignment.status !== 'assigned') {
      res.status(409).json({
        success: false,
        error: {
          code: 'CANNOT_REJECT',
          message: 'Only newly assigned (unaccepted) tasks can be declined.',
        },
      });
      return;
    }

    const now = new Date();
    const reason = String(req.body?.reason || 'Partner unavailable').trim();
    assignment.status = 'cancelled';
    assignment.cancelledAt = now;
    assignment.failureReason = reason;
    assignment.trackingHistory.push({
      status: 'cancelled',
      note: `Declined by ${partner.name}: ${reason}`,
      changedBy: partner.partnerId,
      timestamp: now.toISOString(),
    });
    await assignment.save();

    const order = await Order.findOne(getOrderQuery(assignment.orderId));
    if (order) {
      order.deliveryDetails = undefined;
      order.trackingNumber = undefined;
      order.shippingProvider = undefined;
      order.statusHistory.push({
        status: order.fulfilmentStatus,
        changedBy: partner.partnerId,
        changedAt: now.toISOString(),
        note: `Delivery partner ${partner.partnerId} declined assignment: ${reason}`,
      });
      await order.save();
    }

    res.json({ success: true, message: 'Assignment declined and returned to pool.' });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/delivery/assignments/:id/status
 * Progresses delivery lifecycle: arrived_pickup -> picked_up -> in_transit -> arrived_customer | failed
 */
export async function updateDeliveryProgress(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const partner = await requireActiveDeliveryPartner(req, res);
    if (!partner) return;

    const { status, note, reason, lat, lng } = req.body || {};
    if (!isDeliveryAssignmentStatus(status) || status === 'delivered') {
      res.status(422).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message:
            status === 'delivered'
              ? 'Use /complete endpoint with OTP & Proof of Delivery to mark delivered.'
              : `Invalid delivery status '${status}'.`,
        },
      });
      return;
    }

    const assignment = await DeliveryAssignment.findOne({
      ...getAssignmentQuery(req.params.id),
      partnerId: partner.partnerId,
    });

    if (!assignment) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Assignment not found.' } });
      return;
    }

    if (!canTransitionDelivery(assignment.status, status)) {
      res.status(409).json({
        success: false,
        error: {
          code: 'INVALID_TRANSITION',
          message: `Cannot move delivery from '${assignment.status}' to '${status}'.`,
          details: { allowed: nextDeliveryStatuses(assignment.status) },
        },
      });
      return;
    }

    if (status === 'failed' && !String(reason || note || '').trim()) {
      res.status(422).json({
        success: false,
        error: { code: 'REASON_REQUIRED', message: 'A reason is required when marking delivery failed.' },
      });
      return;
    }

    const now = new Date();
    assignment.status = status;
    if (status === 'arrived_pickup') assignment.arrivedPickupAt = now;
    if (status === 'picked_up') assignment.pickedUpAt = now;
    if (status === 'arrived_customer') assignment.arrivedCustomerAt = now;
    if (status === 'failed') {
      assignment.failedAt = now;
      assignment.failureReason = String(reason || note).trim();
    }
    if (status === 'cancelled') assignment.cancelledAt = now;

    if (typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      assignment.lastKnownLocation = { lat, lng, updatedAt: now.toISOString() };
    }

    assignment.trackingHistory.push({
      status,
      note: String(note || reason || `Status updated to ${status.replace('_', ' ')}`),
      lat: typeof lat === 'number' ? lat : undefined,
      lng: typeof lng === 'number' ? lng : undefined,
      changedBy: partner.partnerId,
      timestamp: now.toISOString(),
    });

    await assignment.save();

    const order = await Order.findOne(getOrderQuery(assignment.orderId));
    if (order) {
      if ((status === 'picked_up' || status === 'in_transit') && canTransitionOrder(order.fulfilmentStatus, 'shipped')) {
        order.fulfilmentStatus = 'shipped';
        for (const it of order.items) {
          if (it.itemStatus !== 'cancelled' && it.itemStatus !== 'delivered') {
            it.itemStatus = 'dispatched';
            it.courierName = 'E-Shopy Express';
            it.trackingNumber = assignment.assignmentCode;
            it.dispatchedAt = it.dispatchedAt || now.toISOString();
          }
        }
        triggerOrderDispatchedNotification(order, {
          courierName: `E-Shopy Express (${partner.name})`,
          trackingNumber: assignment.assignmentCode,
        });
      }

      syncOrderDeliveryDetails(order, assignment);
      order.statusHistory.push({
        status: order.fulfilmentStatus,
        changedBy: `Delivery (${partner.partnerId})`,
        changedAt: now.toISOString(),
        note: `Delivery update: ${status.replace('_', ' ')}${assignment.failureReason ? ` (${assignment.failureReason})` : ''}`,
      });
      await order.save();
    }

    if (status === 'failed' || status === 'cancelled') {
      await updatePartnerStats(String(partner._id), { availabilityStatus: 'online' });
    }

    res.json({
      success: true,
      data: sanitizeAssignmentForPartner(assignment),
      message: `Delivery status updated to ${status.replace('_', ' ')}.`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/delivery/assignments/:id/location
 * Streams live rider GPS coordinates for an active assignment.
 */
export async function updateAssignmentLocation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const partner = await requireActiveDeliveryPartner(req, res);
    if (!partner) return;

    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      res.status(422).json({
        success: false,
        error: { code: 'INVALID_COORDINATES', message: 'Valid lat and lng are required.' },
      });
      return;
    }

    const assignment = await DeliveryAssignment.findOne({
      ...getAssignmentQuery(req.params.id),
      partnerId: partner.partnerId,
    });

    if (!assignment) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Assignment not found.' } });
      return;
    }

    const point: DeliveryGeoPoint = {
      lat,
      lng,
      formattedAddress: req.body?.formattedAddress,
      updatedAt: new Date().toISOString(),
    };

    assignment.lastKnownLocation = point;
    await assignment.save();

    const order = await Order.findOne(getOrderQuery(assignment.orderId));
    if (order) {
      syncOrderDeliveryDetails(order, assignment);
      await order.save();
    }

    await updatePartnerStats(String(partner._id), { currentLocation: point });

    res.json({ success: true, data: { lastKnownLocation: point } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/delivery/assignments/:id/complete
 * Verifies 4-digit customer OTP, saves POD (photo/signature/recipient), records COD collection, and completes order.
 */
export async function completeDeliveryWithPod(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const partner = await requireActiveDeliveryPartner(req, res);
    if (!partner) return;

    const { otp, photoUrl, signatureDataUrl, recipientName, notes, codCollected, codCollectedPaise, lat, lng } =
      req.body || {};

    const assignment = await DeliveryAssignment.findOne({
      ...getAssignmentQuery(req.params.id),
      partnerId: partner.partnerId,
    });

    if (!assignment) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Assignment not found.' } });
      return;
    }

    if (!canTransitionDelivery(assignment.status, 'delivered')) {
      res.status(409).json({
        success: false,
        error: {
          code: 'INVALID_TRANSITION',
          message: `Cannot complete delivery from '${assignment.status}' status. Pick up the order first.`,
          details: { allowed: nextDeliveryStatuses(assignment.status) },
        },
      });
      return;
    }

    const submittedOtp = String(otp || '').trim();
    if (!submittedOtp || submittedOtp !== assignment.deliveryOtp) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OTP',
          message: 'Incorrect 4-digit delivery verification OTP from customer.',
        },
      });
      return;
    }

    let finalCodCollected = 0;
    if (assignment.isCod) {
      if (!codCollected) {
        res.status(422).json({
          success: false,
          error: {
            code: 'COD_CONFIRMATION_REQUIRED',
            message: `Please confirm collection of ₹${(assignment.codAmountPaise / 100).toFixed(2)} Cash on Delivery.`,
          },
        });
        return;
      }
      finalCodCollected =
        codCollectedPaise !== undefined ? Number(codCollectedPaise) : assignment.codAmountPaise;
      if (finalCodCollected < assignment.codAmountPaise) {
        res.status(422).json({
          success: false,
          error: {
            code: 'COD_AMOUNT_MISMATCH',
            message: `Collected cash must match ₹${(assignment.codAmountPaise / 100).toFixed(2)}.`,
          },
        });
        return;
      }
    }

    const now = new Date();
    assignment.status = 'delivered';
    assignment.otpVerified = true;
    assignment.podPhotoUrl = photoUrl || assignment.podPhotoUrl;
    assignment.podSignatureUrl = signatureDataUrl || assignment.podSignatureUrl;
    assignment.podRecipientName = String(recipientName || assignment.dropLocation.name || '').trim();
    assignment.podNotes = notes ? String(notes).trim() : undefined;
    assignment.codCollectedPaise = finalCodCollected;
    assignment.deliveredAt = now;

    if (typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      assignment.lastKnownLocation = { lat, lng, updatedAt: now.toISOString() };
    }

    assignment.trackingHistory.push({
      status: 'delivered',
      note: `Delivered to ${assignment.podRecipientName || 'Customer'} (OTP Verified${
        assignment.isCod ? `, COD ₹${(finalCodCollected / 100).toFixed(2)} collected` : ''
      })`,
      lat: typeof lat === 'number' ? lat : undefined,
      lng: typeof lng === 'number' ? lng : undefined,
      changedBy: partner.partnerId,
      timestamp: now.toISOString(),
    });

    await assignment.save();

    const order = await Order.findOne(getOrderQuery(assignment.orderId));
    if (order) {
      const wasPaid = order.paymentStatus === 'paid';
      if (canTransitionOrder(order.fulfilmentStatus, 'delivered')) {
        order.fulfilmentStatus = 'delivered';
      }
      for (const it of order.items) {
        if (it.itemStatus !== 'cancelled') {
          it.itemStatus = 'delivered';
          it.deliveredAt = now.toISOString();
        }
      }
      if (assignment.isCod && finalCodCollected > 0 && order.paymentStatus !== 'paid') {
        order.paymentStatus = 'paid';
        order.paymentMethod = order.pricing?.walletAmountPaid
          ? 'COD + Wallet (Collected by Partner)'
          : 'COD (Collected by Partner)';
        order.paymentReference = assignment.assignmentCode;
      }

      syncOrderDeliveryDetails(order, assignment);
      order.statusHistory.push({
        status: 'delivered',
        changedBy: `Delivery (${partner.partnerId})`,
        changedAt: now.toISOString(),
        note: `Order delivered with OTP verification by ${partner.name} (${partner.partnerId}).`,
      });
      await order.save();

      triggerOrderDeliveredNotification(order);

      if (!wasPaid && order.paymentStatus === 'paid') {
        distributeOrderCommissions(order).catch((err) => {
          log.error({ err, orderNumber: order.orderNumber }, 'Commission distribution failed on COD delivery');
        });
        triggerInvoiceGeneration(order);
      }
    }

    await updatePartnerStats(
      String(partner._id),
      { availabilityStatus: 'online' },
      {
        totalDeliveries: 1,
        totalEarningsPaise: assignment.payoutPaise + assignment.tipPaise,
        cashInHandPaise: finalCodCollected,
      },
    );

    res.json({
      success: true,
      data: sanitizeAssignmentForPartner(assignment),
      message: 'Delivery completed and Proof of Delivery recorded!',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/delivery/earnings
 */
export async function getMyEarnings(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const partner = await requireActiveDeliveryPartner(req, res);
    if (!partner) return;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const [recentAssignments, activeCount] = await Promise.all([
      DeliveryAssignment.find({
        partnerId: partner.partnerId,
        status: 'delivered',
      })
        .sort({ deliveredAt: -1 })
        .limit(50),
      DeliveryAssignment.countDocuments({
        partnerId: partner.partnerId,
        status: { $in: [...ACTIVE_DELIVERY_STATUSES] },
      }),
    ]);

    let todayEarningsPaise = 0;
    let weekEarningsPaise = 0;

    for (const trip of recentAssignments) {
      const earning = (trip.payoutPaise || 0) + (trip.tipPaise || 0);
      const deliveredDate = trip.deliveredAt || trip.updatedAt;
      if (deliveredDate >= startOfToday) {
        todayEarningsPaise += earning;
      }
      if (deliveredDate >= startOfWeek) {
        weekEarningsPaise += earning;
      }
    }

    res.json({
      success: true,
      data: {
        todayEarningsPaise,
        weekEarningsPaise,
        totalEarningsPaise: partner.totalEarningsPaise ?? 0,
        cashInHandPaise: partner.cashInHandPaise ?? 0,
        completedTrips: partner.totalDeliveries ?? recentAssignments.length,
        activeTrips: activeCount,
        rating: partner.rating ?? 5.0,
        recentTrips: recentAssignments.slice(0, 20).map((t) => ({
          id: String(t._id),
          assignmentCode: t.assignmentCode,
          orderNumber: t.orderNumber,
          status: t.status,
          payoutPaise: t.payoutPaise,
          tipPaise: t.tipPaise,
          codCollectedPaise: t.codCollectedPaise,
          codSettled: t.codSettled,
          dropCity: t.dropLocation?.city || '',
          deliveredAt: t.deliveredAt?.toISOString(),
          createdAt: t.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// ADMIN DISPATCH & TRACKING ENDPOINTS
// ==========================================

/**
 * POST /api/v1/admin/orders/:id/delivery/assign
 */
export async function adminAssignDeliveryPartner(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { partnerId } = req.body || {};
    if (!partnerId) {
      res.status(422).json({
        success: false,
        error: { code: 'PARTNER_ID_REQUIRED', message: 'partnerId is required.' },
      });
      return;
    }

    const order = await Order.findOne(getOrderQuery(req.params.id));
    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found.' } });
      return;
    }

    if (order.sellerAcceptanceStatus !== 'accepted') {
      res.status(400).json({
        success: false,
        error: { code: 'SELLER_NOT_ACCEPTED', message: 'Seller must accept the order before assigning a delivery partner.' },
      });
      return;
    }

    if (['cancelled', 'delivered', 'returned'].includes(order.fulfilmentStatus)) {
      res.status(409).json({
        success: false,
        error: { code: 'ORDER_CLOSED', message: `Cannot assign partner to ${order.fulfilmentStatus} order.` },
      });
      return;
    }

    const authDb = getAuthDb();
    const partner = (await authDb.collection('delivery_partners').findOne({
      $or: [
        { partnerId: String(partnerId).trim() },
        ...(mongoose.Types.ObjectId.isValid(String(partnerId))
          ? [{ _id: new mongoose.Types.ObjectId(String(partnerId)) }]
          : []),
      ],
    })) as PartnerDoc | null;

    if (!partner) {
      res.status(404).json({
        success: false,
        error: { code: 'PARTNER_NOT_FOUND', message: 'Delivery partner not found.' },
      });
      return;
    }

    if (partner.status !== 'active' || !partner.isActive) {
      res.status(400).json({
        success: false,
        error: { code: 'PARTNER_INACTIVE', message: 'Selected delivery partner is not active.' },
      });
      return;
    }

    if (partner.kycStatus !== 'verified') {
      res.status(400).json({
        success: false,
        error: {
          code: 'PARTNER_KYC_NOT_VERIFIED',
          message: 'Selected delivery partner has not completed KYC verification.',
        },
      });
      return;
    }

    const assignment = await createAssignmentForOrder({
      order,
      partner,
      mode: 'admin_assigned',
      actorLabel: req.user?.email || 'Admin',
    });

    res.status(201).json({
      success: true,
      data: {
        assignment: assignment.toJSON(),
        order,
      },
      message: `Assigned order #${order.orderNumber} to ${partner.name} (${partner.partnerId}).`,
    });
  } catch (err: unknown) {
    const statusErr = err as { statusCode?: number; code?: number | string; message?: string };
    if (statusErr?.statusCode === 409 || statusErr?.code === 11000) {
      res.status(409).json({
        success: false,
        error: { code: 'ALREADY_ASSIGNED', message: statusErr.message || 'Order already has an active delivery partner.' },
      });
      return;
    }
    next(err);
  }
}

/**
 * GET /api/v1/admin/orders/:id/delivery/track
 */
export async function adminTrackOrderDelivery(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const order = await Order.findOne(getOrderQuery(req.params.id));
    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found.' } });
      return;
    }

    const assignment = await DeliveryAssignment.findOne({ orderId: String(order._id) }).sort({ createdAt: -1 });
    if (!assignment) {
      res.status(404).json({
        success: false,
        error: { code: 'NO_ASSIGNMENT', message: 'No E-Shopy delivery assignment exists for this order.' },
      });
      return;
    }

    res.json({
      success: true,
      data: assignment.toJSON(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/orders/:id/delivery/cancel
 */
export async function adminCancelOrderDelivery(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const order = await Order.findOne(getOrderQuery(req.params.id));
    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found.' } });
      return;
    }

    const assignment = await DeliveryAssignment.findOne({
      orderId: String(order._id),
      status: { $in: [...ACTIVE_DELIVERY_STATUSES] },
    });

    if (!assignment) {
      res.status(404).json({
        success: false,
        error: { code: 'NO_ACTIVE_ASSIGNMENT', message: 'No active delivery assignment found for this order.' },
      });
      return;
    }

    const now = new Date();
    const reason = String(req.body?.reason || 'Cancelled by admin').trim();
    assignment.status = 'cancelled';
    assignment.cancelledAt = now;
    assignment.failureReason = reason;
    assignment.trackingHistory.push({
      status: 'cancelled',
      note: `Assignment cancelled by admin: ${reason}`,
      changedBy: req.user?.email || 'Admin',
      timestamp: now.toISOString(),
    });
    await assignment.save();

    order.deliveryDetails = undefined;
    order.trackingNumber = undefined;
    order.shippingProvider = undefined;
    order.statusHistory.push({
      status: order.fulfilmentStatus,
      changedBy: req.user?.email || 'Admin',
      changedAt: now.toISOString(),
      note: `E-Shopy delivery assignment ${assignment.assignmentCode} cancelled: ${reason}`,
    });
    await order.save();

    await updatePartnerStats(assignment.partnerMongoId, { availabilityStatus: 'online' });

    res.json({ success: true, message: 'Delivery assignment cancelled.' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/delivery/assignments
 */
export async function adminListDeliveryAssignments(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const status = String(req.query.status || '').trim();
    const partnerId = String(req.query.partnerId || '').trim();
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (partnerId) filter.partnerId = partnerId;

    const items = await DeliveryAssignment.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: { items: items.map((i) => i.toJSON()) } });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// CUSTOMER TRACKING ENDPOINT
// ==========================================

/**
 * GET /api/v1/orders/:id/delivery
 * Returns live delivery status, rider info, and the 4-digit delivery OTP for the order owner.
 */
export async function getCustomerOrderDelivery(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const order = await Order.findOne(getOrderQuery(req.params.id));
    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found.' } });
      return;
    }

    if (req.user && req.user.role === 'customer' && order.userId !== req.user.userId) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } });
      return;
    }

    const assignment = await DeliveryAssignment.findOne({ orderId: String(order._id) }).sort({ createdAt: -1 });
    if (!assignment) {
      res.json({ success: true, data: order.deliveryDetails || null });
      return;
    }

    res.json({
      success: true,
      data: buildOrderDeliverySnapshot(assignment),
    });
  } catch (err) {
    next(err);
  }
}
