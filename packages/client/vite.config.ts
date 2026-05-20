import { defineConfig } from 'vite';
import path from 'node:path';

/** GitHub Pages: VITE_BASE_PATH=/webgame/ — local/Docker: không set (/) */
const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base,
  root: '.',
  publicDir: 'public',
  resolve: {
    alias: {
      '@bto/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        game: path.resolve(__dirname, 'game.html'),
      },
    },
  },
  server: {
    port: 8080,
    /** 0.0.0.0: truy cập qua 127.0.0.1 / Simple Browser / tunnel dễ hơn */
    host: true,
    strictPort: true,
    open: '/',
    /** Một origin :8080 — API/Socket.io qua cùng cổng (chạy kèm `npm run dev:server`) */
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '') || '/',
      },
      '/socket.io': {
        target: 'http://127.0.0.1:3001',
        ws: true,
        changeOrigin: true,
      },
    },
    fs: {
      // Cho phép import JSON/TS từ workspace `packages/shared` (ngoài root client)
      allow: [path.resolve(__dirname, '..'), path.resolve(__dirname, '../shared')],
    },
  },
});
