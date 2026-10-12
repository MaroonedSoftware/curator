# @curator/api

HTTP API over [`@curator/frame`](../../packages/frame/README.md), built on
[ServerKit Fastify](https://github.com/MaroonedSoftware/serverkit/tree/main/packages/fastify).

## Layout

```
src/
  index.ts               entry point: load config, start the server
  server/                config loading and validation, the plugin stack, buildServer/startServer
  modules/               ServerKit modules (DI registrations and lifecycle hooks), in setup order
    frame/               the TV: the SamsungFrameClient, and FrameService, which routes call
  routes/                Fastify route plugins, schemas declared with zod
tests/
  test.server.ts         builds the real server for app.inject(), with FakeFrameClient in place of the TV
  fake.frame.client.ts   an in-memory FrameClient
```

## Running

```
pnpm dev     # from apps/api: watch mode on :14100
pnpm build && pnpm start
```

Config is `appconfig.${NODE_ENV}.yaml` (default `development`), overlaid by a gitignored
`appconfig.local.yaml`. Any string value may be `${env:NAME}`. The whole tree is validated at boot
(`src/server/api.config.ts`), so a bad value fails with its key named.

Set the TV's address before the first run, in `appconfig.local.yaml`:

```yaml
tv:
    host: 192.168.1.50
```

or as `CURATOR_TV_HOST`. The first request that reaches the TV pops a pairing prompt on it; accept
it and the token is kept in `.data/tv-token.txt`. `tv.debug: true` logs every frame on the wire.

To run without a TV, start the fake one (`pnpm fake:tv` in `packages/frame`) and point the API at
it with `tv.host: 127.0.0.1` and `tv.port: 18002`.

There is no authentication: the API is meant for the home network the TV sits on.

## Routes

| Method | Path      | Answers                      |
| ------ | --------- | ---------------------------- |
| GET    | `/health` | `{ status: 'ok', uptimeMs }` |
