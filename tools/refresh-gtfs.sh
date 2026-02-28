#!/usr/bin/env bash
# Refresh MARTA GTFS static data
# Downloads latest GTFS zip, extracts, rebuilds SQLite, restarts service.
# Run weekly (MARTA publishes schedule updates periodically).
#
# Usage: ./tools/refresh-gtfs.sh
#   Or via cron: 0 4 * * 0  ./tools/refresh-gtfs.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
GTFS_DIR="$PROJECT_DIR/data/gtfs"
GTFS_URL="https://itsmarta.com/google_transit_feed/google_transit.zip"
GTFS_ZIP="$PROJECT_DIR/data/gtfs.zip"

cd "$PROJECT_DIR"

echo "📥 Downloading MARTA GTFS feed..."
curl -fSL -o "$GTFS_ZIP" "$GTFS_URL"

echo "📦 Extracting..."
mkdir -p "$GTFS_DIR"
python3 -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "$GTFS_ZIP" "$GTFS_DIR"
rm "$GTFS_ZIP"

echo "🗄️  Rebuilding SQLite database..."
bun run src/data/gtfs-import.ts

echo "🚇 Building transfer stop lookup..."
bun run tools/build-transfer-lookup.ts

echo "🔄 Restarting Pullcord..."
systemctl --user restart pullcord

echo "✅ GTFS refresh complete — $(date)"
