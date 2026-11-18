import axios, { AxiosInstance } from 'axios';
import { createLogger } from '@ornate/logger';

const log = createLogger('shadowfax-service');

export interface ShadowfaxPickupAddress {
  name: string;
  contact: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state?: string;
  pincode: string | number;
}

export interface ShadowfaxDeliveryAddress {
  name: string;
  contact: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state?: string;
  pincode: string | number;
}

export interface ShadowfaxProductItem {
  sku_name: string;
  sku_id: string;
  price: number;
  category?: string;
  brand?: string;
}

export interface CreateForwardOrderPayload {
  client_order_id: string;
  product_value: number;
  payment_mode: 'prepaid' | 'cod';
  cod_amount?: number;
  order_service?: string;
  customer_details: ShadowfaxDeliveryAddress;
  pickup_details: ShadowfaxPickupAddress;
  return_details: ShadowfaxPickupAddress;
  product_details: ShadowfaxProductItem[];
}

export interface ShadowfaxOrderResponse {
  message: string;
  errors?: string | null;
  data?: {
    id: number;
    client_name: string;
    client_order_id: string;
    awb_number: string;
    product_value: number;
    cod_amount: number;
    payment_mode: string;
    status: string;
    status_display: string;
    destination_hub?: string;
    sort_code?: string;
    [key: string]: any;
  };
}

