import { mongoose } from '@ornate/db';
import { Customer } from '../models/customer.model.js';

export interface ReferralLookupResult {
  valid: boolean;
  referralCode?: string;
  referralName?: string;
  referralType?: 'vendor' | 'customer';
  message?: string;
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
      return {
        valid: true,
        referralCode: vendor.Member_id || vendor.member_id || code,
        referralName,
        referralType: 'vendor',
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
      return {
        valid: true,
        referralCode: customer.customerId || customer.customer_id || customer.mobileNumber || code,
        referralName,
        referralType: 'customer',
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
