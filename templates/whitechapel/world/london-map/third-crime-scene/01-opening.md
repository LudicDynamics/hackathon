---
type: chalk
title: Third scene · Almost identical to the illustration
choice:
  options:
    - id: investigate-with-dice
      label: Find clues by rolling dice
    - id: action-1
      label: Investigate differences between the illustration and the scene
    - id: action-2
      label: Compare two blue pigments
  allow_free: true
intent: Answer based on pigment-record.md and do not convict just by ultramarine presence. Check the timeline from the morgue records; those who saw the manuscript can be directed to the print shop.
choice_actions:
  action-1:
    kind: read
    paths:
      - world/london-map/third-crime-scene/pigment-record.md
  action-2:
    kind: read
    paths:
      - player/blue-brass-cap.md
      - world/london-map/third-crime-scene/pigment-record.md
  investigate-with-dice:
    kind: read
    paths:
      - world/london-map/third-crime-scene/04-investigation-dice.md
---

The chair and hat are exactly where they are in the novel’s illustration. It seems someone intentionally arranged the scene to match the picture. Blue paint and a mark from a hand hitting the railing are present.

Let's first read the records. Whether the illustration or the incident came first can be checked at the morgue and print shop.
