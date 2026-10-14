# syntax=docker/dockerfile:1
# curator, as one container: the API, the web app it serves, and the migrations it runs on boot.
# Bring a Postgres; everything the API writes goes to the /data volume.
#
#   docker build -t curator .
#
# CI builds this for linux/amd64 and publishes it as maroonedsoftware/curator (see
# `.github/workflows/images.yml`).

# dbmate, copied out of its own image rather than installed from npm: in the workspace it is a dev
# dependency, which the production install below leaves out. GHCR, so it never counts against a
# Docker Hub pull limit. Keep the version in step with apps/api's devDependency.
FROM ghcr.io/amacneil/dbmate:2.36.0 AS dbmate

# ─────────────────────────────────────────────────────────────────────────────────────────────
# The manifests, and nothing else.
# ─────────────────────────────────────────────────────────────────────────────────────────────
# An install is a function of the lockfile and the manifests. This stage throws away everything
# else, so its output only moves when a dependency does, and the install downstream of it stays
# cached across ordinary commits. The member globs are pnpm-workspace.yaml's; a directory with no
# manifest (packages/library, say) is skipped.
FROM node:26-trixie-slim AS manifests
WORKDIR /src
COPY . .
RUN set -eux; \
    mkdir -p /manifests; \
    cp -p package.json pnpm-lock.yaml pnpm-workspace.yaml /manifests/; \
    for member in apps/* packages/*; do \
        [ -f "$member/package.json" ] || continue; \
        mkdir -p "/manifests/$member"; \
        cp -p "$member/package.json" "/manifests/$member/"; \
    done

# ─────────────────────────────────────────────────────────────────────────────────────────────
# The workspace: build the API and the web app, then cut the API down to what it runs on.
# ─────────────────────────────────────────────────────────────────────────────────────────────
# Trixie to match the runtime, because sharp's native binding is installed here and loaded there.
FROM node:26-trixie-slim AS workspace

# pnpm comes from npm rather than from corepack: Node 25 and later ship no corepack binary. It still
# reads the repo's `packageManager` pin, so the version is the lockfile's rather than this line's.
RUN npm install -g corepack@latest && corepack enable

WORKDIR /app

COPY --from=manifests /manifests/ ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile

# Only what the build reads. Every tsconfig extends a workspace package, and every build script is
# tsc, tsup or vite reading its own directory.
COPY turbo.json ./
COPY packages ./packages
COPY apps ./apps

RUN pnpm exec turbo run build --filter=@curator/api --filter=@curator/web

# The API as a standalone directory with its production dependencies alone, @curator/frame
# included as a copy of its build. `--legacy` because the workspace does not inject its packages,
# which is what pnpm's newer deploy requires.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store,sharing=locked \
    pnpm --filter @curator/api deploy --prod --legacy /deploy \
 && cp -a apps/web/dist /deploy/public

# ─────────────────────────────────────────────────────────────────────────────────────────────
# The image.
# ─────────────────────────────────────────────────────────────────────────────────────────────
FROM node:26-trixie-slim

COPY --from=dbmate /usr/local/bin/dbmate /usr/local/bin/dbmate

WORKDIR /app
# The tree is root's and read-only to the server; only /data is the server's to write.
COPY --from=workspace /deploy ./
COPY docker/curator.entrypoint.sh /usr/local/bin/curator-entrypoint
RUN mkdir -p /data && chown node:node /data

ENV NODE_ENV=production \
    PORT=14100

LABEL org.opencontainers.image.title="curator" \
    org.opencontainers.image.description="Curates the art on Samsung Frame TVs: albums, rotation and uploads, from a web app on your home network." \
    org.opencontainers.image.source="https://github.com/MaroonedSoftware/curator" \
    org.opencontainers.image.url="https://github.com/MaroonedSoftware/curator" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.vendor="Marooned Software"

# What this image was built from and which release it is. Empty by default: a build from a working
# tree is neither, and saying nothing is the honest answer. CI passes both (see images.yml). The
# LABEL is for `docker inspect`; the ENV is for the API, which reports both from /api/health.
#
# Declared here, as late as possible, because the sha changes every build and an argument busts the
# cache of every layer after it.
ARG REVISION=
ARG VERSION=
LABEL org.opencontainers.image.revision="${REVISION}" \
    org.opencontainers.image.version="${VERSION}"
ENV BUILD_REVISION=${REVISION} \
    BUILD_VERSION=${VERSION}

# No USER: the entrypoint starts as root only to hand /data to PUID:PGID (node's 1000:1000 unless
# set), then drops to them for the migrations and the server. Unraid sets 99:100, nobody:users.
EXPOSE 14100
VOLUME ["/data"]

# Liveness only: /health never touches the database or a TV.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

ENTRYPOINT ["curator-entrypoint"]
