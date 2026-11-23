import { Request, Response } from 'express';
import { createLogger } from '@ornate/logger';

const log = createLogger('gateway-config-controller');

export interface GatewayPublicConfig {
  activeGateway: 'razorpay' | 'cashfree' | 'paytm';
  razorpay: {
    keyId: string;
  };
  cashfree: {
    appId: string;
    environment: 'production' | 'sandbox';
  };
  paytm: {
    mid: string;
    environment: 'stage' | 'prod';
  };
}

export function resolveGatewayConfig(): GatewayPublicConfig {
  const rawGateway = (process.env.PAYMENT_GATEWAY || 'razorpay').toLowerCase().trim();
  const activeGateway: 'razorpay' | 'cashfree' | 'paytm' =
    rawGateway === 'cashfree'
      ? 'cashfree'
      : rawGateway === 'paytm'
      ? 'paytm'
      : 'razorpay';

  const cfEnv = (process.env.CASHFREE_ENV || 'SANDBOX').toUpperCase();
  const cfAppId = (process.env.CASHFREE_APP_ID || '').trim();
  const cfIsProd = cfEnv === 'PRODUCTION' && !cfAppId.startsWith('TEST');

  const paytmEnv = (process.env.PAYTM_ENV || 'STAGE').toUpperCase();
  const paytmIsProd = paytmEnv === 'PROD' || paytmEnv === 'PRODUCTION';

  return {
    activeGateway,
    razorpay: {
      keyId: (process.env.RAZORPAY_KEY_ID || '').trim(),
    },
    cashfree: {
      appId: cfAppId,
      environment: cfIsProd ? 'production' : 'sandbox',
    },
    paytm: {
      mid: (process.env.PAYTM_MID || '').trim(),
      environment: paytmIsProd ? 'prod' : 'stage',
    },
  };
}

/**
 * GET /api/v1/payments/config
 * Exposes non-secret public gateway client parameters for web checkout.
 * SECURITY: NEVER expose secrets (RAZORPAY_KEY_SECRET, CASHFREE_SECRET_KEY, PAYTM_MERCHANT_KEY).
 */
export async function getPaymentGatewayConfig(req: Request, res: Response): Promise<void> {
  try {
    const config = resolveGatewayConfig();
    log.info(`Exposing gateway config. Active gateway: ${config.activeGateway}`);
    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    log.error({ error }, 'Failed to resolve payment gateway config');
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment gateway configuration',
    });
  }
}

export const getGatewayConfig = getPaymentGatewayConfig;
