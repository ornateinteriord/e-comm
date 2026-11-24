import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import {
  submitDeletionRequest,
  getMyDeletionRequest,
  cancelMyDeletionRequest,
  adminListDataDeletionRequests,
  adminExecuteDataDeletion,
  adminRejectDataDeletion,
} from '../controllers/privacy.controller.js';

const router = Router();

// Customer privacy endpoints (DPDP Act, 2023)
router.post('/privacy/deletion-request', requireAuth, submitDeletionRequest);
router.get('/privacy/deletion-request', requireAuth, getMyDeletionRequest);
router.delete('/privacy/deletion-request', requireAuth, cancelMyDeletionRequest);

// Admin compliance privacy endpoints
router.get(
  '/admin/privacy/deletion-requests',
  requireAuth,
  requireRole('support', 'admin', 'super_admin'),
  adminListDataDeletionRequests,
);
router.post(
  '/admin/privacy/deletion-requests/:id/execute',
  requireAuth,
  requireRole('admin', 'super_admin'),
  adminExecuteDataDeletion,
);
router.post(
  '/admin/privacy/deletion-requests/:id/reject',
  requireAuth,
  requireRole('admin', 'super_admin'),
  adminRejectDataDeletion,
);

export default router;
