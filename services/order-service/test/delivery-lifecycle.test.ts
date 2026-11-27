import { describe, it, expect } from 'vitest';
import {
  canTransitionDelivery,
  formatDropAreaLabel,
  isDropLocationUnlocked,
  maskDropLocationUntilPickup,
  nextDeliveryStatuses,
  calculateHaversineKm,
  calculateHaversineMeters,
  calculatePartnerPayoutPaise,
  generateDeliveryOtp,
  resolveCodDetails,
  validatePickupGeofence,
  validateStopGeofence,
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

  describe('Pickup-First Drop Address Gating', () => {
    it('keeps customer drop address locked before pickup and unlocks after picked_up', () => {
      expect(isDropLocationUnlocked('assigned')).toBe(false);
      expect(isDropLocationUnlocked('accepted')).toBe(false);
      expect(isDropLocationUnlocked('arrived_pickup')).toBe(false);
      expect(isDropLocationUnlocked('cancelled', null)).toBe(false);

      expect(isDropLocationUnlocked('picked_up')).toBe(true);
      expect(isDropLocationUnlocked('in_transit')).toBe(true);
      expect(isDropLocationUnlocked('arrived_customer')).toBe(true);
      expect(isDropLocationUnlocked('delivered')).toBe(true);
      expect(isDropLocationUnlocked('failed', new Date())).toBe(true);
    });

    it('masks exact street, phone, and coordinates until pickup while preserving city/pincode area', () => {
      const masked = maskDropLocationUntilPickup({
        name: 'Aarav Sharma',
        phone: '9876501234',
        line1: 'Flat 402, Lotus Residency',
        line2: 'Near Orion Mall',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560055',
        lat: 13.011,
        lng: 77.554,
      });

      expect(masked.phone).toBe('');
      expect(masked.line2).toBe('');
      expect(masked.lat).toBeUndefined();
      expect(masked.lng).toBeUndefined();
      expect(masked.line1).not.toContain('Lotus Residency');
      expect(masked.name).not.toContain('Aarav');
      expect(formatDropAreaLabel(masked)).toBe('Bengaluru - 560055');
    });
  });

  describe('Pickup Location Geofence', () => {
    it('blocks arrived_pickup and picked_up without live GPS or outside 300m radius', () => {
      const noGps = validatePickupGeofence({
        status: 'arrived_pickup',
        pickupLat: 12.9716,
        pickupLng: 77.5946,
        pickupName: 'Ornate Hub',
      });
      expect(noGps.ok).toBe(false);
      if (!noGps.ok) expect(noGps.code).toBe('GPS_REQUIRED');

      const far = validatePickupGeofence({
        status: 'picked_up',
        riderLat: 12.89,
        riderLng: 77.55,
        pickupLat: 12.9716,
        pickupLng: 77.5946,
        pickupName: 'Ornate Hub',
        maxRadiusMeters: 300,
      });
      expect(far.ok).toBe(false);
      if (!far.ok) {
        expect(far.code).toBe('PICKUP_TOO_FAR');
        expect(far.distanceMeters).toBeGreaterThan(5000);
      }
    });

    it('allows arrived_pickup and picked_up within 300m and skips check for failed/cancelled', () => {
      expect(calculateHaversineMeters(12.9716, 77.5946, 12.9722, 77.5949)).toBeLessThan(150);

      const near = validatePickupGeofence({
        status: 'picked_up',
        riderLat: 12.9722,
        riderLng: 77.5949,
        pickupLat: 12.9716,
        pickupLng: 77.5946,
        pickupName: 'Ornate Hub',
      });
      expect(near.ok).toBe(true);

      expect(validatePickupGeofence({ status: 'failed' }).ok).toBe(true);
    });

    it('blocks arrived_customer and delivered when rider has no GPS, is too far, or is still at pickup', () => {
      const noGps = validateStopGeofence({
        status: 'arrived_customer',
        dropLat: 12.91,
        dropLng: 77.61,
      });
      expect(noGps.ok).toBe(false);
      if (!noGps.ok) expect(noGps.code).toBe('GPS_REQUIRED');

      const stillAtPickupCoordsKnown = validateStopGeofence({
        status: 'arrived_customer',
        riderLat: 12.9716,
        riderLng: 77.5946,
        pickupLat: 12.9716,
        pickupLng: 77.5946,
        dropLat: 12.91,
        dropLng: 77.61,
        dropName: 'Customer2',
      });
      expect(stillAtPickupCoordsKnown.ok).toBe(false);
      if (!stillAtPickupCoordsKnown.ok) expect(stillAtPickupCoordsKnown.code).toBe('CUSTOMER_TOO_FAR');

      const stillAtPickupFallback = validateStopGeofence({
        status: 'arrived_customer',
        riderLat: 12.9716,
        riderLng: 77.5946,
        pickupLat: 12.9716,
        pickupLng: 77.5946,
        pickupLine1: '17th Main Rd, Vijayanagara',
        dropLine1: '50, Bengaluru',
      });
      expect(stillAtPickupFallback.ok).toBe(false);
      if (!stillAtPickupFallback.ok) expect(stillAtPickupFallback.code).toBe('STILL_AT_PICKUP');

      const atCustomer = validateStopGeofence({
        status: 'arrived_customer',
        riderLat: 12.9102,
        riderLng: 77.6104,
        pickupLat: 12.9716,
        pickupLng: 77.5946,
        dropLat: 12.91,
        dropLng: 77.61,
        dropName: 'Customer2',
      });
      expect(atCustomer.ok).toBe(true);
    });
  });
});
