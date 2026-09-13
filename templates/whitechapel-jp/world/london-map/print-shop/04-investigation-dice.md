---
type: chalk
title: 原稿の流れをつかむ
roll_dice:
  type: 2d10
  desc: 原稿の流れをつかむ
  expect: ">=11"
choice:
  options:
    - id: back
      label: 今は振らずに地図へ戻る
choice_actions:
  back:
    kind: enter
    target: world/london-map
dice_outcomes:
  - min: 2
    max: 4
    text: 調査の物音が響き、気付かれずに調べる機会を失った。まだ糸口はある。原稿は編集者から画家へ渡り、絵は事件前に納品された。作品を先に知る人物と、事件後に知る人物を区別できる。
    options:
      - id: read-clue
        label: 手掛かりを読む
        action:
          kind: read
          paths: &a1
            - world/london-map/print-shop/receipt.md
      - id: back
        label: 地図へ戻る
        action:
          kind: enter
          target: world/london-map
    rewards:
      - path: world/london-map/print-shop/investigation-setback.md
        title: 見落としと次の手掛かり
        body: 調査の物音が響き、気付かれずに調べる機会を失った。まだ糸口はある。原稿は編集者から画家へ渡り、絵は事件前に納品された。作品を先に知る人物と、事件後に知る人物を区別できる。
  - min: 5
    max: 10
    text: すぐには結び付かなかったが、手掛かりを見直す方向はつかめた。原稿は編集者から画家へ渡り、絵は事件前に納品された。作品を先に知る人物と、事件後に知る人物を区別できる。
    options:
      - id: read-clue
        label: 手掛かりを読む
        action:
          kind: read
          paths: *a1
      - id: back
        label: 地図へ戻る
        action:
          kind: enter
          target: world/london-map
    rewards:
      - path: world/london-map/print-shop/investigation-setback.md
        title: 見落としと次の手掛かり
        body: すぐには結び付かなかったが、手掛かりを見直す方向はつかめた。原稿は編集者から画家へ渡り、絵は事件前に納品された。作品を先に知る人物と、事件後に知る人物を区別できる。
  - min: 11
    max: 17
    text: 観察がつながった。原稿は編集者から画家へ渡り、絵は事件前に納品された。作品を先に知る人物と、事件後に知る人物を区別できる。
    options:
      - id: read-clue
        label: 手掛かりを読む
        action:
          kind: read
          paths: *a1
      - id: back
        label: 地図へ戻る
        action:
          kind: enter
          target: world/london-map
    rewards:
      - path: world/london-map/print-shop/investigation-success.md
        title: 調査の覚え書き
        body: 観察がつながった。原稿は編集者から画家へ渡り、絵は事件前に納品された。作品を先に知る人物と、事件後に知る人物を区別できる。
  - min: 18
    max: 20
    text: 核心だけでなく、次に確かめる手順まで見えた。原稿は編集者から画家へ渡り、絵は事件前に納品された。作品を先に知る人物と、事件後に知る人物を区別できる。 原本を示して質問すれば、推測と証言を分けて確かめられる。
    options:
      - id: read-clue
        label: 手掛かりを読む
        action:
          kind: read
          paths: *a1
      - id: back
        label: 地図へ戻る
        action:
          kind: enter
          target: world/london-map
    rewards:
      - path: world/london-map/print-shop/investigation-great-success.md
        title: 核心を記した覚え書き
        body: 核心だけでなく、次に確かめる手順まで見えた。原稿は編集者から画家へ渡り、絵は事件前に納品された。作品を先に知る人物と、事件後に知る人物を区別できる。 原本を示して質問すれば、推測と証言を分けて確かめられる。
---

難しい時は、ダイスで登場人物に調査を任せられます。自分で考えたい時は、振らずに戻っても大丈夫です。

2d10：十面ダイスを二つ振ります。合計11以上で成功です。調べる時の見落としや、偶然の発見を表します。
2–4（6%）：物音で誰かに気づかれます。こっそり調べる機会を失いますが、手掛かりは残ります。
5–10（39%）：すぐには解けません。次に何を調べればよいか分かります。物は失いません。
11–17（49%）：成功。手掛かりの意味と、次にすることが分かります。
18–20（6%）：大成功。さらに、次の調査に役立つ発見があります。

失敗しても、ここで行き止まりにはなりません。同じダイスの振り直しはできません。結果を見てから、続きを選べます。新しい場所を作る時だけ、作家への送信が必要です。
