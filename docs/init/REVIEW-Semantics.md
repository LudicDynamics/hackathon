# REVIEW — 语义/规格正确性（对照 doc-11 与既有代码）

> 评审对象：`docs/init/00-共同上下文.md` / `01` / `02` / `03` / `04`。
> 角度：**产品语义（doc-11）转述是否忠实** + **文档所述形状与已落地代码/真实 schema 是否一致**（以实为准）。
> 纪律：只读评审，不改任何文件。每条带 `file:line`；无法核实的标 `[无法核实]`。
> 核对基准（本机实测，2026-09-13）：
> `packages/shared/src/rules/{emptiness,characters,init-fallback}.ts`、`packages/shared/src/render/brief.ts`（**现存**；`apps/server/src/engine/brief-builder.ts` 已 staged delete）、`packages/shared/src/actions/layer.ts:91-171`、`packages/shared/src/schemas/events.ts:96-106`、`packages/shared/src/store/layers.ts:32-49`、`vendor/pi-rp/.../subagent/{spawn,run,prepare}.ts`、`vendor/pi-rp/.../extensions/types.ts`。
> git：`HEAD=ebf614a`；`brief.ts`/`brief.test.mjs` 未跟踪，`brief-builder.ts` 已 `D`（staged）。`node tools/check-ws-contract.mjs --json` → `findings: 9`。

---

## 0. 结论速览

| # | 级别 | 一句话 |
|---|---|---|
| B1 | **BLOCKER** | `kind:'scene'` 的「裸层 id」归一分支产出**非 world 相对目录**：判空短路恒为真（反复重初始化），且 `detail.layer` 落在 manifest 的 id 域外。契约 §2.2 的示例 `baker-street/crime-scene` 本身就是伪 id。 |
| B2 | **BLOCKER** | `02` 的 brief 调用形状（`parentLayerId` 字段、位置参数 `buildNookInitBrief(target, roleDesc, manifest, opts)`、无 `displayName`）与**冻结契约 §4.1/§4.2** 及**已落地代码** `render/brief.ts` 均不一致；照 `02` 实现无法编译。 |
| B3 | **BLOCKER** | `04` 的验收门禁引用**已删除**的 `apps/server/src/engine/brief-builder.ts` / `../dist/engine/brief-builder.js`，并另起一个与已落地 `init-rules.test.mjs` 重名的测试文件；照抄即跑不通。 |
| M1 | MAJOR | `04` P18 断言 `check:ws findings === 14`；实测 **9**，且 `03` 自己写的是 9。跨篇自相矛盾 + 断言值错。 |
| M2 | MAJOR | 契约 §2.3 第 2 步称判空短路是幂等的「**唯一来源**」，但扩展命令**可并发执行**（已实测），双击/重入会两条都通过判空并各自 spawn。`03 §⑫-3` 登记但未裁决。 |
| M3 | MAJOR | doc-11 §5 第三行「上帝模式新建空目录 → 直接落最小模板，**不惊动 AI**」在两批文档里**整条未转述**；`03 §3.8` 反而把该入口设计成 AI 路径。 |
| M4 | MAJOR | doc-11 §4.1 的「默认 brief 按**他的来历**（角色 README 简介 + `world.json` 的 `home`/`role`）推导」未被 brief 兑现：`home`/`role` **从不进 brief**，`roleDesc` 取的是 holmes 里为空的 `description`。 |
| M5 | MAJOR | `02 §⑫-1` 引用的契约原文「从命令参数读，不从常量读死」**已不在契约**（契约现写「作为命令内常量」）。死引用。 |
| m1-m6 | MINOR | `01` 的行号/冲突列表已相对落地代码漂移（§6）；`02 §⑧` 的 import 仍指已删文件（§7）。 |

**Verdict：小改后可落地**（B1 需契约级澄清；B2/B3 是文档与已定案形状的对齐；M1 是纯数值修正）。

---

## 1. doc-11 产品语义转述（§3.1/§4.1 判据、§5 模板、§1 分类、§6.1/§6.2）

