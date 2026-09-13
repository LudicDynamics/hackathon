---
type: chalk
title: 放送室 · 七海
choice:
  options:
    - id: action-1
      label: 今夜は七海と一緒にいると伝える
    - id: action-2
      label: 七海に今の気持ちを尋ねる
intent: 現地で交わした言葉に返事し、世界 skill の「対話を記録する」で約束と記憶を更新する。質問は質問、約束は約束として扱い、どちらも結末の自動確定にしない。澄への訪問や既存の約束も残す。
choice_actions:
  action-1:
    kind: writer
  action-2:
    kind: character
    character: nanami
---

「さっきの最後の曲、私のために選んだって言ったら、困る？」七海はまだ送信ランプを見ている。
