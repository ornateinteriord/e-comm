import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  uploadProfileAvatar,
  sendEmailOtp,
  verifyEmailOtp,
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  adminListCustomers,
} from '../controllers/user.controller.js';
import { attachUser, requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { uploadAvatarMiddleware } from '../utils/imagekit.js';

const router: Router = Router();

router.use(attachUser);

// Profile
router.get('/profile', requireAuth, getProfile);
router.get('/me', requireAuth, getProfile);
router.put('/profile', requireAuth, updateProfile);
router.patch('/profile', requireAuth, updateProfile);

// Profile Picture Upload to ImageKit (Supports any field name e.g. avatar, image, file)
router.post('/profile/avatar', requireAuth, uploadAvatarMiddleware.any(), uploadProfileAvatar);
router.post('/profile/upload-picture', requireAuth, uploadAvatarMiddleware.any(), uploadProfileAvatar);
router.post('/upload-avatar', requireAuth, uploadAvatarMiddleware.any(), uploadProfileAvatar);
router.post('/users/profile/avatar', requireAuth, uploadAvatarMiddleware.any(), uploadProfileAvatar);

// Email Verification OTP (via Nodemailer)
router.post('/send-email-otp', requireAuth, sendEmailOtp);
router.post('/verify-email-otp', requireAuth, verifyEmailOtp);
router.post('/users/send-email-otp', requireAuth, sendEmailOtp);
router.post('/users/verify-email-otp', requireAuth, verifyEmailOtp);

// Addresses
router.get('/addresses', requireAuth, getAddresses);
router.post('/addresses', requireAuth, createAddress);
router.put('/addresses/:id', requireAuth, updateAddress);
router.delete('/addresses/:id', requireAuth, deleteAddress);
router.patch('/addresses/:id/default', requireAuth, setDefaultAddress);

// Wishlist
router.get('/wishlist', requireAuth, getWishlist);
router.post('/wishlist', requireAuth, addToWishlist);
router.delete('/wishlist/:productId', requireAuth, removeFromWishlist);

// Admin customers
router.get('/admin/customers', requireAuth, requireRole('support', 'admin', 'super_admin'), adminListCustomers);

export default router;
