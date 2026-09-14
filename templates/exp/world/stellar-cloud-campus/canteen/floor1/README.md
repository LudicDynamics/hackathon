---
type: readme
name: 星味楼 1 层 · 快速就餐大平层
bg: assets/scenes/stellar-cloud-campus-canteen-floor1.jpg
ambient: tavern-chatter
title: 星味楼 1 层 · 快速就餐大平层
intent: 星味楼一层，整个食堂最快的一层。大排档套餐窗口、自选称重菜、炒面盖饭排成一排，水吧和烘焙房在最里侧，中间是自助调料台。刷工牌或刷脸结账，出口有免费打包盒。每层都有餐具回收传送带。往上是二层，或回食堂总览。
choice:
  options:
    - id: action-1
      label: 去自选称重台
    - id: action-2
      label: 看炒面盖饭窗口
    - id: action-3
      label: 舀一勺调料台的折耳根碎
    - id: action-4
      label: 上二层
    - id: action-5
      label: 回食堂总览
choice_actions:
  action-1:
    kind: read
    paths:
      - world/stellar-cloud-campus/canteen/floor1/weigh-station.md
  action-2:
    kind: read
    paths:
      - world/stellar-cloud-campus/canteen/floor1/noodle-window.md
  action-3:
    kind: read
    paths:
      - world/stellar-cloud-campus/canteen/floor1/condiment-bar.md
  action-4:
    kind: enter
    target: world/stellar-cloud-campus/canteen/floor2
  action-5:
    kind: enter
    target: world/stellar-cloud-campus/canteen
---

一层是整个星味楼最快的一层。推门进去就是一整片大平层，桌椅排得密，饭点的时候盘子碰撞声几乎没有断过。窗口在里侧排成一长列：最左边是大排档套餐，中间是自选称重菜，右边是炒面盖饭。想快的人直奔左边，端着托盘找位置坐下，十分钟解决。

靠里侧是水吧和烘焙房，饭后一杯饮料或者一块面包，顺手就拿。取餐动线上摆着一张自助调料台，辣椒油、陈醋，还有一盆切得碎碎的折耳根——阳都人的口味，一勺下去这一餐才算齐。

出口立着几摞免费的打包盒，赶时间的话装走也行。靠墙那条自动传送带是餐具回收口，筷勺、纸巾、厨余分三个槽，员工自己分类放上去。
