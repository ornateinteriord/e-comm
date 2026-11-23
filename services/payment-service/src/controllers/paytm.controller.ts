import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import axios from 'axios';
import { PaymentTransaction } from '../models/payment.model.js';
import { createLogger } from '@ornate/logger';

const log = createLogger('paytm-controller');

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL ?? 'http://localhost:4006';

export function getPaytmConfig() {
  const mid = (process.env.PAYTM_MID ?? 'YOUR_PAYTM_MID').trim();
  const merchantKey = (process.env.PAYTM_MERCHANT_KEY ?? 'YOUR_PAYTM_KEY').trim();
  const website = (process.env.PAYTM_WEBSITE ?? 'DEFAULT').trim();
  const envSetting = (process.env.PAYTM_ENV ?? 'STAGE').toUpperCase().trim();
  const isProd = envSetting === 'PROD' || envSetting === 'PRODUCTION';

  const isPlaceholder = !mid || mid === 'YOUR_PAYTM_MID' || !merchantKey || merchantKey === 'YOUR_PAYTM_KEY';

  return {
    mid,
    merchantKey,
    website,
    environment: isProd ? ('prod' as const) : ('stage' as const),
    isProd,
    isPlaceholder,
    baseUrl: isProd
      ? 'https://securegw.paytm.in'
      : 'https://securegw-stage.paytm.in',
  };
}

/**
 * Generate HMAC-SHA256 checksum for Paytm payload
 */
export function generatePaytmChecksum(data: string | object, merchantKey: string): string {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHmac('sha256', merchantKey).update(content).digest('hex');
}

/**
 * Verify HMAC-SHA256 checksum for Paytm payload
 */
export function verifyPaytmSignature(data: string | object, checksum: string, merchantKey: string): boolean {
  if (!checksum || !merchantKey) return false;
  const expected = generatePaytmChecksum(data, merchantKey);
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(checksum, 'hex'));
}

/**
 * Initiate Paytm Transaction token
 */
