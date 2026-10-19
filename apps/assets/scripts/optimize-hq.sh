#!/usr/bin/env bash
# HQ GLB optimization pipeline: dedup | instance (floors) | meshopt | KTX2 (ktx mode) | basis transcoder copy.
# Idempotent, rerunnable. Creates apps/web/public/models/{hq_shell,floor_1..4,char_base}.glb.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
STAGING_DIR="$ROOT_DIR/apps/assets/models/export"
OUT_DIR="$ROOT_DIR/apps/web/public/models"
BASIS_DIR="$ROOT_DIR/apps/web/public/basis"
EVIDENCE_DIR="$ROOT_DIR/.omo/evidence/mvp3-integration"
HELPER="$SCRIPT_DIR/optimize_hq_helpers.py"

# Ensure commands resolve from repo root.
cd "$ROOT_DIR"
export PATH="$ROOT_DIR/node_modules/.bin:$PATH"

GLTF_TRANSFORM="bunx gltf-transform"
FILES=(hq_shell floor_1 floor_2 floor_3 floor_4 char_base)
UASTC_SLOTS="{normalTexture,occlusionTexture,metallicRoughnessTexture}"
UASTC_SLOT_SET="normalTexture occlusionTexture metallicRoughnessTexture"

# ---- Argument parsing --------------------------------------------------------
MODE="${MODE:-auto}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="$2"; shift 2 ;;
    --mode=*) MODE="${1#*=}"; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# ---- KTX preflight -----------------------------------------------------------
ktx_install_attempt() {
  echo "Attempting KTX-Software install to ~/.local/ktx ..."
  local tmpdir release asset url
  mkdir -p "$HOME/.local/ktx"
  tmpdir="$(mktemp -d /tmp/ktx-install.XXXXXX)"
  release="$(curl -fsSL https://api.github.com/repos/KhronosGroup/KTX-Software/releases/latest | python3 -c 'import sys,json; print(json.load(sys.stdin).get("tag_name",""))')"
  if [[ -z "$release" ]]; then
    echo "  Could not determine latest KTX-Software release."
    return 1
  fi
  url="https://github.com/KhronosGroup/KTX-Software/releases/download/${release}/KTX-Software-${release#v}-Linux-x86_64.tar.bz2"
  echo "  Downloading $url"
  if curl -fsSL -o "$tmpdir/ktx.tar.bz2" "$url"; then
    tar -xjf "$tmpdir/ktx.tar.bz2" -C "$HOME/.local/ktx"
    rm -r "$tmpdir"
    return 0
  fi
  rm -r "$tmpdir"
  return 1
}

find_ktx_bin() {
  local ktx
  ktx="$(command -v ktx || true)"
  if [[ -n "$ktx" ]]; then
    dirname "$ktx"
    return 0
  fi
  local dir
  dir="$(ls -d "$HOME/.local/ktx"/KTX-Software-*/bin 2>/dev/null | head -1)"
  if [[ -n "$dir" ]]; then
    echo "$dir"
    return 0
  fi
  return 1
}

KTX_DIR=""
if ktx_bin="$(find_ktx_bin)"; then
  export PATH="$ktx_bin:$PATH"
  KTX_DIR="$(dirname "$ktx_bin")"
fi

if command -v ktx >/dev/null 2>&1; then
  KTX_PREFLIGHT="$(ktx --version 2>&1)"
  echo "PREFLIGHT PASS: $KTX_PREFLIGHT"
  [[ "$MODE" == "auto" ]] && MODE="ktx2"
else
  echo "PREFLIGHT FAIL: ktx not found"
  if [[ "$MODE" == "auto" ]]; then
    if ktx_install_attempt; then
      if ktx_bin="$(find_ktx_bin)"; then
        export PATH="$ktx_bin:$PATH"
        KTX_DIR="$(dirname "$ktx_bin")"
        KTX_PREFLIGHT="$(ktx --version 2>&1)"
        echo "PREFLIGHT RECOVERED: $KTX_PREFLIGHT"
        MODE="ktx2"
      else
        echo "PREFLIGHT RECOVERY FAIL: install succeeded but binary not found"
        MODE="meshopt"
      fi
    else
      echo "PREFLIGHT RECOVERY FAIL: could not install KTX-Software"
      MODE="meshopt"
    fi
  elif [[ "$MODE" == "ktx2" ]]; then
    echo "ERROR: --mode ktx2 requested but ktx binary unavailable"
    exit 1
  fi
fi

echo "MODE=$MODE"
echo "KTX_DIR=${KTX_DIR:-<system PATH>}"

# ---- Directories -------------------------------------------------------------
mkdir -p "$OUT_DIR" "$BASIS_DIR" "$EVIDENCE_DIR"
TMPDIR="$(mktemp -d /tmp/optimize-hq.XXXXXX)"
trap 'rm -r "$TMPDIR"' EXIT

