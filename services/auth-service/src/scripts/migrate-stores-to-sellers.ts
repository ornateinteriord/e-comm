import { connectDB, mongoose } from '@ornate/db';

const uri = process.env.MONGODB_URI || '';
if (!uri) {
  console.error('MONGODB_URI environment variable is required to run migration.');
  process.exit(1);
}

async function migrate() {
  console.log('[Migration] Starting Store -> Seller data migration...');

  // 1. Migrate auth DB: stores -> sellers
  const authDbName = process.env.AUTH_DB_NAME || 'ornate_auth';
  await connectDB(uri, authDbName);
  const authDb = mongoose.connection.useDb(authDbName).db;
  if (!authDb) {
    throw new Error('Could not connect to auth database.');
  }

  const collections = await authDb.listCollections().toArray();
  const collNames = collections.map((c) => c.name);

  if (collNames.includes('stores')) {
    const storesColl = authDb.collection('stores');
    const sellersColl = authDb.collection('sellers');

    const stores = await storesColl.find().toArray();
    console.log(`[Migration] Found ${stores.length} store documents in "${authDbName}.stores" to migrate.`);

    for (const store of stores) {
      const effectiveId = store.sellerId || store.storeId || store._id.toString();
      const type = store.typeOfSeller || store.typeOfStore || 'Standard';
      const refType = store.referralType === 'store' ? 'seller' : (store.referralType || 'vendor');

      await sellersColl.updateOne(
        { _id: store._id },
        {
          $set: {
            ...store,
            sellerId: effectiveId,
            storeId: effectiveId,
            typeOfSeller: type,
            typeOfStore: type,
            role: 'seller',
            referralType: refType,
          },
        },
        { upsert: true },
      );
      console.log(`[Migration] Migrated store "${store.name}" (${effectiveId}) -> sellers collection.`);
    }

    // Ensure indexes on sellers collection
    await sellersColl.createIndex({ sellerId: 1 }, { unique: true, sparse: true });
    await sellersColl.createIndex({ mobileNumber: 1 }, { unique: true, sparse: true });
    await sellersColl.createIndex({ categoryId: 1 });
    await sellersColl.createIndex({ referralCode: 1 });
    console.log('[Migration] Indexes ensured on sellers collection.');
  } else {
    console.log(`[Migration] Collection "${authDbName}.stores" not found, checking sellers collection...`);
  }

  // 2. Migrate products DB: storeId -> sellerId, createdBy.type
  const prodDbName = process.env.PRODUCT_DB_NAME || 'ornate_products';
  const prodDb = mongoose.connection.useDb(prodDbName).db;
  if (prodDb) {
    const productsColl = prodDb.collection('products');
    const prodRes = await productsColl.updateMany(
      { storeId: { $exists: true, $ne: null } },
      [
        {
          $set: {
            sellerId: { $ifNull: ['$sellerId', '$storeId'] },
            sellerName: { $ifNull: ['$sellerName', '$storeName'] },
          },
        },
      ],
    );
    console.log(`[Migration] Updated ${prodRes.modifiedCount} products with sellerId/sellerName.`);

    const createdByRes = await productsColl.updateMany(
      { 'createdBy.type': 'store' },
      { $set: { 'createdBy.type': 'seller' } },
    );
    console.log(`[Migration] Updated ${createdByRes.modifiedCount} products createdBy.type -> "seller".`);

    await productsColl.createIndex({ sellerId: 1 });
  }

  // 3. Migrate orders DB: items.$.storeId -> sellerId
  const orderDbName = process.env.ORDER_DB_NAME || 'ornate_orders';
  const orderDb = mongoose.connection.useDb(orderDbName).db;
  if (orderDb) {
    const ordersColl = orderDb.collection('orders');
    const orders = await ordersColl.find({ 'items.storeId': { $exists: true } }).toArray();
    console.log(`[Migration] Found ${orders.length} orders with items.storeId.`);

    let orderItemsUpdated = 0;
    for (const order of orders) {
      const updatedItems = order.items.map((it: any) => ({
        ...it,
        sellerId: it.sellerId || it.storeId,
        sellerName: it.sellerName || it.storeName,
      }));

      await ordersColl.updateOne(
        { _id: order._id },
        { $set: { items: updatedItems } },
      );
      orderItemsUpdated++;
    }
    console.log(`[Migration] Successfully updated ${orderItemsUpdated} orders with items.sellerId.`);
  }

  console.log('[Migration] Store -> Seller data migration finished successfully.');
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('[Migration Error]:', err);
  process.exit(1);
});

