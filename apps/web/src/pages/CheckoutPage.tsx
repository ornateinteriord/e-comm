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
  Stack,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  InputAdornment,
  Chip,
  Radio,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Lock as SecureIcon,
  Phone as PhoneIcon,
  Visibility,
  VisibilityOff,
  Close as CloseIcon,
  VerifiedUser,
  CreditCard,
  AccountBalance,
  AccountBalanceWallet,
  QrCode2,
  CheckCircle,
  Add as AddIcon,
  EditOutlined as EditIcon,
  DeleteOutline as DeleteIcon,
  LocationOn as LocationIcon,
  Home as HomeIcon,
  Work as WorkIcon,
  CheckCircleOutline,
} from '@mui/icons-material';
import { load } from '@cashfreepayments/cashfree-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Address } from '@ornate/types';
import { useCartStore } from '../store/cart.store';
import { useAuthStore } from '../store/auth.store';
import api from '../api/client';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, clearCart } = useCartStore();
  const { user, isAuthenticated, setAuth } = useAuthStore();
  const queryClient = useQueryClient();

  // Query user's saved addresses
  const { data: addresses = [], isLoading: isLoadingAddresses } = useQuery<Address[]>({
    queryKey: ['my-addresses'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/addresses');
        return data.data || [];
      } catch {
        return [];
      }
    },
    enabled: isAuthenticated,
  });

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [saveAddressForFuture, setSaveAddressForFuture] = useState(true);

  // Address Dialog State (Add / Edit)
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState({
    label: 'Home',
    name: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
    isDefault: false,
  });
  const [addressFormError, setAddressFormError] = useState<string | null>(null);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

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

  // Keep shippingAddress synced whenever user profile loads/changes (if no saved address exists)
  useEffect(() => {
    if (user && addresses.length === 0) {
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
  }, [user, addresses.length]);

  // Select default or first address when saved addresses are loaded
  useEffect(() => {
    if (addresses && addresses.length > 0) {
      const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
      const currentSelected = addresses.find((a) => (a.id || (a as any)._id) === selectedAddressId) || defaultAddr;
      if (currentSelected) {
        const id = currentSelected.id || (currentSelected as any)._id;
        setSelectedAddressId(id);
        setShippingAddress({
          name: currentSelected.name,
          phone: currentSelected.phone,
          line1: currentSelected.line1,
          line2: currentSelected.line2 || '',
          city: currentSelected.city,
          state: currentSelected.state,
          pincode: currentSelected.pincode,
          country: currentSelected.country || 'India',
        });
      }
    }
  }, [addresses]);

  const handleSelectAddress = (addr: Address) => {
    const id = addr.id || (addr as any)._id;
    setSelectedAddressId(id);
    setShippingAddress({
      name: addr.name,
      phone: addr.phone,
      line1: addr.line1,
      line2: addr.line2 || '',
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      country: addr.country || 'India',
    });
  };

  const handleOpenAddAddress = () => {
    setEditingAddressId(null);
    setAddressForm({
      label: 'Home',
      name: user?.fullName || user?.name || '',
      phone: user?.mobileNumber || user?.phone || '',
      line1: '',
      line2: '',
      city: user?.city || '',
      state: user?.state || '',
      pincode: user?.pincode || '',
      isDefault: addresses.length === 0,
    });
    setAddressFormError(null);
    setAddressModalOpen(true);
  };

  const handleOpenEditAddress = (addr: Address, e: React.MouseEvent) => {
    e.stopPropagation();
    const id = addr.id || (addr as any)._id;
    setEditingAddressId(id);
    setAddressForm({
      label: addr.label || 'Home',
      name: addr.name,
      phone: addr.phone,
      line1: addr.line1,
      line2: addr.line2 || '',
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      isDefault: Boolean(addr.isDefault),
    });
    setAddressFormError(null);
    setAddressModalOpen(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressFormError(null);

    const name = addressForm.name.trim();
    const phone = addressForm.phone.trim().replace(/\D/g, '');
    const line1 = addressForm.line1.trim();
    const city = addressForm.city.trim();
    const state = addressForm.state.trim();
    const pincode = addressForm.pincode.trim();

    if (!name || !phone || !line1 || !city || !state || !pincode) {
      setAddressFormError('Please fill in all required fields.');
      return;
    }

    if (!/^\d{10}$/.test(phone)) {
      setAddressFormError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!/^\d{6}$/.test(pincode)) {
      setAddressFormError('Please enter a valid 6-digit PIN code.');
      return;
    }

    setIsSavingAddress(true);
    try {
      const payload = {
        ...addressForm,
        name,
        phone,
        line1,
        city,
        state,
        pincode,
      };

      if (editingAddressId) {
        const res = await api.put(`/addresses/${editingAddressId}`, payload);
        const updated = res.data?.data;
        await queryClient.invalidateQueries({ queryKey: ['my-addresses'] });
        if (updated) {
          handleSelectAddress(updated);
        }
      } else {
        const res = await api.post('/addresses', payload);
        const created = res.data?.data;
        await queryClient.invalidateQueries({ queryKey: ['my-addresses'] });
        if (created) {
          handleSelectAddress(created);
        }
      }
      setAddressModalOpen(false);
    } catch (err: any) {
      setAddressFormError(err.response?.data?.error?.message || 'Failed to save address. Please try again.');
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this address?')) return;
    try {
      await api.delete(`/addresses/${id}`);
      await queryClient.invalidateQueries({ queryKey: ['my-addresses'] });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to delete address.');
    }
  };

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
      setError('Please select or fill in all required shipping address fields.');
      return;
    }

    if (items.length === 0) {
      setError('Your cart is empty.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // If user had no saved addresses, automatically save the entered address if opted in
    if (addresses.length === 0 && saveAddressForFuture && isAuthenticated) {
      api.post('/addresses', {
        ...shippingAddress,
        label: 'Home',
        isDefault: true,
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['my-addresses'] });
      }).catch(() => {});
    }

    try {
      // 1. Create order via /checkout (with paymentMethod 'Cashfree')
      const orderRes = await api.post('/checkout', {
        shippingAddress,
        billingAddress: shippingAddress,
        customerName: shippingAddress.name,
        customerEmail: user?.email || `${shippingAddress.phone}@customer.eshopy.biz`,
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
        paymentMethod: 'Cashfree',
      });

      const order = orderRes.data.data;
      const orderId = order._id || order.id || order.orderNumber;

      // 2. Initiate Cashfree Payment Session
      const cfRes = await api.post('/payments/cashfree/create-order', {
        orderId,
        orderNumber: order.orderNumber,
        amount: grandTotal, // in paise
        customerName: shippingAddress.name,
        customerEmail: user?.email || `${shippingAddress.phone}@customer.eshopy.biz`,
        customerPhone: shippingAddress.phone,
        returnUrl: `${window.location.origin}/payment/return?order_id=${orderId}&cf_order_id={order_id}`,
      });

      const paymentSessionId = cfRes.data?.data?.payment_session_id;
      if (!paymentSessionId) {
        throw new Error('Could not initialize Cashfree payment session.');
      }

      // 3. Launch Cashfree Drop-in / Redirect Checkout
      const cfMode = (import.meta.env.VITE_CASHFREE_MODE || 'sandbox').toLowerCase() === 'production'
        ? 'production'
        : 'sandbox';

      const cashfree = await load({ mode: cfMode });
      await cashfree.checkout({
        paymentSessionId,
        redirectTarget: '_self',
      });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to initiate payment. Please try again.');
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
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.5, sm: 3.5 },
                borderRadius: '12px',
                border: '1px solid',
                borderColor: 'divider',
                mb: 4,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocationIcon sx={{ color: '#FF7900' }} />
                  <Typography variant="h6" fontWeight={800} sx={{ fontSize: '1.1rem', letterSpacing: '-0.01em' }}>
                    1. Shipping Address
                  </Typography>
                </Box>
                {addresses.length > 0 && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleOpenAddAddress}
                    sx={{
                      borderRadius: 2,
                      fontWeight: 700,
                      borderColor: '#FF7900',
                      color: '#FF7900',
                      textTransform: 'none',
                      '&:hover': { borderColor: '#E85D04', bgcolor: 'rgba(255, 121, 0, 0.04)' },
                    }}
                  >
                    Add New Address
                  </Button>
                )}
              </Box>

              {/* Loading State */}
              {isLoadingAddresses && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={32} sx={{ color: '#FF7900' }} />
                </Box>
              )}

              {/* Saved Addresses List (Cards) */}
              {!isLoadingAddresses && addresses.length > 0 && (
                <Grid container spacing={2}>
                  {addresses.map((addr) => {
                    const id = addr.id || (addr as any)._id;
                    const isSelected = selectedAddressId === id;
                    return (
                      <Grid item xs={12} sm={6} key={id}>
                        <Paper
                          variant="outlined"
                          onClick={() => handleSelectAddress(addr)}
                          sx={{
                            p: 2.5,
                            borderRadius: '10px',
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'all 0.2s ease',
                            borderWidth: isSelected ? '2px' : '1px',
                            borderColor: isSelected ? '#FF7900' : 'divider',
                            bgcolor: isSelected
                              ? (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 121, 0, 0.08)' : 'rgba(255, 121, 0, 0.03)')
                              : 'background.paper',
                            boxShadow: isSelected ? '0 4px 14px rgba(255, 121, 0, 0.12)' : 'none',
                            '&:hover': {
                              borderColor: isSelected ? '#FF7900' : 'text.secondary',
                            },
                          }}
                        >
                          {/* Card Header: Radio, Label, Default Chip, Actions */}
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Radio
                                checked={isSelected}
                                onChange={() => handleSelectAddress(addr)}
                                value={id}
                                size="small"
                                sx={{ p: 0, color: '#FF7900', '&.Mui-checked': { color: '#FF7900' } }}
                              />
                              <Chip
                                label={(addr.label || 'HOME').toUpperCase()}
                                size="small"
                                sx={{
                                  height: 22,
                                  fontSize: 10,
                                  fontWeight: 800,
                                  bgcolor: addr.label?.toLowerCase() === 'work' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 121, 0, 0.1)',
                                  color: addr.label?.toLowerCase() === 'work' ? '#2563eb' : '#FF7900',
                                }}
                              />
                              {addr.isDefault && (
                                <Chip
                                  label="DEFAULT"
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: 9,
                                    fontWeight: 800,
                                    bgcolor: 'success.light',
                                    color: 'success.dark',
                                  }}
                                />
                              )}
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <IconButton
                                size="small"
                                onClick={(e) => handleOpenEditAddress(addr, e)}
                                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                                title="Edit address"
                              >
                                <EditIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={(e) => handleDeleteAddress(id, e)}
                                sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                                title="Delete address"
                              >
                                <DeleteIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Box>
                          </Box>

                          {/* Recipient info */}
                          <Typography variant="subtitle2" fontWeight={800} sx={{ fontSize: '0.95rem', mb: 0.5 }}>
                            {addr.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, lineHeight: 1.5 }}>
                            {addr.line1}
                            {addr.line2 ? `, ${addr.line2}` : ''}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
                            {addr.city}, {addr.state} - {addr.pincode}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            Phone: {addr.phone}
                          </Typography>

                          {/* Delivery Badge when Selected */}
                          {isSelected && (
                            <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed', borderColor: 'rgba(255, 121, 0, 0.3)' }}>
                              <Typography variant="caption" fontWeight={700} sx={{ color: '#FF7900', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <CheckCircle sx={{ fontSize: 16 }} /> Delivering to this address
                              </Typography>
                            </Box>
                          )}
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              )}

              {/* When no saved addresses exist yet */}
              {!isLoadingAddresses && addresses.length === 0 && (
                <Box>
                  <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
                    You don&apos;t have any saved addresses yet. Enter your delivery address below to save it for this and future orders.
                  </Alert>
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
                        placeholder="10-digit mobile number"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="Address Line 1 (House/Flat, Street)"
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
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={saveAddressForFuture}
                            onChange={(e) => setSaveAddressForFuture(e.target.checked)}
                            sx={{ color: '#FF7900', '&.Mui-checked': { color: '#FF7900' } }}
                          />
                        }
                        label="Save this address to my account for faster checkout next time"
                      />
                    </Grid>
                  </Grid>
                </Box>
              )}
            </Paper>

            {/* Step 2: Payment Method */}
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.5, sm: 3.5 },
                borderRadius: '12px',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                <Typography variant="h6" fontWeight={800} sx={{ fontSize: '1.1rem', letterSpacing: '-0.01em' }}>
                  2. Payment Method
                </Typography>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1.5,
                    py: 0.5,
                    borderRadius: '20px',
                    bgcolor: 'rgba(22, 163, 74, 0.08)',
                    color: '#16a34a',
                  }}
                >
                  <VerifiedUser sx={{ fontSize: '0.95rem' }} />
                  <Typography variant="caption" fontWeight={700}>
                    Bank-Grade Security
                  </Typography>
                </Box>
              </Box>

              {/* Main Payment Selection Card */}
              <Box
                sx={{
                  border: '1.5px solid #FF7900',
                  borderRadius: '10px',
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 121, 0, 0.06)' : 'rgba(255, 121, 0, 0.02)',
                  overflow: 'hidden',
                  boxShadow: '0 4px 16px -2px rgba(255, 121, 0, 0.1)',
                }}
              >
                {/* Header Row with Selected Radio & Title */}
                <Box
                  sx={{
                    p: 2.5,
                    display: 'flex',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    justifyContent: 'space-between',
                    gap: 2,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.75 }}>
                    <Box
                      sx={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        border: '2px solid #FF7900',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mt: 0.3,
                        flexShrink: 0,
                      }}
                    >
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          bgcolor: '#FF7900',
                        }}
                      />
                    </Box>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.25 }}>
                        <Typography variant="subtitle1" fontWeight={800} sx={{ color: 'text.primary', fontSize: '1rem' }}>
                          Online Payment (UPI, Cards, Net Banking)
                        </Typography>
                        <Chip
                          label="RECOMMENDED"
                          size="small"
                          sx={{
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            height: 20,
                            bgcolor: '#FF7900',
                            color: '#ffffff',
                            letterSpacing: '0.04em',
                          }}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                        Secured & processed by Cashfree Payments Gateway
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Divider sx={{ borderColor: 'rgba(255, 121, 0, 0.15)' }} />

                {/* Available Payment Methods Grid */}
                <Box sx={{ p: 2.5, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.7)' }}>
                  <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1.5, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                    Available Payment Options
                  </Typography>

                  <Grid container spacing={1.5} sx={{ mb: 2 }}>
                    {/* UPI Option */}
                    <Grid item xs={12} sm={6}>
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: '8px',
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: 'background.paper',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                        }}
                      >
                        <Box sx={{ width: 36, height: 36, borderRadius: '8px', bgcolor: 'rgba(255, 121, 0, 0.08)', color: '#FF7900', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <QrCode2 fontSize="small" />
                        </Box>
                        <Box>
                          <Typography variant="body2" fontWeight={700}>UPI / QR Code</Typography>
                          <Typography variant="caption" color="text.secondary">Google Pay, PhonePe, Paytm, BHIM</Typography>
                        </Box>
                      </Box>
                    </Grid>

                    {/* Cards Option */}
                    <Grid item xs={12} sm={6}>
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: '8px',
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: 'background.paper',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                        }}
                      >
                        <Box sx={{ width: 36, height: 36, borderRadius: '8px', bgcolor: 'rgba(37, 99, 235, 0.08)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <CreditCard fontSize="small" />
                        </Box>
                        <Box>
                          <Typography variant="body2" fontWeight={700}>Credit & Debit Cards</Typography>
                          <Typography variant="caption" color="text.secondary">Visa, Mastercard, RuPay, Maestro</Typography>
                        </Box>
                      </Box>
                    </Grid>

                    {/* NetBanking Option */}
                    <Grid item xs={12} sm={6}>
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: '8px',
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: 'background.paper',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                        }}
                      >
                        <Box sx={{ width: 36, height: 36, borderRadius: '8px', bgcolor: 'rgba(16, 185, 129, 0.08)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <AccountBalance fontSize="small" />
                        </Box>
                        <Box>
                          <Typography variant="body2" fontWeight={700}>Net Banking</Typography>
                          <Typography variant="caption" color="text.secondary">All Indian Banks (HDFC, SBI, ICICI +50)</Typography>
                        </Box>
                      </Box>
                    </Grid>

                    {/* Wallets Option */}
                    <Grid item xs={12} sm={6}>
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: '8px',
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: 'background.paper',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                        }}
                      >
                        <Box sx={{ width: 36, height: 36, borderRadius: '8px', bgcolor: 'rgba(124, 58, 237, 0.08)', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <AccountBalanceWallet fontSize="small" />
                        </Box>
                        <Box>
                          <Typography variant="body2" fontWeight={700}>Wallets & More</Typography>
                          <Typography variant="caption" color="text.secondary">Amazon Pay, Mobikwik & others</Typography>
                        </Box>
                      </Box>
                    </Grid>
                  </Grid>

                  {/* Trust Footer Features */}
                  <Box
                    sx={{
                      pt: 1.5,
                      borderTop: '1px dashed',
                      borderColor: 'divider',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: { xs: 1.5, sm: 3 },
                      alignItems: 'center',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <CheckCircle sx={{ fontSize: '0.95rem', color: '#16a34a' }} />
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        Zero Convenience Fee
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <CheckCircle sx={{ fontSize: '0.95rem', color: '#16a34a' }} />
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        Instant Refund on Cancellation
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <CheckCircle sx={{ fontSize: '0.95rem', color: '#16a34a' }} />
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        256-Bit SSL Encrypted
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
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
                    Opening Cashfree Checkout…
                  </Box>
                ) : (
                  `Pay ₹${(grandTotal / 100).toFixed(0)} via Cashfree`
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

      {/* Add / Edit Address Dialog */}
      <Dialog
        open={addressModalOpen}
        onClose={() => !isSavingAddress && setAddressModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography variant="h6" fontWeight={800}>
            {editingAddressId ? 'Edit Address' : 'Add New Delivery Address'}
          </Typography>
          <IconButton onClick={() => setAddressModalOpen(false)} disabled={isSavingAddress} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <form onSubmit={handleSaveAddress}>
          <DialogContent sx={{ pt: 1 }}>
            {addressFormError && (
              <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
                {addressFormError}
              </Alert>
            )}

            <Stack spacing={2.5}>
              {/* Address Type / Label Selection */}
              <Box>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  ADDRESS TYPE
                </Typography>
                <Stack direction="row" spacing={1}>
                  {['Home', 'Work', 'Other'].map((type) => (
                    <Chip
                      key={type}
                      label={type}
                      clickable
                      onClick={() => setAddressForm((f) => ({ ...f, label: type }))}
                      sx={{
                        fontWeight: 700,
                        bgcolor: addressForm.label === type ? '#FF7900' : 'action.hover',
                        color: addressForm.label === type ? '#fff' : 'text.primary',
                        '&:hover': {
                          bgcolor: addressForm.label === type ? '#E85D04' : 'action.selected',
                        },
                      }}
                    />
                  ))}
                </Stack>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Full Name"
                    required
                    fullWidth
                    size="small"
                    value={addressForm.name}
                    onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="10-Digit Mobile Number"
                    required
                    fullWidth
                    size="small"
                    value={addressForm.phone}
                    onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                    placeholder="e.g. 9876543210"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Flat, House no., Building, Company, Apartment"
                    required
                    fullWidth
                    size="small"
                    value={addressForm.line1}
                    onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
                    placeholder="e.g. Flat 301, Tower B"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Area, Street, Sector, Village (Optional)"
                    fullWidth
                    size="small"
                    value={addressForm.line2}
                    onChange={(e) => setAddressForm({ ...addressForm, line2: e.target.value })}
                    placeholder="e.g. Near City Mall"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="City"
                    required
                    fullWidth
                    size="small"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="State"
                    required
                    fullWidth
                    size="small"
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="6-Digit PIN Code"
                    required
                    fullWidth
                    size="small"
                    value={addressForm.pincode}
                    onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value })}
                  />
                </Grid>
              </Grid>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={addressForm.isDefault}
                    onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                    sx={{ color: '#FF7900', '&.Mui-checked': { color: '#FF7900' } }}
                  />
                }
                label="Make this my default shipping address"
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setAddressModalOpen(false)} disabled={isSavingAddress} sx={{ fontWeight: 600 }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSavingAddress}
              sx={{
                borderRadius: 2,
                fontWeight: 700,
                px: 3,
                bgcolor: '#FF7900',
                color: '#fff',
                '&:hover': { bgcolor: '#E85D04' },
              }}
            >
              {isSavingAddress ? <CircularProgress size={20} color="inherit" /> : editingAddressId ? 'Update Address' : 'Save & Deliver Here'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
}
