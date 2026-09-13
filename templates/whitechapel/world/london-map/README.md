---
type: gate
name: London · Where to investigate next?
title: London · Where to investigate next?
bg: assets/backgrounds/map.webp
requires:
  items:
    - player/blue-brass-cap.md
blocked: Accept the case at 221B and take the illustration tube lid with you.
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
      - world/london-map/04-investigation-dice.md
---

The next incident is today at noon. First, compare the picture and the scene at the ‘third site.’ Then investigate who read the manuscript at the print shop. You can also talk to the author Edith in the parlor.

The order is free. If confused, select “Find clues by dice” and Holmes will deduce for you. Plan from what you learn to stop the next incident.
