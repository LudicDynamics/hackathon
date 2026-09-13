---
type: chalk
title: Comprehend the meaning of twelve minutes
roll_dice:
  type: 2d10
  desc: Comprehend the meaning of twelve minutes
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
    text: Sounds from the investigation alerted someone; lost chance to investigate unnoticed. Clues remain. The twelve-minute blackout coincided with tide and the old customs tunnel exit. It is proof of a passage opportunity, not that Old Mo knew of an unseen ship.
    options:
      - id: read-clue
        label: Read the clues
        action:
          kind: read
          paths:
            - world/harbor-chart/old-lighthouse/lighthouse-logbook.md
      - id: back
        label: Return to the map
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/old-lighthouse/investigation-setback.md
        title: A setback and the next lead
        body: Sounds from the investigation alerted someone; lost chance to investigate unnoticed. Clues remain. The twelve-minute blackout coincided with tide and the old customs tunnel exit. It is proof of a passage opportunity, not that Old Mo knew of an unseen ship.
  - min: 5
    max: 10
    text: No immediate conclusion, but identified how to revisit clues. The twelve-minute blackout coincided with tide and old customs tunnel exit. It is proof of passage opportunity, not that Old Mo knew of an unknown ship.
    options:
      - id: read-clue
        label: Read the clues
        action:
          kind: read
          paths:
            - world/harbor-chart/old-lighthouse/lighthouse-logbook.md
      - id: back
        label: Return to the map
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/old-lighthouse/investigation-setback.md
        title: A setback and the next lead
        body: No immediate conclusion, but identified how to revisit clues. The twelve-minute blackout coincided with tide and old customs tunnel exit. It is proof of passage opportunity, not that Old Mo knew of an unknown ship.
  - min: 11
    max: 17
    text: Observations connected. The twelve-minute blackout coincided with tide and old customs tunnel exit. It shows an opportunity for passage, not knowledge of an unknown ship by Old Mo.
    options:
      - id: read-clue
        label: Read the clues
        action:
          kind: read
          paths:
            - world/harbor-chart/old-lighthouse/lighthouse-logbook.md
      - id: back
        label: Return to the map
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/old-lighthouse/investigation-success.md
        title: Investigation notes
        body: Observations connected. The twelve-minute blackout coincided with tide and old customs tunnel exit. It shows an opportunity for passage, not knowledge of an unknown ship by Old Mo.
  - min: 18
    max: 20
    text: Not only the core, but next steps to verify are visible. The twelve-minute blackout coincided with tide and old customs tunnel exit. It shows passage opportunity, not knowledge of unknown ships. If you show the original and ask, you can separate speculation and testimony.
    options:
      - id: read-clue
        label: Read the clues
        action:
          kind: read
          paths:
            - world/harbor-chart/old-lighthouse/lighthouse-logbook.md
      - id: back
        label: Return to the map
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/old-lighthouse/investigation-great-success.md
        title: Breakthrough notes
        body: Not only the core, but next steps to verify are visible. The twelve-minute blackout coincided with tide and old customs tunnel exit. It shows passage opportunity, not knowledge of unknown ships. If you show the original and ask, you can separate speculation and testimony.
---

If it gets difficult, you can have characters investigate by dice. If you want to think yourself, returning without rolling is fine.

2d10: Roll two ten-sided dice. Success on total 11 or higher. Represents oversights or serendipitous discoveries during investigation.
2–4 (6%): Investigation noise alerts someone. Lose chance to investigate secretly, but clues remain.
5–10 (39%): Not solved immediately. Know what to investigate next. No loss of items.
11–17 (49%): Success. Understand clue meaning and next steps.
18–20 (6%): Great success. Discoveries helpful for next investigation.

Failure does not lead to dead ends here. Cannot re-roll the same dice. After seeing results, choose next actions. Sending to writer needed only when making new places.
