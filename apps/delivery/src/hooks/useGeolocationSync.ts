import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import api from '../api/client';
import { useDeliveryAuthStore } from '../store/auth.store';
import type { DeliveryGeoPoint } from '@ornate/types';

export interface GeolocationSyncState {
  coords: DeliveryGeoPoint | null;
  gpsStatus: 'checking' | 'tracking' | 'denied' | 'unsupported';
  isGpsReady: boolean;
  lastSyncedAt: string | null;
  permissionError: string | null;
  pingNow: () => Promise<DeliveryGeoPoint | null>;
}

export function useGeolocationSync(activeAssignmentId?: string | null): GeolocationSyncState {
  const { partner, isAuthenticated, updatePartnerProfile } = useDeliveryAuthStore();
  const [coords, setCoords] = useState<DeliveryGeoPoint | null>(partner?.currentLocation || null);
  const [gpsStatus, setGpsStatus] = useState<GeolocationSyncState['gpsStatus']>('checking');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    partner?.currentLocation?.updatedAt || null,
  );
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const lastSentRef = useRef<number>(0);

  const isNative = Capacitor.isNativePlatform();

  const syncLocationToBackend = useCallback(
    async (lat: number, lng: number, force = false) => {
      const point: DeliveryGeoPoint = {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        updatedAt: new Date().toISOString(),
      };
      setCoords(point);
      setGpsStatus('tracking');
      setPermissionError(null);
      updatePartnerProfile({ currentLocation: point });

      const now = Date.now();
      if (!force && now - lastSentRef.current < 15_000) {
        return point;
      }
      lastSentRef.current = now;

      try {
        await api.post('/delivery/me/location', { lat: point.lat, lng: point.lng });
        if (activeAssignmentId) {
          await api
            .post(`/delivery/assignments/${activeAssignmentId}/location`, {
              lat: point.lat,
              lng: point.lng,
            })
            .catch(() => undefined);
        }
        setLastSyncedAt(point.updatedAt || new Date().toISOString());
      } catch {
        // Non-blocking telemetry
      }
      return point;
    },
    [activeAssignmentId, updatePartnerProfile],
  );

  const pingNow = useCallback(async (): Promise<DeliveryGeoPoint | null> => {
    setGpsStatus('checking');

    if (isNative) {
      try {
        const perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
          const reqPerm = await Geolocation.requestPermissions();
          if (reqPerm.location !== 'granted' && reqPerm.coarseLocation !== 'granted') {
            setGpsStatus('denied');
            setPermissionError('Location permission denied. Enable GPS in Android settings.');
            return null;
          }
        }
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 12_000,
        });
        return await syncLocationToBackend(pos.coords.latitude, pos.coords.longitude, true);
      } catch (err: unknown) {
        setGpsStatus('denied');
        setPermissionError(
          err instanceof Error ? err.message : 'Unable to fetch GPS location. Turn on device GPS.',
        );
        return null;
      }
    }

    if (!navigator.geolocation) {
      setGpsStatus('unsupported');
      setPermissionError('Geolocation is not supported on this browser.');
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const point = await syncLocationToBackend(
            position.coords.latitude,
            position.coords.longitude,
            true,
          );
          resolve(point);
        },
        (err) => {
          setGpsStatus('denied');
          setCoords(null);
          setPermissionError(
            err.code === err.PERMISSION_DENIED
              ? 'Location permission is blocked. Allow GPS in browser settings to go online.'
              : err.message || 'GPS signal unavailable. Enable location services and retry.',
          );
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 },
      );
    });
  }, [isNative, syncLocationToBackend]);

  // Continuous watcher whenever authenticated so GPS Live / GPS Off is always accurate
  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    let nativeWatchId: string | null = null;
    let webWatchId: number | null = null;

    const startWatch = async () => {
      if (isNative) {
        try {
          const perm = await Geolocation.checkPermissions();
          if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
            const reqPerm = await Geolocation.requestPermissions();
            if (reqPerm.location !== 'granted' && reqPerm.coarseLocation !== 'granted') {
              if (!cancelled) {
                setGpsStatus('denied');
                setPermissionError('Location permission is required to go online.');
              }
              return;
            }
          }
          nativeWatchId = await Geolocation.watchPosition(
            { enableHighAccuracy: true, timeout: 15_000 },
            (position, err) => {
              if (cancelled) return;
              if (err || !position) {
                setGpsStatus('denied');
                setPermissionError(err?.message || 'GPS signal lost. Turn on location services.');
                return;
              }
              syncLocationToBackend(position.coords.latitude, position.coords.longitude);
            },
          );
        } catch (err: unknown) {
          if (!cancelled) {
            setGpsStatus('denied');
            setPermissionError(err instanceof Error ? err.message : 'GPS unavailable.');
          }
        }
        return;
      }

      if (!navigator.geolocation) {
        if (!cancelled) {
          setGpsStatus('unsupported');
          setPermissionError('Geolocation is not supported on this device.');
        }
        return;
      }

      // Probe initial fix immediately so UI reflects real GPS state even while Offline
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!cancelled) {
            syncLocationToBackend(pos.coords.latitude, pos.coords.longitude);
          }
        },
        (err) => {
          if (!cancelled) {
            setGpsStatus('denied');
            setCoords(null);
            setPermissionError(
              err.code === err.PERMISSION_DENIED
                ? 'Location permission blocked. Allow GPS in browser settings.'
                : 'GPS is off or unavailable. Turn on location services.',
            );
          }
        },
        { enableHighAccuracy: true, maximumAge: 15_000, timeout: 10_000 },
      );

      webWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (!cancelled) {
            syncLocationToBackend(pos.coords.latitude, pos.coords.longitude);
          }
        },
        (err) => {
          if (!cancelled) {
            setGpsStatus('denied');
            setCoords(null);
            setPermissionError(
              err.code === err.PERMISSION_DENIED
                ? 'Location permission blocked. Allow GPS in browser settings.'
                : err.message || 'GPS signal lost.',
            );
          }
        },
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
      );
    };

    startWatch();

    return () => {
      cancelled = true;
      if (nativeWatchId !== null) {
        Geolocation.clearWatch({ id: nativeWatchId }).catch(() => undefined);
      }
      if (webWatchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(webWatchId);
      }
    };
  }, [isAuthenticated, isNative, syncLocationToBackend]);

  return {
    coords,
    gpsStatus,
    isGpsReady: gpsStatus === 'tracking' && Boolean(coords),
    lastSyncedAt,
    permissionError,
    pingNow,
  };
}
