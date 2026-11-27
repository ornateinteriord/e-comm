package biz.eshopy.delivery;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

public class OrderMonitorService extends Service {
    private static final String TAG = "OrderMonitorService";
    private static final int FOREGROUND_NOTIFICATION_ID = 41002;
    private ScheduledExecutorService scheduler;
    private String lastWorkingBaseUrl = null;

    @Override
    public void onCreate() {
        super.onCreate();
        OrderRingController.ensureChannels(this);

        if (!OrderRingController.isMonitorEnabled(this)) {
            stopSelf();
            return;
        }

        startForegroundNotification();
        scheduler = Executors.newSingleThreadScheduledExecutor();
        scheduler.scheduleWithFixedDelay(this::pollAssignedOrders, 1, 5, TimeUnit.SECONDS);
    }

    private void startForegroundNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(
            this,
            1002,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, OrderRingController.MONITOR_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_order)
            .setColor(0xFFFF7900)
            .setContentTitle("E-Shopy Rider Online")
            .setContentText("Listening for new delivery assignments")
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pi)
            .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                FOREGROUND_NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            );
        } else {
            startForeground(FOREGROUND_NOTIFICATION_ID, notification);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!OrderRingController.isMonitorEnabled(this)) {
            Log.d(TAG, "Monitor disabled (rider offline) — stopping service immediately");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
            stopSelf();
            return START_NOT_STICKY;
        }
        startForegroundNotification();
        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        if (OrderRingController.isMonitorEnabled(this)) {
            Log.d(TAG, "Task removed while rider Online — scheduling service keep-alive");
            OrderRingController.scheduleMonitorRestart(this, 1200L);
        } else {
            OrderRingController.cancelMonitorRestart(this);
        }
        super.onTaskRemoved(rootIntent);
    }

    private static class HttpPollResult {
        final int code;
        final String body;
        HttpPollResult(int code, String body) {
            this.code = code;
            this.body = body;
        }
    }

    private HttpPollResult fetchAssignmentsRaw(String baseUrl, String token) throws Exception {
        String endpoint = baseUrl.replaceAll("/+$", "") + "/delivery/assignments?scope=active";
        HttpURLConnection conn = (HttpURLConnection) new URL(endpoint).openConnection();
        try {
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(1800);
            conn.setReadTimeout(4500);
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("X-Client-Type", "delivery");
            conn.setRequestProperty("Accept", "application/json");

            int code = conn.getResponseCode();
            if (code != 200) {
                return new HttpPollResult(code, "");
            }

            StringBuilder sb = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8)
            )) {
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
            }
            return new HttpPollResult(code, sb.toString());
        } finally {
            conn.disconnect();
        }
    }

    private String tryRefreshAuthToken(String baseUrl, SharedPreferences prefs) {
        String refreshToken = prefs.getString(OrderRingController.KEY_REFRESH_TOKEN, "");
        if (refreshToken == null || refreshToken.isEmpty()) return null;

        HttpURLConnection conn = null;
        try {
            String endpoint = baseUrl.replaceAll("/+$", "") + "/delivery/refresh";
            conn = (HttpURLConnection) new URL(endpoint).openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setConnectTimeout(2000);
            conn.setReadTimeout(4500);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("X-Client-Type", "delivery");
            conn.setRequestProperty("X-Requested-With", "XMLHttpRequest");

            JSONObject payload = new JSONObject();
            payload.put("refreshToken", refreshToken);
            byte[] bodyBytes = payload.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(bodyBytes);
            }

            if (conn.getResponseCode() != 200) {
                return null;
            }

            StringBuilder sb = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8)
            )) {
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
            }

            JSONObject root = new JSONObject(sb.toString());
            JSONObject data = root.optJSONObject("data");
            if (data == null) return null;

            String nextAccess = data.optString("accessToken", "");
            String nextRefresh = data.optString("refreshToken", "");
            if (!nextAccess.isEmpty()) {
                SharedPreferences.Editor editor = prefs.edit().putString(OrderRingController.KEY_AUTH_TOKEN, nextAccess);
                if (!nextRefresh.isEmpty()) {
                    editor.putString(OrderRingController.KEY_REFRESH_TOKEN, nextRefresh);
                }
                editor.apply();
                Log.d(TAG, "Refreshed rider accessToken inside background service");
                return nextAccess;
            }
        } catch (Exception ex) {
            Log.w(TAG, "Token refresh attempt failed: " + ex.getMessage());
        } finally {
            if (conn != null) conn.disconnect();
        }
        return null;
    }

    private void pollAssignedOrders() {
        try {
            if (!OrderRingController.isMonitorEnabled(this)) {
                stopSelf();
                return;
            }

            SharedPreferences prefs = OrderRingController.getPrefs(this);
            String primaryUrl = prefs.getString(OrderRingController.KEY_API_BASE_URL, "");
            String fallbackUrl = prefs.getString(OrderRingController.KEY_FALLBACK_API_BASE_URL, "");
            String token = prefs.getString(OrderRingController.KEY_AUTH_TOKEN, "");

            if (token == null || token.isEmpty()) {
                return;
            }

            List<String> candidateBases = new ArrayList<>();
            if (lastWorkingBaseUrl != null && !lastWorkingBaseUrl.isEmpty()) {
                candidateBases.add(lastWorkingBaseUrl);
            }
            if (primaryUrl != null && !primaryUrl.isEmpty() && !candidateBases.contains(primaryUrl)) {
                candidateBases.add(primaryUrl);
            }
            if (fallbackUrl != null && !fallbackUrl.isEmpty() && !candidateBases.contains(fallbackUrl)) {
                candidateBases.add(fallbackUrl);
            }
            if (candidateBases.isEmpty()) return;

            // While foreground WebView is open and interactive, React polls & navigates directly.
            if (OrderRingController.isAppForegroundAndInteractive(this)) {
                return;
            }

            String successBody = null;
            for (String base : candidateBases) {
                try {
                    HttpPollResult res = fetchAssignmentsRaw(base, token);
                    if (res.code == 401) {
                        String renewedToken = tryRefreshAuthToken(base, prefs);
                        if (renewedToken != null && !renewedToken.isEmpty()) {
                            token = renewedToken;
                            res = fetchAssignmentsRaw(base, token);
                        }
                    }
                    if (res.code == 200) {
                        lastWorkingBaseUrl = base;
                        successBody = res.body;
                        prefs.edit().putString(OrderRingController.KEY_LAST_POLL_INFO, "OK@" + base).apply();
                        break;
                    } else {
                        prefs.edit().putString(OrderRingController.KEY_LAST_POLL_INFO, "HTTP_" + res.code + "@" + base).apply();
                        Log.w(TAG, "Poll returned HTTP " + res.code + " from " + base);
                    }
                } catch (Exception netEx) {
                    prefs.edit().putString(OrderRingController.KEY_LAST_POLL_INFO, "ERR@" + base + ":" + netEx.getClass().getSimpleName()).apply();
                    Log.w(TAG, "Poll failed on " + base + ": " + netEx.getMessage());
                }
            }

            if (successBody == null || successBody.isEmpty()) {
                return;
            }

            JSONObject root = new JSONObject(successBody);
            JSONObject data = root.optJSONObject("data");
            JSONArray items = data != null ? data.optJSONArray("items") : null;
            if (items == null) return;

            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (item == null) continue;
                if (!"assigned".equals(item.optString("status"))) continue;

                String assignmentId = item.optString("id");
                if (assignmentId.isEmpty() || OrderRingController.hasAlertedAssignment(this, assignmentId)) {
                    continue;
                }

                String orderNumber = item.optString("orderNumber", "");
                JSONObject pickup = item.optJSONObject("pickupLocation");
                String pickupName = pickup != null ? pickup.optString("name", "Seller Hub") : "Seller Hub";
                String pickupCity = pickup != null ? pickup.optString("city", "") : "";
                long payoutPaise = item.optLong("payoutPaise", 4000L);
                String payoutText = String.format(Locale.US, "₹%.0f", payoutPaise / 100.0);

                OrderRingController.startRinging(
                    this,
                    assignmentId,
                    orderNumber,
                    pickupName,
                    pickupCity,
                    payoutText,
                    OrderRingController.DEFAULT_RING_MS,
                    true
                );
                break;
            }
        } catch (Exception ex) {
            Log.w(TAG, "Unexpected error in pollAssignedOrders: " + ex.getMessage());
        }
    }

    @Override
    public void onDestroy() {
        if (scheduler != null) {
            scheduler.shutdownNow();
            scheduler = null;
        }
        try {
            NotificationManagerCompat.from(this).cancel(FOREGROUND_NOTIFICATION_ID);
        } catch (Exception ignored) {
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
