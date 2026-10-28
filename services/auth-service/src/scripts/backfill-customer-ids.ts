import { connectDB, mongoose } from '@ornate/db';

const uri =
  process.env.MONGODB_URI ??
  'mongodb+srv://ornateinteriord:22k3ZVbQMZDpybDP@cluster0.plzr559.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function backfill() {
  await connectDB(uri, 'ornate_auth');
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not established.');
  }

  const customersColl = db.collection('customers');
  const customers = await customersColl.find().sort({ createdAt: 1 }).toArray();
  console.log(`Found ${customers.length} customers in collection.`);

  let counter = 1;

  // First give admin CUS00001 if present
  const admin = customers.find((c) => c.email === 'admin@ornate.dev');
  if (admin && (!admin.customerId || !admin.customer_id)) {
    const cid = `CUS${String(counter++).padStart(5, '0')}`;
    console.log(`Setting admin ${admin.email} -> ${cid}`);
    await customersColl.updateOne(
      { _id: admin._id },
      { $set: { customerId: cid, customer_id: cid, userId: admin._id.toString() } }
    );
  } else if (admin && admin.customerId) {
    counter = 2;
  }

  for (const c of customers) {
    if (c.email === 'admin@ornate.dev') continue;
    if (!c.customerId || !c.customer_id) {
      const cid = `CUS${String(counter++).padStart(5, '0')}`;
      console.log(`Setting customer ${c.email || c._id} -> ${cid}`);
      await customersColl.updateOne(
        { _id: c._id },
        { $set: { customerId: cid, customer_id: cid, userId: c._id.toString() } }
      );
    } else {
      console.log(`Customer ${c.email || c._id} already has customerId: ${c.customerId}`);
    }
  }

  console.log('Customer ID backfill complete!');
  const all = await customersColl.find({}, { projection: { email: 1, customerId: 1, customer_id: 1, role: 1 } }).toArray();
  console.log('Current customers:', all);
  process.exit(0);
}

backfill().catch((err) => {
  console.error('Backfill error:', err);
  process.exit(1);
});
