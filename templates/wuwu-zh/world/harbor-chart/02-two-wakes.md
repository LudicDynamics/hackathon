---
type: chalk
title: 寻找另一艘船
choice:
  options:
    - id: investigate-with-dice
      label: 用骰子寻找线索
    - id: action-1
      label: 摆出收集到的材料
    - id: action-2
      label: 还要再调查
  allow_free: true
intent: 阅读提交来源的实物与内容。审查两项独立的观察与执行方法；若不足，返回理由和下一个调查地点。若妥当，只制作费用与判定预告。不自动掷骰。
choice_actions:
  action-1:
    kind: stage
    slots:
      - id: material-1
        title: 吃水线记录
        required: false
        paths:
          - world/harbor-chart/seventh-berth/waterline-trace.md
      - id: material-2
        title: 扣件的证据
        required: false
        paths:
          - world/harbor-chart/workshop/crest-clasp.md
      - id: material-3
        title: 灯塔日志
        required: false
        paths:
          - world/harbor-chart/old-lighthouse/lighthouse-logbook.md
  action-2:
    kind: enter
    target: world/harbor-chart
  investigate-with-dice:
    kind: read
    paths:
      - world/harbor-chart/04-investigation-dice.md
---

船上的伤痕，和灯塔熄灭的时间。把两者合起来看，雾中可能还有另一艘船。

想自己思考的话，可以摆出材料来商量。太难的话，就用骰子交给调查员吧。两条路都能继续前进。只有调查新地点时，才需要发送给作家。
