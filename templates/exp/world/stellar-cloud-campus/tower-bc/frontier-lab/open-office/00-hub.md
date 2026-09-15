---
type: chalk
title: 开放办公区
intent: 实验室的核心区域，整层没有实体墙隔断。靠门这侧是底层支持组三个人的工位，你的位子在最边缘、紧挨走廊；另一侧隔着低矮储物柜和大型移动白板，是核心算法组的十二个位子，墙上全是没擦的公式。你能看自己的工位、组长的位子、同事的位子，也能走到交界处的共享打印机和排障终端。出去就是走廊，两边是埃利亚斯的办公室、会议室和茶水间。
choice:
  options:
    - id: action-1
      label: 坐回自己的工位
    - id: action-2
      label: 走到区域交界处的共享打印机和排障终端
    - id: action-3
      label: 回到走廊
choice_actions:
  action-1:
    kind: read
    paths:
      - world/stellar-cloud-campus/tower-bc/frontier-lab/open-office/my-desk.md
  action-2:
    kind: read
    paths:
      - world/stellar-cloud-campus/tower-bc/frontier-lab/open-office/ticket-queue.md
  action-3:
    kind: enter
    target: world/stellar-cloud-campus/tower-bc/frontier-lab
---

进门右手边就是你们的工位区。整层没有实体墙，靠走廊这一侧摆着底层支持组的三个位子，你在最外面，紧挨走廊，谁进来谁出去你先看见。矩阵式升降桌，黑色西昊椅，两台 27 寸戴尔显示器并排拼在一起，Thinkpad 架在左边支架上接着电源。桌面很干净，键盘鼠标周边用湿巾擦过，没有灰。

屏幕上常年驻着三样东西：云端算力监控面板、星轨排障工单界面、堡垒机登录窗口。你在右侧显示器边框贴了张黄色便利贴，写着新网段的内部 DNS 和几行测试 IP；黑色硬面笔记本翻开在第一页，两行交接事项。键盘右上方是不锈钢保温杯，杯身磕掉了几块漆。

组长的位子和同事的位子在你旁边，三个人挨成一片。穿过中间那排低矮储物柜和一大块移动白板，另一侧就是核心算法组的十二个位子：MacBook 配一台高阶外接显示器，桌上有手冲器具、降噪耳机和客制化机械键盘，承重墙和移动白板上写满没擦干净的公式推导。两边各干各的，中间只隔一层柜子和一块白板。

你现在可以坐回自己的位子，也可以走到两组交界处那台共享打印机和排障终端跟前。走廊在右边，尽头是埃利亚斯的办公室，对面是会议室，角落里是茶水间。
