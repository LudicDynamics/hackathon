# docs/init/REVIEW-Implementability — I1 五篇的「可实施性」独立评审

> 评审角度：**一个没参与设计的实现者，能否照着这五篇零歧义地写出代码。**
> 只读评审，不改任何文档。基线：工作树 `/home/yoshix7ti/projects/hackathon`，2026-09-13。
> 契约 = `docs/init/00-共同上下文.md`（现行工作树版，含未提交的 §2.3/§3.3/§4 裁决）。
> 已落地代码实测：`99ae55d`（纯函数内核）+ `71bd888`（`nookCardPaths` / `directChildrenOf`）+ `ebf614a`（A 档接线）。
> 级别：**BLOCKER**（照文档写出来跑不通/依赖缺失）/ **MAJOR**（会写错或写不出来）/ **MINOR**（措辞/漂移）。
> 行号日期 2026-09-13，有保质期；实现前按符号名复核。

---

## 1. 伪代码完备性（02 篇的命令 handler）

结论：**主干完备、无「然后就这样」的空白；但 5 处字段/签名在 02 与「现行契约 + 已落地代码」之间已分叉——按 02 的伪代码逐字实现会编译不过或跑偏。**

### 1.1 BLOCKER — 02 §8.2 伪代码 import 的是已被契约废除的路径

- 02:308 `import { buildSceneInitBrief, buildNookInitBrief } from '../../apps/server/src/engine/brief-builder.js';`
- 02:25 / 02:33 / 02:281-290 全篇按「MODIFY `apps/server/src/engine/brief-builder.ts`」写。
- 但契约 §4 已裁决**下沉到 `packages/shared/src/render/brief.ts`**（00:186），且工作树里 `apps/server/src/engine/brief-builder.ts` 已被 `git rm`（`git status` 显示 `D`）。实测 `packages/shared/src/render/brief.ts` 存在、`packages/shared/src/index.ts:60` 已 export、`packages/shared/dist/render/brief.js` 已 build。
- 后果：照 02 写 → import 一个**已不存在的文件**；且 `extensions/`（jiti、不在 workspace）跨包直 import `apps/server/src`，与既有纪律（`extensions/toolkit/deps.ts:20` 逐字「只 import `../../packages/shared/dist/index.js`」）相反。
- 修法：02 §2.2/§8.1/§8.2 全改为「`packages/shared/src/render/brief.ts`（NEW，从 server 下沉；旧文件删除）」；02:308 改为
  `import { buildSceneInitBrief, buildNookInitBrief } from '../../packages/shared/dist/index.js';`；
  并把 02 §⑪-6、§⑫-6 从「待拍板」标记为**已裁决（选 A）**。

### 1.2 MAJOR — 02 §8.2 给 `buildSceneInitBrief` 传了契约已删的死字段 `parentLayerId`

- 02:38 把它设计成 `SceneInitContext` 字段；02:408 传 `parentLayerId: parentId ?? undefined,`；02:493 单测 #1 也传它。
- 契约已删（00:204 逐字：「`parentLayerId` 曾被 02 篇设计为字段却无输出行，属死字段，已删」）。实测 `packages/shared/src/render/brief.ts:16-28` 的 `SceneInitContext` **无该字段**。
- 后果：TS excess-property check 直接报错（对象字面量多传字段）。
- 修法：删 02:38 字段声明、02:408 实参、02:493 用例；`parentId` 只在命令内部用于算 `parentLayerPath`（00:204 的写法）。

### 1.3 MAJOR — 02 §8.2 的 `buildNookInitBrief` 调用是旧位置签名，且漏了契约新增的 `displayName`

