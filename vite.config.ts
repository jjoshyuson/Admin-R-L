import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/Admin-R-L/' : '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        admin: 'index.html',
        pos: 'pos.html',
      },
    },
  },
})
