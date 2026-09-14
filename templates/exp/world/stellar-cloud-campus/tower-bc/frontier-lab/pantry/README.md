---
type: readme
name: 茶水间
ambient: office-night
title: 茶水间
intent: 实验室角落、洗手间隔壁的一小间。行政配的饮水区在这头，核心组自费的高端意式咖啡机在另一头，各自占地。两台微波炉、双开门冰箱、零食架和三把高脚凳。你热饭、接水、撕一包速溶，都在这儿。出门口就是洗手间，再往前是走廊。
choice:
  options:
    - id: action-1
      label: 打开冰箱看看
    - id: action-2
      label: 热一份午饭
    - id: action-3
      label: 看一眼墙上的留言板和药箱
    - id: action-4
      label: 回到走廊
choice_actions:
  action-1:
    kind: read
    paths:
      - world/stellar-cloud-campus/tower-bc/frontier-lab/pantry/fridge.md
  action-2:
    kind: read
    paths:
      - world/stellar-cloud-campus/tower-bc/frontier-lab/pantry/microwave.md
  action-3:
    kind: read
    paths:
      - world/stellar-cloud-campus/tower-bc/frontier-lab/pantry/corkboard.md
  action-4:
    kind: enter
    target: world/stellar-cloud-campus/tower-bc/frontier-lab
---

茶水间在实验室的角落，紧挨着洗手间。进门先是靠墙的一整条大理石吧台：商用直饮水机提供冰水、常温和开水，旁边一个大号亚克力盒，装免费的红茶包、速溶咖啡条和白糖包。再往另一头走，吧台近三分之一的位置被核心组自费的东西占着——一台 Breville 旗舰半自动意式咖啡机、一台 Niche Zero 磨豆机，旁边几罐深烘豆、布粉器、压粉锤，还有一个专门敲粉饼的不锈钢渣桶。核心组很少碰行政配的胶囊机。

加热和冷藏区在里侧：两台商用微波炉并排架在双层不锈钢架上，下面一台双开门大冰箱，门板上贴着物业打印的 A4 纸。再过去是不锈钢单槽水盆、按压式洗手液和洗洁精、沥水架和擦手纸盒——沥水架上倒扣着几个洗干净的马克杯。落地零食架上是行政定期补的饼干和小面包，旁边一张独立吧台桌配三把高脚凳。墙上挂着亚克力小药箱和一块软木留言板。

这里常年有现磨咖啡豆的焦苦味和醇香。中午饭点会混进微波炉加热饭菜的气味，很快被新风抽走。背景音一直是直饮水机制冷的低频嗡嗡声，偶尔插进意式机打奶泡的尖锐蒸汽声和敲粉饼的沉闷砰砰声。
