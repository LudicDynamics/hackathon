---
type: chalk
title: 客厅兼工作区
intent: 602
  最主要的房间，一半是工作区，一半是休闲区。靠墙一张长条电脑桌、带鱼屏和二手人体工学椅，桌上桌下都是你的装备；对面是旧布艺沙发和矮茶几，堆着没拆的快递和一台
  Switch。中间空地上铺着一张一米直径的黑色防滑垫，是你的 VR 活动区。往里有厨房和卧室，外侧连着阳台，也能退回玄关。
choice:
  options:
    - id: action-1
      label: 坐到电脑桌前
    - id: action-2
      label: 看茶几上的 Switch
    - id: action-3
      label: 翻茶几储物里的工具箱
    - id: action-4
      label: 站到中间的防滑垫上
    - id: action-5
      label: 退回玄关
    - id: action-6
      label: 去厨房
    - id: action-7
      label: 进卧室
    - id: action-8
      label: 去阳台
choice_actions:
  action-1:
    kind: read
    paths:
      - world/zhonghe-old-street/unit-602/living-room/ultrawide-monitor.md
  action-2:
    kind: read
    paths:
      - world/zhonghe-old-street/unit-602/living-room/nintendo-switch.md
  action-3:
    kind: read
    paths:
      - world/zhonghe-old-street/unit-602/living-room/toolbox.md
  action-4:
    kind: read
    paths:
      - world/zhonghe-old-street/unit-602/living-room/vr-mat.md
  action-5:
    kind: enter
    target: world/zhonghe-old-street/unit-602
  action-6:
    kind: enter
    target: world/zhonghe-old-street/unit-602/kitchen
  action-7:
    kind: enter
    target: world/zhonghe-old-street/unit-602/bedroom
  action-8:
    kind: enter
    target: world/zhonghe-old-street/unit-602/balcony
---

客厅是这间屋子里最大的一块地方。地板是旧式的拼接木地板，扫得很干净，边角有几处被家具磨出来的浅痕。墙角拉出一条白色长插排，用透明胶带沿着踢脚线贴了一路。屋里没有电视，靠墙那台带鱼屏就是你的显示器。

靠墙的长条电脑桌上，机械键盘、鼠标、耳机支架排得整整齐齐。桌子正上方的墙上装着收纳架，手柄、耳机、VR 头显各占一格；左边贴着辐射核子可乐的海报，右边是荒野之息的重涂风格海报。桌子角落里站着一个二十厘米的刺客信条艾吉奥手办。桌下是高配主机，线缆被绑扎带束成几股，挤，但没打结。

对面的旧布艺沙发和矮茶几是另一套节奏。茶几上摊着没拆的快递、几罐常喝的饮料、几袋零食，一台 Switch 放在边上；旁边还压着几本小说和一台连着电源的轻薄本。茶几下面的储物层塞着一个基础医药箱和两个工具箱。沙发靠背上搭着一件格子衫外套。

茶几和电脑桌之间的空地上，铺着一张直径一米的黑色圆形防滑垫，中间画着十字。靠墙立着一台旧落地扇，插头插进踢脚线的插排上。这块地方是留给 VR 的。
