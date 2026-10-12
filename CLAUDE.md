# curator

pnpm + turbo workspace. Deployables live in `apps/` (`@curator/api` on ServerKit Fastify, `@curator/web` on Vite + React + Mantine); libraries in `packages/`; shared config in `packages/config-*` (`@repo/*`).

## Rules that apply everywhere

1. **Never add AI attribution** (`Co-Authored-By: Claude`, etc.) to commits or PR bodies.
2. **File names are dotted lowercase, no hyphens**: `samsung.frame.client.ts`, `token.store.ts`, `fake.tv.ts`. The role goes last before the extension. Directory names are kebab-case.
3. **`undefined` means "not set", never `null`.** Prefer `foo?: T` over `foo: T | null`. `null` only where a wire format demands it.
4. **Tests live in each package's top-level `tests/`**, mirroring `src/`, named `<srcfile>.test.ts`, importing `../src/...`. Fakes and helpers sit in `tests/` without a `.test` suffix. `tests/` is out of the build tsconfig and type-checked through `tsconfig.tests.json`.
5. **Formatting**: prettier with 4-space indent, single quotes, semicolons, width 150, `arrowParens: avoid`. Run `pnpm format`.
6. **Toolchain**: Node 26+, TypeScript 6 (pinned), ESM with `.js` import extensions and `node:` builtins. Packages build with `tsup` + `tsc --emitDeclarationOnly`; scripts run with `node --import @swc-node/register/esm-register`.
7. **Ports**: local services use curator's 14100-14199 block (see the README's Ports table), so they never collide with other projects. Pin every port with `strictPort`; never rely on a tool's default.
