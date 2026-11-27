import { Router } from 'express';
import {
  verifySellerReferral,
  getAvailableCategories,
  registerSeller,
  loginSeller,
  refreshSeller,
  getSellerMe,
  updateSellerMe,
  adminListSellers,
  adminCreateSeller,
  adminUpdateSellerStatus,
  adminDeleteSeller,
  adminResetSellerPassword,
} from '../controllers/seller.controller.js';
import { attachUser, requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router: Router = Router();

// Public seller endpoints
router.get('/api/v1/seller/verify-referral', verifySellerReferral);
router.get('/seller/verify-referral', verifySellerReferral);
router.get('/api/v1/store/verify-referral', verifySellerReferral);
router.get('/store/verify-referral', verifySellerReferral);

router.get('/api/v1/seller/categories/available', getAvailableCategories);
router.get('/seller/categories/available', getAvailableCategories);
router.get('/api/v1/store/categories/available', getAvailableCategories);
router.get('/store/categories/available', getAvailableCategories);

router.post('/api/v1/seller/register', registerSeller);
router.post('/seller/register', registerSeller);
router.post('/api/v1/store/register', registerSeller);
router.post('/store/register', registerSeller);

router.post('/api/v1/seller/login', loginSeller);
router.post('/seller/login', loginSeller);
router.post('/api/v1/store/login', loginSeller);
router.post('/store/login', loginSeller);

router.post('/api/v1/seller/refresh', refreshSeller);
router.post('/seller/refresh', refreshSeller);
router.post('/api/v1/store/refresh', refreshSeller);
router.post('/store/refresh', refreshSeller);

// Authenticated seller profile endpoints
router.get('/api/v1/seller/me', attachUser, requireAuth, getSellerMe);
router.get('/seller/me', attachUser, requireAuth, getSellerMe);
router.get('/api/v1/store/me', attachUser, requireAuth, getSellerMe);
router.get('/store/me', attachUser, requireAuth, getSellerMe);

router.patch('/api/v1/seller/me', attachUser, requireAuth, updateSellerMe);
router.patch('/seller/me', attachUser, requireAuth, updateSellerMe);
router.patch('/api/v1/store/me', attachUser, requireAuth, updateSellerMe);
router.patch('/store/me', attachUser, requireAuth, updateSellerMe);

// Admin seller management endpoints
router.get('/api/v1/admin/sellers', attachUser, requireRole('admin'), adminListSellers);
router.get('/admin/sellers', attachUser, requireRole('admin'), adminListSellers);
router.get('/api/v1/admin/stores', attachUser, requireRole('admin'), adminListSellers);
router.get('/admin/stores', attachUser, requireRole('admin'), adminListSellers);

router.post('/api/v1/admin/sellers', attachUser, requireRole('admin'), adminCreateSeller);
router.post('/admin/sellers', attachUser, requireRole('admin'), adminCreateSeller);
router.post('/api/v1/admin/stores', attachUser, requireRole('admin'), adminCreateSeller);
router.post('/admin/stores', attachUser, requireRole('admin'), adminCreateSeller);

router.patch('/api/v1/admin/sellers/:id/status', attachUser, requireRole('admin'), adminUpdateSellerStatus);
router.patch('/admin/sellers/:id/status', attachUser, requireRole('admin'), adminUpdateSellerStatus);
router.patch('/api/v1/admin/stores/:id/status', attachUser, requireRole('admin'), adminUpdateSellerStatus);
router.patch('/admin/stores/:id/status', attachUser, requireRole('admin'), adminUpdateSellerStatus);

router.delete('/api/v1/admin/sellers/:id', attachUser, requireRole('admin'), adminDeleteSeller);
router.delete('/admin/sellers/:id', attachUser, requireRole('admin'), adminDeleteSeller);
router.delete('/api/v1/admin/stores/:id', attachUser, requireRole('admin'), adminDeleteSeller);
router.delete('/admin/stores/:id', attachUser, requireRole('admin'), adminDeleteSeller);

router.patch('/api/v1/admin/sellers/:id/password', attachUser, requireRole('admin'), adminResetSellerPassword);
router.patch('/admin/sellers/:id/password', attachUser, requireRole('admin'), adminResetSellerPassword);
router.patch('/api/v1/admin/stores/:id/password', attachUser, requireRole('admin'), adminResetSellerPassword);
router.patch('/admin/stores/:id/password', attachUser, requireRole('admin'), adminResetSellerPassword);

export default router;

