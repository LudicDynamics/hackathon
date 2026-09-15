#!/bin/sh
# Track A (the chosen song) at the current length, 224s (v16). File name kept from v6.
#  - Voice demo 33–73s (40s): thirteen bars (26s) of the quiet pad spliced in (38–44s twice, 40–42s, 38–44s twice).
#  - Fogwharf 64s: its groove 52–60s plus six bars (52–60s again, 56–60s) and seven more (52–60, 56–60, 58–60) before
#    the crash at 62s, so the crash lands on Vera's 「二隻目だね」; after it one bar (64–66s) and eight more
#    (64–66 twice, 52–60, 56–60) under the lantern dock, 「戻る？」 and the out-of-credits screen.
#  - Divergence 12s: two bars of its own groove (84–88s) repeated before the roll at 88s.
# Everything after each splice moves with it and still lands on its cut.
#   node video/music/make-track.mjs --style=a && sh video/music/make-track-a-156.sh
set -eu
cd "$(dirname "$0")/../remotion/public/music"
X="acrossfade=d=0.03:c1=tri:c2=tri"
seg() { printf '[0]atrim=%s:%s,asetpts=PTS-STARTPTS[%s];' "$1" "$2" "$3"; }
S="$(seg 0 44 a)$(seg 38 44 b)$(seg 38 44 b2)$(seg 40 42 b3)$(seg 38 44 b4)$(seg 38 44 b5)"
S="$S$(seg 44 60 c)$(seg 52 60 c2)$(seg 56 60 c3)$(seg 52 60 c4)$(seg 56 60 c5)$(seg 58 60 c6)"
S="$S$(seg 60 66 d)$(seg 64 66 d2)$(seg 64 66 d3)$(seg 64 66 d4)$(seg 52 60 d5)$(seg 56 60 d6)"
S="$S$(seg 66 88 e)$(seg 84 88 e2)$(seg 88 150 f)"
# Chain every segment in order with a short crossfade.
L="a b b2 b3 b4 b5 c c2 c3 c4 c5 c6 d d2 d3 d4 d5 d6 e e2 f"
F="$S"; prev=a; i=0
for s in $(echo "$L" | cut -d' ' -f2-); do i=$((i + 1)); F="$F[$prev][$s]$X[x$i];"; prev="x$i"; done
# The last crossfade feeds apad directly (no output label).
F="${F%"[x$i];"},apad=whole_dur=224"
ffmpeg -loglevel error -y -i placeholder-120.wav -filter_complex "$F" -ar 44100 track-a.wav
echo "wrote track-a.wav ($(ffprobe -v error -show_entries format=duration -of csv=p=0 track-a.wav)s)"
