# docs/init/02 — brief 与执行内核（`airp-init`）

> 归属：I1 批次 `02` 篇（`docs/init/00-共同上下文.md` §12：`render/brief` 字段补齐 + `airp-init` 命令）。
> 上游冻结：`docs/init/00-共同上下文.md`（下称「契约」）、`docs/doc-11-场景与小天地初始化协议.md`（下称「doc-11」）、`docs/prompts/03-初始化器提示词.md`（下称「03 篇」）。
> 冲突时按契约 §0 的权威层级裁决；本文只登记冲突，**不回改契约**。
> 行号日期 2026-09-13，基准工作树 = commit `99ae55d`（纯函数内核已落盘）。行号有保质期，实现前按符号名复核。
>
> **落地状态（2026-09-13 对齐）**：`packages/shared/src/rules/*` 三个文件、`index.ts` 导出、`layers.ts` 的 `dirOf` 导出、以及 **`packages/shared/src/render/brief.ts`（两 brief 函数下沉后）已落地**（见 `01-纯函数与校验.md`）；`extensions/toolkit/init-command.ts` **尚未落地**（两 brief 函数今天仍零调用点，契约 §1）。`apps/server/src/engine/brief-builder.ts` **已删除、不存在**。

---

## ① 一句话定位

**`airp-init` 是初始化执行的唯一内核**：它把「服务端送来的一段 JSON 请求」变成「一个层/小天地从 stub 长成成品」，并在同一次调用里走完 **判空短路 → 拼 brief → 进程内 spawn 子代理 → 结果分流 → 落账/兜底 → 回报**。R2（引擎直唤）走它；R1（作家委托）不走它，但两者**共用同一份 preset**（契约 §2.4）。`packages/shared/src/render/brief.ts` 的两函数是它拼 brief 的唯一来源，本批把 `03` 篇正文**已经承诺过的字段**（父层路径、缺失文件）补齐。

一句话反例（本批要消灭的状态）：今天 `buildSceneInitBrief`/`buildNookInitBrief` **零调用点**（`packages/shared/src/render/brief.ts`；契约 §1 逐字记录，历史落点为已删除的 `apps/server/src/engine/brief-builder.ts:11,46`），`recordLayerInitialized`/`recordLayerInitFailed` **已写、已注册、零调用点**（`packages/shared/src/actions/layer.ts:105,146`），两个 init preset **从未被 `installPreset`**（`launch.ts:106,149` 只装 writer/character）。R2 入口整条不存在。

---

## ② 签名 / 参数

### 2.1 产物总览

```
packages/shared/src/render/brief.ts      MODIFY  SceneInitContext −parentLayerId；buildNookInitBrief 改选项对象
extensions/toolkit/init-command.ts        NEW     airp-init 命令（解析/判空/brief/spawn/分流/落账/回报）
extensions/tools.ts                       MODIFY  在 default export 里调 registerAirpInitCommand
```

### 2.2 `packages/shared/src/render/brief.ts` 改动（契约 §4.1 / §4.2 冻结）

> **落点（契约 §4，已落地）**：两函数已**下沉**到 `packages/shared/src/render/brief.ts`；`apps/server/src/engine/brief-builder.ts` **已删除、不存在**。理由：命令在 `extensions/`（jiti 直跑），现存纪律是**只 import `packages/shared/dist`**；不下沉则命令要么跨包 import `apps/server/src/**`，要么内联一份 brief 模板（两入口必分叉）。`packages/shared/src/index.ts:60` 已导出本文件。

```ts
// packages/shared/src/render/brief.ts
export interface SceneInitContext {
  targetPath: string;          // 世界根相对目录，如 'world/baker-street/crime-scene'
  layerId: string;             // 层身份；根层为 'map'，其物理目录为 'world'
  manifest: WorldManifest;
  parentLayerName?: string;    // 父层显示名
  parentLayerPath?: string;    // 父层目录（'world' 或 'world/a/b'）
  userPrompt?: string;         // 玩家一句话（R2 的 request）
  knownClues?: string[];       // 本批由调用方传，缺省 []
}
export function buildSceneInitBrief(ctx: SceneInitContext): string;   // **无 parentLayerId**（冻结删，契约 §4.1）

// nook 已改为**选项对象**（契约 §4.2；不再是位置参数）
export interface NookInitContext {
  characterId: string;         // 目录名 = 角色 id（[Target Path] 用）
  displayName: string;         // 显示名（[Character] 用；无 README 时 = characterId）
  roleDesc?: string;           // 空则省略 `(roleDesc)` 括号
  home?: string;               // manifest.characters[].home（doc-11 §4.1 的「来历」）
  role?: string;               // 'companion' | 'npc'
  manifest: WorldManifest;
  missingFiles?: string[];     // 仅 file 槽（跳过 glob 槽），只写文件名
}
export function buildNookInitBrief(ctx: NookInitContext): string;

```

`buildSceneInitBrief` 输出顺序固定为 `[Task]`、`[Layer ID] <layerId>`、`[Target Path] <targetPath>`；根层示例是 `map` + `world`，绝不生成 `map/...` 文件路径。其 `[Deliverables]` 要求 1–3 个物件与 1–2 篇 opening；新 authored opening 使用 `NN-opening.md`（首篇 `01-opening.md`，可选 `02-opening.md`）。

`[Parent Path] <parentLayerPath>` 与 `[Home] <home> (role: <role>)` 两个输出行见契约 §4.1 / §4.2；**不设 `[Parent Id]`**——`parentLayerId` 曾是死字段（无输出行），**已删**，父层 id 只在命令内部用于解析 `parentLayerPath`。

### 2.3 `airp-init` 命令（契约 §2.2 冻结）

| 项 | 值 |
|---|---|
| 命令名 | `airp-init`（`pi.registerCommand('airp-init', …)`；调用 `/airp-init <json>`） |
| 注册位置 | `extensions/toolkit/init-command.ts`（NEW），由 `extensions/tools.ts` 的 default export 注册 |
| handler 签名 | `(args: string, ctx: ExtensionCommandContext) => Promise<void>`（`vendor/pi-rp/packages/coding-agent/src/core/extensions/types.ts:1306`） |
| 参数形状 | `{ kind: 'scene' | 'nook', target: string, request?: string, by: 'player' | 'engine' | 'god' }` |
| 谁调用 | 服务端（R2）经 `RpcClient.prompt('/airp-init <json>')`（`rpc-client.ts:273-275`；`rpc-mode.ts:568-594` 扩展命令立即执行） |

NEW 导出（`extensions/toolkit/init-command.ts`）：

```ts
import type { ExtensionAPI, ExtensionCommandContext, ToolDefinition } from '@earendil-works/pi-coding-agent';

/** 命令参数（契约 §2.2 冻结；`by` 含上帝模式 `'god'`，契约 §2.3.2）。 */
export interface InitArgs {
  kind: 'scene' | 'nook';
  target: string;
  request?: string;
  by: 'player' | 'engine' | 'god';
}

/** 纯解析/校验：JSON.parse + 形状校验。不碰 store、不落事件（可单测）。 */
export function parseInitArgs(raw: string): { ok: true; value: InitArgs } | { ok: false; error: string };

/** 注册入口，由 extensions/tools.ts 调用（airpTools 显式传入，避免与 tools.ts 的循环 import）。 */
export function registerAirpInitCommand(pi: ExtensionAPI, airpTools: readonly ToolDefinition[]): void;
```

**超时（契约 §2.3 冻结）**：场景 `60000`ms、小天地 `45000`ms（doc-11 §6.2）。**本批作为命令内部默认值**（`const TIMEOUT_MS = { scene: 60_000, nook: 45_000 }`）；登记为「配置项待外提」（§⑫-1）。

---

## ③ 行为契约逐步（每步写"漏了会怎样"）

