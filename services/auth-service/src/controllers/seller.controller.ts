import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { mongoose } from '@ornate/db';
import { Seller, generateNextSellerId } from '../models/seller.model.js';
import { lookupSellerReferralCode } from '../utils/referral.js';
import { signAccessToken, signRefreshToken } from '../utils/jwt.js';
import { createLogger } from '@ornate/logger';

const log = createLogger('seller-controller');
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12);

function getCatalogDb() {
  const conn: any = mongoose.connection;
  const client = typeof conn.getClient === 'function' ? conn.getClient() : conn.client;
  const dbName = process.env.PRODUCT_DB_NAME ?? 'ornate_products';
  return client ? client.db(dbName) : mongoose.connection.useDb(dbName).db;
}

/**
 * GET /api/v1/seller/verify-referral?code=XYZ
 * Verifies a sponsor code (must be from a vendor or an existing seller).
 */
export async function verifySellerReferral(req: Request, res: Response): Promise<void> {
  const code = String(req.query.code || req.body?.code || '').trim();
  if (!code) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Referral code is required.' },
    });
    return;
  }

  const result = await lookupSellerReferralCode(code);
  if (!result.valid) {
    res.status(404).json({
      success: false,
      error: { code: 'INVALID_REFERRAL_CODE', message: result.message || 'Invalid sponsor code.' },
    });
    return;
  }

  res.json({
    success: true,
    data: {
      valid: true,
      referralCode: result.referralCode,
      referralName: result.referralName,
      referralType: result.referralType,
    },
  });
}

/**
 * GET /api/v1/seller/categories/available
 * Returns all active categories with availability flag (each category can have only one seller).
 */
export async function getAvailableCategories(_req: Request, res: Response): Promise<void> {
  try {
    const catalogDb = getCatalogDb();
    const categories = await catalogDb.collection('categories').find({ isActive: true }).sort({ order: 1, name: 1 }).toArray();

    // Find all active sellers and map their categoryId
    const activeSellers = await Seller.find({ isActive: true, status: { $ne: 'suspended' } }).select('categoryId sellerId storeId name');
    const sellerMap = new Map<string, { sellerId: string; storeId?: string; name: string }>();

    for (const s of activeSellers) {
      if (s.categoryId) {
        const id = s.sellerId || s.storeId || '';
        sellerMap.set(String(s.categoryId), { sellerId: id, storeId: id, name: s.name });
      }
    }

    const result = categories.map((cat: any) => {
      const catId = cat._id.toString();
      const claimed = sellerMap.get(catId);
      return {
        id: catId,
        _id: catId,
        name: cat.name,
        slug: cat.slug,
        description: cat.description || '',
        image: cat.image || '',
        isAvailable: !claimed,
        claimedBySeller: claimed || null,
        claimedByStore: claimed || null,
      };
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    log.error({ err }, 'Failed to fetch available categories for seller');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch categories.' },
    });
  }
}

/**
 * POST /api/v1/seller/register
 * Registers a new seller. Validates sponsor, category exclusivity, coordinates, and creates credentials.
 */
