import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Use VITE_APP_BASE=./ when building for Capacitor (APK) so assets load from app://localhost
  base: process.env.VITE_APP_BASE || '/',
  plugins: [react()],
  server: {
    proxy: {
      // Run `npx vercel dev` (default :3000) so POST /api/ai-rab works locally with GEMINI_API_KEY.
      '/api': {
        target: process.env.VITE_DEV_API_PROXY || 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
})

