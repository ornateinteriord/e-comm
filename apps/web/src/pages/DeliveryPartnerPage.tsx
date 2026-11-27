import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Android as AndroidIcon,
  CheckCircleOutline as CheckIcon,
  Download as DownloadIcon,
  MyLocation as GpsIcon,
  OpenInNew as OpenIcon,
  TwoWheeler as BikeIcon,
  UploadFile as UploadIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import type {
  DeliveryAppReleaseInfo,
  DeliveryPartnerProfile,
  DeliveryVehicleType,
} from '@ornate/types';
import PageBreadcrumbs from '../components/PageBreadcrumbs';

const API_BASE = import.meta.env.VITE_API_GATEWAY_URL
  ? `${import.meta.env.VITE_API_GATEWAY_URL.replace(/\/+$/, '')}/api/v1`
  : '/api/v1';

const DELIVERY_PORTAL_URL = (
  import.meta.env.VITE_DELIVERY_PORTAL_URL || 'https://delivery.eshopy.biz'
).replace(/\/+$/, '');

// Dedicated axios client so rider onboarding requests never alter storefront customer auth
const deliveryApi = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  timeout: 15000,
});

const VEHICLE_OPTIONS: Array<{ value: DeliveryVehicleType; label: string }> = [
  { value: 'bike', label: 'Motorbike' },
  { value: 'scooter', label: 'Scooter / EV' },
  { value: 'bicycle', label: 'Bicycle' },
  { value: 'car', label: 'Car' },
  { value: 'van', label: 'Delivery Van' },
];

type KycDocKey = 'drivingLicenseUrl' | 'vehicleRcUrl' | 'idProofUrl' | 'profilePhotoUrl';

function resolveApkDownloadHref(release?: DeliveryAppReleaseInfo | null): string {
  const gatewayBase = (import.meta.env.VITE_API_GATEWAY_URL || '').replace(/\/+$/, '');
  if (release?.apkUrl) {
    return gatewayBase ? `${gatewayBase}/api/v1/delivery/app-download` : '/api/v1/delivery/app-download';
  }
  if (release?.playStoreUrl) {
    return release.playStoreUrl;
  }
  return '';
}

function getErrorMessage(err: unknown, fallback: string): string {
  const axiosErr = err as { response?: { data?: { error?: { message?: string }; message?: string } } };
  return (
    axiosErr.response?.data?.error?.message ||
    axiosErr.response?.data?.message ||
    fallback
  );
}

