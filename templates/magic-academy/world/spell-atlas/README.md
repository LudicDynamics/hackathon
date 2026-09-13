---
type: gate
name: Magic Materials · What Will You Make?
title: Magic Materials · What Will You Make?
intent: Ask freely for verbs, target items, desired results, and acceptable
  costs. Confirm item existence and possession and record the combo proposal.
  Choosing alone does not auto-cast.
choice:
  options:
    - id: action-1
      label: Propose a combination
    - id: action-2
      label: Check usable materials
choice_actions:
  action-1:
    kind: writer
  action-2:
    kind: read
    paths:
      - world/spell-atlas/star-fragment.md
      - world/spell-atlas/small-hand-mirror.md
      - world/spell-atlas/reflection-fragment.md
bg: assets/scenes/academy-library.webp
---

You can use star fragments, a hand mirror, and the magic words "Open" and "Reflect." Let's read the descriptions of the materials first.

For example, a short suggestion like "I want to reflect the starry sky on the hand mirror" is fine. I'll ask what it can do and what it needs in exchange. You'll only use magic after you agree. Asking doesn't make you lose anything important.
