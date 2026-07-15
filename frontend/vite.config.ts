import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',   // Allow connections from mobile devices on the same network
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
      '/signed': 'http://localhost:3001',
    },
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
});
