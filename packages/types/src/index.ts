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
  | 'super_admin'
  | 'seller'
  | 'store'
  | 'delivery_partner';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  sellerId?: string;
  storeId?: string;
  deliveryPartnerId?: string;
  categoryId?: string;
  subcategoryId?: string;
  iat: number;
  exp: number;
}

export interface PublicUser {
  id: string;
  customerId?: string;
  customer_id?: string;
  email: string;
  name: string;
  fullName?: string;
  phone?: string;
  mobileNumber?: string;
  username?: string;
  role: UserRole;
  level?: number;
  token?: number;
  referralCode?: string;
  referralName?: string;
  referralType?: 'vendor' | 'customer';
  vendor_id?: string | null;
  vendor_name?: string | null;
  country?: string;
  state?: string;
  city?: string;
  pincode?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  avatar?: string;
  profilePicture?: string;
  emailVerified: boolean;
  isEmailVerified?: boolean;
  walletBalance?: number;
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
  _id?: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parent?: string | null;
  parentId?: string | null;
  ancestors: Array<{ id: string; name: string; slug: string }>;
  order: number;
  isActive: boolean;
  children?: Category[];
  productCount?: number;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Product ----
export type ProductStatus = 'draft' | 'active' | 'archived' | 'inactive';

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
  subcategoryId?: string;
  subcategoryName?: string;
  images: ProductImage[];
  pricing: ApplicablePrice;
  stock: number;
  assignedStock?: number;
  unassignedStock?: number;
  assignmentStatus?: 'assigned' | 'partially_assigned' | 'unassigned';
  attributes: ProductAttribute[];
  variants: ProductVariant[];
  status: ProductStatus;
  isPublished: boolean;
  isFeatured?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  netQuantity?: string;
  weight?: number;
  dimensions?: { l: number; w: number; h: number };
  sellerId?: string;
  sellerName?: string;
  storeId?: string;
  storeName?: string;
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

export type SellerAcceptanceStatus = 'pending' | 'accepted' | 'rejected';

export interface ShadowfaxTrackingEvent {
  created?: string;
  location?: string;
  status_id?: string;
  status?: string;
  remarks?: string;
  awb_number?: string;
}

export interface ShadowfaxDetails {
  awbNumber: string;
  orderId?: number | string;
  clientOrderId?: string;
  status?: string;
  statusDisplay?: string;
  destinationHub?: string;
  sortCode?: string;
  labelUrl?: string;
  pickupPincode?: string;
  deliveryPincode?: string;
  bookedAt?: string;
  trackingDetails?: ShadowfaxTrackingEvent[];
  lastTrackingSync?: string;
  rawResponse?: any;
}

export interface OrderItem {
  productId: string;
  variantId?: string | null;
  name: string;
  sku: string;
  image?: string;
  categoryId?: string;
  categoryName?: string;
  subcategoryId?: string;
  subcategoryName?: string;
  sellerId?: string;
  sellerName?: string;
  storeId?: string;
  storeName?: string;
  itemStatus?: 'pending' | 'confirmed' | 'packed' | 'dispatched' | 'delivered' | 'cancelled';
  sellerAcceptanceStatus?: SellerAcceptanceStatus;
  sellerRejectionReason?: string;
  sellerAcceptedAt?: string;
  sellerRejectedAt?: string;
  courierName?: string;
  trackingNumber?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
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
  walletAmountPaid?: number;
  gatewayAmount?: number;
}

// ---- Customer Wallet ----
export type WalletTransactionType = 'credit' | 'debit';
export type WalletTransactionCategory =
  | 'topup'
  | 'order_payment'
  | 'commission'
  | 'refund'
  | 'admin_adjustment';
export type WalletTransactionStatus = 'pending' | 'success' | 'failed' | 'cancelled';

export interface WalletTransactionItem {
  id: string;
  transactionId: string;
  userId: string;
  customerId?: string;
  type: WalletTransactionType;
  category: WalletTransactionCategory;
  amount: number; // in paise
  amountRupees: number; // in INR
  balanceAfter?: number; // in paise
  balanceAfterRupees?: number; // in INR
  status: WalletTransactionStatus;
  referenceId?: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
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
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress: OrderAddress;
  billingAddress: OrderAddress;
  items: OrderItem[];
  pricing: OrderPricing;
  couponCode?: string | null;
  paymentStatus: PaymentStatus;
  fulfilmentStatus: FulfilmentStatus;
  sellerAcceptanceStatus?: SellerAcceptanceStatus;
  sellerRejectionReason?: string;
  sellerAcceptedAt?: string;
  sellerRejectedAt?: string;
  shadowfaxDetails?: ShadowfaxDetails;
  deliveryDetails?: OrderDeliveryDetails;
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

// ---- Contact Inquiries ----
export type ContactMessageStatus = 'new' | 'in_progress' | 'resolved' | 'archived';

export interface ContactMessage {
  id: string;
  _id?: string;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  status: ContactMessageStatus;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Seller ----
export interface SellerLocation {
  lat: number;
  lng: number;
  formattedAddress?: string;
}

export interface SellerAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export type SellerStatus = 'active' | 'pending_approval' | 'suspended';

export type SellerType =
  | 'Basic'
  | 'Standard'
  | 'Advanced'
  | 'Flagship'
  | 'Wholesale';

export interface SellerProfile {
  id: string;
  sellerId: string;
  name: string;
  typeOfSeller?: string;
  ownerName: string;
  email: string;
  mobileNumber: string;
  categoryId: string;
  categoryName: string;
  categorySlug?: string;
  subcategoryId?: string;
  subcategoryName?: string;
  subcategorySlug?: string;
  maxStockLimit?: number;
  currentStockTotal?: number;
  availableCapacity?: number;
  referralCode: string;
  referralName: string;
  referralType: 'vendor' | 'seller';
  address: SellerAddress;
  location: SellerLocation;
  status: SellerStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Aliases for transition
  storeId?: string;
  typeOfStore?: string;
}

// Backward compatibility aliases
export type StoreLocation = SellerLocation;
export type StoreAddress = SellerAddress;
export type StoreStatus = SellerStatus;
export type StoreType = SellerType;
export type StoreProfile = SellerProfile;

// ---- Delivery Partner & Last-Mile Logistics ----
export type DeliveryVehicleType = 'bike' | 'scooter' | 'bicycle' | 'car' | 'van';
export type DeliveryPartnerStatus = 'pending_approval' | 'active' | 'suspended';
export type DeliveryKycStatus = 'unverified' | 'submitted' | 'verified' | 'rejected';
export type DeliveryAvailabilityStatus = 'offline' | 'online' | 'on_delivery';
export type DeliveryAssignmentStatus =
  | 'assigned'
  | 'accepted'
  | 'arrived_pickup'
  | 'picked_up'
  | 'in_transit'
  | 'arrived_customer'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export interface DeliveryGeoPoint {
  lat: number;
  lng: number;
  formattedAddress?: string;
  updatedAt?: string;
}

export interface DeliveryKycDocuments {
  drivingLicenseNumber?: string;
  drivingLicenseUrl?: string;
  vehicleRcUrl?: string;
  idProofUrl?: string;
  profilePhotoUrl?: string;
}

export interface DeliveryBankDetails {
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
}

export interface DeliveryPartnerProfile {
  id: string;
  partnerId: string;
  name: string;
  email: string;
  mobileNumber: string;
  role: 'delivery_partner';
  vehicleType: DeliveryVehicleType;
  vehicleNumber: string;
  city: string;
  state: string;
  pincode: string;
  servicePincodes: string[];
  status: DeliveryPartnerStatus;
  isActive: boolean;
  kycStatus?: DeliveryKycStatus;
  kycRejectionReason?: string;
  kycVerifiedAt?: string;
  isKycComplete?: boolean;
  availabilityStatus: DeliveryAvailabilityStatus;
  currentLocation?: DeliveryGeoPoint;
  kycDocuments?: DeliveryKycDocuments;
  bankDetails?: DeliveryBankDetails;
  rating: number;
  totalDeliveries: number;
  totalEarningsPaise: number;
  cashInHandPaise: number;
  lastActiveAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryAppReleaseInfo {
  appId: string;
  appName: string;
  versionName: string;
  versionCode: number;
  minSupportedVersionCode: number;
  apkUrl: string;
  playStoreUrl?: string;
  downloadUrl: string;
  releaseNotes?: string;
  forceUpdate: boolean;
  isConfigured: boolean;
  updatedAt?: string;
}

export interface DeliveryProofOfDelivery {
  otpVerified: boolean;
  photoUrl?: string;
  signatureDataUrl?: string;
  recipientName?: string;
  notes?: string;
  deliveredAt?: string;
}

export interface DeliveryCodSummary {
  isCod: boolean;
  expectedAmountPaise: number;
  collectedAmountPaise: number;
  collectedAt?: string;
  settled: boolean;
}

export interface DeliveryTrackingEvent {
  status: string;
  note?: string;
  lat?: number;
  lng?: number;
  changedBy?: string;
  timestamp: string;
}

export interface OrderDeliveryDetails {
  assignmentId?: string;
  assignmentCode?: string;
  partnerId?: string;
  partnerName?: string;
  partnerPhone?: string;
  vehicleType?: DeliveryVehicleType;
  vehicleNumber?: string;
  status?: DeliveryAssignmentStatus;
  deliveryOtp?: string;
  otpVerified?: boolean;
  assignedAt?: string;
  acceptedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  failedReason?: string;
  payoutPaise?: number;
  pod?: DeliveryProofOfDelivery;
  cod?: DeliveryCodSummary;
  lastKnownLocation?: DeliveryGeoPoint;
  trackingHistory?: DeliveryTrackingEvent[];
}

export interface DeliveryStopLocation {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  pincode: string;
  lat?: number;
  lng?: number;
}

export interface DeliveryAssignment {
  id: string;
  assignmentCode: string;
  orderId: string;
  orderNumber: string;
  partnerId: string;
  partnerMongoId?: string;
  partnerName: string;
  partnerPhone: string;
  vehicleType: DeliveryVehicleType;
  vehicleNumber?: string;
  assignmentMode: 'admin_assigned' | 'self_claimed';
  status: DeliveryAssignmentStatus;
  pickupLocation: DeliveryStopLocation;
  dropLocation: DeliveryStopLocation;
  isDropLocked?: boolean;
  dropAreaLabel?: string;
  itemsSummary: Array<{
    productId: string;
    name: string;
    sku: string;
    quantity: number;
    image?: string;
  }>;
  otpRequired: boolean;
  otpVerified: boolean;
  deliveryOtp?: string;
  isCod: boolean;
  codAmountPaise: number;
  codCollectedPaise: number;
  codSettled: boolean;
  payoutPaise: number;
  tipPaise: number;
  distanceKm?: number;
  podPhotoUrl?: string;
  podSignatureUrl?: string;
  podRecipientName?: string;
  podNotes?: string;
  failureReason?: string;
  lastKnownLocation?: DeliveryGeoPoint;
  trackingHistory: DeliveryTrackingEvent[];
  assignedAt: string;
  acceptedAt?: string;
  arrivedPickupAt?: string;
  pickedUpAt?: string;
  arrivedCustomerAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AvailableDeliveryOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  fulfilmentStatus: FulfilmentStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  isCod: boolean;
  codAmountPaise: number;
  grandTotalPaise: number;
  estimatedPayoutPaise: number;
  estimatedDistanceKm?: number;
  itemCount: number;
  itemsSummary: Array<{
    productId: string;
    name: string;
    sku: string;
    quantity: number;
    image?: string;
  }>;
  pickupLocation: DeliveryStopLocation;
  dropLocation: DeliveryStopLocation;
  isDropLocked?: boolean;
  dropAreaLabel?: string;
}

export interface DeliveryEarningsSummary {
  todayEarningsPaise: number;
  weekEarningsPaise: number;
  totalEarningsPaise: number;
  cashInHandPaise: number;
  completedTrips: number;
  activeTrips: number;
  rating: number;
  recentTrips: Array<{
    id: string;
    assignmentCode: string;
    orderNumber: string;
    status: DeliveryAssignmentStatus;
    payoutPaise: number;
    tipPaise: number;
    codCollectedPaise: number;
    codSettled: boolean;
    dropCity: string;
    deliveredAt?: string;
    createdAt: string;
  }>;
}
