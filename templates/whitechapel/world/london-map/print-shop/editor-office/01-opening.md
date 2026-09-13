---
type: chalk
title: Editor’s office · Who received the manuscript next?
choice:
  options:
    - id: investigate-with-dice
      label: Find clues by rolling dice
    - id: action-1
      label: Ask who the corrected manuscript was circulated to
    - id: action-2
      label: Read the record of who received the manuscript
  allow_free: true
intent: Based on correction-log.md, separate responsibility for manuscript distribution from involvement in the crime. Do not disclose the patient's whereabouts.
choice_actions:
  action-1:
    kind: character
    character: blackburn
  action-2:
    kind: read
    paths:
      - world/london-map/print-shop/editor-office/correction-log.md
  investigate-with-dice:
    kind: read
    paths:
      - world/london-map/print-shop/editor-office/04-investigation-dice.md
---

Editor Blackburn manages the manuscript. This morning, a corrected manuscript from Edith was received.

Who did they hand that manuscript to next? Read the desk records or ask Blackburn directly.
