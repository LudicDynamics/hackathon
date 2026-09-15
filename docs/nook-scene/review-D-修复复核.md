# docs/nook-scene/review-D —— 修复复核（第三轮 · 收口）

> 2026-09-15。复核者：`ForeignTyrannosaurus`。**只读**：未改动任何被评文档／契约／源码，只新建本文件。
> 基准：`docs/nook-scene/00-共同上下文.md`（契约，可被推翻）。方法：逐条定位（**以符号名/引文为准**，行号仅作导航）+ 对每条「文档自称跑过」的命令**逐字复跑**。
> **未跑**（按任务硬约束）：`pnpm build` / `pnpm test` / `pnpm lint`。复算一律用 `node -e` / `node --input-type=module -e` 的纯逻辑片段。
> 不评架构方向（前两轮已评）、不复述前两轮报告内容 —— 本文只报**这一轮修复的到位状态**。

---

## 0. 总判

**有条件通过。**

一句话理由：**前两轮的 8 条 blocker（评审 C 的 RB1–RB5、评审 A 的 A-B1–A-B3、评审 B 的 B-B1–B-B3 主体）绝大多数已真正修好，且我逐条复跑后与文档自称的输出一致**；但收口期仍留 **3 处「照着文档做会做错」的缺陷**（`04 §10.4` 保留了 RB1 的同一条坏正则 / `02` 整篇夹具事实未随 `writing/`→`meta/` 漂移同步 / `06 §6.2` 的命令块含语法错误）与若干已被登记但未同步的旧口径。修掉这 3 条即可进入实现。

修完的判据：§2 表中无「未修」，§3 的条件 1–3 落地。

---

## 1. 逐条结论表

