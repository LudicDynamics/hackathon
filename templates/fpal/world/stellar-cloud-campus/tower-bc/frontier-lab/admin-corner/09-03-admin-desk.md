---
type: chalk
title: 行政角 · 她的桌子
choice:
  options:
    - id: action-1
      label: 看她桌上那本硬皮笔记
    - id: action-2
      label: 看那摞等着流转的单子
    - id: action-3
      label: 问明月几个问题
    - id: action-4
      label: 回走廊
choice_actions:
  action-1:
    kind: read
    paths:
      - world/stellar-cloud-campus/tower-bc/frontier-lab/admin-corner/notebook.md
  action-2:
    kind: read
    paths:
      - world/stellar-cloud-campus/tower-bc/frontier-lab/admin-corner/ticket-triage.md
  action-3:
    kind: character
    character: mingyue
  action-4:
    kind: enter
    target: world/stellar-cloud-campus/tower-bc/frontier-lab
---

她抬头看了你一眼，手底下没停：「等会儿，这张单子先流转出去。」

然后她把手往桌上一摊：「随便看。我这儿没秘密——秘密都记在脑子里。」
