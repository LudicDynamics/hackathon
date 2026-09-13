---
type: gate
name: Old Lighthouse · Light Out
title: Old Lighthouse · Light Out
bg: assets/scenes/old-lighthouse.webp
intent: When borrowing oil, actually hand over one unit player/lamp-oil.md of kerosene. The log only proves the lights-out time. Do not fabricate a second unknown ship in Old Mo's memory.
choice:
  options:
    - id: investigate-with-dice
      label: Find clues by rolling dice
    - id: action-1
      label: Read the Lighthouse Log
    - id: action-2
      label: Borrow oil and discuss illumination methods
  allow_free: true
bgVideo: assets/motion/seedance/backgrounds/lighthouse.webm
choice_actions:
  action-1:
    kind: read
    paths:
      - world/harbor-chart/old-lighthouse/lighthouse-logbook.md
  action-2:
    kind: character
    character: old-mo
  investigate-with-dice:
    kind: read
    paths:
      - world/harbor-chart/old-lighthouse/04-investigation-dice.md
---

Old Mo, the lighthouse keeper, says he turned off the light for twelve minutes that night. Why that time?

Reading the log tells you when ships could pass. To investigate beyond the fog with the light, you can borrow oil from Old Mo.