| # | 项 | 结论 | 证据（`file:line` / 命令输出） |
|---|---|---|---|
| 1 | **RB1**（`06 N2-A26` 的 `<Canvas>` 正则） | **已修**（`06`）/ **未修**（`04` 同条残留 → 见 §3-N1） | `06:508` 现为 `(nook.match(/^\s*<Canvas\b[\s\S]*?^\s*\/>/gm) ?? []).filter(...)`，`06:509` 断言 `=== 2`。**我复跑**：`BAD`（旧式）→ 3 match，len `[18964, 729, 897]`；`GOOD`（新式）→ **恰好 2** match，len `[741, 907]`。**模拟正确修复**（给两处真 `<Canvas>` 各插 `onEnterGate={handleEnterGate}`）后复跑：2 match 全部 `hasOnEnterGate=true` ⇒ 断言在正确实现下**可绿**。`06:529-531` 打印的 len 与我的实测**逐字一致**。 |
| 2 | **RB2**（`06 §6` 机械不变量整节缺失） | **已修**（章节齐、输出真跑过）/ 含 **1 处命令语法错误**（见 §3-N3） | `### 6.1`–`### 6.5` 现存在于 `06:588 / 644 / 689 / 729 / 763`；INV-1..INV-4 各含**公式 + 命令 + 逐字输出**。4 条命令我**逐字复跑**：INV-1 输出 `listDirs → [6 项含 meta]`＋`keys === dirs set: true`＋同一层 tree 字典 —— **与 `06:613-622` 逐字一致**；INV-3 输出五行 `layerOfPath / nookSceneOfPath` 对照 —— **与 `06:707-711` 逐字一致**；INV-4 输出三行 —— **与 `06:747-749` 逐字一致**；INV-2 输出 —— **与 `06:665-670` 逐字一致**。**破绽**：`06:651` 的 `const L={"characters/elias",...(x=>x)({})};` 是**非法 JS**（`SyntaxError: Unexpected string`），且 `L` 全块未使用 ⇒ 该块**照抄不能跑**（但其余行拼出的输出可复现，见 §3-N3）。 |
| 3 | **RB3**（`scene` 指向文件 ⇒ 404 不可达） | **已修** | `06:124` 改为无扩展名文件 `scene=not-a-dir`，`06:218` 给建法 `store.writeFile('characters/ryo/not-a-dir', …)`；`06:236-238` 显式 `scene=office%2Fdesk.md → 400`；`06:795` 明写「含 `.` 的输入恒 400」。`02:159-166 / :469 / :676-677 / :690 / :750-752` 同一口径（400 / 404 分行、A6 与 A6b 分开）。**我复算** `isValidNookScenePath('office/desk.md')=false`、`('unspoken.md')=false`、`('office')=true` —— 与两文档一致。**遗留**：两文档给 file 分支用了**不同 fixture 名**（`02`=`characters/ryo/office` 建为文件，`06`=`characters/ryo/not-a-dir`），且 `06 §2.2` 的 TREE 里 `characters/ryo/office` 是**目录** ⇒ 同 harness 混用会撞（见 §4）。 |
| 4 | **RB4**（`03 §8.2` import 落错模块） | **已修** | `03:494` `import { characterIdOfPath, isNookSceneId, nookIdOf } from '../rules/characters.js';`；`03:495` `import { deriveNookLayers, nookSceneCards, nookSceneOfPath } from '../store/nook-layers.js';`。`03:500` 的模块归属警示仍在。**全文 grep 无残留**（`nookSceneOfPath` 不再出现于 `rules/characters.js` 的 import 行；命中仅剩 `00:665` 的 RB4 历史记录行）。交叉项 `03:55` 的 `isValidNookScenePath(scene: string \| null \| undefined)` **已同步**（契约 `00:362` 同）。 |
| 5 | **RB5**（`05 §10.4` 门禁口径 + 旧断言） | **已修** | `05:404` 现为「**唯一口径：`pnpm test`**」（逐字给出 script 全文），`05:405` 以「**旧断言已被推翻（记录在案）**」标出旧断言并禁引 `docs/nook/01 §⑬`；`05:406` 列入 `pnpm typecheck:extensions`。`06:999` 列入 `pnpm test`（并注明「N1 05 §11.2『`pnpm test` 不存在』已被推翻」），`06:1000` 列入 `typecheck:extensions`。**我核** `package.json`：`test` 与 `typecheck:extensions` 均存在。**遗留**：`06:1003` 仍写「`pnpm probe` 不用跑」，而 `05` 改了 `init-command.ts` 的初始化判据（评审 C-M2 点名的回归面，`probe:init` 存在）—— 见 §4。 |
| 6 | **A-B1**（`nookSceneCards` 落点 + 伪造契约出处） | **已修** | `06:814` 落点 = **`packages/shared/src/store/nook-layers.ts`**（含 `MUST NOT 放 rules/characters.ts` 的理由）；`06:815` `deriveNookLayers` 同行。`06:1043` 把初稿条目**划掉**并写明「本文初稿在此处**误引契约 §5.2 指定了 `rules/`** —— 契约 §5.2 正文**无文件路径**，该引用已删」。**我核**契约 §5.2（`00:396` 标题）确实**未指定文件**，§5.1/§5.3 有 ⇒ 伪造出处已清除。 |
| 7 | **A-B2**（`directChildDirsOf` 返回值口径） | **已修** | `06:463` 期望值现为 **`['a']`**，并附注释「唯一实现 `05:48-57` 逐字 `out.add(rest)` ⇒ 返回裸段名」。**我按 `05:48-57` 的实现逐字复算** `directChildDirsOf(['characters/ryo','characters/ryo/a','characters/ryo/a/b','characters/other'],'characters/ryo')` → **`["a"]`**。`06` 其余 `directChildDirsOf` 断言（`06:446` 签名、`06:475` H 行、`06:479` 引用 `05 §10.2`）**全部对齐裸段名口径**。 |
| 8 | **A-B3**（`04` 单参 `nookScenePathOf`） | **已修**（防回退断言已加，但**正则本身有误报面** → 见 §3-N2） | `04:374` 现为 `nookScenePathOf(state.layer, nookIdOf(characterId)!)`。**全文 grep**：`04` 无第二处单参调用。新增回归锁 `04:680` `assert.match(nook, /nookScenePathOf\(\s*[^)]*,\s*[^)]*\)/)` + `04:681` `assert.doesNotMatch(nook, /nookScenePathOf\([^),]*\)/)`。**我实测这两条正则**：对 `nookScenePathOf(target, nookId)`、`nookScenePathOf(state.layer, nookIdOf(characterId)!)` 判定正确（`doesNotMatch` 通过）；**但对 `nookScenePathOf(dirOf(p), nookId)`（合法两参、首参含括号）会误报**（见 §3-N2）。 |
| 9 | **B-B1**（夹具事实 `writing/`→`meta/`） | **已修（`00`/`06`）/ 未同步（`02`/`01`）→ 见 §3-N2′（列 §3-N5）** | `00:38` 现为 `meta/ ← **无 README**，内含 1 个 md`；`00:40-41` 挂**夹具漂移警示 + 影响面清单**。`06:45-58` 给「当时快照 / 当日复核实测」两版；`06:60-64` 显式登记 `meta/` **会是一扇门（MUST NOT 以为被排除）**；`N2-A8`（`06:128`）与 `N2-A11`（`06:131`）**已改指 `meta`**。**`git status --short templates/fpal/characters/elias/`**：`D writing/*.md`（3 个）、`?? meta/` ⇒ **无人恢复 `writing/`**，与约束一致。**未同步**：`02` 全文 36 处 `writing`、0 处 `meta`（含 `02:591-593` 响应示例、`02:655-662` A0 期望、`02:673-682` A3/A4/A8/A11/A13 判据、`02:686`「用 `templates/fpal/…` 即满足 A1-A13」）；`01:471` 夹具段同样滞留 `writing/`。 |
| 10 | **B-B2**（契约 §4.3「真正空目录」括注） | **已修** | `00:262` 现写「**`stub` MUST NOT 被读作「真正空目录」**……精确语义是「**本目录层没有可读内容**」，**MUST NOT 据此判定「可以安全重新初始化」**」，并给出「只含孙目录」反例。`06:300`、`06:128` 同口径。 |
| 11 | **B-B3**（`UNWRITTEN · walk in, …` 承诺） | **已修** | `04:416-447`（步骤 14）**登记并选①**；新文案 `04:437` = `'UNWRITTEN · you can still look at the door from outside'` / `'まだ白紙 · 外から扉を確かめられる'`；`04:442` 明写 **MUST NOT** 用「空房间 / empty room」（只含孙目录的情形）。**防回退断言** `04:679` `assert.doesNotMatch(cardRenderer, /walk in, and it will be written/)`。**我核** `CardRenderer.tsx:160` 仍是旧串 —— 正确（设计文档未落地实现）。 |
| 12 | **B-B4**（`scene.body` 无消费点 ⇒ 空画布） | **已修，技术方案我逐符号验证可行** | `04:382-414`（步骤 13）决定**本批做**，落点 `04:561`（`NookView` state 态 `<Canvas>` 之上，`data-nook-zone="scene-intro"`）。**逐项核实**：① `MarkdownText` 存在 `apps/web/src/lib/md.ts:87`，签名 `React.FC<{ text: string; className?: string }>` —— 与用法 `<MarkdownText text={…} />` **匹配**；② `stripLeadingTitle` 存在 `lib/md.ts:116`，`(body: string) => string`，语义＝剥首行标题 ⇒ **合用**；③ `App.tsx:1149` 确以 `MarkdownText` 渲染日记正文（同款用法属实）；④ 「不能加 `data-path`」的依据成立：`NookView.tsx:436` 确有 `rootRef.current?.querySelectorAll<HTMLElement>('.object[data-path]')` 的 ResizeObserver 登记，且 `lib/footprint.ts:84` 也按 `.object[data-path]` 量高 ⇒ 加了会被当卡；⑤ `UI_COPY.collapseScene/expandScene` 齐备（`lib/legacy-ui-copy.ts:6-7`），且 `messages.json` 有对应键 `Fold/Read scene introduction` → `zh-CN: 收起场景开场 / 阅读场景开场`、`ja` 齐 ⇒ **可复用、无需新增键**。 |
| 13 | **`06 §6` 不变量输出（修复 RB2 时新写）** | **通过**（输出真跑过、内部自洽）/ **1 处命令块语法错** → §3-N3 | 见第 2 项。补充自洽性核查：INV-2 的断言 `06:680` 期望 `['characters/ryo/empty-room','characters/ryo/meta','characters/ryo/office']`（字典序）与 `06 §2.2` 的 `TREE.dirs` 及 `childLayers` 的 `.sort()`（`layers.ts:121-128`，**我实读有 `.sort()`**）**一致**；INV-1 的树形输出与 `01 §3.1` 的父链规则一致。**无编造痕迹**（数字自洽、文件均存在）；唯一破绽是 `06:651` 那行非法表达式。 |
| 14 | **`04 §3` 新增步骤 13/14** | **与 00/05 自洽，但引出 1 处新悬空** → §3-N4 | 与 `00 §4.3`（冻结文案禁令）**一致**；与 `05` 的「子场景 init 结构性不可行」（`05:110-116`）**一致**；与 `04:388`「零新符号」、`04:461`「`md.ts` 不改」、`04:456`「复用既有折叠键」互洽。**新悬空**：`04:665` 声明「`06` 已 own 该文件；此处只列 N2d 面」，但 `06` **零处**提到 `scene-intro` / `MarkdownText` / 新文案断言（`grep -c scene-intro 06` → **0**） ⇒ 步骤 13/14 的回归锁**只活在 `04`**，owner 文件 `06` 未承载。 |
| 15 | **`06 N2-A29` 四种输入** | **已修，与契约 §5.1 逐字一致** | `06:149/156-159` 四条期望：`('characters/ryo/office','characters/ryo')→'office'`、`('characters/ryo','characters/ryo')→''`、`('characters/other/x','characters/ryo')→null`、`('characters/ryo/office/','characters/ryo')→null`。**我按 `01 §8.1` 的实现逐字复算**，四条全中（含尾斜杠 `isNookSceneId=false ⇒ null`）。与契约 `00:372-380 / :391`（`''`=合法根、`null`=越界、**MUST NOT 合并**）**一致**。 |
| 16 | 全文「已定写成未决」措辞 | **1 处残留** | `04:151` 仍写「已登记冲突 **C6**（§⑪）**请主 agent 复核**这把双关」，而同一文档 `04:701` 的 C6 行已标「✅ **已裁决**」⇒ **同文档内把「已定」写成「未决」**。其余「请拍板/待拍板」均为**真实未决**（`00 §8 P6`、`02:784` 的 `bg.video`、`06 §13` 1–3/6），非旧口径残留。 |

