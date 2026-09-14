---
type: readme
name: 会议室
bg: assets/scenes/stellar-cloud-campus-tower-bc-frontier-lab-meeting-room.jpg
title: 会议室
intent: 埃利亚斯办公室正对面的一间标准会议室。长条会议桌、转椅、墙面无线投屏和全向麦克风、玻璃白板。桌面没杂物，椅子摆得整整齐齐。整层极少在这里开全员会，平时多半被核心组的人借来当隔音舱打电话或打游戏。你一年也用不上几次。
choice:
  options:
    - id: action-1
      label: 看一眼玻璃白板
    - id: action-2
      label: 看墙上的投屏显示器和全向麦克风
    - id: action-3
      label: 门口那张房间预约屏
    - id: action-4
      label: 回到走廊
choice_actions:
  action-1:
    kind: read
    paths:
      - world/stellar-cloud-campus/tower-bc/frontier-lab/meeting-room/glass-board.md
  action-2:
    kind: read
    paths:
      - world/stellar-cloud-campus/tower-bc/frontier-lab/meeting-room/wireless-display.md
  action-3:
    kind: read
    paths:
      - world/stellar-cloud-campus/tower-bc/frontier-lab/meeting-room/booking-panel.md
  action-4:
    kind: enter
    target: world/stellar-cloud-campus/tower-bc/frontier-lab
---

会议室就在埃利亚斯办公室正对面，玻璃隔断，一眼能看穿。一张长条会议桌配一圈转椅，墙面上挂着无线投屏显示器和一支全向麦克风，侧面一块玻璃白板。桌面没有杂物，椅子排列整齐，被人推进去时椅背都朝同一个方向。

它极少用于实验室内部的全员会——核心组习惯凑在白板前讨论，支持组三个人也不需要会议室。更多时候它被核心组的人当成隔音舱：抱着一台平板进去关门，打两局游戏，或者接一个需要安静的电话。你在楼下开会用过大会议室，这一间是偶尔路过才想起来的存在。

站在门口能闻到新风的味道，空调很足。玻璃白板上没有字，投屏显示器黑着，麦克风摆在桌中央正对主位。
