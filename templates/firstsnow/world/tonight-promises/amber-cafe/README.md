---
type: gate
name: Kohaku Cafe · Sumi Yukimura
title: Kohaku Cafe · Sumi Yukimura
bg: assets/scenes/amber-cafe.webp
intent: Reply to the words exchanged on site, and update promises and memories with the world skill “record conversation.” Treat questions as questions and promises as promises; neither automatically finalizes the ending. Visits to Nanami or existing promises remain.
choice:
  options:
    - id: action-1
      label: Tell Sumi you’ll spend tonight together
    - id: action-2
      label: Ask what Sumi wanted to talk about
bgVideo: assets/motion/seedance/backgrounds/cafe.webm
choice_actions:
  action-1:
    kind: writer
  action-2:
    kind: character
    character: sumi-yukimura
---

Sumi put her work phone face down. “Is it okay if I’m not the singer here?” The chair across is still unpulled.