以下即契约 §2.3 冻结的执行序。**命令 handler 的完整伪代码见 §⑧**。

### 3.1 解析 args（契约 §2.3 第 1 步）

1. `JSON.parse(args)`：失败 → `pi.sendMessage` 报错（`customType: 'airp-init'`），**不落任何事件**，return。
2. 校验：`kind ∈ {'scene','nook'}`、`target` 是非空 `string`、`by ∈ {'player','engine','god'}`、`request` 若存在必须是 `string`。任一不合法 → 同上报错 return。
   - **漏了会怎样**：`kind` 拼错（`'scenes'`）会一路走到 `spawnAgent` 才因 preset 找不到而失败——错误被误报成"初始化失败"（一条 `layer_init_failed` 谎报），而非"参数不合法（不落事件）"。契约 §2.3 第 1 步明确要求非法 **不落事件**。

### 3.2 target 归一（契约 §2.2「target 口径」）

1. `kind: 'scene'`：`target` 是**层 id，带 `world/` 前缀**（如 `world/baker-street/crime-scene`；**根层 id 是 `map`**）——这是 `/api/enter-layer` 实际收到的形状（契约 §2.2）。**归一必须用 `dirOfLayer`/`layerOfDir`**（`packages/shared/src/store/layers.ts:32-39`）：
   - `dir = target === 'map' ? 'world' : target`（层 id → 目录：`dirOfLayer` 把 `map` 映到 `world`，其余原样）
   - `layer = layerOfDir(dir)`（目录 → 层 id：`world` 映回 `map`，其余原样）
   - `dirName = dir.split('/').pop()`（W2 模板与人类回报用）
   - **MUST NOT** 用无前缀写法（反例：`baker-street/crime-scene`，历史误用形状）当层 id——它会被当成字面目录名，产生 `baker-street/crime-scene/README.md`（不存在），归一分支静默错过（契约 §2.2 逐字）。
2. `kind: 'nook'`：`target` = 角色 id。`nookId = nookIdOf(target)`（`packages/shared/src/rules/characters.ts:35-37`，**唯一** nook 路径构造处）。`nookId === null`（id 非法）→ `pi.sendMessage` 报错，**不落事件**，return。`dir = layer = nookId`。
   - **漏了会怎样**：自己拼 `characters/${target}` 会放过 `../../etc`（契约 §8 反模式 4；nook 00 §3.2 明禁）。归一里**不得**另写第三份 id 正则。

### 3.3 判空短路（契约 §2.3 第 2 步）

1. `files = await store.listFiles()`（全量，`local-store.ts:210-233`；语义见 `01` 篇 §2.2）。
2. `kind: 'scene'` → `isLayerEmpty(files, dir)`；`kind: 'nook'` → `isNookEmpty(files, dir)`（`rules/emptiness.ts:33,44`）。
3. 判定"已有内容" → `pi.sendMessage` 回报「already initialized（no action）」，**return，不 spawn、不落事件**。
   - **漏了会怎样**：二次进入 stub 层/空小天地会重复初始化，凭空生成第二套陈设覆盖玩家已看过的内容（`03` 篇 `[Process] 2`、doc-11 §3.1）。判空短路是**幂等性的第一道防线（顺序路径）**；它**挡不住并发双击**——需叠加**进程内 in-flight 锁**作为第二道防线（契约 §2.3.1，落点见 §3.3.1 / §⑧ 伪代码）。

#### 3.3.1 并发防线：进程内 in-flight 锁（契约 §2.3.1）

pi-rp 的扩展命令**在 streaming 中也会立即执行**，且两次 `prompt()` 之间**没有串行化锁**（`agent-session.ts:1991-1996`）。因此「判空短路」只挡**顺序**的二次进入，**挡不住并发**：玩家双击 stub 卡 → 两条 `/airp-init` 同时在飞 → 两条都过判空 → 各自 `spawnAgent` → 两套陈设。

**冻结修法**：命令内持一个**进程内 in-flight 集合**（模块级 `Set<string>`，键 = `kind + ':' + target`）。命中则 `reply('initialization already in flight')` 并 return；未命中则 `add`，`try/finally` 中 `delete`（spawn 完成/失败/抛错都释放）。扩展进程是单例，模块级 `Set` 足够，**不需要跨进程锁**。**MUST NOT** 依赖「命令会自动排队」——实测不会。

#### 3.3.2 上帝模式建目录 = 零 AI 路径（契约 §2.3.2）

`doc-11 §5` 第三行：**上帝模式新建空目录（玩家没写诉求）→ 直接落最小模板，不惊动 AI**。**保留这条零 AI 路径**：`request` 缺省/为空、且 `by === 'god'` 时，**不 `spawnAgent`**，直接 `w2SceneTemplate(dirName)` 写盘 + `recordLayerInitialized({ by: 'god', files })`。理由：上帝模式建目录是**地图编辑**语义，起一次 45–60s 的 AI 生成既慢又可能不合空白意图。**边界**：玩家双击 stub 门（有诉求/默认 brief）走 AI 路径（R2）；二者由 `by` 区分（`'player'` vs `'god'`）。

### 3.4 解析上下文（契约 §2.3 第 3 步）

1. `manifest = await store.getManifest()`（`local-store.ts:320-326`）。
2. **scene** 的父层：
   - `parentId = manifest.layers[layer]?.parent ?? null`（`LayerConfig.parent`，`schemas/world.ts:12`；`map` 的 parent 为 `null`）。
   - `parentLayerName = parentId ? manifest.layers[parentId]?.name : undefined`
   - `parentLayerPath = parentId ? dirOfLayer(parentId) : undefined`（`store/layers.ts:32`）
3. **nook** 的角色信息（`buildNookInitBrief({ characterId, displayName, roleDesc, home, role, manifest, missingFiles })`，选项对象，契约 §4.2）：
   - `characterId` = `target`（角色 id，驱动 `[Target Path] characters/${characterId}`，`render/brief.ts:90`）。
   - `displayName` = `parseFrontmatter(README.md).frontmatter.name`（`local-store.ts:11` import、`actions/layer.ts:31-32` 同用法），**无 README 则回退 `characterId`**（`render/brief.ts:72`）。显示名只驱动 `[Character]` 行；`[Target Path]` 恒用 id（旧版「第 1 参兼作 id 与显示名」的重载陷阱已由签名拆分消除，见 §⑪-7）。
   - `roleDesc` = `manifest.characters.find(c => c.id === target)?.description`（可空，`render/brief.ts:74`；holmes 的 `world.json` 角色条目**只有** `home`/`role`、**没有** `description`，`templates/holmes-world/world.json:28-39` → `roleDesc` 常为空，brief 省略空括号，见 §⑪-5）。
   - `home` / `role` = 同一条 `manifest.characters.find(c => c.id === target)` 的 `.home` / `.role`（`render/brief.ts:76-78`；`home` 存在时输出 `[Home] <home> (role: <role>)`，`role` 缺省时只到 `[Home] <home>`）。
4. `knownClues`：本批**不接来源**，传 `undefined`（契约 §2.3 第 3 步「本批可为空数组，登记」）。
   - **漏了会怎样**：不解析父层 → `[Parent Path]` 永不出现，"与上级层一致"（`03` 篇 `[Process] 3` / `[Discipline] 1`）退化成不可执行指令（契约 §4.1 理由）。

### 3.5 拼 brief（契约 §2.3 第 4 步 + §4）

1. `kind: 'scene'` → `buildSceneInitBrief({ layerId: layer, targetPath: dir, manifest, parentLayerName, parentLayerPath, userPrompt: request })`（`layerId` 保留 `map`/`world/...` 身份，`targetPath` 始终为归一后的 `world/...` 目录）。
   - `targetPath` 传**归一后的目录** `dir`（不是裸 `target`）；契约 §10 断言 `[Target Path]` 等于传入值。
