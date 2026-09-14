#!/bin/sh
# Private feel-test with any song you supply (e.g. your own copy of a licensed or reference track).
# Lines the song's drop up with the canvas burst at 0:18 and renders the same picture with that music.
#
#   sh scripts/try-song.sh ~/Music/sunshine.m4a 42.5      # 42.5 = second in the song where its drop hits
#
# The copy lands in public/music/ (gitignored), so a reference track is never committed or published by this.
set -eu
cd "$(dirname "$0")/.."

SRC=${1:?usage: try-song.sh <audio file> <drop second in the song>}
DROP=${2:?usage: try-song.sh <audio file> <drop second in the song>}
NAME=try-$(basename "$SRC" | sed 's/\.[^.]*$//' | tr -c 'A-Za-z0-9\n' '-')
DST=public/music/$NAME.wav
TARGET=18.0   # the film's first drop (canvas burst)

# Shift so the song's drop lands on 0:18: trim the head if the drop is later, pad silence if earlier.
SHIFT=$(awk "BEGIN { print $DROP - $TARGET }")
if awk "BEGIN { exit !($SHIFT >= 0) }"; then
  FILTER="atrim=start=$SHIFT,asetpts=PTS-STARTPTS"
else
  FILTER="adelay=$(awk "BEGIN { printf \"%d\", -($SHIFT) * 1000 }"):all=1"
fi
# 150s, gentle fade-out at the end, headroom under the voices.
ffmpeg -loglevel error -y -i "$SRC" -af "$FILTER,apad,atrim=end=150,afade=t=out:st=146:d=4,volume=-6dB" -ac 2 -ar 44100 "$DST"
echo "prepared $DST (drop at ${DROP}s → 0:18)"

MUSIC=music/$NAME.wav OUT=out/worldlines-launch-$NAME.mp4 sh scripts/render-chunks.sh