HAPPY="$EVIDENCE_DIR/task-2-optimize-happy.txt"
FAILURE="$EVIDENCE_DIR/task-2-optimize-failure.txt"
: > "$HAPPY"
: > "$FAILURE"

# ---- Helpers -----------------------------------------------------------------
log() {
  echo "$1" | tee -a "$HAPPY"
}

run_cmd() {
  local desc="$1"; shift
  log ""
  log "[$desc] $*"
  "$@" 2>&1 | tee -a "$HAPPY"
  local rc=${PIPESTATUS[0]}
  if [[ $rc -ne 0 ]]; then
    echo "COMMAND FAILED: $* (exit $rc)" | tee -a "$HAPPY"
    exit "$rc"
  fi
}

file_size_mb() {
  python3 -c "import os; print(f'{os.path.getsize(\"$1\")/1024/1024:.2f}')"
}

max_texture_size() {
  python3 "$HELPER" max-texture --gltf-transform "$GLTF_TRANSFORM" "$1"
}

texture_count() {
  python3 "$HELPER" texture-count --gltf-transform "$GLTF_TRANSFORM" "$1"
}

# ---- Per-file optimization ---------------------------------------------------
optimize_file() {
  local name="$1"
  local input="$STAGING_DIR/${name}_src.glb"
  local output="$OUT_DIR/${name}.glb"
  local instance_flag="$2"

  log ""
  log "=== $name ==="
  log "input: $input ($(file_size_mb "$input") MB)"

  local tmp1="$TMPDIR/${name}_1.glb"
  local tmp2="$TMPDIR/${name}_2.glb"
  local tmp3="$TMPDIR/${name}_3.glb"
  local tmp4="$TMPDIR/${name}_4.glb"

  # 1. dedup
  run_cmd "$name:dedup" $GLTF_TRANSFORM dedup "$input" "$tmp1"

  # 2. instance (floors only, --min 9)
  if [[ "$instance_flag" == "1" ]]; then
    run_cmd "$name:instance" $GLTF_TRANSFORM instance "$tmp1" "$tmp2" --min 9
  else
    cp "$tmp1" "$tmp2"
    log "[$name:instance] skipped (not a floor)"
  fi

  # 3. meshopt
  run_cmd "$name:meshopt" $GLTF_TRANSFORM meshopt "$tmp2" "$tmp3"

  # Texture cap decision
  local max_tex resize_arg
  max_tex="$(max_texture_size "$tmp3")"
  log "[$name:texture-inspect] max texture size = ${max_tex}px"
  if [[ "$max_tex" -gt 2048 ]]; then
    resize_arg="--resize 2048"
  else
    resize_arg=""
  fi

  # 4+5. uastc + etc1s (ktx2 mode) or keep PNG (meshopt mode)
  local tex_count tmp5
  tmp5="$TMPDIR/${name}_5.glb"
  tex_count="$(texture_count "$tmp3")"
  if [[ "$MODE" == "ktx2" ]]; then
    if [[ "$tex_count" -eq 0 ]]; then
      log "[$name:uastc+etc1s] SKIP: no textures (EXIT 0)"
      cp "$tmp3" "$tmp5"
    else
      run_cmd "$name:uastc" $GLTF_TRANSFORM uastc "$tmp3" "$tmp4" \
        --slots "$UASTC_SLOTS" --level 2 --rdo $resize_arg
      run_cmd "$name:etc1s" $GLTF_TRANSFORM etc1s "$tmp4" "$tmp5" \
        --quality 255 $resize_arg
    fi
  else
    log "[$name:texture-compression] SKIP: meshopt-only mode (PNG textures preserved)"
    cp "$tmp3" "$tmp5"
  fi

  run_cmd "$name:meshopt-final" $GLTF_TRANSFORM meshopt "$tmp5" "$output"

  log "output: $output ($(file_size_mb "$output") MB)"
}

# ---- Run pipeline ------------------------------------------------------------
log "HQ GLB optimization pipeline"
log "Started: $(date -Iseconds)"
log "Repository: $ROOT_DIR"
log "Preflight: ${KTX_PREFLIGHT:-KTX not installed}"
log "Mode: $MODE"

for name in "${FILES[@]}"; do
  case "$name" in
    floor_1|floor_2|floor_3|floor_4) optimize_file "$name" 1 ;;
    *) optimize_file "$name" 0 ;;
  esac
done

