import path from "node:path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', 'server/**'],
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
