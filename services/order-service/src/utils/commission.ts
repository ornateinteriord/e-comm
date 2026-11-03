import mongoose from 'mongoose';
import { createLogger } from '@ornate/logger';
import { Order, IOrder } from '../models/order.model.js';

const log = createLogger('order-commission');

// In-memory set to lock concurrent executions in the same process
const inFlightCommissions = new Set<string>();

export interface MarginCalculationResult {
  marginPaise: number;
  marginRupees: number;
  itemBreakdown: Array<{
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    sellingPricePaise: number;
    inwardPricePaise: number;
    marginPerUnitPaise: number;
    totalItemMarginPaise: number;
  }>;
}

export interface UplineMember {
  id: string;
  name?: string;
  type: 'customer' | 'vendor';
}

export interface CommissionEntryBreakdown {
  level: number;
  role: string;
  beneficiaryId: string;
  beneficiaryName?: string;
  rate: number;
  amount: number;
  commissionId: string;
}

export interface CommissionDistributionSummary {
  orderNumber: string;
  marginRupees: number;
  totalCommissionsDistributed: number;
  recordsCount: number;
  breakdown: CommissionEntryBreakdown[];
}

/**
 * Returns a handle to a MongoDB database through the active mongoose connection.
 */
function getDb(dbName: string): any {
  const client =
    typeof (mongoose.connection as any).getClient === 'function'
      ? (mongoose.connection as any).getClient()
      : (mongoose.connection as any).client;

  if (client) {
    return client.db(dbName);
  }
  return mongoose.connection.useDb(dbName).db;
}

/**
 * Calculates the total order margin based on (Selling Price - Inward Cost Price) * quantity for each item.
 */
export async function calculateOrderMargin(order: IOrder, productDb: any): Promise<MarginCalculationResult> {
  let totalMarginPaise = 0;
  const itemBreakdown: MarginCalculationResult['itemBreakdown'] = [];

  for (const item of order.items || []) {
    let inwardPricePaise = 0;

    try {
      const isObjectId = mongoose.Types.ObjectId.isValid(item.productId);
      const query: any[] = [{ sku: item.sku }];
      if (isObjectId) {
        query.unshift({ _id: new mongoose.Types.ObjectId(item.productId) });
      }

      const product = await productDb.collection('products').findOne({ $or: query });
      if (product?.pricing?.inwardPrice !== undefined && product?.pricing?.inwardPrice !== null) {
        inwardPricePaise = Number(product.pricing.inwardPrice) || 0;
      }
    } catch (err) {
      log.warn({ err, productId: item.productId, sku: item.sku }, 'Could not fetch product for inward price lookup');
    }

    const sellingPricePaise = Number(item.unitApplicablePrice || item.unitSellingPrice || 0);
    const marginPerUnitPaise = Math.max(0, sellingPricePaise - inwardPricePaise);
    const qty = Math.max(1, Number(item.quantity || 1));
    const totalItemMarginPaise = marginPerUnitPaise * qty;

    totalMarginPaise += totalItemMarginPaise;

    itemBreakdown.push({
      productId: item.productId,
      sku: item.sku,
      name: item.name,
      quantity: qty,
      sellingPricePaise,
      inwardPricePaise,
      marginPerUnitPaise,
      totalItemMarginPaise,
    });
  }

  const marginRupees = Number((totalMarginPaise / 100).toFixed(2));

  return {
    marginPaise: totalMarginPaise,
    marginRupees,
    itemBreakdown,
  };
}

/**
 * Finds customer document from ornate_auth.customers matching the order's user identifier.
 */
export async function findCustomerForOrder(order: IOrder, authDb: any): Promise<any | null> {
  const query: any[] = [];
  if (mongoose.Types.ObjectId.isValid(order.userId)) {
    query.push({ _id: new mongoose.Types.ObjectId(order.userId) });
  }
  if (order.userId) {
    query.push({ userId: order.userId });
    query.push({ customerId: order.userId });
    query.push({ customer_id: order.userId });
    query.push({ mobileNumber: order.userId });
    query.push({ phone: order.userId });
    query.push({ username: order.userId });
  }
  if (order.customerEmail) {
    query.push({ email: order.customerEmail.toLowerCase().trim() });
  }

  if (query.length === 0) return null;

  try {
    return await authDb.collection('customers').findOne({ $or: query });
  } catch (err) {
    log.error({ err, orderId: order._id }, 'Error looking up customer for order');
    return null;
  }
}

