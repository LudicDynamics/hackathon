# L3 评审（角度：诚实性）—— 文档断言 vs 代码/实测

> 评审者：`ReviewL3Honesty`（L3 批次评审门，第三名评审，**只读**）。
> 角度：**诚实性**——文档里的断言是否与代码 / 实测一致；有无假绿、过度声明、隐藏的未验证前提。
> 方法：对每一条承重断言**回到代码与真跑的门禁**核对，不采信文档自述。所有结论附 `file:line` 或实测命令输出。
> 核验时间：2026-09-15（工作树 `HEAD = 13e3c71`，13:32:04）。**注意：本批文档在评审期间被并行修订**，本文对每条给出「评审时状态」与「是否已修」。
> **本文不改任何实现文件**；仅记录发现。

---

## 0. 结论摘要

5 份设计文档（`31`–`35`）与契约 `30` 的主体是**可信的**：绝大多数承重 `file:line` 引用、门禁基线数字、CSS 语义与既有断言盘点**逐条复核属实**（§1 的 ✅ 项）。尤其值得肯定的是三处**主动自曝**：`30` §5.2 的错误断言被标记 ❌ 并给出证伪链、`32` §10.1 自曝渲染组 skip 假绿并按 `skipped` 数立据、`33` §5.0 对 `opacity` 引理的表述**与浏览器实测方向一致（没有说反）**。

但本批**仍存在 3 条「断言与事实相反」的未修问题**（F3/F4/F5），它们会直接让实现方**写出一条注定变红的断言，或误以为有门禁兜底**：

| 编号 | 位置 | 性质 | 严重级 | 评审时状态 |
|---|---|---|---|---|
| **F1** | `35` §0/§3-T2/§7.1/§10-A6/§11-W1/§12-C1（8 处） | 声称 `UF-3a` 计数 `3→4`；实测**两道独立门**都要求**逐字不变仍为 3** | **阻断** | 已修（`35` mtime 13:58，全文改「逐字不变（仍 3）」） |
| **F2** | `33` §7.3（:288） | S4b `onClick` 写成 ``liveCallStop(`rail:${railCallOwner}`)`` ⇒ 传 `rail:rail:<id>` ⇒ 按钮**渲染出来但永远不做事** | **阻断** | 已修（:290 改为原样传递；`30` §5.4 冻结 10 新立） |
| **F3** | `31` §6.3-A8 vs §4.2-N-3 | A8 要求 `NookView.tsx` **不含** `copy.liveCallConnecting`，而同文 N-3 明确**保留** `:716` 的该用法 ⇒ **A8 必红** | **高** | **未修** |
| **F4** | `31` §3.2（:90）vs §6.2-S3（:364-365） | 文档规定的 props JSDoc 里逐字写着 `owner` / `characterId`，而 S3 断言源码**不得出现**这两个词 ⇒ **S3 必红** | **高** | **未修** |
| **F5** | `33` §7.2 / `35` §2.5 | 声称「穿透 `.prototype-chrome` 的 CSS 会被 `css-declaration` 报 `pointer-events: auto` finding」——**实测 0 finding** | **高** | **未修**（`33` mtime 13:53 仍未改；`35` mtime 13:58 仍未改） |

其余为**基线数字整批过期一提交**（F10）、**行号漂移残留**（F8）、**数量/算术小错**（F11/F12）与**内部残留过期表述**（F9/F13/F14），详见 §2。

---

## 1. 承重断言逐条核验（任务书点名的 10 条 + 追加）

### 1.1 `31` 声称「组件只用 4 个 `messages.json` 既有键、新增 0 键」——✅ **属实**

实测（`JSON.parse` 后逐键判定）：

```
"They say"      {"zh-CN":"对方说","ja":"相手の声"}          HAS
"You"           {"zh-CN":"你","ja":"あなた"}                HAS
"Connecting…"   {"zh-CN":"正在连接…","ja":"接続しています…"}  HAS
"Listening…"    {"zh-CN":"聆听中…","ja":"聞いています…"}      HAS
```

四键均含 `zh-CN` + `ja`，`en` 即 key 本身（`i18n.ts:12` 的 `locale === 'en' ? key : …`）⇒ **新增 0 键成立**。`messages.json:1214/1216/1217` 的行号引用亦**逐字命中**。

### 1.2 `31` 声称「删 `.call-line` 等 class 安全（只有两处引用）」——✅ **属实**

```
$ grep -rn "call-line|call-speaker|call-placeholder" apps/web/src packages
apps/web/src/components/overlay/CharacterModal.tsx: 984,985,990,991,996,997,1002,1003,1008
apps/web/src/index.css: 851-857（定义）
```

命中**恰为两处**：`index.css:851-857`（定义）与 `CharacterModal.tsx:984-1008`（使用）。`prototype.css`、`NookView.tsx` 零命中（nook 用 Tailwind utility）⇒ `31` §4.1 Step D-3 的删除**安全**，U4 的结论为真。

### 1.3 `32` 声称「UF-3a 计数在门控下仍为 3、零测试改动」——✅ **结论属实**，但 **`35` 在同一数字上相反（见 F1）**

`32` 自己披露了「依赖 skip 修复才成立」。核验其**披露是否充分**：

- 披露**充分**且**方向正确**：`32` §2.2 明确写「skip 时改计数是空操作，本节结论只在 §10.1 修复同批落地后才成立」，§5.3-T2 再次写「MUST 在 T-1 落地后复跑确认，否则是『改了计数而断言没跑』的假绿」。
- **但 `32` 只写了一条门（`available`）**，漏了**更根本的第二条门**：`UF-3a` 渲染的是 `state:'absent'` 视图（`character-rail.test.mjs:157` 逐字 `render([view({ state: 'absent', … })])`），而 `railEntry`（`character-rail.mjs:23`）是 `canTalk: inScene` ⇒ **即使 `available` 为 true，absent 视图仍不渲染麦克风**。实测：

```
state=in-scene   canTalk=true   → mic WOULD render
state=elsewhere  canTalk=false  → mic does NOT render
state=absent     canTalk=false  → mic does NOT render   ← UF-3a 用的就是这个
```

