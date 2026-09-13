---
type: chalk
title: Harbor Office · Begin Investigation
choice:
  options:
    - id: action-1
      label: Receive the Commission Letter and Badge
    - id: action-2
      label: Read the Commission Conditions
intent: If accepted, move the physical copies of world/commission-letter.md and world/investigator-badge.md by the same name to player/. Move only missing ones if any already held. Confirm actual possession and guide to the harbor map.
choice_actions:
  action-1:
    kind: take
    paths:
      - world/commission-letter.md
      - world/investigator-badge.md
  action-2:
    kind: read
    paths:
      - world/commission-letter.md
---

You are an investigator who has come to the harbor. An unmanned ship, a person's disappearance, and the lighthouse light going out that night. You have been asked to investigate if these three are connected.

First, choose "Receive the Commission Letter and Badge" to proceed to the harbor map. The badge is a permit to investigate the harbor.
