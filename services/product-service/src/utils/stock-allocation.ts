import mongoose from 'mongoose';
import { Product } from '../models/product.model.js';
import { createLogger } from '@ornate/logger';

const log = createLogger('stock-allocation');

function getAuthDb(): any {
  const conn: any = mongoose.connection;
  const client = typeof conn.getClient === 'function' ? conn.getClient() : conn.client;
  const dbName = process.env.AUTH_DB_NAME ?? 'ornate_auth';
  return client ? client.db(dbName) : mongoose.connection.useDb(dbName).db;
}

export interface AllocationResult {
  sellerId: string | null;
  sellerName: string | null;
  storeId: string | null;
  storeName: string | null;
  assignedStock: number;
  unassignedStock: number;
  assignmentStatus: 'assigned' | 'partially_assigned' | 'unassigned';
}

/**
 * Given a subcategory and incoming stock, finds an active seller assigned to that subcategory
 * that has remaining capacity (maxStockLimit - currentStockTotal > 0).
 * Allocates up to available capacity and updates seller.currentStockTotal.
 */
export async function allocateStockForProduct(params: {
  subcategoryId?: string | null;
  categoryId?: string | null;
  requestedSellerId?: string | null;
  requestedStoreId?: string | null;
  stock: number;
}): Promise<AllocationResult> {
  const requestedId = params.requestedSellerId || params.requestedStoreId || null;
  const stock = Math.max(0, Number(params.stock || 0));
  if (stock === 0) {
    return {
      sellerId: requestedId,
      sellerName: null,
      storeId: requestedId,
      storeName: null,
      assignedStock: 0,
      unassignedStock: 0,
      assignmentStatus: 'assigned',
    };
  }

  const authDb = getAuthDb();
  const subcategoryId = params.subcategoryId ? String(params.subcategoryId).trim() : null;
  const categoryId = params.categoryId ? String(params.categoryId).trim() : null;

  let targetSeller: any = null;

  // 1. If a specific seller was requested (e.g. by a seller owner):
  if (requestedId) {
    targetSeller = await authDb.collection('stores').findOne({
      $or: [{ sellerId: requestedId }, { storeId: requestedId }],
      isActive: true,
      status: { $ne: 'suspended' },
    });
  }

  // 2. Otherwise find an active seller matching subcategoryId with space available
  if (!targetSeller && subcategoryId) {
    const candidateSellers = await authDb
      .collection('stores')
      .find({
        subcategoryId,
        isActive: true,
        status: { $ne: 'suspended' },
      })
      .toArray();

    for (const seller of candidateSellers) {
      const maxLimit = Number(seller.maxStockLimit ?? 2500);
      const current = Number(seller.currentStockTotal ?? 0);
      if (maxLimit - current > 0) {
        targetSeller = seller;
        break;
      }
    }
  }

  // 3. Fallback to categoryId if no subcategoryId matched
  if (!targetSeller && categoryId && !subcategoryId) {
    const candidateSellers = await authDb
      .collection('stores')
      .find({
        categoryId,
        isActive: true,
        status: { $ne: 'suspended' },
      })
      .toArray();

    for (const seller of candidateSellers) {
      const maxLimit = Number(seller.maxStockLimit ?? 2500);
      const current = Number(seller.currentStockTotal ?? 0);
      if (maxLimit - current > 0) {
        targetSeller = seller;
        break;
      }
    }
  }

  if (!targetSeller) {
    // No seller or all sellers full -> 100% unassigned
    log.info({ subcategoryId, categoryId, stock }, 'No seller with available capacity found. Queuing as unassigned.');
    return {
      sellerId: null,
      sellerName: null,
      storeId: null,
      storeName: null,
      assignedStock: 0,
      unassignedStock: stock,
      assignmentStatus: 'unassigned',
    };
  }

  const maxLimit = Number(targetSeller.maxStockLimit ?? 2500);
  const currentTotal = Number(targetSeller.currentStockTotal ?? 0);
  const availableSpace = Math.max(0, maxLimit - currentTotal);

  const unitsToAssign = Math.min(stock, availableSpace);
  const remainingUnassigned = stock - unitsToAssign;

  if (unitsToAssign > 0) {
    await authDb.collection('stores').updateOne(
      { _id: targetSeller._id },
      { $inc: { currentStockTotal: unitsToAssign } }
    );
  }

  const assignmentStatus: 'assigned' | 'partially_assigned' | 'unassigned' =
    remainingUnassigned === 0
      ? 'assigned'
      : unitsToAssign > 0
      ? 'partially_assigned'
      : 'unassigned';

  const resolvedSellerId = targetSeller.sellerId || targetSeller.storeId || String(targetSeller._id);

  log.info(
    {
      sellerId: resolvedSellerId,
      sellerName: targetSeller.name,
      unitsToAssign,
      remainingUnassigned,
      assignmentStatus,
    },
    'Stock allocated to seller'
  );

  return {
    sellerId: resolvedSellerId,
    sellerName: targetSeller.name,
    storeId: resolvedSellerId,
    storeName: targetSeller.name,
    assignedStock: unitsToAssign,
    unassignedStock: remainingUnassigned,
    assignmentStatus,
  };
}

