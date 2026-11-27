import type { DeliveryStopLocation } from '@ornate/types';

const geocodeCache = new Map<string, { lat: number; lng: number }>();

/**
 * Best-effort geocoding for stop addresses when store/shipping coordinates are absent.
 */
export async function geocodeStopLocation(
  stop: Partial<DeliveryStopLocation>,
): Promise<{ lat: number; lng: number } | null> {
  if (typeof stop.lat === 'number' && typeof stop.lng === 'number') {
    return { lat: stop.lat, lng: stop.lng };
  }

  const queries = [
    [stop.line1, stop.city, stop.state, stop.pincode, 'India'].filter(Boolean).join(', '),
    [stop.city, stop.pincode, 'India'].filter(Boolean).join(', '),
    [stop.pincode, 'India'].filter(Boolean).join(', '),
  ].filter(Boolean);

  for (const query of queries) {
    const cached = geocodeCache.get(query);
    if (cached) return cached;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2200);
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'E-Shopy-Delivery-Service/1.0' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) continue;
      const results = (await resp.json()) as Array<{ lat?: string; lon?: string }>;
      const first = results?.[0];
      if (first?.lat && first?.lon) {
        const lat = Number(first.lat);
        const lng = Number(first.lon);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          const point = { lat, lng };
          geocodeCache.set(query, point);
          return point;
        }
      }
    } catch {
      // Best-effort non-blocking geocoding
    }
  }

  return null;
}
