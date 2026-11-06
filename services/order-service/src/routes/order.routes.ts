import { Router } from 'express';
import {
  createCheckoutOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  adminListOrders,
  adminUpdateOrderStatus,
  adminGetDashboardMetrics,
  confirmOrderPayment,
  adminTriggerOrderCommission,
  storeListOrders,
  storeGetOrderDetails,
  storeUpdateItemStatus,
} from '../controllers/order.controller.js';
import { attachUser, requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router: Router = Router();

router.use(attachUser);

// Customer checkout & orders
router.post('/checkout', createCheckoutOrder);
router.get('/orders', requireAuth, getMyOrders);
router.get('/orders/:id', getOrderById);
router.post('/orders/:id/cancel', requireAuth, cancelOrder);
router.patch('/orders/:id/payment-confirmation', confirmOrderPayment);

// Store orders & fulfillment
router.get('/api/v1/store/orders', requireAuth, requireRole('store'), storeListOrders);
router.get('/store/orders', requireAuth, requireRole('store'), storeListOrders);
router.get('/api/v1/store/orders/:id', requireAuth, requireRole('store'), storeGetOrderDetails);
router.get('/store/orders/:id', requireAuth, requireRole('store'), storeGetOrderDetails);
router.patch('/api/v1/store/orders/:id/status', requireAuth, requireRole('store'), storeUpdateItemStatus);
router.patch('/store/orders/:id/status', requireAuth, requireRole('store'), storeUpdateItemStatus);

// Admin orders & dashboard
router.get('/admin/orders', requireAuth, requireRole('order_manager', 'admin', 'super_admin'), adminListOrders);
router.get('/admin/orders/:id', requireAuth, requireRole('order_manager', 'admin', 'super_admin'), getOrderById);
router.patch('/admin/orders/:id/status', requireAuth, requireRole('order_manager', 'admin', 'super_admin'), adminUpdateOrderStatus);
router.post('/admin/orders/:id/distribute-commission', requireAuth, requireRole('order_manager', 'admin', 'super_admin'), adminTriggerOrderCommission);
router.get('/admin/dashboard', requireAuth, requireRole('order_manager', 'finance_manager', 'admin', 'super_admin'), adminGetDashboardMetrics);

export default router;