- 02:415-416 `buildNookInitBrief(target, roleDesc, manifest, { missingFiles: await missingFilesFor(ctx, dir) })`（4 个位置参数）。
- 契约 §4.2 已冻结为**选项对象**且**新增 `displayName` 必填**（00:211-219）：`buildNookInitBrief({ characterId, displayName, roleDesc, manifest, missingFiles })`。实测 `packages/shared/src/render/brief.ts:68-81,83-103` 正是对象 + `displayName` 必填（`[Character] ${ctx.displayName}`）。
- 后果：照 02 写 → 类型不匹配；且 `displayName` 的来源（`parseFrontmatter(README).frontmatter.name ?? characterId`，契约 00:227）在 02 的命令伪代码里**完全没出现**——参数穿越链的一处断裂。
- 修法：02 §3.4-3/§3.5-2/§8.2:415 改写为对象，并补一步：
  ```ts
  const displayName = await displayNameFor(ctx, dir /* characters/<id> */, target);
  brief = buildNookInitBrief({ characterId: target, displayName, roleDesc, manifest,
                                missingFiles: await missingFilesFor(ctx, dir) });
  ```
  `displayNameFor` = `parseFrontmatter(await store.readFile(`${dir}/README.md`)).frontmatter?.name ?? target`（catch → `target`；契约 00:227 已点名此来源）。

### 1.4 MAJOR — 02 §3.6 / 契约的 `missingFiles` 来源写成「真实 preset 里不存在的形状」

- 02:139 逐字：「读 `characters/<id>/preset.json` 里所有 `{"kind":"file","path":…}` 槽的 `path`」；契约 00:227 同写 `{"kind":"file","path":…}`。
- 实测真实形状是 `{ kind:'slot', slot:'file', options:{ path: string|string[], baseDir?, glob?, onMissing? } }` —— `templates/holmes-world/characters/watson/preset.json:47-57`（`"slot":"file"` + `options.path` 数组 + `options.baseDir:"characters/watson"`）。
- 02 §8.2 伪代码（02:335-345）**写对了**（判 `item.kind==='slot' && item.slot==='file'`），但 §3.6 散文（02:139）与契约（00:227）写错。
- 后果：只读散文的实现者会写 `item.kind==='file'` → **差集恒空**（`[Missing Files]` 行永不出现，正是本节要修的 bug），`baseDir` 漏处理还会把已存在的 `README.md` 误报为缺失。
- 修法：把 00:227 与 02:139 改为逐字 `{"kind":"slot","slot":"file","options":{"path":…,"baseDir":…}}`，注明 `path` 可为 `string|string[]`、`baseDir` 默认 `''`（02:141 已有正确描述，上提即可）。

### 1.5 MINOR — `dir` 尾斜杠/空白只有「调用方保证」，命令内无归一动作

- 02:275 / 01:401 都推给调用方；01:159 明说 `isLayerEmpty('world/x/')` 会一律判「空」。
- 命令归一（02:381）`dir = target === 'world' || target.startsWith('world/') ? target : dirOfLayer(target)` **不剥尾斜杠、不 trim**；`parseInitArgs`（02:322）也只对 `target.trim()===''` 判空。
- 后果：`target='world/x/'` → 判空恒真 → 对已有内容的层重复初始化。
- 修法：命令 §3.2 加 `target = target.trim().replace(/\/+$/, '')`；并给 01:401 的待拍板项写定裁决「命令侧归一」。

### 1.6 分支覆盖盘点（主干合格，无空白）

逐字核对契约 §2.3 执行序（00:69-81）与 02 §8.2 伪代码：

| 分支 | 伪代码覆盖 | 位置 |
|---|---|---|
| 解析失败 / 缺字段 | ✅ | 02:374-375 |
| nook 非法 id | ✅ | 02:384-385 |
| 判空短路 | ✅ | 02:393-397 |
| manifest/父层解析失败 | ✅ | 02:401-418 |
| `spawnAgent` 抛异常 | ✅ | 02:429-432 |
| agent 失败/超时/取消 | ✅ | 02:445-448 |
| `completed` 但产物为空 | ✅ | 02:436-444 |
| W2 写盘失败 | ✅ | 02:449-451（不静默） |

---

## 2. 参数穿越链（`airp_init` WS → 命令 args → brief → `spawnAgent`）

链路：`03 §2.1`（WS 消息）→ `03 §3.4`（服务端拼 JSON）→ `02 §3.1`（`parseInitArgs`）→ `02 §3.5`（brief 实参）→ `02 §3.7`（`spawnAgent`）。

