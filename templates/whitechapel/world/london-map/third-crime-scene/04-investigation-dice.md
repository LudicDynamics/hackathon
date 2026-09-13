---
type: chalk
title: Detect the compositional inconsistency
roll_dice:
  type: 2d10
  desc: Detect the compositional inconsistency
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
    text: The sound of investigation alerted someone, so the chance to search unnoticed was lost. There's still a lead. The chair and hat are the same. It's suspicious that someone arranged the scene to match the illustration. Verify ultramarine and right-hand injuries with the artist.
    options:
      - id: read-clue
        label: Read the clues
        action:
          kind: read
          paths:
            - world/london-map/third-crime-scene/pigment-record.md
      - id: back
        label: Return to the map
        action:
          kind: enter
          target: world/london-map
    rewards:
      - path: world/london-map/third-crime-scene/investigation-setback.md
        title: A setback and the next lead
        body: The sound of investigation alerted someone, so the chance to search unnoticed was lost. There's still a lead. The chair and hat are the same. It's suspicious that someone arranged the scene to match the illustration. Verify ultramarine and right-hand injuries with the artist.
  - min: 5
    max: 10
    text: No immediate connection, but we've found a direction to review the clues. The chair and hat are the same. It's suspicious that someone arranged the scene to match the illustration. Verify ultramarine and right-hand injuries with the artist.
    options:
      - id: read-clue
        label: Read the clues
        action:
          kind: read
          paths:
            - world/london-map/third-crime-scene/pigment-record.md
      - id: back
        label: Return to the map
        action:
          kind: enter
          target: world/london-map
    rewards:
      - path: world/london-map/third-crime-scene/investigation-setback.md
        title: A setback and the next lead
        body: No immediate connection, but we've found a direction to review the clues. The chair and hat are the same. It's suspicious that someone arranged the scene to match the illustration. Verify ultramarine and right-hand injuries with the artist.
  - min: 11
    max: 17
    text: Observations connected. The chair and hat are the same. It's suspicious that someone arranged the scene to match the illustration. Verify ultramarine and right-hand injuries with the artist.
    options:
      - id: read-clue
        label: Read the clues
        action:
          kind: read
          paths:
            - world/london-map/third-crime-scene/pigment-record.md
      - id: back
        label: Return to the map
        action:
          kind: enter
          target: world/london-map
    rewards:
      - path: world/london-map/third-crime-scene/investigation-success.md
        title: Investigation notes
        body: Observations connected. The chair and hat are the same. It's suspicious that someone arranged the scene to match the illustration. Verify ultramarine and right-hand injuries with the artist.
  - min: 18
    max: 20
    text: Not only the core, but also the next steps to verify are clear. The chair and hat are the same. It's suspicious that someone arranged the scene to match the illustration. Verify ultramarine and right-hand injuries with the artist. Presenting originals during questioning can separate assumptions from testimony.
    options:
      - id: read-clue
        label: Read the clues
        action:
          kind: read
          paths:
            - world/london-map/third-crime-scene/pigment-record.md
      - id: back
        label: Return to the map
        action:
          kind: enter
          target: world/london-map
    rewards:
      - path: world/london-map/third-crime-scene/investigation-great-success.md
        title: Breakthrough notes
        body: Not only the core, but also the next steps to verify are clear. The chair and hat are the same. It's suspicious that someone arranged the scene to match the illustration. Verify ultramarine and right-hand injuries with the artist. Presenting originals during questioning can separate assumptions from testimony.
---

If difficulty arises, roll dice to let characters conduct investigation. If you want to think yourself, you can return without rolling safely.

2d10: Roll two ten-sided dice. Success if total ≥ 11. Represents oversights or lucky discoveries during investigation.
2–4 (6%): Someone notices by sound, you lose the stealthy chance but keep clues.
5–10 (39%): No immediate solution. You learn what to investigate next. No lost items.
11–17 (49%): Success. You understand a clue’s meaning and next steps.
18–20 (6%): Great success. Plus further useful findings for next investigation.

Even on failure, this is not a dead end. You cannot reroll the same dice. After seeing results, choose next action. Only creating new places requires sending to the writer.
