import { connectDB, mongoose } from '@ornate/db';

const uri =
  process.env.MONGODB_URI ??
  'mongodb+srv://ornateinteriord:22k3ZVbQMZDpybDP@cluster0.plzr559.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function migrate() {
  await connectDB(uri, 'ornate_auth');
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not established.');
  }

  const usersColl = db.collection('users');
  const customersColl = db.collection('customers');

  const users = await usersColl.find().toArray();
  console.log(`Found ${users.length} users to migrate to customers collection.`);

  for (const user of users) {
    const existing = await customersColl.findOne({
      $or: [{ _id: user._id }, { email: user.email }],
    });

    if (existing) {
      console.log(`Customer already exists for email ${user.email}, updating auth fields...`);
      await customersColl.updateOne(
        { _id: existing._id },
        {
          $set: {
            passwordHash: user.passwordHash,
            role: user.role || 'customer',
            isActive: user.isActive !== undefined ? user.isActive : true,
            emailVerified: user.emailVerified || false,
            fullName: user.name,
            name: user.name,
            phone: user.phone,
            mobileNumber: user.phone,
            username: user.email === 'admin@ornate.dev' ? 'admin' : (user.phone || user.email.split('@')[0]),
          },
        }
      );
    } else {
      console.log(`Migrating user ${user.email} -> customer...`);
      await customersColl.insertOne({
        _id: user._id,
        userId: user._id.toString(),
        name: user.name,
        fullName: user.name,
        email: user.email,
        phone: user.phone,
        mobileNumber: user.phone,
        username: user.email === 'admin@ornate.dev' ? 'admin' : (user.phone || user.email.split('@')[0]),
        passwordHash: user.passwordHash,
        role: user.role || 'customer',
        isActive: user.isActive !== undefined ? user.isActive : true,
        emailVerified: user.emailVerified || false,
        emailVerificationToken: user.emailVerificationToken,
        emailVerificationExpires: user.emailVerificationExpires,
        resetPasswordToken: user.resetPasswordToken,
        resetPasswordExpires: user.resetPasswordExpires,
        referralCode: user.email === 'admin@ornate.dev' ? 'SYSTEM' : 'ADMIN',
        referralName: 'System Admin',
        referralType: 'customer',
        vendor_id: null,
        vendor_name: null,
        country: 'India',
        gender: 'prefer_not_to_say',
        totalOrders: 0,
        totalSpent: 0,
        createdAt: user.createdAt || new Date(),
        updatedAt: user.updatedAt || new Date(),
      });
    }
  }

  const count = await customersColl.countDocuments();
  console.log(`Migration finished. Total documents in customers collection: ${count}`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
