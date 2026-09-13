---
type: gate
name: Tonight in 1995 · Inform by Fax
title: Tonight in 1995 · Inform by Fax
bg: assets/scenes/tonight.webp
intent: Read the intent from the current README. If player/fax-draft.md is missing, immediately offer a single Chalk with options to "Write message to send" or "Discuss and draft". Do not consider "confirm" or the original letter as the sending body. Save the draft once received, displaying recipient, date, full text, and character count on one Chalk, offering "Send this page" or "Rewrite". Mere confirmation, reading, or using tools does not send. Detailed steps follow the world skill.
choice:
  options:
    - id: action-1
      label: Write the message to send
    - id: action-2
      label: Check the prepared fax
    - id: action-3
      label: Check the time the fax will arrive
bgVideo: assets/motion/seedance/backgrounds/tonight.webm
choice_actions:
  action-1:
    kind: writer
  action-2:
    kind: stage
    slots:
      - id: material-1
        title: Fax message draft before sending
        required: true
        paths:
          - player/fax-draft.md
  action-3:
    kind: read
    paths:
      - world/time-map/tonight/tokiwa-electronics/fax-machine.md
---

Ryo had the accident this morning, on the way to pick up the frog. The fax machine before you can send a message to the shop at 8 AM the same day — thirty minutes before she left home.

What should you inform the shop, so she won't take the dangerous route? First, draft a message with “Write message to send.” Do not send until you confirm the content and decide to send it.
