import dotenv from 'dotenv';
import path from 'node:path';
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB, mongoose } from '@ornate/db';
import { Seller } from '../models/seller.model.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const identifier = args[0] || '9200000000';
  const newPassword = args[1] || '12345678';

  console.log(`[ResetPassword] Target Identifier: "${identifier}"`);
  console.log(`[ResetPassword] Target Password: "${newPassword}"`);

  const uri = process.env.MONGODB_URI || '';
  const authDbName = process.env.AUTH_DB_NAME || 'ornate_auth';

  if (!uri) {
    console.error('[ResetPassword] Error: MONGODB_URI not found in environment.');
    process.exit(1);
  }

  await connectDB(uri, authDbName);
  console.log(`[ResetPassword] Connected to "${authDbName}"`);

  const cleanDigits = identifier.replace(/\D/g, '');
  const queryConditions: any[] = [
    { sellerId: new RegExp(`^${identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    { storeId: new RegExp(`^${identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    { email: identifier.toLowerCase() },
  ];
  if (cleanDigits.length >= 10) {
    const tenDigits = cleanDigits.slice(-10);
    queryConditions.push(
      { mobileNumber: tenDigits },
      { mobileNumber: `+91${tenDigits}` },
      { mobileNumber: `91${tenDigits}` },
    );
  }

  // 1. Search in stores collection
  let seller = await Seller.findOne({ $or: queryConditions });

  // 2. Fallback search in sellers collection
  if (!seller) {
    const authDb = mongoose.connection.useDb(authDbName).db;
    if (authDb) {
      const raw = await authDb.collection('sellers').findOne({ $or: queryConditions });
      if (raw) {
        seller = await Seller.findById(raw._id);
      }
    }
  }

  if (!seller) {
    console.error(`[ResetPassword] No seller found matching identifier: "${identifier}".`);
    await disconnectDB();
    process.exit(1);
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  seller.passwordHash = newHash;
  await seller.save();

  // Also update sellers collection directly if it exists
  try {
    const authDb = mongoose.connection.useDb(authDbName).db;
    if (authDb) {
      await authDb.collection('sellers').updateOne(
        { $or: queryConditions },
        { $set: { passwordHash: newHash } }
      );
    }
  } catch (err) {
    // ignore
  }

  console.log(`[ResetPassword] Successfully updated password for seller "${seller.name}" (${seller.sellerId || seller.storeId}) to "${newPassword}".`);
  console.log(`[ResetPassword] Stored new hash: ${newHash}`);

  await disconnectDB();
}

main().catch((err) => {
  console.error('[ResetPassword] Error:', err);
  process.exit(1);
});

