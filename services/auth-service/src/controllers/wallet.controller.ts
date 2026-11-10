import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Customer } from '../models/customer.model.js';
import { WalletTransaction } from '../models/wallet-transaction.model.js';
import { createLogger } from '@ornate/logger';

const log = createLogger('wallet-controller');

/**
 * Synchronizes any credited commission records from e-cash.commission_tbl into
 * ornate_auth.wallettransactions for the customer if not already present.
 * Also atomically credits walletBalance on the customer document for each
 * newly-discovered commission (fixes the ₹0 balance bug).
 * Returns total paise newly credited (0 if everything was already in sync).
 */
async function syncCustomerCommissions(customer: any): Promise<number> {
  let totalNewlyCreditedPaise = 0;
  try {
    const client =
      typeof (mongoose.connection as any).getClient === 'function'
        ? (mongoose.connection as any).getClient()
        : (mongoose.connection as any).client;

    const ecashDb = client ? client.db('e-cash') : mongoose.connection.useDb('e-cash');
    const authDb  = client ? client.db('ornate_auth') : (mongoose.connection.useDb('ornate_auth') as any).db;

    const customerIdentifiers = [
      String(customer._id),
      customer.customerId,
      customer.customer_id,
      customer.mobileNumber,
      customer.phone,
      customer.username,
    ].filter(Boolean);

    const comms = await ecashDb.collection('commission_tbl').find({
      $or: [
        { userId: { $in: customerIdentifiers } },
        { beneficiary_id: { $in: customerIdentifiers } },
      ],
      status: 'CREDITED',
    }).toArray();

    if (!comms || comms.length === 0) return 0;

    for (const comm of comms) {
      const commId = String(comm.commission_id || '');
      const refId = String(comm.transaction_id || commId);

      const existing = await WalletTransaction.findOne({
        $or: [
          { transactionId: `txn_comm_${commId}` },
          { 'metadata.commissionId': commId },
        ],
      });

      if (!existing) {
        const amountPaise = Math.round(Number(comm.commission_amount) * 100);
        const amountRupees = Number(comm.commission_amount);
        const orderNumber = comm.transaction_id || refId;
        const createdAtDate = comm.transaction_date || comm.credited_at || comm.createdAt || new Date();

        if (amountPaise <= 0) continue;

        // ── KEY FIX: atomically increment walletBalance on the customer document ──
        const updatedCustomer = await authDb.collection('customers').findOneAndUpdate(
          { _id: customer._id },
          { $inc: { walletBalance: amountPaise } },
          { returnDocument: 'after' },
        );

        const newBalancePaise =
          (updatedCustomer && (updatedCustomer.walletBalance ?? updatedCustomer.value?.walletBalance)) ??
          ((customer.walletBalance || 0) + amountPaise);

        await WalletTransaction.create({
          transactionId: `txn_comm_${commId}`,
          userId: String(customer._id),
          customerId: customer.customerId || customer.customer_id,
          type: 'credit',
          category: 'commission',
          amount: amountPaise,
          amountRupees,
          balanceAfter: newBalancePaise,
          balanceAfterRupees: Number((newBalancePaise / 100).toFixed(2)),
          status: 'success',
          referenceId: orderNumber,
          description: `Commission from Order #${orderNumber} (Level ${comm.level || 1})`,
          metadata: {
            orderNumber,
            commissionId: commId,
            level: comm.level || 1,
            role: comm.account_type || 'Commission Margin',
            rate: comm.commission_rate,
            sourceName: comm.source_name,
            sourceId: comm.source_id,
          },
          createdAt: createdAtDate,
          updatedAt: comm.updatedAt || createdAtDate,
        });

        // Keep local reference in sync for subsequent iterations
        customer.walletBalance = newBalancePaise;
        totalNewlyCreditedPaise += amountPaise;

        log.info(
          { commissionId: commId, customerId: customer.customerId, amountRupees, newBalancePaise },
          '[WALLET] Synced commission record + credited walletBalance',
        );
      }
    }
  } catch (syncErr) {
    log.warn({ syncErr }, '[WALLET] Non-fatal error while syncing commissions from commission_tbl');
  }
  return totalNewlyCreditedPaise;
}

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

