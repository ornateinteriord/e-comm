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
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Inventory2 as ProductsIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import api from '../api/client';
import { useStoreAuthStore } from '../store/auth.store';
import { ProductImageUploader, type ProductImageItem } from '../components/ProductImageUploader';

export default function ProductsPage() {
  const { store } = useStoreAuthStore();
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add Product Dialog State
  const [openAddModal, setOpenAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // New Product Form Fields
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

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const resp = await api.get(`/store/products?search=${encodeURIComponent(search.trim())}`);
      if (resp.data?.success) {
        setProducts(resp.data.data?.items || []);
      }
    } catch (err) {
      console.error('Failed to load products', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [search]);

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
      const payload = {
        name: name.trim(),
        sku: sku.trim().toUpperCase(),
        brand: brand.trim() || undefined,
        shortDescription: shortDescription.trim() || undefined,
        stock: parseInt(stock, 10) || 0,
        lowStockThreshold: parseInt(lowStockThreshold, 10) || 3,
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#172B30' }}>
              Category Products & Catalog
            </Typography>
            <Chip
              label={store?.categoryName || 'General'}
              size="small"
              sx={{ bgcolor: '#FF7900', color: '#FFFFFF', fontWeight: 700 }}
            />
          </Box>
          <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
            All products added here synchronize bidirectionally with the central Admin catalog.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenAddModal(true)}
          sx={{ fontWeight: 700 }}
        >
          Add Product
        </Button>
      </Box>

      {/* Filter & Search Bar */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 2.5, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF' }}>
        <TextField
          placeholder="Search by product title or SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ maxWidth: 400 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: '#94A3B8' }} />
              </InputAdornment>
            ),
          }}
        />
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
            <Typography variant="body1" sx={{ fontWeight: 600 }}>No products found in this category.</Typography>
            <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
              Click "Add Product" to create your first item.
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
                  <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {products.map((prod) => {
                  const selling = prod.pricing?.applicablePrice || prod.pricing?.sellingPrice || 0;
                  const mrpVal = prod.pricing?.mrp || selling;
                  const isStoreAdded = prod.storeId === store?.storeId;

                  return (
                    <TableRow key={prod.id || prod._id} hover>
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
                        <Chip
                          label={prod.categoryName || store?.categoryName}
                          size="small"
                          sx={{ bgcolor: '#FFF7ED', color: '#FF7900', fontWeight: 700, fontSize: '0.7rem' }}
                        />
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
                        <Chip
                          label={`${prod.stock ?? 0} in stock`}
                          size="small"
                          sx={{
                            bgcolor: (prod.stock ?? 0) <= 3 ? '#FEF2F2' : '#ECFDF5',
                            color: (prod.stock ?? 0) <= 3 ? '#B91C1C' : '#047857',
                            fontWeight: 700,
                          }}
                        />
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
                      <TableCell>
                        <Chip
                          label={prod.status || 'Active'}
                          size="small"
                          sx={{
                            bgcolor: prod.status === 'active' ? '#ECFDF5' : '#F1F5F9',
                            color: prod.status === 'active' ? '#047857' : '#64748B',
                            fontWeight: 700,
                            textTransform: 'capitalize',
                          }}
                        />
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
          Add Product to {store?.categoryName || 'Category'}
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
                  label="Category (Locked to Store)"
                  value={store?.categoryName || 'General'}
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
            sx={{ fontWeight: 700 }}
          >
            {isSubmitting ? 'Creating Product...' : 'Publish to Catalog'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

