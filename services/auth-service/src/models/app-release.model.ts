import mongoose, { Schema, Document } from 'mongoose';
import type { DeliveryAppReleaseInfo } from '@ornate/types';

export interface IAppRelease extends Document {
  key: string;
  versionName: string;
  versionCode: number;
  minSupportedVersionCode: number;
  apkUrl: string;
  playStoreUrl?: string;
  releaseNotes?: string;
  forceUpdate: boolean;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const appReleaseSchema = new Schema<IAppRelease>(
  {
    key: { type: String, required: true, unique: true, default: 'delivery_android' },
    versionName: { type: String, required: true, default: '1.0.0' },
    versionCode: { type: Number, required: true, default: 100 },
    minSupportedVersionCode: { type: Number, required: true, default: 100 },
    apkUrl: { type: String, default: '', trim: true },
    playStoreUrl: { type: String, default: '', trim: true },
    releaseNotes: { type: String, default: '' },
    forceUpdate: { type: Boolean, default: false },
    updatedBy: { type: String },
  },
  { timestamps: true, collection: 'app_releases' },
);

export const AppRelease = mongoose.model<IAppRelease>('AppRelease', appReleaseSchema, 'app_releases');

export async function getDeliveryAppReleaseInfo(): Promise<DeliveryAppReleaseInfo> {
  const doc = await AppRelease.findOne({ key: 'delivery_android' }).lean().catch(() => null);

  const versionName = doc?.versionName || process.env.DELIVERY_APP_VERSION_NAME || '1.0.0';
  const versionCode = Number(doc?.versionCode ?? process.env.DELIVERY_APP_VERSION_CODE ?? 100);
  const minSupportedVersionCode = Number(
    doc?.minSupportedVersionCode ?? process.env.DELIVERY_APP_MIN_VERSION_CODE ?? 100,
  );
  const apkUrl = (doc?.apkUrl || process.env.DELIVERY_APK_URL || '').trim();
  const playStoreUrl = (doc?.playStoreUrl || process.env.DELIVERY_PLAYSTORE_URL || '').trim();
  const releaseNotes = doc?.releaseNotes || process.env.DELIVERY_RELEASE_NOTES || '';
  const forceUpdate = Boolean(doc?.forceUpdate);

  return {
    appId: 'biz.eshopy.delivery',
    appName: 'E-Shopy Rider',
    versionName,
    versionCode,
    minSupportedVersionCode,
    apkUrl,
    playStoreUrl: playStoreUrl || undefined,
    downloadUrl: apkUrl ? '/api/v1/delivery/app-download' : playStoreUrl || '',
    releaseNotes: releaseNotes || undefined,
    forceUpdate,
    isConfigured: Boolean(apkUrl || playStoreUrl),
    updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
  };
}