### 1.1 判空判据 —— 忠实

- `doc-11:181-184`「层是 stub ⟺ 目录里没有 README.md」→ 契约 `00:106-107,113-114` 与落地 `emptiness.ts:37-39`（`!directChildrenOf(...).includes('README.md')`，大小写敏感）**一致**。
- `doc-11:236`「小天地为空 = 只含 preset.json；除 `preset.json`/`.json` 外无任何 md/文件」→ `00:109-115` 与 `emptiness.ts:48-50`（`every(name => name.endsWith('.json'))`）**语义等价**（代码把「任意 `*.json` 都不算内容」固化了，比 doc-11 更明确，属良性收窄）。**无偷换**。
- doc-11「根目录为空」（`doc-11:236`）→ `00:115`、`emptiness.ts:19-29` 只取直接子级。**一致**。

### 1.2 W2 模板（§5）—— 前两行有据，第三行缺失

- `doc-11:302-311` 三行行为表 → 契约 `00:133-148`（常量、英文文案、文件名 `README.md`/`opening.md`）**已覆盖前两行**（超时/失败、离线），且语言/文件名差异已登记（`01:345-350`、`04:472-475`）。**可接受**。
- **遗漏**：`doc-11:304`「**上帝模式新建空目录**（玩家没写诉求）→ **直接落最小模板，不惊动 AI**」在两批文档里**没有对应实现/契约条目**。`03:346-360` 把「新建空目录」整体改设计为「（A）只 mkdir + `requestInit`（走 AI）」并标待拍板（`03:675-677`）。即 doc-11 §5 这条**零 AI 路径被静默替换成 AI 路径**，且 `02`/`04` 均未登记。
  - **级别**：MAJOR。
  - **修法**：在 `02 §③` 或 `03 §3.8` 明确——保留 W2-for-new-empty-dir（`kind:'scene'` + 空 request 时直接落 `w2SceneTemplate`、不发 `airp-init`）**或**显式声明废止并回写 `doc-11:304`。二选一，勿悬空。

### 1.3 R1/R2/W2 分类（§1）—— 忠实；W1 未提（可接受）

- `doc-11:20-23` 的 2×2 → 契约 `00:87-95` 表**覆盖 R1/R2/W2**。W1（作家亲写 chalk，doc-11 明说「不是初始化，是叙事」）未列，**不构成遗漏**。

### 1.4 超时（§6.2）—— 数值一致；性质转述已改口，但留下死引用

- `doc-11:344`「场景 60s；小天地 45s」→ `00:83`、`02:85`（`TIMEOUT_MS = {scene:60_000, nook:45_000}`）**一致**。
- `doc-11:344`「超时值是配置不是常量」→ 契约**现行**写「作为命令内常量，登记『配置项待外提』」（`00:83`），属**有意偏离并登记**。但 `02:631` 仍逐字引用**旧契约**「契约 §2.3 说『从命令参数读，不从常量读死』」——**该句已不在契约**。
  - **级别**：MAJOR（M5）。
  - **修法**：`02:631` 改为「契约 §2.3 冻结为命令内常量并登记待外提」。

### 1.5 中断语义（§6.1/§6.2）—— 忠实

- `doc-11:335-342`「不中断，让它写完」→ `03:429-430`（切层不中断、生成中说话不冲突）、`03:333`（不靠计时器兜底清 UI）**一致**；`02 §⑦`（dispose → `cancelled` → W2）与 `doc-11:341`「引擎进程退出 → subagent 随会话 dispose」**一致**（`spawn.ts:110-137` 的 `registerSideRequest` 实测存在）。

### 1.6 默认 brief 的「来历」口径（doc-11 §4.1）—— **未兑现**

