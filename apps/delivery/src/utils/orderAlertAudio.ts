import { Capacitor, registerPlugin } from '@capacitor/core';
import type { DeliveryAssignment } from '@ornate/types';

export const ORDER_BELL_DURATION_MS = 30_000;

export type PermissionStatusValue = 'granted' | 'denied';

export interface NativePermissionsReport {
  gps: PermissionStatusValue;
  gpsEnabled: boolean;
  backgroundLocation: PermissionStatusValue;
  notifications: PermissionStatusValue;
  camera: PermissionStatusValue;
  files: PermissionStatusValue;
  overlay: PermissionStatusValue;
  backgroundRun: PermissionStatusValue;
  fullScreenIntent?: PermissionStatusValue;
}

interface OrderAlertNativePlugin {
  checkAllPermissions(): Promise<NativePermissionsReport>;
  requestCorePermissions(): Promise<NativePermissionsReport>;
  requestNotificationPermission(): Promise<{ notifications: PermissionStatusValue }>;
  requestBackgroundLocation(): Promise<NativePermissionsReport>;
  requestBatteryOptimization(): Promise<void>;
  requestOverlayPermission(): Promise<void>;
  requestFullScreenIntentPermission(): Promise<void>;
  openLocationSettings(): Promise<void>;
  openAppSettings(): Promise<void>;
  startBackgroundMonitor(options: {
    apiBaseUrl: string;
    fallbackApiBaseUrl?: string;
    authToken: string;
    refreshToken?: string;
    partnerId: string;
  }): Promise<void>;
  stopBackgroundMonitor(): Promise<void>;
  startRinging(options: {
    assignmentId: string;
    orderNumber: string;
    pickupName: string;
    pickupCity?: string;
    payoutText?: string;
    durationMs?: number;
  }): Promise<void>;
  stopRinging(): Promise<void>;
  markAssignmentHandled(options: { assignmentId: string }): Promise<void>;
  consumePendingLaunchRoute(): Promise<{ route?: string | null }>;
  addListener(
    eventName: 'incomingOrderLaunch',
    listenerFunc: (data: { route?: string }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

const OrderAlertNative = registerPlugin<OrderAlertNativePlugin>('OrderAlert');

let activeWebAudioCtx: AudioContext | null = null;
let activeHtmlAudio: HTMLAudioElement | null = null;
let activeChimeInterval: number | null = null;
let activeAutoStopTimer: number | null = null;

function playBellDoubleChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!activeWebAudioCtx || activeWebAudioCtx.state === 'closed') {
      activeWebAudioCtx = new AudioCtx();
    }
    if (activeWebAudioCtx.state === 'suspended') {
      activeWebAudioCtx.resume().catch(() => undefined);
    }

    const ctx = activeWebAudioCtx;
    const now = ctx.currentTime;

    const triggerHit = (offset: number, fundamental: number) => {
      const harmonics = [
        { ratio: 1, gain: 0.38 },
        { ratio: 2, gain: 0.16 },
        { ratio: 3, gain: 0.07 },
      ];
      for (const h of harmonics) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(fundamental * h.ratio, now + offset);
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(h.gain, now + offset + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.65);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.7);
      }
    };

    triggerHit(0.02, 987.77);
    triggerHit(0.32, 1318.51);
  } catch {
    // Web Audio may be unavailable before user interaction
  }
}

export function isAllNativePermissionsGranted(report?: NativePermissionsReport | null): boolean {
  if (!report) return false;
  return (
    report.gps === 'granted' &&
    report.gpsEnabled &&
    report.backgroundLocation === 'granted' &&
    report.notifications === 'granted' &&
    report.camera === 'granted' &&
    report.files === 'granted' &&
    report.backgroundRun === 'granted' &&
    report.overlay === 'granted' &&
    report.fullScreenIntent !== 'denied'
  );
}

export async function checkAllNativePermissions(): Promise<NativePermissionsReport | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    return await OrderAlertNative.checkAllPermissions();
  } catch {
    return null;
  }
}

export async function requestCoreNativePermissions(): Promise<NativePermissionsReport | null> {
  if (!Capacitor.isNativePlatform()) return null;
  return await OrderAlertNative.requestCorePermissions();
}

export async function requestNativeBackgroundLocation(): Promise<NativePermissionsReport | null> {
  if (!Capacitor.isNativePlatform()) return null;
  return await OrderAlertNative.requestBackgroundLocation();
}

export async function requestNativeBatteryOptimization(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await OrderAlertNative.requestBatteryOptimization().catch(() => undefined);
}

export async function requestNativeOverlayPermission(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await OrderAlertNative.requestOverlayPermission().catch(() => undefined);
}

export async function requestNativeFullScreenIntentPermission(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await OrderAlertNative.requestFullScreenIntentPermission().catch(() => undefined);
}

export async function openDeviceLocationSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await OrderAlertNative.openLocationSettings().catch(() => undefined);
}

