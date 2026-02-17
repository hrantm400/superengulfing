#!/bin/bash
# Deploy on server: reset, install deps, build, restart
set -e
cd /var/www/superengulfing
git fetch origin main
git reset --hard origin/main
npm install
npm run build
if [ ! -f build/server/index.js ]; then
  echo "ERROR: build/server/index.js not found. Build may have failed."
  exit 1
fi
pm2 restart all
echo "Deploy done."
