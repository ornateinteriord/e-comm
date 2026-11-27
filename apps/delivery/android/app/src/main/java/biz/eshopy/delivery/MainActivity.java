package biz.eshopy.delivery;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import androidx.appcompat.app.AppCompatDelegate;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private void handleLaunchIntent(Intent intent) {
        if (intent == null) return;
        String openRoute = intent.getStringExtra(OrderRingController.EXTRA_OPEN_ROUTE);
        if (openRoute != null && !openRoute.isEmpty()) {
            intent.removeExtra(OrderRingController.EXTRA_OPEN_ROUTE);
            OrderAlertPlugin.notifyLaunchRoute(openRoute);
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO);
        registerPlugin(OrderAlertPlugin.class);
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) {
                km.requestDismissKeyguard(this, null);
            }
        }

        getTheme().applyStyle(R.style.AppTheme_LightSystemBarsOverlay, true);
        getWindow().getDecorView().setBackgroundColor(Color.WHITE);

        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(true);
        controller.setAppearanceLightNavigationBars(true);

        handleLaunchIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleLaunchIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        OrderRingController.setAppForeground(true);
    }

    @Override
    public void onPause() {
        OrderRingController.setAppForeground(false);
        super.onPause();
    }
}
