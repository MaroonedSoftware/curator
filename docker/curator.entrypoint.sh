#!/bin/sh
# Migrate, then serve. The server never starts on a schema older than its code: a failed
# migration stops the container here, with dbmate's error as the last thing in its log.
set -eu

# Started as root (the default), first make /data the server's, then run the rest as PUID:PGID.
# A bind-mounted host folder that Docker or Unraid created is root's, and the server could write
# nothing into it. Only a /data that isn't already theirs is chowned, so a big library of
# originals is not walked on every start. Started as some other user (`--user`), /data is left
# as it is and the rest runs as that user.
if [ "$(id -u)" = 0 ]; then
    uid="${PUID:-1000}"
    gid="${PGID:-1000}"
    if [ "$(stat -c %u:%g /data)" != "$uid:$gid" ]; then
        chown -R "$uid:$gid" /data
    fi
    exec setpriv --reuid="$uid" --regid="$gid" --clear-groups "$0" "$@"
fi

node dist/migrate.js
exec node --enable-source-maps dist/index.js
