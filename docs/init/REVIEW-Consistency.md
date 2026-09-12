# docs/init — 独立评审：一致性（文档之间 / 文档与代码之间）

> 评审角度：**一致性**。只读评审，未改任何被评文件。
> 复核时间 2026-09-13，工作树 `/home/yoshix7ti/projects/hackathon`。
> 复核基准（md5 / mtime）：
> - `00-共同上下文.md` `7a26a15b…` / 02:28
> - `01-纯函数与校验.md` `933dfaf9…` / 01:35
> - `02-brief与执行内核.md` `c62f161a…` / 01:45
> - `03-触发链路与前端.md` `c81040be…` / 02:26
> - `04-验收与回归.md` `cba0d9aa…` / 01:47
>
> 已落地代码基准：`packages/shared/src/rules/{characters,emptiness,init-fallback}.ts`、`packages/shared/src/render/brief.ts`（未跟踪）、`packages/shared/src/store/layers.ts`、`packages/shared/src/index.ts`、`packages/shared/test/init-rules.test.mjs`。
> 级别：**BLOCKER**（会误导实现/验收、或与冻结契约或已落地代码直接矛盾）/ **MAJOR**（同一事实两处说法不一致，读者会据错版本行动）/ **MINOR**（行号/命名漂移，不影响行为）。
> 无法核实的标 `[无法核实]`。

**总览**：00 契约在 02:28 被主 agent 改过一轮（删 `parentLayerId`、把 W2 键定案为文件名、补 `nookCardPaths`/`directChildrenOf` 裁决、把 RPC 30s 陷阱写进 §2.3），但 **01/02/03/04 四篇未同步回改**，`render/brief.ts` 下沉这一契约级裁决也只在 00 里体现。四篇里普遍残留 02:28 之前的契约形状与 `brief-builder.ts`（已删除）的引用。

---

## 一、契约（00）自身

### 00-1 `kind:'scene'` 的「层 id」示例缺 `world/` 前缀 —— BLOCKER
- `docs/init/00-共同上下文.md:62`：`kind: 'scene'` → `target` = **层 id**（如 `baker-street/crime-scene`）。
- 代码里层 id **带** `world/` 前缀：`packages/shared/src/store/layers.ts:4-8`（`world/baker-street/ → 'world/baker-street'`）；`deriveLayers` 的 `id = layerOfDir(d)`（`layers.ts:79`）直接沿用目录串；前端 `currentLayer` 也是 `world/…` 形态（`apps/web/src/App.tsx:354,394`；测试 `apps/server/test/smoke-routes.mjs:139` `layer: 'world/inn'`）。
- 后果：若实现者照契约示例传 `baker-street/crime-scene`，`init-command` 的归一 `dirOfLayer(target)`（`layers.ts:32-34`，只把 `'map'` 映到 `'world'`）会得到 `baker-street/crime-scene` —— **没有 `world/` 前缀的目录**，`isLayerEmpty` 永远判「空」，判空短路永不生效，且写盘落到世界根外的错误路径。这是会直接产 bug 的示例。
- 修法：把 :62 的示例改为 `world/baker-street/crime-scene`（层 id 与目录同形，两者现在写法不同反而更易混）。`03` 篇同错见 03-1。

### 00-2 §3.1 / §3.4 仍称 `dirOf` 在 `layers.ts:42` 且「私有未导出」 —— MINOR
- `00:116`：`packages/shared/src/store/layers.ts:42` 的 `dirOf` **是私有未导出**；`00:152`、`00:159` 同述 `layers.ts:42`。
- 实际：`packages/shared/src/store/layers.ts:46-49`（`dirOf` 已导出），是 `71bd888` 之后的行号。
- 修法：三处 `layers.ts:42` 改为 `layers.ts:46-49`，把 §3.4「私有」措辞改为「本批导出的既有实现」。`01` 篇同处已改对（`01:185`），只有契约残留。

### 00-3 §3.1 那句「取直接子级需要一个 `dirOf`」与最终实现路径不符 —— MINOR
- `00:116` 想定 `emptiness.ts` 用 `dirOf`；实际用前缀切片 `directChildrenOf`（`packages/shared/src/rules/emptiness.ts:19-29`），`dirOf` 的唯一调用者仍是 `layers.ts:111`。
- `01:389-394`（冲突 8）已登记且结论正确；契约侧未回改，两处并存。修法：采纳 `01` 建议，把 §3.1:116 放宽为「需要一个统一的前缀/目录提取口径」，或直接引用 §3.5 的 `directChildrenOf`。

