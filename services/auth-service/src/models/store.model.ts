import mongoose, { Schema, Document } from 'mongoose';
import type { StoreStatus } from '@ornate/types';

export interface IStoreAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface IStoreLocation {
  lat: number;
  lng: number;
  formattedAddress?: string;
}

export interface IStore extends Document {
  storeId: string;
  name: string;
  typeOfStore?: string;
  ownerName: string;
  email: string;
  mobileNumber: string;
  passwordHash: string;
  role: 'store';
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  referralCode: string;
  referralName: string;
  referralType: 'vendor' | 'store';
  address: IStoreAddress;
  location: IStoreLocation;
  status: StoreStatus;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const storeAddressSchema = new Schema<IStoreAddress>(
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

const storeLocationSchema = new Schema<IStoreLocation>(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    formattedAddress: { type: String, trim: true },
  },
  { _id: false },
);

const storeSchema = new Schema<IStore>(
  {
    storeId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    typeOfStore: { type: String, default: 'Standard', trim: true },
    ownerName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    mobileNumber: { type: String, required: true, unique: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: 'store', index: true },
    categoryId: { type: String, required: true, index: true },
    categoryName: { type: String, required: true, trim: true },
    categorySlug: { type: String, required: true, trim: true },
    referralCode: { type: String, required: true, trim: true, index: true },
    referralName: { type: String, required: true, trim: true },
    referralType: { type: String, enum: ['vendor', 'store'], required: true },
    address: { type: storeAddressSchema, required: true },
    location: { type: storeLocationSchema, required: true },
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
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id?.toString() || ret.id;
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const Store = mongoose.model<IStore>('Store', storeSchema);

export async function generateNextStoreId(): Promise<string> {
  const lastStore = await Store.findOne({ storeId: /^STR\d+$/ })
    .sort({ storeId: -1 })
    .select('storeId');

  let maxNum = 0;
  if (lastStore?.storeId) {
    const match = lastStore.storeId.match(/^STR(\d+)$/);
    if (match) {
      maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
  }

  const nextNum = maxNum + 1;
  return `STR${String(nextNum).padStart(5, '0')}`;
}