/**
 * Resolves the upline referral chain from Level 3 up to Level 20.
 * Follows upstream customers in ornate_auth.customers, then vendors in e-cash.vendor_tbl.
 */
export async function traceReferralChain(
  customer: any,
  authDb: any,
  ecashDb: any,
  sponsorId: string | null,
  vendorId: string | null,
): Promise<UplineMember[]> {
  const upline: UplineMember[] = [];
  const visited = new Set<string>();

  const customerId = String(customer.customerId || customer.customer_id || customer.mobileNumber || customer._id || '');
  if (customerId) visited.add(customerId);
  if (sponsorId) visited.add(sponsorId);
  if (vendorId) visited.add(vendorId);

  let currentCode = customer.referralCode;
  let vendorStartId: string | null = null;

  // 1. Trace upstream customers (up to 18 hops)
  let customerDepth = 0;
  while (currentCode && customerDepth < 18 && upline.length < 18) {
    try {
      const parentCust = await authDb.collection('customers').findOne({
        $or: [
          { customerId: currentCode },
          { customer_id: currentCode },
          { mobileNumber: currentCode },
          { phone: currentCode },
          { username: currentCode },
        ],
      });

      if (!parentCust) {
        // Not a customer, could be a vendor ID
        vendorStartId = currentCode;
        break;
      }

      const nextCode = parentCust.referralCode;
      if (!nextCode) {
        if (parentCust.vendor_id) {
          vendorStartId = parentCust.vendor_id;
        }
        break;
      }

      // Check if next parent is a customer or a vendor
      const isNextCust = await authDb.collection('customers').findOne({
        $or: [
          { customerId: nextCode },
          { customer_id: nextCode },
          { mobileNumber: nextCode },
          { phone: nextCode },
          { username: nextCode },
        ],
      });

      if (isNextCust) {
        const pId = String(isNextCust.customerId || isNextCust.customer_id || isNextCust.mobileNumber || nextCode);
        if (!visited.has(pId)) {
          visited.add(pId);
          upline.push({
            id: pId,
            name: isNextCust.fullName || isNextCust.name,
            type: 'customer',
          });
        }
        currentCode = nextCode;
      } else {
        vendorStartId = nextCode || parentCust.vendor_id;
        break;
      }
    } catch {
      break;
    }
    customerDepth++;
  }

  // 2. Trace upstream vendors via e-cash vendor_tbl
  const targetVendor = vendorStartId || vendorId || sponsorId;
  if (targetVendor && upline.length < 18) {
    try {
      const vendorDoc = await ecashDb.collection('vendor_tbl').findOne({
        $or: [
          { Member_id: targetVendor },
          { member_id: targetVendor },
          { Member_id: new RegExp(`^${targetVendor}$`, 'i') },
          { member_id: new RegExp(`^${targetVendor}$`, 'i') },
        ],
      });

      if (vendorDoc) {
        // Check introducer_hierarchy array first (common in MLM / vendor_tbl)
        if (Array.isArray(vendorDoc.introducer_hierarchy)) {
          for (const uplineId of vendorDoc.introducer_hierarchy) {
            if (upline.length >= 18) break;
            const cleanId = String(uplineId || '').trim();
            if (cleanId && !visited.has(cleanId)) {
              visited.add(cleanId);
              let vName = 'Vendor';
              try {
                const uDoc = await ecashDb.collection('vendor_tbl').findOne({
                  $or: [
                    { Member_id: cleanId },
                    { member_id: cleanId },
                    { Member_id: new RegExp(`^${cleanId}$`, 'i') },
                    { member_id: new RegExp(`^${cleanId}$`, 'i') },
                  ],
                });
                if (uDoc) {
                  vName = uDoc.Name || uDoc.name || 'Vendor';
                }
              } catch {}
              upline.push({ id: cleanId, name: vName, type: 'vendor' });
            }
          }
        }

        // Also traverse sponsor_id / introducer if needed to reach up to Level 20
        let currentVendor = vendorDoc;
        let vendorHops = 0;
        while (currentVendor && upline.length < 18 && vendorHops < 18) {
          const nextVId = String(currentVendor.sponsor_id || currentVendor.introducer || currentVendor.Sponsor_code || '').trim();
          if (!nextVId) break;

          let nextDoc: any = null;
          try {
            nextDoc = await ecashDb.collection('vendor_tbl').findOne({
              $or: [
                { Member_id: nextVId },
                { member_id: nextVId },
                { Member_id: new RegExp(`^${nextVId}$`, 'i') },
                { member_id: new RegExp(`^${nextVId}$`, 'i') },
              ],
            });
          } catch {}

          if (!visited.has(nextVId)) {
            visited.add(nextVId);
            const vName = nextDoc?.Name || nextDoc?.name || currentVendor.Sponsor_name || currentVendor.introducer_name || 'Vendor';
            upline.push({
              id: nextVId,
              name: vName,
              type: 'vendor',
            });
          }

          currentVendor = nextDoc;
          vendorHops++;
        }
      }
    } catch (err) {
      log.warn({ err, targetVendor }, 'Error tracing vendor upline hierarchy');
    }
  }

  return upline;
}

