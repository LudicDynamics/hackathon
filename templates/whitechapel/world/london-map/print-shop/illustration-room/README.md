---
type: gate
name: Illustration room · Ask Wayne
title: Illustration room · Ask Wayne
bg: assets/backgrounds/press.webp
intent: Use visible-details.md and the circulation records as basis for questions. Do not convict based on attitude or injury alone. Do not mark unseen evidence as seen, and record the actual responses.
choice:
  options:
    - id: investigate-with-dice
      label: Find clues by rolling dice
    - id: action-1
      label: Ask Wayne about his wrist injury and the delivery of the illustration
    - id: action-2
      label: Confirm if Wayne read the corrected address
  allow_free: true
bgVideo: assets/motion/seedance/backgrounds/press.webm
choice_actions:
  action-1:
    kind: character
    character: wayne
  action-2:
    kind: character
    character: wayne
  investigate-with-dice:
    kind: read
    paths:
      - world/london-map/print-shop/illustration-room/04-investigation-dice.md
---

Wayne, who drew the illustration, has a fresh bandage on his right wrist. His sleeve has blue paint. On the desk is the manuscript with the changed address.

This may relate to the scene. Ask about the injury and the time the illustration was delivered. Injury alone does not establish guilt.
