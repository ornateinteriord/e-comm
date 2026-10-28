import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { Customer, generateNextCustomerId } from '../models/customer.model.js';
import { AuditLog } from '../models/audit-log.model.js';
import { lookupReferralCode } from '../utils/referral.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';
import { createLogger } from '@ornate/logger';

const log = createLogger('auth-controller');
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12);
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN ?? 'localhost';

function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'strict',
    domain: COOKIE_DOMAIN,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/v1/auth',
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'strict',
    domain: COOKIE_DOMAIN,
    path: '/api/v1/auth',
  });
}

// GET/POST /api/v1/auth/verify-referral?code=:code
export async function verifyReferral(req: Request, res: Response): Promise<void> {
  const code = String(req.query.code || req.body?.code || '').trim();
  if (!code) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Referral code is required.' },
    });
    return;
  }

  const result = await lookupReferralCode(code);
  if (!result.valid) {
    res.status(404).json({
      success: false,
      error: { code: 'INVALID_REFERRAL_CODE', message: result.message || 'Invalid referral code.' },
    });
    return;
  }

  res.json({
    success: true,
    data: {
      valid: true,
      referralCode: result.referralCode,
      referralName: result.referralName,
      referralType: result.referralType,
    },
  });
}

// POST /api/v1/auth/register
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      referralCode,
      fullName,
      name,
      email,
      mobileNumber,
      phone,
      password,
      country,
      state,
      city,
      pincode,
      gender,
    } = req.body;

    const rawRefCode = String(referralCode || '').trim();
    if (!rawRefCode) {
      res.status(422).json({
        success: false,
        error: { code: 'REFERRAL_REQUIRED', message: 'A valid referral code is mandatory to create an account.' },
      });
      return;
    }

    // Verify referral code server-side
    const refResult = await lookupReferralCode(rawRefCode);
    if (!refResult.valid) {
      res.status(422).json({
        success: false,
        error: { code: 'INVALID_REFERRAL_CODE', message: refResult.message || 'Invalid referral code.' },
      });
      return;
    }

    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanMobile = String(mobileNumber || phone || '').trim();
    const cleanName = String(fullName || name || '').trim();
    const username = cleanMobile; // username = mobilenumber

    if (!cleanEmail || !cleanMobile || !password || !cleanName) {
      res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Full name, email, mobile number, and password are required.' },
      });
      return;
    }

    // Check for existing customer by email, mobileNumber, or username
    const existing = await Customer.findOne({
      $or: [
        { email: cleanEmail },
        { mobileNumber: cleanMobile },
        { phone: cleanMobile },
        { username },
      ],
    });

    if (existing) {
      const matchField = existing.email === cleanEmail ? 'email' : 'mobile number';
      res.status(409).json({
        success: false,
        error: { code: 'USER_EXISTS', message: `An account with this ${matchField} already exists.` },
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const customerId = await generateNextCustomerId();

    // Create customer in unified customers collection (vendor_id and vendor_name left empty as instructed)
    const customer = await Customer.create({
      customerId,
      customer_id: customerId,
      name: cleanName,
      fullName: cleanName,
      email: cleanEmail,
      mobileNumber: cleanMobile,
      phone: cleanMobile,
      username,
      passwordHash,
      role: 'customer',
      referralCode: refResult.referralCode || rawRefCode,
      referralName: refResult.referralName || 'Referral',
      referralType: refResult.referralType || 'vendor',
      vendor_id: null,
      vendor_name: null,
      country: country || 'India',
      state: state || '',
      city: city || '',
      pincode: pincode || '',
      gender: gender || 'prefer_not_to_say',
      emailVerificationToken: crypto.createHash('sha256').update(verificationToken).digest('hex'),
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isActive: true,
      emailVerified: false,
    });

    const accessToken = signAccessToken({ userId: customer.id, email: customer.email, role: customer.role });
    const refreshToken = signRefreshToken({ userId: customer.id });
    setRefreshCookie(res, refreshToken);

    await AuditLog.create({
      action: 'auth.register',
      actorId: customer.id,
      actorRole: customer.role,
      targetModel: 'Customer',
      targetId: customer.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      data: {
        accessToken,
        user: {
          id: customer.id,
          customerId: customer.customerId,
          email: customer.email,
          name: customer.name,
          fullName: customer.fullName,
          username: customer.username,
          mobileNumber: customer.mobileNumber,
          phone: customer.phone,
          role: customer.role,
          emailVerified: customer.emailVerified,
          country: customer.country,
          state: customer.state,
          city: customer.city,
          pincode: customer.pincode,
          gender: customer.gender,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/auth/login
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, username, mobileNumber, password } = req.body;
    const identifier = String(mobileNumber || username || email || '').trim();

    if (!identifier || !password) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Mobile number or username and password are required.' },
      });
      return;
    }

    // Lookup in unified customers collection by email, username, mobileNumber, or phone
    const customer = await Customer.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier },
        { mobileNumber: identifier },
        { phone: identifier },
      ],
    }).select('+passwordHash');

    if (!customer || !customer.isActive) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials or account inactive.' },
      });
      return;
    }

    const valid = await bcrypt.compare(password, customer.passwordHash);
    if (!valid) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials.' },
      });
      return;
    }

    const accessToken = signAccessToken({ userId: customer.id, email: customer.email, role: customer.role });
    const refreshToken = signRefreshToken({ userId: customer.id });
    setRefreshCookie(res, refreshToken);

    await AuditLog.create({
      action: 'auth.login',
      actorId: customer.id,
      actorRole: customer.role,
      targetModel: 'Customer',
      targetId: customer.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: {
        accessToken,
        user: {
          id: customer.id,
          customerId: customer.customerId,
          email: customer.email,
          name: customer.name,
          fullName: customer.fullName || customer.name,
          username: customer.username,
          mobileNumber: customer.mobileNumber || customer.phone,
          phone: customer.phone,
          role: customer.role,
          emailVerified: customer.emailVerified,
          country: customer.country,
          state: customer.state,
          city: customer.city,
          pincode: customer.pincode,
          gender: customer.gender,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/auth/logout
export async function logout(req: Request, res: Response): Promise<void> {
  clearRefreshCookie(res);
  res.json({ success: true, data: null, message: 'Logged out successfully.' });
}

// POST /api/v1/auth/refresh
export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.refreshToken as string | undefined;
    if (!token) {
      res.status(401).json({
        success: false,
        error: { code: 'NO_REFRESH_TOKEN', message: 'Refresh token missing.' },
      });
      return;
    }

    let payload: { userId: string };
    try {
      payload = verifyRefreshToken(token);
    } catch {
      clearRefreshCookie(res);
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token.' },
      });
      return;
    }

    const customer = await Customer.findById(payload.userId);
    if (!customer || !customer.isActive) {
      clearRefreshCookie(res);
      res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'Account not found.' },
      });
      return;
    }

    const accessToken = signAccessToken({ userId: customer.id, email: customer.email, role: customer.role });
    const newRefreshToken = signRefreshToken({ userId: customer.id });
    setRefreshCookie(res, newRefreshToken);

    res.json({ success: true, data: { accessToken } });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/auth/me
