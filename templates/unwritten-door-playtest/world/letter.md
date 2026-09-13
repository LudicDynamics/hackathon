---
type: letter
title: The sealed envelope
visual: envelope
portable: true
appearance:
  preset: parchment-letter
  motion: calm
choice:
  - Open the envelope
  - Examine the outside
status:
  data:
    opened: false
intent: Only opening reveals a short concrete message. Persist the full message, public Context and opened=true. Looking outside is not opening. On revisit keep the same text.
---

An envelope addressed in unfamiliar handwriting.

## Context
The letter has not been opened.
