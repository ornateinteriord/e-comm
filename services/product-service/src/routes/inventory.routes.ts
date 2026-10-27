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

const router: Router = Router();

router.use(attachUser);

// /api/v1/inventory routes
router.post('/check', checkStock);
router.post('/reserve', reserveStock);
router.post('/deduct', deductStock);

// Admin routes (can also be matched directly)
router.get('/admin', requireAuth, requireRole('inventory_manager', 'admin', 'super_admin'), adminListInventory);
router.post('/admin/adjust', requireAuth, requireRole('inventory_manager', 'admin', 'super_admin'), adminAdjustStock);
router.get('/admin/movements', requireAuth, requireRole('inventory_manager', 'admin', 'super_admin'), adminListMovements);

export default router;
