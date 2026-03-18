import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/power-fortune/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  server: {
    port: 3000,
    open: true,
  },
});
