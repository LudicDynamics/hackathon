---
type: gate
name: 7号码头 · 船上的伤痕
title: 7号码头 · 船上的伤痕
bg: assets/scenes/seventh-berth.webp
intent: 调查过水位痕迹后，让对方读实际的记录。银鸢即使出示空箱，也不会断定那艘不明船只的全貌。
choice:
  options:
    - id: investigate-with-dice
      label: 用骰子寻找线索
    - id: action-1
      label: 阅读船上伤痕的说明
    - id: action-2
      label: 向银鸢询问箱子的事
  allow_free: true
bgVideo: assets/motion/seedance/backgrounds/dock.webm
choice_actions:
  action-1:
    kind: read
    paths:
      - world/harbor-chart/seventh-berth/waterline-trace.md
  action-2:
    kind: character
    character: silver-kite
  investigate-with-dice:
    kind: read
    paths:
      - world/harbor-chart/seventh-berth/04-investigation-dice.md
---

骑士银鸢看守着一艘空无一人的船。船侧有一道伤痕，位置比水面高得多。

是什么撞上了船？读一读伤痕的记录，或者用骰子调查吧。空箱的事可以问银鸢。