/**
 * When a new seller is created or capacity is increased, auto-assigns unassigned stock
 * in that subcategory to the seller up to its maxStockLimit.
 */
export async function autoAssignUnassignedStockToSeller(seller: {
  sellerId?: string;
  storeId?: string;
  name: string;
  subcategoryId?: string | null;
  categoryId?: string | null;
  maxStockLimit?: number;
  currentStockTotal?: number;
}): Promise<{ allocatedProducts: number; allocatedUnits: number }> {
  const authDb = getAuthDb();
  const effectiveId = seller.sellerId || seller.storeId || '';
  const subcategoryId = seller.subcategoryId ? String(seller.subcategoryId).trim() : null;
  const maxLimit = Number(seller.maxStockLimit ?? 2500);
  const currentTotal = Number(seller.currentStockTotal ?? 0);
  let remainingCapacity = Math.max(0, maxLimit - currentTotal);

  if (!effectiveId || !subcategoryId || remainingCapacity <= 0) {
    return { allocatedProducts: 0, allocatedUnits: 0 };
  }

  // Find unassigned or partially assigned products in this subcategory, FIFO
  const pendingProducts = await Product.find({
    $or: [
      { subcategoryId, unassignedStock: { $gt: 0 } },
      { subcategoryId, assignmentStatus: { $in: ['unassigned', 'partially_assigned'] } },
      ...(mongoose.Types.ObjectId.isValid(subcategoryId)
        ? [
            { subcategory: new mongoose.Types.ObjectId(subcategoryId), unassignedStock: { $gt: 0 } },
            { subcategory: new mongoose.Types.ObjectId(subcategoryId), assignmentStatus: { $in: ['unassigned', 'partially_assigned'] } },
          ]
        : []),
    ],
  }).sort({ createdAt: 1 });

  let allocatedProducts = 0;
  let allocatedUnits = 0;

  for (const prod of pendingProducts) {
    if (remainingCapacity <= 0) break;

    const unassigned = Number(prod.unassignedStock ?? ((prod.sellerId || prod.storeId) ? 0 : prod.stock));
    if (unassigned <= 0) continue;

    const qtyToAllocate = Math.min(unassigned, remainingCapacity);

    prod.assignedStock = (prod.assignedStock || 0) + qtyToAllocate;
    prod.unassignedStock = unassigned - qtyToAllocate;
    prod.sellerId = effectiveId;
    prod.sellerName = seller.name;
    prod.storeId = effectiveId;
    prod.storeName = seller.name;
    prod.assignmentStatus = prod.unassignedStock === 0 ? 'assigned' : 'partially_assigned';

    await prod.save();

    remainingCapacity -= qtyToAllocate;
    allocatedUnits += qtyToAllocate;
    allocatedProducts++;
  }

  if (allocatedUnits > 0) {
    await authDb.collection('stores').updateOne(
      { $or: [{ sellerId: effectiveId }, { storeId: effectiveId }] },
      { $inc: { currentStockTotal: allocatedUnits } }
    );
    log.info(
      {
        sellerId: effectiveId,
        allocatedProducts,
        allocatedUnits,
        newCurrentTotal: currentTotal + allocatedUnits,
      },
      'Auto-assigned unassigned products to seller'
    );
  }

  return { allocatedProducts, allocatedUnits };
}

// Backward compatibility alias
export const autoAssignUnassignedStockToStore = autoAssignUnassignedStockToSeller;
