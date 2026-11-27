package biz.eshopy.delivery;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "OrderAlert",
    permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications"),
        @Permission(
            strings = {
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            },
            alias = "location"
        ),
        @Permission(strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION }, alias = "backgroundLocation"),
        @Permission(strings = { Manifest.permission.CAMERA }, alias = "camera"),
        @Permission(strings = { Manifest.permission.READ_MEDIA_IMAGES }, alias = "mediaImages"),
        @Permission(strings = { Manifest.permission.READ_EXTERNAL_STORAGE }, alias = "legacyStorage")
    }
)
public class OrderAlertPlugin extends Plugin {
    private static OrderAlertPlugin activeInstance;

    @Override
    public void load() {
        super.load();
        activeInstance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (activeInstance == this) {
            activeInstance = null;
        }
        super.handleOnDestroy();
    }

    public static void notifyLaunchRoute(String route) {
        OrderRingController.setPendingLaunchRoute(route);
        if (activeInstance != null && route != null && !route.isEmpty()) {
            JSObject payload = new JSObject();
            payload.put("route", route);
            activeInstance.notifyListeners("incomingOrderLaunch", payload, true);
        }
    }

    private boolean isGranted(Context ctx, String perm) {
        return ContextCompat.checkSelfPermission(ctx, perm) == PackageManager.PERMISSION_GRANTED;
    }

    private JSObject buildPermissionReport(Context ctx) {
        JSObject obj = new JSObject();
        boolean gpsPerm =
            isGranted(ctx, Manifest.permission.ACCESS_FINE_LOCATION) ||
            isGranted(ctx, Manifest.permission.ACCESS_COARSE_LOCATION);
        boolean bgLoc = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
            || isGranted(ctx, Manifest.permission.ACCESS_BACKGROUND_LOCATION);
        boolean notif = (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || isGranted(ctx, Manifest.permission.POST_NOTIFICATIONS))
            && NotificationManagerCompat.from(ctx).areNotificationsEnabled();
        boolean camera = isGranted(ctx, Manifest.permission.CAMERA);
        boolean files = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            ? isGranted(ctx, Manifest.permission.READ_MEDIA_IMAGES)
            : isGranted(ctx, Manifest.permission.READ_EXTERNAL_STORAGE);
        boolean overlay = OrderRingController.canDrawOverlay(ctx);
        boolean fullScreenIntent = OrderRingController.canUseFullScreenIntent(ctx);

        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        boolean batteryUnrestricted = Build.VERSION.SDK_INT < Build.VERSION_CODES.M
            || pm == null
            || pm.isIgnoringBatteryOptimizations(ctx.getPackageName());

        LocationManager lm = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
        boolean gpsHardwareOn = true;
        if (lm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            gpsHardwareOn = lm.isLocationEnabled();
        } else if (lm != null) {
            gpsHardwareOn =
                lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        }

        obj.put("gps", gpsPerm ? "granted" : "denied");
        obj.put("gpsEnabled", gpsHardwareOn);
        obj.put("backgroundLocation", bgLoc ? "granted" : "denied");
        obj.put("notifications", notif ? "granted" : "denied");
        obj.put("camera", camera ? "granted" : "denied");
        obj.put("files", files ? "granted" : "denied");
        obj.put("overlay", overlay ? "granted" : "denied");
        obj.put("backgroundRun", batteryUnrestricted ? "granted" : "denied");
        obj.put("fullScreenIntent", fullScreenIntent ? "granted" : "denied");
        return obj;
    }

