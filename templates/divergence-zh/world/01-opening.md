---
type: chalk
title: 悔恨 · 最初的一页
choice:
  options:
    - id: action-1
      label: 拿起发条青蛙
    - id: action-2
      label: 阅读事故通知
    - id: read-letter
      label: 阅读没寄出的信
intent: 如果玩家说要拿，就把 world/clockwork-frog.md move 到 player/clockwork-frog.md。只有玩家也想要信时，才把信 move 到 player/undelivered-letter.md。只带青蛙就能进入时间地图。事故通知只需阅读。不要提前给出救援。不要把背景里的电话显示当作新证据或必需操作。
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

雨敲打着窗户。灯下放着一封只写了收信人姓名的信，和一只刚修好的青蛙。

你是常盘电器的修理学徒。1995年1月1日，晚上8点。昨天你答应凉的“明天上午10点”，已经过去了。

青蛙会跳了。只有那个本该来的少女，没有回来。