- 我**独立复现**了 `32` §10.1 的核心实测（临时给 `character-rail.test.mjs` 的 esbuild 加 `define: { 'import.meta.env.BASE_URL': '"/"' }`，跑完即 `md5sum -c` 复原）：

```
修复前：ℹ tests 23 | pass 12 | fail 0 | skipped 11
修复后：ℹ tests 23 | pass 23 | fail 0 | skipped 0     ← 与 32 §10.1 逐字一致
```

另测 `renderToStaticMarkup` **从不调用 `subscribe`**（故 `ensureConfig` 不会被触发、`available` 停在 `let available = false`，`live-call-store.ts:323`）⇒ 「静态渲染下 `available` 恒 false」这条机制链**为真**。

⇒ **两道门独立成立，`count(class="character-rail__action") === 3` 逐字不变。`32` 对，`35` 错。**

### 1.4 `32` 声称「在场性裁决：不在场角色 MUST NOT 发起通话」——✅ **理由链属实**

- `railEntry`（`character-rail.mjs:19-36`）的 `canTalk`（`:23`）= `view.state === 'in-scene'`，非 in-scene 给 `talkHintKey`（`:27-29`）——**逐字属实**。
- orb 已按 `canTalk` 分支（`CharacterRail.tsx:105-108`：`if (entry.canTalk) onOpenCharacter(view.id); else if (entry.talkHintKey) notify(t(entry.talkHintKey));`）——**属实**。
- 后端只校验 nook 目录（`apps/server/src/routes/live.ts:93-99` 的 `statKind(nookId) !== 'dir'` → 404），**不校验在场**——**属实**。
- 既有断言 `character-rail.test.mjs:47-49`（`inScene.canTalk === true` / `elsewhere/absent.canTalk === false`）与 `:81-88`（hint 键）**逐字在位** ⇒ 裁决「与既有断言自洽」**成立**。

⚠️ **但有一处口径缺口**（见 F9）：`30` §11 表第 6 行已把该条**写死为裁决**，而 `32` §12-1 仍写「**待评审确认**」、`35` §13-4 仍写「本批**仍未裁决**」。

### 1.5 `32` 声称「`available` 只门入口、不门通话态」——✅ **属实，且依据逐字同型**

依据链**可机械核验**：`CharacterModal.tsx:147` 的 `modeSwitchVisible = liveCallAvailable === true` 门的是**整块模式切换**（入口），而 `:146` 的 `callVisible` **与 `available` 无关**（实测源码逐字）。`32` §3.6 的风险论证（`setAvailable(false)` 在 `:503` 的 catch 分支可瞬时触发）也**与代码一致**：`setAvailable` 的调用点只有 `:501`（成功）与 `:503`（catch 失败）两处。

### 1.6 `33` 的 CSS 引理——✅ **表述与实测一致，没有说反**

这是任务书点名要查的一处。`33` §5.0（:102-128）的表述：

| 属性 | 祖先设值后后代能否救回 | 文档结论 |
|---|---|---|
| `opacity: 0` | **不能**（合成相乘） | 与实测一致 |
| `visibility: hidden` | **能**（可继承） | 与实测一致 |
| `pointer-events: none` | **能** | 与实测一致 |
| `opacity: 0`（**对命中**） | **不适用**——`elementFromPoint` 仍返回后代 ⇒ **只挡视觉、不挡命中** | 与实测一致 |

**关键是它把方向说对了**：`33` §5.0 表第 4 行 + §5.0 的「⚠️ 补精度」段（:122）明确写「**`opacity:0` 挡住的是「视觉」，不是「命中」**」，并据此把验收判据钉成「MUST 用 `checkVisibility({opacityProperty,visibilityProperty})`，**MUST NOT** 只查 `elementFromPoint`/DOM 存在性」。**恰恰是因为「可点但不可见」更危险，才必须用视觉可见性**——这个方向是对的。`35` §3 的同款段落亦一致。**没有说反。**

### 1.7 `34` 声称「`fail()` 不 `releaseLocal`」——✅ **属实**

```
live-call-store.ts:416-418   function fail(error) { commitState({ phase: 'error', error: errorText(error, activeLocale) }); }
live-call-store.ts:389       function releaseLocal()
live-call-store.ts:634/667/685/698   releaseLocal() 的四处调用点（无一处是 fail）
```

⇒ `fail()` 只改相位、不释放本地资源；`onCharacterFrame` 的 `error` 分支（`:477-482`）亦只 `commitState({phase:'error'})`。**`34` §6.1 的事实基础成立**（error 态下麦克风/peer 可能仍活着）。

### 1.8 `34` 声称「缺陷 2 阴影面不被 `35` 规则 6 抓到」——✅ **属实**

`35` §2.5 规则 6 的判据是 `required-source` 锚 `disabled={callActive && call.characterId === characterId}` + `forbid: ["disabled={callActive}"]`——**只锚 `.dialogue-modes` 那一行**。而 `34` §7.2 指的阴影面是 `:879` 的 `callActiveRef.current = callActive` 镜像 + 其 8 个读点（`:433/:445/:451/:595/:608/:661/:672/:846`，**逐个实测在位**）⇒ 门禁**确实抓不到**。`34` 据此要求 `35` 补一条 `required-source`（`34` §10-W2）——这是一条**正确且诚实**的缺口登记。

### 1.9 `35` 声称「MUST NOT 把 `LiveCallTranscript.tsx` 加进 `CONSUMERS`」——✅ **理由为真**

`31` §3.2 的组件是 props 驱动的（`lines`/`call`/`className`），`31` §6.2 S1 还断言它**不得**值导入 store ⇒ 零帧字面量。`check-ws-contract.mjs` 的 `CONSUMERS`（`:48-70`，**实测 9 条**）语义是「消费某帧」；实测今日消费面账面与 `35` §2.1 表**逐字一致**：

```
25 apps/web/src/state/useWorld.ts
 0 apps/web/src/App.tsx
 0 apps/web/src/lib/live-call.ts
 0 apps/web/src/components/nook/NookView.tsx
 4 apps/web/src/lib/live-call-store.ts   (character_delta/message/idle/error)
 3 apps/web/src/components/overlay/CharacterModal.tsx
 2 apps/web/src/components/overlay/dialogue-pages.ts
 2 apps/web/src/components/chrome/CanvasArrangeControl.tsx
 9 apps/web/src/lib/writer-state.ts
UNION 26
```

