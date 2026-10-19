import { Request, Response, NextFunction } from 'express';
import { InventoryItem, InventoryMovement } from '../models/inventory.model.js';

export async function checkStock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'items array required.' } });
      return;
    }

    const results = await Promise.all(
      items.map(async (item: { productId: string; variantId?: string; quantity: number }) => {
        const inv = await InventoryItem.findOne({
          productId: item.productId,
          variantId: item.variantId || null,
        });

        // If inventory item doesn't exist yet, assume in stock for dev (or 50)
        const available = inv ? inv.available : 50;
        return {
          productId: item.productId,
          variantId: item.variantId || null,
          requested: item.quantity,
          available,
          isSufficient: available >= item.quantity,
        };
      }),
    );

    const allSufficient = results.every((r) => r.isSufficient);
    res.json({ success: true, data: { isAvailable: allSufficient, items: results } });
  } catch (err) {
    next(err);
  }
}

export async function reserveStock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'items array required.' } });
      return;
    }

    for (const item of items) {
      let inv = await InventoryItem.findOne({
        productId: item.productId,
        variantId: item.variantId || null,
      });

      if (!inv) {
        inv = await InventoryItem.create({
          productId: item.productId,
          variantId: item.variantId || null,
          sku: item.sku || `SKU-${item.productId}`,
          productName: item.name || 'Product',
          quantity: 100,
          reserved: 0,
          available: 100,
        });
      }

      const before = inv.available;
      inv.reserved += item.quantity;
      inv.available = Math.max(0, inv.quantity - inv.reserved);
      await inv.save();

      await InventoryMovement.create({
        productId: item.productId,
        variantId: item.variantId || null,
        sku: inv.sku,
        type: 'reservation',
        delta: item.quantity,
        balanceBefore: before,
        balanceAfter: inv.available,
        reason: 'Order checkout reservation',
        performedBy: req.user?.email || 'System',
      });
    }

    res.json({ success: true, message: 'Stock reserved successfully.' });
  } catch (err) {
    next(err);
  }
}

export async function deductStock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'items array required.' } });
      return;
    }

    for (const item of items) {
      const inv = await InventoryItem.findOne({
        productId: item.productId,
        variantId: item.variantId || null,
      });

      if (inv) {
        const before = inv.quantity;
        inv.quantity = Math.max(0, inv.quantity - item.quantity);
        inv.reserved = Math.max(0, inv.reserved - item.quantity);
        inv.available = Math.max(0, inv.quantity - inv.reserved);
        await inv.save();

        await InventoryMovement.create({
          productId: item.productId,
          variantId: item.variantId || null,
          sku: inv.sku,
          type: 'sale',
          delta: -item.quantity,
          balanceBefore: before,
          balanceAfter: inv.quantity,
          reason: 'Order confirmed sale',
          performedBy: req.user?.email || 'System',
        });
      }
    }

    res.json({ success: true, message: 'Stock deducted successfully.' });
  } catch (err) {
    next(err);
  }
}

// ---- Admin Endpoints ----
export async function adminListInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const { search, lowStockOnly } = req.query;

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { productName: { $regex: String(search), $options: 'i' } },
        { sku: { $regex: String(search), $options: 'i' } },
      ];
    }
    if (lowStockOnly === 'true') {
      filter.$expr = { $lte: ['$quantity', '$lowStockThreshold'] };
    }

    const [items, total] = await Promise.all([
      InventoryItem.find(filter)
        .sort({ quantity: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      InventoryItem.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function adminAdjustStock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { productId, variantId, delta, reason, type = 'adjustment' } = req.body;
    if (!productId || delta === undefined) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'productId and delta required.' } });
      return;
    }

    let inv = await InventoryItem.findOne({ productId, variantId: variantId || null });
    if (!inv) {
      inv = await InventoryItem.create({
        productId,
        variantId: variantId || null,
        sku: req.body.sku || `SKU-${productId}`,
        productName: req.body.productName || 'Product',
        quantity: 0,
        reserved: 0,
        available: 0,
      });
    }

    const before = inv.quantity;
    inv.quantity = Math.max(0, inv.quantity + Number(delta));
    inv.available = Math.max(0, inv.quantity - inv.reserved);
    await inv.save();

    await InventoryMovement.create({
      productId,
      variantId: variantId || null,
      sku: inv.sku,
      type: type as any,
      delta: Number(delta),
      balanceBefore: before,
      balanceAfter: inv.quantity,
      reason: reason || 'Manual adjustment by admin',
      performedBy: req.user?.email || 'Admin',
    });

    res.json({ success: true, data: inv, message: 'Stock adjusted successfully.' });
  } catch (err) {
    next(err);
  }
}

export async function adminListMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const { productId, type } = req.query;

    const filter: Record<string, unknown> = {};
    if (productId) filter.productId = productId;
    if (type) filter.type = type;

    const [items, total] = await Promise.all([
      InventoryMovement.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      InventoryMovement.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}
