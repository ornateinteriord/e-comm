import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { mongoose } from '@ornate/db';
import { Store, generateNextStoreId, getDefaultMaxStockLimit } from '../models/store.model.js';
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
 * Returns root categories and nested subcategories with store assignment & capacity info.
 */
export async function getAvailableCategories(_req: Request, res: Response): Promise<void> {
  try {
    const catalogDb = getCatalogDb();
    const allCategories = await catalogDb
      .collection('categories')
      .find({ isActive: true })
      .sort({ order: 1, name: 1 })
      .toArray();

    // Find all active stores and map by subcategoryId & categoryId
    const activeStores = await Store.find({ isActive: true, status: { $ne: 'suspended' } }).select(
      'categoryId categoryName subcategoryId subcategoryName storeId name maxStockLimit currentStockTotal typeOfStore',
    );

    const storeSubcatMap = new Map<string, any>();
    const storeCatMap = new Map<string, any>();

    for (const s of activeStores) {
      const remainingSpace = Math.max(0, (s.maxStockLimit ?? 2500) - (s.currentStockTotal ?? 0));
      const sInfo = {
        storeId: s.storeId,
        name: s.name,
        typeOfStore: s.typeOfStore,
        maxStockLimit: s.maxStockLimit,
        currentStockTotal: s.currentStockTotal,
        hasSpace: remainingSpace > 0,
      };
      if (s.subcategoryId) {
        storeSubcatMap.set(String(s.subcategoryId), sInfo);
      }
      if (s.categoryId) {
        storeCatMap.set(String(s.categoryId), sInfo);
      }
    }

    const roots: any[] = [];
    const subcategoriesMap = new Map<string, any[]>();

    for (const cat of allCategories) {
      const catId = cat._id.toString();
      const parentId = cat.parent ? cat.parent.toString() : null;

      if (!parentId) {
        roots.push({
          id: catId,
          _id: catId,
          name: cat.name,
          slug: cat.slug,
          description: cat.description || '',
          image: cat.image || '',
          subcategories: [],
        });
      } else {
        const claimed = storeSubcatMap.get(catId);
        const subItem = {
          id: catId,
          _id: catId,
          parentId,
          name: cat.name,
          slug: cat.slug,
          description: cat.description || '',
          image: cat.image || '',
          isAvailable: !claimed || claimed.hasSpace === false,
          claimedByStore: claimed || null,
        };
        const list = subcategoriesMap.get(parentId) || [];
        list.push(subItem);
        subcategoriesMap.set(parentId, list);
      }
    }

    for (const root of roots) {
      root.subcategories = subcategoriesMap.get(root.id) || [];
    }

    res.json({
      success: true,
      data: roots,
      flat: allCategories.map((c: any) => {
        const cId = c._id.toString();
        const claimed = storeSubcatMap.get(cId) || storeCatMap.get(cId);
        return {
          id: cId,
          _id: cId,
          name: c.name,
          slug: c.slug,
          parent: c.parent ? c.parent.toString() : null,
          parentId: c.parent ? c.parent.toString() : null,
          isAvailable: !claimed || claimed.hasSpace === false,
          claimedByStore: claimed || null,
        };
      }),
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
      subcategoryId,
      subcategoryName,
      subcategorySlug,
      typeOfStore: rawTypeOfStore,
      maxStockLimit: rawLimit,
      referralCode,
      address,
      location,
    } = req.body;

    const cleanMobile = String(mobileNumber || '').replace(/\D/g, '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(name || '').trim();
    const cleanOwnerName = String(ownerName || '').trim();
    const cleanReferral = String(referralCode || '').trim();

    if (!cleanName || !cleanOwnerName || !cleanMobile || !password || (!categoryId && !subcategoryId) || !cleanReferral) {
      res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Store name, owner name, mobile, password, subcategory, and sponsor code are required.' },
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

    // 2. Resolve subcategory and parent root category
    const catalogDb = getCatalogDb();
    let finalCatId = String(categoryId || '').trim();
    let finalCatName = categoryName || '';
    let finalCatSlug = categorySlug || '';
    let finalSubcatId = String(subcategoryId || '').trim();
    let finalSubcatName = subcategoryName || '';
    let finalSubcatSlug = subcategorySlug || '';

    if (finalSubcatId) {
      try {
        const subDoc = await catalogDb.collection('categories').findOne({
          $or: [
            ...(mongoose.Types.ObjectId.isValid(finalSubcatId) ? [{ _id: new mongoose.Types.ObjectId(finalSubcatId) }] : []),
            { id: finalSubcatId },
            { slug: finalSubcatId },
          ],
        });
        if (subDoc) {
          finalSubcatId = subDoc._id.toString();
          finalSubcatName = subDoc.name;
          finalSubcatSlug = subDoc.slug;

          if (subDoc.parent) {
            const parentDoc = await catalogDb.collection('categories').findOne({ _id: subDoc.parent });
            if (parentDoc) {
              finalCatId = parentDoc._id.toString();
              finalCatName = parentDoc.name;
              finalCatSlug = parentDoc.slug;
            }
          } else {
            finalCatId = finalSubcatId;
            finalCatName = finalSubcatName;
            finalCatSlug = finalSubcatSlug;
          }
        }
      } catch (err) {
        log.warn({ err }, 'Error resolving subcategory');
      }
    } else if (finalCatId) {
      try {
        const catDoc = await catalogDb.collection('categories').findOne({
          $or: [
            ...(mongoose.Types.ObjectId.isValid(finalCatId) ? [{ _id: new mongoose.Types.ObjectId(finalCatId) }] : []),
            { id: finalCatId },
            { slug: finalCatId },
          ],
        });
        if (catDoc) {
          if (catDoc.parent) {
            finalSubcatId = catDoc._id.toString();
            finalSubcatName = catDoc.name;
            finalSubcatSlug = catDoc.slug;
            const parentDoc = await catalogDb.collection('categories').findOne({ _id: catDoc.parent });
            if (parentDoc) {
              finalCatId = parentDoc._id.toString();
              finalCatName = parentDoc.name;
              finalCatSlug = parentDoc.slug;
            }
          } else {
            finalCatName = catDoc.name;
            finalCatSlug = catDoc.slug;
            finalSubcatId = finalCatId;
            finalSubcatName = finalCatName;
            finalSubcatSlug = finalCatSlug;
          }
        }
      } catch (err) {
        log.warn({ err }, 'Error resolving category');
      }
    }

    // 3. Verify subcategory exclusivity
    if (finalSubcatId) {
      const existingSubStore = await Store.findOne({
        subcategoryId: finalSubcatId,
        isActive: true,
        status: { $ne: 'suspended' },
      });
      if (existingSubStore) {
        const remCap = Math.max(0, (existingSubStore.maxStockLimit ?? 2500) - (existingSubStore.currentStockTotal ?? 0));
        if (remCap > 0) {
          res.status(422).json({
            success: false,
            error: {
              code: 'SUBCATEGORY_ALREADY_TAKEN',
              message: `Subcategory "${finalSubcatName || finalSubcatId}" is already assigned to active store "${existingSubStore.name}" (${existingSubStore.storeId}), which still has available capacity (${remCap} units).`,
            },
          });
          return;
        }
      }
    }

    // 4. Verify unique mobile and email
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

    // 5. Generate unique Store ID
    const storeId = await generateNextStoreId();

    // 6. Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // 7. Validate location
    const lat = Number(location?.lat ?? 12.9716);
    const lng = Number(location?.lng ?? 77.5946);

    const typeOfStore = String(rawTypeOfStore || 'Standard (Fulfillment Hub)').trim();
    const maxStockLimit = Number(rawLimit) > 0 ? Number(rawLimit) : getDefaultMaxStockLimit(typeOfStore);

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
      maxStockLimit,
      currentStockTotal: 0,
      ownerName: cleanOwnerName,
      email: cleanEmail || `${cleanMobile}@store.eshopy.biz`,
      mobileNumber: cleanMobile,
      passwordHash,
      role: 'store',
      categoryId: finalCatId,
      categoryName: finalCatName || 'General',
      categorySlug: finalCatSlug || 'general',
      subcategoryId: finalSubcatId || finalCatId,
      subcategoryName: finalSubcatName || finalCatName || 'General',
      subcategorySlug: finalSubcatSlug || finalCatSlug || 'general',
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

    // 8. Auto-assign any pending unassigned stock in this subcategory to the new store
    try {
      let remainingCap = store.maxStockLimit;
      const targetSubcat = store.subcategoryId;
      if (remainingCap > 0 && targetSubcat) {
        const pendingProducts = await catalogDb
          .collection('products')
          .find({
            $or: [
              { subcategoryId: targetSubcat, unassignedStock: { $gt: 0 } },
              { subcategoryId: targetSubcat, assignmentStatus: { $in: ['unassigned', 'partially_assigned'] } },
              { subcategoryId: targetSubcat, storeId: null },
            ],
          })
          .sort({ createdAt: 1 })
          .toArray();

        let allocatedUnits = 0;
        for (const prod of pendingProducts) {
          if (remainingCap <= 0) break;
          const unassigned = Number(prod.unassignedStock ?? (prod.storeId ? 0 : prod.stock));
          if (unassigned <= 0) continue;

          const qtyToAllocate = Math.min(unassigned, remainingCap);
          const newAssigned = (Number(prod.assignedStock) || 0) + qtyToAllocate;
          const newUnassigned = unassigned - qtyToAllocate;
          const newStatus = newUnassigned === 0 ? 'assigned' : 'partially_assigned';

          await catalogDb.collection('products').updateOne(
            { _id: prod._id },
            {
              $set: {
                storeId: store.storeId,
                storeName: store.name,
                assignedStock: newAssigned,
                unassignedStock: newUnassigned,
                assignmentStatus: newStatus,
              },
            },
          );

          remainingCap -= qtyToAllocate;
          allocatedUnits += qtyToAllocate;
        }

        if (allocatedUnits > 0) {
          store.currentStockTotal = allocatedUnits;
          await store.save();
          log.info({ storeId: store.storeId, allocatedUnits }, 'Auto-assigned pending products to new store upon creation');
        }
      }
    } catch (autoErr) {
      log.warn({ autoErr, storeId: store.storeId }, 'Error auto-assigning products on store creation');
    }

    const accessToken = signAccessToken({
      userId: store._id.toString(),
      email: store.email,
      role: 'store',
      storeId: store.storeId,
      categoryId: store.categoryId,
      subcategoryId: store.subcategoryId,
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
      subcategoryId: store.subcategoryId,
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
