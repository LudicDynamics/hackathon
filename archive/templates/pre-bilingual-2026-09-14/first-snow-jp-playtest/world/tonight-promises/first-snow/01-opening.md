---
type: chalk
title: 初雪 · 今夜の最後の場面
choice:
  options:
    - id: action-1
      label: 今夜を結ぶ
    - id: action-2
      label: まだ話したいことがある
intent: ここは決断の夜。入場条件はない。入場だけでは結末を書かない。「今夜を結ぶ」を送信した時だけ、世界 skill の「決断の夜」に従い、背包の信物と実際の RP を確認して作家が結末を判断する。キャラクターを選ぶボタンで結末を指定しない。
choice_actions:
  action-1:
    kind: writer
  action-2:
    kind: enter
    target: world/tonight-promises
---

ここで、今夜の話を締めくくれます。誰に何を伝え、どんな約束をしたかで、最後の場面は変わります。

「今夜を結ぶ」を選び、作家に送信してください。まだ話したい相手がいれば戻れます。誰にも会わなかった夜にも、その夜の結末があります。