# ---- Basis transcoder copy ---------------------------------------------------
log ""
log "=== basis transcoder copy ==="
resolve_three_basis() {
  local basis_dir=""
  if command -v node >/dev/null 2>&1; then
    basis_dir="$(node -e "const p=require('path'); try { const d=p.dirname(require.resolve('three')); console.log(p.join(d,'../examples/jsm/libs/basis')); } catch(e) {}" 2>/dev/null || true)"
  fi
  if [[ -z "$basis_dir" ]] || [[ ! -f "$basis_dir/basis_transcoder.wasm" ]]; then
    basis_dir="$(ls -d "$ROOT_DIR"/node_modules/.bun/three@0.186.1*/node_modules/three/examples/jsm/libs/basis 2>/dev/null | head -1)"
  fi
  echo "$basis_dir"
}
BASIS_SRC="$(resolve_three_basis)"
if [[ -z "$BASIS_SRC" ]] || [[ ! -f "$BASIS_SRC/basis_transcoder.wasm" ]]; then
  echo "ERROR: could not locate three basis transcoder files" | tee -a "$HAPPY"
  exit 1
fi
cp "$BASIS_SRC/basis_transcoder.js" "$BASIS_SRC/basis_transcoder.wasm" "$BASIS_DIR/"
log "Copied basis_transcoder.{js,wasm} from $BASIS_SRC"

# ---- Verification ------------------------------------------------------------
log ""
log "=== verification ==="
VERIFY_JSON="$TMPDIR/verify.json"
python3 "$HELPER" verify \
  --gltf-transform "$GLTF_TRANSFORM" \
  --staging-dir "$STAGING_DIR" \
  --out-dir "$OUT_DIR" \
  --mode "$MODE" \
  "${FILES[@]}" > "$VERIFY_JSON"

python3 - <<PY | tee -a "$HAPPY"
import json
from pathlib import Path
with open("$VERIFY_JSON") as f:
    data = json.load(f)
rows = data["rows"]
print(f"{'File':<12} {'Status':<6} {'BaseTris':>10} {'Tris':>10} {'Δ%':>7} {'Inst':>5} {'MaxTex':>7} {'Extensions'}")
print("-" * 100)
for r in rows:
    print(f"{r['file']:<12} {r['status']:<6} {r['baseline_tris']:>10} {r['tris']:>10} {r['tri_delta_pct']:>7.2f} {r['instances']:>5} {r['max_texture']:>7} {', '.join(r['extensions'])}")
print("-" * 100)
print("ALL PASS" if data["all_pass"] else "VERIFY FAILED")
print("Expected prefixes (staging):", data["expected_prefix"])
PY

if ! python3 -c "import json; d=json.load(open('$VERIFY_JSON')); exit(0 if d['all_pass'] else 1)"; then
  log "VERIFICATION FAILED"
  exit 1
fi

# ---- Before/after size table -------------------------------------------------
log ""
log "=== before/after size (MB) ==="
python3 - <<PY | tee -a "$HAPPY"
import os
names = "${FILES[*]}".split()
print(f"{'File':<12} {'Before':>10} {'After':>10} {'Ratio':>8}")
print("-" * 50)
for name in names:
    before = os.path.getsize(f"$STAGING_DIR/{name}_src.glb") / 1024 / 1024
    after = os.path.getsize(f"$OUT_DIR/{name}.glb") / 1024 / 1024
    ratio = after / before if before else 0
    print(f"{name:<12} {before:>10.2f} {after:>10.2f} {ratio:>8.2%}")
PY

log ""
log "Finished: $(date -Iseconds)"

# ---- Failure-path probe (textureless GLB) ------------------------------------
{
  echo "Failure-path probe: textureless GLB"
  echo "Started: $(date -Iseconds)"
  echo ""
  PROBE_IN="$ROOT_DIR/apps/web/public/models/building.glb"
  if [[ ! -f "$PROBE_IN" ]]; then
    echo "Probe input not found: $PROBE_IN"
    exit 0
  fi
  PROBE_TMP="$TMPDIR/probe"
  mkdir -p "$PROBE_TMP"
  cp "$PROBE_IN" "$PROBE_TMP/in.glb"
  echo "[probe:dedup] $GLTF_TRANSFORM dedup $PROBE_TMP/in.glb $PROBE_TMP/1.glb"
  $GLTF_TRANSFORM dedup "$PROBE_TMP/in.glb" "$PROBE_TMP/1.glb" 2>&1
  echo "[probe:meshopt] $GLTF_TRANSFORM meshopt $PROBE_TMP/1.glb $PROBE_TMP/2.glb"
  $GLTF_TRANSFORM meshopt "$PROBE_TMP/1.glb" "$PROBE_TMP/2.glb" 2>&1
  if [[ "$(texture_count "$PROBE_TMP/2.glb")" -eq 0 ]]; then
    echo "[probe:uastc+etc1s] SKIP: no textures (EXIT 0)"
  else
    echo "[probe:uastc+etc1s] would run (unexpected textures found)"
  fi
  cp "$PROBE_TMP/2.glb" "$PROBE_TMP/out.glb"
  echo ""
  echo "Probe output: $PROBE_TMP/out.glb ($(file_size_mb "$PROBE_TMP/out.glb") MB)"
  echo "Finished: $(date -Iseconds)"
} > "$FAILURE"

exit 0