| 字段 | WS（03） | 命令 args（02） | brief | spawnAgent | 判定 |
|---|---|---|---|---|---|
| `kind` | `'scene'\|'nook'`（03:29,35） | 同（02:321） | 选 profileId | `profileId`（02:424） | ✅ |
| `target` | `string`（03:29,36） | 非空 string（02:322） | 归一进 `[Target Path]` | 经 brief | ⚠️ 见 2.1 |
| `request` | `string?`，空则整键省略（03:37,206） | `string?`（02:324） | `userPrompt`（02:410） | 经 brief | ✅ |
| `by` | 服务端**恒填 `'player'`**（03:207） | `'player'\|'engine'`（02:323） | 不进 brief | 只进 `detail.by` | ⚠️ 见 2.2 |
| `timeoutMs` | — | — | — | `TIMEOUT_MS[kind]`（02:310,427） | ✅ |
| `customTools` | — | — | — | `AIRP_TOOLS.map(t=>t.tool)`（02:426） | ✅ |

### 2.1 MAJOR — 「层 id」示例是**现实中不存在的形状**，归一分支会静默错

- 契约 00:57/00:62 与 03:36 都举「层 id（如 `baker-street/crime-scene`）」。
- 实测层 id **带 `world/` 前缀**：`packages/shared/src/store/layers.ts:62`（只收 `world/` 下目录）、`:79`（`id = layerOfDir(d)`，`layerOfDir` 只把 `world`→`map`，见 `layers.ts:37-39`）；`/api/enter-layer` 也按 `${layer}/README.md` 取文件（`apps/server/src/routes/world.ts:737`）。
- 而 02:381 的 `else dirOfLayer(target)` 对裸 `baker-street/crime-scene` **原样返回**（`dirOfLayer` 只映射 `map`）→ `dir` 无前缀 → 与 `listFiles()` 的 world 相对路径不匹配 → 判空恒真 + `[Target Path]` 写成无前缀路径。
- 现状没炸只因为前端传的是 `path.replace('/README.md','')`（`apps/web/src/components/canvas/CardRenderer.tsx:165`），本就带 `world/`。
- 修法：把 00:57/00:62、02:101-104、03:36 的层 id 示例统一改为 `world/baker-street/crime-scene`，删掉「层 id 或世界根相对目录二者皆可」的暗示；scene 支加断言 `dir==='world' || dir.startsWith('world/')`，否则报参数非法。

### 2.2 MINOR — `by:'engine'` 在 R2 链路上不可达

- 契约 00:57/00:65 冻结 `by:'player'|'engine'`；`schemas/events.ts:99` 的 `detail.by` 含 `'writer'|'player'|'engine'`。
- 但 03:207 服务端**恒写 `by:'player'`**，03 §3.8 上帝模式选项 A 也走默认 player。→ 全链路只有 `'player'`。
- 修法：03 §2.1 加可选 `by`（默认 player），服务端按值透传；或在 03 §3.4 写明「R2 恒 player，`engine` 归 R1/未来」，与 02:639 的登记对齐。

### 2.3 MINOR — `request:''` 的语义未写明

- 03:228 保证空 request 整键省略，故命令侧收不到 `''`；02:324 只校验类型。若真传 `''`，`brief.ts:44` 的 `if (ctx.userPrompt)` 为假 → 无害。跨端一致但未写明。
- 修法：02 §3.1 补一句「`request===''` 等价于省略」。

---

## 3. 改动清单（依赖序 · 环检测 · 遗漏）

汇总四篇的「新增/改动文件与函数」，按依赖序排列（⬆ 表示被下游依赖）：

