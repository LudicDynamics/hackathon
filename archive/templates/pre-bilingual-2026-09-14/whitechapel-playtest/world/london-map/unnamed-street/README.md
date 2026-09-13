---
type: gate
name: 印刷所の中庭 · 安全な作戦を考える
title: 印刷所の中庭 · 安全な作戦を考える
bg: assets/backgrounds/fourth.webp
intent: revision-scrap.md は地図の照合結果。meeting-options.md は相談用の既知の手段。まだ誘いを出したことにしない。合意した計画だけを実行する。
choice:
  options:
    - id: investigate-with-dice
      label: ダイスで手掛かりを見つける
    - id: action-1
      label: 住所と原稿の記録を比べる
    - id: action-2
      label: 安全に相手を呼ぶ方法をワトソンへ相談する
  allow_free: true
bgVideo: assets/motion/seedance/backgrounds/fourth.webm
choice_actions:
  action-1:
    kind: read
    paths:
      - world/london-map/unnamed-street/revision-scrap.md
      - world/london-map/print-shop/editor-office/correction-log.md
  action-2:
    kind: character
    character: watson
  investigate-with-dice:
    kind: read
    paths:
      - world/london-map/unnamed-street/04-investigation-dice.md
---

小説の新しい住所は、実在しません。そこへ行って待つことはできません。今いるのは、実際に会って話せる印刷所の中庭です。

編集者に頼み、住所の確認を理由に、気になる相手をここへ呼ぶ案があります。ワトソンに相談して、誰を呼ぶか、何を確かめるか決めましょう。イーディスを危険な場所へ連れ出す必要はありません。
