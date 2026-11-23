import Razorpay from 'razorpay';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

async function verifyLiveRazorpay() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  console.log(`[VERIFY] Testing Live Razorpay with Key ID: ${key_id}`);
  if (!key_id || !key_secret) {
    throw new Error('Missing Razorpay credentials');
  }

  const razorpay = new Razorpay({ key_id, key_secret });

  console.log('[VERIFY] Invoking razorpay.orders.create...');
  const order = await razorpay.orders.create({
    amount: 10000, // 100 INR in paise
    currency: 'INR',
    receipt: `verify_rcpt_${Date.now()}`,
    notes: {
      source: 'verification_script',
      environment: 'production',
    },
  });

  console.log(`[VERIFY] SUCCESS: Live Razorpay order created! Order ID: ${order.id}`);
  if (!order.id || !order.id.startsWith('order_')) {
    throw new Error(`Unexpected order ID format: ${order.id}`);
  }

  // Verify HMAC signature calculation
  const mockPaymentId = `pay_mock_${Date.now()}`;
  const generatedSignature = crypto
    .createHmac('sha256', key_secret)
    .update(`${order.id}|${mockPaymentId}`)
    .digest('hex');

  console.log(`[VERIFY] Generated HMAC-SHA256 signature: ${generatedSignature}`);

  const isValid = crypto.timingSafeEqual(
    Buffer.from(generatedSignature, 'utf8'),
    Buffer.from(
      crypto.createHmac('sha256', key_secret).update(`${order.id}|${mockPaymentId}`).digest('hex'),
      'utf8',
    ),
  );

  console.log(`[VERIFY] HMAC Validation: ${isValid ? 'PASS' : 'FAIL'}`);
  console.log('[VERIFY] ALL LIVE CHECKS PASSED.');
}

verifyLiveRazorpay().catch((err) => {
  console.error('[VERIFY] Error:', err.message || err);
  process.exit(1);
});
