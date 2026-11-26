import mongoose, { Schema, Document } from 'mongoose';
import type {
  DeliveryAssignmentStatus,
  DeliveryGeoPoint,
  DeliveryStopLocation,
  DeliveryTrackingEvent,
  DeliveryVehicleType,
} from '@ornate/types';
import {
  ACTIVE_DELIVERY_STATUSES,
  DELIVERY_ASSIGNMENT_STATUSES,
} from '../domain/delivery-lifecycle.js';

export interface IDeliveryAssignment extends Document {
  assignmentCode: string;
  orderId: string;
  orderNumber: string;
  partnerId: string;
  partnerMongoId: string;
  partnerName: string;
  partnerPhone: string;
  vehicleType: DeliveryVehicleType;
  vehicleNumber?: string;
  assignmentMode: 'admin_assigned' | 'self_claimed';
  status: DeliveryAssignmentStatus;
  pickupLocation: DeliveryStopLocation;
  dropLocation: DeliveryStopLocation;
  itemsSummary: Array<{
    productId: string;
    name: string;
    sku: string;
    quantity: number;
    image?: string;
  }>;
  deliveryOtp: string;
  otpVerified: boolean;
  isCod: boolean;
  codAmountPaise: number;
  codCollectedPaise: number;
  codSettled: boolean;
  payoutPaise: number;
  tipPaise: number;
  distanceKm?: number;
  podPhotoUrl?: string;
  podSignatureUrl?: string;
  podRecipientName?: string;
  podNotes?: string;
  failureReason?: string;
  lastKnownLocation?: DeliveryGeoPoint;
  trackingHistory: DeliveryTrackingEvent[];
  assignedAt: Date;
  acceptedAt?: Date;
  arrivedPickupAt?: Date;
  pickedUpAt?: Date;
  arrivedCustomerAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const stopLocationSchema = new Schema<DeliveryStopLocation>(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    state: { type: String },
    pincode: { type: String, required: true },
    lat: { type: Number },
    lng: { type: Number },
  },
  { _id: false },
);

const geoPointSchema = new Schema<DeliveryGeoPoint>(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    formattedAddress: { type: String },
    updatedAt: { type: String },
  },
  { _id: false },
);

const deliveryAssignmentSchema = new Schema<IDeliveryAssignment>(
  {
    assignmentCode: { type: String, required: true, unique: true, index: true },
    orderId: { type: String, required: true, index: true },
    orderNumber: { type: String, required: true, index: true },
    partnerId: { type: String, required: true, index: true },
    partnerMongoId: { type: String, required: true, index: true },
    partnerName: { type: String, required: true },
    partnerPhone: { type: String, required: true },
    vehicleType: {
      type: String,
      enum: ['bike', 'scooter', 'bicycle', 'car', 'van'],
      default: 'bike',
    },
    vehicleNumber: { type: String },
    assignmentMode: {
      type: String,
      enum: ['admin_assigned', 'self_claimed'],
      default: 'self_claimed',
    },
    status: {
      type: String,
      enum: [...DELIVERY_ASSIGNMENT_STATUSES],
      default: 'assigned',
      index: true,
    },
    pickupLocation: { type: stopLocationSchema, required: true },
    dropLocation: { type: stopLocationSchema, required: true },
    itemsSummary: [
      {
        productId: { type: String, required: true },
        name: { type: String, required: true },
        sku: { type: String, required: true },
        quantity: { type: Number, required: true },
        image: { type: String },
      },
    ],
    deliveryOtp: { type: String, required: true },
    otpVerified: { type: Boolean, default: false },
    isCod: { type: Boolean, default: false },
    codAmountPaise: { type: Number, default: 0 },
    codCollectedPaise: { type: Number, default: 0 },
    codSettled: { type: Boolean, default: false },
    payoutPaise: { type: Number, default: 4000 },
    tipPaise: { type: Number, default: 0 },
    distanceKm: { type: Number },
    podPhotoUrl: { type: String },
    podSignatureUrl: { type: String },
    podRecipientName: { type: String },
    podNotes: { type: String },
    failureReason: { type: String },
    lastKnownLocation: { type: geoPointSchema },
    trackingHistory: [
      {
        status: { type: String, required: true },
        note: { type: String },
        lat: { type: Number },
        lng: { type: Number },
        changedBy: { type: String },
        timestamp: { type: String, required: true },
      },
    ],
    assignedAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date },
    arrivedPickupAt: { type: Date },
    pickedUpAt: { type: Date },
    arrivedCustomerAt: { type: Date },
    deliveredAt: { type: Date },
    failedAt: { type: Date },
    cancelledAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'delivery_assignments',
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id ? String(ret._id) : ret.id;
        ret.otpRequired = Boolean(ret.deliveryOtp);
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Ensure at most one active delivery assignment per order at the database layer
deliveryAssignmentSchema.index(
  { orderId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: [...ACTIVE_DELIVERY_STATUSES] },
    },
  },
);

export const DeliveryAssignment = mongoose.model<IDeliveryAssignment>(
  'DeliveryAssignment',
  deliveryAssignmentSchema,
  'delivery_assignments',
);

export function sanitizeAssignmentForPartner(assignment: IDeliveryAssignment) {
  const obj = assignment.toJSON() as Record<string, unknown>;
  obj.otpRequired = Boolean(obj.deliveryOtp);
  delete obj.deliveryOtp;
  return obj;
}
