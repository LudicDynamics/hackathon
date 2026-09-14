---
type: readme
name: 距广播结束还有九十秒
title: 距广播结束还有九十秒
bg: assets/scenes/intro.webp
intent: 若拿走，就把点歌单实物移到 player/。若回复七海，就记住那句话，但暂时不让今晚的赴约或告白成立。
choice:
  options:
    - id: action-1
      label: 拿起单子来读
    - id: action-2
      label: 回复七海「我听得到」
bgVideo: assets/motion/seedance/backgrounds/intro.webm
choice_actions:
  action-1:
    kind: take
    paths:
      - world/request-slip.md
  action-2:
    kind: writer
---

你是学生导播。七海的声音从广播用的声音，变成了只对你一个人说话的声音。

「最后一首歌，我还没定。……今晚，待会儿你有空吗？」

桌上的单子里，有雪村澄的邀约，还有七海差点擦掉的一行字。