export async function registerSeller(req: Request, res: Response): Promise<void> {
  try {
    const {
      name,
      ownerName,
      email,
      mobileNumber,
      password,
      categoryId,
      categoryName,
      categorySlug,
      referralCode,
      address,
      location,
    } = req.body;

    const cleanMobile = String(mobileNumber || '').replace(/\D/g, '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(name || '').trim();
    const cleanOwnerName = String(ownerName || '').trim();
    const cleanReferral = String(referralCode || '').trim();

    if (!cleanName || !cleanOwnerName || !cleanMobile || !password || !categoryId || !cleanReferral) {
      res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Seller name, owner name, mobile, password, category, and sponsor code are required.' },
      });
      return;
    }

    if (cleanMobile.length < 10) {
      res.status(422).json({
        success: false,
        error: { code: 'INVALID_MOBILE', message: 'Please provide a valid 10-digit mobile number.' },
      });
      return;
    }

    if (String(password).length < 6) {
      res.status(422).json({
        success: false,
        error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 6 characters.' },
      });
      return;
    }

    // 1. Verify referral code
    const refResult = await lookupSellerReferralCode(cleanReferral);
    if (!refResult.valid) {
      res.status(422).json({
        success: false,
        error: { code: 'INVALID_REFERRAL_CODE', message: refResult.message || 'Invalid referral code.' },
      });
      return;
    }

    // 2. Verify category exclusivity
    const existingCategorySeller = await Seller.findOne({
      categoryId: String(categoryId),
      isActive: true,
      status: { $ne: 'suspended' },
    });
    if (existingCategorySeller) {
      res.status(422).json({
        success: false,
        error: { code: 'CATEGORY_ALREADY_TAKEN', message: `This category is already assigned to seller "${existingCategorySeller.name}" (${existingCategorySeller.sellerId || existingCategorySeller.storeId}). Each category can only have one seller.` },
      });
      return;
    }

    // 3. Verify unique mobile and email
    const existingMobile = await Seller.findOne({ mobileNumber: cleanMobile });
    if (existingMobile) {
      res.status(409).json({
        success: false,
        error: { code: 'MOBILE_EXISTS', message: 'A seller with this mobile number already exists.' },
      });
      return;
    }

    if (cleanEmail) {
      const existingEmail = await Seller.findOne({ email: cleanEmail });
      if (existingEmail) {
        res.status(409).json({
          success: false,
          error: { code: 'EMAIL_EXISTS', message: 'A seller with this email already exists.' },
        });
        return;
      }
    }

    // 4. Validate or fetch category details if not provided
    let finalCatName = categoryName;
    let finalCatSlug = categorySlug;
    if (!finalCatName || !finalCatSlug) {
      try {
        const catalogDb = getCatalogDb();
        const catDoc = await catalogDb.collection('categories').findOne({
          $or: [
            { _id: new mongoose.Types.ObjectId(categoryId) },
            { id: String(categoryId) },
          ],
        });
        if (catDoc) {
          finalCatName = catDoc.name;
          finalCatSlug = catDoc.slug;
        }
      } catch {
        // fallback
      }
    }

    // 5. Generate unique Seller ID
    const sellerId = await generateNextSellerId();

    // 6. Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // 7. Validate location
    const lat = Number(location?.lat ?? 12.9716);
    const lng = Number(location?.lng ?? 77.5946);

    const typeOfSeller = String(req.body.typeOfSeller || req.body.typeOfStore || 'Standard').trim();
    const isCreatedByAdmin = Boolean(
      req.body.createdByAdmin ||
      (req as any).user?.role === 'admin' ||
      (req as any).user?.role === 'super_admin'
    );
    const initialStatus = isCreatedByAdmin ? 'active' : 'pending_approval';
    const initialIsActive = isCreatedByAdmin;

    const seller = new Seller({
      sellerId,
      storeId: sellerId,
      name: cleanName,
      typeOfSeller,
      typeOfStore: typeOfSeller,
      ownerName: cleanOwnerName,
      email: cleanEmail || `${cleanMobile}@seller.eshopy.biz`,
      mobileNumber: cleanMobile,
      passwordHash,
      role: 'seller',
      categoryId: String(categoryId),
      categoryName: finalCatName || 'General',
      categorySlug: finalCatSlug || 'general',
      referralCode: refResult.referralCode,
      referralName: refResult.referralName,
      referralType: refResult.referralType,
      address: {
        line1: address?.line1 || '',
        line2: address?.line2 || '',
        city: address?.city || '',
        state: address?.state || '',
        pincode: address?.pincode || '',
        country: address?.country || 'India',
      },
      location: {
        lat,
        lng,
        formattedAddress: location?.formattedAddress || `${address?.line1 || ''}, ${address?.city || ''}, ${address?.state || ''}`,
      },
      status: initialStatus,
      isActive: initialIsActive,
    });

    await seller.save();

    const accessToken = signAccessToken({
      userId: seller._id.toString(),
      email: seller.email,
      role: 'seller',
      sellerId: seller.sellerId,
      storeId: seller.sellerId,
      categoryId: seller.categoryId,
    });
    const refreshToken = signRefreshToken({ userId: seller._id.toString() });

    log.info({ sellerId: seller.sellerId, name: seller.name }, 'Seller registered successfully');

    const sellerJson = seller.toJSON();
    res.status(201).json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        seller: sellerJson,
        store: sellerJson,
      },
    });
  } catch (err: any) {
    log.error({ err }, 'Error registering seller');
    res.status(500).json({
      success: false,
      error: { code: 'REGISTRATION_FAILED', message: err.message || 'Failed to register seller.' },
    });
  }
}

