import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Chip,
  Grid,
  InputAdornment,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Storefront as StorefrontIcon,
  CheckCircle as CheckCircleIcon,
  Search as SearchIcon,
  Visibility,
  VisibilityOff,
  Verified as VerifiedIcon,
  Place as PlaceIcon,
  Category as CategoryIcon,
  Person as PersonIcon,
  Lock as LockIcon,
  Login as LoginIcon,
} from '@mui/icons-material';
import { MenuItem } from '@mui/material';
import api from '../api/client';
import { useStoreAuthStore } from '../store/auth.store';
import MapLocationPicker, { type LocationData } from '../components/map/MapLocationPicker';
import RegisterSuccessDialog, { type StoreRegistrationDetails } from '../components/auth/RegisterSuccessDialog';

const STORE_TYPES = [
  { value: 'Basic', label: 'Basic — Neighborhood Express Store' },
  { value: 'Standard', label: 'Standard — Fulfillment & Dispatch Hub' },
  { value: 'Advanced', label: 'Advanced — Regional Superstore' },
  { value: 'Flagship', label: 'Flagship — Experience & Service Center' },
  { value: 'Wholesale', label: 'Wholesale — Mega Distribution Hub' },
];


interface CategoryItem {
  id: string;
  _id?: string;
  name: string;
  slug: string;
  description?: string;
  isAvailable: boolean;
  claimedByStore?: { storeId: string; name: string } | null;
}

