---
type: gate
name: 琥珀カフェ · 雪村澄
title: 琥珀カフェ · 雪村澄
bg: assets/scenes/amber-cafe.webp
intent: 現地で交わした言葉に返事し、世界 skill の「対話を記録する」で約束と記憶を更新する。質問は質問、約束は約束として扱い、どちらも結末の自動確定にしない。七海への訪問や既存の約束も残す。
choice:
  options:
    - id: action-1
      label: 今夜は澄と一緒にいると伝える
    - id: action-2
      label: 澄が話したかったことを尋ねる
bgVideo: assets/motion/seedance/backgrounds/cafe.webm
choice_actions:
  action-1:
    kind: writer
  action-2:
    kind: character
    character: sumi-yukimura
---

澄は仕事用の電話を伏せた。「ここでは、歌手の私じゃなくてもいい？」向かいの椅子は、まだ引かれていない。
