import mongoose, { Schema, Document } from 'mongoose';
import type { SellerStatus } from '@ornate/types';

export interface ISellerAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface ISellerLocation {
  lat: number;
  lng: number;
  formattedAddress?: string;
}

export interface ISeller extends Document {
  sellerId: string;
  storeId?: string;
  name: string;
  typeOfSeller?: string;
  typeOfStore?: string;
  ownerName: string;
  email: string;
  mobileNumber: string;
  passwordHash: string;
  role: 'seller' | 'store';
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  subcategoryId?: string;
  subcategoryName?: string;
  subcategorySlug?: string;
  maxStockLimit: number;
  currentStockTotal: number;
  availableCapacity?: number;
  referralCode: string;
  referralName: string;
  referralType: 'vendor' | 'seller' | 'store';
  address: ISellerAddress;
  location: ISellerLocation;
  status: SellerStatus;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const sellerAddressSchema = new Schema<ISellerAddress>(
  {
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    country: { type: String, required: true, default: 'India', trim: true },
  },
  { _id: false },
);

const sellerLocationSchema = new Schema<ISellerLocation>(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    formattedAddress: { type: String, trim: true },
  },
  { _id: false },
);

const sellerSchema = new Schema<ISeller>(
  {
    sellerId: { type: String, sparse: true, index: true },
    storeId: { type: String, sparse: true, index: true },
    name: { type: String, required: true, trim: true },
    typeOfSeller: { type: String, default: 'Standard', trim: true },
    typeOfStore: { type: String, default: 'Standard', trim: true },
    ownerName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    mobileNumber: { type: String, required: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: 'seller', index: true },
    categoryId: { type: String, required: true, index: true },
    categoryName: { type: String, required: true, trim: true },
    categorySlug: { type: String, required: true, trim: true },
    subcategoryId: { type: String, trim: true, index: true },
    subcategoryName: { type: String, trim: true },
    subcategorySlug: { type: String, trim: true },
    maxStockLimit: { type: Number, default: 2500, min: 0 },
    currentStockTotal: { type: Number, default: 0, min: 0 },
    referralCode: { type: String, required: true, trim: true, index: true },
    referralName: { type: String, required: true, trim: true },
    referralType: { type: String, enum: ['vendor', 'seller', 'store'], required: true },
    address: { type: sellerAddressSchema, required: true },
    location: { type: sellerLocationSchema, required: true },
    status: {
      type: String,
      enum: ['active', 'pending_approval', 'suspended'],
      default: 'active',
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    collection: 'stores',
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id?.toString() || ret.id;
        // Keep both sellerId and storeId populated for client compatibility
        ret.sellerId = ret.sellerId || ret.storeId;
        ret.storeId = ret.sellerId;
        ret.typeOfSeller = ret.typeOfSeller || ret.typeOfStore;
        ret.typeOfStore = ret.typeOfSeller;
        ret.availableCapacity = Math.max(0, (ret.maxStockLimit ?? 2500) - (ret.currentStockTotal ?? 0));
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  },
);

sellerSchema.virtual('availableCapacity').get(function () {
  return Math.max(0, (this.maxStockLimit ?? 2500) - (this.currentStockTotal ?? 0));
});

export function getDefaultMaxStockLimit(typeOfSeller?: string): number {
  const normalized = String(typeOfSeller || '').toLowerCase();
  if (normalized.includes('basic') || normalized.includes('express')) {
    return 500;
  }
  if (normalized.includes('advanced') || normalized.includes('superstore') || normalized.includes('warehouse') || normalized.includes('wholesale') || normalized.includes('flagship')) {
    return 10000;
  }
  return 2500;
}

sellerSchema.pre('save', function (next) {
  if (!this.sellerId && this.storeId) {
    this.sellerId = this.storeId;
  }
  if (!this.storeId && this.sellerId) {
    this.storeId = this.sellerId;
  }
  if (!this.typeOfSeller && this.typeOfStore) {
    this.typeOfSeller = this.typeOfStore;
  }
  if (!this.typeOfStore && this.typeOfSeller) {
    this.typeOfStore = this.typeOfSeller;
  }
  next();
});

export const Seller = mongoose.model<ISeller>('Seller', sellerSchema, 'stores');

// Backward compatibility alias
export const Store = Seller;
export type IStore = ISeller;
export type IStoreAddress = ISellerAddress;
export type IStoreLocation = ISellerLocation;

export async function generateNextSellerId(): Promise<string> {
  // Query both new SLR and legacy STR patterns
  const lastSeller = await Seller.findOne({
    $or: [{ sellerId: /^(?:SLR|STR)\d+$/ }, { storeId: /^(?:SLR|STR)\d+$/ }],
  })
    .sort({ createdAt: -1 })
    .select('sellerId storeId');

  let maxNum = 0;
  const rawId = lastSeller?.sellerId || lastSeller?.storeId;
  if (rawId) {
    const match = rawId.match(/^(?:SLR|STR)(\d+)$/);
    if (match) {
      maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
  }

  const nextNum = maxNum + 1;
  return `SLR${String(nextNum).padStart(5, '0')}`;
}

export const generateNextStoreId = generateNextSellerId;

