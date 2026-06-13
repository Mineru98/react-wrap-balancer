#!/usr/bin/env bash
#
# Regenerate .github/demo.gif from .github/demo/index.html.
#
# Pipeline: serve the repo root  ->  Playwright captures one seamless cosine
# "breathing" resize cycle frame-by-frame (record.mjs)  ->  ffmpeg assembles a
# looping GIF with a 2-pass palette for crisp text.
#
# Requirements: python3, Node + Playwright (`npm i playwright && npx playwright
# install chromium`), ffmpeg.
#
# Usage:  bash .github/demo/build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${PORT:-8773}"
FRAMES="${FRAMES:-48}"
OUT_DIR="${OUT_DIR:-/tmp/wb-frames}"
SCALE="${SCALE:-960}"
FPS="${FPS:-16}"

# 1. Serve the repo root so the demo can load ../../wrap-balancer.js
python3 -m http.server "$PORT" --directory "$ROOT" >/tmp/wb-demo-server.log 2>&1 &
SRV=$!
trap 'kill "$SRV" 2>/dev/null || true' EXIT
sleep 1

# 2. Capture deterministic frames with Playwright
rm -rf "$OUT_DIR"
BASE_URL="http://localhost:$PORT/.github/demo/index.html" \
  OUT_DIR="$OUT_DIR" FRAMES="$FRAMES" \
  node "$ROOT/.github/demo/record.mjs"

# 3. Assemble a looping GIF (2-pass palettegen for quality)
ffmpeg -y -framerate "$FPS" -i "$OUT_DIR/frame_%03d.png" \
  -vf "scale=$SCALE:-1:flags=lanczos,palettegen=max_colors=128:stats_mode=diff" \
  /tmp/wb-palette.png
ffmpeg -y -framerate "$FPS" -i "$OUT_DIR/frame_%03d.png" -i /tmp/wb-palette.png \
  -lavfi "scale=$SCALE:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" \
  -loop 0 "$ROOT/.github/demo.gif"

echo "wrote $ROOT/.github/demo.gif"
