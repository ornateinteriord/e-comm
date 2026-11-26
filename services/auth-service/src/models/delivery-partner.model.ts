import mongoose, { Schema, Document } from 'mongoose';
import type {
  DeliveryAvailabilityStatus,
  DeliveryBankDetails,
  DeliveryGeoPoint,
  DeliveryKycDocuments,
  DeliveryKycStatus,
  DeliveryPartnerStatus,
  DeliveryVehicleType,
} from '@ornate/types';

export interface IDeliveryPartner extends Document {
  partnerId: string;
  name: string;
  email: string;
  mobileNumber: string;
  passwordHash: string;
  role: 'delivery_partner';
  vehicleType: DeliveryVehicleType;
  vehicleNumber: string;
  city: string;
  state: string;
  pincode: string;
  servicePincodes: string[];
  status: DeliveryPartnerStatus;
  isActive: boolean;
  kycStatus: DeliveryKycStatus;
  kycRejectionReason?: string;
  kycVerifiedAt?: Date;
  availabilityStatus: DeliveryAvailabilityStatus;
  currentLocation?: DeliveryGeoPoint;
  kycDocuments?: DeliveryKycDocuments;
  bankDetails?: DeliveryBankDetails;
  rating: number;
  totalDeliveries: number;
  totalEarningsPaise: number;
  cashInHandPaise: number;
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const geoPointSchema = new Schema<DeliveryGeoPoint>(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    formattedAddress: { type: String, trim: true },
    updatedAt: { type: String },
  },
  { _id: false },
);

const kycSchema = new Schema<DeliveryKycDocuments>(
  {
    drivingLicenseNumber: { type: String, trim: true },
    drivingLicenseUrl: { type: String, trim: true },
    vehicleRcUrl: { type: String, trim: true },
    idProofUrl: { type: String, trim: true },
    profilePhotoUrl: { type: String, trim: true },
  },
  { _id: false },
);

const bankSchema = new Schema<DeliveryBankDetails>(
  {
    accountHolderName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    ifscCode: { type: String, trim: true, uppercase: true },
    upiId: { type: String, trim: true },
  },
  { _id: false },
);

const deliveryPartnerSchema = new Schema<IDeliveryPartner>(
  {
    partnerId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    mobileNumber: { type: String, required: true, trim: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: 'delivery_partner', index: true },
    vehicleType: {
      type: String,
      enum: ['bike', 'scooter', 'bicycle', 'car', 'van'],
      default: 'bike',
    },
    vehicleNumber: { type: String, required: true, trim: true, uppercase: true },
    city: { type: String, required: true, trim: true, index: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true, index: true },
    servicePincodes: { type: [String], default: [], index: true },
    status: {
      type: String,
      enum: ['pending_approval', 'active', 'suspended'],
      default: 'pending_approval',
      index: true,
    },
    isActive: { type: Boolean, default: false, index: true },
    kycStatus: {
      type: String,
      enum: ['unverified', 'submitted', 'verified', 'rejected'],
      default: 'unverified',
      index: true,
    },
    kycRejectionReason: { type: String, trim: true },
    kycVerifiedAt: { type: Date },
    availabilityStatus: {
      type: String,
      enum: ['offline', 'online', 'on_delivery'],
      default: 'offline',
      index: true,
    },
    currentLocation: { type: geoPointSchema, default: undefined },
    kycDocuments: { type: kycSchema, default: {} },
    bankDetails: { type: bankSchema, default: {} },
    rating: { type: Number, default: 5.0, min: 0, max: 5 },
    totalDeliveries: { type: Number, default: 0, min: 0 },
    totalEarningsPaise: { type: Number, default: 0, min: 0 },
    cashInHandPaise: { type: Number, default: 0, min: 0 },
    lastActiveAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'delivery_partners',
    toJSON: {
      virtuals: true,
      transform: (doc, ret: Record<string, unknown>) => {
        ret.id = ret._id ? String(ret._id) : ret.id;
        ret.isKycComplete = isPartnerKycComplete(doc as unknown as IDeliveryPartner);
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export function isPartnerKycComplete(partner: {
  vehicleType?: string;
  kycDocuments?: DeliveryKycDocuments;
}): boolean {
  const docs = partner.kycDocuments || {};
  const hasIdProof = Boolean(docs.idProofUrl && docs.idProofUrl.trim());
  if (partner.vehicleType === 'bicycle') {
    return hasIdProof;
  }
  return Boolean(
    hasIdProof &&
      docs.drivingLicenseNumber &&
      docs.drivingLicenseNumber.trim() &&
      docs.drivingLicenseUrl &&
      docs.drivingLicenseUrl.trim() &&
      docs.vehicleRcUrl &&
      docs.vehicleRcUrl.trim(),
  );
}

export const DeliveryPartner = mongoose.model<IDeliveryPartner>(
  'DeliveryPartner',
  deliveryPartnerSchema,
  'delivery_partners',
);

export async function generateNextPartnerId(): Promise<string> {
  const lastPartner = await DeliveryPartner.findOne({ partnerId: /^DLV\d+$/ })
    .sort({ createdAt: -1 })
    .select('partnerId');

  let maxNum = 0;
  if (lastPartner?.partnerId) {
    const match = lastPartner.partnerId.match(/^DLV(\d+)$/);
    if (match) {
      maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
  }

  return `DLV${String(maxNum + 1).padStart(5, '0')}`;
}
