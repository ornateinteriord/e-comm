import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
const uuidv4 = () => crypto.randomUUID();
import slugify from 'slugify';
import { Product } from '../models/product.model.js';
import { Category } from '../models/category.model.js';
import { serializePublicProduct, serializeAdminProduct } from '../utils/product.serializer.js';
import { validatePrices } from '@ornate/pricing-utils';
import { createLogger } from '@ornate/logger';
import { emitSearchEvent } from '../utils/search-event.js';

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
    if (status) filter.status = status;
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
      status, isPublished, attributes, variants, seoTitle, seoDescription,
      taxClass, weight, dimensions,
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

    const slug = generateSlug(name, sku);
    const product = await Product.create({
      name, slug, sku: sku.toUpperCase(), brand, shortDescription, longDescription,
      category, subcategory,
      pricing: { ...pricing },
      stock: stock ?? 0,
      lowStockThreshold: lowStockThreshold ?? 5,
      status: status ?? 'draft',
      isPublished: isPublished ?? false,
      attributes: attributes ?? [],
      variants: (variants ?? []).map((v: Record<string, unknown>) => ({ ...v, id: uuidv4() })),
      seoTitle, seoDescription, taxClass, weight, dimensions,
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

    // Update other fields
    const allowed = [
      'name', 'brand', 'shortDescription', 'longDescription', 'category',
      'subcategory', 'stock', 'lowStockThreshold', 'status', 'isPublished',
      'attributes', 'seoTitle', 'seoDescription', 'taxClass', 'weight', 'dimensions',
    ];
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