**其他口径抽查（复核通过、无需改）**：`06:505-511` 的注释与实际正则一致；`06:141-143 / :197 / :266 / :1059` 对 `§6.x` 的四处交叉引用**全部命中**（章节确已存在）。

---

## 2. 新引入的问题（这一轮修复带出来的）

> 结论：**有 5 条**。N1/N2 是「同类缺陷只修了一半」，N3 是 `06 §6.2` 命令块的语法破绽，N4 是 `04` 新增章节引出的悬空，N5 是 `02`/`01` 未随夹具漂移同步。

### N1（**major**）—— `04 §10.4` 逐字保留了 RB1 的同一条坏正则，且自称「与 `06` 对齐」

**位置**：`docs/nook-scene/04-前端视图与导航.md:668-670`。

```js
for (const c of nook.match(/<Canvas\b[\s\S]*?\/>/g) ?? []) {   // ← 正是 review-C B1 判死的旧式
  assert.match(c, /onEnterGate=/, '两处 Canvas 都必须透传（修复前都没有 ⇒ 死点击）');
}
```

**为什么是新问题**：`04:662` 标题逐字「源码级断言（**与 `06` 的 `nook-scene-nav.test.mjs` 对齐**）」，`04:665` 又说「`06` 已 own 该文件」——**读者会据此把这段照抄进测试文件**。而这段是 RB1 的**未修副本**：

