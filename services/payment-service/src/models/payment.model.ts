import mongoose, { Schema, Document } from 'mongoose';

export type PaymentGatewayType = 'razorpay' | 'cashfree' | 'paytm' | 'wallet';

export interface IPaymentTransaction extends Document {
  transactionId: string;
  orderId: string;
  orderNumber: string;
  userId?: string;
  amount: number; // in paise (smallest INR unit)
  currency: string;
  method: string;
  gateway?: PaymentGatewayType;
  status: 'created' | 'success' | 'failed' | 'refunded' | 'pending' | 'user_dropped';
  // Razorpay specific fields
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  // Cashfree specific fields
  cfOrderId?: string;         // Cashfree's order_id returned from create order
  cfPaymentId?: string;       // Cashfree's cf_payment_id after payment
  paymentSessionId?: string;  // Cashfree payment_session_id for frontend SDK
  // Paytm specific fields
  paytmOrderId?: string;
  paytmTxnToken?: string;
  paytmBankTxnId?: string;
  paytmChecksum?: string;
  // Legacy fields (retained for compatibility)
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
  // Error details
  errorDescription?: string;
  failureReason?: string;
  webhookProcessed?: boolean;
  environment?: 'production' | 'sandbox' | 'stage';
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
    method: { type: String, default: 'cashfree' },
    gateway: {
      type: String,
      enum: ['razorpay', 'cashfree', 'paytm', 'wallet'],
      default: 'razorpay',
      index: true,
    },
    status: {
      type: String,
      enum: ['created', 'success', 'failed', 'refunded', 'pending', 'user_dropped'],
      default: 'created',
      index: true,
    },
    // Razorpay
    razorpayOrderId: { type: String, index: true, sparse: true },
    razorpayPaymentId: { type: String, index: true, sparse: true },
    razorpaySignature: { type: String },
    // Cashfree
    cfOrderId: { type: String, index: true, sparse: true },
    cfPaymentId: { type: String, index: true, sparse: true },
    paymentSessionId: { type: String },
    // Paytm
    paytmOrderId: { type: String, index: true, sparse: true },
    paytmTxnToken: { type: String },
    paytmBankTxnId: { type: String },
    paytmChecksum: { type: String },
    // Legacy / fallback
    gatewayOrderId: { type: String },
    gatewayPaymentId: { type: String },
    gatewaySignature: { type: String },
    // Error
    errorDescription: { type: String },
    failureReason: { type: String },
    webhookProcessed: { type: Boolean, default: false },
    environment: { type: String, enum: ['production', 'sandbox', 'stage'], default: 'sandbox' },
  },
  { timestamps: true },
);

export const PaymentTransaction = mongoose.model<IPaymentTransaction>('PaymentTransaction', paymentTransactionSchema);
