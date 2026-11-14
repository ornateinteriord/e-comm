import { mongoose } from '@ornate/db';
import { Customer } from '../models/customer.model.js';

export interface ReferralLookupResult {
  valid: boolean;
  referralCode?: string;
  referralName?: string;
  referralType?: 'vendor' | 'customer';
  vendor_id?: string | null;
  vendor_name?: string | null;
  member_code?: string | null;
  message?: string;
}

export interface StoreReferralLookupResult {
  valid: boolean;
  referralCode?: string;
  referralName?: string;
  referralType?: 'vendor' | 'store';
  message?: string;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generates search variants for multi-key lookup:
 * handles exact string, lowercase, regex, phone format variants (+91, 91, 0), and numbers.
 */
function getSearchVariants(raw: string) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    return { strings: [], numbers: [], regexes: [] };
  }

  const strSet = new Set<string>();
  strSet.add(trimmed);
  strSet.add(trimmed.toLowerCase());

  // Phone number variations if input is digits
  const cleanDigits = trimmed.replace(/\D/g, '');
  if (cleanDigits.length === 10) {
    strSet.add(cleanDigits);
    strSet.add(`+91${cleanDigits}`);
    strSet.add(`91${cleanDigits}`);
    strSet.add(`0${cleanDigits}`);
  } else if (cleanDigits.length === 12 && cleanDigits.startsWith('91')) {
    const tenDigits = cleanDigits.slice(2);
    strSet.add(tenDigits);
    strSet.add(`+91${tenDigits}`);
    strSet.add(`91${tenDigits}`);
    strSet.add(`0${tenDigits}`);
  }

  const numbers: number[] = [];
  for (const s of strSet) {
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      if (!isNaN(n)) numbers.push(n);
    }
  }

  const regexes = Array.from(strSet).map(
    (s) => new RegExp(`^${escapeRegex(s)}$`, 'i')
  );

  return {
    strings: Array.from(strSet),
    numbers,
    regexes,
  };
}

/**
 * Builds MongoDB $or query for vendor_tbl matching:
 * Member_id, member_id, member_code, mobileno, contactno, email, emailid
 */
export function buildVendorQuery(code: string): { $or: any[] } {
  const { strings, numbers, regexes } = getSearchVariants(code);
  const conditions: any[] = [];

  const vendorFields = [
    'Member_id',
    'member_id',
    'member_code',
    'Member_Code',
    'mobileno',
    'MobileNo',
    'contactno',
    'ContactNo',
    'email',
    'Email',
    'emailid',
    'EmailId',
    'email_id',
  ];

  for (const field of vendorFields) {
    for (const s of strings) {
      conditions.push({ [field]: s });
    }
    for (const r of regexes) {
      conditions.push({ [field]: r });
    }
  }

  const numericVendorFields = ['Member_id', 'member_id', 'member_code', 'mobileno', 'contactno'];
  for (const field of numericVendorFields) {
    for (const n of numbers) {
      conditions.push({ [field]: n });
    }
  }

  return { $or: conditions.length > 0 ? conditions : [{ Member_id: code }] };
}

/**
 * Builds MongoDB $or query for customers matching:
 * customerId, customer_id, email, mobileNumber, phone, username, userId
 * NOTE: referralCode is explicitly NOT included here, as referralCode indicates WHO referred this customer,
 * not the customer's own identity.
 */
export function buildCustomerQuery(code: string): { $or: any[] } {
  const { strings, numbers, regexes } = getSearchVariants(code);
  const conditions: any[] = [];

  const customerFields = [
    'customerId',
    'customer_id',
    'email',
    'mobileNumber',
    'phone',
    'username',
    'userId',
  ];

  for (const field of customerFields) {
    for (const s of strings) {
      conditions.push({ [field]: s });
    }
    for (const r of regexes) {
      conditions.push({ [field]: r });
    }
  }

  const numericCustomerFields = ['customerId', 'customer_id', 'mobileNumber', 'phone', 'username'];
  for (const field of numericCustomerFields) {
    for (const n of numbers) {
      conditions.push({ [field]: n });
    }
  }

  if (mongoose.Types.ObjectId.isValid(code)) {
    conditions.unshift({ _id: new mongoose.Types.ObjectId(code) });
  }

  return { $or: conditions.length > 0 ? conditions : [{ customerId: code }] };
}

/**
 * Resolves upstream vendor details for a customer
 */
