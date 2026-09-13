---
type: gate
name: 221B Parlor · Author’s talk
title: 221B Parlor · Author’s talk
bg: assets/backgrounds/intro.webp
intent: Separate Edith’s suspicions from confirmed facts using address-correction.md as source. The protected has their own will. Do not create fake consent to send the person as bait.
choice:
  options:
    - id: investigate-with-dice
      label: Find clues by rolling dice
    - id: action-1
      label: Ask why she changed the address
    - id: action-2
      label: Ask to whom she gave the corrected manuscript
  allow_free: true
bgVideo: assets/motion/seedance/backgrounds/intro.webm
choice_actions:
  action-1:
    kind: character
    character: edith
  action-2:
    kind: character
    character: edith
  investigate-with-dice:
    kind: read
    paths:
      - world/london-map/edith-room/04-investigation-dice.md
---

Novelist Edith is guarded here by Watson. “I wrote the novels, but I never meant to hurt anyone.”

She changed the novel’s address this morning. Ask why and to whom she gave it.
