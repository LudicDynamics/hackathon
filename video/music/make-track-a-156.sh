#!/bin/sh
# Track A (the chosen song) at the v6 length: the voice demo grew 33–47s → 33–53s, so three bars (6s) of its
# quiet pad are spliced in at a bar boundary (38–44s repeated); everything after moves +6s and still lands on its cut.
#   node video/music/make-track.mjs --style=a && sh video/music/make-track-a-156.sh
set -eu
cd "$(dirname "$0")/../remotion/public/music"
ffmpeg -loglevel error -y -i placeholder-120.wav -filter_complex \
  "[0]atrim=0:44,asetpts=PTS-STARTPTS[a];[0]atrim=38:44,asetpts=PTS-STARTPTS[b];[0]atrim=44:150,asetpts=PTS-STARTPTS[c];[a][b]acrossfade=d=0.03:c1=tri:c2=tri[ab];[ab][c]acrossfade=d=0.03:c1=tri:c2=tri,apad=whole_dur=156" \
  -ar 44100 track-a.wav
echo "wrote track-a.wav ($(ffprobe -v error -show_entries format=duration -of csv=p=0 track-a.wav)s)"
