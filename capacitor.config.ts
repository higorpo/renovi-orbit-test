import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'br.com.renovi.orbit',
  appName: 'Orbit',
  webDir: 'dist',
  android: {
    useLegacyBridge: true,
  },
  // Remove this when production is ready
  server: {
    url: 'http://192.168.0.67:5854',
    cleartext: true,
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      style: 'LIGHT',
      hidden: false,
      animation: 'NONE',
    },
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 0,
      backgroundColor: '#000000',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      // Capacitor auto-banners run before JS can suppress the active chat (R12-AC07).
      // Foreground alerts use Local Notifications when not suppressed (other screens / non-chat).
      presentationOptions: ['badge', 'sound'],
    },
    LocalNotifications: {
      smallIcon: 'ic_notification',
      iconColor: '#2563EB',
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
}

export default config
