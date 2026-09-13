---
type: chalk
title: Morgue · When did the incident happen?
choice:
  options:
    - id: investigate-with-dice
      label: Find clues by rolling dice
    - id: action-1
      label: Compare the discovery time to the illustration delivery time
  allow_free: true
intent: Compare time-record.md with the printing house receipt. The time alone doesn't prove a specific person committed the crime.
choice_actions:
  action-1:
    kind: read
    paths:
      - world/london-map/morgue/time-record.md
      - world/london-map/print-shop/receipt.md
  investigate-with-dice:
    kind: read
    paths:
      - world/london-map/morgue/04-investigation-dice.md
---

The third incident occurred around 6 a.m. this morning.

If the illustration was drawn before that, it can't be said it was made after witnessing the crime. Let's compare with the printing house records.
