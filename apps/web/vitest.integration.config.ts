import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Do not auto-load apps/web/.env — integration tests must receive DATABASE_URL
// explicitly (embedded runner / CI). Missing URL must fail closed, not silently
// pick up a local Compose URL.
export default defineConfig({
  envDir: path.resolve(__dirname, 'scripts'),
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    exclude: ['src/**/*.live.integration.test.ts'],
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
