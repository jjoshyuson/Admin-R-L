import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.ooh.pos',
  appName: 'OOH POS',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
}

export default config
