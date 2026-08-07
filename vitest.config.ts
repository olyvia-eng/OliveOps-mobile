import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
