import { Request, Response, NextFunction } from 'express';
import { Customer } from '../models/customer.model.js';
import { WalletTransaction } from '../models/wallet-transaction.model.js';
import { createLogger } from '@ornate/logger';

const log = createLogger('wallet-controller');

function getCashfreeConfig(requestedMode?: string): {
  isProd: boolean;
  appId: string;
  secretKey: string;
  baseUrl: string;
  environment: 'production' | 'sandbox';
} {
  const envSetting = (process.env.CASHFREE_ENV ?? 'SANDBOX').toUpperCase();
  const rawAppId = (process.env.CASHFREE_APP_ID ?? '').trim();
  const rawSecret = (process.env.CASHFREE_SECRET_KEY ?? '').trim();

  let isProd: boolean;
  if (requestedMode?.toLowerCase() === 'production') {
    isProd = true;
  } else if (requestedMode?.toLowerCase() === 'sandbox') {
    isProd = false;
  } else {
    isProd = envSetting === 'PRODUCTION' && !rawAppId.startsWith('TEST');
  }

  return {
    isProd,
    appId: rawAppId,
    secretKey: rawSecret,
    baseUrl: isProd ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg',
    environment: isProd ? 'production' : 'sandbox',
  };
}

// ─── GET /api/v1/wallet (or /balance) ─────────────────────────────────────────
export async function getWalletBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const customer = await Customer.findOne({
      $or: [{ _id: userId }, { userId }],
    });

    if (!customer) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found.' } });
      return;
    }

    const balancePaise = customer.walletBalance || 0;
    const balanceRupees = Number((balancePaise / 100).toFixed(2));

    // Calculate quick stats from transactions
    const [stats] = await WalletTransaction.aggregate([
      { $match: { userId: String(customer._id), status: 'success' } },
      {
        $group: {
          _id: null,
          totalTopup: {
            $sum: { $cond: [{ $eq: ['$category', 'topup'] }, '$amount', 0] },
          },
          totalSpent: {
            $sum: { $cond: [{ $eq: ['$category', 'order_payment'] }, '$amount', 0] },
          },
          totalCommission: {
            $sum: { $cond: [{ $eq: ['$category', 'commission'] }, '$amount', 0] },
          },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        balance: balancePaise,
        balanceRupees,
        stats: {
          totalTopupPaise: stats?.totalTopup || 0,
          totalTopupRupees: Number(((stats?.totalTopup || 0) / 100).toFixed(2)),
          totalSpentPaise: stats?.totalSpent || 0,
          totalSpentRupees: Number(((stats?.totalSpent || 0) / 100).toFixed(2)),
          totalCommissionPaise: stats?.totalCommission || 0,
          totalCommissionRupees: Number(((stats?.totalCommission || 0) / 100).toFixed(2)),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/v1/wallet/transactions ─────────────────────────────────────────
export async function getWalletTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const customer = await Customer.findOne({
      $or: [{ _id: userId }, { userId }],
    });

    if (!customer) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found.' } });
      return;
    }

    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 15)));
    const category = req.query.category as string | undefined;
    const type = req.query.type as string | undefined;

    const query: any = {
      userId: { $in: [String(customer._id), customer.userId, customer.customerId].filter(Boolean) },
    };

    if (category && category !== 'all') {
      query.category = category;
    }
    if (type && type !== 'all') {
      query.type = type;
    }

    const [items, total] = await Promise.all([
      WalletTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      WalletTransaction.countDocuments(query),
    ]);

    const balancePaise = customer.walletBalance || 0;

    res.json({
      success: true,
      data: {
        items,
        balance: balancePaise,
        balanceRupees: Number((balancePaise / 100).toFixed(2)),
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

// ─── POST /api/v1/wallet/topup/create-session ────────────────────────────────
export async function createWalletTopupSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const customer = await Customer.findOne({
      $or: [{ _id: userId }, { userId }],
    });

    if (!customer) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found.' } });
      return;
    }

    const rawAmount = req.body.amount;
    const amountRupees = Number(rawAmount);

    if (isNaN(amountRupees) || amountRupees < 1) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_AMOUNT', message: 'Please enter a valid amount (minimum ₹1).' },
      });
      return;
    }

    if (amountRupees > 100000) {
      res.status(400).json({
        success: false,
        error: { code: 'AMOUNT_TOO_HIGH', message: 'Maximum top-up amount is ₹1,00,000 per transaction.' },
      });
      return;
    }

    const amountPaise = Math.round(amountRupees * 100);
    const cfOrderId = `topup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const transactionId = `txn_topup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const requestedMode = req.body.mode || (process.env.CASHFREE_ENV ?? 'SANDBOX').toLowerCase();
    const cfConfig = getCashfreeConfig(requestedMode);

    if (!cfConfig.appId || !cfConfig.secretKey) {
      res.status(503).json({
        success: false,
        error: { code: 'PAYMENT_GATEWAY_UNAVAILABLE', message: 'Payment gateway credentials are not configured.' },
      });
      return;
    }

    const returnUrl =
      req.body.returnUrl ||
      `${process.env.FRONTEND_URL ?? 'https://www.eshopy.biz'}/wallet?topup_status=returned&cf_order_id=${cfOrderId}`;

    const cleanPhone = String(customer.mobileNumber || customer.phone || '9999999999').replace(/\D/g, '').slice(-10) || '9999999999';

    const orderPayload = {
      order_id: cfOrderId,
      order_amount: amountRupees,
      order_currency: 'INR',
      customer_details: {
        customer_id: String(customer._id),
        customer_name: customer.fullName || customer.name || 'Customer',
        customer_email: customer.email,
        customer_phone: cleanPhone,
      },
      order_meta: {
        return_url: returnUrl,
      },
      order_note: `E-Shophy Wallet Top-up: ₹${amountRupees}`,
    };

    const response = await fetch(`${cfConfig.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': cfConfig.appId,
        'x-client-secret': cfConfig.secretKey,
        'x-api-version': '2023-08-01',
      },
      body: JSON.stringify(orderPayload),
    });

    const responseData: any = await response.json();

    if (!response.ok || !responseData.payment_session_id) {
      log.error({ responseData, status: response.status }, 'Cashfree wallet top-up session creation failed');
      res.status(502).json({
        success: false,
        error: {
          code: responseData.code || 'GATEWAY_ERROR',
          message: responseData.message || 'Failed to create payment session with Cashfree.',
        },
      });
      return;
    }

    // Save pending transaction
    await WalletTransaction.create({
      transactionId,
      userId: String(customer._id),
      customerId: customer.customerId,
      type: 'credit',
      category: 'topup',
      amount: amountPaise,
      amountRupees,
      status: 'pending',
      referenceId: cfOrderId,
      description: `Wallet Top-up of ₹${amountRupees.toFixed(2)}`,
      metadata: {
        cfOrderId,
        paymentSessionId: responseData.payment_session_id,
        environment: cfConfig.environment,
      },
    });

    res.json({
      success: true,
      data: {
        payment_session_id: responseData.payment_session_id,
        cf_order_id: cfOrderId,
        environment: cfConfig.environment,
        amount: amountRupees,
        amountPaise,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/wallet/topup/verify ────────────────────────────────────────
export async function verifyWalletTopup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { orderId, cf_order_id } = req.body;
    const cfOrderId = cf_order_id || orderId;

    if (!cfOrderId) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'cf_order_id or orderId is required.' },
      });
      return;
    }

    const customer = await Customer.findOne({
      $or: [{ _id: userId }, { userId }],
    });

    if (!customer) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found.' } });
      return;
    }

    const txn = await WalletTransaction.findOne({
      referenceId: cfOrderId,
      category: 'topup',
    });

    if (!txn) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Top-up transaction not found.' },
      });
      return;
    }

    // Idempotency: if already completed successfully, return current balance
    if (txn.status === 'success') {
      res.json({
        success: true,
        data: {
          balance: customer.walletBalance || 0,
          balanceRupees: Number(((customer.walletBalance || 0) / 100).toFixed(2)),
          transaction: txn,
          alreadyProcessed: true,
        },
        message: 'Top-up already completed successfully.',
      });
      return;
    }

    // Query Cashfree API to check order status
    const requestedMode = req.body.mode || txn.metadata?.environment || (process.env.CASHFREE_ENV ?? 'SANDBOX').toLowerCase();
    const cfConfig = getCashfreeConfig(requestedMode);

    const cfRes = await fetch(`${cfConfig.baseUrl}/orders/${cfOrderId}`, {
      method: 'GET',
      headers: {
        'x-client-id': cfConfig.appId,
        'x-client-secret': cfConfig.secretKey,
        'x-api-version': '2023-08-01',
      },
    });

    const cfOrderData: any = await cfRes.json();

    if (!cfRes.ok) {
      log.error({ cfOrderData, cfOrderId }, 'Cashfree order fetch failed during top-up verify');
      res.status(502).json({
        success: false,
        error: { code: 'GATEWAY_ERROR', message: cfOrderData.message || 'Could not verify payment status with Cashfree.' },
      });
      return;
    }

    const orderStatus = (cfOrderData.order_status || '').toUpperCase();

    if (orderStatus === 'PAID') {
      // Atomically increment customer wallet balance
      const updatedCustomer = await Customer.findOneAndUpdate(
        { $or: [{ _id: customer._id }, { userId: customer.userId }] },
        { $inc: { walletBalance: txn.amount } },
        { new: true },
      );

      const newBalance = updatedCustomer?.walletBalance || 0;

      txn.status = 'success';
      txn.balanceAfter = newBalance;
      txn.balanceAfterRupees = Number((newBalance / 100).toFixed(2));
      txn.metadata = {
        ...txn.metadata,
        cfOrderStatus: orderStatus,
        cfPaymentData: cfOrderData,
      };
      await txn.save();

      res.json({
        success: true,
        data: {
          balance: newBalance,
          balanceRupees: Number((newBalance / 100).toFixed(2)),
          amountAdded: txn.amountRupees,
          transaction: txn,
        },
        message: `₹${txn.amountRupees.toFixed(2)} added to your wallet successfully!`,
      });
    } else if (orderStatus === 'FAILED' || orderStatus === 'CANCELLED' || orderStatus === 'EXPIRED') {
      txn.status = 'failed';
      txn.metadata = { ...txn.metadata, cfOrderStatus: orderStatus };
      await txn.save();

      res.status(400).json({
        success: false,
        error: { code: 'PAYMENT_FAILED', message: `Top-up payment was ${orderStatus.toLowerCase()}.` },
      });
    } else {
      res.json({
        success: false,
        data: {
          orderStatus,
          message: 'Payment is still being processed. Please refresh in a moment.',
        },
      });
    }
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/wallet/debit (Internal or authorized debit) ────────────────
export async function internalDebitWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId || req.body.userId;
    const { amountPaise, orderNumber, description } = req.body;

    if (!userId || !amountPaise || amountPaise <= 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'userId and positive amountPaise are required.' },
      });
      return;
    }

    const customer = await Customer.findOne({
      $or: [{ _id: userId }, { userId }],
    });

    if (!customer) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found.' } });
      return;
    }

    if ((customer.walletBalance || 0) < amountPaise) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_BALANCE',
          message: `Insufficient wallet balance. Available: ₹${((customer.walletBalance || 0) / 100).toFixed(2)}`,
        },
      });
      return;
    }

    // Atomically decrement
    const updatedCustomer = await Customer.findOneAndUpdate(
      {
        $or: [{ _id: customer._id }, { userId: customer.userId }],
        walletBalance: { $gte: amountPaise },
      },
      { $inc: { walletBalance: -amountPaise } },
      { new: true },
    );

    if (!updatedCustomer) {
      res.status(400).json({
        success: false,
        error: { code: 'INSUFFICIENT_BALANCE', message: 'Insufficient wallet balance.' },
      });
      return;
    }

    const newBalance = updatedCustomer.walletBalance || 0;
    const amountRupees = Number((amountPaise / 100).toFixed(2));

    const txn = await WalletTransaction.create({
      transactionId: `txn_debit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: String(customer._id),
      customerId: customer.customerId,
      type: 'debit',
      category: 'order_payment',
      amount: amountPaise,
      amountRupees,
      balanceAfter: newBalance,
      balanceAfterRupees: Number((newBalance / 100).toFixed(2)),
      status: 'success',
      referenceId: orderNumber || 'MANUAL_DEBIT',
      description: description || `Payment for Order #${orderNumber || ''}`,
      metadata: { orderNumber },
    });

    res.json({
      success: true,
      data: {
        balance: newBalance,
        balanceRupees: Number((newBalance / 100).toFixed(2)),
        amountDebited: amountRupees,
        transaction: txn,
      },
    });
  } catch (err) {
    next(err);
  }
}

