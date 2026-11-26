import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { Box, Button, Stack, Typography } from '@mui/material';
import { Navigation as NavigationIcon } from '@mui/icons-material';
import type { DeliveryGeoPoint, DeliveryStopLocation } from '@ornate/types';
import { buildGoogleMapsDirectionUrl } from '../../utils/navigation';

interface DeliveryRouteMapProps {
  pickupLocation: DeliveryStopLocation;
  dropLocation: DeliveryStopLocation;
  riderLocation?: DeliveryGeoPoint | null;
  height?: number;
}

export { buildGoogleMapsDirectionUrl };

export default function DeliveryRouteMap({
  pickupLocation,
  dropLocation,
  riderLocation,
  height = 240,
}: DeliveryRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const riderMarkerRef = useRef<maplibregl.Marker | null>(null);

  const pickupLat = pickupLocation.lat ?? 12.9716;
  const pickupLng = pickupLocation.lng ?? 77.5946;
  const dropLat = dropLocation.lat;
  const dropLng = dropLocation.lng;

  useEffect(() => {
    if (!containerRef.current) return;

    const centerLng = riderLocation?.lng ?? pickupLng;
    const centerLat = riderLocation?.lat ?? pickupLat;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      center: [centerLng, centerLat],
      zoom: 12,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    const bounds = new maplibregl.LngLatBounds();
    let pointsCount = 0;

    // Pickup Marker (Orange)
    if (typeof pickupLocation.lat === 'number' && typeof pickupLocation.lng === 'number') {
      const el = document.createElement('div');
      el.style.cssText =
        'width:28px;height:28px;border-radius:50%;background:#FF7900;border:2.5px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:11px;';
      el.textContent = 'P';
      new maplibregl.Marker({ element: el })
        .setLngLat([pickupLocation.lng, pickupLocation.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 18 }).setHTML(
            `<strong>Pickup:</strong> ${pickupLocation.name}<br/>${pickupLocation.city} (${pickupLocation.pincode})`,
          ),
        )
        .addTo(map);
      bounds.extend([pickupLocation.lng, pickupLocation.lat]);
      pointsCount++;
    }

    // Drop Marker (Green) if coordinates exist
    if (typeof dropLat === 'number' && typeof dropLng === 'number') {
      const el = document.createElement('div');
      el.style.cssText =
        'width:28px;height:28px;border-radius:50%;background:#10B981;border:2.5px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:11px;';
      el.textContent = 'D';
      new maplibregl.Marker({ element: el })
        .setLngLat([dropLng, dropLat])
        .setPopup(
          new maplibregl.Popup({ offset: 18 }).setHTML(
            `<strong>Customer:</strong> ${dropLocation.name}<br/>${dropLocation.line1}, ${dropLocation.city}`,
          ),
        )
        .addTo(map);
      bounds.extend([dropLng, dropLat]);
      pointsCount++;
    }

    // Rider Marker (Blue)
    if (riderLocation) {
      const el = document.createElement('div');
      el.style.cssText =
        'width:22px;height:22px;border-radius:50%;background:#2563EB;border:3px solid #fff;box-shadow:0 0 0 4px rgba(37,99,235,0.28);';
      riderMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([riderLocation.lng, riderLocation.lat])
        .setPopup(new maplibregl.Popup({ offset: 14 }).setText('Your Live GPS Location'))
        .addTo(map);
      bounds.extend([riderLocation.lng, riderLocation.lat]);
      pointsCount++;
    }

    if (pointsCount >= 2) {
      map.fitBounds(bounds, { padding: 48, maxZoom: 15 });
    }

    mapRef.current = map;

    return () => {
      riderMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [pickupLocation.lat, pickupLocation.lng, dropLat, dropLng]);

  useEffect(() => {
    if (!mapRef.current || !riderLocation) return;
    if (riderMarkerRef.current) {
      riderMarkerRef.current.setLngLat([riderLocation.lng, riderLocation.lat]);
    }
  }, [riderLocation]);

  return (
    <Box>
      <Box
        sx={{
          position: 'relative',
          height,
          borderRadius: 2.5,
          overflow: 'hidden',
          border: '1px solid #E2E8F0',
        }}
      >
        <Box ref={containerRef} sx={{ width: '100%', height: '100%' }} />
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            bgcolor: 'rgba(15, 23, 42, 0.85)',
            color: '#fff',
            px: 1.25,
            py: 0.5,
            borderRadius: 1.5,
            display: 'flex',
            gap: 1.5,
            alignItems: 'center',
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#FFA04D' }}>
            ● Pickup
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#60A5FA' }}>
            ● Rider
          </Typography>
          {typeof dropLat === 'number' && (
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#34D399' }}>
              ● Drop
            </Typography>
          )}
        </Box>
      </Box>

      <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
        <Button
          fullWidth
          variant="outlined"
          size="small"
          component="a"
          href={buildGoogleMapsDirectionUrl(pickupLocation)}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<NavigationIcon />}
          sx={{ borderColor: '#FF7900', color: '#EA580C' }}
        >
          Navigate to Pickup
        </Button>
        <Button
          fullWidth
          variant="contained"
          size="small"
          component="a"
          href={buildGoogleMapsDirectionUrl(dropLocation)}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<NavigationIcon />}
        >
          Navigate to Customer
        </Button>
      </Stack>
    </Box>
  );
}
