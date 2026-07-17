import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    react(),
    // pdf.js needs its cmaps (for CID/embedded fonts, incl. Hebrew) and
    // standard_fonts (fallback for the 14 base fonts) available as static
    // files at runtime, or it silently substitutes fonts with wrong glyph
    // widths — which is what was corrupting text and shifting table
    // layouts. Copied straight from the installed package so it stays in
    // sync with whatever pdfjs-dist version is installed.
    viteStaticCopy({
      targets: [
        { src: 'node_modules/pdfjs-dist/cmaps/*', dest: 'cmaps' },
        { src: 'node_modules/pdfjs-dist/standard_fonts/*', dest: 'standard_fonts' },
      ],
    }),
  ],
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
