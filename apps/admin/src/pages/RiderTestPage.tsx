import { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  Cancel as CancelIcon,
  CheckCircle as CheckIcon,
  Refresh as RefreshIcon,
  RocketLaunch as AssignIcon,
  Storefront as StoreIcon,
  TwoWheeler as RiderIcon,
} from '@mui/icons-material';
import type { DeliveryAssignment } from '@ornate/types';
import api from '../api/client';

const TARGET_PRODUCT_SLUG = 'cubegrid-9-cubby-modular-toy-and-file-organizer-frn-str-004';

interface RiderOption {
  id: string;
  partnerId: string;
  name: string;
  mobileNumber: string;
  city: string;
  pincode: string;
  status: string;
  isActive: boolean;
  kycStatus: string;
  availabilityStatus: string;
  currentLocation?: { lat: number; lng: number; updatedAt?: string } | null;
}

interface TestContextResponse {
  slug: string;
  product: {
    id: string;
    name: string;
    slug: string;
    sku: string;
    stock: number;
    status: string;
    isPublished: boolean;
    sellerId?: string | null;
    sellerName?: string | null;
    image?: string;
    pricing?: {
      mrp?: number;
      sellingPrice?: number;
      dealPrice?: number | null;
    };
  } | null;
  store: {
    id: string;
    sellerId: string;
    name: string;
    ownerName?: string;
    status: string;
    isActive: boolean;
    city: string;
    pincode: string;
  } | null;
  partners: RiderOption[];
  recentAssignments: DeliveryAssignment[];
}

