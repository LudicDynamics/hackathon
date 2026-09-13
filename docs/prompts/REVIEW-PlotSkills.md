# REVIEW-PlotSkills — 两份「剧情脉络」世界级 skill 的独立复核

> 复核对象：`templates/holmes-world/skills/holmes-world-plot/SKILL.md`（47 行）、`templates/firstsnow/skills/firstsnow-plot/SKILL.md`（32 行）。
> 复核人只读、只写本报告。判据来源：`docs/prompts/00-共同上下文.md` §3（三层分工/常驻薄+懒加载）、`docs/prompts/04-skill体系.md` §3.4（剧情 skill 骨架与口径）、`docs/hooks/00` §8 + `docs/hooks/04`（注入块「下一步」段）、`docs/prompts/doc-23`（判据而非形容词）。
> 方法：逐条抽出 skill 的**事实性断言**，回 `world.json` / `world/**/*.md` / `journal/*` / `characters/*` 找 `file:line`；`world.json` 与全部世界文件已 100% 读过（两世界文件数各 ≤ 20）。
> 分级：BLOCKER（会让作家写歪/自相矛盾）/ MAJOR（无据或漏依据的核心断言）/ MINOR（不精确、层级重复）/ NIT（措辞）。

---

## 0. 结论速览

| skill | verdict | 无据/矛盾 | 泄露 | 语言 | 与 `00 §3` 冲突 |
|---|---|---|---|---|---|
| `holmes-world-plot` | **需小改（含 1 BLOCKER）** | 3 项（1 BLOCKER、2 MAJOR） | 0 | ✅ 纯英文 | 1 MINOR（层级重复） |
| `firstsnow-plot` | **可直接用** | 0（2 处措辞不精确） | 0 | ✅ 纯日文，无中文 | 1 MINOR（层级重复） |

两份的**骨架、口径、慵懒加载触发条件、语言分层全部合规**；两份 `description` 用 pi-rp 真解析器 `parseFrontmatter` 实跑通过（`holmes-world-plot` 123 字符、`firstsnow-plot` 57 字符，均 string，无 `Nested mappings`）。问题集中在 holmes 的**几条自造设定**上——它比 firstsnow 更爱把「未在内容里出现的调查角度」当成世界事实写下来。这正是「实现期撰写的正文没走设计评审门」应有的风险形态。

---

## 1. `holmes-world-plot` 逐条断言 vs 世界依据