```text
$ node --input-type=module -e '…读 NookView.tsx，模拟正确修复后跑 04:668 的旧式…'
04:668 BAD matches: 3 [ 18964, 771, 939 ]
  match 0 hasOnEnterGate false        ← JSDoc 散文吞并两处真 <Canvas>
  match 1/2 hasOnEnterGate true
=> 04 loop assertion would FAIL: true
```

⇒ 与 `06` 已修的版本**结论相反**：`06` 的实现可绿，`04` 的同一断言**在任何正确实现下都红**。这属于「照文档做就做错」，且比单点笔误更贵 —— 它是**已经修好的一条缺陷的复制体**，靠「`06` own 文件」的实际归属才没炸，但设计文档是逐字照抄源。

**建议**：`04:668` 换成 `06:508` 的同款（行首锚定 + `=== 2`），或**删掉这段并改指** `06 §3.7`（既有做法：「见 `06` N2-A26」）。

### N2（minor）—— `04:680-681` 的「两参回归锁」对含括号的首参误报

**位置**：`04:680`/`04:681`。

```js
assert.match(nook, /nookScenePathOf\(\s*[^)]*,\s*[^)]*\)/);
assert.doesNotMatch(nook, /nookScenePathOf\([^),]*\)/);
```

**实测**（`node -e`）：

| 输入（合法/非法） | 正锁 `match` | 反锁 `doesNotMatch` | 判定 |
|---|---|---|---|
| `nookScenePathOf(target, nookId)` | ✅ | ✅ | 正确 |
| `nookScenePathOf(state.layer, nookIdOf(characterId)!)` | ✅ | ✅ | 正确 |
| **`nookScenePathOf(dirOf(p), nookId)`**（合法两参） | ❌ **漏报** | ❌ **误报** | **错** |
| `nookScenePathOf(state.layer)`（单参） | ❌ | ❌ 正确报错 | 正确 |

⇒ 两条正则都把「首参含 `(` 或 `,`」的合法两参调用判成「单参残留」：反锁会**在正确实现上红**（同 RB1 家族），正锁会漏判。**建议**：改用 `assert.doesNotMatch(nook, /nookScenePathOf\([^,()]*\)/)`，或干脆**只数逗号**（`nookScenePathOf(` 之后到配平 `)` 前必须恰有 1 个顶层逗号），或**放弃正则、改断 `nookScenePathOf(` 出现次数与 `,` 计数**。

