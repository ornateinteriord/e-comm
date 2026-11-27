import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  DeliveryPartner,
  generateNextPartnerId,
  isPartnerKycComplete,
} from '../models/delivery-partner.model.js';
import { AppRelease, getDeliveryAppReleaseInfo } from '../models/app-release.model.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
  extractRefreshToken,
} from '../utils/jwt.js';
import { uploadToImageKit } from '../utils/imagekit.js';
import { createLogger } from '@ornate/logger';

const log = createLogger('delivery-partner-controller');
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12);

const VEHICLE_TYPES = ['bike', 'scooter', 'bicycle', 'car', 'van'] as const;
const KYC_FIELDS = [
  'drivingLicenseUrl',
  'vehicleRcUrl',
  'idProofUrl',
  'profilePhotoUrl',
] as const;

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Full name must be at least 2 characters.'),
  mobileNumber: z.string().trim().min(10, 'Valid 10-digit mobile number is required.'),
  email: z.string().trim().email('Invalid email address.').optional().or(z.literal('')),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  vehicleType: z.enum(VEHICLE_TYPES).default('bike'),
  vehicleNumber: z.string().trim().min(2, 'Vehicle registration number is required.'),
  city: z.string().trim().min(2, 'City is required.'),
  state: z.string().trim().min(2, 'State is required.'),
  pincode: z.string().trim().min(4, 'Pincode is required.'),
  servicePincodes: z.union([z.array(z.string()), z.string()]).optional(),
  drivingLicenseNumber: z.string().trim().optional(),
  drivingLicenseUrl: z.string().trim().optional(),
  vehicleRcUrl: z.string().trim().optional(),
  idProofUrl: z.string().trim().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
});

function normalizeTenDigitMobile(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function parseServicePincodes(raw: string[] | string | undefined, fallbackPincode: string): string[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[,\s]+/)
      : [];
  const cleaned = list.map((p) => String(p).trim()).filter(Boolean);
  if (fallbackPincode && !cleaned.includes(fallbackPincode)) {
    cleaned.unshift(fallbackPincode);
  }
  return Array.from(new Set(cleaned));
}