export async function openDeviceAppSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await OrderAlertNative.openAppSettings().catch(() => undefined);
}

export async function startNativeOrderMonitor(params: {
  apiBaseUrl: string;
  fallbackApiBaseUrl?: string;
  authToken: string;
  refreshToken?: string;
  partnerId: string;
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await OrderAlertNative.startBackgroundMonitor(params).catch(() => undefined);
}

export async function stopNativeOrderMonitor(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await OrderAlertNative.stopBackgroundMonitor().catch(() => undefined);
}

export async function markNativeAssignmentHandled(assignmentId: string): Promise<void> {
  stopOrderBellAlert();
  if (!Capacitor.isNativePlatform()) return;
  await OrderAlertNative.markAssignmentHandled({ assignmentId }).catch(() => undefined);
}

export async function consumePendingNativeLaunchRoute(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const res = await OrderAlertNative.consumePendingLaunchRoute();
    return res?.route || null;
  } catch {
    return null;
  }
}

export function subscribeNativeLaunchRoute(onRoute: (route: string) => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => undefined;
  let removed = false;
  let handlePromise: Promise<{ remove: () => Promise<void> }> | null = null;
  try {
    handlePromise = OrderAlertNative.addListener('incomingOrderLaunch', (data) => {
      if (!removed && data?.route) {
        onRoute(data.route);
      }
    });
  } catch {
    return () => undefined;
  }
  return () => {
    removed = true;
    handlePromise?.then((h) => h.remove()).catch(() => undefined);
  };
}

export async function requestOrderAlertPermission(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await OrderAlertNative.requestNotificationPermission().catch(() => undefined);
    return;
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    await Notification.requestPermission().catch(() => undefined);
  }
}

export function stopOrderBellAlert(): void {
  if (activeAutoStopTimer !== null) {
    window.clearTimeout(activeAutoStopTimer);
    activeAutoStopTimer = null;
  }
  if (activeChimeInterval !== null) {
    window.clearInterval(activeChimeInterval);
    activeChimeInterval = null;
  }
  if (activeHtmlAudio) {
    try {
      activeHtmlAudio.pause();
      activeHtmlAudio.currentTime = 0;
    } catch {
      // Ignore cleanup errors
    }
    activeHtmlAudio = null;
  }
  if (Capacitor.isNativePlatform()) {
    OrderAlertNative.stopRinging().catch(() => undefined);
  }
}

export function startOrderBellAlert(options: {
  assignmentId: string;
  orderNumber: string;
  pickupName: string;
  pickupCity?: string;
  payoutText?: string;
  durationMs?: number;
  onTimeout?: () => void;
}): void {
  stopOrderBellAlert();

  const durationMs = options.durationMs ?? ORDER_BELL_DURATION_MS;

  if (Capacitor.isNativePlatform()) {
    OrderAlertNative.startRinging({
      assignmentId: options.assignmentId,
      orderNumber: options.orderNumber,
      pickupName: options.pickupName,
      pickupCity: options.pickupCity || '',
      payoutText: options.payoutText || '',
      durationMs,
    }).catch(() => {
      playBellDoubleChime();
    });
  } else {
    try {
      const audio = new Audio('/sounds/ALRMBell.wav');
      audio.loop = true;
      activeHtmlAudio = audio;
      audio.play().catch(() => {
        playBellDoubleChime();
        activeChimeInterval = window.setInterval(playBellDoubleChime, 1900);
      });
    } catch {
      playBellDoubleChime();
      activeChimeInterval = window.setInterval(playBellDoubleChime, 1900);
    }

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([450, 220, 450]);
    }

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(`New Delivery Assigned (#${options.orderNumber})`, {
          body: `Pickup: ${options.pickupName}${options.pickupCity ? ` (${options.pickupCity})` : ''}${options.payoutText ? ` • Earn ${options.payoutText}` : ''}`,
          icon: '/favicon.svg',
        });
      } catch {
        // Ignore notification errors
      }
    }
  }

  activeAutoStopTimer = window.setTimeout(() => {
    stopOrderBellAlert();
    options.onTimeout?.();
  }, durationMs);
}

export function playConfirmationChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = activeWebAudioCtx && activeWebAudioCtx.state !== 'closed' ? activeWebAudioCtx : new AudioCtx();
    activeWebAudioCtx = ctx;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => undefined);
    }
    const now = ctx.currentTime;
    [880, 1318.51].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.1 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.1 + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.24);
    });
  } catch {
    // Non-blocking sound cue
  }
}

export function resolveNextPendingAlert(
  assignments: DeliveryAssignment[],
  alreadyPromptedIds: Set<string>,
): DeliveryAssignment | null {
  for (const item of assignments) {
    if (item.status === 'assigned' && !alreadyPromptedIds.has(item.id)) {
      return item;
    }
  }
  return null;
}
