import { Router } from 'express';
import {
  createCheckoutOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  adminListOrders,
  adminUpdateOrderStatus,
  adminGetDashboardMetrics,
} from '../controllers/order.controller.js';
import { attachUser, requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

router.use(attachUser);

// Customer checkout & orders
router.post('/checkout', createCheckoutOrder);
router.get('/orders', requireAuth, getMyOrders);
router.get('/orders/:id', getOrderById);
router.post('/orders/:id/cancel', requireAuth, cancelOrder);

// Admin orders & dashboard
router.get('/admin/orders', requireAuth, requireRole('order_manager', 'admin', 'super_admin'), adminListOrders);
router.get('/admin/orders/:id', requireAuth, requireRole('order_manager', 'admin', 'super_admin'), getOrderById);
router.patch('/admin/orders/:id/status', requireAuth, requireRole('order_manager', 'admin', 'super_admin'), adminUpdateOrderStatus);
router.get('/admin/dashboard', requireAuth, requireRole('order_manager', 'finance_manager', 'admin', 'super_admin'), adminGetDashboardMetrics);

export default router;
