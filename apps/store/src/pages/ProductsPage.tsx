import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Stack,
  TextField,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Alert,
  InputAdornment,
  Switch,
  FormControlLabel,
  Tooltip,
  IconButton,
  MenuItem,
  Snackbar,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Inventory2 as ProductsIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import api from '../api/client';
import { useStoreAuthStore } from '../store/auth.store';
import { ProductImageUploader, type ProductImageItem } from '../components/ProductImageUploader';

export default function ProductsPage() {
  const { store, updateStoreProfile } = useStoreAuthStore();
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

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

  // Add Product Dialog State
  const [openAddModal, setOpenAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Add Product Form Fields
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [brand, setBrand] = useState('');
  const [mrp, setMrp] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [inwardPrice, setInwardPrice] = useState('');
  const [stock, setStock] = useState('10');
  const [lowStockThreshold, setLowStockThreshold] = useState('3');
  const [images, setImages] = useState<ProductImageItem[]>([]);
  const [shortDescription, setShortDescription] = useState('');
  const [addStatus, setAddStatus] = useState<'active' | 'inactive'>('active');

  // Edit Product Dialog State
  const [openEditModal, setOpenEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Edit Form Fields
  const [editName, setEditName] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editMrp, setEditMrp] = useState('');
  const [editSellingPrice, setEditSellingPrice] = useState('');
  const [editInwardPrice, setEditInwardPrice] = useState('');
  const [editStock, setEditStock] = useState('10');
  const [editLowStockThreshold, setEditLowStockThreshold] = useState('3');
  const [editImages, setEditImages] = useState<ProductImageItem[]>([]);
  const [editShortDescription, setEditShortDescription] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (search.trim()) queryParams.set('search', search.trim());
      if (statusFilter !== 'all') queryParams.set('status', statusFilter);

      const resp = await api.get(`/store/products?${queryParams.toString()}`);
      if (resp.data?.success) {
        setProducts(resp.data.data?.items || []);
      }

      // Refresh store profile to get latest stock totals and capacity
      api.get('/store/me').then((sResp) => {
        if (sResp.data?.success && sResp.data.data) {
          updateStoreProfile(sResp.data.data);
        }
      }).catch(() => {});
    } catch (err) {
      console.error('Failed to load products', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [search, statusFilter]);

  // One-click Toggle Active/Inactive Handler
  const handleToggleStatus = async (prod: any) => {
    const prodId = prod.id || prod._id;
    const isCurrentlyActive = prod.status === 'active' && prod.isPublished !== false;
    const newStatus = isCurrentlyActive ? 'inactive' : 'active';
    const newPublished = !isCurrentlyActive;

    setActionLoadingId(prodId);
    try {
      const resp = await api.patch(`/store/products/${prodId}`, {
        status: newStatus,
        isPublished: newPublished,
      });

      if (resp.data?.success) {
        // Optimistic local state update
        setProducts((prev) =>
          prev.map((p) =>
            (p.id === prodId || p._id === prodId)
              ? { ...p, status: newStatus, isPublished: newPublished }
              : p
          )
        );
        showToast(
          newStatus === 'active'
            ? `"${prod.name}" activated and enabled in storefront!`
            : `"${prod.name}" disabled / marked as inactive.`,
          'success'
        );
      }
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || 'Failed to update product status.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (prod: any) => {
    setEditingProduct(prod);
    setEditName(prod.name || '');
    setEditBrand(prod.brand || '');
    const mrpPaise = prod.pricing?.mrp || 0;
    const sellingPaise = prod.pricing?.sellingPrice || prod.pricing?.applicablePrice || 0;
    const inwardPaise = prod.pricing?.inwardPrice || sellingPaise;
    setEditMrp(mrpPaise > 0 ? String(mrpPaise / 100) : '');
    setEditSellingPrice(sellingPaise > 0 ? String(sellingPaise / 100) : '');
    setEditInwardPrice(inwardPaise > 0 ? String(inwardPaise / 100) : '');
    setEditStock(String(prod.stock ?? 0));
    setEditLowStockThreshold(String(prod.lowStockThreshold ?? 3));
    setEditShortDescription(prod.shortDescription || '');
    const isActive = prod.status === 'active' && prod.isPublished !== false;
    setEditStatus(isActive ? 'active' : 'inactive');

    const initialImages: ProductImageItem[] = (prod.images || []).map((img: any, idx: number) => ({
      id: img.id || `img_${idx}`,
      url: img.url,
      name: img.name || img.alt || prod.name,
      alt: img.alt || img.name || prod.name,
      order: img.order ?? idx,
    }));
    setEditImages(initialImages);
    setEditError(null);
    setOpenEditModal(true);
  };

  // Save Edit Handler
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setEditError(null);

    const mrpPaise = Math.round(parseFloat(editMrp || '0') * 100);
    const sellingPaise = Math.round(parseFloat(editSellingPrice || '0') * 100);
    const inwardPaise = Math.round(parseFloat(editInwardPrice || editSellingPrice || '0') * 100);

    if (!editName.trim()) {
      setEditError('Product name is required.');
      return;
    }

    if (sellingPaise <= 0 || mrpPaise <= 0) {
      setEditError('Please enter valid MRP and Selling Price.');
      return;
    }

    if (sellingPaise > mrpPaise) {
      setEditError('Selling Price cannot exceed MRP.');
      return;
    }

    setIsUpdating(true);
    try {
      const prodId = editingProduct.id || editingProduct._id;
      const isAct = editStatus === 'active';
      const payload: Record<string, any> = {
        name: editName.trim(),
        brand: editBrand.trim() || undefined,
        shortDescription: editShortDescription.trim() || undefined,
        stock: parseInt(editStock, 10) || 0,
        lowStockThreshold: parseInt(editLowStockThreshold, 10) || 3,
        status: editStatus,
        isPublished: isAct,
        pricing: {
          mrp: mrpPaise,
          sellingPrice: sellingPaise,
          inwardPrice: inwardPaise,
        },
        images: editImages.map((img, idx) => ({
          id: img.id || `img_${idx}`,
          url: img.url,
          name: img.name || editName.trim(),
          alt: img.alt || editName.trim(),
          order: idx,
        })),
      };

      const resp = await api.patch(`/store/products/${prodId}`, payload);
      if (resp.data?.success) {
        setOpenEditModal(false);
        setEditingProduct(null);
        showToast('Product updated successfully!', 'success');
        loadProducts();
      }
    } catch (err: any) {
      setEditError(err.response?.data?.error?.message || 'Failed to update product.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Create Product Handler
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const mrpPaise = Math.round(parseFloat(mrp || '0') * 100);
    const sellingPaise = Math.round(parseFloat(sellingPrice || '0') * 100);
    const inwardPaise = Math.round(parseFloat(inwardPrice || sellingPrice || '0') * 100);

    if (!name.trim() || !sku.trim()) {
      setModalError('Product name and SKU are required.');
      return;
    }

    if (sellingPaise <= 0 || mrpPaise <= 0) {
      setModalError('Please enter valid MRP and Selling Price.');
      return;
    }

    if (sellingPaise > mrpPaise) {
      setModalError('Selling Price cannot exceed MRP.');
      return;
    }

    setIsSubmitting(true);
    try {
      const isAct = addStatus === 'active';
      const payload = {
        name: name.trim(),
        sku: sku.trim().toUpperCase(),
        brand: brand.trim() || undefined,
        subcategoryId: store?.subcategoryId || undefined,
        shortDescription: shortDescription.trim() || undefined,
        stock: parseInt(stock, 10) || 0,
        lowStockThreshold: parseInt(lowStockThreshold, 10) || 3,
        status: addStatus,
        isPublished: isAct,
        pricing: {
          mrp: mrpPaise,
          sellingPrice: sellingPaise,
          inwardPrice: inwardPaise,
        },
        images: images.map((img, idx) => ({
          id: img.id || `img_${idx}`,
          url: img.url,
          name: img.name || name.trim(),
          alt: img.alt || name.trim(),
          order: idx,
        })),
      };

      const resp = await api.post('/store/products', payload);
      if (resp.data?.success) {
        setOpenAddModal(false);
        // Reset form
        setName('');
        setSku('');
        setBrand('');
        setMrp('');
        setSellingPrice('');
        setInwardPrice('');
        setImages([]);
        setShortDescription('');
        setAddStatus('active');
        showToast('Product added successfully!', 'success');
        loadProducts();
      }
    } catch (err: any) {
      setModalError(err.response?.data?.error?.message || 'Failed to create product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#172B30' }}>
              Subcategory Products & Inventory
            </Typography>
            <Chip
              label={store?.subcategoryName ? `${store.categoryName || 'Category'} > ${store.subcategoryName}` : (store?.categoryName || 'General')}
              size="small"
              sx={{ bgcolor: '#FF7900', color: '#FFFFFF', fontWeight: 700 }}
            />
            {store?.typeOfStore && (
              <Chip
                label={`${store.typeOfStore} Tier`}
                size="small"
                variant="outlined"
                sx={{ borderColor: '#CBD5E1', color: '#475569', fontWeight: 600, fontSize: '0.75rem' }}
              />
            )}
          </Box>
          <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
            Manage product inventory, pricing, and live storefront status for your dedicated subcategory.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenAddModal(true)}
          sx={{ fontWeight: 700, bgcolor: '#FF7900', '&:hover': { bgcolor: '#E85D04' } }}
        >
          Add Product
        </Button>
      </Box>

      {/* Stock Capacity Progress Meter */}
      {store && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 3,
            borderRadius: 2.5,
            border: '1px solid #E2E8F0',
            bgcolor: '#FFFFFF',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ProductsIcon sx={{ color: '#FF7900', fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#172B30' }}>
                Store Physical Stock Capacity ({store.typeOfStore || 'Standard'} Tier)
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
              Occupied: {store.currentStockTotal ?? 0} / {store.maxStockLimit ?? 2500} units ({Math.min(100, Math.round(((store.currentStockTotal ?? 0) / (store.maxStockLimit ?? 2500)) * 100))}%)
            </Typography>
          </Box>
          {(() => {
            const maxL = store.maxStockLimit ?? 2500;
            const curL = store.currentStockTotal ?? 0;
            const pct = Math.min(100, Math.round((curL / maxL) * 100));
            const available = Math.max(0, maxL - curL);
            return (
              <>
                <LinearProgress
                  variant="determinate"
                  value={pct}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: '#E2E8F0',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 4,
                      bgcolor: pct >= 90 ? '#EF4444' : pct >= 75 ? '#F59E0B' : '#10B981',
                    },
                  }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                  <Typography variant="caption" sx={{ color: available > 0 ? '#047857' : '#B91C1C', fontWeight: 600 }}>
                    {available > 0
                      ? `${available.toLocaleString()} units remaining for new or restocked products`
                      : 'Store capacity full: Any newly added units will overflow into the unassigned queue'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>
                    Dedicated Subcategory: <strong>{store.subcategoryName || store.categoryName || 'General'}</strong>
                  </Typography>
                </Box>
              </>
            );
          })()}
        </Paper>
      )}

      {/* Filter & Search Bar */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 2.5, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search by product title or SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ maxWidth: 360, width: '100%' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: '#94A3B8' }} />
              </InputAdornment>
            ),
          }}
        />

        <TextField
          select
          size="small"
          label="Filter Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="all">All Statuses</MenuItem>
          <MenuItem value="active">Active Only</MenuItem>
          <MenuItem value="inactive">Inactive / Disabled</MenuItem>
        </TextField>

        <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, ml: 'auto' }}>
          Showing {products.length} product{products.length === 1 ? '' : 's'}
        </Typography>
      </Paper>

      {/* Products Table */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF', overflow: 'hidden' }}>
        {isLoading ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <CircularProgress size={32} sx={{ color: '#FF7900' }} />
          </Box>
        ) : products.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center', color: '#94A3B8' }}>
            <ProductsIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
            <Typography variant="body1" sx={{ fontWeight: 600 }}>No products found.</Typography>
            <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
              Click "Add Product" to create your first item or clear filter criteria.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Product</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>SKU</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Selling Price</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Stock</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Source / Attribution</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569', textAlign: 'center', minWidth: 170 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {products.map((prod) => {
                  const prodId = prod.id || prod._id;
                  const selling = prod.pricing?.applicablePrice || prod.pricing?.sellingPrice || 0;
                  const mrpVal = prod.pricing?.mrp || selling;
                  const isStoreAdded = prod.storeId === store?.storeId;
                  const isProdActive = prod.status === 'active' && prod.isPublished !== false;
                  const isPendingToggle = actionLoadingId === prodId;

                  return (
                    <TableRow key={prodId} hover>
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Box
                            component="img"
                            src={prod.images?.[0]?.url || 'https://placehold.co/48x48?text=Product'}
                            alt={prod.name}
                            sx={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 1.5, border: '1px solid #E2E8F0' }}
                          />
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#172B30' }}>
                              {prod.name}
                            </Typography>
                            {prod.brand && (
                              <Typography variant="caption" sx={{ color: '#64748B' }}>
                                {prod.brand}
                              </Typography>
                            )}
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#475569' }}>
                        {prod.sku}
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Chip
                            label={prod.subcategoryName || prod.categoryName || store?.subcategoryName || store?.categoryName || 'General'}
                            size="small"
                            sx={{ bgcolor: '#FFF7ED', color: '#FF7900', fontWeight: 700, fontSize: '0.7rem' }}
                          />
                          {prod.subcategoryName && prod.categoryName && (
                            <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.65rem' }}>
                              under {prod.categoryName}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#172B30' }}>
                          ₹{(selling / 100).toFixed(2)}
                        </Typography>
                        {mrpVal > selling && (
                          <Typography variant="caption" sx={{ color: '#94A3B8', textDecoration: 'line-through' }}>
                            ₹{(mrpVal / 100).toFixed(2)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Chip
                            label={`${prod.stock ?? 0} in stock`}
                            size="small"
                            sx={{
                              bgcolor: (prod.stock ?? 0) <= 3 ? '#FEF2F2' : '#ECFDF5',
                              color: (prod.stock ?? 0) <= 3 ? '#B91C1C' : '#047857',
                              fontWeight: 700,
                            }}
                          />
                          {prod.assignmentStatus === 'partially_assigned' && (
                            <Chip
                              label={`${prod.assignedStock} store / ${prod.unassignedStock} queue`}
                              size="small"
                              sx={{ bgcolor: '#FEF3C7', color: '#B45309', fontWeight: 600, fontSize: '0.65rem' }}
                            />
                          )}
                          {prod.assignmentStatus === 'unassigned' && (
                            <Chip
                              label="Unassigned Queue"
                              size="small"
                              sx={{ bgcolor: '#FEF2F2', color: '#B91C1C', fontWeight: 600, fontSize: '0.65rem' }}
                            />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {isStoreAdded ? (
                          <Chip
                            label="Added by My Store"
                            size="small"
                            sx={{ bgcolor: '#EFF6FF', color: '#2563EB', fontWeight: 700, fontSize: '0.7rem' }}
                          />
                        ) : (
                          <Chip
                            label="Central Admin Catalog"
                            size="small"
                            sx={{ bgcolor: '#F1F5F9', color: '#475569', fontWeight: 600, fontSize: '0.7rem' }}
                          />
                        )}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                          <Tooltip title={isProdActive ? "Click to Disable / Deactivate product" : "Click to Enable / Activate product"}>
                            <span>
                              {isPendingToggle ? (
                                <CircularProgress size={18} sx={{ mx: 0.5 }} />
                              ) : (
                                <Switch
                                  size="small"
                                  checked={isProdActive}
                                  onChange={() => handleToggleStatus(prod)}
                                  color="success"
                                />
                              )}
                            </span>
                          </Tooltip>
                          <Chip
                            label={isProdActive ? 'Active' : 'Inactive'}
                            size="small"
                            sx={{
                              bgcolor: isProdActive ? '#ECFDF5' : '#FEF2F2',
                              color: isProdActive ? '#047857' : '#B91C1C',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              textTransform: 'capitalize',
                            }}
                          />
                          <Tooltip title="Edit Product">
                            <IconButton size="small" onClick={() => handleOpenEdit(prod)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Add Product Modal */}
      <Dialog open={openAddModal} onClose={() => setOpenAddModal(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#172B30', borderBottom: '1px solid #E2E8F0' }}>
          Add Product to {store?.subcategoryName || store?.categoryName || 'Subcategory'}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {modalError && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
              {modalError}
            </Alert>
          )}

          <Box component="form" onSubmit={handleCreateProduct}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  label="Product Title *"
                  placeholder="e.g. Sony WH-1000XM5 Wireless Headphones"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="SKU Code *"
                  placeholder="e.g. SNY-WH-001"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Brand Name"
                  placeholder="e.g. Sony"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  disabled
                  label="Designated Subcategory & Category"
                  value={store?.subcategoryName ? `${store.subcategoryName} (${store.categoryName || 'General'})` : (store?.categoryName || 'General')}
                  helperText={`Store capacity: ${store?.currentStockTotal ?? 0} / ${store?.maxStockLimit ?? 2500} units`}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="MRP (₹) *"
                  placeholder="e.g. 29999"
                  type="number"
                  value={mrp}
                  onChange={(e) => setMrp(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Selling Price (₹) *"
                  placeholder="e.g. 24999"
                  type="number"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Cost / Inward (₹)"
                  placeholder="e.g. 22000"
                  type="number"
                  value={inwardPrice}
                  onChange={(e) => setInwardPrice(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Stock Inventory *"
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Low Stock Alert Threshold"
                  type="number"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                />
              </Grid>

              {(() => {
                const maxL = store?.maxStockLimit ?? 2500;
                const curL = store?.currentStockTotal ?? 0;
                const avail = Math.max(0, maxL - curL);
                const reqStock = parseInt(stock, 10) || 0;
                if (reqStock > avail) {
                  return (
                    <Grid item xs={12}>
                      <Alert severity="warning" sx={{ py: 0.5, px: 1.5, fontSize: '0.8rem' }}>
                        Notice: Requested stock ({reqStock} units) exceeds available store capacity ({avail} units remaining). {avail} units will be allocated to your store immediately, and the remaining {reqStock - avail} units will be placed in the central unassigned overflow queue for future stores.
                      </Alert>
                    </Grid>
                  );
                }
                return null;
              })()}

              {/* Status / Active Selection */}
              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    bgcolor: addStatus === 'active' ? '#F0FDF4' : '#FEF2F2',
                    border: '1px solid',
                    borderColor: addStatus === 'active' ? '#BBF7D0' : '#FECACA',
                    borderRadius: 2,
                  }}
                >
                  <FormControlLabel
                    control={
                      <Switch
                        checked={addStatus === 'active'}
                        onChange={(e) => setAddStatus(e.target.checked ? 'active' : 'inactive')}
                        color="success"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight={800} color={addStatus === 'active' ? '#15803D' : '#B91C1C'}>
                          {addStatus === 'active' ? 'Active Product (Visible in Customer Storefront)' : 'Inactive / Disabled Product (Hidden)'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {addStatus === 'active'
                            ? 'Customers will be able to see and buy this product immediately.'
                            : 'This product will be saved as disabled/inactive and will not appear on the storefront.'}
                        </Typography>
                      </Box>
                    }
                  />
                </Paper>
              </Grid>

              {/* Product Images (Multi-Image Gallery & Card Cover Selection) */}
              <Grid item xs={12}>
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" fontWeight={800} color="#334155" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Product Images (ImageKit CDN)
                  </Typography>
                </Box>
                <ProductImageUploader
                  images={images}
                  onChange={setImages}
                  uploadEndpoint="/store/products/upload-images"
                  singleUploadEndpoint="/store/products/upload-image"
                  onTitleSuggest={(suggestedTitle) => {
                    if (!name.trim()) setName(suggestedTitle);
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Short Description"
                  placeholder="Key features and specifications..."
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid #E2E8F0' }}>
          <Button onClick={() => setOpenAddModal(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleCreateProduct}
            variant="contained"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <AddIcon />}
            sx={{ fontWeight: 700, bgcolor: '#FF7900', '&:hover': { bgcolor: '#E85D04' } }}
          >
            {isSubmitting ? 'Creating Product...' : addStatus === 'active' ? 'Publish to Catalog' : 'Save as Inactive'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Product Modal */}
      <Dialog open={openEditModal} onClose={() => setOpenEditModal(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#172B30', borderBottom: '1px solid #E2E8F0' }}>
          Edit Product: {editingProduct?.name}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {editError && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
              {editError}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSaveEdit}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  label="Product Title *"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  disabled
                  label="SKU Code"
                  value={editingProduct?.sku || ''}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Brand Name"
                  value={editBrand}
                  onChange={(e) => setEditBrand(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  disabled
                  label="Category"
                  value={editingProduct?.categoryName || store?.categoryName || 'General'}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="MRP (₹) *"
                  type="number"
                  value={editMrp}
                  onChange={(e) => setEditMrp(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Selling Price (₹) *"
                  type="number"
                  value={editSellingPrice}
                  onChange={(e) => setEditSellingPrice(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Cost / Inward (₹)"
                  type="number"
                  value={editInwardPrice}
                  onChange={(e) => setEditInwardPrice(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Stock Inventory *"
                  type="number"
                  value={editStock}
                  onChange={(e) => setEditStock(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Low Stock Alert Threshold"
                  type="number"
                  value={editLowStockThreshold}
                  onChange={(e) => setEditLowStockThreshold(e.target.value)}
                />
              </Grid>

              {/* Status Selector / Toggle */}
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Product Status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                >
                  <MenuItem value="active">Active (Visible in Storefront)</MenuItem>
                  <MenuItem value="inactive">Inactive / Disabled (Hidden from Storefront)</MenuItem>
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.2,
                    bgcolor: editStatus === 'active' ? '#F0FDF4' : '#FEF2F2',
                    border: '1px solid',
                    borderColor: editStatus === 'active' ? '#BBF7D0' : '#FECACA',
                    borderRadius: 2,
                  }}
                >
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editStatus === 'active'}
                        onChange={(e) => setEditStatus(e.target.checked ? 'active' : 'inactive')}
                        color="success"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight={800} color={editStatus === 'active' ? '#15803D' : '#B91C1C'}>
                          {editStatus === 'active' ? 'Product Enabled' : 'Product Disabled / Inactive'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {editStatus === 'active' ? 'Visible to customers' : 'Hidden from customers'}
                        </Typography>
                      </Box>
                    }
                  />
                </Paper>
              </Grid>

              {/* Images */}
              <Grid item xs={12}>
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" fontWeight={800} color="#334155" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Product Images (ImageKit CDN)
                  </Typography>
                </Box>
                <ProductImageUploader
                  images={editImages}
                  onChange={setEditImages}
                  uploadEndpoint="/store/products/upload-images"
                  singleUploadEndpoint="/store/products/upload-image"
                  onTitleSuggest={(suggestedTitle) => {
                    if (!editName.trim()) setEditName(suggestedTitle);
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Short Description"
                  value={editShortDescription}
                  onChange={(e) => setEditShortDescription(e.target.value)}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid #E2E8F0' }}>
          <Button onClick={() => setOpenEditModal(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleSaveEdit}
            variant="contained"
            disabled={isUpdating}
            startIcon={isUpdating ? <CircularProgress size={18} color="inherit" /> : null}
            sx={{ fontWeight: 700, bgcolor: '#FF7900', '&:hover': { bgcolor: '#E85D04' } }}
          >
            {isUpdating ? 'Saving Changes...' : 'Save Product Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setToast({ ...toast, open: false })}
          severity={toast.severity}
          variant="filled"
          sx={{ width: '100%', fontWeight: 700, borderRadius: 2 }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
