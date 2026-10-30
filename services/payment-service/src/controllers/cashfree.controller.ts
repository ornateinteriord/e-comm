 import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import axios from 'axios';
import { PaymentTransaction } from '../models/payment.model.js';
import { createLogger } from '@ornate/logger';
import { Cashfree, CFEnvironment } from 'cashfree-pg';

const log = createLogger('cashfree-controller');

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID ?? '';
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY ?? '';
const CASHFREE_ENV = (process.env.CASHFREE_ENV ?? 'SANDBOX') as 'SANDBOX' | 'PRODUCTION';
const CASHFREE_WEBHOOK_SECRET = process.env.CASHFREE_WEBHOOK_SECRET ?? CASHFREE_SECRET_KEY;
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL ?? 'http://localhost:4006';

// Initialize Cashfree client instance
const cashfree = new Cashfree(
  CASHFREE_ENV === 'PRODUCTION' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
  CASHFREE_APP_ID,
  CASHFREE_SECRET_KEY,
);

/**
 * Notifies the order-service to update payment/fulfillment status.
 * Fire-and-forget on failure — webhook will serve as safety net.
 */
async function notifyOrderService(
  orderId: string,
  paymentStatus: string,
  fulfilmentStatus: string,
  note: string,
  paymentReference?: string,
) {
  try {
    await axios.patch(
      `${ORDER_SERVICE_URL}/api/v1/orders/${orderId}/payment-confirmation`,
      { paymentStatus, fulfilmentStatus, note, paymentReference },
    );
    log.info({ orderId, paymentStatus }, 'Order service notified successfully');
  } catch (err) {
    log.error({ err, orderId }, 'Failed to notify order service — webhook should retry');
  }
}

