---
type: chalk
title: Broadcast Room · Nanami
choice:
  options:
    - id: action-1
      label: Tell Nanami you’ll spend tonight together
    - id: action-2
      label: Ask Nanami how she’s feeling right now
intent: Reply to the spoken words on site, updating promises and memories with world skill “record conversation.” Treat questions as questions and promises as promises; don’t auto-finalize endings. Visits to Sumi and existing promises remain.
choice_actions:
  action-1:
    kind: writer
  action-2:
    kind: character
    character: nanami
---

"Would you be upset if I said you picked the last song just for me?" Nanami is still watching the sending lamp.
