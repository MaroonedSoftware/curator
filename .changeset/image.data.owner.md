---
'@curator/api': patch
---

The image waits up to two minutes for Postgres before migrating, and makes `/data` its own at start, running as `PUID:PGID` (default 1000:1000), so a bind-mounted folder Docker or Unraid created works without a manual `chown`.
