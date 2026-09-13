# 02 — Agent 路径与初始化 brief 设计

> 范围：只定义 Agent 如何看待 `worldRoot`、`cwd` 与三类稳定世界根相对路径，并定义初始化 brief 如何避免把虚拟层 id 当成文件路径。
>
> 本文遵守 `docs/2026-09-14-agent-photo-content-design/00-共同上下文.md`；不新增玩家 Agent、不新增第二份路径状态、不新增 WS 通道，也不修改共同契约文件。
>
> 现状行号以 2026-09-14 工作树为准；实现前仍需按符号名复核。

## 1. 一句话定位

**把 Agent 的“我在哪”和“这个路径是什么”固定成一套以 `worldRoot` 为物理根、以 `world/`、`player/`、`characters/{id}/` 为稳定引用、以 `map` 仅作虚拟层 id 的英文常驻说明；初始化 brief 只补足会随任务变化的目标身份。**

## 2. 冻结的路径模型

### 2.1 物理根与 Agent cwd

现状：Writer 的 `LaunchSpec.cwd` 是 `worldRoot`（`apps/server/src/engine/launch.ts:131-137`），Character 同样使用 `cwd: worldRoot`（`:165-184`）。服务端默认世界由 `path.resolve(REPO_ROOT, AIRP_WORLD ?? 'templates/wuwu')` 得到（`apps/server/src/index.ts:68-76`），启动 Writer 时把这个目录传给 lifecycle（`:80-81`）。

因此常驻 instruction 采用以下口径：

- “Your process working directory is the current `worldRoot`.” 这里的 `worldRoot` 是当前存档的物理根，不是仓库根，也不是 `world/` 子目录。
- Agent-facing AIRP 路径**一律是相对 `worldRoot` 的 POSIX 路径**。不要把运行时绝对 cwd 写进文件、事件、brief 或发给前端的文案。
- 平台原生 `read` 确实把相对参数按 cwd 解析（`vendor/pi-rp/packages/coding-agent/src/core/tools/path-utils.ts:44-50`），但这不改变 AIRP 工具的路径契约：模型应传稳定的世界根相对路径，而不是依赖“当前打开文件所在目录”。
- `worldRoot` 改变时必须视为换世界，而不是换一层；旧 Agent、旧 store、旧 session 不能继续作为新世界的上下文。[推断]

### 2.2 三类稳定路径

| Agent 看到的路径 | 物理语义 | 是否普通 layer | 可说给 Agent 的关键规则 |
|---|---|---:|---|
| `world/...` | 世界内容树及其子目录 | 是（根目录本身例外见下） | 层由 `world/**` 的目录树派生，不按显示名猜路径；场景文件也用此形状。 |
| `player/...` | 真人玩家的背包/私人空间 | 否 | 这是玩家数据，不是 Agent cwd、不是角色 preset、不是场景；物品转入背包才移动到此根。 |
| `characters/{id}/...` | 角色独立小天地及角色文件 | 否 | `{id}` 是 ASCII 小写 kebab-case 稳定 id；显示名不是路径；小天地通过独立 nook 读取。 |

依据：`world/**` 目录派生 layer 且 `map` 映射到 `world/`（`packages/shared/src/store/layers.ts:1-39`）；`characters/**` 不进入普通 layer（`apps/server/src/routes/world.ts:552-560`、`:630-659`）；背包枚举 `player/` 下文件（`packages/shared/src/actions/backpack.ts:18-36`）。
角色 nook 的“Agent 可读文件”与“公开投影卡片”不是同一集合：`README.md`、`identity.md`、`personality.md`、`memory.md` 是角色根配置，Character preset 可按需读取；公开 `GET /api/nook?character={id}` 的 `items` 必须过滤这四个根文件，只投影生活内容。四个文件可编辑但不可移除或移动；`write`/`edit`/`move`/`delete` 的统一门禁必须在动作层落地，不能只依赖 Nook instruction 的提示词。Skill 装给 Character 之前也必须通过前门禁（preset/launch 的可见性与权限校验），否则路径说明不得声称 skill 已可用。
所有 public nook 读取/排布 caller 必须使用同一份过滤结果：`GET /api/nook`（`apps/server/src/routes/world.ts:587-590`）与 nook `arrangeCards`（`packages/shared/src/actions/canvas.ts:519-524`）都走 `nookCardPaths`；该 helper 迁移后统一排除四个根配置，不能只改其中一个 caller。`README.md` 仍可作为独立 `scene` facade 返回，不进入 `items`。

路径示例必须保留完整根前缀：

```text
world/baker-street
world/baker-street/README.md
player/brass-key.md
characters/watson/README.md
characters/watson/letters/unsent.md
```

不得使用以下替代形状：`baker-street/README.md`（缺 `world/`）、`map/README.md`（把虚拟 id 当目录）、`characters/Watson/...`（id 大小写错误）、绝对路径、`./`、`..` 或隐藏段。写入侧已有根白名单及穿越检查（`packages/shared/src/actions/chalk.ts:316-334`、`packages/shared/src/actions/create.ts:54-81`）；instruction 是让模型稳定选择正确输入，不能代替动作层校验。

### 2.3 `map` 是虚拟层 id，不是文件路径

- `map` 只表示 `world/` 的虚拟根层 id；`dirOfLayer('map') === 'world'`，反向映射由 `layerOfDir` 完成（`packages/shared/src/store/layers.ts:26-39`）。
- 进入根层时 API 接收 `layer: 'map'`，随后读取 `world/README.md`（`apps/server/src/routes/world.ts:1162-1171`）。
- 需要读/写文件、给 `look_at`、`chalk`、`move` 等动作传文件或目录时，传 `world/...`；**永远不要**传 `map/...`。`look_at` 的输入文档也把目录解释为 layer/map/player/nook 的目录，但路径本身仍是世界根相对路径（`packages/shared/src/actions/look-at.ts:42-49`）。
- `player/` 和 `characters/{id}/` 可以作为可读目录，但它们不是 `manifest.layers` 中的 layer；`move_to` 的目的地必须是场景，不能把角色 nook 或背包当站立场景（`packages/shared/src/actions/move-to.ts:21-25`；`packages/shared/src/actions/presence.ts:155-163`）。
- `characters/{id}/README.md` 是角色文件/小天地 facade，不等于角色在画布上的 presence；角色位置由 `move_to` 记录，不能移动 nook 目录（`packages/shared/src/actions/move-to.ts:1-7`）。