2. `kind: 'nook'` → `buildNookInitBrief({ characterId: target, displayName, roleDesc, home, role, manifest, missingFiles })`（选项对象，契约 §4.2）。各字段解析见 §3.4-3；`missingFiles` 见 §3.6。
   - **漏了会怎样**：`missingFiles` 不传 → `03` 篇 `[Process] 4`「若 brief 点名了缺失文件就补齐」**永不触发**。
   - **漏了 `home`/`role` 会怎样**：holmes 的 `description` 恒空 → brief 语义空洞、`[Home]` 行永不出现（契约 §4.2 裁决 M4）。

### 3.6 `missingFiles` 的来源（契约 §4.2 末段）

**定义**：读 `characters/<id>/preset.json`，取其**所有 file 槽**声明的 `path`，减去 `characters/<id>/` 下**实际存在**的文件 → 差集（**空则不输出该行**）。

**pi-rp preset 的真实形状**（实测 `templates/holmes-world/characters/watson/preset.json:47-57`）：file 槽**不是** `{kind:'file',path}`，而是 **`{ kind:'slot', slot:'file', options:{ path: string|string[], baseDir?: string, glob?: boolean, onMissing?: string } }`**——`path` 是**字符串**或**字符串数组**，与 `options.baseDir` 合成 world 相对完整路径；watson 的槽逐字为 `{"kind":"slot","id":"profile","slot":"file","options":{"path":["README.md","identity.md","personality.md"],"baseDir":"characters/watson","stripFrontmatter":true,"onMissing":"skip"}}`。算法（私有函数，落在 `init-command.ts`）：

```
async function missingFilesFor(store, nookId /* 'characters/<id>' */): Promise<string[]> {
  let preset; try { preset = JSON.parse(await store.readFile(`${nookId}/preset.json`)); } catch { return []; }
  const files = await store.listFiles();                          // world 相对全量
  const out: string[] = [];
  for (const item of preset?.items ?? []) {
    if (item?.kind !== 'slot' || item?.slot !== 'file') continue;  // 只认 file 槽
    const opts = item.options ?? {};
    if (opts.glob === true) continue;                              // glob 槽无法静态判定（§⑫-2）
    const base = typeof opts.baseDir === 'string' ? opts.baseDir : '';
    const paths = Array.isArray(opts.path) ? opts.path : (typeof opts.path === 'string' ? [opts.path] : []);
    for (const p of paths) {
      if (typeof p !== 'string') continue;
      const candidate = base ? `${base}/${p}` : p;                 // world 相对
      if (!files.includes(candidate) && !out.includes(p)) out.push(p);   // 差集；回报用**书写形状**
    }
  }
  return out;
}
```

**判空纪律**：`out.length === 0` → brief **不输出** `[Missing Files]` 行（契约 §4.2：**MUST NOT** 输出 `（none）`）。

**实测预期**：`characters/watson/` 只有 `README.md` + `preset.json`（实测 `templates/holmes-world/characters/watson/`），preset 的 file 槽声明 `["README.md","identity.md","personality.md"]`（`preset.json:52`）→ `missingFiles = ['identity.md','personality.md']`，`README.md` 已存在被减掉。

- **漏了会怎样**：不做差集、或差集为空也输出 → brief 里出现 `[Missing Files] （none）`，模型会去"补齐"一个不存在的东西，或空转（契约 §4.2）。

### 3.7 spawn 子代理（契约 §2.3 第 5 步）

```ts
const result = await ctx.spawnAgent({
  profileId: kind === 'scene' ? 'scene-init' : 'nook-init',
  task: brief,
  customTools: [...airpTools],   // = AIRP_TOOLS.map(t => t.tool)
  timeoutMs: TIMEOUT_MS[kind],
});
```

- `ctx.spawnAgent` 来自 `ExtensionContext`（`types.ts:383`；runner 绑定 `runner.ts:891-894`；实现 `agent-session.ts:3936` → `subagent/spawn.ts:78`）。
- **`customTools` 必须传**：`spawnAgent` 刻意 `inheritExtensionTools: false`（`spawn.ts:97`）——**不继承父会话扩展工具**。省略 `tools` 时默认集自动并上 `customTools` 的名字（`spawn.ts:96`），与 R1 等价（doc-11 §2.4）。**漏了 `customTools` 会怎样**：初始化子代理只有内建工具（`read/bash/edit/write/grep/find/ls`，`prepare.ts:27`），调不到任何 AIRP 工具；正文虽只用 `write`（`03` 篇 §⑩-1 待拍板），但 doc-11 §2.4 要求两入口工具面一致、本批必须兑现。
- **`tools` 省略**（契约 §2.3）：它是收窄白名单，省略即"默认集 ∪ customTools"（doc-11 §2.4）。
- `timeoutMs` 即 pi-rp 的 `timed-out` 机制（见 §3.8）。
- **漏了 `timeoutMs` 会怎样**：`run.ts:145` 不设定时器 → 模型挂住则命令永不返回，`RpcClient.prompt` 的 30s 通信超时（`rpc-client.ts:828-831`）只让**服务端**放弃等回应，agent 进程里的 spawn 仍在跑（契约 §8 反模式 2 的同类风险）。

### 3.8 结果分流（契约 §2.3 第 6 步）

`SpawnAgentResult.status ∈ {'completed','failed','cancelled','timed-out'}`（`spawn.ts:48-56`；`run.ts:13,182-195`）。映射：**只有 `'completed'` 走成功路径，其余三种一律走 W2 兜底**。

**成功路径（`status === 'completed'`）**：

1. `after = await store.listFiles()`；`hasInitProduct(after, dir, kind)`（`rules/emptiness.ts:59-68`）？
   - `true` → `svc.recordLayerInitialized({ layer, by, files })`（`actions/layer.ts:105-131`）。
   - `false` → **视同失败**，走 W2（契约 §3.2：模型"completed 但什么都没写"= 不合格；否则层仍是 stub，下次进入再触发，死循环）。
   - **漏了产物校验会怎样**：落一条 `layer_initialized` 谎报，层实际仍是 stub，反复初始化（契约 §3.2 / §10 判据 (a)）。

**失败路径（`status !== 'completed'`）**：

1. W2 兜底落盘（§3.9）。
2. `svc.recordLayerInitFailed({ layer, reason, fallback })`（`actions/layer.ts:146-171`）。`reason` = `result.error ?? result.status`（如 `'timed-out'`）。`fallback` = 落了模板 → `'template'`，否则 `'none'`（§⑪-2）。
   - **漏了会怎样**：失败静默（只 `console.error`）→ 违反 `docs/tools/00` 硬约束 4（契约 §8 反模式 8）；前端拿不到降级信号（doc-11 §6.1）。

### 3.9 W2 兜底（契约 §2.3 第 6 步 / §3.3）

**scene**：`w2SceneTemplate(dirName)`（`rules/init-fallback.ts:29-35`）→ 对每个 `[name, body]`：`await store.writeFile(`${dir}/${name}`, body)`（`local-store.ts:163-167`，mkdirs）。落 `README.md` + `opening.md`。
**nook**：**本批无模板**（契约 §3.3 只定义 `w2SceneTemplate`；`01` 篇 §⑫-3 已登记）。见 §⑪-2 的两个选项。
- **漏了会怎样**（scene）：超时后层仍无 README → 永远是 stub、每次进入都重跑（doc-11 §5「不是可选项，是失败降级的保底」）。
- **`material: stub` 是正解**：`MATERIAL_SKINS` 含 `stub`（`schemas/forms.ts:193-198`），是"这里还没长出来"的皮肤（契约 §3.3）。

### 3.10 三行摘要（契约 §2.3 第 7 步）

