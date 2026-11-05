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
  level: number;
  userLevel: number;
  rate: number;
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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getSearchVariants(raw: string) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    return { strings: [], numbers: [], regexes: [] };
  }

  const strSet = new Set<string>();
  strSet.add(trimmed);
  strSet.add(trimmed.toLowerCase());

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

  return { strings: Array.from(strSet), numbers, regexes };
}

function buildVendorQuery(code: string): { $or: any[] } {
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

function buildCustomerQuery(code: string): { $or: any[] } {
  const { strings, numbers, regexes } = getSearchVariants(code);
  const conditions: any[] = [];

  if (mongoose.Types.ObjectId.isValid(code)) {
    conditions.push({ _id: new mongoose.Types.ObjectId(code) });
  }

  const customerFields = [
    'customerId',
    'customer_id',
    'email',
    'mobileNumber',
    'phone',
    'username',
    'referralCode',
  ];

  for (const field of customerFields) {
    for (const s of strings) {
      conditions.push({ [field]: s });
    }
    for (const r of regexes) {
      conditions.push({ [field]: r });
    }
  }

  const numericCustomerFields = ['mobileNumber', 'phone', 'username'];
  for (const field of numericCustomerFields) {
    for (const n of numbers) {
      conditions.push({ [field]: n });
    }
  }

  return { $or: conditions.length > 0 ? conditions : [{ customerId: code }] };
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
    const custQ = buildCustomerQuery(order.userId);
    query.push(...custQ.$or);
  }
  if (order.customerEmail) {
    const emailQ = buildCustomerQuery(order.customerEmail);
    query.push(...emailQ.$or);
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
 * Resolves the upline referral chain from Level 2 up to Level 20.
 * Follows upstream customers in ornate_auth.customers, then vendors in e-cash.vendor_tbl.
 * Level 2 receives 5% commission rate, while Levels 3 to 20 receive 0.5% each.
 */
export async function traceReferralChain(
  customer: any,
  authDb: any,
  ecashDb: any,
  sponsorId: string | null,
): Promise<UplineMember[]> {
  const upline: UplineMember[] = [];
  const visited = new Set<string>();

  const customerId = String(customer?.customerId || customer?.customer_id || customer?.mobileNumber || customer?._id || '').trim();
  if (customerId) visited.add(customerId.toLowerCase());
  if (sponsorId) visited.add(String(sponsorId).trim().toLowerCase());

  let currentLevel = 2;
  let currentCode: string | null = null;
  let reachedVendorId: string | null = null;

  // Determine where Level 2 starts based on the direct sponsor
  if (sponsorId) {
    try {
      const sponsorCust = await authDb.collection('customers').findOne(buildCustomerQuery(sponsorId));
      if (sponsorCust) {
        const parentRef = String(sponsorCust.referralCode || '').trim();
        const parentType = sponsorCust.referralType;
        if (parentType === 'vendor') {
          reachedVendorId = sponsorCust.vendor_id || parentRef;
        } else if (parentRef) {
          currentCode = parentRef;
        } else if (sponsorCust.vendor_id) {
          reachedVendorId = sponsorCust.vendor_id;
        }
      } else {
        // Direct sponsor is a vendor in vendor_tbl
        reachedVendorId = sponsorId;
      }
    } catch (err) {
      log.warn({ err, sponsorId }, 'Error looking up sponsor for upline trace');
    }
  }

  // 1. Trace upstream customers
  while (currentCode && currentLevel <= 20) {
    const custId = String(currentCode).trim();
    if (!custId || visited.has(custId.toLowerCase())) break;

    try {
      const custDoc = await authDb.collection('customers').findOne(buildCustomerQuery(custId));

      if (custDoc) {
        const canonicalId = String(custDoc.customerId || custDoc.customer_id || custDoc.mobileNumber || custId);
        visited.add(canonicalId.toLowerCase());
        visited.add(custId.toLowerCase());
        const userLevel = Number(custDoc.level ?? 0);

        upline.push({
          id: canonicalId,
          name: custDoc.fullName || custDoc.name || 'Customer',
          type: 'customer',
          level: currentLevel,
          userLevel,
          rate: currentLevel === 2 ? 5 : 0.5,
        });
        currentLevel++;

        if (currentLevel > 20) break;

        const parentRef = String(custDoc.referralCode || '').trim();
        const parentType = custDoc.referralType;

        if (parentType === 'vendor') {
          reachedVendorId = custDoc.vendor_id || parentRef;
          currentCode = null;
        } else if (parentRef) {
          currentCode = parentRef;
        } else if (custDoc.vendor_id) {
          reachedVendorId = custDoc.vendor_id;
          currentCode = null;
        } else {
          currentCode = null;
        }
      } else {
        // If code is not found in customers, it points to a vendor in vendor_tbl
        reachedVendorId = custId;
        currentCode = null;
      }
    } catch {
      break;
    }
  }

  // 2. Trace upstream vendors via e-cash vendor_tbl
  if (reachedVendorId && currentLevel <= 20) {
    try {
      const vendorDoc = await ecashDb.collection('vendor_tbl').findOne(buildVendorQuery(reachedVendorId));

      if (vendorDoc) {
        const canonicalVendorId = String(vendorDoc.Member_id || vendorDoc.member_id || vendorDoc.member_code || reachedVendorId).trim();

        // If this vendor is not the direct sponsor (which was added to visited at startup),
        // add this vendor into the upline chain:
        if (!visited.has(canonicalVendorId.toLowerCase()) && !visited.has(reachedVendorId.toLowerCase())) {
          visited.add(canonicalVendorId.toLowerCase());
          visited.add(reachedVendorId.toLowerCase());
          const userLevel = Number(vendorDoc.level ?? 0);

          upline.push({
            id: canonicalVendorId,
            name: vendorDoc.Name || vendorDoc.name || vendorDoc.firm_name || 'Vendor',
            type: 'vendor',
            level: currentLevel,
            userLevel,
            rate: currentLevel === 2 ? 5 : 0.5,
          });
          currentLevel++;
        }

        // Trace vendor's upline introducers
        // A. Check introducer_hierarchy array
        if (Array.isArray(vendorDoc.introducer_hierarchy)) {
          for (const uplineId of vendorDoc.introducer_hierarchy) {
            if (currentLevel > 20) break;
            const cleanId = String(uplineId || '').trim();
            if (cleanId && !visited.has(cleanId.toLowerCase())) {
              visited.add(cleanId.toLowerCase());
              let vName = 'Vendor';
              let vLevel = 0;
              try {
                const uDoc = await ecashDb.collection('vendor_tbl').findOne(buildVendorQuery(cleanId));
                if (uDoc) {
                  vName = uDoc.Name || uDoc.name || uDoc.firm_name || 'Vendor';
                  vLevel = Number(uDoc.level ?? 0);
                }
              } catch {}
              upline.push({
                id: cleanId,
                name: vName,
                type: 'vendor',
                level: currentLevel,
                userLevel: vLevel,
                rate: currentLevel === 2 ? 5 : 0.5,
              });
              currentLevel++;
            }
          }
        }

        // B. Also traverse sponsor_id / introducer / Sponsor_code
        let currentVendor = vendorDoc;
        let vHops = 0;
        while (currentVendor && currentLevel <= 20 && vHops < 20) {
          const nextVId = String(currentVendor.sponsor_id || currentVendor.introducer || currentVendor.Sponsor_code || '').trim();
          if (!nextVId) break;

          let nextDoc: any = null;
          try {
            nextDoc = await ecashDb.collection('vendor_tbl').findOne(buildVendorQuery(nextVId));
          } catch {}

          if (!visited.has(nextVId.toLowerCase())) {
            visited.add(nextVId.toLowerCase());
            const vName = nextDoc?.Name || nextDoc?.name || nextDoc?.firm_name || currentVendor.Sponsor_name || currentVendor.introducer_name || 'Vendor';
            const vLevel = Number(nextDoc?.level ?? 0);
            upline.push({
              id: nextVId,
              name: vName,
              type: 'vendor',
              level: currentLevel,
              userLevel: vLevel,
              rate: currentLevel === 2 ? 5 : 0.5,
            });
            currentLevel++;
          }

          currentVendor = nextDoc;
          vHops++;
        }
      }
    } catch (err) {
      log.warn({ err, reachedVendorId }, 'Error tracing vendor upline hierarchy');
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
      role: 'Level 1 Sponsor',
      beneficiaryId: sponsorId,
      beneficiaryName: customer?.referralName,
      rate: 5,
      amount: level1Amount,
      commissionId: commId,
    });
    totalDistributed += level1Amount;
  }

  // Vendor Margin Bonus (5%)
  // If sponsor and vendor are the same entity, both entries are created so they receive 5% two times (10% total).
  const vendorAmount = Number(((marginRupees * 5) / 100).toFixed(2));
  if (vendorAmount > 0 && vendorId) {
    const commId = `COM-${Date.now()}-0-${Math.floor(1000 + Math.random() * 9000)}`;
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
      account_type: 'Vendor Margin Bonus (Order Margin)',
      account_type_id: 'COMMISSION_MARGIN',
      transaction_amount: marginRupees,
      commission_rate: 5,
      commission_amount: vendorAmount,
      level: 0,
      status: 'CREDITED',
      credited_at: now,
      failure_reason: null,
      notes: `Vendor (${vendorId}) - 5% Margin Commission for Order ${orderNumber}`,
      createdAt: now,
      updatedAt: now,
      __v: 0,
    });
    breakdown.push({
      level: 0,
      role: 'Vendor Bonus',
      beneficiaryId: vendorId,
      beneficiaryName: customer?.vendor_name,
      rate: 5,
      amount: vendorAmount,
      commissionId: commId,
    });
    totalDistributed += vendorAmount;
  }

  // Upline Referral Chain: Level 2 (5%) and Levels 3 to 20 (0.5% each)
  const uplineChain = await traceReferralChain(customer || {}, authDb, ecashDb, sponsorId);

  for (const member of uplineChain) {
    const levelNumber = member.level;
    const userLevel = member.userLevel;

    // Verify user's level matches the upline level number (e.g., Level 7 commission requires user level === 7)
    if (userLevel !== levelNumber) {
      log.info(
        {
          orderNumber,
          levelNumber,
          userLevel,
          beneficiaryId: member.id,
        },
        `[COMMISSION] Skipping Level ${levelNumber} and member ${member.id}: user level (${userLevel}) does not match required level (${levelNumber})`
      );
      continue;
    }

    const rate = member.rate;
    const levelAmount = Number(((marginRupees * rate) / 100).toFixed(2));

    if (levelAmount > 0) {
      const commId = `COM-${Date.now()}-${levelNumber}-${Math.floor(1000 + Math.random() * 9000)}`;
      const isLevel2 = levelNumber === 2;
      const accountType = isLevel2
        ? 'Level 2 Sponsor Bonus (Order Margin)'
        : `Level ${levelNumber} Network Bonus (Order Margin)`;
      const role = isLevel2
        ? `Level 2 Sponsor (${member.type})`
        : `Level ${levelNumber} Network (${member.type})`;
      const notes = isLevel2
        ? `Level 2 Sponsor (${member.id}) - 5% Margin Commission for Order ${orderNumber}`
        : `Level ${levelNumber} Network (${member.id}) - 0.5% Margin Commission for Order ${orderNumber}`;

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
        account_type: accountType,
        account_type_id: 'COMMISSION_MARGIN',
        transaction_amount: marginRupees,
        commission_rate: rate,
        commission_amount: levelAmount,
        level: levelNumber,
        status: 'CREDITED',
        credited_at: now,
        failure_reason: null,
        notes,
        createdAt: now,
        updatedAt: now,
        __v: 0,
      });

      breakdown.push({
        level: levelNumber,
        role,
        beneficiaryId: member.id,
        beneficiaryName: member.name,
        rate,
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
          const customerDoc = await authDb.collection('customers').findOne(buildCustomerQuery(benId));

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
          const vendorDoc = await ecashDb.collection('vendor_tbl').findOne(buildVendorQuery(benId));

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
  console.log('\n' + '='.repeat(96));
  console.log(`[COMMISSION DISTRIBUTION SUCCESS] Order Number: ${orderNumber}`);
  console.log(`Customer: ${sourceName} (ID / Mobile: ${sourceId})`);
  console.log(`Order Margin Amount: ₹${marginRupees.toFixed(2)}`);
  console.log(`Total Commission Distributed: ₹${totalDistributed.toFixed(2)} across ${records.length} records`);
  console.log('-'.repeat(96));
  console.log(
    'Level'.padEnd(10) +
    'Role'.padEnd(28) +
    'Beneficiary ID'.padEnd(20) +
    'Rate'.padEnd(8) +
    'Amount (₹)'.padEnd(14) +
    'Notes'
  );
  console.log('-'.repeat(96));
  for (const item of breakdown) {
    const lvlStr = item.level === 0 ? 'Vendor' : `L${item.level}`;
    console.log(
      lvlStr.padEnd(10) +
      item.role.padEnd(28) +
      item.beneficiaryId.padEnd(20) +
      `${item.rate}%`.padEnd(8) +
      `₹${item.amount.toFixed(2)}`.padEnd(14) +
      (item.beneficiaryName ? `(${item.beneficiaryName})` : '')
    );
  }
  console.log('='.repeat(96) + '\n');

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
