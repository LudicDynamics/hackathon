---
type: readme
name: 夜晚的图书馆 · 第一个魔法
title: 夜晚的图书馆 · 第一个魔法
intent: 若领取，就把名牌 move 到 player/。讲失败的故事时，举一个具体的例子，但不要把未确认的代价强加给玩家。
choice:
  options:
    - id: action-1
      label: 领取名牌
    - id: action-2
      label: 向塞拉菲娜请教失败的魔法
choice_actions:
  action-1:
    kind: take
    paths:
      - world/freshman-badge.md
  action-2:
    kind: character
    character: seraphina
bg: assets/scenes/academy-library.webp
---

你是魔法学院的新生。学姐塞拉菲娜会告诉你第一个课题。


「试着把身边的东西组合起来，做出属于你自己的魔法吧。告诉我你想做什么、要用什么，以及愿意拿什么作为交换。」

先领取名牌，再前往存放魔法材料的地方吧。看过能用的东西之后再决定也没关系。