export default function RegisterStorePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth, isAuthenticated } = useStoreAuthStore();

  // Dialog State
  const [successDetails, setSuccessDetails] = useState<StoreRegistrationDetails | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [tempAuthData, setTempAuthData] = useState<{ token: string; store: any } | null>(null);

  useEffect(() => {
    if (isAuthenticated && !showSuccessDialog) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, showSuccessDialog, navigate]);

  // Form State - Referral
  const [referralCode, setReferralCode] = useState('');
  const [verifiedReferral, setVerifiedReferral] = useState<{
    code: string;
    name: string;
    type: 'vendor' | 'store';
  } | null>(null);
  const [isVerifyingRef, setIsVerifyingRef] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);

  // Form State - Category
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryItem | null>(null);
  const [isLoadingCats, setIsLoadingCats] = useState(false);

  // Form State - Store Details
  const [storeName, setStoreName] = useState('');
  const [typeOfStore, setTypeOfStore] = useState('Standard (Fulfillment Hub)');
  const [ownerName, setOwnerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Form State - Address
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');

  // Form State - Map Location
  const [location, setLocation] = useState<LocationData>({
    lat: 12.9716,
    lng: 77.5946,
  });

  const handleLocationChange = (newLoc: LocationData) => {
    setLocation(newLoc);
    if (newLoc.city) setCity(newLoc.city);
    if (newLoc.state) setStateName(newLoc.state);
    if (newLoc.pincode) setPincode(newLoc.pincode);
    if (newLoc.line1 && !line1) setLine1(newLoc.line1);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch available categories on mount
  useEffect(() => {
    async function fetchCategories() {
      setIsLoadingCats(true);
      try {
        const resp = await api.get('/store/categories/available');
        if (resp.data?.success) {
          setCategories(resp.data.data);
        }
      } catch (err: any) {
        console.error('Failed to load categories', err);
      } finally {
        setIsLoadingCats(false);
      }
    }
    fetchCategories();
  }, []);

  // Verify referral code
  const handleVerifyReferral = async (overrideCode?: string) => {
    const code = (overrideCode || referralCode).trim();
    if (!code) {
      setReferralError('Please enter a referral sponsor code.');
      setVerifiedReferral(null);
      return;
    }

    setIsVerifyingRef(true);
    setReferralError(null);
    try {
      const resp = await api.get(`/store/verify-referral?code=${encodeURIComponent(code)}`);
      if (resp.data?.success && resp.data.data?.valid) {
        setVerifiedReferral({
          code: resp.data.data.referralCode,
          name: resp.data.data.referralName,
          type: resp.data.data.referralType,
        });
      } else {
        setReferralError(resp.data?.error?.message || 'Invalid referral code.');
        setVerifiedReferral(null);
      }
    } catch (err: any) {
      setReferralError(err.response?.data?.error?.message || 'Invalid referral code.');
      setVerifiedReferral(null);
    } finally {
      setIsVerifyingRef(false);
    }
  };

  // Pre-fill and verify referral from URL query string if present (?ref=STR00001 or ?referral=...)
  useEffect(() => {
    const refFromQuery = searchParams.get('ref') || searchParams.get('referral') || searchParams.get('sponsor');
    if (refFromQuery) {
      const cleanRef = refFromQuery.trim();
      setReferralCode(cleanRef);
      handleVerifyReferral(cleanRef);
    }
  }, [searchParams]);

  // Submit Registration
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!verifiedReferral) {
      setFormError('A verified sponsor code (Vendor or existing Store) is required.');
      return;
    }

    if (!selectedCategory) {
      setFormError('Please select a category for your store.');
      return;
    }

    if (!storeName.trim() || !ownerName.trim()) {
      setFormError('Store name and owner name are required.');
      return;
    }

    const cleanMobile = mobileNumber.replace(/\D/g, '').trim();
    if (cleanMobile.length < 10) {
      setFormError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    if (!line1.trim() || !city.trim() || !stateName.trim() || !pincode.trim()) {
      setFormError('Please complete all required address fields (Street, City, State, PIN code).');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: storeName.trim(),
        typeOfStore,
        ownerName: ownerName.trim(),
        email: email.trim() || `${cleanMobile}@store.eshopy.biz`,
        mobileNumber: cleanMobile,
        password,
        categoryId: selectedCategory.id || selectedCategory._id,
        categoryName: selectedCategory.name,
        categorySlug: selectedCategory.slug,
        referralCode: verifiedReferral.code,
        address: {
          line1: line1.trim(),
          line2: line2.trim(),
          city: city.trim(),
          state: stateName.trim(),
          pincode: pincode.trim(),
          country: 'India',
        },
        location: {
          lat: location.lat,
          lng: location.lng,
          formattedAddress: location.formattedAddress || `${line1}, ${city}, ${stateName}`,
        },
      };

      const resp = await api.post('/store/register', payload);

      if (resp.data?.success) {
        const { accessToken, store } = resp.data.data;
        setTempAuthData({ token: accessToken, store });
        setSuccessDetails({
          storeId: store.storeId,
          name: store.name,
          typeOfStore: store.typeOfStore || typeOfStore,
          ownerName: store.ownerName,
          email: store.email,
          mobileNumber: store.mobileNumber,
          password,
          categoryName: store.categoryName,
          referralCode: verifiedReferral.code,
          referralName: verifiedReferral.name,
          referralType: verifiedReferral.type,
          city: store.address?.city,
          state: store.address?.state,
        });
        setShowSuccessDialog(true);
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProceedToDashboard = () => {
    if (tempAuthData) {
      setAuth(tempAuthData.token, tempAuthData.store);
    }
    setShowSuccessDialog(false);
    navigate('/');
  };

  const handleGoToLogin = () => {
    setShowSuccessDialog(false);
    navigate('/login');
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F8FAFC', py: { xs: 4, sm: 6 } }}>
      <Container maxWidth="md">
        {/* Brand Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            component="img"
            src="/logo.svg"
            alt="E-Shopy"
            sx={{ height: 42, width: 'auto', maxWidth: 220, objectFit: 'contain', mx: 'auto', mb: 1.5 }}
          />
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#172B30' }}>
            Register Your Partner Store
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
            Each category is exclusively managed by one partner store. Set up your store and start fulfilling local orders.
          </Typography>
        </Box>

        <Paper
          elevation={1}
          sx={{
            p: { xs: 2.5, sm: 4 },
            borderRadius: 3,
            bgcolor: '#FFFFFF',
          }}
        >
          {formError && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {formError}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={4}>
              {/* SECTION 1: REFERRAL VERIFICATION */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <VerifiedIcon sx={{ color: '#FF7900' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#172B30' }}>
                    1. Referring Sponsor / Vendor
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: '#64748B', mb: 2 }}>
                  Every store must be referred by an authorized Vendor or an existing partner Store.
                </Typography>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
                  <TextField
                    placeholder="Enter Vendor ID or Store ID"
                    value={referralCode}
                    onChange={(e) => {
                      setReferralCode(e.target.value);
                      setVerifiedReferral(null);
                      setReferralError(null);
                    }}
                    error={Boolean(referralError)}
                    helperText={referralError}
                    sx={{ flex: 1 }}
                  />
                  <Button
                    variant="contained"
                    onClick={() => handleVerifyReferral()}
                    disabled={isVerifyingRef || !referralCode.trim()}
                    sx={{ height: 40, minWidth: 120 }}
                  >
                    {isVerifyingRef ? <CircularProgress size={20} color="inherit" /> : 'Verify Sponsor'}
                  </Button>
                </Stack>

                {verifiedReferral && (
                  <Paper
                    elevation={0}
                    sx={{
                      mt: 2,
                      p: 2,
                      bgcolor: '#F0FDF4',
                      border: '1px solid #BBF7D0',
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <CheckCircleIcon sx={{ color: '#10B981', fontSize: 24 }} />
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#166534' }}>
                          {verifiedReferral.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#15803D' }}>
                          Sponsor Code: {verifiedReferral.code}
                        </Typography>
                      </Box>
                    </Box>
                    <Chip
                      label={verifiedReferral.type === 'vendor' ? 'Vendor Sponsor' : 'Store Referral'}
                      size="small"
                      sx={{ bgcolor: '#DCFCE7', color: '#15803D', fontWeight: 700 }}
                    />
                  </Paper>
                )}
              </Box>

              <Divider />

              {/* SECTION 2: CATEGORY SELECTION */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <CategoryIcon sx={{ color: '#FF7900' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#172B30' }}>
                    2. Select Store Category
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: '#64748B', mb: 2 }}>
                  Choose which product category your store will operate. Each category is granted to one store.
                </Typography>

                {isLoadingCats ? (
                  <Box sx={{ py: 3, textAlign: 'center' }}>
                    <CircularProgress size={28} sx={{ color: '#FF7900' }} />
                  </Box>
                ) : (
                  <Grid container spacing={1.5}>
                    {categories.map((cat) => {
                      const isSelected = (selectedCategory?.id || selectedCategory?._id) === (cat.id || cat._id);
                      const isTaken = !cat.isAvailable;

                      return (
                        <Grid item xs={12} sm={6} md={4} key={cat.id || cat._id}>
                          <Paper
                            elevation={0}
                            onClick={() => !isTaken && setSelectedCategory(cat)}
                            sx={{
                              p: 2,
                              borderRadius: 2,
                              border: '1.5px solid',
                              borderColor: isSelected ? '#FF7900' : isTaken ? '#E2E8F0' : '#CBD5E1',
                              bgcolor: isSelected ? '#FFF7ED' : isTaken ? '#F1F5F9' : '#FFFFFF',
                              cursor: isTaken ? 'not-allowed' : 'pointer',
                              opacity: isTaken ? 0.65 : 1,
                              transition: 'all 0.15s ease-in-out',
                              '&:hover': {
                                borderColor: isTaken ? '#E2E8F0' : '#FF7900',
                                transform: isTaken ? 'none' : 'translateY(-2px)',
                              },
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: isTaken ? '#64748B' : '#172B30' }}>
                                {cat.name}
                              </Typography>
                              {isSelected && <CheckCircleIcon sx={{ fontSize: 18, color: '#FF7900' }} />}
                            </Box>
                            <Box sx={{ mt: 1 }}>
                              {isTaken ? (
                                <Chip
                                  label={`Claimed: ${cat.claimedByStore?.name || 'Store'}`}
                                  size="small"
                                  sx={{ fontSize: '0.65rem', height: 20, bgcolor: '#E2E8F0', color: '#64748B' }}
                                />
                              ) : (
                                <Chip
                                  label="Available"
                                  size="small"
                                  sx={{ fontSize: '0.65rem', height: 20, bgcolor: '#ECFDF5', color: '#047857', fontWeight: 700 }}
                                />
                              )}
                            </Box>
                          </Paper>
                        </Grid>
                      );
                    })}
                  </Grid>
                )}

                {selectedCategory && (
                  <Alert severity="success" sx={{ mt: 2, borderRadius: 2 }}>
                    Selected Category: <strong>{selectedCategory.name}</strong>
                  </Alert>
                )}
              </Box>

              <Divider />

              {/* SECTION 3: STORE DETAILS */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <StorefrontIcon sx={{ color: '#FF7900' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#172B30' }}>
                    3. Store & Owner Details
                  </Typography>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Store Name *"
                      placeholder="e.g. Apex Electronics"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      fullWidth
                      label="Type of Store *"
                      value={typeOfStore}
                      onChange={(e) => setTypeOfStore(e.target.value)}
                      helperText="Select your store tier or operational capacity"
                    >
                      {STORE_TYPES.map((t) => (
                        <MenuItem key={t.value} value={t.value}>
                          {t.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Owner / Manager Full Name *"
                      placeholder="e.g. Ramesh Kumar"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Contact Mobile (Login Username) *"
                      placeholder="10-digit mobile number"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">+91</InputAdornment>,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="email"
                      label="Store Email"
                      placeholder="store@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type={showPassword ? 'text' : 'password'}
                      label="Password *"
                      placeholder="Minimum 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                              {showPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </Grid>
              </Box>

              <Divider />

              {/* SECTION 4: MAP LOCATION & ADDRESS */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <PlaceIcon sx={{ color: '#FF7900' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#172B30' }}>
                    4. Store Location & Address
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: '#64748B', mb: 2 }}>
                  First select your store location on the map. Your PIN code, City, and State will automatically auto-populate below.
                </Typography>

                {/* 1. Map First */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#172B30', mb: 0.5 }}>
                    Select Store Location on Map *
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 1.5 }}>
                    Search an area or click directly on the map to drop the store pin.
                  </Typography>

                  <MapLocationPicker
                    initialLat={location.lat}
                    initialLng={location.lng}
                    onChange={handleLocationChange}
                    height={340}
                  />
                </Box>

                {/* 2. Address Down */}
                <Box sx={{ mt: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#172B30' }}>
                      Store Address Details
                    </Typography>
                    {(pincode || city) && (
                      <Chip
                        icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
                        label="Auto-populated from map"
                        size="small"
                        sx={{ bgcolor: '#ECFDF5', color: '#047857', fontWeight: 700, fontSize: '0.72rem' }}
                      />
                    )}
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Address Line 1 (Building / Shop No. / Street) *"
                        placeholder="e.g. Shop #12, Ground Floor, MG Road"
                        value={line1}
                        onChange={(e) => setLine1(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Address Line 2 (Area / Landmark)"
                        placeholder="e.g. Near Metro Station"
                        value={line2}
                        onChange={(e) => setLine2(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="PIN Code *"
                        placeholder="e.g. 560001"
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="City *"
                        placeholder="e.g. Bengaluru"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="State *"
                        placeholder="e.g. Karnataka"
                        value={stateName}
                        onChange={(e) => setStateName(e.target.value)}
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Box>

              {/* SUBMIT BUTTON */}
              <Box sx={{ pt: 2 }}>
                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={isSubmitting}
                  sx={{
                    py: 1.5,
                    fontSize: '1rem',
                    fontWeight: 800,
                  }}
                >
                  {isSubmitting ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    'Complete Store Registration'
                  )}
                </Button>

                <Box sx={{ textAlign: 'center', mt: 2 }}>
                  <Typography variant="body2" sx={{ color: '#64748B' }}>
                    Already have a partner store account?{' '}
                    <Button
                      component={RouterLink}
                      to="/login"
                      sx={{ textTransform: 'none', fontWeight: 700, color: '#FF7900' }}
                    >
                      Sign In
                    </Button>
                  </Typography>
                </Box>
              </Box>
            </Stack>
          </Box>
        </Paper>
      </Container>

      {/* Post Registration Credentials Summary Dialog */}
      <RegisterSuccessDialog
        open={showSuccessDialog}
        details={successDetails}
        onProceedToDashboard={handleProceedToDashboard}
        onGoToLogin={handleGoToLogin}
      />
    </Box>
  );
}