async function resolveCustomerVendor(cust: any): Promise<{ vendor_id: string | null; vendor_name: string | null }> {
  if (cust.vendor_id) {
    return { vendor_id: cust.vendor_id, vendor_name: cust.vendor_name || null };
  }
  if (cust.referralType === 'vendor' && cust.referralCode) {
    return { vendor_id: cust.referralCode, vendor_name: cust.referralName || 'Vendor' };
  }

  // Trace up referral chain if cust was referred by another customer (up to 5 levels)
  let current = cust;
  let depth = 0;
  while (current && depth < 5) {
    if (current.vendor_id) {
      return { vendor_id: current.vendor_id, vendor_name: current.vendor_name || null };
    }
    if (current.referralType === 'vendor' && current.referralCode) {
      return { vendor_id: current.referralCode, vendor_name: current.referralName || 'Vendor' };
    }
    if (current.referralCode) {
      const parentCustomer = await Customer.findOne(buildCustomerQuery(current.referralCode));
      if (parentCustomer) {
        current = parentCustomer;
      } else {
        // Referral code is not another customer; check if it's a vendor in e-cash vendor_tbl
        try {
          const client = typeof (mongoose.connection as any).getClient === 'function'
            ? (mongoose.connection as any).getClient()
            : (mongoose.connection as any).client;
          const ecashDb = client ? client.db('e-cash') : mongoose.connection.useDb('e-cash').db;
          const v = await ecashDb.collection('vendor_tbl').findOne(buildVendorQuery(current.referralCode));
          if (v) {
            const memberCode = String(
              v.member_code ||
              v.Member_Code ||
              v.Member_code ||
              v.member_Code ||
              v.Member_id ||
              v.member_id ||
              v.mobileno ||
              current.referralCode
            ).trim();
            return {
              vendor_id: memberCode,
              vendor_name: v.Name || v.name || v.firm_name || 'Vendor',
            };
          }
        } catch (e) {
          // ignore
        }
        break;
      }
    } else {
      break;
    }
    depth++;
  }

  return { vendor_id: null, vendor_name: null };
}

export async function lookupReferralCode(rawCode: string): Promise<ReferralLookupResult> {
  const code = String(rawCode || '').trim();
  if (!code) {
    return {
      valid: false,
      message: 'Referral code is required.',
    };
  }

  // 1. First, search in e-cash database -> vendor_tbl collection
  // Matches: Member_id, member_id, member_code, mobileno, contactno, email, emailid
  try {
    const client = typeof (mongoose.connection as any).getClient === 'function'
      ? (mongoose.connection as any).getClient()
      : (mongoose.connection as any).client;
    const ecashDb = client ? client.db('e-cash') : mongoose.connection.useDb('e-cash').db;
    const vendor = await ecashDb.collection('vendor_tbl').findOne(buildVendorQuery(code));

    if (vendor) {
      const rawStatus = vendor.status !== undefined && vendor.status !== null ? String(vendor.status).trim().toLowerCase() : '';
      const inactiveStatuses = ['inactive', 'blocked', 'suspended', 'deleted', 'disabled', '0', 'false'];
      if (inactiveStatuses.includes(rawStatus)) {
        return {
          valid: false,
          message: 'User no longer active.',
        };
      }

      const referralName =
        vendor.Name ||
        vendor.name ||
        vendor.firm_name ||
        vendor.Firm_name ||
        vendor.shop_name ||
        vendor.Shop_name ||
        vendor.business_name ||
        'Vendor';

      const memberCode = String(
        vendor.member_code ||
        vendor.Member_Code ||
        vendor.Member_code ||
        vendor.member_Code ||
        vendor.Member_id ||
        vendor.member_id ||
        vendor.mobileno ||
        code
      ).trim();

      return {
        valid: true,
        referralCode: memberCode,
        referralName,
        referralType: 'vendor',
        vendor_id: memberCode,
        vendor_name: referralName,
        member_code: memberCode,
      };
    }
  } catch (err) {
    console.error('Error querying e-cash vendor_tbl:', err);
  }

  // 2. If not found in vendor_tbl, check ornate_auth -> customers collection
  // Matches: customerId, customer_id, email, mobileNumber, phone, username, referralCode
  try {
    const customer = await Customer.findOne(buildCustomerQuery(code));

    if (customer) {
      if (customer.isActive === false) {
        return {
          valid: false,
          message: 'User no longer active.',
        };
      }

      const referralName = customer.fullName || customer.name || customer.username || 'Customer';
      const referralCode = String(
        customer.customerId ||
        customer.customer_id ||
        customer.mobileNumber ||
        customer.phone ||
        customer.username ||
        code
      );
      const { vendor_id, vendor_name } = await resolveCustomerVendor(customer);

      return {
        valid: true,
        referralCode,
        referralName,
        referralType: 'customer',
        vendor_id,
        vendor_name,
      };
    }
  } catch (err) {
    console.error('Error querying customers collection:', err);
  }

  // 3. Not found in either collection
  return {
    valid: false,
    message: 'Invalid referral code or user not found.',
  };
}

