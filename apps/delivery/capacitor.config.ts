import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'biz.eshopy.delivery',
  appName: 'E-Shopy Rider',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    Geolocation: {
      permissions: ['location', 'coarseLocation'],
    },
  },
};

export default config;
