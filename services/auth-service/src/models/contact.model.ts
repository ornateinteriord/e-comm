import mongoose, { Schema, Document } from 'mongoose';
import type { ContactMessageStatus } from '@ornate/types';

export interface IContactMessage extends Document {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  status: ContactMessageStatus;
  adminNotes?: string;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const contactMessageSchema = new Schema<IContactMessage>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    subject: { type: String, trim: true, default: 'General Inquiry' },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['new', 'in_progress', 'resolved', 'archived'],
      default: 'new',
      index: true,
    },
    adminNotes: { type: String, trim: true },
    ip: { type: String },
    userAgent: { type: String },
  },
  {
    timestamps: true,
    collection: 'contact_messages',
  },
);

export const ContactMessage = mongoose.model<IContactMessage>('ContactMessage', contactMessageSchema);

