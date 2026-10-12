import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Tests live in a top-level tests/ folder mirroring src/, importing ../src/...
// Kept out of the build tsconfig so tsc only type-checks shippable src.
export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        setupFiles: ['./tests/setup.ts'],
        include: ['./tests/**/*.test.{ts,tsx}'],
        // Mantine's comboboxes are slow under jsdom, and a full workspace run contends for cores.
        testTimeout: 20_000,
    },
});
