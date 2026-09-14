---
type: chalk
title: 221B · 阻止下一起事件
choice:
  options:
    - id: action-1
      label: 阅读来信和第四幅画
    - id: action-2
      label: 接受委托，拿上画筒盖
intent: 阅读并展示 world/watson-letter.md 和 fourth-illustration.md。玩家接受委托并说要拿走时，把 world/blue-brass-cap.md move 到 player/blue-brass-cap.md。接下来从伦敦地图引导前往第三现场。暂不揭晓真相。正午是故事里的压力，不因现实中的阅读时间施加惩罚。
choice_actions:
  action-1:
    kind: read
    paths:
      - world/watson-letter.md
      - world/fourth-illustration.md
  action-2:
    kind: take
    paths:
      - world/blue-brass-cap.md
---

你是夏洛克·福尔摩斯。华生前来向你求助。

“我的病人伊迪丝是位小说家。和她小说里一样的事件，已经接连发生了三起。下一起就在今天正午。有人在模仿她的小说。请你帮帮她。”

你要做两件事：查出是谁在模仿小说，并阻止今天的第四起事件。先读来信和第四幅画，拿上画筒盖，前往伦敦地图。伊迪丝就在这栋房子的客厅里。
