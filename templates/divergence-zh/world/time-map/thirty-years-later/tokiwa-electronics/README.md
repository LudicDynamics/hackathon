---
type: gate
name: 2024年12月31日 · 三十年后 · 常盘电器
title: 2024年12月31日 · 三十年后 · 常盘电器
bg: assets/scenes/future-original.webp
intent: 现状以 shop-record.md 为准。介入之前，不要让成年的凉或正在营业的店出现。改变之后，展示同一目录中实际存在的结果。回访时不重新生成。
choice:
  options:
    - id: action-1
      label: 阅读店铺消失的原因
    - id: action-2
      label: 回到时间地图
choice_actions:
  action-1:
    kind: read
    paths:
      - world/time-map/thirty-years-later/tokiwa-electronics/shop-record.md
  action-2:
    kind: enter
    target: world/time-map
---

上了年纪的你站在店铺旧址上。隔壁的房子和道路都还在，只有常盘电器的那块地空着。失去那个少女后，师傅关了店；没有人继承的建筑后来被拆除了。这里是尚未改变的未来。
