import { Request, Response, NextFunction } from 'express';
import { Cart, ICart } from '../models/cart.model.js';
import { Coupon, ICoupon } from '../models/coupon.model.js';

// Helper to recalculate totals
async function recalculateCart(cart: ICart): Promise<void> {
  const subtotal = cart.items.reduce((sum, item) => sum + item.lineTotal, 0);
  cart.subtotal = subtotal;

  let discount = 0;
  if (cart.couponCode && subtotal > 0) {
    const coupon = await Coupon.findOne({
      code: cart.couponCode.toUpperCase(),
      isActive: true,
      validFrom: { $lte: new Date() },
      validTo: { $gte: new Date() },
    });

    if (coupon && subtotal >= coupon.minOrderValue) {
      if (coupon.type === 'percentage') {
        discount = Math.round((subtotal * coupon.value) / 100);
        if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
          discount = coupon.maxDiscountAmount;
        }
      } else {
        discount = Math.min(coupon.value, subtotal);
      }
    } else {
      cart.couponCode = null;
    }
  }

  cart.couponDiscount = discount;
  const taxable = Math.max(0, subtotal - discount);

  // Free shipping above ₹500 (50,000 paise), else ₹50 (5,000 paise)
  cart.shippingCharge = subtotal === 0 ? 0 : subtotal >= 50000 ? 0 : 5000;
  // 18% GST
  cart.tax = Math.round(taxable * 0.18);
  cart.grandTotal = taxable + cart.shippingCharge + cart.tax;
}

// Find or create cart based on userId or sessionId
async function getOrCreateCart(req: Request): Promise<ICart> {
  const userId = req.user?.userId;
  const sessionId = (req.headers['x-session-id'] as string) || req.cookies?.sessionId || 'guest_default_session';

  let cart: ICart | null = null;
  if (userId) {
    cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = await Cart.findOne({ sessionId, userId: null });
      if (cart) {
        cart.userId = userId;
        await cart.save();
      }
    }
  } else {
    cart = await Cart.findOne({ sessionId });
  }

  if (!cart) {
    cart = new Cart({
      userId: userId || null,
      sessionId: sessionId || null,
      items: [],
      subtotal: 0,
      couponDiscount: 0,
      shippingCharge: 0,
      tax: 0,
      grandTotal: 0,
    });
    await cart.save();
  }

  return cart;
}

export async function getCart(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cart = await getOrCreateCart(req);
    await recalculateCart(cart);
    await cart.save();
    res.json({ success: true, data: cart });
  } catch (err) {
    next(err);
  }
}

export async function addItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { productId, variantId, productName, productSlug, productImage, sku, quantity, unitApplicablePrice, unitMrp } = req.body;
    if (!productId || !quantity || quantity <= 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Product and valid quantity required.' } });
      return;
    }

    const cart = await getOrCreateCart(req);
    const existingIndex = cart.items.findIndex((item) => item.productId === productId && item.variantId === (variantId || null));

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += quantity;
      cart.items[existingIndex].lineTotal = cart.items[existingIndex].quantity * cart.items[existingIndex].unitApplicablePrice;
    } else {
      cart.items.push({
        id: `${productId}_${variantId || 'base'}_${Date.now()}`,
        productId,
        variantId: variantId || null,
        productName: productName || 'Product',
        productSlug: productSlug || '',
        productImage: productImage || '',
        sku: sku || 'SKU',
        quantity,
        unitApplicablePrice: unitApplicablePrice || 0,
        unitMrp: unitMrp || unitApplicablePrice || 0,
        lineTotal: quantity * (unitApplicablePrice || 0),
      });
    }

    await recalculateCart(cart);
    await cart.save();
    res.json({ success: true, data: cart, message: 'Item added to cart' });
  } catch (err) {
    next(err);
  }
}

export async function updateItemQuantity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || quantity < 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Valid quantity required.' } });
      return;
    }

    const cart = await getOrCreateCart(req);
    const index = cart.items.findIndex((item) => item.id === id || item.productId === id);

    if (index === -1) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Item not found in cart.' } });
      return;
    }

    if (quantity === 0) {
      cart.items.splice(index, 1);
    } else {
      cart.items[index].quantity = quantity;
      cart.items[index].lineTotal = quantity * cart.items[index].unitApplicablePrice;
    }

    await recalculateCart(cart);
    await cart.save();
    res.json({ success: true, data: cart, message: 'Cart updated' });
  } catch (err) {
    next(err);
  }
}

export async function removeItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const cart = await getOrCreateCart(req);

    cart.items = cart.items.filter((item) => item.id !== id && item.productId !== id);
    await recalculateCart(cart);
    await cart.save();

    res.json({ success: true, data: cart, message: 'Item removed from cart' });
  } catch (err) {
    next(err);
  }
}

export async function clearCart(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cart = await getOrCreateCart(req);
    cart.items = [];
    cart.couponCode = null;
    await recalculateCart(cart);
    await cart.save();

    res.json({ success: true, data: cart, message: 'Cart cleared' });
  } catch (err) {
    next(err);
  }
}

export async function applyCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Coupon code required.' } });
      return;
    }

    const coupon = await Coupon.findOne({
      code: code.trim().toUpperCase(),
      isActive: true,
      validFrom: { $lte: new Date() },
      validTo: { $gte: new Date() },
    });

    if (!coupon) {
      res.status(400).json({ success: false, error: { code: 'INVALID_COUPON', message: 'Invalid or expired coupon code.' } });
      return;
    }

    const cart = await getOrCreateCart(req);
    if (cart.subtotal < coupon.minOrderValue) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MIN_ORDER_NOT_MET',
          message: `Minimum order value of ₹${(coupon.minOrderValue / 100).toFixed(0)} required for this coupon.`,
        },
      });
      return;
    }

    cart.couponCode = coupon.code;
    await recalculateCart(cart);
    await cart.save();

    res.json({ success: true, data: cart, message: `Coupon ${coupon.code} applied successfully!` });
  } catch (err) {
    next(err);
  }
}

export async function removeCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cart = await getOrCreateCart(req);
    cart.couponCode = null;
    await recalculateCart(cart);
    await cart.save();

    res.json({ success: true, data: cart, message: 'Coupon removed' });
  } catch (err) {
    next(err);
  }
}

// ---- Admin Coupon Management ----
export async function adminListCoupons(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json({ success: true, data: coupons });
  } catch (err) {
    next(err);
  }
}

export async function adminCreateCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code, type, value, maxDiscountAmount, minOrderValue, usageLimit, validFrom, validTo, isActive } = req.body;
    const existing = await Coupon.findOne({ code: code.toUpperCase() });
    if (existing) {
      res.status(400).json({ success: false, error: { code: 'CONFLICT', message: 'Coupon code already exists.' } });
      return;
    }

    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      type,
      value,
      maxDiscountAmount,
      minOrderValue: minOrderValue || 0,
      usageLimit,
      validFrom: validFrom ? new Date(validFrom) : new Date(),
      validTo: new Date(validTo || Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: isActive !== undefined ? isActive : true,
    });

    res.status(201).json({ success: true, data: coupon, message: 'Coupon created successfully' });
  } catch (err) {
    next(err);
  }
}

export async function adminUpdateCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const updated = await Coupon.findByIdAndUpdate(id, { $set: req.body }, { new: true });
    if (!updated) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Coupon not found.' } });
      return;
    }
    res.json({ success: true, data: updated, message: 'Coupon updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function adminDeleteCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    await Coupon.findByIdAndDelete(id);
    res.json({ success: true, message: 'Coupon deleted successfully' });
  } catch (err) {
    next(err);
  }
}