| # | skill 断言（`file:line`） | 世界依据（`file:line`） | 判定 |
|---|---|---|---|
| H1 | "Lady Adler has been missing three days"（`:10`） | `world.json:42` `"status": "Missing — Day 3"`；`journal/01-...:7`；`player/README.md:11`；`characters/watson/README.md:12` | **有据** ✅ |
| H2 | "what Holmes is really chasing is whoever keeps signing `—A`"（`:10-11`） | `journal/01-...:10` 信末 `—A`；`world/abandoned-orchard/evening.md:20` `—A` | **有据**（解读成立），但 "keeps signing"（惯性复数）只对应**一处**署名 → 见 H15 MINOR |
| H3 | "the world never hands over that name"（`:11`） | `world.json:49` `open_ended: true`、`:50` `no_predetermined_killer: true` | **有据** ✅ |
| H4 | "Where Adler is … combining the photograph, the orchard, and the letter"（`:15-16`） | 照片 `world/baker-street/evening.md:17-19`；果园 `world/abandoned-orchard/evening.md:16-20`；信同上；`world.json:43-47` clues 四项 | **有据** ✅（"combining only" 为设计意图，三项线索确实都在） |
| H5 | "What the rusted key opens … found beneath the orchard roots; the lock it fits has not been shown yet"（`:17-19`） | `journal/01-...:9` "found beneath the orchard tree roots"；`world/crime-scene/evening.md:19` "No telling what it opens."；`:12` `clue_found: "A rusted key"` | **有据** ✅（最强的一条，逐字对上） |
| H6 | "Who the Constable is working for. He produced the photograph."（`:20-21`） | "he produced/found it" → `world/baker-street/evening.md:12` `photo_source: "The Constable"`、`:21` "This is what the Constable found"；但 **"working for" 无任何依据**：`characters/constable/README.md:9-11` 只写他是 Baker Street 警局警长、门口出现匿名消息 | **无据（MAJOR）** → §3-A |
| H7 | "Nobody has asked him why he had it."（`:21`） | 无任何内容支持"没人问过" | **无据（随 H6 一并处理）** → §3-A |
| H8 | "Who `A` is … explicitly open-ended and has no predetermined answer"（`:25-26`） | `world.json:49-50` | **有据** ✅ |
| H9 | "Whether Adler is alive or dead … every clue sits on either side"（`:27-28`） | 无内容断言生死；`world/crime-scene/evening.md:13` `adler_whereabouts: "Unknown"` | **有据** ✅ |
| H10 | "That the letter is addressed to Holmes personally" 属于「**must not be said yet**」（`:29`） | 信正文 `world/abandoned-orchard/evening.md:18` "I know who you are, Holmes."；`journal/01-...:10` 同 | **矛盾（BLOCKER）** → §3-B |
| H11 | "'The truth you're chasing runs deeper than a disappearance' is a hook, not a fact about the case"（`:29-31`） | 引用正确（`world/abandoned-orchard/evening.md:19`、`journal:10`）；"hook 非事实"是解读 | **有据** ✅（措辞判断成立） |
| H12 | orchard 与 crime scene 都读作 "It exists only at first glance"（`:35`） | `world/abandoned-orchard/README.md:15` 与 `world/crime-scene/README.md:15` **逐字相同** | **有据** ✅ |
| H13 | "Reach them by following the photograph's back ('The truth in the orchard lies beneath the tree')"（`:37`） | `world/baker-street/evening.md:19` 照片背面原句 | **有据** ✅ |
| H14 | "they are places a clue has to earn, not places the player can simply walk to … never by narrating a direct arrival"（`:36-38`） | **与机制相反**：`docs/init/doc-11` §3.2 R2（`:190-192`）玩家可直接双击 stub 进入；holmes 两个 stub README **零 `requires`**（`grep -rn requires templates/holmes-world` 无命中） | **无据/矛盾（MAJOR）** → §3-C |
| H15 | "New layers and gated scenes should carry a `requires.items` threshold"（`:39-40`） | 该门槛机制真实存在（`docs/protocols/doc-20:124-130`，`apps/server/src/routes/world.ts:751`） | **有据** ✅（前瞻建议，非现状断言） |
| H16 | "The demo closes on … the board assembled, the connections drawn"（`:44-45`） | holmes-world **无任何 `board` 组件/收束场景**；`READMEWORLD.md:78` 反而是 "Multiple endings possible"。`board` 仅作为另一世界方案的"案卷桌"出现在 `docs/doc-24:233` | **无据（MAJOR）** → §3-D |
| H17 | "Not a culprit named, not a confession delivered"（`:45-46`） | `world.json:50` `no_predetermined_killer: true` | **有据** ✅ |

**小结**：17 条中 12 条有据、3 条无据/矛盾、2 条需连带处理（H7 随 H6、H15 是前瞻）。骨架五节（一句话 / 悬着什么 / 不能早说 / 门与钥匙 / 结尾形状）与 `04 §3.4` 骨架**逐节对应**，写法 também 合规（每节都是判据/后果，非形容词）。

---

## 2. `firstsnow-plot` 逐条断言 vs 世界依据

