import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.spec.ts', '**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@modules': resolve(__dirname, './src/modules'),
      '@common': resolve(__dirname, './src/common'),
      '@config': resolve(__dirname, './src/config'),
      '@database': resolve(__dirname, './src/database'),
      '@redis': resolve(__dirname, './src/redis'),
    },
  },
});
