---
type: chalk
title: 編集室 · 原稿を渡した相手
choice:
  options:
    - id: investigate-with-dice
      label: ダイスで手掛かりを見つける
    - id: action-1
      label: 訂正稿を誰に回したか聞く
    - id: action-2
      label: 原稿を渡した相手の記録を読む
  allow_free: true
intent: correction-log.md を根拠に、原稿流通の責任と犯罪への関与を分ける。患者の居場所は明かさない。
choice_actions:
  action-1:
    kind: character
    character: blackburn
  action-2:
    kind: read
    paths:
      - world/london-map/print-shop/editor-office/correction-log.md
  investigate-with-dice:
    kind: read
    paths:
      - world/london-map/print-shop/editor-office/04-investigation-dice.md
---

編集者のブラックバーンが原稿を管理しています。今朝、イーディスから住所を変えた原稿が届きました。

その原稿を、次に誰へ渡したのでしょう？ 机の記録を読むか、本人に聞いてみましょう。