### 00-4 §4.3 / §6 / §12 出现未定义的「`05` 篇」 —— MAJOR
- `00:232`、`00:236`、`00:273` 把回写任务指给 **`05` 篇**（doc-11 §4.3 的 `1~3`、doc-11 §2.2 样例三行、doc-11 §6.1 的 `path`→`layer`）。
- 但 §12 的文档清单（`00:356-359`）只有 `01`–`04` 四篇，全仓无 `docs/init/05-*.md`。同一指代在 `02:479,565,577,589` 反复出现。
- 后果：回写清单落到不存在的篇目，实际无人认领。修法：或新增 `05-回写清单.md` 并在 §12 登记，或把这些回写项并入 `04` 篇（`04:403` 的标题恰是「发现的冲突 / 需要修订的上位文档」，本就是回写清单的家）。

---

## 二、01-纯函数与校验.md

### 01-1 §⑪ 冲突 1 的对象已不存在（契约早已改） —— BLOCKER
- `01:331-343`（冲突 1）称契约 §3.3 冻结的是 `{ readme: string; chalk: string }`，据此报「代码 W2SceneFiles 与契约签名不逐字一致」。
- 契约现在 `00:138-145` 冻结的就是 `W2SceneFiles` / `{ 'README.md', 'opening.md' }`，且 `00:145` 逐字写「`01` 篇初稿写的 `{readme, chalk}` 作废」。**冲突已消解。**
- 后果：实现者读 §⑪-1 会去「修」一个不存在的冲突（甚至被引向改回 `{readme,chalk}`）。修法：把 `01:331-343` 改写为「已按契约 §3.3 收敛为 `W2SceneFiles`（`00:138-145`、`init-fallback.ts:18-23`）」，或删除后移入 §⑨。

### 01-2 正文仍描述**不存在的私有 `directChildren`**，且漏 `directChildrenOf` / `nookCardPaths` —— BLOCKER
- `01:37`（§2.2 签名块）：`function directChildren(files, dir): string[];`（无 `export`）。
- `01:75-80`（§3.1）、`01:175`（§⑧ 行 1「`directChildren`（私有）| `15-25`」）同述。
- 实际代码：`emptiness.ts:19-29` 是 **`export function directChildrenOf`**（`71bd888` 重命名 + 导出，供 `characters.ts:18,66` 复用）。**名称、导出性、行号三者全错。**
- 同时 `01:27`（§2.1）`characters.ts` 只列三函数，**漏 `nookCardPaths`**；而契约 `00:173`、`00:180`（裁决）与代码 `characters.ts:65-69` 都有它。
- 修法：01 篇通篇 `directChildren` → `directChildrenOf`（并标 `export`）；`01:27`/§2.2 签名块补 `nookCardPaths(allFiles, nookId): string[]`；§⑧ 行 1 行号改 `19-29`。

### 01-3 §⑪ 冲突 6 的事实已被契约裁决推翻 —— MAJOR
- `01:379-383` 称「nook 00 §5.2 冻结三函数，`nookCardPaths` 若真要落属 nook 批，本批契约只有三函数」。
- 契约 `00:171-174` 已把 `nookCardPaths` 列入 `characters.ts` 冻结签名，`00:180` 有主 agent 裁决（2026-09-13）采纳之，代码也已落地（`characters.ts:65-69`，`71bd888`）。
- 后果：01 篇把已裁决的事写成「未决/别批」→ 与契约、代码三方矛盾。修法：改写为「已按契约 §3.5 裁决落地（`00:180`、`characters.ts:65`）」。