async function uploadImageWithFallback(
  file: Express.Multer.File,
  folder: string,
): Promise<{ url: string; fileId: string }> {
  try {
    const result = await uploadToImageKit(file.buffer, file.originalname, folder);
    return { url: result.url, fileId: result.fileId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn({ err: message, folder }, 'ImageKit upload failed; using inline data URL fallback if within size limit');
    if (file.buffer.length <= 1_500_000) {
      const mime = file.mimetype || 'image/jpeg';
      return {
        url: `data:${mime};base64,${file.buffer.toString('base64')}`,
        fileId: `local_${Date.now()}`,
      };
    }
    throw new Error('Image upload service unavailable and file exceeds 1.5MB fallback limit.');
  }
}

function buildPartnerTokens(partner: {
  _id: unknown;
  email: string;
  partnerId: string;
}) {
  const accessToken = signAccessToken({
    userId: String(partner._id),
    email: partner.email,
    role: 'delivery_partner',
    deliveryPartnerId: partner.partnerId,
  });
  const refreshToken = signRefreshToken({ userId: String(partner._id) });
  return { accessToken, refreshToken };
}

/**
 * POST /api/v1/delivery/register
 */
export async function registerDeliveryPartner(req: Request, res: Response): Promise<void> {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Invalid registration data.',
          details: parsed.error.issues,
        },
      });
      return;
    }

    const data = parsed.data;
    const cleanMobile = normalizeTenDigitMobile(data.mobileNumber);
    if (cleanMobile.length < 10) {
      res.status(422).json({
        success: false,
        error: { code: 'INVALID_MOBILE', message: 'Please provide a valid 10-digit mobile number.' },
      });
      return;
    }

    const cleanEmail = (data.email || `${cleanMobile}@delivery.eshopy.biz`).toLowerCase().trim();

    const [existingMobile, existingEmail] = await Promise.all([
      DeliveryPartner.findOne({ mobileNumber: cleanMobile }),
      DeliveryPartner.findOne({ email: cleanEmail }),
    ]);

    if (existingMobile) {
      res.status(409).json({
        success: false,
        error: { code: 'MOBILE_EXISTS', message: 'A delivery partner with this mobile number already exists.' },
      });
      return;
    }

    if (existingEmail) {
      res.status(409).json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'A delivery partner with this email already exists.' },
      });
      return;
    }

    const partnerId = await generateNextPartnerId();
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const isCreatedByAdmin = Boolean(
      req.body.createdByAdmin ||
      req.user?.role === 'admin' ||
      req.user?.role === 'super_admin' ||
      req.user?.role === 'order_manager',
    );
    const verifyKycOnCreate = Boolean(isCreatedByAdmin && req.body.verifyKyc);
    const kycDocs = {
      drivingLicenseNumber: data.drivingLicenseNumber || '',
      drivingLicenseUrl: data.drivingLicenseUrl || '',
      vehicleRcUrl: data.vehicleRcUrl || '',
      idProofUrl: data.idProofUrl || '',
    };
    const docsComplete = isPartnerKycComplete({
      vehicleType: data.vehicleType,
      kycDocuments: kycDocs,
    });

    const partner = new DeliveryPartner({
      partnerId,
      name: data.name,
      email: cleanEmail,
      mobileNumber: cleanMobile,
      passwordHash,
      role: 'delivery_partner',
      vehicleType: data.vehicleType,
      vehicleNumber: data.vehicleNumber.toUpperCase(),
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      servicePincodes: parseServicePincodes(data.servicePincodes, data.pincode),
      status: isCreatedByAdmin ? 'active' : 'pending_approval',
      isActive: isCreatedByAdmin,
      kycStatus: verifyKycOnCreate ? 'verified' : docsComplete ? 'submitted' : 'unverified',
      kycVerifiedAt: verifyKycOnCreate ? new Date() : undefined,
      availabilityStatus: 'offline',
      currentLocation:
        typeof data.lat === 'number' && typeof data.lng === 'number' && !Number.isNaN(data.lat) && !Number.isNaN(data.lng)
          ? { lat: data.lat, lng: data.lng, updatedAt: new Date().toISOString() }
          : undefined,
      kycDocuments: kycDocs,
    });

    await partner.save();

    const tokens = buildPartnerTokens(partner);
    setRefreshCookie(res, tokens.refreshToken, 'deliveryRefreshToken', req);
    log.info({ partnerId: partner.partnerId, status: partner.status }, 'Delivery partner registered');

    res.status(201).json({
      success: true,
      data: {
        ...tokens,
        partner: partner.toJSON(),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to register delivery partner.';
    log.error({ err: message }, 'Delivery partner registration failed');
    res.status(500).json({
      success: false,
      error: { code: 'REGISTRATION_FAILED', message },
    });
  }
}

/**
 * POST /api/v1/delivery/login
 */
export async function loginDeliveryPartner(req: Request, res: Response): Promise<void> {
  try {
    const { identifier, mobileNumber, partnerId, password } = req.body || {};
    const loginKey = String(identifier || partnerId || mobileNumber || '').trim();

    if (!loginKey || !password) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_CREDENTIALS', message: 'Partner ID / Mobile number and password are required.' },
      });
      return;
    }

    const escaped = loginKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cleanDigits = loginKey.replace(/\D/g, '');
    const conditions: Record<string, unknown>[] = [
      { partnerId: new RegExp(`^${escaped}$`, 'i') },
      { email: loginKey.toLowerCase() },
    ];

    if (cleanDigits.length >= 10) {
      const tenDigits = cleanDigits.slice(-10);
      conditions.push(
        { mobileNumber: tenDigits },
        { mobileNumber: `+91${tenDigits}` },
        { mobileNumber: `91${tenDigits}` },
      );
    }

    const partner = await DeliveryPartner.findOne({ $or: conditions });
    if (!partner) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid delivery partner credentials.' },
      });
      return;
    }

    if (partner.status === 'suspended') {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'Your delivery partner account has been suspended. Please contact dispatch support.',
        },
      });
      return;
    }

    const isMatch = await bcrypt.compare(String(password), partner.passwordHash);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid delivery partner credentials.' },
      });
      return;
    }

    partner.lastActiveAt = new Date();
    await partner.save();

    const tokens = buildPartnerTokens(partner);
    setRefreshCookie(res, tokens.refreshToken, 'deliveryRefreshToken', req);
    log.info({ partnerId: partner.partnerId }, 'Delivery partner logged in');

    res.json({
      success: true,
      data: {
        ...tokens,
        partner: partner.toJSON(),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Login failed.';
    log.error({ err: message }, 'Error logging in delivery partner');
    res.status(500).json({
      success: false,
      error: { code: 'LOGIN_FAILED', message: 'Login failed. Please try again.' },
    });
  }
}

/**
 * POST /api/v1/delivery/refresh
 */
export async function refreshDeliveryPartner(req: Request, res: Response): Promise<void> {
  try {
    const token = extractRefreshToken(req, ['deliveryRefreshToken', 'refreshToken']);
    if (!token) {
      res.status(401).json({
        success: false,
        error: { code: 'NO_REFRESH_TOKEN', message: 'Delivery partner refresh token missing.' },
      });
      return;
    }

    let payload: { userId: string };
    try {
      payload = verifyRefreshToken(token);
    } catch {
      clearRefreshCookie(res, 'deliveryRefreshToken', req);
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired delivery refresh token.' },
      });
      return;
    }

    const partner = await DeliveryPartner.findById(payload.userId);
    if (!partner || partner.status === 'suspended') {
      clearRefreshCookie(res, 'deliveryRefreshToken', req);
      res.status(401).json({
        success: false,
        error: { code: 'PARTNER_INACTIVE', message: 'Delivery partner account not found or suspended.' },
      });
      return;
    }

    const tokens = buildPartnerTokens(partner);
    setRefreshCookie(res, tokens.refreshToken, 'deliveryRefreshToken', req);

    res.json({
      success: true,
      data: tokens,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to refresh delivery session.';
    log.error({ err: message }, 'Error refreshing delivery partner token');
    res.status(500).json({
      success: false,
      error: { code: 'REFRESH_FAILED', message },
    });
  }
}

/**
 * GET /api/v1/delivery/me
 */
export async function getDeliveryPartnerMe(req: Request, res: Response): Promise<void> {
  try {
    if (req.user?.role !== 'delivery_partner') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Delivery partner access required.' },
      });
      return;
    }

    const partner = await DeliveryPartner.findById(req.user.userId);
    if (!partner) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Delivery partner not found.' },
      });
      return;
    }

    res.json({ success: true, data: partner.toJSON() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load profile.';
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
  }
}

