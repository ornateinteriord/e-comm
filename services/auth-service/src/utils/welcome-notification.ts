import { createLogger } from '@ornate/logger';

const log = createLogger('welcome-notification');

const REMOTE_NOTIFICATION_URL = (process.env.NOTIFICATION_SERVICE_URL || '').replace(/\/+$/, '');
const LOCAL_NOTIFICATION_URL = 'http://localhost:4010';

export function triggerCustomerWelcomeNotification(customer: {
  email?: string;
  mobileNumber?: string;
  phone?: string;
  fullName?: string;
  name?: string;
  customerId?: string;
}): void {
  const to = customer.email;
  const phone = customer.mobileNumber || customer.phone;
  const name = customer.fullName || customer.name || 'Shopper';
  const customerId = customer.customerId;

  if (!to && !phone) return;

  const payload = {
    to,
    phone,
    name,
    customerId,
    loginUrl: 'https://eshopy.biz/login',
  };

  // Dispatch function with local fallback
  const sendRequest = async () => {
    // Try local notification service first if running locally
    const targetUrl = LOCAL_NOTIFICATION_URL;
    try {
      const res = await fetch(`${targetUrl}/api/v1/notifications/welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        log.info({ email: to, phone, status: res.status, via: targetUrl }, 'Welcome notification dispatched locally');
        return;
      }
    } catch {
      // Local not running or timed out; fallback to remote
    }

    if (REMOTE_NOTIFICATION_URL && REMOTE_NOTIFICATION_URL !== LOCAL_NOTIFICATION_URL) {
      try {
        const res = await fetch(`${REMOTE_NOTIFICATION_URL}/api/v1/notifications/welcome`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        log.info({ email: to, phone, status: res.status, via: REMOTE_NOTIFICATION_URL }, 'Welcome notification dispatched via remote');
      } catch (remoteErr: any) {
        log.warn({ err: remoteErr?.message, email: to, phone }, 'Failed to dispatch welcome notification (non-blocking)');
      }
    }
  };

  sendRequest().catch((err) => log.warn({ err: err?.message }, 'Welcome dispatch exception'));
}