### 01-4 「落地状态」的 commit 与测试条数过期 —— MAJOR
- `01:8`：「本批的代码已在 commit `99ae55d` 落盘」。
- 实际：`nookCardPaths` / `directChildrenOf` 在**其后**的 `71bd888` 才落（`git show --stat 71bd888`：改 `emptiness.ts`/`characters.ts`/`init-rules.test.mjs` + 契约）。`render/brief.ts` 至今仍是**未跟踪**文件。
- `01:136`、`01:187`、`01:189`、`01:211`、`01:215`、`01:221`、`01:323` 一律称单测「**8 条**」，行区间 `16-101`。
- 实际 `packages/shared/test/init-rules.test.mjs` 现有 **10 条**（前八 + `directChildrenOf` + `nookCardPaths`），文件 126 行。
- 修法：`01:8` 基准 commit 改为 `71bd888`（或写「`99ae55d` + `71bd888`」）；全篇「8 条」→「10 条」，`01:187` 行区间改 `16-127`，`01:189` 用例清单补 `directChildrenOf`/`nookCardPaths`。

### 01-5 `characters.ts` 的行号引用整体漂移（`71bd888` 扩了文件头） —— MINOR
- `01:115` `CHARACTER_ID_RE` `:18` → 实为 `:21`；`01:115`/`01:167` `isValidCharacterId` `:21-23`/`:22` → 实为 `:24-26`；`01:116`/`01:183` `nookIdOf` `:32-34` → 实为 `:35-37`；`01:117-121`/`01:184` `characterIdOfPath` `:43-50` → 实为 `:46-53`。
- `01:178`（§⑧ 行 4）`hasInitProduct` `59-68` → 实为 `63-72`。
- 修法：按符号名重定位后统一回填。

---

## 三、02-brief与执行内核.md

### 02-1 `buildNookInitBrief` 仍是**旧的位置参数签名** —— BLOCKER
- `02:47-52` 冻结为 `buildNookInitBrief(characterName, roleDesc, manifest, opts?)`；`02:124`、`02:415`（§8.2 伪代码 `buildNookInitBrief(target, roleDesc, manifest, {missingFiles})`）、`02:498`（§10.1 #6）同。
- 契约 `00:206-219` 已裁决为**选项对象** `buildNookInitBrief(ctx: NookInitContext)`；已落地代码 `packages/shared/src/render/brief.ts:83` 正是选项对象。
- 后果：实现者照 02 §2.2/§8.2 会写出三个位置参数 + 尾对象，与该函数真实签名不符，编译不过或写错调用点。修法：`02:34-52` 整块换成契约 `00:211-219` 的 `NookInitContext` 形态；`02:415` 改为 `buildNookInitBrief({ characterId: target, displayName, roleDesc, manifest, missingFiles })`；§3.4-3/§10.1 同步。

### 02-2 §8.2 伪代码 import 一个**已删除**的文件 —— BLOCKER
- `02:308`：`import { buildSceneInitBrief, buildNookInitBrief } from '../../apps/server/src/engine/brief-builder.js';`
- `apps/server/src/engine/brief-builder.ts` 已删除（`git status` 显示 `D`），契约 `00:186` 裁决下沉到 `packages/shared/src/render/brief.ts` 并「原文件删除——零调用点，不留 shim」。
- 修法：`02:308` 改为从 `'../../packages/shared/dist/index.js'`（与同段 `02:303-306` 的 shared import 合并）导入。

### 02-3 §2.1 / §8.1 的落点与字段仍是**下沉前**的 —— MAJOR
- `02:25`：`apps/server/src/engine/brief-builder.ts MODIFY SceneInitContext +2 字段…`；`02:281-285`（§8.1）同，且 `02:285` 指令「增 `parentLayerId?: string` / `parentLayerPath?: string`」。
- 契约 `00:186` 已把落点定为 `render/brief.ts`；`00:197` 只留 `parentLayerPath`，`00:204` 明写「**不设 `[Parent Id]`**——`parentLayerId` 曾被 02 篇设计为字段却无输出行，属死字段，已删」。
- `02:38`、`02:285` 仍把 `parentLayerId` 作为要新增的字段；`02:34-42` 的 `SceneInitContext` 含 `parentLayerId`，与契约 `00:193-201` 不一致。
- 修法：`02:25`/`02:281` 的文件行改 `packages/shared/src/render/brief.ts (MODIFY，已由契约 §4 下沉)`；`02:34-42` 删 `parentLayerId`；`02:285` 改为「仅增 `parentLayerPath`」。

