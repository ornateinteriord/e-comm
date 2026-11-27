import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { mongoose } from '@ornate/db';
import { Seller, generateNextSellerId, getDefaultMaxStockLimit } from '../models/seller.model.js';
import { lookupSellerReferralCode } from '../utils/referral.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
  extractRefreshToken,
} from '../utils/jwt.js';
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
 * Returns root categories and nested subcategories with seller assignment & capacity info.
 */
export async function getAvailableCategories(_req: Request, res: Response): Promise<void> {
  try {
    const catalogDb = getCatalogDb();
    const allCategories = await catalogDb
      .collection('categories')
      .find({ isActive: true })
      .sort({ order: 1, name: 1 })
      .toArray();

    // Find all active sellers and map by subcategoryId & categoryId
    const activeSellers = await Seller.find({ isActive: true, status: { $ne: 'suspended' } }).select(
      'categoryId categoryName subcategoryId subcategoryName sellerId storeId name typeOfSeller typeOfStore maxStockLimit currentStockTotal',
    );

    const sellerSubcatMap = new Map<string, any>();
    const sellerCatMap = new Map<string, any>();

    for (const s of activeSellers) {
      const id = s.sellerId || s.storeId || '';
      const remainingSpace = Math.max(0, (s.maxStockLimit ?? 2500) - (s.currentStockTotal ?? 0));
      const sInfo = {
        sellerId: id,
        storeId: id,
        name: s.name,
        typeOfSeller: s.typeOfSeller || s.typeOfStore,
        typeOfStore: s.typeOfStore || s.typeOfSeller,
        maxStockLimit: s.maxStockLimit ?? 2500,
        currentStockTotal: s.currentStockTotal ?? 0,
        hasSpace: remainingSpace > 0,
      };
      if (s.subcategoryId) {
        sellerSubcatMap.set(String(s.subcategoryId), sInfo);
      }
      if (s.categoryId) {
        sellerCatMap.set(String(s.categoryId), sInfo);
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
        const claimed = sellerSubcatMap.get(catId);
        const subItem = {
          id: catId,
          _id: catId,
          parentId,
          name: cat.name,
          slug: cat.slug,
          description: cat.description || '',
          image: cat.image || '',
          isAvailable: !claimed || claimed.hasSpace === false,
          claimedBySeller: claimed || null,
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
        const claimed = sellerSubcatMap.get(cId) || sellerCatMap.get(cId);
        return {
          id: cId,
          _id: cId,
          name: c.name,
          slug: c.slug,
          parent: c.parent ? c.parent.toString() : null,
          parentId: c.parent ? c.parent.toString() : null,
          isAvailable: !claimed || claimed.hasSpace === false,
          claimedBySeller: claimed || null,
          claimedByStore: claimed || null,
        };
      }),
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
 * Registers a new seller. Validates sponsor, subcategory exclusivity, coordinates, and creates credentials.
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
      subcategoryId,
      subcategoryName,
      subcategorySlug,
      typeOfSeller: rawTypeOfSeller,
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

    if (!cleanName || !cleanOwnerName || !cleanMobile || !password || (!subcategoryId && !categoryId) || !cleanReferral) {
      res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Seller name, owner name, mobile, password, subcategory, and sponsor code are required.' },
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

    // 2. Resolve subcategory and parent root category (Sellers are based on subcategories only)
    const catalogDb = getCatalogDb();
    let finalCatId = String(categoryId || '').trim();
    let finalCatName = categoryName || '';
    let finalCatSlug = categorySlug || '';
    let finalSubcatId = String(subcategoryId || '').trim();
    let finalSubcatName = subcategoryName || '';
    let finalSubcatSlug = subcategorySlug || '';

    const lookupId = finalSubcatId || finalCatId;
    if (lookupId) {
      try {
        const subDoc = await catalogDb.collection('categories').findOne({
          $or: [
            ...(mongoose.Types.ObjectId.isValid(lookupId) ? [{ _id: new mongoose.Types.ObjectId(lookupId) }] : []),
            { id: lookupId },
            { slug: lookupId },
          ],
        });

        if (subDoc) {
          if (!subDoc.parent) {
            // Sellers must be assigned to a subcategory, not a bare root category
            res.status(422).json({
              success: false,
              error: {
                code: 'SUBCATEGORY_REQUIRED',
                message: `Sellers are assigned to subcategories only. "${subDoc.name}" is a main category — please select a subcategory under it.`,
              },
            });
            return;
          }

          finalSubcatId = subDoc._id.toString();
          finalSubcatName = subDoc.name;
          finalSubcatSlug = subDoc.slug;

          const parentDoc = await catalogDb.collection('categories').findOne({ _id: subDoc.parent });
          if (parentDoc) {
            finalCatId = parentDoc._id.toString();
            finalCatName = parentDoc.name;
            finalCatSlug = parentDoc.slug;
          }
        }
      } catch (err) {
        log.warn({ err }, 'Error resolving subcategory');
      }
    }

    if (!finalSubcatId) {
      res.status(422).json({
        success: false,
        error: { code: 'SUBCATEGORY_REQUIRED', message: 'A valid subcategory is required to register a seller.' },
      });
      return;
    }

    // 3. Verify subcategory exclusivity (only reject if existing active seller still has remaining stock capacity)
    const existingSubSeller = await Seller.findOne({
      subcategoryId: finalSubcatId,
      isActive: true,
      status: { $ne: 'suspended' },
    });
    if (existingSubSeller) {
      const remCap = Math.max(0, (existingSubSeller.maxStockLimit ?? 2500) - (existingSubSeller.currentStockTotal ?? 0));
      if (remCap > 0) {
        res.status(422).json({
          success: false,
          error: {
            code: 'SUBCATEGORY_ALREADY_TAKEN',
            message: `Subcategory "${finalSubcatName || finalSubcatId}" is already assigned to active seller "${existingSubSeller.name}" (${existingSubSeller.sellerId || existingSubSeller.storeId}), which still has available capacity (${remCap} units).`,
          },
        });
        return;
      }
    }

    // 4. Verify unique mobile and email
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

    // 5. Generate unique Seller ID
    const sellerId = await generateNextSellerId();

    // 6. Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // 7. Validate location & tier limits
    const lat = Number(location?.lat ?? 12.9716);
    const lng = Number(location?.lng ?? 77.5946);

    const typeOfSeller = String(rawTypeOfSeller || rawTypeOfStore || 'Standard (Fulfillment Hub)').trim();
    const maxStockLimit = Number(rawLimit) > 0 ? Number(rawLimit) : getDefaultMaxStockLimit(typeOfSeller);

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
      maxStockLimit,
      currentStockTotal: 0,
      ownerName: cleanOwnerName,
      email: cleanEmail || `${cleanMobile}@seller.eshopy.biz`,
      mobileNumber: cleanMobile,
      passwordHash,
      role: 'seller',
      categoryId: finalCatId || finalSubcatId,
      categoryName: finalCatName || 'General',
      categorySlug: finalCatSlug || 'general',
      subcategoryId: finalSubcatId,
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

    await seller.save();

    // 8. Auto-assign any pending unassigned stock in this subcategory to the new seller
    try {
      let remainingCap = seller.maxStockLimit;
      const targetSubcat = seller.subcategoryId;
      if (remainingCap > 0 && targetSubcat) {
        const pendingProducts = await catalogDb
          .collection('products')
          .find({
            $or: [
              { subcategoryId: targetSubcat, unassignedStock: { $gt: 0 } },
              { subcategoryId: targetSubcat, assignmentStatus: { $in: ['unassigned', 'partially_assigned'] } },
              { subcategoryId: targetSubcat, sellerId: null, storeId: null },
            ],
          })
          .sort({ createdAt: 1 })
          .toArray();

        let allocatedUnits = 0;
        for (const prod of pendingProducts) {
          if (remainingCap <= 0) break;
          const unassigned = Number(prod.unassignedStock ?? ((prod.sellerId || prod.storeId) ? 0 : prod.stock));
          if (unassigned <= 0) continue;

          const qtyToAllocate = Math.min(unassigned, remainingCap);
          const newAssigned = (Number(prod.assignedStock) || 0) + qtyToAllocate;
          const newUnassigned = unassigned - qtyToAllocate;
          const newStatus = newUnassigned === 0 ? 'assigned' : 'partially_assigned';

          await catalogDb.collection('products').updateOne(
            { _id: prod._id },
            {
              $set: {
                sellerId: seller.sellerId,
                sellerName: seller.name,
                storeId: seller.sellerId,
                storeName: seller.name,
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
          seller.currentStockTotal = allocatedUnits;
          await seller.save();
          log.info({ sellerId: seller.sellerId, allocatedUnits }, 'Auto-assigned pending products to new seller upon creation');
        }
      }
    } catch (autoErr) {
      log.warn({ autoErr, sellerId: seller.sellerId }, 'Error auto-assigning products on seller creation');
    }

    const accessToken = signAccessToken({
      userId: seller._id.toString(),
      email: seller.email,
      role: 'seller',
      sellerId: seller.sellerId,
      storeId: seller.sellerId,
      categoryId: seller.categoryId,
      subcategoryId: seller.subcategoryId,
    });
    const refreshToken = signRefreshToken({ userId: seller._id.toString() });
    setRefreshCookie(res, refreshToken, 'sellerRefreshToken', req);

    log.info({ sellerId: seller.sellerId, name: seller.name, subcategoryId: seller.subcategoryId }, 'Seller registered successfully');

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
      subcategoryId: seller.subcategoryId,
    });
    const refreshToken = signRefreshToken({ userId: seller._id.toString() });
    setRefreshCookie(res, refreshToken, 'sellerRefreshToken', req);

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
 * POST /api/v1/seller/refresh
 * Refreshes an expired seller access token using the 30-day refresh token.
 */
export async function refreshSeller(req: Request, res: Response): Promise<void> {
  try {
    const token = extractRefreshToken(req, ['sellerRefreshToken', 'refreshToken']);
    if (!token) {
      res.status(401).json({
        success: false,
        error: { code: 'NO_REFRESH_TOKEN', message: 'Seller refresh token missing.' },
      });
      return;
    }

    let payload: { userId: string };
    try {
      payload = verifyRefreshToken(token);
    } catch {
      clearRefreshCookie(res, 'sellerRefreshToken', req);
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired seller refresh token.' },
      });
      return;
    }

    const seller = await Seller.findById(payload.userId);
    if (!seller || seller.status === 'suspended') {
      clearRefreshCookie(res, 'sellerRefreshToken', req);
      res.status(401).json({
        success: false,
        error: { code: 'SELLER_INACTIVE', message: 'Seller account not found or suspended.' },
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
      subcategoryId: seller.subcategoryId,
    });
    const newRefreshToken = signRefreshToken({ userId: seller._id.toString() });
    setRefreshCookie(res, newRefreshToken, 'sellerRefreshToken', req);

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (err: any) {
    log.error({ err }, 'Error refreshing seller token');
    res.status(500).json({
      success: false,
      error: { code: 'REFRESH_FAILED', message: 'Failed to refresh seller session.' },
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
    const subcategoryId = String(req.query.subcategoryId || '').trim();
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
        { subcategoryName: regex },
        { 'address.city': regex },
      ];
    }
    if (categoryId) filter.categoryId = categoryId;
    if (subcategoryId) filter.subcategoryId = subcategoryId;
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

