---
type: chalk
title: Choose a place to lie in wait
roll_dice:
  type: 2d10
  desc: Choose a place to lie in wait
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
    text: The sound of investigation alerted someone, so the chance to search unnoticed was lost. There's still a lead. We can’t go to the fictitious street. We can use the real courtyard and ask the editor to mediate address verification. No need to use Edith herself as bait.
    options:
      - id: read-clue
        label: Read the clues
        action:
          kind: read
          paths:
            - world/london-map/unnamed-street/meeting-options.md
      - id: back
        label: Return to the map
        action:
          kind: enter
          target: world/london-map
    rewards:
      - path: world/london-map/unnamed-street/investigation-setback.md
        title: A setback and the next lead
        body: The sound of investigation alerted someone, so the chance to search unnoticed was lost. There's still a lead. We can’t go to the fictitious street. We can use the real courtyard and ask the editor to mediate address verification. No need to use Edith herself as bait.
  - min: 5
    max: 10
    text: No immediate connection, but we've found a direction to review the clues. We can’t go to the fictitious street. We can use the real courtyard and ask the editor to mediate address verification. No need to use Edith herself as bait.
    options:
      - id: read-clue
        label: Read the clues
        action:
          kind: read
          paths:
            - world/london-map/unnamed-street/meeting-options.md
      - id: back
        label: Return to the map
        action:
          kind: enter
          target: world/london-map
    rewards:
      - path: world/london-map/unnamed-street/investigation-setback.md
        title: A setback and the next lead
        body: No immediate connection, but we've found a direction to review the clues. We can’t go to the fictitious street. We can use the real courtyard and ask the editor to mediate address verification. No need to use Edith herself as bait.
  - min: 11
    max: 17
    text: Observations connected. We can’t go to the fictitious street. We can use the real courtyard and ask the editor to mediate address verification. No need to use Edith herself as bait.
    options:
      - id: read-clue
        label: Read the clues
        action:
          kind: read
          paths:
            - world/london-map/unnamed-street/meeting-options.md
      - id: back
        label: Return to the map
        action:
          kind: enter
          target: world/london-map
    rewards:
      - path: world/london-map/unnamed-street/investigation-success.md
        title: Investigation notes
        body: Observations connected. We can’t go to the fictitious street. We can use the real courtyard and ask the editor to mediate address verification. No need to use Edith herself as bait.
  - min: 18
    max: 20
    text: Not only the core, but also the next steps to verify are clear. We can’t go to the fictitious street. We can use the real courtyard and ask the editor to mediate address verification. No need to use Edith herself as bait. Presenting originals while questioning can separate assumptions from testimony.
    options:
      - id: read-clue
        label: Read the clues
        action:
          kind: read
          paths:
            - world/london-map/unnamed-street/meeting-options.md
      - id: back
        label: Return to the map
        action:
          kind: enter
          target: world/london-map
    rewards:
      - path: world/london-map/unnamed-street/investigation-great-success.md
        title: Breakthrough notes
        body: Not only the core, but also the next steps to verify are clear. We can’t go to the fictitious street. We can use the real courtyard and ask the editor to mediate address verification. No need to use Edith herself as bait. Presenting originals while questioning can separate assumptions from testimony.
---

If difficulty arises, roll dice to let characters conduct investigation. If you want to think yourself, you can return without rolling safely.

2d10: Roll two ten-sided dice. Success if total ≥ 11. Represents oversights or lucky discoveries during investigation.
2–4 (6%): Someone notices by sound, you lose the stealthy chance but keep clues.
5–10 (39%): No immediate solution. You learn what to investigate next. No lost items.
11–17 (49%): Success. You understand a clue’s meaning and next steps.
18–20 (6%): Great success. Plus further useful findings for next investigation.

Even on failure, this is not a dead end. You cannot reroll the same dice. After seeing results, choose next action. Only creating new places requires sending to the writer.
