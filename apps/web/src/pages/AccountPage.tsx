import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router';
import {
  Box, Container, Typography, Paper, Grid, TextField, Button,
  Divider, Stack, Chip, Card, CardContent, IconButton, Alert,
} from '@mui/material';
import {
  Person as UserIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  AccountBalanceWallet as WalletIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { useAuthStore } from '../store/auth.store';
import api from '../api/client';
import type { Address } from '@ornate/types';

export default function AccountPage() {
  const queryClient = useQueryClient();
  const { user, setAuth } = useAuthStore();

  // Real-time user profile query (fetches updated level, name, customerId, etc.)
  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/users/profile');
        const cust = data.data;
        if (cust) {
          const currentToken = useAuthStore.getState().accessToken;
          if (currentToken) {
            setAuth(currentToken, {
              ...user,
              ...cust,
              id: cust._id || cust.id || user?.id,
              name: cust.fullName || cust.name || user?.name,
              level: cust.level ?? 0,
            });
          }
        }
        return cust;
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 10,
  });

  const effectiveUser = profile || user;
  const currentLevel = profile?.level ?? user?.level ?? 0;

  // Real-time wallet balance query
  const { data: walletData } = useQuery({
    queryKey: ['my-wallet-balance'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/wallet/balance');
        return data.data as { balance: number; balanceRupees: number };
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 15,
  });

  const walletBalancePaise = walletData?.balance ?? (effectiveUser?.walletBalance ?? 0);
  const walletBalanceRupees = (walletBalancePaise / 100).toFixed(2);

  const [name, setName] = useState(effectiveUser?.fullName || effectiveUser?.name || '');
  const [profileSuccess, setProfileSuccess] = useState(false);

  useEffect(() => {
    if (effectiveUser?.fullName || effectiveUser?.name) {
      setName(effectiveUser.fullName || effectiveUser.name);
    }
  }, [effectiveUser?.fullName, effectiveUser?.name]);

  const [newAddress, setNewAddress] = useState({
    name: user?.name || '',
    phone: '9876543210',
    line1: '',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
    isDefault: false,
  });

  const { data: addresses } = useQuery<Address[]>({
    queryKey: ['my-addresses'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/addresses');
        return data.data;
      } catch {
        return [];
      }
    },
  });

  const addAddressMutation = useMutation({
    mutationFn: async () => {
      await api.post('/addresses', newAddress);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-addresses'] });
      setNewAddress({
        name: user?.name || '',
        phone: '9876543210',
        line1: '',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
        isDefault: false,
      });
    },
  });

  const deleteAddressMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/addresses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-addresses'] });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/addresses/${id}/default`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-addresses'] });
    },
  });

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography variant="h4" fontWeight={800} letterSpacing="-0.02em" sx={{ mb: 4 }}>
        My Account
      </Typography>

      <Grid container spacing={4}>
        {/* Profile & Wallet Column */}
        <Grid item xs={12} md={5}>
          <Stack spacing={3}>
            {/* E-Shophy Wallet Information & Redirect Card */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #172B30 0%, #1A363D 100%)',
                color: '#FFFFFF',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(23, 43, 48, 0.2)',
                border: '1px solid rgba(255, 121, 0, 0.35)',
              }}
            >
              {/* Background Glow */}
              <Box
                sx={{
                  position: 'absolute',
                  top: -20,
                  right: -20,
                  width: 110,
                  height: 110,
                  borderRadius: '50%',
                  bgcolor: 'rgba(255, 121, 0, 0.12)',
                  pointerEvents: 'none',
                }}
              />

              <Box sx={{ position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: '10px',
                        bgcolor: 'rgba(255, 121, 0, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FF7900',
                        border: '1px solid rgba(255, 121, 0, 0.4)',
                      }}
                    >
                      <WalletIcon sx={{ fontSize: 22 }} />
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#FFFFFF', lineHeight: 1.2 }}>
                        E-Shophy Wallet
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        Instant checkout & commissions
                      </Typography>
                    </Box>
                  </Box>
                  <Chip
                    label="ACTIVE"
                    size="small"
                    sx={{
                      bgcolor: 'rgba(16, 185, 129, 0.2)',
                      color: '#34D399',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      fontWeight: 800,
                      fontSize: '0.675rem',
                      height: 22,
                    }}
                  />
                </Box>

                {/* Available Balance */}
                <Box sx={{ my: 2 }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                    Total Available Balance
                  </Typography>
                  <Typography variant="h3" fontWeight={900} sx={{ color: '#FFFFFF', mt: 0.5, letterSpacing: '-0.02em' }}>
                    ₹{walletBalanceRupees}
                  </Typography>
                </Box>

                {/* Redirect Action Buttons */}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2.5 }}>
                  <Button
                    component={RouterLink}
                    to="/wallet"
                    variant="contained"
                    fullWidth
                    endIcon={<ArrowForwardIcon />}
                    sx={{
                      bgcolor: '#FF7900',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      py: 1,
                      borderRadius: '8px',
                      textTransform: 'none',
                      fontSize: '0.875rem',
                      boxShadow: '0 4px 14px rgba(255, 121, 0, 0.35)',
                      '&:hover': {
                        bgcolor: '#E85D04',
                      },
                    }}
                  >
                    View Wallet & Transactions
                  </Button>
                  <Button
                    component={RouterLink}
                    to="/wallet"
                    variant="outlined"
                    sx={{
                      color: '#FFFFFF',
                      borderColor: 'rgba(255, 255, 255, 0.35)',
                      fontWeight: 700,
                      py: 1,
                      px: 2,
                      borderRadius: '8px',
                      textTransform: 'none',
                      fontSize: '0.875rem',
                      whiteSpace: 'nowrap',
                      '&:hover': {
                        borderColor: '#FF7900',
                        bgcolor: 'rgba(255, 121, 0, 0.12)',
                        color: '#FF7900',
                      },
                    }}
                  >
                    + Add Money
                  </Button>
                </Stack>
              </Box>
            </Paper>

            {/* Profile Card */}
            <Paper elevation={0} sx={{ p: 4, borderRadius: '8px', border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Box sx={{ p: 1.5, borderRadius: '50%', bgcolor: 'primary.light', color: 'primary.dark' }}>
                  <UserIcon sx={{ fontSize: 32 }} />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={800}>{effectiveUser?.fullName || effectiveUser?.name || 'Customer'}</Typography>
                  <Typography variant="body2" color="text.secondary">{effectiveUser?.email}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                    <Chip label={`Role: ${effectiveUser?.role || 'customer'}`} size="small" color="primary" sx={{ fontWeight: 700 }} />
                    <Chip label={`Level: ${currentLevel}`} size="small" color="secondary" sx={{ fontWeight: 800 }} />
                    {(effectiveUser?.customerId || effectiveUser?.customer_id) && (
                      <Chip label={`Referral Code: ${effectiveUser.customerId || effectiveUser.customer_id}`} size="small" variant="outlined" sx={{ fontWeight: 700 }} />
                    )}
                  </Box>
                </Box>
              </Box>

              <Divider sx={{ my: 3 }} />

              {profileSuccess && (
                <Alert severity="success" sx={{ mb: 3 }}>Profile updated successfully!</Alert>
              )}

              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2 }}>Edit Profile</Typography>
              <Stack spacing={2}>
                <TextField
                  label="Full Name"
                  fullWidth
                  size="small"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <TextField
                  label="Email Address"
                  fullWidth
                  size="small"
                  disabled
                  value={user?.email || ''}
                />
                <Button
                  variant="contained"
                  sx={{ borderRadius: '6px', fontWeight: 700 }}
                  onClick={async () => {
                    try {
                      await api.put('/users/profile', { name });
                      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
                      if (user) setAuth(useAuthStore.getState().accessToken || '', { ...user, name });
                      setProfileSuccess(true);
                    } catch {
                      // handled
                    }
                  }}
                >
                  Save Changes
                </Button>
              </Stack>
            </Paper>
          </Stack>
        </Grid>

        {/* Addresses */}
        <Grid item xs={12} md={7}>
          <Paper elevation={0} sx={{ p: 4, borderRadius: '8px', border: '1px solid', borderColor: 'divider', mb: 4 }}>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 3 }}>
              Saved Addresses
            </Typography>

            <Stack spacing={2} sx={{ mb: 4 }}>
              {addresses?.map((addr) => {
                const id = addr.id || (addr as any)._id;
                return (
                  <Card key={id} variant="outlined" sx={{ borderRadius: '6px', p: 1 }}>
                    <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: '8px !important' }}>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle2" fontWeight={700}>{addr.name}</Typography>
                          {addr.label && <Chip label={addr.label.toUpperCase()} size="small" sx={{ height: 20, fontSize: 10, fontWeight: 700 }} />}
                          {addr.isDefault ? (
                            <Chip label="DEFAULT" size="small" color="primary" sx={{ height: 20, fontSize: 10, fontWeight: 800 }} />
                          ) : (
                            <Button size="small" onClick={() => setDefaultMutation.mutate(id)} sx={{ fontSize: 11, p: 0, textTransform: 'none' }}>
                              Set as Default
                            </Button>
                          )}
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.state} - {addr.pincode}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">Phone: {addr.phone}</Typography>
                      </Box>
                      <IconButton size="small" color="error" onClick={() => deleteAddressMutation.mutate(id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>

            <Divider sx={{ my: 3 }} />

            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2 }}>Add New Address</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Contact Name"
                  fullWidth
                  size="small"
                  value={newAddress.name}
                  onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Phone"
                  fullWidth
                  size="small"
                  value={newAddress.phone}
                  onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Address Line 1"
                  fullWidth
                  size="small"
                  value={newAddress.line1}
                  onChange={(e) => setNewAddress({ ...newAddress, line1: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="City"
                  fullWidth
                  size="small"
                  value={newAddress.city}
                  onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="State"
                  fullWidth
                  size="small"
                  value={newAddress.state}
                  onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Pincode"
                  fullWidth
                  size="small"
                  value={newAddress.pincode}
                  onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => addAddressMutation.mutate()}
                  disabled={!newAddress.line1}
                  sx={{ borderRadius: '6px', fontWeight: 700 }}
                >
                  Save Address
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