/**
 * PATCH /api/v1/delivery/me
 */
export async function updateDeliveryPartnerMe(req: Request, res: Response): Promise<void> {
  try {
    if (req.user?.role !== 'delivery_partner') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Delivery partner access required.' },
      });
      return;
    }

    const partner = await DeliveryPartner.findById(req.user.userId);
    if (!partner) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Delivery partner not found.' },
      });
      return;
    }

    const {
      name,
      email,
      vehicleType,
      vehicleNumber,
      city,
      state,
      pincode,
      servicePincodes,
      kycDocuments,
      bankDetails,
    } = req.body || {};

    if (name) partner.name = String(name).trim();
    if (email) partner.email = String(email).trim().toLowerCase();
    if (vehicleType && VEHICLE_TYPES.includes(vehicleType)) partner.vehicleType = vehicleType;
    if (vehicleNumber) partner.vehicleNumber = String(vehicleNumber).trim().toUpperCase();
    if (city) partner.city = String(city).trim();
    if (state) partner.state = String(state).trim();
    if (pincode) partner.pincode = String(pincode).trim();
    if (servicePincodes !== undefined) {
      partner.servicePincodes = parseServicePincodes(servicePincodes, partner.pincode);
    }
    if (kycDocuments && typeof kycDocuments === 'object') {
      partner.kycDocuments = {
        ...partner.kycDocuments,
        ...kycDocuments,
      };
      if (isPartnerKycComplete(partner) && partner.kycStatus !== 'verified') {
        partner.kycStatus = 'submitted';
        partner.kycRejectionReason = undefined;
      }
    }
    if (bankDetails && typeof bankDetails === 'object') {
      partner.bankDetails = {
        ...partner.bankDetails,
        ...bankDetails,
      };
    }

    partner.lastActiveAt = new Date();
    await partner.save();

    res.json({ success: true, data: partner.toJSON(), message: 'Profile updated successfully.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update profile.';
    res.status(500).json({ success: false, error: { code: 'UPDATE_FAILED', message } });
  }
}

