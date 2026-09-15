---
type: chalk
title: 1806 · 开放式厨房与水吧台
intent: 会客厅西侧的开放式厨房，没有实体门。石材中岛加两把高脚凳，岛上是意式半自动咖啡机和独立磨豆机、黑色玻璃电子秤、整木砧板。烹饪区有嵌入式电磁炉、铸铁煎烤锅、纯铜雪平锅、磁吸刀架。储物区是双开门冰箱和隐藏迷你吧抽屉。能看咖啡机、开冰箱、拉开迷你吧。
choice:
  options:
    - id: action-1
      label: 看岛台上的意式咖啡机
    - id: action-2
      label: 看电磁炉上的铸铁煎烤锅
    - id: action-3
      label: 拉开台面下的迷你吧抽屉
    - id: action-4
      label: 看岛台上的两罐咖啡豆
    - id: action-5
      label: 回会客厅
    - id: action-6
      label: 回 1806 门厅
choice_actions:
  action-1:
    kind: read
    paths:
      - world/jingge-apartment/suite-1806/kitchen-bar/espresso-machine.md
  action-2:
    kind: read
    paths:
      - world/jingge-apartment/suite-1806/kitchen-bar/cast-iron-pan.md
  action-3:
    kind: read
    paths:
      - world/jingge-apartment/suite-1806/kitchen-bar/mini-bar.md
  action-4:
    kind: read
    paths:
      - world/jingge-apartment/suite-1806/kitchen-bar/coffee-beans.md
  action-5:
    kind: enter
    target: world/jingge-apartment/suite-1806/living-room
  action-6:
    kind: enter
    target: world/jingge-apartment/suite-1806
---

厨房在会客厅的西侧，没有门，也没有隔断，中岛台把备餐和烹饪分成两边。整个空间是石材和哑光的金属色，台面干净得发亮。

中岛上摆着一台意式半自动咖啡机和一台独立的磨豆机，旁边是两罐无糖深烘咖啡豆、一只黑色玻璃镜面的电子厨房秤和一块整木厚砧板。秤面擦得没有指纹，砧板边缘有一层被油养出来的浅光。

烹饪区是嵌入式的电磁炉和隐形抽油烟机，最内侧的炉眼上压着一口二合一铸铁煎烤锅，沉甸甸的，锅盖本身就是一面带条纹的煎盘。旁边是纯铜的雪平锅。防溅墙上固定着黑胡桃木的磁吸刀架，刀口一律朝向同一边。

靠墙是嵌入式双开门冰箱，台面下有一条隐藏的迷你吧抽屉。这里能看设备、能看那两罐豆子、能拉开抽屉，也能往会客厅走。