- `pi.sendMessage({ customType: 'airp-init', content: <人话>, display: false }, { triggerTurn: false })`（`types.ts:1482-1485`）。
- **成功**：`content` = `result.text`（初始化器自己回报的三行；`03` 篇 `[Report]`）。
- **失败/短路**：一句降级说明（`reason` + `fallback`）。可直接复用 `recordLayerInitFailed(...).text`。
- `triggerTurn: false`：不进 LLM 触发新回合（契约 §2.2「仅供作家/日志感知，不影响玩家 UI」）。
- **漏了会怎样**：作家/日志完全看不到初始化结果；doc-11 §2.2「作家摘要过目」断链（R2 路径）。

---

## ④ 文件与副作用

| 文件 | 性质 | 副作用 |
|---|---|---|
| `packages/shared/src/render/brief.ts` | 纯函数（字符串拼接，已落地） | **无** |
| `extensions/toolkit/init-command.ts` | 命令 handler（NEW） | 读 store、写世界文件（W2）、`ctx.spawnAgent`、`pi.sendMessage`、经 `getActionService` 落事件 |
| `extensions/tools.ts` | 加一行 `registerAirpInitCommand(pi, AIRP_TOOLS.map(t => t.tool))` | 注册命令（无 I/O） |

**继承的既有副作用面**：`spawnAgent` 在**同进程**（`SessionManager.inMemory`，`run.ts:59`）运行子代理，子代理用 `write` 落盘到世界根；子代理**零注入**（`extensions/context.ts:39-43`，`run.ts:81-98`），不会污染作家上下文。落账经 `recordLayerInitialized`/`recordLayerInitFailed`（唯一通道，契约 §8 反模式 3）。

---

## ⑤ 落账

**唯一落账口径**（契约 §6，本批零新增事件 `type`）：

| 情形 | 动作 | 事件 detail |
|---|---|---|
| 成功且产物合格 | `recordLayerInitialized({ layer, by, files })` | `layer_initialized: { layer, name, by, files }` |
| 失败 / 超时 / 取消 / 产物不合格 | `recordLayerInitFailed({ layer, reason, fallback })` | `layer_init_failed: { layer, name, reason, fallback }` |
| 参数非法 / 判空短路 | **不落账** | — |

- detail 形状冻结于 `packages/shared/src/schemas/events.ts:96-106`（`satisfies` 编译期穷尽）。
- `recordLayer*` 的动作层**恒写 `actor = engine`**（`actions/layer.ts:118-125,158-165`）——`by` 只进 `detail.by`，不改 actor（契约 §2.2 末尾，既有裁决）。
- `files` 数组（成功路径）：`dir` 的**直接子级**、world 相对全路径（如 `world/crime-scene/README.md`）。契约 §6 只冻结 `string[]`，未冻结"全路径 vs 文件名"（§⑫-3）。
- **MUST NOT** 绕过两动作自 `appendEvent`（契约 §8 反模式 3）。

---

## ⑥ WS 与前端

**本文件不产生 WS 帧。** 落账后 `world_event` 广播由服务端尾读 events 表完成（`docs/tools/00 §5.3`）。本批：
- **不碰** `apps/web/src/state/useWorld.ts` 的 switch（等 A 档广播，契约 §9）；
- **不新增帧名**；
- `pi.sendMessage` 的 `customType` 消息**不承诺**任何前端消费面（契约 §2.2：仅供作家/日志）。前端如何显示"生成中 / 失败降级"归 `03` 篇。

---

## ⑦ 错误边界

| 情形 | 行为 | 依据 |
|---|---|---|
| `args` 非 JSON / 缺 `kind` / `target` 空 / `by` 非法 | `pi.sendMessage` 报错，**不落事件**，return | 契约 §2.3 第 1 步 |
| `kind:'nook'` 且 `target` 非法 id（`nookIdOf` 返回 null） | 同上 | 契约 §2.2 / `rules/characters.ts:35-37` |
| 判空为假（已有内容） | 回报 "already initialized"，**不 spawn、不落事件** | 契约 §2.3 第 2 步 |
| preset 未安装（`scene-init`/`nook-init` 不在世界） | `spawnAgent` 返回 `status:'failed'`（`prepare.ts:133-138` "preset not found"）→ 走 W2 + `layer_init_failed` | `spawn.ts:102-104` |
| 无可用模型 | `prepare` 返回 error → `status:'failed'`（`prepare.ts:161-167`）→ W2 | 同上 |
| 超时（`timeoutMs` 到） | `status:'timed-out'`（`run.ts:189-192`）→ W2 + `layer_init_failed(reason:'timed-out')` | doc-11 §6.2 |
| 会话 dispose（`ctx.newSession` / 进程退出） | 子请求随会话 abort（`spawn.ts:114-137` `registerSideRequest`）→ `status:'cancelled'` → W2 | doc-11 §6.2 |
| `completed` 但目录无产物 | **视同 failed** → W2 | 契约 §3.2 |
| W2 写盘失败（如权限） | 逐文件 write 抛错；catch → 仍尽力落 `layer_init_failed(fallback:'none')`，**不得**静默 | 契约 §8 反模式 8 |
| `characters/<id>/preset.json` 不存在 / 非法 JSON | `missingFiles` = `[]`（catch），不阻断初始化 | §3.6 |
| `preset.json` 的 file 槽 `glob:true` | 跳过（无法静态判定），不误报 | §3.6 / §⑫-2 |
| `manifest.characters` 无该 id（目录裸建） | `roleDesc` 省略、`home`/`role` 不输出；`displayName` 回退 `characterId`；照常 spawn | 契约 §4.2；§3.4-3 |
| `target` 带尾斜杠（`world/x/`） | **未定义**：`isLayerEmpty` 前缀切法会判"空"（`01` 篇 §⑦）。命令 MUST 先归一 | `01` 篇 §⑦；契约 §2.2 |

---

## ⑧ 代码落点（精确到文件与函数）

### 8.1 `packages/shared/src/render/brief.ts`（MODIFY — 已落地）

> `apps/server/src/engine/brief-builder.ts` **已删除**；下列行号指向新落点 `packages/shared/src/render/brief.ts`。

| # | 符号 | 行（现） | 状态 / 改动 |
|---|---|---|---|
| 1 | `SceneInitContext` | `:16-28` | **已删 `parentLayerId`**；保留 `parentLayerName?` / `parentLayerPath?`（契约 §4.1） |
| 2 | `buildSceneInitBrief` | `:30-66` | **已落地**：`if (ctx.parentLayerPath)`（`:40-42`）紧跟 `[Parent Layer]`（`:37-39`）之后 push `[Parent Path]` |
| 3 | `buildSceneInitBrief` 的 `[Report]` | `:62` | **已落地**：中性指路 `Report in exactly the three lines the system prompt defines`（契约 §4.3） |
| 4 | `NookInitContext` | `:68-85` | **已改选项对象**：`characterId` / `displayName` / `roleDesc?` / `home?` / `role?` / `manifest` / `missingFiles?`（契约 §4.2） |
| 5 | `buildNookInitBrief` | `:87-112` | **已落地**：角色行 `roleDesc ? '[Character] displayName (roleDesc)' : '[Character] displayName'`（`:91-93`）；`[Home] home (role: role)`（`:95-99`）；`[Missing Files] join(', ')` 仅非空时（`:105-107`）；`[Report]` 中性指路（`:109`） |
| 6 | `buildNookInitBrief` 的 `[Deliverables]` | `:102` | **已改** `2–4`（`03` §⑨ 冲突 3；doc-11 §4.3） |

**输出行的完整清单**（实际落地，`03` §⑧-8 的字段对账）：

