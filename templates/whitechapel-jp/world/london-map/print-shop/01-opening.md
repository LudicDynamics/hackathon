---
type: chalk
title: 印刷所 · トムに聞こう
choice:
  options:
    - id: investigate-with-dice
      label: ダイスで手掛かりを見つける
    - id: action-1
      label: トムに原稿と挿絵の順番を聞く
    - id: action-2
      label: 受領票と当直帳を読む
  allow_free: true
intent: receipt.md と shift-ledger.md を示す。トムは記録した受渡しと自分の勤務だけ知る。編集者は editor-office、画家は illustration-room に実在する。会話がまだなら既に証言を得たことにしない。
choice_actions:
  action-1:
    kind: character
    character: tom
  action-2:
    kind: read
    paths:
      - world/london-map/print-shop/receipt.md
      - world/london-map/print-shop/shift-ledger.md
  investigate-with-dice:
    kind: read
    paths:
      - world/london-map/print-shop/04-investigation-dice.md
---

印刷工のトムが、仕事の記録を見せてくれます。ここでは「誰が原稿を読んだか」「絵がいつ届いたか」を調べられます。

まず記録を読むか、トムに聞いてみましょう。奥の編集室にはブラックバーン、画室にはウェインがいます。
