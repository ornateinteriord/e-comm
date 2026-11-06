import { Router } from 'express';
import {
  verifyStoreReferral,
  getAvailableCategories,
  registerStore,
  loginStore,
  getStoreMe,
  updateStoreMe,
  adminListStores,
  adminCreateStore,
  adminUpdateStoreStatus,
  adminDeleteStore,
} from '../controllers/store.controller.js';
import { attachUser, requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router: Router = Router();

// Public store endpoints
router.get('/api/v1/store/verify-referral', verifyStoreReferral);
router.get('/store/verify-referral', verifyStoreReferral);

router.get('/api/v1/store/categories/available', getAvailableCategories);
router.get('/store/categories/available', getAvailableCategories);

router.post('/api/v1/store/register', registerStore);
router.post('/store/register', registerStore);

router.post('/api/v1/store/login', loginStore);
router.post('/store/login', loginStore);

// Authenticated store profile endpoints
router.get('/api/v1/store/me', attachUser, requireAuth, getStoreMe);
router.get('/store/me', attachUser, requireAuth, getStoreMe);

router.patch('/api/v1/store/me', attachUser, requireAuth, updateStoreMe);
router.patch('/store/me', attachUser, requireAuth, updateStoreMe);

// Admin store management endpoints
router.get('/api/v1/admin/stores', attachUser, requireRole('admin'), adminListStores);
router.get('/admin/stores', attachUser, requireRole('admin'), adminListStores);

router.post('/api/v1/admin/stores', attachUser, requireRole('admin'), adminCreateStore);
router.post('/admin/stores', attachUser, requireRole('admin'), adminCreateStore);

router.patch('/api/v1/admin/stores/:id/status', attachUser, requireRole('admin'), adminUpdateStoreStatus);
router.patch('/admin/stores/:id/status', attachUser, requireRole('admin'), adminUpdateStoreStatus);

router.delete('/api/v1/admin/stores/:id', attachUser, requireRole('admin'), adminDeleteStore);
router.delete('/admin/stores/:id', attachUser, requireRole('admin'), adminDeleteStore);

export default router;

