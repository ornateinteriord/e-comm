import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  AccountBalanceWallet as WalletIcon,
  CheckCircle as TripIcon,
  CurrencyRupee as RupeeIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import type { DeliveryEarningsSummary } from '@ornate/types';
import api from '../api/client';

const formatRupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function EarningsPage() {
  const { data, isLoading } = useQuery<DeliveryEarningsSummary>({
    queryKey: ['delivery-earnings'],
    queryFn: async () => {
      const resp = await api.get('/delivery/earnings');
      return resp.data.data;
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ py: 10, textAlign: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 0.5 }}>
        Earnings & COD Ledger
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Track trip payouts, incentives, and cash-on-delivery balance to settle
      </Typography>

      {(data?.cashInHandPaise ?? 0) > 0 && (
        <Alert severity="warning" icon={<WalletIcon />} sx={{ mb: 2.5, borderRadius: 2.5 }}>
          <strong>Cash in Hand (COD): {formatRupees(data!.cashInHandPaise)}</strong> — Please deposit collected COD cash at your E-Shopy hub or request admin settlement.
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: 2.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              TODAY
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#10B981', mt: 0.5 }}>
              {formatRupees(data?.todayEarningsPaise ?? 0)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: 2.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              LAST 7 DAYS
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#FF7900', mt: 0.5 }}>
              {formatRupees(data?.weekEarningsPaise ?? 0)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: 2.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              LIFETIME EARNINGS
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.5 }}>
              {formatRupees(data?.totalEarningsPaise ?? 0)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: 2.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              TRIPS / RATING
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {data?.completedTrips ?? 0}
              </Typography>
              <Chip
                size="small"
                icon={<StarIcon sx={{ fontSize: '14px !important', color: '#F59E0B' }} />}
                label={(data?.rating ?? 5.0).toFixed(1)}
                sx={{ fontWeight: 800, height: 22 }}
              />
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 800 }}>
        Completed Trips
      </Typography>

      <Stack spacing={1.5}>
        {(!data?.recentTrips || data.recentTrips.length === 0) ? (
          <Paper elevation={0} sx={{ p: 4, textAlign: 'center', border: '1px solid #E2E8F0', borderRadius: 3 }}>
            <RupeeIcon sx={{ fontSize: 40, color: '#94A3B8', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Complete your first delivery to see itemized trip payouts here.
            </Typography>
          </Paper>
        ) : (
          data.recentTrips.map((trip) => (
            <Paper
              key={trip.id}
              elevation={0}
              sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: 2.5 }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <TripIcon sx={{ color: '#10B981' }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      Order #{trip.orderNumber}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {trip.dropCity} •{' '}
                      {trip.deliveredAt ? new Date(trip.deliveredAt).toLocaleString('en-IN') : ''}
                    </Typography>
                  </Box>
                </Stack>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#047857' }}>
                    +{formatRupees(trip.payoutPaise + (trip.tipPaise || 0))}
                  </Typography>
                  {trip.codCollectedPaise > 0 && (
                    <Typography variant="caption" sx={{ color: '#B45309', display: 'block', fontWeight: 700 }}>
                      COD: {formatRupees(trip.codCollectedPaise)}
                    </Typography>
                  )}
                </Box>
              </Stack>
            </Paper>
          ))
        )}
      </Stack>
    </Box>
  );
}
