---
type: chalk
title: 誰が気になる？ 次はどうする？
choice:
  options:
    - id: investigate-with-dice
      label: ダイスで手掛かりを見つける
    - id: action-1
      label: 気になる人物と根拠を話す
    - id: action-2
      label: 確かめる小さな計画を相談する
    - id: action-3
      label: 推理と作戦を読み返す
  allow_free: true
intent: 提出・確認・評価と言われたら、既存の player/deduction.md と player/operation-plan.md を読む。全文を書き直させず、この回合の現在地の Chalk 一枚に二文書の短い要約、具体的な懸念一つ、choice「この計画を実行する」「計画を直す」を出す。欠けたファイルだけ尋ねる。読むだけ・不足という本文だけで終えない。実行承諾済みなら確認を繰り返さず世界 skill の「提出後の応答と分岐」に従い、誤推理も短い結果場面へ進める。
choice_actions:
  action-1:
    kind: writer
  action-2:
    kind: writer
  action-3:
    kind: stage
    slots:
      - id: material-1
        title: 推論と根拠
        required: true
        paths:
          - player/deduction.md
      - id: material-2
        title: 安全な実行計画
        required: true
        paths:
          - player/operation-plan.md
  investigate-with-dice:
    kind: read
    paths:
      - world/london-map/04-investigation-dice.md
---

「ウェインが気になる。手のけがを聞きたい」のような一言で大丈夫です。ワトソンと作家が、試せる作戦に整理します。長い文章を二つ書く必要はありません。

迷ったらダイスでホームズに推理を任せられます。作戦を試す前には、何をするか確認できます。外れても短い結果と次の手掛かりが出ます。
