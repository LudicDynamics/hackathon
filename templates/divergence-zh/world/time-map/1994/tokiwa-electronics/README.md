---
type: gate
name: 1994年12月31日 · 送修日 · 常盘电器
title: 1994年12月31日 · 送修日 · 常盘电器
bg: assets/scenes/shop-daylight.webp
intent: 少女不知道第二天早上的事故。以 collection-slip.md 和 route-note.md 为依据回答。如果玩家具体商量改为送货等事项，把对方的答复和已成立的约定记录到 intervention.md，并按照世界 skill 更新未来。仅仅“考虑一下”不算约定成立。
choice:
  options:
    - id: action-1
      label: 询问取件约定和回家的路
    - id: action-2
      label: 商量改为送货上门，不用她来取
choice_actions:
  action-1:
    kind: character
    character: young-ryo
  action-2:
    kind: writer
---

同一个柜台上，还放着坏掉的青蛙和送修单。七岁的凉抬头看着你：“明天真的能修好吗？长大以后，我也想在这里当修东西的人。”你是她认识的修理学徒。
