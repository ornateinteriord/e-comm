import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Android as AndroidIcon,
  Block as SuspendedIcon,
  CheckCircle as ActiveIcon,
  CurrencyRupee as SettleIcon,
  Delete as DeleteIcon,
  HourglassTop as PendingIcon,
  Map as MapViewIcon,
  OpenInNew as OpenIcon,
  Search as SearchIcon,
  TableChart as TableViewIcon,
  TwoWheeler as BikeIcon,
  VerifiedUser as KycIcon,
} from '@mui/icons-material';
import maplibregl from 'maplibre-gl';
import type { DeliveryAppReleaseInfo, DeliveryPartnerProfile, DeliveryVehicleType } from '@ornate/types';
import api from '../api/client';

export default function DeliveryPartnersPage() {
  const [partners, setPartners] = useState<DeliveryPartnerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Add Partner Dialog
  const [openAddModal, setOpenAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [vehicleType, setVehicleType] = useState<DeliveryVehicleType>('bike');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [drivingLicenseNumber, setDrivingLicenseNumber] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [stateName, setStateName] = useState('Karnataka');
  const [pincode, setPincode] = useState('560001');
  const [servicePincodes, setServicePincodes] = useState('560001, 560002');
  const [verifyKycOnCreate, setVerifyKycOnCreate] = useState(false);

  // KYC Review Dialog
  const [kycPartner, setKycPartner] = useState<DeliveryPartnerProfile | null>(null);
  const [kycRejectReason, setKycRejectReason] = useState('');
  const [isUpdatingKyc, setIsUpdatingKyc] = useState(false);

  // Android APK Release Settings Dialog
  const [openReleaseModal, setOpenReleaseModal] = useState(false);
  const [releaseForm, setReleaseForm] = useState({
    versionName: '1.0.0',
    versionCode: '100',
    minSupportedVersionCode: '100',
    apkUrl: '',
    playStoreUrl: '',
    releaseNotes: '',
    forceUpdate: false,
  });
  const [isSavingRelease, setIsSavingRelease] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const loadPartners = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      const resp = await api.get(`/admin/delivery-partners?${params.toString()}`);
      if (resp.data?.success) {
        setPartners(resp.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load delivery partners', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPartners();
  }, [search, statusFilter]);

  useEffect(() => {
    if (viewMode !== 'map' || !mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      center: [77.5946, 12.9716],
      zoom: 5,
    });
    map.addControl(new maplibregl.NavigationControl({}), 'top-right');
    mapRef.current = map;

    const bounds = new maplibregl.LngLatBounds();
    let hasCoords = false;

    partners.forEach((p) => {
      const lat = p.currentLocation?.lat;
      const lng = p.currentLocation?.lng;
      if (typeof lat !== 'number' || typeof lng !== 'number') return;

      hasCoords = true;
      bounds.extend([lng, lat]);

      const el = document.createElement('div');
      el.style.cssText = `width:32px;height:32px;border-radius:50%;border:2px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.25);cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:11px;background:${
        p.availabilityStatus === 'on_delivery'
          ? '#2563EB'
          : p.availabilityStatus === 'online'
            ? '#10B981'
            : '#64748B'
      };`;
      el.textContent = p.partnerId.slice(-2);

      new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(
          new maplibregl.Popup({ offset: 20 }).setHTML(
            `<strong>${p.name}</strong> (${p.partnerId})<br/>Status: ${p.availabilityStatus}<br/>KYC: ${p.kycStatus || 'unverified'}`,
          ),
        )
        .addTo(map);
    });

    if (hasCoords) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [viewMode, partners]);

  const handleOpenReleaseModal = async () => {
    setOpenReleaseModal(true);
    try {
      const resp = await api.get('/admin/delivery-app-release');
      if (resp.data?.success && resp.data.data) {
        const d = resp.data.data as DeliveryAppReleaseInfo;
        setReleaseForm({
          versionName: d.versionName || '1.0.0',
          versionCode: String(d.versionCode ?? 100),
          minSupportedVersionCode: String(d.minSupportedVersionCode ?? 100),
          apkUrl: d.apkUrl || '',
          playStoreUrl: d.playStoreUrl || '',
          releaseNotes: d.releaseNotes || '',
          forceUpdate: Boolean(d.forceUpdate),
        });
      }
    } catch {
      // keep defaults
    }
  };

  const handleSaveReleaseSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingRelease(true);
    try {
      const resp = await api.put('/admin/delivery-app-release', {
        versionName: releaseForm.versionName.trim(),
        versionCode: Number(releaseForm.versionCode) || 100,
        minSupportedVersionCode: Number(releaseForm.minSupportedVersionCode) || 100,
        apkUrl: releaseForm.apkUrl.trim(),
        playStoreUrl: releaseForm.playStoreUrl.trim(),
        releaseNotes: releaseForm.releaseNotes.trim(),
        forceUpdate: releaseForm.forceUpdate,
      });
      if (resp.data?.success) {
        setToast({ open: true, message: 'Android APK release link saved!', severity: 'success' });
        setOpenReleaseModal(false);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setToast({
        open: true,
        message: axiosErr.response?.data?.error?.message || 'Failed to save release settings.',
        severity: 'error',
      });
    } finally {
      setIsSavingRelease(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await api.patch(`/admin/delivery-partners/${id}/status`, { status });
      setToast({ open: true, message: `Partner status updated to ${status}.`, severity: 'success' });
      loadPartners();
    } catch {
      setToast({ open: true, message: 'Failed to update partner status.', severity: 'error' });
    }
  };

  const handleUpdateKyc = async (kycStatus: 'verified' | 'rejected') => {
    if (!kycPartner) return;
    if (kycStatus === 'rejected' && !kycRejectReason.trim()) {
      setToast({ open: true, message: 'Please enter a reason to reject KYC.', severity: 'error' });
      return;
    }
    setIsUpdatingKyc(true);
    try {
      await api.patch(`/admin/delivery-partners/${kycPartner.id}/kyc`, {
        kycStatus,
        reason: kycStatus === 'rejected' ? kycRejectReason.trim() : undefined,
      });
      setToast({
        open: true,
        message: kycStatus === 'verified' ? 'Partner KYC verified & approved!' : 'Partner KYC rejected.',
        severity: 'success',
      });
      setKycPartner(null);
      setKycRejectReason('');
      loadPartners();
    } catch {
      setToast({ open: true, message: 'Failed to update KYC status.', severity: 'error' });
    } finally {
      setIsUpdatingKyc(false);
    }
  };

  const handleSettleCod = async (partner: DeliveryPartnerProfile) => {
    if (!window.confirm(`Confirm COD cash deposit of ₹${(partner.cashInHandPaise / 100).toFixed(2)} from ${partner.name}?`)) {
      return;
    }
    try {
      const resp = await api.post(`/admin/delivery-partners/${partner.id}/settle-cod`, {
        amountPaise: partner.cashInHandPaise,
      });
      setToast({
        open: true,
        message: resp.data?.message || 'COD balance settled.',
        severity: 'success',
      });
      loadPartners();
    } catch {
      setToast({ open: true, message: 'Failed to settle COD balance.', severity: 'error' });
    }
  };

  const handleDeletePartner = async (id: string, partnerName: string) => {
    if (!window.confirm(`Delete delivery partner "${partnerName}"?`)) return;
    try {
      await api.delete(`/admin/delivery-partners/${id}`);
      setToast({ open: true, message: 'Delivery partner deleted.', severity: 'success' });
      loadPartners();
    } catch {
      setToast({ open: true, message: 'Failed to delete partner.', severity: 'error' });
    }
  };

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setIsSubmitting(true);
    try {
      const resp = await api.post('/admin/delivery-partners', {
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
        verifyKyc: verifyKycOnCreate,
      });
      if (resp.data?.success) {
        setOpenAddModal(false);
        setName('');
        setMobileNumber('');
        setEmail('');
        setPassword('');
        setVehicleNumber('');
        setDrivingLicenseNumber('');
        setVerifyKycOnCreate(false);
        setToast({ open: true, message: 'Delivery partner created!', severity: 'success' });
        loadPartners();
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setModalError(axiosErr.response?.data?.error?.message || 'Failed to create delivery partner.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onlineCount = partners.filter(
    (p) => p.availabilityStatus === 'online' || p.availabilityStatus === 'on_delivery',
  ).length;
  const pendingKycCount = partners.filter((p) => p.kycStatus !== 'verified').length;
  const totalCodCash = partners.reduce((sum, p) => sum + (p.cashInHandPaise || 0), 0);

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
            Delivery Partners & Fleet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Verify rider KYC documents, manage APK release links, monitor GPS status, and reconcile COD cash
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.25} flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<AndroidIcon />}
            onClick={handleOpenReleaseModal}
            sx={{ fontWeight: 700, borderColor: '#10B981', color: '#047857' }}
          >
            APK Release Link
          </Button>

          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_e, val) => val && setViewMode(val)}
            size="small"
            sx={{ bgcolor: '#fff' }}
          >
            <ToggleButton value="table" sx={{ fontWeight: 700 }}>
              <TableViewIcon fontSize="small" sx={{ mr: 0.5 }} /> Table
            </ToggleButton>
            <ToggleButton value="map" sx={{ fontWeight: 700 }}>
              <MapViewIcon fontSize="small" sx={{ mr: 0.5 }} /> Map
            </ToggleButton>
          </ToggleButtonGroup>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenAddModal(true)}
            sx={{ bgcolor: '#FF7900', '&:hover': { bgcolor: '#E85D04' }, fontWeight: 700 }}
          >
            Add Rider
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>TOTAL FLEET</Typography>
            <Typography variant="h5" fontWeight={900}>{partners.length}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>ONLINE / ON TRIP</Typography>
            <Typography variant="h5" fontWeight={900} color="success.main">{onlineCount}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>KYC PENDING</Typography>
            <Typography variant="h5" fontWeight={900} color="warning.main">{pendingKycCount}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>COD CASH IN HAND</Typography>
            <Typography variant="h5" fontWeight={900} color="primary.main">
              ₹{(totalCodCash / 100).toLocaleString('en-IN')}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper elevation={0} sx={{ p: 2, mb: 2.5, border: '1px solid #e2e8f0', borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by Partner ID, name, mobile, vehicle, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            select
            size="small"
            label="Account Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All Statuses</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="pending_approval">Pending Approval</MenuItem>
            <MenuItem value="suspended">Suspended</MenuItem>
          </TextField>
        </Stack>
      </Paper>

      {viewMode === 'map' ? (
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 2 }}>
          <Box ref={mapContainerRef} sx={{ width: '100%', height: 480, borderRadius: 2 }} />
        </Paper>
      ) : (
        <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
          {isLoading ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Partner</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Vehicle & Zone</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>KYC</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Duty</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Account</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>COD Cash</TableCell>
                    <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {partners.map((p) => {
                    const kyc = p.kycStatus || 'unverified';
                    return (
                      <TableRow key={p.id} hover>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight={800}>
                            {p.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {p.partnerId} • +91 {p.mobileNumber}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={700} sx={{ textTransform: 'uppercase' }}>
                            {p.vehicleType} • {p.vehicleNumber}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {p.city} ({p.pincode})
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            icon={<KycIcon sx={{ fontSize: '14px !important' }} />}
                            label={kyc.toUpperCase()}
                            onClick={() => {
                              setKycPartner(p);
                              setKycRejectReason(p.kycRejectionReason || '');
                            }}
                            color={
                              kyc === 'verified'
                                ? 'success'
                                : kyc === 'rejected'
                                  ? 'error'
                                  : kyc === 'submitted'
                                    ? 'info'
                                    : 'warning'
                            }
                            sx={{ fontWeight: 800, fontSize: 10, cursor: 'pointer' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={p.availabilityStatus.replace('_', ' ').toUpperCase()}
                            sx={{
                              fontWeight: 800,
                              fontSize: 10,
                              bgcolor:
                                p.availabilityStatus === 'on_delivery'
                                  ? '#EFF6FF'
                                  : p.availabilityStatus === 'online'
                                    ? '#ECFDF5'
                                    : '#F1F5F9',
                              color:
                                p.availabilityStatus === 'on_delivery'
                                  ? '#1D4ED8'
                                  : p.availabilityStatus === 'online'
                                    ? '#047857'
                                    : '#64748B',
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            icon={
                              p.status === 'active' ? (
                                <ActiveIcon sx={{ fontSize: '14px !important' }} />
                              ) : p.status === 'suspended' ? (
                                <SuspendedIcon sx={{ fontSize: '14px !important' }} />
                              ) : (
                                <PendingIcon sx={{ fontSize: '14px !important' }} />
                              )
                            }
                            label={p.status.replace('_', ' ').toUpperCase()}
                            color={
                              p.status === 'active' ? 'success' : p.status === 'suspended' ? 'error' : 'warning'
                            }
                            sx={{ fontWeight: 800, fontSize: 10 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" fontWeight={800} color={p.cashInHandPaise > 0 ? 'warning.dark' : 'text.secondary'}>
                              ₹{((p.cashInHandPaise || 0) / 100).toFixed(0)}
                            </Typography>
                            {p.cashInHandPaise > 0 && (
                              <Tooltip title="Mark COD Cash Deposited / Settled">
                                <IconButton size="small" color="primary" onClick={() => handleSettleCod(p)}>
                                  <SettleIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ textAlign: 'right' }}>
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                setKycPartner(p);
                                setKycRejectReason(p.kycRejectionReason || '');
                              }}
                              sx={{ fontSize: '0.7rem', py: 0.25 }}
                            >
                              KYC
                            </Button>
                            {p.status !== 'active' && (
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                onClick={() => handleStatusChange(p.id, 'active')}
                                sx={{ fontSize: '0.7rem', py: 0.25 }}
                              >
                                Approve
                              </Button>
                            )}
                            {p.status === 'active' && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="warning"
                                onClick={() => handleStatusChange(p.id, 'suspended')}
                                sx={{ fontSize: '0.7rem', py: 0.25 }}
                              >
                                Suspend
                              </Button>
                            )}
                            <IconButton size="small" color="error" onClick={() => handleDeletePartner(p.id, p.name)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* KYC Review Modal */}
      <Dialog open={Boolean(kycPartner)} onClose={() => !isUpdatingKyc && setKycPartner(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <KycIcon color="primary" />
          Review Rider KYC — {kycPartner?.name} ({kycPartner?.partnerId})
        </DialogTitle>
        <DialogContent dividers>
          {kycPartner && (
            <Stack spacing={2}>
              <Alert severity={kycPartner.kycStatus === 'verified' ? 'success' : 'info'}>
                Vehicle: <strong style={{ textTransform: 'uppercase' }}>{kycPartner.vehicleType}</strong> ({kycPartner.vehicleNumber}) •
                Driving License #: <strong>{kycPartner.kycDocuments?.drivingLicenseNumber || 'Not provided'}</strong>
              </Alert>

              {[
                { label: 'Driving License Photo', url: kycPartner.kycDocuments?.drivingLicenseUrl },
                { label: 'Vehicle RC Photo', url: kycPartner.kycDocuments?.vehicleRcUrl },
                { label: 'Government ID Proof', url: kycPartner.kycDocuments?.idProofUrl },
              ].map((doc) => (
                <Paper
                  key={doc.label}
                  elevation={0}
                  sx={{ p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#f8fafc' }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" fontWeight={700}>
                      {doc.label}
                    </Typography>
                    {doc.url ? (
                      <Button
                        size="small"
                        component="a"
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        endIcon={<OpenIcon fontSize="small" />}
                      >
                        View Document
                      </Button>
                    ) : (
                      <Chip size="small" label="Not Uploaded" color="warning" />
                    )}
                  </Stack>
                </Paper>
              ))}

              <TextField
                fullWidth
                size="small"
                label="Rejection Reason (Required only if rejecting)"
                value={kycRejectReason}
                onChange={(e) => setKycRejectReason(e.target.value)}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setKycPartner(null)} disabled={isUpdatingKyc}>
            Close
          </Button>
          <Button
            color="error"
            variant="outlined"
            disabled={isUpdatingKyc}
            onClick={() => handleUpdateKyc('rejected')}
          >
            Reject KYC
          </Button>
          <Button
            color="success"
            variant="contained"
            disabled={isUpdatingKyc}
            onClick={() => handleUpdateKyc('verified')}
          >
            Verify KYC
          </Button>
        </DialogActions>
      </Dialog>

      {/* Android APK Release Link Modal */}
      <Dialog open={openReleaseModal} onClose={() => !isSavingRelease && setOpenReleaseModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AndroidIcon sx={{ color: '#10B981' }} />
          Rider Android APK Release & Redirect Settings
        </DialogTitle>
        <Box component="form" onSubmit={handleSaveReleaseSettings}>
          <DialogContent dividers>
            <Stack spacing={2}>
              <Alert severity="info">
                Paste your <strong>GitHub Releases</strong> or <strong>Cloudflare R2</strong> APK URL below.
                The rider app download endpoint (<code>/api/v1/delivery/app-download</code>) will automatically redirect browsers & in-app updaters to this link.
              </Alert>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    required
                    size="small"
                    label="Version Name"
                    placeholder="1.0.1"
                    value={releaseForm.versionName}
                    onChange={(e) => setReleaseForm((f) => ({ ...f, versionName: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    required
                    type="number"
                    size="small"
                    label="Version Code"
                    value={releaseForm.versionCode}
                    onChange={(e) => setReleaseForm((f) => ({ ...f, versionCode: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    required
                    type="number"
                    size="small"
                    label="Min Supported Build"
                    value={releaseForm.minSupportedVersionCode}
                    onChange={(e) => setReleaseForm((f) => ({ ...f, minSupportedVersionCode: e.target.value }))}
                  />
                </Grid>
              </Grid>
              <TextField
                fullWidth
                size="small"
                label="Direct APK Download URL (GitHub Release / Cloudflare R2)"
                placeholder="https://github.com/.../releases/download/v1.0.0/eshopy-rider.apk"
                value={releaseForm.apkUrl}
                onChange={(e) => setReleaseForm((f) => ({ ...f, apkUrl: e.target.value }))}
              />
              <TextField
                fullWidth
                size="small"
                label="Google Play Store URL (Optional)"
                placeholder="https://play.google.com/store/apps/details?id=biz.eshopy.delivery"
                value={releaseForm.playStoreUrl}
                onChange={(e) => setReleaseForm((f) => ({ ...f, playStoreUrl: e.target.value }))}
              />
              <TextField
                fullWidth
                multiline
                rows={2}
                size="small"
                label="Release Notes"
                value={releaseForm.releaseNotes}
                onChange={(e) => setReleaseForm((f) => ({ ...f, releaseNotes: e.target.value }))}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={releaseForm.forceUpdate}
                    onChange={(e) => setReleaseForm((f) => ({ ...f, forceUpdate: e.target.checked }))}
                  />
                }
                label="Force update (block older APK builds until updated)"
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setOpenReleaseModal(false)} disabled={isSavingRelease}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={isSavingRelease} sx={{ bgcolor: '#FF7900' }}>
              {isSavingRelease ? 'Saving...' : 'Save APK Release Link'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Create Delivery Partner Modal */}
      <Dialog open={openAddModal} onClose={() => setOpenAddModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <BikeIcon sx={{ color: '#FF7900' }} />
          Add Delivery Partner
        </DialogTitle>
        <Box component="form" onSubmit={handleCreatePartner}>
          <DialogContent dividers>
            {modalError && <Alert severity="error" sx={{ mb: 2 }}>{modalError}</Alert>}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required size="small" label="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required size="small" label="Mobile Number" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required size="small" type="password" label="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Vehicle Type"
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value as DeliveryVehicleType)}
                >
                  <MenuItem value="bike">Bike</MenuItem>
                  <MenuItem value="scooter">Scooter</MenuItem>
                  <MenuItem value="bicycle">Bicycle</MenuItem>
                  <MenuItem value="car">Car</MenuItem>
                  <MenuItem value="van">Van</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required size="small" label="Vehicle Number" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" label="Driving License #" value={drivingLicenseNumber} onChange={(e) => setDrivingLicenseNumber(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required size="small" label="City" value={city} onChange={(e) => setCity(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required size="small" label="State" value={stateName} onChange={(e) => setStateName(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required size="small" label="Base Pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="Service Pincodes (comma separated)" value={servicePincodes} onChange={(e) => setServicePincodes(e.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={verifyKycOnCreate}
                      onChange={(e) => setVerifyKycOnCreate(e.target.checked)}
                    />
                  }
                  label="Mark KYC Verified immediately (Admin override)"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setOpenAddModal(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={isSubmitting} sx={{ bgcolor: '#FF7900' }}>
              {isSubmitting ? 'Creating...' : 'Create Rider'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={4000} onClose={() => setToast((t) => ({ ...t, open: false }))}>
        <Alert severity={toast.severity} onClose={() => setToast((t) => ({ ...t, open: false }))}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
