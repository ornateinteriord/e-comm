package biz.eshopy.delivery;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.Settings;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

public final class OrderRingController {
    private static final String TAG = "OrderRingController";

    public static final String PREFS_NAME = "eshopy_rider_monitor";
    public static final String KEY_API_BASE_URL = "api_base_url";
    public static final String KEY_FALLBACK_API_BASE_URL = "fallback_api_base_url";
    public static final String KEY_AUTH_TOKEN = "auth_token";
    public static final String KEY_REFRESH_TOKEN = "refresh_token";
    public static final String KEY_PARTNER_ID = "partner_id";
    public static final String KEY_MONITOR_ENABLED = "monitor_enabled";
    public static final String KEY_LAST_POLL_INFO = "last_poll_info";
    public static final String KEY_ALERTED_IDS = "alerted_assignment_ids";
    public static final String EXTRA_OPEN_ROUTE = "openRoute";
    public static final String ACTION_RESTART_MONITOR = "biz.eshopy.delivery.ACTION_RESTART_MONITOR";

    public static final String ALERT_CHANNEL_ID = "eshopy_order_assignments_v3";
    public static final String MONITOR_CHANNEL_ID = "eshopy_order_monitor_v1";
    public static final int ALERT_NOTIFICATION_ID = 41001;
    public static final int RESTART_ALARM_REQUEST_CODE = 41009;
    public static final long DEFAULT_RING_MS = 30_000L;

    private static volatile boolean appInForeground = false;
    private static volatile String pendingLaunchRoute = null;

    private static final Handler mainHandler = new Handler(Looper.getMainLooper());
    private static MediaPlayer mediaPlayer;
    private static PowerManager.WakeLock partialWakeLock;
    private static PowerManager.WakeLock screenWakeLock;
    private static AudioFocusRequest audioFocusRequest;
    private static Runnable autoStopRunnable;
    private static String activeRingingAssignmentId = null;

    private OrderRingController() {}

    public static void setAppForeground(boolean foreground) {
        appInForeground = foreground;
    }

    public static boolean isAppForegroundAndInteractive(Context ctx) {
        if (!appInForeground) return false;
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        return pm == null || pm.isInteractive();
    }

    public static void setPendingLaunchRoute(String route) {
        pendingLaunchRoute = route;
    }

    public static String consumePendingLaunchRoute() {
        String r = pendingLaunchRoute;
        pendingLaunchRoute = null;
        return r;
    }

    public static SharedPreferences getPrefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static boolean isMonitorEnabled(Context ctx) {
        return getPrefs(ctx).getBoolean(KEY_MONITOR_ENABLED, false);
    }

    public static void setMonitorEnabled(Context ctx, boolean enabled) {
        getPrefs(ctx).edit().putBoolean(KEY_MONITOR_ENABLED, enabled).apply();
    }

    public static boolean hasAlertedAssignment(Context ctx, String assignmentId) {
        if (assignmentId == null || assignmentId.isEmpty()) return false;
        Set<String> ids = getPrefs(ctx).getStringSet(KEY_ALERTED_IDS, Collections.emptySet());
        return ids != null && ids.contains(assignmentId);
    }

    public static void markAlertedAssignment(Context ctx, String assignmentId) {
        if (assignmentId == null || assignmentId.isEmpty()) return;
        SharedPreferences prefs = getPrefs(ctx);
        Set<String> current = prefs.getStringSet(KEY_ALERTED_IDS, Collections.emptySet());
        Set<String> updated = new HashSet<>(current != null ? current : Collections.emptySet());
        if (updated.size() > 80) {
            updated.clear();
        }
        updated.add(assignmentId);
        prefs.edit().putStringSet(KEY_ALERTED_IDS, updated).apply();
    }

