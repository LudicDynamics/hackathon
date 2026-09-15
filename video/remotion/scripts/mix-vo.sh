#!/bin/sh
# Swap the narrator without another Remotion pass (Remotion audio passes can run the machine out of memory).
# Needs: the rendered video chunks (render-chunks.sh), a narration-free audio track rendered once with
#   npx remotion render src/index.ts Launch out/chunks-0.5/audio-base-novo.aac --codec=aac --props='{"vo":false}' …
# and the narration currently in src/lib/narration.json (video/music/make-narration.mjs).
#   sh scripts/mix-vo.sh andrew        → out/worldlines-launch-v15-andrew.mp4 + out/share-v15-andrew.mp4 (V=v16 to rename)
# The base track is ducked under each narration line with a gentle sidechain compressor (≈ the in-film music duck):
# the melody and its hits must stay audible under the narrator (user, v16); character voices are ducked harder in the base.
set -eu
cd "$(dirname "$0")/.."
TAG=${1:?usage: mix-vo.sh <tag>}
DIR=out/chunks-0.5
BASE=$DIR/audio-base-novo.aac
[ -s "$BASE" ] || { echo "missing $BASE"; exit 1; }
TOTAL=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$BASE")

# Narration track: every line at its subtitle start, on silence, full length.
JSON=src/lib/narration-$TAG.json
[ -s "$JSON" ] || JSON=src/lib/narration.json
node -e '
const n = require("./" + process.argv[3]); const { execFileSync } = require("child_process");
const total = process.argv[1], out = process.argv[2];
const args = ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-t", total, "-i", "anullsrc=r=48000:cl=stereo"];
n.forEach((x) => args.push("-i", "public/" + x.file));
let f = n.map((x, i) => `[${i + 1}]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(x.from * 1000)}:all=1[v${i}]`).join(";");
f += ";[0]" + n.map((_, i) => `[v${i}]`).join("") + `amix=inputs=${n.length + 1}:normalize=0:duration=first[out]`;
args.push("-filter_complex", f, "-map", "[out]", "-c:a", "pcm_s16le", out);
execFileSync("ffmpeg", args);
' "$TOTAL" "$DIR/vo-$TAG.wav" "$JSON"

# Duck the base under the narration, add the narration, mux onto the video chunks.
# The picture's exact length: the mix is padded to it and the mux is cut to it (never -shortest, which clipped the logo).
# (ffprobe reports N/A for a concat list, so add up the chunks.)
VLEN=$(awk -F"'" '/^file/{print $2}' "$DIR/list.txt" | while read -r f; do ffprobe -v error -show_entries format=duration -of csv=p=0 "$f"; done | awk '{s+=$1} END {printf "%.3f", s}')
ffmpeg -hide_banner -loglevel error -y -i "$BASE" -i "$DIR/vo-$TAG.wav" -filter_complex \
  "[0]aresample=48000,aformat=channel_layouts=stereo,apad=whole_dur=$VLEN[b];[1]apad=whole_dur=$VLEN,asplit=2[sc][vo];[b][sc]sidechaincompress=threshold=0.03:ratio=2.2:attack=20:release=300:makeup=1[ducked];[ducked][vo]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.89:level=false,apad=whole_dur=$VLEN[a]" \
  -map "[a]" -c:a aac -b:a 256k "$DIR/audio-$TAG.m4a"
V=${V:-v16}
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$DIR/list.txt" -i "$DIR/audio-$TAG.m4a" -map 0:v -map 1:a -c:v copy -c:a copy -t "$VLEN" "out/worldlines-launch-$V-$TAG.mp4"
ffmpeg -hide_banner -loglevel error -y -i "out/worldlines-launch-$V-$TAG.mp4" -c:v libx264 -crf 29 -preset slow -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart "out/share-$V-$TAG.mp4"
echo "done $TAG → out/share-$V-$TAG.mp4"