export interface ReferralRewardResult {
  vendorUpdated: boolean;
  vendorIds?: string[];
  customerUpdated: boolean;
  customerIds?: string[];
}

/**
 * Helper to reward a vendor and all upstream vendors in its introducer_hierarchy with token: +1
 * Respects maxTokensRemaining budget so total tokens distributed across chain never exceeds 20.
 * Increments both `token` and `tokens` to maintain compatibility with all dashboard variants.
 * Vendors NEVER receive a level increment.
 */
async function rewardVendorHierarchyWithBudget(
  startVendorId: string,
  ecashDb: any,
  visitedVendors: Set<string>,
  maxTokensRemaining: number,
): Promise<{ updatedVendors: string[]; tokensGiven: number }> {
  const updatedVendors: string[] = [];
  let tokensGiven = 0;
  if (!startVendorId || !ecashDb || maxTokensRemaining <= 0) {
    return { updatedVendors, tokensGiven };
  }

  const queue: string[] = [String(startVendorId).trim()];

  while (queue.length > 0 && tokensGiven < maxTokensRemaining) {
    const vId = queue.shift()!;
    const normalized = vId.toLowerCase();
    if (!vId || visitedVendors.has(normalized)) continue;
    visitedVendors.add(normalized);

    try {
      const vendorDoc = await ecashDb.collection('vendor_tbl').findOne(buildVendorQuery(vId));

      if (vendorDoc) {
        // Track all known identifiers of this vendor to prevent duplicate reward iterations
        visitedVendors.add(String(vendorDoc._id).toLowerCase());
        if (vendorDoc.Member_id) visitedVendors.add(String(vendorDoc.Member_id).toLowerCase());
        if (vendorDoc.member_id) visitedVendors.add(String(vendorDoc.member_id).toLowerCase());
        if (vendorDoc.member_code) visitedVendors.add(String(vendorDoc.member_code).toLowerCase());
        if (vendorDoc.Member_Code) visitedVendors.add(String(vendorDoc.Member_Code).toLowerCase());
        if (vendorDoc.mobileno) visitedVendors.add(String(vendorDoc.mobileno).toLowerCase());
        if (vendorDoc.MobileNo) visitedVendors.add(String(vendorDoc.MobileNo).toLowerCase());

        // Increment both token and tokens fields so all interfaces reflect the reward
        await ecashDb.collection('vendor_tbl').updateOne(
          { _id: vendorDoc._id },
          {
            $inc: { token: 1, tokens: 1 },
            $set: { updatedAt: new Date() },
          },
        );

        const canonicalCode = String(
          vendorDoc.member_code ||
          vendorDoc.Member_Code ||
          vendorDoc.Member_code ||
          vendorDoc.member_Code ||
          vendorDoc.Member_id ||
          vendorDoc.member_id ||
          vId
        );
        updatedVendors.push(canonicalCode);
        tokensGiven++;

        if (tokensGiven >= maxTokensRemaining) {
          break;
        }

        // Check introducer_hierarchy array from this vendor
        if (Array.isArray(vendorDoc.introducer_hierarchy) && vendorDoc.introducer_hierarchy.length > 0) {
          for (const parentId of vendorDoc.introducer_hierarchy) {
            const cleanParent = String(parentId || '').trim();
            if (cleanParent && !visitedVendors.has(cleanParent.toLowerCase())) {
              queue.push(cleanParent);
            }
          }
        } else {
          // Fallback to direct introducer/sponsor
          const directParent = String(
            vendorDoc.introducer || vendorDoc.sponsor_id || vendorDoc.Sponsor_code || '',
          ).trim();
          if (directParent && !visitedVendors.has(directParent.toLowerCase())) {
            queue.push(directParent);
          }
        }
      }
    } catch (err) {
      console.error(`Error incrementing token for vendor ${vId}:`, err);
    }
  }

  return { updatedVendors, tokensGiven };
}

