---
type: chalk
title: 印刷所中庭 · 想一个安全的作战
choice:
  options:
    - id: investigate-with-dice
      label: 用骰子寻找线索
    - id: action-1
      label: 比较地址与原稿的记录
    - id: action-2
      label: 和华生商量安全地把对方叫来的办法
  allow_free: true
intent: revision-scrap.md 是地图核对的结果。meeting-options.md 是供商量用的已知手段。不要当作已经发出邀约。只执行已商定的计划。
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

小说里的新地址并不存在。没法去那里守着。你现在所在的，是可以实际见面谈话的印刷所中庭。

有一个办法：请编辑以确认地址为由，把你在意的人叫到这里来。和华生商量一下，叫谁、要确认什么。没必要把伊迪丝带到危险的地方去。
