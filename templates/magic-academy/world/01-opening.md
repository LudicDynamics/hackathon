---
type: chalk
title: Night Library · First Magic
choice:
  options:
    - id: action-1
      label: Receive your name tag
    - id: action-2
      label: Ask Seraphina about failed magic
intent: If received, move the name tag to player/. The failure story returns one concrete example but imposes no unconfirmed costs on the player.
choice_actions:
  action-1:
    kind: take
    paths:
      - world/freshman-badge.md
  action-2:
    kind: character
    character: seraphina
---

You are a new student at the magic academy. Senior Seraphina will teach you your first assignment.


"Try combining familiar things to create your own magic. Tell me what you want to do, what you use, and what you're willing to give in exchange."

First, receive your name tag and go to where the magical materials are. You can decide after seeing what you can use.
