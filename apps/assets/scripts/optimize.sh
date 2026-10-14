#!/usr/bin/env bash
# GLB optimization script using gltf-transform

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELS_DIR="$(dirname "$SCRIPT_DIR")/models"

if ! command -v gltf-transform &> /dev/null; then
    echo "⚠️  gltf-transform not found. Install with: npm install -g @gltf-transform/cli"
    echo "Skipping optimization."
    exit 0
fi

echo "🔧 Optimizing GLB files..."

for input in "$MODELS_DIR"/*.glb; do
    [ -f "$input" ] || continue
    filename=$(basename "$input")
    output="$MODELS_DIR/${filename%.glb}-optimized.glb"
    
    echo "  Optimizing $filename..."
    gltf-transform optimize "$input" "$output" \
        --compress draco \
        --texture-compress webp \
        --texture-size 1024 \
        2>/dev/null || {
            echo "  ⚠️  Optimization failed for $filename (may have no textures)"
            # Fallback: just copy original
            cp "$input" "$output"
        }
done

echo "✓ Optimization complete"
ls -lh "$MODELS_DIR"/*.glb
