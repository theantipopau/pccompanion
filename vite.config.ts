import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const enableSourceMaps =
  process.env.VITE_ENABLE_SOURCEMAPS === '1' ||
  process.env.RADIUM_ENABLE_SOURCEMAPS === '1';

export default defineConfig({
  base: './',
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: false,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'es2022',
    minify: 'esbuild',
    sourcemap: enableSourceMaps,
    rollupOptions: {
      output: {
        manualChunks: {
          motion: ['framer-motion'],
          charts: ['recharts'],
          icons: ['lucide-react'],
        },
      },
    },
  },
});
