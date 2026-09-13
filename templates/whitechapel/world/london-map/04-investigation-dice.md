---
type: chalk
title: Let Holmes deduce by dice
roll_dice:
  type: 2d10
  desc: Let Holmes deduce by dice
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
    text: "Sounds indicate investigation, but you lose the chance to check unnoticed. Clues remain. Strongest suspicion: Wayne read the text first and aligned the depicted composition to the incident. Edith’s address change was a probe. Verify in the courtyard, separating protection and evidence gathering."
    options:
      - id: play-result
        label: Try a different path from the clues
        action:
          kind: writer
          prompt: "Read judgment source world/london-map/04-investigation-dice.md. The player entrusts Holmes’ inference to dice and tries this safe plan: focus on Wayne, ask the editor to confirm the courtyard address, protect Edith at 221B, signal and plan retreat with Watson. No need for two documents or correct text. Treat this submission as trial confirmation. This scene will be a brief failure/partial success including misses and refusals, playing fixed culprit and responses. Use existing ending rules to create result scene and route."
      - id: back
        label: Return to investigation
        action:
          kind: enter
          target: world/london-map
    rewards:
      - path: world/london-map/investigation-setback.md
        title: A setback and the next lead
        body: "Sounds indicate investigation, but you lose the chance to check unnoticed. Clues remain. Strongest suspicion: Wayne read the text first and aligned the depicted composition to the incident. Edith’s address change was a probe. Verify in the courtyard, separating protection and evidence gathering."
  - min: 5
    max: 10
    text: No immediate conclusions, but you identify a direction to revisit clues. Wayne likely read the text first, matching the depicted composition to the incident. Edith’s address correction was a probe. Verify in the courtyard, separating protection and evidence gathering.
    options:
      - id: play-result
        label: Try a different path from the clues
        action:
          kind: writer
          prompt: "Read judgment source world/london-map/04-investigation-dice.md. The player entrusts Holmes’ inference to dice and tries this safe plan: focus on Wayne, ask the editor to confirm the courtyard address, protect Edith at 221B, signal and plan retreat with Watson. No need for two documents or correct text. Treat this submission as trial confirmation. This scene will be a brief failure/partial success including misses and refusals, playing fixed culprit and responses. Use existing ending rules to create result scene and route."
      - id: back
        label: Return to investigation
        action:
          kind: enter
          target: world/london-map
    rewards:
      - path: world/london-map/investigation-setback.md
        title: A setback and the next lead
        body: No immediate conclusions, but you identify a direction to revisit clues. Wayne likely read the text first, matching the depicted composition to the incident. Edith’s address correction was a probe. Verify in the courtyard, separating protection and evidence gathering.
  - min: 11
    max: 17
    text: Observations connected. Wayne likely read the text first and aligned the depicted composition to the incident. Edith’s address correction was a probe. Verify in the courtyard, separating protection and evidence gathering.
    options:
      - id: play-result
        label: Advance beyond discoveries
        action:
          kind: writer
          prompt: "Read judgment source world/london-map/04-investigation-dice.md. The player entrusts Holmes’ inference to dice and tries this safe plan: focus on Wayne, ask editor to confirm the courtyard address, protect Edith at 221B, signal and plan retreat with Watson. No need for two documents or correct text. Treat as trial confirmation. Use observations to continue the setup. Fixed culprit and responses remain. Use existing ending rules."
      - id: back
        label: Return to investigation
        action:
          kind: enter
          target: world/london-map
    rewards:
      - path: world/london-map/investigation-success.md
        title: Investigation notes
        body: Observations connected. Wayne likely read the text first and aligned the depicted composition to the incident. Edith’s address correction was a probe. Verify in the courtyard, separating protection and evidence gathering.
  - min: 18
    max: 20
    text: Not only the core, but the next verification steps are clear. Wayne likely read the text first, aligning the composition to the incident. Edith’s address correction was a probe. Verify in the courtyard, separating protection and evidence. Next scene will make this grace a concrete added observation opportunity.
    options:
      - id: play-result
        label: Advance beyond discoveries
        action:
          kind: writer
          prompt: "Read judgment source world/london-map/04-investigation-dice.md. The player entrusts Holmes’ inference to dice and tries this safe plan: focus on Wayne, ask editor to confirm the courtyard address, protect Edith at 221B, signal and plan retreat with Watson. No need for two documents or correct text. Treat as trial confirmation. Use observations to continue the setup. Fixed culprit and responses remain. Use existing ending rules."
      - id: back
        label: Return to investigation
        action:
          kind: enter
          target: world/london-map
    rewards:
      - path: world/london-map/investigation-great-success.md
        title: Breakthrough notes
        body: Not only the core, but the next verification steps are clear. Wayne likely read the text first, aligning the composition to the incident. Edith’s address correction was a probe. Verify in the courtyard, separating protection and evidence. Next scene will make this grace a concrete added observation opportunity.
---

If difficulty arises, roll dice to let characters conduct investigation. If you want to think yourself, you can return without rolling safely.

2d10: Roll two ten-sided dice. Success if total ≥ 11. Represents oversights or lucky discoveries during investigation.
2–4 (6%): Someone notices by sound, you lose the stealthy chance but keep clues.
5–10 (39%): No immediate solution. You learn what to investigate next. No lost items.
11–17 (49%): Success. You understand a clue’s meaning and next steps.
18–20 (6%): Great success. Plus further useful findings for next investigation.

Even on failure, this is not a dead end. You cannot reroll the same dice. After seeing results, choose next action. Only creating new places requires sending to the writer.
