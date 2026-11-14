import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
const uuidv4 = () => crypto.randomUUID();
import slugify from 'slugify';
import { Product } from '../models/product.model.js';
import { Category } from '../models/category.model.js';
import { serializePublicProduct, serializeAdminProduct } from '../utils/product.serializer.js';
import { validatePrices } from '@ornate/pricing-utils';
import { createLogger } from '@ornate/logger';
import { emitSearchEvent } from '../utils/search-event.js';
import { allocateStockForProduct, autoAssignUnassignedStockToStore } from '../utils/stock-allocation.js';

const log = createLogger('product-controller');

function generateSlug(name: string, sku: string): string {
  return `${slugify(name, { lower: true, strict: true })}-${sku.toLowerCase()}`;
}

// GET /api/v1/products
export async function listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 24)));
    const skip = (page - 1) * limit;
    const category = req.query.category as string | undefined;
    const brand = req.query.brand as string | undefined;
    const sort = (req.query.sort as string) ?? 'newest';

    const filter: Record<string, unknown> = { status: 'active', isPublished: true };
    if (category) filter.category = category;
    if (brand) filter.brand = brand;

    const sortMap: Record<string, Record<string, number>> = {
      newest: { createdAt: -1 },
      price_asc: { 'pricing.sellingPrice': 1 },
      price_desc: { 'pricing.sellingPrice': -1 },
    };

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('category', 'name slug')
        .sort((sortMap[sort] as any) ?? { createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        items: products.map((p) => {
          const pub = serializePublicProduct(p);
          pub.categoryName = (p.category as { name?: string })?.name ?? '';
          return pub;
        }),
        pagination: {
          page, limit, total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/products/:slug
export async function getProductBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await Product.findOne({
      slug: req.params.slug,
      status: 'active',
      isPublished: true,
    }).populate('category', 'name slug');

    if (!product) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found.' },
      });
      return;
    }

    const pub = serializePublicProduct(product);
    pub.categoryName = (product.category as { name?: string })?.name ?? '';
    res.json({ success: true, data: pub });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/products/featured
