import nodemailer from 'nodemailer';
import path from 'node:path';
import fs from 'node:fs';
import { createLogger } from '@ornate/logger';

const log = createLogger('email-service');

function findLogoFile(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'services/notification-service/src/assets/logo.png'),
    path.resolve(process.cwd(), 'services/notification-service/dist/assets/logo.png'),
    path.resolve(process.cwd(), 'src/assets/logo.png'),
    path.resolve(process.cwd(), 'dist/assets/logo.png'),
    path.resolve(process.cwd(), 'public/logo.png'),
    path.resolve(process.cwd(), '../../public/logo.png'),
    path.resolve(process.cwd(), 'apps/web/public/logo.png'),
    path.resolve(process.cwd(), '../../apps/web/public/logo.png'),
  ];
  for (const f of candidates) {
    if (fs.existsSync(f)) {
      return f;
    }
  }
  return null;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private fromEmail: string;

  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || '"E-Shopy" <ornateinteriord@gmail.com>';
    this.initTransporter();
  }

  private initTransporter(): void {
    const user = process.env.EMAIL_USER || process.env.SMTP_USER;
    const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT || 465);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (user && pass && !user.includes('mock') && !pass.includes('mock')) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: { user, pass },
        });
        log.info({ host, port, user }, 'Real SMTP transporter initialized');
      } catch (err) {
        log.error({ err }, 'Failed to initialize SMTP transporter');
      }
    } else {
      log.warn('No valid SMTP credentials found; running in simulation mode');
    }
  }

  public async sendMail(options: {
    to: string;
    subject: string;
    html: string;
    attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string; cid?: string }>;
  }): Promise<{ success: boolean; messageId?: string; simulated?: boolean; error?: string }> {
    if (!this.transporter) {
      log.info({ to: options.to, subject: options.subject }, 'Simulated Email (transporter not configured)');
      return { success: true, simulated: true };
    }

    try {
      const logoFile = findLogoFile();
      const allAttachments = [...(options.attachments || [])];

      // Attach logo with CID if not already attached and html references cid:eshopylogo
      if (logoFile && options.html.includes('cid:eshopylogo') && !allAttachments.some((a) => a.cid === 'eshopylogo')) {
        allAttachments.push({
          filename: 'logo.png',
          content: fs.readFileSync(logoFile),
          contentType: 'image/png',
          cid: 'eshopylogo',
        });
      }

      const info = await this.transporter.sendMail({
        from: this.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: allAttachments,
      });

      log.info({ to: options.to, subject: options.subject, messageId: info.messageId }, 'Email sent successfully');
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      log.error({ err: err?.message, to: options.to, subject: options.subject }, 'Failed to send real email');
      return { success: false, error: err?.message };
    }
  }

  /**
   * Base Email Shell matching E-Shopy's signature corporate branding
   */
  private buildBaseTemplate(title: string, contentHtml: string): string {
    const logoFile = findLogoFile();
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; padding: 36px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #E2E8F0;">
          
          <!-- Header Bar -->
          <tr>
            <td style="background-color: #FFFFFF; padding: 28px 24px 20px 24px; text-align: center; border-bottom: 3.5px solid #FF7900;">
              ${
                logoFile
                  ? `<img src="cid:eshopylogo" alt="E-Shopy" style="height: 52px; max-height: 52px; width: auto; max-width: 240px; object-fit: contain; display: block; margin: 0 auto 8px auto;" />`
                  : `<div style="font-size: 28px; font-weight: 900; letter-spacing: -0.5px; color: #0F172A; margin: 0 0 6px 0;">E-<span style="color: #FF7900;">Shopy</span></div>`
              }
              <div style="font-size: 11.5px; color: #64748B; margin-top: 4px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;">
                Your Trusted Online Marketplace
              </div>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 32px 28px 24px 28px;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Corporate Footer -->
          <tr>
            <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 24px 28px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748B; font-weight: 600;">
                E-Shopy Retail (Pvt Ltd) • www.eshopy.biz
              </p>
              <p style="margin: 0 0 10px 0; font-size: 11px; color: #94A3B8; line-height: 1.5;">
                Admin: Shop No. G2, Asha Chandra Trade Center, Court Road, Udupi, Karnataka - 576101<br/>
                Regd: L-29 Block L Mohan Garden, Uttam Nagar, New Delhi - 110059
              </p>
              <p style="margin: 0; font-size: 11.5px; color: #64748B;">
                Need help? Contact <a href="mailto:77411011100sandeep@gmail.com" style="color: #FF7900; text-decoration: none; font-weight: 700;">77411011100sandeep@gmail.com</a> or call <strong style="color: #0F172A;">+91 7676518566</strong>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  /**
   * 1. Welcome Email (with Direct Login URL)
   */
  public async sendWelcomeEmail(data: {
    to: string;
    name: string;
    customerId?: string;
    loginUrl?: string;
  }): Promise<{ success: boolean; messageId?: string }> {
    const safeName = data.name || 'Customer';
    const loginUrl = data.loginUrl || 'https://eshopy.biz/login';

    const body = `
      <h2 style="font-size: 22px; font-weight: 800; color: #0F172A; margin: 0 0 16px 0;">
        Welcome to E-Shopy, ${safeName}! 🎉
      </h2>
      <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 16px 0;">
        We are thrilled to welcome you to the E-Shopy family. Your account has been registered successfully.
      </p>

      ${
        data.customerId
          ? `
      <div style="background-color: #F8FAFC; border: 1.5px dashed #CBD5E1; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
        <span style="font-size: 12px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">
          Your Customer ID
        </span>
        <span style="font-size: 20px; font-weight: 900; color: #0F172A; letter-spacing: 1px;">
          ${data.customerId}
        </span>
      </div>`
          : ''
      }

      <p style="font-size: 14.5px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
        You can now discover exclusive deals, track all your orders in real time, and enjoy high-speed doorstep deliveries.
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${loginUrl}" style="background-color: #FF7900; color: #FFFFFF; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 34px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 14px rgba(255, 121, 0, 0.35);">
          Login to Your Account →
        </a>
      </div>

      <p style="font-size: 12.5px; color: #94A3B8; text-align: center; margin: 0;">
        Or copy and open this URL in your browser: <br/>
        <a href="${loginUrl}" style="color: #64748B; word-break: break-all;">${loginUrl}</a>
      </p>
    `;

    const html = this.buildBaseTemplate('Welcome to E-Shopy', body);
    return this.sendMail({
      to: data.to,
      subject: `Welcome to E-Shopy, ${safeName}! Your account is ready`,
      html,
    });
  }

  /**
   * 2. Order Confirmed & Paid Email (with attached PDF Invoice)
   */
  public async sendOrderConfirmedEmail(data: {
    to: string;
    name: string;
    orderNumber: string;
    items: Array<{ name: string; quantity: number; unitPrice: number; lineTotal: number }>;
    grandTotal: number;
    paymentReference?: string;
    shippingAddress?: any;
    pdfBuffer?: Buffer;
  }): Promise<{ success: boolean; messageId?: string }> {
    const safeName = data.name || 'Valued Customer';
    const totalRupees = ((data.grandTotal || 0) / 100).toFixed(2);

    const itemsRows = (data.items || [])
      .map(
        (it) => `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; font-size: 13.5px; color: #0F172A; font-weight: 600;">
            ${it.name}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; font-size: 13.5px; text-align: center; color: #475569;">
            ${it.quantity}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; font-size: 13.5px; text-align: right; color: #0F172A; font-weight: 700;">
            ₹${((it.lineTotal || 0) / 100).toFixed(2)}
          </td>
        </tr>`,
      )
      .join('');

    const body = `
      <div style="background-color: #ECFDF5; border-left: 4px solid #10B981; padding: 14px 18px; border-radius: 8px; margin-bottom: 24px;">
        <span style="font-size: 16px; font-weight: 800; color: #065F46; display: block;">
          Payment Confirmed & Order Placed! ✓
        </span>
        <span style="font-size: 13px; color: #047857; display: block; margin-top: 3px;">
          Your order has been verified. We are preparing your items for delivery.
        </span>
      </div>

      <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0;">
        Hello <strong>${safeName}</strong>,
      </p>
      <p style="font-size: 14.5px; color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
        Thank you for shopping with E-Shopy. We have received your payment of <strong style="color: #0F172A;">₹${totalRupees}</strong> for Order <strong style="color: #FF7900;">#${data.orderNumber}</strong>.
      </p>

      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin: 20px 0; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background-color: #F8FAFC;">
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 700; color: #64748B; text-transform: uppercase;">Item</th>
            <th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 700; color: #64748B; text-transform: uppercase;">Qty</th>
            <th style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: 700; color: #64748B; text-transform: uppercase;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
        <tfoot>
          <tr style="background-color: #0F172A;">
            <td colspan="2" style="padding: 12px; font-size: 14px; font-weight: 800; color: #FFFFFF;">
              Amount Paid (Inc. GST)
            </td>
            <td style="padding: 12px; font-size: 15px; font-weight: 900; color: #FF7900; text-align: right;">
              ₹${totalRupees}
            </td>
          </tr>
        </tfoot>
      </table>

      ${
        data.shippingAddress
          ? `
      <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px 18px; margin: 20px 0;">
        <span style="font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; display: block; margin-bottom: 6px;">
          Delivery Address
        </span>
        <div style="font-size: 13.5px; color: #1E293B; line-height: 1.5;">
          <strong>${data.shippingAddress.name || safeName}</strong><br/>
          ${data.shippingAddress.line1 || ''} ${data.shippingAddress.line2 || ''}<br/>
          ${data.shippingAddress.city || ''}, ${data.shippingAddress.state || ''} - ${data.shippingAddress.pincode || ''}<br/>
          Mobile: ${data.shippingAddress.phone || 'N/A'}
        </div>
      </div>`
          : ''
      }

      <div style="background-color: #FFF7ED; border: 1px solid #FFEDD5; border-radius: 8px; padding: 12px 16px; margin: 20px 0;">
        <span style="font-size: 13px; color: #C2410C; font-weight: 700; display: block;">
          📎 Official Tax Invoice Attached
        </span>
        <span style="font-size: 12px; color: #9A3412;">
          Your GST-compliant commercial tax invoice has been generated and attached as a PDF to this email for your records and warranty.
        </span>
      </div>

      <div style="text-align: center; margin: 28px 0 10px 0;">
        <a href="https://eshopy.biz/orders" style="background-color: #0F172A; color: #FFFFFF; font-size: 14px; font-weight: 800; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block;">
          Track Order on E-Shopy →
        </a>
      </div>
    `;

    const html = this.buildBaseTemplate(`Order Confirmed - #${data.orderNumber}`, body);
    const attachments = data.pdfBuffer
      ? [
          {
            filename: `Invoice_${data.orderNumber}.pdf`,
            content: data.pdfBuffer,
            contentType: 'application/pdf',
          },
        ]
      : [];

    return this.sendMail({
      to: data.to,
      subject: `Order Confirmed: #${data.orderNumber} (Invoice Attached)`,
      html,
      attachments,
    });
  }

  /**
   * 3. Order Dispatched / Shipped Email
   */
  public async sendOrderDispatchedEmail(data: {
    to: string;
    name: string;
    orderNumber: string;
    courierName: string;
    trackingNumber: string;
    trackingUrl?: string;
  }): Promise<{ success: boolean; messageId?: string }> {
    const safeName = data.name || 'Customer';
    const trackUrl = data.trackingUrl || `https://eshopy.biz/orders`;

    const body = `
      <div style="background-color: #EFF6FF; border-left: 4px solid #3B82F6; padding: 14px 18px; border-radius: 8px; margin-bottom: 24px;">
        <span style="font-size: 16px; font-weight: 800; color: #1E40AF; display: block;">
          Your Order is on the Way! 🚚
        </span>
        <span style="font-size: 13px; color: #1D4ED8; display: block; margin-top: 3px;">
          Your package has been dispatched and is currently in transit.
        </span>
      </div>

      <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0;">
        Hello <strong>${safeName}</strong>,
      </p>
      <p style="font-size: 14.5px; color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
        Great news! Items from your order <strong style="color: #FF7900;">#${data.orderNumber}</strong> have been packed and handed over to our delivery partner.
      </p>

      <!-- Tracking Card -->
      <div style="background-color: #F8FAFC; border: 1.5px solid #CBD5E1; border-radius: 12px; padding: 20px 24px; margin: 24px 0;">
        <table width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td>
              <span style="font-size: 11.5px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; display: block;">
                Courier Partner
              </span>
              <span style="font-size: 16px; font-weight: 800; color: #0F172A; display: block; margin-top: 3px;">
                ${data.courierName || 'Standard Express'}
              </span>
            </td>
            <td align="right">
              <span style="font-size: 11.5px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; display: block;">
                Tracking Number (AWB)
              </span>
              <span style="font-size: 16px; font-weight: 800; color: #FF7900; font-family: monospace; display: block; margin-top: 3px;">
                ${data.trackingNumber || 'N/A'}
              </span>
            </td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 28px 0 10px 0;">
        <a href="${trackUrl}" style="background-color: #FF7900; color: #FFFFFF; font-size: 14.5px; font-weight: 800; text-decoration: none; padding: 13px 32px; border-radius: 8px; display: inline-block; box-shadow: 0 4px 14px rgba(255, 121, 0, 0.3);">
          Track Your Package →
        </a>
      </div>
    `;

    const html = this.buildBaseTemplate(`Order Dispatched - #${data.orderNumber}`, body);
    return this.sendMail({
      to: data.to,
      subject: `Your order #${data.orderNumber} is on the way! (${data.courierName || 'Dispatched'})`,
      html,
    });
  }

  /**
   * 4. Order Delivered Email
   */
  public async sendOrderDeliveredEmail(data: {
    to: string;
    name: string;
    orderNumber: string;
  }): Promise<{ success: boolean; messageId?: string }> {
    const safeName = data.name || 'Customer';

    const body = `
      <div style="background-color: #ECFDF5; border-left: 4px solid #10B981; padding: 14px 18px; border-radius: 8px; margin-bottom: 24px;">
        <span style="font-size: 16px; font-weight: 800; color: #065F46; display: block;">
          Delivered Successfully! 📦
        </span>
        <span style="font-size: 13px; color: #047857; display: block; margin-top: 3px;">
          Your package has been safely handed over.
        </span>
      </div>

      <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0;">
        Hello <strong>${safeName}</strong>,
      </p>
      <p style="font-size: 14.5px; color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
        Your order <strong style="color: #FF7900;">#${data.orderNumber}</strong> has been successfully delivered. We hope you love your new purchase!
      </p>

      <p style="font-size: 14px; color: #64748B; line-height: 1.5; margin: 0 0 24px 0;">
        If you have any questions, return requests, or warranty claims, our concierge team is always here for you at <strong style="color: #0F172A;">77411011100sandeep@gmail.com</strong>.
      </p>

      <div style="text-align: center; margin: 26px 0 10px 0;">
        <a href="https://eshopy.biz/orders" style="background-color: #0F172A; color: #FFFFFF; font-size: 14px; font-weight: 800; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block;">
          View Order & Download Invoice →
        </a>
      </div>
    `;

    const html = this.buildBaseTemplate(`Delivered - #${data.orderNumber}`, body);
    return this.sendMail({
      to: data.to,
      subject: `Delivered: Your E-Shopy order #${data.orderNumber} has arrived!`,
      html,
    });
  }

  /**
   * 5. Order Cancelled Email
   */
  public async sendOrderCancelledEmail(data: {
    to: string;
    name: string;
    orderNumber: string;
    reason?: string;
    refundAmount?: number;
  }): Promise<{ success: boolean; messageId?: string }> {
    const safeName = data.name || 'Customer';
    const refundRupees = data.refundAmount ? (data.refundAmount / 100).toFixed(2) : null;

    const body = `
      <div style="background-color: #FEF2F2; border-left: 4px solid #EF4444; padding: 14px 18px; border-radius: 8px; margin-bottom: 24px;">
        <span style="font-size: 16px; font-weight: 800; color: #991B1B; display: block;">
          Order Cancelled
        </span>
        <span style="font-size: 13px; color: #B91C1C; display: block; margin-top: 3px;">
          Your order #${data.orderNumber} has been cancelled.
        </span>
      </div>

      <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0;">
        Hello <strong>${safeName}</strong>,
      </p>
      <p style="font-size: 14.5px; color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        As requested, order <strong style="color: #0F172A;">#${data.orderNumber}</strong> has been cancelled.
        ${data.reason ? `<br/>Reason: <em>${data.reason}</em>` : ''}
      </p>

      ${
        refundRupees
          ? `
      <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px 20px; margin: 20px 0;">
        <span style="font-size: 12px; font-weight: 800; color: #64748B; text-transform: uppercase; display: block; margin-bottom: 4px;">
          Refund Status
        </span>
        <span style="font-size: 17px; font-weight: 900; color: #16A34A; display: block;">
          ₹${refundRupees} Refund Initiated
        </span>
        <span style="font-size: 12.5px; color: #64748B; display: block; margin-top: 4px;">
          Amount will be credited back to your original payment method or wallet within 3-5 business days.
        </span>
      </div>`
          : ''
      }
    `;

    const html = this.buildBaseTemplate(`Order Cancelled - #${data.orderNumber}`, body);
    return this.sendMail({
      to: data.to,
      subject: `Order Cancelled: #${data.orderNumber}`,
      html,
    });
  }
}

export const emailService = new EmailService();