    @PluginMethod
    public void checkAllPermissions(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.resolve(new JSObject());
            return;
        }
        call.resolve(buildPermissionReport(ctx));
    }

    @PluginMethod
    public void requestCorePermissions(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.resolve(new JSObject());
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissionForAliases(
                new String[] { "location", "notifications", "camera", "mediaImages" },
                call,
                "corePermsCallback"
            );
        } else {
            requestPermissionForAliases(
                new String[] { "location", "camera", "legacyStorage" },
                call,
                "corePermsCallback"
            );
        }
    }

    @PermissionCallback
    private void corePermsCallback(PluginCall call) {
        Context ctx = getContext();
        call.resolve(ctx != null ? buildPermissionReport(ctx) : new JSObject());
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            JSObject res = new JSObject();
            res.put("notifications", "granted");
            call.resolve(res);
            return;
        }
        if (getPermissionState("notifications") == PermissionState.GRANTED) {
            JSObject res = new JSObject();
            res.put("notifications", "granted");
            call.resolve(res);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationsCallback");
    }

    @PermissionCallback
    private void notificationsCallback(PluginCall call) {
        JSObject res = new JSObject();
        res.put(
            "notifications",
            getPermissionState("notifications") == PermissionState.GRANTED ? "granted" : "denied"
        );
        call.resolve(res);
    }

    @PluginMethod
    public void requestBackgroundLocation(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.resolve(ctx != null ? buildPermissionReport(ctx) : new JSObject());
            return;
        }
        if (!isGranted(ctx, Manifest.permission.ACCESS_FINE_LOCATION)) {
            requestPermissionForAlias("location", call, "corePermsCallback");
            return;
        }
        if (isGranted(ctx, Manifest.permission.ACCESS_BACKGROUND_LOCATION)) {
            call.resolve(buildPermissionReport(ctx));
            return;
        }
        requestPermissionForAlias("backgroundLocation", call, "corePermsCallback");
    }

    @PluginMethod
    public void requestBatteryOptimization(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            call.resolve();
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + ctx.getPackageName()));
            getActivity().startActivity(intent);
        } catch (Exception ex) {
            try {
                getActivity().startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
            } catch (Exception ignored) {
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            call.resolve();
            return;
        }
        try {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + ctx.getPackageName())
            );
            getActivity().startActivity(intent);
        } catch (Exception ex) {
            try {
                getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION));
            } catch (Exception ignored) {
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void requestFullScreenIntentPermission(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            call.resolve();
            return;
        }
        try {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                Uri.parse("package:" + ctx.getPackageName())
            );
            getActivity().startActivity(intent);
        } catch (Exception ex) {
            try {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallback.setData(Uri.fromParts("package", ctx.getPackageName(), null));
                getActivity().startActivity(fallback);
            } catch (Exception ignored) {
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        try {
            getActivity().startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS));
        } catch (Exception ignored) {
        }
        call.resolve();
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.resolve();
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", ctx.getPackageName(), null));
            getActivity().startActivity(intent);
        } catch (Exception ignored) {
        }
        call.resolve();
    }

    @PluginMethod
    public void startBackgroundMonitor(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.resolve();
            return;
        }
        String apiBaseUrl = call.getString("apiBaseUrl", "");
        String fallbackApiBaseUrl = call.getString("fallbackApiBaseUrl", "");
        String authToken = call.getString("authToken", "");
        String refreshToken = call.getString("refreshToken", "");
        String partnerId = call.getString("partnerId", "");

        OrderRingController.cancelMonitorRestart(ctx);
        OrderRingController.getPrefs(ctx)
            .edit()
            .putString(OrderRingController.KEY_API_BASE_URL, apiBaseUrl)
            .putString(OrderRingController.KEY_FALLBACK_API_BASE_URL, fallbackApiBaseUrl)
            .putString(OrderRingController.KEY_AUTH_TOKEN, authToken)
            .putString(OrderRingController.KEY_REFRESH_TOKEN, refreshToken)
            .putString(OrderRingController.KEY_PARTNER_ID, partnerId)
            .putBoolean(OrderRingController.KEY_MONITOR_ENABLED, !authToken.isEmpty() && (!apiBaseUrl.isEmpty() || !fallbackApiBaseUrl.isEmpty()))
            .apply();

        if (!authToken.isEmpty() && (!apiBaseUrl.isEmpty() || !fallbackApiBaseUrl.isEmpty())) {
            Intent serviceIntent = new Intent(ctx, OrderMonitorService.class);
            ContextCompat.startForegroundService(ctx, serviceIntent);
        }
        call.resolve();
    }

    @PluginMethod
    public void stopBackgroundMonitor(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.resolve();
            return;
        }
        OrderRingController.setMonitorEnabled(ctx, false);
        OrderRingController.cancelMonitorRestart(ctx);
        OrderRingController.getPrefs(ctx)
            .edit()
            .remove(OrderRingController.KEY_AUTH_TOKEN)
            .remove(OrderRingController.KEY_REFRESH_TOKEN)
            .apply();
        OrderRingController.stopRinging(ctx, true);
        try {
            ctx.stopService(new Intent(ctx, OrderMonitorService.class));
        } catch (Exception ignored) {
        }
        call.resolve();
    }

    @PluginMethod
    public void startRinging(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.resolve();
            return;
        }
        String assignmentId = call.getString("assignmentId", "");
        String orderNumber = call.getString("orderNumber", "");
        String pickupName = call.getString("pickupName", "Seller Hub");
        String pickupCity = call.getString("pickupCity", "");
        String payoutText = call.getString("payoutText", "");
        long requestedMs = call.getInt("durationMs", (int) OrderRingController.DEFAULT_RING_MS);

        OrderRingController.startRinging(
            ctx,
            assignmentId,
            orderNumber,
            pickupName,
            pickupCity,
            payoutText,
            requestedMs,
            false
        );
        call.resolve();
    }

    @PluginMethod
    public void stopRinging(PluginCall call) {
        OrderRingController.stopRinging(getContext(), true);
        call.resolve();
    }

    @PluginMethod
    public void markAssignmentHandled(PluginCall call) {
        Context ctx = getContext();
        String assignmentId = call.getString("assignmentId", "");
        if (ctx != null && !assignmentId.isEmpty()) {
            OrderRingController.markAlertedAssignment(ctx, assignmentId);
        }
        OrderRingController.stopRinging(ctx, true);
        call.resolve();
    }

    @PluginMethod
    public void consumePendingLaunchRoute(PluginCall call) {
        JSObject res = new JSObject();
        res.put("route", OrderRingController.consumePendingLaunchRoute());
        call.resolve(res);
    }
}
