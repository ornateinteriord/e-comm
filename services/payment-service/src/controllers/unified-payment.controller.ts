import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import axios from 'axios';
import { PaymentTransaction, PaymentGatewayType } from '../models/payment.model.js';
import { createLogger } from '@ornate/logger';
import { resolveCashfreeCredentials } from './cashfree.controller.js';
import { initiatePaytmTransaction, getPaytmConfig, verifyPaytmSignature } from './paytm.controller.js';

const log = createLogger('unified-payment-controller');

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL ?? 'http://localhost:4006';

function getRazorpayKeyId(): string {
  return (process.env.RAZORPAY_KEY_ID ?? '').trim();
}

function getRazorpayKeySecret(): string {
  return (process.env.RAZORPAY_KEY_SECRET ?? '').trim();
}

function getRazorpayWebhookSecret(): string {
  return (process.env.RAZORPAY_WEBHOOK_SECRET ?? '').trim();
}

export function getRazorpayClient(): Razorpay {
  return new Razorpay({
    key_id: getRazorpayKeyId(),
    key_secret: getRazorpayKeySecret(),
  });
}

/**
 * Validates HMAC-SHA256 signature for Razorpay payment
 */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string = getRazorpayKeySecret(),
): boolean {
  if (!orderId || !paymentId || !signature || !secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
}

/**
 * Validates HMAC-SHA256 signature for Razorpay webhooks
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string | Buffer,
  signature: string,
  secret: string = getRazorpayWebhookSecret(),
): boolean {
  if (!rawBody || !signature || !secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
}

/**
 * Notifies the order-service to update payment/fulfillment status.
 */
async function notifyOrderService(
  orderId: string,
  paymentStatus: string,
  fulfilmentStatus: string,
  note: string,
  paymentReference?: string,
  paymentMethod?: string,
) {
  try {
    await axios.patch(
      `${ORDER_SERVICE_URL}/api/v1/orders/${orderId}/payment-confirmation`,
      {
        paymentStatus,
        fulfilmentStatus,
        note,
        paymentReference,
        paymentMethod,
      },
    );
    log.info({ orderId, paymentStatus, paymentMethod }, 'Order service notified successfully');
  } catch (err: any) {
    log.error({ err: err?.message, orderId }, 'Failed to notify order service');
  }
}

/**
 * Helper to determine active gateway
 */
export function resolveActiveGateway(requestedGateway?: string): 'razorpay' | 'cashfree' | 'paytm' {
  const candidate = (requestedGateway || process.env.PAYMENT_GATEWAY || 'razorpay').toLowerCase().trim();
  if (candidate === 'cashfree') return 'cashfree';
  if (candidate === 'paytm') return 'paytm';
  return 'razorpay';
}

// ─── POST /api/v1/payments/create-order ──────────────────────────────────────
export async function createUnifiedPaymentOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      orderId,
      orderNumber,
      amount, // in paise
      customerName,
      customerEmail,
      customerPhone,
      returnUrl,
      gateway: requestedGateway,
    } = req.body;

    if (!orderId || !amount || amount <= 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'orderId and valid positive amount are required.' },
      });
      return;
    }

    // Prevent duplicate payments for already-paid orders
    const alreadyPaid = await PaymentTransaction.findOne({ orderId, status: 'success' });
    if (alreadyPaid) {
      res.status(409).json({
        success: false,
        error: { code: 'ALREADY_PAID', message: 'This order has already been paid.' },
      });
      return;
    }

    const activeGateway = resolveActiveGateway(requestedGateway);
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const parsedAmount = Math.round(Number(amount));

    log.info({ orderId, activeGateway, amount: parsedAmount }, 'Creating unified payment order');

    // ───────────────────────── 1. RAZORPAY ─────────────────────────
    if (activeGateway === 'razorpay') {
      const keyId = getRazorpayKeyId();
      const keySecret = getRazorpayKeySecret();

      if (!keyId || !keySecret) {
        res.status(503).json({
          success: false,
          error: { code: 'PAYMENT_GATEWAY_UNAVAILABLE', message: 'Razorpay credentials not configured.' },
        });
        return;
      }

      const razorpay = getRazorpayClient();
      let rzpOrder: any;

      try {
        rzpOrder = await razorpay.orders.create({
          amount: parsedAmount,
          currency: 'INR',
          receipt: (orderNumber || orderId).substring(0, 40),
          notes: {
            orderId,
            orderNumber: orderNumber || orderId,
            customerEmail: customerEmail || '',
          },
        });
      } catch (err: any) {
        log.error({ err: err?.message, orderId }, 'Razorpay orders.create API error');
        // If offline in development or sandbox without network egress, fallback to dev order
        const isOffline = err?.code === 'ENOTFOUND' || err?.message?.includes('ENOTFOUND') || err?.message?.includes('status');
        if (isOffline && process.env.NODE_ENV !== 'production') {
          log.warn({ orderId }, 'Offline/sandbox network detected: generating development Razorpay order');
          rzpOrder = { id: `order_dev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}` };
        } else {
          res.status(502).json({
            success: false,
            error: { code: 'GATEWAY_ERROR', message: err?.message || 'Failed to create Razorpay order.' },
          });
          return;
        }
      }

      const isLive = keyId.startsWith('rzp_live');
      await PaymentTransaction.create({
        transactionId,
        orderId,
        orderNumber: orderNumber || orderId,
        userId: req.user?.userId,
        amount: parsedAmount,
        currency: 'INR',
        method: 'razorpay',
        gateway: 'razorpay',
        status: 'created',
        razorpayOrderId: rzpOrder.id,
        gatewayOrderId: rzpOrder.id,
        environment: isLive ? 'production' : 'sandbox',
      });

      res.status(200).json({
        success: true,
        data: {
          gateway: 'razorpay',
          transactionId,
          orderId: rzpOrder.id,
          razorpayOrderId: rzpOrder.id,
          amount: parsedAmount,
          currency: 'INR',
          keyId,
          customer: {
            name: customerName || '',
            email: customerEmail || '',
            phone: customerPhone || '',
          },
        },
      });
      return;
    }

    // ───────────────────────── 2. CASHFREE ─────────────────────────
    if (activeGateway === 'cashfree') {
      const cfAppId = process.env.CASHFREE_APP_ID;
      const cfSecretKey = process.env.CASHFREE_SECRET_KEY;

      if (!cfAppId || !cfSecretKey) {
        res.status(503).json({
          success: false,
          error: { code: 'PAYMENT_GATEWAY_UNAVAILABLE', message: 'Cashfree credentials not configured.' },
        });
        return;
      }

      const cfOrderId = `cf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const amountInRupees = (parsedAmount / 100).toFixed(2);
      const isProd = (process.env.CASHFREE_ENV ?? 'SANDBOX').toUpperCase() === 'PRODUCTION';

      let finalReturnUrl = returnUrl || `${process.env.FRONTEND_URL ?? 'https://www.eshopy.biz'}/payment/return?order_id=${orderId}&cf_order_id=${cfOrderId}`;
      if (isProd && finalReturnUrl.startsWith('http://')) {
        finalReturnUrl = finalReturnUrl.replace(/^http:\/\//i, 'https://');
      }

      const cfOrderRequest: any = {
        order_id: cfOrderId,
        order_amount: parseFloat(amountInRupees),
        order_currency: 'INR',
        customer_details: {
          customer_id: req.user?.userId || orderId,
          customer_name: customerName || (customerEmail ? customerEmail.split('@')[0] : 'Customer'),
          customer_email: customerEmail || 'customer@eshopy.biz',
          customer_phone: String(customerPhone || '9999999999').replace(/\D/g, '').slice(-10) || '9999999999',
        },
        order_meta: {
          return_url: finalReturnUrl,
        },
        order_note: `Order ${orderNumber || orderId}`,
      };

      const requestedMode = (process.env.CASHFREE_ENV ?? 'SANDBOX').toLowerCase();
      const cfConfig = resolveCashfreeCredentials(requestedMode);

      let payment_session_id = '';
      try {
        const cfResponse = await cfConfig.client.PGCreateOrder(cfOrderRequest);
        payment_session_id = cfResponse?.data?.payment_session_id ?? '';
      } catch (err: any) {
        const errorMsg = err?.response?.data?.message || err?.message || 'Cashfree API error';
        log.error({ errorMsg, orderId }, 'Cashfree create order failed');
        res.status(502).json({
          success: false,
          error: { code: 'GATEWAY_ERROR', message: errorMsg },
        });
        return;
      }

      await PaymentTransaction.create({
        transactionId,
        orderId,
        orderNumber: orderNumber || orderId,
        userId: req.user?.userId,
        amount: parsedAmount,
        currency: 'INR',
        method: 'cashfree',
        gateway: 'cashfree',
        status: 'created',
        cfOrderId,
        gatewayOrderId: cfOrderId,
        paymentSessionId: payment_session_id,
        environment: cfConfig.environment,
      });

      res.status(200).json({
        success: true,
        data: {
          gateway: 'cashfree',
          transactionId,
          paymentSessionId: payment_session_id,
          payment_session_id,
          orderId: cfOrderId,
          cfOrderId,
          cf_order_id: cfOrderId,
          amount: parsedAmount,
          currency: 'INR',
          environment: cfConfig.environment,
        },
      });
      return;
    }

    // ───────────────────────── 3. PAYTM ─────────────────────────
    if (activeGateway === 'paytm') {
      const ptmRes = await initiatePaytmTransaction({
        orderId,
        orderNumber: orderNumber || orderId,
        amountPaise: parsedAmount,
        customerId: req.user?.userId || orderId,
        customerEmail,
        customerPhone,
        returnUrl,
      });

      await PaymentTransaction.create({
        transactionId,
        orderId,
        orderNumber: orderNumber || orderId,
        userId: req.user?.userId,
        amount: parsedAmount,
        currency: 'INR',
        method: 'paytm',
        gateway: 'paytm',
        status: 'created',
        paytmOrderId: ptmRes.paytmOrderId,
        gatewayOrderId: ptmRes.paytmOrderId,
        paytmTxnToken: ptmRes.txnToken,
        environment: ptmRes.environment,
      });

      res.status(200).json({
        success: true,
        data: {
          gateway: 'paytm',
          transactionId,
          orderId: ptmRes.paytmOrderId,
          paytmOrderId: ptmRes.paytmOrderId,
          txnToken: ptmRes.txnToken,
          mid: ptmRes.mid,
          amount: parsedAmount,
          currency: 'INR',
          environment: ptmRes.environment,
        },
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: { code: 'INVALID_GATEWAY', message: `Unsupported payment gateway: ${activeGateway}` },
    });
  } catch (err) {
    next(err);
  }
}

export const createUnifiedOrder = createUnifiedPaymentOrder;

// ─── POST /api/v1/payments/verify ───────────────────────────────────────────
export async function verifyUnifiedPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      gateway: specifiedGateway,
      orderId,
      // Razorpay
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      // Cashfree
      cf_order_id,
      // Paytm
      paytmOrderId,
      paytmChecksum,
      // Fallback
      gatewayOrderId,
      gatewayPaymentId,
      gatewaySignature,
    } = req.body;

    const rzpOrderId = razorpay_order_id || gatewayOrderId;
    const rzpPaymentId = razorpay_payment_id || gatewayPaymentId;
    const rzpSig = razorpay_signature || gatewaySignature;
    const cfOrderId = cf_order_id || (specifiedGateway === 'cashfree' ? orderId : undefined);
    const ptmOrderId = paytmOrderId || (specifiedGateway === 'paytm' ? orderId : undefined);

    // Locate matching transaction record
    const txn = await PaymentTransaction.findOne({
      $or: [
        ...(rzpOrderId ? [{ razorpayOrderId: rzpOrderId }, { gatewayOrderId: rzpOrderId }] : []),
        ...(cfOrderId ? [{ cfOrderId }, { gatewayOrderId: cfOrderId }] : []),
        ...(ptmOrderId ? [{ paytmOrderId: ptmOrderId }, { gatewayOrderId: ptmOrderId }] : []),
        ...(orderId ? [{ orderId }] : []),
      ],
    }).sort({ createdAt: -1 });

    // Idempotency: If already marked success, return 200 immediately
    if (txn && txn.status === 'success') {
      log.info({ orderId: txn.orderId }, 'Payment already verified previously (idempotent 200)');
      res.status(200).json({
        success: true,
        message: 'Payment already verified successfully.',
        data: {
          status: 'PAID',
          orderId: txn.orderId,
          gateway: txn.gateway || txn.method,
          paymentReference: txn.razorpayPaymentId || txn.cfPaymentId || txn.paytmBankTxnId || txn.gatewayPaymentId,
        },
      });
      return;
    }

    // Determine gateway to verify against
    const effectiveGateway = (
      specifiedGateway ||
      (rzpPaymentId || rzpSig ? 'razorpay' : '') ||
      (cfOrderId ? 'cashfree' : '') ||
      (ptmOrderId ? 'paytm' : '') ||
      txn?.gateway ||
      txn?.method ||
      process.env.PAYMENT_GATEWAY ||
      'razorpay'
    ).toLowerCase();

    const targetOrderId = txn?.orderId || orderId;

    // ───────────────────────── 1. RAZORPAY VERIFICATION ─────────────────────────
    if (effectiveGateway === 'razorpay') {
      if (!rzpOrderId || !rzpPaymentId || !rzpSig) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.',
          },
        });
        return;
      }

      const isValid = verifyRazorpaySignature(rzpOrderId, rzpPaymentId, rzpSig);
      if (!isValid) {
        if (txn) {
          txn.status = 'failed';
          txn.failureReason = 'Invalid Razorpay HMAC signature';
          txn.errorDescription = 'Signature verification failed';
          await txn.save();
        }
        res.status(400).json({
          success: false,
          error: { code: 'PAYMENT_FAILED', message: 'Payment verification failed: Invalid signature.' },
        });
        return;
      }

      if (txn) {
        txn.status = 'success';
        txn.razorpayOrderId = rzpOrderId;
        txn.razorpayPaymentId = rzpPaymentId;
        txn.razorpaySignature = rzpSig;
        txn.gatewayPaymentId = rzpPaymentId;
        txn.gatewaySignature = rzpSig;
        await txn.save();
      }

      if (targetOrderId) {
        await notifyOrderService(
          targetOrderId,
          'paid',
          'confirmed',
          `Payment verified via Razorpay. Reference: ${rzpPaymentId}`,
          rzpPaymentId,
          'Razorpay',
        );
      }

      res.status(200).json({
        success: true,
        message: 'Payment verified and order confirmed successfully!',
        data: {
          status: 'PAID',
          orderId: targetOrderId,
          gateway: 'razorpay',
          paymentReference: rzpPaymentId,
        },
      });
      return;
    }

    // ───────────────────────── 2. CASHFREE VERIFICATION ─────────────────────────
    if (effectiveGateway === 'cashfree') {
      const lookupCfOrderId = cfOrderId || txn?.cfOrderId || txn?.gatewayOrderId;
      if (!lookupCfOrderId) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'cf_order_id or orderId required for Cashfree verification.' },
        });
        return;
      }

      const requestedMode = (process.env.CASHFREE_ENV ?? 'SANDBOX').toLowerCase();
      const cfConfig = resolveCashfreeCredentials(requestedMode);
      let isPaid = false;
      let cfPaymentId = `cf_pay_${Date.now()}`;

      try {
        const paymentsResponse = await cfConfig.client.PGOrderFetchPayments(lookupCfOrderId);
        const payments: any[] = paymentsResponse?.data ?? [];
        const successPayment = payments.find((p: any) => p.payment_status === 'SUCCESS');
        if (successPayment) {
          isPaid = true;
          cfPaymentId = String(successPayment.cf_payment_id || cfPaymentId);
        } else {
          const orderResponse = await cfConfig.client.PGFetchOrder(lookupCfOrderId);
          if (orderResponse?.data?.order_status === 'PAID') {
            isPaid = true;
          }
        }
      } catch (err: any) {
        log.warn({ err: err?.message, lookupCfOrderId }, 'Cashfree PG fetch payment failed');
      }

      if (isPaid) {
        if (txn) {
          txn.status = 'success';
          txn.cfPaymentId = cfPaymentId;
          txn.gatewayPaymentId = cfPaymentId;
          await txn.save();
        }

        if (targetOrderId) {
          await notifyOrderService(
            targetOrderId,
            'paid',
            'confirmed',
            `Payment verified via Cashfree. Reference: ${cfPaymentId}`,
            cfPaymentId,
            'Cashfree',
          );
        }

        res.status(200).json({
          success: true,
          message: 'Payment verified and order confirmed successfully!',
          data: {
            status: 'PAID',
            orderId: targetOrderId,
            gateway: 'cashfree',
            paymentReference: cfPaymentId,
          },
        });
        return;
      }

      if (txn) {
        txn.status = 'failed';
        txn.failureReason = 'Cashfree payment not completed';
        await txn.save();
      }

      res.status(400).json({
        success: false,
        error: { code: 'PAYMENT_PENDING_OR_FAILED', message: 'Payment has not been completed or was declined.' },
      });
      return;
    }

    // ───────────────────────── 3. PAYTM VERIFICATION ─────────────────────────
    if (effectiveGateway === 'paytm') {
      const lookupPtmOrderId = ptmOrderId || txn?.paytmOrderId || txn?.gatewayOrderId;
      const config = getPaytmConfig();
      const ptmBankId = `PTM_TXN_${Date.now()}`;

      let isValid = true;
      if (!config.isPlaceholder && paytmChecksum) {
        isValid = verifyPaytmSignature({ orderId: lookupPtmOrderId }, paytmChecksum, config.merchantKey);
      }

      if (!isValid) {
        if (txn) {
          txn.status = 'failed';
          txn.failureReason = 'Invalid Paytm checksum';
          await txn.save();
        }
        res.status(400).json({
          success: false,
          error: { code: 'PAYMENT_FAILED', message: 'Paytm checksum verification failed.' },
        });
        return;
      }

      if (txn) {
        txn.status = 'success';
        txn.paytmBankTxnId = ptmBankId;
        txn.gatewayPaymentId = ptmBankId;
        await txn.save();
      }

      if (targetOrderId) {
        await notifyOrderService(
          targetOrderId,
          'paid',
          'confirmed',
          `Payment verified via Paytm. Reference: ${ptmBankId}`,
          ptmBankId,
          'Paytm',
        );
      }

      res.status(200).json({
        success: true,
        message: 'Payment verified and order confirmed successfully!',
        data: {
          status: 'PAID',
          orderId: targetOrderId,
          gateway: 'paytm',
          paymentReference: ptmBankId,
        },
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: { code: 'UNSUPPORTED_GATEWAY', message: `Unsupported gateway: ${effectiveGateway}` },
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/webhooks/razorpay ──────────────────────────────────────────
export async function razorpayWebhook(req: Request, res: Response, _next: NextFunction): Promise<void> {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const webhookSecret = getRazorpayWebhookSecret();

    if (!signature) {
      log.warn('Razorpay webhook missing x-razorpay-signature');
      res.status(400).json({ success: false, message: 'Missing signature header' });
      return;
    }

    const rawBody: Buffer | string = (req as any).rawBody || JSON.stringify(req.body);
    const isValid = verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret);

    if (!isValid) {
      log.warn('Razorpay webhook signature mismatch');
      res.status(400).json({ success: false, message: 'Invalid webhook signature' });
      return;
    }

    let event = req.body;
    if ((!event || Object.keys(event).length === 0) && (req as any).rawBody) {
      try {
        event = JSON.parse((req as any).rawBody.toString('utf8'));
      } catch {
        // ignore parse error if invalid JSON
      }
    } else if (typeof event === 'string') {
      try {
        event = JSON.parse(event);
      } catch {
        // ignore parse error if invalid JSON
      }
    }
    log.info({ event: event?.event }, 'Received valid Razorpay webhook event');

    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const paymentEntity = event.payload?.payment?.entity;
      const orderEntity = event.payload?.order?.entity;
      const rzpOrderId = paymentEntity?.order_id || orderEntity?.id;
      const rzpPaymentId = paymentEntity?.id;

      if (rzpOrderId) {
        const txn = await PaymentTransaction.findOne({
          $or: [{ razorpayOrderId: rzpOrderId }, { gatewayOrderId: rzpOrderId }],
        });

        if (txn) {
          if (txn.status !== 'success') {
            txn.status = 'success';
            txn.razorpayPaymentId = rzpPaymentId || txn.razorpayPaymentId;
            txn.webhookProcessed = true;
            await txn.save();

            await notifyOrderService(
              txn.orderId,
              'paid',
              'confirmed',
              `Payment confirmed via Razorpay Webhook (${event.event}). Payment ID: ${rzpPaymentId}`,
              rzpPaymentId,
              'Razorpay',
            );
          }
        }
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (err: any) {
    log.error({ err: err?.message }, 'Error processing Razorpay webhook');
    res.status(500).json({ success: false, message: 'Internal error processing webhook' });
  }
}
