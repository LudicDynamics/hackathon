---
type: chalk
title: 後悔 · 最初の一頁
choice:
  options:
    - id: action-1
      label: ぜんまいの蛙を持つ
    - id: action-2
      label: 事故の知らせを読む
    - id: read-letter
      label: 届かなかった手紙を読む
intent: 取ると言われたら world/clockwork-frog.md を player/clockwork-frog.md へ move。手紙も希望された場合のみ player/undelivered-letter.md へ move。蛙だけで時間図へ入れる。事故の知らせは読むだけでよい。救済を先取りしない。背景の電話表示を新しい証拠や必須操作にしない。
choice_actions:
  action-1:
    kind: take
    paths:
      - world/clockwork-frog.md
  action-2:
    kind: read
    paths:
      - world/accident-notice.md
  read-letter:
    kind: read
    paths:
      - world/undelivered-letter.md
---

雨が窓をたたく。灯りの下には、宛名だけを書いた手紙と、直ったばかりの蛙。

あなたは常盤電器の修理見習い。一九九五年一月一日、午後八時。昨日リョウに約束した「明日の朝十時」は、もう過ぎた。

蛙は跳ねる。来るはずだった少女だけが、帰らない。