| # | 文件 | 动作 | 出处 | 状态 |
|---|---|---|---|---|
| 1 | `packages/shared/src/rules/emptiness.ts` | NEW：`directChildrenOf`/`isLayerEmpty`/`isNookEmpty`/`hasInitProduct` | 01:175-178 | ✅ 已落地 |
| 2 | `packages/shared/src/rules/init-fallback.ts` | NEW：`W2SceneFiles`/`w2SceneTemplate` | 01:179-180 | ✅ 已落地 |
| 3 | `packages/shared/src/rules/characters.ts` | NEW：`isValidCharacterId`/`nookIdOf`/`characterIdOfPath`/`nookCardPaths` | 01:181-184 | ✅ 已落地 |
| 4 | `packages/shared/src/store/layers.ts` | `dirOf` 加 `export` | 01:185 | ✅ 已落地 |
| 5 | `packages/shared/src/index.ts` | 手工补 `export *` 行（无 glob） | 01:186 | ⚠️ `rules/*` 三行已落；`render/brief` 由他人补在 `:60`，**四篇均未登记** |
| 6 | `packages/shared/src/render/brief.ts` | NEW（从 `apps/server/.../brief-builder.ts` **下沉**） | 契约 00:186 | ⚠️ 已存在（未提交），02 仍写「MODIFY brief-builder」 |
| 7 | `apps/server/src/engine/brief-builder.ts` | **DELETE** | 契约 00:186 | ⚠️ 工作树已 `git rm`，02:25/§8.1 仍写 MODIFY |
| 8 | `pnpm --filter @airp/shared build` | 重建 dist | 00:332 / 04:314 | ⚠️ 硬前置，extension/探针按 `dist` import |
| 9 | `apps/server/src/engine/launch.ts` | `writerLaunch` 追加两行 `installPreset(scene-init/nook-init)` | 契约 00:244-249 | ❌ **未落地且无子文档认领**（见 3.1） |
| 10 ⬆9 | `extensions/toolkit/init-command.ts` | NEW：命令 handler | 02:26/§8.2 | ❌ 待做 |
| 11 ⬆10 | `extensions/tools.ts` | 调 `registerAirpInitCommand(pi, AIRP_TOOLS.map(t=>t.tool))` | 02:27/457-461 | ❌ 待做 |
| 12 | `apps/server/src/index.ts` | `ws.on('message')` 加 `else if (data.type==='airp_init')` | 03:188-221/§8.1 | ❌ 待做 |
| 13 | `apps/web/src/lib/i18n.ts` | 5 键 × 2 locale | 03:373/470 | ❌ 待做 |
| 14 | `apps/web/src/components/chrome/StubPrompt.tsx` | NEW | 03:156-166/456 | ❌ 待做 |
| 15 | `apps/web/src/components/canvas/Canvas.tsx` | 加可选 prop `ghost` | 03:64-69/460-466 | ❌ 待做 |
| 16 | `apps/web/src/App.tsx` | 2 state + `requestInit` + `handleEnterGate` + effect + `ghost` | 03:444-454 | ❌ 待做 |
| 17 | `apps/web/src/state/useWorld.ts` | 加 2 行 `dispatchEvent('airp:layer-init')` | 03:309-313/§6.2 | ⛔ **BLOCKED on A 档**（03 §⑪-3） |
| 18 ⬆11,17 | `tools/init-probe-provider.ts` | NEW：确定性 provider | 04:30/282 | ❌ 待做 |
| 19 ⬆18 | `tools/probe-init.mjs` | NEW：端到端探针 | 04:29/281 | ❌ 待做 |
| 20 | `packages/shared/test/init.test.mjs` | NEW | 04:31/283 | ⚠️ 与已落地的 `init-rules.test.mjs` 重叠（见 4.3） |
| 21 | `apps/server/test/init-brief.test.mjs` | NEW | 04:32/284 | ⚠️ 目标模块已迁 shared（见 4.1） |
| 22 | `package.json` | `"probe:init"` | 04:285 | ❌ 待做 |
| 23 | `AGENTS.md:276` | 复合门禁加 `probe:init` | 04:287-290 | ❌ 待做 |

### 3.1 BLOCKER — preset 安装（#9）无文档认领，而它是 R2 与探针正例的硬前置

- 契约 §5 冻结了落点（00:244-250：`writerLaunch` 里追加 `installPreset(scene-init/nook-init)`），并列为**本批新增**。
- 但 02:479（D7）逐字：「**不在本文件**——归 `05` 篇 / `launch.ts` 的接线（契约 §5）」；而 `ls docs/init/` 实测只有 `00–04`，**不存在 05 篇**，四篇里也无人认领 `launch.ts`。
- 后果：按文档做完全部四篇后，`ctx.spawnAgent({ profileId:'scene-init' })` 因 preset 未装 → `prepareSubagentConversation` 返回 error → `status:'failed'`（02:266 已描述）→ **探针 P1/P2/P4/P14/P15/P16 全红**，R2 永远走 W2 兜底。
- 修法：把 `launch.ts` 的两行安装写进**持有命令落点的 02 篇**（§4 或 §8），或明确新增 `docs/init/05`；同时把 02:479 的「归 05 篇」改为实际持有者。

### 3.2 环检测：无循环依赖

