import { Router } from 'express';
import {
  sendEmail,
  sendOrderConfirmation,
  listNotificationLogs,
} from '../controllers/notification.controller.js';

const router: Router = Router();

router.post('/send-email', sendEmail);
router.post('/order-confirmation', sendOrderConfirmation);
router.get('/logs', listNotificationLogs);

export default router;
