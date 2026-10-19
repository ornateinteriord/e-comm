import mongoose, { Schema, Document } from 'mongoose';
import type { CouponType } from '@ornate/types';

export interface ICoupon extends Document {
  code: string;
  type: CouponType;
  value: number;
  maxDiscountAmount?: number | null;
  minOrderValue: number;
  usageLimit?: number | null;
  usedCount: number;
  perUserLimit?: number | null;
  isActive: boolean;
  validFrom: Date;
  validTo: Date;
  applicableCategories: string[];
  applicableProducts: string[];
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<ICoupon>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: ['percentage', 'fixed'], required: true },
    value: { type: Number, required: true, min: 0 },
    maxDiscountAmount: { type: Number, default: null },
    minOrderValue: { type: Number, default: 0 },
    usageLimit: { type: Number, default: null },
    usedCount: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true, index: true },
    validFrom: { type: Date, default: Date.now },
    validTo: { type: Date, required: true },
    applicableCategories: [{ type: String }],
    applicableProducts: [{ type: String }],
  },
  { timestamps: true },
);

export const Coupon = mongoose.model<ICoupon>('Coupon', couponSchema);
