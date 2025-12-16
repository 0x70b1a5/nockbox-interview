import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait(),
    tailwindcss(),
    react(),
  ],
  optimizeDeps: {
    exclude: ['@nockbox/iris-wasm'],
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
})
