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
import { attachUser, requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router: Router = Router();

router.use(attachUser);

// ── Cashfree routes (primary gateway) ──────────────────────────
router.post('/cashfree/create-order', createCashfreeOrder);
router.post('/cashfree/verify', verifyCashfreePayment);

// ── Legacy routes (kept for compatibility) ──────────────────────
router.post('/create-intent', createPaymentIntent);
router.post('/verify', verifyPayment);

// ── Admin payments ──────────────────────────────────────────────
router.get('/admin/payments', requireAuth, requireRole('finance_manager', 'admin', 'super_admin'), adminListPayments);

export default router;
