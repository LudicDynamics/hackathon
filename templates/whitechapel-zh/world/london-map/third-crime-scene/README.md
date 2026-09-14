---
type: gate
name: 第三现场 · 和画一模一样
title: 第三现场 · 和画一模一样
bg: assets/backgrounds/scene3.webp
intent: 以 pigment-record.md 为依据回答。不能仅凭群青就断定是谁。画和事件孰先孰后，引导去看验尸室的时间记录；谁能看到原稿，引导去印刷所。
choice:
  options:
    - id: investigate-with-dice
      label: 用骰子寻找线索
    - id: action-1
      label: 调查画与现场的差异
    - id: action-2
      label: 比较两处蓝色颜料
  allow_free: true
bgVideo: assets/motion/seedance/backgrounds/scene3.webm
choice_actions:
  action-1:
    kind: read
    paths:
      - world/london-map/third-crime-scene/pigment-record.md
  action-2:
    kind: read
    paths:
      - player/blue-brass-cap.md
      - world/london-map/third-crime-scene/pigment-record.md
  investigate-with-dice:
    kind: read
    paths:
      - world/london-map/third-crime-scene/04-investigation-dice.md
---

椅子和帽子，都摆在和小说插图相同的位置。似乎有人故意照着画布置了现场。栏杆上有蓝色颜料，还有手撞上去的痕迹。

先读读记录吧。画和事件哪个在先，可以去验尸室和印刷所确认。
