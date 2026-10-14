---
'@curator/api': patch
---

The Docker image now runs as `PUID`:`PGID` (default 1000:1000) and hands `/data` to that user when it starts, so a bind-mounted data directory owned by someone else works: on Unraid set `PUID=99` and `PGID=100`. It also waits up to a minute for Postgres before migrating instead of exiting, keeps a database password exactly as set (one like `1.50` used to arrive as `1.5`), and stays healthy when `PORT` is left blank.
