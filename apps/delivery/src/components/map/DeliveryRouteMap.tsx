import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Box, Button, Stack, Typography } from '@mui/material';
import { Navigation as NavigationIcon } from '@mui/icons-material';
import type { DeliveryGeoPoint, DeliveryStopLocation } from '@ornate/types';
import { buildGoogleMapsDirectionUrl, geocodeStopAddress } from '../../utils/navigation';

interface DeliveryRouteMapProps {
  pickupLocation: DeliveryStopLocation;
  dropLocation: DeliveryStopLocation;
  riderLocation?: DeliveryGeoPoint | null;
  showDrop?: boolean;
  onDropCoordsResolved?: (coords: { lat: number; lng: number } | null) => void;
  height?: number;
}

export { buildGoogleMapsDirectionUrl };

async function fetchRoadRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  signal: AbortSignal,
): Promise<{ coordinates: [number, number][]; distanceKm: number; durationMin: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const resp = await fetch(url, { signal });
    if (!resp.ok) return null;
    const json = (await resp.json()) as {
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: { coordinates?: [number, number][] };
      }>;
    };
    const route = json?.routes?.[0];
    if (!route?.geometry?.coordinates?.length) return null;
    return {
      coordinates: route.geometry.coordinates,
      distanceKm: Number(((route.distance || 0) / 1000).toFixed(1)),
      durationMin: Math.max(1, Math.round((route.duration || 0) / 60)),
    };
  } catch {
    return null;
  }
}

