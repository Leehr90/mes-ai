import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const mesConfig = require('../mes.config.json')
const MES_SERVER = process.env.MES_SERVER_URL ?? 'http://localhost:8082'
// Program argument (1): tracking type — "lot" or "unit" (default "unit").
// Set via the WIP_TRACKING environment variable (run-client.ps1 -WIP).
const WIP_TRACKING =
  (process.env.WIP_TRACKING ?? 'unit').toLowerCase() === 'lot' ? 'lot' : 'unit'

export default defineConfig({
  define: {
    __MES_VERSION__: JSON.stringify(mesConfig.mesVersion),
    __MES_RELEASE_DATE__: JSON.stringify(mesConfig.releaseDate),
    __WIP_TRACKING__: JSON.stringify(WIP_TRACKING),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: {
        enabled: true,
      },
      includeAssets: ['vite.svg'],
      manifest: {
        name: 'MES AI WIP Client',
        short_name: 'MES WIP',
        description: 'WIP processing client for MES AI',
        theme_color: '#111827',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5177,
    proxy: {
      '/api': {
        target: MES_SERVER,
        changeOrigin: true,
        ws: true,
      },
    },
  },
})