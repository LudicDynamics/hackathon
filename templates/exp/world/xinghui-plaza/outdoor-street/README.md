---
type: readme
name: 星汇天地 · 室外步行街与下沉广场
bg: assets/scenes/xinghui-plaza-outdoor-street.jpg
ambient: city-night
title: 星汇天地 · 室外步行街与下沉广场
intent: 商圈外围的露天步行街，连着商场和园区方向。两侧是双层餐饮门店、咖啡馆外摆和新能源车展厅；走到中段地面下沉，是阶梯式的露天小广场，中间有小喷泉，边上散着轻食店和连锁茶饮。傍晚下班你会来这边走走，吃个饭、坐一会儿。能看车展厅、看喷泉、在外摆桌边坐下，也能回商场总览。
choice:
  options:
    - id: action-1
      label: 看新能源车展厅
    - id: action-2
      label: 走到下沉广场的喷泉边
    - id: action-3
      label: 在咖啡馆外摆的桌边坐一会儿
    - id: action-4
      label: 回星汇天地总览
choice_actions:
  action-1:
    kind: read
    paths:
      - world/xinghui-plaza/outdoor-street/car-showroom.md
  action-2:
    kind: read
    paths:
      - world/xinghui-plaza/outdoor-street/fountain.md
  action-3:
    kind: read
    paths:
      - world/xinghui-plaza/outdoor-street/cafe-tables.md
  action-4:
    kind: enter
    target: world/xinghui-plaza
---

从园区南门出来，过一条街就是星汇天地的步行街。路面是浅色的石材拼铺，两边立着双层的餐饮门店，一层的落地玻璃里能看见明黄色的灯和坐满的人。

街两头各有一家咖啡馆，把桌椅外摆到人行道上，塑料的遮阳伞收着，因为阳都的雨说来就来。再往前走，一家新能源车展厅把两台车摆在通透的玻璃盒子后面，灯打得雪亮。

走到步行街中段，地面往下沉，是一小块阶梯式的露天广场。几级台阶围着中间一圈空地，中央是座小喷泉，水柱不高，晚上会亮。广场边上挤着轻食店和连锁茶饮，队伍弯出店门。

你不赶时间的时候，喜欢在喷泉边站一会儿，看水流，看下班的人来来往往。
