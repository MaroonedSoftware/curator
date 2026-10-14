#!/bin/sh
# Started as root (the default), hand /data to PUID:PGID and run the rest as that user. Without
# them it is 1000:1000, the image's `node` user; on Unraid, whose appdata shares belong to
# nobody:users, set 99 and 100. Only what is not already theirs is changed, so a restart over a
# large library touches nothing. Started as anyone else (`--user`), it runs as is, and /data must
# already be writable by that user.
#
# Then migrate, then serve. The server never starts on a schema older than its code: a failed
# migration stops the container here, with dbmate's error as the last thing in its log.
set -eu

if [ "$(id -u)" = 0 ]; then
    uid="${PUID:-1000}"
    gid="${PGID:-1000}"
    find /data \( ! -user "$uid" -o ! -group "$gid" \) -exec chown -h "$uid:$gid" {} +
    exec setpriv --reuid="$uid" --regid="$gid" --clear-groups -- "$0" "$@"
fi

node dist/migrate.js
exec node --enable-source-maps dist/index.js
