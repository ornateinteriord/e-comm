export type PaymentGatewayType = 'razorpay' | 'cashfree' | 'paytm';

export interface PaymentGatewayConfig {
  activeGateway: PaymentGatewayType;
  razorpay?: { keyId: string };
  cashfree?: { appId: string; environment: 'production' | 'sandbox' };
  paytm?: { mid: string; environment: 'stage' | 'prod' };
}

/**
 * Dynamically injects an external script tag into the DOM idempotently.
 * Returns true if loaded successfully (or already loaded), false otherwise.
 */
export function loadScript(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(false);
    if (document.querySelector(`script[src="${src}"]`)) return resolve(true);
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
