#!/bin/sh
# Render the Launch composition in section-sized chunks, each in a fresh process (memory is released
# between chunks), then concatenate and mux one continuous audio track.
# Resumable: finished chunks are kept, so re-running only renders what is missing.
#
#   sh scripts/render-chunks.sh                  # 960x540 preview
#   SCALE=1 OUT=out/worldlines-launch.mp4 sh scripts/render-chunks.sh   # final 1080p
#   MUSIC=music/candidate-b.wav OUT=out/try-b.mp4 sh scripts/render-chunks.sh   # same picture, another song
#
# After changing a scene, delete the chunk(s) covering it (and audio-*.aac if sound changed) before re-running.
set -u
cd "$(dirname "$0")/.."

SCALE=${SCALE:-0.5}
OUT=${OUT:-out/worldlines-launch-preview.mp4}
MUSIC=${MUSIC:-music/track-a.wav}
DIR=out/chunks-$SCALE
# --gl=angle: the 3D dice (parts/Dice3D.tsx, three.js) need a real GL context.
FLAGS="--scale=$SCALE --concurrency=2 --offthreadvideo-cache-size-in-bytes=268435456 --gl=angle --log=error"
# Act boundaries (frames at 30fps, v6 = 156s); A4 is split after the second world to keep each chunk short.
CHUNKS="0-509 510-989 990-1589 1590-2339 2340-2879 2880-3719 3720-4259 4260-4679"

mkdir -p "$DIR"
for r in $CHUNKS; do
  f="$DIR/$r.mp4"
  if [ -s "$f" ]; then echo "skip   $r"; continue; fi
  echo "render $r  $(date +%T)"
  npx remotion render src/index.ts Launch "$DIR/tmp-$r.mp4" --frames="$r" --muted --codec=h264 --crf=22 $FLAGS || { echo "FAILED $r"; exit 1; }
  mv "$DIR/tmp-$r.mp4" "$f"
done

# One audio track per song (music + voices + foley), cached by song name.
AUDIO="$DIR/audio-$(basename "$MUSIC" .wav).aac"
if [ ! -s "$AUDIO" ]; then
  echo "audio  $MUSIC  $(date +%T)"
  npx remotion render src/index.ts Launch "$AUDIO" --codec=aac --gl=angle --concurrency=2 --props="{\"music\":\"$MUSIC\"}" --log=error || { echo "FAILED audio"; exit 1; }
fi

: > "$DIR/list.txt"
for r in $CHUNKS; do echo "file '$PWD/$DIR/$r.mp4'" >> "$DIR/list.txt"; done
ffmpeg -loglevel error -y -f concat -safe 0 -i "$DIR/list.txt" -i "$AUDIO" -map 0:v -map 1:a -c:v copy -c:a copy -shortest "$OUT" || { echo "FAILED mux"; exit 1; }
echo "done   $OUT  $(date +%T)"
