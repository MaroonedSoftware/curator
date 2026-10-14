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
pnpm db:up          # Postgres for development and tests (docker compose)
pnpm migrate:up     # apply apps/api/data/migrations
pnpm build          # tsup + declarations for every package
pnpm typecheck
pnpm lint
pnpm test
pnpm format         # prettier --write .
pnpm --filter @curator/api dev   # the API on :14100, restarting on change
pnpm --filter @curator/web dev   # the web app on :14102, proxying /api to the API
```

Node 26+ (`.nvmrc`), pnpm 11, Docker for Postgres. `pnpm db:reset` empties the development database and re-migrates it.

## Running in Docker

One image, [`maroonedsoftware/curator`](https://hub.docker.com/r/maroonedsoftware/curator), holds the
API, the web app it serves, and the migrations it applies on every start. Bring a Postgres 17:

```yaml
services:
    curator:
        image: maroonedsoftware/curator:latest
        restart: unless-stopped
        ports:
            - '14100:14100'
        environment:
            DATABASE_HOST: db
            DATABASE_USER: postgres
            DATABASE_PASSWORD: change-me
            DATABASE_NAME: curator
        volumes:
            - curator-data:/data
        depends_on:
            db:
                condition: service_healthy
    db:
        image: postgres:17
        restart: unless-stopped
        environment:
            POSTGRES_USER: postgres
            POSTGRES_PASSWORD: change-me
            POSTGRES_DB: curator
        volumes:
            - curator-db:/var/lib/postgresql/data
        healthcheck:
            test: ['CMD', 'pg_isready', '-U', 'postgres', '-d', 'curator']
            interval: 5s
            retries: 10
volumes:
    curator-data:
    curator-db:
```

The web app is then on port 14100, with the API under `/api`. `DATABASE_PORT` (default 5432) and
`PORT` (default 14100) are also read. Uploaded originals and the log live on the `/data` volume.
The config is `apps/api/appconfig.production.yaml`.

Every connection to a TV is outbound, so bridge networking works, but SSDP discovery (the TVs page's
Search) needs multicast on the TVs' network: run with `network_mode: host` (and no `ports`) to use it,
or add each TV by address.

Every push to `main` publishes the image under its full commit sha, and `latest` moves onto it once
the tests pass (`.github/workflows/release.yml`). To build it locally: `docker build -t curator .`.

## Ports

Curator owns 14100-14199 locally; no other project under `~/projects` uses that block.

| Port  | What                                                  |
| ----- | ----------------------------------------------------- |
| 14100 | API (`apps/api`, `server.port`); the Docker image     |
| 14102 | Web dev server (`apps/web`, proxies `/api`)           |
| 14103 | Web `vite preview`                                    |
| 14132 | Postgres for development (`curator-db`)               |
| 14133 | Postgres for the API tests (`curator-db-test`, tmpfs) |
| 14180 | Fake TV (`pnpm fake:tv` in `packages/frame`)          |

The real TV listens on 8002 (and 8001 for REST) on its own address.
