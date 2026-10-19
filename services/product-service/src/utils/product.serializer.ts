import { IProduct, IProductPricing } from '../models/product.model.js';
import { getApplicablePrice } from '@ornate/pricing-utils';
import type { PublicProduct, AdminProduct } from '@ornate/types';

function serializeDeal(deal: IProductPricing['deal']) {
  if (!deal || !deal.isActive || !deal.startDate || !deal.endDate) {
    return null;
  }
  return {
    isActive: Boolean(deal.isActive),
    startDate: deal.startDate instanceof Date ? deal.startDate.toISOString() : new Date(deal.startDate).toISOString(),
    endDate: deal.endDate instanceof Date ? deal.endDate.toISOString() : new Date(deal.endDate).toISOString(),
    maxQtyPerOrder: deal.maxQtyPerOrder ?? null,
  };
}

function safeIsoString(date: Date | string | undefined): string {
  if (!date) return new Date().toISOString();
  if (date instanceof Date) return date.toISOString();
  return new Date(date).toISOString();
}

/**
 * Serializes a product for public customer-facing APIs.
 * NEVER includes inwardPrice.
 */
export function serializePublicProduct(product: IProduct): PublicProduct {
  const deal = serializeDeal(product.pricing.deal);
  const pricing = getApplicablePrice({
    mrp: product.pricing.mrp,
    sellingPrice: product.pricing.sellingPrice,
    dealPrice: product.pricing.dealPrice ?? null,
    deal,
  });

  const categoryObj = product.category as any;
  const categoryId = categoryObj
    ? (categoryObj._id ? categoryObj._id.toString() : categoryObj.toString())
    : '';
  const categoryName = categoryObj && categoryObj.name ? String(categoryObj.name) : '';

  return {
    id: (product._id ?? product.id).toString(),
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    brand: product.brand,
    shortDescription: product.shortDescription,
    longDescription: product.longDescription,
    categoryId,
    categoryName,
    images: product.images ?? [],
    pricing,
    stock: product.stock,
    attributes: product.attributes ?? [],
    variants: product.variants ?? [],
    status: product.status,
    isPublished: product.isPublished,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    weight: product.weight,
    dimensions: product.dimensions,
    createdAt: safeIsoString(product.createdAt),
    updatedAt: safeIsoString(product.updatedAt),
  };
}

/**
 * Serializes a product for admin APIs.
 * Includes inwardPrice — must only be called behind auth + finance_manager+ guards.
 */
export function serializeAdminProduct(product: IProduct): AdminProduct {
  const deal = serializeDeal(product.pricing.deal);
  const applicablePrice = getApplicablePrice({
    mrp: product.pricing.mrp,
    sellingPrice: product.pricing.sellingPrice,
    dealPrice: product.pricing.dealPrice ?? null,
    deal,
  });

  return {
    ...serializePublicProduct(product),
    pricing: {
      ...applicablePrice,
      mrp: product.pricing.mrp,
      sellingPrice: product.pricing.sellingPrice,
      dealPrice: product.pricing.dealPrice ?? null,
      inwardPrice: product.pricing.inwardPrice,
      deal,
    },
    lowStockThreshold: product.lowStockThreshold,
    taxClass: product.taxClass,
  };
}
