import path from "node:path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Same shape as production's vercel.json rewrite: the SPA calls /api/*
// on its own origin and the prefix is stripped on the way to the backend,
// so auth cookies are first-party here too. Used when VITE_API_URL=/api
// (the e2e suite); a direct VITE_API_URL like http://localhost:3001 never
// touches it.
const apiProxy = {
  '/api': {
    target: process.env.API_PROXY_TARGET ?? 'http://localhost:3001',
    rewrite: (p) => p.replace(/^\/api/, ''),
  },
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    // e2e/ is Playwright's; server/ is its own separate project (its own
    // vitest.config.ts, own DB, run via `cd server && npm test`) -- the
    // root runner must not sweep either up.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', 'e2e-prod/**', 'server/**'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      // Vendored shadcn primitives and pure-presentation files aren't
      // where the risk lives; measure the logic we actually own.
      exclude: [
        'src/components/ui/**',
        'src/test/**',
        'src/main.jsx',
        '**/*.config.js',
      ],
    },
  },
})
