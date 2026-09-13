---
type: chalk
title: 1995年の今夜 · FAXで知らせる
choice:
  options:
    - id: action-1
      label: 送る文章を書く
    - id: action-2
      label: 用意したＦＡＸを確認する
intent: 現在地 README の intent を read で読む。player/fax-draft.md がなければ即座に一枚の Chalk で「送る文章を入力する」「相談して草稿を作る」を提示する。確認という選択名や元の手紙を送信本文と見なさない。本文を受けたら草稿を保存し、宛先・日時・全文・字数を一枚の Chalk に表示、「この一枚を送る」「書き直す」を提示。確認・読む・道具を使うだけでは送らない。詳しい手順は世界 skill。
choice_actions:
  action-1:
    kind: writer
  action-2:
    kind: stage
    slots:
      - id: material-1
        title: 送信前のＦＡＸ草稿
        required: true
        paths:
          - player/fax-draft.md
---

リョウは今朝、蛙を受け取りに来る途中で事故に遭いました。目の前のFAXは、同じ日の午前八時、彼女が家を出る三十分前のこの店へ送れます。

店に何を知らせれば、彼女が危険な道を通らずに済むでしょう？ まず「送る文章を書く」で下書きを作りましょう。内容を確かめ、あなたが送ると決めるまでは送信しません。