## 3. 指令槽设计

### 3.1 槽归属与不新增玩家槽

现有扩展注册的是 `writer-char` / `writer-instruction`、`system-char` / `char-instruction`、`scene-init-instruction`、`nook-init-instruction`（`extensions/instructions.ts:313-350`）。四种 slot 的正文分别来自 `WRITER_INSTRUCTION`（`:53-191`）、`CHARACTER_INSTRUCTION`（`:193-245`）、`SCENE_INIT_INSTRUCTION`（`:247-281`）、`NOOK_INIT_INSTRUCTION`（`:283-311`）。

本设计只更新这些已有常驻正文：

1. **Writer：** 在 `WRITER_INSTRUCTION` 的“先读世界、再写入”纪律附近加入 `[Paths and the world root]`。它教 Writer 使用 `world/...`、`player/...`、`characters/{id}/...`，并单列 `map` 只是假想层 id。
2. **Character：** 在 `CHARACTER_INSTRUCTION` 的“Where you come from”之后加入同一事实但更窄的版本：角色自己的配置文件位于 `characters/{id}/...`；`README.md`、`identity.md`、`personality.md`、`memory.md` 是根配置，允许编辑但不可移动/删除；公开 nook 卡片不会显示这四个文件。谈及场景时用 `world/...`；不要把 `player/` 当自己的工作目录或场景；不要把显示名当 id。
3. **Scene initializer：** 在 `SCENE_INIT_INSTRUCTION` 的 Process 之前加入路径操作段：brief 的目标目录是物理 `world/...` 目录；当 brief 同时给 `[Layer ID] map` 与 `[Target Path] world` 时，前者是 layer 身份，后者才是 `write` 目标目录；不得创建 `map/`。层根 `README.md` 统一写 `type: readme`；只有独立 child-door 才写 `type: gate`；`stub: true` 只是未写入的显示标记，不是新的 layer/path 命名空间。新 authored opening 的文件名统一为 `NN-opening.md`（首篇 `01-opening.md`）；`opening.md` 仅旧 W2 fallback，`evening.md` 仅 legacy，旧文件不自动重命名。
4. **Nook initializer：** 在 `NOOK_INIT_INSTRUCTION` 的 Deliverables 之前加入路径操作段：目标**仅**是 `characters/{id}`；本轮绝不接受 `player/` 或“player stronghold”作为 `kind:nook` 目标。文件名只能在该角色目标目录下写；`README.md`、`identity.md`、`personality.md`、`memory.md` 是根配置，缺失时只能按 brief 指示补写，永远不可由初始化器移动/删除。公开 nook 投影不把这四个配置文件当 cards。`player/` 是真人玩家空间，不是本命令的 Agent 目标。

四段英文正文可共用相同的事实顺序，但**不要**再注册一个 `player-instruction`、`PLAYER_INSTRUCTION` 或同义 slot。`ActorType` 虽含 `player`，但 `readerOfActor` 对 player 返回 `null`（`packages/shared/src/actions/actor.ts:6-10,48-58`）；`AIRP_AGENT_ROLE` 只解析 Writer、初始化继承的 Writer、或 `character:<id>`（`:13-45`）。这说明 player 是事件归属/真人 UI 概念，不是模型会话角色。

### 3.2 推荐的常驻正文结构

以下不是第二份路径契约，而是四个 slot 都应遵循的段落顺序；具体句子由实现时写进 `extensions/instructions.ts` 的四个常量，并保持英文平台提示词口径。

```text
[Paths and the world root]
Your process cwd is the current world root. AIRP paths are POSIX paths relative to that root.
world/... is the world tree; player/... is the real player's private/bag space;
characters/<lower-kebab-id>/... is a character's private nook and character files.
Do not replace a stable path with a display name, an absolute path, './', '..', or a hidden segment.
The layer id `map` is virtual: it names the `world/` root layer, but `map/...` is never a file path.
When a brief gives both a layer id and a target path, the layer id is identity and the target path is the directory to use.
```

按角色补充“漏了会怎样”：

- Writer 漏掉“先 `look_at`/`read` 真实路径” → 可能只凭状态索引或显示标题写错文件；现有 Writer 正文已经规定 touched path 先打开（`extensions/instructions.ts:66-72`），路径段应把这个要求绑定到三类稳定路径。
- Character 漏掉 `characters/{id}` 与 `world/...` 的区别 → 可能把自己的 nook 当场景或把显示名拼进路径；模型会说出未读文件内容。
- Scene-init 漏掉 `map`/`world` 区分 → 根场景会尝试写 `map/README.md`，而真正根文件是 `world/README.md`。
- Nook-init 漏掉“不可初始化 player” → 会虚构一个不存在的玩家 preset/Agent；这是本轮明确禁止的降级。

### 3.3 Preset 装配边界

不为路径说明添加新 item：

- Writer preset 已引用 `writer-char`（`presets/writer.json:33-43`）。
- 兜底 Character preset 已引用 `system-char`（`presets/character.json:33-43`）；Character launch 优先选择 `characters/{id}/preset.json`（`apps/server/src/engine/launch.ts:145-162`），所以各世界侧自定义 preset 若缺该 slot，角色仍会看不到正文，必须在装配阶段单列出来，不能靠新增 Player slot 补救。
- 两个 initializer preset 已分别引用对应 init slot（`presets/scene-init.json:26-36`、`presets/nook-init.json:26-36`）；不要为它们加假的 `tools`/player slot。
- `writerLaunch` 在启动时安装 Writer、scene-init、nook-init preset（`apps/server/src/engine/launch.ts:106-124`）；此处是已有装配入口，不新增路径状态文件。