export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const customer = await Customer.findById(req.user!.userId);
    if (!customer) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Account not found.' },
      });
      return;
    }
    res.json({
      success: true,
      data: {
        id: customer.id,
        customerId: customer.customerId,
        email: customer.email,
        name: customer.name,
        fullName: customer.fullName || customer.name,
        username: customer.username,
        mobileNumber: customer.mobileNumber || customer.phone,
        phone: customer.phone,
        role: customer.role,
        emailVerified: customer.emailVerified,
        referralCode: customer.referralCode,
        referralName: customer.referralName,
        country: customer.country,
        state: customer.state,
        city: customer.city,
        pincode: customer.pincode,
        gender: customer.gender,
        createdAt: customer.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/auth/forgot-password
export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = req.body;
    const customer = await Customer.findOne({ email });

    // Always return 200 to prevent email enumeration
    if (!customer) {
      res.json({
        success: true,
        data: null,
        message: 'If an account with that email exists, a reset link has been sent.',
      });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    customer.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    customer.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await customer.save({ validateBeforeSave: false });

    if (process.env.NODE_ENV !== 'production') {
      log.debug({ resetToken }, 'Password reset token (dev only)');
    }

    res.json({
      success: true,
      data: null,
      message: 'If an account with that email exists, a reset link has been sent.',
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/auth/reset-password
export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, password } = req.body;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const customer = await Customer.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!customer) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Password reset token is invalid or has expired.' },
      });
      return;
    }

    customer.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    customer.resetPasswordToken = undefined;
    customer.resetPasswordExpires = undefined;
    await customer.save({ validateBeforeSave: false });

    await AuditLog.create({
      action: 'auth.reset_password',
      actorId: customer.id,
      actorRole: customer.role,
      targetModel: 'Customer',
      targetId: customer.id,
      ip: req.ip,
    });

    res.json({ success: true, data: null, message: 'Password reset successfully.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/admin/users — list all users/customers from unified collection
export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const skip = (page - 1) * limit;
    const search = req.query.search as string | undefined;

    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { fullName: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { mobileNumber: { $regex: search, $options: 'i' } },
            { username: { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      Customer.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Customer.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        items: items.map((c) => ({
          id: c.id,
          email: c.email,
          name: c.name,
          fullName: c.fullName || c.name,
          username: c.username,
          phone: c.phone || c.mobileNumber,
          mobileNumber: c.mobileNumber || c.phone,
          role: c.role,
          referralCode: c.referralCode,
          referralName: c.referralName,
          emailVerified: c.emailVerified,
          isActive: c.isActive,
          createdAt: c.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/admin/users/:id/role
export async function updateUserRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const customer = await Customer.findByIdAndUpdate(id, { role }, { new: true });
    if (!customer) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Account not found.' },
      });
      return;
    }

    await AuditLog.create({
      action: 'admin.update_role',
      actorId: req.user!.userId,
      actorRole: req.user!.role,
      targetModel: 'Customer',
      targetId: id,
      after: { role },
      ip: req.ip,
    });

    res.json({ success: true, data: { id: customer.id, role: customer.role } });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/admin/audit-logs
export async function getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find({}).skip(skip).limit(limit).sort({ createdAt: -1 }),
      AuditLog.countDocuments(),
    ]);

    res.json({
      success: true,
      data: {
        items: logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}
