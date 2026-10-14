## What this changes, and why

<!-- The why is the part worth writing. Link the issue if there is one. -->

## Checklist

- [ ] `pnpm lint:check`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass locally
- [ ] Tests are in the package's top-level `tests/`, mirroring `src/`
- [ ] A new migration has its Kysely types regenerated (`pnpm --filter @curator/api build:datatypes`) and committed beside it
- [ ] I read the `CLAUDE.md` covering what I changed