// ─── HELPER: Reconcile & get customer balance + stats ────────────────────────
export async function reconcileAndGetCustomerBalance(customer: any): Promise<{
  balancePaise: number;
  balanceRupees: number;
  stats: {
    totalTopupPaise: number;
    totalTopupRupees: number;
    totalSpentPaise: number;
    totalSpentRupees: number;
    totalCommissionPaise: number;
    totalCommissionRupees: number;
  };
  freshCustomer: any;
}> {
  // 1. Auto-sync any un-synced commissions from commission_tbl
  const newlyCredited = await syncCustomerCommissions(customer);

  let freshCustomer =
    newlyCredited > 0
      ? (await Customer.findById(customer._id)) ?? customer
      : customer;

  const userIds = [String(freshCustomer._id), freshCustomer.userId].filter(Boolean);

  // 2. Aggregate actual transaction totals strictly scoped to this user account
  const [stats] = await WalletTransaction.aggregate([
    {
      $match: {
        userId: { $in: userIds },
        status: 'success',
      },
    },
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

  const totalTopupPaise = stats?.totalTopup || 0;
  const totalSpentPaise = stats?.totalSpent || 0;
  const totalCommissionPaise = stats?.totalCommission || 0;

  const expectedBalancePaise = Math.max(0, totalTopupPaise + totalCommissionPaise - totalSpentPaise);
  const currentDbBalancePaise = freshCustomer.walletBalance || 0;

  let resolvedBalancePaise = currentDbBalancePaise;

  // 3. Reconcile DB customer.walletBalance if ledger has more credits
  if (expectedBalancePaise > currentDbBalancePaise) {
    await Customer.findByIdAndUpdate(freshCustomer._id, {
      $set: { walletBalance: expectedBalancePaise },
    });
    freshCustomer.walletBalance = expectedBalancePaise;
    resolvedBalancePaise = expectedBalancePaise;
    log.info(
      {
        customerId: freshCustomer.customerId,
        oldBalance: currentDbBalancePaise,
        reconciledBalance: expectedBalancePaise,
      },
      '[WALLET] Reconciled customer walletBalance from transaction ledger',
    );
  }

  // 4. Fix any historical transactions that recorded balanceAfter = 0 for successful credits
  if (resolvedBalancePaise > 0) {
    await WalletTransaction.updateMany(
      {
        userId: { $in: userIds },
        $or: [
          { balanceAfter: 0 },
          { balanceAfter: null },
          { balanceAfterRupees: 0 },
          { balanceAfterRupees: null },
        ],
        type: 'credit',
        status: 'success',
      },
      {
        $set: {
          balanceAfter: resolvedBalancePaise,
          balanceAfterRupees: Number((resolvedBalancePaise / 100).toFixed(2)),
        },
      },
    ).catch(() => {});
  }

  const balanceRupees = Number((resolvedBalancePaise / 100).toFixed(2));

  return {
    balancePaise: resolvedBalancePaise,
    balanceRupees,
    stats: {
      totalTopupPaise,
      totalTopupRupees: Number((totalTopupPaise / 100).toFixed(2)),
      totalSpentPaise,
      totalSpentRupees: Number((totalSpentPaise / 100).toFixed(2)),
      totalCommissionPaise,
      totalCommissionRupees: Number((totalCommissionPaise / 100).toFixed(2)),
    },
    freshCustomer,
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

    const { balancePaise, balanceRupees, stats } = await reconcileAndGetCustomerBalance(customer);

    res.json({
      success: true,
      data: {
        balance: balancePaise,
        balanceRupees,
        stats,
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

    const { balancePaise, balanceRupees, freshCustomer } = await reconcileAndGetCustomerBalance(customer);

    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 10)));
    const category = req.query.category as string | undefined;
    const type = req.query.type as string | undefined;

    const userIds = [String(freshCustomer._id), freshCustomer.userId].filter(Boolean);
    const query: any = {
      userId: { $in: userIds },
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

    res.json({
      success: true,
      data: {
        items,
        balance: balancePaise,
        balanceRupees,
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
      order_note: `E-Shopy Wallet Top-up: ₹${amountRupees}`,
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

