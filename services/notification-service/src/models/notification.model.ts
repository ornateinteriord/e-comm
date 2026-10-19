import mongoose, { Schema, Document } from 'mongoose';

export interface INotificationLog extends Document {
  recipient: string;
  subject: string;
  type: string;
  status: 'sent' | 'simulated' | 'failed';
  body?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const notificationLogSchema = new Schema<INotificationLog>(
  {
    recipient: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    type: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['sent', 'simulated', 'failed'],
      default: 'simulated',
    },
    body: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const NotificationLog = mongoose.model<INotificationLog>('NotificationLog', notificationLogSchema);
