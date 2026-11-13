import { Router } from 'express';
import {
  sendEmail,
  sendOrderConfirmation,
  listNotificationLogs,
} from '../controllers/notification.controller.js';
import whatsappRoutes from './whatsapp.routes.js';

const router: Router = Router();

router.use('/whatsapp', whatsappRoutes);
router.post('/send-email', sendEmail);
router.post('/order-confirmation', sendOrderConfirmation);
router.get('/logs', listNotificationLogs);

export default router;

