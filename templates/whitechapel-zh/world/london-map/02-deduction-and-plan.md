---
type: chalk
title: 你在意谁？接下来怎么做？
choice:
  options:
    - id: investigate-with-dice
      label: 用骰子寻找线索
    - id: action-1
      label: 说出在意的人和理由
    - id: action-2
      label: 商量一个用来核实的小计划
    - id: action-3
      label: 重读推理和作战计划
  allow_free: true
intent: 当玩家说提交、确认或评估时，读取现有的 player/deduction.md 和 player/operation-plan.md。不要让玩家重写全文；在本回合当前位置的那一张 Chalk 上给出两份文件的简短摘要、一个具体的顾虑，以及选项“执行这个计划”“修改计划”。只询问缺少的文件。不要只读取、或只写一段“内容不足”就结束。如果已同意执行，就不再重复确认，按照世界 skill 的“提交后的回应与分支”处理，推理有误也推进到简短的结果场景。
choice_actions:
  action-1:
    kind: writer
  action-2:
    kind: writer
  action-3:
    kind: stage
    slots:
      - id: material-1
        title: 推理与依据
        required: true
        paths:
          - player/deduction.md
      - id: material-2
        title: 安全的执行计划
        required: true
        paths:
          - player/operation-plan.md
  investigate-with-dice:
    kind: read
    paths:
      - world/london-map/04-investigation-dice.md
---

像“我在意韦恩，想问问他手上的伤”这样一句话就够了。华生和作家会把它整理成可以尝试的作战。不需要写两篇长文。

拿不定主意时，可以用骰子让福尔摩斯推理。尝试作战之前，可以先确认要做什么。即使猜错，也会得到简短的结果和下一条线索。