### 02-4 §8.1 引用的行号全部落在已删文件上 —— MAJOR
- `02:287`（`:39-40`）、`02:288`（`:51`）、`02:289`（`:55`）、`02:290`（`:54`）与 §⑪-1 比对表 `02:552-553` 引 `brief-builder.ts:39-40,:55`。
- 这些符号现在在 `render/brief.ts`：`[Report]` scene 在 `:61-62`、nook 在 `:100`、`[Deliverables] 2–4` 在 `:59,:93`。
- 修法：全篇 `brief-builder.ts` → `render/brief.ts` 并按新行号回填；§⑪-1 比对表同样。

### 02-5 §⑪ 冲突 6（brief 落点）已被契约裁决，02 仍写成「未定」 —— MAJOR
- `02:591-604` 列 A/B 两选项并称「**待主 agent 拍板**」；`02:636`（§⑫-6）「brief-builder 的落点…**未定**」。
- 契约 `00:186` 已裁决（下沉 `render/brief.ts`，选 A），代码已按 A 落地（`render/brief.ts` 存在、`brief-builder.ts` 删除），`00:186` 还反向引用「02 §⑪-6」。
- 修法：§⑪-6 与 §⑫-6 改写为「已按契约 §4 裁决采纳方案 A，落盘 `render/brief.ts`（`00:186`）」。

### 02-6 §⑪ 冲突 5（`roleDesc` 为空产生空括号）已被代码/契约解决 —— MINOR
- `02:585` 声称 brief 会输出 `[Character] ${characterName} ()`。
- 契约 `00:214` 规定「空则省略括号」；代码 `render/brief.ts:87-89` 已是三目省略括号。
- 修法：冲突 5 改写为「已按契约 §4.2 落地为条件拼接（`brief.ts:87-89`）」。

### 02-7 §⑪ 冲突 1 的「契约现状」与 30s 结论过期 —— MINOR
- 与 03-2 同源：契约 `00:85` 已写「必须处理的 RPC 超时陷阱（04 §12.1 实测）」并要求「等待窗口 > timeoutMs 或 fire-and-forget」。`02:185` 仍把该风险当作「契约 §8 反模式 2 的同类」，未引 `00:85`。
- 修法：`02:185` 补引用 `00:85`，与 03 篇统一表述。

### 02-8 §⑫ 多条自发「待拍板」实际已在契约定案 —— MINOR
- `02:631`（超时值）、`02:634`（nook 失败是否落模板）、`02:637`（`display:false`）、`02:639`（`by` 不进 `'writer'`）：契约 `00:83`（超时冻结）、`00:234`（nook `fallback:'none'`）、`00:58`（`sendMessage`）已有结论。
- 修法：逐条把「未定」改为引用契约对应行；保留真正未决的（`02:633` `files` 形状、`02:632` `missingFiles` 的 glob）。

---

## 四、03-触发链路与前端.md

### 03-1 层 id 示例同样缺 `world/` 前缀 —— MAJOR（与 00-1 同源）
- `03:36`：`scene = **层 id**（如 `baker-street/crime-scene`）`。与 `00:62` 同错，见 00-1。
- 修法：示例改 `world/baker-street/crime-scene`；并补一句「= 目录串，含 `world/` 前缀」（依据 `layers.ts:4-8`）。

### 03-2 §⑪ 冲突 1（RpcClient 30s）称契约未覆盖，实际已覆盖 —— MAJOR
- `03:556-564`（冲突 1）：「契约现状：…**未说明是否 await、也未提 30s**」「报主 agent 裁决——若要在契约里补一条…」。
- 契约 `00:85` 现在**逐字**覆盖：「必须处理的 RPC 超时陷阱（04 §12.1 实测）…落地方必须：RPC 调用的等待窗口 > 命令内 timeoutMs（如 75s/60s），或改用 fire-and-forget…（推荐，见 `03` 篇）」。契约甚至反向指到 `03` 篇。
- 后果：读者以为这是悬而未决的新风险。修法：把冲突 1 降级为「已按契约 §2.3（`00:85`）裁决采用 fire-and-forget」，删「报主 agent」诉求。

### 03-3 引用已删除的 `brief-builder.ts` —— MAJOR
- `03:184`：`buildSceneInitBrief` 的 `if (ctx.userPrompt)`（`apps/server/src/engine/brief-builder.ts:23`）。
- 该文件已删；等价位置在 `packages/shared/src/render/brief.ts:44`（`if (ctx.userPrompt)`）。
- 修法：路径与行号改 `render/brief.ts:44`。

