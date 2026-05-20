#!/usr/bin/env bash
# Render every Remotion tutorial composition as a GIF into docs/tutorials/.
# Renders MP4 to a temp dir first, then converts to GIF via ffmpeg palettegen.
set -euo pipefail

OUT=docs/tutorials
mkdir -p "$OUT"

TMP=$(mktemp -d)
trap "rm -rf $TMP" EXIT

# Width/fps for the GIF output. Tutorials render at 1600x900 internally.
W=900
GIF_FPS=10

EXTRA_FLAGS=()
if [[ -n "${REMOTION_BROWSER_EXECUTABLE:-}" ]]; then
  EXTRA_FLAGS+=(--browser-executable "$REMOTION_BROWSER_EXECUTABLE")
  EXTRA_FLAGS+=(--chrome-mode chrome-for-testing)
fi
if [[ "${REMOTION_IGNORE_CERT_ERRORS:-0}" == "1" ]]; then
  EXTRA_FLAGS+=(--ignore-certificate-errors --disable-web-security)
fi

TUTORIALS=(tut-budget tut-google tut-github tut-vault tut-skills tut-kb)

for id in "${TUTORIALS[@]}"; do
  echo "=== $id ==="
  mp4="$TMP/$id.mp4"
  gif="$OUT/${id#tut-}.gif"
  npx remotion render "$id" "$mp4" \
    --codec h264 --crf 22 --log=warn "${EXTRA_FLAGS[@]}"
  ffmpeg -y -i "$mp4" -vf "fps=$GIF_FPS,scale=$W:-1:flags=lanczos,palettegen=stats_mode=diff" \
    "$TMP/$id.palette.png" -hide_banner -loglevel error
  ffmpeg -y -i "$mp4" -i "$TMP/$id.palette.png" \
    -filter_complex "fps=$GIF_FPS,scale=$W:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
    "$gif" -hide_banner -loglevel error
  ls -lh "$gif" | awk '{print "  -> "$NF" ("$5")"}'
done
