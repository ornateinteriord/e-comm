import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  BatteryChargingFull as BatteryIcon,
  CameraAlt as CameraIcon,
  CheckCircle as GrantedIcon,
  Layers as OverlayIcon,
  LocationOn as GpsIcon,
  NotificationsActive as NotificationIcon,
  Refresh as RefreshIcon,
  Security as ShieldIcon,
} from '@mui/icons-material';
import {
  openDeviceLocationSettings,
  requestCoreNativePermissions,
  requestNativeBackgroundLocation,
  requestNativeBatteryOptimization,
  requestNativeFullScreenIntentPermission,
  requestNativeOverlayPermission,
  type NativePermissionsReport,
} from '../../utils/orderAlertAudio';

interface RiderPermissionsGateProps {
  report: NativePermissionsReport;
  onRefreshReport: () => Promise<void>;
}

interface PermissionRow {
  key: string;
  title: string;
  description: string;
  granted: boolean;
  icon: React.ReactNode;
  actionLabel: string;
  onAction: () => void;
}

export default function RiderPermissionsGate({
  report,
  onRefreshReport,
}: RiderPermissionsGateProps) {
  const handleCore = async () => {
    await requestCoreNativePermissions();
    await onRefreshReport();
  };

  const handleBackgroundLocation = async () => {
    await requestNativeBackgroundLocation();
    await onRefreshReport();
  };

  const handleBattery = async () => {
    await requestNativeBatteryOptimization();
    window.setTimeout(() => {
      onRefreshReport();
    }, 600);
  };

  const handleOverlay = async () => {
    await requestNativeOverlayPermission();
    window.setTimeout(() => {
      onRefreshReport();
    }, 600);
  };

  const handleFullScreenIntent = async () => {
    await requestNativeFullScreenIntentPermission();
    window.setTimeout(() => {
      onRefreshReport();
    }, 600);
  };

  const handleGpsToggle = async () => {
    if (report.gps !== 'granted') {
      await requestCoreNativePermissions();
    } else {
      await openDeviceLocationSettings();
    }
    await onRefreshReport();
  };

  const rows: PermissionRow[] = [
    {
      key: 'gps',
      title: 'Live GPS & Location Services',
      description: report.gpsEnabled
        ? 'Required to verify store arrival, customer arrival, and live route.'
        : 'Device GPS is turned off. Enable GPS & allow location access.',
      granted: report.gps === 'granted' && report.gpsEnabled,
      icon: <GpsIcon fontSize="small" />,
      actionLabel: report.gps !== 'granted' ? 'Allow' : 'Turn On GPS',
      onAction: handleGpsToggle,
    },
    {
      key: 'bg_loc',
      title: 'Always-Allow Background Location',
      description: 'Keeps rider coordinates updated even while navigating or screen locked.',
      granted: report.backgroundLocation === 'granted',
      icon: <GpsIcon fontSize="small" />,
      actionLabel: 'Allow Always',
      onAction: handleBackgroundLocation,
    },
    {
      key: 'notifications',
      title: 'Order Notifications & Bell Sound',
      description: 'Required to ring ALRMBell sound and show incoming order alerts.',
      granted: report.notifications === 'granted',
      icon: <NotificationIcon fontSize="small" />,
      actionLabel: 'Allow',
      onAction: handleCore,
    },
    {
      key: 'background',
      title: 'Run in Background (Unrestricted Battery)',
      description: 'Allows order listener to run even when app is closed or phone is locked.',
      granted: report.backgroundRun === 'granted',
      icon: <BatteryIcon fontSize="small" />,
      actionLabel: 'Allow',
      onAction: handleBattery,
    },
    {
      key: 'overlay',
      title: 'Display Over Other Apps (Overlay)',
      description: 'Opens incoming order Accept/Decline screen over lockscreen & other apps.',
      granted: report.overlay === 'granted',
      icon: <OverlayIcon fontSize="small" />,
      actionLabel: 'Allow',
      onAction: handleOverlay,
    },
    ...(report.fullScreenIntent !== undefined
      ? [
          {
            key: 'fullscreen_intent',
            title: 'Full-Screen Lockscreen Alerts',
            description: 'Required on Android 14+ to wake and open order bell screen while phone is locked.',
            granted: report.fullScreenIntent === 'granted',
            icon: <NotificationIcon fontSize="small" />,
            actionLabel: 'Allow',
            onAction: handleFullScreenIntent,
          },
        ]
      : []),
    {
      key: 'media',
      title: 'Camera & Files / Photos',
      description: 'Used for KYC document uploads and Proof of Delivery photos.',
      granted: report.camera === 'granted' && report.files === 'granted',
      icon: <CameraIcon fontSize="small" />,
      actionLabel: 'Allow',
      onAction: handleCore,
    },
  ];

  const missingCount = rows.filter((r) => !r.granted).length;
  const needsRuntimeCore =
    report.gps !== 'granted' ||
    report.notifications !== 'granted' ||
    report.camera !== 'granted' ||
    report.files !== 'granted';

  return (
    <Box sx={{ maxWidth: 520, mx: 'auto', py: 2 }}>
      <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #E5E7EB', borderRadius: 2.5 }}>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
          <ShieldIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Required Rider Permissions
          </Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          All {rows.length} device permissions are required so incoming order alerts ring loudly and wake the screen even when the app is closed or your phone is locked.
        </Typography>

        <Alert severity="warning" sx={{ mb: 2, borderRadius: 1.5 }}>
          {missingCount} {missingCount === 1 ? 'permission' : 'permissions'} remaining before you can receive deliveries.
        </Alert>

        <Stack spacing={1.25} sx={{ mb: 2.25 }}>
          {rows.map((row) => (
            <Box
              key={row.key}
              sx={{
                p: 1.5,
                borderRadius: 2,
                border: `1px solid ${row.granted ? '#A7F3D0' : '#E5E7EB'}`,
                bgcolor: row.granted ? '#F0FDF4' : '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
              }}
            >
              <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', minWidth: 0, flex: 1 }}>
                <Box sx={{ color: row.granted ? '#059669' : '#EA580C', mt: 0.25, flexShrink: 0 }}>
                  {row.granted ? <GrantedIcon fontSize="small" /> : row.icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#111827' }}>
                    {row.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {row.description}
                  </Typography>
                </Box>
              </Box>

              {row.granted ? (
                <Chip
                  size="small"
                  label="Allowed"
                  color="success"
                  sx={{ fontWeight: 700, flexShrink: 0 }}
                />
              ) : (
                <Button
                  size="small"
                  variant="contained"
                  onClick={row.onAction}
                  sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  {row.actionLabel}
                </Button>
              )}
            </Box>
          ))}
        </Stack>

        <Stack spacing={1}>
          {needsRuntimeCore && (
            <Button fullWidth variant="contained" size="large" onClick={handleCore}>
              Grant Location, Notifications, Camera & Files
            </Button>
          )}
          <Button
            fullWidth
            variant="outlined"
            color="inherit"
            startIcon={<RefreshIcon />}
            onClick={() => onRefreshReport()}
          >
            Recheck All Permissions
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
