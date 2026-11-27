package biz.eshopy.delivery;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;
import androidx.core.content.ContextCompat;

public class OrderMonitorRestartReceiver extends BroadcastReceiver {
    private static final String TAG = "OrderMonitorReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null) return;
        SharedPreferences prefs = OrderRingController.getPrefs(context);
        boolean enabled = prefs.getBoolean(OrderRingController.KEY_MONITOR_ENABLED, false);
        String token = prefs.getString(OrderRingController.KEY_AUTH_TOKEN, "");
        String primaryUrl = prefs.getString(OrderRingController.KEY_API_BASE_URL, "");
        String fallbackUrl = prefs.getString(OrderRingController.KEY_FALLBACK_API_BASE_URL, "");

        boolean hasUrl = (primaryUrl != null && !primaryUrl.isEmpty())
            || (fallbackUrl != null && !fallbackUrl.isEmpty());

        if (!enabled || token == null || token.isEmpty() || !hasUrl) {
            Log.d(TAG, "Skipping monitor restart (offline or missing credentials)");
            return;
        }

        try {
            Log.d(TAG, "Starting OrderMonitorService from receiver action=" + (intent != null ? intent.getAction() : "none"));
            ContextCompat.startForegroundService(context, new Intent(context, OrderMonitorService.class));
        } catch (Exception ex) {
            Log.w(TAG, "Could not start OrderMonitorService from receiver: " + ex.getMessage());
        }
    }
}