/**
 * Applies level and token rewards upon a successful customer registration:
 * 1. Exactly 20 tokens maximum distributed across the entire upline chain per registration.
 * 2. When Customer X refers Customer Y:
 *    - Customer X receives level: +1 and token: +1.
 *    - Traverses upstream sponsors: if sponsor is another Customer (e.g. Customer A):
 *      Customer A receives level: +1 and token: +1.
 *    - Continues until total tokens reaches 20, or a sponsor's role is Vendor.
 * 3. When a Vendor is encountered:
 *    - Vendor receives token: +1 and tokens: +1 (NO level increase).
 *    - If total tokens < 20, checks vendor's introducer_hierarchy and gives token: +1 to upstream vendors until 20 tokens total.
 */
export async function applyReferralRewards(params: {
  referralType?: 'vendor' | 'customer' | string | null;
  referralCode?: string | null;
  vendor_id?: string | null;
  newCustomerId?: string | null;
}): Promise<ReferralRewardResult> {
  const result: ReferralRewardResult = {
    vendorUpdated: false,
    vendorIds: [],
    customerUpdated: false,
    customerIds: [],
  };

  const MAX_TOTAL_TOKENS = 20;
  let tokensDistributed = 0;

  try {
    const client =
      typeof (mongoose.connection as any).getClient === 'function'
        ? (mongoose.connection as any).getClient()
        : (mongoose.connection as any).client;
    const ecashDb = client ? client.db('e-cash') : mongoose.connection.useDb('e-cash').db;

    const visitedVendors = new Set<string>();
    const visitedCustomers = new Set<string>();

    // Safeguard: explicitly mark the newly registered customer so they are never rewarded for their own registration
    if (params.newCustomerId) {
      visitedCustomers.add(String(params.newCustomerId).toLowerCase());
    }

    if (params.referralType === 'vendor') {
      const vendorId = params.vendor_id || params.referralCode;
      if (vendorId && ecashDb) {
        // Direct vendor referral: vendor & upstream vendors in introducer_hierarchy get token: +1 up to 20 tokens
        const { updatedVendors, tokensGiven } = await rewardVendorHierarchyWithBudget(
          vendorId,
          ecashDb,
          visitedVendors,
          MAX_TOTAL_TOKENS - tokensDistributed,
        );
        tokensDistributed += tokensGiven;
        if (updatedVendors.length > 0) {
          result.vendorUpdated = true;
          result.vendorIds = updatedVendors;
        }
      }
    } else {
      // Referred by customer (e.g. Customer X refers Customer Y)
      let currentCode = params.referralCode;
      let reachedVendorId: string | null = null;

      while (currentCode && tokensDistributed < MAX_TOTAL_TOKENS) {
        const custId = String(currentCode).trim();
        if (!custId || visitedCustomers.has(custId.toLowerCase())) break;
        visitedCustomers.add(custId.toLowerCase());

        // Find referring customer, excluding the new customer
        const customerDoc = await Customer.findOne({
          ...buildCustomerQuery(custId),
          ...(params.newCustomerId && mongoose.Types.ObjectId.isValid(params.newCustomerId)
            ? { _id: { $ne: new mongoose.Types.ObjectId(params.newCustomerId) } }
            : {}),
        });

        if (customerDoc) {
          // Track all identifiers of this customer to prevent duplicate loops
          visitedCustomers.add(String(customerDoc._id).toLowerCase());
          if (customerDoc.customerId) visitedCustomers.add(String(customerDoc.customerId).toLowerCase());
          if (customerDoc.customer_id) visitedCustomers.add(String(customerDoc.customer_id).toLowerCase());
          if (customerDoc.mobileNumber) visitedCustomers.add(String(customerDoc.mobileNumber).toLowerCase());
          if (customerDoc.phone) visitedCustomers.add(String(customerDoc.phone).toLowerCase());
          if (customerDoc.email) visitedCustomers.add(String(customerDoc.email).toLowerCase());

          // Increment Customer: level: +1 AND token: +1
          await Customer.updateOne(
            { _id: customerDoc._id },
            {
              $inc: { level: 1, token: 1 },
              $set: { updatedAt: new Date() },
            },
          );
          tokensDistributed++;
          result.customerUpdated = true;
          const canonicalCustId = String(customerDoc.customerId || customerDoc.customer_id || custId);
          result.customerIds?.push(canonicalCustId);

          if (tokensDistributed >= MAX_TOTAL_TOKENS) {
            break; // 20 tokens cap reached
          }

          const parentRef = String(customerDoc.referralCode || '').trim();
          const parentType = customerDoc.referralType;

          if (parentType === 'vendor' || (!parentType && customerDoc.vendor_id)) {
            // Sponsor role is vendor -> stop customer level increment and switch to vendor token hierarchy
            reachedVendorId = customerDoc.vendor_id || parentRef;
            break;
          } else if (parentRef) {
            // Check if parentRef is another customer or points to a vendor
            const parentCustomer = await Customer.findOne({
              ...buildCustomerQuery(parentRef),
              _id: { $ne: customerDoc._id },
            });
            if (parentCustomer) {
              currentCode = parentCustomer.customerId || parentRef;
            } else {
              // Not a customer -> points to vendor
              reachedVendorId = customerDoc.vendor_id || parentRef;
              break;
            }
          } else if (customerDoc.vendor_id) {
            reachedVendorId = customerDoc.vendor_id;
            break;
          } else {
            break; // No further sponsor
          }
        } else {
          // If code is not another customer, check if it points to a vendor in vendor_tbl
          try {
            const vDoc = await ecashDb?.collection('vendor_tbl').findOne(buildVendorQuery(custId));
            if (vDoc) {
              reachedVendorId = String(
                vDoc.member_code ||
                vDoc.Member_Code ||
                vDoc.Member_code ||
                vDoc.member_Code ||
                vDoc.Member_id ||
                vDoc.member_id ||
                custId
              );
            } else {
              reachedVendorId = custId;
            }
          } catch {
            reachedVendorId = custId;
          }
          break;
        }
      }

      // If referral chain reached a Vendor and total tokens < 20:
      const targetVendor = reachedVendorId || params.vendor_id;
      if (targetVendor && tokensDistributed < MAX_TOTAL_TOKENS && ecashDb) {
        const { updatedVendors, tokensGiven } = await rewardVendorHierarchyWithBudget(
          targetVendor,
          ecashDb,
          visitedVendors,
          MAX_TOTAL_TOKENS - tokensDistributed,
        );
        tokensDistributed += tokensGiven;
        if (updatedVendors.length > 0) {
          result.vendorUpdated = true;
          result.vendorIds = [...(result.vendorIds || []), ...updatedVendors];
        }
      }
    }
  } catch (err) {
    console.error('Failed to apply referral rewards to vendor/customer hierarchy:', err);
  }

  return result;
}

