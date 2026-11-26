import crypto from 'node:crypto';
import type { DeliveryAssignmentStatus, OrderPricing } from '@ornate/types';

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