| # | skill 断言（`file:line`） | 世界依据（`file:line`） | 判定 |
|---|---|---|---|
| F1 | "十年越しに言えなかった約束と、今夜はじめて交わす約束"（`:10`） | 十年 = `world/intro/README.md:12`、`world/intro/relationships/rooftop/README.md:10`；今夜 = `world/intro/relationships/cafe/README.md`、`world.json:6` | **有据** ✅ |
| F2 | 七海の「最後に流す。それとも、しまっておく？」（`:14`） | `world/intro/request-slip.md:8` **逐字** | **有据** ✅ |
| F3 | "台本の余白と、消しゴムで消された一行"（`:14`、`:20`） | `world/intro/relationships/studio/script-margin.md:5` "その先だけ、消しゴムで消されている" | **有据** ✅ |
| F4 | "澄との「最初の三十九分」… 琥珀喫茶店の四十分"（`:15`） | `world/intro/relationships/cafe/README.md:9` "最初の三十九分"、`:10` "自由時間は四十分"；`.../cafe/sumi.md:6` "最初の三十九分だけ" | **有据** ✅（数字全对） |
| F5 | "十年前に屋上で分けたイヤホンの片方。誰が先に手を出したのか"（`:16`） | `world/intro/relationships/rooftop/README.md:7` "七海に片方のイヤホンを渡す"、`:10` "十年前…一組のイヤホンを分けた" | **有据** ✅ |
| F6 | "終幕の三つの選択肢は、どれも同じ重さで開いている"（`:21`） | `world/intro/relationships/snowfall/README.md:10-12` 确为三条；"同じ重さ" → `world/intro/relationships/README.md:14` "どちらも本物で…具体的な不在が残る" | **有据** ✅ |
| F7 | "終幕「初雪」は `requires.items: [player/request-slip.md]` で閉じている"（`:26`） | `world/intro/relationships/snowfall/README.md:6-8` **逐字**（含 `blocked` 人话） | **有据** ✅ |
| F8 | "**第47回リクエスト票**（`world/intro/request-slip.md`）を手に取っていなければ"（`:26`） | `world/intro/request-slip.md:3` `title: 第47回リクエスト票`、`:4` `portable: true` | **有据** ✅ |
| F9 | "第一幕の九十秒は `1d6 > 3` のダイス … マイクを開くかどうかを委ねる"（`:27`） | `world/intro/relationships/studio/README.md:6-9` `type: 1d6` / `expect: ">3"` / `desc: マイクを開き、自分の言葉を一行だけ届ける`；九十秒 = `world/intro/nanami.md:6` | **有据** ✅（`desc` 比"是否开麦"略宽，见 F12 NIT） |
| F10 | "結果はエンジンが決める。地の文で先に書かない"（`:27`） | `docs/prompts/00 §5` 事实表（`roll_dice` 的 `result/type/expect` 由引擎读文件产，调用者不能传） | **有据** ✅ |
| F11 | "それぞれの幕は `choice` で次へ進む。選んだこと自体は記録されるが、世界は自動では動かない"（`:28`） | `intro/README.md:6`、`relationships/README.md:9`、`cafe/README.md:6`、`rooftop/README.md:6`、`snowfall/README.md:9` 均有 `choice`；**但第一幕 `studio/README.md` 只有 `roll_dice`、无 `choice`**。后半句 = `choose` 语义（`docs/prompts/00 §5`） | **部分不精确（MINOR）** → §3-E |
| F12 | "「初雪が降る前に答える」——それがこの Demo の形"（`:32`） | `world.json:6` description "初雪が降る前に、二つの約束へ答える。" | **有据** ✅ |
| F13 | "誰が隣にいるかだけでなく、いない人が今どこで何をしているかまで、一つの短い情景として決着させる"（`:32`） | `world/intro/relationships/snowfall/README.md:16` **逐字** | **有据** ✅（几乎照抄，好） |
| F14 | "台詞で締めるのではなく、雪の降り方で締める"（`:32`） | 无直接文案；`snowfall/README.md:14` "初雪が街灯の光へ落ちてくる" 提供意象 | **有据（软）** ✅（属"形状"而非台词，符合 `04 §3.4`） |
| F15 | "この鍵を先回りして開けないこと"（`:26`） | 门槛由引擎在 `enter-layer` 强制（`docs/protocols/doc-20:130`），非作家可控 | **层级问题（MINOR）** → §3-F |

**小结**：15 条中 13 条有据、0 条无据、2 条仅措辞/层级不精确。两份 description（`:3`）均与 `docs/prompts/04 §3.4` 的**逐字示例一致**，且 `world.json.locale = "ja"`（`templates/firstsnow/world.json:9`），语言分层正确。

---

## 3. 无据 / 矛盾项（单列 + 修复建议）

### A. `holmes-world-plot:20-21` — Constable「在为谁工作」（MAJOR）

