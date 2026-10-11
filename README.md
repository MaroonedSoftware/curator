# curator

Samsung Frame TV artwork management.

## Layout

pnpm + turbo workspace.

```
packages/
  frame/              @curator/frame: client for the Frame's local art-mode protocol (see its README)
  config-eslint/      @repo/config-eslint: shared ESLint flat config
  config-typescript/  @repo/config-typescript: shared tsconfig base
```

## Commands

```
pnpm install
pnpm build          # tsup + declarations for every package
pnpm typecheck
pnpm lint
pnpm test
pnpm format         # prettier --write .
```

Node 26+ (`.nvmrc`), pnpm 11.
