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
  sellerListOrders,
  sellerGetOrderDetails,
  sellerUpdateItemStatus,
  sellerAcceptOrder,
  sellerRejectOrder,
  adminGetShadowfaxQuote,
  adminCreateShadowfaxShipment,
  adminTrackShadowfaxOrder,
  adminGetShadowfaxLabel,
  adminCancelShadowfaxShipment,
  shadowfaxWebhook,
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

// Shadowfax Webhook (Public POST endpoint for callbacks)
router.post('/orders/webhook/shadowfax', shadowfaxWebhook);
router.post('/webhooks/shadowfax', shadowfaxWebhook);

// Seller orders & fulfillment
router.get('/api/v1/seller/orders', requireAuth, requireRole('seller'), sellerListOrders);
router.get('/seller/orders', requireAuth, requireRole('seller'), sellerListOrders);
router.get('/api/v1/seller/orders/:id', requireAuth, requireRole('seller'), sellerGetOrderDetails);
router.get('/seller/orders/:id', requireAuth, requireRole('seller'), sellerGetOrderDetails);
router.patch('/api/v1/seller/orders/:id/status', requireAuth, requireRole('seller'), sellerUpdateItemStatus);
router.patch('/seller/orders/:id/status', requireAuth, requireRole('seller'), sellerUpdateItemStatus);

// Seller order accept / reject
router.post('/api/v1/seller/orders/:id/accept', requireAuth, requireRole('seller'), sellerAcceptOrder);
router.post('/seller/orders/:id/accept', requireAuth, requireRole('seller'), sellerAcceptOrder);
router.post('/api/v1/seller/orders/:id/reject', requireAuth, requireRole('seller'), sellerRejectOrder);
router.post('/seller/orders/:id/reject', requireAuth, requireRole('seller'), sellerRejectOrder);

// Store orders & fulfillment (legacy aliases)
router.get('/api/v1/store/orders', requireAuth, requireRole('store'), storeListOrders);
router.get('/store/orders', requireAuth, requireRole('store'), storeListOrders);
router.get('/api/v1/store/orders/:id', requireAuth, requireRole('store'), storeGetOrderDetails);
router.get('/store/orders/:id', requireAuth, requireRole('store'), storeGetOrderDetails);
router.patch('/api/v1/store/orders/:id/status', requireAuth, requireRole('store'), storeUpdateItemStatus);
router.patch('/store/orders/:id/status', requireAuth, requireRole('store'), storeUpdateItemStatus);
router.post('/api/v1/store/orders/:id/accept', requireAuth, requireRole('store'), sellerAcceptOrder);
router.post('/store/orders/:id/accept', requireAuth, requireRole('store'), sellerAcceptOrder);
router.post('/api/v1/store/orders/:id/reject', requireAuth, requireRole('store'), sellerRejectOrder);
router.post('/store/orders/:id/reject', requireAuth, requireRole('store'), sellerRejectOrder);

// Admin orders & dashboard
router.get('/admin/orders', requireAuth, requireRole('order_manager', 'admin', 'super_admin'), adminListOrders);
router.get('/admin/orders/:id', requireAuth, requireRole('order_manager', 'admin', 'super_admin'), getOrderById);
router.patch('/admin/orders/:id/status', requireAuth, requireRole('order_manager', 'admin', 'super_admin'), adminUpdateOrderStatus);
router.post('/admin/orders/:id/distribute-commission', requireAuth, requireRole('order_manager', 'admin', 'super_admin'), adminTriggerOrderCommission);
router.get('/admin/dashboard', requireAuth, requireRole('order_manager', 'finance_manager', 'admin', 'super_admin'), adminGetDashboardMetrics);

// Admin Shadowfax Forward Logistics Actions
router.get('/admin/orders/:id/shadowfax/quote', requireAuth, requireRole('order_manager', 'admin', 'super_admin'), adminGetShadowfaxQuote);
router.get('/api/v1/admin/orders/:id/shadowfax/quote', requireAuth, requireRole('order_manager', 'admin', 'super_admin'), adminGetShadowfaxQuote);
router.post('/admin/orders/:id/shadowfax/create', requireAuth, requireRole('order_manager', 'admin', 'super_admin'), adminCreateShadowfaxShipment);
router.post('/api/v1/admin/orders/:id/shadowfax/create', requireAuth, requireRole('order_manager', 'admin', 'super_admin'), adminCreateShadowfaxShipment);
router.get('/admin/orders/:id/shadowfax/track', requireAuth, requireRole('order_manager', 'admin', 'super_admin'), adminTrackShadowfaxOrder);
router.get('/api/v1/admin/orders/:id/shadowfax/track', requireAuth, requireRole('order_manager', 'admin', 'super_admin'), adminTrackShadowfaxOrder);
router.get('/admin/orders/:id/shadowfax/label', requireAuth, requireRole('order_manager', 'admin', 'super_admin'), adminGetShadowfaxLabel);
router.get('/api/v1/admin/orders/:id/shadowfax/label', requireAuth, requireRole('order_manager', 'admin', 'super_admin'), adminGetShadowfaxLabel);
router.post('/admin/orders/:id/shadowfax/cancel', requireAuth, requireRole('order_manager', 'admin', 'super_admin'), adminCancelShadowfaxShipment);
router.post('/api/v1/admin/orders/:id/shadowfax/cancel', requireAuth, requireRole('order_manager', 'admin', 'super_admin'), adminCancelShadowfaxShipment);

export default router;
