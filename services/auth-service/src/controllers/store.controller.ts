import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { mongoose } from '@ornate/db';
import { Store, generateNextStoreId } from '../models/store.model.js';
import { lookupStoreReferralCode } from '../utils/referral.js';
import { signAccessToken, signRefreshToken } from '../utils/jwt.js';
import { createLogger } from '@ornate/logger';

const log = createLogger('store-controller');
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12);

function getCatalogDb() {
  const conn: any = mongoose.connection;
  const client = typeof conn.getClient === 'function' ? conn.getClient() : conn.client;
  const dbName = process.env.PRODUCT_DB_NAME ?? 'ornate_products';
  return client ? client.db(dbName) : mongoose.connection.useDb(dbName).db;
}

/**
 * GET /api/v1/store/verify-referral?code=XYZ
 * Verifies a sponsor code (must be from a vendor or an existing store).
 */
export async function verifyStoreReferral(req: Request, res: Response): Promise<void> {
  const code = String(req.query.code || req.body?.code || '').trim();
  if (!code) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Referral code is required.' },
    });
    return;
  }

  const result = await lookupStoreReferralCode(code);
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
 * GET /api/v1/store/categories/available
 * Returns all active categories with availability flag (each category can have only one store).
 */
export async function getAvailableCategories(_req: Request, res: Response): Promise<void> {
  try {
    const catalogDb = getCatalogDb();
    const categories = await catalogDb.collection('categories').find({ isActive: true }).sort({ order: 1, name: 1 }).toArray();

    // Find all active stores and map their categoryId
    const activeStores = await Store.find({ isActive: true, status: { $ne: 'suspended' } }).select('categoryId storeId name');
    const storeMap = new Map<string, { storeId: string; name: string }>();

    for (const s of activeStores) {
      if (s.categoryId) {
        storeMap.set(String(s.categoryId), { storeId: s.storeId, name: s.name });
      }
    }

    const result = categories.map((cat: any) => {
      const catId = cat._id.toString();
      const claimed = storeMap.get(catId);
      return {
        id: catId,
        _id: catId,
        name: cat.name,
        slug: cat.slug,
        description: cat.description || '',
        image: cat.image || '',
        isAvailable: !claimed,
        claimedByStore: claimed || null,
      };
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    log.error({ err }, 'Failed to fetch available categories for store');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch categories.' },
    });
  }
}

/**
 * POST /api/v1/store/register
 * Registers a new store. Validates sponsor, category exclusivity, coordinates, and creates credentials.
 */
