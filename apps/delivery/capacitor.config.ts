import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'biz.eshopy.delivery',
  appName: 'E-Shopy Rider',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SystemBars: {
      style: 'LIGHT',
      insetsHandling: 'native',
    },
    Geolocation: {
      permissions: ['location', 'coarseLocation'],
    },
  },
};

export default config;
