import { Router } from 'express';
import {
  sendWhatsApp,
  getWhatsAppConfig,
  getWhatsAppLogs,
  verifyWhatsAppWebhook,
  receiveWhatsAppWebhook,
} from '../controllers/whatsapp.controller.js';

const router: Router = Router();

// Test & Admin endpoints
router.post('/send', sendWhatsApp);
router.get('/config', getWhatsAppConfig);
router.get('/logs', getWhatsAppLogs);

// Meta Webhook endpoints (GET for challenge verification, POST for events)
router.get('/webhook', verifyWhatsAppWebhook);
router.post('/webhook', receiveWhatsAppWebhook);

export default router;

