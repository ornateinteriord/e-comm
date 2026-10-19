import React, { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import {
  Box, Container, Typography, Grid, Paper, IconButton, Button,
  Divider, TextField, Stack, Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  DeleteOutline as DeleteIcon,
  ArrowForward as CheckoutIcon,
  ShoppingBagOutlined as EmptyCartIcon,
} from '@mui/icons-material';
import { useCartStore } from '../store/cart.store';

export default function CartPage() {
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, clearCart, subtotal } = useCartStore();
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);

  const shippingCharge = subtotal === 0 ? 0 : subtotal >= 50000 ? 0 : 5000;
  const taxable = Math.max(0, subtotal - couponDiscount);
  const tax = Math.round(taxable * 0.18);
  const grandTotal = taxable + shippingCharge + tax;

  const handleApplyCoupon = () => {
    const code = couponCode.trim().toUpperCase();
    if (code === 'WELCOME10') {
      const discount = Math.round(subtotal * 0.1);
      setCouponDiscount(discount);
      setAppliedCoupon('WELCOME10');
    } else if (code === 'FLAT500' && subtotal >= 150000) {
      setCouponDiscount(50000);
      setAppliedCoupon('FLAT500');
    } else if (code === 'SUPER20') {
      const discount = Math.round(subtotal * 0.2);
      setCouponDiscount(discount);
      setAppliedCoupon('SUPER20');
    } else {
      alert('Invalid coupon code or minimum order condition not met. Try "WELCOME10" or "SUPER20".');
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponCode('');
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
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 3 }}>
            {items.map((item, idx) => (
              <React.Fragment key={`${item.productId}_${item.variantId || 'base'}`}>
                <Box sx={{ display: 'flex', gap: 3, py: 2.5, alignItems: 'center' }}>
                  {/* Thumbnail */}
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: 2,
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
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 3, bgcolor: '#f8fafc' }}>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
              Order Summary
            </Typography>

            {/* Coupon Input */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary">PROMO CODE</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="e.g. WELCOME10"
                  value={couponCode}
                  disabled={Boolean(appliedCoupon)}
                  onChange={(e) => setCouponCode(e.target.value)}
                  sx={{ bgcolor: 'white' }}
                />
                {appliedCoupon ? (
                  <Button variant="outlined" color="error" onClick={handleRemoveCoupon}>
                    Remove
                  </Button>
                ) : (
                  <Button variant="contained" onClick={handleApplyCoupon}>
                    Apply
                  </Button>
                )}
              </Box>
              {appliedCoupon && (
                <Alert severity="success" sx={{ mt: 1, py: 0.5, fontSize: '0.8rem' }}>
                  Promo code <strong>{appliedCoupon}</strong> applied!
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
                <Typography variant="h5" fontWeight={900} color="primary">
                  ₹{(grandTotal / 100).toFixed(0)}
                </Typography>
              </Box>
            </Stack>

            <Button
              variant="contained"
              fullWidth
              size="large"
              endIcon={<CheckoutIcon />}
              onClick={() => navigate('/checkout')}
              sx={{
                py: 1.5,
                borderRadius: 1,
                fontWeight: 700,
                bgcolor: '#2563eb',
                '&:hover': { bgcolor: '#1d4ed8' },
              }}
            >
              Proceed to Checkout
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
