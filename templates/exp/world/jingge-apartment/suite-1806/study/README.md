---
type: readme
name: 1806 · 独立书房
ambient: rain
title: 1806 · 独立书房
intent: 走廊右侧的独立书房，一扇实体木门隔开。门边是落地衣帽架，里面是升降办公桌与人体工学椅、单侧通顶书架（酒店中文书与自购外文书）、单人沙发与落地灯。桌上是 MacBook 和外接显示器，桌下有一台 UPS。能翻桌上的 MacBook、看废纸篓里的草稿、抽一本外文书。
choice:
  options:
    - id: action-1
      label: 看桌上的 MacBook
    - id: action-2
      label: 看废纸篓里的算法草稿
    - id: action-3
      label: 从书架抽一本外文书
    - id: action-4
      label: 看桌下那台 UPS
    - id: action-5
      label: 回走廊，去会客厅
    - id: action-6
      label: 回 1806 门厅
choice_actions:
  action-1:
    kind: read
    paths:
      - world/jingge-apartment/suite-1806/study/macbook.md
  action-2:
    kind: read
    paths:
      - world/jingge-apartment/suite-1806/study/draft-crumples.md
  action-3:
    kind: read
    paths:
      - world/jingge-apartment/suite-1806/study/crypto-shelf.md
  action-4:
    kind: read
    paths:
      - world/jingge-apartment/suite-1806/study/ups.md
  action-5:
    kind: enter
    target: world/jingge-apartment/suite-1806/living-room
  action-6:
    kind: enter
    target: world/jingge-apartment/suite-1806
---

书房在走廊的右侧，是这个套房里唯一有实体门的地方。门是一扇厚木门，关上就把外面的客厅声全隔掉了。

推门进去，先看见门边的落地衣帽架，上面挂着一件西装外套。房间不大，一张升降办公桌居中，配一把高配的人体工学椅。桌上居中放着一台 MacBook 和一台外接显示器，屏幕挂灯是这里唯一的光源，把键盘照得清楚。线缆都绑扎好，贴在桌沿下方。桌下立着一台 UPS，电源指示灯是绿的。

靠一面墙是通顶书架，按尺寸排着书：一部分是酒店常备的中文小说，另一部分是自购的外文书，多数是专业书。书架旁是单人沙发和一盏几乎不开的落地灯。

桌右侧有一只黑色金属废纸篓，里面躺着几团揉皱的草稿纸，边上能看见密密麻麻的手写公式。这里能翻电脑、看草稿、抽书，也能回走廊。
