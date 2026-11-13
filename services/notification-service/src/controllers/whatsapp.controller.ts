import { Request, Response, NextFunction } from 'express';
import { whatsappService } from '../services/whatsapp.service.js';
import { NotificationLog } from '../models/notification.model.js';
import { createLogger } from '@ornate/logger';

const log = createLogger('whatsapp-controller');

export async function sendWhatsApp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { phone, message, type = 'text', templateName = 'hello_world', languageCode = 'en_US', components } = req.body;

    if (!phone || !String(phone).trim()) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PHONE',
          message: 'Phone number is required.',
        },
      });
      return;
    }

    let result;
    if (type === 'template') {
      result = await whatsappService.sendTemplateMessage({
        to: String(phone),
        templateName: templateName || 'hello_world',
        languageCode: languageCode || 'en_US',
        components,
      });
    } else {
      if (!message || !String(message).trim()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_MESSAGE',
            message: 'Message text is required for text messages.',
          },
        });
        return;
      }

      result = await whatsappService.sendTextMessage({
        to: String(phone),
        message: String(message),
      });
    }

    // Persist notification log
    try {
      await NotificationLog.create({
        recipient: result.recipient,
        subject: `WhatsApp ${type.toUpperCase()}`,
        type: `whatsapp_${type}`,
        channel: 'whatsapp',
        status: result.success ? 'sent' : 'failed',
        deliveryStatus: result.success ? 'sent' : 'failed',
        whatsappMessageId: result.messageId,
        body: type === 'text' ? message : `Template: ${templateName} (${languageCode})`,
        metadata: {
          metaResponse: result.data,
          error: result.error,
          requestedPhone: phone,
          type,
        },
      });
    } catch (dbErr) {
      log.warn({ dbErr }, 'Failed to persist WhatsApp notification log to MongoDB');
    }

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.error?.message || 'WhatsApp message dispatch failed.',
        error: result.error,
        recipient: result.recipient,
      });
      return;
    }

    res.json({
      success: true,
      message: 'WhatsApp message sent successfully!',
      recipient: result.recipient,
      messageId: result.messageId,
      data: result.data,
    });
  } catch (err) {
    next(err);
  }
}

export async function getWhatsAppConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const config = whatsappService.getPublicConfig();
    res.json({
      success: true,
      data: config,
    });
  } catch (err) {
    next(err);
  }
}

export async function getWhatsAppLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
    const logs = await NotificationLog.find({ channel: 'whatsapp' })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({
      success: true,
      data: logs,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Meta Webhook verification endpoint (GET)
 * Meta calls this when you configure the Callback URL in the Meta App Dashboard
 */
export async function verifyWhatsAppWebhook(req: Request, res: Response): Promise<void> {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && expectedToken && token === expectedToken) {
    log.info('Meta WhatsApp webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    log.warn({ mode, tokenReceived: token }, 'Meta WhatsApp webhook verification failed');
    res.status(403).json({ error: 'Verification token mismatch' });
  }
}

/**
 * Meta Webhook event listener (POST)
 * Receives delivery receipts (sent, delivered, read) and incoming user replies
 */
export async function receiveWhatsAppWebhook(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body;
    log.info({ body }, 'Meta WhatsApp Webhook event received');

    if (body.object === 'whatsapp_business_account') {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value;
          if (value?.statuses) {
            for (const statusObj of value.statuses) {
              const wamid = statusObj.id;
              const deliveryStatus = statusObj.status; // sent, delivered, read, failed

              if (wamid) {
                await NotificationLog.updateOne(
                  { whatsappMessageId: wamid },
                  {
                    $set: {
                      deliveryStatus,
                      ...(deliveryStatus === 'failed' ? { status: 'failed' } : {}),
                    },
                    $push: {
                      'metadata.statusUpdates': {
                        status: deliveryStatus,
                        timestamp: statusObj.timestamp,
                        errors: statusObj.errors,
                      },
                    },
                  },
                ).catch((err) => log.warn({ err }, 'Error updating notification status'));
              }
            }
          }
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    log.error({ err }, 'Error processing WhatsApp webhook event');
    res.status(200).json({ received: true }); // Always return 200 to prevent Meta retry storm
  }
}

