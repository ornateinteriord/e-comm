import mongoose, { Schema, Document } from 'mongoose';
import type { UserRole } from '@ornate/types';

export interface IAdmin extends Document {
  email: string;
  username: string;
  passwordHash: string;
  name: string;
  fullName?: string;
  role: UserRole;
  isActive: boolean;
  emailVerified?: boolean;
  phone?: string;
  mobileNumber?: string;
  avatar?: string;
  profilePicture?: string;
  createdAt: Date;
  updatedAt: Date;
}

const adminSchema = new Schema<IAdmin>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    fullName: { type: String, trim: true },
    role: {
      type: String,
      enum: [
        'admin',
        'super_admin',
        'catalog_manager',
        'inventory_manager',
        'order_manager',
        'finance_manager',
        'support',
      ],
      default: 'super_admin',
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    emailVerified: { type: Boolean, default: true },
    phone: { type: String, sparse: true },
    mobileNumber: { type: String, sparse: true },
    avatar: { type: String },
    profilePicture: { type: String },
  },
  {
    timestamps: true,
    collection: 'admins',
  },
);

export const Admin = mongoose.model<IAdmin>('Admin', adminSchema);

