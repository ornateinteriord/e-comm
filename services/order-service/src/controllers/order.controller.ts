import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Order, IOrder } from '../models/order.model.js';
import { createLogger } from '@ornate/logger';
import { distributeOrderCommissions } from '../utils/commission.js';
import {
  triggerOrderConfirmedNotification,
  triggerOrderDispatchedNotification,
  triggerOrderDeliveredNotification,
  triggerOrderCancelledNotification,
} from '../utils/notification.client.js';
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
import { shadowfaxService } from '../services/shadowfax.service.js';

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
        categoryId: it.categoryId || null,
        categoryName: it.categoryName || null,
        sellerId: it.sellerId || it.storeId || null,
        sellerName: it.sellerName || it.storeName || null,
        storeId: it.storeId || it.sellerId || null,
        storeName: it.storeName || it.sellerName || null,
        itemStatus: 'pending' as const,
        sellerAcceptanceStatus: 'pending' as const,
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
          if (product) {
            if ((product.stock ?? 0) < item.quantity) {
              res.status(400).json({
                success: false,
                error: {
                  code: 'OUT_OF_STOCK',
                  message: `Product "${product.name || item.name}" is out of stock (available: ${product.stock ?? 0}).`,
                },
              });
              return;
            }
            const rawCatId = product.category || product.categoryId;
            if (rawCatId) {
              item.categoryId = String(rawCatId);
              if (!item.categoryName) {
                try {
                  const catDoc = await productDb.collection('categories').findOne({
                    _id: mongoose.Types.ObjectId.isValid(rawCatId) ? new mongoose.Types.ObjectId(rawCatId) : rawCatId,
                  });
                  if (catDoc?.name) item.categoryName = catDoc.name;
                } catch {}
              }
            }
            if (!item.categoryName && product.categoryName) item.categoryName = product.categoryName;

            // Resolve seller for this item
            const resolvedSellerId = product.sellerId || product.storeId;
            if (resolvedSellerId) {
              item.sellerId = String(resolvedSellerId);
              item.storeId = String(resolvedSellerId);
              item.sellerName = product.sellerName || product.storeName || item.sellerName;
              item.storeName = product.storeName || product.sellerName || item.storeName;
            } else if (item.categoryId) {
              // Look up assigned seller for this category in authDb
              try {
                const clientObj = typeof (mongoose.connection as any).getClient === 'function'
                  ? (mongoose.connection as any).getClient()
                  : (mongoose.connection as any).client;
                const authDb = clientObj ? clientObj.db('ornate_auth') : null;
                if (authDb) {
                  const assignedStore = await authDb.collection('stores').findOne({
                    categoryId: item.categoryId,
                    isActive: true,
                    status: { $ne: 'suspended' },
                  });
                  if (assignedStore) {
                    const storeId = assignedStore.storeId || assignedStore.sellerId || String(assignedStore._id);
                    item.sellerId = storeId;
                    item.storeId = storeId;
                    item.sellerName = assignedStore.name || assignedStore.ownerName;
                    item.storeName = assignedStore.name || assignedStore.ownerName;
                  }
                }
              } catch (storeLookupErr) {
                log.warn({ storeLookupErr }, 'Could not look up assigned store for category');
              }
            }
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
      sellerAcceptanceStatus: 'pending',
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
      triggerOrderConfirmedNotification(order);
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

    triggerOrderCancelledNotification(order, { reason: req.body.reason });

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

    // Trigger lifecycle notifications
    if (fulfilmentStatus === 'dispatched' || fulfilmentStatus === 'shipped') {
      triggerOrderDispatchedNotification(order, { courierName: shippingProvider, trackingNumber });
    } else if (fulfilmentStatus === 'delivered') {
      triggerOrderDeliveredNotification(order);
    } else if (fulfilmentStatus === 'cancelled') {
      triggerOrderCancelledNotification(order, { reason: note });
    }

    if (paymentStatus === 'paid') {
      triggerOrderConfirmedNotification(order);
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
      triggerOrderConfirmedNotification(order);
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
// SELLER PORTAL ORDER CONTROLLERS
// ==========================================

/**
 * GET /api/v1/seller/orders
 * Returns orders containing products in the seller's category, with items filtered to seller scope.
 */
export async function sellerListOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categoryId = req.user?.categoryId;
    const sellerId = req.user?.sellerId || req.user?.storeId;

    if (!categoryId && !sellerId) {
      res.status(400).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No seller or category assigned.' } });
      return;
    }

    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    const matchConditions: any[] = [];
    if (sellerId) {
      matchConditions.push({ 'items.sellerId': sellerId });
      matchConditions.push({ 'items.storeId': sellerId });
    }
    if (categoryId) matchConditions.push({ 'items.categoryId': categoryId });

    const query: any = { $or: matchConditions };

    const [orders, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(query),
    ]);

    // Filter each order's items so the seller only receives their category items
    let filteredOrders = orders.map((o) => {
      const obj = o.toObject();
      obj.items = (obj.items || []).filter((it: any) =>
        (sellerId && (it.sellerId === sellerId || it.storeId === sellerId)) || (categoryId && it.categoryId === categoryId)
      );
      return obj;
    });

    if (status) {
      filteredOrders = filteredOrders.filter((o: any) =>
        status === 'pending'
          ? o.items.some((it: any) => it.itemStatus === 'pending' || it.itemStatus === 'confirmed')
          : o.items.some((it: any) => it.itemStatus === status),
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
 * GET /api/v1/seller/orders/:orderNumber
 */
export async function sellerGetOrderDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categoryId = req.user?.categoryId;
    const sellerId = req.user?.sellerId || req.user?.storeId;
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
      (sellerId && (it.sellerId === sellerId || it.storeId === sellerId)) || (categoryId && it.categoryId === categoryId)
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
 * PATCH /api/v1/seller/orders/:id/status
 * Updates delivery/dispatch status for items belonging to this seller.
 */
export async function sellerUpdateItemStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categoryId = req.user?.categoryId;
    const sellerId = req.user?.sellerId || req.user?.storeId;
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
        ((sellerId && (it.sellerId === sellerId || it.storeId === sellerId)) || (categoryId && it.categoryId === categoryId)) &&
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
      res.status(404).json({ success: false, error: { code: 'NO_ITEMS_FOUND', message: 'No items in this order match your seller category.' } });
      return;
    }

    // Recalculate the master order status from the item states. Derivation can
    // only move the order forward; see deriveOrderFulfilmentStatus.
    order.fulfilmentStatus = deriveOrderFulfilmentStatus(order.items, order.fulfilmentStatus);

    order.statusHistory.push({
      status: order.fulfilmentStatus,
      changedBy: `Seller (${sellerId || 'Seller'})`,
      changedAt: new Date().toISOString(),
      note: `Items updated to "${status}"${courierName ? ` via ${courierName}` : ''}${trackingNumber ? ` (Tracking: ${trackingNumber})` : ''}`,
    });

    await order.save();

    if (status === 'dispatched') {
      triggerOrderDispatchedNotification(order, { courierName, trackingNumber });
    } else if (status === 'delivered') {
      triggerOrderDeliveredNotification(order);
    }

    res.json({
      success: true,
      data: order,
      message: `Status updated to "${status}" successfully.`,
    });
  } catch (err) {
    next(err);
  }
}

