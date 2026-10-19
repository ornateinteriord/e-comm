import { Router } from 'express';
import {
  getProfile,
  updateProfile,
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

const router: Router = Router();

router.use(attachUser);

// Profile
router.get('/profile', requireAuth, getProfile);
router.put('/profile', requireAuth, updateProfile);

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
