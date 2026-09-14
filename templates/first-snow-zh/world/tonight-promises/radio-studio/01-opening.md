---
type: chalk
title: 广播室 · 七海
choice:
  options:
    - id: action-1
      label: 告诉七海今晚和她在一起
    - id: action-2
      label: 问七海现在的心情
intent: 回应在现场交流的话语，并按世界 skill 中的「记录对话」更新约定与记忆。问题就当问题，约定就当约定，两者都不会自动确定结局。对澄的拜访和已有的约定也会保留。
choice_actions:
  action-1:
    kind: writer
  action-2:
    kind: character
    character: nanami
---

「刚才最后那首歌，如果我说是你为我选的，你会为难吗？」七海还望着播出指示灯。
