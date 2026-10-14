#!/bin/sh
# Migrate, then serve. The server never starts on a schema older than its code: a failed
# migration stops the container here, with dbmate's error as the last thing in its log.
set -eu

node dist/migrate.js
exec node --enable-source-maps dist/index.js
