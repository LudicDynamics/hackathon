---
type: chalk
title: Deciphering the scrapes
roll_dice:
  type: 2d10
  desc: Deciphering the scrapes
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
    text: Investigation noise alerted someone; lost chance to investigate unnoticed. Clues remain. The scrapes are above high tide. Investigation can check not just water level but possibility another ship pushed sideways.
    options:
      - id: read-clue
        label: Read the clues
        action:
          kind: read
          paths:
            - world/harbor-chart/seventh-berth/waterline-trace.md
      - id: back
        label: Return to the map
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/seventh-berth/investigation-setback.md
        title: A setback and the next lead
        body: Investigation noise alerted someone; lost chance to investigate unnoticed. Clues remain. The scrapes are above high tide. Investigation can check not just water level but possibility another ship pushed sideways.
  - min: 5
    max: 10
    text: No immediate conclusion, but identified how to revisit clues. The scrapes are above high tide. Investigation can check not just water level but possibility another ship pushed sideways.
    options:
      - id: read-clue
        label: Read the clues
        action:
          kind: read
          paths:
            - world/harbor-chart/seventh-berth/waterline-trace.md
      - id: back
        label: Return to the map
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/seventh-berth/investigation-setback.md
        title: A setback and the next lead
        body: No immediate conclusion, but identified how to revisit clues. The scrapes are above high tide. Investigation can check not just water level but possibility another ship pushed sideways.
  - min: 11
    max: 17
    text: Observations connected. The scrapes are above high tide. Investigation can check not just water level but possibility another ship pushed sideways.
    options:
      - id: read-clue
        label: Read the clues
        action:
          kind: read
          paths:
            - world/harbor-chart/seventh-berth/waterline-trace.md
      - id: back
        label: Return to the map
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/seventh-berth/investigation-success.md
        title: Investigation notes
        body: Observations connected. The scrapes are above high tide. Investigation can check not just water level but possibility another ship pushed sideways.
  - min: 18
    max: 20
    text: Not only the core, but next steps to verify are visible. The scrapes are above high tide. Investigation can check not just water level but possibility another ship pushed sideways. Showing original documents and asking separates speculation from testimony.
    options:
      - id: read-clue
        label: Read the clues
        action:
          kind: read
          paths:
            - world/harbor-chart/seventh-berth/waterline-trace.md
      - id: back
        label: Return to the map
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/seventh-berth/investigation-great-success.md
        title: Breakthrough notes
        body: Not only the core, but next steps to verify are visible. The scrapes are above high tide. Investigation can check not just water level but possibility another ship pushed sideways. Showing original documents and asking separates speculation from testimony.
---

If it gets difficult, you can have characters investigate by dice. If you want to think yourself, returning without rolling is fine.

2d10: Roll two ten-sided dice. Success on total 11 or higher. Represents oversights or serendipitous discoveries during investigation.
2–4 (6%): Investigation noise alerts someone. Lose chance to investigate secretly, but clues remain.
5–10 (39%): Not solved immediately. Know what to investigate next. No loss of items.
11–17 (49%): Success. Understand clue meaning and next steps.
18–20 (6%): Great success. Discoveries helpful for next investigation.

Failure does not lead to dead ends here. Cannot re-roll the same dice. After seeing results, choose next actions. Sending to writer needed only when making new places.
