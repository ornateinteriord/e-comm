import { Request, Response, NextFunction } from 'express';
import nodemailer from 'nodemailer';
import { NotificationLog } from '../models/notification.model.js';
import { createLogger } from '@ornate/logger';

const log = createLogger('notification-controller');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'noreply@Ornate.dev';

const hasRealSmtp = SMTP_HOST && SMTP_USER && !SMTP_USER.includes('mock') && SMTP_PASS && !SMTP_PASS.includes('mock');

let transporter: nodemailer.Transporter | null = null;
if (hasRealSmtp) {
  try {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  } catch (err) {
    log.warn({ err }, 'Could not initialize SMTP transport, fallback to simulation mode');
  }
}

export async function sendEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { recipient, subject, body, type = 'general', metadata } = req.body;
    if (!recipient || !subject) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'recipient and subject required.' } });
      return;
    }

    let status: 'sent' | 'simulated' | 'failed' = 'simulated';

    if (transporter) {
      try {
        await transporter.sendMail({
          from: EMAIL_FROM,
          to: recipient,
          subject,
          html: body,
        });
        status = 'sent';
      } catch (err) {
        log.error({ err }, 'Failed to send real email, logging simulated message');
      }
    }

    const record = await NotificationLog.create({
      recipient,
      subject,
      type,
      status,
      body,
      metadata,
    });

    log.info({ recipient, subject, status }, 'Notification processed');

    res.json({
      success: true,
      message: status === 'sent' ? 'Email sent successfully.' : 'Notification logged (simulation mode).',
      data: record,
    });
  } catch (err) {
    next(err);
  }
}

export async function sendOrderConfirmation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { recipient, orderNumber, grandTotal, items } = req.body;
    const subject = `Order Confirmed - #${orderNumber}`;
    const body = `
      <h2>Thank you for your order!</h2>
      <p>Your order <strong>${orderNumber}</strong> has been received and confirmed.</p>
      <p>Amount Paid: <strong>₹${((grandTotal || 0) / 100).toFixed(2)}</strong></p>
      <p>We are preparing your items for delivery.</p>
    `;

    return sendEmail(
      {
        ...req,
        body: { recipient, subject, body, type: 'order_confirmation', metadata: { orderNumber, items } },
      } as Request,
      res,
      next,
    );
  } catch (err) {
    next(err);
  }
}

export async function listNotificationLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const logs = await NotificationLog.find().sort({ createdAt: -1 }).limit(limit);
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
}
