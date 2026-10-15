# @curator/api

## 0.1.1

### Patch Changes

- 2dcb215: The Docker image now runs as `PUID`:`PGID` (default 1000:1000) and hands `/data` to that user when it starts, so a bind-mounted data directory owned by someone else works: on Unraid set `PUID=99` and `PGID=100`. It also waits up to a minute for Postgres before migrating instead of exiting, keeps a database password exactly as set (one like `1.50` used to arrive as `1.5`), and stays healthy when `PORT` is left blank.
- 4af59f5: An Unraid template, `unraid/curator.xml`, installs the image on host networking with your Postgres and an appdata folder.
- @curator/frame@0.1.1

## 0.1.0

### Minor Changes

- The first release, published as the Docker image `maroonedsoftware/curator`: one container serving the web app and the API under `/api`, applying its migrations on every start. Bring a Postgres; see "Running in Docker" in the README.

### Patch Changes

- @curator/frame@0.1.0
