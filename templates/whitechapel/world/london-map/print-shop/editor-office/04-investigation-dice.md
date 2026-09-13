---
type: chalk
title: Follow the destination of the corrected manuscript
roll_dice:
  type: 2d10
  desc: Follow the destination of the corrected manuscript
  expect: ">=11"
choice:
  options:
    - id: back
      label: Return to the map now without rolling
choice_actions:
  back:
    kind: enter
    target: world/london-map
dice_outcomes:
  - min: 2
    max: 4
    text: The sound of investigation alerted someone, so the chance to search unnoticed was lost. There's still a lead. The editor received it at 8 a.m. and forwarded it to Wayne at 8:15. The corrected address was not a secret just between the author and editor.
    options:
      - id: read-clue
        label: Read the clues
        action:
          kind: read
          paths:
            - world/london-map/print-shop/editor-office/correction-log.md
      - id: back
        label: Return to the map
        action:
          kind: enter
          target: world/london-map
    rewards:
      - path: world/london-map/print-shop/editor-office/investigation-setback.md
        title: A setback and the next lead
        body: The sound of investigation alerted someone, so the chance to search unnoticed was lost. There's still a lead. The editor received it at 8 a.m. and forwarded it to Wayne at 8:15. The corrected address was not a secret just between the author and editor.
  - min: 5
    max: 10
    text: No immediate connection, but we've found a direction to review the clues. The editor received it at 8 a.m. and forwarded it to Wayne at 8:15. The corrected address was not a secret just between the author and editor.
    options:
      - id: read-clue
        label: Read the clues
        action:
          kind: read
          paths:
            - world/london-map/print-shop/editor-office/correction-log.md
      - id: back
        label: Return to the map
        action:
          kind: enter
          target: world/london-map
    rewards:
      - path: world/london-map/print-shop/editor-office/investigation-setback.md
        title: A setback and the next lead
        body: No immediate connection, but we've found a direction to review the clues. The editor received it at 8 a.m. and forwarded it to Wayne at 8:15. The corrected address was not a secret just between the author and editor.
  - min: 11
    max: 17
    text: Observations connected. The editor received it at 8 a.m. and forwarded it to Wayne at 8:15. The corrected address was not a secret just between the author and editor.
    options:
      - id: read-clue
        label: Read the clues
        action:
          kind: read
          paths:
            - world/london-map/print-shop/editor-office/correction-log.md
      - id: back
        label: Return to the map
        action:
          kind: enter
          target: world/london-map
    rewards:
      - path: world/london-map/print-shop/editor-office/investigation-success.md
        title: Investigation notes
        body: Observations connected. The editor received it at 8 a.m. and forwarded it to Wayne at 8:15. The corrected address was not a secret just between the author and editor.
  - min: 18
    max: 20
    text: Not only the core, but also the next steps to verify are clear. The editor received it at 8 a.m. and forwarded it to Wayne at 8:15. The corrected address was not a secret just between the author and editor. Presenting the original during questioning can differentiate assumptions from testimony.
    options:
      - id: read-clue
        label: Read the clues
        action:
          kind: read
          paths:
            - world/london-map/print-shop/editor-office/correction-log.md
      - id: back
        label: Return to the map
        action:
          kind: enter
          target: world/london-map
    rewards:
      - path: world/london-map/print-shop/editor-office/investigation-great-success.md
        title: Breakthrough notes
        body: Not only the core, but also the next steps to verify are clear. The editor received it at 8 a.m. and forwarded it to Wayne at 8:15. The corrected address was not a secret just between the author and editor. Presenting the original during questioning can differentiate assumptions from testimony.
---

If difficulty arises, roll dice to let characters conduct investigation. If you want to think yourself, you can return without rolling safely.

2d10: Roll two ten-sided dice. Success if total ≥ 11. Represents oversights or lucky discoveries during investigation.
2–4 (6%): Someone notices by sound, you lose the stealthy chance but keep clues.
5–10 (39%): No immediate solution. You learn what to investigate next. No lost items.
11–17 (49%): Success. You understand a clue’s meaning and next steps.
18–20 (6%): Great success. Plus further useful findings for next investigation.

Even on failure, this is not a dead end. You cannot reroll the same dice. After seeing results, choose next action. Only creating new places requires sending to the writer.
