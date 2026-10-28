import mongoose, { Schema, Document } from 'mongoose';
import type { UserRole } from '@ornate/types';

export interface ICustomer extends Document {
  customerId?: string;
  customer_id?: string;
  userId?: string;
  name: string;
  fullName: string;
  email: string;
  mobileNumber?: string;
  phone?: string;
  username?: string;
  passwordHash: string;
  role: UserRole;
  referralCode?: string;
  referralName?: string;
  referralType?: 'vendor' | 'customer';
  vendor_id?: string | null;
  vendor_name?: string | null;
  country?: string;
  state?: string;
  city?: string;
  pincode?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  avatar?: string;
  isActive: boolean;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  totalOrders: number;
  totalSpent: number;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    customerId: { type: String, unique: true, sparse: true, index: true },
    customer_id: { type: String, sparse: true, index: true },
    userId: { type: String, index: true },
    name: { type: String, required: true, trim: true },
    fullName: { type: String, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    mobileNumber: { type: String, trim: true, index: true, sparse: true },
    phone: { type: String, trim: true },
    username: { type: String, trim: true, index: true, sparse: true },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: [
        'customer',
        'support',
        'catalog_manager',
        'inventory_manager',
        'order_manager',
        'finance_manager',
        'admin',
        'super_admin',
      ],
      default: 'customer',
    },
    referralCode: { type: String, trim: true, index: true },
    referralName: { type: String, trim: true },
    referralType: { type: String, enum: ['vendor', 'customer'], default: 'vendor' },
    vendor_id: { type: String, default: null },
    vendor_name: { type: String, default: null },
    country: { type: String, default: 'India', trim: true },
    state: { type: String, trim: true },
    city: { type: String, trim: true },
    pincode: { type: String, trim: true },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say'],
      default: 'prefer_not_to_say',
    },
    avatar: { type: String },
    isActive: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: 'customers',
  },
);

// Pre-save hook to ensure userId, name, and phone are synced
customerSchema.pre('save', function (next) {
  if (!this.userId) {
    this.userId = this._id.toString();
  }
  if (!this.fullName && this.name) {
    this.fullName = this.name;
  }
  if (!this.name && this.fullName) {
    this.name = this.fullName;
  }
  if (!this.phone && this.mobileNumber) {
    this.phone = this.mobileNumber;
  }
  if (!this.mobileNumber && this.phone) {
    this.mobileNumber = this.phone;
  }
  if (!this.username && this.mobileNumber) {
    this.username = this.mobileNumber;
  }
  if (!this.customer_id && this.customerId) {
    this.customer_id = this.customerId;
  }
  if (!this.customerId && this.customer_id) {
    this.customerId = this.customer_id;
  }
  next();
});

export const Customer = mongoose.model<ICustomer>('Customer', customerSchema);

export async function generateNextCustomerId(): Promise<string> {
  const lastCustomer = await Customer.findOne({ customerId: /^CUS\d+$/ })
    .sort({ customerId: -1 })
    .select('customerId');

  if (!lastCustomer || !lastCustomer.customerId) {
    return 'CUS00001';
  }

  const match = lastCustomer.customerId.match(/^CUS(\d+)$/);
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1;
    return `CUS${String(nextNum).padStart(5, '0')}`;
  }

  const count = await Customer.countDocuments();
  return `CUS${String(count + 1).padStart(5, '0')}`;
}

