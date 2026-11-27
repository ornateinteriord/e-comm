import crypto from 'node:crypto';
import type { DeliveryAssignmentStatus, DeliveryStopLocation, OrderPricing } from '@ornate/types';

export const DELIVERY_ASSIGNMENT_STATUSES: readonly DeliveryAssignmentStatus[] = [
  'assigned',
  'accepted',
  'arrived_pickup',
  'picked_up',
  'in_transit',
  'arrived_customer',
  'delivered',
  'failed',
  'cancelled',
] as const;

export const PICKUP_CONFIRMED_STATUSES: readonly DeliveryAssignmentStatus[] = [
  'picked_up',
  'in_transit',
  'arrived_customer',
  'delivered',
] as const;

/**
 * Customer delivery address/phone stays hidden from the rider until pickup is confirmed.
 */
export function isDropLocationUnlocked(
  status: DeliveryAssignmentStatus,
  pickedUpAt?: Date | string | null,
): boolean {
  if ((PICKUP_CONFIRMED_STATUSES as readonly string[]).includes(status)) {
    return true;
  }
  return Boolean(pickedUpAt);
}

export function formatDropAreaLabel(drop?: Partial<DeliveryStopLocation> | null): string {
  if (!drop) return 'Delivery Area';
  return [drop.city, drop.pincode].filter(Boolean).join(' - ') || 'Delivery Area';
}

export function maskDropLocationUntilPickup(
  drop: DeliveryStopLocation,
): DeliveryStopLocation {
  return {
    name: 'Customer Drop (Unlocks after Pickup)',
    phone: '',
    line1: 'Exact delivery address unlocks after confirming pickup at store',
    line2: '',
    city: drop.city || '',
    state: drop.state || '',
    pincode: drop.pincode || '',
  };
}

export const ACTIVE_DELIVERY_STATUSES: readonly DeliveryAssignmentStatus[] = [
  'assigned',
  'accepted',
  'arrived_pickup',
  'picked_up',
  'in_transit',
  'arrived_customer',
] as const;

export const TERMINAL_DELIVERY_STATUSES: readonly DeliveryAssignmentStatus[] = [
  'delivered',
  'failed',
  'cancelled',
] as const;

const DELIVERY_TRANSITIONS: Record<DeliveryAssignmentStatus, readonly DeliveryAssignmentStatus[]> = {
  assigned: ['accepted', 'cancelled'],
  accepted: ['arrived_pickup', 'picked_up', 'failed', 'cancelled'],
  arrived_pickup: ['picked_up', 'failed', 'cancelled'],
  picked_up: ['in_transit', 'arrived_customer', 'failed', 'cancelled'],
  in_transit: ['arrived_customer', 'delivered', 'failed', 'cancelled'],
  arrived_customer: ['delivered', 'failed'],
  delivered: [],
  failed: [],
  cancelled: [],
};

export function isDeliveryAssignmentStatus(value: unknown): value is DeliveryAssignmentStatus {
  return (
    typeof value === 'string' &&
    (DELIVERY_ASSIGNMENT_STATUSES as readonly string[]).includes(value)
  );
}

