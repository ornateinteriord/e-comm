import { Router } from 'express';
import {
  register,
  login,
  logout,
  refresh,
  getMe,
  forgotPassword,
  resetPassword,
  listUsers,
  updateUserRole,
  getAuditLogs,
  verifyReferral,
} from '../controllers/auth.controller.js';
import { attachUser, requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../schemas/auth.schema.js';
import rateLimit from 'express-rate-limit';

const router: Router = Router();

// Strict rate limits for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many auth attempts.' } },
  standardHeaders: true,
  legacyHeaders: false,
});

// Referral verification route (open to public during signup)
router.get('/verify-referral', verifyReferral);
router.post('/verify-referral', verifyReferral);

// Public auth routes
router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPassword);

// Authenticated user routes
router.get('/me', attachUser, requireAuth, getMe);

// Admin routes
router.get('/admin/users', attachUser, requireRole('admin'), listUsers);
router.patch('/admin/users/:id/role', attachUser, requireRole('super_admin'), updateUserRole);
router.get('/admin/audit-logs', attachUser, requireRole('admin'), getAuditLogs);

export default router;
