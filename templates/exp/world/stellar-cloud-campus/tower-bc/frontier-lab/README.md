---
type: readme
name: 前沿隐私架构实验室
bg: assets/scenes/stellar-cloud-campus-tower-bc-frontier-lab.jpg
ambient: office-night
title: 前沿隐私架构实验室
intent: 实验室总览层，也是埃利亚斯与明月的 home。B 栋 12
  层西侧独立封闭办公区，磨砂玻璃双开门，白名单刷卡门禁。开门后是入口区：左手边是行政角，明月的工位。再往里是开放办公区：你的工位在边缘靠近走廊。走廊尽头是埃利亚斯的独立玻璃办公室，对面是会议室，角落是茶水间和洗手间。核心算法组是另一群人，跟你们底层支持组各干各的。
choice:
  options:
    - id: action-1
      label: 去开放办公区，回你的工位
    - id: action-2
      label: 走到走廊尽头的玻璃办公室
    - id: action-3
      label: 去茶水间倒杯水
    - id: action-4
      label: 去会议室
    - id: action-5
      label: 出实验室，回电梯厅
    - id: action-6
      label: 走到门口左手边的行政角
choice_actions:
  action-1:
    kind: enter
    target: world/stellar-cloud-campus/tower-bc/frontier-lab/open-office
  action-2:
    kind: enter
    target: world/stellar-cloud-campus/tower-bc/frontier-lab/elias-office
  action-3:
    kind: enter
    target: world/stellar-cloud-campus/tower-bc/frontier-lab/pantry
  action-4:
    kind: enter
    target: world/stellar-cloud-campus/tower-bc/frontier-lab/meeting-room
  action-5:
    kind: enter
    target: world/stellar-cloud-campus/tower-bc
  action-6:
    kind: enter
    target: world/stellar-cloud-campus/tower-bc/frontier-lab/admin-corner
---

B 栋 12 层西侧，磨砂玻璃双开门。玻璃墙下半截贴了防窥膜，你刷卡，绿灯亮，门开。

进门是入口区，雨伞架里插着两把没干的伞。再往里，一整片开放办公区没有实体墙：靠门这侧是底层支持组的工位区，三个人，你的位子在边缘，紧挨走廊，抬头能看见谁进谁出。穿过低矮储物柜和移动白板组成的软隔断，另一侧是核心算法组的十二个位子，墙上和板上全是没擦干净的公式推导。

走廊在右边，尽头是埃利亚斯的玻璃办公室，百叶窗半开着。走廊对面是会议室。角落里是茶水间。

进门左手边、紧挨白名单闸口的那一小块地方是行政角。一张升降桌、一台共享打印机、一摞等着流转的纸质单子——明月在这儿办公，负责整层的登记、会务、报销和工单流转。她桌上总摊着一本硬皮笔记。

这里一天的大部分时间都很安静，除了核心组那边偶尔为某个推导吵起来。
