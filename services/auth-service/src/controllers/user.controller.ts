import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Customer } from '../models/customer.model.js';
import { Address } from '../models/address.model.js';
import { Wishlist } from '../models/wishlist.model.js';
import { uploadToImageKit } from '../utils/imagekit.js';
import { sendEmailVerificationOtp } from '../utils/mailer.js';
import { createLogger } from '@ornate/logger';

const log = createLogger('user-controller');

// Helper to find customer by authenticated userId
function getCustomerQuery(userId: string) {
  const query: any[] = [
    { userId },
    { customerId: userId },
    { customer_id: userId },
    { email: userId },
    { mobileNumber: userId },
  ];
  if (mongoose.Types.ObjectId.isValid(userId)) {
    query.unshift({ _id: new mongoose.Types.ObjectId(userId) });
  } else {
    query.push({ _id: userId });
  }
  return { $or: query };
}

// ---- Profile ----
export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const customer = await Customer.findOne(getCustomerQuery(userId));
    if (!customer) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Profile not found.' } });
      return;
    }
    res.json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
}

/**
 * Updates customer profile details.
 * Note: Mobile number is permanently locked. Email can be edited ONLY IF not yet verified.
 */
export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { name, fullName, avatar, profilePicture, gender, city, state, pincode, country, email } = req.body;

    const existingCustomer = await Customer.findOne(getCustomerQuery(userId));
    if (!existingCustomer) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Profile not found.' } });
      return;
    }

    const isVerified = Boolean(existingCustomer.isEmailVerified || existingCustomer.emailVerified);
    let newEmail: string | undefined = undefined;

    // If email is not yet verified, allow updating it
    if (email && !isVerified) {
      const cleanEmail = String(email).toLowerCase().trim();
      if (cleanEmail !== existingCustomer.email?.toLowerCase().trim()) {
        const duplicate = await Customer.findOne({
          email: cleanEmail,
          _id: { $ne: existingCustomer._id },
        });
        if (duplicate) {
          res.status(400).json({
            success: false,
            error: { code: 'EMAIL_IN_USE', message: 'This email address is already in use by another account.' },
          });
          return;
        }
        newEmail = cleanEmail;
      }
    }

    const pic = profilePicture || avatar;

    const customer = await Customer.findOneAndUpdate(
      { _id: existingCustomer._id },
      {
        $set: {
          ...(name && { name, fullName: fullName || name }),
          ...(fullName && { fullName, name: name || fullName }),
          ...(pic && { avatar: pic, profilePicture: pic }),
          ...(gender && { gender }),
          ...(city !== undefined && { city }),
          ...(state !== undefined && { state }),
          ...(pincode !== undefined && { pincode }),
          ...(country !== undefined && { country }),
          ...(newEmail && { email: newEmail, isEmailVerified: false, emailVerified: false }),
        },
      },
      { new: true },
    );

    if (!customer) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Profile not found.' } });
      return;
    }

    res.json({ success: true, data: customer, message: 'Profile updated successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * Uploads customer avatar / profile picture to ImageKit CDN and stores URL in Customer table.
 */
export async function uploadProfileAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const file =
      req.file ||
      (Array.isArray((req as any).files) ? (req as any).files[0] : null) ||
      (req as any).files?.image?.[0] ||
      (req as any).files?.avatar?.[0];

    if (!file) {
      res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'No image file provided.' } });
      return;
    }

    // Upload to ImageKit
    const originalName = file.originalname || `avatar_${userId}`;
    const result = await uploadToImageKit(file.buffer, originalName, '/ornate/avatars');

    // Update Customer record in DB
    const customer = await Customer.findOneAndUpdate(
      getCustomerQuery(userId),
      {
        $set: {
          avatar: result.url,
          profilePicture: result.url,
        },
      },
      { new: true },
    );

    if (!customer) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found.' } });
      return;
    }

    log.info({ userId, url: result.url }, 'Customer profile picture updated via ImageKit');

    res.json({
      success: true,
      data: {
        url: result.url,
        avatar: result.url,
        profilePicture: result.url,
        fileId: result.fileId,
        customer,
      },
      message: 'Profile picture uploaded and saved successfully.',
    });
  } catch (err: any) {
    log.error({ err: err.message }, 'Failed to upload profile picture to ImageKit');
    next(err);
  }
}

/**
 * Sends a 6-digit verification code to the customer's email via Nodemailer.
 */