```
scene:  [Task] [Target Path] [World] [Parent Layer] [Parent Path](NEW) [Player Request] [Known Clues] [Constraints] [Deliverables] [Report]
nook:   [Task] [Target Path] [Character] [World] [Home](NEW) [Missing Files](NEW) [Request] [Constraints] [Deliverables] [Report]
```

（`[Home]` 仅当 `ctx.home` 存在；`[Missing Files]` 仅当 `ctx.missingFiles` 非空。）

### 8.2 `extensions/toolkit/init-command.ts`（NEW）—— **完整伪代码**

```ts
import type { ExtensionAPI, ExtensionCommandContext, ToolDefinition } from '@earendil-works/pi-coding-agent';
import {
  dirOfLayer, layerOfDir, nookIdOf,
  isLayerEmpty, isNookEmpty, hasInitProduct, w2SceneTemplate,
  parseFrontmatter, buildSceneInitBrief, buildNookInitBrief,
} from '../../packages/shared/dist/index.js';
import { worldStore, getActionService } from './deps.js';

const TIMEOUT_MS = { scene: 60_000, nook: 45_000 } as const;
const INIT_CUSTOM_TYPE = 'airp-init';
/** 进程内 in-flight 锁（契约 §2.3.1）：键 = `kind + ':' + target`。扩展进程单例，模块级 Set 足够。 */
const IN_FLIGHT = new Set<string>();

export type ParseResult = { ok: true; value: InitArgs } | { ok: false; error: string };

/** §3.1 —— 纯解析/校验（可单测，不碰 store）。 */
export function parseInitArgs(raw: string): ParseResult {
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return { ok: false, error: 'args is not valid JSON' }; }
  if (typeof v !== 'object' || v === null) return { ok: false, error: 'args must be a JSON object' };
  const o = v as Record<string, unknown>;
  if (o.kind !== 'scene' && o.kind !== 'nook') return { ok: false, error: `kind must be 'scene'|'nook', got ${String(o.kind)}` };
  if (typeof o.target !== 'string' || o.target.trim() === '') return { ok: false, error: 'target must be a non-empty string' };
  if (o.by !== 'player' && o.by !== 'engine' && o.by !== 'god') return { ok: false, error: `by must be 'player'|'engine'|'god', got ${String(o.by)}` };
  if (o.request !== undefined && typeof o.request !== 'string') return { ok: false, error: 'request must be a string when present' };
  return { ok: true, value: { kind: o.kind, target: o.target, request: o.request, by: o.by } as InitArgs };
}

/** §3.6 —— file 槽差集。读不到 preset.json / 非法 JSON → []。 */
async function missingFilesFor(ctx: ExtensionCommandContext, nookId: string): Promise<string[]> {
  const store = worldStore(ctx);
  let preset: any;
  try { preset = JSON.parse(await store.readFile(`${nookId}/preset.json`)); } catch { return []; }
  const files = await store.listFiles();
  const out: string[] = [];
  for (const item of preset?.items ?? []) {
    if (item?.kind !== 'slot' || item?.slot !== 'file') continue;
    const opts = item.options ?? {};
    if (opts.glob === true) continue;
    const base = typeof opts.baseDir === 'string' ? opts.baseDir : '';
    const paths = Array.isArray(opts.path) ? opts.path : (typeof opts.path === 'string' ? [opts.path] : []);
    for (const p of paths) {
      if (typeof p !== 'string') continue;
      const candidate = base ? `${base}/${p}` : p;
      if (!files.includes(candidate) && !out.includes(p)) out.push(p);
    }
  }
  return out;
}

/** §3.9 —— W2 写盘。scene 有模板；nook 无模板（§⑪-2）。 */
async function writeW2(ctx: ExtensionCommandContext, kind: 'scene' | 'nook', dir: string): Promise<{ fallback: 'template' | 'none' }> {
  if (kind !== 'scene') return { fallback: 'none' };                 // §⑪-2 待裁决
  const tpl = w2SceneTemplate(dir.split('/').pop() ?? dir);
  for (const [name, body] of Object.entries(tpl)) await worldStore(ctx).writeFile(`${dir}/${name}`, body);
  return { fallback: 'template' };
}

/** §3.4-3 —— README 显示名（frontmatter `name`），无 README / 无 name → characterId。 */
async function displayNameFor(ctx: ExtensionCommandContext, nookId: string, characterId: string): Promise<string> {
  try {
    const { frontmatter } = parseFrontmatter(await worldStore(ctx).readFile(`${nookId}/README.md`));
    const name = (frontmatter as { name?: unknown }).name;
    return typeof name === 'string' && name.trim() !== '' ? name : characterId;
  } catch { return characterId; }
}

/** dir 的直接子级的 world 相对全路径（§⑫-3）。 */
function directChildPaths(files: readonly string[], dir: string): string[] {
  const prefix = `${dir}/`;
  return files.filter((f) => f.startsWith(prefix) && !f.slice(prefix.length).includes('/'));
}

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export function registerAirpInitCommand(pi: ExtensionAPI, airpTools: readonly ToolDefinition[]): void {
  pi.registerCommand('airp-init', {
    description: 'Engine-invoked layer/nook initializer (R2)',
    handler: async (args: string, ctx: ExtensionCommandContext): Promise<void> => {
      const reply = (text: string): void =>
        pi.sendMessage({ customType: INIT_CUSTOM_TYPE, content: text, display: false }, { triggerTurn: false });

      // ① 解析（§3.1）
      const parsed = parseInitArgs(args);
      if (!parsed.ok) { reply(`airp-init: ${parsed.error}`); return; }
      const { kind, target, request, by } = parsed.value;

      // ①b 进程内 in-flight 锁（契约 §2.3.1）—— 判空短路只挡顺序，挡不住并发双击
      const flightKey = `${kind}:${target}`;
      if (IN_FLIGHT.has(flightKey)) { reply(`airp-init: initialization already in flight for "${target}"`); return; }
      IN_FLIGHT.add(flightKey);
      try {
        // ② target 归一（§3.2）
        let dir: string, layer: string;
        if (kind === 'scene') {
          dir = dirOfLayer(target);          // 层 id → 目录：'map'→'world'，其余原样
          layer = layerOfDir(dir);           // 目录 → 层 id：'world'→'map'，其余原样
        } else {
          const nookId = nookIdOf(target);
          if (nookId === null) { reply(`airp-init: invalid character id "${target}"`); return; }
          dir = layer = nookId;
        }

        const store = worldStore(ctx);
        const svc = getActionService(ctx);            // actor 恒为 engine（recordLayer* 内部保证）

        // ③ 判空短路（§3.3）—— 幂等第一道防线（顺序）
        try {
          const files = await store.listFiles();
          const empty = kind === 'scene' ? isLayerEmpty(files, dir) : isNookEmpty(files, dir);
          if (!empty) { reply(`airp-init: "${layer}" already initialized; no action.`); return; }
        } catch (err) { reply(`airp-init: failed to read world: ${msg(err)}`); return; }

        // ③b 上帝模式建目录 = 零 AI 路径（契约 §2.3.2）：request 空 + by:'god' → 不 spawn
        if (by === 'god' && kind === 'scene' && (request === undefined || request.trim() === '')) {
          await writeW2(ctx, kind, dir);              // scene 有模板，落 README.md + opening.md
          const after = await store.listFiles();
          const r = await svc.recordLayerInitialized({ layer, by: 'god', files: directChildPaths(after, dir) });
          reply(r.text);
          return;
        }

        // ④ 拼 brief（§3.4/§3.5/§3.6）
        let brief: string;
        try {
          const manifest = await store.getManifest();
          if (kind === 'scene') {
            const parentId = manifest.layers[layer]?.parent ?? null;
            brief = buildSceneInitBrief({
              layerId: layer,
              targetPath: dir,
              manifest,
              parentLayerName: parentId ? manifest.layers[parentId]?.name : undefined,
              parentLayerPath: parentId ? dirOfLayer(parentId) : undefined,
              userPrompt: request,
            });
          } else {
            const c = manifest.characters.find((ch) => ch.id === target);
            brief = buildNookInitBrief({               // 选项对象（契约 §4.2）
              characterId: target,
              displayName: await displayNameFor(ctx, dir, target),
              roleDesc: c?.description,
              home: c?.home,
              role: c?.role,
              manifest,
              missingFiles: await missingFilesFor(ctx, dir),
            });
          }
        } catch (err) { reply(`airp-init: failed to build brief: ${msg(err)}`); return; }

        // ⑤ spawn（§3.7）
        let result;
        try {
          result = await ctx.spawnAgent({
            profileId: kind === 'scene' ? 'scene-init' : 'nook-init',
            task: brief,
            customTools: [...airpTools],              // spawnAgent 不继承父会话扩展工具（spawn.ts:97）
            timeoutMs: TIMEOUT_MS[kind],
          });
        } catch (err) {
          // spawnAgent 自身抛出（罕见）→ 与 failed 同路，绝不静默
          result = { status: 'failed' as const, text: '', error: msg(err), stateOps: [] };
        }

        // ⑥ 分流（§3.8/§3.9/§3.10）
        try {
          if (result.status === 'completed') {
            const after = await store.listFiles();
            if (hasInitProduct(after, dir, kind)) {
              const files = directChildPaths(after, dir);
              const r = await svc.recordLayerInitialized({ layer, by, files });
              reply(result.text || r.text);
              return;
            }
          }
          const { fallback } = await writeW2(ctx, kind, dir);
          const reason = result.status === 'completed' ? 'no product written' : (result.error ?? result.status);
          const r = await svc.recordLayerInitFailed({ layer, reason, fallback });
          reply(`${result.text ? result.text + '\n' : ''}${r.text}`);
        } catch (err) {
          reply(`airp-init: post-run failed for "${layer}": ${msg(err)}`);   // 绝不留静默
        }
      } finally {
        IN_FLIGHT.delete(flightKey);                  // 成功/失败/抛错都释放（契约 §2.3.1）
      }
    },
  });
}
```

