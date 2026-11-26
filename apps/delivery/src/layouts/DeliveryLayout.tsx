import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, Link as RouterLink } from 'react-router';
import {
  Alert,
  AppBar,
  Avatar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Switch,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  AccountBalanceWallet as EarningsIcon,
  Android as AndroidIcon,
  DirectionsBike as ActiveTripIcon,
  Download as DownloadIcon,
  GpsFixed as GpsIcon,
  GpsOff as GpsOffIcon,
  Inventory2 as OrdersIcon,
  Logout as LogoutIcon,
  Person as ProfileIcon,
  SystemUpdateAlt as UpdateIcon,
  VerifiedUser as KycIcon,
  WifiOff as OfflineIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import type { DeliveryAssignment, DeliveryPartnerProfile } from '@ornate/types';
import api from '../api/client';
import { useDeliveryAuthStore } from '../store/auth.store';
import { useGeolocationSync } from '../hooks/useGeolocationSync';
import { useAppReleaseUpdater } from '../hooks/useAppReleaseUpdater';
import DeliveryPendingActivationView from '../components/auth/DeliveryPendingActivationView';

const DRAWER_WIDTH = 250;

const NAV_ITEMS = [
  { label: 'Orders', path: '/', icon: <OrdersIcon /> },
  { label: 'Active Trip', path: '/active', icon: <ActiveTripIcon /> },
  { label: 'Earnings', path: '/earnings', icon: <EarningsIcon /> },
  { label: 'Profile', path: '/profile', icon: <ProfileIcon /> },
];

export default function DeliveryLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();
  const navigate = useNavigate();
  const { partner, isAuthenticated, updatePartnerProfile, clearAuth } = useDeliveryAuthStore();
  const [isTogglingDuty, setIsTogglingDuty] = useState(false);
  const [dutyError, setDutyError] = useState<string | null>(null);
  const [apkInfoDialogOpen, setApkInfoDialogOpen] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [isOnlineNet, setIsOnlineNet] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  const updater = useAppReleaseUpdater();

  // Keep partner profile (status, kycStatus, cashInHand) synced live from auth-service
  const { data: livePartner } = useQuery<DeliveryPartnerProfile | null>({
    queryKey: ['delivery-me'],
    queryFn: async () => {
      const resp = await api.get('/delivery/me');
      return resp.data?.data || null;
    },
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (livePartner) {
      updatePartnerProfile(livePartner);
    }
  }, [livePartner, updatePartnerProfile]);

  const { data: activeAssignments } = useQuery<DeliveryAssignment[]>({
    queryKey: ['delivery-active-assignments'],
    queryFn: async () => {
      const resp = await api.get('/delivery/assignments?scope=active');
      return resp.data?.data?.items || [];
    },
    enabled: partner?.status === 'active',
    refetchInterval: 20_000,
  });

  const primaryActiveAssignment = activeAssignments?.[0];
  const geo = useGeolocationSync(primaryActiveAssignment?.id || null);

  useEffect(() => {
    const onOnline = () => setIsOnlineNet(true);
    const onOffline = () => setIsOnlineNet(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (partner && (partner.status !== 'active' || !partner.isActive)) {
    return <DeliveryPendingActivationView />;
  }

  const isKycVerified = partner?.kycStatus === 'verified';
  const isFullyVerified =
    partner?.status === 'active' && Boolean(partner?.isActive) && isKycVerified;
  const isOnDuty =
    partner?.availabilityStatus === 'online' || partner?.availabilityStatus === 'on_delivery';
  const canToggleOnline =
    isFullyVerified && geo.isGpsReady && partner?.availabilityStatus !== 'on_delivery';

  const handleToggleDuty = async (checked: boolean) => {
    setDutyError(null);

    if (checked) {
      if (!isKycVerified) {
        setDutyError('Complete KYC document uploads and admin verification before going online.');
        return;
      }
      if (!geo.isGpsReady) {
        const freshCoords = await geo.pingNow();
        if (!freshCoords) {
          setDutyError('Live GPS is required to go online. Enable location services and retry.');
          return;
        }
      }
    }

    setIsTogglingDuty(true);
    try {
      const targetStatus = checked ? 'online' : 'offline';
      const coords = checked ? geo.coords || (await geo.pingNow()) : null;
      if (checked && !coords) {
        setDutyError('GPS fix could not be obtained. Cannot switch online while GPS is off.');
        return;
      }

      const resp = await api.patch('/delivery/me/availability', {
        availabilityStatus: targetStatus,
        lat: coords?.lat,
        lng: coords?.lng,
      });
      if (resp.data?.success && resp.data.data) {
        updatePartnerProfile(resp.data.data);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setDutyError(
        axiosErr.response?.data?.error?.message || 'Unable to change duty status right now.',
      );
    } finally {
      setIsTogglingDuty(false);
    }
  };

  const handleDownloadApkClick = async () => {
    if (updater.releaseInfo?.isConfigured) {
      await updater.openDownload();
    } else {
      setApkInfoDialogOpen(true);
    }
  };

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const activeNavIndex = Math.max(
    0,
    NAV_ITEMS.findIndex((item) =>
      item.path === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(item.path) ||
          (item.path === '/active' && location.pathname.startsWith('/deliveries/')),
    ),
  );

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#0F172A', color: '#F8FAFC' }}>
      <Toolbar sx={{ px: 3, py: 2 }}>
        <Box
          component="img"
          src="/logo-dark.svg"
          alt="E-Shopy"
          sx={{ height: 32, width: 'auto', maxWidth: 160, objectFit: 'contain' }}
        />
      </Toolbar>

      <Box sx={{ px: 2, py: 1.5, mx: 1.5, my: 1, borderRadius: 2, bgcolor: '#1E293B', border: '1px solid #334155' }}>
        <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, letterSpacing: '0.05em' }}>
          DELIVERY PARTNER
        </Typography>
        <Typography noWrap variant="subtitle2" sx={{ color: '#FFFFFF', fontWeight: 800 }}>
          {partner?.name}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }}>
          <Chip
            label={partner?.partnerId || 'DLV'}
            size="small"
            sx={{ bgcolor: '#FF7900', color: '#fff', fontWeight: 800, fontSize: '0.7rem', height: 20 }}
          />
          <Chip
            label={isKycVerified ? 'KYC VERIFIED' : 'KYC PENDING'}
            size="small"
            sx={{
              bgcolor: isKycVerified ? '#065F46' : '#92400E',
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.65rem',
              height: 20,
            }}
          />
        </Stack>
      </Box>

      <Divider sx={{ borderColor: '#1E293B' }} />

      <List sx={{ px: 1.5, py: 2, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isSelected =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path) ||
                (item.path === '/active' && location.pathname.startsWith('/deliveries/'));
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.75 }}>
              <ListItemButton
                component={RouterLink}
                to={item.path}
                sx={{
                  borderRadius: 2,
                  py: 1.25,
                  bgcolor: isSelected ? '#FF7900' : 'transparent',
                  color: isSelected ? '#FFFFFF' : '#CBD5E1',
                  '&:hover': {
                    bgcolor: isSelected ? '#E85D04' : 'rgba(255,255,255,0.08)',
                    color: '#FFFFFF',
                  },
                }}
              >
                <ListItemIcon sx={{ color: isSelected ? '#FFFFFF' : '#94A3B8', minWidth: 38 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontWeight: isSelected ? 800 : 600, fontSize: '0.9rem' }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: '#1E293B' }} />
      <Box sx={{ p: 2 }}>
        <Button
          fullWidth
          variant="outlined"
          color="inherit"
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
          sx={{ borderColor: '#475569', color: '#E2E8F0' }}
        >
          Sign Out
        </Button>
      </Box>
    </Box>
  );

  const toggleDisabledReason = !isKycVerified
    ? 'Complete & verify KYC before going online'
    : !geo.isGpsReady
      ? 'Enable live GPS first before going online'
      : partner?.availabilityStatus === 'on_delivery'
        ? 'Complete active trip before going offline'
        : '';

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F8FAFC' }}>
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', border: 'none' },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top App Bar */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: '#FFFFFF',
            color: '#172B30',
            borderBottom: '1px solid #E2E8F0',
          }}
        >
          <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 1.5, sm: 3 }, minHeight: 62 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              {isMobile && (
                <Box component="img" src="/logo.svg" alt="E-Shopy" sx={{ height: 28, width: 'auto' }} />
              )}
              {!isMobile && (
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  E-Shopy Delivery Fleet
                </Typography>
              )}
              <Tooltip
                title={
                  geo.permissionError ||
                  (geo.coords ? `GPS: ${geo.coords.lat}, ${geo.coords.lng}` : 'Tap to enable/refresh GPS')
                }
              >
                <Chip
                  size="small"
                  icon={
                    geo.isGpsReady ? (
                      <GpsIcon sx={{ fontSize: '14px !important' }} />
                    ) : (
                      <GpsOffIcon sx={{ fontSize: '14px !important' }} />
                    )
                  }
                  label={
                    geo.gpsStatus === 'checking'
                      ? 'GPS Check...'
                      : geo.isGpsReady
                        ? 'GPS Live'
                        : 'GPS Off'
                  }
                  onClick={() => geo.pingNow()}
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    bgcolor: geo.isGpsReady ? '#EFF6FF' : '#FEF2F2',
                    color: geo.isGpsReady ? '#1D4ED8' : '#B91C1C',
                    border: `1px solid ${geo.isGpsReady ? '#BFDBFE' : '#FECACA'}`,
                  }}
                />
              </Tooltip>
            </Stack>

            {/* Duty Toggle — locked unless KYC verified AND GPS is live */}
            <Stack direction="row" alignItems="center" spacing={1}>
              <Tooltip title={toggleDisabledReason || (isOnDuty ? 'Switch Offline' : 'Go Online')}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1.25,
                    py: 0.25,
                    borderRadius: 999,
                    bgcolor: isOnDuty ? '#ECFDF5' : !isFullyVerified || !geo.isGpsReady ? '#FEF2F2' : '#F1F5F9',
                    border: `1px solid ${
                      isOnDuty ? '#6EE7B7' : !isFullyVerified || !geo.isGpsReady ? '#FECACA' : '#CBD5E1'
                    }`,
                    opacity: !canToggleOnline && !isOnDuty ? 0.75 : 1,
                  }}
                >
                  <Box
                    className={isOnDuty ? 'online-pulse' : undefined}
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: isOnDuty ? '#10B981' : !isFullyVerified || !geo.isGpsReady ? '#EF4444' : '#94A3B8',
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                      color: isOnDuty ? '#047857' : !isFullyVerified || !geo.isGpsReady ? '#991B1B' : '#475569',
                    }}
                  >
                    {partner?.availabilityStatus === 'on_delivery'
                      ? 'On Trip'
                      : isOnDuty
                        ? 'Online'
                        : !isKycVerified
                          ? 'Verify KYC'
                          : !geo.isGpsReady
                            ? 'GPS Req.'
                            : 'Offline'}
                  </Typography>
                  <Switch
                    size="small"
                    checked={isOnDuty}
                    disabled={
                      isTogglingDuty ||
                      partner?.availabilityStatus === 'on_delivery' ||
                      (!isOnDuty && !canToggleOnline)
                    }
                    onChange={(e) => handleToggleDuty(e.target.checked)}
                    color="success"
                  />
                </Box>
              </Tooltip>

              {!isMobile && (
                <Avatar sx={{ width: 32, height: 32, bgcolor: '#FF7900', fontSize: '0.85rem', fontWeight: 800 }}>
                  {partner?.name?.charAt(0)?.toUpperCase() || 'R'}
                </Avatar>
              )}
            </Stack>
          </Toolbar>
        </AppBar>

        {/* Network Offline Banner */}
        {!isOnlineNet && (
          <Alert severity="warning" icon={<OfflineIcon />} sx={{ borderRadius: 0 }}>
            You are currently offline. Reconnect to accept orders and stream live GPS.
          </Alert>
        )}

        {/* Duty Error Banner */}
        {dutyError && (
          <Alert severity="error" onClose={() => setDutyError(null)} sx={{ borderRadius: 0 }}>
            {dutyError}
          </Alert>
        )}

        {/* KYC Verification Gate Banner */}
        {!isKycVerified && (
          <Alert
            severity={partner?.kycStatus === 'rejected' ? 'error' : 'warning'}
            icon={<KycIcon />}
            action={
              <Button
                size="small"
                variant="contained"
                color="warning"
                onClick={() => navigate('/profile')}
                sx={{ whiteSpace: 'nowrap' }}
              >
                {partner?.isKycComplete ? 'View KYC' : 'Upload KYC'}
              </Button>
            }
            sx={{ borderRadius: 0 }}
          >
            {partner?.kycStatus === 'submitted'
              ? 'KYC documents submitted and awaiting admin verification. You can go online once verified.'
              : partner?.kycStatus === 'rejected'
                ? `KYC Rejected: ${partner.kycRejectionReason || 'Please re-upload valid documents.'}`
                : 'KYC Verification Required: Upload your Driving License, Vehicle RC, and Government ID in Profile before going online.'}
          </Alert>
        )}

        {/* GPS Required Gate Banner */}
        {isKycVerified && !geo.isGpsReady && (
          <Alert
            severity="error"
            icon={<GpsOffIcon />}
            action={
              <Button
                size="small"
                variant="contained"
                color="error"
                onClick={() => geo.pingNow()}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Enable GPS
              </Button>
            }
            sx={{ borderRadius: 0 }}
          >
            {geo.permissionError || 'GPS is turned off. Enable live location access to switch Online and receive orders.'}
          </Alert>
        )}

        {/* Web Browser -> Capacitor Android APK Download Banner */}
        {!updater.isNative && (
          <Alert
            severity="info"
            icon={<AndroidIcon />}
            action={
              <Button
                size="small"
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadApkClick}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Download APK
              </Button>
            }
            sx={{ borderRadius: 0 }}
          >
            Use the <strong>E-Shopy Rider Android App</strong> (v{updater.releaseInfo?.versionName || '1.0.0'}) for background GPS & live alerts.
          </Alert>
        )}

        {/* Native Capacitor -> Optional Update Banner */}
        {updater.hasNativeUpdate && !updater.isForceUpdate && !updateDismissed && (
          <Alert
            severity="info"
            icon={<UpdateIcon />}
            onClose={() => setUpdateDismissed(true)}
            action={
              <Button
                size="small"
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={() => updater.openDownload()}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Update v{updater.releaseInfo?.versionName}
              </Button>
            }
            sx={{ borderRadius: 0 }}
          >
            New app update <strong>v{updater.releaseInfo?.versionName}</strong> is available!
            {updater.releaseInfo?.releaseNotes ? ` — ${updater.releaseInfo.releaseNotes}` : ''}
          </Alert>
        )}

        {/* Main View */}
        <Box
          component="main"
          sx={{
            flex: 1,
            p: { xs: 1.75, sm: 3 },
            pb: { xs: 10, md: 4 },
            maxWidth: 960,
            width: '100%',
            mx: 'auto',
          }}
        >
          <Outlet context={{ geo, primaryActiveAssignment, isKycVerified, isFullyVerified }} />
        </Box>
      </Box>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <Paper
          elevation={4}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1200,
            borderTop: '1px solid #E2E8F0',
            pb: 'env(safe-area-inset-bottom)',
          }}
        >
          <BottomNavigation
            showLabels
            value={activeNavIndex}
            onChange={(_e, idx) => navigate(NAV_ITEMS[idx].path)}
            sx={{
              height: 64,
              '& .Mui-selected': { color: '#FF7900', fontWeight: 800 },
            }}
          >
            {NAV_ITEMS.map((item) => (
              <BottomNavigationAction key={item.path} label={item.label} icon={item.icon} />
            ))}
          </BottomNavigation>
        </Paper>
      )}

      {/* Mandatory Update Dialog inside Capacitor APK */}
      <Dialog open={updater.isForceUpdate} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <UpdateIcon color="primary" />
          App Update Required
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            A newer version <strong>v{updater.releaseInfo?.versionName}</strong> of{' '}
            <strong>E-Shopy Rider</strong> is required to continue receiving orders.
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            Installed: v{updater.installedVersion} (Build {updater.installedBuild}) → Required Build{' '}
            {updater.releaseInfo?.minSupportedVersionCode}+
          </Typography>
          {updater.releaseInfo?.releaseNotes && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {updater.releaseInfo.releaseNotes}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={() => updater.openDownload()}
          >
            Download & Install Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* APK Download Link Not Configured Info Dialog */}
      <Dialog open={apkInfoDialogOpen} onClose={() => setApkInfoDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AndroidIcon sx={{ color: '#10B981' }} />
          Android APK Link Pending
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            The Android APK download redirect endpoint (<code>/api/v1/delivery/app-download</code>) is ready,
            but no GitHub Release or Cloudflare R2 APK URL has been saved yet.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Once an Admin saves the APK URL in <strong>Admin → Delivery Partners → Android APK Settings</strong> (or sets{' '}
            <code>DELIVERY_APK_URL</code>), clicking Download APK will automatically redirect to that file.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button variant="contained" onClick={() => setApkInfoDialogOpen(false)}>
            Got It
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
