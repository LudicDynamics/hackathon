---
type: chalk
title: 七番埠頭 · 船の傷
choice:
  options:
    - id: investigate-with-dice
      label: ダイスで手掛かりを見つける
    - id: action-1
      label: 船の傷の説明を読む
    - id: action-2
      label: 銀鳶に箱のことを尋ねる
  allow_free: true
intent: 水位の痕跡を調べたら実物の記録を読ませる。銀鳶は空箱を見せても、知らない船の全容を断定しない。
choice_actions:
  action-1:
    kind: read
    paths:
      - world/harbor-chart/seventh-berth/waterline-trace.md
  action-2:
    kind: character
    character: silver-kite
  investigate-with-dice:
    kind: read
    paths:
      - world/harbor-chart/seventh-berth/04-investigation-dice.md
---

誰もいない船を、騎士の銀鳶が見張っています。船の横には、水面よりずっと高い所に傷があります。

何がぶつかったのでしょう？ 傷の記録を読むか、ダイスで調べてみましょう。空の箱については銀鳶に聞けます。
