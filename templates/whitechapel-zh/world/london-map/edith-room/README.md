---
type: gate
name: 221B客厅 · 作者的讲述
title: 221B客厅 · 作者的讲述
bg: assets/backgrounds/intro.webp
intent: 以 address-correction.md 为出处，把本人的怀疑与确定的事实分开。被保护的人也有自己的意愿。不要擅自编造她同意外出当诱饵。
choice:
  options:
    - id: investigate-with-dice
      label: 用骰子寻找线索
    - id: action-1
      label: 问她为什么改地址
    - id: action-2
      label: 问她把订正稿交给了谁
  allow_free: true
bgVideo: assets/motion/seedance/backgrounds/intro.webm
choice_actions:
  action-1:
    kind: character
    character: edith
  action-2:
    kind: character
    character: edith
  investigate-with-dice:
    kind: read
    paths:
      - world/london-map/edith-room/04-investigation-dice.md
---

小说家伊迪丝在这里受华生保护。“小说是我写的。可我从没想过要伤害任何人。”

她今早改了小说里的地址。问问她为什么改，又交给了谁。
