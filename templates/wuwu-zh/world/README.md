---
type: readme
name: 港务所 · 开始调查
title: 港务所 · 开始调查
bg: assets/scenes/intro.webp
intent: 若接受，将 world/commission-letter.md 与 world/investigator-badge.md 的实物分别以同名 move 到 player/。若已持有其中一件，只移动缺少的。确认实际持有后，引导前往港口地图。
choice:
  options:
    - id: action-1
      label: 领取委托书与徽章
    - id: action-2
      label: 阅读委托条件
bgVideo: assets/motion/seedance/backgrounds/intro.webm
choice_actions:
  action-1:
    kind: take
    paths:
      - world/commission-letter.md
      - world/investigator-badge.md
  action-2:
    kind: read
    paths:
      - world/commission-letter.md
---

你是来到港口的调查员。一艘无人的船、一个人的失踪、灯塔熄灯的夜晚。有人请你调查这三件事之间是否有关联。

先选择“领取委托书与徽章”，前往港口地图吧。徽章是调查港口的许可证。
