#!/usr/bin/env python3
"""Helpers for optimize-hq.sh: GLB JSON parsing and gltf-transform inspect."""

import csv
import io
import json
import os
import re
import struct
import subprocess
import sys
from pathlib import Path


def glb_json(path: str) -> dict:
    with open(path, "rb") as fh:
        magic, _version, _length = struct.unpack("<III", fh.read(12))
        if magic != 0x46546C67:
            raise SystemExit(f"{path}: not a GLB")
        chunk_len, chunk_type = struct.unpack("<II", fh.read(8))
        if chunk_type != 0x4E4F534A:
            raise SystemExit(f"{path}: first chunk is not JSON")
        return json.loads(fh.read(chunk_len))


def run_inspect(gltf_transform: str, path: str) -> str:
    """Run `gltf-transform inspect --format=csv` and return stdout text."""
    cmd = gltf_transform.split() + ["inspect", "--format=csv", path]
    env = os.environ.copy()
    env["FORCE_COLOR"] = "0"
    result = subprocess.run(cmd, capture_output=True, text=True, env=env)
    if result.returncode != 0:
        raise SystemExit(f"inspect failed for {path}: {result.stderr}")
    return result.stdout


def parse_csv_section(text: str, section_name: str):
    """Return list of dicts for a CSV section like TEXTURES or MESHES."""
    lines = text.splitlines()
    in_section = False
    header = None
    rows = []
    # inspect CSV has section header lines then a separator line of dashes
    for line in lines:
        stripped = line.strip()
        if stripped.upper().startswith(section_name):
            in_section = True
            header = None
            continue
        if in_section and re.fullmatch(r"[─\-]+", stripped.replace(" ", "")):
            continue
        if in_section and header is None and stripped:
            header = [h.strip() for h in stripped.split(",")]
            continue
        if in_section and header and stripped:
            values = list(csv.reader(io.StringIO(stripped)))[0]
            if len(values) == len(header):
                rows.append(dict(zip(header, values)))
        if in_section and not stripped and header:
            break
    return rows


def max_texture_size(gltf_transform: str, path: str) -> int:
    text = run_inspect(gltf_transform, path)
    rows = parse_csv_section(text, "TEXTURES")
    if not rows:
        return 0
    max_dim = 0
    for r in rows:
        res = r.get("resolution", "")
        if "x" in res:
            w, h = res.split("x", 1)
            max_dim = max(max_dim, int(w), int(h))
    return max_dim


def texture_count(gltf_transform: str, path: str) -> int:
    text = run_inspect(gltf_transform, path)
    rows = parse_csv_section(text, "TEXTURES")
    return len(rows)


def has_texture_slots(gltf_transform: str, path: str, slots: set[str]) -> bool:
    text = run_inspect(gltf_transform, path)
    rows = parse_csv_section(text, "TEXTURES")
    if not rows:
        return False
    for r in rows:
        if r.get("slots", "") in slots:
            return True
    return False


def scene_tri_count(path: str) -> int:
    g = glb_json(path)
    nodes = g.get("nodes", [])
    meshes = g.get("meshes", [])
    accessors = g.get("accessors", [])

    def prim_tris(pr):
        if pr.get("mode", 4) != 4:
            return 0
        if "indices" in pr:
            return accessors[pr["indices"]]["count"] // 3
        return accessors[list(pr["attributes"].values())[0]]["count"] // 3

    mesh_tris = [sum(prim_tris(pr) for pr in m.get("primitives", [])) for m in meshes]
    total = 0
    for n in nodes:
        mi = n.get("mesh")
        if mi is None:
            continue
        inst_ext = n.get("extensions", {}).get("EXT_mesh_gpu_instancing")
        if inst_ext:
            attrs = inst_ext.get("attributes", {})
            count = accessors[attrs["TRANSLATION"]]["count"] if "TRANSLATION" in attrs else 1
            total += mesh_tris[mi] * count
        else:
            total += mesh_tris[mi]
    return total


def node_prefix_counts(path: str) -> dict[str, int]:
    g = glb_json(path)
    names = [n.get("name", "") for n in g.get("nodes", [])]
    return {p: sum(1 for n in names if n.startswith(p)) for p in ("NAV_", "TASK_", "ROOM_", "COL_")}