- `doc-11:255`：「留空/跳过 = 引擎用默认 brief：从 `characters/<名>/README.md`（角色简介）+ `world.json` 的角色条目（**`home` / `role`**）推导出『这个人的来历』，生成符合来历的陈设。」
- 落地 `render/brief.ts:83-103` 的 `buildNookInitBrief` 实际只注入 `[Character] displayName (roleDesc?)`、`[World] name (genre)` 与**固定常量** `[Request]`/`[Constraints]`；**既不读角色 README 正文，也从不传 `home`/`role`**。`02:123-125` 明确只取 `manifest.characters[].description`，而 holmes 角色条目**无 `description`**（实测 `templates/holmes-world/world.json:28-39` 仅 `id`/`home`/`role`）→ `roleDesc` 恒为 `''`（`02:583-589` 自认）。
- 即 doc-11 承诺的「按他的来历」这条语义，**默认路径实际是靠模型从 `[World]` 与静态 `[Request]` 里猜**，没有任何「来历」输入。这是**规格转述的空洞**，不只是措辞差异。
  - **级别**：MAJOR（M4）。
  - **修法**：二选一——(a) 给 `NookInitContext` 增 `role?: string` / `home?: string`，命令从 `manifest.characters` 取（`home` 是层 id，可再取父层名）使 brief 真带「来历」；(b) 回写 `doc-11:255`，把「默认 brief 的来历来源」改成与实现一致的「displayName + roleDesc（可空）+ 世界基调」。**推荐 (a)**，否则 doc-11 §4.1 是空头支票。

---

## 2. 事件合约（02/03 对 `layer_initialized` / `layer_init_failed`）

### 2.1 detail 字段 —— 一致

- 真实 schema：`events.ts:96-101` `layer_initialized = { layer, name, by: 'writer'|'player'|'engine', files: string[] }`；`events.ts:102-106` `layer_init_failed = { layer, name, reason, fallback: 'template'|'none' }`。
- `00:270-273`、`02:239-240`、`03:387-388`、`04:244-245` 逐字转述**与 schema 一致**（含 `by` 枚举三值、`fallback` 两值、`name` 字段）。`03 §3.6` 只消费 `detail.layer`/`fallback`/`reason`，均在 schema 内。**无字段名/类型/枚举错配**。
- `04 §11.1`（`04:408-428`）正确指出 `doc-11 §6.1` 的 `path`/`by` 是过时写法，并给出 `layer`/`name` 修正，与代码一致。**评价：正确**。

### 2.2 `recordLayer*` 调用签名 —— 一致

- 真实签名：`recordLayerInitialized(ctx, { layer, by, files })`（`layer.ts:91-96,105-125`）、`recordLayerInitFailed(ctx, { layer, reason, fallback })`（`layer.ts:133-137,146-165`）；两者入参**都不含 `name`**（由 `layerNameOf` 派生），`actor` 恒 `{type:'engine'}`（`layer.ts:120,160`）。
- `02:239-240`、`02:194,201`、`04:235,244-245` 的调用形状**与代码一致**；`02:244`「`by` 只进 `detail.by`、不改 actor」与 `layer.ts:116-120` 注释**逐字吻合**。**无错用**。

### 2.3 小瑕疵（MINOR）

- `02:245` 说成功路径 `files` = 「dir 的直接子级、world 相对全路径」；落地伪代码 `02:359-362` 的 `directChildPaths` 确为全路径。但 `recordLayerInitialized` 的字段注释（`layer.ts:94`）只承诺 `world-relative`，未冻结「全路径 vs 文件名」。`02 §⑫-3` 已登记。**OK**。
- `04:247` 明智地**不断言 `detail.name`**，避开 `layerNameOf` 回落细节。**好的取舍**。

---

## 3. pi-rp 合约（spawnAgent / registerCommand）

### 3.1 `customTools` 语义 —— 一致（引文精确）

- 真实实现 `spawn.ts:96-97`：**省略 `tools` 时** `tools = [...DEFAULT_SUBAGENT_TOOLS, ...customTools.map(t=>t.name)]`，且 `inheritExtensionTools:false`。
- `00:298`、`02:182-183`、`02:426`、`doc-11:155-161` 的转述**与源码一致**（`tools` 是收窄白名单，省略即「默认集 ∪ customTools」；不继承父会话扩展工具 → 必须传 `customTools`）。行号 `spawn.ts:96/97` 亦命中。**评价：准确**。
- `00:294` 引 `SpawnAgentOptions` 在 `spawn.ts:21-57`、`SpawnAgentResult` 在 `:59-63`——实测为 `:21-46`（Options）/`:48-56`（Result），**行号有 1-2 行漂移**，符号名正确。**MINOR**（建议按符号名定位）。

