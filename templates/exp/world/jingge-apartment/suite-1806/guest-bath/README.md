---
type: readme
name: 1806 · 客用卫浴间
bg: assets/scenes/jingge-apartment-suite-1806-guest-bath.jpg
ambient: rain
title: 1806 · 客用卫浴间
intent: 走廊左侧的客卫，干湿分离。智能感应马桶、单台盆大理石洗漱台与防雾镜、基础全玻璃淋浴房。这里几乎没有私人痕迹——洗漱台上是酒店标配、未拆封的洗漱包，毛巾是保洁叠出的折痕，没有任何电动牙刷、剃须刀或护肤品。能看洗漱包、看毛巾架，也能回走廊。
choice:
  options:
    - id: action-1
      label: 看洗漱台上的酒店洗漱包
    - id: action-2
      label: 看毛巾架上叠好的毛巾
    - id: action-3
      label: 回走廊
    - id: action-4
      label: 回 1806 门厅
choice_actions:
  action-1:
    kind: read
    paths:
      - world/jingge-apartment/suite-1806/guest-bath/amenity-kit.md
  action-2:
    kind: read
    paths:
      - world/jingge-apartment/suite-1806/guest-bath/folded-towels.md
  action-3:
    kind: enter
    target: world/jingge-apartment/suite-1806
  action-4:
    kind: enter
    target: world/jingge-apartment/suite-1806/living-room
---

客卫在走廊的左侧，门推开，里面是一个标准到没有多余东西的干湿分离空间。地面和墙都是浅色石材，灯光是中性白。

单台盆的大理石洗漱台对着防雾镜，台面上一只酒店标配的洗漱包，旁边一个没拆封的牙具盒。镜子里映不出任何私人的物件。淋浴房是全玻璃的，壁龛里的旅行装洗发水和沐浴露还是出厂状态。马桶是智能感应式的，盖板合着。

毛巾架上挂着浴巾和毛巾，保留着保洁叠出来的折痕，边角方方正正。整个空间只有中央新风的微弱循环声，别的什么都没有。

这里空得不像有人住——它像是给客人准备的，而客人还没来，或者根本没来过。
