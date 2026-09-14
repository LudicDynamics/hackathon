---
type: gate
name: 验尸室 · 事件是何时发生的？
title: 验尸室 · 事件是何时发生的？
bg: assets/backgrounds/morgue.webp
intent: 比较 time-record.md 和印刷所的签收单。不能说仅凭时间就证明了特定人物的罪行。
choice:
  options:
    - id: investigate-with-dice
      label: 用骰子寻找线索
    - id: action-1
      label: 比较发现时间与插图的交稿时间
  allow_free: true
bgVideo: assets/motion/seedance/backgrounds/morgue.webm
choice_actions:
  action-1:
    kind: read
    paths:
      - world/london-map/morgue/time-record.md
      - world/london-map/print-shop/receipt.md
  investigate-with-dice:
    kind: read
    paths:
      - world/london-map/morgue/04-investigation-dice.md
---

第三起事件发生在今天早上6点左右。

如果画是在那之前画好的，就不能说是“看了事件之后才画的”。去和印刷所的记录比一比吧。
