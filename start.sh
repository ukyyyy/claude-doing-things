#!/usr/bin/env bash
set -euo pipefail

# Always run from the directory this script lives in.
cd "$(dirname "${BASH_SOURCE[0]}")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js wurde nicht gefunden. Bitte installiere Node.js (https://nodejs.org/) und versuche es erneut." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installiere Abhängigkeiten (einmalig)..."
  npm install
fi

PORT="${PORT:-5173}"
URL="http://localhost:${PORT}/"

open_browser() {
  sleep 1.5
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then
    open "$URL" >/dev/null 2>&1 &
  elif command -v start >/dev/null 2>&1; then
    start "$URL" >/dev/null 2>&1 &
  fi
}

open_browser &

echo "Starte HOLLOW STATION auf ${URL} ..."
npm run dev -- --port "$PORT"
