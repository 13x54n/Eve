#!/bin/sh
# Bind-mounted source plus a node_modules volume means image `npm ci` is
# overwritten by a stale volume after dependency changes. Reinstall when the
# lockfile is newer (or viem / tsx is missing) before starting the process.
set -e
cd /app
mkdir -p node_modules
LOCK_STAMP=node_modules/.eve-lock-stamp
exec 9>node_modules/.eve-npm.lock
flock 9
if [ ! -x node_modules/.bin/tsx ] \
  || [ ! -d node_modules/kafkajs ] \
  || [ ! -f "$LOCK_STAMP" ] \
  || [ package-lock.json -nt "$LOCK_STAMP" ]; then
  echo "eve: syncing node_modules from package-lock.json"
  npm ci
  cp package-lock.json "$LOCK_STAMP"
fi
exec "$@"
