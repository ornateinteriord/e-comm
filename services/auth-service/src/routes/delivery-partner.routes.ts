import { Router } from 'express';
import {
  registerDeliveryPartner,
  loginDeliveryPartner,
  getDeliveryPartnerMe,
  updateDeliveryPartnerMe,
  uploadDeliveryPartnerDocument,
  uploadDeliveryPodPhoto,
  updateDeliveryAvailability,
  updateDeliveryLocation,
  adminListDeliveryPartners,
  adminCreateDeliveryPartner,
  adminUpdateDeliveryPartnerStatus,
  adminUpdateDeliveryPartnerKyc,
  adminResetDeliveryPartnerPassword,
  adminSettleDeliveryPartnerCod,
  adminDeleteDeliveryPartner,
  getDeliveryAppRelease,
  downloadDeliveryAppApk,
  adminUpdateDeliveryAppRelease,
} from '../controllers/delivery-partner.controller.js';
import { attachUser, requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { uploadAvatarMiddleware } from '../utils/imagekit.js';

const router: Router = Router();

// Public auth & APK release endpoints
router.post('/delivery/register', registerDeliveryPartner);
router.post('/delivery/login', loginDeliveryPartner);
router.get('/delivery/app-release', getDeliveryAppRelease);
router.get('/delivery/app-download', downloadDeliveryAppApk);

// Authenticated delivery partner endpoints
router.get('/delivery/me', attachUser, requireAuth, getDeliveryPartnerMe);
router.patch('/delivery/me', attachUser, requireAuth, updateDeliveryPartnerMe);
router.post(
  '/delivery/me/documents',
  attachUser,
  requireAuth,
  uploadAvatarMiddleware.any(),
  uploadDeliveryPartnerDocument,
);
router.post(
  '/delivery/upload-pod',
  attachUser,
  requireAuth,
  uploadAvatarMiddleware.any(),
  uploadDeliveryPodPhoto,
);
router.patch('/delivery/me/availability', attachUser, requireAuth, updateDeliveryAvailability);
router.post('/delivery/me/location', attachUser, requireAuth, updateDeliveryLocation);

// Admin delivery partner management endpoints
const adminRoles = requireRole('order_manager', 'admin', 'super_admin');
router.get('/admin/delivery-partners', attachUser, requireAuth, adminRoles, adminListDeliveryPartners);
router.post('/admin/delivery-partners', attachUser, requireAuth, adminRoles, adminCreateDeliveryPartner);
router.patch(
  '/admin/delivery-partners/:id/status',
  attachUser,
  requireAuth,
  adminRoles,
  adminUpdateDeliveryPartnerStatus,
);
router.patch(
  '/admin/delivery-partners/:id/kyc',
  attachUser,
  requireAuth,
  adminRoles,
  adminUpdateDeliveryPartnerKyc,
);
router.get('/admin/delivery-app-release', attachUser, requireAuth, adminRoles, getDeliveryAppRelease);
router.put('/admin/delivery-app-release', attachUser, requireAuth, adminRoles, adminUpdateDeliveryAppRelease);
router.patch(
  '/admin/delivery-partners/:id/password',
  attachUser,
  requireAuth,
  adminRoles,
  adminResetDeliveryPartnerPassword,
);
router.post(
  '/admin/delivery-partners/:id/settle-cod',
  attachUser,
  requireAuth,
  adminRoles,
  adminSettleDeliveryPartnerCod,
);
router.delete(
  '/admin/delivery-partners/:id',
  attachUser,
  requireAuth,
  adminRoles,
  adminDeleteDeliveryPartner,
);

export default router;
