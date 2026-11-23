import { Router } from 'express';
import {
  createPaymentIntent,
  verifyPayment,
  adminListPayments,
} from '../controllers/payment.controller.js';
import {
  createCashfreeOrder,
  verifyCashfreePayment,
  cashfreeWebhook,
} from '../controllers/cashfree.controller.js';
import {
  getPaymentGatewayConfig,
} from '../controllers/gateway-config.controller.js';
import {
  createUnifiedPaymentOrder,
  verifyUnifiedPayment,
  razorpayWebhook,
} from '../controllers/unified-payment.controller.js';
import {
  paytmWebhook,
} from '../controllers/paytm.controller.js';
import { attachUser, requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router: Router = Router();

// ── Gateway Public Configuration (client-safe, no secrets) ─────
router.get('/payments/config', getPaymentGatewayConfig);
router.get('/config', getPaymentGatewayConfig);

// ── Webhook endpoints (no auth) ────────────────────────────────
router.post('/webhooks/razorpay', razorpayWebhook);
router.post('/webhooks/cashfree', cashfreeWebhook);
router.post('/webhooks/paytm', paytmWebhook);

// ── Dynamic Unified Payment Endpoints ──────────────────────────
router.post('/payments/create-order', attachUser, createUnifiedPaymentOrder);
router.post('/create-order', attachUser, createUnifiedPaymentOrder);
router.post('/payments/verify', verifyUnifiedPayment);
router.post('/verify-payment', verifyUnifiedPayment);

// ── Cashfree routes (retained for backward compatibility) ───────
router.post('/payments/cashfree/create-order', attachUser, createCashfreeOrder);
router.post('/cashfree/create-order', attachUser, createCashfreeOrder);
router.post('/payments/cashfree/verify', verifyCashfreePayment);
router.post('/cashfree/verify', verifyCashfreePayment);

// ── Legacy routes (retained for backward compatibility) ─────────
router.post('/payments/create-intent', attachUser, createPaymentIntent);
router.post('/create-intent', attachUser, createPaymentIntent);
router.post('/verify', verifyPayment);

// ── Admin payments ──────────────────────────────────────────────
router.get('/admin/payments', attachUser, requireAuth, requireRole('finance_manager', 'admin', 'super_admin'), adminListPayments);
router.get('/payments/admin/payments', attachUser, requireAuth, requireRole('finance_manager', 'admin', 'super_admin'), adminListPayments);

export default router;
