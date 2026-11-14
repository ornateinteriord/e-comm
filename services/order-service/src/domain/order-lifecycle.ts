import type { FulfilmentStatus, PaymentStatus } from '@ornate/types';

/**
 * Single authority for the order lifecycle.
 *
 * The order and its line items track the same pipeline with different words:
 * the order says "shipped", the item says "dispatched", and the order adds
 * "processing" / "return_requested" / "returned" which have no item equivalent.
 * Before this module, legality lived in whichever controller happened to touch
 * the field, so the admin route accepted any value from the request body while
 * the store route folded item statuses into the order with no else branch.
 *
 * Every writer (admin, store, payment gateway, customer cancellation) now goes
 * through these functions.
 */

// ─── Vocabulary ──────────────────────────────────────────────────────────────

export const ITEM_STATUSES = [
  'pending',
  'confirmed',
  'packed',
  'dispatched',
  'delivered',
  'cancelled',
] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const ORDER_FULFILMENT_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'return_requested',
  'returned',
] as const;

export const PAYMENT_STATUSES = [
  'pending',
  'paid',
  'failed',
  'refunded',
  'partially_refunded',
] as const;

// ─── Pipelines ───────────────────────────────────────────────────────────────

/** Forward-progress axis for the order. Rank order is the only ordering that matters. */
const ORDER_PIPELINE: readonly FulfilmentStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'delivered',
];

/** Forward-progress axis for a line item. Note `dispatched`, not `shipped`. */
const ITEM_PIPELINE: readonly ItemStatus[] = [
  'pending',
  'confirmed',
  'packed',
  'dispatched',
  'delivered',
];

/** Sinks: once entered, nothing leaves. */
const TERMINAL_ORDER: readonly FulfilmentStatus[] = ['cancelled', 'returned'];
const TERMINAL_ITEM: readonly ItemStatus[] = ['delivered', 'cancelled'];

const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  pending: ['paid', 'failed'],
  // A failed attempt may be retried and succeed later.
  failed: ['pending', 'paid'],
  paid: ['refunded', 'partially_refunded'],
  partially_refunded: ['refunded', 'paid'],
  refunded: [],
};

export function isOrderFulfilmentStatus(value: unknown): value is FulfilmentStatus {
  return typeof value === 'string' && (ORDER_FULFILMENT_STATUSES as readonly string[]).includes(value);
}

export function isItemStatus(value: unknown): value is ItemStatus {
  return typeof value === 'string' && (ITEM_STATUSES as readonly string[]).includes(value);
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === 'string' && (PAYMENT_STATUSES as readonly string[]).includes(value);
}

// ─── Transition rules ────────────────────────────────────────────────────────

/**
 * Order-level rules:
 *  - no-op is always allowed
 *  - `cancelled` and `returned` are sinks
 *  - forward movement along the pipeline is allowed, including skips (an admin
 *    may move `confirmed` straight to `delivered`); backward movement is not
 *  - `cancelled` is reachable from any non-terminal state (admins need the override)
 *  - returns are only reachable once the goods have shipped
 */
export function canTransitionOrder(from: FulfilmentStatus, to: FulfilmentStatus): boolean {
  if (from === to) return true;
  if (TERMINAL_ORDER.includes(from)) return false;

  if (to === 'cancelled') return true;
  if (to === 'return_requested') return from === 'shipped' || from === 'delivered';
  if (to === 'returned') return from === 'return_requested';
  // A rejected return puts the order back in the customer's hands.
  if (from === 'return_requested') return to === 'delivered';

  const fromRank = ORDER_PIPELINE.indexOf(from);
  const toRank = ORDER_PIPELINE.indexOf(to);
  if (fromRank === -1 || toRank === -1) return false;
  return toRank > fromRank;
}

/**
 * Item-level rules mirror the order, minus the states an item cannot occupy.
 * Cancelling is allowed from any in-flight item because the store portal offers
 * that option in its status dropdown.
 */
