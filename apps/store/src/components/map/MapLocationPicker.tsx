import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  CircularProgress,
  IconButton,
  Tooltip,
  Paper,
  InputAdornment,
} from '@mui/material';
import {
  MyLocation as MyLocationIcon,
  Search as SearchIcon,
  Place as PlaceIcon,
  CheckCircle as CheckCircleIcon,
  Navigation as NavigationIcon,
} from '@mui/icons-material';

export interface LocationData {
  lat: number;
  lng: number;
  formattedAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
  line1?: string;
}

interface MapLocationPickerProps {
  initialLat?: number;
  initialLng?: number;
  onChange: (location: LocationData) => void;
  height?: number | string;
}

const DEFAULT_LAT = 12.9716; // Bengaluru default
const DEFAULT_LNG = 77.5946;

export default function MapLocationPicker({
  initialLat = DEFAULT_LAT,
  initialLng = DEFAULT_LNG,
  onChange,
  height = 360,
}: MapLocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const [lat, setLat] = useState<number>(initialLat);
  const [lng, setLng] = useState<number>(initialLng);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [addressLabel, setAddressLabel] = useState<string>('');

  // Reverse geocode to get human-readable address
  const reverseGeocode = useCallback(async (latitude: number, longitude: number) => {
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        { headers: { 'User-Agent': 'EShophyStorePortal/1.0' } }
      );
      if (resp.ok) {
        const data = await resp.json();
        const display = data.display_name || '';
        const addr = data.address || {};
        const pincode = addr.postcode || '';
        const state = addr.state || '';
        const city = addr.city || addr.town || addr.village || addr.suburb || addr.county || addr.state_district || '';
        const street = [addr.house_number, addr.road || addr.suburb || addr.neighbourhood].filter(Boolean).join(', ');

        setAddressLabel(display);
        onChange({
          lat: latitude,
          lng: longitude,
          formattedAddress: display,
          city,
          state,
          pincode,
          line1: street,
        });
        return display;
      }
    } catch {
      // fallback
    }
    onChange({ lat: latitude, lng: longitude });
    return '';
  }, [onChange]);

  // Update marker position and notify parent
  const updatePosition = useCallback((newLat: number, newLng: number, skipReverse = false) => {
    const fixedLat = Number(newLat.toFixed(6));
    const fixedLng = Number(newLng.toFixed(6));
    setLat(fixedLat);
    setLng(fixedLng);

    if (markerRef.current) {
      markerRef.current.setLngLat([fixedLng, fixedLat]);
    }

    if (!skipReverse) {
      reverseGeocode(fixedLat, fixedLng);
    } else {
      onChange({ lat: fixedLat, lng: fixedLng, formattedAddress: addressLabel });
    }
  }, [onChange, reverseGeocode, addressLabel]);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      center: [initialLng, initialLat],
      zoom: 13,
      attributionControl: false,
    });

    // Add navigation controls (zoom, compass)
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');

    // Create custom styled marker
    const markerEl = document.createElement('div');
    markerEl.className = 'custom-store-pin';
    markerEl.innerHTML = `
      <div style="
        background: #FF7900;
        width: 38px;
        height: 38px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 14px rgba(255, 121, 0, 0.5);
        border: 2.5px solid #FFFFFF;
        cursor: grab;
      ">
        <svg style="transform: rotate(45deg); width: 20px; height: 20px; fill: white;" viewBox="0 0 24 24">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
    `;

    const marker = new maplibregl.Marker({
      element: markerEl,
      draggable: true,
      anchor: 'bottom',
    })
      .setLngLat([initialLng, initialLat])
      .addTo(map);

    marker.on('dragend', () => {
      const lngLat = marker.getLngLat();
      updatePosition(lngLat.lat, lngLat.lng);
    });

    map.on('click', (e) => {
      updatePosition(e.lngLat.lat, e.lngLat.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    // Initial reverse geocode
    reverseGeocode(initialLat, initialLng);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Handle address geocoding search
  const handleSearchAddress = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        { headers: { 'User-Agent': 'EShophyStorePortal/1.0' } }
      );
      if (resp.ok) {
        const results = await resp.json();
        if (results && results.length > 0) {
          const item = results[0];
          const newLat = parseFloat(item.lat);
          const newLng = parseFloat(item.lon);
          if (mapRef.current) {
            mapRef.current.flyTo({ center: [newLng, newLat], zoom: 15, duration: 1500 });
          }
          setAddressLabel(item.display_name || query);
          updatePosition(newLat, newLng, true);
        }
      }
    } catch (err) {
      console.error('Failed to geocode address', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle GPS Locate Me
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        if (mapRef.current) {
          mapRef.current.flyTo({ center: [userLng, userLat], zoom: 16, duration: 1200 });
        }
        updatePosition(userLat, userLng);
        setIsLocating(false);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setIsLocating(false);
        alert('Could not retrieve your location. Please ensure location permissions are granted.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Search & Action Bar */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
        <Box component="form" onSubmit={handleSearchAddress} sx={{ flex: 1 }}>
          <TextField
            fullWidth
            placeholder="Search city, area, or landmark..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: '#94A3B8' }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Button
                    type="submit"
                    variant="contained"
                    size="small"
                    disabled={isSearching || !searchQuery.trim()}
                    sx={{ minWidth: 70, py: 0.5, fontSize: '0.75rem' }}
                  >
                    {isSearching ? <CircularProgress size={16} color="inherit" /> : 'Search'}
                  </Button>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <Button
          variant="outlined"
          color="secondary"
          onClick={handleLocateMe}
          disabled={isLocating}
          startIcon={isLocating ? <CircularProgress size={16} /> : <MyLocationIcon />}
          sx={{
            borderColor: '#CBD5E1',
            color: '#172B30',
            bgcolor: '#FFFFFF',
            whiteSpace: 'nowrap',
            '&:hover': { bgcolor: '#F8FAFC', borderColor: '#94A3B8' },
          }}
        >
          {isLocating ? 'Locating...' : 'Locate Me'}
        </Button>
      </Stack>

      {/* Map Canvas */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height,
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <Box ref={mapContainerRef} sx={{ width: '100%', height: '100%' }} />

        {/* Floating Instruction Pill */}
        <Paper
          elevation={2}
          sx={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            px: 2,
            py: 0.75,
            borderRadius: 6,
            bgcolor: 'rgba(23, 43, 48, 0.9)',
            backdropFilter: 'blur(4px)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          <PlaceIcon sx={{ fontSize: 18, color: '#FF7900' }} />
          <Typography variant="caption" sx={{ fontWeight: 600, letterSpacing: '0.01em' }}>
            Click anywhere or drag pin to position store
          </Typography>
        </Paper>
      </Box>

      {/* Selected Coordinates & Address Footer */}
      <Paper
        elevation={0}
        sx={{
          mt: 1.5,
          p: 2,
          bgcolor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: 2,
        }}
      >
        <Stack spacing={1}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleIcon sx={{ fontSize: 18, color: '#10B981' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#172B30' }}>
              Selected Store Coordinates
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <TextField
              label="Latitude"
              value={lat}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) updatePosition(val, lng);
              }}
              size="small"
              sx={{ flex: 1 }}
              type="number"
              inputProps={{ step: 'any' }}
            />
            <TextField
              label="Longitude"
              value={lng}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) updatePosition(lat, val);
              }}
              size="small"
              sx={{ flex: 1 }}
              type="number"
              inputProps={{ step: 'any' }}
            />
          </Stack>

          {addressLabel && (
            <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 0.5 }}>
              <strong>Resolved Area:</strong> {addressLabel}
            </Typography>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}