// Backward compatibility exports
export const storeListOrders = sellerListOrders;
export const storeGetOrderDetails = sellerGetOrderDetails;
export const storeUpdateItemStatus = sellerUpdateItemStatus;

/**
 * Helper to fetch seller pickup address details from database or platform defaults.
 */
async function getSellerPickupDetails(sellerId?: string) {
  let sellerInfo: any = null;
  if (sellerId) {
    try {
      const client =
        typeof (mongoose.connection as any).getClient === 'function'
          ? (mongoose.connection as any).getClient()
          : (mongoose.connection as any).client;
      const authDb = client ? client.db('ornate_auth') : null;
      if (authDb) {
        sellerInfo = await authDb.collection('stores').findOne({
          $or: [
            { sellerId },
            { storeId: sellerId },
            ...(mongoose.Types.ObjectId.isValid(sellerId) ? [{ _id: new mongoose.Types.ObjectId(sellerId) }] : []),
          ],
        });
      }
    } catch (err) {
      log.warn({ err, sellerId }, 'Could not fetch seller details from database');
    }
  }

  const name = sellerInfo?.name || sellerInfo?.ownerName || process.env.SELLER_NAME || 'Platform Store Pvt Ltd';
  const contact = sellerInfo?.mobileNumber || process.env.SELLER_PHONE || '9876543210';
  const line1 = sellerInfo?.address?.line1 || process.env.SELLER_ADDRESS || '42 Industrial Area, Sector 5';
  const city = sellerInfo?.address?.city || 'NEW DELHI';
  const state = sellerInfo?.address?.state || 'Delhi';
  const pincode = sellerInfo?.address?.pincode || '110001';

  return { name, contact, address_line_1: line1, city, state, pincode };
}

