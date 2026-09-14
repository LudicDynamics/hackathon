---
type: readme
name: Ninety seconds until broadcast ends
title: Ninety seconds until broadcast ends
bg: assets/scenes/intro.webp
intent: If you take it, move the actual request slip to player/. If replying to Nanami, remember the words but do not finalize tonight’s appointment or confession yet.
choice:
  options:
    - id: action-1
      label: Pick up the paper and read it
    - id: action-2
      label: Reply to Nanami with “I can hear you.”
bgVideo: assets/motion/seedance/backgrounds/intro.webm
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