### 03-4 「A 档未提交」这一前提已被 `ebf614a` 提交 —— MAJOR
- `03:7`、`03:485`、`03:586` 以「`useWorld.ts`/`App.tsx` 含 **A 档未提交改动**、最新 commit `71bd888`、wiring 未广播」为等待前提（§⑪-3、§6.2 的 BLOCKED）。
- 实际 HEAD = `ebf614a`（`feat(wiring): 前端接线 A 档止血 … world_event 消费`，改 `useWorld.ts` +86、`App.tsx` +29），`useWorld.ts` 的 `case 'world_event'`（`:326-335`）、`seenEventIds`（`:107`）已在提交里。
- 后果：§⑪-3 的「等待点/前置」描述的是旧状态，读者无法判断 A 档是否已到。修法：更新为「A 档已随 `ebf614a` 落地；`03:309-314` 的两行 `dispatchEvent` 现可直接加」。

### 03-5 §10.2 承诺的 P1–P3 探针在 04 篇没有对应断言 —— MAJOR
- `03:521-523` 列 P1（作家进程收到 `/airp-init`）、P2（`request` 有无 → brief 是否有 `[Player Request]`）、P3（落账后 `world_event{type:'layer_initialized'}` 广播）。
- `04` 篇的探针明确**不解析 brief**、**不走 WS**：`04:59`「provider 不该解析 brief」、`04:253`「探针**不走 WS**…直接读 history.db」。故 03 的 P2/P3 在 04 无落地断言（04 的 P1–P20 里没有「读 brief 文本」或「抓 WS 帧」这两类观察点）。
- 修法：或把 `03:521-523` 三个断言并入 04 §3 的表（新增「brief 文本断言」「WS 抓帧断言」两组，或显式声明「P2/P3 归浏览器 smoke，不进离线探针」）。

---

## 五、04-验收与回归.md

### 04-1 `pnpm check:ws` 基线写 14，实测为 9 —— BLOCKER
- `04:113`（P18）、`04:318`、`04:390`：`pnpm check:ws` findings **不变（`=== 14`，`[实测]`）**，修复前/后均 14。
- 实测（本机）：`node tools/check-ws-contract.mjs --json` → `summary: { contract: 24, emitted: 24, consumed: 11, findings: 9 }`。`03:515` 也写 `findings: 9` 并称「本档交付后必须仍是 9」。
- 后果：三篇对同一门禁给出**互相矛盾**的基线，且 04 标着 `[实测]` 却是错的（14 是 `AGENTS.md:278` 的 2026-09-12 历史值）。照 04 跑的验收会「修复前就是 9≠14」直接假红。修法：`04:113,318,390` 的 14 → 9，删 `[实测]` 或注明取自 `03:515`。

### 04-2 `characterIdOfPath` 断言 `'characters/a/../..'→null` 与代码/测试/01 篇矛盾 —— BLOCKER
- `04:369`（§10.2 #24）：`characterIdOfPath`：`'characters/a/../..'→null`。
- 实际：`characters.ts:46-53` 取第一个 `/` 前的 id 段 `'a'`（穿越段被忽略），返回 `'a'`；`init-rules.test.mjs` 断言 `'a'`；`01:261`（§10.3 #8）也写 `'a'`。
- 后果：照 04 写断言必红；且 04 自称与 01 篇「互为镜像」，此处恰为镜像失败。修法：`04:369` 该例改 `→'a'`。

### 04-3 `isValidCharacterId` 断言 `'a-'`→false 与代码/01 篇矛盾 —— BLOCKER
- `04:367`（§10.2 #22）：`['','A','Ryo','-a','a-','a/b','a/../..','七海',' a']` → `false`（把 `'a-'` 列为 false）。
- 实际：正则 `^[a-z0-9][a-z0-9-]*$`（`characters.ts:21`）**接受**尾随连字符，`'a-'` → `true`；`01:239`（§10.1 #13）逐字写「`'a-'` / `'a--b'` | `true` | **尾随/连续连字符是合法的**」。
- 后果：两篇对同一函数同一输入给出相反期望，且 04 与代码相反。修法：把 `'a-'` 从 04:367 的 false 列表移出（或改成 `true`），并在该行注明依据 `01:239`/`characters.ts:21`。

