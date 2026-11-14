import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Order, IOrder } from '../models/order.model.js';
import { createLogger } from '@ornate/logger';
import { distributeOrderCommissions } from '../utils/commission.js';
import {
  canCustomerCancel,
  canTransitionOrder,
  canTransitionItem,
  canTransitionPayment,
  deriveOrderFulfilmentStatus,
  isOrderFulfilmentStatus,
  isItemStatus,
  isPaymentStatus,
  nextItemStatuses,
  nextOrderFulfilmentStatuses,
} from '../domain/order-lifecycle.js';

const log = createLogger('order-controller');

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
    const orderPricing = pricing ? { ...pricing } : {
      subtotal,
      couponDiscount: 0,
      shippingCharge: 0,
      tax: Math.round(subtotal * 0.18),
      grandTotal: Math.round(subtotal * 1.18),
    };

    // Pre-checkout stock verification
    try {
      const client = typeof (mongoose.connection as any).getClient === 'function'
        ? (mongoose.connection as any).getClient()
        : (mongoose.connection as any).client;
      const productDb = client ? client.db('ornate_products') : null;
      if (productDb) {
        for (const item of items) {
          const isObjectId = mongoose.Types.ObjectId.isValid(item.productId);
          const pQuery: any[] = [{ sku: item.sku }];
          if (isObjectId) {
            pQuery.unshift({ _id: new mongoose.Types.ObjectId(item.productId) });
          }
          const product = await productDb.collection('products').findOne({ $or: pQuery });
          if (product && (product.stock ?? 0) < item.quantity) {
            res.status(400).json({
              success: false,
              error: {
                code: 'OUT_OF_STOCK',
                message: `Product "${product.name || item.name}" is out of stock (available: ${product.stock ?? 0}).`,
              },
            });
            return;
          }
        }
      }
    } catch (stockErr) {
      log.warn({ stockErr }, 'Could not verify stock before order creation');
    }

    // ---- Wallet Payment (Full or Split) ----
    const requestedWalletAmount = Math.max(0, Number(req.body.walletAmountToUse || 0));
    let walletAmountPaid = 0;
    let isFullyPaidByWallet = false;

    if (requestedWalletAmount > 0 && userId && userId !== 'guest_user') {
      try {
        const client =
          typeof (mongoose.connection as any).getClient === 'function'
            ? (mongoose.connection as any).getClient()
            : (mongoose.connection as any).client;
        const authDb = client ? client.db('ornate_auth') : null;

        if (authDb) {
          const isObjectId = mongoose.Types.ObjectId.isValid(userId);
          const customer = await authDb.collection('customers').findOne({
            $or: [
              ...(isObjectId ? [{ _id: new mongoose.Types.ObjectId(userId) }] : []),
              { userId },
              { customerId: userId },
              { customer_id: userId },
              { email: customerEmail.toLowerCase() },
            ],
          });

          if (customer && (customer.walletBalance || 0) > 0) {
            const actualDeduction = Math.min(requestedWalletAmount, customer.walletBalance || 0, orderPricing.grandTotal);

            if (actualDeduction > 0) {
              const updateResult = await authDb.collection('customers').findOneAndUpdate(
                { _id: customer._id, walletBalance: { $gte: actualDeduction } },
                { $inc: { walletBalance: -actualDeduction } },
                { returnDocument: 'after' },
              );

              if (updateResult) {
                walletAmountPaid = actualDeduction;
                const newBal = (updateResult.walletBalance ?? updateResult.value?.walletBalance) ?? 0;

                // Record debit transaction in wallettransactions
                await authDb.collection('wallettransactions').insertOne({
                  transactionId: `txn_debit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  userId: String(customer._id),
                  customerId: customer.customerId || customer.customer_id,
                  type: 'debit',
                  category: 'order_payment',
                  amount: actualDeduction,
                  amountRupees: Number((actualDeduction / 100).toFixed(2)),
                  balanceAfter: newBal,
                  balanceAfterRupees: Number((newBal / 100).toFixed(2)),
                  status: 'success',
                  referenceId: orderNumber,
                  description: `Payment for Order #${orderNumber}`,
                  metadata: { orderNumber },
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });

                if (walletAmountPaid >= orderPricing.grandTotal) {
                  isFullyPaidByWallet = true;
                }
              }
            }
          }
        }
      } catch (walletErr) {
        log.error({ walletErr, userId, orderNumber }, 'Error processing wallet deduction during checkout');
      }
    }

    orderPricing.walletAmountPaid = walletAmountPaid;
    orderPricing.gatewayAmount = Math.max(0, orderPricing.grandTotal - walletAmountPaid);

    const effectivePaymentMethod = isFullyPaidByWallet
      ? 'Wallet'
      : walletAmountPaid > 0
      ? 'Cashfree + Wallet'
      : paymentMethod || 'Cashfree';

    const order = await Order.create({
      orderNumber,
      userId,
      customerEmail,
      customerName,
      shippingAddress,
      billingAddress,
      items,
      pricing: orderPricing,
      couponCode: couponCode || null,
      paymentStatus: isFullyPaidByWallet ? 'paid' : 'pending',
      fulfilmentStatus: isFullyPaidByWallet ? 'confirmed' : 'pending',
      paymentMethod: effectivePaymentMethod,
      cashfreeOrderId: req.body.cashfreeOrderId || null,
      statusHistory: [
        {
          status: isFullyPaidByWallet ? 'confirmed' : 'pending',
          changedBy: isFullyPaidByWallet ? 'Customer Wallet' : customerName,
          changedAt: new Date().toISOString(),
          note: isFullyPaidByWallet
            ? `Order paid in full using customer wallet balance (₹${(walletAmountPaid / 100).toFixed(2)}).`
            : walletAmountPaid > 0
            ? `Order placed. Paid ₹${(walletAmountPaid / 100).toFixed(2)} from wallet, remaining ₹${(orderPricing.gatewayAmount / 100).toFixed(2)} pending via Cashfree.`
            : 'Order placed by customer.',
        },
      ],
    });

    // Decrement stock for ordered items
    try {
      const client = typeof (mongoose.connection as any).getClient === 'function'
        ? (mongoose.connection as any).getClient()
        : (mongoose.connection as any).client;
      const productDb = client ? client.db('ornate_products') : null;
      if (productDb) {
        for (const item of items) {
          const isObjectId = mongoose.Types.ObjectId.isValid(item.productId);
          const pQuery: any[] = [{ sku: item.sku }];
          if (isObjectId) {
            pQuery.unshift({ _id: new mongoose.Types.ObjectId(item.productId) });
          }
          await productDb.collection('products').updateOne(
            { $or: pQuery },
            { $inc: { stock: -item.quantity } },
          );
        }
      }
    } catch (stockDecErr) {
      log.warn({ stockDecErr }, 'Could not decrement product stock after order creation');
    }

    if (isFullyPaidByWallet) {
      distributeOrderCommissions(order).catch((err) => {
        log.error({ err, orderId: order._id, orderNumber: order.orderNumber }, 'Failed to distribute commission on 100% wallet payment');
      });
    }

    res.status(201).json({
      success: true,
      data: order,
      message: isFullyPaidByWallet
        ? 'Order placed and paid successfully via Wallet!'
        : 'Order placed successfully! Please proceed to payment.',
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

    if (!canCustomerCancel(order.fulfilmentStatus)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CANNOT_CANCEL',
          message: `Order cannot be cancelled in '${order.fulfilmentStatus}' state.`,
          details: { allowed: nextOrderFulfilmentStatuses(order.fulfilmentStatus) },
        },
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

    if (fulfilmentStatus !== undefined && fulfilmentStatus !== null) {
      if (!isOrderFulfilmentStatus(fulfilmentStatus)) {
        res.status(422).json({
          success: false,
          error: { code: 'INVALID_STATUS', message: `Unknown fulfilment status '${fulfilmentStatus}'.` },
        });
        return;
      }
      if (!canTransitionOrder(order.fulfilmentStatus, fulfilmentStatus)) {
        res.status(409).json({
          success: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: `Order cannot move from '${order.fulfilmentStatus}' to '${fulfilmentStatus}'.`,
            details: { allowed: nextOrderFulfilmentStatuses(order.fulfilmentStatus) },
          },
        });
        return;
      }
      order.fulfilmentStatus = fulfilmentStatus;
    }

    if (paymentStatus !== undefined && paymentStatus !== null) {
      if (!isPaymentStatus(paymentStatus)) {
        res.status(422).json({
          success: false,
          error: { code: 'INVALID_STATUS', message: `Unknown payment status '${paymentStatus}'.` },
        });
        return;
      }
      if (!canTransitionPayment(order.paymentStatus, paymentStatus)) {
        res.status(409).json({
          success: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: `Payment cannot move from '${order.paymentStatus}' to '${paymentStatus}'.`,
            details: { allowed: [order.paymentStatus] },
          },
        });
        return;
      }
      order.paymentStatus = paymentStatus;
    }

    if (trackingNumber !== undefined) order.trackingNumber = trackingNumber;
    if (shippingProvider !== undefined) order.shippingProvider = shippingProvider;

    order.statusHistory.push({
      status: fulfilmentStatus || order.fulfilmentStatus,
      changedBy: req.user?.email || 'Admin',
      changedAt: new Date().toISOString(),
      note: note || `Status updated to ${fulfilmentStatus || order.fulfilmentStatus}`,
    });

    await order.save();

    if (order.paymentStatus === 'paid') {
      distributeOrderCommissions(order).catch((err) => {
        log.error({ err, orderId: order._id, orderNumber: order.orderNumber }, 'Failed to distribute commission on admin update');
      });
    }

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
    if (!isPaymentStatus(paymentStatus)) {
      res.status(422).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: `Unknown payment status '${paymentStatus}'.` },
      });
      return;
    }
    if (!canTransitionPayment(order.paymentStatus, paymentStatus)) {
      res.status(409).json({
        success: false,
        error: {
          code: 'INVALID_TRANSITION',
          message: `Payment cannot move from '${order.paymentStatus}' to '${paymentStatus}'.`,
          details: { allowed: [order.paymentStatus] },
        },
      });
      return;
    }

    order.paymentStatus = paymentStatus;
    // The gateway's fulfilment suggestion is applied only when it is a legal
    // forward move. A late webhook must still be able to mark an already-shipped
    // order as paid without dragging its fulfilment state backwards.
    if (isOrderFulfilmentStatus(fulfilmentStatus) && canTransitionOrder(order.fulfilmentStatus, fulfilmentStatus)) {
      order.fulfilmentStatus = fulfilmentStatus;
    }
    if (paymentReference) order.paymentReference = paymentReference;
    order.statusHistory.push({
      status: order.fulfilmentStatus,
      changedBy: 'Payment Gateway',
      changedAt: new Date().toISOString(),
      note: note || 'Payment verified successfully.',
    });
    await order.save();

    if (order.paymentStatus === 'paid') {
      distributeOrderCommissions(order).catch((err) => {
        log.error({ err, orderId: order._id, orderNumber: order.orderNumber }, 'Failed to distribute commission on payment confirmation');
      });
    }

    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function adminTriggerOrderCommission(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const order = await Order.findOne(getOrderQuery(req.params.id));
    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found.' } });
      return;
    }

    const summary = await distributeOrderCommissions(order);
    res.json({
      success: true,
      data: summary || { message: 'No new commissions generated (already processed or zero margin)' },
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// STORE PORTAL ORDER CONTROLLERS
// ==========================================

/**
 * GET /api/v1/store/orders
 * Returns orders containing products in the store's category, with items filtered to store scope.
 */
export async function storeListOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categoryId = req.user?.categoryId;
    const storeId = req.user?.storeId;

    if (!categoryId && !storeId) {
      res.status(400).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No store or category assigned.' } });
      return;
    }

    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    const matchConditions: any[] = [];
    if (storeId) matchConditions.push({ 'items.storeId': storeId });
    if (categoryId) matchConditions.push({ 'items.categoryId': categoryId });

    const query: any = { $or: matchConditions };

    const [orders, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(query),
    ]);

    // Filter each order's items so the store only receives their category items
    let filteredOrders = orders.map((o) => {
      const obj = o.toObject();
      obj.items = (obj.items || []).filter((it: any) =>
        (storeId && it.storeId === storeId) || (categoryId && it.categoryId === categoryId)
      );
      return obj;
    });

    if (status) {
      filteredOrders = filteredOrders.filter((o: any) =>
        o.items.some((it: any) => it.itemStatus === status)
      );
    }

    res.json({
      success: true,
      data: {
        items: filteredOrders,
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

/**
 * GET /api/v1/store/orders/:orderNumber
 */
export async function storeGetOrderDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categoryId = req.user?.categoryId;
    const storeId = req.user?.storeId;
    const orderId = String(req.params.id || '');

    const order = await Order.findOne({
      $or: [
        { orderNumber: orderId },
        ...(mongoose.Types.ObjectId.isValid(orderId) ? [{ _id: new mongoose.Types.ObjectId(orderId) }] : []),
      ],
    });

    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found.' } });
      return;
    }

    const obj = order.toObject();
    obj.items = (obj.items || []).filter((it: any) =>
      (storeId && it.storeId === storeId) || (categoryId && it.categoryId === categoryId)
    );

    if (obj.items.length === 0) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'This order has no items in your category.' } });
      return;
    }

    res.json({ success: true, data: obj });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/store/orders/:id/status
 * Updates delivery/dispatch status for items belonging to this store.
 */
