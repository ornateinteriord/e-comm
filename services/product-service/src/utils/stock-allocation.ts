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
  storeId: string | null;
  storeName: string | null;
  assignedStock: number;
  unassignedStock: number;
  assignmentStatus: 'assigned' | 'partially_assigned' | 'unassigned';
}

/**
 * Given a subcategory and incoming stock, finds an active store assigned to that subcategory
 * that has remaining capacity (maxStockLimit - currentStockTotal > 0).
 * Allocates up to available capacity and updates store.currentStockTotal.
 */
export async function allocateStockForProduct(params: {
  subcategoryId?: string | null;
  categoryId?: string | null;
  requestedStoreId?: string | null;
  stock: number;
}): Promise<AllocationResult> {
  const stock = Math.max(0, Number(params.stock || 0));
  if (stock === 0) {
    return {
      storeId: params.requestedStoreId || null,
      storeName: null,
      assignedStock: 0,
      unassignedStock: 0,
      assignmentStatus: 'assigned',
    };
  }

  const authDb = getAuthDb();
  const subcategoryId = params.subcategoryId ? String(params.subcategoryId).trim() : null;
  const categoryId = params.categoryId ? String(params.categoryId).trim() : null;

  let targetStore: any = null;

  // 1. If a specific store was requested (e.g. by a store owner):
  if (params.requestedStoreId) {
    targetStore = await authDb.collection('stores').findOne({
      storeId: params.requestedStoreId,
      isActive: true,
      status: { $ne: 'suspended' },
    });
  }

  // 2. Otherwise find an active store matching subcategoryId with space available
  if (!targetStore && subcategoryId) {
    const candidateStores = await authDb
      .collection('stores')
      .find({
        subcategoryId,
        isActive: true,
        status: { $ne: 'suspended' },
      })
      .toArray();

    for (const store of candidateStores) {
      const maxLimit = Number(store.maxStockLimit ?? 2500);
      const current = Number(store.currentStockTotal ?? 0);
      if (maxLimit - current > 0) {
        targetStore = store;
        break;
      }
    }
  }

  // 3. Fallback to categoryId if no subcategoryId matched
  if (!targetStore && categoryId && !subcategoryId) {
    const candidateStores = await authDb
      .collection('stores')
      .find({
        categoryId,
        isActive: true,
        status: { $ne: 'suspended' },
      })
      .toArray();

    for (const store of candidateStores) {
      const maxLimit = Number(store.maxStockLimit ?? 2500);
      const current = Number(store.currentStockTotal ?? 0);
      if (maxLimit - current > 0) {
        targetStore = store;
        break;
      }
    }
  }

  if (!targetStore) {
    // No store or all stores full -> 100% unassigned
    log.info({ subcategoryId, categoryId, stock }, 'No store with available capacity found. Queuing as unassigned.');
    return {
      storeId: null,
      storeName: null,
      assignedStock: 0,
      unassignedStock: stock,
      assignmentStatus: 'unassigned',
    };
  }

  const maxLimit = Number(targetStore.maxStockLimit ?? 2500);
  const currentTotal = Number(targetStore.currentStockTotal ?? 0);
  const availableSpace = Math.max(0, maxLimit - currentTotal);

  const unitsToAssign = Math.min(stock, availableSpace);
  const remainingUnassigned = stock - unitsToAssign;

  if (unitsToAssign > 0) {
    await authDb.collection('stores').updateOne(
      { _id: targetStore._id },
      { $inc: { currentStockTotal: unitsToAssign } }
    );
  }

  const assignmentStatus: 'assigned' | 'partially_assigned' | 'unassigned' =
    remainingUnassigned === 0
      ? 'assigned'
      : unitsToAssign > 0
      ? 'partially_assigned'
      : 'unassigned';

  log.info(
    {
      storeId: targetStore.storeId,
      storeName: targetStore.name,
      unitsToAssign,
      remainingUnassigned,
      assignmentStatus,
    },
    'Stock allocated to store'
  );

  return {
    storeId: targetStore.storeId,
    storeName: targetStore.name,
    assignedStock: unitsToAssign,
    unassignedStock: remainingUnassigned,
    assignmentStatus,
  };
}

/**
 * When a new store is created or capacity is increased, auto-assigns unassigned stock
 * in that subcategory to the new store up to its maxStockLimit.
 */
export async function autoAssignUnassignedStockToStore(store: {
  storeId: string;
  name: string;
  subcategoryId?: string | null;
  categoryId?: string | null;
  maxStockLimit?: number;
  currentStockTotal?: number;
}): Promise<{ allocatedProducts: number; allocatedUnits: number }> {
  const authDb = getAuthDb();
  const subcategoryId = store.subcategoryId ? String(store.subcategoryId).trim() : null;
  const maxLimit = Number(store.maxStockLimit ?? 2500);
  let currentTotal = Number(store.currentStockTotal ?? 0);
  let remainingCapacity = Math.max(0, maxLimit - currentTotal);

  if (!subcategoryId || remainingCapacity <= 0) {
    return { allocatedProducts: 0, allocatedUnits: 0 };
  }

  // Find unassigned or partially assigned products in this subcategory, FIFO
  const pendingProducts = await Product.find({
    $or: [
      { subcategoryId, unassignedStock: { $gt: 0 } },
      { subcategoryId, assignmentStatus: { $in: ['unassigned', 'partially_assigned'] } },
    ],
  }).sort({ createdAt: 1 });

  let allocatedProducts = 0;
  let allocatedUnits = 0;

  for (const prod of pendingProducts) {
    if (remainingCapacity <= 0) break;

    const unassigned = Number(prod.unassignedStock ?? (prod.storeId ? 0 : prod.stock));
    if (unassigned <= 0) continue;

    const qtyToAllocate = Math.min(unassigned, remainingCapacity);

    prod.assignedStock = (prod.assignedStock || 0) + qtyToAllocate;
    prod.unassignedStock = unassigned - qtyToAllocate;
    prod.storeId = store.storeId;
    prod.storeName = store.name;
    prod.assignmentStatus = prod.unassignedStock === 0 ? 'assigned' : 'partially_assigned';

    await prod.save();

    remainingCapacity -= qtyToAllocate;
    allocatedUnits += qtyToAllocate;
    allocatedProducts++;
  }

  if (allocatedUnits > 0) {
    await authDb.collection('stores').updateOne(
      { storeId: store.storeId },
      { $inc: { currentStockTotal: allocatedUnits } }
    );
    log.info(
      {
        storeId: store.storeId,
        allocatedProducts,
        allocatedUnits,
        newCurrentTotal: currentTotal + allocatedUnits,
      },
      'Auto-assigned unassigned products to new store'
    );
  }

  return { allocatedProducts, allocatedUnits };
}