- `rules/characters.ts` → `rules/emptiness.ts`（`characters.ts:18`）单向，无环。
- `extensions/toolkit/init-command.ts` 由 `extensions/tools.ts` 单向 import；命令**不反向 import** `tools.ts`（02:463 用 `airpTools` 显式注入规避）——正确，无环。
- 02 原设计「命令 → `apps/server/src`」不构成环，但属跨包反向（见 1.1）。
- 结论：**依赖序可线性化**（见 §5）。

### 3.3 MINOR — `index.ts` 的 barrel 行：四篇都没登记 `render/brief`

- 契约 §3.5 只要求补三行 `rules/*`（00:178）；实测 `packages/shared/src/index.ts:60` 已有 `export * from './render/brief.js'`，但契约 §4 的落点段没把「补 barrel 行」写成必做。
- 后果：只照 §3.5 补三行、下沉 brief 后忘加第 4 行 → extension/探针 import 不到（正是 `index.ts:49-51` 注释警告的「静默不可达」）。
- 修法：契约 §4.1 落点段补一句「并 MUST 在 `index.ts` 补 `export * from './render/brief.js'`」，与 §3.5 同规格。

---

## 4. 验收可执行性（04 篇 20 条探针断言）
结论：**断言本身大多可写成代码，fixture 与 provider 范式都真实存在；但 4 处落点/期望值/前置与现状不符，照抄会红或写不出来。**

### 4.1 MAJOR — brief 单测文件路径指向已迁走的模块

- 04:32 / 04:284 / 04:316 / 04:371 都写 `apps/server/test/init-brief.test.mjs`，且 04:284 逐字「import `../dist/engine/brief-builder.js`」。
- 实测：`apps/server/dist/engine/brief-builder.js` 仍在（旧产物），但**源文件已删**（`git status`：`D apps/server/src/engine/brief-builder.ts`），契约已把 brief 移到 `packages/shared/src/render/brief.ts`（00:186）。
- 后果：照 04 写 → 测一个 `pnpm build` 后会消失的旧 dist → import 失败。
- 修法：04 §2.1/§8/§10.1 的 brief 单测改为 `packages/shared/test/brief.test.mjs`、import `../dist/index.js`（工作树里该文件已如此存在）。

### 4.2 MAJOR — 04 §3.0 的 P18 期望值 `14` 与实测/03 篇矛盾

- 04:113 逐字「`pnpm check:ws` findings 数不变（`=== 14`，`[实测]`）」。
- 实测 `node tools/check-ws-contract.mjs --json`（2026-09-13 工作树）→ `summary: { contract:24, emitted:24, consumed:11, findings:9 }`；03:515 也写**基线 9**。
- 后果：P18 按 `14` 写**恒红**。
- 修法：04:113 改为 `=== 9`（与 03:515 一致）；`AGENTS.md:280` 的「14 条」是 2026-09-12 旧值，回写为 9。

### 4.3 MAJOR — 04 §2.1 的 `init.test.mjs` 与已落地的 `init-rules.test.mjs` 重叠且分工不明

- 04:31 主张 NEW `packages/shared/test/init.test.mjs`。
- 实测已存在 `packages/shared/test/init-rules.test.mjs`（`99ae55d`/`71bd888` 落地，含 `isLayerEmpty`/`isNookEmpty`/`hasInitProduct`/`w2SceneTemplate`/三函数/`nookCardPaths`），01:187-189 也承认它。
- 后果：实现者会写**第三份重叠测试**，或误删既有测试。
- 修法：04 §2.1/§10.2 改为「**扩充** `init-rules.test.mjs`」（列增量用例），或写死「`init.test.mjs` 只放 04 新增边界，与 `init-rules.test.mjs` 互斥」。

### 4.4 MAJOR — 04 依赖的 preset 安装未落地，P1/P14/P16 正例无法通过（同 3.1）

- 04 §3.2 的 P1、§3.5 小天地正例、§3.6 W2 兜底都建立在 `spawnAgent('scene-init'/'nook-init')` 能真跑；该前置（`launch.ts` 两行 `installPreset`）**无文档实现**（3.1），探针的 `writerLaunch`（04:127）也不装。
- 后果：按现状实现 04 全部工件后正例仍全红，会误判为「实现没接对」。
- 修法：同 3.1；探针加一条前置断言「`getCommands()` 含 `airp-init` 且 init preset 已装载」，把「前置缺失」与「实现错误」分开打印。

