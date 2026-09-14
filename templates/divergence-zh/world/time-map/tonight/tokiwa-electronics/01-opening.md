---
type: chalk
title: 1995年的今夜 · 用传真通知
choice:
  options:
    - id: action-1
      label: 写下要发送的内容
    - id: action-2
      label: 确认准备好的传真
intent: 用 read 读取当前位置 README 的 intent。如果没有 player/fax-draft.md，立刻用一个 Chalk 提供“输入要发送的内容”“商量着拟草稿”两个选项。不要把名为“确认”的选项或原来的信当作发送正文。收到正文后保存草稿，在一个 Chalk 上显示收件方、日期时间、全文和字数，并提供“发送这一页”“重写”。仅确认、阅读或使用道具都不会发送。详细步骤见世界 skill。
choice_actions:
  action-1:
    kind: writer
  action-2:
    kind: stage
    slots:
      - id: material-1
        title: 发送前的传真草稿
        required: true
        paths:
          - player/fax-draft.md
---

凉今天早上在来取青蛙的路上出了事故。眼前的传真机，可以把消息发到同一天上午8点的这家店——那时离她出门还有三十分钟。

要告诉店里什么，她才能不走那条危险的路？先用“写下要发送的内容”拟一份草稿吧。在你确认内容、决定发送之前，不会发出。
