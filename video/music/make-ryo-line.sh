#!/bin/sh
# Character lines taken from the user's own recordings, as standalone voice clips at the cast's level (-16 LUFS).
# The recordings have them at -19…-27 LUFS, so the video beats play muted and these clips play over them instead
# (Launch.tsx / A3Voice.tsx), each starting where its picture does (cuts.ts).
set -eu
cd "$(dirname "$0")/.."

clip() { # src from len out
  TMP=$(mktemp -t clip).wav
  ffmpeg -loglevel error -y -ss "$2" -t "$3" -i "$1" -vn -ac 1 -ar 44100 "$TMP"
  I=$(ffmpeg -i "$TMP" -af ebur128 -f null - 2>&1 | grep -E '^\s+I:' | tail -1 | awk '{print $2}')
  G=$(awk "BEGIN { printf \"%.2f\", -16 - ($I) }")
  ffmpeg -loglevel error -y -i "$TMP" -af "volume=${G}dB,alimiter=limit=0.84:level=false,afade=t=in:d=0.04,afade=t=out:st=$(awk "BEGIN { print $3 - 0.1 }"):d=0.1" \
    -ac 1 -ar 44100 -c:a pcm_s16le "$4"
  rm -f "$TMP"
  echo "wrote $4 (source $I LUFS, +$G dB)"
}

V=remotion/public/voice
# Ryo (Divergence, 8:21.3): 「鮭が跳ねるところ、また見たいな。」 → "I want to see the salmon leap again."
clip footage/divergence-run-raw.mp4 501.3 4.0 $V/ryo-1.wav

# Vera, from the user's Fogwharf run — every line whole (the user asked for no cut-off lines):
#  vera-trust 5:26.0  「あんたを無条件に信用してるわけじゃないよ。ただ、見落とした傷が誰かを傷つけるのは嫌だし、
#                      部品の持ち主を決めつける前に確かめたい。」
#  vera-ship  27:49.0 「二隻目だね。まだ船そのものを確認したわけじゃないよ。でも新しい道は本物だね。」
#  vera-back  32:23.8 「私なら、まだ戻らない。」
#  vera-back2 32:28.3 「木箱の擦れか、泥のない車輪跡——どちらか一つを確かめれば、二隻目の手がかりに近づけそうだよ。」
F=footage/fogwharf-run-raw.mp4
clip $F 326.0 10.83 $V/vera-trust.wav
#  vera-go    19:55.9 「行くよ、もちろん。」 (her answer to 「一緒に行く？」)
clip $F 1195.9 2.0 $V/vera-go.wav
clip $F 1669.0 6.83 $V/vera-ship.wav
clip $F 1943.8 2.2 $V/vera-back.wav
clip $F 1948.3 8.0 $V/vera-back2.wav

# Elias ("Ei"), from the user's two recordings of his world, for the end of A3 (cuts.ts `el-*`). Only his voice is
# in these recordings (the user's mic was not captured), so the clips are his lines alone:
#  elias-1: voiced reply, 13.27 run 0:50.2 — "But I'm not going back to my office until I hear it."
#  elias-2: GPT Live call, 15.59 run 3:42.0 — "Okay, let's take it slow and get it right. I'm checking what the ticket should cover."
clip footage/ei-run-raw.mp4 50.2 4.1 $V/elias-1.wav
clip footage/ei-live-run-raw.mp4 222.0 6.5 $V/elias-2.wav
