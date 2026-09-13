---
type: gate
name: Workshop · Detached Ship Part
title: Workshop · Detached Ship Part
bg: assets/scenes/workshop.webp
choice:
  options:
    - id: investigate-with-dice
      label: Find clues by rolling dice
    - id: action-1
      label: Examine the ship's part
    - id: action-2
      label: Ask Vera about the owner
  allow_free: true
bgVideo: assets/motion/seedance/backgrounds/workshop.webm
choice_actions:
  action-1:
    kind: read
    paths:
      - world/harbor-chart/workshop/crest-clasp.md
  action-2:
    kind: character
    character: vera
  investigate-with-dice:
    kind: read
    paths:
      - world/harbor-chart/workshop/04-investigation-dice.md
---

The engineer Vera is holding a part detached from a ship's rudder. The part bears the crest of the lord's family.

This part is a clue to which ship it is related. First, read the description of the part, then ask Vera about its owner.