## 4. brief 是否增加 path 字段

### 4.1 迁移决定：不增加泛化 `path`，正式增加必填 `layerId`

**本设计冻结采用 `layerId` 必填迁移，不把它留作可选建议。** 不新增名为 `path` 的自由字符串字段。当前 `SceneInitContext.targetPath` 已明确承担“写入目标目录”，`NookInitContext.characterId` 已明确承担“角色 id”，并由 builder 生成唯一的 `[Target Path] characters/{id}`（`packages/shared/src/render/brief.ts:16-28,68-85,87-111`）。再加一个可由调用方任意填写的 `path` 会制造两个目标真相，且会绕过 `dirOfLayer`/`nookIdOf` 的安全归一。

但当前 scene 命令把 `map` 先转换为 `dir='world'`，随后只把 `dir` 作为 `targetPath` 传给 builder（`extensions/toolkit/init-command.ts:199-207,286-295`）。这样根层 brief 只有 `[Target Path] world`，模型看不到“这是虚拟层 `map`”的身份。[现状] 因此 `layerId` 是**必须落地的迁移字段**，而不是实现者可自行取舍的建议：

```ts
// packages/shared/src/render/brief.ts
export interface SceneInitContext {
  /** Physical world-root-relative directory to write, e.g. world/baker-street. */
  targetPath: string;
  /** Layer identity; 'map' is virtual and maps to targetPath 'world'. */
  layerId: string; // NEW, required; no compatibility default
  manifest: WorldManifest;
  parentLayerName?: string;
  parentLayerPath?: string;
  userPrompt?: string;
  knownClues?: string[];
}
export function buildSceneInitBrief(ctx: SceneInitContext): string;
```

`layerId` 不可选、不可由 builder 从 `targetPath` 反推：`targetPath='world'` 可能来自显式物理目录，而只有调用链掌握原始 layer id。builder 的动态输出固定为：

```text
[Task] Instantiate a scene layer
[Layer ID] map
[Target Path] world
...
```

普通层则例如：

```text
[Layer ID] world/baker-street/crime-scene
[Target Path] world/baker-street/crime-scene
```

因此 `map` 永远只出现于 `[Layer ID]` 或 HTTP/事件的 layer 字段，不出现在文件路径；`world/` 永远是物理文件/目录前缀。
brief 的 `[Deliverables]` 仍描述 opening，但实现文本必须明确“新 authored opening → `NN-opening.md`，首篇 `01-opening.md`；`opening.md` 只允许 W2 fallback，`evening.md` 只按 legacy 读取/保留”。这只是文件命名约束，不改变 `layerId`/`targetPath` 身份分工；旧文件不自动重命名。

`buildNookInitBrief` 保持现有选项对象签名，不添加 `path`：

```ts
export interface NookInitContext {
  characterId: string;
  displayName: string;
  roleDesc?: string;
  home?: string;
  role?: string;
  manifest: WorldManifest;
  missingFiles?: string[];
}
export function buildNookInitBrief(ctx: NookInitContext): string;
```

它继续由 `characterId` 输出 `[Target Path] characters/${characterId}`（`packages/shared/src/render/brief.ts:87-111`）；`characterId` 必须是已通过 `nookIdOf` 的角色 id，不能让 Agent 或 HTTP 调用方直接传完整目录。

### 4.2 调用链及漏项后果

1. `airp-init` 解析并验证 `target`，scene 用 `dirOfLayer`，nook 用 `nookIdOf`（`extensions/toolkit/init-command.ts:71-86,198-207`）。**漏了会怎样：** 自己拼 `characters/${target}` 可能接受穿越/非法 id；把 `map` 当目录会落到错误位置。
2. scene 计算 `layer = args.target` 与 `dir = dirOfLayer(args.target)` 后，调用 `buildSceneInitBrief({ layerId: layer, targetPath: dir, ... })`。**漏了会怎样：** 根层 brief 无法区分 `map` 与 `world`，initializer 可能产生 `map/` 文件或在报告中回写错误 id。
3. nook 继续调用 `buildNookInitBrief({ characterId: args.target, ... })`，不接受调用方 path。**漏了会怎样：** 同一个角色会出现 `[Character]` 显示名与 `[Target Path]` 不一致，或者任意路径注入。
4. builder 输出的 `[Target Path]` 只写稳定 world-root 相对路径，不输出绝对 cwd；`[Layer ID]` 只描述身份。**漏了会怎样：** brief 把机器路径泄漏给模型/日志，或让模型把身份字段当可写路径。
5. initializer 按 `[Target Path]` 写，并在三行报告列出实际稳定路径；结果校验仍由现有 `hasInitProduct`/store 完成（`extensions/toolkit/init-command.ts:322-345`）。**漏了会怎样：** “报告成功”可能掩盖目标目录写错，事件却已被记录。

### 4.3 必须完成的全量迁移清单

这是 `layerId` 从类型到运行时再到回归测试的闭环；任何一项漏掉都必须视为未完成，而不是兼容旧调用。

