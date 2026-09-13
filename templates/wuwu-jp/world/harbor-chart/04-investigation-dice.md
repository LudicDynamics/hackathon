---
type: chalk
title: 骰子で二つの航跡をつなぐ
roll_dice:
  type: 2d10
  desc: 骰子で二つの航跡をつなぐ
  expect: ">=11"
choice:
  options:
    - id: back
      label: 今は振らずに地図へ戻る
choice_actions:
  back:
    kind: enter
    target: world/harbor-chart
dice_outcomes:
  - min: 2
    max: 4
    text: 調査の物音が響き、気付かれずに調べる機会を失った。まだ糸口はある。無人船だけでは擦り跡と消灯の時間を説明しきれない。もう一隻と税関側の通行を追う。
    options:
      - id: play-result
        label: 手掛かりから別の道を試す
        action:
          kind: writer
          prompt: 判定元 world/harbor-chart/04-investigation-dice.md の実際の出目と本文を読む。これは解読を代行する承諾済みの骰子ルート。証拠二点や照らす方法の作文は要求しない。空振りの代価を残して world/harbor-chart/tidal-approach/ に潮痕を追う短い場面を生成する。そこから新しい道の発見を続けられる。 README・物二つ・行動付きChalk・戻り門を揃え、必要な画像は後で一枚。本文済みなら再生成しない。
      - id: back
        label: 調査へ戻る
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/investigation-setback.md
        title: 見落としと次の手掛かり
        body: 調査の物音が響き、気付かれずに調べる機会を失った。まだ糸口はある。無人船だけでは擦り跡と消灯の時間を説明しきれない。もう一隻と税関側の通行を追う。
  - min: 5
    max: 10
    text: すぐには結び付かなかったが、手掛かりを見直す方向はつかめた。無人船だけでは擦り跡と消灯の時間を説明しきれない。もう一隻と税関側の通行を追う。
    options:
      - id: play-result
        label: 手掛かりから別の道を試す
        action:
          kind: writer
          prompt: 判定元 world/harbor-chart/04-investigation-dice.md の実際の出目と本文を読む。これは解読を代行する承諾済みの骰子ルート。証拠二点や照らす方法の作文は要求しない。空振りの代価を残して world/harbor-chart/tidal-approach/ に潮痕を追う短い場面を生成する。そこから新しい道の発見を続けられる。 README・物二つ・行動付きChalk・戻り門を揃え、必要な画像は後で一枚。本文済みなら再生成しない。
      - id: back
        label: 調査へ戻る
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/investigation-setback.md
        title: 見落としと次の手掛かり
        body: すぐには結び付かなかったが、手掛かりを見直す方向はつかめた。無人船だけでは擦り跡と消灯の時間を説明しきれない。もう一隻と税関側の通行を追う。
  - min: 11
    max: 17
    text: 観察がつながった。無人船だけでは擦り跡と消灯の時間を説明しきれない。もう一隻と税関側の通行を追う。
    options:
      - id: play-result
        label: 発見の先へ進む
        action:
          kind: writer
          prompt: 判定元 world/harbor-chart/04-investigation-dice.md の実際の出目と本文を読む。これは解読を代行する承諾済みの骰子ルート。証拠二点や照らす方法の作文は要求しない。二隻目の船影から world/harbor-chart/beyond-the-fog/ に最初の岸道を生成する。 README・物二つ・行動付きChalk・戻り門を揃え、必要な画像は後で一枚。本文済みなら再生成しない。
      - id: back
        label: 調査へ戻る
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/investigation-success.md
        title: 調査の覚え書き
        body: 観察がつながった。無人船だけでは擦り跡と消灯の時間を説明しきれない。もう一隻と税関側の通行を追う。
  - min: 18
    max: 20
    text: 核心だけでなく、次に確かめる手順まで見えた。無人船だけでは擦り跡と消灯の時間を説明しきれない。もう一隻と税関側の通行を追う。 次の場面では、この余裕を具体的な追加の観察機会にする。
    options:
      - id: play-result
        label: 発見の先へ進む
        action:
          kind: writer
          prompt: 判定元 world/harbor-chart/04-investigation-dice.md の実際の出目と本文を読む。これは解読を代行する承諾済みの骰子ルート。証拠二点や照らす方法の作文は要求しない。二隻目の船影から world/harbor-chart/beyond-the-fog/ に最初の岸道を生成する。大成功で見つけた接応の合図を次の場面に反映する。 README・物二つ・行動付きChalk・戻り門を揃え、必要な画像は後で一枚。本文済みなら再生成しない。
      - id: back
        label: 調査へ戻る
        action:
          kind: enter
          target: world/harbor-chart
    rewards:
      - path: world/harbor-chart/investigation-great-success.md
        title: 核心を記した覚え書き
        body: 核心だけでなく、次に確かめる手順まで見えた。無人船だけでは擦り跡と消灯の時間を説明しきれない。もう一隻と税関側の通行を追う。 次の場面では、この余裕を具体的な追加の観察機会にする。
---

難しい時は、ダイスで登場人物に調査を任せられます。自分で考えたい時は、振らずに戻っても大丈夫です。

2d10：十面ダイスを二つ振ります。合計11以上で成功です。調べる時の見落としや、偶然の発見を表します。
2–4（6%）：物音で誰かに気づかれます。こっそり調べる機会を失いますが、手掛かりは残ります。
5–10（39%）：すぐには解けません。次に何を調べればよいか分かります。物は失いません。
11–17（49%）：成功。手掛かりの意味と、次にすることが分かります。
18–20（6%）：大成功。さらに、次の調査に役立つ発見があります。

失敗しても、ここで行き止まりにはなりません。同じダイスの振り直しはできません。結果を見てから、続きを選べます。新しい場所を作る時だけ、作家への送信が必要です。
