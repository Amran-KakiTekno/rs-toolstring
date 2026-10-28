import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// The demo runs entirely in the browser. The Vitest suite exercises the pure
// domain module only, so the default node environment is enough. The Vitest
// configuration lives inside this file because a separate vitest.config.ts is
// outside the writable scope of this milestone.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 4103,
    strictPort: true,
  },
  preview: {
    port: 4103,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    reporters: ['default'],
  },
})
