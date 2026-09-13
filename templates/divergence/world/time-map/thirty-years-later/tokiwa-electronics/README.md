---
type: gate
name: December 31, 2024 · Thirty Years Later · Tokiwa Electronics
title: December 31, 2024 · Thirty Years Later · Tokiwa Electronics
bg: assets/scenes/future-original.webp
intent: Current state follows shop-record.md. Do not show adult Ryo or an open shop before interference. Show existing results in the same directory after changes. Do not regenerate on revisits.
choice:
  options:
    - id: action-1
      label: Read why the shop closed
    - id: action-2
      label: Return to the Time Map
choice_actions:
  action-1:
    kind: read
    paths:
      - world/time-map/thirty-years-later/tokiwa-electronics/shop-record.md
  action-2:
    kind: enter
    target: world/time-map
---

You, now older, stand at the shop’s former site. The neighboring house and road remain, but only the land of Tokiwa Electronics is empty. After losing the girl, the master closed the shop; without anyone to inherit it, the building was demolished later. This is still the unaltered future.