### 3.2 `status` 枚举 / `timeoutMs` —— 一致

- 真实：`SubagentResultStatus = "completed"|"failed"|"cancelled"|"timed-out"`（`run.ts:13`）；`timeoutMs` → `setTimeout(()=>controller.abort(), timeoutMs)`（`run.ts:145-146`）；catch 据 `isCancelled/isTimeout` 分流（`run.ts:188-193`）。
- `02:189`（枚举）、`02:268-269`（timed-out/cancelled 分流）、`00:83`（`timeoutMs` 即 pi-rp 机制）**全部一致**。**准确**。

### 3.3 `registerCommand` handler 签名 —— 一致

- 真实 `types.ts:1306`：`handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>`；`registerCommand(name, options)` 在 `types.ts:1393`；`ExtensionContext.spawnAgent` 在 `types.ts:383`。
- `02:61`、`00:296`、契约 `00:54` 的引用**命中且正确**；`02:369` 的 handler 形状与之一致。**准确**。

### 3.4 RPC 应答时序 / 30s 超时 —— 一致

- 真实：`rpc-client.js:671` 有 `30000`；扩展命令在 `agent-session.js:1521-1531` 内 `await command.handler(...)`（`_tryExecuteExtensionCommand`，`agent-session.ts:2173-2197`），handler 返回后才 `preflightResult?.(true)`。
- `03:210-215,556-564`、`00:85`、`04:494` 的转述**与源码一致**。本批判定最扎实的工程约束之一。**准确**。
- 附注（非缺陷）：`04:130`「`await client.prompt(...)` 之后 spawnAgent 已结束、事件已 commit」在确定性 provider 下成立；真 provider 下会撞 30s 上限，`04 §12.1-2` 已自认。**自洽**。

---

## 4. 暗路：并发 / 幂等 / 失败回退

### 4.1 并发（同一层两次触发）—— 契约表述过强

- 事实（源码）：扩展命令**在 streaming 中也立即执行**（`agent-session.ts:1991-1996`；`rpc.md:41` 段），且 `prompt()` 对扩展命令**无串行化**——两次 `/airp-init` 会各自 `await handler`，**并发**。
- 契约 `00:71`（第 2 步判空短路）与 `02:113` 称判空短路是幂等的「**唯一来源**」（`02:113` 逐字「这是**幂等性的唯一来源**」）。并发下不成立：两条命令都在「目录尚空」时通过判空 → **各自 spawn**，产生两套陈设。
- `03:657-661`（§⑫-3）**已识别**（「在写入完成前两条都可能 spawn」），但只登记待拍板、以「本地最小去重」为建议，契约层**无裁决**。
  - **级别**：MAJOR（M2）。
  - **修法**：契约 §2.3 增一条同步闸（命令内对 `layer` 的 in-flight 集合，第二次直接短路返回；`02` 伪代码加 ~3 行），或明确接受「并发双写」并把 `02:113` 的「唯一来源」改为「**顺序**路径的幂等来源」。勿让与实测相反的强断言留在冻结契约里。

### 4.2 幂等（判空短路安全性）—— 顺序场景自洽

- scene：W2 落 `README.md`（`init-fallback.ts:31-32`）后 `isLayerEmpty` 转假 → 不再触发（`01:111`）。nook 成功路径要求存在非 json（`emptiness.ts:63-71`）→ `isNookEmpty` 转假。**顺序路径自洽**。
- `hasInitProduct('nook')` 允许「只落一个 `letter.md`、README 仍缺」（`emptiness.ts:71`；`01:403` 已登记待拍板）。此时 `isNookEmpty` 已为假（放行），**不会**重触发——与「nook 门面 `scene===null` 空态」（`01:403`）是两个问题，不构成幂等漏洞。**OK**。

