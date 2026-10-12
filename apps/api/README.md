# @curator/api

HTTP API over [`@curator/frame`](../../packages/frame/README.md), built on
[ServerKit Fastify](https://github.com/MaroonedSoftware/serverkit/tree/main/packages/fastify).

## Layout

```
src/
  index.ts               entry point: load config, start the server
  server/                config loading and validation, the plugin stack, buildServer/startServer
  modules/               ServerKit modules (DI registrations and lifecycle hooks), in setup order
  routes/                Fastify route plugins, schemas declared with zod
tests/
  test.server.ts         builds the real server for app.inject(), without listening
```

## Running

```
pnpm dev     # from apps/api: watch mode on :14100
pnpm build && pnpm start
```

Config is `appconfig.${NODE_ENV}.yaml` (default `development`), overlaid by a gitignored
`appconfig.local.yaml`. Any string value may be `${env:NAME}`. The whole tree is validated at boot
(`src/server/api.config.ts`), so a bad value fails with its key named.

There is no authentication: the API is meant for the home network the TV sits on.

## Routes

| Method | Path      | Answers                      |
| ------ | --------- | ---------------------------- |
| GET    | `/health` | `{ status: 'ok', uptimeMs }` |