### 04-4 §2.1 声明的单测文件名与 01 篇「已落地」的文件名不一致 —— BLOCKER
- `04:31`（§2.1 表）与 `04:283`、`04:302`、`04:315`、`04:366` 一律称纯函数单测为 **NEW** `packages/shared/test/init.test.mjs`。
- `01:187`、`01:189`、`01:211`、`01:323` 称该套单测**已落地**在 `packages/shared/test/init-rules.test.mjs`（存在，126 行，10 条）。
- `04:302`「纯函数单测 | `packages/shared/test/` 无 init 用例」是**错误现状** —— init 用例已存在。
- 后果：实现者会新建一个 `init.test.mjs` 与既有 `init-rules.test.mjs` 重复；或以为「无既有单测」而漏跑。修法：`04` 全篇文件名统一为 `init-rules.test.mjs`（扩充既有文件），`04:302` 的现状列改为「已有 `init-rules.test.mjs`（10 条），本批补 §10.2 未覆盖的边界」。

### 04-5 §10.2 仍用旧键名 `readme` / `chalk` —— MAJOR
- `04:362`：「`readme` 逐字等于 `---\ntype: readme…`」；`04:363`：「`chalk`（键 `opening.md`）逐字等于 …」。
- 代码/契约/01 篇的键是**文件名** `'README.md'` / `'opening.md'`（`init-fallback.ts:18-23`；`00:139-145`；`01:106-108`）。`04:364` 又写「键名恰为 `README.md` / `opening.md`」，与同段 :362-363 的 `readme`/`chalk` 自相矛盾。
- 修法：`04:362-363` 的 `readme`→`'README.md'`、`chalk`→`'opening.md'`（`chalk` 只保留为 `type: chalk` 的说明）。

### 04-6 §8 的 brief 单测 import 已删文件 —— MAJOR
- `04:284`：`apps/server/test/init-brief.test.mjs` import `../dist/engine/brief-builder.js`。
- `brief-builder.ts` 已删，两函数现在 `packages/shared/src/render/brief.ts`（`00:186`），编译产物 `@airp/shared/dist`。
- 修法：`04:284` 改为 import `@airp/shared`（或 `../dist/…` 对应 shared 的相对路径），并按 04-4 的口径确认单测落点。

### 04-7 §8 拟写进 `AGENTS.md:276` 的复合命令**丢了 `check:bodies`** —— MAJOR
- `04:289`：`pnpm build && pnpm probe && pnpm probe:init && pnpm probe:inject && pnpm check:ws && pnpm check:docs && pnpm probe:prompt && pnpm check:skills`。
- 实际 `AGENTS.md:276`：`pnpm build && pnpm probe && pnpm probe:inject && pnpm check:ws && pnpm check:bodies && pnpm check:docs && pnpm probe:prompt && pnpm check:skills`（含 `check:bodies`）。
- 后果：照 04 落地会把 HTTP 请求体门禁（`check:bodies`）从复合命令里**删掉**（回归）。修法：`04:289` 以 `AGENTS.md:276` 现文为基，仅**插入** `pnpm probe:init`，保留 `check:bodies`。

### 04-8 §11.6 / §12 与已落地的 `render/brief.ts` 脱节 —— MINOR
- `04:479`（§11.6 行 :448 回写）与 `04:481` 讨论 `buildNookInitBrief(name, roleDesc, manifest, opts?)` 的旧签名。
- 契约 `00:218` 已定选项对象；`render/brief.ts:83` 已按选项对象落地。修法：`04:479` 的「已演化成」描述改为 `buildNookInitBrief(ctx: NookInitContext)`。

---

## 六、跨篇引用对账（任务点 3）

