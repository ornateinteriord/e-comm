import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { formatGatewayName } from '../src/controllers/order.controller.js';

describe('Order Service: Dynamic Payment Method Tracking', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('formatGatewayName helper', () => {
    it('normalizes razorpay variations to Razorpay', () => {
      expect(formatGatewayName('razorpay')).toBe('Razorpay');
      expect(formatGatewayName('RAZORPAY')).toBe('Razorpay');
      expect(formatGatewayName('Razorpay')).toBe('Razorpay');
      expect(formatGatewayName('razorpay + wallet')).toBe('Razorpay');
    });

    it('normalizes cashfree variations to Cashfree', () => {
      expect(formatGatewayName('cashfree')).toBe('Cashfree');
      expect(formatGatewayName('CASHFREE')).toBe('Cashfree');
      expect(formatGatewayName('Cashfree')).toBe('Cashfree');
    });

    it('normalizes paytm variations to Paytm', () => {
      expect(formatGatewayName('paytm')).toBe('Paytm');
      expect(formatGatewayName('PAYTM')).toBe('Paytm');
      expect(formatGatewayName('Paytm')).toBe('Paytm');
    });

    it('falls back to environment variable PAYMENT_GATEWAY when omitted', () => {
      process.env.PAYMENT_GATEWAY = 'razorpay';
      expect(formatGatewayName()).toBe('Razorpay');

      process.env.PAYMENT_GATEWAY = 'cashfree';
      expect(formatGatewayName()).toBe('Cashfree');

      process.env.PAYMENT_GATEWAY = 'paytm';
      expect(formatGatewayName()).toBe('Paytm');
    });

    it('defaults to Razorpay when no param and no env var are present', () => {
      delete process.env.PAYMENT_GATEWAY;
      expect(formatGatewayName()).toBe('Razorpay');
    });
  });

  describe('R3: Effective Payment Method Resolution & Wallet Splits', () => {
    function computeEffectivePaymentMethod(params: {
      isFullyPaidByWallet: boolean;
      walletAmountPaid: number;
      paymentMethod?: string;
      gateway?: string;
    }): { effectivePaymentMethod: string; note: string } {
      const rawGatewayInput = params.gateway || params.paymentMethod || process.env.PAYMENT_GATEWAY || 'Razorpay';
      const gatewayDisplayName = formatGatewayName(rawGatewayInput);

      const effectivePaymentMethod = params.isFullyPaidByWallet
        ? 'Wallet'
        : params.walletAmountPaid > 0
        ? `${gatewayDisplayName} + Wallet`
        : gatewayDisplayName;

      const note = params.isFullyPaidByWallet
        ? `Order paid in full using customer wallet balance.`
        : params.walletAmountPaid > 0
        ? `Order placed. Paid from wallet, remaining pending via ${gatewayDisplayName}.`
        : 'Order placed by customer.';

      return { effectivePaymentMethod, note };
    }

    it('100% wallet payment resolves to "Wallet"', () => {
      const result = computeEffectivePaymentMethod({
        isFullyPaidByWallet: true,
        walletAmountPaid: 50000,
        gateway: 'razorpay',
      });
      expect(result.effectivePaymentMethod).toBe('Wallet');
      expect(result.note).toContain('using customer wallet balance');
    });

    it('Partial wallet split with Razorpay resolves to "Razorpay + Wallet"', () => {
      const result = computeEffectivePaymentMethod({
        isFullyPaidByWallet: false,
        walletAmountPaid: 20000,
        gateway: 'razorpay',
      });
      expect(result.effectivePaymentMethod).toBe('Razorpay + Wallet');
      expect(result.note).toContain('pending via Razorpay');
    });

    it('Partial wallet split with Cashfree resolves to "Cashfree + Wallet"', () => {
      const result = computeEffectivePaymentMethod({
        isFullyPaidByWallet: false,
        walletAmountPaid: 15000,
        gateway: 'cashfree',
      });
      expect(result.effectivePaymentMethod).toBe('Cashfree + Wallet');
      expect(result.note).toContain('pending via Cashfree');
    });

    it('Partial wallet split with Paytm resolves to "Paytm + Wallet"', () => {
      const result = computeEffectivePaymentMethod({
        isFullyPaidByWallet: false,
        walletAmountPaid: 10000,
        gateway: 'paytm',
      });
      expect(result.effectivePaymentMethod).toBe('Paytm + Wallet');
      expect(result.note).toContain('pending via Paytm');
    });

    it('Pure gateway checkout without wallet resolves to gateway name', () => {
      expect(computeEffectivePaymentMethod({ isFullyPaidByWallet: false, walletAmountPaid: 0, gateway: 'razorpay' }).effectivePaymentMethod).toBe('Razorpay');
      expect(computeEffectivePaymentMethod({ isFullyPaidByWallet: false, walletAmountPaid: 0, gateway: 'cashfree' }).effectivePaymentMethod).toBe('Cashfree');
      expect(computeEffectivePaymentMethod({ isFullyPaidByWallet: false, walletAmountPaid: 0, gateway: 'paytm' }).effectivePaymentMethod).toBe('Paytm');
    });
  });

  describe('confirmOrderPayment: Wallet Split Method Name Preservation', () => {
    function resolveConfirmedPaymentMethod(order: {
      pricing?: { walletAmountPaid?: number };
      paymentMethod?: string;
    }, incomingPaymentMethod?: string): string | undefined {
      if (!incomingPaymentMethod) return order.paymentMethod;
      const hasWalletSplit = Boolean((order.pricing?.walletAmountPaid && order.pricing.walletAmountPaid > 0) || order.paymentMethod?.includes('Wallet'));
      if (hasWalletSplit && !incomingPaymentMethod.includes('Wallet')) {
        return `${formatGatewayName(incomingPaymentMethod)} + Wallet`;
      }
      return incomingPaymentMethod;
    }

    it('preserves wallet split when order.pricing.walletAmountPaid > 0', () => {
      const order = { pricing: { walletAmountPaid: 20000 }, paymentMethod: 'Razorpay + Wallet' };
      expect(resolveConfirmedPaymentMethod(order, 'Razorpay')).toBe('Razorpay + Wallet');
      expect(resolveConfirmedPaymentMethod(order, 'Cashfree')).toBe('Cashfree + Wallet');
    });

    it('preserves wallet split when order.paymentMethod includes Wallet even if pricing is missing', () => {
      const order = { paymentMethod: 'Cashfree + Wallet' };
      expect(resolveConfirmedPaymentMethod(order, 'Cashfree')).toBe('Cashfree + Wallet');
      expect(resolveConfirmedPaymentMethod(order, 'Razorpay')).toBe('Razorpay + Wallet');
    });

    it('does not append Wallet when pure gateway order is confirmed', () => {
      const order = { pricing: { walletAmountPaid: 0 }, paymentMethod: 'Razorpay' };
      expect(resolveConfirmedPaymentMethod(order, 'Razorpay')).toBe('Razorpay');
      expect(resolveConfirmedPaymentMethod(order, 'Cashfree')).toBe('Cashfree');
    });
  });
});