// ─── POST /api/v1/payments/cashfree/create-order ─────────────────────────────
export async function createCashfreeOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      orderId,
      orderNumber,
      amount,          // in paise
      customerName,
      customerEmail,
      customerPhone,
      returnUrl,
    } = req.body;

    if (!orderId || !amount || amount <= 0 || !customerEmail) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'orderId, amount, and customerEmail are required.' },
      });
      return;
    }

    if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
      res.status(503).json({
        success: false,
        error: { code: 'PAYMENT_GATEWAY_UNAVAILABLE', message: 'Payment gateway not configured.' },
      });
      return;
    }

    // Prevent duplicate payment for already-paid orders
    const alreadyPaid = await PaymentTransaction.findOne({ orderId, status: 'success' });
    if (alreadyPaid) {
      res.status(409).json({
        success: false,
        error: { code: 'ALREADY_PAID', message: 'This order has already been paid.' },
      });
      return;
    }

    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const cfOrderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Amount for Cashfree is in INR (rupees), not paise
    const amountInRupees = (amount / 100).toFixed(2);

    const cfOrderRequest = {
      order_id: cfOrderId,
      order_amount: parseFloat(amountInRupees),
      order_currency: 'INR',
      customer_details: {
        customer_id: req.user?.userId || orderId,
        customer_name: customerName || customerEmail.split('@')[0],
        customer_email: customerEmail,
        customer_phone: String(customerPhone || '9999999999').replace(/\D/g, '').slice(-10) || '9999999999',
      },
      order_meta: {
        return_url: returnUrl || `${process.env.FRONTEND_URL ?? 'https://www.eshopy.biz'}/payment/return?order_id=${orderId}&cf_order_id=${cfOrderId}`,
        notify_url: `${process.env.PAYMENT_SERVICE_URL ?? 'https://api.eshopy.biz'}/api/v1/webhooks/cashfree`,
      },
      order_note: `Order ${orderNumber || orderId}`,
    };

    let payment_session_id = '';
    let cashfreeError: string | null = null;

    try {
      const cfResponse = await cashfree.PGCreateOrder(cfOrderRequest as any);
      payment_session_id = cfResponse?.data?.payment_session_id ?? '';
    } catch (err: any) {
      cashfreeError = err?.response?.data?.message || err?.message || 'Cashfree API error';
      log.error({ err, cfOrderId }, 'Cashfree create order failed');
    }

    if (!payment_session_id) {
      res.status(502).json({
        success: false,
        error: { code: 'GATEWAY_ERROR', message: cashfreeError || 'Failed to create payment session.' },
      });
      return;
    }

    // Persist the transaction record
    await PaymentTransaction.create({
      transactionId,
      orderId,
      orderNumber: orderNumber || orderId,
      userId: req.user?.userId,
      amount: Math.round(amount),
      currency: 'INR',
      method: 'cashfree',
      status: 'created',
      cfOrderId,
      gatewayOrderId: cfOrderId,
      paymentSessionId: payment_session_id,
    });

    log.info({ transactionId, cfOrderId, orderId }, 'Cashfree payment session created');

    res.json({
      success: true,
      data: {
        transactionId,
        payment_session_id,
        cf_order_id: cfOrderId,
        amount: Math.round(amount),
        currency: 'INR',
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/payments/cashfree/verify ────────────────────────────────────
/**
 * Called by the frontend on the return URL page.
 * Queries Cashfree for the real payment status and updates DB + order.
 */
export async function verifyCashfreePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderId, cf_order_id } = req.body;

    if (!orderId && !cf_order_id) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'orderId or cf_order_id is required.' },
      });
      return;
    }

    // Find the transaction
    const txn = await PaymentTransaction.findOne({
      $or: [
        ...(cf_order_id ? [{ cfOrderId: cf_order_id }] : []),
        ...(orderId ? [{ orderId }] : []),
      ],
    }).sort({ createdAt: -1 });

    if (!txn) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Payment transaction not found.' },
      });
      return;
    }

    // If already confirmed, return success immediately (idempotent)
    if (txn.status === 'success') {
      res.json({
        success: true,
        data: { status: 'PAID', orderId: txn.orderId, cfPaymentId: txn.cfPaymentId },
      });
      return;
    }

    const targetCfOrderId = txn.cfOrderId || txn.gatewayOrderId || cf_order_id;

    // Query Cashfree for real-time payment status
    let cfStatus = 'ACTIVE'; // default = still pending
    let cfPaymentId: string | undefined = txn.cfPaymentId || txn.gatewayPaymentId;
    let failureReason: string | undefined = txn.failureReason;
    let payments: any[] = [];

    if (targetCfOrderId) {
      try {
        const cfRes = await cashfree.PGFetchOrder(targetCfOrderId);
        const orderData = cfRes?.data as any;
        cfStatus = orderData?.order_status ?? 'ACTIVE';
      } catch (err: any) {
        log.warn({ err: err?.message, cfOrderId: targetCfOrderId }, 'Cashfree fetch order failed');
      }

      try {
        const paymentsRes = await cashfree.PGOrderFetchPayments(targetCfOrderId);
        const paymentList = paymentsRes?.data;
        if (Array.isArray(paymentList)) {
          payments = paymentList;
        }
      } catch (err: any) {
        log.warn({ err: err?.message, cfOrderId: targetCfOrderId }, 'Cashfree fetch payments failed or no payments found');
      }
    }

    // 1. Check if any payment is SUCCESS
    const successPayment = payments.find((p: any) => (p.payment_status || '').toUpperCase() === 'SUCCESS');
    if (successPayment) {
      cfPaymentId = successPayment?.cf_payment_id?.toString() || cfPaymentId;
      cfStatus = 'PAID';
    }

    if (cfStatus === 'PAID') {
      // Update transaction
      txn.status = 'success';
      txn.cfPaymentId = cfPaymentId;
      txn.gatewayPaymentId = cfPaymentId;
      txn.webhookProcessed = true;
      await txn.save();

      // Notify order service
      await notifyOrderService(
        txn.orderId,
        'paid',
        'confirmed',
        `Payment confirmed via Cashfree. Ref: ${cfPaymentId || targetCfOrderId}`,
        cfPaymentId || targetCfOrderId,
      );

      res.json({
        success: true,
        data: { status: 'PAID', orderId: txn.orderId, cfPaymentId },
      });
      return;
    }

    // 2. Check individual payment attempts if any were made
    if (payments.length > 0) {
      // Sort payments by timestamp / id descending (latest attempt first)
      const sortedPayments = [...payments].sort((a: any, b: any) => {
        const timeA = new Date(a.payment_completion_time || a.payment_time || 0).getTime();
        const timeB = new Date(b.payment_completion_time || b.payment_time || 0).getTime();
        if (timeA !== timeB) return timeB - timeA;
        const idA = Number(a.cf_payment_id) || 0;
        const idB = Number(b.cf_payment_id) || 0;
        return idB - idA;
      });

      const latestPayment = sortedPayments[0];
      const pStatus = (latestPayment?.payment_status || '').toUpperCase();

      if (pStatus === 'USER_DROPPED') {
        txn.status = 'user_dropped';
        txn.failureReason = latestPayment.payment_message || 'Payment session was cancelled or closed.';
        await txn.save();

        res.json({
          success: true,
          data: {
            status: 'USER_DROPPED',
            orderId: txn.orderId,
            message: latestPayment.payment_message || 'You cancelled the payment or closed the checkout window.',
          },
        });
        return;
      }

      if (pStatus === 'FAILED' || pStatus === 'CANCELLED' || pStatus === 'VOID') {
        const reason =
          latestPayment.error_details?.error_description ||
          latestPayment.payment_message ||
          'Payment failed or declined by your bank.';

        txn.status = 'failed';
        txn.failureReason = reason;
        await txn.save();

        await notifyOrderService(
          txn.orderId,
          'failed',
          'pending',
          `Payment failed. Reason: ${reason}`,
        );

        res.json({
          success: true,
          data: {
            status: 'FAILED',
            orderId: txn.orderId,
            message: reason,
          },
        });
        return;
      }

      if (pStatus === 'PENDING') {
        res.json({
          success: true,
          data: {
            status: 'PENDING',
            orderId: txn.orderId,
            message: latestPayment.payment_message || 'Payment is still being processed.',
          },
        });
        return;
      }
    }

    // 3. Fallback when no payment attempts were returned or found
    if (cfStatus === 'EXPIRED' || cfStatus === 'TERMINATED' || cfStatus === 'FAILED') {
      txn.status = 'failed';
      txn.failureReason = failureReason || `Cashfree order status: ${cfStatus}`;
      await txn.save();

      await notifyOrderService(
        txn.orderId,
        'failed',
        'pending',
        `Payment failed. Status: ${cfStatus}`,
      );

      res.json({
        success: true,
        data: {
          status: 'FAILED',
          orderId: txn.orderId,
          message: `Payment session ${cfStatus.toLowerCase()}. Please try again.`,
        },
      });
      return;
    }

    // Check if webhook previously recorded a terminal state in DB
    if (txn.status === 'user_dropped') {
      res.json({
        success: true,
        data: {
          status: 'USER_DROPPED',
          orderId: txn.orderId,
          message: txn.failureReason || 'You cancelled the payment or closed the checkout window.',
        },
      });
      return;
    }

    if (txn.status === 'failed') {
      res.json({
        success: true,
        data: {
          status: 'FAILED',
          orderId: txn.orderId,
          message: txn.failureReason || 'Payment failed.',
        },
      });
      return;
    }

    // ACTIVE / still pending
    res.json({
      success: true,
      data: {
        status: 'PENDING',
        orderId: txn.orderId,
        message: 'Payment is still being processed.',
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/webhooks/cashfree ──────────────────────────────────────────
/**
 * Cashfree webhook handler — safety net for all payment events.
 * Must return 200 quickly; heavy work is sync but fast.
 * Cashfree retries on non-2xx.
 */
export async function cashfreeWebhook(req: Request, res: Response): Promise<void> {
  try {
    // Verify webhook signature using Cashfree SDK
    const timestamp = req.headers['x-webhook-timestamp'] as string;
    const signature = req.headers['x-webhook-signature'] as string;

    if (!timestamp || !signature) {
      log.warn('Cashfree webhook missing signature headers');
      res.status(200).json({ received: true }); // always 200 to prevent retries on config issues
      return;
    }

    // Cashfree webhook signature: HMAC-SHA256 of (timestamp + rawBody) using webhook secret
    const rawBody = (req as any).rawBody as Buffer | undefined;
    const bodyString = rawBody ? rawBody.toString('utf8') : JSON.stringify(req.body);
    const signaturePayload = `${timestamp}${bodyString}`;

    const expectedSignature = crypto
      .createHmac('sha256', CASHFREE_WEBHOOK_SECRET)
      .update(signaturePayload)
      .digest('base64');

    if (CASHFREE_WEBHOOK_SECRET && signature !== expectedSignature) {
      log.warn({ signature, expected: expectedSignature }, 'Cashfree webhook signature mismatch');
      res.status(200).json({ received: true }); // still 200 to stop retries for bad configs
      return;
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const eventType: string = event?.type ?? '';
    const paymentData = event?.data?.payment ?? {};
    const orderData = event?.data?.order ?? {};

    const cfPaymentId = String(paymentData?.cf_payment_id ?? '');
    const cfOrderId = String(orderData?.order_id ?? paymentData?.order_id ?? '');
    const paymentStatus: string = paymentData?.payment_status ?? '';

    log.info({ eventType, cfOrderId, cfPaymentId, paymentStatus }, 'Cashfree webhook received');

    if (!cfOrderId && !cfPaymentId) {
      res.status(200).json({ received: true });
      return;
    }

    // Find the transaction
    const txn = await PaymentTransaction.findOne({
      $or: [
        ...(cfOrderId ? [{ cfOrderId }] : []),
        ...(cfPaymentId ? [{ cfPaymentId }] : []),
      ],
    }).sort({ createdAt: -1 });

    if (!txn) {
      log.warn({ cfOrderId, cfPaymentId }, 'No matching transaction for webhook');
      res.status(200).json({ received: true });
      return;
    }

    // Idempotency: skip if already successfully processed
    if (txn.status === 'success' && txn.webhookProcessed) {
      log.info({ cfOrderId }, 'Webhook already processed, skipping');
      res.status(200).json({ received: true });
      return;
    }

    if (eventType === 'PAYMENT_SUCCESS_WEBHOOK' || paymentStatus === 'SUCCESS') {
      // Idempotent update — only if not already paid
      if (txn.status !== 'success') {
        txn.status = 'success';
        txn.cfPaymentId = cfPaymentId || txn.cfPaymentId;
        txn.gatewayPaymentId = cfPaymentId || txn.gatewayPaymentId;
        txn.webhookProcessed = true;
        await txn.save();

        await notifyOrderService(
          txn.orderId,
          'paid',
          'confirmed',
          `Payment confirmed via Cashfree webhook. Ref: ${cfPaymentId}`,
          cfPaymentId,
        );
        log.info({ cfOrderId, cfPaymentId }, 'Webhook: order marked paid');
      }
    } else if (eventType === 'PAYMENT_FAILED_WEBHOOK' || paymentStatus === 'FAILED') {
      if (txn.status !== 'success') { // don't override a success
        txn.status = 'failed';
        txn.cfPaymentId = cfPaymentId || txn.cfPaymentId;
        txn.failureReason = paymentData?.payment_message || 'Payment failed';
        txn.webhookProcessed = true;
        await txn.save();

        await notifyOrderService(txn.orderId, 'failed', 'pending', `Payment failed via Cashfree webhook.`);
        log.info({ cfOrderId }, 'Webhook: order payment marked failed');
      }
    } else if (eventType === 'PAYMENT_USER_DROPPED_WEBHOOK' || paymentStatus === 'USER_DROPPED') {
      if (txn.status !== 'success') {
        txn.status = 'user_dropped';
        txn.webhookProcessed = true;
        await txn.save();
        log.info({ cfOrderId }, 'Webhook: user dropped payment');
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    log.error({ err }, 'Cashfree webhook handler error');
    // Always 200 to avoid Cashfree retry storm
    res.status(200).json({ received: true });
  }
}
