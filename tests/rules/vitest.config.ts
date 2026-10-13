import { defineConfig } from 'vitest/config';

// Firestore security-rules tests run in Node against the emulator
// (`npm run test:rules` wraps this in `firebase emulators:exec`).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