export async function sendEmailOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const customer = await Customer.findOne(getCustomerQuery(userId));

    if (!customer) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Account not found.' } });
      return;
    }

    if (customer.isEmailVerified || customer.emailVerified) {
      res.status(400).json({
        success: false,
        error: { code: 'ALREADY_VERIFIED', message: 'Email address is already verified.' },
      });
      return;
    }

    // If an unverified user provided a new email to verify
    let targetEmail = customer.email;
    if (req.body?.email) {
      const requestedEmail = String(req.body.email).toLowerCase().trim();
      if (requestedEmail && requestedEmail !== customer.email?.toLowerCase().trim()) {
        const duplicate = await Customer.findOne({
          email: requestedEmail,
          _id: { $ne: customer._id },
        });
        if (duplicate) {
          res.status(400).json({
            success: false,
            error: { code: 'EMAIL_IN_USE', message: 'This email is already in use by another account.' },
          });
          return;
        }
        targetEmail = requestedEmail;
      }
    }

    // Generate secure 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await Customer.updateOne(
      { _id: customer._id },
      {
        $set: {
          email: targetEmail,
          emailOtp: otp,
          emailOtpExpires: expires,
        },
      },
    );

    // Send custom styled branded HTML email
    await sendEmailVerificationOtp(targetEmail, customer.fullName || customer.name, otp);

    res.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${targetEmail}.`,
    });
  } catch (err: any) {
    log.error({ err: err.message }, 'Error sending email verification OTP');
    res.status(500).json({
      success: false,
      error: { code: 'EMAIL_SEND_FAILED', message: err.message || 'Failed to send verification email.' },
    });
  }
}

/**
 * Verifies the 6-digit OTP and marks isEmailVerified: true.
 */
export async function verifyEmailOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { otp } = req.body;

    const cleanOtp = String(otp || '').trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_OTP', message: 'Please provide a valid 6-digit verification code.' },
      });
      return;
    }

    const customer = await Customer.findOne(getCustomerQuery(userId)).select('+emailOtp +emailOtpExpires');
    if (!customer) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Account not found.' } });
      return;
    }

    if (!customer.emailOtp || !customer.emailOtpExpires) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_OTP_REQUESTED', message: 'No verification code requested or code has expired. Please request a new code.' },
      });
      return;
    }

    if (new Date() > customer.emailOtpExpires) {
      res.status(400).json({
        success: false,
        error: { code: 'OTP_EXPIRED', message: 'Verification code has expired. Please request a new one.' },
      });
      return;
    }

    if (customer.emailOtp !== cleanOtp) {
      res.status(400).json({
        success: false,
        error: { code: 'WRONG_OTP', message: 'Incorrect verification code. Please check and try again.' },
      });
      return;
    }

    // OTP is valid -> Mark email as verified and clear OTP
    customer.isEmailVerified = true;
    customer.emailVerified = true;
    customer.emailOtp = undefined;
    customer.emailOtpExpires = undefined;
    await customer.save();

    log.info({ userId, email: customer.email }, 'Customer email verified successfully via OTP');

    res.json({
      success: true,
      message: 'Email verified successfully!',
      data: {
        isEmailVerified: true,
        emailVerified: true,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ---- Addresses ----
export async function getAddresses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const addresses = await Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
    res.json({ success: true, data: addresses });
  } catch (err) {
    next(err);
  }
}

export async function createAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { label, name, phone, line1, line2, city, state, pincode, country, isDefault } = req.body;

    const count = await Address.countDocuments({ userId });
    const makeDefault = isDefault || count === 0;

    if (makeDefault) {
      await Address.updateMany({ userId }, { isDefault: false });
    }

    const address = await Address.create({
      userId,
      label,
      name,
      phone,
      line1,
      line2,
      city,
      state,
      pincode,
      country: country || 'India',
      isDefault: makeDefault,
    });

    res.status(201).json({ success: true, data: address, message: 'Address added successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { label, name, phone, line1, line2, city, state, pincode, country, isDefault } = req.body;

    const existing = await Address.findOne({ _id: id, userId });
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Address not found' } });
      return;
    }

    if (isDefault) {
      await Address.updateMany({ userId }, { isDefault: false });
    }

    const updated = await Address.findOneAndUpdate(
      { _id: id, userId },
      { $set: { label, name, phone, line1, line2, city, state, pincode, country, ...(isDefault !== undefined && { isDefault }) } },
      { new: true },
    );

    res.json({ success: true, data: updated, message: 'Address updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function deleteAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const deleted = await Address.findOneAndDelete({ _id: id, userId });
    if (!deleted) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Address not found' } });
      return;
    }

    if (deleted.isDefault) {
      const nextDefault = await Address.findOne({ userId });
      if (nextDefault) {
        nextDefault.isDefault = true;
        await nextDefault.save();
      }
    }

    res.json({ success: true, message: 'Address deleted successfully' });
  } catch (err) {
    next(err);
  }
}

export async function setDefaultAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    await Address.updateMany({ userId }, { isDefault: false });
    const updated = await Address.findOneAndUpdate({ _id: id, userId }, { isDefault: true }, { new: true });
    if (!updated) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Address not found' } });
      return;
    }

    res.json({ success: true, data: updated, message: 'Default address updated' });
  } catch (err) {
    next(err);
  }
}

// ---- Wishlist ----
export async function getWishlist(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const wishlist = await Wishlist.findOne({ userId });
    res.json({ success: true, data: wishlist ? wishlist.products : [] });
  } catch (err) {
    next(err);
  }
}

export async function addToWishlist(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { productId } = req.body;
    if (!productId) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'productId is required' } });
      return;
    }

    const wishlist = await Wishlist.findOneAndUpdate(
      { userId },
      { $addToSet: { products: productId } },
      { new: true, upsert: true },
    );

    res.json({ success: true, data: wishlist.products, message: 'Added to wishlist' });
  } catch (err) {
    next(err);
  }
}

export async function removeFromWishlist(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { productId } = req.params;

    const wishlist = await Wishlist.findOneAndUpdate(
      { userId },
      { $pull: { products: productId } },
      { new: true },
    );

    res.json({ success: true, data: wishlist ? wishlist.products : [], message: 'Removed from wishlist' });
  } catch (err) {
    next(err);
  }
}

// ---- Admin Customers ----
export async function adminListCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const search = req.query.search ? String(req.query.search).trim() : '';

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      Customer.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Customer.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        items,
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