/**
 * POST /api/v1/seller/login
 * Seller portal authentication via mobile / seller ID + password.
 */
export async function loginSeller(req: Request, res: Response): Promise<void> {
  try {
    const { identifier, username, mobileNumber, password } = req.body;
    const loginKey = String(identifier || username || mobileNumber || '').trim();

    if (!loginKey || !password) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_CREDENTIALS', message: 'Seller ID / Mobile number and password are required.' },
      });
      return;
    }

    const cleanDigits = loginKey.replace(/\D/g, '');
    const queryConditions: any[] = [
      { sellerId: new RegExp(`^${loginKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      { storeId: new RegExp(`^${loginKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      { email: loginKey.toLowerCase() },
    ];
    if (cleanDigits.length >= 10) {
      const tenDigits = cleanDigits.slice(-10);
      queryConditions.push(
        { mobileNumber: tenDigits },
        { mobileNumber: `+91${tenDigits}` },
        { mobileNumber: `91${tenDigits}` },
        { mobileNumber: new RegExp(`${tenDigits}$`) },
      );
    }

    let seller = await Seller.findOne({ $or: queryConditions });
    if (!seller) {
      // Fallback check against 'sellers' collection in case document is in sellers
      try {
        const authDb = mongoose.connection.useDb(process.env.AUTH_DB_NAME || 'ornate_auth').db;
        if (authDb) {
          const rawSeller = await authDb.collection('sellers').findOne({ $or: queryConditions });
          if (rawSeller) {
            seller = new Seller(rawSeller);
          }
        }
      } catch (err) {
        log.warn({ err }, 'Fallback query to sellers collection failed');
      }
    }

    if (!seller) {
      log.warn({ loginKey, cleanDigits }, 'Seller not found during login attempt');
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid seller login credentials.' },
      });
      return;
    }

    if (seller.status === 'suspended') {
      res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_SUSPENDED', message: 'Your seller account has been suspended. Please contact administrator.' },
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, seller.passwordHash);
    if (!isMatch) {
      log.warn({ loginKey, sellerId: seller.sellerId || seller.storeId }, 'Seller password mismatch');
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid seller login credentials.' },
      });
      return;
    }

    const effectiveId = seller.sellerId || seller.storeId || '';
    const accessToken = signAccessToken({
      userId: seller._id.toString(),
      email: seller.email,
      role: 'seller',
      sellerId: effectiveId,
      storeId: effectiveId,
      categoryId: seller.categoryId,
    });
    const refreshToken = signRefreshToken({ userId: seller._id.toString() });

    log.info({ sellerId: effectiveId }, 'Seller logged in successfully');

    const sellerJson = seller.toJSON();
    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        seller: sellerJson,
        store: sellerJson,
      },
    });
  } catch (err: any) {
    log.error({ err }, 'Error logging in seller');
    res.status(500).json({
      success: false,
      error: { code: 'LOGIN_FAILED', message: 'Login failed. Please try again.' },
    });
  }
}

/**
 * GET /api/v1/seller/me
 * Retrieves authenticated seller's profile.
 */
export async function getSellerMe(req: Request, res: Response): Promise<void> {
  try {
    const seller = await Seller.findById(req.user?.userId);
    if (!seller) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Seller not found.' },
      });
      return;
    }

    res.json({
      success: true,
      data: seller.toJSON(),
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * PATCH /api/v1/seller/me
 * Updates seller profile / location.
 */
export async function updateSellerMe(req: Request, res: Response): Promise<void> {
  try {
    const { name, ownerName, email, address, location } = req.body;
    const seller = await Seller.findById(req.user?.userId);
    if (!seller) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Seller not found.' },
      });
      return;
    }

    if (name) seller.name = String(name).trim();
    if (ownerName) seller.ownerName = String(ownerName).trim();
    if (email) seller.email = String(email).trim().toLowerCase();
    if (address) {
      seller.address = {
        line1: address.line1 ?? seller.address.line1,
        line2: address.line2 ?? seller.address.line2,
        city: address.city ?? seller.address.city,
        state: address.state ?? seller.address.state,
        pincode: address.pincode ?? seller.address.pincode,
        country: address.country ?? seller.address.country,
      };
    }
    if (location) {
      seller.location = {
        lat: Number(location.lat ?? seller.location.lat),
        lng: Number(location.lng ?? seller.location.lng),
        formattedAddress: location.formattedAddress ?? seller.location.formattedAddress,
      };
    }

    await seller.save();

    res.json({
      success: true,
      data: seller.toJSON(),
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: err.message },
    });
  }
}