/**
 * POST /api/v1/seller/orders/:id/accept
 * Seller accepts the order for fulfillment.
 */
export async function sellerAcceptOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categoryId = req.user?.categoryId;
    const sellerId = req.user?.sellerId || req.user?.storeId;
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

    const matchedItems = order.items.filter(
      (it) =>
        ((sellerId && (it.sellerId === sellerId || it.storeId === sellerId)) || (categoryId && it.categoryId === categoryId)) ||
        (!sellerId && !categoryId), // If single-seller / admin
    );

    if (matchedItems.length === 0 && (sellerId || categoryId)) {
      res.status(403).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'No items in this order match your seller profile.' },
      });
      return;
    }

    const now = new Date();
    for (const it of matchedItems) {
      it.sellerAcceptanceStatus = 'accepted';
      it.sellerAcceptedAt = now.toISOString();
      if (it.itemStatus === 'pending') {
        it.itemStatus = 'confirmed';
      }
    }

    order.sellerAcceptanceStatus = 'accepted';
    order.sellerAcceptedAt = now;
    if (order.fulfilmentStatus === 'pending') {
      order.fulfilmentStatus = 'confirmed';
    }

    order.statusHistory.push({
      status: order.fulfilmentStatus,
      changedBy: req.user?.email || `Seller (${sellerId || 'Seller'})`,
      changedAt: now.toISOString(),
      note: 'Order accepted by seller for fulfillment.',
    });

    await order.save();

    res.json({
      success: true,
      data: order,
      message: 'Order accepted successfully.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/seller/orders/:id/reject
 * Seller rejects the order with a mandatory reason.
 */
export async function sellerRejectOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categoryId = req.user?.categoryId;
    const sellerId = req.user?.sellerId || req.user?.storeId;
    const orderId = String(req.params.id || '');
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';

    if (!reason) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'A rejection reason is required.' },
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
        ((sellerId && (it.sellerId === sellerId || it.storeId === sellerId)) || (categoryId && it.categoryId === categoryId)) ||
        (!sellerId && !categoryId),
    );

    if (matchedItems.length === 0 && (sellerId || categoryId)) {
      res.status(403).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'No items in this order match your seller profile.' },
      });
      return;
    }

    const now = new Date();
    for (const it of matchedItems) {
      it.sellerAcceptanceStatus = 'rejected';
      it.sellerRejectionReason = reason;
      it.sellerRejectedAt = now.toISOString();
      it.itemStatus = 'cancelled';
    }

    order.sellerAcceptanceStatus = 'rejected';
    order.sellerRejectionReason = reason;
    order.sellerRejectedAt = now;
    order.fulfilmentStatus = 'cancelled';

    order.statusHistory.push({
      status: 'cancelled',
      changedBy: req.user?.email || `Seller (${sellerId || 'Seller'})`,
      changedAt: now.toISOString(),
      note: `Order rejected by seller. Reason: ${reason}`,
    });

    await order.save();

    triggerOrderCancelledNotification(order, { reason });

    res.json({
      success: true,
      data: order,
      message: 'Order rejected and marked as cancelled.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/orders/:id/shadowfax/quote
 * Pre-check serviceability and shipping quote before booking.
 */
export async function adminGetShadowfaxQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
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

    const firstSellerId = order.items.find((it) => it.sellerId || it.storeId)?.sellerId || order.items[0]?.storeId;
    const pickupDetails = await getSellerPickupDetails(firstSellerId);
    const destPincode = order.shippingAddress.pincode;

    const [deliveryService, pickupService, rateEstimate] = await Promise.all([
      shadowfaxService.checkServiceability(destPincode, 'customer_delivery'),
      shadowfaxService.checkServiceability(pickupDetails.pincode, 'seller_pickup'),
      shadowfaxService.calculateRate(pickupDetails.pincode, destPincode, 1.0),
    ]);

    res.json({
      success: true,
      data: {
        pickup: {
          ...pickupDetails,
          serviceable: pickupService.serviceable,
          services: pickupService.services,
        },
        delivery: {
          pincode: destPincode,
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          serviceable: deliveryService.serviceable,
          services: deliveryService.services,
        },
        rate: rateEstimate,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/orders/:id/shadowfax/create
 * Admin triggers Shadowfax Forward Logistics API to book delivery and generate AWB.
 */
export async function adminCreateShadowfaxShipment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
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

    // Validation: Seller Acceptance Status
    if (order.sellerAcceptanceStatus === 'rejected') {
      res.status(400).json({
        success: false,
        error: {
          code: 'SELLER_REJECTED',
          message: `Cannot dispatch: Order was rejected by the seller (${order.sellerRejectionReason || 'No reason specified'}).`,
        },
      });
      return;
    }

    if (order.sellerAcceptanceStatus !== 'accepted') {
      res.status(400).json({
        success: false,
        error: {
          code: 'SELLER_NOT_ACCEPTED',
          message: 'Cannot dispatch: The seller must accept the order before delivery can be booked with Shadowfax.',
        },
      });
      return;
    }

    // Prevent duplicate AWB booking
    if (order.shadowfaxDetails?.awbNumber) {
      res.status(409).json({
        success: false,
        error: {
          code: 'ALREADY_BOOKED',
          message: `Order already has an active Shadowfax shipment (AWB: ${order.shadowfaxDetails.awbNumber}).`,
          details: order.shadowfaxDetails,
        },
      });
      return;
    }

    const firstSellerId = order.items.find((it) => it.sellerId || it.storeId)?.sellerId || order.items[0]?.storeId;
    const pickupDetails = await getSellerPickupDetails(firstSellerId);

    const productValue = Math.max(1, Number(order.pricing.grandTotal ? (order.pricing.grandTotal / 100).toFixed(2) : 100));
    const isPrepaid = order.paymentStatus === 'paid' || order.paymentMethod !== 'COD';

    const shadowfaxPayload = {
      client_order_id: order.orderNumber,
      product_value: productValue,
      payment_mode: (isPrepaid ? 'prepaid' : 'cod') as 'prepaid' | 'cod',
      cod_amount: isPrepaid ? 0 : productValue,
      order_service: 'Regular',
      customer_details: {
        name: order.shippingAddress.name || (order.shippingAddress as any).fullName || order.customerName || 'Customer',
        contact: order.shippingAddress.phone || (order.shippingAddress as any).phoneNumber || '9876543210',
        address_line_1: order.shippingAddress.line1 || (order.shippingAddress as any).addressLine1 || 'Main Street',
        address_line_2: order.shippingAddress.line2 || (order.shippingAddress as any).addressLine2 || undefined,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        pincode: order.shippingAddress.pincode,
      },
      pickup_details: pickupDetails,
      return_details: pickupDetails,
      product_details: order.items.map((it) => ({
        sku_name: it.name,
        sku_id: it.sku || it.productId,
        price: Math.max(1, Number((it.unitApplicablePrice / 100).toFixed(2))),
        category: it.categoryName || 'General',
      })),
    };

    // 1. Place order on Shadowfax
    const sfxRes = await shadowfaxService.placeForwardOrder(shadowfaxPayload);
    const sfxData = sfxRes.data;
    const awbNumber = sfxData?.awb_number;

    if (!awbNumber) {
      res.status(502).json({
        success: false,
        error: { code: 'SHADOWFAX_ERROR', message: 'No AWB number returned by Shadowfax.' },
      });
      return;
    }

    // 2. Fetch shipping label PDF
    let labelUrl: string | undefined;
    try {
      const labelRes = await shadowfaxService.generateShippingLabel(awbNumber);
      labelUrl = labelRes.labelUrl;
    } catch (labelErr: any) {
      log.warn({ labelErr: labelErr?.message, awbNumber }, 'Shipping label generation deferred');
    }

    // 3. Update order
    order.fulfilmentStatus = 'shipped';
    order.shippingProvider = 'Shadowfax';
    order.trackingNumber = awbNumber;

    for (const it of order.items) {
      it.itemStatus = 'dispatched';
      it.courierName = 'Shadowfax';
      it.trackingNumber = awbNumber;
      it.dispatchedAt = new Date().toISOString();
    }

    order.shadowfaxDetails = {
      awbNumber,
      orderId: sfxData?.id,
      clientOrderId: sfxData?.client_order_id || order.orderNumber,
      status: sfxData?.status || 'new',
      statusDisplay: sfxData?.status_display || 'New',
      destinationHub: sfxData?.destination_hub,
      sortCode: sfxData?.sort_code,
      labelUrl,
      pickupPincode: String(pickupDetails.pincode),
      deliveryPincode: String(order.shippingAddress.pincode),
      bookedAt: new Date().toISOString(),
      rawResponse: sfxData,
    };

    order.statusHistory.push({
      status: 'shipped',
      changedBy: req.user?.email || 'Admin',
      changedAt: new Date().toISOString(),
      note: `Shadowfax forward delivery booked. AWB: ${awbNumber}, Hub: ${sfxData?.destination_hub || 'N/A'}${
        labelUrl ? ' (Label ready)' : ''
      }`,
    });

    await order.save();

    // 4. Trigger Email & WhatsApp dispatch notifications
    triggerOrderDispatchedNotification(order, {
      courierName: 'Shadowfax',
      trackingNumber: awbNumber,
      trackingUrl: `https://dale.staging.shadowfax.in/api/v4/clients/orders/${awbNumber}/track/`,
    });

    res.json({
      success: true,
      message: `Shadowfax delivery successfully booked with AWB ${awbNumber}.`,
      data: {
        order,
        awbNumber,
        labelUrl,
        destinationHub: sfxData?.destination_hub,
        sortCode: sfxData?.sort_code,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/orders/:id/shadowfax/track
 * Fetch real-time tracking details from Shadowfax.
 */
export async function adminTrackShadowfaxOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
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

    const awbNumber = order.shadowfaxDetails?.awbNumber || order.trackingNumber;
    if (!awbNumber) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_AWB', message: 'This order does not have an AWB / Shadowfax tracking number.' },
      });
      return;
    }

    const tracking = await shadowfaxService.trackOrder(awbNumber);

    if (order.shadowfaxDetails) {
      order.shadowfaxDetails.status = tracking.orderDetails?.status || order.shadowfaxDetails.status;
      order.shadowfaxDetails.statusDisplay = tracking.orderDetails?.status_display || order.shadowfaxDetails.statusDisplay;
      order.shadowfaxDetails.trackingDetails = tracking.trackingDetails;
      order.shadowfaxDetails.lastTrackingSync = new Date().toISOString();
      await order.save();
    }

    res.json({
      success: true,
      data: {
        awbNumber,
        orderDetails: tracking.orderDetails,
        trackingDetails: tracking.trackingDetails,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/orders/:id/shadowfax/label
 * Retrieve or generate shipping label PDF.
 */
export async function adminGetShadowfaxLabel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
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

    const awbNumber = order.shadowfaxDetails?.awbNumber || order.trackingNumber;
    if (!awbNumber) {
      res.status(400).json({ success: false, error: { code: 'NO_AWB', message: 'No AWB number found on this order.' } });
      return;
    }

    const label = await shadowfaxService.generateShippingLabel(awbNumber);

    if (order.shadowfaxDetails) {
      order.shadowfaxDetails.labelUrl = label.labelUrl;
      await order.save();
    }

    res.json({
      success: true,
      data: {
        awbNumber,
        labelUrl: label.labelUrl,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/orders/:id/shadowfax/cancel
 * Cancel a booked Shadowfax shipment before pickup.
 */
export async function adminCancelShadowfaxShipment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orderId = String(req.params.id || '');
    const reason = req.body.reason || 'Admin cancelled shipment';

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

    const awbNumber = order.shadowfaxDetails?.awbNumber || order.trackingNumber;
    if (!awbNumber) {
      res.status(400).json({ success: false, error: { code: 'NO_AWB', message: 'No Shadowfax shipment exists on this order.' } });
      return;
    }

    const cancelRes = await shadowfaxService.cancelForwardOrder(awbNumber, reason);

    if (order.shadowfaxDetails) {
      order.shadowfaxDetails.status = 'cancelled';
      order.shadowfaxDetails.statusDisplay = 'Cancelled';
    }

    order.statusHistory.push({
      status: order.fulfilmentStatus,
      changedBy: req.user?.email || 'Admin',
      changedAt: new Date().toISOString(),
      note: `Shadowfax shipment cancelled. AWB: ${awbNumber}. Reason: ${reason}`,
    });

    await order.save();

    res.json({
      success: true,
      message: cancelRes.message,
      data: order,
    });
  } catch (err: any) {
    next(err);
  }
}

/**
 * POST /api/v1/orders/webhook/shadowfax
 * Receives webhook callbacks from Shadowfax on status transitions.
 */
export async function shadowfaxWebhook(req: Request, res: Response): Promise<void> {
  try {
    const payload = req.body || {};
    const awbNumber = payload.awb_number || payload.awbNumber;
    const clientOrderId = payload.client_order_id || payload.clientOrderId;
    const statusId = payload.status_id || payload.statusId || '';
    const status = payload.status || '';
    const remarks = payload.remarks || '';
    const currentLocation = payload.current_location || payload.currentLocation || '';

    log.info({ awbNumber, clientOrderId, statusId, status }, 'Received Shadowfax webhook callback');

    if (!awbNumber && !clientOrderId) {
      res.status(200).json({ message: 'Callback received without identifiers' });
      return;
    }

    const query: any = {
      $or: [
        ...(awbNumber ? [{ 'shadowfaxDetails.awbNumber': awbNumber }, { trackingNumber: awbNumber }] : []),
        ...(clientOrderId ? [{ orderNumber: clientOrderId }] : []),
      ],
    };

    const order = await Order.findOne(query);
    if (!order) {
      log.warn({ awbNumber, clientOrderId }, 'Webhook received for unknown order');
      res.status(200).json({ message: 'Order not found' });
      return;
    }

    if (order.shadowfaxDetails) {
      order.shadowfaxDetails.status = statusId || order.shadowfaxDetails.status;
      order.shadowfaxDetails.statusDisplay = status || order.shadowfaxDetails.statusDisplay;
      if (!order.shadowfaxDetails.trackingDetails) order.shadowfaxDetails.trackingDetails = [];
      order.shadowfaxDetails.trackingDetails.push({
        created: new Date().toISOString(),
        location: currentLocation,
        status_id: statusId,
        status,
        remarks,
        awb_number: awbNumber,
      });
      order.shadowfaxDetails.lastTrackingSync = new Date().toISOString();
    }

    // Map statusId to fulfillmentStatus
    if (statusId === 'delivered') {
      order.fulfilmentStatus = 'delivered';
      for (const it of order.items) {
        it.itemStatus = 'delivered';
        it.deliveredAt = new Date().toISOString();
      }
      triggerOrderDeliveredNotification(order);
    } else if (statusId === 'picked' || statusId === 'recd_at_fwd_hub' || statusId === 'ofd') {
      if (order.fulfilmentStatus !== 'delivered') {
        order.fulfilmentStatus = 'shipped';
      }
    } else if (statusId === 'cancelled') {
      order.fulfilmentStatus = 'cancelled';
      for (const it of order.items) {
        it.itemStatus = 'cancelled';
      }
    } else if (statusId === 'rts' || statusId === 'rto' || statusId === 'rts_d' || statusId === 'rto_d') {
      order.fulfilmentStatus = 'returned';
    }

    order.statusHistory.push({
      status: order.fulfilmentStatus,
      changedBy: 'Shadowfax Webhook',
      changedAt: new Date().toISOString(),
      note: `Shadowfax: ${status || statusId}${remarks ? ` - ${remarks}` : ''}${
        currentLocation ? ` (${currentLocation})` : ''
      }`,
    });

    await order.save();
    res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (err: any) {
    log.error({ err: err?.message }, 'Error processing Shadowfax webhook');
    res.status(200).json({ message: 'Error processed' });
  }
}


