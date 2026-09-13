---
type: gate
name: 二〇二四年十二月三十一日 · 三十年後 · 常盤電器
title: 二〇二四年十二月三十一日 · 三十年後 · 常盤電器
bg: assets/scenes/future-original.webp
intent: 現状は shop-record.md に従う。干渉前に成年リョウや営業中の店を出さない。改変後は同じディレクトリの実在する結果を見せる。再訪で再生成しない。
choice:
  options:
    - id: action-1
      label: 店がなくなった理由を読む
    - id: action-2
      label: 時間の地図へ戻る
choice_actions:
  action-1:
    kind: read
    paths:
      - world/time-map/thirty-years-later/tokiwa-electronics/shop-record.md
  action-2:
    kind: enter
    target: world/time-map
---

年を取ったあなたが店の跡に立つ。隣の家と道は残り、常盤電器の敷地だけが空いている。少女を失った師匠は店を閉め、引き継ぐ人のいない建物は後に取り壊された。ここはまだ変えていない未来。