export function canTransitionItem(from: ItemStatus, to: ItemStatus): boolean {
  if (from === to) return true;
  if (TERMINAL_ITEM.includes(from)) return false;
  if (to === 'cancelled') return true;

  const fromRank = ITEM_PIPELINE.indexOf(from);
  const toRank = ITEM_PIPELINE.indexOf(to);
  if (fromRank === -1 || toRank === -1) return false;
  return toRank > fromRank;
}

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) return true;
  return PAYMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Every state the given order state may legally become. */
export function nextOrderFulfilmentStatuses(from: FulfilmentStatus): FulfilmentStatus[] {
  return ORDER_FULFILMENT_STATUSES.filter((to) => canTransitionOrder(from, to));
}

/** Every state the given item state may legally become. */
export function nextItemStatuses(from: ItemStatus): ItemStatus[] {
  return ITEM_STATUSES.filter((to) => canTransitionItem(from, to));
}

/**
 * States from which a *customer* may self-cancel.
 *
 * Deliberately narrower than the admin override: once goods are in transit the
 * customer has to go through the return flow, not cancellation. The admin route
 * uses `canTransitionOrder` directly and keeps its broader override.
 */
const CUSTOMER_CANCELLABLE: readonly FulfilmentStatus[] = ['pending', 'confirmed'];

export function canCustomerCancel(from: FulfilmentStatus): boolean {
  return CUSTOMER_CANCELLABLE.includes(from) && canTransitionOrder(from, 'cancelled');
}

// ─── Vocabulary bridge ───────────────────────────────────────────────────────

/** Project an item state onto its order-level equivalent. */
export function itemStatusToOrderStatus(item: ItemStatus): FulfilmentStatus {
  switch (item) {
    case 'dispatched':
      return 'shipped';
    case 'pending':
    case 'confirmed':
    case 'packed':
    case 'delivered':
    case 'cancelled':
      return item;
  }
}

// ─── Derivation ──────────────────────────────────────────────────────────────

type DerivableItem = { itemStatus?: string | null };

/**
 * Computes the order status implied by its items.
 *
 * This replaces the old fold, which covered only the dispatched branches and
 * silently left the order untouched in every other case — so an order whose
 * items were all cancelled or all packed never advanced.
 *
 * The result is applied through `canTransitionOrder`, so derivation can move an
 * order forward but never drag it backward (a cancelled item on an already
 * shipped order does not reset the order to `processing`).
 */
export function deriveOrderFulfilmentStatus(
  items: readonly DerivableItem[],
  current: FulfilmentStatus,
): FulfilmentStatus {
  if (!items || items.length === 0) return current;

  const states: ItemStatus[] = items.map((it) =>
    isItemStatus(it.itemStatus) ? it.itemStatus : 'pending',
  );

  const all = (predicate: (s: ItemStatus) => boolean) => states.every(predicate);
  const some = (predicate: (s: ItemStatus) => boolean) => states.some(predicate);

  const shippedOrDelivered = (s: ItemStatus) => s === 'dispatched' || s === 'delivered';

  let candidate: FulfilmentStatus;

  if (all((s) => s === 'delivered')) {
    candidate = 'delivered';
  } else if (all(shippedOrDelivered)) {
    candidate = 'shipped';
  } else if (some(shippedOrDelivered)) {
    candidate = 'processing';
  } else if (all((s) => s === 'cancelled')) {
    candidate = 'cancelled';
  } else if (some((s) => s === 'packed')) {
    candidate = 'packed';
  } else if (all((s) => s === 'confirmed' || s === 'cancelled')) {
    candidate = 'confirmed';
  } else {
    candidate = 'pending';
  }

  if (candidate === current) return current;
  return canTransitionOrder(current, candidate) ? candidate : current;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

/**
 * Thrown by callers that prefer exceptions over booleans. Carries the state
 * machine's own vocabulary so an HTTP layer can answer with the allowed set
 * instead of a bare "no".
 */
export class TransitionError extends Error {
  readonly code = 'INVALID_TRANSITION';

  constructor(
    readonly entity: 'order' | 'item' | 'payment',
    readonly from: string,
    readonly to: string,
    readonly allowed: string[],
  ) {
    super(
      `Cannot move ${entity} from '${from}' to '${to}'. Allowed: ${
        allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'
      }.`,
    );
    this.name = 'TransitionError';
  }
}
