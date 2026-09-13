---
type: chalk
title: 工房 · 船から外れた部品
choice:
  options:
    - id: investigate-with-dice
      label: ダイスで手掛かりを見つける
    - id: action-1
      label: 船の部品を調べる
    - id: action-2
      label: ヴェラに持ち主を尋ねる
  allow_free: true
choice_actions:
  action-1:
    kind: read
    paths:
      - world/harbor-chart/workshop/crest-clasp.md
  action-2:
    kind: character
    character: vera
  investigate-with-dice:
    kind: read
    paths:
      - world/harbor-chart/workshop/04-investigation-dice.md
---

技師のヴェラが、船の舵から外れた部品を預かっています。部品には領主の家の印があります。

この部品が、どの船と関係するのかが手掛かりです。まず部品の説明を読み、ヴェラに持ち主を聞いてみましょう。
