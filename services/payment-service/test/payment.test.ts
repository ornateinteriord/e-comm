import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { resolveGatewayConfig } from '../src/controllers/gateway-config.controller.js';
import {
  verifyRazorpaySignature,
  verifyRazorpayWebhookSignature,
  resolveActiveGateway,
} from '../src/controllers/unified-payment.controller.js';
import {
  generatePaytmChecksum,
  verifyPaytmSignature,
  getPaytmConfig,
} from '../src/controllers/paytm.controller.js';

describe('Payment Service: Multi-Gateway Unit Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('R1 & R2: Dynamic Gateway Config & Security Invariants', () => {
    it('returns activeGateway matching configured PAYMENT_GATEWAY=razorpay', () => {
      process.env.PAYMENT_GATEWAY = 'razorpay';
      process.env.RAZORPAY_KEY_ID = 'rzp_live_U20h2abCkEGZBi';
      process.env.RAZORPAY_KEY_SECRET = 'OnrRvbaYvFMbhuaYGCuaSl7E';

      const config = resolveGatewayConfig();
      expect(config.activeGateway).toBe('razorpay');
      expect(config.razorpay.keyId).toBe('rzp_live_U20h2abCkEGZBi');
    });

    it('returns activeGateway matching configured PAYMENT_GATEWAY=cashfree', () => {
      process.env.PAYMENT_GATEWAY = 'cashfree';
      process.env.CASHFREE_APP_ID = 'TEST1089421775b25afe7f2e6158714871249801';
      process.env.CASHFREE_ENV = 'SANDBOX';

      const config = resolveGatewayConfig();
      expect(config.activeGateway).toBe('cashfree');
      expect(config.cashfree.appId).toBe('TEST1089421775b25afe7f2e6158714871249801');
      expect(config.cashfree.environment).toBe('sandbox');
    });

    it('returns activeGateway matching configured PAYMENT_GATEWAY=paytm', () => {
      process.env.PAYMENT_GATEWAY = 'paytm';
      process.env.PAYTM_MID = 'YOUR_PAYTM_MID';
      process.env.PAYTM_ENV = 'STAGE';

      const config = resolveGatewayConfig();
      expect(config.activeGateway).toBe('paytm');
      expect(config.paytm.mid).toBe('YOUR_PAYTM_MID');
      expect(config.paytm.environment).toBe('stage');
    });

    it('SECURITY CRITICAL: NEVER leaks private secrets in config response', () => {
      process.env.RAZORPAY_KEY_SECRET = 'SUPER_SECRET_RAZORPAY_KEY';
      process.env.CASHFREE_SECRET_KEY = 'SUPER_SECRET_CASHFREE_KEY';
      process.env.PAYTM_MERCHANT_KEY = 'SUPER_SECRET_PAYTM_KEY';

      const config = resolveGatewayConfig();
      const stringified = JSON.stringify(config);

      expect(stringified).not.toContain('SUPER_SECRET_RAZORPAY_KEY');
      expect(stringified).not.toContain('SUPER_SECRET_CASHFREE_KEY');
      expect(stringified).not.toContain('SUPER_SECRET_PAYTM_KEY');
      expect(stringified).not.toContain('secret');
      expect(stringified).not.toContain('keySecret');
      expect(stringified).not.toContain('merchantKey');
    });
  });

  describe('R2: Razorpay HMAC-SHA256 Signature Verification', () => {
    const liveSecret = 'OnrRvbaYvFMbhuaYGCuaSl7E';
    const testOrderId = 'order_DAvD8z4qWf1234';
    const testPaymentId = 'pay_DAvD8z4qWf5678';

    it('authenticates genuine HMAC-SHA256 signature generated with live key secret', () => {
      const genuineSignature = crypto
        .createHmac('sha256', liveSecret)
        .update(`${testOrderId}|${testPaymentId}`)
        .digest('hex');

      const isValid = verifyRazorpaySignature(testOrderId, testPaymentId, genuineSignature, liveSecret);
      expect(isValid).toBe(true);
    });

    it('rejects tampered signature', () => {
      const tamperedSignature = 'a'.repeat(64);
      const isValid = verifyRazorpaySignature(testOrderId, testPaymentId, tamperedSignature, liveSecret);
      expect(isValid).toBe(false);
    });

    it('rejects signature if paymentId is altered', () => {
      const genuineSignature = crypto
        .createHmac('sha256', liveSecret)
        .update(`${testOrderId}|${testPaymentId}`)
        .digest('hex');

      const isValid = verifyRazorpaySignature(testOrderId, 'pay_tampered_9999', genuineSignature, liveSecret);
      expect(isValid).toBe(false);
    });

    it('rejects signature if orderId is altered', () => {
      const genuineSignature = crypto
        .createHmac('sha256', liveSecret)
        .update(`${testOrderId}|${testPaymentId}`)
        .digest('hex');

      const isValid = verifyRazorpaySignature('order_altered_0000', testPaymentId, genuineSignature, liveSecret);
      expect(isValid).toBe(false);
    });

    it('returns false for empty or missing inputs gracefully', () => {
      expect(verifyRazorpaySignature('', testPaymentId, 'sig', liveSecret)).toBe(false);
      expect(verifyRazorpaySignature(testOrderId, '', 'sig', liveSecret)).toBe(false);
      expect(verifyRazorpaySignature(testOrderId, testPaymentId, '', liveSecret)).toBe(false);
      expect(verifyRazorpaySignature(testOrderId, testPaymentId, 'sig', '')).toBe(false);
    });

    it('verifies webhook HMAC-SHA256 signatures with raw body', () => {
      const webhookSecret = 'eshopy_rzp_webhook_secret_2026';
      const rawPayload = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: testPaymentId } } } });
      const webhookSig = crypto.createHmac('sha256', webhookSecret).update(rawPayload).digest('hex');

      expect(verifyRazorpayWebhookSignature(rawPayload, webhookSig, webhookSecret)).toBe(true);
      expect(verifyRazorpayWebhookSignature(rawPayload, 'invalid_sig', webhookSecret)).toBe(false);
    });
  });

  describe('R2: Paytm Checksum and Config', () => {
    it('generates and validates authentic Paytm checksum', () => {
      const merchantKey = 'TEST_PAYTM_KEY_1234';
      const payload = { orderId: 'PTM_ORDER_001', amount: '499.00' };

      const checksum = generatePaytmChecksum(payload, merchantKey);
      expect(checksum).toHaveLength(64);

      const isValid = verifyPaytmSignature(payload, checksum, merchantKey);
      expect(isValid).toBe(true);

      const isInvalid = verifyPaytmSignature(payload, 'b'.repeat(64), merchantKey);
      expect(isInvalid).toBe(false);
    });

    it('correctly flags placeholder credentials for graceful staging fallback', () => {
      process.env.PAYTM_MID = 'YOUR_PAYTM_MID';
      process.env.PAYTM_MERCHANT_KEY = 'YOUR_PAYTM_KEY';
      const config = getPaytmConfig();
      expect(config.isPlaceholder).toBe(true);

      process.env.PAYTM_MID = 'REAL_MID_987654';
      process.env.PAYTM_MERCHANT_KEY = 'REAL_KEY_123456';
      const realConfig = getPaytmConfig();
      expect(realConfig.isPlaceholder).toBe(false);
    });
  });

  describe('R2: Gateway Resolution', () => {
    it('resolves active gateway with fallback precedence', () => {
      expect(resolveActiveGateway('cashfree')).toBe('cashfree');
      expect(resolveActiveGateway('paytm')).toBe('paytm');
      expect(resolveActiveGateway('razorpay')).toBe('razorpay');

      delete process.env.PAYMENT_GATEWAY;
      expect(resolveActiveGateway()).toBe('razorpay');

      process.env.PAYMENT_GATEWAY = 'cashfree';
      expect(resolveActiveGateway()).toBe('cashfree');
    });
  });
});
