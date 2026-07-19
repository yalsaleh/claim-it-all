import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Live ingestion tests (MinIO / Redis / ClamAV / outbox).
 * Run only when LIVE_INGESTION_TESTS=true against real infrastructure.
 */
export default defineConfig({
  envDir: path.resolve(__dirname, 'scripts'),
  test: {
    environment: 'node',
    include: ['src/**/*.live.integration.test.ts'],
    setupFiles: ['./src/server/live/live-setup.ts'],
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 120_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
