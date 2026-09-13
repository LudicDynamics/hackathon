---
type: chalk
title: Print shop · Ask Tom
choice:
  options:
    - id: investigate-with-dice
      label: Find clues by rolling dice
    - id: action-1
      label: Ask Tom about the order of manuscript and illustration
    - id: action-2
      label: Read the receipt and the duty log
  allow_free: true
intent: Show receipt.md and shift-ledger.md. Tom only knows about his logging of receipt and his shifts. The editor and artist are at editor-office and illustration-room respectively. If no conversation happened yet, don't assume testimony obtained.
choice_actions:
  action-1:
    kind: character
    character: tom
  action-2:
    kind: read
    paths:
      - world/london-map/print-shop/receipt.md
      - world/london-map/print-shop/shift-ledger.md
  investigate-with-dice:
    kind: read
    paths:
      - world/london-map/print-shop/04-investigation-dice.md
---

Pressman Tom will show the work records. Here, we can check “who read the manuscript” and “when the illustration arrived.”

First, read the records or ask Tom. In the back, editor Blackburn is in the office; Wayne is in the illustration room.
