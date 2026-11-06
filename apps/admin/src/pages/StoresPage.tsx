import React, { useState, useEffect, useRef } from 'react';
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
  MenuItem,
  IconButton,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Storefront as StorefrontIcon,
  Place as PlaceIcon,
  TableChart as TableViewIcon,
  Map as MapViewIcon,
  CheckCircle as ActiveIcon,
  HourglassTop as PendingIcon,
  Block as SuspendedIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import maplibregl from 'maplibre-gl';
import api from '../api/client';

export default function StoresPage() {
  const [stores, setStores] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');

  // Add Store Dialog State
  const [openAddModal, setOpenAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // New Store Form Fields
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');
  const [lat, setLat] = useState('12.9716');
  const [lng, setLng] = useState('77.5946');

  // Map Container Ref
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [storesResp, catsResp] = await Promise.all([
        api.get(`/admin/stores?search=${encodeURIComponent(search.trim())}`),
        api.get('/store/categories/available').catch(() => ({ data: { data: [] } })),
      ]);

      if (storesResp.data?.success) {
        setStores(storesResp.data.data || []);
      }
      if (catsResp.data?.success) {
        setCategories(catsResp.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load stores data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  // Handle Status Toggle
  const handleStatusChange = async (storeId: string, newStatus: string) => {
    try {
      await api.patch(`/admin/stores/${storeId}/status`, { status: newStatus });
      loadData();
    } catch (err) {
      console.error('Failed to update store status', err);
    }
  };

  // Handle Delete Store
  const handleDeleteStore = async (storeId: string, storeName: string) => {
    if (!window.confirm(`Are you sure you want to delete store "${storeName}"?`)) return;
    try {
      await api.delete(`/admin/stores/${storeId}`);
      loadData();
    } catch (err) {
      console.error('Failed to delete store', err);
    }
  };

  // Handle Add Store Submit
  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const cleanMobile = mobileNumber.replace(/\D/g, '').trim();
    if (!name.trim() || !ownerName.trim() || !cleanMobile || !password || !categoryId || !referralCode.trim()) {
      setModalError('Store Name, Owner Name, Mobile, Password, Category, and Sponsor Code are required.');
      return;
    }

    const selectedCat = categories.find((c) => (c.id || c._id) === categoryId);

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        ownerName: ownerName.trim(),
        mobileNumber: cleanMobile,
        email: email.trim() || `${cleanMobile}@store.eshopy.biz`,
        password,
        categoryId,
        categoryName: selectedCat?.name || 'General',
        categorySlug: selectedCat?.slug || 'general',
        referralCode: referralCode.trim(),
        address: {
          line1: line1.trim() || 'Store Address',
          city: city.trim() || 'Bengaluru',
          state: stateName.trim() || 'Karnataka',
          pincode: pincode.trim() || '560001',
          country: 'India',
        },
        location: {
          lat: parseFloat(lat) || 12.9716,
          lng: parseFloat(lng) || 77.5946,
        },
      };

      const resp = await api.post('/admin/stores', payload);
      if (resp.data?.success) {
        setOpenAddModal(false);
        // Reset form
        setName('');
        setOwnerName('');
        setMobileNumber('');
        setEmail('');
        setPassword('');
        setCategoryId('');
        setReferralCode('');
        setLine1('');
        setCity('');
        setStateName('');
        setPincode('');
        loadData();
      }
    } catch (err: any) {
      setModalError(err.response?.data?.error?.message || 'Failed to create store.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Map View
  useEffect(() => {
    if (viewMode !== 'map' || !mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      center: [78.9629, 20.5937], // Center of India
      zoom: 4.5,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');

    // Add markers for all stores
    stores.forEach((s) => {
      const sLat = s.location?.lat;
      const sLng = s.location?.lng;
      if (!sLat || !sLng) return;

      const markerEl = document.createElement('div');
      markerEl.style.cursor = 'pointer';
      markerEl.innerHTML = `
        <div style="
          background: #FF7900;
          color: white;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 800;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          border: 2px solid white;
          white-space: nowrap;
        ">
          ${s.name} (${s.categoryName})
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`
        <div style="font-family: inherit; padding: 4px;">
          <h4 style="margin: 0; font-size: 14px; font-weight: 800; color: #172B30;">${s.name}</h4>
          <p style="margin: 2px 0; font-size: 11px; color: #FF7900; font-weight: 700;">Category: ${s.categoryName}</p>
          <p style="margin: 4px 0 0; font-size: 11px; color: #475569;">Owner: ${s.ownerName}</p>
          <p style="margin: 2px 0; font-size: 11px; color: #475569;">Mobile: ${s.mobileNumber}</p>
          <p style="margin: 2px 0; font-size: 11px; color: #64748B;">${s.address?.city || ''}, ${s.address?.state || ''}</p>
        </div>
      `);

      new maplibregl.Marker({ element: markerEl })
        .setLngLat([sLng, sLat])
        .setPopup(popup)
        .addTo(map);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [viewMode, stores]);

  // Metric counts
  const totalStores = stores.length;
  const activeStores = stores.filter((s) => s.status === 'active').length;
  const pendingStores = stores.filter((s) => s.status === 'pending_approval').length;
  const suspendedStores = stores.filter((s) => s.status === 'suspended').length;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#172B30' }}>
            Partner Stores Management
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
            Manage category-assigned stores, view geolocation map, and toggle activation status.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_e, val) => val && setViewMode(val)}
            size="small"
            sx={{ bgcolor: '#FFFFFF' }}
          >
            <ToggleButton value="table" sx={{ px: 2, fontWeight: 700 }}>
              <TableViewIcon fontSize="small" sx={{ mr: 0.5 }} /> Table
            </ToggleButton>
            <ToggleButton value="map" sx={{ px: 2, fontWeight: 700 }}>
              <MapViewIcon fontSize="small" sx={{ mr: 0.5 }} /> Map
            </ToggleButton>
          </ToggleButtonGroup>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenAddModal(true)}
            sx={{ fontWeight: 700 }}
          >
            Add New Store
          </Button>
        </Stack>
      </Box>

      {/* Metrics Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF' }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>TOTAL STORES</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#172B30', mt: 0.5 }}>{totalStores}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF' }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>ACTIVE STORES</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#10B981', mt: 0.5 }}>{activeStores}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF' }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>PENDING REVIEW</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#F59E0B', mt: 0.5 }}>{pendingStores}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF' }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>SUSPENDED</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#EF4444', mt: 0.5 }}>{suspendedStores}</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Search Bar */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 2.5, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF' }}>
        <TextField
          placeholder="Search by Store Name, ID, Mobile, or City..."
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

      {/* View Mode: Map View */}
      {viewMode === 'map' ? (
        <Paper elevation={0} sx={{ height: 500, borderRadius: 3, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <Box ref={mapContainerRef} sx={{ width: '100%', height: '100%' }} />
        </Paper>
      ) : (
        /* View Mode: Table View */
        <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF', overflow: 'hidden' }}>
          {isLoading ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <CircularProgress size={32} sx={{ color: '#FF7900' }} />
            </Box>
          ) : stores.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center', color: '#94A3B8' }}>
              <StorefrontIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
              <Typography variant="body1" sx={{ fontWeight: 600 }}>No stores found.</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Store</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Owner & Contact</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Location</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Sponsor</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stores.map((s) => (
                    <TableRow key={s.id || s._id} hover>
                      <TableCell>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#172B30' }}>
                          {s.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#FF7900', fontWeight: 800 }}>
                          {s.storeId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={s.categoryName || 'General'}
                          size="small"
                          sx={{ bgcolor: '#FFF7ED', color: '#FF7900', fontWeight: 700, fontSize: '0.75rem' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#172B30' }}>
                          {s.ownerName}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>
                          +91 {s.mobileNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#334155' }}>
                          {s.address?.city}, {s.address?.state}
                        </Typography>
                        {s.location?.lat && s.location?.lng && (
                          <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block' }}>
                            [{s.location.lat.toFixed(4)}, {s.location.lng.toFixed(4)}]
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#172B30', display: 'block' }}>
                          {s.referralName}
                        </Typography>
                        <Chip
                          label={`${s.referralCode} (${s.referralType || 'vendor'})`}
                          size="small"
                          sx={{ fontSize: '0.65rem', height: 18, bgcolor: '#EFF6FF', color: '#2563EB' }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          value={s.status || 'active'}
                          onChange={(e) => handleStatusChange(s.id || s._id, e.target.value)}
                          sx={{
                            minWidth: 120,
                            '& .MuiSelect-select': { py: 0.5, fontSize: '0.75rem', fontWeight: 700 },
                          }}
                        >
                          <MenuItem value="active">Active</MenuItem>
                          <MenuItem value="pending_approval">Pending Review</MenuItem>
                          <MenuItem value="suspended">Suspended</MenuItem>
                        </TextField>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Delete Store">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteStore(s.id || s._id, s.name)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* Add New Store Dialog (Admin Only) */}
      <Dialog open={openAddModal} onClose={() => setOpenAddModal(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#172B30', borderBottom: '1px solid #E2E8F0' }}>
          Register New Store (Admin)
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {modalError && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
              {modalError}
            </Alert>
          )}

          <Box component="form" onSubmit={handleCreateStore}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Store Name *"
                  placeholder="e.g. Fresh Groceries Bangalore"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Owner Name *"
                  placeholder="e.g. Sunil Sharma"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Contact Mobile (Login Username) *"
                  placeholder="10-digit mobile"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Login Password *"
                  placeholder="Minimum 6 characters"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Assign Product Category *"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  {categories.map((c) => (
                    <MenuItem key={c.id || c._id} value={c.id || c._id}>
                      {c.name} {c.isAvailable ? '(Available)' : `(Claimed: ${c.claimedByStore?.name})`}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Referring Sponsor Code *"
                  placeholder="Vendor ID or Store ID"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address Line 1"
                  placeholder="Building, street"
                  value={line1}
                  onChange={(e) => setLine1(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="State"
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="PIN Code"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Latitude"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Longitude"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
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
            onClick={handleCreateStore}
            variant="contained"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <AddIcon />}
            sx={{ fontWeight: 700 }}
          >
            {isSubmitting ? 'Creating...' : 'Register Store'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

