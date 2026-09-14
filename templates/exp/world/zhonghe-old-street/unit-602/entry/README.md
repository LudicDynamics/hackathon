---
type: readme
name: 玄关与门后空间
bg: assets/scenes/zhonghe-old-street-unit-602-entry.jpg
ambient: city-night
title: 玄关与门后空间
intent: 602 的入户玄关，进门第一小块地方。老式防盗门的锁孔磨得发亮，简易鞋架和带抽屉的半高鞋柜挤在墙边，门后挂着购物袋、尼龙胸包和一把备用黑伞。鞋柜桌面上是你随手丢下的钥匙和工作牌。往里有客厅，也能直接下楼。
choice:
  options:
    - id: action-1
      label: 拉开鞋柜抽屉
    - id: action-2
      label: 看门后挂着的伞和包
    - id: action-3
      label: 走进客厅
    - id: action-4
      label: 下楼
choice_actions:
  action-1:
    kind: read
    paths:
      - world/zhonghe-old-street/unit-602/entry/utility-bills.md
  action-2:
    kind: read
    paths:
      - world/zhonghe-old-street/unit-602/entry/black-umbrella.md
  action-3:
    kind: enter
    target: world/zhonghe-old-street/unit-602
  action-4:
    kind: enter
    target: world/zhonghe-old-street
---

进门是一小块玄关，转个身都嫌挤。防盗门是老式的，锁舌要用力顶一下才咬得住，锁孔被磨得发亮。简易鞋架上摆着几双常穿的鞋，旁边挤着一个带抽屉的半高鞋柜。

门后挂着一只大型购物袋、一个尼龙胸包，还有一把黑色的备用雨伞。伞骨收得很紧，伞尖积了点灰——好好收着的那把，通常是不希望用上的那把。

鞋柜的桌面就是你的随手置物台：钥匙、工牌，进门一放，出门再摸。抽屉里塞着折叠的超市传单、攒下来的外卖小票，还有一叠水电费收据，都是"等有空再理"的东西。

往里一步是客厅。要出门就从这里下楼。
