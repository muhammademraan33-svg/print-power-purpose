import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // WooCommerce API (CORS bypass)
      '/wp-json': {
        target: 'https://printpowerpurpose.com',
        changeOrigin: true,
        secure: false,
      },
      // SinaLite Auth (CORS bypass for OAuth token)
      '/sinalite-auth': {
        target: 'https://api.sinaliteuppy.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sinalite-auth/, ''),
        secure: false,
      },
      // SinaLite API (CORS bypass for product options/pricing)
      '/sinalite-api': {
        target: 'https://api.sinaliteuppy.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sinalite-api/, ''),
        secure: false,
      },
      // Printify API (CORS bypass)
      '/printify-api': {
        target: 'https://api.printify.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/printify-api/, ''),
        secure: false,
      },
    },
  },
})
