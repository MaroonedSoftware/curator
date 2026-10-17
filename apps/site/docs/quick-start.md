---
sidebar_label: Quick start
---

# Quick start

curator is one Docker image, [`maroonedsoftware/curator`](https://hub.docker.com/r/maroonedsoftware/curator),
holding the web app, the API behind it, and the database migrations it applies on every start. It
needs a Postgres 17 beside it, and a Samsung Frame on the same network.

## Start it

Save this as `compose.yaml`, change both passwords, and run `docker compose up -d`:

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

The web app is then at `http://<host>:14100`, with the API under `/api`. Uploaded originals and the
log live on the `/data` volume. If `DATABASE_NAME` does not exist yet, the first start creates it,
which needs a user allowed to create databases.

The server runs as `PUID`:`PGID` (default 1000:1000) and hands `/data` to that user when it starts,
so a bind-mounted host directory works when you set them to its owner.

## Add a TV

Open the TVs page and either search the network or type the TV's address, then accept the pairing
prompt on the TV with its remote. curator keeps the token the TV issues, so you pair once. Give the
TV a DHCP reservation in your router, because curator finds it again by address.

Every connection to a TV is outbound, so bridge networking works. Searching uses SSDP, which needs
multicast on the TVs' network: run the container with `network_mode: host` (and no `ports`) to use
it, or add each TV by address.

## On Unraid

The repository has an Unraid template, `unraid/curator.xml`, on host networking so the TVs page can
search. Until it is in Community Applications, add it from the Docker tab: Template Repositories, add
`https://github.com/MaroonedSoftware/curator`, save, then Add Container and pick curator. Fill in your
Postgres server and start it. The template runs the app as `nobody:users` (`PUID=99`, `PGID=100`),
Unraid's owner for appdata.

## Tags

`latest` follows `main`, `X.Y.Z` is a release and `X.Y` the newest release in that line, and every
published commit is also tagged with its full sha.

There is no sign-in: curator is meant for the home network the TV sits on. Don't publish its port to
the internet.
