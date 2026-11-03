import { mongoose } from '@ornate/db';
import { Customer } from '../models/customer.model.js';

export interface ReferralLookupResult {
  valid: boolean;
  referralCode?: string;
  referralName?: string;
  referralType?: 'vendor' | 'customer';
  vendor_id?: string | null;
  vendor_name?: string | null;
  message?: string;
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
      const parentCustomer = await Customer.findOne({
        $or: [
          { customerId: current.referralCode },
          { customer_id: current.referralCode },
          { mobileNumber: current.referralCode },
          { phone: current.referralCode },
          { username: current.referralCode },
        ],
      });
      if (parentCustomer) {
        current = parentCustomer;
      } else {
        // Referral code is not another customer; check if it's a vendor in e-cash vendor_tbl
        try {
          const client = typeof (mongoose.connection as any).getClient === 'function'
            ? (mongoose.connection as any).getClient()
            : (mongoose.connection as any).client;
          const ecashDb = client ? client.db('e-cash') : mongoose.connection.useDb('e-cash').db;
          const v = await ecashDb.collection('vendor_tbl').findOne({
            $or: [
              { Member_id: current.referralCode },
              { member_id: current.referralCode },
              { Member_id: new RegExp(`^${current.referralCode}$`, 'i') },
              { member_id: new RegExp(`^${current.referralCode}$`, 'i') },
            ],
          });
          if (v) {
            return {
              vendor_id: String(v.Member_id || v.member_id || current.referralCode),
              vendor_name: v.Name || v.name || 'Vendor',
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
  try {
    const client = typeof (mongoose.connection as any).getClient === 'function'
      ? (mongoose.connection as any).getClient()
      : (mongoose.connection as any).client;
    const ecashDb = client ? client.db('e-cash') : mongoose.connection.useDb('e-cash').db;
    const vendor = await ecashDb.collection('vendor_tbl').findOne({
      $or: [
        { Member_id: code },
        { member_id: code },
        { Member_id: new RegExp(`^${code}$`, 'i') },
        { member_id: new RegExp(`^${code}$`, 'i') },
      ],
    });

    if (vendor) {
      const vendorStatus = String(vendor.status || '').trim().toLowerCase();
      if (vendorStatus !== 'active') {
        return {
          valid: false,
          message: 'User no longer active.',
        };
      }

      const referralName = vendor.Name || vendor.name || 'Vendor';
      const vendorId = String(vendor.Member_id || vendor.member_id || code);
      return {
        valid: true,
        referralCode: vendorId,
        referralName,
        referralType: 'vendor',
        vendor_id: vendorId,
        vendor_name: referralName,
      };
    }
  } catch (err) {
    console.error('Error querying e-cash vendor_tbl:', err);
  }

  // 2. If not found in vendor_tbl, check ornate_auth -> customers collection
  try {
    const customer = await Customer.findOne({
      $or: [
        { customerId: code },
        { customer_id: code },
        { customerId: new RegExp(`^${code}$`, 'i') },
        { customer_id: new RegExp(`^${code}$`, 'i') },
        { referralCode: code },
        { referralCode: new RegExp(`^${code}$`, 'i') },
        { mobileNumber: code },
        { phone: code },
        { username: code },
      ],
    });

    if (customer) {
      if (!customer.isActive) {
        return {
          valid: false,
          message: 'User no longer active.',
        };
      }

      const referralName = customer.fullName || customer.name || 'Customer';
      const referralCode = customer.customerId || customer.customer_id || customer.mobileNumber || code;
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
 * Continues traversing until introducer_hierarchy is empty.
 */
async function rewardVendorHierarchy(
  startVendorId: string,
  ecashDb: any,
  visitedVendors: Set<string>,
): Promise<string[]> {
  const updatedVendors: string[] = [];
  if (!startVendorId || !ecashDb) return updatedVendors;

  const queue: string[] = [String(startVendorId).trim()];

  while (queue.length > 0) {
    const vId = queue.shift()!;
    const normalized = vId.toLowerCase();
    if (!vId || visitedVendors.has(normalized)) continue;
    visitedVendors.add(normalized);

    try {
      const vendorDoc = await ecashDb.collection('vendor_tbl').findOne({
        $or: [
          { Member_id: vId },
          { member_id: vId },
          { Member_id: new RegExp(`^${vId}$`, 'i') },
          { member_id: new RegExp(`^${vId}$`, 'i') },
        ],
      });

      if (vendorDoc) {
        // Increment token only (no level increment for vendors)
        await ecashDb.collection('vendor_tbl').updateOne(
          { _id: vendorDoc._id },
          { $inc: { token: 1 } },
        );
        updatedVendors.push(String(vendorDoc.Member_id || vendorDoc.member_id || vId));

        // Check introducer_hierarchy array from this vendor
        if (Array.isArray(vendorDoc.introducer_hierarchy) && vendorDoc.introducer_hierarchy.length > 0) {
          for (const parentId of vendorDoc.introducer_hierarchy) {
            const cleanParent = String(parentId || '').trim();
            if (cleanParent && !visitedVendors.has(cleanParent.toLowerCase())) {
              queue.push(cleanParent);
            }
          }
        } else {
          // If introducer_hierarchy is empty or absent, check direct introducer/sponsor as fallback
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

  return updatedVendors;
}

/**
 * Applies level and token rewards upon a successful customer registration:
 * 1. If referred by Vendor:
 *    - Vendor receives token: +1 (no level increment).
 *    - Check introducer_hierarchy: all upstream vendors also receive token: +1 until empty.
 * 2. If referred by Customer:
 *    - Customer receives level: +1.
 *    - Upstream customers receive level: +1.
 *    - When the referral chain reaches a vendor: that vendor receives token: +1,
 *      and continues with that vendor's introducer_hierarchy, increasing token: +1 for all upstream vendors.
 */
export async function applyReferralRewards(params: {
  referralType?: 'vendor' | 'customer' | string | null;
  referralCode?: string | null;
  vendor_id?: string | null;
}): Promise<ReferralRewardResult> {
  const result: ReferralRewardResult = {
    vendorUpdated: false,
    vendorIds: [],
    customerUpdated: false,
    customerIds: [],
  };

  try {
    const client =
      typeof (mongoose.connection as any).getClient === 'function'
        ? (mongoose.connection as any).getClient()
        : (mongoose.connection as any).client;
    const ecashDb = client ? client.db('e-cash') : mongoose.connection.useDb('e-cash').db;

    const visitedVendors = new Set<string>();
    const visitedCustomers = new Set<string>();

    if (params.referralType === 'vendor') {
      const vendorId = params.vendor_id || params.referralCode;
      if (vendorId && ecashDb) {
        // Vendor gets token +1, and all upstream vendors in introducer_hierarchy get token +1
        const updated = await rewardVendorHierarchy(vendorId, ecashDb, visitedVendors);
        if (updated.length > 0) {
          result.vendorUpdated = true;
          result.vendorIds = updated;
        }
      }
    } else if (params.referralType === 'customer') {
      // 1. Customer chain: referring customer and any upstream customers get level: +1
      let currentCode = params.referralCode;
      let customerDepth = 0;
      let reachedVendorId: string | null = null;

      while (currentCode && customerDepth < 20) {
        const custId = String(currentCode).trim();
        if (!custId || visitedCustomers.has(custId.toLowerCase())) break;
        visitedCustomers.add(custId.toLowerCase());

        const customerDoc = await Customer.findOne({
          $or: [
            { customerId: custId },
            { customer_id: custId },
            { customerId: new RegExp(`^${custId}$`, 'i') },
            { customer_id: new RegExp(`^${custId}$`, 'i') },
            { mobileNumber: custId },
            { phone: custId },
            { username: custId },
          ],
        });

        if (customerDoc) {
          // Increment customer level
          await Customer.updateOne({ _id: customerDoc._id }, { $inc: { level: 1 } });
          result.customerUpdated = true;
          result.customerIds?.push(String(customerDoc.customerId || customerDoc.customer_id || custId));

          const parentRef = String(customerDoc.referralCode || '').trim();
          const parentType = customerDoc.referralType;

          if (parentType === 'vendor') {
            reachedVendorId = customerDoc.vendor_id || parentRef;
            break;
          } else if (parentRef) {
            currentCode = parentRef;
          } else {
            if (customerDoc.vendor_id) {
              reachedVendorId = customerDoc.vendor_id;
            }
            break;
          }
        } else {
          // If code is not another customer, it points to a vendor
          reachedVendorId = custId;
          break;
        }

        customerDepth++;
      }

      // 2. Upstream Vendor: gets token: +1, and all vendors in introducer_hierarchy get token: +1
      const targetVendor = reachedVendorId || params.vendor_id;
      if (targetVendor && ecashDb) {
        const updatedVendors = await rewardVendorHierarchy(targetVendor, ecashDb, visitedVendors);
        if (updatedVendors.length > 0) {
          result.vendorUpdated = true;
          result.vendorIds = updatedVendors;
        }
      }
    }
  } catch (err) {
    console.error('Failed to apply referral rewards to vendor/customer hierarchy:', err);
  }

  return result;
}