| 位置 | 当前调用/定义 | 迁移动作 | 漏了会怎样 |
|---|---|---|---|
| `packages/shared/src/render/brief.ts:16-35` | `SceneInitContext` 与 `buildSceneInitBrief` | 增加必填 `layerId`；在 `[Task]` 后输出 `[Layer ID] ${ctx.layerId}`，再输出 `[Target Path] ${ctx.targetPath}` | 根层身份丢失；`map` 与 `world` 再次混用 |
| `extensions/toolkit/init-command.ts:288-295` | 唯一生产调用 | 传 `layerId: layer`、`targetPath: dir`；`layer` 保留 `args.target` 的 `map` 或 `world/...` 形状 | 运行时仍只传物理目录，新增字段永远为空 |
| `packages/shared/test/brief.test.mjs:15-18,20-31,33-37,39-43,45-58,60-64` | 6 个 scene builder 调用 | 每个对象都补 `layerId`；新增 map/world 对照断言，删除“旧签名仍可调用”的隐式兼容期待 | 类型/测试不能证明迁移完成；旧实现可能假绿 |
| `packages/shared/src/index.ts` 的既有 render 导出 | dist 入口不改形状 | 保持 `buildSceneInitBrief` 导出；实现 shared 后重新生成 `packages/shared/dist`，不手写 dist | extensions 仍加载旧构建产物，生产与源码分叉 |
| `docs/init/00-共同上下文.md:213-220` | 上位接口示例 | 同步写成 `layerId` + `targetPath`，明确 `map/world` 对照 | 下游实现者按旧接口漏传字段 |
| `docs/init/02-brief与执行内核.md:36-44,107-112,147-153` | brief 接口、归一、调用伪码 | 同步签名、输出行、`buildSceneInitBrief({ layerId: layer, targetPath: dir, ... })` 与测试要求 | 文档仍声称只有 targetPath，产生第二份契约 |
| `docs/prompts/03-初始化器提示词.md`（当前正文对应 `extensions/instructions.ts:247-281`） | initializer 对 brief 的字段假设 | 增加 `[Layer ID]` 与 `[Target Path]` 的身份/物理目录区分 | init Agent 把 `map` 当文件夹 |

当前生产源码中 `buildSceneInitBrief` 只有上述一处调用（`extensions/toolkit/init-command.ts:288-295`）；测试中的 6 处必须全部迁移。场景 `airp_init` 的 HTTP/WS 输入 shape 不增加 `layerId`：`layerId` 由命令内部已归一的 `layer` 产生，避免让浏览器成为第二个 layer 身份来源。

## 5. 文件与副作用

### 5.1 设计落点（实现阶段修改清单）

| 文件 | 精确落点 | 设计动作 | 副作用 |
|---|---|---|---|
| `extensions/instructions.ts` | `WRITER_INSTRUCTION`、`CHARACTER_INSTRUCTION`、`SCENE_INIT_INSTRUCTION`、`NOOK_INIT_INSTRUCTION`（`:53-311`） | 增加英文路径段；修正 nook-init 不声称可初始化 player | 只改变后续新编译 session 的静态 system prompt；不写世界文件 |
| `packages/shared/src/render/brief.ts` | `SceneInitContext`、`buildSceneInitBrief`（`:16-65`） | 增加必填 `layerId`，输出 `[Layer ID]`；保留 `targetPath` | 只改变 initializer task 文本；不写 store/事件 |
| `extensions/toolkit/init-command.ts` | scene brief 调用（`:286-295`） | 传 `layerId: layer`，`targetPath: dir` | 不改 `airp-init` 参数、不改事件形状 |
| `packages/shared/src/rules/init-fallback.ts:17-35` + `apps/server/src/routes/world.ts:707-725` | W2 fallback 已用 `README.md type:readme`；现 child stub door 合成仍是 `type:readme` | 保留 W2 的 `opening.md`，但 child-door 合成改为独立 `type:gate`；layer-root README 始终 `type:readme`；`stub:true` 只作显示标记。新 authored opening 的 brief/instruction/test 一律使用 `NN-opening.md`（首篇 `01-opening.md`），不重命名旧 `opening.md`/`evening.md` | 把 child door 当 layer README，或把 authored opening 与 W2/legacy 文件混为同一文件 |
| `presets/writer.json`、`presets/character.json`、`presets/scene-init.json`、`presets/nook-init.json` | 现有 slot item | 保持 slot 名与顺序；不创建 player slot | 启动时照既有规则复制 preset |
| 世界侧 `characters/{id}/preset.json` | 各自已有 `system-char` item | 装配阶段检查缺失项；不在本篇偷偷改 9+1 份世界文件 | 缺 slot 的旧角色仍是已知不一致，须由装配任务处理 |
| `packages/shared/src/rules/characters.ts:55-69` + `apps/server/src/routes/world.ts:587-590` + `packages/shared/src/actions/canvas.ts:519-524` | 当前 `nookCardPaths` 只排除 `README.md`，且两个 public caller 都依赖它 | 将 `nookCardPaths` 直接迁移为过滤 `README.md`、`identity.md`、`personality.md`、`memory.md`；所有 callers（public `/api/nook` 与 nook `arrangeCards`）继续共用该 helper；Agent 自己的 preset 读取不受 projection 过滤影响 | 配置文件泄露为公开 cards，或 callers 分叉导致不同页面看到不同集合 |
| `packages/shared/src/rules/characters.ts`、`packages/shared/src/actions/chalk.ts:316-350`、`packages/shared/src/actions/delete.ts:72-99,152-232`、`packages/shared/src/actions/move.ts:73-100` | 各动作已有分散的 path/README 检查；尚未形成四配置统一门禁[推断] | generic native `write/edit` 默认拒绝四配置；唯一编辑入口为 `edit_character_config({ characterId, file, content, mode })`，Character 仅自身 memory，Writer 可编辑 `manifest.characters` 中任一已登记角色四项，其他 actor/initializer 拒绝；`move/delete` 永久拒绝 | 只在 instruction 里说“不可删除”会被任一动作绕过，配置无法保持角色身份 |
| Character skill 装配入口（`apps/server/src/engine/launch.ts:152-185`、`vendor/pi-rp/packages/coding-agent/src/core/subagent/prepare.ts:174-184`）及其装配测试 | skill/character 前门禁必须先于 prompt 可见性 | 在向 Character 传 `--skill`、合并 `skills` slot 前执行角色身份/路径权限前门禁；无门禁则拒绝装配，不以 instruction 声称“skill 可用”；补真实 Character prompt 的负/正断言 | 未授权 skill 进入 Character prompt，路径说明成为虚假权限承诺 |

