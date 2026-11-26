import { describe, it, expect } from 'vitest';
import { buildGoogleMapsDirectionUrl, formatRupeesFromPaise } from '../utils/navigation';

describe('Delivery App Utilities', () => {
  it('builds coordinate-based Google Maps navigation URL when lat/lng are available', () => {
    const url = buildGoogleMapsDirectionUrl({
      name: 'Hub A',
      phone: '9999999999',
      line1: 'MG Road',
      city: 'Bengaluru',
      pincode: '560001',
      lat: 12.9716,
      lng: 77.5946,
    });
    expect(url).toBe('https://www.google.com/maps/dir/?api=1&destination=12.9716,77.5946');
  });

  it('falls back to encoded street address when coordinates are absent', () => {
    const url = buildGoogleMapsDirectionUrl({
      name: 'Customer',
      phone: '9999999999',
      line1: '100 Feet Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560038',
    });
    expect(url).toContain('https://www.google.com/maps/dir/?api=1&destination=');
    expect(decodeURIComponent(url)).toContain('100 Feet Road, Bengaluru, Karnataka, 560038');
  });

  it('formats paise values accurately in INR', () => {
    expect(formatRupeesFromPaise(4500)).toBe('₹45.00');
    expect(formatRupeesFromPaise(125050)).toBe('₹1,250.50');
  });
});
