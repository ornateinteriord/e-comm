import type { DeliveryAssignment, DeliveryGeoPoint, DeliveryStopLocation } from '@ornate/types';

export const PICKUP_GEOFENCE_RADIUS_METERS = 300;
export const CUSTOMER_GEOFENCE_RADIUS_METERS = 300;

export function buildGoogleMapsDirectionUrl(stop: DeliveryStopLocation): string {
  if (typeof stop.lat === 'number' && typeof stop.lng === 'number') {
    return `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`;
  }
  const address = [stop.line1, stop.line2, stop.city, stop.state, stop.pincode]
    .filter(Boolean)
    .join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

export function formatRupeesFromPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function isAssignmentDropUnlocked(
  assignment: Pick<DeliveryAssignment, 'status' | 'isDropLocked' | 'pickedUpAt'>,
): boolean {
  if (assignment.isDropLocked === false) return true;
  if (assignment.isDropLocked === true) return false;
  if (['picked_up', 'in_transit', 'arrived_customer', 'delivered'].includes(assignment.status)) {
    return true;
  }
  return Boolean(assignment.pickedUpAt);
}

export function resolveVisibleReceiverName(
  assignment: Pick<DeliveryAssignment, 'status' | 'isDropLocked' | 'pickedUpAt' | 'dropLocation'>,
): string {
  if (!isAssignmentDropUnlocked(assignment)) return '';
  const name = (assignment.dropLocation?.name || '').trim();
  if (!name || /unlocks after pickup/i.test(name)) return '';
  return name;
}

export function calculateStopDistanceMeters(
  fromLat?: number | null,
  fromLng?: number | null,
  toLat?: number | null,
  toLng?: number | null,
): number | null {
  if (
    typeof fromLat !== 'number' ||
    typeof fromLng !== 'number' ||
    typeof toLat !== 'number' ||
    typeof toLng !== 'number' ||
    Number.isNaN(fromLat) ||
    Number.isNaN(fromLng) ||
    Number.isNaN(toLat) ||
    Number.isNaN(toLng)
  ) {
    return null;
  }
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function formatDistanceMetersLabel(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function calculateStopDistanceKm(
  fromLat?: number | null,
  fromLng?: number | null,
  toLat?: number | null,
  toLng?: number | null,
): number | null {
  const meters = calculateStopDistanceMeters(fromLat, fromLng, toLat, toLng);
  if (meters === null) return null;
  return Number((meters / 1000).toFixed(1));
}

export function areAllItemsChecked(
  totalItems: number,
  checkedMap: Record<number, boolean>,
): boolean {
  if (totalItems <= 0) return true;
  for (let i = 0; i < totalItems; i++) {
    if (!checkedMap[i]) return false;
  }
  return true;
}

export function evaluateStopGeofence(params: {
  milestone: 'pickup' | 'customer';
  liveRiderCoords?: DeliveryGeoPoint | null;
  pickupLocation: Partial<DeliveryStopLocation>;
  dropLocation?: Partial<DeliveryStopLocation>;
  maxRadiusMeters?: number;
}): string | null {
  const maxRadius = params.maxRadiusMeters ?? PICKUP_GEOFENCE_RADIUS_METERS;
  const { liveRiderCoords, pickupLocation, dropLocation } = params;

  if (
    !liveRiderCoords ||
    typeof liveRiderCoords.lat !== 'number' ||
    typeof liveRiderCoords.lng !== 'number'
  ) {
    return params.milestone === 'pickup'
      ? 'Live GPS is off. Turn on location access to verify you are at the pickup store.'
      : 'Live GPS is off. Turn on location access to verify you reached the customer address.';
  }

  if (params.milestone === 'pickup') {
    const pickupDist = calculateStopDistanceMeters(
      liveRiderCoords.lat,
      liveRiderCoords.lng,
      pickupLocation.lat,
      pickupLocation.lng,
    );
    if (pickupDist !== null && pickupDist > maxRadius) {
      return `Move within ${maxRadius} m of ${pickupLocation.name || 'pickup store'} to confirm arrival/pickup (${formatDistanceMetersLabel(pickupDist)} away).`;
    }
    return null;
  }

  const dropDist = calculateStopDistanceMeters(
    liveRiderCoords.lat,
    liveRiderCoords.lng,
    dropLocation?.lat,
    dropLocation?.lng,
  );
  if (dropDist !== null && dropDist > maxRadius) {
    return `Move within ${maxRadius} m of ${dropLocation?.name || 'customer location'} to mark arrived or deliver (${formatDistanceMetersLabel(dropDist)} away).`;
  }

  if (dropDist === null) {
    const pickupDist = calculateStopDistanceMeters(
      liveRiderCoords.lat,
      liveRiderCoords.lng,
      pickupLocation.lat,
      pickupLocation.lng,
    );
    const sameStreet =
      Boolean(pickupLocation.line1 && dropLocation?.line1) &&
      pickupLocation.line1!.trim().toLowerCase() === dropLocation!.line1!.trim().toLowerCase();
    if (!sameStreet && pickupDist !== null && pickupDist <= maxRadius) {
      return 'You are still at the pickup store address. Travel to the customer location before marking arrived.';
    }
  }

  return null;
}

const geocodeCache = new Map<string, { lat: number; lng: number }>();

export async function geocodeStopAddress(
  stop: Partial<DeliveryStopLocation>,
  signal: AbortSignal,
): Promise<{ lat: number; lng: number } | null> {
  if (typeof stop.lat === 'number' && typeof stop.lng === 'number') {
    return { lat: stop.lat, lng: stop.lng };
  }

  const candidates = [
    [stop.line1, stop.city, stop.state, stop.pincode, 'India'].filter(Boolean).join(', '),
    [stop.city, stop.pincode, 'India'].filter(Boolean).join(', '),
    [stop.pincode, 'India'].filter(Boolean).join(', '),
  ].filter(Boolean);

  for (const query of candidates) {
    const cached = geocodeCache.get(query);
    if (cached) return cached;
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
        { signal },
      );
      if (!resp.ok) continue;
      const results = (await resp.json()) as Array<{ lat?: string; lon?: string }>;
      if (results?.[0]?.lat && results?.[0]?.lon) {
        const point = { lat: Number(results[0].lat), lng: Number(results[0].lon) };
        if (!Number.isNaN(point.lat) && !Number.isNaN(point.lng)) {
          geocodeCache.set(query, point);
          return point;
        }
      }
    } catch {
      if (signal.aborted) return null;
    }
  }
  return null;
}
