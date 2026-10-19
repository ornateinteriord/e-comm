import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Box, Container, Typography, Grid, Paper, TextField, Button,
  Divider, RadioGroup, FormControlLabel, Radio, Stack, Alert,
  CircularProgress,
} from '@mui/material';
import {
  Lock as SecureIcon,
  CheckCircle as SuccessIcon,
} from '@mui/icons-material';
import { useCartStore } from '../store/cart.store';
import { useAuthStore } from '../store/auth.store';
import api from '../api/client';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, clearCart, subtotal } = useCartStore();
  const { user } = useAuthStore();

  const [shippingAddress, setShippingAddress] = useState({
    name: user?.name || '',
    phone: user?.phone || '9876543210',
    line1: 'Flat 402, Sunshine Heights',
    line2: '12th Main Road, Indiranagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560038',
    country: 'India',
  });

  const [paymentMethod, setPaymentMethod] = useState('razorpay_simulator');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shippingCharge = subtotal === 0 ? 0 : subtotal >= 50000 ? 0 : 5000;
  const tax = Math.round(subtotal * 0.18);
  const grandTotal = subtotal + shippingCharge + tax;

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shippingAddress.name || !shippingAddress.phone || !shippingAddress.line1 || !shippingAddress.pincode) {
      setError('Please fill in all required shipping address fields.');
      return;
    }

    if (items.length === 0) {
      setError('Your cart is empty.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Create order via /checkout
      const orderRes = await api.post('/checkout', {
        shippingAddress,
        billingAddress: shippingAddress,
        customerName: shippingAddress.name,
        customerEmail: user?.email || 'customer@example.com',
        items: items.map((it) => ({
          productId: it.productId,
          variantId: it.variantId || null,
          name: it.productName,
          sku: it.sku,
          image: it.productImage,
          quantity: it.quantity,
          unitMrp: it.unitMrp,
          unitSellingPrice: it.unitApplicablePrice,
          unitApplicablePrice: it.unitApplicablePrice,
          discount: 0,
          taxRate: 18,
          taxAmount: Math.round(it.lineTotal * 0.18),
          lineTotal: it.lineTotal,
        })),
        pricing: {
          subtotal,
          couponDiscount: 0,
          shippingCharge,
          tax,
          grandTotal,
        },
        paymentMethod: paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online (Razorpay UPI / Simulator)',
      });

      const order = orderRes.data.data;

      // 2. If online payment, immediately complete payment via simulator or gateway
      if (paymentMethod !== 'cod') {
        await api.post('/payments/verify', {
          orderId: order._id || order.id || order.orderNumber,
          isSimulator: true,
          gatewayPaymentId: `pay_sim_${Date.now()}`,
          gatewayOrderId: `order_sim_${Date.now()}`,
        });

        // 3. Trigger tax invoice generation
        try {
          await api.post('/invoices/generate', {
            orderId: order._id || order.id || order.orderNumber,
            order,
          });
        } catch {
          // non-blocking
        }
      }

      clearCart();
      navigate(`/orders/${order._id || order.id || order.orderNumber}`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography variant="h4" fontWeight={800} letterSpacing="-0.02em" sx={{ mb: 4 }}>
        Checkout & Payment
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handlePlaceOrder}>
        <Grid container spacing={4}>
          {/* Left Column: Address & Payment */}
          <Grid item xs={12} md={7}>
            {/* Step 1: Shipping Address */}
            <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 4 }}>
              <Typography variant="h6" fontWeight={800} sx={{ mb: 3 }}>
                1. Shipping Address
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Full Name"
                    required
                    fullWidth
                    size="small"
                    value={shippingAddress.name}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, name: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Phone Number"
                    required
                    fullWidth
                    size="small"
                    value={shippingAddress.phone}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, phone: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Address Line 1"
                    required
                    fullWidth
                    size="small"
                    value={shippingAddress.line1}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, line1: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Address Line 2 (Optional)"
                    fullWidth
                    size="small"
                    value={shippingAddress.line2}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, line2: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="City"
                    required
                    fullWidth
                    size="small"
                    value={shippingAddress.city}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="State"
                    required
                    fullWidth
                    size="small"
                    value={shippingAddress.state}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="PIN Code"
                    required
                    fullWidth
                    size="small"
                    value={shippingAddress.pincode}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, pincode: e.target.value })}
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* Step 2: Payment Method */}
            <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" fontWeight={800} sx={{ mb: 3 }}>
                2. Select Payment Method
              </Typography>
              <RadioGroup
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    mb: 2,
                    borderRadius: 2,
                    borderColor: paymentMethod === 'razorpay_simulator' ? 'primary.main' : 'divider',
                    bgcolor: paymentMethod === 'razorpay_simulator' ? 'action.hover' : 'transparent',
                  }}
                >
                  <FormControlLabel
                    value="razorpay_simulator"
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700}>
                          Razorpay UPI / Cards / NetBanking (Instant Sandbox)
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Recommended for testing. Confirms payment immediately with simulated transaction.
                        </Typography>
                      </Box>
                    }
                  />
                </Paper>

                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    borderColor: paymentMethod === 'cod' ? 'primary.main' : 'divider',
                    bgcolor: paymentMethod === 'cod' ? 'action.hover' : 'transparent',
                  }}
                >
                  <FormControlLabel
                    value="cod"
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700}>
                          Cash on Delivery (COD)
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Pay with cash or UPI at your doorstep upon delivery.
                        </Typography>
                      </Box>
                    }
                  />
                </Paper>
              </RadioGroup>
            </Paper>
          </Grid>

          {/* Right Column: Order Summary */}
          <Grid item xs={12} md={5}>
            <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: '#f8fafc' }}>
              <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
                Items in Order ({items.length})
              </Typography>

              <Stack spacing={2} sx={{ mb: 3, maxHeight: 260, overflowY: 'auto' }}>
                {items.map((it) => (
                  <Box key={`${it.productId}_${it.variantId || 'b'}`} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ maxWidth: '70%' }}>
                      <Typography variant="body2" fontWeight={700} noWrap>{it.productName}</Typography>
                      <Typography variant="caption" color="text.secondary">Qty: {it.quantity}</Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={800}>
                      ₹{(it.lineTotal / 100).toFixed(0)}
                    </Typography>
                  </Box>
                ))}
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Stack spacing={1.5} sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                  <Typography variant="body2" fontWeight={600}>₹{(subtotal / 100).toFixed(0)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Shipping Charge</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {shippingCharge === 0 ? 'FREE' : `₹${(shippingCharge / 100).toFixed(0)}`}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">GST (18%)</Typography>
                  <Typography variant="body2" fontWeight={600}>₹{(tax / 100).toFixed(0)}</Typography>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Typography variant="subtitle1" fontWeight={800}>Total Payable</Typography>
                  <Typography variant="h4" fontWeight={900} color="primary">
                    ₹{(grandTotal / 100).toFixed(0)}
                  </Typography>
                </Box>
              </Stack>

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SecureIcon />}
                sx={{
                  py: 1.5,
                  borderRadius: 1,
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  bgcolor: '#2563eb',
                  '&:hover': { bgcolor: '#1d4ed8' },
                }}
              >
                {isSubmitting ? 'Placing Order…' : `Pay ₹${(grandTotal / 100).toFixed(0)} & Confirm`}
              </Button>
            </Paper>
          </Grid>
        </Grid>
      </form>
    </Container>
  );
}
