---
type: chalk
title: Connect the meaning of the fastener
roll_dice:
  type: 2d10
  desc: Connect the meaning of the fastener
  expect: ">=11"
choice:
  options:
    - id: back
      label: Return to the map without rolling now
choice_actions:
  back:
    kind: enter
    target: world/harbor-chart
dice_outcomes:
  - min: 2
    max: 4
    text: The noise of investigation echoed, and I lost the chance to examine unnoticed. There is still a lead. This is a part of a rudder bearing the lord family's crest. It's a clue to trace the owner involved in steering, not part of the unmanned ship's cargo.
    options:
      - id: read-clue
        label: Read the clues
        action:
          kind: read
          paths:
            - world/harbor-chart/workshop/crest-clasp.md
      - id: back
        label: Return to the map
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/workshop/investigation-setback.md
        title: A setback and the next lead
        body: The noise of investigation echoed, and I lost the chance to examine unnoticed. There is still a lead. This is a part of a rudder bearing the lord family's crest. It's a clue to trace the owner involved in steering, not part of the unmanned ship's cargo.
  - min: 5
    max: 10
    text: It didn't connect immediately, but I grasped the direction to review the clues. This is a rudder part with the lord family's crest. It's a clue to trace the owner involved in steering, not part of the unmanned ship's cargo.
    options:
      - id: read-clue
        label: Read the clues
        action:
          kind: read
          paths:
            - world/harbor-chart/workshop/crest-clasp.md
      - id: back
        label: Return to the map
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/workshop/investigation-setback.md
        title: A setback and the next lead
        body: It didn't connect immediately, but I grasped the direction to review the clues. This is a rudder part with the lord family's crest. It's a clue to trace the owner involved in steering, not part of the unmanned ship's cargo.
  - min: 11
    max: 17
    text: The observation linked up. This is a rudder part bearing the lord family's crest. It's a clue to trace the owner involved in steering, not part of the unmanned ship's cargo.
    options:
      - id: read-clue
        label: Read the clues
        action:
          kind: read
          paths:
            - world/harbor-chart/workshop/crest-clasp.md
      - id: back
        label: Return to the map
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/workshop/investigation-success.md
        title: Investigation notes
        body: The observation linked up. This is a rudder part bearing the lord family's crest. It's a clue to trace the owner involved in steering, not part of the unmanned ship's cargo.
  - min: 18
    max: 20
    text: Not only the core point, but also the next steps to verify are clear. This is a rudder part with the lord family's crest. It's a clue to track the owner involved in steering, not part of the unmanned ship's cargo. If you present the original and ask, you can distinguish between assumptions and testimonies.
    options:
      - id: read-clue
        label: Read the clues
        action:
          kind: read
          paths:
            - world/harbor-chart/workshop/crest-clasp.md
      - id: back
        label: Return to the map
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/workshop/investigation-great-success.md
        title: Breakthrough notes
        body: Not only the core point, but also the next steps to verify are clear. This is a rudder part with the lord family's crest. It's a clue to track the owner involved in steering, not part of the unmanned ship's cargo. If you present the original and ask, you can distinguish between assumptions and testimonies.
---

If it gets difficult, you can have characters investigate by dice. If you want to think yourself, returning without rolling is fine.

2d10: Roll two ten-sided dice. Success on total 11 or higher. Represents oversights or serendipitous discoveries during investigation.
2–4 (6%): Investigation noise alerts someone. Lose chance to investigate secretly, but clues remain.
5–10 (39%): Not solved immediately. Know what to investigate next. No loss of items.
11–17 (49%): Success. Understand clue meaning and next steps.
18–20 (6%): Great success. Discoveries helpful for next investigation.

Failure does not lead to dead ends here. Cannot re-roll the same dice. After seeing results, choose next actions. Sending to writer needed only when making new places.