**注册（`extensions/tools.ts`）**：在 default export 里、`registerTurnTracking(pi)`（`:72`）之后加：

```ts
registerAirpInitCommand(pi, AIRP_TOOLS.map((t) => t.tool));
```

（`AIRP_TOOLS` 定义于 `extensions/tools.ts:48-64`；`registerCommand` 与 `registerTool` 同入口文件，契约 §2.2 冻结。**`airpTools` 显式传入**而非 `init-command.ts` 反向 import `tools.ts`——后者会形成循环 import。`init-command.ts` 与 `render/brief.ts` 同源 import `packages/shared/dist/index.js`（契约 §4 的下沉裁决；**无跨包 `apps/server/src/**` import**，§⑪-6 已按方案 A 解决）。模块级 `const IN_FLIGHT = new Set<string>()` 定义在 `registerAirpInitCommand` 之上（§3.3.1）。）

---

## ⑨ 与现状差异

以基准 commit `99ae55d` 为**前状态**：

| # | 前状态（`file:line`） | 本批 | 理由 |
|---|---|---|---|
| D1 | `buildSceneInitBrief` 只输出 `[Parent Layer]` 名字（历史落点 `brief-builder.ts:18-20`），无父层路径 | 增 `[Parent Path]` + `parentLayerPath` 字段（`parentLayerId` 曾设计但为死字段，**已删**） | 契约 §4.1；让 `03` 篇「与上级层一致」可执行 |
| D2 | `buildNookInitBrief(characterName, roleDesc, manifest)`（历史 `:46`），无 `missingFiles`、无 `home`/`role` | **改选项对象** `{characterId, displayName, roleDesc, home, role, manifest, missingFiles}` + `[Home]`/`[Missing Files]` 行 | 契约 §4.2；`03` §⑨ 冲突 2 的修法落点 |
| D3 | 两函数的 `[Report]` 是各自粗略措辞（历史 `:39-40`、`:55`） | 都改为中性指路「三行由 system prompt 定义」 | 契约 §4.3；正文才是权威 |
| D4 | nook `[Deliverables] 2–3`（历史 `:54`） | `2–4` | `03` §⑨ 冲突 3；doc-11 §4.3（**§⑪-3**） |
| D5 | 无 `airp-init` 命令（契约 §1：R2 入口整条不存在） | 新建 `extensions/toolkit/init-command.ts` + 注册 | 契约 §2.2 / §2.3 |
| D6 | `recordLayerInitialized` / `recordLayerInitFailed` 零调用点（`actions/layer.ts:105,146`） | 命令内首次真实调用 | 契约 §1 / §6 |
| D7 | 两个 init preset 从未 `installPreset`（`launch.ts:106,149`） | **不在本文件**——归 `05` 篇 / `launch.ts` 的接线（契约 §5），但**命令依赖它**：不装 → `spawnAgent` 必 `status:'failed'` | 契约 §5 |

**行为层面零回归**：`render/brief.ts` 的改动全部 additive/无破坏（+1 个可选字段、nook 改选项对象、3 行文案替换）；`apps/server/src/engine/brief-builder.ts` 零调用点，直接删除不留 shim（契约 §4 裁决）。新增命令不改任何既有工具/preset/事件形状（契约 §10：`pnpm probe` / `probe:tools` 不回归）。

---

## ⑩ 验收测试（字段级断言清单）

### 10.1 brief 字段级单测（契约 §10 门禁）

运行方式：`node --test packages/shared/test/brief.test.mjs`（**已落地**，从 `../dist/index.js` import 两函数）。**字段级断言**（`03` §⑧-8 的对账口径；**nook 一律用选项对象**）：

| # | 输入 | 断言 |
|---|---|---|
| 1 | `buildSceneInitBrief({ layerId:'world/a/b', targetPath:'world/a/b', manifest, parentLayerName:'A', parentLayerPath:'world/a' })` | 输出**含** `[Layer ID] world/a/b`、`[Parent Layer] A` **且** 含 `[Parent Path] world/a`，且 `[Parent Path]` 紧跟在 `[Parent Layer]` 行**之后**一行 |
| 2 | 同 #1 | 输出含 `[Target Path] world/a/b`（**等于传入值**，逐字） |
| 3 | `buildSceneInitBrief({ layerId:'world/x', targetPath:'world/x', manifest })`（无 parent 字段） | 输出**不含** `[Parent Layer]`、**不含** `[Parent Path]` |
| 4 | `buildSceneInitBrief({ layerId:'world/a/b', targetPath:'world/a/b', manifest, parentLayerName:'A' })`（只有名字、无路径） | 输出含 `[Parent Layer] A`、**不含** `[Parent Path]`（两个 `if` 独立） |
| 5 | `buildNookInitBrief({ characterId:'watson', displayName:'Watson', manifest, missingFiles:['identity.md','personality.md'] })` | 输出含 `[Missing Files] identity.md, personality.md` |
| 6 | `buildNookInitBrief({ characterId:'watson', displayName:'Watson', manifest })`（**省略 `missingFiles`**） | 输出**不含** `[Missing Files]`（契约 §4.2「空则不输出」） |
| 7 | `buildNookInitBrief({ …, missingFiles: [] })` | **不含** `[Missing Files]`（**空数组也不输出**，MUST NOT 出现 `（none）`） |
| 8 | 同 #5/#7 | 输出含 `[Target Path] characters/watson`（逐字；**由 `characterId` 驱动，与 `displayName` 无关**） |
| 9 | `buildNookInitBrief({ characterId:'w', displayName:'W', roleDesc:'', manifest })` | `[Character]` 行**无空括号**（`[Character] W`）；`roleDesc` 非空时才带 ` (roleDesc)` |
| 10 | `buildNookInitBrief({ …, home:'world/baker-street', role:'companion' })` | 输出含 `[Home] world/baker-street (role: companion)`；`role` 缺省时只到 `[Home] <home>` |
| 11 | 两函数 | 输出含 `[Report]`；且正文为中性指路 `Report in exactly the three lines the system prompt defines`（不重复 `03` 正文规格） |
| 12 | `buildSceneInitBrief` 含 `[Deliverables]` | `[Deliverables]` 三条与 `03` 篇 §① 的产出规范一致（README / 1–3 物件 / 1–2 篇 `NN-opening.md` chalk） |