- **断言**："**Who the Constable is working for.** He produced the photograph. Nobody has asked him why he had it."
- **内容依据**：无。`characters/constable/README.md:9-11` 只说他是警局警长、门口出现匿名消息；`world/baker-street/evening.md:21` 只说"这是警长发现的"。**"为谁工作"暗示一个雇主/组织**，世界内容零支持。
- **危害**：把 `no_predetermined_killer: true`（`world.json:50`）的世界往"背后有主使"的单一阴谋方向推，恰是 skill 自己 `:25-26` 禁止的"freeze the mystery into a single solution"。这是**自相矛盾**：同一个 skill 既说"别把谜题钉死"，又给了作家一条钉死的阴谋线。
- **修复（改 skill，不改 world）**：删掉"working for"框架，改成基于已有事实的悬问——"**Why the Constable had the photograph.** He found it (`world/baker-street/evening.md:21`) and no scene has asked him where. A scene can move toward that question without answering it." 删除 "Nobody has asked him why he had it"（无法验证的世界状态断言）。

### B. `holmes-world-plot:29` — 「信是写给 Holmes 本人的」列为"必须还不能说"，但世界已逐字说出（BLOCKER）

- **断言**：`## What must not be said yet` 第二条 = "**That the letter is addressed to Holmes personally.**"
- **矛盾**：信件正文**本身就是**这句的揭示——`world/abandoned-orchard/evening.md:18` "I know who you are, Holmes."，`journal/01-...:10` 同样收录。玩家一旦捡到信（这是本 demo 的核心线索卡之一），这句话就已经在画布上。
- **危害**：作家若照 skill 字面执行，会**回避/淡化一封已经在玩家手里的信的核心信息**，与已落盘的内容直接打架（作家最怕的"自相矛盾"）；或者作家看出矛盾后直接不信这条 skill，连带不信其余两条真·禁忌。
- **根因**：实现期把"Hook 的**意义/分量**"误写成"Hook 的**存在**"。真正该留到后面的不是"信是写给 Holmes 的"（已公开），而是"这封信**为什么**写给 Holmes、`—A` 与 Holmes 是什么关系"。
- **修复（改 skill，且需回写 world 作者确认）**：把该条改为——"**What `—A` means by 'I know who you are, Holmes.'** The letter's text is public (`world/abandoned-orchard/evening.md:18`); its *significance* is not. Do not let one scene explain why `A` knows Holmes — the line is a hook, and explaining it now converts it into a fact with nothing behind it." 这样禁忌仍成立、且不再与内容冲突。

### C. `holmes-world-plot:36-38` — 两个 stub「不是玩家能直接走过去的地方」（MAJOR）

- **断言**："they are places a clue has to earn, not places the player can simply walk to … **never by narrating a direct arrival**."
- **矛盾**：
  - `docs/init/doc-11 §3.2` R2（`:190-192`）：玩家**可直接双击** stub 卡 → 穿越 → 玩家已经在场，看着它长出来。"两条路径都合法"。
  - holmes 的两个 stub README（`world/abandoned-orchard/README.md`、`world/crime-scene/README.md`）**都没有 `requires` 字段**（`grep -rn requires templates/holmes-world` 零命中），所以 `enter-layer` 门槛（`docs/protocols/doc-20:130`）对它们**永不触发**——玩家**确实可以**直接走到。
- **危害**：作家会拒绝/惩罚玩家直接进入果园的行为，与引擎允许的合法操作冲突（`docs/prompts/00 §7.6`：不得给作品加权限门禁；`§7.7`：不做也是合法输出）。
- **修复（二选一）**：
  1. **改 world**（更贴设计意图）：给 `world/abandoned-orchard/README.md` 与 `world/crime-scene/README.md` 加 `requires.items`（如 `[player/old-boat-ticket.md]` 或一道照片线索的门），并补 `blocked` 人话——这样 skill 的"必须挣得"才成立（`docs/protocols/doc-20:124-130`）。
  2. **改 skill**（若维持现状）：删去"not places the player can simply walk to / never by narrating a direct arrival"，改为可选建议——"The photograph's back (`world/baker-street/evening.md:19`) is a *stronger* route in; prefer it as the on-ramp, but a direct arrival is legal (doc-11 R2)."
  - 我倾向前者（改 world），因为 skill 表达的是这个世界**该有**的形态；但当前它把"应然"写成了"实然"。

### D. `holmes-world-plot:44-45` — 收束形状里的 "the board"（MAJOR）

