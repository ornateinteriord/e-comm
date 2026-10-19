import mongoose, { Schema, Document } from 'mongoose';

export interface IPaymentTransaction extends Document {
  transactionId: string;
  orderId: string;
  orderNumber: string;
  userId?: string;
  amount: number; // in paise
  currency: string;
  method: string;
  status: 'created' | 'success' | 'failed' | 'refunded';
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
  errorDescription?: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    transactionId: { type: String, required: true, unique: true, index: true },
    orderId: { type: String, required: true, index: true },
    orderNumber: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    method: { type: String, default: 'razorpay' },
    status: {
      type: String,
      enum: ['created', 'success', 'failed', 'refunded'],
      default: 'created',
      index: true,
    },
    gatewayOrderId: { type: String },
    gatewayPaymentId: { type: String },
    gatewaySignature: { type: String },
    errorDescription: { type: String },
  },
  { timestamps: true },
);

export const PaymentTransaction = mongoose.model<IPaymentTransaction>('PaymentTransaction', paymentTransactionSchema);
