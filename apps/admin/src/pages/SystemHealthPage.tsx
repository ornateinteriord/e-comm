import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  TextField,
  InputAdornment,
  Stack,
  Collapse,
  Paper,
  Switch,
  FormControlLabel,
  Alert,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  ErrorOutline as ErrorIcon,
  ContentCopy as CopyIcon,
  OpenInNew as OpenInNewIcon,
  ArrowBack as ArrowBackIcon,
  Speed as SpeedIcon,
  Router as GatewayIcon,
  Shield as ShieldIcon,
  People as PeopleIcon,
  Inventory2 as ProductIcon,
  Search as SearchIcon,
  ShoppingCart as CartIcon,
  ReceiptLong as OrderIcon,
  Payment as PaymentIcon,
  Description as InvoiceIcon,
  Warehouse as InventoryIcon,
  Notifications as NotificationIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import api from '../api/client';
import { useAdminAuthStore } from '../store/auth.store';

export interface ServiceHealthItem {
  name: string;
  key: string;
  path: string;
  target: string;
  status: 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | 'CHECKING';
  httpStatus?: number;
  latency?: number;
  error?: string;
  data?: any;
}

interface GatewayHealthSummary {
  total: number;
  healthy: number;
  degraded: number;
  offline: number;
}

const DEFAULT_SERVICES: ServiceHealthItem[] = [
  { name: 'API Gateway', key: 'gateway', path: '/', target: 'https://api-geteway.vercel.app', status: 'CHECKING' },
  { name: 'Auth & User Service', key: 'auth', path: '/api/v1/auth', target: 'https://e-comm-auth-alpha.vercel.app', status: 'CHECKING' },
  { name: 'Product & Catalog Service', key: 'product', path: '/api/v1/products', target: 'https://e-comm-product-two.vercel.app', status: 'CHECKING' },
  { name: 'Order & Cart Service', key: 'order', path: '/api/v1/orders', target: 'https://e-comm-order.vercel.app', status: 'CHECKING' },
  { name: 'Payment & Invoice Service', key: 'payment', path: '/api/v1/payments', target: 'https://e-comm-payment.vercel.app', status: 'CHECKING' },
  { name: 'Notification Service', key: 'notification', path: '/api/v1/notifications', target: 'https://e-comm-notification.vercel.app', status: 'CHECKING' },
];

const getServiceIcon = (key: string) => {
  switch (key) {
    case 'gateway': return <GatewayIcon sx={{ color: '#38bdf8' }} />;
    case 'auth': return <ShieldIcon sx={{ color: '#a855f7' }} />;
    case 'user': return <PeopleIcon sx={{ color: '#3b82f6' }} />;
    case 'product': return <ProductIcon sx={{ color: '#10b981' }} />;
    case 'search': return <SearchIcon sx={{ color: '#f59e0b' }} />;
    case 'cart': return <CartIcon sx={{ color: '#ec4899' }} />;
    case 'order': return <OrderIcon sx={{ color: '#6366f1' }} />;
    case 'payment': return <PaymentIcon sx={{ color: '#14b8a6' }} />;
    case 'invoice': return <InvoiceIcon sx={{ color: '#8b5cf6' }} />;
    case 'inventory': return <InventoryIcon sx={{ color: '#eab308' }} />;
    case 'notification': return <NotificationIcon sx={{ color: '#f97316' }} />;
    default: return <GatewayIcon sx={{ color: '#94a3b8' }} />;
  }
};