export function canTransitionDelivery(
  from: DeliveryAssignmentStatus,
  to: DeliveryAssignmentStatus,
): boolean {
  if (from === to) return true;
  return DELIVERY_TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextDeliveryStatuses(
  from: DeliveryAssignmentStatus,
): DeliveryAssignmentStatus[] {
  return [...(DELIVERY_TRANSITIONS[from] ?? [])];
}

export function calculateHaversineKm(
  lat1?: number | null,
  lng1?: number | null,
  lat2?: number | null,
  lng2?: number | null,
): number | undefined {
  if (
    typeof lat1 !== 'number' ||
    typeof lng1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lng2 !== 'number' ||
    Number.isNaN(lat1) ||
    Number.isNaN(lng1) ||
    Number.isNaN(lat2) ||
    Number.isNaN(lng2)
  ) {
    return undefined;
  }

  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

export const DEFAULT_PICKUP_GEOFENCE_METERS = 300;

export function calculateHaversineMeters(
  lat1?: number | null,
  lng1?: number | null,
  lat2?: number | null,
  lng2?: number | null,
): number | undefined {
  if (
    typeof lat1 !== 'number' ||
    typeof lng1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lng2 !== 'number' ||
    Number.isNaN(lat1) ||
    Number.isNaN(lng1) ||
    Number.isNaN(lat2) ||
    Number.isNaN(lng2)
  ) {
    return undefined;
  }

  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function formatDistanceLabel(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function validateStopGeofence(params: {
  status: DeliveryAssignmentStatus;
  riderLat?: number | null;
  riderLng?: number | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupName?: string;
  pickupLine1?: string;
  dropLat?: number | null;
  dropLng?: number | null;
  dropName?: string;
  dropLine1?: string;
  maxRadiusMeters?: number;
}):
  | { ok: true; distanceMeters?: number }
  | {
      ok: false;
      code: 'GPS_REQUIRED' | 'PICKUP_TOO_FAR' | 'CUSTOMER_TOO_FAR' | 'STILL_AT_PICKUP';
      message: string;
      distanceMeters?: number;
      maxRadiusMeters: number;
    } {
  const maxRadiusMeters = params.maxRadiusMeters ?? DEFAULT_PICKUP_GEOFENCE_METERS;
  const isPickupMilestone = params.status === 'arrived_pickup' || params.status === 'picked_up';
  const isCustomerMilestone = params.status === 'arrived_customer' || params.status === 'delivered';
  const requiresLiveGps = isPickupMilestone || isCustomerMilestone || params.status === 'in_transit';

  if (!requiresLiveGps) {
    return { ok: true };
  }

  const hasRiderCoords =
    typeof params.riderLat === 'number' &&
    typeof params.riderLng === 'number' &&
    !Number.isNaN(params.riderLat) &&
    !Number.isNaN(params.riderLng);

  if (!hasRiderCoords) {
    return {
      ok: false,
      code: 'GPS_REQUIRED',
      message: isPickupMilestone
        ? 'Live GPS location is required to verify you are at the pickup store.'
        : 'Live GPS location is required to update delivery transit or customer arrival.',
      maxRadiusMeters,
    };
  }

  if (isPickupMilestone) {
    const distanceMeters = calculateHaversineMeters(
      params.riderLat,
      params.riderLng,
      params.pickupLat,
      params.pickupLng,
    );
    if (distanceMeters !== undefined && distanceMeters > maxRadiusMeters) {
      const label = params.pickupName || 'the pickup store';
      return {
        ok: false,
        code: 'PICKUP_TOO_FAR',
        message: `Move within ${maxRadiusMeters} m of ${label} to update pickup status (currently ${formatDistanceLabel(distanceMeters)} away).`,
        distanceMeters,
        maxRadiusMeters,
      };
    }
    return { ok: true, distanceMeters };
  }

  if (isCustomerMilestone) {
    const dropDistanceMeters = calculateHaversineMeters(
      params.riderLat,
      params.riderLng,
      params.dropLat,
      params.dropLng,
    );
    if (dropDistanceMeters !== undefined && dropDistanceMeters > maxRadiusMeters) {
      const label = params.dropName || 'the customer address';
      return {
        ok: false,
        code: 'CUSTOMER_TOO_FAR',
        message: `Move within ${maxRadiusMeters} m of ${label} to mark arrived/delivered (currently ${formatDistanceLabel(dropDistanceMeters)} away).`,
        distanceMeters: dropDistanceMeters,
        maxRadiusMeters,
      };
    }

    // Fallback safety: if customer coordinates are unavailable, prevent marking arrived at customer while still inside pickup perimeter
    if (dropDistanceMeters === undefined) {
      const pickupDistanceMeters = calculateHaversineMeters(
        params.riderLat,
        params.riderLng,
        params.pickupLat,
        params.pickupLng,
      );
      const sameStreet =
        Boolean(params.pickupLine1 && params.dropLine1) &&
        params.pickupLine1!.trim().toLowerCase() === params.dropLine1!.trim().toLowerCase();
      if (!sameStreet && pickupDistanceMeters !== undefined && pickupDistanceMeters <= maxRadiusMeters) {
        return {
          ok: false,
          code: 'STILL_AT_PICKUP',
          message:
            'You are still at the pickup store location. Travel to the customer delivery address before marking arrived at customer.',
          distanceMeters: pickupDistanceMeters,
          maxRadiusMeters,
        };
      }
    }

    return { ok: true, distanceMeters: dropDistanceMeters };
  }

  return { ok: true };
}

export function validatePickupGeofence(params: {
  status: DeliveryAssignmentStatus;
  riderLat?: number | null;
  riderLng?: number | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupName?: string;
  maxRadiusMeters?: number;
}) {
  return validateStopGeofence(params);
}

/**
 * Computes delivery partner trip payout in integer paise.
 * Base fee: ₹40 (4000 paise) + ₹8/km beyond 2km + ₹10 handling bonus for ₹2000+ orders.
 */
export function calculatePartnerPayoutPaise(
  pricing?: Partial<OrderPricing> | null,
  distanceKm?: number,
): number {
  const baseFeePaise = 4000;
  const extraKm = typeof distanceKm === 'number' && distanceKm > 2 ? distanceKm - 2 : 0;
  const distanceBonusPaise = Math.round(extraKm * 800);
  const highValueBonusPaise = (pricing?.grandTotal ?? 0) >= 200000 ? 1000 : 0;
  return baseFeePaise + distanceBonusPaise + highValueBonusPaise;
}

export function generateDeliveryOtp(): string {
  return String(crypto.randomInt(1000, 10000));
}

export function resolveCodDetails(order: {
  paymentStatus?: string;
  paymentMethod?: string;
  pricing?: Partial<OrderPricing>;
}): { isCod: boolean; codAmountPaise: number } {
  const method = String(order.paymentMethod || '').trim().toLowerCase();
  const isCodMethod = method === 'cod' || method.includes('cash');
  if (!isCodMethod || order.paymentStatus === 'paid') {
    return { isCod: false, codAmountPaise: 0 };
  }

  const grandTotal = Number(order.pricing?.grandTotal || 0);
  const walletPaid = Number(order.pricing?.walletAmountPaid || 0);
  const codAmountPaise = Math.max(0, grandTotal - walletPaid);
  return { isCod: codAmountPaise > 0, codAmountPaise };
}
