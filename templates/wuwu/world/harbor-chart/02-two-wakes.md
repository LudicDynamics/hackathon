---
type: chalk
title: Search for the other ship
choice:
  options:
    - id: investigate-with-dice
      label: Find clues by rolling dice
    - id: action-1
      label: Arrange the collected materials
    - id: action-2
      label: Still investigating
  allow_free: true
intent: Read the original submission and content. Consider two independent observations and execution method; if lacking, return reasons and next investigation locations. If appropriate, only prepare cost and judgment preview. Do not roll dice automatically.
choice_actions:
  action-1:
    kind: stage
    slots:
      - id: material-1
        title: Waterline record
        required: false
        paths:
          - world/harbor-chart/seventh-berth/waterline-trace.md
      - id: material-2
        title: Fastener evidence
        required: false
        paths:
          - world/harbor-chart/workshop/crest-clasp.md
      - id: material-3
        title: Lighthouse log
        required: false
        paths:
          - world/harbor-chart/old-lighthouse/lighthouse-logbook.md
  action-2:
    kind: enter
    target: world/harbor-chart
  investigate-with-dice:
    kind: read
    paths:
      - world/harbor-chart/04-investigation-dice.md
---

The ship's damage and the time the lighthouse went dark. Together, they suggest another ship may have been in the fog.

If you want to think for yourself, you can arrange materials and consult. If difficult, entrust investigation to the dice. Either way, progress is possible. Send to the writer only when investigating a new location.
