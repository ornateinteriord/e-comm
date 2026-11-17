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

export default function SellersPage() {
  const [sellers, setSellers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');

  // Add Seller Dialog State
  const [openAddModal, setOpenAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // New Seller Form Fields
  const [name, setName] = useState('');
  const [typeOfSeller, setTypeOfSeller] = useState('Standard (Fulfillment Hub)');
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
  const markersMapRef = useRef<Map<string, { marker: maplibregl.Marker; popup: maplibregl.Popup; lat: number; lng: number }>>(new Map());
  const [pendingTargetSellerId, setPendingTargetSellerId] = useState<string | null>(null);

  const handleShowSellerOnMap = (s: any) => {
    const sLat = s.location?.lat;
    const sLng = s.location?.lng;
    if (!sLat || !sLng) {
      alert('This seller does not have geolocation coordinates configured.');
      return;
    }
    const sellerKey = s.id || s._id;
    setPendingTargetSellerId(sellerKey);
    setViewMode('map');
    setTimeout(() => {
      const mapSection = document.getElementById('sellers-map-section');
      if (mapSection) {
        mapSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
  };

  // Fly and focus on target seller if already in map mode
  useEffect(() => {
    if (viewMode === 'map' && pendingTargetSellerId && mapInstanceRef.current) {
      const item = markersMapRef.current.get(pendingTargetSellerId);
      if (item) {
        mapInstanceRef.current.flyTo({
          center: [item.lng, item.lat],
          zoom: 15,
          speed: 1.4,
          curve: 1.4,
          essential: true,
        });
        item.marker.togglePopup();
        setPendingTargetSellerId(null);
      }
    }
  }, [viewMode, pendingTargetSellerId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sellersResp, catsResp] = await Promise.all([
        api.get(`/admin/sellers?search=${encodeURIComponent(search.trim())}`).catch(() => api.get(`/admin/stores?search=${encodeURIComponent(search.trim())}`)),
        api.get('/seller/categories/available').catch(() => api.get('/store/categories/available')).catch(() => ({ data: { data: [] } })),
      ]);

      if (sellersResp.data?.success) {
        setSellers(sellersResp.data.data || []);
      }
      if (catsResp.data?.success) {
        setCategories(catsResp.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load sellers data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  // Handle Status Toggle
  const handleStatusChange = async (sellerId: string, newStatus: string) => {
    try {
      await api.patch(`/admin/sellers/${sellerId}/status`, { status: newStatus }).catch(() => api.patch(`/admin/stores/${sellerId}/status`, { status: newStatus }));
      loadData();
    } catch (err) {
      console.error('Failed to update seller status', err);
    }
  };

  // Handle Delete Seller
  const handleDeleteSeller = async (sellerId: string, sellerName: string) => {
    if (!window.confirm(`Are you sure you want to delete seller "${sellerName}"?`)) return;
    try {
      await api.delete(`/admin/sellers/${sellerId}`).catch(() => api.delete(`/admin/stores/${sellerId}`));
      loadData();
    } catch (err) {
      console.error('Failed to delete seller', err);
    }
  };

  // Handle Add Seller Submit
  const handleCreateSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const cleanMobile = mobileNumber.replace(/\D/g, '').trim();
    if (!name.trim() || !ownerName.trim() || !cleanMobile || !password || !categoryId || !referralCode.trim()) {
      setModalError('Seller Name, Owner Name, Mobile, Password, Category, and Sponsor Code are required.');
      return;
    }

    const selectedCat = categories.find((c) => (c.id || c._id) === categoryId);

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        typeOfSeller,
        typeOfStore: typeOfSeller,
        ownerName: ownerName.trim(),
        mobileNumber: cleanMobile,
        email: email.trim() || `${cleanMobile}@seller.eshopy.biz`,
        password,
        categoryId,
        categoryName: selectedCat?.name || 'General',
        categorySlug: selectedCat?.slug || 'general',
        referralCode: referralCode.trim(),
        address: {
          line1: line1.trim() || 'Seller Address',
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

      const resp = await api.post('/admin/sellers', payload).catch(() => api.post('/admin/stores', payload));
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
      } else {
        setModalError(resp.data?.error?.message || 'Failed to register seller.');
      }
    } catch (err: any) {
      setModalError(err.response?.data?.error?.message || 'Failed to register seller.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // MapLibre Integration
  useEffect(() => {
    if (viewMode !== 'map' || !mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap Contributors',
          },
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [78.9629, 20.5937],
      zoom: 4.5,
    });

    map.addControl(new maplibregl.NavigationControl({}), 'top-right');
    mapInstanceRef.current = map;

    const markersMap = new Map<string, { marker: maplibregl.Marker; popup: maplibregl.Popup; lat: number; lng: number }>();
    const bounds = new maplibregl.LngLatBounds();
    let hasCoords = false;

    sellers.forEach((s) => {
      const sLat = s.location?.lat;
      const sLng = s.location?.lng;
      if (!sLat || !sLng) return;

      hasCoords = true;
      bounds.extend([sLng, sLat]);

      const markerEl = document.createElement('div');
      markerEl.className = 'custom-seller-map-pin';
      markerEl.style.width = '36px';
      markerEl.style.height = '36px';
      markerEl.style.borderRadius = '50%';
      markerEl.style.display = 'flex';
      markerEl.style.alignItems = 'center';
      markerEl.style.justifyContent = 'center';
      markerEl.style.cursor = 'pointer';
      markerEl.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
      markerEl.style.border = '2px solid #FFFFFF';

      if (s.status === 'active') {
        markerEl.style.backgroundColor = '#10B981';
      } else if (s.status === 'suspended') {
        markerEl.style.backgroundColor = '#EF4444';
      } else {
        markerEl.style.backgroundColor = '#F59E0B';
      }

      markerEl.innerHTML = `
        <svg style="width:20px;height:20px;fill:#ffffff;" viewBox="0 0 24 24">
          <path d="M4 4h16v2H4zm0 4h16v12H4zm2 2v8h12v-8z"/>
        </svg>
      `;

      const effectiveId = s.sellerId || s.storeId || s.id;
      const popupHtml = `
        <div style="font-family: inherit; padding: 6px; min-width: 220px;">
          <div style="font-weight: 800; font-size: 14px; color: #172B30; margin-bottom: 2px;">
            ${s.name}
          </div>
          <div style="font-size: 12px; color: #FF7900; font-weight: 700; margin-bottom: 6px;">
            ${effectiveId} • ${s.categoryName || 'General'}
          </div>
          <div style="font-size: 11px; color: #64748B; margin-bottom: 3px;">
            <strong>Manager:</strong> ${s.ownerName} (+91 ${s.mobileNumber})
          </div>
          <div style="font-size: 11px; color: #64748B; margin-bottom: 3px;">
            <strong>Address:</strong> ${s.address?.city || ''}, ${s.address?.state || ''} ${s.address?.pincode ? `(${s.address.pincode})` : ''}
          </div>
          <div style="margin-top: 6px; display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 800; text-transform: uppercase; background: ${
            s.status === 'active' ? '#DCFCE7; color: #15803D;' : s.status === 'suspended' ? '#FEE2E2; color: #B91C1C;' : '#FEF3C7; color: #B45309;'
          }">
            ${s.status}
          </div>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(popupHtml);
      const marker = new maplibregl.Marker({ element: markerEl })
        .setLngLat([sLng, sLat])
        .setPopup(popup)
        .addTo(map);

      const sellerKey = s.id || s._id;
      markersMap.set(sellerKey, { marker, popup, lat: sLat, lng: sLng });
    });

    markersMapRef.current = markersMap;

    if (hasCoords) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    }

    if (pendingTargetSellerId && markersMap.has(pendingTargetSellerId)) {
      setTimeout(() => {
        const item = markersMap.get(pendingTargetSellerId)!;
        map.flyTo({
          center: [item.lng, item.lat],
          zoom: 15,
          speed: 1.4,
          curve: 1.4,
          essential: true,
        });
        item.marker.togglePopup();
        setPendingTargetSellerId(null);
      }, 300);
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [viewMode, sellers]);

  // Metric counts
  const totalSellers = sellers.length;
  const activeSellers = sellers.filter((s) => s.status === 'active').length;
  const pendingSellers = sellers.filter((s) => s.status === 'pending_approval').length;
  const suspendedSellers = sellers.filter((s) => s.status === 'suspended').length;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#172B30' }}>
            Partner Sellers Management
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
            Manage category-assigned sellers, view geolocation map, and toggle activation status.
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
            Add New Seller
          </Button>
        </Stack>
      </Box>

      {/* Metrics Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF' }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>TOTAL SELLERS</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#172B30', mt: 0.5 }}>{totalSellers}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF' }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>ACTIVE SELLERS</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#10B981', mt: 0.5 }}>{activeSellers}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF' }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>PENDING REVIEW</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#F59E0B', mt: 0.5 }}>{pendingSellers}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF' }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>SUSPENDED</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#EF4444', mt: 0.5 }}>{suspendedSellers}</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Search Bar */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 2.5, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF' }}>
        <TextField
          placeholder="Search by Seller Name, ID, Mobile, or City..."
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
        <Paper id="sellers-map-section" elevation={0} sx={{ height: 520, borderRadius: 3, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <Box ref={mapContainerRef} sx={{ width: '100%', height: '100%' }} />
        </Paper>
      ) : (
        /* View Mode: Table View */
        <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #E2E8F0', bgcolor: '#FFFFFF', overflow: 'hidden' }}>
          {isLoading ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <CircularProgress size={32} sx={{ color: '#FF7900' }} />
            </Box>
          ) : sellers.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center', color: '#94A3B8' }}>
              <StorefrontIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
              <Typography variant="body1" sx={{ fontWeight: 600 }}>No sellers found.</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small" sx={{ '& td, & th': { verticalAlign: 'middle' } }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Seller</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Owner & Contact</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Location</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Sponsor</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }} align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sellers.map((s) => {
                    const effectiveId = s.sellerId || s.storeId || s.id;
                    const effectiveType = s.typeOfSeller || s.typeOfStore;
                    return (
                      <TableRow key={s.id || s._id} hover>
                        <TableCell>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#172B30' }}>
                            {s.name}
                          </Typography>
                          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25 }}>
                            <Typography variant="caption" sx={{ color: '#FF7900', fontWeight: 800 }}>
                              {effectiveId}
                            </Typography>
                            {effectiveType && (
                              <Chip
                                label={effectiveType}
                                size="small"
                                sx={{ fontSize: '0.62rem', height: 16, bgcolor: '#F1F5F9', color: '#475569' }}
                              />
                            )}
                          </Stack>
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
                          <Stack spacing={0.75} alignItems="flex-start">
                            <TextField
                              select
                              size="small"
                              value={s.status || 'active'}
                              onChange={(e) => handleStatusChange(s.id || s._id, e.target.value)}
                              sx={{
                                minWidth: 130,
                                '& .MuiSelect-select': { py: 0.5, fontSize: '0.75rem', fontWeight: 700 },
                              }}
                            >
                              <MenuItem value="active">Active</MenuItem>
                              <MenuItem value="pending_approval">Pending Review</MenuItem>
                              <MenuItem value="suspended">Suspended</MenuItem>
                            </TextField>
                            {s.status === 'pending_approval' && (
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                onClick={() => handleStatusChange(s.id || s._id, 'active')}
                                startIcon={<ActiveIcon sx={{ fontSize: '13px !important' }} />}
                                sx={{
                                  py: 0.25,
                                  px: 1,
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  bgcolor: '#10B981',
                                  '&:hover': { bgcolor: '#059669' },
                                }}
                              >
                                Approve Seller
                              </Button>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.75} justifyContent="center" alignItems="center">
                            <Tooltip title={s.location?.lat && s.location?.lng ? "View on Map" : "No Coordinates Configured"}>
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={!s.location?.lat || !s.location?.lng}
                                  onClick={() => handleShowSellerOnMap(s)}
                                  sx={{
                                    color: '#FF7900',
                                    bgcolor: 'rgba(255, 121, 0, 0.08)',
                                    border: '1px solid rgba(255, 121, 0, 0.25)',
                                    '&:hover': {
                                      bgcolor: 'rgba(255, 121, 0, 0.18)',
                                      borderColor: '#FF7900',
                                    },
                                    '&.Mui-disabled': {
                                      opacity: 0.35,
                                      borderColor: 'transparent',
                                    },
                                  }}
                                >
                                  <PlaceIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>

                            <Tooltip title="Delete Seller">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteSeller(s.id || s._id, s.name)}
                                sx={{
                                  bgcolor: 'rgba(239, 68, 68, 0.06)',
                                  border: '1px solid rgba(239, 68, 68, 0.15)',
                                  '&:hover': {
                                    bgcolor: 'rgba(239, 68, 68, 0.14)',
                                  },
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* Add New Seller Dialog (Admin Only) */}
      <Dialog open={openAddModal} onClose={() => setOpenAddModal(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#172B30', borderBottom: '1px solid #E2E8F0' }}>
          Register New Seller (Admin)
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {modalError && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
              {modalError}
            </Alert>
          )}

          <Box component="form" onSubmit={handleCreateSeller}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Seller Name *"
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
                      {c.name} {c.isAvailable ? '(Available)' : `(Claimed: ${c.claimedBySeller?.name || c.claimedByStore?.name})`}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Type of Seller *"
                  value={typeOfSeller}
                  onChange={(e) => setTypeOfSeller(e.target.value)}
                >
                  <MenuItem value="Basic (Neighborhood Express)">Basic — Neighborhood Express Seller</MenuItem>
                  <MenuItem value="Standard (Fulfillment Hub)">Standard — Fulfillment Hub</MenuItem>
                  <MenuItem value="Advanced (Superstore)">Advanced — Regional Superstore</MenuItem>
                  <MenuItem value="Flagship (Experience Center)">Flagship — Experience Center</MenuItem>
                  <MenuItem value="Wholesale (Mega Distribution Point)">Wholesale — Mega Distribution Hub</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Referring Sponsor Code *"
                  placeholder="Vendor ID or Seller ID"
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
            onClick={handleCreateSeller}
            variant="contained"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <AddIcon />}
            sx={{ fontWeight: 700 }}
          >
            {isSubmitting ? 'Creating...' : 'Register Seller'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

