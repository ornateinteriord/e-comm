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
import { useSellerAuthStore } from '../store/auth.store';
import MapLocationPicker, { type LocationData } from '../components/map/MapLocationPicker';
import SellerReferralCard from '../components/referral/SellerReferralCard';

export default function ProfilePage() {
  const { seller, updateSellerProfile } = useSellerAuthStore();

  const [name, setName] = useState(seller?.name || '');
  const [ownerName, setOwnerName] = useState(seller?.ownerName || '');
  const [email, setEmail] = useState(seller?.email || '');
  const [line1, setLine1] = useState(seller?.address?.line1 || '');
  const [line2, setLine2] = useState(seller?.address?.line2 || '');
  const [city, setCity] = useState(seller?.address?.city || '');
  const [stateName, setStateName] = useState(seller?.address?.state || '');
  const [pincode, setPincode] = useState(seller?.address?.pincode || '');

  const [location, setLocation] = useState<LocationData>({
    lat: seller?.location?.lat || 12.9716,
    lng: seller?.location?.lng || 77.5946,
    formattedAddress: seller?.location?.formattedAddress || '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sellerDisplayId = seller?.sellerId || seller?.storeId;

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

      const resp = await api.patch('/seller/me', payload);
      if (resp.data?.success) {
        updateSellerProfile(resp.data.data);
        setSuccessMsg('Seller profile and location updated successfully.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Failed to update seller profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#172B30' }}>
          Seller Profile & Map Location
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
          Manage your seller metadata, contact details, and geolocation coordinates.
        </Typography>
      </Box>

      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{errorMsg}</Alert>}

      {/* Referral Link & Code Card */}
      {sellerDisplayId && (
        <Box sx={{ mb: 3 }}>
          <SellerReferralCard
            sellerId={sellerDisplayId}
            sellerName={seller?.name}
            storeId={sellerDisplayId}
            storeName={seller?.name}
          />
        </Box>
      )}

      <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 3, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF' }}>
        <Box component="form" onSubmit={handleSave}>
          <Stack spacing={4}>
            {/* Seller Identity */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <StorefrontIcon sx={{ color: '#FF7900' }} />
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#172B30' }}>
                  Seller Identity
                </Typography>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    disabled
                    label="Seller ID"
                    value={sellerDisplayId || ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    disabled
                    label="Assigned Subcategory"
                    value={seller?.subcategoryName ? `${seller.subcategoryName} (${seller.categoryName || 'General'})` : (seller?.categoryName || '')}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    disabled
                    label="Seller Tier & Capacity"
                    value={`${seller?.typeOfSeller || seller?.typeOfStore || 'Standard'} Tier • ${seller?.currentStockTotal ?? 0} / ${seller?.maxStockLimit ?? 2500} units held`}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Seller Business Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Owner / Manager Name"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    disabled
                    label="Login Username (Mobile)"
                    value={seller?.mobileNumber || ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="email"
                    label="Seller Email"
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
                  {seller?.referralName} ({seller?.referralCode})
                </Typography>
                <Chip
                  label={seller?.referralType === 'vendor' ? 'Vendor Sponsor' : 'Seller Referral'}
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
                Interactive Seller Map Location
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
