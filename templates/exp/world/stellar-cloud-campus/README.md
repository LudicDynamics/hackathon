---
type: readme
name: 恒星云西南总部园区
ambient: city-night
title: 恒星云西南总部园区
intent: 园区总览层。封闭式科技园区，你上班的地方。西侧南北向排着深色玻璃幕墙的 BC 双子楼，西北角是食堂星味楼，中间是下沉广场，西南角有片小公园。四扇门分别通向这四处。
choice:
  options:
    - id: action-1
      label: 进双子楼，去实验室
    - id: action-2
      label: 去星味楼吃饭
    - id: action-3
      label: 下到下沉广场
    - id: action-4
      label: 去小公园走走
choice_actions:
  action-1:
    kind: enter
    target: world/stellar-cloud-campus/tower-bc
  action-2:
    kind: enter
    target: world/stellar-cloud-campus/canteen
  action-3:
    kind: enter
    target: world/stellar-cloud-campus/sunken-plaza
  action-4:
    kind: enter
    target: world/stellar-cloud-campus/riverside-park
---

早上八点五十，你从东侧主入口刷工牌过闸机。人脸识别的绿灯亮了一下，闸门弹开。吉祥物的雕塑立在入口内侧，被雨水冲得发亮。

园区里没有车，只有走路的人。西装、卫衣、通勤双肩包，全都低着头往各自楼里赶。你往西走，双子楼的影子压过来，二十层的玻璃幕墙把阴天切成一块块灰。

园区很大。你脚下的路通向四个方向，每个方向都有你这一天会用到的地方。
