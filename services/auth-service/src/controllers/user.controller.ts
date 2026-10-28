import { Request, Response, NextFunction } from 'express';
import { Customer } from '../models/customer.model.js';
import { Address } from '../models/address.model.js';
import { Wishlist } from '../models/wishlist.model.js';

// ---- Profile ----
export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    let customer = await Customer.findOne({
      $or: [{ _id: userId }, { userId }],
    });
    if (!customer) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Profile not found.' } });
      return;
    }
    res.json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { name, fullName, phone, mobileNumber, avatar, gender, city, state, pincode, country } = req.body;
    const customer = await Customer.findOneAndUpdate(
      { $or: [{ _id: userId }, { userId }] },
      {
        $set: {
          ...(name && { name, fullName: fullName || name }),
          ...(fullName && { fullName, name: name || fullName }),
          ...((phone || mobileNumber) && { phone: phone || mobileNumber, mobileNumber: mobileNumber || phone }),
          ...(avatar && { avatar }),
          ...(gender && { gender }),
          ...(city && { city }),
          ...(state && { state }),
          ...(pincode && { pincode }),
          ...(country && { country }),
        },
      },
      { new: true },
    );
    res.json({ success: true, data: customer, message: 'Profile updated successfully' });
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
