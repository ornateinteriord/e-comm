import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  MyLocation as GpsIcon,
  TwoWheeler as BikeIcon,
} from '@mui/icons-material';
import type { DeliveryVehicleType } from '@ornate/types';
import api from '../api/client';
import { useDeliveryAuthStore } from '../store/auth.store';

const VEHICLE_OPTIONS: Array<{ value: DeliveryVehicleType; label: string }> = [
  { value: 'bike', label: 'Motorbike' },
  { value: 'scooter', label: 'Scooter / EV' },
  { value: 'bicycle', label: 'Bicycle' },
  { value: 'car', label: 'Car' },
  { value: 'van', label: 'Delivery Van' },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setAuth } = useDeliveryAuthStore();

  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [vehicleType, setVehicleType] = useState<DeliveryVehicleType>('bike');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [drivingLicenseNumber, setDrivingLicenseNumber] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');
  const [servicePincodes, setServicePincodes] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported on this device.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setIsLocating(false);
      },
      () => {
        setError('Could not retrieve GPS location.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const resp = await api.post('/delivery/register', {
        name: name.trim(),
        mobileNumber: mobileNumber.trim(),
        email: email.trim() || undefined,
        password,
        vehicleType,
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        drivingLicenseNumber: drivingLicenseNumber.trim(),
        city: city.trim(),
        state: stateName.trim(),
        pincode: pincode.trim(),
        servicePincodes,
        lat: coords?.lat,
        lng: coords?.lng,
      });

      if (resp.data?.success) {
        const { accessToken, partner } = resp.data.data;
        setAuth(accessToken, partner);
        navigate('/');
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr.response?.data?.error?.message || 'Registration failed. Please check all fields.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F8FAFC', py: { xs: 3, sm: 5 }, px: 2 }}>
      <Container maxWidth="sm">
        <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 3, border: '1px solid #E2E8F0' }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box component="img" src="/logo.svg" alt="E-Shopy" sx={{ height: 34, mx: 'auto', mb: 1.5 }} />
            <Typography variant="h5">Join E-Shopy Delivery Fleet</Typography>
            <Typography variant="body2" color="text.secondary">
              Register with your vehicle and KYC details. Admin activation unlocks deliveries.
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2.5 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="Mobile Number"
                  placeholder="10-digit mobile"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email (Optional)"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  type="password"
                  label="Password (min 6 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  required
                  label="Vehicle Type"
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value as DeliveryVehicleType)}
                >
                  {VEHICLE_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="Vehicle Registration #"
                  placeholder="KA01AB1234"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Driving License Number (KYC)"
                  placeholder="DL-XXXXXXXXXXXX"
                  value={drivingLicenseNumber}
                  onChange={(e) => setDrivingLicenseNumber(e.target.value.toUpperCase())}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField fullWidth required label="City" value={city} onChange={(e) => setCity(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth required label="State" value={stateName} onChange={(e) => setStateName(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth required label="Base Pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Preferred Delivery Pincodes (comma separated)"
                  placeholder="560001, 560002, 560034"
                  value={servicePincodes}
                  onChange={(e) => setServicePincodes(e.target.value)}
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleCaptureGps}
                  disabled={isLocating}
                  startIcon={isLocating ? <CircularProgress size={16} /> : <GpsIcon />}
                >
                  {coords
                    ? `GPS Captured (${coords.lat}, ${coords.lng})`
                    : isLocating
                      ? 'Detecting Location...'
                      : 'Capture Current GPS Coordinates (Optional)'}
                </Button>
              </Grid>
            </Grid>

            <Stack spacing={1.5} sx={{ mt: 3 }}>
              <Button
                fullWidth
                type="submit"
                variant="contained"
                size="large"
                disabled={isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <BikeIcon />}
              >
                {isSubmitting ? 'Submitting Application...' : 'Submit Partner Registration'}
              </Button>
              <Button component={RouterLink} to="/login" fullWidth color="secondary">
                Already registered? Sign In
              </Button>
            </Stack>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
