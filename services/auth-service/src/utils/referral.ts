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
    message: 'Invalid referral code. A valid sponsor or referral code is required to register.',
  };
}
