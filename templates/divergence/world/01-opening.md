---
type: chalk
title: Regret · The First Page
choice:
  options:
    - id: action-1
      label: Holding a wind-up frog
    - id: action-2
      label: Reading the accident notice
    - id: read-letter
      label: Reading the undelivered letter
intent: If told to take, move world/clockwork-frog.md to player/clockwork-frog.md. Move the letter player/undelivered-letter.md only if requested. Only the frog enters the time map. The accident notice is only read. Do not preempt the rescue. Do not use the phone display in the background as new evidence or required action.
choice_actions:
  action-1:
    kind: take
    paths:
      - world/clockwork-frog.md
  action-2:
    kind: read
    paths:
      - world/accident-notice.md
  read-letter:
    kind: read
    paths:
      - world/undelivered-letter.md
---

Rain taps the window. Below the light lies a letter addressed only to you, and a just-repaired clockwork frog.

You are an apprentice repairer at Tokiwa Electronics. It's January 1, 1995, 8 PM. The “10 AM tomorrow” appointment you promised Ryo has already passed.

The frog jumps. Only the girl who was supposed to come has not returned.
