import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Container, Typography, Paper, Grid, TextField, Button,
  Divider, Stack, Chip, Card, CardContent, IconButton, Alert,
} from '@mui/material';
import {
  Person as UserIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useAuthStore } from '../store/auth.store';
import api from '../api/client';
import type { Address } from '@ornate/types';

export default function AccountPage() {
  const queryClient = useQueryClient();
  const { user, setAuth } = useAuthStore();

  const [name, setName] = useState(user?.name || '');
  const [profileSuccess, setProfileSuccess] = useState(false);

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

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography variant="h4" fontWeight={800} letterSpacing="-0.02em" sx={{ mb: 4 }}>
        My Account
      </Typography>

      <Grid container spacing={4}>
        {/* Profile Card */}
        <Grid item xs={12} md={5}>
          <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Box sx={{ p: 1.5, borderRadius: '50%', bgcolor: 'primary.light', color: 'primary.dark' }}>
                <UserIcon sx={{ fontSize: 32 }} />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={800}>{user?.name || 'Customer'}</Typography>
                <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
                <Chip label={`Role: ${user?.role || 'customer'}`} size="small" color="primary" sx={{ mt: 0.5, fontWeight: 700 }} />
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
                sx={{ borderRadius: 2, fontWeight: 700 }}
                onClick={async () => {
                  try {
                    await api.put('/users/profile', { name });
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
        </Grid>

        {/* Addresses */}
        <Grid item xs={12} md={7}>
          <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 4 }}>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 3 }}>
              Saved Addresses
            </Typography>

            <Stack spacing={2} sx={{ mb: 4 }}>
              {addresses?.map((addr) => (
                <Card key={addr.id} variant="outlined" sx={{ borderRadius: 2, p: 1 }}>
                  <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: '8px !important' }}>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2" fontWeight={700}>{addr.name}</Typography>
                        {addr.isDefault && <Chip label="DEFAULT" size="small" color="primary" sx={{ height: 20, fontSize: 10, fontWeight: 800 }} />}
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {addr.line1}, {addr.city}, {addr.state} - {addr.pincode}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Phone: {addr.phone}</Typography>
                    </Box>
                    <IconButton size="small" color="error" onClick={() => deleteAddressMutation.mutate(addr.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </CardContent>
                </Card>
              ))}
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
                  sx={{ borderRadius: 2, fontWeight: 700 }}
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
