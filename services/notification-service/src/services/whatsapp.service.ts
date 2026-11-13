import axios, { AxiosError } from 'axios';
import { createLogger } from '@ornate/logger';

const log = createLogger('whatsapp-service');

export interface WhatsAppConfig {
  token?: string;
  phoneNumberId?: string;
  appId?: string;
  businessAccountId?: string;
  apiVersion: string;
}

export interface SendWhatsAppTextOptions {
  to: string;
  message: string;
  previewUrl?: boolean;
}

export interface SendWhatsAppTemplateOptions {
  to: string;
  templateName?: string;
  languageCode?: string;
  components?: any[];
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  recipient: string;
  type: 'text' | 'template';
  data?: any;
  error?: {
    code?: string | number;
    message: string;
    details?: any;
    fbtrace_id?: string;
  };
}

export class WhatsAppService {
  private config: WhatsAppConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  public reloadConfig(): void {
    this.config = this.loadConfig();
  }

  private loadConfig(): WhatsAppConfig {
    return {
      token: process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '1490530494134515',
      appId: process.env.WHATSAPP_APP_ID || '2719957848437443',
      businessAccountId:
        process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ||
        process.env.WHATSAPP_MESSAGING_ACCOUNT_ID ||
        '1861063598359054',
      apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
    };
  }

  public isConfigured(): boolean {
    return Boolean(this.config.token && this.config.phoneNumberId);
  }

  public getPublicConfig() {
    return {
      configured: this.isConfigured(),
      phoneNumberId: this.config.phoneNumberId || null,
      appId: this.config.appId || null,
      businessAccountId: this.config.businessAccountId || null,
      apiVersion: this.config.apiVersion,
      hasToken: Boolean(this.config.token),
      webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || null,
    };
  }

  /**
   * Normalizes incoming phone numbers to international E.164 digits format (without '+').
   * Examples:
   *  "+91 98765 43210" -> "919876543210"
   *  "9876543210"      -> "919876543210" (default Indian country code 91)
   *  "09876543210"     -> "919876543210"
   */
  public normalizePhoneNumber(phone: string, defaultCountryCode = '91'): string {
    if (!phone) return '';
    // Strip everything except digits
    let cleaned = phone.replace(/\D/g, '');

    // If starts with 0 and 11 digits (e.g. 09876543210 in India), drop the leading 0
    if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = cleaned.substring(1);
    }

    // Standard 10-digit mobile number: prepend default country code (91)
    if (cleaned.length === 10) {
      cleaned = `${defaultCountryCode}${cleaned}`;
    }

    return cleaned;
  }

  /**
   * Send a freeform text message (valid within 24hr service window or to whitelisted test numbers in sandbox)
   */
  public async sendTextMessage(options: SendWhatsAppTextOptions): Promise<WhatsAppSendResult> {
    const recipient = this.normalizePhoneNumber(options.to);
    if (!recipient) {
      return {
        success: false,
        recipient: options.to,
        type: 'text',
        error: { code: 'INVALID_PHONE_NUMBER', message: 'Recipient phone number is invalid or empty.' },
      };
    }

    if (!options.message || !options.message.trim()) {
      return {
        success: false,
        recipient,
        type: 'text',
        error: { code: 'EMPTY_MESSAGE', message: 'Message text cannot be empty.' },
      };
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        recipient,
        type: 'text',
        error: {
          code: 'WHATSAPP_NOT_CONFIGURED',
          message: 'WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID is missing from environment.',
        },
      };
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'text',
      text: {
        preview_url: Boolean(options.previewUrl),
        body: options.message,
      },
    };

    return this.dispatchMetaRequest(recipient, payload, 'text');
  }

  /**
   * Send an official WhatsApp pre-approved Template message (e.g. hello_world for testing, or order_confirmation)
   */
  public async sendTemplateMessage(options: SendWhatsAppTemplateOptions): Promise<WhatsAppSendResult> {
    const recipient = this.normalizePhoneNumber(options.to);
    if (!recipient) {
      return {
        success: false,
        recipient: options.to,
        type: 'template',
        error: { code: 'INVALID_PHONE_NUMBER', message: 'Recipient phone number is invalid or empty.' },
      };
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        recipient,
        type: 'template',
        error: {
          code: 'WHATSAPP_NOT_CONFIGURED',
          message: 'WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID is missing from environment.',
        },
      };
    }

    const templateName = options.templateName || 'hello_world';
    const languageCode = options.languageCode || 'en_US';

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
      },
    };

    if (options.components && Array.isArray(options.components) && options.components.length > 0) {
      payload.template.components = options.components;
    }

    return this.dispatchMetaRequest(recipient, payload, 'template');
  }

  private async dispatchMetaRequest(
    recipient: string,
    payload: any,
    type: 'text' | 'template',
  ): Promise<WhatsAppSendResult> {
    const url = `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`;

    try {
      log.info({ recipient, type, phoneNumberId: this.config.phoneNumberId }, 'Dispatching WhatsApp message to Meta');

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      const responseData = response.data;
      const messageId = responseData?.messages?.[0]?.id;

      log.info({ recipient, messageId, status: response.status }, 'WhatsApp message accepted by Meta API');

      return {
        success: true,
        messageId,
        recipient,
        type,
        data: responseData,
      };
    } catch (err: any) {
      const axiosErr = err as AxiosError<any>;
      const metaError = axiosErr.response?.data?.error;

      log.error(
        {
          recipient,
          type,
          status: axiosErr.response?.status,
          metaError,
          rawError: axiosErr.message,
        },
        'WhatsApp dispatch failed',
      );

      const friendlyMessage =
        metaError?.message ||
        (axiosErr.response?.status === 401
          ? 'Invalid or expired WhatsApp Access Token.'
          : axiosErr.response?.status === 400
            ? 'Bad Request: Check recipient phone number or message format.'
            : axiosErr.message || 'Failed to dispatch WhatsApp message.');

      return {
        success: false,
        recipient,
        type,
        error: {
          code: metaError?.code || axiosErr.response?.status || 'META_API_ERROR',
          message: friendlyMessage,
          details: metaError || axiosErr.response?.data || axiosErr.message,
          fbtrace_id: metaError?.fbtrace_id,
        },
      };
    }
  }
}

export const whatsappService = new WhatsAppService();

