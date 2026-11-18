import axios from 'axios';
import { createLogger } from '@ornate/logger';

const log = createLogger('order-notification-client');

const REMOTE_NOTIFICATION_URL = (process.env.NOTIFICATION_SERVICE_URL || '').replace(/\/+$/, '');
const LOCAL_NOTIFICATION_URL = 'http://localhost:4010';

async function dispatchNotification(path: string, payload: any, timeoutMs = 10000): Promise<void> {
  // Try local notification service first if running
  try {
    const res = await axios.post(`${LOCAL_NOTIFICATION_URL}${path}`, payload, { timeout: 3000 });
    log.info({ path, status: res.status, via: LOCAL_NOTIFICATION_URL }, 'Notification delivered locally');
    return;
  } catch {
    // Local not running or timed out; fallback to remote
  }

  if (REMOTE_NOTIFICATION_URL && REMOTE_NOTIFICATION_URL !== LOCAL_NOTIFICATION_URL) {
    try {
      const res = await axios.post(`${REMOTE_NOTIFICATION_URL}${path}`, payload, { timeout: timeoutMs });
      log.info({ path, status: res.status, via: REMOTE_NOTIFICATION_URL }, 'Notification delivered via remote');
    } catch (err: any) {
      log.warn({ path, err: err?.response?.data || err?.message }, 'Failed to deliver notification (non-blocking)');
    }
  }
}

/**
 * Fire-and-forget Order Confirmed notification (Sends Email with Tax Invoice PDF + WhatsApp)
 */
export async function triggerOrderConfirmedNotification(order: any): Promise<void> {
  if (!order || !order.orderNumber) return;

  try {
    const payload = {
      to: order.customerEmail,
      phone: order.customerPhone || order.shippingAddress?.phone || '',
      name: order.customerName || order.shippingAddress?.name || 'Customer',
      orderNumber: order.orderNumber,
      items: (order.items || []).map((it: any) => ({
        name: it.productName || it.name || 'Product',
        sku: it.sku || it.productId || 'SKU-ESHOPY',
        quantity: Number(it.quantity || 1),
        unitPrice: Number(it.unitPrice || it.price || 0),
        discount: Number(it.discount || 0),
        taxRate: Number(it.taxRate || 18),
        lineTotal: Number(it.lineTotal || (Number(it.unitPrice || 0) * Number(it.quantity || 1))),
      })),
      pricing: {
        subtotal: Number(order.pricing?.subtotal || order.pricing?.grandTotal || 0),
        couponDiscount: Number(order.pricing?.couponDiscount || 0),
        shippingCharge: Number(order.pricing?.shippingCharge || 0),
        tax: Number(order.pricing?.tax || 0),
        grandTotal: Number(order.pricing?.grandTotal || 0),
      },
      grandTotal: Number(order.pricing?.grandTotal || 0),
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress || order.shippingAddress,
      paymentMethod: order.paymentMethod || 'PREPAID',
      paymentReference: order.paymentReference || order.orderNumber,
      orderDate: order.createdAt,
    };

    log.info({ orderNumber: order.orderNumber, to: payload.to }, 'Triggering order-confirmed notification');
    dispatchNotification('/api/v1/notifications/order-confirmed', payload, 15000).catch((err) =>
      log.warn({ err: err?.message }, 'Error in order-confirmed dispatch'),
    );
  } catch (err) {
    log.error({ err, orderNumber: order?.orderNumber }, 'Exception preparing order confirmed notification');
  }
}

/**
 * Fire-and-forget Order Dispatched notification (Sends Email with courier/tracking + WhatsApp)
 */
export async function triggerOrderDispatchedNotification(
  order: any,
  shippingDetails?: { courierName?: string; trackingNumber?: string; trackingUrl?: string },
): Promise<void> {
  if (!order || !order.orderNumber) return;

  try {
    const payload = {
      to: order.customerEmail,
      phone: order.customerPhone || order.shippingAddress?.phone || '',
      name: order.customerName || order.shippingAddress?.name || 'Customer',
      orderNumber: order.orderNumber,
      courierName: shippingDetails?.courierName || order.shippingProvider || 'Express Logistics',
      trackingNumber: shippingDetails?.trackingNumber || order.trackingNumber || 'AWB-PENDING',
      trackingUrl:
        shippingDetails?.trackingUrl ||
        (shippingDetails?.trackingNumber ? `https://eshopy.biz/orders` : undefined),
    };

    log.info({ orderNumber: order.orderNumber, courier: payload.courierName }, 'Triggering order-dispatched notification');
    dispatchNotification('/api/v1/notifications/order-dispatched', payload, 10000).catch((err) =>
      log.warn({ err: err?.message }, 'Error in order-dispatched dispatch'),
    );
  } catch (err) {
    log.error({ err, orderNumber: order?.orderNumber }, 'Exception preparing order dispatched notification');
  }
}

/**
 * Fire-and-forget Order Delivered notification (Sends Email + WhatsApp)
 */
export async function triggerOrderDeliveredNotification(order: any): Promise<void> {
  if (!order || !order.orderNumber) return;

  try {
    const payload = {
      to: order.customerEmail,
      phone: order.customerPhone || order.shippingAddress?.phone || '',
      name: order.customerName || order.shippingAddress?.name || 'Customer',
      orderNumber: order.orderNumber,
    };

    log.info({ orderNumber: order.orderNumber }, 'Triggering order-delivered notification');
    dispatchNotification('/api/v1/notifications/order-delivered', payload, 10000).catch((err) =>
      log.warn({ err: err?.message }, 'Error in order-delivered dispatch'),
    );
  } catch (err) {
    log.error({ err, orderNumber: order?.orderNumber }, 'Exception preparing order delivered notification');
  }
}

/**
 * Fire-and-forget Order Cancelled notification (Sends Email + WhatsApp)
 */
export async function triggerOrderCancelledNotification(
  order: any,
  cancellationDetails?: { reason?: string; refundAmount?: number; refundRupees?: string },
): Promise<void> {
  if (!order || !order.orderNumber) return;

  try {
    const refundRupees =
      cancellationDetails?.refundRupees ||
      (cancellationDetails?.refundAmount
        ? (cancellationDetails.refundAmount / 100).toFixed(2)
        : ((order.pricing?.grandTotal || 0) / 100).toFixed(2));

    const payload = {
      to: order.customerEmail,
      phone: order.customerPhone || order.shippingAddress?.phone || '',
      name: order.customerName || order.shippingAddress?.name || 'Customer',
      orderNumber: order.orderNumber,
      reason: cancellationDetails?.reason || 'Order cancelled',
      refundRupees,
      refundAmount: cancellationDetails?.refundAmount || order.pricing?.grandTotal,
    };

    log.info({ orderNumber: order.orderNumber, reason: payload.reason }, 'Triggering order-cancelled notification');
    dispatchNotification('/api/v1/notifications/order-cancelled', payload, 10000).catch((err) =>
      log.warn({ err: err?.message }, 'Error in order-cancelled dispatch'),
    );
  } catch (err) {
    log.error({ err, orderNumber: order?.orderNumber }, 'Exception preparing order cancelled notification');
  }
}

