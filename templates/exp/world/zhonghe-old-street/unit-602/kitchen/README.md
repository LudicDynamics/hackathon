---
type: readme
name: 厨房
bg: assets/scenes/zhonghe-old-street-unit-602-kitchen.jpg
ambient: city-night
title: 厨房
intent: 602 的厨房，在客厅侧面，没有门，直接连通。墙面高处一扇铝合金小窗贴着防油烟贴纸。单开门冰箱和储物柜靠里，老式双头燃气灶、抽油烟机、迷你空气炸锅和二手电饭煲占着烹饪区，大理石台面上是备餐的地方，墙上挂着几口常用的锅。往回到客厅。
choice:
  options:
    - id: action-1
      label: 拉开冰箱门
    - id: action-2
      label: 看调料架
    - id: action-3
      label: 拿起墙上的炒锅
    - id: action-4
      label: 按下电饭煲
    - id: action-5
      label: 回客厅
choice_actions:
  action-1:
    kind: read
    paths:
      - world/zhonghe-old-street/unit-602/kitchen/rice-cooker.md
  action-2:
    kind: read
    paths:
      - world/zhonghe-old-street/unit-602/kitchen/condiment-rack.md
  action-3:
    kind: read
    paths:
      - world/zhonghe-old-street/unit-602/kitchen/wok.md
  action-4:
    kind: read
    paths:
      - world/zhonghe-old-street/unit-602/kitchen/air-fryer.md
  action-5:
    kind: enter
    target: world/zhonghe-old-street/unit-602
---

厨房不大，是贴着客厅侧面隔出来的一间，连门都没有，站在灶台前能听见客厅里主机风扇的声音。高处有一扇铝合金小窗，玻璃上贴着防油烟贴纸，透进来的光有点发黄。

靠里的储物区，一台单开门冰箱站在墙边，门板上吸着一把砍骨剪刀，还贴了几张手写的食材消耗清单。冰箱侧面用小挂钩挂着防烫手套和一条黑色帆布围裙。旁边的储物柜里，三套备用陶瓷餐具、几个玻璃保鲜盒、十个叠好的塑料分装盒码得整整齐齐，下层收着高压锅和瓦煲，角落里几个玻璃罐装着散装香料和杂粮。

烹饪区是一台老式双头燃气灶加抽油烟机，台面擦得很干净，没有黏腻的油污。灶边挤着一个迷你空气炸锅和一台二手电饭煲，都是省事的家伙。调料架上酱油、陈醋、郫县豆瓣酱和玻璃罐装的干辣椒段挤成一排。

备餐区的大理石台面是最宽敞的一块，墙上的连排挂钩挂着 28cm 炒锅、平底不粘煎锅、雪平锅和汤锅，锅底留着长期用的火烧痕迹。台面下方的米桶里放着一个量杯。清洗区靠着不锈钢水槽和沥水架，边上立着一瓶 1L 装的洗洁精，沥水架上倒扣着刚洗净的碗盘。