// ==========================================
// ADMIN SELLER ENDPOINTS
// ==========================================

/**
 * GET /api/v1/admin/sellers
 * Lists all registered sellers for admin with optional search and category filters.
 */
export async function adminListSellers(req: Request, res: Response): Promise<void> {
  try {
    const search = String(req.query.search || '').trim();
    const categoryId = String(req.query.categoryId || '').trim();
    const status = String(req.query.status || '').trim();

    const filter: any = {};
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { sellerId: regex },
        { storeId: regex },
        { name: regex },
        { ownerName: regex },
        { mobileNumber: regex },
        { email: regex },
        { 'address.city': regex },
      ];
    }
    if (categoryId) filter.categoryId = categoryId;
    if (status) filter.status = status;

    const sellers = await Seller.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: sellers.map((s) => s.toJSON()),
      total: sellers.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * POST /api/v1/admin/sellers
 * Admin adds a new seller directly.
 */
export async function adminCreateSeller(req: Request, res: Response): Promise<void> {
  req.body.createdByAdmin = true;
  return registerSeller(req, res);
}

/**
 * PATCH /api/v1/admin/sellers/:id/status
 * Updates status of a seller (active, pending_approval, suspended).
 */
export async function adminUpdateSellerStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status, isActive } = req.body;

    const seller = await Seller.findById(id);
    if (!seller) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Seller not found.' },
      });
      return;
    }

    if (status) {
      seller.status = status;
      seller.isActive = status === 'active';
    }
    if (typeof isActive === 'boolean') {
      seller.isActive = isActive;
      if (!isActive && seller.status === 'active') {
        seller.status = 'pending_approval';
      } else if (isActive && seller.status !== 'active') {
        seller.status = 'active';
      }
    }

    await seller.save();

    res.json({
      success: true,
      data: seller.toJSON(),
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: err.message },
    });
  }
}

/**
 * DELETE /api/v1/admin/sellers/:id
 */
export async function adminDeleteSeller(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const seller = await Seller.findByIdAndDelete(id);
    if (!seller) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Seller not found.' },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Seller deleted successfully.',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_FAILED', message: err.message },
    });
  }
}

/**
 * PATCH /api/v1/admin/sellers/:id/password
 * Admin resets a seller's password.
 */
export async function adminResetSellerPassword(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || String(password).length < 6) {
      res.status(422).json({
        success: false,
        error: { code: 'INVALID_PASSWORD', message: 'Password must be at least 6 characters.' },
      });
      return;
    }

    const seller = (await Seller.findById(id)) || (await Seller.findOne({ $or: [{ sellerId: id }, { storeId: id }, { mobileNumber: id }] }));
    if (!seller) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Seller not found.' },
      });
      return;
    }

    const newHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    seller.passwordHash = newHash;
    await seller.save();

    res.json({
      success: true,
      message: 'Seller password reset successfully.',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'RESET_FAILED', message: err.message },
    });
  }
}

// Backward compatibility aliases
export const verifyStoreReferral = verifySellerReferral;
export const registerStore = registerSeller;
export const loginStore = loginSeller;
export const getStoreMe = getSellerMe;
export const updateStoreMe = updateSellerMe;
export const adminListStores = adminListSellers;
export const adminCreateStore = adminCreateSeller;
export const adminUpdateStoreStatus = adminUpdateSellerStatus;
export const adminDeleteStore = adminDeleteSeller;
export const adminResetStorePassword = adminResetSellerPassword;

