import mongoose, { Schema, Document } from 'mongoose';

export type DeletionRequestStatus = 'pending' | 'completed' | 'rejected' | 'cancelled';

export interface IDataDeletionRequest extends Document {
  userId: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  reason: string;
  notes?: string;
  status: DeletionRequestStatus;
  adminNotes?: string;
  requestedAt: Date;
  processedAt?: Date;
  processedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const dataDeletionRequestSchema = new Schema<IDataDeletionRequest>(
  {
    userId: { type: String, required: true, index: true },
    customerId: { type: String, index: true },
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    customerPhone: { type: String, trim: true },
    reason: { type: String, required: true, trim: true },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'completed', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    adminNotes: { type: String, trim: true },
    requestedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
    processedBy: { type: String, trim: true },
  },
  { timestamps: true },
);

dataDeletionRequestSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id?.toString();
    return ret;
  },
});

export const DataDeletionRequest = mongoose.model<IDataDeletionRequest>(
  'DataDeletionRequest',
  dataDeletionRequestSchema,
);
