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
The config is `apps/api/appconfig.production.yaml`. The migrations wait up to a minute for Postgres to
accept connections, so the container can start before the database.

Every connection to a TV is outbound, so bridge networking works, but SSDP discovery (the TVs page's
Search) needs multicast on the TVs' network: run with `network_mode: host` (and no `ports`) to use it,
or add each TV by address.

Tags: `latest` follows `main`, `X.Y.Z` is a release and `X.Y` the newest release in that line, and
every published commit is also its full sha. To build it locally: `docker build -t curator .`.

## Releasing

Releases come from [changesets](https://github.com/changesets/changesets), and all of it runs in
`.github/workflows/release.yml`:

1. A pull request a user would notice carries a changeset (`pnpm changeset`; see `.changeset/README.md`).
2. Every push to `main` publishes the image under its commit sha and moves `latest` onto it once the
   tests pass. If changesets are pending, it also opens (or rebuilds) a **Version packages** pull
   request that bumps the version and writes `apps/api/CHANGELOG.md`.
3. Merging that pull request is the release: its push finds a version with no `v*` tag, publishes the
   image as `X.Y.Z` and `X.Y`, then tags `vX.Y.Z` and creates the GitHub release from the changelog.

A failed release cuts no tag, so the next push to `main` retries it. Publishing needs the
`DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` Actions secrets, and the version pull request needs
Settings, Actions, General, "Allow GitHub Actions to create and approve pull requests".

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