export async function lookupStoreReferralCode(rawCode: string): Promise<StoreReferralLookupResult> {
  const code = String(rawCode || '').trim();
  if (!code) {
    return { valid: false, message: 'Referral code is required.' };
  }

  // 1. Search in e-cash vendor_tbl
  try {
    const client = typeof (mongoose.connection as any).getClient === 'function'
      ? (mongoose.connection as any).getClient()
      : (mongoose.connection as any).client;
    const ecashDb = client ? client.db('e-cash') : mongoose.connection.useDb('e-cash').db;
    const vendor = await ecashDb.collection('vendor_tbl').findOne(buildVendorQuery(code));
    if (vendor) {
      const rawStatus = vendor.status !== undefined && vendor.status !== null ? String(vendor.status).trim().toLowerCase() : '';
      const inactiveStatuses = ['inactive', 'blocked', 'suspended', 'deleted', 'disabled', '0', 'false'];
      if (inactiveStatuses.includes(rawStatus)) {
        return { valid: false, message: 'Vendor referral account is inactive.' };
      }
      const canonicalCode = String(
        vendor.member_code ||
        vendor.Member_Code ||
        vendor.Member_code ||
        vendor.member_Code ||
        vendor.Member_id ||
        vendor.member_id ||
        vendor.mobileno ||
        code
      ).trim();
      const vendorName = String(vendor.Name || vendor.name || vendor.firm_name || vendor.Firm_Name || 'Vendor').trim();
      return {
        valid: true,
        referralCode: canonicalCode,
        referralName: vendorName,
        referralType: 'vendor',
      };
    }
  } catch (err) {
    console.error('Error looking up vendor sponsor for store:', err);
  }

  // 2. Search in ornate_auth.stores
  try {
    const { Store } = await import('../models/store.model.js');
    const store = await Store.findOne({
      $or: [
        { storeId: new RegExp(`^${escapeRegex(code)}$`, 'i') },
        { mobileNumber: code.replace(/\D/g, '') },
        { email: code.toLowerCase() },
      ],
    });
    if (store) {
      if (store.status === 'suspended' || !store.isActive) {
        return { valid: false, message: 'Referring store account is inactive or suspended.' };
      }
      return {
        valid: true,
        referralCode: store.storeId,
        referralName: store.name,
        referralType: 'store',
      };
    }
  } catch (err) {
    console.error('Error looking up store sponsor for store:', err);
  }

  return {
    valid: false,
    message: 'Invalid referral code. A store must be referred by an authorized vendor or existing store.',
  };
}
