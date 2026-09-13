---
type: chalk
title: 三十年後 · 同じ敷居
choice:
  options:
    - id: action-1
      label: 目の前の店と人を確かめる
    - id: action-2
      label: 時間の地図へ戻る
intent: この場所の README と shop-record.md、実在すれば adult-ryo.md と counter-frog.md を読み、現在の事実だけでこの Chalk を更新する。再訪で改史しない。
choice_actions:
  action-1:
    kind: read
    paths:
      - world/time-map/thirty-years-later/tokiwa-electronics/shop-record.md
  action-2:
    kind: enter
    target: world/time-map
---

二〇二四年。同じ敷居の前で、蛙をそっと握る。ここに何が残り、誰がいるか。今の記録と目の前の景色を確かめよう。
