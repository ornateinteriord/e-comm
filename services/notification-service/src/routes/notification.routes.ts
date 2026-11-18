import { Router } from 'express';
import {
  notifyWelcome,
  notifyOrderConfirmed,
  notifyOrderDispatched,
  notifyOrderDelivered,
  notifyOrderCancelled,
  downloadInvoicePdf,
  sendEmail,
  sendOrderConfirmation,
  listNotificationLogs,
} from '../controllers/notification.controller.js';
import whatsappRoutes from './whatsapp.routes.js';

const router: Router = Router();

// Dedicated Sub-routers
router.use('/whatsapp', whatsappRoutes);

// Core Lifecycle Notifications (Email + WhatsApp + PDF)
router.post('/welcome', notifyWelcome);
router.post('/order-confirmed', notifyOrderConfirmed);
router.post('/order-dispatched', notifyOrderDispatched);
router.post('/order-delivered', notifyOrderDelivered);
router.post('/order-cancelled', notifyOrderCancelled);

// Tax Invoice PDF Generation & Download
router.get('/invoice/:orderNumber/pdf', downloadInvoicePdf);
router.post('/invoice/generate', downloadInvoicePdf);

// Legacy & Generic Endpoints
router.post('/send-email', sendEmail);
router.post('/order-confirmation', sendOrderConfirmation);
router.get('/logs', listNotificationLogs);

export default router;
