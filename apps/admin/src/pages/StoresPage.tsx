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
  const [typeOfStore, setTypeOfStore] = useState('Standard (Fulfillment Hub)');
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
  const [pendingTargetStoreId, setPendingTargetStoreId] = useState<string | null>(null);

  const handleShowStoreOnMap = (s: any) => {
    const sLat = s.location?.lat;
    const sLng = s.location?.lng;
    if (!sLat || !sLng) {
      alert('This store does not have geolocation coordinates configured.');
      return;
    }
    const storeKey = s.id || s._id;
    setPendingTargetStoreId(storeKey);
    setViewMode('map');
    setTimeout(() => {
      const mapSection = document.getElementById('stores-map-section');
      if (mapSection) {
        mapSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
  };

  // Fly and focus on target store if already in map mode
  useEffect(() => {
    if (viewMode === 'map' && pendingTargetStoreId && mapInstanceRef.current) {
      const item = markersMapRef.current.get(pendingTargetStoreId);
      if (item) {
        mapInstanceRef.current.flyTo({
          center: [item.lng, item.lat],
          zoom: 15,
          speed: 1.4,
          curve: 1.4,
          essential: true,
        });
        item.marker.togglePopup();
        setPendingTargetStoreId(null);
      }
    }
  }, [viewMode, pendingTargetStoreId]);

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
        typeOfStore,
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

    const markersMap = new Map<string, { marker: maplibregl.Marker; popup: maplibregl.Popup; lat: number; lng: number }>();

    // Add markers for all stores
    stores.forEach((s) => {
      const sLat = s.location?.lat;
      const sLng = s.location?.lng;
      if (!sLat || !sLng) return;

      const markerEl = document.createElement('div');
      markerEl.style.cssText = 'position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; user-select: none;';
      markerEl.innerHTML = `
        <!-- Hover Tooltip showing store name -->
        <div class="store-pin-tooltip" style="
          position: absolute;
          bottom: 100%;
          margin-bottom: 8px;
          opacity: 0;
          transform: translateY(6px);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: none;
          white-space: nowrap;
          z-index: 100;
          display: flex;
          flex-direction: column;
          align-items: center;
        ">
          <div style="
            background: #0F172A;
            color: #FFFFFF;
            padding: 5px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            box-shadow: 0 4px 14px rgba(15, 23, 42, 0.35);
            display: flex;
            align-items: center;
            gap: 6px;
            border: 1px solid #334155;
          ">
            <span>${s.name}</span>
            <span style="background: #FF7900; color: #FFFFFF; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 800;">
              ${s.categoryName || 'Store'}
            </span>
          </div>
          <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid #0F172A;"></div>
        </div>

        <!-- Store Pin Icon Badge -->
        <div class="store-pin-icon-circle" style="
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: linear-gradient(135deg, #FF7900 0%, #EA580C 100%);
          border: 2.5px solid #FFFFFF;
          box-shadow: 0 4px 14px rgba(234, 88, 12, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
        ">
          <svg style="width: 20px; height: 20px; fill: #FFFFFF;" viewBox="0 0 24 24">
            <path d="M5 6h14c.55 0 1-.45 1-1s-.45-1-1-1H5c-.55 0-1 .45-1 1s.45 1 1 1m15.16 1.8c-.09-.46-.5-.8-.98-.8H4.82c-.48 0-.89.34-.98.8l-1 5c-.12.62.35 1.2.98 1.2H4v5c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-5h4v5c0 .55.45 1 1 1s1-.45 1-1v-5h.18c.63 0 1.1-.58.98-1.2zM12 18H6v-4h6z"/>
          </svg>
        </div>
        <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid #EA580C; margin-top: -1px;"></div>
      `;

      let isPopupOpen = false;

      // Hover events
      const tooltip = markerEl.querySelector('.store-pin-tooltip') as HTMLElement;
      const iconCircle = markerEl.querySelector('.store-pin-icon-circle') as HTMLElement;
      markerEl.addEventListener('mouseenter', () => {
        if (isPopupOpen) return;
        if (tooltip) {
          tooltip.style.display = 'flex';
          tooltip.style.opacity = '1';
          tooltip.style.transform = 'translateY(0)';
        }
        if (iconCircle) {
          iconCircle.style.transform = 'scale(1.18)';
          iconCircle.style.boxShadow = '0 6px 20px rgba(234, 88, 12, 0.65)';
        }
      });
      markerEl.addEventListener('mouseleave', () => {
        if (tooltip) {
          tooltip.style.opacity = '0';
          tooltip.style.transform = 'translateY(6px)';
        }
        if (iconCircle) {
          iconCircle.style.transform = 'scale(1)';
          iconCircle.style.boxShadow = '0 4px 14px rgba(234, 88, 12, 0.45)';
        }
      });

      // Click to Zoom and Center on Map
      markerEl.addEventListener('click', () => {
        if (tooltip) {
          tooltip.style.opacity = '0';
          tooltip.style.transform = 'translateY(6px)';
          tooltip.style.display = 'none';
        }
        map.flyTo({
          center: [sLng, sLat],
          zoom: 15,
          speed: 1.2,
          curve: 1.4,
          essential: true,
        });
      });

      const statusBg = s.status === 'active' ? '#ECFDF5' : s.status === 'pending_approval' ? '#FFFBEB' : '#FEF2F2';
      const statusBorder = s.status === 'active' ? '#A7F3D0' : s.status === 'pending_approval' ? '#FDE68A' : '#FECACA';
      const statusColor = s.status === 'active' ? '#059669' : s.status === 'pending_approval' ? '#D97706' : '#DC2626';
      const statusDot = s.status === 'active' ? '#10B981' : s.status === 'pending_approval' ? '#F59E0B' : '#EF4444';
      const statusLabel = s.status === 'pending_approval' ? 'Pending' : (s.status === 'active' ? 'Active' : 'Suspended');

      // Cohesive, Non-AI Human-Designed Details Card
      const popup = new maplibregl.Popup({
        offset: [0, -18],
        closeButton: true,
        closeOnClick: false,
        maxWidth: '265px',
      }).setHTML(`
        <div style="font-family: inherit; width: 250px; overflow: hidden; background: #FFFFFF;">
          <!-- Top Orange Brand Accent Line -->
          <div style="height: 2.5px; background: linear-gradient(90deg, #FF7900 0%, #EA580C 100%);"></div>

          <!-- Header Section -->
          <div style="padding: 10px 12px 8px 12px; border-bottom: 1px solid #F1F5F9;">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding-right: 22px;">
              <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                <div style="width: 28px; height: 28px; border-radius: 6px; background: #FFF7ED; border: 1px solid #FED7AA; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #EA580C;">
                  <svg style="width: 15px; height: 15px; fill: currentColor;" viewBox="0 0 24 24">
                    <path d="M5 6h14c.55 0 1-.45 1-1s-.45-1-1-1H5c-.55 0-1 .45-1 1s.45 1 1 1m15.16 1.8c-.09-.46-.5-.8-.98-.8H4.82c-.48 0-.89.34-.98.8l-1 5c-.12.62.35 1.2.98 1.2H4v5c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-5h4v5c0 .55.45 1 1 1s1-.45 1-1v-5h.18c.63 0 1.1-.58.98-1.2zM12 18H6v-4h6z"/>
                  </svg>
                </div>
                <div style="min-width: 0;">
                  <h4 style="margin: 0; font-size: 13.5px; font-weight: 800; color: #0F172A; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${s.name}
                  </h4>
                  <div style="display: flex; align-items: center; gap: 5px; margin-top: 2px;">
                    <span style="font-size: 10px; font-weight: 800; color: #FF7900; letter-spacing: 0.03em;">${s.storeId}</span>
                    ${s.typeOfStore ? `<span style="font-size: 9px; font-weight: 700; color: #475569; background: #F1F5F9; border: 1px solid #E2E8F0; padding: 0.5px 5px; border-radius: 3px;">${s.typeOfStore}</span>` : ''}
                  </div>
                </div>
              </div>
            </div>

            <!-- Status and Category Badges -->
            <div style="display: flex; align-items: center; gap: 5px; margin-top: 7px; flex-wrap: wrap;">
              <span style="display: inline-flex; align-items: center; gap: 4px; padding: 1.5px 6px; border-radius: 5px; background: ${statusBg}; border: 1px solid ${statusBorder}; font-size: 9px; font-weight: 700; color: ${statusColor};">
                <span style="width: 5px; height: 5px; border-radius: 50%; background: ${statusDot}; display: inline-block;"></span>
                ${statusLabel}
              </span>
              <span style="background: #FFF7ED; color: #EA580C; border: 1px solid #FED7AA; font-size: 9px; font-weight: 700; padding: 1.5px 6px; border-radius: 5px; display: inline-flex; align-items: center; gap: 3px;">
                <svg style="width: 9px; height: 9px; fill: currentColor;" viewBox="0 0 24 24"><path d="M12 2l-5.5 9h11z M4 13h7v7H4z M17 13a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z"/></svg>
                ${s.categoryName || 'General'}
              </span>
            </div>
          </div>

          <!-- Body Info Section -->
          <div style="padding: 8px 12px; display: flex; flex-direction: column; gap: 6px; font-size: 11px; background: #FFFFFF;">
            <!-- Manager -->
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 20px; height: 20px; border-radius: 5px; background: #F8FAFC; border: 1px solid #E2E8F0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #64748B;">
                <svg style="width: 11px; height: 11px; fill: currentColor;" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              </div>
              <div style="min-width: 0; flex: 1;">
                <div style="font-size: 8.5px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.04em;">Manager</div>
                <div style="font-weight: 700; color: #0F172A; font-size: 11px; line-height: 1.15;">${s.ownerName || '—'}</div>
              </div>
            </div>

            <!-- Phone -->
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 20px; height: 20px; border-radius: 5px; background: #F8FAFC; border: 1px solid #E2E8F0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #64748B;">
                <svg style="width: 11px; height: 11px; fill: currentColor;" viewBox="0 0 24 24"><path d="M6.62 10.79a15.053 15.053 0 0 0 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
              </div>
              <div style="min-width: 0; flex: 1;">
                <div style="font-size: 8.5px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.04em;">Phone</div>
                <div style="font-weight: 700; color: #0F172A; font-size: 11px; line-height: 1.15;">+91 ${s.mobileNumber}</div>
              </div>
            </div>

            <!-- Location -->
            <div style="display: flex; align-items: flex-start; gap: 8px;">
              <div style="width: 20px; height: 20px; border-radius: 5px; background: #F8FAFC; border: 1px solid #E2E8F0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #64748B; margin-top: 1px;">
                <svg style="width: 11px; height: 11px; fill: currentColor;" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              </div>
              <div style="min-width: 0; flex: 1;">
                <div style="font-size: 8.5px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.04em;">Location</div>
                <div style="color: #334155; font-size: 10.5px; line-height: 1.3;">
                  ${[s.address?.line1, s.address?.city, s.address?.state].filter(Boolean).join(', ')}${s.address?.pincode ? ` - <strong>${s.address.pincode}</strong>` : ''}
                </div>
              </div>
            </div>

            <!-- Sponsor -->
            ${s.referralName ? `
            <div style="margin-top: 2px; padding: 5px 8px; border-radius: 6px; background: #F8FAFC; border: 1px solid #E2E8F0; display: flex; align-items: center; justify-content: space-between;">
              <div>
                <div style="font-size: 8.5px; font-weight: 700; color: #64748B; text-transform: uppercase;">Sponsor</div>
                <div style="font-size: 10px; font-weight: 700; color: #2563EB;">${s.referralName}</div>
              </div>
              <span style="background: #EFF6FF; border: 1px solid #DBEAFE; color: #1D4ED8; font-size: 9px; font-weight: 800; padding: 1.5px 5px; border-radius: 3px; font-family: monospace;">
                ${s.referralCode}
              </span>
            </div>` : ''}
          </div>

          <!-- Footer Bar -->
          <div style="padding: 6px 12px; background: #F8FAFC; border-top: 1px solid #F1F5F9; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 9.5px; color: #64748B; font-family: monospace; display: flex; align-items: center; gap: 3px;">
              <svg style="width: 9px; height: 9px; fill: #94A3B8;" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
              ${sLat.toFixed(4)}, ${sLng.toFixed(4)}
            </span>
            <span style="font-size: 9.5px; font-weight: 700; color: #FF7900;">Partner Store</span>
          </div>
        </div>
      `);

      popup.on('open', () => {
        isPopupOpen = true;
        if (tooltip) {
          tooltip.style.opacity = '0';
          tooltip.style.transform = 'translateY(6px)';
          tooltip.style.display = 'none';
        }
      });

      popup.on('close', () => {
        isPopupOpen = false;
        if (tooltip) {
          tooltip.style.display = 'flex';
        }
      });

      const marker = new maplibregl.Marker({ element: markerEl, anchor: 'bottom' })
        .setLngLat([sLng, sLat])
        .setPopup(popup)
        .addTo(map);

      const storeKey = s.id || s._id;
      markersMap.set(storeKey, { marker, popup, lat: sLat, lng: sLng });
    });

    markersMapRef.current = markersMap;
    mapInstanceRef.current = map;

    // If targeted from table, fly and open popup
    if (pendingTargetStoreId && markersMap.has(pendingTargetStoreId)) {
      const item = markersMap.get(pendingTargetStoreId)!;
      setTimeout(() => {
        map.flyTo({
          center: [item.lng, item.lat],
          zoom: 15,
          speed: 1.4,
          curve: 1.4,
          essential: true,
        });
        item.marker.togglePopup();
        setPendingTargetStoreId(null);
      }, 300);
    }

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
        <Paper id="stores-map-section" elevation={0} sx={{ height: 520, borderRadius: 3, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
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
              <Table size="small" sx={{ '& td, & th': { verticalAlign: 'middle' } }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Store</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Owner & Contact</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Location</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Sponsor</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569' }} align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stores.map((s) => (
                    <TableRow key={s.id || s._id} hover>
                      <TableCell>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#172B30' }}>
                          {s.name}
                        </Typography>
                        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25 }}>
                          <Typography variant="caption" sx={{ color: '#FF7900', fontWeight: 800 }}>
                            {s.storeId}
                          </Typography>
                          {s.typeOfStore && (
                            <Chip
                              label={s.typeOfStore}
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
                              Approve Store
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
                                onClick={() => handleShowStoreOnMap(s)}
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

                          <Tooltip title="Delete Store">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteStore(s.id || s._id, s.name)}
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
                  select
                  fullWidth
                  label="Type of Store *"
                  value={typeOfStore}
                  onChange={(e) => setTypeOfStore(e.target.value)}
                >
                  <MenuItem value="Basic (Neighborhood Express)">Basic — Neighborhood Express Store</MenuItem>
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