`SceneInitContext` 的其余字段与 `NookInitContext` 签名保持；唯一接口变更是 `SceneInitContext.layerId` 增为必填。若实现需要抽取正文常量，NEW 签名应为 `const PATH_INSTRUCTION: string` 或同等常量，不应引入运行时读盘函数。`dirOfLayer`、`layerOfDir`、`nookIdOf` 是现有唯一映射/构造函数，禁止复制实现。

### 5.2 文件系统与日志副作用

路径 instruction 本身没有文件、数据库、cursor 或事件副作用。只有 Agent 后续调用既有工具才会产生写盘和事件：

- `chalk`/`write`/`edit` 的写入仍由动作层记录；路径安全仍受 `invalid_path` 等错误保护。
- `airp-init` 的成功/失败仍由 `layer_initialized`/`layer_init_failed` 落账；本设计不增加 `path_explained`、`player_agent_started` 等事件。
- brief 的 `[Layer ID]` 仅是 task 文本，不是新的状态命名空间，也不能驱动 choice 或 branch 状态。

## 6. 状态、事件、WS 与缓存边界

### 6.1 常驻 instruction 与动态 world state 分离

`extensions/context.ts` 把目录扫描、数据库读取与 state block 渲染放在 `agent_start`，每轮写入缓存（`extensions/context.ts:125-161`）；`context` handler 只读取缓存并追加一条消息，不做 I/O（`:165-193`）。路径段属于静态 instruction，不能塞进动态 state cache，也不能让 `context` 每轮重扫路径。

动态 state 仍可以包含当前 layer、viewport、bag、presence 等路径；它只作为索引，Writer 仍应先 `look_at`/`read` 实际路径。Character 不应因为本设计新增 cursor：Writer cursor 在 `agent_start` 结算，Character cursor 由服务端 overlay 关闭时结算（`extensions/context.ts:142-160`）。

Scene-init/Nook-init 子代理没有 `context`/`agent_start` 注入；它们只看到 system prompt、preset 与 brief（`extensions/context.ts:39-43`）。因此 `[Target Path]`/`[Layer ID]` 必须在 brief 中完整出现，不能要求 initializer 从 Writer 状态块自行推断。

### 6.2 既有 session 的刷新边界

1. slot 文本在 session 的静态 system prompt 编译阶段确定，不是每轮 `agent_start` 重算。pi-rp 的 subagent preparation 优先用父 session 的内存 preset，只有没有时才从 cwd 的磁盘 preset fallback（`vendor/pi-rp/packages/coding-agent/src/core/subagent/prepare.ts:124-140`）。
2. Writer 同世界会复用现有 client（`apps/server/src/engine/lifecycle.ts:168-187`），已有 session 时 launch args 加 `--continue`（`apps/server/src/engine/launch.ts:100-129`）。因此修改 `extensions/instructions.ts` 或世界侧 preset 后，旧 client 的静态 prompt 不变；“刷新”不是重新 install 文件，而是执行既有生命周期序列 `await lifecycle.stopWriter(); await lifecycle.startWriter(worldRoot)`。`startWriter` 的新进程重新执行 `writerLaunch`、重新安装 preset 并重新编译 slot；`--continue` 只保留历史 session，不复用旧 system prompt。[推断]
3. `installPreset` 每次 launch 覆盖 world 的 `.airpworld/prompt-presets` 拷贝（`apps/server/src/engine/presets.ts:22-39`），所以磁盘残留不能覆盖仓库真相源；它没有对运行中的 session 触发 reload。必须以 stop/start 作为唯一 Writer 静态 prompt 刷新机制，不能把 `/airp-init` 或下一轮 `prompt()` 当刷新动作。
4. Character 每次 `startCharacter` 先停止旧 client 再启动新 client（`apps/server/src/engine/lifecycle.ts:213-230`），所以关闭/重开 overlay 或显式调用 `startCharacter(characterId, worldRoot)` 就是其刷新机制；它仍可继续自己的 `char-{id}.jsonl`，历史续接不等于旧 system prompt 被保留。[推断]
5. initializer 的 profile 在 Writer 进程内使用；`writerLaunch` 在启动前安装 scene/nook preset（`apps/server/src/engine/launch.ts:106-113`）。因此路径正文变更后，必须先完成 Writer stop/start，再由新 command spawn；当前 `registerInitCommand`（`extensions/toolkit/init-command.ts:173-180`）没有 reload API，也不得在 handler 中临时 install 并假定父 session 的内存 preset 已改变。
6. 现有 cache 在 turn boundary 无 fingerprint、每轮无条件覆盖；branch/new/resume 等切换由下一次重算覆盖，`previewPrompt()` 的 stale window 不进模型（`extensions/context.ts:45-55`）。这只刷新动态 state，不刷新静态 slot；本设计不添加清 cache hook，也不把静态路径段复制进 cache。
7. world switch 时 lifecycle 会停止旧 Writer、启动新 world client（`apps/server/src/engine/lifecycle.ts:185-205`）；context 的 store fallback 也按 `ctx.cwd` 重新打开 root（`extensions/context.ts:202-234`）。路径段不应跨 world session 复用。

### 6.3 WS / HTTP 不变

Writer 玩家请求经现有唯一 WS `writer_prompt`，服务端把 `[Current Layer]` 与 `[Player Request]` 拼入 Writer 输入（`apps/server/src/index.ts:123-151`）。`[Current Layer] map` 是输入中的层 id；这不使 player 变成 Agent，也不应改写成 `world/` 文件路径。

