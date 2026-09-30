import { defineConfig } from 'vite';
import playgamaBridge from '@playgama/bridge/vite';

export default defineConfig({
  plugins: [playgamaBridge()],
  base: './',
  build: {
    assetsDir: 'assets',
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