/**
 * POST /api/v1/delivery/me/documents
 * Upload KYC or profile document for the authenticated delivery partner.
 */
export async function uploadDeliveryPartnerDocument(req: Request, res: Response): Promise<void> {
  try {
    if (req.user?.role !== 'delivery_partner') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Delivery partner access required.' },
      });
      return;
    }

    const docType = String(req.body?.docType || 'drivingLicenseUrl') as (typeof KYC_FIELDS)[number];
    if (!KYC_FIELDS.includes(docType)) {
      res.status(422).json({
        success: false,
        error: { code: 'INVALID_DOC_TYPE', message: `docType must be one of: ${KYC_FIELDS.join(', ')}` },
      });
      return;
    }

    const files = (req as unknown as { files?: Express.Multer.File[] }).files;
    const file = req.file || (Array.isArray(files) ? files[0] : undefined);
    if (!file) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'Please attach an image file.' },
      });
      return;
    }

    const uploaded = await uploadImageWithFallback(file, '/ornate/delivery-kyc');
    const partner = await DeliveryPartner.findByIdAndUpdate(
      req.user.userId,
      {
        $set: {
          [`kycDocuments.${docType}`]: uploaded.url,
          lastActiveAt: new Date(),
        },
      },
      { new: true },
    );

    if (!partner) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Delivery partner not found.' },
      });
      return;
    }

    if (isPartnerKycComplete(partner) && partner.kycStatus !== 'verified') {
      partner.kycStatus = 'submitted';
      partner.kycRejectionReason = undefined;
      await partner.save();
    }

    res.json({
      success: true,
      data: {
        docType,
        url: uploaded.url,
        fileId: uploaded.fileId,
        partner: partner.toJSON(),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Document upload failed.';
    res.status(500).json({ success: false, error: { code: 'UPLOAD_FAILED', message } });
  }
}

/**
 * POST /api/v1/delivery/upload-pod
 * Uploads a Proof of Delivery (POD) photo to ImageKit CDN (with safe fallback).
 */
export async function uploadDeliveryPodPhoto(req: Request, res: Response): Promise<void> {
  try {
    if (req.user?.role !== 'delivery_partner') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Delivery partner access required.' },
      });
      return;
    }

    const files = (req as unknown as { files?: Express.Multer.File[] }).files;
    const file = req.file || (Array.isArray(files) ? files[0] : undefined);
    if (!file) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'Please provide a Proof of Delivery photo.' },
      });
      return;
    }

    const uploaded = await uploadImageWithFallback(file, '/ornate/delivery-pod');
    res.json({
      success: true,
      data: uploaded,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'POD photo upload failed.';
    res.status(500).json({ success: false, error: { code: 'UPLOAD_FAILED', message } });
  }
}

/**
 * PATCH /api/v1/delivery/me/availability
 */