初始化经现有 `airp_init` WS 消息转为 `/airp-init` prompt（`apps/server/src/index.ts:152-176`）；完成与失败仍通过事件桥的 `layer_initialized`/`layer_init_failed` world event（`:153-160`）。本设计不增加第二条 WS、不增加路径事件、不修改事件 payload。

## 7. “作家和玩家”语义与前端最小边界

### 7.1 服务器/模型侧

用户说“作家和玩家”时，按以下三层解释：

- **作家**：真实 Writer Agent，`AIRP_AGENT_ROLE=writer`，读 state、读文件、写 canon。
- **玩家**：真人及其事件 actor。Writer 收到的用户输入当前已明确标为 `[Player Request]`（`apps/server/src/index.ts:131-146`）；player 事件没有 reader cursor（`packages/shared/src/actions/actor.ts:48-58`）。
- **玩家目录**：`player/` 文件空间；它可由真人通过前端背包操作，也可作为 Writer 叙事中被引用的稳定路径，但不是一个模型会话。

因此实现时必须：

- 不创建 `PLAYER_INSTRUCTION` 常量或 slot。
- 不给 `player/` 复制 Writer/Character preset。
- 不把 `by: 'player'`（`airp-init` 的来源标签）解释为“启动玩家 Agent”；它只是请求/事件来源。`InitArgs` 的 `by` 解析目前是 `'player' | 'engine'`（`extensions/toolkit/init-command.ts:49-56,71-86`）。
- 不把前端显示的“YOU / PLAYER CHARACTER”当作模型身份；当前 UI 文案位于 `apps/web/src/App.tsx:765-770`，它是 UI profile，不是 prompt slot。

### 7.2 前端文案与跨域接口

**推荐：不新增跨域 path-guide API。** 路径说明是平台静态文案，前端若确实要向真人解释，可在既有 i18n 中增加一条短帮助文案（现有地点/玩家文案已在 `apps/web/src/lib/messages.json:378-385`），内容只说：

- 当前世界中的文件引用使用 `world/...`、`player/...`、`characters/{id}/...`；
- `map` 是根层的内部 id，不是要打开的文件夹；
- 玩家不需要理解 `worldRoot` 的绝对物理路径。

动态世界名称继续使用现有 `/api/manifest`（`apps/server/src/routes/world.ts:540-550`）；前端已经显示 world/current place（`apps/web/src/App.tsx:608-611`），不应把绝对 cwd 拼进 DOM。这样不需要新的 HTTP route、WS frame 或状态同步，亦不会让前端误以为存在 Player Agent。

若未来产品明确要求服务端成为多语言文案的唯一来源，最小候选才是一个只读、无副作用的 `GET /api/path-guide`；其返回值只能是版本化根语义（不能返回绝对 `worldRoot`），例如 `{ version, roots: { world: 'layer-tree', player: 'player-space', characters: 'character-nook' } }`。当前没有消费者，故不纳入本轮实现、验收或 WS 契约；不得先建空 endpoint。[推断]

## 8. 错误边界

| 场景 | 应发生什么 | 漏掉会怎样 |
|---|---|---|
| `worldRoot` 不存在/不可读 | 沿现有 launch/store 错误边界失败；不回退到仓库根或 player Agent | Agent 读到另一世界文件，属于严重串档 |
| Agent 传绝对路径、反斜杠、`.`/`..`、隐藏段 | 让既有动作返回 `invalid_path`；instruction 不承诺“自动修正” | 相对路径语义与安全校验分叉，可能穿越 worldRoot |
| `map/README.md` | 视为错误文件路径；根层文件应为 `world/README.md` | 根初始化器产生不可见文件，入口仍读不到 |
| `layer: 'map'`（HTTP/事件） | 保留为虚拟层 id；入口代码映射至 `world/README.md` | 把 API 层身份改成文件路径后，`manifest.layers` 查找失败 |
| `player/` 作为 `move_to` 目的地 | 返回既有 scene-only 错误（`packages/shared/src/actions/presence.ts:155-163`） | 玩家背包被当成角色站立场景 |
| 公开 `GET /api/nook` 的四个根配置文件 | `items` 必须过滤 `README.md`、`identity.md`、`personality.md`、`memory.md`；过滤只作用于 public projection，Character preset 仍可读 | 配置泄露给真人页面，或错误地让 Agent 失去自身身份文件 |
| Character 根配置的 `write`/`edit`/`move`/`delete` | generic native `write/edit` 默认拒绝；唯一编辑入口为 `edit_character_config({ characterId, file, content, mode })`，Character 仅自身 memory，Writer 可编辑 `manifest.characters` 中任一已登记角色四项；move/delete 永久拒绝 | 统一受信 action 与动作门禁，不依赖模型传入的 configurationMaintenance | 任一入口漏接都会让配置可移动/删除或绕过 actor 矩阵 |
| brief 缺 `[Target Path]` | initializer 不猜路径，只在三行报告说明缺失；命令不应伪造替代目录 | 写入默认 cwd 或 world 根，污染错误位置 |
| brief 只有 `[Target Path] world` 没 `[Layer ID] map` | 实现阶段的回归失败；不得默默把 world 当 layer id | Agent 会在报告/API 里混用 `map` 与 `world` |
| 用户要求“玩家 Agent” | 说明 player 是真人/actor/目录，不启动模型；Writer 仍按 `[Player Request]` 处理 | 凭空创建不存在的会话、preset、cursor 或权限边界 |

## 9. 与现状差异

