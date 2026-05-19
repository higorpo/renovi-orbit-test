import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.renovi.orbit',
  appName: 'Orbit',
  webDir: 'dist',
  // Remove this when production is ready
  server: {
    url: 'http://192.168.0.248:5854',
    cleartext: true,
  }
};

export default config;
