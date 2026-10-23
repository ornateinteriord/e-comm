import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead,
  TableRow, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, CircularProgress, Alert,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import api from '../api/client';
import type { Category } from '@ornate/types';

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data } = await api.get('/categories');
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/admin/categories', { name, description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setDialogOpen(false);
      setName('');
      setDescription('');
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || 'Failed to create category');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    },
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={900} letterSpacing="-0.02em">
            Category Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage storefront taxonomy, nested subcategories, and hierarchy
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          sx={{ borderRadius: '6px', fontWeight: 700 }}
        >
          Add Category
        </Button>
      </Box>

      <Paper elevation={0} sx={{ borderRadius: '8px', border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Category Name</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Slug</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {categories?.map((cat) => (
                <TableRow key={cat.id} hover>
                  <TableCell sx={{ fontWeight: 800 }}>{cat.name}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{cat.slug}</TableCell>
                  <TableCell>{cat.description || '-'}</TableCell>
                  <TableCell sx={{ textAlign: 'right' }}>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        if (confirm(`Delete category "${cat.name}"?`)) {
                          deleteMutation.mutate(cat.id);
                        }
                      }}
                      title="Delete Category"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Add Category</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            label="Category Name"
            required
            fullWidth
            size="small"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            label="Description"
            fullWidth
            multiline
            rows={2}
            size="small"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => createMutation.mutate()}
            disabled={!name || createMutation.isPending}
            sx={{ fontWeight: 700 }}
          >
            {createMutation.isPending ? 'Creating…' : 'Create Category'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
