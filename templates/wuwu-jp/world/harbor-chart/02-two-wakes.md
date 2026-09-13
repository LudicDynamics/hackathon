---
type: chalk
title: もう一隻の船を探そう
choice:
  options:
    - id: investigate-with-dice
      label: ダイスで手掛かりを見つける
    - id: action-1
      label: 集めた材料を並べる
    - id: action-2
      label: まだ調べる
  allow_free: true
intent: 提出元の現物と内容を読む。独立した観察二つと実行方法を検討し、不足なら理由と次の調査先を返す。妥当なら費用・判定予告を作るだけ。自動で骰子を振らない。
choice_actions:
  action-1:
    kind: stage
    slots:
      - id: material-1
        title: 喫水線の記録
        required: false
        paths:
          - world/harbor-chart/seventh-berth/waterline-trace.md
      - id: material-2
        title: 留め具の証拠
        required: false
        paths:
          - world/harbor-chart/workshop/crest-clasp.md
      - id: material-3
        title: 灯台日誌
        required: false
        paths:
          - world/harbor-chart/old-lighthouse/lighthouse-logbook.md
  action-2:
    kind: enter
    target: world/harbor-chart
  investigate-with-dice:
    kind: read
    paths:
      - world/harbor-chart/04-investigation-dice.md
---

船の傷と、灯台が消えた時間。二つを合わせると、霧の中に別の船がいた可能性があります。

自分で考えたいなら材料を並べて相談できます。難しければ、ダイスで調査員に任せましょう。どちらでも先へ進めます。新しい場所を調べる時だけ、作家へ送信します。
