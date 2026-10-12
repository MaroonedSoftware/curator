//  @ts-check

import base from '@repo/config-eslint/base.js';

/** @type {import("eslint").Linter.Config[]} */
export default [
    ...base,
    {
        // kysely-codegen output, regenerated wholesale by `pnpm build:datatypes`.
        ignores: ['src/modules/data/kysely.ts', 'dist/**'],
    },
];
