/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const manualChunks: Record<string, string[]> = {
  'leaflet': ['leaflet', 'react-leaflet'],
  'geo-data': ['./src/data/us-states-10m.json'],
}

function getManualChunk(id: string): string | undefined {
  for (const [chunkName, modules] of Object.entries(manualChunks)) {
    if (modules.some(mod => id.includes(mod))) return chunkName
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: getManualChunk,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
})