### N3（major）—— `06 §6.2` 的命令块含**非法 JS**，照抄不能跑

**位置**：`docs/nook-scene/06-验收与回归.md:651`。

```js
const L={"characters/elias",...(x=>x)({})};
```

**实测**：`node --input-type=module -e "$(sed -n '650,659p' docs/nook-scene/06-验收与回归.md)"` →

```text
const L={"characters/elias",...(x=>x)({})};
         ^^^^^^^^^^^^^^^^^^
SyntaxError: Unexpected string
```

且 `L` 在整块中**从未被引用**（后续全用 `nookLayers`）。⇒ 这是一行**残留/占位**，混进了「提案前自己跑过」的命令区。**判断**：输出本身**不是编的**（删掉该行后其余行复现出与 `06:665-670` 逐字一致的输出，我已跑过），但该块**当前形态确实跑不过** —— 恰好落在「可机械核验」这个最不该出错的位置。**建议**：删掉 `06:651`（`L` 无用）。

### N4（minor）—— 步骤 13/14 的回归锁在 owner 文件（`06`）里没有落点

`04:665` 把新断言的归属交给 `06`，但 `06` 全文没有 `scene-intro`（`grep -c` = 0）、没有 `MarkdownText`、没有 `walk in…` 的反向断言。⇒ `04 §10.4` 末尾 4 行（`04:676-679`：横幅存在 / 复用 `MarkdownText` / 横幅无 `data-path` / 不再承诺）是**孤儿断言**：`06 §2.1` 的 `nook-scene-nav.test.mjs` 覆盖项只写着「门牌接线与 `isRootScene` 门」。**建议**：`06 §2.1` 与 `§3.7` 补上这几条（或 `04` 改为「本文自有断言，不并入 `06`」并停止声称对齐）。

### N5（major）—— `02`（与 `01`）未随 `writing/`→`meta/` 的夹具漂移同步

`00`/`06` 已修（见 §1 第 9 项），但：

- `02:591-593` 的**响应示例 1**仍把 `characters/elias/writing/README.md` 作为根场景的第 6 张门牌；
- `02:655-662` 的 **A0「修复前失败」断言**期望 `root.items` 含 `characters/elias/writing/README.md`；
- `02:673-682` 的 **A3/A4/A8/A11/A13** 全部以 `?scene=writing` / `writing` 门牌为判据（A8 逐字「`writing` 门牌 `stub===false`（它有 3 张卡）」）；
- `02:686` 逐字「本批的 fixture **真实存在**，用 `templates/fpal/characters/elias/` 即满足 A1-A13 的绝大多数」；
- `01:471` 的 `nookSceneCards` 夹具段同样滞留 `./writing/note-a.md`。

**实测**：`templates/fpal/characters/elias/` 现无 `writing/`、有 `meta/`（`ls` + `git status`）；`02` 全文 `writing` 36 处、`meta` **0 处**。⇒ 这些判据**在当前夹具上不可达**（与 RB3 同类：断言在任何实现下取不到期望）。因为 `02 §10.2` 声明「本片只给判据、`06` 复制」，污染会**传导到 `06`**。

**建议**：`02` 按 `06` 的做法加漂移段并把 A0/A3/A4/A8/A11/A13 的 `writing`→`meta`（同步改「3 张卡」→「1 张卡」等**数目**）；`01:471` 的合成夹具段明确标注「合成夹具，非真实树」。

---

## 3. 仍缺的 / 建议

**进实现前的条件（3 条，必修）**

1. **N1**：`04:668` 换掉坏正则（违背则「两处 `<Canvas>` 都传 `onEnterGate`」在正确实现上恒红）。
2. **N5**：`02`（连带 `01:471`）把夹具事实同步到 `meta/`，并补漂移段（违背则 `02 §⑩` 的 A0 与一半判据不可达，且会被 `06` 照抄）。
3. **N3**：删 `06:651` 的非法行（违背则 `06 §6.2` 的命令块自证「没跑过」）。

**建议（不阻断，但值得顺手）**

