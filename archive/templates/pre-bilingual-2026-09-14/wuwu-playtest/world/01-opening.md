---
type: chalk
title: 港務所 · 調査を始める
choice:
  options:
    - id: action-1
      label: 依頼書と徽章を受け取る
    - id: action-2
      label: 依頼の条件を読む
intent: 受領なら world/commission-letter.md と world/investigator-badge.md の現物をそれぞれ同名で player/ へ move。片方が既にあれば不足分だけ。実際の所持を確認し、港の地図を案内する。
choice_actions:
  action-1:
    kind: take
    paths:
      - world/commission-letter.md
      - world/investigator-badge.md
  action-2:
    kind: read
    paths:
      - world/commission-letter.md
---

あなたは港に来た調査員です。誰も乗っていない船、人の失踪、灯台の明かりが消えた夜。この三つに関係があるのか、調べてほしいと頼まれました。

まず「依頼書と徽章を受け取る」を選び、港の地図へ進みましょう。徽章は港を調べるための許可証です。