export async function updateDeliveryAvailability(req: Request, res: Response): Promise<void> {
  try {
    if (req.user?.role !== 'delivery_partner') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Delivery partner access required.' },
      });
      return;
    }

    const { availabilityStatus, lat, lng, formattedAddress } = req.body || {};
    if (!['offline', 'online', 'on_delivery'].includes(availabilityStatus)) {
      res.status(422).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'availabilityStatus must be offline, online, or on_delivery.' },
      });
      return;
    }

    const partner = await DeliveryPartner.findById(req.user.userId);
    if (!partner) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Delivery partner not found.' },
      });
      return;
    }

    if (partner.status !== 'active' || !partner.isActive) {
      res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_NOT_ACTIVE', message: 'Your account must be approved by admin before going online.' },
      });
      return;
    }

    if (availabilityStatus === 'offline') {
      if (partner.availabilityStatus === 'on_delivery') {
        res.status(409).json({
          success: false,
          error: {
            code: 'ACTIVE_DELIVERY_IN_PROGRESS',
            message: 'Complete or cancel your active delivery before going offline.',
          },
        });
        return;
      }
      partner.availabilityStatus = 'offline';
      partner.lastActiveAt = new Date();
      await partner.save();
      res.json({ success: true, data: partner.toJSON() });
      return;
    }

    if (partner.kycStatus !== 'verified') {
      res.status(403).json({
        success: false,
        error: {
          code: 'KYC_NOT_VERIFIED',
          message:
            partner.kycStatus === 'rejected'
              ? `KYC was rejected (${partner.kycRejectionReason || 're-upload documents'}).`
              : 'Complete KYC uploads and wait for admin verification before going online.',
        },
      });
      return;
    }

    const hasIncomingCoords =
      typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng);
    const recentStoredTimestamp = partner.currentLocation?.updatedAt
      ? Date.parse(partner.currentLocation.updatedAt)
      : NaN;
    const hasFreshStoredCoords =
      typeof partner.currentLocation?.lat === 'number' &&
      typeof partner.currentLocation?.lng === 'number' &&
      !Number.isNaN(recentStoredTimestamp) &&
      Date.now() - recentStoredTimestamp <= 15 * 60_000;

    if (!hasIncomingCoords && !hasFreshStoredCoords) {
      res.status(422).json({
        success: false,
        error: {
          code: 'GPS_REQUIRED',
          message: 'Live GPS location is required to go online. Enable location services and retry.',
        },
      });
      return;
    }

    partner.availabilityStatus = availabilityStatus;
    partner.lastActiveAt = new Date();
    if (hasIncomingCoords) {
      partner.currentLocation = {
        lat,
        lng,
        formattedAddress: formattedAddress || partner.currentLocation?.formattedAddress,
        updatedAt: new Date().toISOString(),
      };
    }

    await partner.save();
    res.json({ success: true, data: partner.toJSON() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update availability.';
    res.status(500).json({ success: false, error: { code: 'UPDATE_FAILED', message } });
  }
}

/**
 * POST /api/v1/delivery/me/location
 */
export async function updateDeliveryLocation(req: Request, res: Response): Promise<void> {
  try {
    if (req.user?.role !== 'delivery_partner') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Delivery partner access required.' },
      });
      return;
    }

    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      res.status(422).json({
        success: false,
        error: { code: 'INVALID_COORDINATES', message: 'Valid numeric lat and lng are required.' },
      });
      return;
    }

    const updated = await DeliveryPartner.findByIdAndUpdate(
      req.user.userId,
      {
        $set: {
          currentLocation: {
            lat,
            lng,
            formattedAddress: req.body?.formattedAddress || undefined,
            updatedAt: new Date().toISOString(),
          },
          lastActiveAt: new Date(),
        },
      },
      { new: true },
    );

    if (!updated) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Delivery partner not found.' },
      });
      return;
    }

    res.json({ success: true, data: updated.toJSON() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update location.';
    res.status(500).json({ success: false, error: { code: 'UPDATE_FAILED', message } });
  }
}

// ==========================================
// ADMIN DELIVERY PARTNER CONTROLLERS
// ==========================================

/**
 * GET /api/v1/admin/delivery-partners
 */
export async function adminListDeliveryPartners(req: Request, res: Response): Promise<void> {
  try {
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const availability = String(req.query.availability || '').trim();

    const filter: Record<string, unknown> = {};
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { partnerId: regex },
        { name: regex },
        { mobileNumber: regex },
        { email: regex },
        { vehicleNumber: regex },
        { city: regex },
        { pincode: regex },
      ];
    }
    if (status) filter.status = status;
    if (availability) filter.availabilityStatus = availability;

    const partners = await DeliveryPartner.find(filter).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: partners.map((p) => p.toJSON()),
      total: partners.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list delivery partners.';
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
  }
}

/**
 * POST /api/v1/admin/delivery-partners
 */
export async function adminCreateDeliveryPartner(req: Request, res: Response): Promise<void> {
  req.body.createdByAdmin = true;
  return registerDeliveryPartner(req, res);
}

/**
 * PATCH /api/v1/admin/delivery-partners/:id/status
 */
export async function adminUpdateDeliveryPartnerStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status, isActive } = req.body || {};

    const partner = await DeliveryPartner.findById(id);
    if (!partner) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Delivery partner not found.' },
      });
      return;
    }

    if (status && ['active', 'pending_approval', 'suspended'].includes(status)) {
      partner.status = status;
      partner.isActive = status === 'active';
      if (status !== 'active') {
        partner.availabilityStatus = 'offline';
      }
    }

    if (typeof isActive === 'boolean') {
      partner.isActive = isActive;
      partner.status = isActive ? 'active' : 'pending_approval';
      if (!isActive) partner.availabilityStatus = 'offline';
    }

    await partner.save();
    res.json({ success: true, data: partner.toJSON() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update status.';
    res.status(500).json({ success: false, error: { code: 'UPDATE_FAILED', message } });
  }
}

/**
 * PATCH /api/v1/admin/delivery-partners/:id/password
 */
export async function adminResetDeliveryPartnerPassword(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { password } = req.body || {};
    if (!password || String(password).length < 6) {
      res.status(422).json({
        success: false,
        error: { code: 'INVALID_PASSWORD', message: 'Password must be at least 6 characters.' },
      });
      return;
    }

    const partner =
      (await DeliveryPartner.findById(id).catch(() => null)) ||
      (await DeliveryPartner.findOne({ $or: [{ partnerId: id }, { mobileNumber: id }] }));

    if (!partner) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Delivery partner not found.' },
      });
      return;
    }

    partner.passwordHash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
    await partner.save();

    res.json({ success: true, message: 'Delivery partner password reset successfully.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to reset password.';
    res.status(500).json({ success: false, error: { code: 'RESET_FAILED', message } });
  }
}

/**
 * POST /api/v1/admin/delivery-partners/:id/settle-cod
 * Reduces cashInHandPaise after partner deposits COD cash to the hub.
 */