### 4.5 可执行性逐条核验（fixture / provider / env 是否真实存在）

| 依赖 | 04 位置 | 实测 | 判定 |
|---|---|---|---|
| `makeTmpWorld` / `writerLaunch` / `RpcClient` 范式 | 04:35,127 | `tools/probe-inject.mjs:66-73,122-152` | ✅ |
| `inject-probe-provider.ts` 注册形状 | 04:39 | `tools/inject-probe-provider.ts:103-147`（`registerProvider`+`streamSimple`） | ✅ |
| `parseFrontmatter` | 04:146 | `packages/shared/src/schemas/frontmatter.ts:180`，`index.ts:2` 导出 | ✅ |
| `LocalWorldStore.getEventsSince` / `close` | 04:153,155 | `local-store.ts:450` / `:1553` | ✅ |
| `client.getCommands()`（P20） | 04:115,121 | `rpc-client.ts:627`，返回 `RpcSlashCommand[]`（字段 `name`） | ✅ |
| `--extension` 只扫 `extensions/` 顶层（provider 不进生产） | 04:30 | `presets.ts:124-152` 逐字 | ✅ |
| fixture：`world/probe-stub` 空目录 | 04:72-74 | 模板 `world/{abandoned-orchard,baker-street,crime-scene}/` 都有 README.md，须自造 | ✅ 合理 |
| fixture：`characters/probe-nook` 仅 `preset.json` | 04:77-80 | `characters/{watson,constable}` 都有 README，须自造 | ✅ 合理 |
| W2 断言 `material: stub` + `opening.md` | 04:111,330 | `rules/init-fallback.ts:29-35` 逐字产出 | ✅ |
| P7 `detail.files` 为 world 相对全路径 | 04:102,159 | 02:358-362 的 `directChildPaths` 产全路径；契约未冻结（02 §⑫-3） | ⚠️ 依赖 02 实现选择，非空话但未冻结 |

### 4.6 明确「空话」或不可机械断言的项

- 04 §3.4 自述 P10-P13「修复前 0→0（vacuous）」（04:194-196）——**不是空话，是分组成员**，保留。
- 04:271「写盘部分失败 → 初始化器按 `03` 篇在回报里明说」标「不机械断言」——**合理**（依赖模型行为）。
- 04 §12.1-1 `timed-out` **刻意不覆盖**（04:493）、§12.1-2 的 30s RPC 超时（04:494）——**显式登记，非遗漏**（但见 4.7）。

### 4.7 MINOR — `timed-out` 分支无自动覆盖，且依赖 02 的「可测内核」尚未抽取

- 04:504 逐字：「需 02 篇先抽出『命令内核 = (store, spawnAgent, brief) 三依赖注入』的可测形状。若 02 不抽，超时只能手测。」
- 02 §8.2 是一个**大闭包 handler**（02:367-453），无依赖注入缝 → 该可测性前提**未兑现**。
- 修法：02 明确回答「抽 or 不抽」；若不抽，04 §12.1-1 直接写「超时仅手测」，删掉依赖 02 的悬置条件。

---

## 5. 按依赖序的落地清单（可直接照做）

