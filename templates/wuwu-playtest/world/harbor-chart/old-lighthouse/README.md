---
type: gate
name: 古い灯台 · 消えた明かり
title: 古い灯台 · 消えた明かり
bg: assets/scenes/old-lighthouse.webp
intent: 油を借りる行動なら灯油を一つ player/lamp-oil.md へ実際に渡す。日誌は消灯の時刻だけ証明する。知らない二隻目を老モーの記憶として捏造しない。
choice:
  options:
    - id: investigate-with-dice
      label: ダイスで手掛かりを見つける
    - id: action-1
      label: 灯台日誌を読む
    - id: action-2
      label: 油を借り、照らし方を相談する
  allow_free: true
bgVideo: assets/motion/seedance/backgrounds/lighthouse.webm
choice_actions:
  action-1:
    kind: read
    paths:
      - world/harbor-chart/old-lighthouse/lighthouse-logbook.md
  action-2:
    kind: character
    character: old-mo
  investigate-with-dice:
    kind: read
    paths:
      - world/harbor-chart/old-lighthouse/04-investigation-dice.md
---

灯台守の老モーは、あの夜、明かりを十二分間消したと話します。なぜ、その時間だったのでしょう？

日誌を読むと、船が通れた時間が分かります。明かりで霧の先を調べたい時は、老モーに油を借りる相談もできます。
