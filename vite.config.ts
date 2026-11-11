import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // neucli/core's primitives import React from the sibling repo; use ours.
    dedupe: ['react', 'react-dom'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          if (/node_modules\/(zod|yaml)\//.test(id)) return 'format';
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // `neucli` is linked from ../neucli; let the dev server read its sources and examples.
    fs: { allow: [path.resolve(__dirname), path.resolve(__dirname, '../neucli')] },
  },
});
