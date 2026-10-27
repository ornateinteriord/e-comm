import mongoose, { Schema, Document } from 'mongoose';

export interface IProductPricing {
  mrp: number;
  sellingPrice: number;
  dealPrice?: number | null;
  inwardPrice: number;
  deal?: {
    isActive: boolean;
    startDate: Date;
    endDate: Date;
    maxQtyPerOrder?: number | null;
  } | null;
}

export interface IProductImage {
  id: string;
  url: string;
  alt?: string;
  order: number;
}

export interface IProductAttribute {
  key: string;
  value: string;
}

export interface IProductVariant {
  id: string;
  sku: string;
  attributes: IProductAttribute[];
  stock: number;
  sellingPriceOverride?: number | null;
}

export interface IPriceHistoryEntry {
  changedBy: string;
  changedAt: Date;
  snapshot: IProductPricing;
}

export interface IProduct extends Document {
  name: string;
  slug: string;
  sku: string;
  brand?: string;
  shortDescription?: string;
  longDescription?: string;
  category: mongoose.Types.ObjectId;
  subcategory?: mongoose.Types.ObjectId | null;
  images: IProductImage[];
  pricing: IProductPricing;
  stock: number;
  lowStockThreshold: number;
  status: 'draft' | 'active' | 'archived';
  isPublished: boolean;
  isFeatured?: boolean;
  attributes: IProductAttribute[];
  variants: IProductVariant[];
  seoTitle?: string;
  seoDescription?: string;
  taxClass?: string;
  weight?: number;
  dimensions?: { l: number; w: number; h: number };
  priceHistory: IPriceHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const productPricingSchema = new Schema<IProductPricing>(
  {
    mrp: { type: Number, required: true, min: 0, validate: Number.isInteger },
    sellingPrice: { type: Number, required: true, min: 0, validate: Number.isInteger },
    dealPrice: { type: Number, min: 0, default: null },
    inwardPrice: { type: Number, required: true, min: 0, validate: Number.isInteger },
    deal: {
      isActive: { type: Boolean, default: false },
      startDate: { type: Date },
      endDate: { type: Date },
      maxQtyPerOrder: { type: Number, default: null },
    },
  },
  { _id: false },
);

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, index: 'text' },
    slug: { type: String, required: true, unique: true, index: true },
    sku: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
    brand: { type: String, trim: true, index: true },
    shortDescription: { type: String },
    longDescription: { type: String },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    subcategory: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    images: [
      {
        id: { type: String, required: true },
        url: { type: String, required: true },
        alt: { type: String },
        order: { type: Number, default: 0 },
      },
    ],
    pricing: { type: productPricingSchema, required: true },
    stock: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    status: {
      type: String,
      enum: ['draft', 'active', 'archived'],
      default: 'draft',
      index: true,
    },
    isPublished: { type: Boolean, default: false, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    attributes: [
      {
        key: { type: String, required: true },
        value: { type: String, required: true },
      },
    ],
    variants: [
      {
        id: { type: String, required: true, default: () => new mongoose.Types.ObjectId().toString() },
        sku: { type: String, required: true },
        attributes: [{ key: String, value: String }],
        stock: { type: Number, default: 0 },
        sellingPriceOverride: { type: Number, default: null },
      },
    ],
    seoTitle: { type: String },
    seoDescription: { type: String },
    taxClass: { type: String },
    weight: { type: Number },
    dimensions: {
      l: { type: Number },
      w: { type: Number },
      h: { type: Number },
    },
    priceHistory: [
      {
        changedBy: { type: String, required: true },
        changedAt: { type: Date, default: Date.now },
        snapshot: { type: Schema.Types.Mixed },
      },
    ],
  },
  { timestamps: true },
);

// Compound index for category + status + published
productSchema.index({ category: 1, status: 1, isPublished: 1 });
productSchema.index({ status: 1, isPublished: 1 });
productSchema.index({ 'pricing.mrp': 1 });
productSchema.index({ 'pricing.sellingPrice': 1 });
productSchema.index({ stock: 1 });

export const Product = mongoose.model<IProduct>('Product', productSchema);