- **断言**："the demo closes on the moment the player lays the clues out together — **the board assembled**, the connections drawn."
- **内容依据**：holmes-world **没有任何 `board` 组件或收束场景**（全模板 grep `board` 只命中 skill 自身与无关词）。`READMEWORLD.md:78` 明写 "Multiple endings possible"。"案卷桌/case board"只作为**另一世界方案**出现在 `docs/doc-24:233`（那是 doc-24 的福尔摩斯 demo 愿景，不是本模板的落地内容）。
- **危害**：作家会尝试落一个不存在的 `board` 组件（未注册 kind 静默降级为 note，`docs/prompts/00 §5`），或把收束写成一个画布上没有的物件。"the board"是**具体机制词**，不是"形状"。
- **修复（改 skill）**：改成不点名组件的形状描述——"…closes on the moment the deductions are laid out **on paper** — the lines drawn, the shape finally visible — and stops there." 若确实想要案卷桌，则**改 world**：先落一个 `board` 组件与一个收束场景，再让 skill 点名它。

### E. `firstsnow-plot:28` — "それぞれの幕は `choice` で次へ進む"（MINOR）

- **断言**：每一幕都以 `choice` 前进。
- **不精确**：第一幕 `world/intro/relationships/studio/README.md` **只有 `roll_dice`、没有 `choice`**（第 1–11 行 frontmatter 无 `choice:`）。
- **修复（改 skill）**：改为"幕の大半は `choice` で次へ進む（第一幕は `roll_dice`）"。

### F. `firstsnow-plot:26` — "この鍵を先回りして開けないこと"（MINOR，层级）

- **断言**：让作家"别提前开这把钥匙"。
- **问题**：`requires.items` 门槛由引擎在 `enter-layer` 强制（`docs/protocols/doc-20:130`），作家不控制它；这条指令与 `docs/prompts/00 §3.1`「一条内容只住一层」（这条属于机制层）错位。
- **修复（改 skill）**：改为面向叙事的表述——"雪の結末は、`world/intro/request-slip.md` を手に取った者にしか開かない（`requires.items`）。まだ手に取っていない間、地の文で結末を先取りしないこと。" 即把"别开锁"变成"别抢先叙事"。

### G. 措辞层（NIT，可不改）

- `holmes-world-plot:10` "whoever **keeps signing** `—A`" —— 世界里 `—A` 只出现一次（`journal:10`）；"keeps"（惯性）over-claims。改 "whoever signs `—A`"。
- `firstsnow-plot:27` "マイクを開くかどうかを委ねる" —— `studio/README.md:8` 的 `desc` 是"マイクを開き、自分の言葉を一行だけ届ける"（开麦 + 交出一行），比"是否开麦"更宽。可照抄 `desc` 或去掉"かどうか"。

---

## 4. 泄露项（自述"不能早说"、却自己说破）—— 单列

| skill | 自述禁忌 | skill 是否自己说破 | 判定 |
|---|---|---|---|
| holmes-world-plot | Who `A` is（`:25`） | 未点名 | **未泄露** ✅ |
| holmes-world-plot | Whether Adler alive/dead（`:27`） | 未选边 | **未泄露** ✅ |
| holmes-world-plot | 信写给 Holmes 一句（`:29`） | 未"说破"——但**世界内容已说破**，故 skill 的禁忌本身无效 | 归 §3-B（矛盾），非 skill 泄露 |
| firstsnow-plot | 七海十年前言えないこと（`:20`） | 未代述 | **未泄露** ✅ |
| firstsnow-plot | 今夜誰の隣か（`:21`） | 未选边 | **未泄露** ✅ |
| firstsnow-plot | 初雪の比喩（`:22`） | 未解释 | **未泄露** ✅ |

**结论：skill 层零主动泄露**。两份都没有把"终幕答案"写进正文——符合 `docs/prompts/04 §3.4`「开门不演戏」与 `doc-11` 的"开门不演戏"纪律。唯一的泄露风险是 **§3-B 的错位**：那件"被要求保密"的事，其实早就在世界内容里公开了——这不是 skill 说破，而是 skill 选错了保密对象。

---

## 5. 与 `docs/prompts/00 §3`（常驻薄 + 细则懒加载、不重复注入块）的一致性

