import mongoose, { Schema, Document } from 'mongoose';
import type { InvoiceLineItem, SellerDetails, CustomerDetails, TaxBreakdown } from '@ornate/types';

export interface IInvoiceDoc extends Document {
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  invoiceDate: string;
  sellerDetails: SellerDetails;
  customerDetails: CustomerDetails;
  lineItems: InvoiceLineItem[];
  taxBreakdown: TaxBreakdown[];
  subtotal: number;
  couponDiscount: number;
  shippingCharge: number;
  totalTax: number;
  grandTotal: number;
  currency: string;
  paymentReference?: string;
  pdfUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema<IInvoiceDoc>(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    orderId: { type: String, required: true, index: true },
    orderNumber: { type: String, required: true, index: true },
    invoiceDate: { type: String, required: true },
    sellerDetails: {
      name: { type: String, required: true },
      address: { type: String, required: true },
      gstin: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
    },
    customerDetails: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String },
      billingAddress: {
        name: String,
        phone: String,
        line1: String,
        line2: String,
        city: String,
        state: String,
        pincode: String,
        country: String,
      },
    },
    lineItems: [
      {
        name: { type: String, required: true },
        sku: { type: String, required: true },
        quantity: { type: Number, required: true },
        unitPrice: { type: Number, required: true },
        discount: { type: Number, default: 0 },
        taxRate: { type: Number, default: 18 },
        taxAmount: { type: Number, default: 0 },
        lineTotal: { type: Number, required: true },
      },
    ],
    taxBreakdown: [
      {
        description: { type: String, required: true },
        rate: { type: Number, required: true },
        taxableAmount: { type: Number, required: true },
        taxAmount: { type: Number, required: true },
      },
    ],
    subtotal: { type: Number, required: true },
    couponDiscount: { type: Number, default: 0 },
    shippingCharge: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    paymentReference: { type: String },
    pdfUrl: { type: String },
  },
  { timestamps: true },
);

export const Invoice = mongoose.model<IInvoiceDoc>('Invoice', invoiceSchema);