⇒ 「加了就是假登记（会稀释 `dark` 检测）」**理由为真**。

### 1.10 `35` 声称「`check-live-voices` 不变、L4/L5 不存在」——✅ **属实**

```
$ grep -n "L0|L1|L2|L3|L4|L5" tools/check-live-voices.mjs
:64 L0   :81 L1   :106 L2   :167 L3        （无 L4/L5）
$ grep -rn "LIVE_VOICE_GENDER|genderOf" tools/ packages/ apps/   → 仅 node_modules 噪声命中
packages/shared/src/rules/voices.ts:22   export type VoiceGender = 'female' | 'male';
$ node tools/check-live-voices.mjs → ALL GPT-LIVE VOICE ASSERTIONS PASSED
```

`11` 处 `check(…)` 调用点亦与 `35` §1 的「11 处」**逐字一致** ⇒ 「L2 的 `13 §2.4` 是一份未兑现的排期」**为真**，且 `35` 给它的时间戳处置正确。

### 1.11 追加：`30` §5.2 的错误断言是否留残余——✅ **主错误已完全修正**，仅剩行号漂移

`30` §5.2（:188-208）已带 ❌ 标记记录原错误断言，给出证伪链（Tab → `shell.immersive` → G-B 隐藏角色栏根），并立**冻结 8b**。**无残余的方向性错误**。仅 `:195` 的守卫行号曾写 `:710`（实测 **`:708`**）——**已修**（现文写 `:708`）。

### 1.12 追加：`30`/`31` 的 nook zone 枚举与两扇门——✅ **逐字命中**

```
$ grep -n 'data-nook-zone=' apps/web/src/components/nook/NookView.tsx
486 topbar / 531 canvas / 533 character-media / 638 left-lane / 647 notice / 677 notice / 686 call / 746 transcript / 792 note
$ grep -c prototype-chrome apps/web/src/components/nook/NookView.tsx → 0
```

`33` §3.1 表的 9 行（含未来项 `scene-intro`）**逐行命中**，`prototype-chrome` 零命中**属实**。

---

## 2. ❌ / ⚠️ 清单（严重级 + 修正建议）

> 约定：**❌ = 与事实相反**；**⚠️ = 部分属实 / 前提缺失 / 已过期**。

### F1 ❌【阻断】`35` 全文 8 处「UF-3a 计数 `3→4`」与实测相反

- **证据**：`35` 的 `:14`、`:22`、`:286`、`:322`、`:390`、`:424`、`:451`、`:507`、`:565`、`:479` 反复要求把 `character-rail.test.mjs:164` 的 `3` 改成 `4`，并称「`DesignRailEntry` 已裁定方案 A（⇒ 必红）」。实测两道**独立**门（§1.3）都要求**保持 3**：
  1. `UF-3a` 用 `state:'absent'` 视图 ⇒ `canTalk=false` ⇒ 麦克风不渲染；
  2. 静态渲染下 `isAvailable()` 恒 false（`renderToStaticMarkup` 不 `subscribe`）。
- **影响**：若按 `35` 执行，会**把正确的 3 改成 4 并把测试改红**，随后为「修绿」再去动别的——这是本批第四次「测试绿 ≠ 安全」的变体。
- **修正建议**：`35` 全文改「**逐字不变（仍 3）**」并写明双门理由；`35` §10-A6 的「`fail` 指向 UF-3a ⇒ 计数没改 4」须删除（该判据方向相反）。`32` §2.2 SHOULD 补上**第二条门（`canTalk=false`）**——现在只写了 `available` 一条。
- **状态**：**已修**（评审期间，`35` mtime 13:58，全部 8 处改为「逐字不变（仍 3）」并写明双门理由；`§10-A6` 的反向判据也已改写为「若 `fail` 指向 UF-3a，说明有人**多渲染了一个** `character-rail__action`，去查双门控是否被去掉」——方向已纠正）。

### F2 ❌【阻断】`33` §7.3（:288）S4b 的 `onClick` 双前缀 ⇒ 按钮静默失效

- **证据**：`32` §4.2（:368-370）的 `railCallOwner` 定义是「`liveCall.owner` 若以 `rail:` 开头则**取原值**」⇒ **已含前缀**，调用 `liveCallStop(railCallOwner)` 正确；`33` §7.3（评审时 `:288`）却写 `` onClick={() => void liveCallStop(`rail:${railCallOwner}`)} `` ⇒ 实参 `rail:rail:<id>` ⇒ `stop` 首行守卫（`live-call-store.ts:642`）**静默 return** ⇒ **唤醒按钮渲染出来但永远不做事**，`33` §5.2 情形 C 的空集性补丁当场失效。`32` 自称「照抄 `33` 不另立」⇒ 实现方抄 `33` 就中招。
- **性质**：**「按钮渲染出来、点了没用」的静默失败**——外观全对、只查存在性的断言也全绿，但功能为零。
- **修正建议**：`33` 改为原样传递；契约补一条「owner MUST 原样传递，MUST NOT 再拼前缀」+ 一条**行为断言**（不只断言按钮存在）。
- **状态**：**已修**（`33:290` 已改；`30` §5.4 冻结 10 已立，含「验收 MUST 证明 `stop('rail:X')` 真的生效」）。

### F3 ❌【高】`31` §6.3-A8 与 §4.2-N-3 自相矛盾（A8 必红）

- **证据**：`31` §4.2 Step N-3（:263）逐字保留 `copy.liveCallStart/Stop/Live/Connecting`（`:699/700/716/718/728`）与 `copy.liveCallModalBlocked`（`:192`）；而 `NookView.tsx:716` **正是** `? copy.liveCallConnecting`。`31` §6.3 的 A8（:382）却断言 `NookView.tsx` **「不再含 `copy.liveCallThem` / `copy.liveCallYou` / `copy.liveCallConnecting`」**。

```
$ grep -n "copy.liveCallConnecting" apps/web/src/components/nook/NookView.tsx
716:  ? copy.liveCallConnecting        ← N-3 明确保留（call lane）
754:  {copy.liveCallConnecting}        ← N-3 删除（transcript lane）
```

