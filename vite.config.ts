/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'child_process'

const commitHash = execSync('git rev-parse --short HEAD').toString().trim()

export default defineConfig({
  base: '/scorekeeper/',
  server: {
    allowedHosts: ['.ngrok-free.dev'],
  },
  define: {
    __BUILD_HASH__: JSON.stringify(commitHash),
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      manifest: {
        name: 'Scorekeeper',
        short_name: 'Scorekeeper',
        description: 'Little League Scorekeeping App',
        theme_color: '#1e3a5f',
        background_color: '#f8fafc',
        display: 'standalone',
        scope: '/scorekeeper/',
        start_url: '/scorekeeper/',
        icons: [
          {
            src: '/scorekeeper/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/scorekeeper/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '.worktrees/**'],
  }
})
