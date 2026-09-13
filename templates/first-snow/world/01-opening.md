---
type: chalk
title: Ninety seconds until broadcast ends
choice:
  options:
    - id: action-1
      label: Pick up the paper and read it
    - id: action-2
      label: Reply to Nanami with “I can hear you.”
intent: If you take it, move the actual request slip to player/. If replying to Nanami, remember the words but do not finalize tonight’s appointment or confession yet.
choice_actions:
  action-1:
    kind: take
    paths:
      - world/request-slip.md
  action-2:
    kind: writer
---

You are the student director. Nanami's voice changes from a broadcast tone to one speaking only to you.

"I haven’t chosen the last song yet… are you free tonight?"

On the desk are an invitation from Sumi Yukimura and a line Nanami almost erased.
