import 'dotenv/config';
import { connectDB } from '@ornate/db';
import { InventoryItem, InventoryMovement } from '../models/inventory.model.js';
import axios from 'axios';

async function syncInventory() {
  await connectDB(
    process.env.MONGODB_URI ?? 'mongodb://localhost:27017',
    process.env.INVENTORY_DB_NAME ?? 'ornate_inventory',
  );

  const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL ?? 'http://localhost:4003';
  console.log('Fetching products from:', PRODUCT_SERVICE_URL);

  const res = await axios.get(`${PRODUCT_SERVICE_URL}/api/v1/products?limit=100`);
  const products = res.data?.data?.items ?? [];

  console.log(`Found ${products.length} products to sync into inventory.`);

  for (const prod of products) {
    const existing = await InventoryItem.findOne({ productId: prod.id, variantId: null });
    if (!existing) {
      const stock = prod.stock ?? 50;
      await InventoryItem.create({
        productId: prod.id,
        variantId: null,
        sku: prod.sku,
        productName: prod.name,
        quantity: stock,
        reserved: 0,
        available: stock,
        lowStockThreshold: 10,
      });

      await InventoryMovement.create({
        productId: prod.id,
        variantId: null,
        sku: prod.sku,
        type: 'restock',
        delta: stock,
        balanceBefore: 0,
        balanceAfter: stock,
        reason: 'Initial catalog stocking',
        performedBy: 'System Seeder',
      });
      console.log(`Initialized inventory for: ${prod.name} (${stock} units)`);
    }
  }

  console.log('Inventory sync complete!');
  process.exit(0);
}

syncInventory().catch((err) => {
  console.error('Inventory sync error:', err);
  process.exit(1);
});