export async function getFeaturedProduct(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // 1. Explicitly sponsor/featured product
    let product = await Product.findOne({ isFeatured: true, status: 'active', isPublished: true }).populate('category', 'name slug');

    // 2. Fallback to active product with deal
    if (!product) {
      product = await Product.findOne({ 'pricing.deal.isActive': true, status: 'active', isPublished: true }).populate('category', 'name slug');
    }

    // 3. Fallback to any active published product
    if (!product) {
      product = await Product.findOne({ status: 'active', isPublished: true }).populate('category', 'name slug');
    }

    if (!product) {
      res.json({ success: true, data: null });
      return;
    }

    const pub = serializePublicProduct(product);
    pub.categoryName = (product.category as { name?: string })?.name ?? '';
    res.json({ success: true, data: pub });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/admin/products
export async function adminListProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const skip = (page - 1) * limit;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const category = req.query.category as string | undefined;

    const filter: Record<string, unknown> = {};
    if (status && status !== 'all') filter.status = status;
    if (category) filter.category = category;
    if (search) filter.$text = { $search: search };

    const [products, total] = await Promise.all([
      Product.find(filter).populate('category', 'name slug').skip(skip).limit(limit).sort({ createdAt: -1 }),
      Product.countDocuments(filter),
    ]);

    const isFinance = ['finance_manager', 'admin', 'super_admin'].includes(req.user?.role ?? '');

    res.json({
      success: true,
      data: {
        items: products.map((p) => isFinance ? serializeAdminProduct(p) : serializePublicProduct(p)),
        pagination: {
          page, limit, total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/admin/products
export async function createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      name, sku, brand, shortDescription, longDescription,
      category, subcategory, pricing, stock, lowStockThreshold,
      status, isPublished, isFeatured, attributes, variants, seoTitle, seoDescription,
      taxClass, weight, dimensions, images,
    } = req.body;

    // Validate prices
    const priceErrors = validatePrices(pricing);
    if (priceErrors.length > 0) {
      res.status(422).json({
        success: false,
        error: { code: 'PRICE_VALIDATION_ERROR', message: 'Invalid pricing.', details: priceErrors },
      });
      return;
    }

    // Check SKU uniqueness
    const skuExists = await Product.findOne({ sku: sku.toUpperCase() });
    if (skuExists) {
      res.status(409).json({
        success: false,
        error: { code: 'SKU_IN_USE', message: `SKU ${sku} is already in use.` },
      });
      return;
    }

    if (isFeatured) {
      await Product.updateMany({ isFeatured: true }, { $set: { isFeatured: false } });
    }

    const slug = generateSlug(name, sku);

    // Resolve subcategory details
    const subcatId = req.body.subcategoryId || (subcategory ? subcategory.toString() : null);
    let subcatDoc: any = null;
    let finalSubcatName = req.body.subcategoryName;
    if (subcatId) {
      subcatDoc = await Category.findById(subcatId).catch(() => null);
      if (subcatDoc) {
        finalSubcatName = subcatDoc.name;
      }
    }

    // Allocate stock to an active store in this subcategory up to store capacity limit
    const incomingStock = stock ?? 0;
    const allocation = await allocateStockForProduct({
      subcategoryId: subcatId,
      categoryId: category ? category.toString() : null,
      stock: incomingStock,
    });

    const product = await Product.create({
      name, slug, sku: sku.toUpperCase(), brand, shortDescription, longDescription,
      category,
      subcategory: subcatDoc ? subcatDoc._id : (subcategory ?? null),
      subcategoryId: subcatId || (subcatDoc ? subcatDoc._id.toString() : undefined),
      subcategoryName: finalSubcatName,
      storeId: allocation.storeId,
      storeName: allocation.storeName,
      assignedStock: allocation.assignedStock,
      unassignedStock: allocation.unassignedStock,
      assignmentStatus: allocation.assignmentStatus,
      pricing: { ...pricing },
      stock: incomingStock,
      lowStockThreshold: lowStockThreshold ?? 5,
      status: status ?? 'draft',
      isPublished: isPublished ?? false,
      isFeatured: Boolean(isFeatured),
      attributes: attributes ?? [],
      variants: (variants ?? []).map((v: Record<string, unknown>) => ({ ...v, id: uuidv4() })),
      seoTitle, seoDescription, taxClass, weight, dimensions,
      images: (images ?? []).map((img: any, idx: number) => ({
        id: img.id || uuidv4(),
        url: img.url,
        alt: img.alt || img.name || name,
        order: img.order ?? idx,
      })),
      priceHistory: [{ changedBy: req.user!.userId, changedAt: new Date(), snapshot: pricing }],
    });

    // Emit search index event
    await emitSearchEvent(product.id as string, 'upsert');

    log.info({ productId: product.id, sku: product.sku }, 'Product created');
    res.status(201).json({ success: true, data: serializeAdminProduct(product) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/admin/products/:id
export async function updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body;

    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found.' } });
      return;
    }

    // If pricing is being updated, validate and record history
    if (updates.pricing) {
      const priceErrors = validatePrices(updates.pricing);
      if (priceErrors.length > 0) {
        res.status(422).json({
          success: false,
          error: { code: 'PRICE_VALIDATION_ERROR', message: 'Invalid pricing.', details: priceErrors },
        });
        return;
      }
      product.priceHistory.push({
        changedBy: req.user!.userId,
        changedAt: new Date(),
        snapshot: (product.pricing as any),
      });
      Object.assign(product.pricing, updates.pricing);
      delete updates.pricing;
    }

    if (updates.images) {
      product.images = (updates.images ?? []).map((img: any, idx: number) => ({
        id: img.id || uuidv4(),
        url: img.url,
        alt: img.alt || img.name || product.name,
        order: img.order ?? idx,
      }));
      delete updates.images;
    }

    // Update other fields
    const allowed = [
      'name', 'brand', 'shortDescription', 'longDescription', 'category',
      'subcategory', 'stock', 'lowStockThreshold', 'status', 'isPublished', 'isFeatured',
      'attributes', 'seoTitle', 'seoDescription', 'taxClass', 'weight', 'dimensions',
    ];

    if (updates.status === 'inactive' && updates.isPublished === undefined) {
      updates.isPublished = false;
    } else if (updates.status === 'active' && updates.isPublished === undefined) {
      updates.isPublished = true;
    }

    if (updates.status === 'inactive' || updates.isPublished === false) {
      updates.isFeatured = false;
    }

    if (updates.isFeatured === true) {
      await Product.updateMany({ _id: { $ne: product._id }, isFeatured: true }, { $set: { isFeatured: false } });
    }

    for (const key of allowed) {
      if (key in updates) (product as any)[key] = updates[key];
    }

    // Regenerate slug if name changed
    if (updates.name) {
      product.slug = generateSlug(updates.name, product.sku);
    }

    await product.save();
    await emitSearchEvent(product.id as string, 'upsert');

    log.info({ productId: id }, 'Product updated');
    res.json({ success: true, data: serializeAdminProduct(product) });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/admin/products/:id/sponsor
export async function setSponsorProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const isObjectId = Boolean(String(id).match(/^[0-9a-fA-F]{24}$/));
    const target = await Product.findOne(isObjectId ? { _id: id } : { sku: id });

    if (!target) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found.' } });
      return;
    }

    // Unset all other products
    await Product.updateMany({ _id: { $ne: target._id }, isFeatured: true }, { $set: { isFeatured: false } });

    // Set target product as isFeatured: true
    const updated = await Product.findByIdAndUpdate(
      target._id,
      { $set: { isFeatured: true, status: 'active', isPublished: true } },
      { new: true },
    );

    log.info({ productId: target.id, sku: target.sku }, 'Product designated as front sponsor');
    res.json({
      success: true,
      data: serializeAdminProduct(updated || target),
      message: `"${target.name}" is now set as the front page Sponsor / Featured product.`,
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/v1/admin/products/:id
export async function deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndUpdate(
      id,
      { status: 'archived', isPublished: false },
      { new: true },
    );

    if (!product) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found.' } });
      return;
    }

    await emitSearchEvent(String(id), 'delete');
    log.info({ productId: id }, 'Product archived');
    res.json({ success: true, data: null, message: 'Product archived successfully.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/admin/products/:id
export async function getAdminProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await Product.findById(req.params.id).populate('category', 'name slug');
    if (!product) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found.' } });
      return;
    }
    const isFinance = ['finance_manager', 'admin', 'super_admin'].includes(req.user?.role ?? '');
    res.json({ success: true, data: isFinance ? serializeAdminProduct(product) : serializePublicProduct(product) });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// STORE PORTAL PRODUCT CONTROLLERS
// ==========================================

/**
 * GET /api/v1/store/products
 * Returns all products within the store's assigned category.
 */
export async function storeListProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categoryId = req.user?.categoryId;
    if (!categoryId) {
      res.status(400).json({ success: false, error: { code: 'CATEGORY_REQUIRED', message: 'Store has no category assigned.' } });
      return;
    }

    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const skip = (page - 1) * limit;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;

    const filter: Record<string, unknown> = {
      category: mongoose.Types.ObjectId.isValid(categoryId) ? new mongoose.Types.ObjectId(categoryId) : categoryId,
    };
    if (status && status !== 'all') filter.status = status;
    if (search) {
      const reg = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: reg }, { sku: reg }];
    }

    const [products, total] = await Promise.all([
      Product.find(filter).populate('category', 'name slug').skip(skip).limit(limit).sort({ createdAt: -1 }),
      Product.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        items: products.map((p) => serializePublicProduct(p)),
        pagination: {
          page, limit, total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/store/products
 * Creates a product within the store's category.
 */
export async function storeCreateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categoryId = req.user?.categoryId;
    const storeId = req.user?.storeId;
    if (!categoryId) {
      res.status(400).json({ success: false, error: { code: 'CATEGORY_REQUIRED', message: 'Store has no category assigned.' } });
      return;
    }

    const {
      name, sku, brand, shortDescription, longDescription,
      pricing, stock, lowStockThreshold,
      status, isPublished, attributes, variants,
      seoTitle, seoDescription, taxClass, weight, dimensions, images,
    } = req.body;

    const pricePayload = {
      mrp: Number(pricing?.mrp ?? 0),
      sellingPrice: Number(pricing?.sellingPrice ?? 0),
      inwardPrice: Number(pricing?.inwardPrice ?? pricing?.sellingPrice ?? 0),
      dealPrice: pricing?.dealPrice ? Number(pricing.dealPrice) : null,
      deal: pricing?.deal ?? null,
    };

    const priceErrors = validatePrices(pricePayload);
    if (priceErrors.length > 0) {
      res.status(422).json({
        success: false,
        error: { code: 'PRICE_VALIDATION_ERROR', message: 'Invalid pricing.', details: priceErrors },
      });
      return;
    }

    const skuUpper = String(sku || '').toUpperCase().trim();
    const skuExists = await Product.findOne({ sku: skuUpper });
    if (skuExists) {
      res.status(409).json({
        success: false,
        error: { code: 'SKU_IN_USE', message: `SKU ${skuUpper} is already in use.` },
      });
      return;
    }

    const slug = generateSlug(name, skuUpper);

    const targetSubcatId = (req.body.subcategoryId || (req.user as any)?.subcategoryId || categoryId)?.toString();
    let subcatName: string | undefined = undefined;
    if (targetSubcatId && mongoose.Types.ObjectId.isValid(targetSubcatId)) {
      const subcatDoc = await Category.findById(targetSubcatId).select('name');
      if (subcatDoc) subcatName = subcatDoc.name;
    }

    const incomingStock = stock ?? 0;
    const allocation = await allocateStockForProduct({
      requestedStoreId: storeId,
      subcategoryId: targetSubcatId,
      stock: incomingStock,
    });

    const product = await Product.create({
      name,
      slug,
      sku: skuUpper,
      brand,
      shortDescription,
      longDescription,
      category: mongoose.Types.ObjectId.isValid(categoryId) ? new mongoose.Types.ObjectId(categoryId) : categoryId,
      subcategoryId: targetSubcatId,
      subcategoryName: subcatName,
      pricing: pricePayload,
      stock: incomingStock,
      assignedStock: allocation.assignedStock,
      unassignedStock: allocation.unassignedStock,
      assignmentStatus: allocation.assignmentStatus,
      lowStockThreshold: lowStockThreshold ?? 5,
      status: status ?? 'active',
      isPublished: typeof isPublished === 'boolean' ? isPublished : true,
      attributes: attributes ?? [],
      variants: (variants ?? []).map((v: Record<string, unknown>) => ({ ...v, id: uuidv4() })),
      seoTitle,
      seoDescription,
      taxClass,
      weight,
      dimensions,
      storeId: allocation.storeId || storeId,
      storeName: allocation.storeName || storeId,
      createdBy: { type: 'store', id: req.user!.userId, name: storeId },
      images: (images ?? []).map((img: any, idx: number) => ({
        id: img.id || uuidv4(),
        url: img.url,
        alt: img.alt || img.name || name,
        order: img.order ?? idx,
      })),
      priceHistory: [{ changedBy: req.user!.userId, changedAt: new Date(), snapshot: pricePayload }],
    });

    await emitSearchEvent(product.id as string, 'upsert');
    log.info({ productId: product.id, sku: product.sku, storeId }, 'Product created by store');

    res.status(201).json({
      success: true,
      data: serializePublicProduct(product),
      message: 'Product created successfully.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/store/products/:id
 */
export async function storeUpdateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const categoryId = req.user?.categoryId;

    const catMatch = mongoose.Types.ObjectId.isValid(categoryId!)
      ? { $in: [categoryId, new mongoose.Types.ObjectId(categoryId!)] }
      : categoryId;

    const product = await Product.findOne({
      _id: id,
      category: catMatch,
    });
    if (!product) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found in store category.' } });
      return;
    }

    const { name, brand, shortDescription, longDescription, pricing, stock, lowStockThreshold, status, isPublished, images } = req.body;

    if (name) product.name = name;
    if (brand !== undefined) product.brand = brand;
    if (shortDescription !== undefined) product.shortDescription = shortDescription;
    if (longDescription !== undefined) product.longDescription = longDescription;
    if (stock !== undefined) product.stock = Number(stock);
    if (lowStockThreshold !== undefined) product.lowStockThreshold = Number(lowStockThreshold);
    if (status) {
      product.status = status;
      if (status === 'inactive') {
        product.isPublished = false;
        product.isFeatured = false;
      } else if (status === 'active' && isPublished === undefined) {
        product.isPublished = true;
      }
    }
    if (typeof isPublished === 'boolean') {
      product.isPublished = isPublished;
      if (!isPublished) {
        product.isFeatured = false;
      }
    }

    if (pricing) {
      const pricePayload = {
        mrp: Number(pricing.mrp ?? product.pricing.mrp),
        sellingPrice: Number(pricing.sellingPrice ?? product.pricing.sellingPrice),
        inwardPrice: Number(pricing.inwardPrice ?? product.pricing.inwardPrice ?? product.pricing.sellingPrice),
        dealPrice: pricing.dealPrice !== undefined ? pricing.dealPrice : product.pricing.dealPrice,
        deal: pricing.deal !== undefined ? pricing.deal : product.pricing.deal,
      };
      product.pricing = pricePayload as any;
      product.priceHistory.push({ changedBy: req.user!.userId, changedAt: new Date(), snapshot: pricePayload });
    }

    if (Array.isArray(images)) {
      product.images = images.map((img: any, idx: number) => ({
        id: img.id || uuidv4(),
        url: img.url,
        alt: img.alt || img.name || product.name,
        order: img.order ?? idx,
      }));
    }

    await product.save();
    await emitSearchEvent(product.id as string, 'upsert');

    res.json({
      success: true,
      data: serializePublicProduct(product),
      message: 'Product updated successfully.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/stores/:storeId/auto-assign-stock
 * Automatically allocates pending unassigned products to a store up to its maximum capacity.
 */
export async function adminAutoAssignStock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { storeId } = req.params;
    const conn: any = mongoose.connection;
    const client = typeof conn.getClient === 'function' ? conn.getClient() : conn.client;
    const authDb = client ? client.db(process.env.AUTH_DB_NAME ?? 'ornate_auth') : mongoose.connection.useDb(process.env.AUTH_DB_NAME ?? 'ornate_auth').db;

    const store = await authDb.collection('stores').findOne({ storeId });
    if (!store) {
      res.status(404).json({ success: false, error: { code: 'STORE_NOT_FOUND', message: 'Store not found.' } });
      return;
    }

    const result = await autoAssignUnassignedStockToStore({
      storeId: store.storeId,
      name: store.name,
      subcategoryId: store.subcategoryId || store.categoryId,
      maxStockLimit: store.maxStockLimit,
      currentStockTotal: store.currentStockTotal,
    });

    const updatedStore = await authDb.collection('stores').findOne({ storeId });

    res.json({
      success: true,
      data: {
        allocatedProducts: result.allocatedProducts,
        allocatedUnits: result.allocatedUnits,
        currentStockTotal: updatedStore?.currentStockTotal ?? 0,
        maxStockLimit: updatedStore?.maxStockLimit ?? 2500,
        availableCapacity: Math.max(0, (updatedStore?.maxStockLimit ?? 2500) - (updatedStore?.currentStockTotal ?? 0)),
      },
      message: `Successfully allocated ${result.allocatedUnits} units across ${result.allocatedProducts} products to store ${store.name}.`,
    });
  } catch (err) {
    next(err);
  }
}
