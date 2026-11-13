import mongoose, { Schema, Document } from 'mongoose';

export interface INotificationLog extends Document {
  recipient: string;
  subject: string;
  type: string;
  channel: 'email' | 'whatsapp';
  status: 'sent' | 'simulated' | 'failed';
  deliveryStatus?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  whatsappMessageId?: string;
  body?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const notificationLogSchema = new Schema<INotificationLog>(
  {
    recipient: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    type: { type: String, required: true, index: true },
    channel: {
      type: String,
      enum: ['email', 'whatsapp'],
      default: 'email',
      index: true,
    },
    status: {
      type: String,
      enum: ['sent', 'simulated', 'failed'],
      default: 'simulated',
      index: true,
    },
    deliveryStatus: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
      default: 'pending',
    },
    whatsappMessageId: { type: String, index: true },
    body: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const NotificationLog = mongoose.model<INotificationLog>('NotificationLog', notificationLogSchema);