```
阶段 0  纯函数内核（已落地 ✅）
  0.1 packages/shared/src/rules/emptiness.ts        directChildrenOf / isLayerEmpty / isNookEmpty / hasInitProduct
  0.2 packages/shared/src/rules/init-fallback.ts    W2SceneFiles / w2SceneTemplate
  0.3 packages/shared/src/rules/characters.ts       isValidCharacterId / nookIdOf / characterIdOfPath / nookCardPaths
  0.4 packages/shared/src/store/layers.ts           导出 dirOf
  0.5 packages/shared/src/index.ts                  补 3 行 rules/* export
  0.6 packages/shared/test/init-rules.test.mjs

阶段 1  brief 下沉 + 构建（部分落地）
  1.1 NEW packages/shared/src/render/brief.ts        buildSceneInitBrief / buildNookInitBrief
  1.2 packages/shared/src/index.ts  + export * from './render/brief.js'   ← 四篇未登记
  1.3 DELETE apps/server/src/engine/brief-builder.ts                       ← 02 仍写 MODIFY
  1.4 pnpm --filter @airp/shared build              （硬前置：extension/探针按 dist import）

阶段 2  世界侧 preset 安装（❌ 无文档认领，BLOCKER）
  2.1 apps/server/src/engine/launch.ts  writerLaunch 追加：
        installPreset(worldRoot, path.join(repoRoot,'presets','scene-init.json'));
        installPreset(worldRoot, path.join(repoRoot,'presets','nook-init.json'));

阶段 3  扩展命令（依赖 1.4 + 2.1）
  3.1 NEW extensions/toolkit/init-command.ts         parseInitArgs / missingFilesFor / displayNameFor / writeW2 / registerAirpInitCommand
  3.2 extensions/tools.ts default export 调 registerAirpInitCommand(pi, AIRP_TOOLS.map(t=>t.tool))

阶段 4  服务端触发
  4.1 apps/server/src/index.ts  ws.on('message') 加 airp_init 分支（fire-and-forget writer.prompt）

阶段 5  前端（5.4 阻塞于 A 档广播）
  5.1 apps/web/src/lib/i18n.ts                      5 键 × 2 locale
  5.2 NEW apps/web/src/components/chrome/StubPrompt.tsx
  5.3 apps/web/src/components/canvas/Canvas.tsx     可选 prop ghost
  5.4 apps/web/src/App.tsx                          2 state + requestInit + handleEnterGate + effect + ghost
  5.5 apps/web/src/state/useWorld.ts                2 行 dispatchEvent('airp:layer-init')   ⛔ BLOCKED on A 档

阶段 6  验收工件（依赖 3、4）
  6.1 NEW packages/shared/test/brief.test.mjs       （非 apps/server/test，见 4.1）
  6.2 扩充 packages/shared/test/init-rules.test.mjs （非新建 init.test.mjs，见 4.3）
  6.3 NEW tools/init-probe-provider.ts
  6.4 NEW tools/probe-init.mjs
  6.5 package.json 加 "probe:init"
  6.6 AGENTS.md:276 复合门禁加 probe:init

验证（评审照抄）
  node tools/check-ws-contract.mjs   → findings === 9（非 14）
  node --test packages/shared/test/init-rules.test.mjs
  node --test packages/shared/test/brief.test.mjs
  node tools/probe-init.mjs
```

**并行性**：阶段 5（前端）与阶段 2/3/4（后端）互不依赖，可并行；5.5 单点阻塞于 A 档广播。阶段 6 依赖 3/4 落地与 2.1。

---

## 6. verdict

**小改后可落地。**

文档的设计质量与伪代码完整度足以支撑实现：执行序 6 步全有分支定义、参数穿越链的形状基本闭合、依赖序无环、验收断言大多可机械核验。拦路的是**三处「文档与世界已分叉」的同步缺口**与**一处零认领的硬前置**，全部是笔误级修补、不是设计返工：
1. **BLOCKER ×2**：preset 安装（`launch.ts`）无子文档认领（3.1 / 4.4）；02 §8.2 import 已删除的 `brief-builder.ts`（1.1）。
2. **MAJOR ×8**：02 传死字段 `parentLayerId`（1.2）；02 的 nook brief 旧签名 + 缺 `displayName`（1.3）；`missingFiles` 解析形状写错（1.4）；层 id 示例形状错（2.1）；04 的 brief 单测路径指向已迁模块（4.1）；P18 期望值 `14` 应为 `9`（4.2）；`init.test.mjs` 与既有测试重叠（4.3）；探针正例因 preset 未装而全红（4.4）。
3. **MINOR ×5**：`dir` 归一归谁（1.5）；`by:'engine'` 不可达（2.2）；`request:''` 语义（2.3）；`index.ts` 缺 `render/brief` barrel 行登记（3.3）；`timed-out` 无自动覆盖且依赖未兑现（4.7）。

这些改完后，一个未参与设计的实现者可以照四篇 + 契约 **零歧义** 地写出：三个纯函数（已落地）、brief 两函数、`airp-init` 命令、WS 触发、前端消费、以及 P1-P20 探针。若不做修改而直接实现，**必踩**的是 preset 未装（正例全红）与 brief-builder 路径（编译不过）这两条。
