---
type: chalk
title: 放送終了まで九十秒
choice:
  options:
    - id: action-1
      label: 用紙を手に取って読む
    - id: action-2
      label: 七海に「聞こえてるよ」と返す
intent: 取るならリクエスト用紙の現物を player/ へ移す。七海へ返事ならその言葉を覚えるが、まだ今夜の赴約や告白を成立させない。
choice_actions:
  action-1:
    kind: take
    paths:
      - world/request-slip.md
  action-2:
    kind: writer
---

あなたは学生ディレクター。七海の声が、放送用の声から、あなただけに話す声へ変わる。

「最後の曲、まだ決めてないんだ。……今夜、このあと空いてる？」

机の用紙には、雪村澄からの誘いと、七海が消しかけた一行がある。
