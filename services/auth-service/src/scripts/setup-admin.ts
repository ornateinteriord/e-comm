import dotenv from 'dotenv';
import path from 'node:path';
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '@ornate/db';
import { createLogger } from '@ornate/logger';
import { Customer } from '../models/customer.model.js';
import { AuditLog } from '../models/audit-log.model.js';

const log = createLogger('setup-admin');

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL ?? 'admin@ornate.dev';
  const password = process.env.ADMIN_PASSWORD ?? 'Admin@1234';
  const name = process.env.ADMIN_NAME ?? 'Super Admin';

  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_EMAIL) {
    log.error('Set ADMIN_EMAIL env var before running setup in production.');
    process.exit(1);
  }

  await connectDB(
    process.env.MONGODB_URI ?? 'mongodb://localhost:27017',
    process.env.AUTH_DB_NAME ?? 'ornate_auth',
  );

  const existing = await Customer.findOne({ email });
  if (existing) {
    log.info({ email }, 'Admin customer already exists. Updating role to super_admin.');
    existing.role = 'super_admin';
    existing.username = 'admin';
    await existing.save();
    await disconnectDB();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await Customer.create({
    email,
    passwordHash,
    name,
    fullName: name,
    username: 'admin',
    role: 'super_admin',
    emailVerified: true,
    isActive: true,
    referralCode: 'SYSTEM',
    referralName: 'System Admin',
  });

  await AuditLog.create({
    action: 'admin.setup_admin',
    targetModel: 'User',
    targetId: user.id,
    after: { email, role: 'super_admin' },
  });

  log.info({ email, password: process.env.NODE_ENV === 'production' ? '[hidden]' : password },
    'Admin user created. Change the password immediately after first login.');

  await disconnectDB();
}

main().catch((err) => {
  log.error({ err }, 'Setup failed');
  process.exit(1);
});