export async function storeUpdateItemStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categoryId = req.user?.categoryId;
    const storeId = req.user?.storeId;
    const orderId = String(req.params.id || '');
    const { status, courierName, trackingNumber, productId } = req.body;

    if (!isItemStatus(status)) {
      res.status(422).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Invalid delivery status.' },
      });
      return;
    }

    const order = await Order.findOne({
      $or: [
        { orderNumber: orderId },
        ...(mongoose.Types.ObjectId.isValid(orderId) ? [{ _id: new mongoose.Types.ObjectId(orderId) }] : []),
      ],
    });

    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found.' } });
      return;
    }

    const matchedItems = order.items.filter(
      (it) =>
        ((storeId && it.storeId === storeId) || (categoryId && it.categoryId === categoryId)) &&
        (!productId || it.productId === productId),
    );

    // Validate the whole batch before mutating anything, so an illegal item
    // never leaves the order half-updated.
    const blocked = matchedItems
      .map((it) => ({
        productId: it.productId,
        from: isItemStatus(it.itemStatus) ? it.itemStatus : ('pending' as const),
      }))
      .filter((entry) => !canTransitionItem(entry.from, status));

    if (blocked.length > 0) {
      res.status(409).json({
        success: false,
        error: {
          code: 'INVALID_TRANSITION',
          message: `Cannot move item from '${blocked[0].from}' to '${status}'.`,
          details: { blocked, allowed: nextItemStatuses(blocked[0].from) },
        },
      });
      return;
    }

    let updatedCount = 0;
    for (const it of matchedItems) {
      it.itemStatus = status;
      if (courierName) it.courierName = courierName;
      if (trackingNumber) it.trackingNumber = trackingNumber;
      if (status === 'dispatched') it.dispatchedAt = new Date().toISOString();
      if (status === 'delivered') it.deliveredAt = new Date().toISOString();
      updatedCount++;
    }

    if (updatedCount === 0) {
      res.status(404).json({ success: false, error: { code: 'NO_ITEMS_FOUND', message: 'No items in this order match your store/category.' } });
      return;
    }

    // Recalculate the master order status from the item states. Derivation can
    // only move the order forward; see deriveOrderFulfilmentStatus.
    order.fulfilmentStatus = deriveOrderFulfilmentStatus(order.items, order.fulfilmentStatus);

    order.statusHistory.push({
      status: order.fulfilmentStatus,
      changedBy: `Store (${storeId || req.user?.storeId || 'Store'})`,
      changedAt: new Date().toISOString(),
      note: `Items updated to "${status}"${courierName ? ` via ${courierName}` : ''}${trackingNumber ? ` (Tracking: ${trackingNumber})` : ''}`,
    });

    await order.save();

    res.json({
      success: true,
      data: order,
      message: `Status updated to "${status}" successfully.`,
    });
  } catch (err) {
    next(err);
  }
}

