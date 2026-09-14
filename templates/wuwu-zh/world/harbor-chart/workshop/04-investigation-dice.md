---
type: chalk
title: 串起扣件的含义
roll_dice:
  type: 2d10
  desc: 串起扣件的含义
  expect: ">=11"
choice:
  options:
    - id: back
      label: 先不掷骰，返回地图
choice_actions:
  back:
    kind: enter
    target: world/harbor-chart
dice_outcomes:
  - min: 2
    max: 4
    text: 调查的动静传开了，失去了不被察觉地调查的机会。但线索还在。这是带有领主家族纹章的船舵零件。它不是无人船上的货物，而是用来追查与操舵有关的物主的线索。
    options:
      - id: read-clue
        label: 阅读线索
        action:
          kind: read
          paths:
            - world/harbor-chart/workshop/crest-clasp.md
      - id: back
        label: 返回地图
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/workshop/investigation-setback.md
        title: 疏漏与下一条线索
        body: 调查的动静传开了，失去了不被察觉地调查的机会。但线索还在。这是带有领主家族纹章的船舵零件。它不是无人船上的货物，而是用来追查与操舵有关的物主的线索。
  - min: 5
    max: 10
    text: 虽然没能马上联系起来，但找到了重新审视线索的方向。这是带有领主家族纹章的船舵零件。它不是无人船上的货物，而是用来追查与操舵有关的物主的线索。
    options:
      - id: read-clue
        label: 阅读线索
        action:
          kind: read
          paths:
            - world/harbor-chart/workshop/crest-clasp.md
      - id: back
        label: 返回地图
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/workshop/investigation-setback.md
        title: 疏漏与下一条线索
        body: 虽然没能马上联系起来，但找到了重新审视线索的方向。这是带有领主家族纹章的船舵零件。它不是无人船上的货物，而是用来追查与操舵有关的物主的线索。
  - min: 11
    max: 17
    text: 观察联系起来了。这是带有领主家族纹章的船舵零件。它不是无人船上的货物，而是用来追查与操舵有关的物主的线索。
    options:
      - id: read-clue
        label: 阅读线索
        action:
          kind: read
          paths:
            - world/harbor-chart/workshop/crest-clasp.md
      - id: back
        label: 返回地图
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/workshop/investigation-success.md
        title: 调查笔记
        body: 观察联系起来了。这是带有领主家族纹章的船舵零件。它不是无人船上的货物，而是用来追查与操舵有关的物主的线索。
  - min: 18
    max: 20
    text: 不只是核心，连下一步要确认的步骤也看清了。这是带有领主家族纹章的船舵零件。它不是无人船上的货物，而是用来追查与操舵有关的物主的线索。拿出原件来提问，就能把推测和证词分开确认。
    options:
      - id: read-clue
        label: 阅读线索
        action:
          kind: read
          paths:
            - world/harbor-chart/workshop/crest-clasp.md
      - id: back
        label: 返回地图
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/workshop/investigation-great-success.md
        title: 记下核心的笔记
        body: 不只是核心，连下一步要确认的步骤也看清了。这是带有领主家族纹章的船舵零件。它不是无人船上的货物，而是用来追查与操舵有关的物主的线索。拿出原件来提问，就能把推测和证词分开确认。
---

遇到困难时，可以用骰子把调查交给登场人物。想自己思考的话，不掷骰直接返回也没关系。

2d10：掷两颗十面骰，合计11以上为成功。代表调查时的疏漏或偶然的发现。
2–4（6%）：动静惊动了某人。失去暗中调查的机会，但线索还在。
5–10（39%）：没能马上解开，但知道下一步该查什么。不会失去物品。
11–17（49%）：成功。明白线索的含义和下一步该做什么。
18–20（6%）：大成功。另外还有对下一步调查有用的发现。

即使失败，这里也不会走进死路。同一次骰子不能重掷。看到结果后，可以选择接下来的行动。只有创建新地点时，才需要发送给作家。
