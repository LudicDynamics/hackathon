---
type: readme
name: 星汇天地
ambient: cafe-murmur
title: 星汇天地
intent: 商圈总览层。园区正南侧一街之隔的大型综合商圈，含多层室内购物中心、室外步行街、下沉广场、地下车库。你下班早的时候会来这边吃个饭、买点东西。B1 是生鲜超市和美食广场，1-2 层快时尚和数码旗舰店，5-6 层有院线和健身房。
choice:
  options:
    - id: action-1
      label: 逛室外步行街和下沉广场
    - id: action-2
      label: 进购物中心，下 B1
    - id: action-3
      label: 回高新南区街上
choice_actions:
  action-1:
    kind: enter
    target: world/xinghui-plaza/outdoor-street
  action-2:
    kind: enter
    target: world/xinghui-plaza/mall-b1
  action-3:
    kind: enter
    target: map
---

从园区出来往南走，过一条街就是星汇天地。商场很大，玻璃幕墙和园区那边不是一种冷——这边亮着暖色灯，人声也密。

室外步行街在购物中心外围，两边是双层餐饮门店和咖啡馆外摆，新能源车展厅里停着两台车，灯打得雪亮。走到中段，地面下沉，是一小块阶梯式的露天广场，中间有小喷泉。

商场里空调很足。你不赶时间的时候，喜欢在 B1 超市慢慢逛，或者直接上个美食广场随便吃点。
