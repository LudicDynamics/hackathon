---
type: gate
name: ロンドン · 次はどこを調べる？
title: ロンドン · 次はどこを調べる？
bg: assets/backgrounds/map.webp
requires:
  items:
    - player/blue-brass-cap.md
blocked: 二二一Ｂで依頼を引き受け、画筒の蓋を持って出かけよう。
bgVideo: assets/motion/seedance/backgrounds/map.webm
choice:
  options:
    - id: investigate-with-dice
      label: ダイスで手掛かりを見つける
  allow_free: true
choice_actions:
  investigate-with-dice:
    kind: read
    paths:
      - world/london-map/04-investigation-dice.md
---

次の事件は今日の正午です。まず「第三現場」で、絵と現場を比べましょう。次に印刷所で、原稿を読めた人を調べます。作者のイーディスにも、客間で話を聞けます。

順番は自由。難しければ「ダイスで手掛かりを見つける」を選ぶと、ホームズが推理します。分かったことから、次の事件を止める作戦を選びましょう。
