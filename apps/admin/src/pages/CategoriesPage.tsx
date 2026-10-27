import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead,
  TableRow, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, CircularProgress, Alert, Snackbar,
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

  // Custom confirmation dialog state
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    categoryId: string | null;
    categoryName: string;
  }>({
    open: false,
    categoryId: null,
    categoryName: '',
  });

  // Toast state
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showToast = (message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setToast({ open: true, message, severity });
  };

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
      showToast('Category created successfully!', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message || 'Failed to create category';
      setError(msg);
      showToast(msg, 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setDeleteConfirmDialog({ open: false, categoryId: null, categoryName: '' });
      showToast('Category deleted successfully', 'success');
    },
    onError: (err: any) => {
      showToast(err.response?.data?.error?.message || 'Failed to delete category', 'error');
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
                        setDeleteConfirmDialog({
                          open: true,
                          categoryId: cat.id,
                          categoryName: cat.name,
                        });
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '10px' } }}>
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
          <Button onClick={() => setDialogOpen(false)} sx={{ fontWeight: 700, color: '#64748b' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => createMutation.mutate()}
            disabled={!name || createMutation.isPending}
            sx={{ fontWeight: 700, bgcolor: '#FF7900', '&:hover': { bgcolor: '#E85D04' } }}
          >
            {createMutation.isPending ? 'Creating…' : 'Create Category'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmDialog.open}
        onClose={() => setDeleteConfirmDialog({ open: false, categoryId: null, categoryName: '' })}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px', p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, pb: 1, color: '#0f172a' }}>
          Delete Category
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to delete category <strong>{deleteConfirmDialog.categoryName}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1, gap: 1 }}>
          <Button
            onClick={() => setDeleteConfirmDialog({ open: false, categoryId: null, categoryName: '' })}
            sx={{ fontWeight: 700, color: '#64748b' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (deleteConfirmDialog.categoryId) {
                deleteMutation.mutate(deleteConfirmDialog.categoryId);
              }
            }}
            sx={{ fontWeight: 800, borderRadius: '8px', px: 2.5 }}
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Delete Category'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Global Toast Notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          severity={toast.severity}
          variant="filled"
          sx={{
            fontWeight: 700,
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            alignItems: 'center',
          }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

