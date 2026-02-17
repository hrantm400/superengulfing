#!/usr/bin/env bash
# Update disposable email domain blocklist (monthly via cron).
#
# Source repo: https://github.com/disposable-email-domains/disposable-email-domains
# Raw file:
#   https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf
#
# Suggested cron (run on the server as the same user that owns the repo files):
#   0 3 1 * * /var/www/superengulfing/server/scripts/update_disposable_email_domains.sh
#
# This script atomically replaces:
#   server/data/disposable_email_blocklist.conf

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$ROOT_DIR/data"
OUT_FILE="$DATA_DIR/disposable_email_blocklist.conf"
TMP_FILE="$DATA_DIR/.disposable_email_blocklist.conf.tmp"

URL="https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf"

mkdir -p "$DATA_DIR"

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$URL" -o "$TMP_FILE"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$TMP_FILE" "$URL"
else
  echo "ERROR: curl or wget is required" >&2
  exit 1
fi

# Basic sanity: file should not be tiny
LINES="$(wc -l < "$TMP_FILE" | tr -d ' ')"
if [[ "$LINES" -lt 100 ]]; then
  echo "ERROR: downloaded blocklist looks too small ($LINES lines). Not updating." >&2
  rm -f "$TMP_FILE"
  exit 1
fi

mv -f "$TMP_FILE" "$OUT_FILE"
echo "Updated: $OUT_FILE ($LINES lines)"

