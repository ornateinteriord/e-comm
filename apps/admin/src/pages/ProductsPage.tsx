import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead,
  TableRow, TableContainer, Button, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Grid, MenuItem, CircularProgress,
  IconButton, Stack, Tooltip, Alert, FormControlLabel, Switch, InputAdornment,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  TrendingUp as TrendingUpIcon,
  Star as StarIcon,
  CloudUpload as CloudUploadIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import api from '../api/client';
import type { AdminProduct } from '@ornate/types';

export const DEFAULT_CATEGORIES = [
  { id: '6ad1ef935be79206b89816e5', _id: '6ad1ef935be79206b89816e5', name: 'Electronics & Audio', slug: 'electronics' },
  { id: '6ad1ef935be79206b89816e6', _id: '6ad1ef935be79206b89816e6', name: 'Fashion & Apparel', slug: 'clothing' },
  { id: '6ad1ef935be79206b89816e7', _id: '6ad1ef935be79206b89816e7', name: 'Watches & Accessories', slug: 'accessories' },
  { id: '6ad1ef935be79206b89816e8', _id: '6ad1ef935be79206b89816e8', name: 'Home, Living & Coffee', slug: 'home-kitchen' },
  { id: '6ad1ef935be79206b89816e9', _id: '6ad1ef935be79206b89816e9', name: 'Fitness & Outdoors', slug: 'sports' },
  { id: '6ad1ef935be79206b89816ea', _id: '6ad1ef935be79206b89816ea', name: 'Books & Stationery', slug: 'books' },
];

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Toast notification state
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showToast = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ open: true, message, severity });
  };

  // Custom confirmation dialog for archiving/deleting products
  const [archiveDialog, setArchiveDialog] = useState<{
    open: boolean;
    productId: string | null;
    productName: string;
  }>({
    open: false,
    productId: null,
    productName: '',
  });

  // Form state
  const [form, setForm] = useState({
    name: '',
    sku: '',
    brand: '',
    category: '',
    shortDescription: '',
    longDescription: '',
    mrp: 1000,
    sellingPrice: 800,
    dealPrice: '',
    inwardPrice: 400,
    stock: 50,
    lowStockThreshold: 5,
    status: 'active',
    isPublished: true,
    isFeatured: false,
    imageUrl: '',
    imageName: '',
  });

  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleImageUpload = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, WebP, etc.).', 'error');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      showToast('Image file size must be less than 15MB.', 'error');
      return;
    }

    try {
      setUploadingImage(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append('image', file);

      const res = await api.post('/admin/products/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const { url, name, title } = res.data.data;
      const cleanTitle = title || file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();

      setForm((prev) => ({
        ...prev,
        imageUrl: url,
        imageName: name || file.name,
        // Auto-fill Product Title if empty or default
        name: prev.name.trim() === '' ? cleanTitle : prev.name,
      }));

      showToast(`Image "${name || file.name}" uploaded to ImageKit successfully!`, 'success');
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to upload image to ImageKit';
      setUploadError(msg);
      showToast(msg, 'error');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const { data: productsData, isLoading } = useQuery<{ items: AdminProduct[]; total: number }>({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data } = await api.get('/admin/products?limit=100');
      return data.data;
    },
  });

  const { data: rawCategories } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      try {
        const res = await api.get('/categories');
        const raw = res.data?.data?.categories || res.data?.data || res.data || [];
        const rawList = Array.isArray(raw) ? raw : [];
        if (rawList.length > 0) {
          return rawList.map((cat: any) => ({
            id: String(cat.id || cat._id || ''),
            _id: String(cat._id || cat.id || ''),
            name: cat.name,
            slug: cat.slug,
          }));
        }
      } catch {
        // Fallback to /admin/categories
        try {
          const res2 = await api.get('/admin/categories');
          const raw2 = res2.data?.data?.categories || res2.data?.data || res2.data || [];
          const rawList2 = Array.isArray(raw2) ? raw2 : [];
          if (rawList2.length > 0) {
            return rawList2.map((cat: any) => ({
              id: String(cat.id || cat._id || ''),
              _id: String(cat._id || cat.id || ''),
              name: cat.name,
              slug: cat.slug,
            }));
          }
        } catch {
          // Fall through to default categories
        }
      }
      return DEFAULT_CATEGORIES;
    },
    initialData: DEFAULT_CATEGORIES,
  });

  const categories = rawCategories && rawCategories.length > 0 ? rawCategories : DEFAULT_CATEGORIES;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const targetCategory = form.category || categories?.[0]?.id || (categories?.[0] as any)?._id;
      if (!targetCategory) {
        throw new Error('Please select a Category / Department.');
      }

      const mrpPaise = Math.round(Number(form.mrp) * 100);
      const sellingPaise = Math.round(Number(form.sellingPrice) * 100);
      const inwardPaise = Math.round(Number(form.inwardPrice) * 100);
      const dealPaise = form.dealPrice ? Math.round(Number(form.dealPrice) * 100) : null;

      if (inwardPaise > sellingPaise) {
        throw new Error('Inward Price cannot exceed Selling Price (negative margin).');
      }
      if (sellingPaise > mrpPaise) {
        throw new Error('Selling Price cannot exceed Maximum Retail Price (MRP).');
      }
      if (dealPaise && dealPaise >= sellingPaise) {
        throw new Error('Deal Price must be lower than Selling Price.');
      }

      const payload = {
        name: form.name,
        sku: form.sku.toUpperCase(),
        brand: form.brand,
        category: targetCategory,
        shortDescription: form.shortDescription,
        longDescription: form.longDescription,
        pricing: {
          mrp: mrpPaise,
          sellingPrice: sellingPaise,
          inwardPrice: inwardPaise,
          dealPrice: dealPaise,
          deal: dealPaise
            ? {
                isActive: true,
                startDate: new Date(),
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                maxQtyPerOrder: 5,
              }
            : null,
        },
        stock: Number(form.stock),
        lowStockThreshold: Number(form.lowStockThreshold),
        status: form.status,
        isPublished: form.isPublished,
        isFeatured: form.isFeatured,
        images: form.imageUrl
          ? [{
              id: 'img_' + Date.now(),
              url: form.imageUrl,
              name: form.imageName || form.name,
              alt: form.name,
              order: 0,
            }]
          : [],
      };

      if (editingProduct) {
        await api.patch(`/admin/products/${editingProduct.id}`, payload);
      } else {
        await api.post('/admin/products', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setDialogOpen(false);
      setEditingProduct(null);
      setFormError(null);
      showToast(editingProduct ? 'Product updated successfully!' : 'Product created and published successfully!', 'success');
    },
    onError: (err: any) => {
      const msg = err.message || err.response?.data?.error?.message || 'Failed to save product';
      setFormError(msg);
      showToast(msg, 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setArchiveDialog({ open: false, productId: null, productName: '' });
      showToast('Product archived successfully', 'success');
    },
    onError: (err: any) => {
      showToast(err.response?.data?.error?.message || 'Failed to archive product', 'error');
    },
  });

  const setSponsorMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        const { data } = await api.post(`/admin/products/${id}/sponsor`);
        return data;
      } catch (err: any) {
        // Resilient fallback: if the backend deployment hasn't registered /sponsor route yet (HTTP 404),
        // fallback to updating the product with isFeatured: true via PATCH /admin/products/:id
        if (err.response?.status === 404) {
          const { data } = await api.patch(`/admin/products/${id}`, { isFeatured: true });
          return data;
        }
        throw err;
      }
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      showToast(res?.message || 'Product designated as Front Page Sponsor successfully!', 'success');
    },
    onError: (err: any) => {
      showToast(err.response?.data?.error?.message || err.message || 'Failed to set sponsor product', 'error');
    },
  });

  const openCreateDialog = () => {
    setEditingProduct(null);
    const firstCat = categories?.[0] || DEFAULT_CATEGORIES[0];
    const defaultCatId = firstCat ? (firstCat.id || (firstCat as any)._id) : '';
    setForm({
      name: '',
      sku: `PROD-${Math.floor(100 + Math.random() * 900)}`,
      brand: '',
      category: defaultCatId,
      shortDescription: '',
      longDescription: '',
      mrp: 2999,
      sellingPrice: 2299,
      dealPrice: '',
      inwardPrice: 1400,
      stock: 50,
      lowStockThreshold: 5,
      status: 'active',
      isPublished: true,
      isFeatured: false,
      imageUrl: '',
      imageName: '',
    });
    setFormError(null);
    setUploadError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (p: AdminProduct) => {
    setEditingProduct(p);
    const catId = (p as any).category?._id || (p as any).category?.id || p.categoryId || (p as any).category || '';
    setForm({
      name: p.name,
      sku: p.sku,
      brand: p.brand || '',
      category: String(catId),
      shortDescription: p.shortDescription || '',
      longDescription: p.longDescription || '',
      mrp: ((p.pricing?.mrp ?? 0) / 100),
      sellingPrice: ((p.pricing?.sellingPrice ?? 0) / 100),
      dealPrice: p.pricing?.dealPrice ? String(p.pricing.dealPrice / 100) : '',
      inwardPrice: ((p.pricing?.inwardPrice ?? 0) / 100),
      stock: p.stock,
      lowStockThreshold: p.lowStockThreshold || 5,
      status: p.status,
      isPublished: p.isPublished,
      isFeatured: Boolean(p.isFeatured),
      imageUrl: p.images?.[0]?.url || '',
      imageName: (p.images?.[0] as any)?.name || (p.images?.[0] as any)?.alt || '',
    });
    setFormError(null);
    setUploadError(null);
    setDialogOpen(true);
  };

  const filteredProducts = productsData?.items?.filter((p) => {
    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term) ||
      (p.brand && p.brand.toLowerCase().includes(term))
    );
  }) || [];

  const computedMargin = form.sellingPrice > 0
    ? (((form.sellingPrice - form.inwardPrice) / form.sellingPrice) * 100).toFixed(1)
    : '0';
  const computedProfit = Math.max(0, form.sellingPrice - form.inwardPrice);
  const currentSponsor = productsData?.items?.find((p) => p.isFeatured);

  return (
    <Box>
      {/* Header Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={900} letterSpacing="-0.03em" sx={{ fontSize: { xs: '1.6rem', md: '2rem' } }}>
            Product Catalog & 4-Tier Pricing
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage listings, inward supplier costs, selling rates, flash deals, and gross margins.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreateDialog}
          sx={{ bgcolor: '#0f172a', borderRadius: 1, fontWeight: 700, px: 2.5, py: 1, '&:hover': { bgcolor: '#1e293b' } }}
        >
          Add Product
        </Button>
      </Box>

      {/* Front Page Sponsor Product Status Card */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3,
          bgcolor: currentSponsor ? '#fff7ed' : '#f8fafc',
          border: '1px solid',
          borderColor: currentSponsor ? '#fed7aa' : '#e2e8f0',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              p: 1.25,
              borderRadius: '8px',
              bgcolor: currentSponsor ? '#ffedd5' : '#f1f5f9',
              color: currentSponsor ? '#ea580c' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <StarIcon sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: currentSponsor ? '#c2410c' : '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Storefront Hero Sponsor Product
              </Typography>
              {currentSponsor && (
                <Chip label="ACTIVE ON HOMEPAGE" size="small" sx={{ bgcolor: '#ea580c', color: '#fff', fontWeight: 900, fontSize: 10, height: 18 }} />
              )}
            </Box>
            <Typography variant="subtitle1" fontWeight={800} color={currentSponsor ? '#9a3412' : '#334155'}>
              {currentSponsor
                ? `${currentSponsor.name} (${currentSponsor.sku}) — ₹${((currentSponsor.pricing?.sellingPrice ?? 0) / 100).toLocaleString('en-IN')}`
                : 'No explicit sponsor product selected (first active deal product is shown automatically)'}
            </Typography>
            <Typography variant="caption" sx={{ color: currentSponsor ? '#b45309' : '#64748b' }}>
              Click the star icon next to any product in the table below or toggle it when creating/editing a product to feature it here.
            </Typography>
          </Box>
        </Box>
        {currentSponsor && (
          <Button
            size="small"
            variant="outlined"
            onClick={() => openEditDialog(currentSponsor)}
            sx={{ borderColor: '#fdba74', color: '#c2410c', fontWeight: 700, borderRadius: '6px', '&:hover': { borderColor: '#ea580c', bgcolor: '#ffedd5' } }}
          >
            Edit Sponsor Details
          </Button>
        )}
      </Paper>

      {/* Filter / Search Bar */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: '8px', border: '1px solid #e2e8f0', bgcolor: 'background.paper', display: 'flex', alignItems: 'center', gap: 2 }}>
        <TextField
          size="small"
          placeholder="Filter by name, brand, or SKU…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
          sx={{ maxWidth: 380, width: '100%' }}
        />
        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, ml: 'auto' }}>
          Showing {filteredProducts.length} of {productsData?.total ?? 0} products
        </Typography>
      </Paper>

      {/* Products Table with Responsive Container */}
      <Paper elevation={0} sx={{ borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Product</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#475569' }}>SKU</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Department</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#475569' }}>MRP</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Selling Price</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Inward Cost</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Gross Margin</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Stock</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#475569', textAlign: 'right' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProducts.map((product) => {
                  const mrp = ((product.pricing?.mrp ?? 0) / 100);
                  const selling = ((product.pricing?.sellingPrice ?? 0) / 100);
                  const inward = ((product.pricing?.inwardPrice ?? 0) / 100);
                  const margin = selling > 0 ? (((selling - inward) / selling) * 100).toFixed(0) : '0';

                  return (
                    <TableRow key={product.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                      <TableCell sx={{ minWidth: 240 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Box sx={{ width: 44, height: 44, borderRadius: '6px', overflow: 'hidden', bgcolor: '#f1f5f9', flexShrink: 0 }}>
                            <img
                              src={product.images?.[0]?.url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100&q=80'}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </Box>
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Typography variant="body2" fontWeight={800} sx={{ color: '#0f172a' }}>
                                {product.name}
                              </Typography>
                              {product.isFeatured && (
                                <Chip
                                  icon={<StarIcon sx={{ fontSize: '13px !important', color: '#fff !important' }} />}
                                  label="SPONSOR"
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: 10,
                                    fontWeight: 900,
                                    bgcolor: '#ea580c',
                                    color: '#fff',
                                  }}
                                />
                              )}
                            </Box>
                            {product.brand && (
                              <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 700, display: 'block' }}>
                                {product.brand}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.85rem' }}>
                        {product.sku}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.85rem' }}>
                        {product.categoryName || 'General'}
                      </TableCell>
                      <TableCell sx={{ color: '#94a3b8', textDecoration: mrp > selling ? 'line-through' : 'none' }}>
                        ₹{mrp.toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 900, color: '#0f172a' }}>
                        ₹{selling.toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell sx={{ color: '#64748b', fontWeight: 600 }}>
                        ₹{inward.toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={<TrendingUpIcon sx={{ fontSize: 13, color: '#15803d !important' }} />}
                          label={`+${margin}%`}
                          size="small"
                          sx={{
                            fontWeight: 800,
                            fontSize: 11,
                            bgcolor: '#dcfce7',
                            color: '#15803d',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`${product.stock} left`}
                          size="small"
                          sx={{
                            fontWeight: 800,
                            fontSize: 11,
                            bgcolor: product.stock <= 5 ? '#fee2e2' : '#f1f5f9',
                            color: product.stock <= 5 ? '#b91c1c' : '#334155',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={product.isPublished ? 'Live' : 'Draft'}
                          size="small"
                          sx={{
                            fontWeight: 800,
                            fontSize: 11,
                            bgcolor: product.isPublished ? '#e0e7ff' : '#f1f5f9',
                            color: product.isPublished ? '#4338ca' : '#64748b',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right', minWidth: 130 }}>
                        <Tooltip title={product.isFeatured ? "Active Front Storefront Sponsor" : "Set as Front Page Sponsor Product"}>
                          <IconButton
                            size="small"
                            onClick={() => setSponsorMutation.mutate(product.id)}
                            disabled={setSponsorMutation.isPending}
                            sx={{ color: product.isFeatured ? '#ea580c' : '#cbd5e1', '&:hover': { color: '#ea580c' } }}
                          >
                            <StarIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <IconButton size="small" onClick={() => openEditDialog(product)} title="Edit Product">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            setArchiveDialog({
                              open: true,
                              productId: product.id,
                              productName: product.name,
                            });
                          }}
                          title="Archive Product"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Create / Edit Dialog with Live Margin Calculator */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '10px' } }}>
        <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>
          {editingProduct ? 'Edit Product & Pricing' : 'Add New Flagship Product'}
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          {formError && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: '6px' }}>{formError}</Alert>
          )}

          <Grid container spacing={3}>
            <Grid item xs={12} sm={8}>
              <TextField
                label="Product Title"
                required
                fullWidth
                size="small"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="SKU"
                required
                fullWidth
                size="small"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Brand"
                fullWidth
                size="small"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Category / Department"
                required
                fullWidth
                size="small"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                InputLabelProps={{ shrink: true }}
                SelectProps={{
                  displayEmpty: true,
                  renderValue: (selected) => {
                    const selStr = String(selected || '');
                    if (!selStr) {
                      return (
                        <Typography component="span" sx={{ color: 'text.disabled', fontStyle: 'italic', fontSize: '0.875rem' }}>
                          Select a Category
                        </Typography>
                      );
                    }
                    const found = categories.find((c) => (c.id || c._id) === selStr || c.slug === selStr || c.name === selStr);
                    return found ? found.name : selStr;
                  },
                }}
                error={Boolean(formError && !form.category)}
                helperText={!form.category ? 'Please select a product category' : ''}
              >
                <MenuItem value="" disabled sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                  Select a Category
                </MenuItem>
                {categories.map((cat, idx) => {
                  const val = cat.id || cat._id || `cat-${idx}`;
                  return (
                    <MenuItem key={val} value={val}>
                      {cat.name}
                    </MenuItem>
                  );
                })}
              </TextField>
            </Grid>

            {/* 4-Tier Pricing Configuration */}
            <Grid item xs={12}>
              <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2" fontWeight={900} color="#0f172a">
                    4-TIER PRICING & MARGIN ANALYSIS
                  </Typography>
                  <Chip
                    label={`Gross Margin: ₹${computedProfit.toLocaleString('en-IN')} (+${computedMargin}%)`}
                    size="small"
                    color={Number(computedMargin) >= 20 ? 'success' : 'warning'}
                    sx={{ fontWeight: 800 }}
                  />
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      label="MRP (₹)"
                      type="number"
                      required
                      fullWidth
                      size="small"
                      value={form.mrp}
                      onChange={(e) => setForm({ ...form, mrp: Number(e.target.value) })}
                      helperText="Maximum Retail Price"
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      label="Selling Price (₹)"
                      type="number"
                      required
                      fullWidth
                      size="small"
                      value={form.sellingPrice}
                      onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })}
                      helperText="Customer Selling Price"
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      label="Deal Price (₹, optional)"
                      type="number"
                      fullWidth
                      size="small"
                      value={form.dealPrice}
                      onChange={(e) => setForm({ ...form, dealPrice: e.target.value })}
                      helperText="Promo Flash Deal"
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      label="Inward Cost Price (₹)"
                      type="number"
                      required
                      fullWidth
                      size="small"
                      value={form.inwardPrice}
                      onChange={(e) => setForm({ ...form, inwardPrice: Number(e.target.value) })}
                      helperText="Store Supplier Cost"
                    />
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            {/* Stock & Inventory */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Stock Quantity"
                type="number"
                fullWidth
                size="small"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Low Stock Threshold"
                type="number"
                fullWidth
                size="small"
                value={form.lowStockThreshold}
                onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })}
              />
            </Grid>

            {/* ImageKit Product Image Upload Section */}
            <Grid item xs={12}>
              <Box sx={{ mb: 0.75 }}>
                <Typography variant="caption" fontWeight={800} color="#334155" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Product Image (ImageKit CDN)
                </Typography>
              </Box>

              {/* Hidden Native File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
              />

              {uploadError && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }} onClose={() => setUploadError(null)}>
                  {uploadError}
                </Alert>
              )}

              {uploadingImage ? (
                <Paper
                  elevation={0}
                  sx={{
                    p: 3.5,
                    borderRadius: '10px',
                    border: '2px dashed #FF7900',
                    bgcolor: 'rgba(255, 121, 0, 0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1.5,
                  }}
                >
                  <CircularProgress size={36} sx={{ color: '#FF7900' }} />
                  <Typography variant="subtitle2" fontWeight={800} color="#0f172a">
                    Uploading image to ImageKit CDN...
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Optimizing resolution and generating global CDN asset
                  </Typography>
                </Paper>
              ) : form.imageUrl ? (
                /* Uploaded Image Preview & Details Card */
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    bgcolor: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 2,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box
                      component="img"
                      src={form.imageUrl}
                      alt={form.imageName || form.name || 'Product'}
                      sx={{
                        width: 76,
                        height: 76,
                        borderRadius: '8px',
                        objectFit: 'cover',
                        border: '1px solid #cbd5e1',
                        bgcolor: '#FFFFFF',
                      }}
                    />
                    <Box sx={{ maxWidth: { xs: 260, sm: 420 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                        <Chip
                          icon={<CheckCircleIcon sx={{ fontSize: 14, color: '#16a34a !important' }} />}
                          label="ImageKit Hosted"
                          size="small"
                          sx={{
                            fontWeight: 800,
                            fontSize: 11,
                            bgcolor: '#dcfce7',
                            color: '#16a34a',
                            height: 22,
                          }}
                        />
                        {form.imageName && (
                          <Typography variant="caption" fontWeight={700} color="#334155" noWrap sx={{ maxWidth: 280 }}>
                            {form.imageName}
                          </Typography>
                        )}
                      </Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: 'block',
                          wordBreak: 'break-all',
                          fontSize: '0.75rem',
                          fontFamily: 'monospace',
                          bgcolor: '#ffffff',
                          py: 0.25,
                          px: 1,
                          borderRadius: '4px',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        {form.imageUrl}
                      </Typography>
                    </Box>
                  </Box>

                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<CloudUploadIcon />}
                      onClick={() => fileInputRef.current?.click()}
                      sx={{
                        borderRadius: '6px',
                        textTransform: 'none',
                        fontWeight: 700,
                        borderColor: '#cbd5e1',
                        color: '#334155',
                        '&:hover': { borderColor: '#FF7900', color: '#FF7900' },
                      }}
                    >
                      Replace Image
                    </Button>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setForm({ ...form, imageUrl: '', imageName: '' })}
                      title="Remove Image"
                      sx={{ bgcolor: '#fee2e2', '&:hover': { bgcolor: '#fecaca' } }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Paper>
              ) : (
                /* Drag & Drop Upload Dropzone */
                <Paper
                  elevation={0}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                  sx={{
                    p: 3.5,
                    borderRadius: '10px',
                    border: '2px dashed #cbd5e1',
                    bgcolor: '#f8fafc',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: '#FF7900',
                      bgcolor: 'rgba(255, 121, 0, 0.03)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      bgcolor: 'rgba(255, 121, 0, 0.1)',
                      color: '#FF7900',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 1.25,
                    }}
                  >
                    <CloudUploadIcon sx={{ fontSize: 26 }} />
                  </Box>
                  <Typography variant="subtitle2" fontWeight={800} color="#0f172a">
                    Click to upload product image, or drag and drop here
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Supports PNG, JPG, WEBP, or GIF up to 15MB. Automatically uploaded to ImageKit CDN.
                  </Typography>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<CloudUploadIcon />}
                    sx={{
                      mt: 1.75,
                      bgcolor: '#FF7900',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      borderRadius: '6px',
                      textTransform: 'none',
                      '&:hover': { bgcolor: '#E85D04' },
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    Select Image File
                  </Button>
                </Paper>
              )}
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Short Description"
                fullWidth
                multiline
                rows={2}
                size="small"
                value={form.shortDescription}
                onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
                placeholder="Brief summary shown in product listings and cards..."
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Long Description"
                fullWidth
                multiline
                rows={4}
                size="small"
                value={form.longDescription}
                onChange={(e) => setForm({ ...form, longDescription: e.target.value })}
                placeholder="Comprehensive description, specifications, features, materials, and warranty information..."
                helperText="Detailed overview displayed on the product details page"
              />
            </Grid>

            <Grid item xs={12}>
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  bgcolor: form.isFeatured ? '#fff7ed' : '#f8fafc',
                  border: '1px solid',
                  borderColor: form.isFeatured ? '#fed7aa' : '#e2e8f0',
                  borderRadius: '6px',
                }}
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.isFeatured}
                      onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                      color="warning"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <StarIcon sx={{ color: form.isFeatured ? '#ea580c' : '#94a3b8', fontSize: 18 }} />
                      <Typography variant="body2" fontWeight={800} color={form.isFeatured ? '#c2410c' : 'text.primary'}>
                        Set as Front Storefront Sponsor Product (Featured on Homepage Hero)
                      </Typography>
                    </Box>
                  }
                />
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isPublished}
                    onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                    color="primary"
                  />
                }
                label={<Typography variant="body2" fontWeight={700}>Publish immediately to customer storefront</Typography>}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ fontWeight: 700, color: '#64748b' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            sx={{ bgcolor: '#FF7900', fontWeight: 800, borderRadius: '6px', px: 3, '&:hover': { bgcolor: '#E85D04' } }}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save & Publish Product'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Archive / Delete Confirmation Dialog */}
      <Dialog
        open={archiveDialog.open}
        onClose={() => setArchiveDialog({ open: false, productId: null, productName: '' })}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px', p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, pb: 1, color: '#0f172a' }}>
          Archive Product
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to archive <strong>{archiveDialog.productName}</strong>?
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            This product will be unpublished and hidden from customer storefront browsing.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1, gap: 1 }}>
          <Button
            onClick={() => setArchiveDialog({ open: false, productId: null, productName: '' })}
            sx={{ fontWeight: 700, color: '#64748b' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (archiveDialog.productId) {
                deleteMutation.mutate(archiveDialog.productId);
              }
            }}
            sx={{ fontWeight: 800, borderRadius: '8px', px: 2.5 }}
          >
            {deleteMutation.isPending ? 'Archiving…' : 'Archive Product'}
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