### 10.2 `parseInitArgs` 表驱动（纯函数，`03`/`02` 共用）

| # | 输入 `raw` | 期望 |
|---|---|---|
| 1 | `'{"kind":"scene","target":"world/a","by":"player"}'` | `ok:true`，`value.kind='scene'` 等 |
| 2 | `'{"kind":"nook","target":"watson","by":"engine","request":"hi"}'` | `ok:true`，`value.request='hi'` |
| 3 | `'not json'` | `ok:false` |
| 4 | `'{"kind":"scenes","target":"x","by":"player"}'` | `ok:false`（kind 不在集合） |
| 5 | `'{"kind":"scene","target":"","by":"player"}'` | `ok:false`（target 空） |
| 6 | `'{"kind":"scene","target":"x"}'` | `ok:false`（缺 by） |
| 7 | `'{"kind":"scene","target":"x","by":"god"}'` | `ok:true`（`by` 含上帝模式，契约 §2.3.2） |
| 7b | `'{"kind":"scene","target":"x","by":"plant"}'` | `ok:false`（`by` 不在集合） |
| 8 | `'{"kind":"scene","target":"x","by":"player","request":123}'` | `ok:false`（request 非 string） |
| 9 | `'[]'` / `'null'` | `ok:false`（非对象） |

### 10.3 `missingFilesFor`（需 store 桩 / 真世界）

| # | fixture | 期望 |
|---|---|---|
| 1 | holmes `characters/watson/`（只有 README.md + preset.json，preset 声明 `["README.md","identity.md","personality.md"]`） | `['identity.md','personality.md']` |
| 2 | 角色目录有全部三文件 | `[]` |
| 3 | preset `items` 无 file 槽（全是内置 slot） | `[]` |
| 4 | preset 的 file 槽带 `options.glob:true` | 该槽被跳过，`[]`（不误报） |
| 5 | `preset.json` 不存在 | `[]`（不抛） |
| 6 | `preset.json` 非法 JSON | `[]`（不抛） |
| 7 | 同一路径在多个 file 槽出现且缺失 | 去重（`out.includes` 守卫），只出现一次 |

### 10.4 端到端（契约 §10 判据，归 `04` 篇落地）

对 stub 层发 `/airp-init`（经真 spawned writer + 确定性 provider，沿用 `tools/probe-inject.mjs` 的「真 spawn + 确定性 provider」范式）：

- (a) 目标目录长出 `README.md` + ≥1 内容文件；
- (b) `events` 表新增一条 `layer_initialized`，`detail.by` 与传入 `by` 一致，`detail.layer` = 归一后的层 id；
- (c) 第二次发同一命令**不再动作**（判空短路；`events` 不再增行）。

**负路径**（建议补）：模拟 `spawnAgent` 返回 `timed-out` → 断言目录有 `README.md` + `opening.md`（W2）且 events 新增 `layer_init_failed(reason:'timed-out', fallback:'template')`。

---

## ⑪ 发现的冲突

> 逐条带 `file:line`。**不回改契约**，由主 agent 裁决。**2026-09-13 对齐**：下表历史落点中的 `brief-builder.ts` 均已删除，实际函数在 `packages/shared/src/render/brief.ts`。

### 冲突 1（**已解决**）— `brief` 与 `03` 篇正文的 `[Report]` **逐字比对**（契约 §4.3 末尾的待办）

契约 §4.3 明写「**待 P2 文档核对**：逐字比对现有 brief 的 `[Report]` 行与 `03` 篇正文，列出差异并给改法」。逐字结果：

| 位置 | 逐字内容 |
|---|---|
| ~~`brief-builder.ts:39-40`~~（历史，文件已删） | `[Report]` / `Three lines: list of paths / one-sentence scene summary / one sentence on "what is the most striking detail here"` |
| ~~`brief-builder.ts:55`~~（历史，文件已删） | `[Report] Describe the generated content in three lines.` |
| `03` 篇场景正文 `[Report]`（`docs/prompts/03:304-305`） | `When done, return a short three-line report: list of paths / one-sentence summary / the single detail most worth noticing. If you wrote nothing, the three lines say why.` |
| `03` 篇小天地正文 `[Report]`（`03:337-338`） | 与场景**同一句**（逐字相同） |
| doc-11 §2.2 样例（`doc-11:101-102`） | `Three lines: list of paths / one-sentence scene summary / one sentence on "what is the most striking detail here"` |

**差异**：
1. **场景侧**：brief（`:39-40`）与 `03` 篇**语义一致但措辞不同**（brief 说 "scene summary / what is the most striking detail here"；`03` 说 "one-sentence summary / the single detail most worth noticing"，且 `03` 多了 "If you wrote nothing, the three lines say why"）。**不冲突**——两者都表达"三行 = 路径 / 一句话摘要 / 最抓眼的细节"。brief 缺 `03` 的"什么都没写就说明为什么"出口。
2. **小天地侧**：brief（`:55`）**只说"三行"、不给三行规格**；`03` 篇给了精确三行。brief **弱于**正文。
3. **权威裁决**（契约 §4.3）：正文（`03`，优先级 3）**高于** brief 的措辞（brief 只是提醒）。故本批**不改 brief 的 `[Report]` 语义**，只把两处改成**中性指路**，消除"brief 措辞与正文逐字不一致"的表象：
   - `:39-40` → `Report in exactly the three lines the system prompt defines`（**删除**现有那句与 `03` 不同措辞的规格，避免两处规格互相打架）
   - `:55` → 同一句
4. **doc-11 §2.2 的样例三行**（`doc-11:102`）与 `03` 篇**措辞不同**（"scene summary" vs "summary"）——doc-11 是产品语义、`03` 是提示词正文，两者都在，**建议由 `05` 篇回写 doc-11 §2.2 的样例，使其与 `03` 篇逐字一致**（否则"brief 字段对账"（`03` §⑧-8）的人工核永远有两套措辞）。本文件只登记。

### 冲突 2 — 小天地**没有 W2 模板**，但契约 §2.3 第 6 步要求失败一律走 W2

- 契约 §2.3 第 6 步：`status !== 'completed'` → **W2 兜底落盘** → `recordLayerInitFailed({ …, fallback:'template' })`。
- 契约 §3.3 只定义 `w2SceneTemplate`（scene 专用）；**没有 `w2NookTemplate`**。
- 实测：holmes 的 `characters/watson/` 只有 `README.md` + `preset.json`——若 nook 初始化失败，**无模板可落**。
- 本文件的选择：nook 失败时 `fallback: 'none'`、不写盘（§⑧ `writeW2`），保持"诚实告知无兜底"。**但**：`layer_init_failed` 的 `fallback` 枚举是 `'template' | 'none'`（`events.ts:105`），`'none'` 语义合法。
- **待主 agent 裁决**（选项见 §⑫-4）：(a) 维持 `'none'`；(b) 新增一个 nook 最小模板（如只落 `README.md`），契约 §3.3 需同步。

### 冲突 3（**已解决**）— `2–4` vs `2–3` vs `1~3`（沿用 `03` §⑨ 冲突 3）

