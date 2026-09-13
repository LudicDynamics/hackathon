import { author } from './common.mjs';
import { divergenceMedia } from './divergence-media.mjs';
const p = author('divergence', '分岐点 · 体験版', '直った蛙と、帰らなかった少女。同じ店の三つの時間を歩き、迎えに来るはずだった朝を変える。');
const map = 'world/time-map';
const past = `${map}/1994/tokiwa-electronics`;
const now = `${map}/tonight/tokiwa-electronics`;
const future = `${map}/thirty-years-later/tokiwa-electronics`;
const shop = 'assets/scenes/tonight.webp';
const daylight = 'assets/scenes/shop-daylight.webp';
const originalExterior = 'assets/scenes/future-original.webp';
const restoredExterior = 'assets/scenes/future-restored.webp';
const adultPortrait = 'assets/characters/ryo-adult.webp';
const draftIntent = '現在地 README の intent を read で読む。player/fax-draft.md がなければ即座に一枚の Chalk で「送る文章を入力する」「相談して草稿を作る」を提示する。確認という選択名や元の手紙を送信本文と見なさない。本文を受けたら草稿を保存し、宛先・日時・全文・字数を一枚の Chalk に表示、「この一枚を送る」「書き直す」を提示。確認・読む・道具を使うだけでは送らない。詳しい手順は世界 skill。';

