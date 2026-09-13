---
type: chalk
title: 港の地図 · 船を調べよう
intent: ここは地点の一覧。証拠を集める順序は自由。帰り道は港務所。未所持を語りだけで突破させない。
choice:
  options:
    - id: investigate-with-dice
      label: ダイスで手掛かりを見つける
  allow_free: true
choice_actions:
  investigate-with-dice:
    kind: read
    paths:
      - world/harbor-chart/04-investigation-dice.md
---

まず七番埠頭で、船に残った傷を見てみましょう。工房では船の部品、灯台では明かりが消えた時間を調べられます。順番は自由です。

謎が難しければ「ダイスで手掛かりを見つける」を選べます。あなたの代わりに調査員が考えます。分かったことを使って、霧の先へ進みましょう。
