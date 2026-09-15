#!/bin/sh
# Track A for the 1-minute cut (Launch60.tsx), 60s; every section of the cut starts on a hit:
#   0–7s   ← 17–24s   end of the riser into the first drop (the canvas key press lands on it at 1s)
#   7–25s  ← 49–67s   launcher riser, then the worlds groove: hits at 10s (the dice) and 20s (Vera's 「二隻目だね」)
#   25–31s ← 72–78s   crash at 25s (First Snow's title card)
#   31–35s ← 82–86s   crash at 31s (Divergence's title card)
#   35–45s ← 76–86s   GPT Live; crash at 41s (back into the world, before the ticket card)
#   45–51s ← 118–124s the second drop (the writer agent writes the code; next: friends)
#   51–55s ← 137–141s the formula hits (SANDBOX / AGENTS / AI ROLEPLAY) and the equals
#   55–60s ← 144–149s the final hit (logo) and the outro
# Each segment runs 0.03s past its end so the crossfades never shift a hit (see make-track-a-156.sh).
#   sh video/music/make-track-60.sh
set -eu
cd "$(dirname "$0")/../remotion/public/music"
X="acrossfade=d=0.03:c1=tri:c2=tri"
seg() { printf '[0]atrim=%s:%s,asetpts=PTS-STARTPTS[%s];' "$1" "$(awk "BEGIN { print $2 + 0.03 }")" "$3"; }
F="$(seg 17 24 a)$(seg 49 67 b)$(seg 72 78 c)$(seg 82 86 d)$(seg 76 86 e)$(seg 118 124 f)$(seg 137 141 g)$(seg 144 149 h)"
F="$F[a][b]$X[x1];[x1][c]$X[x2];[x2][d]$X[x3];[x3][e]$X[x4];[x4][f]$X[x5];[x5][g]$X[x6];[x6][h]$X"
F="$F,afade=t=in:d=0.2,afade=t=out:st=59.2:d=0.8,apad=whole_dur=60,atrim=0:60"
ffmpeg -loglevel error -y -i placeholder-120.wav -filter_complex "$F" -ar 44100 track-60.wav
echo "wrote track-60.wav ($(ffprobe -v error -show_entries format=duration -of csv=p=0 track-60.wav)s)"
