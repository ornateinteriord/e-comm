import { Router } from 'express';
import {
  getAvailableOrdersForDelivery,
  claimAvailableOrder,
  listMyAssignments,
  getMyAssignmentById,
  acceptAssignedDelivery,
  rejectAssignedDelivery,
  updateDeliveryProgress,
  updateAssignmentLocation,
  completeDeliveryWithPod,
  getMyEarnings,
  adminAssignDeliveryPartner,
  adminTrackOrderDelivery,
  adminCancelOrderDelivery,
  adminListDeliveryAssignments,
  getCustomerOrderDelivery,
} from '../controllers/delivery.controller.js';
import { attachUser, requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router: Router = Router();

router.use(attachUser);

// Delivery partner operations (role enforced inside controller to isolate from seller role)
router.get('/delivery/orders/available', requireAuth, getAvailableOrdersForDelivery);
router.post('/delivery/orders/:orderId/claim', requireAuth, claimAvailableOrder);
router.get('/delivery/assignments', requireAuth, listMyAssignments);
router.get('/delivery/assignments/:id', requireAuth, getMyAssignmentById);
router.post('/delivery/assignments/:id/accept', requireAuth, acceptAssignedDelivery);
router.post('/delivery/assignments/:id/reject', requireAuth, rejectAssignedDelivery);
router.patch('/delivery/assignments/:id/status', requireAuth, updateDeliveryProgress);
router.post('/delivery/assignments/:id/location', requireAuth, updateAssignmentLocation);
router.post('/delivery/assignments/:id/complete', requireAuth, completeDeliveryWithPod);
router.get('/delivery/earnings', requireAuth, getMyEarnings);

// Customer tracking
router.get('/orders/:id/delivery', requireAuth, getCustomerOrderDelivery);

// Admin dispatch & live delivery monitoring
const adminOrderRoles = requireRole('order_manager', 'admin', 'super_admin');
router.post('/admin/orders/:id/delivery/assign', requireAuth, adminOrderRoles, adminAssignDeliveryPartner);
router.get('/admin/orders/:id/delivery/track', requireAuth, adminOrderRoles, adminTrackOrderDelivery);
router.post('/admin/orders/:id/delivery/cancel', requireAuth, adminOrderRoles, adminCancelOrderDelivery);
router.get('/admin/delivery/assignments', requireAuth, adminOrderRoles, adminListDeliveryAssignments);

export default router;
