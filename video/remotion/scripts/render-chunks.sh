#!/bin/sh
# Render the Launch composition in section-sized chunks, each in a fresh process (memory is released
# between chunks), then concatenate and mux one continuous audio track.
# Resumable: finished chunks are kept, so re-running only renders what is missing.
#
#   sh scripts/render-chunks.sh                  # 960x540 preview
#   SCALE=1 OUT=out/worldlines-launch.mp4 sh scripts/render-chunks.sh   # final 1080p
set -u
cd "$(dirname "$0")/.."

SCALE=${SCALE:-0.5}
OUT=${OUT:-out/worldlines-launch-preview.mp4}
DIR=out/chunks-$SCALE
FLAGS="--scale=$SCALE --concurrency=2 --offthreadvideo-cache-size-in-bytes=268435456 --log=error"
# Section boundaries (frames at 30fps); S4 is split in two to keep each chunk short.
CHUNKS="0-449 450-1169 1170-1889 1890-2609 2610-3359 3360-4109 4110-4499"

mkdir -p "$DIR"
for r in $CHUNKS; do
  f="$DIR/$r.mp4"
  if [ -s "$f" ]; then echo "skip   $r"; continue; fi
  echo "render $r  $(date +%T)"
  npx remotion render src/index.ts Launch "$DIR/tmp-$r.mp4" --frames="$r" --muted --codec=h264 --crf=22 $FLAGS || { echo "FAILED $r"; exit 1; }
  mv "$DIR/tmp-$r.mp4" "$f"
done

if [ ! -s "$DIR/audio.aac" ]; then
  echo "audio  $(date +%T)"
  npx remotion render src/index.ts Launch "$DIR/audio.aac" --codec=aac --log=error || { echo "FAILED audio"; exit 1; }
fi

: > "$DIR/list.txt"
for r in $CHUNKS; do echo "file '$PWD/$DIR/$r.mp4'" >> "$DIR/list.txt"; done
ffmpeg -loglevel error -y -f concat -safe 0 -i "$DIR/list.txt" -i "$DIR/audio.aac" -map 0:v -map 1:a -c:v copy -c:a copy -shortest "$OUT" || { echo "FAILED mux"; exit 1; }
echo "done   $OUT  $(date +%T)"