⇒ 迁移后 `copy.liveCallConnecting` **仍在文件里** ⇒ **A8 必红**。
- **修正建议**：A8 只断 `copy.liveCallThem` / `copy.liveCallYou`（这两个确实只出现在字幕段），**删去 `copy.liveCallConnecting`**。
- **状态**：**未修**（`31` mtime 12:34；Main 已派 `Fix31` 处理，改法已定：A8 删去 `copy.liveCallConnecting`）。

### F4 ❌【高】`31` §3.2 规定的 JSDoc 会让 §6.2-S3 变红

- **证据**：`31` §3.2 给出的 props 签名（:89-93）**逐字**含：

```ts
   * 只读三个字段。MUST NOT 传 owner / characterId —— 归属不属展示，
   * 组件 MUST NOT 假定 owner（30 §3.2 冻结 4）。
```

而 `31` §6.2 S3（:363-366）断言：

```js
assert.doesNotMatch(src, /\bowner\b/);
assert.doesNotMatch(src, /characterId/);
```

`src` 是**同一个 `.tsx` 文件**（`:348` 读 `LiveCallTranscript.tsx`）。文档规定的注释里同时出现 `owner` 与 `characterId` ⇒ **S3 必红**。`31` 只对 `/characterId/` 承认「一处已知假阳性」（说「若注释里提到它，S3 会变红」），却**没有发现它自己的 §3.2 示例注释正好踩中**，也**未提到 `\bowner\b` 同样踩中**。
- **修正建议**：把 §3.2 JSDoc 中这两个词形改掉（如「承载者标识 / 角色标识」），或把 S3 改成先 `stripComments` 再断言——后者更稳，与 `check-ux-contract.mjs:156` 的既有做法一致。
- **状态**：**未修**。

### F5 ❌【高】`33` §7.2 / `35` §2.5 的「反向义务」实测结论不成立

- **证据**：两文都声称「若把沉浸例外写成 `.is-immersive .prototype-chrome.<新类>`，`css-declaration` 会**同时**因 `pointer-events: auto` 报一条 finding」，并标为「**实测**」。我把该候选 CSS 喂给 `scanSource`（规则集 = 今日真实 `ux-contract.json` + `33` §9.1 的 P1–P4）：

```
REAL prototype.css             => []
REAL + 穿透 CSS                => []          ← 文档声称这里有 finding
穿透 CSS（单独）                => [".is-immersive .prototype-chrome must declare opacity: 0 !important"]
```

原因（读实现 `check-ux-contract.mjs:189`）：

```js
if (new RegExp(`${e.property}\s*:\s*auto\b`).test(body)) add(…)
```

——它只在**该规则自己的 `property`** 恰为 `pointer-events` 时才触发。`P3` 的 property 是 `opacity`，`P4` 的是 `display`；今日全仓唯一的 `pointer-events` 规则（`ghost.pointer-events`）target 是 `index.css` 的 `.object--ghost` ⇒ **对 `prototype.css` 永不触发**。
- **影响**：「穿透 chrome 这条错路会被门禁抓住」是 `33` §7.2 否掉该方案的**两条理由之一**；这条理由**不成立**（另一条 CSS 合成引理理由成立）。实现方会**误以为有门禁兜底**。
- **修正建议**：删「会报 `pointer-events: auto` finding」的断言，改为「若走穿透路线，**须另行新增**一条 `css-declaration`（selector `.is-immersive .prototype-chrome.<新类>`，property `pointer-events`，value `none !important`）才可能被门禁看见」；或删除该理由、只保留 CSS 引理理由。**两处（`33` §7.2、`35` §2.5 的「反向义务」段）须同改。**
- **状态**：**未修**（`33` mtime 13:53 / `35` mtime 13:58 均未改；Main 已派 `Fix33and35`，并采纳我的「**「会触发门禁」型断言 MUST 附 `scanSource` 实测输出**」升格为纪律）。

### F6 ❌【高】`34` 头部元数据「993 / 1141 行 / 42 pass」与实测不符

- **证据**：`34` 头部逐字「行号实测于 2026-09-15 的工作树（`NookView.tsx` 993 行 / `CharacterModal.tsx` 1141 行）」，§8.5/§9.6 逐字「42 pass」。实测：

```
wc -l: NookView.tsx 812 / CharacterModal.tsx 1083 / live-call-store.ts 736
node --test apps/web/test/live-call-store.test.mjs → tests 26 | pass 26 | fail 0 | skipped 0
```

（`32`/`33` 头部写的 812/1083 是**对的**。）`34` 正文的**具体行号引用**则与实测吻合（`:183` `callInProgress`、`:696` `void stopCall();`、`:190`/`:201`、`:139`/`:146`/`:955`/`:879` 全部命中）⇒ **只有这句「实测行数/用例数」是假的**。
- **修正建议**：改为 812 / 1083 / 736 与 26 pass。
- **状态**：**已修**（现文写「812 / 1083 / 736，`wc -l` 实测」与「26 pass / 0 skipped」）。

### F7 ❌【高】`34` §3.3 的空态占位用了挂断键

- **证据**：`34` §3.3（评审时 :143）给出 `{call.phase !== 'connecting' && …{copy.liveCallStop}}`，而 `copy.liveCallStop` 的值是 **`Hang up`**——那是**挂断按钮**的文案，不是空态文案；且与 `31` §3.5 的 D2 收敛（`connecting → Connecting…`，其余 → `Listening…`）**直接冲突**，也违反 `30` §3.2 冻结 4（「空态」MUST 共享）。
- **修正建议**：空态 owner 归 `31` 的组件；`34` 只保留外盒门。若 `31` 不落地，则 MUST 用 `connecting ? Connecting… : Listening…`。
- **状态**：**已修**（`34:132-140` 已裁定「本 hunk 由 `31` 接管，本文不再提供任何空态实现」，并显式点名原稿的错误）。

### F8 ⚠️【中】行号漂移残留（`30` 的 `:695`；`32` 的 `CONSUMERS :52`）

