#!/usr/bin/env bash
# Compile the Swift window recorder into a Tauri sidecar binary.
# Tauri's externalBin mechanism expects the file named with the Rust
# target triple suffix (e.g. windowrec-aarch64-apple-darwin).
set -euo pipefail

SRC_TAURI="$(cd "$(dirname "$0")/.." && pwd)"
TRIPLE="$(rustc -Vv | sed -n 's/^host: //p')"
OUT_DIR="$SRC_TAURI/binaries"
OUT="$OUT_DIR/windowrec-$TRIPLE"

mkdir -p "$OUT_DIR"
swiftc -O "$SRC_TAURI/recorder/windowrec.swift" -o "$OUT"
echo "built $OUT"
