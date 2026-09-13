---
type: chalk
title: 画室 · ウェインに聞こう
choice:
  options:
    - id: investigate-with-dice
      label: ダイスで手掛かりを見つける
    - id: action-1
      label: ウェインに手首と絵の納品について聞く
    - id: action-2
      label: 訂正された住所を読んだか確かめる
  allow_free: true
intent: visible-details.md と回覧記録を根拠に質問を受ける。態度や怪我だけで有罪にしない。未提示の証拠を提示済みにせず、実際の返答を残す。
choice_actions:
  action-1:
    kind: character
    character: wayne
  action-2:
    kind: character
    character: wayne
  investigate-with-dice:
    kind: read
    paths:
      - world/london-map/print-shop/illustration-room/04-investigation-dice.md
---

絵を描いたウェインは、右手首に新しい包帯を巻いています。袖には青い絵具。机には、住所を変えた原稿があります。

現場の跡と関係があるかもしれません。手のけがと、絵を届けた時間について聞いてみましょう。まだ、けがだけで犯人とは決められません。
