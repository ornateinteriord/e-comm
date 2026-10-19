import mongoose, { Schema, Document } from 'mongoose';

/**
 * Outbox pattern: written in the same operation as product changes,
 * consumed asynchronously by the search sync worker.
 */
export interface ISearchIndexEvent extends Document {
  productId: string;
  action: 'upsert' | 'delete';
  status: 'pending' | 'done' | 'failed' | 'dead-letter';
  attempts: number;
  lastAttemptAt?: Date;
  error?: string;
  createdAt: Date;
}

const searchIndexEventSchema = new Schema<ISearchIndexEvent>(
  {
    productId: { type: String, required: true, index: true },
    action: { type: String, enum: ['upsert', 'delete'], required: true },
    status: {
      type: String,
      enum: ['pending', 'done', 'failed', 'dead-letter'],
      default: 'pending',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date },
    error: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Index for polling pending events
searchIndexEventSchema.index({ status: 1, createdAt: 1 });

export const SearchIndexEvent = mongoose.model<ISearchIndexEvent>(
  'SearchIndexEvent',
  searchIndexEventSchema,
);
