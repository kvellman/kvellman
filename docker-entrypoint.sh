#!/bin/sh
# Apply pending DB migrations, then start the server. Idempotent: drizzle-kit only applies
# migrations not yet recorded in __drizzle_migrations, so it is safe on every (re)start.
set -e

echo "[entrypoint] applying database migrations..."
node_modules/.bin/drizzle-kit migrate

echo "[entrypoint] starting kvellman on ${HOST:-0.0.0.0}:${PORT:-3000}"
exec node .output/server/index.mjs