### 4.3 失败回退不对称（scene W2 vs nook none）—— 自洽且已登记

- 契约 `00:235`（nook `fallback:'none'`、不写盘）、`02:207,352`（`writeW2` 对 nook 返回 `none`）、`02:567-573`（冲突 2）。`fallback` 枚举含 `none`（`events.ts:105`）→ **合法**。理由（stub 层会「进一次触发一次」，nook 为空是正常态）**成立**。
- 与 doc-11 的关系：doc-11 §5 未定义 nook 模板 → 本批的「none」是**新增语义**，已登记待拍板。**无偷换**。

---

## 5. 与代码「以实为准」不一致处（点名）

> 本评审的核心要求：**文档说的与代码不一致**处，逐条列。

### B1（BLOCKER）—— `kind:'scene'` 裸层 id 归一产出非 world 相对目录

- 契约 `00:62`：`kind:'scene'` 的 `target` = **层 id（如 `baker-street/crime-scene`）**或世界根相对目录（`world/baker-street/crime-scene`）；命令内部用 `dirOfLayer`/`layerOfDir` 归一。
- `02:101-104` 实现该口径：
  ```ts
  dir = target === 'world' || target.startsWith('world/') ? target : dirOfLayer(target)
  layer = layerOfDir(dir)
  ```
- **实测**（本机 `node` 跑 `dist`）：`dirOfLayer('baker-street/crime-scene') === 'baker-street/crime-scene'`（`layers.ts:32-34` 只把 `'map'` 映射为 `'world'`，其余恒等）。于是裸层 id 形态得到 `dir='baker-street/crime-scene'`（**无 `world/` 前缀**）。
- 而 `store.listFiles()` 返回的路径**恒为 world 根相对**（`local-store.ts:232`：`path.relative(this.worldRoot, abs)`），即 `world/baker-street/crime-scene/…`。`isLayerEmpty(files, 'baker-street/crime-scene')` 的前缀 `baker-street/crime-scene/` **永不匹配** → **恒判「空」** → 每次调用都进入 spawn；`detail.layer` 也得到 `baker-street/crime-scene`，与 `manifest.layers` 的键域（`world/…`，实测 `deriveLayers` → `['map','world/baker-street','world/baker-street/crime-scene']`）**不一致**。
- 铁证：`04:99` 的探针断言 `detail.layer === 'world/probe-stub'`（world 前缀），与契约 `00:62` 的示例 id 形态**互相矛盾**。
  - **级别**：BLOCKER（静默破坏幂等 + 污染事件 `layer`）。
  - **修法**：三选一，任选但要冻结——
    1. 删除「裸层 id」形态，契约 `00:62` 的示例改为 `world/baker-street/crime-scene`（推荐，与 `CardRenderer.tsx:165` 的 `path.replace('/README.md','')` 实际产出的 id 同域）；
    2. 归一分支补前缀：`dir = target.startsWith('world/') ? target : (target === 'map' ? 'world' : \`world/${target}\`)`，并 `layer = layerOfDir(dir)`；
    3. 明确「层 id **就是** world 相对目录（含 `world/`）」，删掉 scene 分支里 `dirOfLayer` 的恒等用法。
  - 同时修正 `00:61-64` 与 `02:101-104`，二者必须同改。

### B2（BLOCKER）—— `02` 的 brief 调用形状落后于冻结契约与落地代码

- 契约 `00:190-219`（**冻结**）与落地 `render/brief.ts`：
  - `SceneInitContext` **无** `parentLayerId` 字段（契约 `00:204` 逐字「`parentLayerId` …属死字段，已删」；落地 `brief.ts:16-28` 确认无该字段）；
  - `NookInitContext` 为**选项对象** `{ characterId, displayName, roleDesc?, manifest, missingFiles? }`（`00:211-218`；落地 `brief.ts:68-81`），`buildNookInitBrief(ctx)`（`brief.ts:83`）。
