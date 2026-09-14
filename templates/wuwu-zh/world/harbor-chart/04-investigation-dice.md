---
type: chalk
title: 用骰子连起两道航迹
roll_dice:
  type: 2d10
  desc: 用骰子连起两道航迹
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
    text: 调查的动静传开了，失去了不被察觉地调查的机会。但线索还在。单凭无人船，解释不了擦痕和熄灯的时间。去追查另一艘船和海关一侧的通行。
    options:
      - id: play-result
        label: 从线索尝试另一条路
        action:
          kind: writer
          prompt: 阅读判定来源 world/harbor-chart/04-investigation-dice.md 的实际点数与正文。这是已获同意、代为解读的骰子路线。不要求写出两项证据或照明方法。保留落空的代价，在 world/harbor-chart/tidal-approach/ 生成一段追踪潮痕的简短场景，并可从那里继续发现新的道路。备齐 README、两件物品、带行动的 Chalk 和返回门，所需图片之后再生成一张。若正文已完成则不重新生成。
      - id: back
        label: 返回调查
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/investigation-setback.md
        title: 疏漏与下一条线索
        body: 调查的动静传开了，失去了不被察觉地调查的机会。但线索还在。单凭无人船，解释不了擦痕和熄灯的时间。去追查另一艘船和海关一侧的通行。
  - min: 5
    max: 10
    text: 虽然没能马上联系起来，但找到了重新审视线索的方向。单凭无人船，解释不了擦痕和熄灯的时间。去追查另一艘船和海关一侧的通行。
    options:
      - id: play-result
        label: 从线索尝试另一条路
        action:
          kind: writer
          prompt: 阅读判定来源 world/harbor-chart/04-investigation-dice.md 的实际点数与正文。这是已获同意、代为解读的骰子路线。不要求写出两项证据或照明方法。保留落空的代价，在 world/harbor-chart/tidal-approach/ 生成一段追踪潮痕的简短场景，并可从那里继续发现新的道路。备齐 README、两件物品、带行动的 Chalk 和返回门，所需图片之后再生成一张。若正文已完成则不重新生成。
      - id: back
        label: 返回调查
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/investigation-setback.md
        title: 疏漏与下一条线索
        body: 虽然没能马上联系起来，但找到了重新审视线索的方向。单凭无人船，解释不了擦痕和熄灯的时间。去追查另一艘船和海关一侧的通行。
  - min: 11
    max: 17
    text: 观察联系起来了。单凭无人船，解释不了擦痕和熄灯的时间。去追查另一艘船和海关一侧的通行。
    options:
      - id: play-result
        label: 沿着发现继续前进
        action:
          kind: writer
          prompt: 阅读判定来源 world/harbor-chart/04-investigation-dice.md 的实际点数与正文。这是已获同意、代为解读的骰子路线。不要求写出两项证据或照明方法。根据第二艘船的船影，在 world/harbor-chart/beyond-the-fog/ 生成第一条岸边小路。备齐 README、两件物品、带行动的 Chalk 和返回门，所需图片之后再生成一张。若正文已完成则不重新生成。
      - id: back
        label: 返回调查
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/investigation-success.md
        title: 调查笔记
        body: 观察联系起来了。单凭无人船，解释不了擦痕和熄灯的时间。去追查另一艘船和海关一侧的通行。
  - min: 18
    max: 20
    text: 不只是核心，连下一步要确认的步骤也看清了。单凭无人船，解释不了擦痕和熄灯的时间。去追查另一艘船和海关一侧的通行。下一个场景中，把这份余裕变成具体的额外观察机会。
    options:
      - id: play-result
        label: 沿着发现继续前进
        action:
          kind: writer
          prompt: 阅读判定来源 world/harbor-chart/04-investigation-dice.md 的实际点数与正文。这是已获同意、代为解读的骰子路线。不要求写出两项证据或照明方法。根据第二艘船的船影，在 world/harbor-chart/beyond-the-fog/ 生成第一条岸边小路。把大成功时发现的接应信号反映到下一个场景中。备齐 README、两件物品、带行动的 Chalk 和返回门，所需图片之后再生成一张。若正文已完成则不重新生成。
      - id: back
        label: 返回调查
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/investigation-great-success.md
        title: 记下核心的笔记
        body: 不只是核心，连下一步要确认的步骤也看清了。单凭无人船，解释不了擦痕和熄灯的时间。去追查另一艘船和海关一侧的通行。下一个场景中，把这份余裕变成具体的额外观察机会。
---

遇到困难时，可以用骰子把调查交给登场人物。想自己思考的话，不掷骰直接返回也没关系。

2d10：掷两颗十面骰，合计11以上为成功。代表调查时的疏漏或偶然的发现。
2–4（6%）：动静惊动了某人。失去暗中调查的机会，但线索还在。
5–10（39%）：没能马上解开，但知道下一步该查什么。不会失去物品。
11–17（49%）：成功。明白线索的含义和下一步该做什么。
18–20（6%）：大成功。另外还有对下一步调查有用的发现。

即使失败，这里也不会走进死路。同一次骰子不能重掷。看到结果后，可以选择接下来的行动。只有创建新地点时，才需要发送给作家。
