---
type: chalk
title: 画室 · 问问韦恩
choice:
  options:
    - id: investigate-with-dice
      label: 用骰子寻找线索
    - id: action-1
      label: 问韦恩手腕的伤和交画的时间
    - id: action-2
      label: 确认他是否读过订正后的地址
  allow_free: true
intent: 以 visible-details.md 和传阅记录为依据回应提问。不能仅凭态度或伤势就定罪。不要把尚未出示的证据当作已出示，记下实际的回答。
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

画插图的韦恩，右手腕缠着新绷带。袖子上有蓝色颜料。桌上放着改过地址的原稿。

这也许和现场的痕迹有关。问问他手上的伤，以及交画的时间吧。但光凭伤，还不能断定他就是犯人。
