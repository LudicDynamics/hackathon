---
type: gate
name: Harbor Map · Investigate the Ship
title: Harbor Map · Investigate the Ship
bg: assets/scenes/harbor-chart.webp
requires:
  items:
    - player/commission-letter.md
    - player/investigator-badge.md
blocked: Put both the commission letter and investigator badge into your bag.
intent: Here is the list of locations. The order to collect evidence is free. The return path is the harbor office. Do not allow bypassing missing items by story alone.
bgVideo: assets/motion/seedance/backgrounds/map.webm
choice:
  options:
    - id: investigate-with-dice
      label: Find clues by rolling dice
  allow_free: true
choice_actions:
  investigate-with-dice:
    kind: read
    paths:
      - world/harbor-chart/04-investigation-dice.md
---

Start at Berth 7 to examine damage to the ship. You can examine ship parts at the workshop and the time the lighthouse light went out at the lighthouse. The order is up to you.

If the mystery is difficult, choose "Find clues by rolling dice." The investigator will think for you. Use what you discover to proceed beyond the fog.
