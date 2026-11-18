import { Request, Response, NextFunction } from 'express';
import { emailService } from '../services/email.service.js';
import { whatsappService } from '../services/whatsapp.service.js';
import { generateInvoicePdfBuffer, InvoiceData } from '../services/pdf-invoice.service.js';
import { NotificationLog } from '../models/notification.model.js';
import { createLogger } from '@ornate/logger';

const log = createLogger('notification-controller');

/**
 * 1. Customer Registration Welcome Notification (Email + WhatsApp)
 * POST /api/v1/notifications/welcome
 */
export async function notifyWelcome(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { to, phone, name, customerId, loginUrl } = req.body;
    const safeName = name || 'Customer';
    const targetLoginUrl = loginUrl || 'https://eshopy.biz/login';

    const results: Record<string, any> = {};

    // 1. Send Branded Welcome Email
    if (to) {
      try {
        const emailRes = await emailService.sendWelcomeEmail({
          to,
          name: safeName,
          customerId,
          loginUrl: targetLoginUrl,
        });
        results.email = emailRes;

        await NotificationLog.create({
          recipient: to,
          subject: `Welcome to E-Shopy, ${safeName}!`,
          type: 'customer_welcome',
          channel: 'email',
          status: emailRes.success ? 'sent' : 'failed',
          deliveryStatus: emailRes.success ? 'sent' : 'failed',
          body: `Welcome email sent to ${to} (Customer ID: ${customerId || 'N/A'})`,
          metadata: { customerId, loginUrl: targetLoginUrl },
        }).catch((err) => log.warn({ err }, 'Failed to save welcome email log'));
      } catch (err: any) {
        log.error({ err, to }, 'Error sending welcome email');
        results.email = { success: false, error: err.message };
      }
    }

    // 2. Send Welcome WhatsApp Message
    if (phone) {
      try {
        const waRes = await whatsappService.sendWelcomeWhatsApp({
          to: String(phone),
          name: safeName,
          customerId,
          loginUrl: targetLoginUrl,
        });
        results.whatsapp = waRes;

        await NotificationLog.create({
          recipient: waRes.recipient,
          subject: 'WhatsApp Welcome',
          type: 'customer_welcome',
          channel: 'whatsapp',
          status: waRes.success ? 'sent' : 'failed',
          deliveryStatus: waRes.success ? 'sent' : 'failed',
          whatsappMessageId: waRes.messageId,
          body: `Welcome WhatsApp sent to ${waRes.recipient}`,
          metadata: { metaResponse: waRes.data, error: waRes.error },
        }).catch((err) => log.warn({ err }, 'Failed to save welcome whatsapp log'));
      } catch (err: any) {
        log.error({ err, phone }, 'Error sending welcome WhatsApp');
        results.whatsapp = { success: false, error: err.message };
      }
    }

    res.json({
      success: true,
      message: 'Welcome notifications processed.',
      data: results,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 2. Order Confirmed & Paid Notification (Email with Tax Invoice PDF + WhatsApp)
 * POST /api/v1/notifications/order-confirmed
 */
export async function notifyOrderConfirmed(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      to,
      phone,
      name,
      orderNumber,
      invoiceNumber,
      items = [],
      pricing = {},
      grandTotal,
      shippingAddress,
      billingAddress,
      paymentMethod,
      paymentReference,
      orderDate,
    } = req.body;

    if (!orderNumber) {
      res.status(400).json({ success: false, error: { code: 'MISSING_ORDER_NUMBER', message: 'orderNumber is required.' } });
      return;
    }

    const safeName = name || shippingAddress?.name || 'Valued Customer';
    const computedGrandTotal = Number(grandTotal ?? pricing.grandTotal ?? 0);
    const invoiceNum = invoiceNumber || `INV-${orderNumber}`;

    // Normalize pricing
    const normalizedPricing = {
      subtotal: Number(pricing.subtotal ?? computedGrandTotal),
      couponDiscount: Number(pricing.couponDiscount ?? 0),
      shippingCharge: Number(pricing.shippingCharge ?? 0),
      tax: Number(pricing.tax ?? 0),
      grandTotal: computedGrandTotal,
    };

    // Normalize items
    const normalizedItems = (items || []).map((it: any) => ({
      name: it.name || it.productName || it.title || 'Product Item',
      sku: it.sku || it.productId || 'SKU-ESHOPY',
      quantity: Number(it.quantity || 1),
      unitPrice: Number(it.unitPrice || it.price || 0),
      discount: Number(it.discount || 0),
      taxRate: Number(it.taxRate || 18),
      lineTotal: Number(it.lineTotal || (Number(it.unitPrice || 0) * Number(it.quantity || 1))),
    }));

    // Normalize shipping address
    const safeShipping = {
      name: shippingAddress?.name || safeName,
      phone: shippingAddress?.phone || phone || '',
      line1: shippingAddress?.line1 || shippingAddress?.street || 'Customer Address',
      line2: shippingAddress?.line2 || '',
      city: shippingAddress?.city || 'City',
      state: shippingAddress?.state || 'Karnataka',
      pincode: shippingAddress?.pincode || shippingAddress?.postalCode || '560001',
      country: shippingAddress?.country || 'India',
    };

    const invoiceData: InvoiceData = {
      invoiceNumber: invoiceNum,
      orderNumber,
      invoiceDate: new Date(),
      orderDate: orderDate ? new Date(orderDate) : new Date(),
      paymentMethod: paymentMethod || 'ONLINE / PREPAID',
      paymentReference: paymentReference || orderNumber,
      customerName: safeName,
      customerEmail: to,
      customerPhone: phone,
      shippingAddress: safeShipping,
      billingAddress: billingAddress ? { ...safeShipping, ...billingAddress } : safeShipping,
      items: normalizedItems,
      pricing: normalizedPricing,
    };

    let pdfBuffer: Buffer | undefined;
    try {
      pdfBuffer = await generateInvoicePdfBuffer(invoiceData);
      log.info({ orderNumber, pdfSize: pdfBuffer.length }, 'Generated Tax Invoice PDF buffer');
    } catch (pdfErr) {
      log.error({ pdfErr, orderNumber }, 'Failed to generate invoice PDF buffer');
    }

    const results: Record<string, any> = {};

    // 1. Dispatch Order Confirmation Email with Attached PDF
    if (to) {
      try {
        const emailRes = await emailService.sendOrderConfirmedEmail({
          to,
          name: safeName,
          orderNumber,
          items: normalizedItems,
          grandTotal: computedGrandTotal,
          paymentReference,
          shippingAddress: safeShipping,
          pdfBuffer,
        });
        results.email = emailRes;

        await NotificationLog.create({
          recipient: to,
          subject: `Order Confirmed - #${orderNumber}`,
          type: 'order_confirmed',
          channel: 'email',
          status: emailRes.success ? 'sent' : 'failed',
          deliveryStatus: emailRes.success ? 'sent' : 'failed',
          body: `Order #${orderNumber} confirmed. Total: ₹${(computedGrandTotal / 100).toFixed(2)}. Tax Invoice attached.`,
          metadata: { orderNumber, invoiceNumber: invoiceNum, grandTotal: computedGrandTotal },
        }).catch((err) => log.warn({ err }, 'Failed to save order confirmed email log'));
      } catch (err: any) {
        log.error({ err, to, orderNumber }, 'Error sending order confirmed email');
        results.email = { success: false, error: err.message };
      }
    }

    // 2. Dispatch Order Confirmation WhatsApp Message
    const targetPhone = phone || safeShipping.phone;
    if (targetPhone) {
      try {
        const waRes = await whatsappService.sendOrderConfirmedWhatsApp({
          to: String(targetPhone),
          name: safeName,
          orderNumber,
          grandTotal: computedGrandTotal,
          itemCount: normalizedItems.reduce((acc: number, it: any) => acc + (it.quantity || 1), 0),
          paymentMethod,
        });
        results.whatsapp = waRes;

        await NotificationLog.create({
          recipient: waRes.recipient,
          subject: `WhatsApp Order #${orderNumber} Confirmed`,
          type: 'order_confirmed',
          channel: 'whatsapp',
          status: waRes.success ? 'sent' : 'failed',
          deliveryStatus: waRes.success ? 'sent' : 'failed',
          whatsappMessageId: waRes.messageId,
          body: `WhatsApp order confirmation for #${orderNumber}`,
          metadata: { orderNumber, grandTotal: computedGrandTotal, metaResponse: waRes.data, error: waRes.error },
        }).catch((err) => log.warn({ err }, 'Failed to save order confirmed whatsapp log'));
      } catch (err: any) {
        log.error({ err, targetPhone, orderNumber }, 'Error sending order confirmed WhatsApp');
        results.whatsapp = { success: false, error: err.message };
      }
    }

    res.json({
      success: true,
      message: `Order #${orderNumber} notifications processed successfully.`,
      invoiceNumber: invoiceNum,
      hasPdf: Boolean(pdfBuffer),
      data: results,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 3. Order Dispatched / Shipped Notification (Email + WhatsApp)
 * POST /api/v1/notifications/order-dispatched
 */
export async function notifyOrderDispatched(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { to, phone, name, orderNumber, courierName, trackingNumber, trackingUrl } = req.body;

    if (!orderNumber) {
      res.status(400).json({ success: false, error: { code: 'MISSING_ORDER_NUMBER', message: 'orderNumber is required.' } });
      return;
    }

    const safeName = name || 'Customer';
    const results: Record<string, any> = {};

    if (to) {
      try {
        const emailRes = await emailService.sendOrderDispatchedEmail({
          to,
          name: safeName,
          orderNumber,
          courierName: courierName || 'Express Logistics',
          trackingNumber: trackingNumber || 'N/A',
          trackingUrl,
        });
        results.email = emailRes;

        await NotificationLog.create({
          recipient: to,
          subject: `Order #${orderNumber} Dispatched`,
          type: 'order_dispatched',
          channel: 'email',
          status: emailRes.success ? 'sent' : 'failed',
          deliveryStatus: emailRes.success ? 'sent' : 'failed',
          body: `Order #${orderNumber} dispatched via ${courierName || 'Courier'} (Tracking: ${trackingNumber || 'N/A'})`,
          metadata: { orderNumber, courierName, trackingNumber },
        }).catch((err) => log.warn({ err }, 'Failed to save dispatched email log'));
      } catch (err: any) {
        log.error({ err, to, orderNumber }, 'Error sending dispatched email');
        results.email = { success: false, error: err.message };
      }
    }

    if (phone) {
      try {
        const waRes = await whatsappService.sendOrderDispatchedWhatsApp({
          to: String(phone),
          name: safeName,
          orderNumber,
          courierName,
          trackingNumber,
          trackingUrl,
        });
        results.whatsapp = waRes;

        await NotificationLog.create({
          recipient: waRes.recipient,
          subject: `WhatsApp Order #${orderNumber} Dispatched`,
          type: 'order_dispatched',
          channel: 'whatsapp',
          status: waRes.success ? 'sent' : 'failed',
          deliveryStatus: waRes.success ? 'sent' : 'failed',
          whatsappMessageId: waRes.messageId,
          body: `WhatsApp dispatched notification for #${orderNumber}`,
          metadata: { orderNumber, courierName, trackingNumber, metaResponse: waRes.data, error: waRes.error },
        }).catch((err) => log.warn({ err }, 'Failed to save dispatched whatsapp log'));
      } catch (err: any) {
        log.error({ err, phone, orderNumber }, 'Error sending dispatched WhatsApp');
        results.whatsapp = { success: false, error: err.message };
      }
    }

    res.json({
      success: true,
      message: `Dispatched notifications sent for #${orderNumber}.`,
      data: results,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 4. Order Delivered Notification (Email + WhatsApp)
 * POST /api/v1/notifications/order-delivered
 */
export async function notifyOrderDelivered(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { to, phone, name, orderNumber } = req.body;

    if (!orderNumber) {
      res.status(400).json({ success: false, error: { code: 'MISSING_ORDER_NUMBER', message: 'orderNumber is required.' } });
      return;
    }

    const safeName = name || 'Customer';
    const results: Record<string, any> = {};

    if (to) {
      try {
        const emailRes = await emailService.sendOrderDeliveredEmail({
          to,
          name: safeName,
          orderNumber,
        });
        results.email = emailRes;

        await NotificationLog.create({
          recipient: to,
          subject: `Order #${orderNumber} Delivered`,
          type: 'order_delivered',
          channel: 'email',
          status: emailRes.success ? 'sent' : 'failed',
          deliveryStatus: emailRes.success ? 'sent' : 'failed',
          body: `Order #${orderNumber} delivered to customer.`,
          metadata: { orderNumber },
        }).catch((err) => log.warn({ err }, 'Failed to save delivered email log'));
      } catch (err: any) {
        log.error({ err, to, orderNumber }, 'Error sending delivered email');
        results.email = { success: false, error: err.message };
      }
    }

    if (phone) {
      try {
        const waRes = await whatsappService.sendOrderDeliveredWhatsApp({
          to: String(phone),
          name: safeName,
          orderNumber,
        });
        results.whatsapp = waRes;

        await NotificationLog.create({
          recipient: waRes.recipient,
          subject: `WhatsApp Order #${orderNumber} Delivered`,
          type: 'order_delivered',
          channel: 'whatsapp',
          status: waRes.success ? 'sent' : 'failed',
          deliveryStatus: waRes.success ? 'sent' : 'failed',
          whatsappMessageId: waRes.messageId,
          body: `WhatsApp delivered notification for #${orderNumber}`,
          metadata: { orderNumber, metaResponse: waRes.data, error: waRes.error },
        }).catch((err) => log.warn({ err }, 'Failed to save delivered whatsapp log'));
      } catch (err: any) {
        log.error({ err, phone, orderNumber }, 'Error sending delivered WhatsApp');
        results.whatsapp = { success: false, error: err.message };
      }
    }

    res.json({
      success: true,
      message: `Delivered notifications sent for #${orderNumber}.`,
      data: results,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 5. Order Cancelled Notification (Email + WhatsApp)
 * POST /api/v1/notifications/order-cancelled
 */
export async function notifyOrderCancelled(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { to, phone, name, orderNumber, reason, refundAmount, refundRupees } = req.body;

    if (!orderNumber) {
      res.status(400).json({ success: false, error: { code: 'MISSING_ORDER_NUMBER', message: 'orderNumber is required.' } });
      return;
    }

    const safeName = name || 'Customer';
    const computedRefundAmount = refundAmount ? Number(refundAmount) : (refundRupees ? Math.round(Number(refundRupees) * 100) : undefined);
    const computedRefundRupees = refundRupees || (computedRefundAmount ? (computedRefundAmount / 100).toFixed(2) : undefined);
    const results: Record<string, any> = {};

    if (to) {
      try {
        const emailRes = await emailService.sendOrderCancelledEmail({
          to,
          name: safeName,
          orderNumber,
          reason,
          refundAmount: computedRefundAmount,
        });
        results.email = emailRes;

        await NotificationLog.create({
          recipient: to,
          subject: `Order #${orderNumber} Cancelled`,
          type: 'order_cancelled',
          channel: 'email',
          status: emailRes.success ? 'sent' : 'failed',
          deliveryStatus: emailRes.success ? 'sent' : 'failed',
          body: `Order #${orderNumber} cancelled. Reason: ${reason || 'N/A'}. Refund: ₹${computedRefundRupees || '0.00'}`,
          metadata: { orderNumber, reason, refundRupees: computedRefundRupees },
        }).catch((err) => log.warn({ err }, 'Failed to save cancelled email log'));
      } catch (err: any) {
        log.error({ err, to, orderNumber }, 'Error sending cancelled email');
        results.email = { success: false, error: err.message };
      }
    }

    if (phone) {
      try {
        const waRes = await whatsappService.sendOrderCancelledWhatsApp({
          to: String(phone),
          name: safeName,
          orderNumber,
          refundRupees: computedRefundRupees,
          reason,
        });
        results.whatsapp = waRes;

        await NotificationLog.create({
          recipient: waRes.recipient,
          subject: `WhatsApp Order #${orderNumber} Cancelled`,
          type: 'order_cancelled',
          channel: 'whatsapp',
          status: waRes.success ? 'sent' : 'failed',
          deliveryStatus: waRes.success ? 'sent' : 'failed',
          whatsappMessageId: waRes.messageId,
          body: `WhatsApp cancelled notification for #${orderNumber}`,
          metadata: { orderNumber, reason, refundRupees: computedRefundRupees, metaResponse: waRes.data, error: waRes.error },
        }).catch((err) => log.warn({ err }, 'Failed to save cancelled whatsapp log'));
      } catch (err: any) {
        log.error({ err, phone, orderNumber }, 'Error sending cancelled WhatsApp');
        results.whatsapp = { success: false, error: err.message };
      }
    }

    res.json({
      success: true,
      message: `Cancelled notifications sent for #${orderNumber}.`,
      data: results,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 6. Direct Tax Invoice PDF Download / Stream Endpoint
 * GET /api/v1/notifications/invoice/:orderNumber/pdf
 * POST /api/v1/notifications/invoice/generate
 */
export async function downloadInvoicePdf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orderNumber = req.params.orderNumber || req.body.orderNumber || req.query.orderNumber;
    if (!orderNumber) {
      res.status(400).json({ success: false, error: { code: 'MISSING_ORDER_NUMBER', message: 'orderNumber is required.' } });
      return;
    }

    const payload = req.method === 'POST' ? req.body : req.query;

    const invoiceData: InvoiceData = {
      invoiceNumber: payload.invoiceNumber || `INV-${orderNumber}`,
      orderNumber: String(orderNumber),
      invoiceDate: payload.invoiceDate ? new Date(payload.invoiceDate) : new Date(),
      orderDate: payload.orderDate ? new Date(payload.orderDate) : new Date(),
      paymentMethod: payload.paymentMethod || 'PREPAID',
      paymentReference: payload.paymentReference || String(orderNumber),
      customerName: payload.customerName || 'Customer',
      customerEmail: payload.customerEmail,
      customerPhone: payload.customerPhone,
      shippingAddress: payload.shippingAddress || {
        name: payload.customerName || 'Customer',
        line1: 'Customer Shipping Address',
        city: 'City',
        state: 'Karnataka',
        pincode: '560001',
      },
      billingAddress: payload.billingAddress || payload.shippingAddress,
      items: (payload.items || [
        {
          name: 'Order Item',
          sku: 'SKU-ESHOPY',
          quantity: 1,
          unitPrice: Number(payload.grandTotal || 0),
          lineTotal: Number(payload.grandTotal || 0),
        },
      ]).map((it: any) => ({
        name: it.name || it.title || 'Product Item',
        sku: it.sku || it.productId || 'SKU-ESHOPY',
        quantity: Number(it.quantity || 1),
        unitPrice: Number(it.unitPrice || 0),
        discount: Number(it.discount || 0),
        taxRate: Number(it.taxRate || 18),
        lineTotal: Number(it.lineTotal || (Number(it.unitPrice || 0) * Number(it.quantity || 1))),
      })),
      pricing: {
        subtotal: Number(payload.pricing?.subtotal ?? payload.grandTotal ?? 0),
        couponDiscount: Number(payload.pricing?.couponDiscount ?? 0),
        shippingCharge: Number(payload.pricing?.shippingCharge ?? 0),
        tax: Number(payload.pricing?.tax ?? 0),
        grandTotal: Number(payload.pricing?.grandTotal ?? payload.grandTotal ?? 0),
      },
    };

    const pdfBuffer = await generateInvoicePdfBuffer(invoiceData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice_${orderNumber}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

/**
 * Legacy / Generic Email endpoint (backwards compatibility)
 * POST /api/v1/notifications/send-email
 */
export async function sendEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { recipient, subject, body, type = 'general', metadata } = req.body;
    if (!recipient || !subject) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'recipient and subject required.' } });
      return;
    }

    const emailRes = await emailService.sendMail({
      to: recipient,
      subject,
      html: body || '',
    });

    const record = await NotificationLog.create({
      recipient,
      subject,
      type,
      status: emailRes.success ? (emailRes.simulated ? 'simulated' : 'sent') : 'failed',
      body,
      metadata,
    });

    res.json({
      success: true,
      message: emailRes.success ? 'Email processed successfully.' : 'Email dispatch failed.',
      data: record,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Legacy Order Confirmation endpoint (backwards compatibility)
 * POST /api/v1/notifications/order-confirmation
 */
export async function sendOrderConfirmation(req: Request, res: Response, next: NextFunction): Promise<void> {
  return notifyOrderConfirmed(req, res, next);
}

/**
 * List Notification Logs
 * GET /api/v1/notifications/logs
 */
export async function listNotificationLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const logs = await NotificationLog.find().sort({ createdAt: -1 }).limit(limit);
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
}