- **证据**：`30` §4.1 的代码块（:125）、§6 落点表（:245）、§9（:293）三处写 `NookView.tsx:695  } else void stopCall();`；实测该行在 **`:696`**（`:695` 是 `});`）。同段的 Tab 守卫 `:710`（实测 `:708`）**已修**，但 `:695` **未修**。另 `32` §4.2（:405）写 `CONSUMERS`（`:52`），实测 `App.tsx` 在 `:53`。
- **修正建议**：`30` 三处 `:695` → `:696`；`32` 的 `:52` → `:53`。
- **状态**：**部分修**。Main 已改 `30` §5.3（:216，现作「今日 `:696`」）并裁定「§4.1 的引文块保留原样（引用原始代码，不是活引用）」。**但该块（:127）的形式与紧邻的 `NookView.tsx:183` 完全同形**（都是「路径:行号 + 代码」的行标引用），读者无法区分它是「引文」还是「活引用」；`§6` 落点表（:247 `183/695-717`）与 `§9`（:295 `:695-717`）也未改 —— 建议统一为 `:696`，或把这处行号去掉、只留符号名（`30` §7.1 自己的引用纪律正是「符号 + 行号」，缺号即应为符号）。

### F9 ⚠️【中】`30` §11 改写后，下游引用与裁决口径三方不一致

- **证据**：
  1. `30` §11 已被改写为「未决项的**裁决**表」（现 `:304-332`，文件 343 行），**不再有「未决 1-6」编号**；`35` §11-W1 仍标「§11「仍未知」（`:241-249`）」，**该行号已落空**（现 `:241-249` 是 §6 落点表）。
  2. `32` §2.1/§3.3/§3.4/§3.5/§12 仍反复引用「`30` §11 未决 N」。
  3. **裁决口径冲突**：`30` §11 表第 6 行已写死「不在场角色 **MUST NOT** 发起通话」；`32` §12-1 仍写「**待评审确认**」；`35` §13-4 仍写「本批**仍未裁决**」。
- **修正建议**：`35` §11-W1 改引「`30` §11 的裁决表」（行号 `:304-332`）；`32`/`35` 的「待裁决/待评审」改为「已裁（`30` §11）」。
- **状态**：**未修**（`35` 尚未回工）。

### F10 ⚠️【中】全批基线数字**整体过期一提交**（`274/435/161`、`406/395/50`、`138`）

- **证据**：多份文档把「干净树」基线写作 `274 used / 435 entries`（`30` §3.3/§7、`31` §5.2/§7/§11、`32` §5.1、`33` §9.4/§R6、`35` §1）。实测：

```
commit 4a11685（L2 收口）: used 274 / entries 435 / warn 161   ← 文档引用的值
HEAD      13e3c71（13:32）: used 279 / entries 443 / warn 164   ← 今日真正的干净树
node --test apps/web/test/*.mjs 今日: tests 429 | pass 418 | fail 0 | skipped 11  (52 个文件)
check-ux-contract 今日: clean (18 rules, 140 files)
```

`13e3c71` **已提交** `world-command.ts`（431 行）与 `reveal-gate.ts`（100 行）并同步 `messages.json`（+10 行）⇒ 文档所称的「**他人未跟踪**的文件造成假红」这一环境叙述**已随该提交失效**：`check-i18n` 今日 **exit 0**。同理 `35` §1 的「406 tests / 395 pass / 50 个测试文件」与「138 files」都是 `4a11685` 的值。
- **影响**：所有「预期逐字不变」的验收判据（`274/435`、`138 files`）在今日树上会**假红**，被误读成 L3 引入的回归。
- **修正建议**：把「干净树」定义写死为「`HEAD` 且工作树无未跟踪文件」，并把基线更新为 **`279 used / 443 entries`**、**`140 files`（软断言 `≥140`）**、**`429 tests / 418 pass / 11 skipped`**；同时删除「`world-command.ts` 未跟踪造成假红」的整段叙述（改为「已随 `13e3c71` 落地」）。
- **状态**：**部分修**。`30` §7（:263）已更新为「今日 279 used keys / 443 entries（164 warn）」；`31`/`32`/`33`/`35` 仍写 `274/435`（Main 已派 `FixBaselines`）。

### F11 ⚠️【中】`liveError*` 的数量与「全部回落」不实

- **证据**：`31` §5.1（:300）写「`liveError*`（**9 个**，`legacy-ui-copy.ts:56-65`）… ❌ 静默回落英文」；`30` §3.3（:105）写「`liveError*` **全部** ❌」。实测：

```
行 56-65 共 10 个 liveError* 键
对 messages.json 逐键判定：BLIND 8 个 / HAS 词条 2 个
  HAS : liveErrorMicDenied（"Microphone access was refused…"）
  HAS : liveErrorCharacter（"This character has no ikigai to call from."）
  BLIND: Unconfigured / MicUnsupported / Connection / World / Request / Voice / Offer / Generic
```

⇒ 数量「9」**错**（实为 10），「全部回落」**部分错**（2/10 有词条）。`35` §2.3.1 的盲键表**是对的**（列 8 个、正确排除了 MicDenied/Character）——**`31` 与 `35` 在同一事实上有 9 vs 8 的分歧**。
- **修正建议**：`31` §5.1 行改为「`liveError*`（10 个，其中 **8 个**回落英文；`liveErrorMicDenied` / `liveErrorCharacter` 有词条）」，`30` §3.3 同改。
- **状态**：**部分修**。`30` §3.3（:105/:107）已改为「10 个中 8 个」并注明「`35` §2.3.1 的 8 键盲表才是对的」；`31` §5.1 仍写「9 个 / 全部回落」。

### F12 ⚠️【中】`30` §3.3 的「132 条 warn」与自身数字算术矛盾

- **证据**：`30` §3.3（:109）逐字「门禁输出为 `274 used keys ... (435 entries)` + **132 条 warn**」。`check-i18n.mjs` 的判定是「`used` 全集都能解析（否则 `exit 1`）」+「`warn` = `entries` 中无字面调用点者」⇒ **warn ≡ entries − used**：

```
435 − 274 = 161 ≠ 132
```

实测 `4a11685` 干净树 warn = **161**；`33` §9.4（:442）也自述「今日 161 条，主 agent 另测为 132 条」——同一份文档里两个互斥的数。**132 在任何已核树上都不可复现**。
- **修正建议**：`30` §3.3 的 `132` → `161`（或写明该数的测量条件）；`33` §9.4 的「主 agent 另测为 132 条」删除。
- **状态**：**部分修**。`30` §3.3（:111）已更正为 `279/443/164 warn` 并写明「warn ≡ entries − used，132 不可复现」；`33` §9.4 的「另测为 132 条」仍未删。

