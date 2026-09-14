---
type: readme
name: 星味楼 2 层 · 特色风味
bg: assets/scenes/stellar-cloud-campus-canteen-floor2.jpg
ambient: tavern-chatter
title: 星味楼 2 层 · 特色风味
intent: 星味楼二层，主打特色风味。面食粉类、麻辣烫串串、地方小吃在里侧排开，轻食减脂餐窗口配着卡路里屏。南侧的连廊入口是一片缓冲枢纽，从 BC 栋走过来的人在这里分流。夜宵时段，面食窗口常亮。往下一层，或回食堂总览。
choice:
  options:
    - id: action-1
      label: 去麻辣烫串串的窗口
    - id: action-2
      label: 看轻食窗口的卡路里屏
    - id: action-3
      label: 走到南侧连廊入口
    - id: action-4
      label: 下一层
    - id: action-5
      label: 回食堂总览
choice_actions:
  action-1:
    kind: read
    paths:
      - world/stellar-cloud-campus/canteen/floor2/malatang.md
  action-2:
    kind: read
    paths:
      - world/stellar-cloud-campus/canteen/floor2/calorie-screen.md
  action-3:
    kind: read
    paths:
      - world/stellar-cloud-campus/canteen/floor2/corridor-gate.md
  action-4:
    kind: enter
    target: world/stellar-cloud-campus/canteen/floor1
  action-5:
    kind: enter
    target: world/stellar-cloud-campus/canteen
---

二层比一层安静一点，也更讲究。南侧的连廊口是最先撞见的——从 BC 栋走过来的人从这里涌进来，站着找方向、等人、看手机，形成一片松松的缓冲地带。过了这片，才算真正进到就餐区。

窗口以特色风味为主。面食粉类靠一排，麻辣烫和串串另占一角，地方小吃散在中间。另一侧是轻食减脂餐窗口，每份都配着卡路里屏，标得清清楚楚，附近几栋楼里健身的人爱来这儿。

整体灯光比一层柔些，桌距也宽一点。宵夜时段，面食那个窗口会一直亮着，加班的人陆续排队取餐。九点以后，刷工牌能免费领一份夜宵套餐。
