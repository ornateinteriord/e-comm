import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Stack,
  Chip,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Storefront as StorefrontIcon,
  Place as PlaceIcon,
  Verified as VerifiedIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import api from '../api/client';
import { useStoreAuthStore } from '../store/auth.store';
import MapLocationPicker, { type LocationData } from '../components/map/MapLocationPicker';
import StoreReferralCard from '../components/referral/StoreReferralCard';

export default function ProfilePage() {
  const { store, updateStoreProfile } = useStoreAuthStore();

  const [name, setName] = useState(store?.name || '');
  const [ownerName, setOwnerName] = useState(store?.ownerName || '');
  const [email, setEmail] = useState(store?.email || '');
  const [line1, setLine1] = useState(store?.address?.line1 || '');
  const [line2, setLine2] = useState(store?.address?.line2 || '');
  const [city, setCity] = useState(store?.address?.city || '');
  const [stateName, setStateName] = useState(store?.address?.state || '');
  const [pincode, setPincode] = useState(store?.address?.pincode || '');

  const [location, setLocation] = useState<LocationData>({
    lat: store?.location?.lat || 12.9716,
    lng: store?.location?.lng || 77.5946,
    formattedAddress: store?.location?.formattedAddress || '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const payload = {
        name,
        ownerName,
        email,
        address: {
          line1,
          line2,
          city,
          state: stateName,
          pincode,
          country: 'India',
        },
        location: {
          lat: location.lat,
          lng: location.lng,
          formattedAddress: location.formattedAddress,
        },
      };

      const resp = await api.patch('/store/me', payload);
      if (resp.data?.success) {
        updateStoreProfile(resp.data.data);
        setSuccessMsg('Store profile and location updated successfully.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Failed to update store profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#172B30' }}>
          Store Profile & Map Location
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
          Manage your store metadata, contact details, and geolocation coordinates.
        </Typography>
      </Box>

      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{errorMsg}</Alert>}

      {/* Referral Link & Code Card */}
      {store?.storeId && (
        <Box sx={{ mb: 3 }}>
          <StoreReferralCard storeId={store.storeId} storeName={store.name} />
        </Box>
      )}

      <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 3, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF' }}>
        <Box component="form" onSubmit={handleSave}>
          <Stack spacing={4}>
            {/* Store Identity */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <StorefrontIcon sx={{ color: '#FF7900' }} />
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#172B30' }}>
                  Store Identity
                </Typography>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    disabled
                    label="Store ID"
                    value={store?.storeId || ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    disabled
                    label="Assigned Subcategory"
                    value={store?.subcategoryName ? `${store.subcategoryName} (${store.categoryName || 'General'})` : (store?.categoryName || '')}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    disabled
                    label="Store Tier & Capacity"
                    value={`${store?.typeOfStore || 'Standard'} Tier • ${store?.currentStockTotal ?? 0} / ${store?.maxStockLimit ?? 2500} units held`}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Store Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Owner Name"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    disabled
                    label="Login Username (Mobile)"
                    value={store?.mobileNumber || ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="email"
                    label="Store Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Grid>
              </Grid>
            </Box>

            <Divider />

            {/* Sponsor Info */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <VerifiedIcon sx={{ color: '#FF7900' }} />
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#172B30' }}>
                  Referring Sponsor
                </Typography>
              </Box>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 2, border: '1px solid #E2E8F0' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#172B30' }}>
                  {store?.referralName} ({store?.referralCode})
                </Typography>
                <Chip
                  label={store?.referralType === 'vendor' ? 'Vendor Sponsor' : 'Store Referral'}
                  size="small"
                  sx={{ mt: 0.5, bgcolor: '#EFF6FF', color: '#2563EB', fontWeight: 700, fontSize: '0.7rem' }}
                />
              </Paper>
            </Box>

            <Divider />

            {/* Address & Map */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <PlaceIcon sx={{ color: '#FF7900' }} />
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#172B30' }}>
                  Address & Map Coordinates
                </Typography>
              </Box>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Address Line 1"
                    value={line1}
                    onChange={(e) => setLine1(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Address Line 2"
                    value={line2}
                    onChange={(e) => setLine2(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="City"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="State"
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="PIN Code"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                  />
                </Grid>
              </Grid>

              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#172B30', mb: 1 }}>
                Interactive Store Map Location
              </Typography>
              <MapLocationPicker
                initialLat={location.lat}
                initialLng={location.lng}
                onChange={(loc) => setLocation(loc)}
                height={340}
              />
            </Box>

            <Box sx={{ textAlign: 'right' }}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={isSaving}
                startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                sx={{ px: 4, py: 1.25, fontWeight: 800 }}
              >
                {isSaving ? 'Saving Changes...' : 'Save Profile & Location'}
              </Button>
            </Box>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}

