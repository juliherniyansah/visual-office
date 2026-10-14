#!/usr/bin/env bash
# Asset build script - generates GLB models from procedural geometry

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASSETS_DIR="$(dirname "$SCRIPT_DIR")"

echo "🏗️  Building assets..."

cd "$ASSETS_DIR"
bun run scripts/generate-assets.ts

echo "✓ Asset build complete"
ls -lh models/*.glb 2>/dev/null || echo "No GLB files found"
