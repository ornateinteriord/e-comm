import { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router';
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  TextField,
  Button,
  Divider,
  RadioGroup,
  FormControlLabel,
  Radio,
  Stack,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  InputAdornment,
} from '@mui/material';
import {
  Lock as SecureIcon,
  Phone as PhoneIcon,
  Visibility,
  VisibilityOff,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useCartStore } from '../store/cart.store';
import { useAuthStore } from '../store/auth.store';
import api from '../api/client';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, clearCart } = useCartStore();
  const { user, isAuthenticated, setAuth } = useAuthStore();

  // Auto-populate with customer's registration profile data
  const [shippingAddress, setShippingAddress] = useState({
    name: user?.fullName || user?.name || '',
    phone: user?.mobileNumber || user?.phone || '',
    line1: '',
    line2: '',
    city: user?.city || '',
    state: user?.state || '',
    pincode: user?.pincode || '',
    country: user?.country || 'India',
  });

  // Keep shippingAddress synced whenever user profile loads/changes
  useEffect(() => {
    if (user) {
      setShippingAddress((prev) => ({
        ...prev,
        name: prev.name || user.fullName || user.name || '',
        phone: prev.phone || user.mobileNumber || user.phone || '',
        country: prev.country || user.country || 'India',
        state: prev.state || user.state || '',
        city: prev.city || user.city || '',
        pincode: prev.pincode || user.pincode || '',
      }));
    }
  }, [user]);

  // Auth Dialog gatekeeper if user directly reaches /checkout
  const [loginDialogOpen, setLoginDialogOpen] = useState(!isAuthenticated);
  const [loginMobile, setLoginMobile] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoginDialogOpen(true);
    } else {
      setLoginDialogOpen(false);
    }
  }, [isAuthenticated]);

  const [paymentMethod, setPaymentMethod] = useState('razorpay_simulator');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Directly calculate subtotal and grandTotal from items
  const subtotal = items.reduce(
    (sum, item) => sum + (item.lineTotal || item.quantity * (item.unitApplicablePrice || 0)),
    0
  );

  const shippingCharge = subtotal === 0 ? 0 : subtotal >= 50000 ? 0 : 5000;
  const tax = Math.round(subtotal * 0.18);
  const grandTotal = subtotal + shippingCharge + tax;

  const handleDialogLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!/^\d{10}$/.test(loginMobile)) {
      setLoginError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!loginPassword) {
      setLoginError('Please enter your password.');
      return;
    }

    setIsLoggingIn(true);

    try {
      const { data } = await api.post('/auth/login', {
        mobileNumber: loginMobile,
        username: loginMobile,
        password: loginPassword,
      });

      setAuth(data.data.accessToken, data.data.user);
      setLoginDialogOpen(false);
    } catch (err: any) {
      setLoginError(err.response?.data?.error?.message || 'Login failed. Please check credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };

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
          taxAmount: Math.round((it.lineTotal || it.quantity * it.unitApplicablePrice) * 0.18),
          lineTotal: it.lineTotal || it.quantity * it.unitApplicablePrice,
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
          });
        } catch {
          // invoice generation fallback non-blocking
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
            <Paper elevation={0} sx={{ p: 4, borderRadius: '8px', border: '1px solid', borderColor: 'divider', mb: 4 }}>
              <Typography variant="h6" fontWeight={800} sx={{ mb: 3 }}>
                1. Shipping Address
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Full Name *"
                    required
                    fullWidth
                    size="small"
                    value={shippingAddress.name}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, name: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Phone Number *"
                    required
                    fullWidth
                    size="small"
                    value={shippingAddress.phone}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, phone: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Address Line 1 (House/Flat, Street) *"
                    required
                    fullWidth
                    size="small"
                    value={shippingAddress.line1}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, line1: e.target.value })}
                    placeholder="e.g. Flat 402, Sunshine Heights"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Address Line 2 (Optional)"
                    fullWidth
                    size="small"
                    value={shippingAddress.line2}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, line2: e.target.value })}
                    placeholder="e.g. 12th Main Road, Landmark"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="City *"
                    required
                    fullWidth
                    size="small"
                    value={shippingAddress.city}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="State *"
                    required
                    fullWidth
                    size="small"
                    value={shippingAddress.state}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="PIN Code *"
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
            <Paper elevation={0} sx={{ p: 4, borderRadius: '8px', border: '1px solid', borderColor: 'divider' }}>
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
                    borderColor: paymentMethod === 'razorpay_simulator' ? '#FF7900' : 'divider',
                    bgcolor: paymentMethod === 'razorpay_simulator' ? 'rgba(255, 121, 0, 0.04)' : 'transparent',
                    cursor: 'pointer',
                  }}
                  onClick={() => setPaymentMethod('razorpay_simulator')}
                >
                  <FormControlLabel
                    value="razorpay_simulator"
                    control={<Radio color="primary" />}
                    label={
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700}>
                          Razorpay UPI / Cards / NetBanking (Instant Sandbox)
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
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
                    borderColor: paymentMethod === 'cod' ? '#FF7900' : 'divider',
                    bgcolor: paymentMethod === 'cod' ? 'rgba(255, 121, 0, 0.04)' : 'transparent',
                    cursor: 'pointer',
                  }}
                  onClick={() => setPaymentMethod('cod')}
                >
                  <FormControlLabel
                    value="cod"
                    control={<Radio color="primary" />}
                    label={
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700}>
                          Cash on Delivery (COD)
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Pay in cash upon delivery at your doorstep.
                        </Typography>
                      </Box>
                    }
                  />
                </Paper>
              </RadioGroup>
            </Paper>
          </Grid>

          {/* Right Column: Order Review & Total */}
          <Grid item xs={12} md={5}>
            <Paper elevation={0} sx={{ p: 4, borderRadius: '8px', border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
              <Typography variant="h6" fontWeight={800} sx={{ mb: 2.5 }}>
                Items in Order ({items.length})
              </Typography>

              <Stack spacing={2} sx={{ mb: 3, maxHeight: 280, overflowY: 'auto' }}>
                {items.map((it) => (
                  <Box key={`${it.productId}_${it.variantId || 'base'}`} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ maxWidth: '70%' }}>
                      <Typography variant="body2" fontWeight={700} noWrap>
                        {it.productName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Qty: {it.quantity}
                      </Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={800}>
                      ₹{(((it.lineTotal || it.quantity * it.unitApplicablePrice)) / 100).toFixed(0)}
                    </Typography>
                  </Box>
                ))}
              </Stack>

              <Divider sx={{ mb: 2.5 }} />

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
                  <Typography variant="h5" fontWeight={900} sx={{ color: '#FF7900' }}>
                    ₹{(grandTotal / 100).toFixed(0)}
                  </Typography>
                </Box>
              </Stack>

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={isSubmitting || items.length === 0}
                startIcon={!isSubmitting && <SecureIcon />}
                sx={{
                  py: 1.5,
                  borderRadius: '6px',
                  fontWeight: 800,
                  fontSize: '1rem',
                  bgcolor: '#FF7900',
                  color: '#FFFFFF',
                  '&:hover': { bgcolor: '#E85D04' },
                }}
              >
                {isSubmitting ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={20} color="inherit" />
                    Processing Payment…
                  </Box>
                ) : (
                  `Pay ₹${(grandTotal / 100).toFixed(0)} & Confirm`
                )}
              </Button>
            </Paper>
          </Grid>
        </Grid>
      </form>

      {/* ---- Login Dialog if unauthenticated ---- */}
      <Dialog
        open={loginDialogOpen}
        onClose={() => navigate('/cart')}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '14px',
            p: 1.5,
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SecureIcon sx={{ color: '#FF7900' }} />
            <Typography variant="h6" fontWeight={800}>
              Sign in to Checkout
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => navigate('/cart')}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Please login with your registered 10-digit mobile number to complete checkout.
          </Typography>

          {loginError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.85rem' }}>
              {loginError}
            </Alert>
          )}

          <form onSubmit={handleDialogLogin}>
            <Stack spacing={2}>
              <TextField
                label="Mobile Number"
                type="tel"
                required
                fullWidth
                size="small"
                value={loginMobile}
                onChange={(e) => {
                  const cleanDigits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setLoginMobile(cleanDigits);
                  if (loginError) setLoginError(null);
                }}
                placeholder="9876543210"
                inputProps={{
                  maxLength: 10,
                  inputMode: 'numeric',
                  pattern: '[0-9]*',
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PhoneIcon sx={{ fontSize: 16, color: '#64748b' }} />
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155' }}>
                          +91
                        </Typography>
                      </Box>
                    </InputAdornment>
                  ),
                }}
                helperText={
                  loginMobile.length > 0 && loginMobile.length < 10
                    ? `${loginMobile.length}/10 digits entered`
                    : 'Enter 10-digit registered mobile number'
                }
                error={loginMobile.length > 0 && loginMobile.length < 10}
              />

              <TextField
                label="Password"
                size="small"
                type={showPassword ? 'text' : 'password'}
                required
                fullWidth
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => setShowPassword((prev) => !prev)}
                        edge="end"
                        size="small"
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={isLoggingIn || loginMobile.length !== 10 || !loginPassword}
                sx={{
                  py: 1.2,
                  mt: 1,
                  borderRadius: '8px',
                  fontWeight: 800,
                  bgcolor: '#FF7900',
                  '&:hover': { bgcolor: '#e66d00' },
                }}
              >
                {isLoggingIn ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={18} color="inherit" />
                    Signing in…
                  </Box>
                ) : (
                  'Sign In & Continue'
                )}
              </Button>
            </Stack>
          </form>

          <Box sx={{ textAlign: 'center', mt: 2.5 }}>
            <Typography variant="body2" color="text.secondary">
              Don't have an account?{' '}
              <Button
                component={RouterLink}
                to="/register"
                sx={{ textTransform: 'none', fontWeight: 700, p: 0 }}
              >
                Create Account
              </Button>
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    </Container>
  );
}
