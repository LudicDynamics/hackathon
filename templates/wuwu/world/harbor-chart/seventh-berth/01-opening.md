---
type: chalk
title: Berth 7 · Ship Damage
choice:
  options:
    - id: investigate-with-dice
      label: Find clues by rolling dice
    - id: action-1
      label: Read the description of the ship damage
    - id: action-2
      label: Ask Silver Kite about the box
  allow_free: true
intent: After examining water level traces, show the actual record to Silver Kite. Even after showing the empty box, Silver Kite will not conclude the entire unknown ship's details.
choice_actions:
  action-1:
    kind: read
    paths:
      - world/harbor-chart/seventh-berth/waterline-trace.md
  action-2:
    kind: character
    character: silver-kite
  investigate-with-dice:
    kind: read
    paths:
      - world/harbor-chart/seventh-berth/04-investigation-dice.md
---

The unmanned ship is watched by the knight Silver Kite. There are scrapes much higher than the water next to the ship.

What collided with the ship? Read the damage records or try investigating with dice. For the empty box, ask Silver Kite.