- **N2**：收紧 `04:680-681` 的正则（当前对含括号首参的合法调用误报）。
- **N4**：把步骤 13/14 的 4 条断言落到 `06 §2.1`/`§3.7`，或让 `04` 停止声称「与 `06` 对齐」。
- **`06:1003`**：`pnpm probe` 的「不用跑」偏窄 —— `05 §8.2` 改了 `extensions/toolkit/init-command.ts` 的初始化判据，而 `tools/probe-init.mjs` 有 `kind:'nook'` 用例（`package.json` 有 `probe:init`）。建议至少点名跑该用例，或写明「已评估、本批不跑」。
- **file 分支 fixture 名不统一**（RB3 尾巴）：`02 A6` 用 `characters/ryo/office`（建为文件），而 `06 §2.2` 的 `TREE` 里 `characters/ryo/office` 是**目录** —— 同一 harness 混用会互相破坏。建议统一到 `06` 的 `not-a-dir`（`02:164` 已声明「夹具建法归 `06`」，只差把示例名换掉）。
- **`05:226/230`** 仍写「`isEmpty` **已与**收紧后的 `isNookEmpty` **等价**」，而 `06:1036` 登记「**不是完全同源**」⇒ 与评审 B 的 F6 同类，**未同步**。建议 `05` 加一句「字面等价成立于「卡 = `nookSceneCards`」前提；非 md 直接子级（如 `base.png`）会让后端判非空、前端判空」。
- **`06:481`** 仍写「漏 A20 → **W2 兜底**把…判为失败」，而 `05:441` 实测更正为 nook 分支 `fallback === 'none'`（`init-command.ts:348`），**不走 W2**。`06` 未同步该更正（评审 B 的 F9 残留）。建议只改这一行的措辞。
- **`04:151`** 的「请主 agent 复核 C6」与同文档 `04:701` 的「✅ 已裁决」冲突 ⇒ 把 `04:151` 改为「见 §⑪ C6（已裁决）」。
- **`06:586`** 称「评审 C 独立复跑了同样四条并给出一致结果（报告 §2.5/§5）」—— 评审 C 实跑的是它的 I1–I6 与竞态表，**非这四条 INV**（数值结论相同，但「同样四条」措辞过强）。建议改为「结论与评审 C §2.5/§5 的独立复跑一致」。

---

## 附：本文用到的复跑命令（可复现，均为纯逻辑，未跑全量 build/test/lint）

```bash
# 1) RB1 / N1：两种 <Canvas> 正则（含「模拟正确修复」）
node --input-type=module -e '…读 NookView.tsx；再给两处 /^\s*<Canvas\b/ 各插一行 onEnterGate=…'
#   旧式 → 3 match [18964,729,897]（match0 无 onEnterGate）；新式 → 2 match [741,907]

# 2) RB2 §6.1 INV-1（复刻 listDirs walk + 祖先扫描）
node --input-type=module -e '…fs.readdirSync(templates/fpal/characters/elias)…'
#   listDirs → 6 项（含 meta）；keys === dirs set: true

# 3) RB2 §6.2 INV-2（真调 dist/store/layers.js）
node --input-type=module -e 'import { childLayers, layerOfPath, cardsOfLayer } from "./packages/shared/dist/store/layers.js"; …'
#   doors(root)=5 含 meta；doors(office)=[]；layerOfPath(office/README.md)=characters/elias/office；cardsOfLayer(root)=[unspoken.md]

# 4) RB2 §6.2 命令块的可执行性（N3）
node --input-type=module -e "$(sed -n '650,659p' docs/nook-scene/06-验收与回归.md)"
#   SyntaxError: Unexpected string  ← const L={"characters/elias",...(x=>x)({})};

# 5) RB2 §6.3 INV-3 / §6.4 INV-4
node --input-type=module -e '…layerOfPath vs nookSceneOfPath 五行…'   # 与 06:707-711 逐字一致
node --input-type=module -e '…nookCardPaths / cardsOfLayer 三行…'      # 与 06:747-749 逐字一致

# 6) A-B2：按 05:48-57 逐字复算
node -e 'function directChildDirsOf(dirs,dir){…}; …'                    # → ["a"]

# 7) A-B3 / N2：两参回归锁的误报面
node -e 'const one=/nookScenePathOf\([^),]*\)/, two=/nookScenePathOf\(\s*[^)]*,\s*[^)]*\)/; …'
#   nookScenePathOf(dirOf(p), nookId) → one.match=true（误报）、two.match=false（漏报）

# 8) B-B4：符号存在性/签名/观察器/文案键
grep -n "export const MarkdownText\|export function stripLeadingTitle" apps/web/src/lib/md.ts
grep -rn "object\[data-path\]" apps/web/src/
node -e 'const m=require("./apps/web/src/lib/messages.json"); …["Fold scene introduction"]…'

# 9) B-B1：夹具现状与「无人恢复 writing/」
ls -a templates/fpal/characters/elias/
git status --short templates/fpal/characters/elias/
```

---

## 4. 收口追加复核（本文交卷后，11:30–11:42 复跑）