历史冲突中的数量分别属于不同产物：当前 **scene** brief/instruction 固定 1–3 个物件、1–2 篇 `NN-opening.md`；当前 **nook** brief/instruction 固定 2–4 个生活痕迹。旧 `brief-builder.ts` 与旧正文数字仅作历史记录，不是现行契约。

### 冲突 4 — `[Missing Files]` 的**输出形状**未被契约冻结（只有"空则不输出"）

契约 §4.2 给了样例 `[Missing Files] identity.md, personality.md`（逗号+空格连接、**只写文件名**）。本文件照此（`join(', ')`）。但契约未冻结：是否该写**相对路径**（`characters/watson/identity.md`）？`03` 篇 `[Process] 4` 只说"点名"（name），故取文件名。**登记**，见 §⑫-5。

### 冲突 5（**已解决**）— `roleDesc` 的来源在 holmes 世界里为空

`buildNookInitBrief` 的 `roleDesc` 从 manifest 取。实测 `templates/holmes-world/world.json:28-39` 的角色条目**只有 `id`/`home`/`role`**，**无 `description`**（`CharacterConfig.description` 是可选，`schemas/world.ts:22`）。→ holmes 所有角色的 `roleDesc` 为空。**已解决**：`render/brief.ts:91-93` 在 `roleDesc` 为空时**省略 `(roleDesc)` 括号**（`[Character] Watson`），不再出现 `[Character] watson ()` 空括号。

### 冲突 6（**已解决**）— `extensions/` 相对 import `apps/server/.../brief-builder.ts` 的可解析性

本文件初稿把 `airp-init` 命令（`extensions/toolkit/`）的 brief import 指向 `apps/server/src/engine/brief-builder.ts`，形成**全新跨包方向**（`extensions` → `apps/server/src`），与「扩展只 import shared/dist」纪律相反。
**裁决（契约 §4，方案 A，已落地）**：把两函数**下沉**到 `packages/shared/src/render/brief.ts`，`apps/server` 与 `extensions` 同源 import `packages/shared/dist/index.js`——与本批 `rules/*` 同一模式；原 `apps/server/src/engine/brief-builder.ts` 零调用点，**直接删除不留 shim**。§⑧-2 伪代码的 import 已随之改为 `packages/shared/dist/index.js`。本冲突**已解决**。

### 冲突 7（**已解决**）— `buildNookInitBrief` 旧第 1 参曾是**参数重载**（id 兼作路径与显示名）

旧签名 `buildNookInitBrief(characterName, …)` 用一个参数同时做两件事：`[Target Path] characters/${characterName}`（要目录名/角色 id）与 `[Character] ${characterName} (${roleDesc})`（要显示名）。二者在 holmes 未必相同（目录 `watson`、README `name` 任意），一旦不同，传显示名会把 `[Target Path]` 拼错。
**裁决（契约 §4.2，已落地）**：**签名拆成选项对象** `{ characterId, displayName, roleDesc?, home?, role?, manifest, missingFiles? }`，两个语义各占一位——`characterId` 驱动 `[Target Path]`（`render/brief.ts:90`），`displayName` 驱动 `[Character]`（`:92-93`）。命令侧：`characterId = target`；`displayName` 由 §3.4-3 的 `displayNameFor` 从 README frontmatter 取、无则回退 id。本冲突**已解决**。

### 冲突 8 — `parseFrontmatter` 是既有复用点（登记，非冲突）

若将来要显示名，应复用 `parseFrontmatter(raw).frontmatter?.name`：`packages/shared/src/store/local-store.ts:11` import 它、`actions/layer.ts:31-32` 正是这个用法（返回 `{ frontmatter, body }`）。命令**不新写解析**。

### 冲突 9 — `actions/layer.ts:23` 的 `layerIdOf` 与 `store/layers.ts:37` 的 `layerOfDir` 是同映射两份

`01` 篇 §⑪-3 已登记；本命令**只用导出的 `layerOfDir`/`dirOfLayer`**，不重写。登记以免遗漏。

### 冲突 10 — `characterIdOfPath` 未被本命令使用

`rules/characters.ts` 提供三函数（`01` 篇 §⑫-1）；本命令只 `nookIdOf`。`characterIdOfPath` 的消费者是 nook 批（`GET /api/nook` / `arrangeCards`）。**登记为"本批未用"**。

**对齐记录（2026-09-13）**：本文已按冻结契约 `docs/init/00-共同上下文.md` 对齐——`parentLayerId` 删、`buildNookInitBrief` 改选项对象、`[Home]`/`[Missing Files]` 字段与 `by:'god'` 补入、§8.2 import 改 `packages/shared/dist`（无 `brief-builder`）、补 in-flight 锁与 god 零 AI 路径、§3.6 preset 形状改 `{kind:'slot',slot:'file',options:{path:[…]}}`、层 id 统一 `world/` 前缀；冲突 1/3/5/6/7 标「已解决」。

---

## ⑫ 仍未知待拍板

1. **超时值的归属**：契约 §2.3 冻结超时为**命令内常量**（"作为命令内常量，登记「配置项待外提」"），doc-11 §6.2 说"超时值是配置不是常量"。本文件取命令内常量（`TIMEOUT_MS`）。**是否要外提为 preset/env/世界配置**？未定。当前：常量。
2. **`missingFiles` 对 `glob:*` 槽的处理**：本文件**跳过** `glob:true` 的槽（无法静态判定哪些文件该存在）。若某角色 preset 用 glob 引用"必定存在"的文件集，会**漏报**。是否需要 glob 展开？未定。
3. **`files` 数组的形状**（成功路径）：本文件取**world 相对全路径**（`world/crime-scene/README.md`）。契约 §6 未冻结。备选：只存文件名，或只存 `dir` 相对。消费方（前端/作家）需要哪种？未定。
4. **nook 失败是否落模板**（§⑪-2）：`fallback:'none'` 是本文件的保守选择。若产品要求 nook 也"至少落一个 README"，需新增 `w2NookTemplate`（契约 §3.3 同步）。未定。
5. **`[Missing Files]` 写文件名还是相对路径**（§⑪-4）：当前文件名（照契约 §4.2 样例）。未定。
6. ~~**brief-builder 的落点**（§⑪-6）~~ **【已裁决，2026-09-13】**：两函数已下沉 `packages/shared/src/render/brief.ts`（契约 §4）；原 `apps/server/.../brief-builder.ts` 已删除。**无待拍板**。
7. **`airp-init` 的命令返回值形态**：契约 §2.2 说"经 `pi.sendMessage` 回一条人话"。是否还需 `display: true`（让 TUI 可见）？本文件取 `display: false`（契约：仅供作家/日志）。未定。
8. **R2 的服务端触发不在本文件**：谁调 `/airp-init`（WS 类型 or HTTP 路由）归 `03` 篇。本文件只定义命令本身。**边界声明**（契约 §9）。
9. **`by` 的第三种值**：契约 §2.2 冻结 `'player' | 'engine' | 'god'`（`'god'` 由上帝模式建目录零 AI 路径用，契约 §2.3.2），而 `layer_initialized` 的 `detail.by` 枚举是 `'writer' | 'player' | 'engine'`（`events.ts:99`）——**不含 `'god'`**。契约 §2.3.2 明写零 AI 路径落 `recordLayerInitialized({ by: 'god' })`，与 `events.ts:99` 的枚举**存在张力**：需 `05` 篇把 `events.ts:99` 的 enum 扩为含 `'god'`（或零 AI 路径改写 `'engine'`）。登记待拍板。本命令永不传 `'writer'`（R1 不经本命令）。
10. ~~**`buildNookInitBrief` 的参数拆分**（§⑪-7）~~ **【已裁决，2026-09-13】**：签名已拆为选项对象 `{ characterId, displayName, … }`（契约 §4.2）。**无待拍板**。