export async function registerStore(req: Request, res: Response): Promise<void> {
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
        error: { code: 'VALIDATION_ERROR', message: 'Store name, owner name, mobile, password, category, and sponsor code are required.' },
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
    const refResult = await lookupStoreReferralCode(cleanReferral);
    if (!refResult.valid) {
      res.status(422).json({
        success: false,
        error: { code: 'INVALID_REFERRAL_CODE', message: refResult.message || 'Invalid referral code.' },
      });
      return;
    }

    // 2. Verify category exclusivity
    const existingCategoryStore = await Store.findOne({
      categoryId: String(categoryId),
      isActive: true,
      status: { $ne: 'suspended' },
    });
    if (existingCategoryStore) {
      res.status(422).json({
        success: false,
        error: { code: 'CATEGORY_ALREADY_TAKEN', message: `This category is already assigned to store "${existingCategoryStore.name}" (${existingCategoryStore.storeId}). Each category can only have one store.` },
      });
      return;
    }

    // 3. Verify unique mobile and email
    const existingMobile = await Store.findOne({ mobileNumber: cleanMobile });
    if (existingMobile) {
      res.status(409).json({
        success: false,
        error: { code: 'MOBILE_EXISTS', message: 'A store with this mobile number already exists.' },
      });
      return;
    }

    if (cleanEmail) {
      const existingEmail = await Store.findOne({ email: cleanEmail });
      if (existingEmail) {
        res.status(409).json({
          success: false,
          error: { code: 'EMAIL_EXISTS', message: 'A store with this email already exists.' },
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

    // 5. Generate unique Store ID
    const storeId = await generateNextStoreId();

    // 6. Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // 7. Validate location
    const lat = Number(location?.lat ?? 12.9716);
    const lng = Number(location?.lng ?? 77.5946);

    const typeOfStore = String(req.body.typeOfStore || 'Standard').trim();
    const isCreatedByAdmin = Boolean(
      req.body.createdByAdmin ||
      (req as any).user?.role === 'admin' ||
      (req as any).user?.role === 'super_admin'
    );
    const initialStatus = isCreatedByAdmin ? 'active' : 'pending_approval';
    const initialIsActive = isCreatedByAdmin;

    const store = new Store({
      storeId,
      name: cleanName,
      typeOfStore,
      ownerName: cleanOwnerName,
      email: cleanEmail || `${cleanMobile}@store.eshopy.biz`,
      mobileNumber: cleanMobile,
      passwordHash,
      role: 'store',
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

    await store.save();

    const accessToken = signAccessToken({
      userId: store._id.toString(),
      email: store.email,
      role: 'store',
      storeId: store.storeId,
      categoryId: store.categoryId,
    });
    const refreshToken = signRefreshToken({ userId: store._id.toString() });

    log.info({ storeId: store.storeId, name: store.name }, 'Store registered successfully');

    res.status(201).json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        store: store.toJSON(),
      },
    });
  } catch (err: any) {
    log.error({ err }, 'Error registering store');
    res.status(500).json({
      success: false,
      error: { code: 'REGISTRATION_FAILED', message: err.message || 'Failed to register store.' },
    });
  }
}

/**
 * POST /api/v1/store/login
 * Store portal authentication via mobile / store ID + password.
 */
export async function loginStore(req: Request, res: Response): Promise<void> {
  try {
    const { identifier, username, mobileNumber, password } = req.body;
    const loginKey = String(identifier || username || mobileNumber || '').trim();

    if (!loginKey || !password) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_CREDENTIALS', message: 'Store ID / Mobile number and password are required.' },
      });
      return;
    }

    const cleanDigits = loginKey.replace(/\D/g, '');
    const queryConditions: any[] = [
      { storeId: new RegExp(`^${loginKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      { email: loginKey.toLowerCase() },
    ];
    if (cleanDigits.length >= 10) {
      queryConditions.push({ mobileNumber: cleanDigits.slice(-10) });
    }

    const store = await Store.findOne({ $or: queryConditions });
    if (!store) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid store login credentials.' },
      });
      return;
    }

    if (store.status === 'suspended') {
      res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_SUSPENDED', message: 'Your store account has been suspended. Please contact administrator.' },
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, store.passwordHash);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid store login credentials.' },
      });
      return;
    }

    const accessToken = signAccessToken({
      userId: store._id.toString(),
      email: store.email,
      role: 'store',
      storeId: store.storeId,
      categoryId: store.categoryId,
    });
    const refreshToken = signRefreshToken({ userId: store._id.toString() });

    log.info({ storeId: store.storeId }, 'Store logged in successfully');

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        store: store.toJSON(),
      },
    });
  } catch (err: any) {
    log.error({ err }, 'Error logging in store');
    res.status(500).json({
      success: false,
      error: { code: 'LOGIN_FAILED', message: 'Login failed. Please try again.' },
    });
  }
}

/**
 * GET /api/v1/store/me
 * Retrieves authenticated store's profile.
 */
export async function getStoreMe(req: Request, res: Response): Promise<void> {
  try {
    const store = await Store.findById(req.user?.userId);
    if (!store) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Store not found.' },
      });
      return;
    }

    res.json({
      success: true,
      data: store.toJSON(),
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * PATCH /api/v1/store/me
 * Updates store profile / location.
 */
export async function updateStoreMe(req: Request, res: Response): Promise<void> {
  try {
    const { name, ownerName, email, address, location } = req.body;
    const store = await Store.findById(req.user?.userId);
    if (!store) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Store not found.' },
      });
      return;
    }

    if (name) store.name = String(name).trim();
    if (ownerName) store.ownerName = String(ownerName).trim();
    if (email) store.email = String(email).trim().toLowerCase();
    if (address) {
      store.address = {
        line1: address.line1 ?? store.address.line1,
        line2: address.line2 ?? store.address.line2,
        city: address.city ?? store.address.city,
        state: address.state ?? store.address.state,
        pincode: address.pincode ?? store.address.pincode,
        country: address.country ?? store.address.country,
      };
    }
    if (location) {
      store.location = {
        lat: Number(location.lat ?? store.location.lat),
        lng: Number(location.lng ?? store.location.lng),
        formattedAddress: location.formattedAddress ?? store.location.formattedAddress,
      };
    }

    await store.save();

    res.json({
      success: true,
      data: store.toJSON(),
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: err.message },
    });
  }
}

// ==========================================
// ADMIN STORE ENDPOINTS
// ==========================================

/**
 * GET /api/v1/admin/stores
 * Lists all registered stores for admin with optional search and category filters.
 */
export async function adminListStores(req: Request, res: Response): Promise<void> {
  try {
    const search = String(req.query.search || '').trim();
    const categoryId = String(req.query.categoryId || '').trim();
    const status = String(req.query.status || '').trim();

    const filter: any = {};
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
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

    const stores = await Store.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: stores.map((s) => s.toJSON()),
      total: stores.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * POST /api/v1/admin/stores
 * Admin adds a new store directly.
 */
export async function adminCreateStore(req: Request, res: Response): Promise<void> {
  // Mark as created by admin so status is automatically active
  req.body.createdByAdmin = true;
  return registerStore(req, res);
}

/**
 * PATCH /api/v1/admin/stores/:id/status
 * Updates status of a store (active, pending_approval, suspended).
 */
export async function adminUpdateStoreStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status, isActive } = req.body;

    const store = await Store.findById(id);
    if (!store) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Store not found.' },
      });
      return;
    }

    if (status) {
      store.status = status;
      store.isActive = status === 'active';
    }
    if (typeof isActive === 'boolean') {
      store.isActive = isActive;
      if (!isActive && store.status === 'active') {
        store.status = 'pending_approval';
      } else if (isActive && store.status !== 'active') {
        store.status = 'active';
      }
    }

    await store.save();

    res.json({
      success: true,
      data: store.toJSON(),
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: err.message },
    });
  }
}

/**
 * DELETE /api/v1/admin/stores/:id
 */
export async function adminDeleteStore(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const store = await Store.findByIdAndDelete(id);
    if (!store) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Store not found.' },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Store deleted successfully.',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_FAILED', message: err.message },
    });
  }
}
