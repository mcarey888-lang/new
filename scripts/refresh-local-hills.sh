#!/usr/bin/env bash
# Run from the repository root in an environment with osmium-tool and the
# existing App Storage service identity. No database migration or Overpass.
set -euo pipefail
cd "$(dirname "$0")/.."
work="$(mktemp -d -t summit-hills-refresh-XXXXXXXX)"
trap 'rm -rf "$work"' EXIT
python scripts/import-local-hills.py --workdir "$work/regions" --output "$work/uk-hills.json" --workers 4
pnpm --filter @workspace/api-server exec tsx scripts/publish-local-hills.ts "$work/uk-hills.json"