> 本文交卷后我又复跑了一遍。期间 `01`/`02`/`04`/`06` 的 mtime 推进到 11:31–11:37 ⇒ **有会话在并发修**。以下为**以符号名复跑得到的最新状态**；行号按你读本文时的最新版重取。

### 4.1 我报的新问题：3 条已修、2 条仍在

| # | 我报的问题 | 最新状态 | 证据 |
|---|---|---|---|
| **N1** | `04 §10.4` 的坏 `<Canvas>` 正则 | ✅ **已修** | `04:672-674` 现为注释说明，逐字含「**该断言【由 `06 §3.7` 持有】，本文不重复**……落地时**只改 `06` 一处**」；`grep 'match(/<Canvas\b' 04` → **零命中**。 |
| **N2** | `04` 两参回归锁对含括号首参误报 | ✅ **已修** | 反锁改为 `/nookScenePathOf\(\s*[A-Za-z_$][\w.$]*\s*\)/`。**我重跑 5 例**：单参 `nookScenePathOf(state.layer)` → **FLAG**；`(target, nookId)` / `(state.layer, nookIdOf(characterId)!)` / **`(dirOf(p), nookId)`** / `(nookId, scene)` → **全 pass** ⇒ 误报面已消除。 |
| **N3** | `06 §6.2` 的 `const L={"characters/elias",…}` 非法行 | ✅ **已修** | `grep 'const L={"characters/elias",' 06` → **零命中**。**我对 `06` 全部 4 个 `--input-type=module` 块做 `node --check`**：全部 **OK**。 |
| **N4** | 步骤 13/14 的断言在 `06` 无落点 | ✅ **已修** | `06` 新增 `N2-A30`（`06:150`）/`N2-A31`（`06:151`）及其测试体（`06:549-583`，`N2-A30/A31/A32/A33`）。`06:590-592` 还逐字记录了「两种邻近性正则都会误报/漏报，正解是先切标签再判」——**这个推理是对的，我复核同意**。 |
| **N5** | `02`/`01` 未随 `writing/`→`meta/` 同步 | ✅ **已修** | `02:238` 改指 `characters/elias/meta/`；`02:240-242` 补**漂移段 + 显式说明「现场构造的对照，不是 `templates/fpal/` 的真实世界目录」**；`02:263-265` 补 `meta/` 实测细节 **+ `writing/` 历史快照**；`02:702-716` 的 A1–A13 全部改指 `meta` 且**数目同步**（A3 「3 项」→「1 项」、A8「3 张卡」→「1 张卡」、A11「3 行」→「1 行」）；`01:471` 已改指 `meta/agent_selfframework.md` 并注明「当日实测：`writing/` 已不存在，改名为 `meta/`（1 md）」。 |

### 4.2 ⚠️ 新出现的 **N6（blocker）**：`02 §10.1` 的 A0 代码块被改坏了

`02 §10.1`（fence 标 ` ```js `，**非**示意用）现在是**语法错误**的：

```js
// 02:675-684 当前逐字
assert.notDeepEqual(          // ❌ 修复前 root 与 office 的 items 逐字相同 ⇒ 这条【失败】
  office.body.items.map(i => i.path),
  root.body.items.map(i => i.path),
  'scene=office must not return the root scene'      ← 缺 `);`
const office = await get('/api/nook?character=elias&scene=office');   ← 重复声明 + const 重复
assert.equal(office.body.layer, 'characters/elias/office');
```

**实测**：

```text
$ node --check <(sed -n '675,695p' 02-取数端点与门牌.md)
SyntaxError: missing ) after argument list
  at 02-取数端点与门牌.md:7  → 'scene=office must not return the root scene'
```

**性质**：这是 N5 修复过程中**新引入**的（`:679` 的 `assert.notDeepEqual` 少了 `);`，且第 `:682` 行重复了一次 `const office = …` ⇒ **同一作用域重复 `const`**）。与 N3 完全同型（「命令/断言块照抄不能跑」），但**更靠前**（A0 是评审 C 点名的「本片核心修复前失败断言」）。**必修**：补 `);`、删掉重复的 `const office` 行、并保持其余 A0 内容。

### 4.3 ⚠️ 新出现的 **N7（blocker）**：夹具**又被改了一次、而且这次已 commit** —— `00`/`06` 的夹具事实**第二次失效**

我上一条（N5）按「`writing/`→`meta/`，`meta/` 只有 1 个 md，根只有 `unspoken.md` 一张卡」报。**但在我复核期间夹具又变了一轮，并已落地为提交**：

```text
$ git log --oneline -3
31f0469 2026-09-15 11:27:45 update elias
21e46ae 2026-09-15 11:26:38 fix(shared): 落地 04 §9.2 的 append_body …
0424fe8 2026-09-15 11:25:16 update elias          ← 正是这次把 writing/→meta/ 并新增卡片