| 检查项 | holmes-world-plot | firstsnow-plot |
|---|---|---|
| `description` 只写**触发条件**、不写摘要（`00 §3.3`；`04 §2.4`） | ✅ `:3` "Read when deciding what a scene is moving toward, or when the player asks a question about the case itself. Not every turn." | ✅ `:3` "この場面がどこへ向かうかを決めるとき…毎ターンではない。" |
| 正文**不复述**注入块的状态/下一步段（`00 §3.2`；`hooks/00` §8 + `hooks/04`） | ✅ 无逐轮状态 | ⚠️ **MINOR**：`:28` "選んだこと自体は記録されるが、世界は自動では動かない——次の一手はプレイヤーの言葉から来る" 与注入块「下一步」段 stance（`docs/hooks/04:182-186` 的 `NEXT_STEP_RULES`："It names what is outstanding; how you resolve it is your call…"）语义重叠 |
| 正文**不复述**平台级 skill（`00 §3.1`：一条内容只住一层） | ✅ | ⚠️ **MINOR**：`:28` 的"选完世界不自动动"正是平台级 `tool-craft` 的 `choose` 段内容（`choose.ts:26-28`，见 `docs/prompts/04` §3.2 的「Letting the player press something」）——同一纪律跨 tier 写两遍 |
| 正文**不复述**常驻层（`00 §3.2`；`doc-23 §2.9`） | ✅ | ⚠️ 同上，`:28` 对机制语义的复述偏常驻/工具层 |
| 正文是**判据/后果**，非形容词（`doc-23 §2.3`） | ✅ 每条都给了"不能早说"的理由 | ✅ 每条都给了理由（"地の文が代わりに言ってしまえば…消える"） |
| "不做也是合法输出"出口（`00 §7.7`；`doc-23 §2.7`） | ✅ `:16` "Do not advance this on its own."（把"不推进"写成合法） | ✅ `:15` "ナレーションは時計を進めるだけ" |
| 世界级语言跟随世界（`00 §3.3`） | ✅ 纯英文 | ✅ 纯日文 |
| `name` ASCII kebab-case、目录名 = `name`（`00 §4.3`；`04 §⑧ A11`） | ✅ `holmes-world-plot` | ✅ `firstsnow-plot` |

**唯一实质性分层问题**：`firstsnow-plot:28` 的最后一句（"選んだこと自体は記録されるが、世界は自動では動かない"）与 `holmes-world-plot:16` 的 "Do not advance this on its own" 有同类倾向，但 firstsnow 那句跨到了 **平台 skill 与注入块均已承担的机制语义**，属 `doc-23 §2.9` 的重复。建议改成单向指路（"…その先はプラットフォーム側の規則に従う"）或删去该分句。holmes 的 `:16` 因紧贴"Hook 不得单独推进"，作为**剧情层**指令尚可接受，不单列。

---

## 6. 语言检查（`holmes-world` 英文 / `firstsnow` 日文，禁混中文）

| skill | 检查 | 结果 |
|---|---|---|
| `holmes-world-plot` | `grep -P '[\u4e00-\u9fff\u3040-\u30ff]'` | **零命中**（exit 1）→ 纯英文 ✅ |
| `firstsnow-plot` | 含かな/漢字（18 处 kana 命中）✅；`grep -P '[\u4e00-\u9fff]'` 仅命中日文汉字 | **纯日文** ✅ |
| `firstsnow-plot` | 简体中文专用字扫描（们/这/说/时/读/让/给/对/还/关/东/发/现/标/记 等） | **零命中** ✅ |
| `firstsnow-plot` | 用词全为日语（"プレイヤー"而非"玩家"、"選択肢"、"結末"、"扉と鍵"） | ✅ |

**无中文混入。** 语言面两份**完全通过**。

---

## 7. 骨架 / 口径 / 触发合规（`docs/prompts/04 §3.4`）

