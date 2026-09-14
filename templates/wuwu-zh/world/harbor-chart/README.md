---
type: gate
name: 港口地图 · 调查那艘船
title: 港口地图 · 调查那艘船
bg: assets/scenes/harbor-chart.webp
requires:
  items:
    - player/commission-letter.md
    - player/investigator-badge.md
blocked: 请把委托书和调查员徽章都放进包里。
intent: 这里是地点一览。收集证据的顺序自由。归途是港务所。不允许仅凭叙述越过未持有的物品。
bgVideo: assets/motion/seedance/backgrounds/map.webm
choice:
  options:
    - id: investigate-with-dice
      label: 用骰子寻找线索
  allow_free: true
choice_actions:
  investigate-with-dice:
    kind: read
    paths:
      - world/harbor-chart/04-investigation-dice.md
---

先去7号码头，看看船上留下的伤痕。在工坊可以调查船的零件，在灯塔可以调查灯熄灭的时间。顺序随你。

如果谜题太难，可以选择“用骰子寻找线索”，由调查员替你思考。用你查明的事，向雾的另一边前进吧。