export class ShadowfaxService {
  private client: AxiosInstance;
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = (process.env.SHADOWFAX_BASE_URL || 'https://dale.staging.shadowfax.in/api').replace(/\/+$/, '');
    this.token = process.env.SHADOWFAX_API_TOKEN || '916881b1ca779725db6f0b6f27ba6692ac34d86f';

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Token ${this.token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  /**
   * Check delivery or pickup serviceability for a given 6-digit pincode.
   * Service types: 'customer_delivery' | 'seller_pickup' | 'seller_delivery' | 'marketplace'
   */
  async checkServiceability(
    pincode: string | number,
    service: 'customer_delivery' | 'seller_pickup' | 'seller_delivery' | 'marketplace' = 'customer_delivery',
  ): Promise<{ serviceable: boolean; services: string[]; message?: string }> {
    try {
      const cleanPincode = String(pincode).trim();
      const res = await this.client.get('/v1/clients/serviceability/', {
        params: {
          service,
          pincodes: cleanPincode,
        },
      });

      if (Array.isArray(res.data) && res.data.length > 0) {
        const entry = res.data.find((e: any) => String(e.code) === cleanPincode) || res.data[0];
        const services = Array.isArray(entry?.services) ? entry.services : [];
        return {
          serviceable: services.length > 0,
          services,
        };
      }

      return {
        serviceable: false,
        services: [],
        message: 'No service tier available for this pincode',
      };
    } catch (err: any) {
      log.error({ err: err?.message, pincode, service }, 'Error checking Shadowfax serviceability');
      return {
        serviceable: false,
        services: [],
        message: err.response?.data?.message || err.message,
      };
    }
  }

  /**
   * Get estimated rate for shipping between origin (pickup) and destination pincodes.
   */
  async calculateRate(
    originPincode: string | number,
    destinationPincode: string | number,
    weightKg: number = 1.0,
    service: string = 'forward',
  ): Promise<{
    shippingRate: number;
    gst: number;
    total: number;
    zone: string;
  } | null> {
    try {
      const payload = {
        origin_pincode: Number(originPincode),
        destination_pincode: Number(destinationPincode),
        weight: Number(weightKg) || 1.0,
        service,
      };

      const res = await this.client.post('/v1/clients/rate_calculator/', payload);
      if (res.data?.message === 'Success' && res.data?.shipping_rate) {
        const shippingRate = parseFloat(res.data.shipping_rate) || 0;
        const gst = parseFloat(res.data.gst) || 0;
        return {
          shippingRate,
          gst,
          total: Number((shippingRate + gst).toFixed(2)),
          zone: res.data.zone || 'Default',
        };
      }
      return null;
    } catch (err: any) {
      log.warn({ err: err?.message, originPincode, destinationPincode }, 'Rate calculator returned no rate or error');
      return null;
    }
  }

  /**
   * Place Forward Delivery Order with Shadowfax.
   */
  async placeForwardOrder(params: CreateForwardOrderPayload): Promise<ShadowfaxOrderResponse> {
    try {
      const payload = {
        customer_details: {
          name: params.customer_details.name,
          contact: params.customer_details.contact.replace(/\D/g, '').slice(-10),
          address_line_1: params.customer_details.address_line_1,
          address_line_2: params.customer_details.address_line_2 || undefined,
          city: params.customer_details.city || 'BANGALORE',
          state: params.customer_details.state || undefined,
          pincode: Number(params.customer_details.pincode),
        },
        order_details: {
          client_order_id: params.client_order_id,
          product_value: Number(params.product_value),
          payment_mode: params.payment_mode,
          cod_amount: params.payment_mode === 'cod' ? Number(params.cod_amount || 0) : 0,
          order_service: params.order_service || 'Regular',
        },
        pickup_details: {
          pickup_type: 'seller',
          name: params.pickup_details.name,
          contact: params.pickup_details.contact.replace(/\D/g, '').slice(-10),
          address_line_1: params.pickup_details.address_line_1,
          address_line_2: params.pickup_details.address_line_2 || undefined,
          city: params.pickup_details.city || 'NEW DELHI',
          state: params.pickup_details.state || undefined,
          pincode: Number(params.pickup_details.pincode),
        },
        return_details: {
          return_type: 'seller',
          name: params.return_details.name || params.pickup_details.name,
          contact: (params.return_details.contact || params.pickup_details.contact).replace(/\D/g, '').slice(-10),
          address_line_1: params.return_details.address_line_1 || params.pickup_details.address_line_1,
          address_line_2: params.return_details.address_line_2 || params.pickup_details.address_line_2 || undefined,
          city: params.return_details.city || params.pickup_details.city || 'NEW DELHI',
          state: params.return_details.state || params.pickup_details.state || undefined,
          pincode: Number(params.return_details.pincode || params.pickup_details.pincode),
        },
        product_details: params.product_details.map((p) => ({
          sku_name: p.sku_name,
          sku_id: p.sku_id,
          price: Number(p.price),
          category: p.category || 'General',
          brand: p.brand || undefined,
        })),
      };

      log.info({ client_order_id: params.client_order_id }, 'Submitting forward order to Shadowfax');
      const res = await this.client.post('/v3/clients/orders/', payload);

      if (res.data?.message === 'Failure') {
        throw new Error(res.data?.errors || 'Shadowfax rejected order placement');
      }

      return res.data;
    } catch (err: any) {
      log.error({ err: err?.response?.data || err.message, client_order_id: params.client_order_id }, 'Failed to place forward order in Shadowfax');
      throw new Error(err.response?.data?.errors || err.response?.data?.message || err.message);
    }
  }

  /**
   * Generate downloadable / printable shipping label PDF for an AWB.
   */
  async generateShippingLabel(awbNumber: string, fileType: 'pdf' | 'prn' = 'pdf'): Promise<{ labelUrl: string }> {
    try {
      const res = await this.client.post('/client/generate_label/', {
        awb_number: awbNumber,
        file_type: fileType,
      });

      if (res.data?.data?.label_url) {
        return { labelUrl: res.data.data.label_url };
      }
      throw new Error(res.data?.message || 'Could not generate shipping label');
    } catch (err: any) {
      log.error({ err: err?.response?.data || err.message, awbNumber }, 'Error generating Shadowfax shipping label');
      throw new Error(err.response?.data?.message || err.message);
    }
  }

  /**
   * Track an order via its AWB Number.
   */
  async trackOrder(awbNumber: string): Promise<{
    orderDetails: any;
    trackingDetails: Array<{
      created?: string;
      location?: string;
      status_id?: string;
      status?: string;
      remarks?: string;
      awb_number?: string;
    }>;
  }> {
    try {
      const res = await this.client.get(`/v4/clients/orders/${awbNumber}/track/`);
      return {
        orderDetails: res.data?.order_details || {},
        trackingDetails: Array.isArray(res.data?.tracking_details) ? res.data.tracking_details : [],
      };
    } catch (err: any) {
      log.error({ err: err?.response?.data || err.message, awbNumber }, 'Failed to track Shadowfax order');
      throw new Error(err.response?.data?.message || err.message);
    }
  }

  /**
   * Cancel an order before pickup.
   */
  async cancelForwardOrder(awbNumberOrOrderId: string, cancelRemarks: string = 'Cancelled by system'): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const res = await this.client.post('/v3/clients/orders/cancel/', {
        request_id: awbNumberOrOrderId,
        cancel_remarks: cancelRemarks,
      });

      return {
        success: res.data?.responseCode === 200 || res.status === 200,
        message: res.data?.responseMsg || res.data?.message || 'Cancelled successfully',
      };
    } catch (err: any) {
      log.error({ err: err?.response?.data || err.message, awbNumberOrOrderId }, 'Failed to cancel Shadowfax forward order');
      throw new Error(err.response?.data?.message || err.message);
    }
  }
}

export const shadowfaxService = new ShadowfaxService();

