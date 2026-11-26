import { describe, it, expect } from 'vitest';
import {
  canTransitionDelivery,
  nextDeliveryStatuses,
  calculateHaversineKm,
  calculatePartnerPayoutPaise,
  generateDeliveryOtp,
  resolveCodDetails,
} from '../src/domain/delivery-lifecycle.js';

describe('Order Service: Delivery Partner Lifecycle & Economics', () => {
  describe('State Transitions', () => {
    it('supports forward lifecycle progression', () => {
      expect(canTransitionDelivery('assigned', 'accepted')).toBe(true);
      expect(canTransitionDelivery('accepted', 'arrived_pickup')).toBe(true);
      expect(canTransitionDelivery('arrived_pickup', 'picked_up')).toBe(true);
      expect(canTransitionDelivery('picked_up', 'in_transit')).toBe(true);
      expect(canTransitionDelivery('in_transit', 'arrived_customer')).toBe(true);
      expect(canTransitionDelivery('arrived_customer', 'delivered')).toBe(true);
      expect(canTransitionDelivery('in_transit', 'delivered')).toBe(true);
    });

    it('blocks invalid backward and post-terminal transitions', () => {
      expect(canTransitionDelivery('picked_up', 'assigned')).toBe(false);
      expect(canTransitionDelivery('delivered', 'failed')).toBe(false);
      expect(canTransitionDelivery('failed', 'delivered')).toBe(false);
      expect(canTransitionDelivery('cancelled', 'accepted')).toBe(false);
      expect(nextDeliveryStatuses('delivered')).toEqual([]);
    });
  });

  describe('Distance & Payout Calculation', () => {
    it('calculates haversine distance accurately in km', () => {
      const dist = calculateHaversineKm(12.9716, 77.5946, 12.9352, 77.6245);
      expect(dist).toBeGreaterThan(4);
      expect(dist).toBeLessThan(7);
      expect(calculateHaversineKm(undefined, 77.5, 12.9, 77.6)).toBeUndefined();
    });

    it('calculates base, distance, and high-value bonus payouts in paise', () => {
      expect(calculatePartnerPayoutPaise({ grandTotal: 50000 }, 1.5)).toBe(4000);
      expect(calculatePartnerPayoutPaise({ grandTotal: 50000 }, 5)).toBe(4000 + 3 * 800);
      expect(calculatePartnerPayoutPaise({ grandTotal: 250000 }, 5)).toBe(4000 + 3 * 800 + 1000);
    });
  });

  describe('OTP & COD Resolution', () => {
    it('generates 4-digit numeric delivery OTPs', () => {
      for (let i = 0; i < 20; i++) {
        const otp = generateDeliveryOtp();
        expect(otp).toMatch(/^\d{4}$/);
        expect(Number(otp)).toBeGreaterThanOrEqual(1000);
        expect(Number(otp)).toBeLessThanOrEqual(9999);
      }
    });

    it('resolves COD balance minus wallet split and returns 0 when already paid', () => {
      expect(
        resolveCodDetails({
          paymentStatus: 'pending',
          paymentMethod: 'COD',
          pricing: { grandTotal: 150000, walletAmountPaid: 30000 },
        }),
      ).toEqual({ isCod: true, codAmountPaise: 120000 });

      expect(
        resolveCodDetails({
          paymentStatus: 'paid',
          paymentMethod: 'COD',
          pricing: { grandTotal: 150000 },
        }),
      ).toEqual({ isCod: false, codAmountPaise: 0 });

      expect(
        resolveCodDetails({
          paymentStatus: 'pending',
          paymentMethod: 'Razorpay',
          pricing: { grandTotal: 150000 },
        }),
      ).toEqual({ isCod: false, codAmountPaise: 0 });
    });
  });
});
