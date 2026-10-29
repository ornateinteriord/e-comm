import mongoose, { Schema, Document } from 'mongoose';
import type { PaymentStatus, FulfilmentStatus, OrderAddress, OrderPricing, OrderItem, StatusHistoryEntry } from '@ornate/types';

export interface IOrder extends Document {
  orderNumber: string;
  userId: string;
  customerEmail: string;
  customerName: string;
  shippingAddress: OrderAddress;
  billingAddress: OrderAddress;
  items: OrderItem[];
  pricing: OrderPricing;
  couponCode?: string | null;
  paymentStatus: PaymentStatus;
  fulfilmentStatus: FulfilmentStatus;
  paymentMethod?: string;
  paymentReference?: string;
  cashfreeOrderId?: string;
  invoiceId?: string | null;
  trackingNumber?: string;
  shippingProvider?: string;
  statusHistory: StatusHistoryEntry[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<OrderAddress>(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, required: true, default: 'India' },
  },
  { _id: false },
);

const orderItemSchema = new Schema<OrderItem>(
  {
    productId: { type: String, required: true },
    variantId: { type: String, default: null },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    image: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    unitMrp: { type: Number, required: true },
    unitSellingPrice: { type: Number, required: true },
    unitApplicablePrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 18 },
    taxAmount: { type: Number, default: 0 },
    lineTotal: { type: Number, required: true },
  },
  { _id: false },
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    customerEmail: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    shippingAddress: { type: addressSchema, required: true },
    billingAddress: { type: addressSchema, required: true },
    items: [orderItemSchema],
    pricing: {
      subtotal: { type: Number, required: true },
      couponDiscount: { type: Number, default: 0 },
      shippingCharge: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      grandTotal: { type: Number, required: true },
    },
    couponCode: { type: String, default: null },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'],
      default: 'pending',
      index: true,
    },
    fulfilmentStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned'],
      default: 'pending',
      index: true,
    },
    paymentMethod: { type: String, default: 'Cashfree' },
    paymentReference: { type: String, default: null },
    cashfreeOrderId: { type: String, default: null },
    invoiceId: { type: String, default: null },
    trackingNumber: { type: String, default: null },
    shippingProvider: { type: String, default: null },
    statusHistory: [
      {
        status: { type: String, required: true },
        changedBy: { type: String, required: true },
        changedAt: { type: String, required: true },
        note: { type: String },
      },
    ],
    notes: { type: String },
  },
  { timestamps: true },
);

export const Order = mongoose.model<IOrder>('Order', orderSchema);
