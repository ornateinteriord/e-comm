import mongoose, { Schema, Document } from 'mongoose';

export interface ICartItem {
  id: string;
  productId: string;
  variantId?: string | null;
  productName: string;
  productSlug: string;
  productImage?: string;
  sku: string;
  quantity: number;
  unitApplicablePrice: number;
  unitMrp: number;
  lineTotal: number;
}

export interface ICart extends Document {
  userId?: string | null;
  sessionId?: string | null;
  items: ICartItem[];
  couponCode?: string | null;
  couponDiscount: number;
  subtotal: number;
  shippingCharge: number;
  tax: number;
  grandTotal: number;
  updatedAt: Date;
  createdAt: Date;
}

const cartItemSchema = new Schema<ICartItem>(
  {
    id: { type: String, required: true },
    productId: { type: String, required: true },
    variantId: { type: String, default: null },
    productName: { type: String, default: 'Product' },
    productSlug: { type: String, default: 'product' },
    productImage: { type: String, default: '' },
    sku: { type: String, default: 'SKU' },
    quantity: { type: Number, required: true, min: 1 },
    unitApplicablePrice: { type: Number, required: true, min: 0 },
    unitMrp: { type: Number, default: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const cartSchema = new Schema<ICart>(
  {
    userId: { type: String, index: true, default: null },
    sessionId: { type: String, index: true, default: null },
    items: [cartItemSchema],
    couponCode: { type: String, default: null },
    couponDiscount: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    shippingCharge: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Cart = mongoose.model<ICart>('Cart', cartSchema);