$ git status --short templates/fpal/characters/elias/     # → 空（0 行）
```

**现在与 `00`/`06` 的记载不符之处**（均为我 `node`/`ls`/`git` 实测）：

| `00`/`06` 的记载 | 实测（HEAD 已提交） |
|---|---|
| `unspoken.md ← 唯一直接子级卡`（`00:33`、`06:48`、`06:255`） | **根有 4 张 `nookCardPaths` 卡**：`pothos-reforged.md`、`rough-cloud.md`、`still-life.md`、`unspoken.md`（实测 `nookCardPaths(...)` 返回这 4 个） |
| 各子场景「有 README、**无卡**」（`06:53-57`、`02 §10.0` 请求 2 `items: []`） | **每个子场景各 1 张卡**：`office/workday-portrait.md`、`balcony/watering-portrait.md`、`living-room/sofa-portrait.md`、`parallel-timeline/forbes-cover.md`（实测 `cardsOfLayer(sub)` 各返 1 项） |
| `.shot_cloud.png  .shot_still.png` 在根（`06:52`） | **不存在**（`ls -a` 无此二文件；`git log --all` 显示早已删除） |
| 「`writing/` 已被外部会话改名/移动……属**他人未提交的在途工作**」（`00:40`、`06:45/60/1111`） | **已提交**（`0424fe8` 做了 rename `writing/`→`meta/`），`git status` 干净 ⇒ 「未提交的在途工作」这一表述**已过期** |

**为什么是 blocker（而不是又一笔 cosmetic）**：
1. `06:255` 的「修复前的实测观测：根 `items` = `['characters/elias/unspoken.md']`」若被当成当前基线，**A0/A6 的「修复前」判据少 3 项**；
2. `06:53-57` 的「无卡」与 `02 §10.0` 一致地给出 `items: []`，但**实测各子场景有 1 张卡** ⇒ 任何照抄的 `deepEqual(items, [])` 会**红**；
3. 「未提交在途、MUST NOT 碰」的告诫现在指向一个**已提交**的状态 —— 读者会据此误判「不要去改夹具」，而它其实已经是其他人的**正式**提交。

**已自我修正的部分（值得记功，也说明这套文档的自我纠错是有效的）**：`02` 已在复核期内跟上到 4 卡 + 1 卡/场景（`02:565`「根场景有 4 张卡…」、`02 §10.0` 请求 1 含 3 张 `kind: 'photo'`、请求 2 `items` 有 `workday-portrait.md`、`:702` A1「**4 个**卡（3 张 `kind='photo'` + `unspoken.md`）」、`:721` 明写「夹具数量会漂」）—— **而且我逐字验算过其 `rot` 值：`02 §10.0` 的 11 个 `rot` 与 `rotOf()` 实测**全部一致（含 `meta/README.md` 的 `-2`、`workday-portrait.md` 的 `-2`）⇒ **`02` 的当前样例数据是真的跑过的**。所以缺口只剩 `00`/`06` 未跟到这一轮。

**另核**（`02` 的相对 `world/meta/…` 对照）：`02:258` 已显式写明「**现场构造的对照，不是 `templates/fpal/` 的真实世界目录**」⇒ 我原报的「需甄别」一条**已按要求处理**。

### 4.4 更新后的放行条件

原 §3 的条件 1–3 **已在复核期内被别人修掉**（见 4.1）。**当前必须修的只剩两条**：

1. **N6**：`02 §10.1` A0 代码块补 `);`、删重复 `const office`（实现者会照抄这段）。
2. **N7**：`00 §1` 与 `06 §2.2 / §3.1 / §3.2` 跟到**已提交**的夹具（根 4 卡、每子场景 1 卡），把「`unspoken.md` 是唯一卡」「子场景无卡」「.shot_*.png」「未提交的在途工作」四处改掉；`02` 已给出可直接引用的当前数据（`02 §10.0` / `§Δ` 表）。

**未变的好消息**：`06 §6` 的 INV-1..INV-4 命令块**全部 `node --check` 通过**，且我逐字复跑的输出与文档一致；`06` 的 INV-1 不变量**仍成立**（`meta/` 替换 `writing/` 后 `listDirs` 仍是 6 项、`keys === dirs set: true`）—— 这正是 `06:625` 自称的「不变量与本目录是否改名无关」，**该论断被我的复跑证实**。