- `02` 却仍写：
  - `02:38`、`02:122`、`02:285`：`SceneInitContext` **增 `parentLayerId?: string`**；
  - `02:47-52`：`buildNookInitBrief(characterName, roleDesc, manifest, opts?)`（**位置参数**）；
  - `02:123-124`、`02:133`、`02:415`：按位置传 `buildNookInitBrief(target, roleDesc, manifest, {missingFiles})`，且**完全不传 `displayName`**；
  - `02:405-411` 的伪代码构造对象时含 `parentLayerId`。
- 照 `02` 实现，`tsc` 会因 `parentLayerId` 不在类型上、`buildNookInitBrief` 参数不匹配而**编译失败**；即便强转，`[Character]` 会退化成显示 id（`brief.ts:86-89` 用 `displayName`），且契约 `00:227` 要求的「命令用 `parseFrontmatter(README.md).name` 取显示名」**从未出现在 `02`**。
  - **级别**：BLOCKER（照文档实现即失败）。
  - **修法**：`02 §3.2/§3.4/§3.5/§8.2` 全面改为 `buildNookInitBrief({ characterId:target, displayName: <README name ?? target>, roleDesc, manifest, missingFiles })`，删除全部 `parentLayerId`；并在 `02 §3.4-3` 补「显示名解析」步骤（复用 `parseFrontmatter`，契约 `00:227`）。`02 §⑫-10`「是否拆签名」随之关闭（契约已裁决）。

### B3（BLOCKER）—— `04` 门禁引用已删除的文件 / 重名测试

- `04:32`、`04:284`：新增 `apps/server/test/init-brief.test.mjs`，「import `../dist/engine/brief-builder.js`」。
- 实况：`apps/server/src/engine/brief-builder.ts` **已 staged delete**（`git status` → `D`），契约 `00:186` 明令「原文件删除——零调用点，不留 shim」；对应 `apps/server/dist/engine/brief-builder.js` 不再产出。落地测试实际是 `packages/shared/test/brief.test.mjs`（import `../dist/index.js`）。
- 另：`04:31` 计划 `packages/shared/test/init.test.mjs`，而 `01:187` 与本机实况是 `packages/shared/test/init-rules.test.mjs`——**同一用途两个名字**。
- `04:315-316` 的命令行、`04:289` 的复合门禁因此**照抄跑不通**（路径/文件不存在）。
  - **级别**：BLOCKER（验收门禁本身失效）。
  - **修法**：`04 §2.1/§8/§10.1` 改为——brief 单测落 `packages/shared/test/brief.test.mjs`（import `../dist/index.js`）；纯函数单测沿用已落地 `packages/shared/test/init-rules.test.mjs`（不要再造 `init.test.mjs`）；删除一切对 `apps/server/.../brief-builder.*` 的引用。

### M1（MAJOR）—— `04` P18 的 findings 基线写错

- `04:113` 断言 `pnpm check:ws findings 数不变（=== 14，[实测]）`；`04:318`/`04:390` 同。
- 实测 `node tools/check-ws-contract.mjs --json` → `{ contract:24, emitted:24, consumed:11, findings:9 }`；`03:515` 也写「必须仍是 **9**」。`KNOWN_DARK` 列了 12 项但实际 findings 为 9（其余被 `intentionallyUnconsumed` 吸收）。
  - **级别**：MAJOR。
  - **修法**：`04:113,318,390` 的 `14` → `9`；注明基线日期与「若 A 档再落帧需重测」。

### M3/M4/M5 —— 见 §1.2 / §1.6 / §1.4。

---

## 6. 01 篇与落地代码的漂移（MINOR 群）

`01` 声明「`file:line` 以 commit `99ae55d` 为准」，但当前工作树已前进（`71bd888` 加了 `nookCardPaths`、`ebf614a` A 档；且 `brief` 已下沉）。以下为**文档 vs 现码**的不一致（均 MINOR，符号名仍对得上）：

