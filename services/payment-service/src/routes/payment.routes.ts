import { Router } from 'express';
import {
  createPaymentIntent,
  verifyPayment,
  adminListPayments,
} from '../controllers/payment.controller.js';
import { attachUser, requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

router.use(attachUser);

router.post('/create-intent', createPaymentIntent);
router.post('/verify', verifyPayment);

// Admin payments
router.get('/admin/payments', requireAuth, requireRole('finance_manager', 'admin', 'super_admin'), adminListPayments);

export default router;