    public static boolean canUseFullScreenIntent(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            return nm != null && nm.canUseFullScreenIntent();
        }
        return true;
    }

    public static void scheduleMonitorRestart(Context ctx, long delayMs) {
        try {
            Context appCtx = ctx.getApplicationContext();
            if (!isMonitorEnabled(appCtx)) return;

            AlarmManager am = (AlarmManager) appCtx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;

            Intent restartIntent = new Intent(appCtx, OrderMonitorRestartReceiver.class);
            restartIntent.setAction(ACTION_RESTART_MONITOR);
            PendingIntent pi = PendingIntent.getBroadcast(
                appCtx,
                RESTART_ALARM_REQUEST_CODE,
                restartIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            long triggerAt = SystemClock.elapsedRealtime() + Math.max(500L, delayMs);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi);
            } else {
                am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi);
            }
            Log.d(TAG, "Scheduled monitor restart in " + delayMs + "ms");
        } catch (Exception ex) {
            Log.w(TAG, "Failed to schedule monitor restart: " + ex.getMessage());
        }
    }

    public static void cancelMonitorRestart(Context ctx) {
        try {
            Context appCtx = ctx.getApplicationContext();
            AlarmManager am = (AlarmManager) appCtx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            Intent restartIntent = new Intent(appCtx, OrderMonitorRestartReceiver.class);
            restartIntent.setAction(ACTION_RESTART_MONITOR);
            PendingIntent pi = PendingIntent.getBroadcast(
                appCtx,
                RESTART_ALARM_REQUEST_CODE,
                restartIntent,
                PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
            );
            if (pi != null) {
                am.cancel(pi);
                pi.cancel();
            }
        } catch (Exception ignored) {
        }
    }

    public static void ensureChannels(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            if (nm == null) return;

            if (nm.getNotificationChannel(ALERT_CHANNEL_ID) == null) {
                NotificationChannel alertCh = new NotificationChannel(
                    ALERT_CHANNEL_ID,
                    "Urgent Order Alerts",
                    NotificationManager.IMPORTANCE_HIGH
                );
                alertCh.setDescription("Incoming delivery assignment bell & lockscreen alert");
                alertCh.enableVibration(true);
                alertCh.setBypassDnd(true);
                alertCh.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
                Uri soundUri = Uri.parse("android.resource://" + ctx.getPackageName() + "/" + R.raw.alrm_bell);
                alertCh.setSound(
                    soundUri,
                    new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                );
                nm.createNotificationChannel(alertCh);
            }

            if (nm.getNotificationChannel(MONITOR_CHANNEL_ID) == null) {
                NotificationChannel monitorCh = new NotificationChannel(
                    MONITOR_CHANNEL_ID,
                    "Rider Order Listener",
                    NotificationManager.IMPORTANCE_LOW
                );
                monitorCh.setDescription("Keeps delivery alerts active when screen is locked or app is closed");
                monitorCh.setSound(null, null);
                nm.createNotificationChannel(monitorCh);
            }
        }
    }

    private static Vibrator resolveVibrator(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager vm = (VibratorManager) ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return vm != null ? vm.getDefaultVibrator() : null;
        }
        return (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
    }

    @SuppressWarnings("deprecation")
    private static void acquireWakeLocks(Context ctx, long durationMs) {
        try {
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            if (pm == null) return;

            partialWakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "eshopy:OrderRingWakeLock");
            partialWakeLock.setReferenceCounted(false);
            partialWakeLock.acquire(durationMs + 3000L);

            screenWakeLock = pm.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK |
                PowerManager.ACQUIRE_CAUSES_WAKEUP |
                PowerManager.ON_AFTER_RELEASE,
                "eshopy:OrderScreenWakeLock"
            );
            screenWakeLock.setReferenceCounted(false);
            screenWakeLock.acquire(Math.min(15_000L, durationMs));
        } catch (Exception ex) {
            Log.w(TAG, "WakeLock acquire warning: " + ex.getMessage());
        }
    }

    private static void requestAudioFocus(Context ctx, int usage) {
        try {
            AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
            if (am == null) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                    .setAudioAttributes(
                        new AudioAttributes.Builder()
                            .setUsage(usage)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    .setAcceptsDelayedFocusGain(false)
                    .build();
                am.requestAudioFocus(audioFocusRequest);
            } else {
                am.requestAudioFocus(null, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
            }
        } catch (Exception ignored) {
        }
    }

    private static void releaseAudioFocus(Context ctx) {
        if (ctx == null) return;
        try {
            AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
            if (am == null) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
                am.abandonAudioFocusRequest(audioFocusRequest);
                audioFocusRequest = null;
            }
        } catch (Exception ignored) {
        }
    }

    public static void startRinging(
        Context rawCtx,
        String assignmentId,
        String orderNumber,
        String pickupName,
        String pickupCity,
        String payoutText,
        long requestedDurationMs,
        boolean triggerLaunchIntent
    ) {
        final Context ctx = rawCtx.getApplicationContext();
        final long durationMs = Math.max(1_000L, Math.min(60_000L, requestedDurationMs));

        mainHandler.post(() -> {
            if (assignmentId != null && assignmentId.equals(activeRingingAssignmentId) && mediaPlayer != null) {
                return;
            }

            stopRinging(ctx, false);
            activeRingingAssignmentId = assignmentId;
            markAlertedAssignment(ctx, assignmentId);
            acquireWakeLocks(ctx, durationMs);

            boolean playingAudio = false;
            try {
                AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
                boolean ringSilent = am != null && am.getStreamVolume(AudioManager.STREAM_RING) == 0;
                int usage = ringSilent ? AudioAttributes.USAGE_ALARM : AudioAttributes.USAGE_NOTIFICATION_RINGTONE;

                requestAudioFocus(ctx, usage);

                Uri rawBellUri = Uri.parse("android.resource://" + ctx.getPackageName() + "/" + R.raw.alrm_bell);
                MediaPlayer player = new MediaPlayer();
                player.setAudioAttributes(
                    new AudioAttributes.Builder()
                        .setUsage(usage)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                );

                try {
                    player.setDataSource(ctx, rawBellUri);
                } catch (Exception fallbackEx) {
                    Uri defaultRing = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                    if (defaultRing == null) {
                        defaultRing = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                    }
                    player.setDataSource(ctx, defaultRing);
                }

                player.setOnErrorListener((mp, what, extra) -> {
                    Log.w(TAG, "MediaPlayer error what=" + what + " extra=" + extra);
                    return false;
                });

                player.setLooping(true);
                player.prepare();
                player.start();
                mediaPlayer = player;
                playingAudio = true;
                Log.d(TAG, "Started ALRMBell ringing for assignment " + assignmentId);
            } catch (Exception ex) {
                Log.w(TAG, "MediaPlayer bell playback failed: " + ex.getMessage());
            }

            try {
                Vibrator vibrator = resolveVibrator(ctx);
                if (vibrator != null && vibrator.hasVibrator()) {
                    long[] pattern = new long[] { 0, 450, 250, 450, 900 };
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                    } else {
                        vibrator.vibrate(pattern, 0);
                    }
                }
            } catch (Exception ignored) {
            }

            String targetRoute = assignmentId != null && !assignmentId.isEmpty()
                ? "/incoming-order/" + assignmentId
                : "/";

            setPendingLaunchRoute(targetRoute);
            OrderAlertPlugin.notifyLaunchRoute(targetRoute);
            postUrgentNotification(ctx, targetRoute, orderNumber, pickupName, pickupCity, payoutText, playingAudio);

            if (triggerLaunchIntent && (canDrawOverlay(ctx) || canUseFullScreenIntent(ctx))) {
                try {
                    Intent launch = new Intent(ctx, MainActivity.class);
                    launch.putExtra(EXTRA_OPEN_ROUTE, targetRoute);
                    launch.addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK |
                        Intent.FLAG_ACTIVITY_SINGLE_TOP |
                        Intent.FLAG_ACTIVITY_CLEAR_TOP
                    );
                    ctx.startActivity(launch);
                    Log.d(TAG, "Triggered MainActivity launch for route " + targetRoute);
                } catch (Exception ex) {
                    Log.w(TAG, "Direct activity launch failed (using notification/pending route): " + ex.getMessage());
                }
            }

            autoStopRunnable = () -> stopRinging(ctx, false);
            mainHandler.postDelayed(autoStopRunnable, durationMs);
        });
    }

    public static void stopRinging(Context rawCtx, boolean clearNotification) {
        final Context ctx = rawCtx != null ? rawCtx.getApplicationContext() : null;
        mainHandler.post(() -> {
            activeRingingAssignmentId = null;
            if (autoStopRunnable != null) {
                mainHandler.removeCallbacks(autoStopRunnable);
                autoStopRunnable = null;
            }
            if (mediaPlayer != null) {
                try {
                    if (mediaPlayer.isPlaying()) mediaPlayer.stop();
                } catch (Exception ignored) {
                }
                try {
                    mediaPlayer.release();
                } catch (Exception ignored) {
                }
                mediaPlayer = null;
            }
            if (partialWakeLock != null) {
                try {
                    if (partialWakeLock.isHeld()) partialWakeLock.release();
                } catch (Exception ignored) {
                }
                partialWakeLock = null;
            }
            if (screenWakeLock != null) {
                try {
                    if (screenWakeLock.isHeld()) screenWakeLock.release();
                } catch (Exception ignored) {
                }
                screenWakeLock = null;
            }
            releaseAudioFocus(ctx);
            if (ctx != null) {
                try {
                    Vibrator vibrator = resolveVibrator(ctx);
                    if (vibrator != null) vibrator.cancel();
                } catch (Exception ignored) {
                }
                if (clearNotification) {
                    try {
                        NotificationManagerCompat.from(ctx).cancel(ALERT_NOTIFICATION_ID);
                    } catch (Exception ignored) {
                    }
                }
            }
        });
    }

    public static boolean canDrawOverlay(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        return Settings.canDrawOverlays(ctx);
    }

    private static void postUrgentNotification(
        Context ctx,
        String targetRoute,
        String orderNumber,
        String pickupName,
        String pickupCity,
        String payoutText,
        boolean silentNotificationAudio
    ) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (
                    ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED
                ) {
                    return;
                }
            }
            ensureChannels(ctx);

            Intent fullScreenIntent = new Intent(ctx, MainActivity.class);
            fullScreenIntent.putExtra(EXTRA_OPEN_ROUTE, targetRoute);
            fullScreenIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_SINGLE_TOP |
                Intent.FLAG_ACTIVITY_CLEAR_TOP
            );
            PendingIntent fullScreenPi = PendingIntent.getActivity(
                ctx,
                1001,
                fullScreenIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            String title = "New Delivery Assigned" + (orderNumber.isEmpty() ? "" : " (#" + orderNumber + ")");
            String body = "Pickup: " + pickupName +
                (pickupCity.isEmpty() ? "" : " (" + pickupCity + ")") +
                (payoutText.isEmpty() ? "" : " • Earn " + payoutText);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, ALERT_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_order)
                .setColor(0xFFFF7900)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setSilent(silentNotificationAudio)
                .setContentIntent(fullScreenPi)
                .setFullScreenIntent(fullScreenPi, true);

            NotificationManagerCompat.from(ctx).notify(ALERT_NOTIFICATION_ID, builder.build());
        } catch (Exception ex) {
            Log.w(TAG, "Failed to post urgent notification: " + ex.getMessage());
        }
    }
}
