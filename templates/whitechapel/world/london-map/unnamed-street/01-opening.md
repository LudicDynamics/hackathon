---
type: chalk
title: Print shop courtyard · Devise a safe plan
choice:
  options:
    - id: investigate-with-dice
      label: Find clues by rolling dice
    - id: action-1
      label: Compare address and manuscript records
    - id: action-2
      label: Consult Watson about a safe way to summon the suspect
  allow_free: true
intent: revision-scrap.md is the result of map verification. meeting-options.md is known methods for consultation. No invitation has been issued yet. Only execute agreed plans.
choice_actions:
  action-1:
    kind: read
    paths:
      - world/london-map/unnamed-street/revision-scrap.md
      - world/london-map/print-shop/editor-office/correction-log.md
  action-2:
    kind: character
    character: watson
  investigate-with-dice:
    kind: read
    paths:
      - world/london-map/unnamed-street/04-investigation-dice.md
---

The new address in the novel does not exist. We can’t go there and wait. We’re currently in the print shop’s courtyard where we can meet and talk in person.

We can ask the editor to call the suspect here under the pretext of confirming the address. Consult with Watson on who to call and what to verify. There’s no need to risk bringing Edith to a dangerous place.