export default function DeliveryRouteMap({
  pickupLocation,
  dropLocation,
  riderLocation,
  showDrop = false,
  onDropCoordsResolved,
  height = 228,
}: DeliveryRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const riderMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [resolvedDropCoords, setResolvedDropCoords] = useState<{ lat: number; lng: number } | null>(
    typeof dropLocation.lat === 'number' && typeof dropLocation.lng === 'number'
      ? { lat: dropLocation.lat, lng: dropLocation.lng }
      : null,
  );
  const [routeSummary, setRouteSummary] = useState<{
    distanceKm: number;
    durationMin: number;
    isRoadRoute: boolean;
  } | null>(null);

  useEffect(() => {
    if (!showDrop) {
      setResolvedDropCoords(null);
      onDropCoordsResolved?.(null);
      return;
    }
    if (typeof dropLocation.lat === 'number' && typeof dropLocation.lng === 'number') {
      const exact = { lat: dropLocation.lat, lng: dropLocation.lng };
      setResolvedDropCoords(exact);
      onDropCoordsResolved?.(exact);
      return;
    }
    const controller = new AbortController();
    geocodeStopAddress(dropLocation, controller.signal).then((coords) => {
      if (!controller.signal.aborted && coords) {
        setResolvedDropCoords(coords);
        onDropCoordsResolved?.(coords);
      }
    });
    return () => controller.abort();
  }, [
    showDrop,
    dropLocation.lat,
    dropLocation.lng,
    dropLocation.line1,
    dropLocation.city,
    dropLocation.state,
    dropLocation.pincode,
    onDropCoordsResolved,
  ]);

  const activeTarget = useMemo(() => {
    if (!showDrop) {
      return typeof pickupLocation.lat === 'number' && typeof pickupLocation.lng === 'number'
        ? { lat: pickupLocation.lat, lng: pickupLocation.lng }
        : null;
    }
    return resolvedDropCoords;
  }, [showDrop, pickupLocation.lat, pickupLocation.lng, resolvedDropCoords]);

  const routeColor = showDrop ? '#059669' : '#EA580C';

  useEffect(() => {
    if (!containerRef.current) return;

    const centerLng = riderLocation?.lng ?? activeTarget?.lng ?? pickupLocation.lng ?? 77.5946;
    const centerLat = riderLocation?.lat ?? activeTarget?.lat ?? pickupLocation.lat ?? 12.9716;

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

    if (!showDrop && typeof pickupLocation.lat === 'number' && typeof pickupLocation.lng === 'number') {
      const el = document.createElement('div');
      el.style.cssText =
        'width:26px;height:26px;border-radius:50%;background:#FF7900;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.28);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:11px;';
      el.textContent = 'P';
      new maplibregl.Marker({ element: el })
        .setLngLat([pickupLocation.lng, pickupLocation.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 16 }).setHTML(
            `<strong>Pickup:</strong> ${pickupLocation.name}<br/>${pickupLocation.city} (${pickupLocation.pincode})`,
          ),
        )
        .addTo(map);
      bounds.extend([pickupLocation.lng, pickupLocation.lat]);
      pointsCount++;
    }

    if (showDrop && resolvedDropCoords) {
      const el = document.createElement('div');
      el.style.cssText =
        'width:26px;height:26px;border-radius:50%;background:#059669;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.28);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:11px;';
      el.textContent = 'D';
      new maplibregl.Marker({ element: el })
        .setLngLat([resolvedDropCoords.lng, resolvedDropCoords.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 16 }).setHTML(
            `<strong>Customer:</strong> ${dropLocation.name}<br/>${dropLocation.line1}, ${dropLocation.city}`,
          ),
        )
        .addTo(map);
      bounds.extend([resolvedDropCoords.lng, resolvedDropCoords.lat]);
      pointsCount++;
    }

    if (riderLocation) {
      const el = document.createElement('div');
      el.style.cssText =
        'width:20px;height:20px;border-radius:50%;background:#2563EB;border:3px solid #fff;box-shadow:0 0 0 4px rgba(37,99,235,0.24);';
      riderMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([riderLocation.lng, riderLocation.lat])
        .setPopup(new maplibregl.Popup({ offset: 14 }).setText('Your Location'))
        .addTo(map);
      bounds.extend([riderLocation.lng, riderLocation.lat]);
      pointsCount++;
    }

    if (pointsCount >= 2) {
      map.fitBounds(bounds, { padding: 46, maxZoom: 15, duration: 0 });
    }

    const controller = new AbortController();
    let styleReady = false;

    const applyRouteGeometry = (coordinates: [number, number][], dashed: boolean) => {
      if (!styleReady || !mapRef.current) return;
      const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates,
        },
      };

      const existing = map.getSource('delivery-route') as maplibregl.GeoJSONSource | undefined;
      if (existing) {
        existing.setData(geojson);
        if (map.getLayer('delivery-route-line')) {
          map.setPaintProperty('delivery-route-line', 'line-dasharray', dashed ? [2, 2] : [1, 0]);
        }
      } else {
        map.addSource('delivery-route', { type: 'geojson', data: geojson });
        map.addLayer({
          id: 'delivery-route-casing',
          type: 'line',
          source: 'delivery-route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#FFFFFF',
            'line-width': 7,
            'line-opacity': 0.9,
          },
        });
        map.addLayer({
          id: 'delivery-route-line',
          type: 'line',
          source: 'delivery-route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': routeColor,
            'line-width': 4,
            'line-dasharray': dashed ? [2, 2] : [1, 0],
          },
        });
      }

      const routeBounds = new maplibregl.LngLatBounds();
      for (const pt of coordinates) {
        routeBounds.extend(pt);
      }
      map.fitBounds(routeBounds, { padding: 48, maxZoom: 15, duration: 250 });
    };

    const drawRoute = async () => {
      if (!riderLocation || !activeTarget) {
        setRouteSummary(null);
        return;
      }

      const straightCoords: [number, number][] = [
        [riderLocation.lng, riderLocation.lat],
        [activeTarget.lng, activeTarget.lat],
      ];
      applyRouteGeometry(straightCoords, true);

      const road = await fetchRoadRoute(
        { lat: riderLocation.lat, lng: riderLocation.lng },
        activeTarget,
        controller.signal,
      );
      if (controller.signal.aborted || !mapRef.current) return;
      if (road) {
        applyRouteGeometry(road.coordinates, false);
        setRouteSummary({
          distanceKm: road.distanceKm,
          durationMin: road.durationMin,
          isRoadRoute: true,
        });
      } else {
        setRouteSummary(null);
      }
    };

    map.once('load', () => {
      styleReady = true;
      drawRoute();
    });

    mapRef.current = map;

    return () => {
      controller.abort();
      riderMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [
    pickupLocation.lat,
    pickupLocation.lng,
    pickupLocation.name,
    pickupLocation.city,
    pickupLocation.pincode,
    resolvedDropCoords?.lat,
    resolvedDropCoords?.lng,
    showDrop,
    routeColor,
  ]);

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
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid #E5E7EB',
        }}
      >
        <Box ref={containerRef} sx={{ width: '100%', height: '100%' }} />
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            right: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1,
            pointerEvents: 'none',
          }}
        >
          <Box
            sx={{
              bgcolor: 'rgba(17, 24, 39, 0.86)',
              color: '#FFFFFF',
              px: 1.25,
              py: 0.45,
              borderRadius: 1.5,
              display: 'flex',
              gap: 1.25,
              alignItems: 'center',
            }}
          >
            {!showDrop ? (
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#FDBA74' }}>
                ● Pickup
              </Typography>
            ) : (
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#6EE7B7' }}>
                ● Customer
              </Typography>
            )}
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#93C5FD' }}>
              ● You
            </Typography>
          </Box>

          {routeSummary && (
            <Box
              sx={{
                bgcolor: 'rgba(17, 24, 39, 0.86)',
                color: '#FFFFFF',
                px: 1.25,
                py: 0.45,
                borderRadius: 1.5,
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                {routeSummary.distanceKm} km · ~{routeSummary.durationMin} min
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
        {!showDrop ? (
          <Button
            fullWidth
            variant="contained"
            size="medium"
            component="a"
            href={buildGoogleMapsDirectionUrl(pickupLocation)}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<NavigationIcon />}
          >
            Navigate to Pickup Store
          </Button>
        ) : (
          <Button
            fullWidth
            variant="contained"
            size="medium"
            color="success"
            component="a"
            href={buildGoogleMapsDirectionUrl(dropLocation)}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<NavigationIcon />}
          >
            Navigate to Customer
          </Button>
        )}
      </Stack>
    </Box>
  );
}
