import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Android as AndroidIcon,
  CheckCircle as VerifiedIcon,
  Download as DownloadIcon,
  Logout as LogoutIcon,
  OpenInNew as OpenIcon,
  Save as SaveIcon,
  UploadFile as UploadIcon,
} from '@mui/icons-material';
import type { DeliveryVehicleType } from '@ornate/types';
import api from '../api/client';
import { useDeliveryAuthStore } from '../store/auth.store';
import { useAppReleaseUpdater } from '../hooks/useAppReleaseUpdater';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { partner, updatePartnerProfile, clearAuth } = useDeliveryAuthStore();
  const updater = useAppReleaseUpdater();

  const [name, setName] = useState(partner?.name || '');
  const [vehicleType, setVehicleType] = useState<DeliveryVehicleType>(partner?.vehicleType || 'bike');
  const [vehicleNumber, setVehicleNumber] = useState(partner?.vehicleNumber || '');
  const [servicePincodes, setServicePincodes] = useState((partner?.servicePincodes || []).join(', '));
  const [licenseNumber, setLicenseNumber] = useState(partner?.kycDocuments?.drivingLicenseNumber || '');
  const [accountHolderName, setAccountHolderName] = useState(partner?.bankDetails?.accountHolderName || '');
  const [accountNumber, setAccountNumber] = useState(partner?.bankDetails?.accountNumber || '');
  const [ifscCode, setIfscCode] = useState(partner?.bankDetails?.ifscCode || '');
  const [upiId, setUpiId] = useState(partner?.bankDetails?.upiId || '');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isBicycle = vehicleType === 'bicycle';
  const kycStatus = partner?.kycStatus || 'unverified';

  const requiredDocs = isBicycle
    ? [{ key: 'idProofUrl' as const, label: 'Government ID Proof (Aadhaar / PAN / Voter ID)' }]
    : [
        { key: 'drivingLicenseUrl' as const, label: 'Driving License Photo' },
        { key: 'vehicleRcUrl' as const, label: 'Vehicle RC Photo' },
        { key: 'idProofUrl' as const, label: 'Government ID Proof' },
      ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      const resp = await api.patch('/delivery/me', {
        name: name.trim(),
        vehicleType,
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        servicePincodes,
        kycDocuments: { drivingLicenseNumber: licenseNumber.trim() },
        bankDetails: {
          accountHolderName: accountHolderName.trim(),
          accountNumber: accountNumber.trim(),
          ifscCode: ifscCode.trim().toUpperCase(),
          upiId: upiId.trim(),
        },
      });
      if (resp.data?.success && resp.data.data) {
        updatePartnerProfile(resp.data.data);
        setMessage({ type: 'success', text: 'Partner profile & bank details saved.' });
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setMessage({
        type: 'error',
        text: axiosErr.response?.data?.error?.message || 'Failed to update profile.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadDoc = async (docType: 'drivingLicenseUrl' | 'vehicleRcUrl' | 'idProofUrl', file?: File) => {
    if (!file) return;
    setUploadingField(docType);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('docType', docType);
      formData.append('file', file);
      const resp = await api.post('/delivery/me/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (resp.data?.success && resp.data.data?.partner) {
        updatePartnerProfile(resp.data.data.partner);
        setMessage({ type: 'success', text: 'KYC document uploaded successfully.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Could not upload document.' });
    } finally {
      setUploadingField(null);
    }
  };

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 0.5 }}>
        Partner Profile & KYC
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Rider ID: <strong>{partner?.partnerId}</strong> • Mobile: <strong>{partner?.mobileNumber}</strong>
      </Typography>

      {message && (
        <Alert severity={message.type} onClose={() => setMessage(null)} sx={{ mb: 2.5 }}>
          {message.text}
        </Alert>
      )}

      {/* Overall Verification Banner */}
      <Paper
        elevation={0}
        sx={{
          p: 2.25,
          mb: 2.5,
          borderRadius: 3,
          border: `1px solid ${kycStatus === 'verified' ? '#86EFAC' : '#FDE68A'}`,
          bgcolor: kycStatus === 'verified' ? '#F0FDF4' : '#FFFBEB',
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <VerifiedIcon sx={{ color: kycStatus === 'verified' ? '#16A34A' : '#D97706' }} />
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                Verification Status: {kycStatus.replace('_', ' ').toUpperCase()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {kycStatus === 'verified'
                  ? 'You are fully verified and eligible to go Online with live GPS.'
                  : kycStatus === 'submitted'
                    ? 'All required KYC documents uploaded. Waiting for Admin verification.'
                    : kycStatus === 'rejected'
                      ? `Rejected: ${partner?.kycRejectionReason || 'Re-upload valid documents below.'}`
                      : 'Upload all required KYC documents (and save License #) so Admin can verify your account.'}
              </Typography>
            </Box>
          </Stack>
          <Chip
            size="small"
            label={kycStatus === 'verified' ? 'FULLY VERIFIED' : kycStatus.toUpperCase()}
            color={kycStatus === 'verified' ? 'success' : kycStatus === 'rejected' ? 'error' : 'warning'}
            sx={{ fontWeight: 800 }}
          />
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: { xs: 2.25, sm: 3 }, border: '1px solid #E2E8F0', borderRadius: 3, mb: 2.5 }}>
        <Box component="form" onSubmit={handleSave}>
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            Vehicle & Service Zone
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label="Vehicle Type"
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value as DeliveryVehicleType)}
              >
                <MenuItem value="bike">Motorbike</MenuItem>
                <MenuItem value="scooter">Scooter / EV</MenuItem>
                <MenuItem value="bicycle">Bicycle</MenuItem>
                <MenuItem value="car">Car</MenuItem>
                <MenuItem value="van">Delivery Van</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Vehicle Number"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required={!isBicycle}
                label="Driving License Number"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value.toUpperCase())}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Serviceable Pincodes"
                value={servicePincodes}
                onChange={(e) => setServicePincodes(e.target.value)}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            Payout Bank / UPI Details
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Account Holder Name"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Bank Account Number"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="IFSC Code"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="UPI ID"
                placeholder="name@upi"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
              />
            </Grid>
          </Grid>

          <Button
            type="submit"
            variant="contained"
            disabled={isSaving}
            startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            sx={{ mt: 3 }}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ p: { xs: 2.25, sm: 3 }, border: '1px solid #E2E8F0', borderRadius: 3, mb: 2.5 }}>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          KYC Document Uploads
        </Typography>
        <Stack spacing={1.5}>
          {requiredDocs.map((doc) => {
            const url = partner?.kycDocuments?.[doc.key];
            return (
              <Stack
                key={doc.key}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                flexWrap="wrap"
                gap={1}
                sx={{ p: 1.5, bgcolor: '#F8FAFC', borderRadius: 2, border: '1px solid #E2E8F0' }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {doc.label}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    <Chip
                      size="small"
                      label={url ? 'Uploaded' : 'Required'}
                      color={url ? 'success' : 'warning'}
                      sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}
                    />
                    {url && (
                      <Button
                        size="small"
                        component="a"
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        endIcon={<OpenIcon sx={{ fontSize: 13 }} />}
                        sx={{ minHeight: 24, py: 0, px: 0.5, fontSize: '0.72rem' }}
                      >
                        View
                      </Button>
                    )}
                  </Stack>
                </Box>
                <Button
                  component="label"
                  size="small"
                  variant="outlined"
                  disabled={uploadingField === doc.key}
                  startIcon={uploadingField === doc.key ? <CircularProgress size={14} /> : <UploadIcon />}
                >
                  {url ? 'Replace' : 'Upload'}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => handleUploadDoc(doc.key, e.target.files?.[0])}
                  />
                </Button>
              </Stack>
            );
          })}
        </Stack>
      </Paper>

      {/* Android App Download / Version Card */}
      <Paper elevation={0} sx={{ p: { xs: 2.25, sm: 3 }, border: '1px solid #E2E8F0', borderRadius: 3, mb: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <AndroidIcon sx={{ color: '#10B981' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                E-Shopy Rider Android App
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {updater.isNative
                ? `Installed: v${updater.installedVersion} (Build ${updater.installedBuild}) • Latest: v${updater.releaseInfo?.versionName || '1.0.0'}`
                : `Latest APK Release: v${updater.releaseInfo?.versionName || '1.0.0'} (${updater.releaseInfo?.isConfigured ? 'Ready to download' : 'Download URL not configured yet'})`}
            </Typography>
          </Box>
          {updater.isNative ? (
            <Button
              size="small"
              variant={updater.hasNativeUpdate ? 'contained' : 'outlined'}
              startIcon={<DownloadIcon />}
              onClick={() => (updater.hasNativeUpdate ? updater.openDownload() : updater.refetch())}
            >
              {updater.hasNativeUpdate ? `Update v${updater.releaseInfo?.versionName}` : 'Check Updates'}
            </Button>
          ) : (
            <Button
              size="small"
              variant="contained"
              disabled={!updater.releaseInfo?.isConfigured}
              startIcon={<DownloadIcon />}
              onClick={() => updater.openDownload()}
            >
              Download APK
            </Button>
          )}
        </Stack>
      </Paper>

      <Button
        fullWidth
        variant="outlined"
        color="error"
        startIcon={<LogoutIcon />}
        onClick={handleLogout}
      >
        Sign Out of Delivery App
      </Button>
    </Box>
  );
}
