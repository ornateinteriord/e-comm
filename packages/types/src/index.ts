// ============================================================
// ornate - Shared Type Definitions
// ============================================================

// ---- User & Auth ----
export type UserRole =
  | 'customer'
  | 'support'
  | 'catalog_manager'
  | 'inventory_manager'
  | 'order_manager'
  | 'finance_manager'
  | 'admin'
  | 'super_admin';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  emailVerified: boolean;
  createdAt: string;
}

// ---- Pricing ----
/**
 * All monetary values are stored as integers in the smallest
 * currency unit (paise for INR). Divide by 100 for display.
 */
export interface ProductPricing {
  mrp: number;
  sellingPrice: number;
  dealPrice: number | null;
  deal: DealConfig | null;
}

export interface DealConfig {
  isActive: boolean;
  startDate: string;
  endDate: string;
  maxQtyPerOrder: number | null;
}

export interface ApplicablePrice {
  applicablePrice: number;
  mrp: number;
  sellingPrice: number;
  dealPrice: number | null;
  dealActive: boolean;
  savingsAmount: number;
  savingsPercent: number;
}

// NOTE: inwardPrice is intentionally OMITTED from all public types.
// Only use InternalProductPricing within trusted backend service contexts.
export interface InternalProductPricing extends ProductPricing {
  inwardPrice: number;
}

// ---- Category ----
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string | null;
  ancestors: Array<{ id: string; name: string; slug: string }>;
  order: number;
  isActive: boolean;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Product ----
export type ProductStatus = 'draft' | 'active' | 'archived';

export interface ProductImage {
  id: string;
  url: string;
  alt?: string;
  order: number;
}

export interface ProductAttribute {
  key: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  attributes: ProductAttribute[];
  stock: number;
  sellingPriceOverride?: number | null;
}

// Public product (what customers see)
export interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  sku: string;
  brand?: string;
  shortDescription?: string;
  longDescription?: string;
  categoryId: string;
  categoryName: string;
  images: ProductImage[];
  pricing: ApplicablePrice;
  stock: number;
  attributes: ProductAttribute[];
  variants: ProductVariant[];
  status: ProductStatus;
  isPublished: boolean;
  seoTitle?: string;
  seoDescription?: string;
  weight?: number;
  dimensions?: { l: number; w: number; h: number };
  createdAt: string;
  updatedAt: string;
}

// Admin product (includes internal pricing, editable fields)
export interface AdminProduct extends Omit<PublicProduct, 'pricing'> {
  pricing: InternalProductPricing & ApplicablePrice;
  lowStockThreshold: number;
  taxClass?: string;
}

// ---- Cart ----
export interface CartItem {
  id: string;
  productId: string;
  variantId?: string | null;
  productName: string;
  productSlug: string;
  productImage?: string;
  sku: string;
  quantity: number;
  unitApplicablePrice: number;
  unitMrp: number;
  lineTotal: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  couponCode?: string | null;
  couponDiscount: number;
  subtotal: number;
  shippingCharge: number;
  tax: number;
  grandTotal: number;
}

// ---- Order ----
export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export type FulfilmentStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'return_requested'
  | 'returned';

export interface OrderItem {
  productId: string;
  variantId?: string | null;
  name: string;
  sku: string;
  image?: string;
  quantity: number;
  unitMrp: number;
  unitSellingPrice: number;
  unitApplicablePrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

export interface OrderAddress {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface OrderPricing {
  subtotal: number;
  couponDiscount: number;
  shippingCharge: number;
  tax: number;
  grandTotal: number;
}

export interface StatusHistoryEntry {
  status: string;
  changedBy: string;
  changedAt: string;
  note?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  shippingAddress: OrderAddress;
  billingAddress: OrderAddress;
  items: OrderItem[];
  pricing: OrderPricing;
  couponCode?: string | null;
  paymentStatus: PaymentStatus;
  fulfilmentStatus: FulfilmentStatus;
  paymentMethod?: string;
  paymentReference?: string;
  invoiceId?: string | null;
  trackingNumber?: string;
  shippingProvider?: string;
  statusHistory: StatusHistoryEntry[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Invoice ----
export interface InvoiceLineItem {
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  invoiceDate: string;
  sellerDetails: SellerDetails;
  customerDetails: CustomerDetails;
  lineItems: InvoiceLineItem[];
  taxBreakdown: TaxBreakdown[];
  subtotal: number;
  couponDiscount: number;
  shippingCharge: number;
  totalTax: number;
  grandTotal: number;
  currency: string;
  paymentReference?: string;
  pdfUrl?: string;
  createdAt: string;
}

export interface SellerDetails {
  name: string;
  address: string;
  gstin: string;
  email: string;
  phone: string;
}

export interface CustomerDetails {
  name: string;
  email: string;
  phone?: string;
  billingAddress: OrderAddress;
}

export interface TaxBreakdown {
  description: string;
  rate: number;
  taxableAmount: number;
  taxAmount: number;
}

// ---- Address ----
export interface Address {
  id: string;
  userId: string;
  label?: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
}

// ---- Coupon ----
export type CouponType = 'percentage' | 'fixed';

export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  maxDiscountAmount?: number | null;
  minOrderValue: number;
  usageLimit?: number | null;
  usedCount: number;
  perUserLimit?: number | null;
  isActive: boolean;
  validFrom: string;
  validTo: string;
  applicableCategories: string[];
  applicableProducts: string[];
}

// ---- Inventory ----
export type InventoryMovementType =
  | 'sale'
  | 'restock'
  | 'adjustment'
  | 'reservation'
  | 'release'
  | 'return';

export interface InventoryMovement {
  id: string;
  productId: string;
  variantId?: string | null;
  type: InventoryMovementType;
  delta: number;
  balanceBefore: number;
  balanceAfter: number;
  reason?: string;
  reference?: string;
  performedBy: string;
  createdAt: string;
}

// ---- Search ----
export interface SearchFilters {
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  attributes?: Record<string, string[]>;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest';
  page?: number;
  limit?: number;
}

export interface SearchResult {
  products: PublicProduct[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export interface SearchSuggestion {
  type: 'product' | 'category' | 'brand';
  label: string;
  slug?: string;
  image?: string;
}

// ---- API Response Envelope ----
export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// ---- Pagination ----
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

// ---- Audit ----
export interface AuditLog {
  id: string;
  action: string;
  actorId: string;
  actorRole: UserRole;
  targetModel: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

// ---- Dashboard ----
export interface DashboardMetrics {
  totalOrders: number;
  paidRevenue: number;
  pendingOrders: number;
  lowStockProducts: number;
  recentOrders: Order[];
}