export async function initiatePaytmTransaction(params: {
  orderId: string;
  orderNumber: string;
  amountPaise: number;
  customerId?: string;
  customerEmail?: string;
  customerPhone?: string;
  returnUrl?: string;
}): Promise<{
  paytmOrderId: string;
  txnToken: string;
  mid: string;
  amount: number;
  environment: 'stage' | 'prod';
  isMock: boolean;
}> {
  const config = getPaytmConfig();
  const paytmOrderId = `PTM_${Date.now()}_${params.orderNumber || params.orderId}`;
  const amountInRupees = (params.amountPaise / 100).toFixed(2);

  if (config.isPlaceholder) {
    log.info({ paytmOrderId }, 'Using placeholder/stage Paytm mock token initiation');
    const mockToken = `ptm_mock_token_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    return {
      paytmOrderId,
      txnToken: mockToken,
      mid: config.mid,
      amount: params.amountPaise,
      environment: config.environment,
      isMock: true,
    };
  }

  const paytmParams = {
    body: {
      requestType: 'Payment',
      mid: config.mid,
      websiteName: config.website,
      orderId: paytmOrderId,
      callbackUrl: params.returnUrl || `${process.env.FRONTEND_URL ?? 'https://www.eshopy.biz'}/payment/return?order_id=${params.orderId}&paytm_order_id=${paytmOrderId}`,
      txnAmount: {
        value: amountInRupees,
        currency: 'INR',
      },
      userInfo: {
        custId: params.customerId || params.customerEmail || 'CUST_001',
      },
    },
    head: {
      signature: generatePaytmChecksum(paytmParamsBody(config.mid, config.website, paytmOrderId, amountInRupees, params.customerId || 'CUST_001', params.returnUrl), config.merchantKey),
    },
  };

  try {
    const url = `${config.baseUrl}/theia/api/v1/initiateTransaction?mid=${encodeURIComponent(config.mid)}&orderId=${encodeURIComponent(paytmOrderId)}`;
    const response = await axios.post(url, paytmParams, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    const txnToken = response.data?.body?.txnToken;
    if (txnToken) {
      return {
        paytmOrderId,
        txnToken,
        mid: config.mid,
        amount: params.amountPaise,
        environment: config.environment,
        isMock: false,
      };
    }

    log.warn({ data: response.data }, 'Paytm API returned without txnToken, falling back to mock token');
  } catch (err: any) {
    log.error({ err: err?.message }, 'Paytm initiateTransaction network error, falling back to mock token');
  }

  const fallbackToken = `ptm_mock_token_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  return {
    paytmOrderId,
    txnToken: fallbackToken,
    mid: config.mid,
    amount: params.amountPaise,
    environment: config.environment,
    isMock: true,
  };
}

function paytmParamsBody(mid: string, website: string, orderId: string, amount: string, custId: string, callbackUrl?: string) {
  return {
    requestType: 'Payment',
    mid,
    websiteName: website,
    orderId,
    callbackUrl: callbackUrl || '',
    txnAmount: {
      value: amount,
      currency: 'INR',
    },
    userInfo: {
      custId,
    },
  };
}

/**
 * Handle Paytm Webhook: POST /api/v1/webhooks/paytm
 */
export async function paytmWebhook(req: Request, res: Response, _next: NextFunction): Promise<void> {
  try {
    let payload = req.body || {};
    if ((!payload || Object.keys(payload).length === 0) && (req as any).rawBody) {
      try {
        payload = JSON.parse((req as any).rawBody.toString('utf8'));
      } catch {
        // ignore parse error
      }
    } else if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        // ignore parse error
      }
    }
    const { ORDERID, STATUS, TXNID, CHECKSUMHASH } = payload;
    const config = getPaytmConfig();

    log.info({ ORDERID, STATUS, TXNID }, 'Received Paytm webhook');

    if (!ORDERID) {
      res.status(400).json({ success: false, message: 'Missing ORDERID in Paytm webhook payload' });
      return;
    }

    // Verify checksum if not placeholder
    if (!config.isPlaceholder && CHECKSUMHASH) {
      const payloadCopy = { ...payload };
      delete payloadCopy.CHECKSUMHASH;
      const isValid = verifyPaytmSignature(payloadCopy, CHECKSUMHASH, config.merchantKey);
      if (!isValid) {
        log.warn({ ORDERID }, 'Paytm webhook checksum verification failed');
        res.status(400).json({ success: false, message: 'Invalid Paytm checksum' });
        return;
      }
    }

    const txn = await PaymentTransaction.findOne({
      $or: [{ paytmOrderId: ORDERID }, { orderNumber: ORDERID }, { gatewayOrderId: ORDERID }],
    });

    if (txn) {
      if (STATUS === 'TXN_SUCCESS') {
        txn.status = 'success';
        txn.paytmBankTxnId = TXNID;
        txn.webhookProcessed = true;
        await txn.save();

        await axios.patch(`${ORDER_SERVICE_URL}/api/v1/orders/${txn.orderId}/payment-confirmation`, {
          paymentStatus: 'paid',
          fulfilmentStatus: 'confirmed',
          paymentReference: TXNID || ORDERID,
          paymentMethod: 'Paytm',
          note: `Payment confirmed via Paytm Webhook. Bank Ref: ${TXNID}`,
        }).catch((err) => log.error({ err, orderId: txn.orderId }, 'Failed to notify order service'));
      } else {
        txn.status = 'failed';
        txn.failureReason = STATUS || 'Paytm transaction failed';
        txn.webhookProcessed = true;
        await txn.save();
      }
    }

    res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (err: any) {
    log.error({ err: err?.message }, 'Error processing Paytm webhook');
    res.status(500).json({ success: false, message: 'Internal error processing Paytm webhook' });
  }
}
