import { Request, Response, NextFunction } from 'express';
import { Order, IOrder } from '../models/order.model.js';

export async function createCheckoutOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId || 'guest_user';
    const customerEmail = req.user?.email || req.body.customerEmail || 'customer@example.com';
    const customerName = req.body.customerName || req.user?.email?.split('@')[0] || 'Customer';

    const { shippingAddress: rawShipping, billingAddress: rawBilling, items: rawItems, pricing, couponCode, paymentMethod } = req.body;

    if (!rawItems || rawItems.length === 0 || !rawShipping) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Cart items and shipping address are required.' } });
      return;
    }

    const shippingAddress = {
      name: rawShipping.name || rawShipping.recipientName || customerName,
      phone: rawShipping.phone || '+91 9999999999',
      line1: rawShipping.line1 || rawShipping.street || 'Address Line 1',
      line2: rawShipping.line2 || '',
      city: rawShipping.city || 'Bengaluru',
      state: rawShipping.state || 'Karnataka',
      pincode: rawShipping.pincode || rawShipping.postalCode || '560001',
      country: rawShipping.country || 'India',
    };

    const billingAddress = rawBilling ? {
      name: rawBilling.name || rawBilling.recipientName || shippingAddress.name,
      phone: rawBilling.phone || shippingAddress.phone,
      line1: rawBilling.line1 || rawBilling.street || shippingAddress.line1,
      line2: rawBilling.line2 || shippingAddress.line2 || '',
      city: rawBilling.city || shippingAddress.city,
      state: rawBilling.state || shippingAddress.state,
      pincode: rawBilling.pincode || rawBilling.postalCode || shippingAddress.pincode,
      country: rawBilling.country || shippingAddress.country,
    } : shippingAddress;

    const items = rawItems.map((it: any) => {
      const applicable = Number(it.unitApplicablePrice || it.unitSellingPrice || it.unitMrp || 0);
      const mrp = Number(it.unitMrp || applicable);
      const selling = Number(it.unitSellingPrice || applicable);
      const qty = Math.max(1, Number(it.quantity || 1));
      return {
        productId: String(it.productId || it.id || 'prod'),
        variantId: it.variantId || null,
        name: String(it.name || it.productName || 'Product'),
        sku: String(it.sku || 'SKU'),
        image: it.image || it.productImage || '',
        quantity: qty,
        unitMrp: mrp,
        unitSellingPrice: selling,
        unitApplicablePrice: applicable,
        discount: Number(it.discount || Math.max(0, mrp - applicable)),
        taxRate: Number(it.taxRate || 18),
        taxAmount: Number(it.taxAmount || Math.round((applicable * qty * 0.18) / 1.18)),
        lineTotal: Number(it.lineTotal || (applicable * qty)),
      };
    });

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${randomSuffix}`;

    const subtotal = items.reduce((sum: number, it: any) => sum + it.lineTotal, 0);
    const order = await Order.create({
      orderNumber,
      userId,
      customerEmail,
      customerName,
      shippingAddress,
      billingAddress,
      items,
      pricing: pricing || {
        subtotal,
        couponDiscount: 0,
        shippingCharge: 0,
        tax: Math.round(subtotal * 0.18),
        grandTotal: Math.round(subtotal * 1.18),
      },
      couponCode: couponCode || null,
      paymentStatus: 'pending',
      fulfilmentStatus: 'pending',
      paymentMethod: paymentMethod || 'Cashfree',
      cashfreeOrderId: req.body.cashfreeOrderId || null,
      statusHistory: [
        {
          status: 'pending',
          changedBy: customerName,
          changedAt: new Date().toISOString(),
          note: 'Order placed by customer.',
        },
      ],
    });

    res.status(201).json({
      success: true,
      data: order,
      message: 'Order placed successfully! Please proceed to payment.',
    });
  } catch (err) {
    next(err);
  }
}

export async function getMyOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 10)));

    const [items, total] = await Promise.all([
      Order.find({ userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Order.countDocuments({ userId }),
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

function getOrderQuery(idOrNumber: string | string[] | undefined) {
  const id = Array.isArray(idOrNumber) ? idOrNumber[0] : String(idOrNumber || '');
  const isObjectId = Boolean(id.match(/^[0-9a-fA-F]{24}$/));
  return isObjectId ? { $or: [{ _id: id }, { orderNumber: id }] } : { orderNumber: id };
}

export async function getOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const order = await Order.findOne(getOrderQuery(req.params.id));

    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found.' } });
      return;
    }

    if (req.user && req.user.role === 'customer' && order.userId !== req.user.userId) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } });
      return;
    }

    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const order = await Order.findOne(getOrderQuery(req.params.id));

    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found.' } });
      return;
    }

    if (order.fulfilmentStatus !== 'pending' && order.fulfilmentStatus !== 'confirmed') {
      res.status(400).json({
        success: false,
        error: { code: 'CANNOT_CANCEL', message: `Order cannot be cancelled in '${order.fulfilmentStatus}' state.` },
      });
      return;
    }

    order.fulfilmentStatus = 'cancelled';
    order.statusHistory.push({
      status: 'cancelled',
      changedBy: req.user?.email || 'Customer',
      changedAt: new Date().toISOString(),
      note: req.body.reason || 'Cancelled by customer.',
    });
    await order.save();

    res.json({ success: true, data: order, message: 'Order cancelled successfully.' });
  } catch (err) {
    next(err);
  }
}

// ---- Admin Endpoints ----
export async function adminListOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const { status, paymentStatus, search } = req.query;

    const filter: Record<string, unknown> = {};
    if (status) filter.fulfilmentStatus = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (search) {
      filter.$or = [
        { orderNumber: { $regex: String(search), $options: 'i' } },
        { customerEmail: { $regex: String(search), $options: 'i' } },
        { customerName: { $regex: String(search), $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Order.countDocuments(filter),
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

export async function adminUpdateOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { fulfilmentStatus, paymentStatus, trackingNumber, shippingProvider, note } = req.body;

    const order = await Order.findOne(getOrderQuery(req.params.id));
    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found.' } });
      return;
    }

    if (fulfilmentStatus) order.fulfilmentStatus = fulfilmentStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (trackingNumber !== undefined) order.trackingNumber = trackingNumber;
    if (shippingProvider !== undefined) order.shippingProvider = shippingProvider;

    order.statusHistory.push({
      status: fulfilmentStatus || order.fulfilmentStatus,
      changedBy: req.user?.email || 'Admin',
      changedAt: new Date().toISOString(),
      note: note || `Status updated to ${fulfilmentStatus || order.fulfilmentStatus}`,
    });

    await order.save();
    res.json({ success: true, data: order, message: 'Order updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function adminGetDashboardMetrics(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [totalOrders, paidOrdersResult, pendingOrders, recentOrders] = await Promise.all([
      Order.countDocuments(),
      Order.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, totalRevenue: { $sum: '$pricing.grandTotal' } } },
      ]),
      Order.countDocuments({ fulfilmentStatus: 'pending' }),
      Order.find().sort({ createdAt: -1 }).limit(7),
    ]);

    const paidRevenue = paidOrdersResult[0]?.totalRevenue || 0;

    res.json({
      success: true,
      data: {
        totalOrders,
        paidRevenue,
        pendingOrders,
        lowStockProducts: 2,
        recentOrders,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function confirmOrderPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { paymentStatus = 'paid', fulfilmentStatus = 'confirmed', note, paymentReference } = req.body;
    const order = await Order.findOne(getOrderQuery(req.params.id));
    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found.' } });
      return;
    }
    order.paymentStatus = paymentStatus as any;
    if (fulfilmentStatus) order.fulfilmentStatus = fulfilmentStatus as any;
    if (paymentReference) order.paymentReference = paymentReference;
    order.statusHistory.push({
      status: (fulfilmentStatus as any) || 'confirmed',
      changedBy: 'Payment Gateway',
      changedAt: new Date().toISOString(),
      note: note || 'Payment verified successfully.',
    });
    await order.save();
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