1. 当前四个 instruction 正文没有统一的 worldRoot/三根路径段；Writer 目前虽要求先打开 touched path（`extensions/instructions.ts:66-72`），但没有把 `world/`、`player/`、`characters/{id}/` 的根语义集中说明。
2. 当前 `SceneInitContext` 只有 `targetPath`，scene builder 输出 `[Target Path]`（`packages/shared/src/render/brief.ts:16-35`）；命令对 `map` 传入物理 `world` 目录（`extensions/toolkit/init-command.ts:286-295`），没有把虚拟 `map` 一并交给 initializer。[现状]
3. 当前 Nook initializer 正文仍写“character's intimate space or the player's personal stronghold”（`extensions/instructions.ts:283-288`），但命令的 nook 目录由 `nookIdOf(args.target)` 得到 `characters/{id}`，非法 id 在 spawn 前拒绝（`extensions/toolkit/init-command.ts:198-207`）。这是必须回写的旧文案，不是运行时兼容要求：本轮 `kind:nook` 只初始化角色 nook，绝不初始化 `player/` stronghold，也不创建 Player Agent。
4. 当前 Writer/Character session 复用与 `--continue` 机制不会因为源码 slot 文本改变而热刷新（`apps/server/src/engine/lifecycle.ts:168-207`、`apps/server/src/engine/launch.ts:100-129`）；本设计把重启作为静态 instruction 生效边界，不把动态 cache 当刷新机制。
5. 当前前端已有 `/api/manifest` 和静态“player/current place”文案（`apps/server/src/routes/world.ts:540-550`、`apps/web/src/App.tsx:608-611`），没有必要为路径解释新增 API/WS；本设计不建立 `PLAYER_INSTRUCTION` 的替代通道。

## 10. 可执行验收测试

以下测试应在实现阶段加入或扩展现有测试，不在本设计阶段执行。

### 10.1 brief 的非空性与 map 对照

1. 在现有 `packages/shared/test/` 的 brief 测试中调用 `buildSceneInitBrief({ layerId: 'map', targetPath: 'world', ... })`，断言同时包含 `[Layer ID] map` 与 `[Target Path] world`，且不包含 `map/README.md`。
2. 调用普通层 `layerId = targetPath = 'world/baker-street'`，断言两行都保留完整 `world/` 前缀。
3. 调用 `buildNookInitBrief({ characterId: 'watson', ... })`，断言只生成 `[Target Path] characters/watson`；没有可由调用方覆盖的任意 `path` 字段。
4. 反向非空性：在未实现 `[Layer ID]` 时，第 1 条必须失败；不能只断言 brief 非空，否则旧实现也会假绿。

### 10.2 slot 装配与 Player Agent 负断言

1. 扩展现有 `tools/probe-prompt.mjs` / `tools/probe-prompt-character.mjs`（仓库已有 `package.json:24-25`），启动真实 Writer/Character prompt，断言 system prompt 包含 `world/...`、`player/...`、`characters/<id>/...` 与“`map` is virtual”语义。
2. 断言 Writer/Character prompt 不包含 `PLAYER_INSTRUCTION`、`player-agent` 或任何声称 player 是模型角色的段落。
3. 用 `presets/*.json` 解析测试断言 slot 集合没有新增 player slot；scene/nook initializer 仍只有对应 instruction + skills（`presets/scene-init.json:26-36`、`presets/nook-init.json:26-36`）。
4. 真实 world-side character preset 选择路径覆盖：一个有 `characters/{id}/preset.json` 的角色和一个走仓库兜底的角色都能看到 `system-char`；缺 slot 的遗留 fixture 必须显式列入 allowlist，不能静默通过。
5. 调用 `/airp-init {"kind":"nook","target":"player",...}` 与 `target:"player/..."`，断言均在 spawn 前拒绝并不落初始化事件；调用合法 `target:"watson"` 才生成 `characters/watson` brief。该负断言用于防止旧 player stronghold 文案变成隐式运行时能力。

### 10.3 cwd、刷新与既有 session

1. 使用 launch spec 断言 Writer/Character 的 `spec.cwd === worldRoot`，且 env role 分别是 `writer` 与 `character:<id>`；断言不存在 player role。
2. 启动一个 Writer session，记录其 system prompt；修改 slot 源文本但不重启，下一轮仍应是旧静态文本；停止并重新启动后才应出现新路径段。此测试证明“缓存/既有 session 不热刷新”的边界，而不是只测新进程。
3. 在 Character 关闭/重新打开后重复第 2 条，确认新 Character client 拾取新 slot，且 `char-{id}.jsonl` 历史续接不会制造 player session。
4. 初始化器真实调用必须在 brief 中同时看到 `[Layer ID]`/`[Target Path]`，且子代理没有 state block 依赖；其成功/失败仍只出现既有 layer init 事件。

### 10.4 路径与前端边界

1. 对 `look_at`/写入动作覆盖 `map/README.md`、`/etc/passwd`、`world/../player/x.md`、`characters/Watson/README.md`，断言 `invalid_path` 或既有角色 id 错误；对合法 `world/README.md`、`player/x.md`、`characters/watson/README.md` 断言通过各自动作契约。
2. 对 `/api/enter-layer` 传 `map`，断言读取目标为 `world/README.md`；传 `world/baker-street`，断言仍按 layer id 处理，不把它解析为 `world/world/baker-street`。
3. 浏览器验收只检查现有 `/api/manifest`、现有 current-place 文案和可选静态 i18n 帮助文本；断言网络中没有新的 player WS frame，也没有绝对 `worldRoot` 泄漏到 DOM。
4. Nook projection fixture同时放置 `characters/watson/README.md`、`identity.md`、`personality.md`、`memory.md` 与一个生活文件，调用 `GET /api/nook?character=watson`，断言四个根配置均不在 `items`，生活文件仍在；同一 fixture 让 Character preset 的 file slot 读取四个配置，证明 public filter 不影响 Agent 自己的输入。
5. 对四个根配置分别调用 native `write`/`edit` 与 `move`/`delete`，断言四类 generic 入口均拒绝；再用受信 `edit_character_config({ characterId, file, content, mode })` 按 actor 矩阵测试允许项（Character 仅自身 memory，Writer 可编辑任一已登记角色四项）与拒绝项。四个文件各测一次，不能只测 `README.md`。
6. Character skill 装配使用未通过前门禁的角色路径时，断言不会把 skill 传入 Character prompt；通过前门禁后才可在 `skills` slot 看到 skill。该测试必须与 Character prompt 正/负断言同批落地。
7. `/api/layer` fixture 同时覆盖根 layer README、written child door、stub child door 与 authored opening：根 README `type:readme`；独立 child-door `type:gate`；stub 只带 `stub:true` 显示标记；新 opening 只接受 `01-opening.md`/`NN-opening.md`，不把旧 `opening.md`/`evening.md` 自动改名或当新 authored 文件。

