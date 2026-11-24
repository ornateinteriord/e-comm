import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Customer } from '../models/customer.model.js';
import { Address } from '../models/address.model.js';
import { Wishlist } from '../models/wishlist.model.js';
import { DataDeletionRequest } from '../models/data-deletion-request.model.js';
import { AuditLog } from '../models/audit-log.model.js';
import { createLogger } from '@ornate/logger';

const log = createLogger('privacy-controller');

// Helper to find customer by authenticated userId
function getCustomerQuery(userId: string) {
  const query: any[] = [
    { userId },
    { customerId: userId },
    { customer_id: userId },
    { email: userId },
    { mobileNumber: userId },
  ];
  if (mongoose.Types.ObjectId.isValid(userId)) {
    query.unshift({ _id: new mongoose.Types.ObjectId(userId) });
  } else {
    query.push({ _id: userId });
  }
  return { $or: query };
}

/**
 * Customer submits a personal data deletion request under DPDP Act 2023.
 */
export async function submitDeletionRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { reason, notes } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_REASON', message: 'Please provide a valid reason for data deletion.' },
      });
      return;
    }

    // Check if there is already a pending deletion request
    const existingPending = await DataDeletionRequest.findOne({ userId, status: 'pending' });
    if (existingPending) {
      res.status(409).json({
        success: false,
        error: {
          code: 'REQUEST_ALREADY_PENDING',
          message: 'You already have an active data deletion request pending compliance review.',
        },
        data: existingPending,
      });
      return;
    }

    const customer = await Customer.findOne(getCustomerQuery(userId));

    const newRequest = await DataDeletionRequest.create({
      userId,
      customerId: customer?.customerId || customer?.customer_id || customer?._id?.toString(),
      customerName: customer?.fullName || customer?.name || req.user?.email || 'Customer',
      customerEmail: (customer?.email || req.user?.email || '').toLowerCase().trim(),
      customerPhone: customer?.mobileNumber || customer?.phone || '',
      reason: reason.trim(),
      notes: typeof notes === 'string' ? notes.trim() : '',
      status: 'pending',
      requestedAt: new Date(),
    });

    log.info({ userId, requestId: newRequest._id, email: newRequest.customerEmail }, 'DPDP data deletion request submitted');

    res.status(201).json({
      success: true,
      message: 'Your personal data deletion request has been submitted and is under compliance review.',
      data: newRequest,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Customer checks the status of their data deletion request.
 */
export async function getMyDeletionRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const latestRequest = await DataDeletionRequest.findOne({ userId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: latestRequest || null,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Customer cancels their pending deletion request.
 */
export async function cancelMyDeletionRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const pendingRequest = await DataDeletionRequest.findOne({ userId, status: 'pending' });

    if (!pendingRequest) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No pending data deletion request found to cancel.' },
      });
      return;
    }

    pendingRequest.status = 'cancelled';
    await pendingRequest.save();

    log.info({ userId, requestId: pendingRequest._id }, 'DPDP data deletion request cancelled by customer');

    res.json({
      success: true,
      message: 'Data deletion request has been cancelled.',
      data: pendingRequest,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin lists all customer data deletion requests with status filtering and pagination.
 */
export async function adminListDataDeletionRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, status, search } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(String(page || '1'), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit || '20'), 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, any> = {};

    if (status && ['pending', 'completed', 'rejected', 'cancelled'].includes(status)) {
      filter.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { customerName: { $regex: q, $options: 'i' } },
        { customerEmail: { $regex: q, $options: 'i' } },
        { customerPhone: { $regex: q, $options: 'i' } },
        { customerId: { $regex: q, $options: 'i' } },
      ];
    }

    const [requests, total, pendingCount, completedCount, rejectedCount] = await Promise.all([
      DataDeletionRequest.find(filter).sort({ requestedAt: -1 }).skip(skip).limit(limitNum),
      DataDeletionRequest.countDocuments(filter),
      DataDeletionRequest.countDocuments({ status: 'pending' }),
      DataDeletionRequest.countDocuments({ status: 'completed' }),
      DataDeletionRequest.countDocuments({ status: 'rejected' }),
    ]);

    res.json({
      success: true,
      data: requests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      counts: {
        totalAll: pendingCount + completedCount + rejectedCount,
        pending: pendingCount,
        completed: completedCount,
        rejected: rejectedCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin executes personal data erasure in compliance with DPDP Act Section 12.
 */
export async function adminExecuteDataDeletion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;
    const adminUser = req.user;

    const request = await DataDeletionRequest.findById(id);
    if (!request) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Data deletion request not found.' },
      });
      return;
    }

    if (request.status !== 'pending') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: `Request is already ${request.status}.` },
      });
      return;
    }

    // Locate customer by userId or email
    const customer = await Customer.findOne({
      $or: [
        ...getCustomerQuery(request.userId).$or,
        { email: request.customerEmail.toLowerCase().trim() },
      ],
    });

    const targetUserIds = [request.userId];
    if (customer?._id) targetUserIds.push(customer._id.toString());
    if (customer?.userId) targetUserIds.push(customer.userId);

    // 1. Permanently delete addresses and wishlist
    await Address.deleteMany({ userId: { $in: targetUserIds } });
    await Wishlist.deleteMany({ userId: { $in: targetUserIds } });

    // 2. Anonymize customer personal identification records (preserving transaction references without PII)
    if (customer) {
      const maskedId = customer._id.toString();
      customer.name = 'Erased Customer';
      customer.fullName = 'Erased Customer (DPDP)';
      customer.email = `deleted_${maskedId}_${Date.now()}@anonymized.local`;
      customer.mobileNumber = undefined;
      customer.phone = undefined;
      customer.username = undefined;
      customer.avatar = undefined;
      customer.profilePicture = undefined;
      customer.city = undefined;
      customer.state = undefined;
      customer.pincode = undefined;
      customer.country = undefined;
      customer.passwordHash = 'ERASED_DPDP_SECTION_12';
      customer.isActive = false;
      await customer.save();
    }

    // 3. Update deletion request record
    request.status = 'completed';
    request.processedAt = new Date();
    request.processedBy = adminUser?.email || adminUser?.userId || 'Admin';
    if (adminNotes && typeof adminNotes === 'string') {
      request.adminNotes = adminNotes.trim();
    }
    await request.save();

    // 4. Record compliance audit log
    await AuditLog.create({
      action: 'DPDP_CUSTOMER_DATA_ERASED',
      actorId: adminUser?.userId,
      actorRole: adminUser?.role || 'admin',
      targetModel: 'Customer',
      targetId: request.userId,
      after: {
        requestId: request._id,
        customerEmail: request.customerEmail,
        erasedAt: request.processedAt,
        processedBy: request.processedBy,
        adminNotes: request.adminNotes,
      },
    }).catch((err) => log.warn({ err: err?.message }, 'Failed to record DPDP audit log'));

    log.info(
      { requestId: request._id, customerEmail: request.customerEmail, processedBy: request.processedBy },
      'DPDP customer personal data erased successfully',
    );

    res.json({
      success: true,
      message: 'Customer personal data has been erased and account anonymized in compliance with DPDP Act.',
      data: request,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin rejects a data deletion request (e.g., active legal hold or pending order disputes).
 */
export async function adminRejectDataDeletion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { adminNotes, reason } = req.body;
    const adminUser = req.user;

    const request = await DataDeletionRequest.findById(id);
    if (!request) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Data deletion request not found.' },
      });
      return;
    }

    if (request.status !== 'pending') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: `Request is already ${request.status}.` },
      });
      return;
    }

    const rejectionReason = (adminNotes || reason || '').trim();
    if (!rejectionReason) {
      res.status(400).json({
        success: false,
        error: { code: 'REASON_REQUIRED', message: 'Please provide a valid explanation for rejecting the request.' },
      });
      return;
    }

    request.status = 'rejected';
    request.adminNotes = rejectionReason;
    request.processedAt = new Date();
    request.processedBy = adminUser?.email || adminUser?.userId || 'Admin';
    await request.save();

    await AuditLog.create({
      action: 'DPDP_DATA_DELETION_REJECTED',
      actorId: adminUser?.userId,
      actorRole: adminUser?.role || 'admin',
      targetModel: 'Customer',
      targetId: request.userId,
      after: {
        requestId: request._id,
        rejectionReason,
        processedBy: request.processedBy,
      },
    }).catch((err) => log.warn({ err: err?.message }, 'Failed to record DPDP audit log'));

    log.info({ requestId: request._id, rejectionReason }, 'DPDP data deletion request rejected');

    res.json({
      success: true,
      message: 'Data deletion request has been rejected with compliance notes.',
      data: request,
    });
  } catch (err) {
    next(err);
  }
}
