---
type: gate
name: 伦敦 · 接下来调查哪里？
title: 伦敦 · 接下来调查哪里？
bg: assets/backgrounds/map.webp
requires:
  items:
    - player/blue-brass-cap.md
blocked: 在221B接下委托，带上画筒盖出发吧。
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
      - world/london-map/04-investigation-dice.md
---

下一起事件就在今天正午。先去“第三现场”，把画和现场比一比。然后到印刷所，查查谁能读到原稿。你也可以在客厅里听作者伊迪丝讲讲。

顺序随意。觉得难的话，选择“用骰子寻找线索”，福尔摩斯会替你推理。根据查到的事，选择阻止下一起事件的作战。
