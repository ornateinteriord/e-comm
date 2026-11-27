import { describe, it, expect } from 'vitest';
import {
  areAllItemsChecked,
  buildGoogleMapsDirectionUrl,
  calculateStopDistanceKm,
  calculateStopDistanceMeters,
  evaluateStopGeofence,
  formatDistanceMetersLabel,
  formatRupeesFromPaise,
  isAssignmentDropUnlocked,
  resolveVisibleReceiverName,
} from '../utils/navigation';
import { resolveNextPendingAlert } from '../utils/orderAlertAudio';
import type { DeliveryAssignment } from '@ornate/types';

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

  it('unlocks customer drop details only after pickup confirmation', () => {
    expect(isAssignmentDropUnlocked({ status: 'assigned', isDropLocked: true })).toBe(false);
    expect(isAssignmentDropUnlocked({ status: 'accepted' })).toBe(false);
    expect(isAssignmentDropUnlocked({ status: 'arrived_pickup' })).toBe(false);
    expect(isAssignmentDropUnlocked({ status: 'picked_up' })).toBe(true);
    expect(isAssignmentDropUnlocked({ status: 'in_transit', isDropLocked: false })).toBe(true);
    expect(isAssignmentDropUnlocked({ status: 'arrived_customer' })).toBe(true);
  });

  it('calculates distance between coordinates in km and meters', () => {
    const km = calculateStopDistanceKm(12.9716, 77.5946, 12.9352, 77.6245);
    expect(km).toBeGreaterThan(4);
    expect(km).toBeLessThan(7);
    expect(calculateStopDistanceKm(undefined, 77.5, 12.9, 77.6)).toBeNull();
    expect(calculateStopDistanceMeters(12.9716, 77.5946, 12.972, 77.595)).toBeLessThan(100);
    expect(formatDistanceMetersLabel(240)).toBe('240 m');
    expect(formatDistanceMetersLabel(2450)).toBe('2.5 km');
  });

  it('reveals real receiver name only after pickup unlock and ignores locked placeholder', () => {
    expect(
      resolveVisibleReceiverName({
        status: 'accepted',
        isDropLocked: true,
        dropLocation: { name: 'Customer Drop (Unlocks after Pickup)', phone: '', line1: '', city: '', pincode: '' },
      } as DeliveryAssignment),
    ).toBe('');

    expect(
      resolveVisibleReceiverName({
        status: 'picked_up',
        isDropLocked: false,
        dropLocation: { name: 'Customer2', phone: '9876543210', line1: '50', city: 'Bengaluru', pincode: '560061' },
      } as DeliveryAssignment),
    ).toBe('Customer2');
  });

  it('selects only unprompted assigned orders for incoming bell alert', () => {
    const list = [
      { id: 'a1', status: 'accepted' },
      { id: 'a2', status: 'assigned' },
      { id: 'a3', status: 'assigned' },
    ] as DeliveryAssignment[];

    expect(resolveNextPendingAlert(list, new Set())?.id).toBe('a2');
    expect(resolveNextPendingAlert(list, new Set(['a2']))?.id).toBe('a3');
    expect(resolveNextPendingAlert(list, new Set(['a2', 'a3']))).toBeNull();
  });

  it('requires all parcel product checkboxes to be ticked before pickup confirmation', () => {
    expect(areAllItemsChecked(0, {})).toBe(true);
    expect(areAllItemsChecked(2, { 0: true })).toBe(false);
    expect(areAllItemsChecked(2, { 0: true, 1: false })).toBe(false);
    expect(areAllItemsChecked(2, { 0: true, 1: true })).toBe(true);
  });

  it('enforces live GPS and 300m geofence at both pickup and customer locations', () => {
    const pickup = { line1: '17th Main Rd', lat: 12.9716, lng: 77.5946, name: 'Hub' };
    const drop = { line1: '50 Koramangala', lat: 12.91, lng: 77.61, name: 'Customer2' };

    expect(
      evaluateStopGeofence({ milestone: 'pickup', liveRiderCoords: null, pickupLocation: pickup }),
    ).toMatch(/GPS is off/i);

    expect(
      evaluateStopGeofence({
        milestone: 'customer',
        liveRiderCoords: { lat: 12.9716, lng: 77.5946 },
        pickupLocation: pickup,
        dropLocation: drop,
      }),
    ).toMatch(/Move within 300 m/i);

    expect(
      evaluateStopGeofence({
        milestone: 'customer',
        liveRiderCoords: { lat: 12.9716, lng: 77.5946 },
        pickupLocation: pickup,
        dropLocation: { line1: '50 Koramangala' },
      }),
    ).toMatch(/still at the pickup store/i);

    expect(
      evaluateStopGeofence({
        milestone: 'customer',
        liveRiderCoords: { lat: 12.9102, lng: 77.6104 },
        pickupLocation: pickup,
        dropLocation: drop,
      }),
    ).toBeNull();
  });
});
