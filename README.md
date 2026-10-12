# curator

Samsung Frame TV artwork management.

## Layout

pnpm + turbo workspace.

```
apps/
  api/                @curator/api: HTTP API over the Frame client, on ServerKit Fastify (see its README)
  web/                @curator/web: browser UI over the API, Vite + React + Mantine (see its README)
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
pnpm --filter @curator/api dev   # the API on :14100, restarting on change
pnpm --filter @curator/web dev   # the web app on :14102, proxying /api to the API
```

Node 26+ (`.nvmrc`), pnpm 11.