### F13 ⚠️【中】`33` §13 V-1 正文残留「本文不裁」

- **证据**：`33` §13 V-1 的**建议段**（:541）仍以「**本文不裁**」结尾，而同文 §13 V-1 的**裁决段**（:518）与 §14 第 2 条（:549）都已写「**已裁：本批必修**」（`30` §5.3 冻结 9 / `34` §5）。同一冲突条目内部自相矛盾。
- **修正建议**：删 `:541` 末的「本文不裁」，改为「处置已裁，见本节裁决段」。
- **状态**：**未修**（半修：裁决段已补，正文残留）。

### F14 ⚠️【低】`35` §12-C7 的「兄弟文档尚未落盘」已过期

- **证据**：`35` §12-C7 逐字「实测 `ls docs/live-voice/3[1-5]*` → 只有 `30`（其余 4 份由并行代理在写）」。实测 `31`–`35` **全部已落盘**（489/763/549/709/601 行）。
- **修正建议**：改为「已于 2026-09-15 全部落盘，核对点逐条见下」。
- **状态**：**未修**。

### F15 ⚠️【低】零散引用小漂移

| 位置 | 文档写 | 实测 |
|---|---|---|
| `32` §4.2（:405） | `CONSUMERS`（`:52`） | `App.tsx` 在 `:53` |
| `33` §9.4（:438） | 「今日工作树 **276 used / exit 1**」 | 已随 `13e3c71` 失效；今日 `279 used / exit 0` |
| `30` §3.1（:81） | `UI_COPY.liveCall*`（`legacy-ui-copy.ts:49-57`） | `liveCall*` 键实际在 `:49-55`（`:56-65` 是 `liveError*`）⇒ 范围略宽 2 行；`messages.json:1210-1218` 则**逐字命中** |
| `33` §9.4（:442） | 「`messages.json` 文本 440 vs 解析 435」 | `4a11685` 时属实；今日为 **448 文本 vs 443 解析** |

### F16 ⚠️【低】两个「既有事实」是自造而非实测（不影响结论）

- `35` §7.1 写「本文原型另证 `rendered OK; action buttons = 3`」、`34` §9 通篇引用 7 个探针脚本（`probe-defect1-store.mjs` 等）的逐字输出。实测：

```
$ ls probe-defect1-store.mjs probe-nook-final.mjs probe-defect2.mjs …   → 全部 absent
```

`34` §11 自述「探针脚本已全部删除」，`35` 的「原型」亦然 ⇒ **这些输出无法独立复现**。结论本身**与我的复核一致**（我复现了 skip 修复与 `available` 恒 false 两条），但**「可执行探针核验」这句方法论声明对下游读者是不可验证的**。
- **修正建议**：把探针的关键步骤写成可直接粘贴的一段（如 `35` §7.1 那样给出 `define` 那一行），或改为「已复核，脚本未留档」。**属于证据可复核性问题，不推翻结论。**

---

## 3. 行号 / 引用真实度抽查（任务书要求 10–15 个，实际抽 24 个）

**结论：本批行号真实度显著优于仓库常态——24 条中 21 条精确命中，3 条漂 1–2 行。**

| # | 引用 | 声称内容 | 实测 | 判定 |
|---|---|---|---|---|
| 1 | `NookView.tsx:183` | `callInProgress = connecting \|\| live` | 逐字一致 | ✅ |
| 2 | `NookView.tsx:190` | `sameCharacterOnCall = callInProgress && call.characterId === id` | 逐字一致 | ✅ |
| 3 | `NookView.tsx:196` | `:696` 的 `else void stopCall();` | 实测在 `:696`（`:695` 是 `});`） | ⚠️ 漂 1 |
| 4 | `NookView.tsx:201` | 卸载 cleanup `stopCall(\`nook:${characterId}\`)` | 逐字一致 | ✅ |
| 5 | `NookView.tsx:626` | `<Canvas>` 的 `onOpenCharacterModal={handleOpenCharacterModal}` | 逐字一致 | ✅ |
| 6 | `NookView.tsx:686/746` | `data-nook-zone="call"` / `"transcript"` | 逐字一致 | ✅ |
| 7 | `NookView.tsx:744` | `{callInProgress && (` 门住 transcript | 逐字一致 | ✅ |
| 8 | `NookView.tsx:174` | `copy = Object.fromEntries(… translate(locale, value))` | 逐字一致 | ✅ |
| 9 | `CharacterModal.tsx:139` | `callActive = connecting \|\| live` | 逐字一致 | ✅ |
| 10 | `CharacterModal.tsx:146` | `callVisible = (callActive \|\| error) && call.characterId === characterId` | 逐字一致 | ✅ |
| 11 | `CharacterModal.tsx:955` | `disabled={callActive}` | 逐字一致 | ✅ |
| 12 | `CharacterModal.tsx:826` | 卸载 cleanup `stopOwnedCall()` | 逐字一致 | ✅ |
| 13 | `CharacterModal.tsx:544` | `handleClose` 内先挂断 | 逐字一致（`void stopOwnedCall();`） | ✅ |
| 14 | `CharacterModal.tsx:948` | 「Text」按钮 `onClick={hangUp}` | 逐字一致 | ✅ |
| 15 | `CharacterModal.tsx:1018` | `{call.phase === 'error' ? t('Close') : t('Hang up')}` | 逐字一致 | ✅ |
| 16 | `live-call-store.ts:642` | `stop` 的 owner 守卫 | 逐字一致 | ✅ |
| 17 | `live-call-store.ts:416-418` | `fail()` 只 `commitState({phase:'error'})` | 逐字一致 | ✅ |
| 18 | `live-call-store.ts:521-526` | `start` 的同角色 adopt | 逐字一致 | ✅ |
| 19 | `CharacterRail.tsx:80` | 根 class 含 `prototype-chrome` | 逐字一致 | ✅ |
| 20 | `character-rail.css:3` | 注释写 `.prototype-residents` 在 `scene-shell.css:110` | 实测规则在 `scene-shell.css:135` | ✅（文档已登记该漂移） |
| 21 | `character-rail.test.mjs:164` | `count(…'character-rail__action'…) === 3` | 逐字一致 | ✅ |
| 22 | `prototype.css:176-179` | `.is-immersive .prototype-chrome` 三条 `!important` | 逐字一致 | ✅ |
| 23 | `check-ux-contract.mjs:182-192` | `css-declaration` 的真实正则 | 逐字一致 | ✅ |
| 24 | `tools/lib/i18n-call-keys.mjs:7-13` | `keys()` 只处理字面量/条件表达式 | 实测 `keys()` 在 `:9-15`（含 `!node return` 头） | ⚠️ 漂 2 |

