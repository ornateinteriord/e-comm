import { Router } from 'express';
import {
  checkStock,
  reserveStock,
  deductStock,
  adminListInventory,
  adminAdjustStock,
  adminListMovements,
} from '../controllers/inventory.controller.js';
import { attachUser, requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

router.use(attachUser);

router.post('/check', checkStock);
router.post('/reserve', reserveStock);
router.post('/deduct', deductStock);

// Admin
router.get('/admin/inventory', requireAuth, requireRole('inventory_manager', 'admin', 'super_admin'), adminListInventory);
router.post('/admin/inventory/adjust', requireAuth, requireRole('inventory_manager', 'admin', 'super_admin'), adminAdjustStock);
router.get('/admin/inventory/movements', requireAuth, requireRole('inventory_manager', 'admin', 'super_admin'), adminListMovements);

export default router;