export async function adminSettleDeliveryPartnerCod(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const partner = await DeliveryPartner.findById(id);
    if (!partner) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Delivery partner not found.' },
      });
      return;
    }

    const amountPaise =
      req.body?.amountPaise !== undefined
        ? Math.max(0, Math.round(Number(req.body.amountPaise)))
        : partner.cashInHandPaise;

    const settledAmount = Math.min(partner.cashInHandPaise, amountPaise);
    partner.cashInHandPaise = Math.max(0, partner.cashInHandPaise - settledAmount);
    await partner.save();

    res.json({
      success: true,
      data: partner.toJSON(),
      message: `Settled ₹${(settledAmount / 100).toFixed(2)} COD cash in hand.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to settle COD cash.';
    res.status(500).json({ success: false, error: { code: 'SETTLE_FAILED', message } });
  }
}

/**
 * DELETE /api/v1/admin/delivery-partners/:id
 */
export async function adminDeleteDeliveryPartner(req: Request, res: Response): Promise<void> {
  try {
    const partner = await DeliveryPartner.findByIdAndDelete(req.params.id);
    if (!partner) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Delivery partner not found.' },
      });
      return;
    }
    res.json({ success: true, message: 'Delivery partner deleted successfully.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete delivery partner.';
    res.status(500).json({ success: false, error: { code: 'DELETE_FAILED', message } });
  }
}

/**
 * PATCH /api/v1/admin/delivery-partners/:id/kyc
 * Admin verifies or rejects partner KYC documents.
 */
export async function adminUpdateDeliveryPartnerKyc(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { kycStatus, reason } = req.body || {};

    if (!['unverified', 'submitted', 'verified', 'rejected'].includes(kycStatus)) {
      res.status(422).json({
        success: false,
        error: { code: 'INVALID_KYC_STATUS', message: 'Invalid kycStatus value.' },
      });
      return;
    }

    if (kycStatus === 'rejected' && !String(reason || '').trim()) {
      res.status(422).json({
        success: false,
        error: { code: 'REASON_REQUIRED', message: 'Provide a rejection reason when rejecting KYC.' },
      });
      return;
    }

    const partner = await DeliveryPartner.findById(id);
    if (!partner) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Delivery partner not found.' },
      });
      return;
    }

    partner.kycStatus = kycStatus;
    if (kycStatus === 'verified') {
      partner.kycVerifiedAt = new Date();
      partner.kycRejectionReason = undefined;
      if (partner.status === 'pending_approval') {
        partner.status = 'active';
        partner.isActive = true;
      }
    } else {
      partner.kycVerifiedAt = undefined;
      partner.availabilityStatus = 'offline';
      partner.kycRejectionReason = kycStatus === 'rejected' ? String(reason).trim() : undefined;
    }

    await partner.save();
    res.json({ success: true, data: partner.toJSON() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update KYC status.';
    res.status(500).json({ success: false, error: { code: 'UPDATE_FAILED', message } });
  }
}

// ==========================================
// DELIVERY ANDROID APK RELEASE & REDIRECT ENDPOINTS
// ==========================================

/**
 * GET /api/v1/delivery/app-release
 */
export async function getDeliveryAppRelease(_req: Request, res: Response): Promise<void> {
  try {
    const info = await getDeliveryAppReleaseInfo();
    res.json({ success: true, data: info });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load app release info.';
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
  }
}

/**
 * GET /api/v1/delivery/app-download
 * Redirects browser or native downloader to whichever hosted APK link (GitHub Releases / Cloudflare R2 / Play Store) is configured.
 */
export async function downloadDeliveryAppApk(_req: Request, res: Response): Promise<void> {
  try {
    const info = await getDeliveryAppReleaseInfo();
    const targetUrl = info.apkUrl || info.playStoreUrl || '';

    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      res.status(404).json({
        success: false,
        error: {
          code: 'APK_NOT_CONFIGURED',
          message: 'Android APK download link has not been configured yet. Set it in Admin Portal or DELIVERY_APK_URL.',
        },
      });
      return;
    }

    res.redirect(302, targetUrl);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to resolve download link.';
    res.status(500).json({ success: false, error: { code: 'DOWNLOAD_ERROR', message } });
  }
}

/**
 * PUT /api/v1/admin/delivery-app-release
 */
export async function adminUpdateDeliveryAppRelease(req: Request, res: Response): Promise<void> {
  try {
    const {
      versionName,
      versionCode,
      minSupportedVersionCode,
      apkUrl,
      playStoreUrl,
      releaseNotes,
      forceUpdate,
    } = req.body || {};

    const cleanApkUrl = String(apkUrl || '').trim();
    const cleanPlayStoreUrl = String(playStoreUrl || '').trim();

    if (cleanApkUrl && !/^https?:\/\//i.test(cleanApkUrl)) {
      res.status(422).json({
        success: false,
        error: { code: 'INVALID_URL', message: 'apkUrl must start with http:// or https://' },
      });
      return;
    }
    if (cleanPlayStoreUrl && !/^https?:\/\//i.test(cleanPlayStoreUrl)) {
      res.status(422).json({
        success: false,
        error: { code: 'INVALID_URL', message: 'playStoreUrl must start with http:// or https://' },
      });
      return;
    }

    const codeNum = Number(versionCode ?? 100);
    const minNum = Number(minSupportedVersionCode ?? codeNum);
    if (!Number.isInteger(codeNum) || codeNum < 1 || !Number.isInteger(minNum) || minNum < 1) {
      res.status(422).json({
        success: false,
        error: { code: 'INVALID_VERSION_CODE', message: 'versionCode and minSupportedVersionCode must be positive integers.' },
      });
      return;
    }

    await AppRelease.findOneAndUpdate(
      { key: 'delivery_android' },
      {
        $set: {
          key: 'delivery_android',
          versionName: String(versionName || '1.0.0').trim(),
          versionCode: codeNum,
          minSupportedVersionCode: minNum,
          apkUrl: cleanApkUrl,
          playStoreUrl: cleanPlayStoreUrl,
          releaseNotes: String(releaseNotes || '').trim(),
          forceUpdate: Boolean(forceUpdate),
          updatedBy: req.user?.email || 'Admin',
        },
      },
      { upsert: true, new: true },
    );

    const updatedInfo = await getDeliveryAppReleaseInfo();
    res.json({ success: true, data: updatedInfo, message: 'Delivery APK release settings saved.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save release settings.';
    res.status(500).json({ success: false, error: { code: 'UPDATE_FAILED', message } });
  }
}
