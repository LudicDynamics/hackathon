# 画像一覧

既存の初雪世界から、次の九枚だけをそのまま再利用する。本文、人物設定、台詞、選択肢と生成規則は日本語版として新しく作成した。画像に焼き込まれた看板などの文字は、画像の再利用範囲に含む。

- scenes/intro.webp：放送終了前の導入
- scenes/winter-schedule.webp：今夜の約束の見取り図
- scenes/radio-studio.webp：放送室
- scenes/amber-cafe.webp：琥珀カフェ
- scenes/campus-rooftop.webp：屋上
- scenes/first-snow.webp：初雪の場面
- characters/nanami.webp：七海
- characters/sumi-yukimura.webp：雪村澄
- characters/radio-director.webp：プレイヤー

画像は世界内の相対パスを使い、/api/asset から配信する。元画像との一致は tools/first-snow-jp.test.mjs で検証する。旧版の会話履歴、データベース、生成済み世界と音声設定は引き継がない。
