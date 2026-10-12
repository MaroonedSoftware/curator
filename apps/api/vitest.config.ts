import { defineConfig } from 'vitest/config';

// Tests live in a top-level tests/ folder mirroring src/, importing ../src/...
export default defineConfig({
    test: {
        include: ['./tests/**/*.test.ts'],
        // Migrates a template database once; each test file clones its own from it (tests/test.db.ts).
        globalSetup: './tests/setup.global.ts',
    },
});
