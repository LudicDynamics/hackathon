---
type: chalk
title: 221Bの客間 · 作者の話
choice:
  options:
    - id: investigate-with-dice
      label: ダイスで手掛かりを見つける
    - id: action-1
      label: 住所を変えた理由を聞く
    - id: action-2
      label: 誰に訂正稿を渡したか聞く
  allow_free: true
intent: address-correction.md を出典に本人の疑いと確定事実を分ける。保護される人にも意思がある。本人を囮として外へ出す同意を勝手に作らない。
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

小説家のイーディスは、ここでワトソンに守られています。「小説は私が書きました。でも、人を傷つけるつもりはなかったんです」。

彼女は今朝、小説の住所を変えました。なぜ変えたのか、誰に渡したのかを聞いてみましょう。
