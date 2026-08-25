import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: [],
    // Secret session dummy untuk test — sign() kini fail-hard tanpa env var
    env: {
      ADMIN_SESSION_SECRET: 'test-admin-secret',
      MEMBER_SESSION_SECRET: 'test-member-secret',
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