def instance_count(path: str) -> int:
    g = glb_json(path)
    nodes = g.get("nodes", [])
    accessors = g.get("accessors", [])
    total = 0
    for n in nodes:
        ext = n.get("extensions", {}).get("EXT_mesh_gpu_instancing")
        if ext:
            attrs = ext.get("attributes", {})
            if attrs:
                idx = next(iter(attrs.values()))
                total += accessors[idx].get("count", 0)
    return total


def extensions_used(path: str) -> list[str]:
    return glb_json(path).get("extensionsUsed", [])


def verify(gltf_transform: str, staging_dir: str, out_dir: str, files: list[str], mode: str) -> dict:
    """Return verification rows and pass/fail status."""
    expected_prefix = {name: node_prefix_counts(os.path.join(staging_dir, f"{name}_src.glb")) for name in files}
    baseline_tris = {name: scene_tri_count(os.path.join(staging_dir, f"{name}_src.glb")) for name in files}

    rows = []
    all_pass = True
    for name in files:
        out_path = os.path.join(out_dir, f"{name}.glb")
        if not os.path.exists(out_path):
            rows.append({"file": name, "status": "MISSING"})
            all_pass = False
            continue

        ext = extensions_used(out_path)
        tris = scene_tri_count(out_path)
        base_tris = baseline_tris[name]
        tri_delta_pct = (tris - base_tris) / base_tris * 100 if base_tris else 0
        prefixes = node_prefix_counts(out_path)
        inst_count = instance_count(out_path)
        max_tex = max_texture_size(gltf_transform, out_path)

        checks = {}
        if mode == "ktx2":
            checks["KHR_texture_basisu"] = "KHR_texture_basisu" in ext
            checks["EXT_meshopt_compression"] = "EXT_meshopt_compression" in ext
        else:
            checks["KHR_texture_basisu"] = True  # not expected in meshopt-only mode
            checks["EXT_meshopt_compression"] = "EXT_meshopt_compression" in ext

        if name in ("floor_1", "floor_2", "floor_3", "floor_4"):
            checks["instancing"] = "EXT_mesh_gpu_instancing" in ext and inst_count > 0
        else:
            checks["instancing"] = "EXT_mesh_gpu_instancing" not in ext and inst_count == 0

        checks["prefixes"] = prefixes == expected_prefix[name]

        if name == "char_base":
            checks["tris"] = 19304 <= tris <= 19694  # 19499 ±1%
        else:
            checks["tris"] = tris >= base_tris * 0.999

        checks["texture_size"] = max_tex <= 2048

        passed = all(checks.values())
        if not passed:
            all_pass = False

        rows.append({
            "file": name,
            "status": "PASS" if passed else "FAIL",
            "baseline_tris": base_tris,
            "tris": tris,
            "tri_delta_pct": tri_delta_pct,
            "prefixes": prefixes,
            "instances": inst_count,
            "max_texture": max_tex,
            "extensions": ext,
            "checks": checks,
        })
    return {"all_pass": all_pass, "rows": rows, "expected_prefix": expected_prefix, "baseline_tris": baseline_tris}


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_max = sub.add_parser("max-texture")
    p_max.add_argument("path")
    p_max.add_argument("--gltf-transform", default="gltf-transform")

    p_has = sub.add_parser("has-uastc-slots")
    p_has.add_argument("path")
    p_has.add_argument("--gltf-transform", default="gltf-transform")

    p_count = sub.add_parser("texture-count")
    p_count.add_argument("path")
    p_count.add_argument("--gltf-transform", default="gltf-transform")

    p_verify = sub.add_parser("verify")
    p_verify.add_argument("--gltf-transform", default="gltf-transform")
    p_verify.add_argument("--staging-dir", required=True)
    p_verify.add_argument("--out-dir", required=True)
    p_verify.add_argument("--mode", default="ktx2")
    p_verify.add_argument("files", nargs="+")

    args = parser.parse_args()
    if args.cmd == "max-texture":
        print(max_texture_size(args.gltf_transform, args.path))
    elif args.cmd == "has-uastc-slots":
        slots = {"normalTexture", "occlusionTexture", "metallicRoughnessTexture"}
        print("yes" if has_texture_slots(args.gltf_transform, args.path, slots) else "no")
    elif args.cmd == "texture-count":
        print(texture_count(args.gltf_transform, args.path))
    elif args.cmd == "verify":
        result = verify(args.gltf_transform, args.staging_dir, args.out_dir, args.files, args.mode)
        print(json.dumps(result, indent=2))
