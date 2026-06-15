import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./tests/globalSetup.ts'],
    hookTimeout: 120000,
    testTimeout: 120000,
    fileParallelism: false,
    pool: 'forks',
  },
});
