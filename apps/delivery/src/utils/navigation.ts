import type { DeliveryStopLocation } from '@ornate/types';

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