export default function DeliveryPartnerPage() {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  // Registration form fields
  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
  const [formError, setFormError] = useState<string | null>(null);

  // Post-registration onboarding state (no web sign-in)
  const [registrationToken, setRegistrationToken] = useState<string | null>(null);
  const [registeredPartner, setRegisteredPartner] = useState<DeliveryPartnerProfile | null>(null);
  const [uploadingField, setUploadingField] = useState<KycDocKey | null>(null);
  const [kycNotice, setKycNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [apkNotice, setApkNotice] = useState<string | null>(null);

  const { data: releaseInfo, isLoading: isLoadingRelease } = useQuery<DeliveryAppReleaseInfo>({
    queryKey: ['web-delivery-app-release'],
    queryFn: async () => {
      const resp = await deliveryApi.get('/delivery/app-release');
      return resp.data.data;
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const downloadHref = resolveApkDownloadHref(releaseInfo);
  const isBicycle = vehicleType === 'bicycle';

  const handleDownloadApk = () => {
    setApkNotice(null);
    if (!releaseInfo?.isConfigured || !downloadHref) {
      setApkNotice(
        'The Rider APK link has not been published yet. You can still open delivery.eshopy.biz or check back shortly.',
      );
      return;
    }
    window.open(downloadHref, '_blank', 'noopener,noreferrer');
  };

  const handleCaptureGps = () => {
    setFormError(null);
    if (!navigator.geolocation) {
      setFormError('Geolocation is not supported by your browser.');
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
        setFormError('Unable to read GPS location. You can still submit without coordinates.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const digits = mobileNumber.replace(/\D/g, '').slice(0, 10);
    if (digits.length !== 10) {
      setFormError('Enter a valid 10-digit mobile number.');
      return;
    }
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    const resolvedVehicleNumber =
      vehicleNumber.trim().toUpperCase() || (isBicycle ? 'BICYCLE' : '');
    if (resolvedVehicleNumber.length < 2) {
      setFormError('Vehicle registration number is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const resp = await deliveryApi.post('/delivery/register', {
        name: name.trim(),
        mobileNumber: digits,
        email: email.trim() || undefined,
        password,
        vehicleType,
        vehicleNumber: resolvedVehicleNumber,
        drivingLicenseNumber: drivingLicenseNumber.trim().toUpperCase() || undefined,
        city: city.trim(),
        state: stateName.trim(),
        pincode: pincode.trim(),
        servicePincodes,
        lat: coords?.lat,
        lng: coords?.lng,
      });

      if (resp.data?.success && resp.data?.data) {
        setRegistrationToken(resp.data.data.accessToken || null);
        setRegisteredPartner(resp.data.data.partner);
        setKycNotice(null);
      }
    } catch (err) {
      setFormError(getErrorMessage(err, 'Registration failed. Please check all required fields.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadDoc = async (docType: KycDocKey, file?: File) => {
    if (!file || !registrationToken) return;
    setUploadingField(docType);
    setKycNotice(null);
    try {
      const formData = new FormData();
      formData.append('docType', docType);
      formData.append('file', file);
      const resp = await deliveryApi.post('/delivery/me/documents', formData, {
        headers: {
          Authorization: `Bearer ${registrationToken}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      if (resp.data?.success && resp.data?.data?.partner) {
        setRegisteredPartner(resp.data.data.partner);
        setKycNotice({ type: 'success', text: 'Document uploaded and attached to your application.' });
      }
    } catch (err) {
      setKycNotice({
        type: 'error',
        text: getErrorMessage(err, 'Document upload failed. Please try a smaller image file.'),
      });
    } finally {
      setUploadingField(null);
    }
  };

  const handleResetRegistration = () => {
    setRegisteredPartner(null);
    setRegistrationToken(null);
    setKycNotice(null);
    setFormError(null);
    setName('');
    setMobileNumber('');
    setEmail('');
    setPassword('');
    setVehicleNumber('');
    setDrivingLicenseNumber('');
    setCity('');
    setStateName('');
    setPincode('');
    setServicePincodes('');
    setCoords(null);
  };

  const requiredDocs: Array<{ key: KycDocKey; label: string; hint: string }> =
    registeredPartner?.vehicleType === 'bicycle'
      ? [
          {
            key: 'idProofUrl',
            label: 'Government ID Proof',
            hint: 'Aadhaar, PAN, or Voter ID',
          },
          {
            key: 'profilePhotoUrl',
            label: 'Rider Photo',
            hint: 'Clear front-facing photo',
          },
        ]
      : [
          {
            key: 'drivingLicenseUrl',
            label: 'Driving License Photo',
            hint: 'Front side showing DL number & validity',
          },
          {
            key: 'vehicleRcUrl',
            label: 'Vehicle RC Photo',
            hint: 'Registration certificate matching vehicle number',
          },
          {
            key: 'idProofUrl',
            label: 'Government ID Proof',
            hint: 'Aadhaar, PAN, or Voter ID',
          },
          {
            key: 'profilePhotoUrl',
            label: 'Rider Photo',
            hint: 'Clear front-facing photo',
          },
        ];

  const cardSx = {
    p: { xs: 2.25, sm: 3.5 },
    borderRadius: '8px',
    border: `1px solid ${isLight ? '#E5E7EB' : 'rgba(255,255,255,0.1)'}`,
    bgcolor: isLight ? '#FFFFFF' : '#111827',
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 4.5 }, pb: { xs: 8, md: 8 } }}>
      <PageBreadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: 'Delivery Partner' },
        ]}
      />

      {/* Page Header */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'flex-end' },
          gap: 2,
          pb: 3,
          mb: 3.5,
          borderBottom: `1px solid ${isLight ? '#E5E7EB' : 'rgba(255,255,255,0.08)'}`,
        }}
      >
        <Box>
          <Typography
            variant="overline"
            sx={{ color: '#FF7900', fontWeight: 800, letterSpacing: '0.06em', display: 'block' }}
          >
            E-SHOPY LOGISTICS
          </Typography>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 900,
              letterSpacing: '-0.025em',
              color: isLight ? '#172B30' : '#F8FAFC',
              fontSize: { xs: '1.55rem', md: '2.1rem' },
            }}
          >
            Delivery Rider Onboarding
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 620 }}>
            Register as a delivery partner here. To sign in, manage deliveries, or check approval, install the Rider APK or open{' '}
            <strong>delivery.eshopy.biz</strong>.
          </Typography>
        </Box>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.25}
          sx={{ width: { xs: '100%', md: 'auto' }, flexShrink: 0 }}
        >
          <Button
            variant="contained"
            onClick={handleDownloadApk}
            disabled={isLoadingRelease}
            startIcon={isLoadingRelease ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
            sx={{
              bgcolor: '#172B30',
              color: '#FFFFFF',
              fontWeight: 700,
              px: 2.25,
              py: 1.1,
              borderRadius: '6px',
              whiteSpace: 'nowrap',
              '&:hover': { bgcolor: '#0E1C20' },
            }}
          >
            {releaseInfo?.versionName ? `Download Rider APK (v${releaseInfo.versionName})` : 'Download Rider APK'}
          </Button>

          <Button
            variant="outlined"
            component="a"
            href={DELIVERY_PORTAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenIcon fontSize="small" />}
            sx={{
              borderColor: isLight ? '#D1D5DB' : 'rgba(255,255,255,0.22)',
              color: isLight ? '#172B30' : '#F8FAFC',
              fontWeight: 700,
              px: 2.25,
              py: 1.1,
              borderRadius: '6px',
              whiteSpace: 'nowrap',
              '&:hover': { borderColor: '#FF7900', color: '#FF7900' },
            }}
          >
            Rider Sign In (delivery.eshopy.biz)
          </Button>
        </Stack>
      </Box>

      {apkNotice && (
        <Alert severity="info" onClose={() => setApkNotice(null)} sx={{ mb: 3, borderRadius: '6px' }}>
          {apkNotice}
        </Alert>
      )}

      <Grid container spacing={3} alignItems="flex-start">
        {/* Left Column: Rider Registration (or post-signup confirmation & optional KYC upload) */}
        <Grid item xs={12} md={8}>
          <Paper elevation={0} sx={cardSx}>
            {!registeredPartner ? (
              <Box component="form" onSubmit={handleRegister}>
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 1,
                    pb: 2,
                    mb: 2.5,
                    borderBottom: `1px solid ${isLight ? '#E5E7EB' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  <Typography variant="h6" fontWeight={800} sx={{ fontSize: '1.05rem' }}>
                    New Rider Registration
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Already registered?{' '}
                    <Box
                      component="a"
                      href={DELIVERY_PORTAL_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        color: '#FF7900',
                        fontWeight: 700,
                        textDecoration: 'none',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      Sign in on delivery.eshopy.biz
                    </Box>
                  </Typography>
                </Box>

                {formError && (
                  <Alert severity="error" sx={{ mb: 2.5, borderRadius: '6px' }}>
                    {formError}
                  </Alert>
                )}

                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, color: 'text.primary' }}>
                  1. Personal Details
                </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      required
                      size="small"
                      label="Full Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      required
                      size="small"
                      label="Mobile Number"
                      placeholder="10-digit mobile"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      inputProps={{ maxLength: 10, inputMode: 'numeric' }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Typography variant="body2" fontWeight={700} color="text.secondary">
                              +91
                            </Typography>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      type="email"
                      label="Email (Optional)"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      required
                      size="small"
                      type={showPassword ? 'text' : 'password'}
                      label="Password (min 6 chars)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              size="small"
                              onClick={() => setShowPassword((prev) => !prev)}
                              aria-label="Toggle password visibility"
                            >
                              {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2.5 }} />

                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, color: 'text.primary' }}>
                  2. Vehicle & License
                </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      fullWidth
                      required
                      size="small"
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
                      required={!isBicycle}
                      size="small"
                      label={isBicycle ? 'Bicycle / Frame Tag (Optional)' : 'Vehicle Registration Number'}
                      placeholder={isBicycle ? 'BICYCLE' : 'KA01AB1234'}
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label={isBicycle ? 'Driving License Number (Optional)' : 'Driving License Number'}
                      placeholder="DL-XXXXXXXXXXXX"
                      value={drivingLicenseNumber}
                      onChange={(e) => setDrivingLicenseNumber(e.target.value.toUpperCase())}
                    />
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2.5 }} />

                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, color: 'text.primary' }}>
                  3. Service Location
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      required
                      size="small"
                      label="City"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      required
                      size="small"
                      label="State"
                      value={stateName}
                      onChange={(e) => setStateName(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      required
                      size="small"
                      label="Base Pincode"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputProps={{ maxLength: 6, inputMode: 'numeric' }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Preferred Delivery Pincodes (comma separated)"
                      placeholder="560001, 560002, 560034"
                      value={servicePincodes}
                      onChange={(e) => setServicePincodes(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                      <Button
                        type="button"
                        variant="outlined"
                        size="small"
                        onClick={handleCaptureGps}
                        disabled={isLocating}
                        startIcon={isLocating ? <CircularProgress size={14} /> : <GpsIcon />}
                        sx={{
                          borderColor: isLight ? '#D1D5DB' : 'rgba(255,255,255,0.2)',
                          color: 'text.primary',
                          borderRadius: '6px',
                          alignSelf: 'flex-start',
                        }}
                      >
                        {coords
                          ? `GPS Saved (${coords.lat}, ${coords.lng})`
                          : isLocating
                            ? 'Detecting Location...'
                            : 'Capture Current GPS (Optional)'}
                      </Button>
                      {coords && (
                        <Typography variant="caption" color="text.secondary">
                          Coordinates will be stored as your starting hub location.
                        </Typography>
                      )}
                    </Stack>
                  </Grid>
                </Grid>

                <Box sx={{ mt: 3.5 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={isSubmitting}
                    startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <BikeIcon />}
                    sx={{
                      bgcolor: '#FF7900',
                      color: '#FFFFFF',
                      borderRadius: '6px',
                      px: 3,
                      width: { xs: '100%', sm: 'auto' },
                      '&:hover': { bgcolor: '#E85D04' },
                    }}
                  >
                    {isSubmitting ? 'Submitting Application...' : 'Submit Rider Registration'}
                  </Button>
                </Box>
              </Box>
            ) : (
              /* Post-Registration Confirmation + Optional Document Upload + App/Portal Handoff */
              <Box>
                <Alert severity="success" sx={{ mb: 2.5, borderRadius: '6px' }}>
                  Application submitted. Your Rider ID is <strong>{registeredPartner.partnerId}</strong>.
                  Sign in via the Rider APK or{' '}
                  <strong>delivery.eshopy.biz</strong> to track approval and accept deliveries.
                </Alert>

                {kycNotice && (
                  <Alert
                    severity={kycNotice.type}
                    onClose={() => setKycNotice(null)}
                    sx={{ mb: 2.5, borderRadius: '6px' }}
                  >
                    {kycNotice.text}
                  </Alert>
                )}

                <Box
                  sx={{
                    p: 2,
                    mb: 3,
                    borderRadius: '6px',
                    bgcolor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isLight ? '#E2E8F0' : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    gap={1.5}
                  >
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="subtitle1" fontWeight={800}>
                          {registeredPartner.name}
                        </Typography>
                        <Chip
                          size="small"
                          label={registeredPartner.partnerId}
                          sx={{ fontWeight: 800, bgcolor: 'rgba(255,121,0,0.12)', color: '#FF7900' }}
                        />
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {registeredPartner.vehicleType.toUpperCase()} • {registeredPartner.vehicleNumber} •{' '}
                        {registeredPartner.city}, {registeredPartner.state} ({registeredPartner.pincode})
                      </Typography>
                    </Box>

                    <Chip size="small" label="Pending Admin Approval" color="warning" />
                  </Stack>
                </Box>

                {registrationToken && (
                  <>
                    <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.5 }}>
                      Upload KYC Documents (Optional now — or complete later in the Rider App)
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                      Uploading clear photos here speeds up admin verification.
                    </Typography>

                    <Stack spacing={1.25} sx={{ mb: 3 }}>
                      {requiredDocs.map((doc) => {
                        const uploadedUrl = registeredPartner.kycDocuments?.[doc.key];
                        return (
                          <Stack
                            key={doc.key}
                            direction={{ xs: 'column', sm: 'row' }}
                            justifyContent="space-between"
                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                            gap={1.5}
                            sx={{
                              p: 1.5,
                              borderRadius: '6px',
                              border: `1px solid ${isLight ? '#E5E7EB' : 'rgba(255,255,255,0.1)'}`,
                              bgcolor: isLight ? '#FAFAFA' : 'rgba(255,255,255,0.02)',
                            }}
                          >
                            <Box>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="body2" fontWeight={700}>
                                  {doc.label}
                                </Typography>
                                {uploadedUrl && <CheckIcon sx={{ fontSize: 16, color: '#10B981' }} />}
                              </Stack>
                              <Typography variant="caption" color="text.secondary">
                                {doc.hint}
                              </Typography>
                            </Box>

                            <Stack direction="row" spacing={1} alignItems="center">
                              {uploadedUrl && (
                                <Button
                                  size="small"
                                  component="a"
                                  href={uploadedUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  endIcon={<OpenIcon sx={{ fontSize: 13 }} />}
                                  sx={{ py: 0.5, px: 1, fontSize: '0.75rem' }}
                                >
                                  View
                                </Button>
                              )}
                              <Button
                                component="label"
                                size="small"
                                variant="outlined"
                                disabled={uploadingField === doc.key}
                                startIcon={
                                  uploadingField === doc.key ? (
                                    <CircularProgress size={14} />
                                  ) : (
                                    <UploadIcon />
                                  )
                                }
                                sx={{ borderRadius: '6px', py: 0.5, px: 1.5 }}
                              >
                                {uploadedUrl ? 'Replace' : 'Upload'}
                                <input
                                  type="file"
                                  accept="image/*"
                                  hidden
                                  onChange={(e) => handleUploadDoc(doc.key, e.target.files?.[0])}
                                />
                              </Button>
                            </Stack>
                          </Stack>
                        );
                      })}
                    </Stack>
                  </>
                )}

                <Divider sx={{ my: 2.5 }} />

                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ sm: 'center' }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                    <Button
                      variant="contained"
                      onClick={handleDownloadApk}
                      startIcon={<DownloadIcon />}
                      sx={{
                        bgcolor: '#172B30',
                        color: '#FFFFFF',
                        borderRadius: '6px',
                        '&:hover': { bgcolor: '#0E1C20' },
                      }}
                    >
                      Download Rider APK
                    </Button>
                    <Button
                      variant="contained"
                      component="a"
                      href={DELIVERY_PORTAL_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      endIcon={<OpenIcon fontSize="small" />}
                      sx={{
                        bgcolor: '#FF7900',
                        color: '#FFFFFF',
                        borderRadius: '6px',
                        '&:hover': { bgcolor: '#E85D04' },
                      }}
                    >
                      Continue to delivery.eshopy.biz
                    </Button>
                  </Stack>

                  <Button
                    variant="text"
                    size="small"
                    onClick={handleResetRegistration}
                    sx={{ color: 'text.secondary', alignSelf: { xs: 'flex-start', sm: 'center' } }}
                  >
                    Register another rider
                  </Button>
                </Stack>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Right Column: Rider Sign-In Portal Link + Android APK Card + Steps */}
        <Grid item xs={12} md={4}>
          <Stack spacing={2.5}>
            {/* Rider Android APK Card */}
            <Paper elevation={0} sx={cardSx}>
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}>
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: '6px',
                    bgcolor: 'rgba(16, 185, 129, 0.12)',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <AndroidIcon />
                </Box>
                <Box>
                  <Typography variant="subtitle1" fontWeight={800} lineHeight={1.2}>
                    E-Shopy Rider App
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Android APK • {releaseInfo?.appId || 'biz.eshopy.delivery'}
                  </Typography>
                </Box>
              </Stack>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Rider sign-in is available in the E-Shopy Rider Android app or on the dedicated rider portal. Install the APK to go online, receive delivery alerts, and upload proof of delivery.
              </Typography>

              <Box
                sx={{
                  p: 1.5,
                  mb: 2,
                  borderRadius: '6px',
                  bgcolor: isLight ? '#F5F6F7' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isLight ? '#E5E7EB' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Latest Version
                  </Typography>
                  <Typography variant="caption" fontWeight={700}>
                    v{releaseInfo?.versionName || '1.0.0'} (Build {releaseInfo?.versionCode || 100})
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">
                    Availability
                  </Typography>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    sx={{ color: releaseInfo?.isConfigured ? '#059669' : 'text.secondary' }}
                  >
                    {isLoadingRelease
                      ? 'Checking...'
                      : releaseInfo?.isConfigured
                        ? 'Ready for download'
                        : 'Pending release URL'}
                  </Typography>
                </Stack>
              </Box>

              {releaseInfo?.releaseNotes && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Release notes: {releaseInfo.releaseNotes}
                </Typography>
              )}

              <Stack spacing={1.25}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleDownloadApk}
                  disabled={isLoadingRelease}
                  startIcon={<DownloadIcon />}
                  sx={{
                    bgcolor: '#FF7900',
                    color: '#FFFFFF',
                    borderRadius: '6px',
                    '&:hover': { bgcolor: '#E85D04' },
                  }}
                >
                  Download Rider APK
                </Button>

                <Button
                  fullWidth
                  variant="outlined"
                  component="a"
                  href={DELIVERY_PORTAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  endIcon={<OpenIcon fontSize="small" />}
                  sx={{
                    borderColor: isLight ? '#D1D5DB' : 'rgba(255,255,255,0.22)',
                    color: isLight ? '#172B30' : '#F8FAFC',
                    borderRadius: '6px',
                    '&:hover': { borderColor: '#FF7900', color: '#FF7900' },
                  }}
                >
                  Open delivery.eshopy.biz
                </Button>
              </Stack>
            </Paper>

            {/* Onboarding Process */}
            <Paper elevation={0} sx={cardSx}>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5 }}>
                Onboarding Steps
              </Typography>
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="body2" fontWeight={700}>
                    1. Submit application here
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Enter your mobile number, vehicle details, and service pincodes to generate your Rider ID.
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" fontWeight={700}>
                    2. Install Rider APK or open delivery.eshopy.biz
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Rider login, KYC document management, and status tracking happen in the Rider App or at{' '}
                    <strong>delivery.eshopy.biz</strong> (not on the shopping site).
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" fontWeight={700}>
                    3. Admin verification & go online
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Once Admin verifies your Driving License, RC, and Government ID, sign in with your Mobile Number or Rider ID to accept deliveries.
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