## 11. 发现的冲突 / 需要回写的上位文档

1. **`docs/init/00-共同上下文.md:213-220` 与本文的 `SceneInitContext.layerId` 决定。** 上位 brief 接口当前只列 `targetPath`，没有可区分虚拟 `map` 的身份字段；实现迁移必须把它回写为必填 `layerId` + 物理 `targetPath` 两字段，并明确 root 例子是 `layerId: map, targetPath: world`。本篇只记录要求，不修改上位契约。
2. **`docs/init/02-brief与执行内核.md:36-44,107-112,147-153` 与本文的 scene 调用。** 该文当前描述 `targetPath` 和 map↔world 归一，但未要求 builder 输出 `[Layer ID]`；实现迁移必须同步签名、输出行、`buildSceneInitBrief({ layerId: layer, targetPath: dir, ... })` 与测试要求，否则旧文会继续产生第二份契约。本篇只记录要求，不修改上位文档。
3. **`docs/prompts/00-共同上下文.md:121-165` 与本文的路径段/无 Player slot。** 该文已经冻结四类 preset 的 slot 形状，但应补充“路径说明属于已有 writer/system-char/init slot，不新增 player slot；静态 slot 变更需重启 session”的引用，防止后续把路径说明放到不存在的 `system`/`PLAYER_INSTRUCTION`。
4. **`docs/prompts/01-作家提示词.md:49-55`、`docs/prompts/02-角色提示词.md:195-202` 与本设计的统一路径段。** 两份既有提示词设计已有“读真实内容”纪律但没有三根目录和 cwd 语义；应回写各自正文设计的段落边界，避免 `extensions/instructions.ts` 与提示词设计稿再次漂移。
5. **`extensions/instructions.ts:283-311` 与 `extensions/toolkit/init-command.ts:198-207` 的旧 player nook 表述冲突。** 旧 `NOOK_INIT_INSTRUCTION` 把 player's personal stronghold 与 character nook 并列，但本轮契约已经冻结 `kind:nook` 仅允许 `characters/{id}`；实现必须回写删除 player stronghold 语义，不能把旧句子当运行时支持，更不能为此创建 Player Agent。
6. **`apps/server/src/routes/world.ts:587-590`、`packages/shared/src/actions/canvas.ts:519-524` / `packages/shared/src/rules/characters.ts:55-69` 与新的公开 nook 投影契约。** 当前 helper 只排除 `README.md`；必须回写/实现四个根配置均不进入 public `items`，且所有 caller（读取与排布）继续共用迁移后的 `nookCardPaths`，同时保留 Character preset 的 Agent 可读性。
7. **`packages/shared/src/actions/chalk.ts:316-350`、`delete.ts:72-99,152-232`、`move.ts:73-100` 与新的统一配置门禁。** 当前已有 README/路径检查但不是四配置统一规则[推断]；必须由共享门禁同时约束 write/edit/move/delete，不能只改 instruction。
8. **Character skill 装配与前门禁。** `characterLaunch` 的 skill/extension 参数和 subagent effective tools 位于 `apps/server/src/engine/launch.ts:152-185`、`vendor/pi-rp/packages/coding-agent/src/core/subagent/prepare.ts:174-184`；必须先完成角色路径/权限前门禁，再让 skill 进入 Character prompt，否则本篇只能描述“尚未可见”，不能把 slot 当授权。
9. **`extensions/instructions.ts:253-265`、`apps/server/src/routes/world.ts:707-725` 与新 authored opening/child-door 类型契约。** 旧正文与合成 stub door 仍允许泛称 opening 或 `type:readme` child door；必须回写为新 authored opening 使用 `NN-opening.md`（首篇 `01-opening.md`），`opening.md` 仅 W2 fallback、`evening.md` 仅 legacy；layer-root README 为 `type:readme`，独立 child-door 为 `type:gate`，`stub:true` 只为显示标记。
10. **现有实现 `extensions/toolkit/init-command.ts:94-112` 与旧版 `docs/init/02-brief与执行内核.md:157-179` 的 `missingFilesFor` 形状存在已知差异。** 本文不改 missing-files 算法，但路径段落和 brief 回写时不得重新引入旧版 `baseDir/glob` 解释；如要修复，应由 init 设计文档单独认领。

## 12. 仍未知待拍板

1. **路径 instruction 是否需要把 `player/...` 的可用动作列全。** 本文只定义语义和边界；具体 `move`/`use_item_on`/`look_at` 用法仍归工具 description，避免静态 prompt 与动作契约重复。
2. **前端是否真的要展示路径帮助。** 推荐默认不展示、不新增 API；若用户测试证明真人需要，它应先确定放在 profile、help 或 nook 页面，再添加最小 i18n 文案，仍不得创建 Player Agent。
3. **世界侧遗留 character preset 的迁移窗口。** `characterLaunch` 会优先选世界侧 preset；缺 `system-char` 的遗留角色需要由装配/验证文档决定“本批迁移”还是显式 allowlist，不能由本篇路径设计静默修复。
4. **多 worldRoot 长生命周期进程的静态 prompt 隔离。** 当前 lifecycle 切 world 会停旧 client，context store 也按 cwd 重开；若未来一个进程同时 multiplex 多世界，必须新增按 session/world key 的静态 prompt 与 cache 隔离审计，本轮不提前扩展。
