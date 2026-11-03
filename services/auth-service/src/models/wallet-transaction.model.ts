import mongoose, { Schema, Document } from 'mongoose';
import type {
  WalletTransactionType,
  WalletTransactionCategory,
  WalletTransactionStatus,
} from '@ornate/types';

export interface IWalletTransaction extends Document {
  transactionId: string;
  userId: string;
  customerId?: string;
  type: WalletTransactionType;
  category: WalletTransactionCategory;
  amount: number; // in paise
  amountRupees: number; // in INR
  balanceAfter?: number; // in paise
  balanceAfterRupees?: number; // in INR
  status: WalletTransactionStatus;
  referenceId?: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const walletTransactionSchema = new Schema<IWalletTransaction>(
  {
    transactionId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    customerId: { type: String, index: true },
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['topup', 'order_payment', 'commission', 'refund', 'admin_adjustment'],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true }, // in paise
    amountRupees: { type: Number, required: true }, // in INR
    balanceAfter: { type: Number },
    balanceAfterRupees: { type: Number },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    referenceId: { type: String, index: true },
    description: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: 'wallettransactions',
  },
);

export const WalletTransaction = mongoose.model<IWalletTransaction>(
  'WalletTransaction',
  walletTransactionSchema,
);

