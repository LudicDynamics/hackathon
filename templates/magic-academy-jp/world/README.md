---
type: readme
name: 夜の図書館 · 初めての魔法
title: 夜の図書館 · 初めての魔法
intent: 受領なら名札を player/ へ move。失敗の話は具体例を一つ返すが、未確認の代価をプレイヤーに課さない。
choice:
  options:
    - id: action-1
      label: 名札を受け取る
    - id: action-2
      label: セラフィナに失敗した魔法を尋ねる
choice_actions:
  action-1:
    kind: take
    paths:
      - world/freshman-badge.md
  action-2:
    kind: character
    character: seraphina
bg: assets/scenes/academy-library.webp
---

あなたは魔法学院の新入生。先輩のセラフィナが、最初の課題を教えてくれます。

「身近な物を組み合わせて、自分の魔法を作ってみて。何をしたいか、何を使うか、代わりに何を差し出せるかを教えてね」。

まず名札を受け取り、魔法の材料がある場所へ進みましょう。使える物を見てから決めて大丈夫です。
