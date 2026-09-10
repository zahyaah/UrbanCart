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
    // e2e/ is Playwright's; Vitest must not try to run those specs.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
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
