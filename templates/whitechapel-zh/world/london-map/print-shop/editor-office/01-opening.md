---
type: chalk
title: 编辑室 · 原稿交给了谁
choice:
  options:
    - id: investigate-with-dice
      label: 用骰子寻找线索
    - id: action-1
      label: 问订正稿传给了谁
    - id: action-2
      label: 阅读原稿交接对象的记录
  allow_free: true
intent: 以 correction-log.md 为依据，把原稿流转的责任与参与犯罪分开。不透露病人的所在。
choice_actions:
  action-1:
    kind: character
    character: blackburn
  action-2:
    kind: read
    paths:
      - world/london-map/print-shop/editor-office/correction-log.md
  investigate-with-dice:
    kind: read
    paths:
      - world/london-map/print-shop/editor-office/04-investigation-dice.md
---

编辑布莱克本管理着原稿。今天早上，伊迪丝送来了改过地址的原稿。

那份原稿，接下来交给了谁？读读桌上的记录，或者直接问他本人吧。