/**
 * Main commission distribution engine with strict anti-duplicate locking:
 * 1. In-memory Set lock against parallel calls in the same process.
 * 2. Atomic MongoDB findOneAndUpdate lock on the Order document.
 * 3. Database idempotency check against e-cash.commission_tbl.
 * 4. Logs comprehensive breakdown of each commission recipient.
 */
export async function distributeOrderCommissions(orderOrDoc: any): Promise<CommissionDistributionSummary | null> {
  const orderNumber = String(orderOrDoc.orderNumber);

  // 1. In-memory concurrency lock
  if (inFlightCommissions.has(orderNumber)) {
    log.info({ orderNumber }, '[COMMISSION] Distribution already in flight for this order, skipping concurrent call');
    return null;
  }

  inFlightCommissions.add(orderNumber);
  try {
    return await executeCommissionDistribution(orderOrDoc);
  } finally {
    inFlightCommissions.delete(orderNumber);
  }
}

async function executeCommissionDistribution(orderOrDoc: any): Promise<CommissionDistributionSummary | null> {
  const orderNumber = String(orderOrDoc.orderNumber);
  log.info({ orderNumber }, '[COMMISSION] Starting distribution check');

  const authDb = getDb('ornate_auth');
  const productDb = getDb('ornate_products');
  const ecashDb = getDb('e-cash');

  // 2. Database Idempotency Check in e-cash.commission_tbl
  const existingCommission = await ecashDb.collection('commission_tbl').findOne({
    transaction_id: orderNumber,
    account_type_id: 'COMMISSION_MARGIN',
  });

  if (existingCommission) {
    log.info({ orderNumber }, '[COMMISSION] Already processed in commission_tbl. Skipping duplicate.');
    return null;
  }

  // 3. Atomic Database Lock on the Order document
  const orderId = orderOrDoc._id;
  const lockedOrder = await Order.findOneAndUpdate(
    {
      $or: [
        ...(orderId ? [{ _id: orderId }] : []),
        { orderNumber },
      ],
      commissionProcessed: { $ne: true },
    },
    {
      $set: { commissionProcessed: true },
    },
    { new: true },
  );

  if (!lockedOrder) {
    log.info({ orderNumber }, '[COMMISSION] Order already marked commissionProcessed=true. Skipping.');
    return null;
  }

  // 4. Calculate Margin (Selling Price - Inward Cost Price)
  const marginResult = await calculateOrderMargin(lockedOrder, productDb);
  const marginRupees = marginResult.marginRupees;

  if (marginRupees <= 0) {
    log.info({ orderNumber, marginRupees }, '[COMMISSION] Zero or negative margin. No commission to distribute.');
    await Order.updateOne({ _id: lockedOrder._id }, { $set: { commissionMargin: 0, commissionTotal: 0, commissionBreakdown: [] } }).catch(() => {});
    return null;
  }

  // 5. Identify Customer
  const customer = await findCustomerForOrder(lockedOrder, authDb);
  const sourceId = String(customer?.mobileNumber || customer?.customerId || lockedOrder.userId || 'CUSTOMER');
  const sourceName = String(customer?.fullName || customer?.name || lockedOrder.customerName || 'Customer');

  // Sponsor & Vendor determination
  const sponsorId = customer?.referralCode || customer?.vendor_id || null;
  const vendorId = customer?.vendor_id || customer?.referralCode || null;

  if (!sponsorId && !vendorId) {
    log.info({ orderNumber }, '[COMMISSION] Customer has neither sponsor nor vendor attached. Skipping.');
    await Order.updateOne({ _id: lockedOrder._id }, { $set: { commissionMargin: marginRupees, commissionTotal: 0, commissionBreakdown: [] } }).catch(() => {});
    return null;
  }

  const records: any[] = [];
  const breakdown: CommissionEntryBreakdown[] = [];
  const now = new Date();
  let totalDistributed = 0;

  // Level 1: Sponsor (5%)
  const level1Amount = Number(((marginRupees * 5) / 100).toFixed(2));
  if (level1Amount > 0 && sponsorId) {
    const commId = `COM-${Date.now()}-1-${Math.floor(1000 + Math.random() * 9000)}`;
    records.push({
      commission_id: commId,
      userId: sponsorId,
      beneficiary_id: sponsorId,
      beneficiary_name: customer?.referralName || '',
      beneficiary_type: customer?.referralType === 'vendor' ? 'MEMBER' : 'CUSTOMER',
      source_id: sourceId,
      source_name: sourceName,
      source_type: 'CUSTOMER',
      transaction_id: orderNumber,
      transaction_date: now,
      account_type: 'Level 1 Sponsor Bonus (Order Margin)',
      account_type_id: 'COMMISSION_MARGIN',
      transaction_amount: marginRupees,
      commission_rate: 5,
      commission_amount: level1Amount,
      level: 1,
      status: 'CREDITED',
      credited_at: now,
      failure_reason: null,
      notes: `Level 1 Sponsor (${sponsorId}) - 5% Margin Commission for Order ${orderNumber}`,
      createdAt: now,
      updatedAt: now,
      __v: 0,
    });
    breakdown.push({
      level: 1,
      role: 'Sponsor',
      beneficiaryId: sponsorId,
      beneficiaryName: customer?.referralName,
      rate: 5,
      amount: level1Amount,
      commissionId: commId,
    });
    totalDistributed += level1Amount;
  }

  // Level 2: Vendor (5%)
  // If sponsor and vendor are the same person, this second 5% entry is still created so they receive 5% twice.
  const level2Amount = Number(((marginRupees * 5) / 100).toFixed(2));
  if (level2Amount > 0 && vendorId) {
    const commId = `COM-${Date.now()}-2-${Math.floor(1000 + Math.random() * 9000)}`;
    records.push({
      commission_id: commId,
      userId: vendorId,
      beneficiary_id: vendorId,
      beneficiary_name: customer?.vendor_name || '',
      beneficiary_type: 'MEMBER',
      source_id: sourceId,
      source_name: sourceName,
      source_type: 'CUSTOMER',
      transaction_id: orderNumber,
      transaction_date: now,
      account_type: 'Level 2 Vendor Bonus (Order Margin)',
      account_type_id: 'COMMISSION_MARGIN',
      transaction_amount: marginRupees,
      commission_rate: 5,
      commission_amount: level2Amount,
      level: 2,
      status: 'CREDITED',
      credited_at: now,
      failure_reason: null,
      notes: `Level 2 Vendor (${vendorId}) - 5% Margin Commission for Order ${orderNumber}`,
      createdAt: now,
      updatedAt: now,
      __v: 0,
    });
    breakdown.push({
      level: 2,
      role: 'Vendor',
      beneficiaryId: vendorId,
      beneficiaryName: customer?.vendor_name,
      rate: 5,
      amount: level2Amount,
      commissionId: commId,
    });
    totalDistributed += level2Amount;
  }

  // Levels 3 to 20: Referral Chain (0.5% each)
  const uplineChain = await traceReferralChain(customer || {}, authDb, ecashDb, sponsorId, vendorId);

  for (let idx = 0; idx < uplineChain.length; idx++) {
    const levelNumber = idx + 3;
    if (levelNumber > 20) break;

    const member = uplineChain[idx];
    const levelAmount = Number(((marginRupees * 0.5) / 100).toFixed(2));

    if (levelAmount > 0) {
      const commId = `COM-${Date.now()}-${levelNumber}-${Math.floor(1000 + Math.random() * 9000)}`;
      records.push({
        commission_id: commId,
        userId: member.id,
        beneficiary_id: member.id,
        beneficiary_name: member.name || '',
        beneficiary_type: member.type === 'vendor' ? 'MEMBER' : 'CUSTOMER',
        source_id: sourceId,
        source_name: sourceName,
        source_type: 'CUSTOMER',
        transaction_id: orderNumber,
        transaction_date: now,
        account_type: `Level ${levelNumber} Network Bonus (Order Margin)`,
        account_type_id: 'COMMISSION_MARGIN',
        transaction_amount: marginRupees,
        commission_rate: 0.5,
        commission_amount: levelAmount,
        level: levelNumber,
        status: 'CREDITED',
        credited_at: now,
        failure_reason: null,
        notes: `Level ${levelNumber} Network (${member.id}) - 0.5% Margin Commission for Order ${orderNumber}`,
        createdAt: now,
        updatedAt: now,
        __v: 0,
      });
      breakdown.push({
        level: levelNumber,
        role: `Network (${member.type})`,
        beneficiaryId: member.id,
        beneficiaryName: member.name,
        rate: 0.5,
        amount: levelAmount,
        commissionId: commId,
      });
      totalDistributed += levelAmount;
    }
  }

  // Double-check e-cash before bulk insert to guard against any edge condition
  const doubleCheck = await ecashDb.collection('commission_tbl').findOne({
    transaction_id: orderNumber,
    account_type_id: 'COMMISSION_MARGIN',
  });

  if (doubleCheck) {
    log.info({ orderNumber }, '[COMMISSION] Race-condition detected; records already exist in e-cash. Skipping insert.');
    return null;
  }

  if (records.length > 0) {
    await ecashDb.collection('commission_tbl').insertMany(records);

    // Credit beneficiaries: Customers receive customer wallet credit & transaction log; Vendors receive vendor wallet balance
    for (const rec of records) {
      try {
        const amountPaise = Math.round(Number(rec.commission_amount) * 100);
        const amountRupees = Number(rec.commission_amount);
        const benId = String(rec.beneficiary_id || rec.userId || '').trim();

        if (!benId || amountPaise <= 0) continue;

        // 1. If beneficiary is a CUSTOMER -> Credit customer wallet in ornate_auth.customers
        if (rec.beneficiary_type === 'CUSTOMER') {
          const customerDoc = await authDb.collection('customers').findOne({
            $or: [
              ...(mongoose.Types.ObjectId.isValid(benId) ? [{ _id: new mongoose.Types.ObjectId(benId) }] : []),
              { customerId: benId },
              { customer_id: benId },
              { mobileNumber: benId },
              { phone: benId },
              { username: benId },
            ],
          });

          if (customerDoc) {
            // Atomically update customer's wallet balance
            const updatedCust = await authDb.collection('customers').findOneAndUpdate(
              { _id: customerDoc._id },
              { $inc: { walletBalance: amountPaise } },
              { returnDocument: 'after' },
            );

            const newBalancePaise =
              (updatedCust && (updatedCust.walletBalance ?? updatedCust.value?.walletBalance)) ??
              ((customerDoc.walletBalance || 0) + amountPaise);

            // Record in wallettransactions collection
            await authDb.collection('wallettransactions').insertOne({
              transactionId: `txn_comm_${rec.commission_id || Date.now()}`,
              userId: String(customerDoc._id),
              customerId: customerDoc.customerId || customerDoc.customer_id,
              type: 'credit',
              category: 'commission',
              amount: amountPaise,
              amountRupees,
              balanceAfter: newBalancePaise,
              balanceAfterRupees: Number((newBalancePaise / 100).toFixed(2)),
              status: 'success',
              referenceId: orderNumber,
              description: `Commission from Order #${orderNumber} (Level ${rec.level})`,
              metadata: {
                orderNumber,
                commissionId: rec.commission_id,
                level: rec.level,
                role: rec.account_type,
                rate: rec.commission_rate,
                sourceName,
                sourceId,
              },
              createdAt: now,
              updatedAt: now,
            });

            log.info(
              {
                customerId: customerDoc.customerId,
                amountRupees,
                newBalanceRupees: Number((newBalancePaise / 100).toFixed(2)),
                level: rec.level,
              },
              '[COMMISSION] Credited customer wallet successfully',
            );
          } else {
            log.warn({ benId, level: rec.level }, '[COMMISSION] Customer beneficiary not found in ornate_auth.customers');
          }
        } else if (rec.beneficiary_type === 'MEMBER') {
          // 2. If beneficiary is a MEMBER (Vendor) -> Credit vendor wallet in e-cash.vendor_tbl
          const vendorDoc = await ecashDb.collection('vendor_tbl').findOne({
            $or: [
              { Member_id: benId },
              { member_id: benId },
              { Member_id: new RegExp(`^${benId}$`, 'i') },
              { member_id: new RegExp(`^${benId}$`, 'i') },
              { mobileno: benId },
              { contactno: benId },
            ],
          });

          if (vendorDoc) {
            await ecashDb.collection('vendor_tbl').updateOne(
              { _id: vendorDoc._id },
              { $inc: { wallet_balance: amountRupees, commission_balance: amountRupees } },
            );
            log.info(
              {
                vendorId: vendorDoc.Member_id || vendorDoc.member_id,
                amountRupees,
                level: rec.level,
              },
              '[COMMISSION] Credited vendor wallet balance successfully',
            );
          } else {
            log.warn({ benId, level: rec.level }, '[COMMISSION] Vendor beneficiary not found in e-cash.vendor_tbl');
          }
        }
      } catch (creditErr) {
        log.error({ creditErr, beneficiaryId: rec.beneficiary_id, record: rec }, 'Failed to credit beneficiary wallet');
      }
    }
  }

  // Update Order with full commission breakdown
  await Order.updateOne(
    { _id: lockedOrder._id },
    {
      $set: {
        commissionProcessed: true,
        commissionMargin: marginRupees,
        commissionTotal: Number(totalDistributed.toFixed(2)),
        commissionBreakdown: breakdown,
      },
    },
  ).catch((err) => {
    log.warn({ err, orderId: lockedOrder._id }, 'Could not update order with commission summary');
  });

  // ---- DETAILED HUMAN-READABLE LOGGING ----
  console.log('\n' + '='.repeat(82));
  console.log(`[COMMISSION DISTRIBUTION SUCCESS] Order Number: ${orderNumber}`);
  console.log(`Customer: ${sourceName} (ID / Mobile: ${sourceId})`);
  console.log(`Order Margin Amount: ₹${marginRupees.toFixed(2)}`);
  console.log(`Total Commission Distributed: ₹${totalDistributed.toFixed(2)} across ${records.length} levels`);
  console.log('-'.repeat(82));
  console.log(
    'Level'.padEnd(8) +
    'Role'.padEnd(18) +
    'Beneficiary ID'.padEnd(18) +
    'Rate'.padEnd(8) +
    'Amount (₹)'.padEnd(14) +
    'Notes'
  );
  console.log('-'.repeat(82));
  for (const item of breakdown) {
    console.log(
      `L${item.level}`.padEnd(8) +
      item.role.padEnd(18) +
      item.beneficiaryId.padEnd(18) +
      `${item.rate}%`.padEnd(8) +
      `₹${item.amount.toFixed(2)}`.padEnd(14) +
      (item.beneficiaryName ? `(${item.beneficiaryName})` : '')
    );
  }
  console.log('='.repeat(82) + '\n');

  log.info(
    {
      orderNumber,
      sourceId,
      sourceName,
      marginRupees,
      totalDistributed,
      recordsCount: records.length,
      breakdown,
    },
    '[COMMISSION DISTRIBUTION COMPLETE]',
  );

  return {
    orderNumber,
    marginRupees,
    totalCommissionsDistributed: Number(totalDistributed.toFixed(2)),
    recordsCount: records.length,
    breakdown,
  };
}
