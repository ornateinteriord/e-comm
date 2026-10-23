import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead,
  TableRow, Button, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, CircularProgress, IconButton,
  Grid,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import api from '../api/client';
import type { Coupon } from '@ornate/types';

export default function CouponsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState(10);
  const [minOrder, setMinOrder] = useState(500);
  const [maxDiscount, setMaxDiscount] = useState(500);

  const { data: coupons, isLoading } = useQuery<Coupon[]>({
    queryKey: ['admin-coupons-list'],
    queryFn: async () => {
      const { data } = await api.get('/admin/coupons');
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/admin/coupons', {
        code: code.toUpperCase(),
        type,
        value: Number(value),
        minOrderValue: Number(minOrder) * 100, // converted to paise
        maxDiscountAmount: type === 'percentage' ? Number(maxDiscount) * 100 : undefined,
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isActive: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons-list'] });
      setDialogOpen(false);
      setCode('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/coupons/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons-list'] });
    },
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={900} letterSpacing="-0.02em">
            Coupons & Promotions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure promotional discount vouchers, cart minimums, and usage limits
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          sx={{ borderRadius: '6px', fontWeight: 700 }}
        >
          Create Promo Code
        </Button>
      </Box>

      <Paper elevation={0} sx={{ borderRadius: '8px', border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : !coupons || coupons.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No coupons created yet.</Typography>
          </Box>
        ) : (
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Discount Type</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Discount Value</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Min Order (₹)</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Max Cap (₹)</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {coupons.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell>
                    <Chip label={c.code} color="primary" sx={{ fontWeight: 900 }} />
                  </TableCell>
                  <TableCell sx={{ textTransform: 'uppercase', fontWeight: 600 }}>{c.type}</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>
                    {c.type === 'percentage' ? `${c.value}% OFF` : `₹${(c.value / 100).toFixed(0)} OFF`}
                  </TableCell>
                  <TableCell>₹{((c.minOrderValue / 100)).toFixed(0)}</TableCell>
                  <TableCell>
                    {c.maxDiscountAmount ? `₹${(c.maxDiscountAmount / 100).toFixed(0)}` : 'No Cap'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={c.isActive ? 'ACTIVE' : 'INACTIVE'}
                      size="small"
                      color={c.isActive ? 'success' : 'default'}
                      sx={{ fontWeight: 800, fontSize: 10 }}
                    />
                  </TableCell>
                  <TableCell sx={{ textAlign: 'right' }}>
                    <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(c.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Create Promotional Coupon</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Coupon Code (e.g. SUMMER30)"
                required
                fullWidth
                size="small"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Discount Type"
                fullWidth
                size="small"
                value={type}
                onChange={(e) => setType(e.target.value as any)}
              >
                <MenuItem value="percentage">Percentage (%)</MenuItem>
                <MenuItem value="fixed">Fixed Amount (₹)</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label={type === 'percentage' ? 'Percentage (%)' : 'Amount (₹)'}
                type="number"
                required
                fullWidth
                size="small"
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Min Order (₹)"
                type="number"
                required
                fullWidth
                size="small"
                value={minOrder}
                onChange={(e) => setMinOrder(Number(e.target.value))}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Max Discount Cap (₹)"
                type="number"
                disabled={type === 'fixed'}
                fullWidth
                size="small"
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(Number(e.target.value))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => createMutation.mutate()}
            disabled={!code || createMutation.isPending}
            sx={{ fontWeight: 700 }}
          >
            Create Coupon
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