| 要求（`04 §3.4` 骨架 + 判据） | holmes-world-plot | firstsnow-plot |
|---|---|---|
| 五节骨架：一句话 / 现在悬着什么 / 不能早说的 / 门与钥匙 / 结尾的形状 | ✅ 全备（`:8/:13/:23/:33/:42`） | ✅ 全备（`:8/:12/:18/:24/:30`） |
| `## 现在悬着什么` 每条能答"下一步玩家能查到什么"，而非"故事答案" | ✅ 三条都给了"还差什么才能解"（`:15-21`） | ✅ 三条都给了"答复的手がかり/下一步"（`:14-16`） |
| `## 不能早说的` 每条写"现在说了会毁掉什么" | ✅ 三条都写了后果（`:25-31`） | ✅ 三条都写了后果（`:20-22`） |
| `## 结尾的形状` 不写台词、只写形状 | ⚠️ 形状成立，但点名了一个不存在的组件 "board"（§3-D） | ✅ 只写形状（"雪の降り方で締める"） |
| description 与 `04 §3.4` 逐字示例一致 | ✅ | ✅ |
| frontmatter 可被 pi-rp 真解析器解析（`04 §2.4.1`、`§⑧ A13`） | ✅ `parseFrontmatter` OK，string，123 字符 | ✅ OK，string，57 字符 |
| 正文 ≤ 120 行（`04 §⑧ A5`） | ✅ 47 行 | ✅ 32 行 |
| 不复述注入块 / 平台 skill（`00 §3.2`、`doc-23 §2.9`） | ✅ | ⚠️ `:28` 见 §5 |

---

## 8. 最终 verdict

### `holmes-world-plot` — **需小改（必修 1 BLOCKER + 2 MAJOR）**

- **为什么不是"需重写"**：五节骨架、判据写法、语言、"不把戏写完"的纪律、description 全部合规；17 条断言 12 条有据，且最强的几条（锈钥匙、两个 stub 的"第一眼才存在"、照片背面引文）逐字对上内容。这是一份**结构正确、局部自造设定**的稿子。
- **为什么不是"可直接用"**：
  - **BLOCKER §3-B**：把"信写给 Holmes"列为禁忌，而世界内容已公开该信息 → 作家要么跟内容打架，要么不信这份 skill。**必须先改**。
  - **MAJOR §3-A/§3-D**：Constable"为谁工作"、结尾的 "board" 两处**凭空发明**（内容零依据），会把作家引向不存在的阴谋线与不存在的组件。
  - **MAJOR §3-C**：把 two stubs 说成"必须先挣得、不能直接进"，与 `doc-11` R2 及空 `requires` 现状矛盾。
- **动作**：按 §3 的 A/B/C/D 改 skill；其中 C 建议**同时回写 world**（给两个 stub 加 `requires.items` + `blocked`）。

### `firstsnow-plot` — **可直接用（可选 2 处 MINOR 打磨）**

- **为什么可直接用**：15 条断言 **13 条逐字/逐数对上**世界内容（三十九分/四十分、九十秒、`1d6 > 3`、`requires.items` 路径与 `blocked`、结尾 clause 近乎照抄），0 项无据、0 项泄露、语言纯正、骨架与触发合规。它是一份**只在世界内容上说话**的范本——与 holmes 稿形成鲜明对照。
- **可选打磨**：§3-E（幕1 用 `roll_dice` 非 `choice`）、§5（`:28` 跨 tier 复述 `choose` 语义）。
- **此稿可作为"剧情 skill 该怎么写"的正例**，特别是它证明了两件事：(1) 钥匙/门槛断言**可以**精确到 `file:line` 且逐字正确；(2) 结尾形状可以只写形状而完全不点名不存在的组件。

---

## 9. 给主 agent 的处置建议（本报告不改任何文件）

1. **采纳 §3-B 的替换文本**（holmes skill），这是唯一的 BLOCKER；同时请 world 作者确认 `—A` 的"意义"确实是禁忌对象。
2. **采纳 §3-A / §3-D 的改写**（holmes skill）：去掉"为谁工作"与 "board"。
3. **§3-C 二选一**：优先改 world（两个 stub 补 `requires`）；若不动 world，则改 skill 措辞。
4. **firstsnow 稿无需改动即可用**；§3-E 可选。
5. 若落 `tools/check-skills.mjs`（`04 §⑧`），建议**追加一条断言**：skill 正文点名的组件 kind 必须命中 `packages/shared/src/components/registry.ts` 的已注册集合——这正是 §3-D（"board"）这类无据断言唯一能被机械拦住的地方（`04 §⑧` 现有 A1–A13 都拦不住它）。
