---
type: chalk
title: Connect the two wakes by dice
roll_dice:
  type: 2d10
  desc: Connect the two wakes by dice
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
    text: Sounds of investigation echo, losing secret chances unnoticed. Clues remain. An unmanned ship alone cannot explain the scrapes and light-out time. Pursue the second ship and customs side passage.
    options:
      - id: play-result
        label: Try a different route from clues
        action:
          kind: writer
          prompt: Read the actual dice roll and text of judgment source world/harbor-chart/04-investigation-dice.md. This is a consented dice route that substitutes decoding. Does not require two pieces of evidence or method writing. Leaves a cost for misses and generates a short scene world/harbor-chart/tidal-approach/ to track tide marks. From there, discovery of new paths can continue. Includes README, two objects, Chalk with actions, return gate; necessary image later. Does not regenerate if text done.
      - id: back
        label: Return to the investigation
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/investigation-setback.md
        title: A setback and the next lead
        body: Sounds of investigation echo, losing secret chances unnoticed. Clues remain. An unmanned ship alone cannot explain the scrapes and light-out time. Pursue the second ship and customs side passage.
  - min: 5
    max: 10
    text: No immediate conclusion, but identified how to revisit clues. An unmanned ship alone cannot explain scrapes and light-out times. Pursue the second ship and customs side passage.
    options:
      - id: play-result
        label: Try a different route from clues
        action:
          kind: writer
          prompt: Read the actual dice roll and text of judgment source world/harbor-chart/04-investigation-dice.md. This is a consented dice route that substitutes decoding. Does not require two pieces of evidence or method writing. Leaves a cost for misses and generates a short scene world/harbor-chart/tidal-approach/ to track tide marks. From there, discovery of new paths can continue. Includes README, two objects, Chalk with actions, return gate; necessary image later. Does not regenerate if text done.
      - id: back
        label: Return to the investigation
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/investigation-setback.md
        title: A setback and the next lead
        body: No immediate conclusion, but identified how to revisit clues. An unmanned ship alone cannot explain scrapes and light-out times. Pursue the second ship and customs side passage.
  - min: 11
    max: 17
    text: Observations connected. An unmanned ship alone cannot explain scrapes and light-out times. Pursue the second ship and customs side passage.
    options:
      - id: play-result
        label: Proceed beyond discovery
        action:
          kind: writer
          prompt: Read the actual dice roll and text of judgment source world/harbor-chart/04-investigation-dice.md. This is a consented dice route that substitutes decoding. No requirement for two pieces of evidence or method writing. Generates the first shore path in world/harbor-chart/beyond-the-fog/ from the silhouette of the second ship. Includes README, two objects, Chalk with actions, return gate; necessary image later. Does not regenerate if text done.
      - id: back
        label: Return to the investigation
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/investigation-success.md
        title: Investigation notes
        body: Observations connected. An unmanned ship alone cannot explain scrapes and light-out times. Pursue the second ship and customs side passage.
  - min: 18
    max: 20
    text: Not only the core, but the next steps to check are visible. An unmanned ship alone cannot explain scrapes and light-out times. Pursue the second ship and customs side passage. The next scene uses this leeway for extra observation opportunities.
    options:
      - id: play-result
        label: Proceed beyond discovery
        action:
          kind: writer
          prompt: Read the actual dice roll and text of judgment source world/harbor-chart/04-investigation-dice.md. This is a consented dice route that substitutes decoding. No requirement for two pieces of evidence or method writing. Generates the first shore path in world/harbor-chart/beyond-the-fog/ from the silhouette of the second ship. Reflects signals of contacts found by great success into the next scene. Includes README, two objects, Chalk with actions, return gate; image later. Does not regenerate if text done.
      - id: back
        label: Return to the investigation
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/investigation-great-success.md
        title: Breakthrough notes
        body: Not only the core, but the next steps to check are visible. An unmanned ship alone cannot explain scrapes and light-out times. Pursue the second ship and customs side passage. The next scene uses this leeway for extra observation opportunities.
---

If it gets difficult, you can have characters investigate by dice. If you want to think yourself, returning without rolling is fine.

2d10: Roll two ten-sided dice. Success on total 11 or higher. Represents oversights or serendipitous discoveries during investigation.
2–4 (6%): Investigation noise alerts someone. Lose chance to investigate secretly, but clues remain.
5–10 (39%): Not solved immediately. Know what to investigate next. No loss of items.
11–17 (49%): Success. Understand clue meaning and next steps.
18–20 (6%): Great success. Discoveries helpful for next investigation.

Failure does not lead to dead ends here. Cannot re-roll the same dice. After seeing results, choose next actions. Sending to writer needed only when making new places.
