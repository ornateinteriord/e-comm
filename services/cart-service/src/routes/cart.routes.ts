import { Router } from 'express';
import {
  getCart,
  addItem,
  updateItemQuantity,
  removeItem,
  clearCart,
  applyCoupon,
  removeCoupon,
  adminListCoupons,
  adminCreateCoupon,
  adminUpdateCoupon,
  adminDeleteCoupon,
} from '../controllers/cart.controller.js';
import { attachUser, requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

router.use(attachUser);

// Customer cart endpoints
router.get('/', getCart);
router.post('/items', addItem);
router.put('/items/:id', updateItemQuantity);
router.delete('/items/:id', removeItem);
router.delete('/', clearCart);
router.post('/coupon', applyCoupon);
router.delete('/coupon', removeCoupon);

// Admin coupon endpoints
router.get('/admin/coupons', requireAuth, requireRole('catalog_manager', 'admin', 'super_admin'), adminListCoupons);
router.post('/admin/coupons', requireAuth, requireRole('catalog_manager', 'admin', 'super_admin'), adminCreateCoupon);
router.put('/admin/coupons/:id', requireAuth, requireRole('catalog_manager', 'admin', 'super_admin'), adminUpdateCoupon);
router.delete('/admin/coupons/:id', requireAuth, requireRole('admin', 'super_admin'), adminDeleteCoupon);

export default router;
