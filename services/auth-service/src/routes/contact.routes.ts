import { Router } from 'express';
import {
  submitContactMessage,
  listContactMessages,
  updateContactMessage,
  deleteContactMessage,
} from '../controllers/contact.controller.js';
import { attachUser, requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router: Router = Router();

// Public submission route
router.post('/contact', submitContactMessage);
router.post('/api/v1/contact', submitContactMessage);

// Admin routes
router.get(
  '/admin/contact',
  attachUser,
  requireAuth,
  requireRole('support', 'admin', 'super_admin'),
  listContactMessages,
);
router.get(
  '/api/v1/admin/contact',
  attachUser,
  requireAuth,
  requireRole('support', 'admin', 'super_admin'),
  listContactMessages,
);

router.patch(
  '/admin/contact/:id',
  attachUser,
  requireAuth,
  requireRole('support', 'admin', 'super_admin'),
  updateContactMessage,
);
router.patch(
  '/api/v1/admin/contact/:id',
  attachUser,
  requireAuth,
  requireRole('support', 'admin', 'super_admin'),
  updateContactMessage,
);

router.delete(
  '/admin/contact/:id',
  attachUser,
  requireAuth,
  requireRole('admin', 'super_admin'),
  deleteContactMessage,
);
router.delete(
  '/api/v1/admin/contact/:id',
  attachUser,
  requireAuth,
  requireRole('admin', 'super_admin'),
  deleteContactMessage,
);

export default router;