export default function SystemHealthPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAdminAuthStore();

  const [services, setServices] = useState<ServiceHealthItem[]>(DEFAULT_SERVICES);
  const [gatewayItem, setGatewayItem] = useState<ServiceHealthItem | null>(null);
  const [summary, setSummary] = useState<GatewayHealthSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'HEALTHY' | 'ISSUES'>('ALL');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    const startGateway = Date.now();

    try {
      const response = await api.get('/system/health', { timeout: 15000 });
      const gatewayLatency = Date.now() - startGateway;

      if (response.data?.success) {
        const gwData = response.data.gateway;
        setGatewayItem({
          name: gwData?.name || 'API Gateway',
          key: 'gateway',
          path: '/',
          target: gwData?.target || 'https://api-geteway.vercel.app',
          status: 'HEALTHY',
          httpStatus: 200,
          latency: gatewayLatency,
          data: gwData?.data || { status: 'ok' },
        });

        const list: ServiceHealthItem[] = response.data.services || [];
        setServices(list);
        setSummary(response.data.summary);
      } else {
        throw new Error('Unexpected response format from gateway');
      }
    } catch (err: any) {
      // If gateway is down or unreachable, mark gateway as OFFLINE
      const gatewayLatency = Date.now() - startGateway;
      const errMsg = err.response?.data?.message || err.message || 'Gateway unreachable';
      setGatewayItem({
        name: 'API Gateway',
        key: 'gateway',
        path: '/',
        target: 'https://api-geteway.vercel.app',
        status: 'OFFLINE',
        httpStatus: err.response?.status || 0,
        latency: gatewayLatency,
        error: errMsg,
      });

      // Mark services as unknown/offline due to gateway failure
      setServices((prev) =>
        prev.map((s) => ({
          ...s,
          status: 'OFFLINE',
          error: 'Gateway unreachable - could not query service',
        }))
      );
      setSummary(null);
    } finally {
      setLoading(false);
      setLastChecked(new Date());
    }
  }, []);

  // Ping a single service directly or via gateway
  const handlePingSingle = async (key: string) => {
    const targetService = [...(gatewayItem ? [gatewayItem] : []), ...services].find((s) => s.key === key);
    if (!targetService) return;

    // Update status to checking
    setServices((prev) =>
      prev.map((s) => (s.key === key ? { ...s, status: 'CHECKING' } : s))
    );

    const startTime = Date.now();
    try {
      const healthUrl = `${targetService.target.replace(/\/+$/, '')}/health`;
      const res = await fetch(healthUrl, { method: 'GET', mode: 'cors' });
      const latency = Date.now() - startTime;
      const data = await res.json().catch(() => null);

      const updatedStatus: ServiceHealthItem['status'] = res.ok ? 'HEALTHY' : 'DEGRADED';
      setServices((prev) =>
        prev.map((s) =>
          s.key === key
            ? {
                ...s,
                status: updatedStatus,
                httpStatus: res.status,
                latency,
                data,
                error: res.ok ? undefined : `HTTP ${res.status}`,
              }
            : s
        )
      );
    } catch (e: any) {
      const latency = Date.now() - startTime;
      setServices((prev) =>
        prev.map((s) =>
          s.key === key
            ? {
                ...s,
                status: 'OFFLINE',
                httpStatus: 0,
                latency,
                error: e.message || 'Direct ping failed',
              }
            : s
        )
      );
    }
  };

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchHealth]);

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const allItems = useMemo(() => {
    const list = [...services];
    if (gatewayItem && !list.some((s) => s.key === 'gateway')) {
      list.unshift(gatewayItem);
    }
    return list;
  }, [services, gatewayItem]);

  const filteredServices = useMemo(() => {
    return allItems.filter((svc) => {
      const matchesSearch =
        svc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        svc.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        svc.target.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'HEALTHY') return svc.status === 'HEALTHY';
      if (statusFilter === 'ISSUES') return svc.status === 'DEGRADED' || svc.status === 'OFFLINE';
      return true;
    });
  }, [allItems, searchQuery, statusFilter]);

  const healthyCount = allItems.filter((s) => s.status === 'HEALTHY').length;
  const issueCount = allItems.filter((s) => s.status === 'DEGRADED' || s.status === 'OFFLINE').length;
  const avgLatency = Math.round(
    allItems.filter((s) => s.latency && s.latency > 0).reduce((acc, s) => acc + (s.latency || 0), 0) /
      Math.max(1, allItems.filter((s) => s.latency && s.latency > 0).length)
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#090d16', color: '#f8fafc', py: 4, px: { xs: 2, sm: 3, md: 5 } }}>
      <Container maxWidth="xl">
        {/* Navigation / Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Button
              variant="outlined"
              size="small"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(isAuthenticated ? '/' : '/login')}
              sx={{
                borderColor: '#334155',
                color: '#94a3b8',
                '&:hover': { borderColor: '#64748b', bgcolor: 'rgba(255,255,255,0.03)' },
              }}
            >
              {isAuthenticated ? 'Back to Dashboard' : 'Back to Login'}
            </Button>
            <Chip
              icon={<LockIcon sx={{ fontSize: 14, color: '#f59e0b' }} />}
              label="Developer Route: /system-health"
              size="small"
              sx={{ bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.2)' }}
            />
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  color="primary"
                  size="small"
                />
              }
              label={<Typography sx={{ fontSize: '0.85rem', color: '#94a3b8' }}>Auto-refresh (15s)</Typography>}
            />
            <Button
              variant="contained"
              onClick={fetchHealth}
              disabled={loading}
              startIcon={<RefreshIcon sx={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />}
              sx={{
                bgcolor: '#3b82f6',
                fontWeight: 600,
                textTransform: 'none',
                px: 2.5,
                borderRadius: '8px',
                '&:hover': { bgcolor: '#2563eb' },
              }}
            >
              {loading ? 'Checking...' : 'Check All Services'}
            </Button>
          </Stack>
        </Box>

        {/* Title & Subtitle */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em', mb: 1 }}>
            Backend Services Health Monitor
          </Typography>
          <Typography sx={{ color: '#94a3b8', fontSize: '0.95rem' }}>
            Instant diagnostics for all microservices routed through the API Gateway and Vercel serverless functions.
            {lastChecked && (
              <Box component="span" sx={{ ml: 1, color: '#64748b' }}>
                (Last check: {lastChecked.toLocaleTimeString()})
              </Box>
            )}
          </Typography>
        </Box>

        {loading && <LinearProgress sx={{ mb: 3, borderRadius: 1, bgcolor: '#1e293b' }} />}

        {/* KPI Summary Cards */}
        <Grid container spacing={2.5} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}>
              <CardContent sx={{ p: 2.5 }}>
                <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                  Total Monitored
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 800, color: '#f8fafc', mt: 1 }}>
                  {allItems.length}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.5 }}>
                  1 Gateway + 10 Microservices
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}>
              <CardContent sx={{ p: 2.5 }}>
                <Typography sx={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600, textTransform: 'uppercase' }}>
                  Operational / Healthy
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 800, color: '#10b981', mt: 1 }}>
                  {healthyCount}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.5 }}>
                  {Math.round((healthyCount / Math.max(1, allItems.length)) * 100)}% uptime rate
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}>
              <CardContent sx={{ p: 2.5 }}>
                <Typography sx={{ fontSize: '0.8rem', color: '#f43f5e', fontWeight: 600, textTransform: 'uppercase' }}>
                  Degraded / Offline
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 800, color: issueCount > 0 ? '#f43f5e' : '#94a3b8', mt: 1 }}>
                  {issueCount}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.5 }}>
                  {issueCount === 0 ? 'All services operational' : 'Attention required'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}>
              <CardContent sx={{ p: 2.5 }}>
                <Typography sx={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase' }}>
                  Average Latency
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 800, color: '#38bdf8', mt: 1 }}>
                  {avgLatency > 0 ? `${avgLatency}ms` : '--'}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.5 }}>
                  Roundtrip health check response
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters & Search */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant={statusFilter === 'ALL' ? 'contained' : 'outlined'}
              onClick={() => setStatusFilter('ALL')}
              sx={{
                textTransform: 'none',
                borderRadius: '8px',
                bgcolor: statusFilter === 'ALL' ? '#334155' : 'transparent',
                borderColor: '#334155',
                color: '#f8fafc',
              }}
            >
              All ({allItems.length})
            </Button>
            <Button
              size="small"
              variant={statusFilter === 'HEALTHY' ? 'contained' : 'outlined'}
              onClick={() => setStatusFilter('HEALTHY')}
              sx={{
                textTransform: 'none',
                borderRadius: '8px',
                bgcolor: statusFilter === 'HEALTHY' ? '#064e3b' : 'transparent',
                borderColor: '#064e3b',
                color: '#34d399',
              }}
            >
              Operational ({healthyCount})
            </Button>
            <Button
              size="small"
              variant={statusFilter === 'ISSUES' ? 'contained' : 'outlined'}
              onClick={() => setStatusFilter('ISSUES')}
              sx={{
                textTransform: 'none',
                borderRadius: '8px',
                bgcolor: statusFilter === 'ISSUES' ? '#881337' : 'transparent',
                borderColor: '#881337',
                color: '#fb7185',
              }}
            >
              Issues ({issueCount})
            </Button>
          </Stack>

          <TextField
            size="small"
            placeholder="Search service, key or URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#64748b', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
            sx={{
              width: { xs: '100%', sm: 300 },
              '& .MuiOutlinedInput-root': {
                bgcolor: '#0f172a',
                color: '#f8fafc',
                borderRadius: '8px',
                '& fieldset': { borderColor: '#1e293b' },
                '&:hover fieldset': { borderColor: '#334155' },
                '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
              },
            }}
          />
        </Box>

        {/* Services List / Cards */}
        <Stack spacing={2}>
          {filteredServices.map((svc) => {
            const isExpanded = !!expandedKeys[svc.key];
            const isHealthy = svc.status === 'HEALTHY';
            const isDegraded = svc.status === 'DEGRADED';
            const isOffline = svc.status === 'OFFLINE';

            let statusColor = '#94a3b8';
            let statusBg = 'rgba(148, 163, 184, 0.1)';
            let statusIcon = <SpeedIcon sx={{ fontSize: 16 }} />;

            if (isHealthy) {
              statusColor = '#10b981';
              statusBg = 'rgba(16, 185, 129, 0.1)';
              statusIcon = <CheckCircleIcon sx={{ fontSize: 16, color: '#10b981' }} />;
            } else if (isDegraded) {
              statusColor = '#f59e0b';
              statusBg = 'rgba(245, 158, 11, 0.1)';
              statusIcon = <WarningIcon sx={{ fontSize: 16, color: '#f59e0b' }} />;
            } else if (isOffline) {
              statusColor = '#f43f5e';
              statusBg = 'rgba(244, 63, 94, 0.1)';
              statusIcon = <ErrorIcon sx={{ fontSize: 16, color: '#f43f5e' }} />;
            }

            return (
              <Card
                key={svc.key}
                sx={{
                  bgcolor: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: '12px',
                  transition: 'all 0.2s ease',
                  '&:hover': { borderColor: '#334155' },
                }}
              >
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    {/* Left: Icon & Title */}
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: '10px',
                          bgcolor: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid #1e293b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {getServiceIcon(svc.key)}
                      </Box>
                      <Box>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#f8fafc' }}>
                            {svc.name}
                          </Typography>
                          <Chip
                            label={svc.path}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(255,255,255,0.05)',
                              color: '#94a3b8',
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                            }}
                          />
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                          <Typography
                            component="a"
                            href={`${svc.target.replace(/\/+$/, '')}/health`}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{
                              fontSize: '0.8rem',
                              color: '#64748b',
                              textDecoration: 'none',
                              '&:hover': { color: '#94a3b8', textDecoration: 'underline' },
                            }}
                          >
                            {svc.target}
                          </Typography>
                          <Tooltip title={copiedKey === svc.key ? 'Copied!' : 'Copy target URL'}>
                            <IconButton
                              size="small"
                              onClick={() => copyToClipboard(svc.target, svc.key)}
                              sx={{ p: 0.25, color: '#64748b', '&:hover': { color: '#f8fafc' } }}
                            >
                              <CopyIcon sx={{ fontSize: 13 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Open /health in new tab">
                            <IconButton
                              size="small"
                              component="a"
                              href={`${svc.target.replace(/\/+$/, '')}/health`}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ p: 0.25, color: '#64748b', '&:hover': { color: '#f8fafc' } }}
                            >
                              <OpenInNewIcon sx={{ fontSize: 13 }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Box>
                    </Stack>

                    {/* Right: Status badge, latency, actions */}
                    <Stack direction="row" spacing={2} alignItems="center">
                      {svc.latency !== undefined && svc.latency > 0 && (
                        <Chip
                          icon={<SpeedIcon sx={{ fontSize: 14 }} />}
                          label={`${svc.latency}ms`}
                          size="small"
                          sx={{
                            bgcolor:
                              svc.latency < 150
                                ? 'rgba(16, 185, 129, 0.1)'
                                : svc.latency < 500
                                ? 'rgba(245, 158, 11, 0.1)'
                                : 'rgba(244, 63, 94, 0.1)',
                            color: svc.latency < 150 ? '#34d399' : svc.latency < 500 ? '#fbbf24' : '#fb7185',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        />
                      )}

                      <Chip
                        icon={statusIcon}
                        label={svc.status}
                        size="small"
                        sx={{
                          bgcolor: statusBg,
                          color: statusColor,
                          border: `1px solid ${statusColor}40`,
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                        }}
                      />

                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handlePingSingle(svc.key)}
                        sx={{
                          textTransform: 'none',
                          fontSize: '0.75rem',
                          borderColor: '#334155',
                          color: '#94a3b8',
                          py: 0.25,
                          px: 1.5,
                          '&:hover': { borderColor: '#64748b', bgcolor: 'rgba(255,255,255,0.03)' },
                        }}
                      >
                        Ping
                      </Button>

                      <IconButton
                        size="small"
                        onClick={() => toggleExpand(svc.key)}
                        sx={{ color: '#64748b', '&:hover': { color: '#f8fafc' } }}
                      >
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </Stack>
                  </Box>

                  {/* Error Alert if degraded or offline */}
                  {svc.error && (
                    <Alert
                      severity="error"
                      variant="outlined"
                      sx={{
                        mt: 2,
                        py: 0.5,
                        px: 1.5,
                        borderColor: 'rgba(244, 63, 94, 0.3)',
                        bgcolor: 'rgba(244, 63, 94, 0.05)',
                        color: '#fb7185',
                        fontSize: '0.85rem',
                      }}
                    >
                      <strong>Error:</strong> {svc.error}
                    </Alert>
                  )}

                  {/* Expandable Diagnostic Details */}
                  <Collapse in={isExpanded}>
                    <Paper
                      sx={{
                        mt: 2,
                        p: 2,
                        bgcolor: '#070b13',
                        border: '1px solid #1e293b',
                        borderRadius: '8px',
                        overflowX: 'auto',
                      }}
                    >
                      <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, mb: 1, textTransform: 'uppercase' }}>
                        Diagnostic Payload & Metrics
                      </Typography>
                      <Box
                        component="pre"
                        sx={{
                          fontFamily: 'Consolas, monospace',
                          fontSize: '0.78rem',
                          color: '#38bdf8',
                          m: 0,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                        }}
                      >
                        {JSON.stringify(
                          {
                            service: svc.name,
                            key: svc.key,
                            status: svc.status,
                            httpStatus: svc.httpStatus || 200,
                            latencyMs: svc.latency || 0,
                            targetUrl: svc.target,
                            gatewayPath: svc.path,
                            responsePayload: svc.data || (svc.error ? { error: svc.error } : null),
                          },
                          null,
                          2
                        )}
                      </Box>
                    </Paper>
                  </Collapse>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      </Container>
    </Box>
  );
}
