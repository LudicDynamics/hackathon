---
type: readme
name: 1806 · 玄关与家政区
ambient: rain
title: 1806 · 玄关与家政区
intent: 入户门内的玄关与家政区。左手墙嵌着智能中控屏，能管全屋声光电、呼叫管家、设勿扰；旁边是电子猫眼屏。通顶玄关柜的下半部藏着洗烘一体机，墙角立着沥水伞架。能读中控屏、看伞架里的黑伞、打开玄关柜，也能往会客厅走或退出套房。
choice:
  options:
    - id: action-1
      label: 读玄关柜上的智能中控屏
    - id: action-2
      label: 看墙角伞架里的那把伞
    - id: action-3
      label: 打开通顶玄关柜
    - id: action-4
      label: 往里走，去会客厅
    - id: action-5
      label: 回到 1806 门厅
    - id: action-6
      label: 出套房，回公寓走廊
choice_actions:
  action-1:
    kind: read
    paths:
      - world/jingge-apartment/suite-1806/entry/smart-panel.md
  action-2:
    kind: read
    paths:
      - world/jingge-apartment/suite-1806/entry/black-umbrella.md
  action-3:
    kind: read
    paths:
      - world/jingge-apartment/suite-1806/entry/shoe-cabinet.md
  action-4:
    kind: enter
    target: world/jingge-apartment/suite-1806/living-room
  action-5:
    kind: enter
    target: world/jingge-apartment/suite-1806
  action-6:
    kind: enter
    target: world/jingge-apartment
---

入户门关上，外面走廊的脚步声和地毯的闷响就被隔断了。门内是一小段玄关，恒温 22 度的干燥空气扑在脸上。

左手边的墙里嵌着一块智能中控屏，屏幕是暗的，边缘有一圈呼吸灯。它管着这套房所有的声光电，也能一键呼叫管家、切换勿扰和清理状态。旁边是电子猫眼的显示屏，此刻映着一段空走廊。

正对面不是墙，是通顶的定制玄关柜，一直顶到天花板。柜子看着像整面木饰面，其实下半部藏着一台洗烘一体机，柜门一推就开。墙角立着一个沥水伞架，里面靠着一把纯黑的长柄直杆伞，伞尖对准了接水的凹槽。

玄关正前方就是会客厅，落地窗的光从那边漫过来。你在这里能看中控屏、看那把伞、打开柜子，也可以往里走。

门外的墙上亮着一盏常明的"请勿打扰"指示灯，从里面看不见，但它一直亮着。
