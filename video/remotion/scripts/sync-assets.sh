#!/bin/sh
# Copy launch-video media from the world templates into public/ (gitignored).
# Run from video/remotion:  npm run sync
set -u
R=../..
T=$R/templates
P=public
mkdir -p $P/cast $P/bg $P/scenes $P/portraits $P/sfx $P/music $P/footage

C=motion/seedance/characters
cp $T/wuwu/assets/$C/viola-transparent.webm              $P/cast/vera.webm
cp $T/first-snow/assets/$C/sumi-transparent.webm         $P/cast/sumi.webm
cp $T/first-snow/assets/$C/nanami-transparent.webm       $P/cast/nanami.webm
cp $T/whitechapel/assets/$C/watson-transparent.webm      $P/cast/watson.webm
cp $T/magic-academy/assets/$C/seraphina-transparent.webm $P/cast/seraphina.webm
cp $T/divergence/assets/$C/ryo-transparent.webm          $P/cast/ryo.webm

for w in wuwu whitechapel first-snow divergence; do
  mkdir -p $P/bg/$w
  cp $T/$w/assets/motion/seedance/backgrounds/*.webm $P/bg/$w/
  cp $T/$w/assets/characters/*.webp $P/portraits/
done
cp $T/magic-academy/assets/$C/seraphina-transparent.webp $P/portraits/seraphina.webp

for w in wuwu whitechapel first-snow divergence magic-academy; do
  for d in scenes backgrounds; do
    [ -d $T/$w/assets/$d ] || continue
    for f in $T/$w/assets/$d/*; do
      [ -f "$f" ] && cp "$f" "$P/scenes/$w-$(basename "$f")"
    done
  done
done

cp $R/assets/audio/foley/*.mp3 $R/assets/audio/foley/canvas/*.mp3 $P/sfx/

# Footage captured into video/footage/claude/ is mirrored here too.
[ -d $R/video/footage/claude ] && cp -R $R/video/footage/claude/. $P/footage/
echo "synced into $P"
