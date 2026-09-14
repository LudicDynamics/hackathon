---
type: gate
name: 旧灯塔 · 熄灭的灯光
title: 旧灯塔 · 熄灭的灯光
bg: assets/scenes/old-lighthouse.webp
intent: 若是借灯油的行动，就把一份灯油实际交给 player/lamp-oil.md。日志只能证明熄灯的时刻。不要把老莫不知道的第二艘船捏造成他的记忆。
choice:
  options:
    - id: investigate-with-dice
      label: 用骰子寻找线索
    - id: action-1
      label: 阅读灯塔日志
    - id: action-2
      label: 借灯油，商量照明方法
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

灯塔看守老莫说，那天夜里他把灯熄了十二分钟。为什么偏偏是那段时间呢？

读一读日志，就能知道船可以通过的时间。想用灯光查看雾的另一边时，也可以找老莫商量借灯油。
