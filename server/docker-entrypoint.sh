#!/bin/sh
# Baked into the image as CMD, not passed via a platform's command-string
# field (Render's dockerCommand didn't shell-parse a compound `&&` command
# the way a Dockerfile CMD reliably does) -- this way "migrate, then start"
# works the same regardless of what's hosting the container.
set -e
node dist/db/migrate.js
exec node dist/server.js
