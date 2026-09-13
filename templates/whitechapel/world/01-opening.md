---
type: chalk
title: 221B · Stop the next incident
choice:
  options:
    - id: action-1
      label: Read the letter and the fourth illustration
    - id: action-2
      label: Accept the request and take the painting tube lid
intent: Read and show world/watson-letter.md and fourth-illustration.md. When accepted and taken, move world/blue-brass-cap.md to player/blue-brass-cap.md. Next, guide from London map to the third scene. The truth remains unrevealed. Noon is story pressure; no penalty for real reading time.
choice_actions:
  action-1:
    kind: read
    paths:
      - world/watson-letter.md
      - world/fourth-illustration.md
  action-2:
    kind: take
    paths:
      - world/blue-brass-cap.md
---

You are Sherlock Holmes. Watson has come seeking your help.

“The patient Edith is a novelist. Three incidents just like her novels have happened. The next incident will occur today at noon. Someone is imitating the novels. She wants your help.”

Two tasks: find who is imitating the novel, and prevent today’s fourth incident. First read the letter and fourth picture, take the painting tube lid, and go to the London map. Edith waits in this house’s parlor.
