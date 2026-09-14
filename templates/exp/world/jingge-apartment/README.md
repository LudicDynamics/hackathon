---
type: readme
name: 璟阁行政公寓
bg: assets/scenes/jingge-apartment.jpg
ambient: city-night
title: 璟阁行政公寓
intent: 公寓总览层。五星级酒店式公寓，大源核心区，离园区正北偏西步行十五分钟。1-3 层是公共服务区（大堂、自助餐厅、泳池健身房沙龙），4-15 层标准居住区，16-20 层行政套房区。埃利亚斯住在 18 层尽头 1806，长包房。访客大多到不了 18 层，梯控直达授权楼层。
choice:
  options:
    - id: action-1
      label: 坐电梯上 18 层，去 1806
    - id: action-2
      label: 回高新南区街上
choice_actions:
  action-1:
    kind: enter
    target: world/jingge-apartment/suite-1806
  action-2:
    kind: enter
    target: map
---

公寓楼下是私密的景观小花园，一条散步步道绕着走，晚上没什么人。

大堂挑高，地面是大理石的，礼宾台后面站着穿制服的人。你报房号或者刷卡，梯控才放你去对应楼层。电梯里铺着厚地毯，按键是磨砂金属的，声音很轻。

十六层往上，每层户数就少了，走廊里地毯更厚，安静得能听见中央新风的低声。这栋楼里住着不少恒星云的差旅高管，也有像埃利亚斯那样签了半年长包房的人。
