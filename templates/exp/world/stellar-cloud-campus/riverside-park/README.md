---
type: readme
name: 小公园
bg: assets/scenes/stellar-cloud-campus-riverside-park.jpg
ambient: rain
title: 小公园
intent: 园区西南角到南侧边缘的绿化区。有篮球场、网球场、乒乓球台和一条八百米环形塑胶跑道；再往里是银杏林，透水砖步道、长椅间距离得很开、循环水景；最南边是大片阳光草坪。午休有人带饭来草坪上坐着。
choice:
  options:
    - id: action-1
      label: 沿银杏步道走一圈
    - id: action-2
      label: 在草坪上坐一会儿
    - id: action-3
      label: 回园区
choice_actions:
  action-1:
    kind: writer
    prompt: 玩家沿小公园的银杏林步道散步，阴天，水景的青石板槽里有循环的水声。写一段安静的具体场景，不推进线索。
  action-2:
    kind: writer
    prompt: 玩家在小公园的草坪区坐下，午休时有人带餐食来这儿。写一段安静的具体场景，不推进线索。
  action-3:
    kind: enter
    target: world/stellar-cloud-campus
---

小公园在园区西南角，是这片玻璃楼里唯一一块潮湿的绿。

运动区离入口最近，两个篮球场、一个网球场、四个乒乓球台，还有一圈八百米的塑胶跑道。再往里是银杏林，铺的是透水砖步道，木长椅之间隔得很远，中间一条循环水景，青石板浅槽里水流的声音不大，但能盖住远处球场的动静。空气里有泥和树叶的味道。

最南边是阳光草坪，午休的时候有人带饭过来，铺开野餐垫坐着，或者干脆躺着看天。阴天，天是灰的，但草是绿的。