p.scene('world', '後悔 · 最初の一頁', '雨が窓をたたく。灯りの下には、宛名だけを書いた手紙と、直ったばかりの蛙。\n\nあなたは常盤電器の修理見習い。一九九五年一月一日、午後八時。昨日リョウに約束した「明日の朝十時」は、もう過ぎた。\n\n蛙は跳ねる。来るはずだった少女だけが、帰らない。', ['手紙を読み、ぜんまいの蛙を持つ', '事故の知らせを読む'], { bg: 'assets/scenes/intro.webp', intent: '取ると言われたら world/clockwork-frog.md を player/clockwork-frog.md へ move。手紙も希望された場合のみ player/undelivered-letter.md へ move。蛙だけで時間図へ入れる。事故の知らせは読むだけでよい。救済を先取りしない。背景の電話表示を新しい証拠や必須操作にしない。' });
p.note('world/undelivered-letter.md', '届かなかった手紙', 'リョウへ。蛙は直ったよ。受け取りに来て、と約束した僕が、こちらから届けていれば。これは今夜あなたが書いた後悔の手紙で、まだ送るＦＡＸの原稿ではない。', { type: 'letter' });
p.note('world/clockwork-frog.md', 'ぜんまいの蛙', '底に「リョウ」。今夜あなたが修理を終えた玩具。時間を歩いても同じ蛙とあなたの記憶は残る。過去にある壊れた蛙はこの品の以前の姿で、もう一個の報酬にはならない。', { status: { data: { time_anchor: true } } });
p.note('world/accident-notice.md', '東橋の事故 · 一月一日午前九時', '一九九五年一月一日、午前九時。東橋の凍った歩道でリョウが転落し、帰らぬ人となった。川向こうの自宅から常盤電器へ、修理した蛙を取りに行く途中だった。家を出たのは八時半。', { portable: false });
p.scene(map, '三つの時間 · 同じ店', '一九九四年十二月三十一日、送修の日。一九九五年一月一日の今夜。そして二〇二四年。同じ自分の、それぞれの時点に入る。蛙とあなたの記憶だけが前の時間を覚えている。', [], { bg: shop, requires: { items: ['player/clockwork-frog.md'] }, blocked: '修理した蛙を手に取ろう。その重さが、あなたを別の時間へつないでいる。' });
for (const [id, title, bg, body, choices, intent] of [
  ['1994', '一九九四年十二月三十一日 · 送修の日', daylight,
    '同じカウンターに、まだ壊れた蛙と送修票がある。七歳のリョウがあなたを見上げる。「明日、本当に直る？ 大人になったら、私もここで直す人になりたい」。あなたは彼女が知っている修理見習いだ。',
    ['受け取りの約束と帰り道を聞く', '取りに来る代わりに届ける相談をする'],
    '少女は翌朝の事故を知らない。collection-slip.md と route-note.md を根拠に返答する。配達への変更などを具体的に相談されたら、相手の返答と成立した約束を intervention.md に記録し、世界 skill に従い未来を更新する。「考える」だけでは約束成立にしない。'],
  ['tonight', '一九九五年一月一日 · 午後八時', shop,
    '蛙のあった同じ位置に未署名の受取票。少女はいない。師匠は口を閉ざしている。ＦＡＸの時計は今夜八時、受信先は「同じ店・今日の午前八時」。彼女が家を出る三十分前だ。',
    ['送る文章を書く', '用意したＦＡＸを確認する', 'ＦＡＸが届く時刻を調べる'], draftIntent],
  ['thirty-years-later', '二〇二四年十二月三十一日 · 三十年後', originalExterior,
    '年を取ったあなたが店の跡に立つ。隣の家と道は残り、常盤電器の敷地だけが空いている。少女を失った師匠は店を閉め、引き継ぐ人のいない建物は後に取り壊された。ここはまだ変えていない未来。',
    ['店がなくなった理由を読む', '時間の地図へ戻る'],
    '現状は shop-record.md に従う。干渉前に成年リョウや営業中の店を出さない。改変後は同じディレクトリの実在する結果を見せる。再訪で再生成しない。'],
]) {
  const time = `${map}/${id}`;
  p.scene(time, title, `${title}。この時刻の常盤電器へ。時間の地図へ戻れば、別の時刻を選べる。`, [], { bg });
  p.scene(`${time}/tokiwa-electronics`, `${title} · 常盤電器`, body, choices, { bg, intent });
}
p.note(`${past}/collection-slip.md`, '送修票 · 明朝十時に受け取り', '預かり：一九九四年十二月三十一日。お客さま：リョウ、七歳。修理担当：あなた。受取予定：一九九五年一月一日午前十時。住所と自宅の電話番号は店の控えにあり、師匠は家族へ連絡できる。', { portable: false });
p.note(`${past}/route-note.md`, '川向こうの家と東橋', 'リョウの家は川向こう。明日は八時半に家を出て東橋を渡るつもりだと言う。店から家へは上流の車道橋を使って配達もできる。「おうちで待ってていいなら、うれしい」。', { portable: false });
p.note(`${past}/broken-frog.md`, 'まだ跳べない蛙', 'ぜんまいが外れた蛙。明朝までに修理できる。修理の成功そのものと、安全な受け渡しは別の問題だ。', { portable: false });
p.note(`${now}/collection-slip.md`, '受取票 · 署名のない欄', '一九九五年一月一日午前十時、リョウが来店する約束だった。修理済み。受取署名は空欄。事故は一時間前、午前九時に東橋で起きた。', { portable: false });
p.note(`${now}/fax-machine.md`, 'ＦＡＸ · 届くのは今日の午前八時', '送信元：一九九五年一月一日午後八時。受信先：同じ店、同じ日の午前八時の師匠。時計のずれは十二時間で固定。歩いて入れる過去は昨日の送修時点だけ。この朝へ直接は入れないが、出発前に紙を一枚届けられる。師匠は送修票の番号から家族へ電話できる。送信前に全文を確認する。', { portable: false });
p.note(`${now}/master.md`, '言葉の出ない師匠', '「直ったのに、な」。あなたの仕事を責めず、空の署名欄を見ている。今夜の師匠に警告するだけでは、もう起きた事故は変わらない。', { portable: false });
p.note(`${future}/shop-record.md`, '店跡に残った記録', 'リョウの事故の後、師匠は店を閉めた。引き継ぐ人はおらず、建物は後に取り壊された。あなたは年を重ねた元見習いとして戻ってきた。蛙だけがあのカウンターを覚えている。', { portable: false, status: { data: { timeline: 'original', shop_open: false } } });
// These entry Chalks must remain true before and after an intervention.
p.put(`${now}/01-目の前のこと.md`, { type: 'chalk', title: '今夜 · 受取票とＦＡＸ', choice: ['送る文章を書く', '用意したＦＡＸを確認する'], intent: draftIntent }, '一九九五年一月一日の夜。受取票とＦＡＸを確かめよう。目の前の記録が、あの旅の結果を語る。');
p.put(`${future}/01-目の前のこと.md`, { type: 'chalk', title: '三十年後 · 同じ敷居', choice: ['目の前の店と人を確かめる', '時間の地図へ戻る'], intent: 'この場所の README と shop-record.md、実在すれば adult-ryo.md と counter-frog.md を読み、現在の事実だけでこの Chalk を更新する。再訪で改史しない。' }, '二〇二四年。同じ敷居の前で、蛙をそっと握る。ここに何が残り、誰がいるか。今の記録と目の前の景色を確かめよう。');
// The adult portrait is available, but the adult entity must be earned in play.
p.person('ryo-child', 'young-ryo', past, 'リョウ、七歳の少女。あなたは彼女が知っている修理見習い。明朝十時に蛙を取りに来る予定。川向こうの家から東橋を渡る。大人になったら修理の仕事がしたい。未来の事故は知らない。');
p.characters[0].name = '幼いリョウ';
p.rules(`## 三つの時間と同じプレイヤー
1994-12-31 は送修の日、1995-01-01 20:00 は事故後の今夜、2024-12-31 は三十年後。主視図は ${map}、各時間の下に地点。プレイヤーは1995年の若い修理見習い。過去では昨日の自分、未来では年を取った自分に入る。同時に二人の自分は出さない。蛙とプレイヤーの記憶は時間の錨。少女や師匠はその時点で知ることだけ知る。新しい現在や第四の必須時間フォルダは作らない。

## 推理できる因果
少女は1994-12-31に蛙を預け、翌朝十時の受け取りを約束する。1995-01-01 08:30に出発、09:00に東橋で転落。直したこと自体ではなく、危険な受け取りの旅を変える必要がある。送修票は日時と連絡先、道のメモは出発時刻・橋・配達手段、導入の事故通知は結果を示す。別の年代の事件や電気契約を追加しない。実際に見た証拠の言葉で一つだけ次の手を案内する。

## 二つの有効な介入
ＦＡＸは1995-01-01 20:00から同日08:00の師匠へ届く。宛先を勝手に1994や未来へ変えない。誤った宛先なら一回質問する。師匠が出発前に家族へ連絡し、家で待ってもらい、安全な車道橋で配達するのは実行可能。作家用の参考文（相談された時だけ案にする）：『今日の受け取りは中止してください。東橋で事故が起きます。出発前に家へ電話し、蛙は安全な道でこちらから届けてください。』。
1994年に配達や安全な付き添いを具体的に提案し、少女または師匠と約束を成立させてもよい。ＦＡＸは唯一の正解ではない。相手の返答・経路・日時を ${past}/intervention.md に保存する。「直す」「救いたい」だけなら不足する一点を Chalk で聞く。骰子で生死や同意を決めない。

## 草稿、確認、送信
${draftIntent}
草稿はプレイヤーの文章。依頼された代筆は案として保存し、承諾を取る。player/fax-draft.md に宛先1995-01-01T08:00、送信元1995-01-01T20:00、本文と status.data.sent: false を残す。空白を除く Unicode 百字以内を目安に数え直す。操作名を本文にしない。原信と蛙は文脈であり、消費する鍵ではない。
本文と宛先を提示した後で「この一枚を送る」と承諾された場合だけ送信。本文が変わったら再確認。草稿がない時は探し続けず一枚の Chalk で本文入力か相談に戻す。回执が同じ草稿の送信を記録していれば再送せず結果へ案内する。新しい送信には新たな承諾が必要。

## 介入後の短い生成回合
共通 skill の全件再読ではなく、この段落の必要ファイルだけ一度 read する。行動元 README、原稿または intervention.md、${future}/README.md と shop-record.md を読む。提供済みの同じ内容は読み直さない。24ツール以内、一枚の Chalk に収める。最終チャットだけで終えない。
1. 元の既知事実を ${map}/before-transmission.md に一度保存する。再試行で上書きしない。
2. 警告が間に合うか、相手が実行できるか、東橋の旅が避けられるかを判断する。曖昧なら送信前に質問。届いても対策が不足なら「届いたが旅は変わらない」と理由を返し、修正する選択を出す。永久に閉じ込めない。
3. 成功なら ${future}/README.md と shop-record.md を営業中の店に書き換え、${future}/adult-ryo.md に37歳のリョウ、${future}/counter-frog.md に店番する蛙を物化する。彼女は元見習いのあなたを知り、本局の受け渡しの約束を引用するが、元の事故の記憶はない。成人は type: note、portable: false の人物紹介として作家が演じ、frontmatter に image: assets/characters/ryo-adult.webp を添える。白い不透明背景の人物画であり、透明な立ち絵や動画として扱わない。未登録 characterId や幼年立ち絵を使わない。素材の使い分けは下の「回報と制作範囲」に従い、${map}/thirty-years-later/README.md も合わせる。年と入口パスは変えない。
4. 今夜は1995年のまま。成功なら ${now}/README.md、collection-slip.md、master.md を受け渡し成立の事実に合わせる。元の後悔の手紙・導入の事故通知は「元の時間線の記録」と明記して残す。別場面の Chalk を同じ回合で edit しない。一回合一パスの制約は既存 Chalk の edit にも及ぶ。入口の初期 Chalk は改変前後どちらでも成立する文章。再訪時、現在地の Chalk 一枚だけを現状に合わせる。
5. 成立した結果を確認後、最後に ${map}/fax-receipt.md を作る。手渡し経由の題名は「約束の記録」。本文に「行動と原文／以前／変化後／理由／残ったものと変わったもの／確かめに行く場所」を短く出典付きで記す。status.data に method: fax または promise、resolved: true、saved: true または false。送信時は草稿の sent を true にする。途中失敗なら resolved を発行せず、同じファイルの不足だけ補う。書き換えが多く一回に収まらない場合は、回执に resolved: false と済んだファイル・未完了ファイルを残し、現在の Chalk に「変化の続きを確かめる」を出す。次の送信で不足だけ補い、送信自体を繰り返さない。
6. 最後は現在地の既存 Chalk 一枚を edit し、実際の結果と「二〇二四年の店を見に行く」（${future}）を提示。未設置時だけ chalk で新規作成。失敗なら不足理由と「草稿を書き直す」「昨日の受け取りを相談する」。入口は元から訪問できるが、生成完了前に結末完成と宣言しない。再訪で再生成しない。

## 回報と制作範囲
救った代償として必ず店やＦＡＸを失わせる条件はない。元の店が消えた理由は少女を失った師匠の閉店と後継者不在。救済後は、修理を夢見た少女が仕事を継ぐ未来を短く描ける。別の不幸を釣り合いとして足さない。実際の RP に即す一言と、カウンターの蛙で締める。未来の全人生や第二章は生成しない。
零級は雨の窓辺と手紙（assets/scenes/intro.webp）。1994の少女は日差しの店内（${daylight}）、1995のＦＡＸは夜の店内（${shop}）。同じ店の構図を使い、改装や別の年代を勝手に足さない。1994には assets/motion/seedance/backgrounds/y1994.webm、零級には assets/motion/seedance/backgrounds/intro.webm が対応する。
2024は同じ入口のまま、未改変・救済不成立なら時間階層と店址の両 README の bg を ${originalExterior} とし、bgVideo を外す。成功時だけ時間階層 README の bg を ${restoredExterior}、店内 README の bg を ${shop} にする。店内は assets/motion/seedance/backgrounds/tonight.webm を併用できるが、外観には動画を付けない。外観は雪の昼、店内はその晩の灯りという短い時間経過を案内する。外観二枚は同じ通りからの対比で、室内に変わるのは店へ入った時。成人画像 ${adultPortrait} を置くのも成功後だけ。再訪で成功画像を先取りせず、shop-record.md と回执の実在する事実を確認する。
この三時刻の既定結果は事前制作素材を使い generate_image を呼ばず、架空の画像パスを書かない。文字結果を先に完成し、画像がなくても読める。1–2分は生成体験予算で速度保証ではない。`);
p.files['assets/three-times-media.json'] = JSON.stringify(divergenceMedia, null, 2) + '\n';
export default p;
