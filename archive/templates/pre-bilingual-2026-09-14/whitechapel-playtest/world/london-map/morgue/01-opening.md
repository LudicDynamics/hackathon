---
type: chalk
title: 検視室 · 事件はいつ起きた？
choice:
  options:
    - id: investigate-with-dice
      label: ダイスで手掛かりを見つける
    - id: action-1
      label: 発見時刻と挿絵の納品時刻を比べる
  allow_free: true
intent: time-record.md と印刷所の受領票を比較する。時刻だけで特定人物の犯行を証明したとは言わない。
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

三件目の事件は、今朝六時ごろに起きました。

絵がそれより前に描かれていたなら、「事件を見てから描いた」とは言えません。印刷所の記録と比べましょう。