**零假引用**：抽查中**没有一条**指向不存在/不相关的代码；漂移都是 1–2 行的边界问题。

---

## 4. 「设计意图」被写成「已实现」的检查

**结论：本批未发现这类污染。** 逐字扫描 `3*.md` 的「已落地 / 已修复 / 已实现 / 本批已 / 已经落地 / 已接入 / 已接线」：

```
docs/live-voice/33:528  「…本条原来『本文已解／建议补一句』的诉求已经落地」   ← 指契约修订，非源码
docs/live-voice/35:92   「现状实测（已核验，L2 的改动已落地）」              ← 指 L2 已提交的 check-request-bodies，**

实测为真**（`BODIES.file` 两条 live 条目确已是 `live-call-store.ts`，`:101-110`）
```

两处均**属实**（都指已提交的既有改动，不指本批）。5 份设计文档**都明确自述「只写设计，不改任何源码」**（`31`/`32`/`33`/`34` 头部逐字；`35` 是门禁与回写登记）。**没有「本批已修复缺陷 1/2」之类的假宣称。**

⚠️ 唯一需要读者警觉的是 **`34` 的「方法论声明」**（见 F16）：它说「本文的每一条行为断言都由**可执行探针**核验，不是推演」，但探针脚本已删除、输出无法复现。这是**证据可复核性**问题，不是「把意图写成实现」。

---

## 5. 隐藏的未验证前提（`[UNKNOWN]` 排查）

逐条检查「论证依赖 X 成立，但 X 从未被验证」：

| # | 前提 | 在哪条论证里承重 | 判定 |
|---|---|---|---|
| U1 | **「`double` 门控下 node 静态渲染不渲染麦克风」** | `32` §2.2 / `30` §7 | ✅ **已验证**（我独立复现：`canTalk=false` + `available` 恒 false 两道门） |
| U2 | **「`renderToStaticMarkup` 不触发 `subscribe`」** | `32` §2.2 的 `available` 恒 false 链 | ✅ **我已独立验证**（探针：`subscribe calls = 0`）；`32` 文档**未直接验证**这一点，只由 `fetch` 失败反推——**前提本身成立，但文档的验证路径绕了一层** [可接受] |
| U3 | **「角色栏在 nook 打开时整个卸载」** | `32` §3.7 的 cleanup 必要性 | ✅ 已验证（`App.tsx:1381` 的 `{!nookChar && (…)}` 包住 `<CharacterRail>`） |
| U4 | **「焦点留在通话按钮上 ⇒ 紧接的第一次 Tab 被吞」** | `33` §5.2 情形 C 的 G-B 可达性节奏 | ⚠️ **未验证**（`33` 自己也标为待 R11 用例覆盖）。**不影响结论**（鼠标路无条件可达）。 |
| U5 | **「nook 的 `<Canvas>` 不传 `presence` ⇒ 无他角色头像可点」** | `33` §5.2 情形 A′ 的「内容条件」限定 | ✅ 已验证（`NookView.tsx:605-630` 的 prop 列表确无 `presence`；`Canvas.tsx:53-56` 注释逐字「Absent value = no avatars (nook path)」） |
| U6 | **「A′ 下唯一可点挂断入口是 `.dialogue-modes` 的 Text 按钮」** | `33` V-5 / `34` 的「MUST NOT 加 owner」反证 | ✅ 前提链可核（`:948` Text→`hangUp`；`:1017` 的 `.call-hangup` 受 `:146` 的 `characterId` 约束） |
| U7 | **「`CharacterModal` 的 `hangUp` 无条件」** | `30` §5.2 末 / `34` §4.5 / `33` V-5 | ✅ 已验证（`:159-161` 逐字 `void liveCallActions.stop();`，注释 *whoever started it*） |
| U8 | **「S4b 的 CSS 不会触发 `visual.global-token-and-literal-policy`」** | `33` §7.3 的形状理由 | ⚠️ **部分未验证**：该规则 target 含 `prototype.css`，且 `33` §7.3 给的形状用了 `top: 155px` / `right: 26px` **裸数字**。实测该规则的 `radius` 模式是 `/\b\d+(\.\d+)?(px|rem|em|%)\b/i`，但**只对 `propertyKind` 命中的属性生效**（`top`/`right` 不在 `color/shadow/radius/font/motion` 任何一类里，`propertyKind === null ⇒ continue`）⇒ **今天不会报**。`33` §14-1 说「需要 designer 定」是对的，但「受该规则约束」这句措辞**过宽**（实测该形状今天不被它抓）。[属措辞精度，非错] |

**未发现「靠一个从未验证的假设支撑整条结论」的情形。** 两处 ⚠️（U4/U8）都被文档自己或宽容地标注为待定/待 designer。

---

## 6. 对整批「可信度」的可操作结论

### 6.1 可直接信（无需复核）

- **全部 `file:line` 引用**（§3 抽查 24 条，21 条逐字命中、3 条漂 1–2 行、**零假引用**）。
- **门禁基线机制链**：`check-ws-contract` 的 `CONSUMERS=9 / consumed=26 / emitted+show_frame=28`、`check-request-bodies=11`、`check-live-voices` 无 L4/L5、`character-rail.test.mjs` 的 `12 pass / 11 skip` 与其根因（`base-path.ts:7` 的 `import.meta.env.BASE_URL`）——**逐条实跑一致**。
- **CSS 引理与验收判据方向**（§1.6）：`opacity` 挡视觉不挡命中、`visibility`/`pointer-events` 可继承救回——**与浏览器实测方向一致，未说反**。
- **缺陷 1/2 的事实与修法方向**（§1.7/§1.8）：`callInProgress` 全局、`stopCall()` 无 owner、`disabled={callActive}` 全局、`fail()` 不 `releaseLocal`、`hangUp` 无条件——**全部逐字属真**。
- **`30` §5.2 的错误断言已彻底修正**（§1.11），`32` 对 skip 假绿的自我披露**充分且方向正确**（§1.3）。

