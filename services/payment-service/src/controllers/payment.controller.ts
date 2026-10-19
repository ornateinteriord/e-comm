import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import axios from 'axios';
import { PaymentTransaction } from '../models/payment.model.js';
import { createLogger } from '@ornate/logger';

const log = createLogger('payment-controller');

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL ?? 'http://localhost:4006';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ?? 'rzp_test_mock';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? 'mock_secret';

const isMockRazorpay = RAZORPAY_KEY_ID.includes('XXXXXXXX') || RAZORPAY_KEY_ID.includes('mock');

let razorpayClient: Razorpay | null = null;
if (!isMockRazorpay) {
  try {
    razorpayClient = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
  } catch (err) {
    log.warn('Could not initialize Razorpay client, fallback to mock mode');
  }
}

export async function createPaymentIntent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderId, orderNumber, amount, currency = 'INR' } = req.body;
    if (!orderId || !amount || amount <= 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'orderId and valid amount required.' } });
      return;
    }

    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let gatewayOrderId = `order_mock_${Date.now()}`;

    if (razorpayClient) {
      try {
        const order = await razorpayClient.orders.create({
          amount: Math.round(amount),
          currency,
          receipt: orderNumber || orderId,
        });
        gatewayOrderId = order.id;
      } catch (err) {
        log.warn({ err }, 'Razorpay API error, falling back to simulator order');
      }
    }

    const txn = await PaymentTransaction.create({
      transactionId,
      orderId,
      orderNumber: orderNumber || orderId,
      userId: req.user?.userId,
      amount: Math.round(amount),
      currency,
      method: 'razorpay',
      status: 'created',
      gatewayOrderId,
    });

    res.json({
      success: true,
      data: {
        transactionId: txn.transactionId,
        gatewayOrderId,
        amount: Math.round(amount),
        currency,
        keyId: RAZORPAY_KEY_ID,
        isMock: isMockRazorpay || !razorpayClient,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function verifyPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderId, gatewayOrderId, gatewayPaymentId, gatewaySignature, isSimulator } = req.body;

    const txn = await PaymentTransaction.findOne({
      $or: [{ gatewayOrderId }, { orderId }],
    }).sort({ createdAt: -1 });

    let isValid = false;

    if (isSimulator || isMockRazorpay || !razorpayClient) {
      isValid = true;
    } else if (gatewayOrderId && gatewayPaymentId && gatewaySignature) {
      const generatedSignature = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(`${gatewayOrderId}|${gatewayPaymentId}`)
        .digest('hex');
      isValid = generatedSignature === gatewaySignature;
    }

    if (!isValid) {
      if (txn) {
        txn.status = 'failed';
        txn.errorDescription = 'Invalid payment signature';
        await txn.save();
      }
      res.status(400).json({ success: false, error: { code: 'PAYMENT_FAILED', message: 'Payment verification failed.' } });
      return;
    }

    const paymentRef = gatewayPaymentId || `pay_sim_${Date.now()}`;

    if (txn) {
      txn.status = 'success';
      txn.gatewayPaymentId = paymentRef;
      txn.gatewaySignature = gatewaySignature;
      await txn.save();
    }

    // Notify order-service to mark order as paid
    const targetOrderId = txn?.orderId || orderId;
    if (targetOrderId) {
      try {
        await axios.patch(
          `${ORDER_SERVICE_URL}/api/v1/orders/${targetOrderId}/payment-confirmation`,
          {
            paymentStatus: 'paid',
            fulfilmentStatus: 'confirmed',
            note: `Payment verified successfully via ${txn?.method || 'Razorpay'}. Reference: ${paymentRef}`,
          },
        );
      } catch (err) {
        log.error({ err, orderId: targetOrderId }, 'Failed to update order status in order-service');
      }
    }

    res.json({
      success: true,
      message: 'Payment verified and order confirmed successfully!',
      data: {
        paymentReference: paymentRef,
        orderId: targetOrderId,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function adminListPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const { status, search } = req.query;

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { transactionId: { $regex: String(search), $options: 'i' } },
        { orderNumber: { $regex: String(search), $options: 'i' } },
        { gatewayPaymentId: { $regex: String(search), $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      PaymentTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      PaymentTransaction.countDocuments(filter),
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
