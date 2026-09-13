---
type: chalk
title: What does that magic change?
choice:
  options:
    - id: action-1
      label: Write the magical combination
    - id: action-2
      label: Confirm the proposed magic's cost
  allow_free: true
  free_hint: Your own words for verb, items, desired change, and acceptable cost.
intent: Save the actual proposal to player/spell-draft.md. Present reasonable results and concrete costs in advance and wait to name it, cast, modify, or quit.
choice_actions:
  action-1:
    kind: writer
  action-2:
    kind: stage
    slots:
      - id: material-1
        title: Magic and cost proposal
        required: true
        paths:
          - player/spell-draft.md
---

Success isn't only opening big doors. Making a pocket-sized star map can also be your magic.
