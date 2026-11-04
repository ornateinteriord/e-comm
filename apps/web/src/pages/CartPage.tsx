import React, { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  IconButton,
  Button,
  Divider,
  TextField,
  Stack,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  DeleteOutline as DeleteIcon,
  ArrowForward as CheckoutIcon,
  ShoppingBagOutlined as EmptyCartIcon,
  Phone as PhoneIcon,
  Visibility,
  VisibilityOff,
  Close as CloseIcon,
  LockOutlined as LockIcon,
} from '@mui/icons-material';
import { useCartStore, calcOrderTotals } from '../store/cart.store';
import { useAuthStore } from '../store/auth.store';
import api from '../api/client';

export default function CartPage() {
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, clearCart, appliedCoupon, applyCoupon, removeCoupon } = useCartStore();
  const { isAuthenticated, setAuth } = useAuthStore();

  const [couponCode, setCouponCode] = useState(appliedCoupon || '');
  const [couponError, setCouponError] = useState<string | null>(null);

  useEffect(() => {
    if (appliedCoupon) {
      setCouponCode(appliedCoupon);
    }
  }, [appliedCoupon]);

  // Login Dialog state for guest checkout
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [loginMobile, setLoginMobile] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Fail-safe direct calculation of subtotal from items
  const subtotal = items.reduce(
    (sum, item) => sum + (item.lineTotal || item.quantity * (item.unitApplicablePrice || 0)),
    0
  );

  const { shippingCharge, couponDiscount, tax, grandTotal } = calcOrderTotals(subtotal, appliedCoupon);

  const handleApplyCoupon = () => {
    setCouponError(null);
    if (!couponCode.trim()) return;
    const res = applyCoupon(couponCode);
    if (!res.success) {
      setCouponError(res.message || 'Invalid coupon code.');
    }
  };

  const handleRemoveCoupon = () => {
    removeCoupon();
    setCouponCode('');
    setCouponError(null);
  };

  const handleProceedToCheckout = () => {
    if (!isAuthenticated) {
      setLoginError(null);
      setLoginDialogOpen(true);
      return;
    }
    navigate('/checkout');
  };

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
      // Seamlessly continue with the exact same cart to checkout
      navigate('/checkout');
    } catch (err: any) {
      setLoginError(err.response?.data?.error?.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (items.length === 0) {
    return (
      <Container maxWidth="md" sx={{ py: 12, textAlign: 'center' }}>
        <EmptyCartIcon sx={{ fontSize: 72, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h5" fontWeight={800} sx={{ mb: 1 }}>Your shopping bag is empty</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Looks like you haven't added anything to your cart yet.
        </Typography>
        <Button variant="contained" component={RouterLink} to="/search" size="large" sx={{ borderRadius: 2, fontWeight: 700 }}>
          Start Shopping
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography variant="h4" fontWeight={800} letterSpacing="-0.02em" sx={{ mb: 4 }}>
        Shopping Bag ({items.reduce((acc, i) => acc + i.quantity, 0)})
      </Typography>

      <Grid container spacing={4}>
        {/* Cart Items List */}
        <Grid item xs={12} md={8}>
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
            {items.map((item, idx) => (
              <React.Fragment key={`${item.productId}_${item.variantId || 'base'}`}>
                <Box sx={{ display: 'flex', gap: 3, py: 2.5, alignItems: 'center' }}>
                  {/* Thumbnail */}
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: '6px',
                      overflow: 'hidden',
                      bgcolor: '#f8fafc',
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={item.productImage || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&q=80'}
                      alt={item.productName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </Box>

                  {/* Details */}
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography
                      component={RouterLink}
                      to={`/products/${item.productSlug}`}
                      variant="subtitle1"
                      fontWeight={700}
                      sx={{ textDecoration: 'none', color: 'text.primary', '&:hover': { color: 'primary.main' } }}
                    >
                      {item.productName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      SKU: {item.sku}
                    </Typography>
                    <Typography variant="body2" fontWeight={800} color="primary" sx={{ mt: 0.5 }}>
                      ₹{(item.unitApplicablePrice / 100).toFixed(0)} each
                    </Typography>
                  </Box>

                  {/* Quantity Controls */}
                  <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <IconButton
                      size="small"
                      onClick={() => {
                        if (item.quantity > 1) {
                          updateQuantity(item.productId, item.variantId, item.quantity - 1);
                        } else {
                          removeItem(item.productId, item.variantId);
                        }
                      }}
                    >
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                    <Typography sx={{ px: 1.5, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>
                      {item.quantity}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  {/* Item Total */}
                  <Typography variant="subtitle1" fontWeight={800} sx={{ minWidth: 80, textAlign: 'right' }}>
                    ₹{(item.lineTotal / 100).toFixed(0)}
                  </Typography>

                  {/* Remove Button */}
                  <IconButton
                    color="error"
                    size="small"
                    onClick={() => removeItem(item.productId, item.variantId)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
                {idx < items.length - 1 && <Divider />}
              </React.Fragment>
            ))}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 3 }}>
              <Button color="error" variant="text" onClick={clearCart}>
                Clear Cart
              </Button>
              <Button component={RouterLink} to="/search" variant="text">
                Continue Shopping
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Order Summary */}
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3, bgcolor: 'background.paper' }}>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
              Order Summary
            </Typography>

            {/* Coupon Input */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary">PROMO CODE</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="e.g. NEW10"
                  value={couponCode}
                  disabled={Boolean(appliedCoupon)}
                  onChange={(e) => {
                    setCouponCode(e.target.value);
                    if (couponError) setCouponError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyCoupon();
                    }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      height: 40,
                      borderRadius: '8px',
                    },
                  }}
                />
                {appliedCoupon ? (
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={handleRemoveCoupon}
                    sx={{
                      height: 40,
                      px: 2.5,
                      borderRadius: '8px',
                      fontWeight: 700,
                      textTransform: 'none',
                      fontSize: '0.875rem',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    Remove
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleApplyCoupon}
                    sx={{
                      height: 40,
                      px: 3,
                      borderRadius: '8px',
                      fontWeight: 700,
                      textTransform: 'none',
                      fontSize: '0.875rem',
                      bgcolor: '#FF7900',
                      whiteSpace: 'nowrap',
                      boxShadow: 'none',
                      flexShrink: 0,
                      '&:hover': { bgcolor: '#E85D04', boxShadow: 'none' },
                    }}
                  >
                    Apply
                  </Button>
                )}
              </Box>
              {appliedCoupon && (
                <Alert severity="success" sx={{ mt: 1, py: 0.5, fontSize: '0.8rem' }}>
                  Promo code <strong>{appliedCoupon}</strong> applied!
                </Alert>
              )}
              {couponError && (
                <Alert severity="error" sx={{ mt: 1, py: 0.5, fontSize: '0.8rem' }}>
                  {couponError}
                </Alert>
              )}
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Stack spacing={1.5} sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                <Typography variant="body2" fontWeight={600}>₹{(subtotal / 100).toFixed(0)}</Typography>
              </Box>

              {couponDiscount > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', color: 'success.main' }}>
                  <Typography variant="body2" fontWeight={600}>Coupon Discount</Typography>
                  <Typography variant="body2" fontWeight={700}>-₹{(couponDiscount / 100).toFixed(0)}</Typography>
                </Box>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Estimated Shipping</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {shippingCharge === 0 ? 'FREE' : `₹${(shippingCharge / 100).toFixed(0)}`}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Estimated GST (18%)</Typography>
                <Typography variant="body2" fontWeight={600}>₹{(tax / 100).toFixed(0)}</Typography>
              </Box>

              <Divider sx={{ my: 1 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Typography variant="subtitle1" fontWeight={800}>Estimated Total</Typography>
                <Typography variant="h5" fontWeight={900} sx={{ color: '#FF7900' }}>
                  ₹{(grandTotal / 100).toFixed(0)}
                </Typography>
              </Box>
            </Stack>

            <Button
              variant="contained"
              fullWidth
              size="large"
              endIcon={<CheckoutIcon />}
              onClick={handleProceedToCheckout}
              sx={{
                py: 1.5,
                borderRadius: '6px',
                fontWeight: 700,
                bgcolor: '#FF7900',
                color: '#FFFFFF',
                '&:hover': { bgcolor: '#E85D04' },
              }}
            >
              Proceed to Checkout
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* ---- Login Dialog Modal for Checkout ---- */}
      <Dialog
        open={loginDialogOpen}
        onClose={() => setLoginDialogOpen(false)}
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
            <LockIcon sx={{ color: '#FF7900' }} />
            <Typography variant="h6" fontWeight={800}>
              Sign in to Checkout
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setLoginDialogOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Login with your 10-digit mobile number to complete your purchase. Your shopping bag will be preserved.
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
                placeholder="Enter 10-digit mobile number"
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
                onClick={() => setLoginDialogOpen(false)}
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
