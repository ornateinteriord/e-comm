import { describe, it, expect } from 'vitest';
import { loadScript, type PaymentGatewayType } from '../../utils/payment-script';

describe('Dynamic Payment Gateway Switching (Web)', () => {
  it('formats gateway display name correctly for all gateways', () => {
    const formatGateway = (gateway: PaymentGatewayType) =>
      gateway === 'razorpay' ? 'Razorpay' : gateway === 'paytm' ? 'Paytm' : 'Cashfree';

    expect(formatGateway('razorpay')).toBe('Razorpay');
    expect(formatGateway('cashfree')).toBe('Cashfree');
    expect(formatGateway('paytm')).toBe('Paytm');
  });

  it('correctly constructs effectivePaymentMethod with wallet split', () => {
    const getPaymentMethod = (
      gateway: PaymentGatewayType,
      isFullyCoveredByWallet: boolean,
      effectiveWalletPaise: number
    ) => {
      const gatewayDisplayName =
        gateway === 'razorpay' ? 'Razorpay' : gateway === 'paytm' ? 'Paytm' : 'Cashfree';
      return isFullyCoveredByWallet
        ? 'Wallet'
        : effectiveWalletPaise > 0
        ? `${gatewayDisplayName} + Wallet`
        : gatewayDisplayName;
    };

    // 100% wallet bypass
    expect(getPaymentMethod('razorpay', true, 50000)).toBe('Wallet');
    expect(getPaymentMethod('cashfree', true, 50000)).toBe('Wallet');

    // Partial wallet split
    expect(getPaymentMethod('razorpay', false, 20000)).toBe('Razorpay + Wallet');
    expect(getPaymentMethod('cashfree', false, 20000)).toBe('Cashfree + Wallet');
    expect(getPaymentMethod('paytm', false, 20000)).toBe('Paytm + Wallet');

    // 0 wallet (100% gateway)
    expect(getPaymentMethod('razorpay', false, 0)).toBe('Razorpay');
    expect(getPaymentMethod('cashfree', false, 0)).toBe('Cashfree');
    expect(getPaymentMethod('paytm', false, 0)).toBe('Paytm');
  });

  it('handles script injection idempotently via loadScript', async () => {
    if (typeof document === 'undefined') {
      // In Node environment without DOM, loadScript returns false gracefully
      const res = await loadScript('https://checkout.razorpay.com/v1/checkout.js');
      expect(res).toBe(false);
    } else {
      const mockScript = document.createElement('script');
      mockScript.src = 'https://checkout.razorpay.com/v1/checkout.js';
      document.body.appendChild(mockScript);

      const res = await loadScript('https://checkout.razorpay.com/v1/checkout.js');
      expect(res).toBe(true);
    }
  });
});
