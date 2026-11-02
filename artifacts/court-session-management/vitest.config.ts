import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@workspace/api-zod': path.resolve(__dirname, '../../lib/api-zod/src/index.ts'),
      '@workspace/api-client-react': path.resolve(__dirname, '../../lib/api-client-react/src/index.ts'),
    },
  },
});