1. **私有 helper 改名**：`01:37,75-80`、`01:175` 称 `directChildren`（私有）；现码是 **`directChildrenOf`（导出）**（`emptiness.ts:19`，`71bd888` 起）。行号亦漂：`01:176-178` 的 `isLayerEmpty 33-35 / isNookEmpty 44-46 / hasInitProduct 59-68` → 现码 `37-39 / 48-50 / 63-72`；`01:181-184` 的 `characters.ts 18/21-23/32-34/43-50` → 现码 `21/24-26/35-37/46-53`；`01:185` 的 `layers.ts:46-49`（`dirOf`）**这条对**。**修法**：按符号名复核并刷新行号。
2. **`01 §⑪-1`（`01:331-343`）** 把「`w2SceneTemplate` 返回 `{readme,chalk}` vs 代码 `W2SceneFiles`」列为**未决冲突**；但契约 `00:139-145` 已按代码冻结为 `W2SceneFiles` 并注明「`01` 篇初稿写的 `{readme,chalk}` 作废」。**该冲突已关闭**，`01` 应改成「已按契约 §3.3 冻结」。
3. **`01 §⑪-6`（`01:379-383`）** 把 `nookCardPaths` 列为「nook 批新增、需裁决」；但契约 `00:180` 已裁决纳入 `rules/characters.ts`，且**已落地**（`characters.ts:65-69`，`init-rules.test.mjs` 已测 `directChildrenOf`/`nookCardPaths`）。**该冲突已关闭**。
4. **`01 §⑧`（`01:189`）** 称「已落地 8 条单测」；现文件 `init-rules.test.mjs` 含 ≥10 条（含 `directChildrenOf`、`nookCardPaths`）。**刷新**。
5. **`01 §⑪-8`（`01:389-394`）** `dirOf` 未被 `emptiness` 复用——**仍成立**（现码 `emptiness.ts:19-29` 自走前缀切片，`dirOf` 仅 `layers.ts:111` 用）。**保留，OK**。
6. `01:63-66` 引用 `local-store.ts:210-233` 的 `listFiles` 三语义——**实测一致**（`local-store.ts:210-234`：跳过 dotfile/`node_modules`、world 相对、只 push 文件且递归）。**准确**。

## 7. 02/03 的其他小不一致（MINOR）

- **`02:308`** 的伪代码 import 仍指向已删的 `../../apps/server/src/engine/brief-builder.js`（`02:463` 称其为「全新跨包方向」）；契约 `00:186` 已裁决下沉 `packages/shared/src/render/brief.ts` 并删原文件。**修法**：改为 `import { buildSceneInitBrief, buildNookInitBrief } from '../../packages/shared/dist/index.js'`，`02 §⑪-6/§⑫-6` 关闭为「已按契约 §4 裁决下沉」。（与 B3 同根，落在 `02`。）
- **`02:110,394`** 用 `store.listFiles()`（无参）做判空/产物校验——与 `00:118`「`files` = `store.listFiles(dir)` 的结果」措辞不同，但 `listFiles` 默认 `prefix=''` 返回**全量 world 相对**，`directChildrenOf` 自行切前缀，**行为一致**。建议契约 `00:118` 的「`listFiles(dir)`」改成「`listFiles()`（全量）」以消歧（MINOR）。
- **`02:157,344`** 的 `missingFiles` 去重按**书写名 `p`**（非 `candidate`）：若两个 file 槽在不同 `baseDir` 下引用同名 `README.md`，会误去重。**MINOR**（当前 holmes 不触发）。
- **`03:421`** 承认 `sendMessage` 无返回值（实测 `useWorld.ts:198-203` 返回 `void`），`requestInit` 的 `false` 分支前提不成立；`03 §⑫-4` 已登记。**自洽，OK**。
- **`03:322`** 清幻影的匹配 `layer === cur`：`detail.layer` 是**归一后的层 id**。按 B1 修好归一后与 `initializingLayer`（前端传入的 target）同域；**未修 B1 前此比较可能永不命中**（detail.layer 是 `baker-...`、target 是 `world/baker-...`）。**修法随 B1 一并解决**；建议 `03 §3.6` 补一句「比较前两侧同域（契约 §2.2 归一）」。
- **`03:349`** 关于上帝模式路径（见 M3）——已登记待拍板，**不阻塞**。

