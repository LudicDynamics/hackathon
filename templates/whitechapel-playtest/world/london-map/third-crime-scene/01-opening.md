---
type: chalk
title: 第三現場 · 絵とそっくり
choice:
  options:
    - id: investigate-with-dice
      label: ダイスで手掛かりを見つける
    - id: action-1
      label: 絵と現場の違いを調べる
    - id: action-2
      label: 二つの青い絵具を比べる
  allow_free: true
intent: pigment-record.md を根拠に答える。群青だけで人を断定しない。絵が先か事件が先かは検視室の時刻記録、原稿を見られた人は印刷所へ案内する。
choice_actions:
  action-1:
    kind: read
    paths:
      - world/london-map/third-crime-scene/pigment-record.md
  action-2:
    kind: read
    paths:
      - player/blue-brass-cap.md
      - world/london-map/third-crime-scene/pigment-record.md
  investigate-with-dice:
    kind: read
    paths:
      - world/london-map/third-crime-scene/04-investigation-dice.md
---

椅子も帽子も、小説の絵と同じ場所にあります。誰かが、わざと絵のとおりに並べたようです。手すりには青い絵具と、手をぶつけた跡があります。

まず記録を読んでみましょう。絵と事件のどちらが先だったかは、検視室と印刷所で確かめられます。
