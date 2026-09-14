---
type: chalk
title: 初雪 · 今夜的最后一幕
choice:
  options:
    - id: action-1
      label: 结束今夜
    - id: action-2
      label: 还有话想说
intent: 这里是决断之夜。没有进入条件。仅仅进入不会写结局。只有在发送「结束今夜」时，才按照世界 skill 的「决断之夜」，确认背包里的信物与实际的 RP，由作家判断结局。不要用选择角色的按钮来指定结局。
choice_actions:
  action-1:
    kind: writer
  action-2:
    kind: enter
    target: world/tonight-promises
---

在这里，可以为今夜的故事收尾。你对谁说了什么、许下了怎样的约定，都会改变最后一幕。

选择「结束今夜」，发送给作家。如果还有想说话的人，可以回去。就算是谁都没见的夜晚，也有属于那个夜晚的结局。
