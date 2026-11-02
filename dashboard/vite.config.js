
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/node1': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/node1/, ''),
      },
      '/node2': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/node2/, ''),
      },
      '/node3': {
        target: 'http://127.0.0.1:5003',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/node3/, ''),
      },
    },
  },
})