---

## 8. 逐条验收对照（doc-11 → 文档）

| doc-11 条目 | 文档转述 | 结论 |
|---|---|---|
| §3.1 判据（README 有无） | `00:106-114`、`01:82-88`、`04:337-345` | ✅ 忠实 |
| §4.1 判据（除 json 外无文件） | `00:109-115`、`01:89-94`、`04:347-352` | ✅ 忠实（代码把「任意 json」固化，良性） |
| §5 W2 模板 | `00:133-148`、`01:104-111`、`04:361-364` | ⚠️ 前两行忠实；**第三行（新空目录零 AI）缺失**（M3） |
| §1 R1/R2/W2 | `00:87-95`、`02:14`、`03:85-93` | ✅ 忠实（W1 不属初始化） |
| §6.2 超时 60s/45s | `00:83`、`02:85`、`04:493` | ✅ 数值一致；「配置非常量」已改口并登记（M5 是 `02` 的死引用） |
| §6.1/§6.2 中断=不中断 | `03:429-430`、`02 §⑦` | ✅ 忠实 |
| §3.3 material 更正 | `00:148`、`03:126` | ✅ 忠实（W2 用 stub、成功用世界默认） |
| §4.3 nook「若缺则补」 | `00:222-228`、`02 §3.6` | ✅ 修法已裁决（增 `[Missing Files]`，落地 `brief.ts:96-98`） |
| §4.1 默认 brief「来历」 | `02:123-125`、`brief.ts:83-103` | ❌ **未兑现**（`home`/`role` 不进 brief；M4） |
| §6.1 事件 detail | `00:270-273`、`02:239-240`、`03:387-388`、`04:244-245` | ✅ 与 `events.ts:96-106` 逐字一致 |

---

## 9. 按严重度汇总修法

**BLOCKER（3）**
- B1：冻结 scene `target` 的 id 域与归一公式，使 `dir` 恒为 world 相对；同步 `00:61-64` 与 `02:101-104`。
- B2：`02 §3.2/§3.4/§3.5/§8.2` 重写为契约 §4.1/§4.2 的冻结形状（去 `parentLayerId`、`buildNookInitBrief(ctx)` 传 `displayName`）。
- B3：`04` 的测试落点改到 `packages/shared/test/brief.test.mjs` 与 `init-rules.test.mjs`；删除对 `brief-builder.*` 的引用。

**MAJOR（5）**
- M1：`04` 的 `14` → `9`。
- M2：契约 §2.3 增 in-flight 短路，或把 `02:113` 的「唯一来源」限定为顺序路径。
- M3：补/废 doc-11 §5「新空目录零 AI」这条。
- M4：brief 增「来历」（`role`/`home`）或回写 `doc-11:255`。
- M5：`02:631` 改成现行契约口径（命令内常量 + 待外提）。

**MINOR（§6/§7 共 ~11 条）**：行号刷新、已关闭冲突的措辞、`02` import 落点、`02:110/118` 的 `listFiles` 措辞、`missingFiles` 去重键、`03` 幻影同域注记。

---

## 10. Verdict

**小改后可落地。**

语义骨架（判空判据、事件 detail/调用签名、pi-rp `customTools`/`status`/`timeoutMs`/`handler` 签名、RPC 30s 时序、失败回退不对称）**经逐条对照源文件，转述准确、无偷换**；这是本批最扎实的部分。三处 BLOCKER 都**不是产品语义错**，而是**文档未跟上已冻结/已落地的形状**（B2/B3）与**一处契约级 id 域未定义**（B1）——修法是机械的。

唯一需要主 agent 拍板的语义分歧是 **M3**（doc-11 §5「新空目录零 AI」是否保留）与 **M4**（默认 brief 是否真的带「来历」）：两条都是「doc-11 承诺了、文档/代码没兑现」，建议按 §1.2/§1.6 的（a）选项补齐，而非回写产品语义。
