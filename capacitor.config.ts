import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.ooh.pos',
  appName: 'OOH POS',
  webDir: 'dist',
  server: {
    // The installed Android app is a native Bluetooth-printing shell. Loading
    // the production POS here lets UI and print-layout releases update without
    // requiring staff to reinstall the APK.
    url: 'https://admin-r-l.vercel.app',
    allowNavigation: ['admin-r-l.vercel.app'],
  },
  android: {
    allowMixedContent: false,
  },
}

export default config