export default function RiderTestPage() {
  const [context, setContext] = useState<TestContextResponse | null>(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    message: string;
    assignment: DeliveryAssignment;
  } | null>(null);

  const loadContext = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await api.get(
        `/admin/delivery/rider-test/context?slug=${encodeURIComponent(TARGET_PRODUCT_SLUG)}`,
      );
      if (resp.data?.success && resp.data.data) {
        const data = resp.data.data as TestContextResponse;
        setContext(data);
        if (!selectedPartnerId && data.partners.length > 0) {
          setSelectedPartnerId(data.partners[0].partnerId);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load rider test context.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadContext();
  }, []);

  const handleAssignOrder = async () => {
    setIsAssigning(true);
    setError(null);
    try {
      const resp = await api.post('/admin/delivery/rider-test/assign', {
        productSlug: TARGET_PRODUCT_SLUG,
        partnerId: selectedPartnerId || undefined,
      });
      if (resp.data?.success && resp.data.data?.assignment) {
        setLastResult({
          message: resp.data.message || 'Test order created and assigned!',
          assignment: resp.data.data.assignment,
        });
        await loadContext();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to assign test order.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleCancelAssignment = async (orderNumber: string) => {
    try {
      await api.post(`/admin/orders/${orderNumber}/delivery/cancel`, {
        reason: 'Reset from Admin Rider Test',
      });
      await loadContext();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to cancel assignment.');
    }
  };

  const product = context?.product;
  const priceRupees = Math.round(
    Number(product?.pricing?.dealPrice || product?.pricing?.sellingPrice || product?.pricing?.mrp || 0) / 100,
  );

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: '#0f172a', letterSpacing: '-0.02em' }}>
            Rider Dispatch Test
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Instantly create a paid, store-approved, packed order and assign it to a rider in one click.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadContext}
          disabled={isLoading}
        >
          Refresh
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2.5 }}>
          {error}
        </Alert>
      )}

      {lastResult && (
        <Alert
          severity="success"
          icon={<CheckIcon />}
          sx={{ mb: 2.5, borderRadius: 2 }}
          onClose={() => setLastResult(null)}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            {lastResult.message}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            Order <strong>#{lastResult.assignment.orderNumber}</strong> • Assignment{' '}
            <strong>{lastResult.assignment.assignmentCode}</strong> • Customer OTP:{' '}
            <strong>{lastResult.assignment.deliveryOtp}</strong> • Status:{' '}
            <strong>{lastResult.assignment.status.toUpperCase()}</strong>
          </Typography>
        </Alert>
      )}

      {isLoading && !context ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2.5}>
          {/* Product & Store Card */}
          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid #e2e8f0', height: '100%' }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#EA580C', letterSpacing: '0.05em' }}>
                TEST PRODUCT (AUTO-PAID &amp; PACKED)
              </Typography>

              {product ? (
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1.5, mb: 2 }}>
                  <Avatar
                    src={product.image}
                    variant="rounded"
                    sx={{ width: 72, height: 72, bgcolor: '#f1f5f9', border: '1px solid #e2e8f0' }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" fontWeight={800}>
                      {product.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      SKU: {product.sku} • Slug: {product.slug}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }} flexWrap="wrap">
                      <Chip
                        size="small"
                        label={`₹${priceRupees.toLocaleString('en-IN')}`}
                        sx={{ fontWeight: 800, bgcolor: '#FFF7ED', color: '#C2410C' }}
                      />
                      <Chip
                        size="small"
                        label={`Stock: ${product.stock}`}
                        color="success"
                        variant="outlined"
                        sx={{ fontWeight: 700 }}
                      />
                      <Chip size="small" label="Paid + Packed" color="success" sx={{ fontWeight: 700 }} />
                    </Stack>
                  </Box>
                </Stack>
              ) : (
                <Alert severity="warning" sx={{ mt: 1.5, mb: 2 }}>
                  Product <code>{TARGET_PRODUCT_SLUG}</code> not found yet. Check catalog database.
                </Alert>
              )}

              <Divider sx={{ my: 2 }} />

              <Stack direction="row" spacing={1.25} alignItems="center">
                <StoreIcon sx={{ color: '#FF7900' }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                    PICKUP STORE (AUTO-APPROVED)
                  </Typography>
                  <Typography variant="body2" fontWeight={800}>
                    {context?.store
                      ? `${context.store.name} (${context.store.sellerId}) — ${context.store.city} ${context.store.pincode}`
                      : 'E-Shopy Default Fulfillment Hub'}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>

          {/* Rider Selection & One-Click Assign Button */}
          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid #e2e8f0', height: '100%' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <RiderIcon sx={{ color: '#FF7900' }} />
                <Typography variant="subtitle1" fontWeight={800}>
                  Target Delivery Partner
                </Typography>
              </Stack>

              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Select Rider</InputLabel>
                <Select
                  value={selectedPartnerId}
                  label="Select Rider"
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                >
                  {(context?.partners || []).map((p) => (
                    <MenuItem key={p.partnerId} value={p.partnerId}>
                      {p.name} ({p.partnerId}) — {p.availabilityStatus.toUpperCase()} • {p.city}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Alert severity="info" sx={{ mb: 2.25, borderRadius: 1.5 }}>
                Clicking <strong>Assign Order</strong> automatically marks the store active, verifies the selected rider if needed, sets Payment = <strong>PAID</strong>, Seller = <strong>ACCEPTED</strong>, and creates a live <strong>assigned</strong> delivery job immediately.
              </Alert>

              <Button
                fullWidth
                size="large"
                variant="contained"
                disabled={isAssigning || !product || (context?.partners?.length ?? 0) === 0}
                onClick={handleAssignOrder}
                startIcon={isAssigning ? <CircularProgress size={18} color="inherit" /> : <AssignIcon />}
                sx={{
                  py: 1.5,
                  fontWeight: 800,
                  fontSize: '1rem',
                  bgcolor: '#FF7900',
                  '&:hover': { bgcolor: '#E85D04' },
                }}
              >
                {isAssigning ? 'Creating & Assigning Order...' : 'Assign Order'}
              </Button>
            </Paper>
          </Grid>

          {/* Recent Assignments */}
          <Grid item xs={12}>
            <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                <Typography variant="subtitle2" fontWeight={800}>
                  Recent Rider Assignments
                </Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>Order #</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Assignment</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Rider</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>OTP</TableCell>
                      <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Reset</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(context?.recentAssignments || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                          No delivery assignments yet. Click &quot;Assign Order&quot; above to trigger one.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (context?.recentAssignments || []).map((asg) => {
                        const isTerminal = ['delivered', 'failed', 'cancelled'].includes(asg.status);
                        return (
                          <TableRow key={asg.id} hover>
                            <TableCell sx={{ fontWeight: 800 }}>#{asg.orderNumber}</TableCell>
                            <TableCell>{asg.assignmentCode}</TableCell>
                            <TableCell>
                              {asg.partnerName} ({asg.partnerId})
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={asg.status.replace(/_/g, ' ').toUpperCase()}
                                color={asg.status === 'delivered' ? 'success' : asg.status === 'cancelled' ? 'default' : 'warning'}
                                sx={{ fontWeight: 700, fontSize: '0.68rem' }}
                              />
                            </TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontWeight: 800 }}>
                              {asg.deliveryOtp || '----'}
                            </TableCell>
                            <TableCell align="right">
                              {!isTerminal && (
                                <Button
                                  size="small"
                                  color="error"
                                  startIcon={<CancelIcon fontSize="small" />}
                                  onClick={() => handleCancelAssignment(asg.orderNumber)}
                                >
                                  Cancel
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
