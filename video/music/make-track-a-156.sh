#!/bin/sh
# Track A (the chosen song) at the current length, 232s (v17). File name kept from v6.
#  - Voice demo 33–59s (26s): six bars (12s) of the quiet pad spliced in (38–44s twice).
#  - Fogwharf 68s: its groove 52–60s plus fifteen bars (52–60, 56–60, 52–60, 56–60, 56–60, 58–60) before the crash at
#    62s, so the crash lands on Vera's 「二隻目だね」; after it one bar (64–66s) and eight more (64–66 twice, 52–60,
#    56–60) under the lantern dock, 「戻る？」 and the out-of-credits screen.
#  - Divergence 12s: two bars of its own groove (84–88s) repeated before the roll at 88s.
#  - GPT Live 18s (after infinite exploration): nine bars of the moonlit section again (98–116s), cut in just before its
#    riser, so the riser still leads into the second drop at 118s under "Next".
# Everything after each splice moves with it and still lands on its cut.
#   node video/music/make-track.mjs --style=a && sh video/music/make-track-a-156.sh
set -eu
cd "$(dirname "$0")/../remotion/public/music"
X="acrossfade=d=0.03:c1=tri:c2=tri"
# Each segment runs 0.03s past its end so the crossfade eats that tail, not the next bar: without it every splice
# pulled the rest of the song 0.03s early (≈0.6s by the formula — the user heard SANDBOX/AGENTS/AI ROLEPLAY miss the hits).
seg() { printf '[0]atrim=%s:%s,asetpts=PTS-STARTPTS[%s];' "$1" "$(awk "BEGIN { print $2 + 0.03 }")" "$3"; }
S="$(seg 0 44 a)$(seg 38 44 b)$(seg 38 44 b2)"
S="$S$(seg 44 60 c)$(seg 52 60 c2)$(seg 56 60 c3)$(seg 52 60 c4)$(seg 56 60 c5)$(seg 56 60 c6)$(seg 58 60 c7)"
S="$S$(seg 60 66 d)$(seg 64 66 d2)$(seg 64 66 d3)$(seg 64 66 d4)$(seg 52 60 d5)$(seg 56 60 d6)"
S="$S$(seg 66 88 e)$(seg 84 88 e2)$(seg 88 116 f1)$(seg 98 116 g)$(seg 116 150 f2)"
# Chain every segment in order with a short crossfade.
L="a b b2 c c2 c3 c4 c5 c6 c7 d d2 d3 d4 d5 d6 e e2 f1 g f2"
F="$S"; prev=a; i=0
for s in $(echo "$L" | cut -d' ' -f2-); do i=$((i + 1)); F="$F[$prev][$s]$X[x$i];"; prev="x$i"; done
# The last crossfade feeds apad directly (no output label).
F="${F%"[x$i];"},apad=whole_dur=232"
ffmpeg -loglevel error -y -i placeholder-120.wav -filter_complex "$F" -ar 44100 track-a.wav
echo "wrote track-a.wav ($(ffprobe -v error -show_entries format=duration -of csv=p=0 track-a.wav)s)"
