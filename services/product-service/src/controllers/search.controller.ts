import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { getApplicablePrice } from '@ornate/pricing-utils';
import type { PublicProduct, SearchResult, SearchSuggestion } from '@ornate/types';
import { createLogger } from '@ornate/logger';

const log = createLogger('search-controller');

// Read from products collection directly for fast queries
function getProductModel() {
  return mongoose.connection.collection('products');
}

function getCategoryModel() {
  return mongoose.connection.collection('categories');
}

export async function searchProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query.q ? String(req.query.q).trim() : '';
    const category = req.query.category ? String(req.query.category).trim() : '';
    const brand = req.query.brand ? String(req.query.brand).trim() : '';
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;
    const inStock = req.query.inStock === 'true';
    const sort = String(req.query.sort || 'relevance');
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 12)));

    const filter: Record<string, any> = {
      status: 'active',
      isPublished: true,
    };

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { shortDescription: { $regex: q, $options: 'i' } },
        { brand: { $regex: q, $options: 'i' } },
        { sku: { $regex: q, $options: 'i' } },
      ];
    }

    if (brand) {
      filter.brand = { $regex: `^${brand}$`, $options: 'i' };
    }

    if (inStock) {
      filter.stock = { $gt: 0 };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter['pricing.sellingPrice'] = {};
      if (minPrice !== undefined) filter['pricing.sellingPrice'].$gte = minPrice;
      if (maxPrice !== undefined) filter['pricing.sellingPrice'].$lte = maxPrice;
    }

    // Category resolution if slug passed
    if (category) {
      const cat = await getCategoryModel().findOne({ slug: category });
      if (cat) {
        filter.category = cat._id;
      }
    }

    const sortOption: Record<string, 1 | -1> = {};
    if (sort === 'price_asc') {
      sortOption['pricing.sellingPrice'] = 1;
    } else if (sort === 'price_desc') {
      sortOption['pricing.sellingPrice'] = -1;
    } else if (sort === 'newest') {
      sortOption['createdAt'] = -1;
    } else {
      sortOption['createdAt'] = -1;
    }

    const prodCollection = getProductModel();
    const [rawDocs, total] = await Promise.all([
      prodCollection
        .find(filter)
        .sort(sortOption)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      prodCollection.countDocuments(filter),
    ]);

    // Categories map for categoryName resolution
    const categories = await getCategoryModel().find({}).toArray();
    const catMap = new Map(categories.map((c) => [c._id.toString(), c.name]));

    const products: PublicProduct[] = rawDocs.map((doc: any) => {
      const applicable = getApplicablePrice(doc.pricing);
      return {
        id: doc._id.toString(),
        name: doc.name,
        slug: doc.slug,
        sku: doc.sku,
        brand: doc.brand,
        shortDescription: doc.shortDescription,
        longDescription: doc.longDescription,
        categoryId: doc.category?.toString() || '',
        categoryName: catMap.get(doc.category?.toString()) || 'General',
        images: doc.images || [],
        pricing: applicable,
        stock: doc.stock ?? 0,
        attributes: doc.attributes || [],
        variants: doc.variants || [],
        status: doc.status,
        isPublished: doc.isPublished,
        createdAt: doc.createdAt?.toISOString?.() || new Date(doc.createdAt).toISOString(),
        updatedAt: doc.updatedAt?.toISOString?.() || new Date(doc.updatedAt).toISOString(),
      };
    });

    const totalPages = Math.ceil(total / limit);
    const result: SearchResult = {
      products,
      total,
      page,
      totalPages,
      hasMore: page < totalPages,
    };

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getSuggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query.q ? String(req.query.q).trim() : '';
    if (!q) {
      res.json({ success: true, data: [] });
      return;
    }

    const [products, categories] = await Promise.all([
      getProductModel()
        .find({ name: { $regex: q, $options: 'i' }, status: 'active', isPublished: true })
        .limit(5)
        .toArray(),
      getCategoryModel()
        .find({ name: { $regex: q, $options: 'i' } })
        .limit(3)
        .toArray(),
    ]);

    const suggestions: SearchSuggestion[] = [
      ...categories.map((c: any) => ({
        type: 'category' as const,
        label: c.name,
        slug: c.slug,
      })),
      ...products.map((p: any) => ({
        type: 'product' as const,
        label: p.name,
        slug: p.slug,
        image: p.images?.[0]?.url,
      })),
    ];

    res.json({ success: true, data: suggestions });
  } catch (err) {
    next(err);
  }
}

export async function reindexAll(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const count = await getProductModel().countDocuments();
    log.info({ count }, 'Reindexed products for search');
    res.json({ success: true, message: `Successfully synchronized ${count} products for search.` });
  } catch (err) {
    next(err);
  }
}
