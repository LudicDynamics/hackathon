---
type: gate
name: 工坊 · 从船上脱落的零件
title: 工坊 · 从船上脱落的零件
bg: assets/scenes/workshop.webp
choice:
  options:
    - id: investigate-with-dice
      label: 用骰子寻找线索
    - id: action-1
      label: 调查船的零件
    - id: action-2
      label: 向薇拉询问物主
  allow_free: true
bgVideo: assets/motion/seedance/backgrounds/workshop.webm
choice_actions:
  action-1:
    kind: read
    paths:
      - world/harbor-chart/workshop/crest-clasp.md
  action-2:
    kind: character
    character: vera
  investigate-with-dice:
    kind: read
    paths:
      - world/harbor-chart/workshop/04-investigation-dice.md
---

技师薇拉保管着一个从船舵上脱落的零件。零件上有领主家族的纹章。

这个零件和哪艘船有关，就是线索。先读一读零件的说明，再问问薇拉它的主人是谁吧。
