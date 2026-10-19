import type { ApplicablePrice, DealConfig, ProductPricing } from '@ornate/types';

/**
 * CENTRAL PRICING SERVICE
 * Single source of truth for all price calculations.
 * Used by: product serializer, cart service, checkout service, invoice service.
 *
 * All monetary values are integers in the smallest currency unit (paise for INR).
 * Divide by CURRENCY_SMALLEST_UNIT (100) for display.
 */

/**
 * Determines whether a deal is currently active.
 */
export function isDealActive(deal: DealConfig | null | undefined, qty = 1): boolean {
  if (!deal || !deal.isActive || !deal.startDate || !deal.endDate) return false;
  const now = new Date();
  const start = new Date(deal.startDate);
  const end = new Date(deal.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
  if (now < start || now > end) return false;
  if (deal.maxQtyPerOrder !== null && qty > deal.maxQtyPerOrder) return false;
  return true;
}

/**
 * Calculates the applicable customer price for a product.
 * This is the ONLY function that should determine what price a customer pays.
 *
 * @param pricing  - Product pricing object (without inwardPrice)
 * @param qty      - Quantity the customer is ordering (affects deal eligibility)
 * @returns        ApplicablePrice object ready for display
 */
export function getApplicablePrice(pricing: ProductPricing, qty = 1): ApplicablePrice {
  const { mrp, sellingPrice, dealPrice, deal } = pricing;

  const dealActive = dealPrice !== null && isDealActive(deal, qty);
  const applicablePrice = dealActive && dealPrice !== null ? dealPrice : sellingPrice;

  const savingsAmount = Math.max(0, mrp - applicablePrice);
  const savingsPercent = mrp > 0 ? Math.round((savingsAmount / mrp) * 100) : 0;

  return {
    applicablePrice,
    mrp,
    sellingPrice,
    dealPrice,
    dealActive,
    savingsAmount,
    savingsPercent,
  };
}

/**
 * Formats a monetary value (in paise) as a display string.
 * e.g. 100000 paise → "₹1,000.00"
 */
export function formatCurrency(
  amountInSmallestUnit: number,
  symbol = '₹',
  smallestUnitDivisor = 100,
): string {
  const amount = amountInSmallestUnit / smallestUnitDivisor;
  return `${symbol}${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Calculates the discount amount when a coupon is applied to an order.
 */
export interface CouponDiscountInput {
  type: 'percentage' | 'fixed';
  value: number;
  maxDiscountAmount?: number | null;
  minOrderValue: number;
  subtotal: number;
}

export function calculateCouponDiscount(coupon: CouponDiscountInput): number {
  if (coupon.subtotal < coupon.minOrderValue) return 0;

  if (coupon.type === 'fixed') {
    return Math.min(coupon.value, coupon.subtotal);
  }

  // percentage
  const discount = Math.round((coupon.subtotal * coupon.value) / 100);
  if (coupon.maxDiscountAmount != null) {
    return Math.min(discount, coupon.maxDiscountAmount);
  }
  return discount;
}

/**
 * Calculates tax on a given taxable amount.
 * @param taxableAmount - Amount in paise
 * @param taxRatePercent - e.g. 18 for 18%
 */
export function calculateTax(taxableAmount: number, taxRatePercent: number): number {
  return Math.round((taxableAmount * taxRatePercent) / 100);
}

/**
 * Validates that all price fields satisfy business rules.
 * Returns an array of violation messages (empty = valid).
 */
export interface PriceValidationInput {
  mrp: number;
  sellingPrice: number;
  dealPrice?: number | null;
  inwardPrice: number;
}

export function validatePrices(input: PriceValidationInput): string[] {
  const errors: string[] = [];

  if (!Number.isInteger(input.mrp) || input.mrp < 0) {
    errors.push('MRP must be a non-negative integer (paise).');
  }
  if (!Number.isInteger(input.sellingPrice) || input.sellingPrice < 0) {
    errors.push('Selling price must be a non-negative integer (paise).');
  }
  if (!Number.isInteger(input.inwardPrice) || input.inwardPrice < 0) {
    errors.push('Inward price must be a non-negative integer (paise).');
  }
  if (input.sellingPrice > input.mrp) {
    errors.push('Selling price must not exceed MRP.');
  }
  if (input.dealPrice != null) {
    if (!Number.isInteger(input.dealPrice) || input.dealPrice < 0) {
      errors.push('Deal price must be a non-negative integer (paise).');
    } else if (input.dealPrice > input.sellingPrice) {
      errors.push('Deal price must not exceed the selling price.');
    }
  }

  return errors;
}