| 对 | 检查点 | 结论 |
|---|---|---|
| 01↔02 | brief 的 `missingFiles` 来源 | **吻合**：01:194（`w2SceneTemplate` 归命令）、01:192-195 的调用点表与 02 §3.6（`02:137-161`）一致；两处都指「file 槽差集、空则不输出」。 |
| 02↔03 | R2 触发 | **基本吻合**：02:63 与 03:15/§3.4 都说服务端经 `RpcClient.prompt('/airp-init <json>')`；02 §⑫-8（`02:638`）与 03 §3.4 的边界声明一致。**但** 02 未引契约 `00:85` 的 fire-and-forget 裁决（见 02-7），03 又说契约未覆盖（见 03-2）→ 三方表述不齐。 |
| 03↔04 | 探针断言 | **不吻合**：03:521-523 的 P1/P2/P3 与 04 §3.0 的 P1–P20 **同编号不同义**（04 的 P1 = 「README 存在」，03 的 P1 = 「作家收到命令」）；03 的 P2/P3 在 04 无落地观察点（04:59/253 明确不解析 brief、不走 WS）。见 03-5。 |
| 04↔01 | 单测清单 | **不吻合**（三处）：文件名 `init.test.mjs` vs `init-rules.test.mjs`（04-4）；`'a-'` true/false 相反（04-3）；`'characters/a/../..'` 的 `'a'` vs `null`（04-2）。 |
| 03↔04 | `check:ws` 基线 | **不吻合**：03:515 = 9，04:113 = 14（04-1）。 |

### 契约 §12 文档清单 vs 实际四篇标题（任务点 4）
- `00:356-359` 的四行（`01`–`04`）与四篇实际标题**一一对应、主题相符**（`01-纯函数与校验` / `02-brief 与执行内核`（实际标题带副题 `（airp-init）`）/ `03-触发链路与前端` / `04-验收与回归`）。
- **唯一缺口**：§12 未登记任何 `05` 篇，而 §4.3（`00:232,236`）与 §6（`00:273`）三处把回写任务派给 `05` 篇（见 00-4）。另 §12 对 `02` 的主题仍写「`brief-builder` 字段补齐」，落点已改 `render/brief.ts`（MINOR）。

---

## 七、汇总与 verdict
**按级别统计**：BLOCKER **9** 条（00-1；01-1、01-2；02-1、02-2；04-1、04-2、04-3、04-4）／MAJOR **12** 条（00-4；01-3、01-4；02-3、02-4、02-5；03-1～03-5；04-5、04-6、04-7）／MINOR **7** 条（00-2、00-3；01-5；02-6、02-7、02-8；04-8）。

**根因（一句话）**：契约在 02:28 做了一次**只改 00、未回改子篇**的修订（下沉 `render/brief.ts`、删 `parentLayerId`、定案 `nookCardPaths`/`directChildrenOf`、写入 RPC 30s 裁决），四篇因此集体滞后一个版本；叠加 A 档 `ebf614a` 落地后 03 篇未更新等待前提。

**最小改后成套的机械核验**（改完照抄即可判对错）：
```bash
# 1) 契约示例层 id 必须带 world/ 前缀
grep -n "baker-street/crime-scene" docs/init/00-共同上下文.md docs/init/03-触发链路与前端.md
# 2) 四篇不得再出现已删文件
grep -rn "brief-builder" docs/init/
# 3) 四篇不得再出现旧 W2 键 / 旧私有名
grep -rn "{readme, chalk}\|directChildren\b" docs/init/
# 4) nook 签名必须是选项对象
grep -rn "buildNookInitBrief(" docs/init/
# 5) check:ws 基线必须是 9（三处一致）
grep -rn "findings" docs/init/03-触发链路与前端.md docs/init/04-验收与回归.md
# 6) 单测文件名统一 + 条数
grep -rn "init\.test\.mjs\|init-rules\.test\.mjs\|8 条\|10 条" docs/init/
```

### verdict：**小改后可落地**

四篇的**骨架与分工是对的**：01 的纯函数签名除 `directChildren`/`nookCardPaths` 外与代码逐字一致；02 的执行序、03 的触发链路与幻影零持久化论证、04 的探针分组（必红组 vs 护栏组）都成立，且 04 的「修复前为何必红」机理链（`04:214-224`）核实无误。

不构成「需重设计」：所有问题都是**同步滞后**，无一处需要改设计或改已落地代码。

但**不能直接照抄落地**：9 条 BLOCKER 里有 4 条会让实现者写出编译不过或断言必红的代码（`brief-builder` import、nook 旧签名、`'a-'`、`'a/../..'`），1 条会让验收基线假红（14 vs 9），2 条会让人去「修」不存在的冲突，2 条是正文与已落地代码/契约直接矛盾（01 篇的私有 `directChildren`、04 篇的单测文件名）。修法均为单文件、单行级改动，无需重新评审设计。
