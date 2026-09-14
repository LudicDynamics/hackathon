---
type: gate
name: 印刷所 · 问问汤姆
title: 印刷所 · 问问汤姆
bg: assets/backgrounds/press.webp
intent: 展示 receipt.md 和 shift-ledger.md。汤姆只知道他记录下的交接和自己的值班。编辑确实在 editor-office，画师确实在 illustration-room。如果还没对话，不要当作已经取得了证词。
choice:
  options:
    - id: investigate-with-dice
      label: 用骰子寻找线索
    - id: action-1
      label: 问汤姆原稿和插图的先后
    - id: action-2
      label: 阅读签收单和值班簿
  allow_free: true
bgVideo: assets/motion/seedance/backgrounds/press.webm
choice_actions:
  action-1:
    kind: character
    character: tom
  action-2:
    kind: read
    paths:
      - world/london-map/print-shop/receipt.md
      - world/london-map/print-shop/shift-ledger.md
  investigate-with-dice:
    kind: read
    paths:
      - world/london-map/print-shop/04-investigation-dice.md
---

印刷工汤姆会给你看工作记录。在这里可以查“谁读过原稿”和“画是什么时候送到的”。

先读记录，或者问问汤姆吧。里面的编辑室有布莱克本，画室有韦恩。
