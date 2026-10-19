import { Router } from 'express';
import {
  generateInvoice,
  getInvoiceByOrderId,
  getInvoiceById,
  renderInvoiceHtml,
  adminListInvoices,
} from '../controllers/invoice.controller.js';
import { attachUser, requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router: Router = Router();

router.use(attachUser);

router.post('/generate', generateInvoice);
router.get('/order/:orderId', getInvoiceByOrderId);
router.get('/:id/html', renderInvoiceHtml);
router.get('/:id', getInvoiceById);

// Admin invoices
router.get('/admin/invoices', requireAuth, requireRole('finance_manager', 'admin', 'super_admin'), adminListInvoices);

export default router;
