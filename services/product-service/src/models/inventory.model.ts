import mongoose, { Schema, Document } from 'mongoose';
import type { InventoryMovementType } from '@ornate/types';

export interface IInventoryItem extends Document {
  productId: string;
  variantId?: string | null;
  sku: string;
  productName: string;
  quantity: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  updatedAt: Date;
  createdAt: Date;
}

const inventoryItemSchema = new Schema<IInventoryItem>(
  {
    productId: { type: String, required: true, index: true },
    variantId: { type: String, default: null },
    sku: { type: String, required: true, uppercase: true, trim: true, index: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, default: 0, min: 0 },
    reserved: { type: Number, required: true, default: 0, min: 0 },
    available: { type: Number, required: true, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5 },
  },
  { timestamps: true },
);

inventoryItemSchema.index({ productId: 1, variantId: 1 }, { unique: true });

export const InventoryItem = mongoose.model<IInventoryItem>('InventoryItem', inventoryItemSchema);

export interface IInventoryMovementDoc extends Document {
  productId: string;
  variantId?: string | null;
  sku: string;
  type: InventoryMovementType;
  delta: number;
  balanceBefore: number;
  balanceAfter: number;
  reason?: string;
  performedBy: string;
  createdAt: Date;
}

const inventoryMovementSchema = new Schema<IInventoryMovementDoc>(
  {
    productId: { type: String, required: true, index: true },
    variantId: { type: String, default: null },
    sku: { type: String, required: true, uppercase: true },
    type: {
      type: String,
      enum: ['sale', 'restock', 'adjustment', 'reservation', 'release', 'return'],
      required: true,
    },
    delta: { type: Number, required: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    reason: { type: String },
    performedBy: { type: String, required: true },
  },
  { timestamps: true },
);

export const InventoryMovement = mongoose.model<IInventoryMovementDoc>('InventoryMovement', inventoryMovementSchema);
