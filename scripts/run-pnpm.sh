#!/usr/bin/env bash
set -Eeuo pipefail

if command -v pnpm >/dev/null 2>&1; then
  exec pnpm "$@"
fi

if command -v npx >/dev/null 2>&1; then
  exec npx --yes pnpm@11.0.7 "$@"
fi

echo "pnpm is unavailable and npx fallback cannot be used." >&2
exit 1