### 6.2 必须复核 / 已在评审中被证伪的断言（**实现前 MUST 处理**）

| 优先级 | 断言 | 为什么必须复核 |
|---|---|---|
| **阻断** | `35` 的「UF-3a 计数 `3→4`」（F1） | 照做会**把测试改红**，并诱发后续「为修绿而动别的」连锁 |
| **阻断** | `33` §7.3 的 S4b `onClick` 拼法（F2） | 照抄会得到**渲染出来但永不生效**的挂断按钮 = 空集性补丁失效 |
| **高** | `31` 的 A8（F3）与 S3（F4） | 两条**新增断言必红**，实现方会为「修绿」而削弱断言 |
| **高** | `33` §7.2 / `35` §2.5 的「门禁会抓穿透」（F5） | 实现方会**误以为有兜底**；该兜底不存在 |
| **中** | 全批基线数字 `274/435/161`、`138 files`、`406/395/50`（F10） | 今日树上会**假红**，被误读成 L3 回归 |

### 6.3 制度性建议（本批诚实性教训的可复用部分）

1. **「改计数」这类断言改动，MUST 附一条「为什么它一定变/一定不变」的**双向**证明**——`30` §7 第 1 行原稿只写了「必须改计数」（单向、缺前提），`35` 照抄放大成 8 处，正是本批最贵的错误。族内 ML 教训：**条件句写成陈述句之前，先把条件验证一遍**。
2. **所有「会触发门禁 X」的主张 MUST 附「喂给该门禁的真实正则/真实规则集」的实测输出**——`33`/`35` 的 F5 是「读起来像实测、实际是推理」的典型；本仓库已有 `check-ux-contract.mjs` 可被直接 `import`（我本次就是这么验的），成本是一行。
3. **「新增源码断言」MUST 在写断言的同时，把文档里的**示例代码/注释**也当成被测对象跑一遍**——F3/F4 都是「文档给出的示例本身会踩红自己给的断言」。这与 `31` §6.3 自己写的「A9 的措辞是关键」是同一个病，只是方向相反（那次是漏了「符号搬家」，这次是**文档示例即为校验输入**）。
4. **基线数字 MUST 写成「命令 + 当时的 `HEAD`」，而不是裸数字**——F10 的整批过期完全可避免：`4a11685 → 274/435`、`13e3c71 → 279/443`，两个都写清就没有歧义。

---

## 7. 逐条验证结果总表（✅/❌/⚠️）

| # | 断言 | 结果 | 证据位置 |
|---|---|---|---|
| 1 | `31`：4 键均存在、新增 0 键 | ✅ | §1.1 |
| 2 | `31`：删 `.call-line*` 安全（仅 2 处引用） | ✅ | §1.2 |
| 3 | `32`：UF-3a 计数仍 3、零测试改动 | ✅（`35` 相反 → F1） | §1.3 |
| 4 | `32`：不在场角色 MUST NOT 发起 | ✅ | §1.4 |
| 5 | `32`：`available` 只门入口不门通话态 | ✅ | §1.5 |
| 6 | `33`：CSS 引理（`opacity` 挡视觉不挡命中） | ✅ **未说反** | §1.6 |
| 7 | `34`：`fail()` 不 `releaseLocal` | ✅ | §1.7 |
| 8 | `34`：缺陷 2 阴影面不被规则 6 抓到 | ✅ | §1.8 |
| 9 | `35`：MUST NOT 把 `LiveCallTranscript.tsx` 加进 `CONSUMERS` | ✅ | §1.9 |
| 10 | `35`：`check-live-voices` 不变、无 L4/L5 | ✅ | §1.10 |
| 11 | `30` §5.2 错误断言已完全修正 | ✅（仅剩 `:695` 漂移） | §1.11 / F8 |
| 12 | `35`：UF-3a 计数 3→4 | ❌ | F1 |
| 13 | `33` §7.3：S4b `onClick` | ❌（已修） | F2 |
| 14 | `31` A8：`NookView` 不再含 `copy.liveCallConnecting` | ❌ | F3 |
| 15 | `31` S3 与 §3.2 JSDoc 并存 | ❌ | F4 |
| 16 | `33`/`35`：穿透 CSS 会触发门禁 finding | ❌ | F5 |
| 17 | `34`：993/1141 行、42 pass | ❌（已修） | F6 |
| 18 | `34` §3.3：空态用 `copy.liveCallStop` | ❌（已修） | F7 |
| 19 | `30`：`:695` / `32`：`CONSUMERS :52` | ⚠️ 漂 1 | F8 |
| 20 | `35` §11-W1 引「`30` §11 :241-249 未决 1-6」 | ⚠️ 已落空 | F9 |
| 21 | 全批基线 `274/435/161`、`138`、`406/395/50` | ⚠️ 过期一提交 | F10 |
| 22 | `31`/`30`：`liveError*` 9 个全部回落 | ⚠️ 实为 10 个 / 8 个回落 | F11 |
| 23 | `30` §3.3：132 条 warn | ⚠️ 与自身数字矛盾（应为 161） | F12 |
| 24 | `33` §13 V-1「本文不裁」 | ⚠️ 与同节裁决段矛盾 | F13 |
| 25 | `35` §12-C7：兄弟文档尚未落盘 | ⚠️ 已过期 | F14 |
| 26 | 零散引用（`legacy-ui-copy.ts:49-57` 等） | ⚠️ 小漂移 | F15 |
| 27 | 「可执行探针核验」方法论声明 | ⚠️ 输出不可复现 | F16 |
| 28 | 「设计意图」被写成「已实现」 | ✅ **未发现** | §4 |
| 29 | 隐藏未验证前提 | ✅ 无致命项（2 处已被文档自标待定） | §5 |
