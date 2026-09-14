# doc-tools/05 `move_to` 与 `set_following`：角色 presence 工具

> 状态：**设计（2026-09-12）**，待评审。本文只写设计，不改代码。
> 权威层级（`00-共同上下文.md` §0）：`00` > `doc-21`/`doc-22` > `doc-20` > `doc-10` > `doc-19` > 本文。
> 本文服从 `01-动作内核与事件落账.md` 冻结的 `ActionContext` / `ActionResult` / `ActionError` / 方法名（`moveCharacter` / `setFollowing`）；`MoveCharacterInput` / `SetFollowingInput` 的字段名与必选性**照 `01 §5` 表第 7/8 行逐字填形状，不增不改**。
>
> 关联：`doc-20 §4`（`move_to` 五种情形）、`§9`（`set_following`）、`§12`（UI 与 Agent 共用动作）、`doc-21 §4.2`（`character_moved` / `following_changed` `detail`）；`doc-05 §4.1.1`（角色 tab 三能力）、`§8.4`（`characters[].home`）；`doc-06 §2.5`（空位排座纪律）、`§5.4`（跟随的语义，逐条）；`doc-22 §3.1/§3.2`（`cast` / `standing` 节读 presence）、`§6`（presence 进 canvas.db）；`doc-19`（追光、在场感强度）；`00-文档骨架.md:67`（变更记录 #10）。
> 源码基线：`packages/shared/src/db/schema.ts:28-37`（`presence` 表）、`store/local-store.ts:14-46/291-415/478-491`（排座与碰撞）、`store/layers.ts:32-135`（`layerOfDir` / `layerOfPath`）、`store/world-store.ts:6-44`、`apps/server/src/routes/world.ts:128-235`（`/api/layer` 吐 presence）、`apps/web/src/state/useWorld.ts`（`LayerLink` / `PresenceEntry` / `LayerState.presence`）、`apps/web/src/components/sidebar/RightSidebar.tsx:105-171`、`apps/web/src/App.tsx:30/112-120/371-377`、`packages/shared/src/schemas/forms.ts:33`、`templates/holmes-world/**`。

---

## 1. 一句话与定位

**`move_to` 与 `set_following` 是唯一两个「改角色在场」的入口：它们只写 `canvas.db` 的 `presence` 一行，一个字节都不碰 `characters/<id>/`，也永不启动角色进程。**

`doc-20` 里的位置与三个调用者（`doc-20 §4` / `§9` / `§12`）：

| 工具 | doc-20 | 干什么 | 谁调 |
|---|---|---|---|
| `move_to` | §4 | 把某个角色的 presence 落到某层的一个空位 / 某个物件旁边 | 作家 agent（指定任意角色）、角色 agent（默认自己） |
| `set_following` | §9 | 翻转某个角色的同行状态 | 作家 agent、角色 agent（默认自己）、**玩家 UI 的「跟随」按钮**（`doc-06 §5.4`） |

**为什么这两个是同一篇**：它们写同一张表、同一行、同一套角色解析（`character?` 省略 = 自己）、同一套 `name` 读取与落账，且**跟随的存在意义就是让 `move_to` 的下一跳自动发生**（切层时跟着走）。分开写会复制四遍角色解析与理论。

**为什么不是 `move`**：`doc-20 §5` 末句「`move` 移动物件文件；`move_to` 移动角色 presence。两者不能合并。」——`move` 是文件语义（`fs.rename` + 引用重写），presence 是画布状态语义（一行 SQL）。混在一起会逼 `move` 对每个 `.md` 判断"这其实是个角色吗"，而角色根本没有可移动的实体文件。

**这一层最容易被写错的三件事**（本文 §3 的每一条都为此）：

1. 把「移动角色」写成「搬角色目录」——`doc-20 §4` 末句明文禁止；
2. 让 presence 排座与卡片排座共用一套占用域——两者的体积与不变量不同（§3.9）；
3. 把「跟随」写成一次性位置拷贝——`doc-05`/`doc-06`/`doc-00:67` 三处都写「跟随是**运行时状态**不是文件搬移；**切场景跟着来**」，跟随的兑现点在 `layer_entered`（§3.6.2）。

---

## 2. 签名与参数

### 2.1 动作层（`packages/shared/src/actions/`，形状由 `01 §2.6` 冻结）

```ts
// actions/move-to.ts
export interface MoveCharacterInput {
  /** 角色 id（`characters/<id>/`），不是路径。省略 = 自己（仅角色 agent 可用，§2.4）。 */
  character?: string;
  /** 层目录（`world/baker-street`）、当前层或别层的组件路径（`world/baker-street/fireplace.md`）。 */
  destination: string;
  /** 可选。目标层内的一个实体路径，落座吸附到它旁边（doc-20 §4 的"进入该层并靠近某物"）。 */
  near?: string;
}
export async function moveCharacter(
  ctx: ActionContext, input: MoveCharacterInput
): Promise<ActionResult<MoveCharacterDetails>>;

export interface MoveCharacterDetails {
  /** 稳定标识：角色 id。 */
  character: string;
  /** 角色显示名（`characters/<id>/README.md` 的 frontmatter `name`，§3.3）。 */
  name: string;
  /** 目标层 id（`map` / `world/baker-street`）。 */
  layer: string;
  /** 移动前所在层；角色此前无 presence 时为 undefined（**不是** `map`）。 */
  from?: string;
  /** 落座点（presence 的 x / y，世界坐标）。 */
  x: number;
  y: number;
  /** 生效的 `near`；未传或未生效时省略。 */
  near?: string;
  /** 本次是否真的改变了世界（false = 幂等 no-op，不落事件，§3.7）。 */
  moved: boolean;
  /** 落座格（Ulam 螺旋第几格）与尝试数，给探针/诊断，不进事件（01 §6.3 第 5 条）。 */
  seat: { gx: number; gy: number; tries: number; exhausted: boolean };
  /** `character_moved` 的 `event` 由包装层挂在 ActionResult 上（01 §2.2），不在 Details 里。 */
}

// actions/following.ts
export interface SetFollowingInput {
  character?: string;
  following: boolean;
}
export async function setFollowing(
  ctx: ActionContext, input: SetFollowingInput
): Promise<ActionResult<SetFollowingDetails>>;

export interface SetFollowingDetails {
  character: string;
  name: string;
  /** 写入后的状态（== 输入，回显给调用者做断言）。 */
  following: boolean;
  /** 角色此刻所在的层；此前无 presence 且本次是 `true` 时 = 落点层（§3.6）。 */
  layer: string;
  x: number;
  y: number;
  /** 本次是否真的改变了世界（false = 幂等 no-op，不落事件，§3.7）。 */
  changed: boolean;
  /** true = 该角色此前没有 presence 行，本次由 `set_following(true)` 新建（§3.6）。 */
  created: boolean;
  /** 无 presence 行时，落点是否直接来自 `world.json` 的 `home`（§3.6 的降级）。 */
  landedFromHome: boolean;
}

// actions/presence.ts —— 两个动作共用的 helper（不注册工具）
export interface PresenceRecord { characterId: string; layer: string; x: number; y: number; following: boolean; updatedAt: string }
export function resolveTargetCharacter(ctx: ActionContext, character?: string): Promise<string>;
export function readCharacterName(store: WorldStore, characterId: string): Promise<string>;
export function resolveDestinationLayer(store: WorldStore, destination: string): Promise<{ layer: string; kind: 'layer' | 'entity' }>;
export function assertNearInLayer(store: WorldStore, near: string, layer: string): Promise<void>;
/** `world.json` characters[].home → 落点层。缺 home / home 不在层树里 → `{layer:'map', fromHome:false}`。 */
export function resolveHome(store: WorldStore, characterId: string): Promise<{ layer: string; fromHome: boolean }>;
/** 搬运结果：成功移动的行 + 失败清单（REVIEW §5.5：失败必须可见，不静默）。 */
export function carryFollowers(
  ctx: ActionContext, toLayer: string
): Promise<{ moved: PresenceRecord[]; failures: Array<{ character: string; reason: string }> }>;
export function appendFollowingChanged(
  ctx: ActionContext, a: { character: string; name: string; following: boolean; layer: string | null }
): Promise<WorldEvent>;
```

**`seatPresence` / `upsertPresence` / `getPresence` / `getPresenceOf` 是 `WorldStore` 的方法，不是 `presence.ts` 的导出**（§3.9.2：放在 `local-store.ts` 里才能直接用私有的 `SEAT_MAX_CANDIDATES` / `spiralCells` / `overlapsOccupied` 与 `SEAT_STEP` / `SEAT_PAD`）。`presence.ts` 里的动作**调用** `ctx.store.seatPresence(...)`，不重新实现几何。`04` 的 `seatNear` 同例。它们的形状见 §8.2 的表。

`presence.ts` 是 `01 §2.1` 布局之外的**一个新增 helper 文件**（`01 §2.1` 只冻结了"每个动作一个文件"，没有禁止共享 helper；`02` 的 `frontmatter-builder` 同例）。它不注册任何工具，只被 `move-to.ts` / `following.ts` / `layer.ts` import。

### 2.2 工具面（`extensions/toolkit/`）

```ts
// extensions/toolkit/move-to.ts
pi.registerTool({
  name: 'move_to',
  label: 'Move To',
  description:
    'Move a character presence to a scene. destination may be a scene directory ' +
    '(world/baker-street), an entity path in the current scene, or an entity path in ' +
    'another scene (the engine derives its layer). Use `near` to make them walk up to a ' +
    'specific object. Writers must name `character`; a character defaults to moving itself. ' +
    'This only moves their presence on the canvas — it never moves files and never starts ' +
    'a character process.',
  parameters: Type.Object({
    character: Type.Optional(Type.String({ description: 'Character id, e.g. "watson". Omit to move yourself (character agents only).' })),
    destination: Type.String({ description: 'A scene directory ("world/baker-street") or an entity path ("world/baker-street/fireplace.md").' }),
    near: Type.Optional(Type.String({ description: 'An entity path in the destination scene to stand next to, e.g. "world/baker-street/fireplace.md".' })),
  }),
  promptSnippet: 'move_to(character?, destination, near?) — walk a character into a scene, next to an object or into a free spot',
  promptGuidelines: [
    'Use move_to when a character enters a scene or crosses to another one; never move a character with move (move is for object files).',
    'Use move_to with `near` to stage a character beside the object they are talking about.',
  ],
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    try { return ok(await serviceFor(ctx).moveCharacter({ character: params.character, destination: params.destination, near: params.near })); }
    catch (err) { if (err instanceof ActionError) return fail(err); throw err; }
  },
});

// extensions/toolkit/following.ts
pi.registerTool({
  name: 'set_following',
  label: 'Set Following',
  description:
    'Turn a character’s "follows you" state on or off. A following character travels with ' +
    'the player: when the player enters another scene, the character’s presence moves to ' +
    'that scene too. Following is a runtime state on the canvas — it never moves files and ' +
    'never starts a character process. Writers must name `character`.',
  parameters: Type.Object({
    character: Type.Optional(Type.String({ description: 'Character id, e.g. "watson". Omit to set your own state (character agents only).' })),
    following: Type.Boolean({ description: 'true = start following the player, false = stop.' }),
  }),
  promptSnippet: 'set_following(character?, following) — start or stop a character travelling with the player',
  promptGuidelines: [
    'Use set_following to record that a character agreed to come along (true) or left the party (false).',
    'Use move_to to place a character in a scene; set_following only flips the follow flag.',
  ],
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    try { return ok(await serviceFor(ctx).setFollowing({ character: params.character, following: params.following })); }
    catch (err) { if (err instanceof ActionError) return fail(err); throw err; }
  },
});
```

`serviceFor(ctx)` / `ok` / `fail` 是 `12` 的 `extensions/toolkit/{store,result}.ts`（`01 §8`）。**工具壳里没有一处业务判断**（`00 §8`）。

### 2.3 参数语义逐条

| 参数 | 类型 | 必需 | 语义 | 示例 |
|---|---|---|---|---|
| `character` | `string` | 否 | **角色 id**（`characters/<id>/` 的目录名），不是路径。省略 = 自己，仅当 `AIRP_AGENT_ROLE` 是 `character:<id>` 时成立（§2.4） | `"watson"` |
| `destination` | `string` | **是** | 三种情形合一：层目录 / 目标层组件路径 / 其他层组件路径（§3.2） | `"world/baker-street"`、`"world/baker-street/fireplace.md"` |
| `near` | `string` | 否 | 目标层内的**实体路径**（不是目录），落座吸附到它的卡片中心旁（§3.9） | `"world/baker-street/fireplace.md"` |
| `following` | `boolean` | **是** | 写入的终态，不是 toggle。`true` 覆盖「邀请同行 / 答应跟随」，`false` 覆盖「离开队伍 / 停止跟随」（`doc-20 §9`） | `true` |

**没有 `target` 参数**（`doc-20 §9` 明文）：MVP 的跟随目标固定为玩家。加 `target` 会立刻要求"跟随 A 但玩家在 B 层"的语义，而 `presence` 是单玩家世界的一张表（`doc-22 §6` 末条）。

**没有 `x` / `y` 参数**：坐标由引擎排座产生（`doc-22 §5` 第 3 条：坐标只供引擎排座，不灌给 agent）。让 agent 传坐标等于让它猜 960×540 锚点周围的空位。

### 2.4 `character` 省略的裁决：`AIRP_AGENT_ROLE` 是唯一身份源（任务点名）

`00 §3` 冻结：扩展侧知道自己是谁**只能**读 `AIRP_AGENT_ROLE`（`writer` / `character:<id>`，未设置则兜底 `writer` 并 stderr warn 一次）。`01 §2.3` 的 `resolveAgentActor` 把它映射成 `Actor`。

**陷阱**：`resolveAgentActor` 返回的 `Actor` 对 `writer` 是 `{type:'writer'}`（无 id），对 `character:watson` 是 `{type:'character', id:'watson'}`。所以「省略 = 自己」**不是** `character ?? ctx.actor.id` 一行——`ctx.actor.id` 在作家路径上是 `undefined`，写成 `??` 会静默变成一个 `undefined` 角色名，然后去查 `characters/undefined/`。

裁决（`resolveTargetCharacter`，纯解析 + 一次存在性校验）：

```ts
async function resolveTargetCharacter(ctx, character) {
  if (character !== undefined) {
    if (typeof character !== 'string' || character.trim() === '')
      fail('invalid_argument', `Character id must be a non-empty string, got ${JSON.stringify(character)}`);
    // id 必须是目录名，不是路径 / 不是 ../（00 §2.1、01 §7.3）
    if (character.includes('/') || character.includes('\\') || character.startsWith('.'))
      fail('invalid_argument', `Character must be a character id, not a path: "${character}"`);
    if (!(await store.listFiles(`characters/${character}`)).length)
      fail('not_found', `Character not found: "characters/${character}"`);
    const manifest = await store.getManifest();
    if (!manifest.characters.some((c) => c.id === character))
      warn(`character "${character}" has a directory but is not listed in world.json characters[]`);
    return character;
  }
  // 省略：只有角色 agent 能默认成自己
  if (ctx.actor.type === 'character' && ctx.actor.id) return ctx.actor.id;
  fail('invalid_argument',
    'move_to / set_following need an explicit "character" when the caller is not a character ' +
    `agent (AIRP_AGENT_ROLE=${JSON.stringify(process.env.AIRP_AGENT_ROLE ?? '')}). ` +
    'Writers and the player UI must name the character.');
}
```

三条纪律：

- **`manifest.characters` 与目录不一致时不拒绝**（目录在但 manifest 没列 → warn 后照做；`00 §8` 禁权限门禁，`doc-20 §1.1` "能力不按身份裁"）。反过来（manifest 列了但目录不存在）→ `not_found`，因为**在场以真实目录为准**。
- **`scene-init` / `nook-init` 子代理**看到的是 `writer`（`00 §3`：子代理继承父 env），所以它们**也必须显式给 `character`**——这正是它们要被拒绝的情形，且报错文案会把它引向正确做法。
- 同理，**C 入口（玩家 UI）必须显式给 `character`**（`POST /api/following` 的 body 里就有，§6.4）。

> 这条与 `03`（`look_at` 的"当前层"）是同一类问题的两半：`03` 需要"我在哪一层"、本文需要"我是谁"。两者都只有 `AIRP_AGENT_ROLE` 这一个来源，所以两处都会在 env 缺失时降级——`03` 降级成 `'map'`，本文**降级成报错**（因为"移动哪个角色"没有安全的默认值：移动错角色是可见的世界污染，而"看错层"只是看不到）。

---

## 3. 行为契约（逐步）

### 3.1 `move_to` 五步骨架（`01 §3.1` 的实例化）

| # | 步骤 | 漏了会怎样 |
|---|---|---|
| 1 | **解析 `character`**（§2.4）→ 得角色 id | 移动了一个 `undefined`，或作家静默移动了自己（它根本不在场） |
| 2 | **推导目标层**（§3.2）并校验 `destination` 存在 | 角色被"移到"一个不存在的层，presence 里出现一个永远渲染不出来的层 id |
| 3 | **校验 `near`**（§3.3）：存在、是实体、属于目标层 | 角色吸附到别的层的物件旁；或拿一个目录当锚点，排座从虚无开始 |
| 4 | **写 `presence`**（§3.4、§3.5、§3.9）：同层无 `near` 且已有行 → 不动；否则排座后 UPSERT | 每调一次 `move_to` 角色就在画布里乱跳（`doc-06 §2.5`「已摆放的永不重排」被破） |
| 5 | **落账 + 返回**：`character_moved`，`turn: ctx.turn`，`details.event` | 世界变了但作家/角色/历史面板都不知道（`doc-21 §1` 第三问判死） |

**全程不碰世界目录**：没有 `writeFile`、没有 `fs.rename`、没有 `characters/<id>/` 的任何写入（读只发生在**读** `README.md` 取 `name`）。`doc-20 §4` 末句「引擎只更新 `canvas.db` 的 presence，不移动 `characters/<id>/` 目录」是硬纪律。

### 3.2 `destination` 的三种情形：推导规则（任务点名）

`doc-20 §4` 逐字列了三种情形（目录 / 当前层组件 / 其他层组件）。推导表：

| # | 情形 | 判据 | 目标层 | 落座 |
|---|---|---|---|---|
| 1 | **层目录** | `destination` 指向 `world/` 下的一个目录（或字面量 `map`） | `layerOfDir(destination)`（`world` → `map`；`layers.ts:32-38`） | 空位（给了 `near` 则吸附） |
| 2 | **当前层组件** | `resolveLayer(destination) === 角色当前层` | 不变 | 吸附（`near` 隐式 = `destination`）或空位 |
| 3 | **其他层组件** | `resolveLayer(destination)` 是该组件所属层，且 ≠ 角色当前层 | `resolveLayer(destination)`——**先推所属层，再跨层落座** | 空位（给了 `near` 则吸附） |

```ts
async function resolveDestinationLayer(store, destination) {
  if (!destination) fail('invalid_argument', 'destination must not be empty');
  const norm = normalizePath(destination);                          // 00 §2.1 的路径纪律（01 §3.1 第 1 步）
  if (norm === MAP_LAYER) return { layer: MAP_LAYER, kind: 'layer' };   // 层 id 也可作 destination（见下）
  const kind = await store.statKind(norm);                          // 'file' | 'dir' | 'missing'（03 §14 冲突 1 请求冻结）
  if (kind === 'dir') {
    const layers = (await store.getManifest()).layers;
    const id = layerOfDir(norm);                                    // 'world' → 'map'；其余 = 目录路径本身
    if (!layers[id]) fail('not_found', `Destination is a directory but not a scene: "${destination}"`);
    return { layer: id, kind: 'layer' };
  }
  if (kind === 'missing') fail('not_found', `Destination not found: "${destination}"`);
  // 是一个文件：必须落在层树里（world/**）
  const layer = await store.resolveLayer(norm);                     // layers.ts::layerOfPath（01 §2.7）
  if (layer === null)
    fail('invalid_argument',
      `Destination must be a scene directory or an entity inside world/: "${destination}" ` +
      '(player/ and characters/<id>/ are not scenes)');
  return { layer, kind: 'entity' };
}
```

四条要点：

- **`map` 这个层 id 必须接受**。`presence.layer` 存的就是 `map`（`layers.ts:27`），而读回 presence 的调用者（或玩家从 presence 推出的路径）会拿它再调一次 `move_to`。只接受 `world` 会让"回退到大地图"变成一次猜谜。两种写法落到同一个 `map`。
- **`destination` 是文件但在保留前缀下**（如 `.airpworld/assets/x.png`）：`resolvePath` 的保留前缀检查先把它挡成 `invalid_path`（`01 §7.3`），不必单写一条。
- **`destination` = `player/coffee-key.md`**：`resolveLayer` 返回 `null` → `invalid_argument`。角色**不能站在背包里**；`doc-22 §3.2` 明写"玩家的口袋不在角色的视野里"，且 `player/` 不是层——presence 落进去在画布上无处渲染。`characters/watson/letter.md` 同理。
- **`destination` 是 stub 层目录**（目录在、无 README）：**允许**。`deriveLayers` 给 stub 层也建条目（`layers.ts:69-76`），角色当然可以走进一个还没被走出来的场景（`doc-11 §3`：门存在，场景未写）。这是正例，不是边界。

### 3.3 `near` 的校验（与 `04` 逐条对齐，已互相确认）

| 检查 | 结果 |
|---|---|
| `near` 不存在 | `not_found`：`near not found: "world/baker-street/fireplace.md"` |
| `near` 是层目录 | `near_out_of_layer`：`near must be an entity path, not a layer directory: "world/baker-street"` |
| `near` 属于其他层（`resolveLayer(near) !== 目标层`） | `near_out_of_layer`：`near "world/other/x.md" is not in the destination layer "world/baker-street"` |

与 `04 §2.3` 的三条口径**逐字一致**（同 code、同文案形状），这是两篇文档里的同一个概念，不能各写一套。

**`near` 与 `destination` 的关系**：`near` 优先。`near` 给了就以它为锚点，**且它的层就是目标层**——若两者冲突，报 `near_out_of_layer` 而不是让 `destination` 赢。静默让 `destination` 赢会让作家以为角色站在壁炉边、实际站在别处。若 `destination` 是组件路径而 `near` 省略，则 **`near` 隐式等于 `destination`**（"走进这层，靠近这个东西"是同一意图的两种写法，`doc-20 §4` 第三种情形正是「先推导所属层，再完成跨层移动和附近排座」）。

### 3.4 写 `presence`：一条 UPSERT，一个自然键（任务点名：`presence` 表现状够不够）

现状（`db/schema.ts:28-37`）：

```sql
CREATE TABLE IF NOT EXISTS presence (
  id TEXT PRIMARY KEY, character_id TEXT NOT NULL, layer TEXT NOT NULL,
  x REAL NOT NULL DEFAULT 0, y REAL NOT NULL DEFAULT 0,
  following INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
);
```

**评估（任务点名的三问）**：

| 问题 | 现状 | 裁决 |
|---|---|---|
| **角色 id 是主键吗？** | 不是。`id` 是主键，`character_id` 只是普通列，**且无 UNIQUE 约束** | **给 `character_id` 加 UNIQUE**。否则同一角色可以有两行（不同层各一行），"他在哪"变成一组答案：作者一次 `move_to` 写一行、旧路径再写一行，画布上就出现两个 Watson |
| **一个角色能同时在多层吗？** | 表结构允许 | **不能**。`doc-06 §5.4` 的角色 tab 导航是「跳到**该角色所在**的场景」（单数），遮罩是「在角色**当前所在**场景」（单数）；两行会让 Locate 与 Talk 都变成掷硬币。切层的正确表达是**移动那一行**（§3.6），不是新增一行 |
| **`id` 列还有用吗？** | `PRIMARY KEY`，但**全仓库没有任何写入点**（`grep -rn "INTO presence"` 零命中；`templates/holmes-world/.airpworld/canvas.db` 的 presence 是 `[]`） | **保留 `id` 作 PK**（改 PK 要重建表，收益为零），值由引擎确定性地给 `presence:<characterId>`——**不用 `randomUUID`**：确定性 id 让 UPSERT 天然幂等、让 `presence:watson` 在 SQLite 里可直接查、让快照 diff 可读。业务键由 UNIQUE 保证 |
| 缺索引 | 无 | 加 `idx_presence_layer ON presence(layer)`——`/api/layer?layer=`（`world.ts:221`）与 `seatPresence` 的占用查询都按层读全量 |
| 缺 `name`？ | 无 | **不加**。名字从 `characters/<id>/README.md` 的 frontmatter `name` 现读（模板里确实有：`characters/watson/README.md` 的 `name: Watson`）。落进表就是第二份真相，角色改名后画布上挂着旧名 |
| 缺 `w` / `h`？ | 无 | **不加**。presence 是一个**点**（`doc-22 §6` 把"角色 presence"与"卡片坐标"并列）；渲染体积是纯函数 `CARD_FORMS.sprite`（`forms.ts:33`，176×196），引擎排座时现取（§3.9） |

**改动后的 DDL**（`01 §8.1` 的 `DROP TABLE` 前例适用：世界目录还没有真实存档，`00 §5.1`/`doc-21 §7` 都明写"直接改 `CREATE TABLE`，不写迁移脚本"）：

```sql
DROP TABLE IF EXISTS presence;
CREATE TABLE presence (
  id           TEXT PRIMARY KEY,            -- 'presence:<characterId>'，确定性、幂等
  character_id TEXT NOT NULL UNIQUE,        -- 一个角色只有一行 = 一个行踪
  layer        TEXT NOT NULL,               -- 层 id：'map' | 'world/baker-street'
  x            REAL NOT NULL DEFAULT 0,     -- 世界坐标（presence 的中心点）
  y            REAL NOT NULL DEFAULT 0,
  following    INTEGER NOT NULL DEFAULT 0,  -- 0/1（sqlite 无 bool）
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_presence_layer ON presence(layer);
```

> **`DROP TABLE IF EXISTS presence` 的取舍**：与 `events` 同理（`01 §8.1`）——这张表在真实世界（`templates/holmes-world`）里是**空的**，没有任何可失数据；而 `CREATE TABLE IF NOT EXISTS` 加约束永远不会生效。评审若要求保留开发库，改法是 `ALTER TABLE presence RENAME TO presence_legacy_b0`。

**写入**（`presence.ts::upsertPresence`）：

```ts
async function upsertPresence(store, p: { characterId; layer; x; y; following? }): Promise<PresenceRecord> {
  const now = new Date().toISOString();
  const keepFollowing = p.following === undefined;
  store.execCanvas(
    keepFollowing
      ? `INSERT INTO presence (id, character_id, layer, x, y, following, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?)
         ON CONFLICT(character_id) DO UPDATE SET layer = excluded.layer, x = excluded.x, y = excluded.y, updated_at = excluded.updated_at`
      : `INSERT INTO presence (id, character_id, layer, x, y, following, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(character_id) DO UPDATE SET layer = excluded.layer, x = excluded.x, y = excluded.y, following = excluded.following, updated_at = excluded.updated_at`,
    keepFollowing
      ? [`presence:${p.characterId}`, p.characterId, p.layer, p.x, p.y, now]
      : [`presence:${p.characterId}`, p.characterId, p.layer, p.x, p.y, p.following ? 1 : 0, now]
  );
  return (await getPresenceOf(store, p.characterId))!;
}
```

- **`following` 省略 = 保持原值**：这是 `move_to` 的关键——移动**不能**顺手清掉跟随标记（跟随中的角色被 `move_to` 挪一下就会退队，是最容易漏的一条）。
- **`ON CONFLICT(character_id)`** 依赖上一条 UNIQUE 约束；没有它这条 UPSERT 会在第二行静默插入。**约束与 UPSERT 是一对，不能只做一半。**
- 单语句，天然原子（`01 §10.1` 的"单语句 UPSERT"，与 `linkCards`/`arrangeCards` 同格）。
- **不加锁、不做事务包**：动作层不加锁是 `01 §7.3` 的定案（后写者赢）。

### 3.5 `move_to` 的完整判定（含"同层不重排"）

```ts
async function moveCharacter(ctx, input) {
  const character = await resolveTargetCharacter(ctx, input.character);          // §2.4
  const dest = await resolveDestinationLayer(ctx.store, input.destination);      // §3.2
  const current = await getPresenceOf(ctx.store, character);                     // 可能为 null
  const near = input.near ?? (dest.kind === 'entity' ? normalizePath(input.destination) : undefined);
  if (near) await assertNearInLayer(ctx.store, near, dest.layer);                // §3.3
  const name = await readCharacterName(ctx.store, character);                    // §3.3 名字来源

  // ── 幂等：已在目标层 && 没有要求吸附 → 不动（doc-06 §2.5「已摆放的永不重排」）
  if (current && current.layer === dest.layer && !near) {
    return { text: `${name} is already in "${layerName}".`,
             details: { character, name, layer: dest.layer, x: current.x, y: current.y, moved: false,
                        seat: { gx: 0, gy: 0, tries: 0, exhausted: false } } };
  }

  const seat = await seatPresence(ctx.store, dest.layer, { near, excludeCharacter: character });  // §3.9
  await upsertPresence(ctx.store, { characterId: character, layer: dest.layer, x: seat.x, y: seat.y });
  //                                 ↑ following 省略 = 保持（§3.4）

  const event = await ctx.store.appendEvent({                                   // §5
    type: 'character_moved', actor: ctx.actor, turn: ctx.turn,
    subject: dirOfLayer(dest.layer), layer: dest.layer,
    detail: { character, name,
              ...(current ? { from: current.layer } : {}),                       // 首次入场省略 from
              to: dest.layer,
              ...(near ? { near } : {}) },
  });
  return { text: ..., details: { character, name, layer: dest.layer, ...(current ? { from: current.layer } : {}),
                                 x: seat.x, y: seat.y, ...(near ? { near } : {}), moved: true, seat: seat.seat, event } };
}
```

**为什么"同层 + 无 `near`"是 no-op 而不是重排**：`doc-06 §2.5` 是画布级纪律（"只给没有坐标的新物件排落脚点，已摆放的永不重排"），而 `move_to` 无 `near` 的落座锚点是全局 `SEAT_ANCHOR`——若允许重排，作家为了"让 Watson 在场"调一次 `move_to(watson, 'world/baker-street')`，就会把已经站在壁炉边聊了三轮的 Watson 拽回画面中央。**"他在不在场"与"他站在哪"是两个问题，前者由层决定、后者由 `near` 决定。**

**"同层 + 有 `near`"是真实移动**：这是显式要求"挪到那个东西旁边"，落座点必然变（锚点从 `SEAT_ANCHOR` 换成锚卡片中心），落事件。

**`from` 只在真跨层时出现**：`detail.from` 是 optional（`00 §5.2`），首次入场（无 presence 行）**省略** `from` 而不是填 `map`——填 `map` 是假话（他此前不在任何层），且会让渲染器说出「从大地图走到 Baker Street」。角色 tab 的"未在场"是合法状态（`doc-06 §5.4` 末条：「若角色当前未在场……点导航提示"ta 此刻不在这里"」）。

### 3.6 `set_following` 的完整判定与跨层跟移动（任务点名）

**运行时语义（`doc-05`/`doc-06`/`doc-00:67` 三处一致，逐条落成不变量）**：

1. **跟随是运行时在场状态，不是文件搬移**（`doc-06 §5.4`：角色目录不移动，只是"此刻他在你身边"）→ `characters/<id>/` 永不移动，跟随前后目录字节相同；
2. **跟随不启动进程**（`doc-06 §5.4`：跟随只是"在场"，被点击聊天时才 spawn agent）→ `set_following` 里没有 `spawn` / `prompt`；
3. **切场景跟着来**（`doc-05 §4.1.1`：切换场景时系统把角色在场位置顺延到新层）→ 兑现点是 `layer_entered`（§3.6.2）；
4. **作家可感知**（`doc-06 §5.4`：叙事回应"老周跟着你进了城"）→ 每次状态翻转落一条 `following_changed`；每次跟随移动落 `character_moved`（§5）。

#### 3.6.1 `set_following` 逐步

```ts
async function setFollowing(ctx, input) {
  const character = await resolveTargetCharacter(ctx, input.character);            // §2.4
  const current = await getPresenceOf(ctx.store, character);
  const name = await readCharacterName(ctx.store, character);

  // ── 无 presence 行：只有 following=true 时才"把人放进世界"
  if (!current) {
    if (!input.following) {
      // 幂等 no-op：他本来就不在场、也没在跟随（与 doc-21 §1 准入第 1 问一致：世界没变 → 不落账）
      // **不写 world**：不调 upsertPresence，presence 里不会凭空多出一行 (0,0) 的幽灵头像（REVIEW M-3）。
      // `layer` 只是回显兜底（无 presence 行 → 画布上不渲染任何东西），不代表他此刻在 map。
      return { text: `${name} is not following you.`,
               details: { character, name, following: false, layer: MAP_LAYER,
                          x: 0, y: 0, changed: false, created: false, landedFromHome: false } };
    }
    const home = await resolveHome(ctx.store, character);                          // world.json characters[].home
    const seat = await seatPresence(ctx.store, home.layer, { excludeCharacter: character });
    await upsertPresence(ctx.store, { characterId: character, layer: home.layer, x: seat.x, y: seat.y, following: true });
    const event = await appendFollowingChanged(ctx, { character, name, following: true, layer: home.layer });
    // … 一条 following_changed（§5）；不额外落 character_moved（理由见下）
    return { text: ..., details: { ..., layer: home.layer, x: seat.x, y: seat.y, changed: true, created: true,
                                   landedFromHome: home.fromHome, event } };
  }

  // ── 已有行：只翻转 following，**不动坐标、不动层**（这是"跟随"不是"移动"）
  if (current.following === input.following) {
    return { text: `${name} is already ${input.following ? '' : 'not '}following you.`,
             details: { character, name, following: input.following, layer: current.layer,
                        x: current.x, y: current.y, changed: false, created: false, landedFromHome: false } };
  }
  const row = await upsertPresence(ctx.store, { characterId: character, layer: current.layer, x: current.x, y: current.y, following: input.following });
  const event = await appendFollowingChanged(ctx, { character, name, following: input.following, layer: current.layer });
  return { text: ..., details: { ..., changed: true, created: false, landedFromHome: false, event } };
}
```

四条裁决：

- **`set_following` 永不改坐标**。要改位置是 `move_to` 的事（`doc-20 §9` 只说"工具更新 presence 的 `following`"）。这条守住了两个工具的分工，也让「跟随」在 UI 上是一个纯开关（`RightSidebar.tsx:155-166` 的按钮）。
- **`set_following(false)` 对不在场的角色是 no-op**→ 不落事件。世界没有变化（`doc-21 §1` 准入第 1 问）；若落一条，`cast` 节（`doc-22 §3.1`）会念出一个压根不在场的人。
- **`set_following(true)` 对无 presence 行的角色会"凭空入场"**，落点是 `world.json` 的 `characters[].home`（`doc-05 §8.4`：`home` = 初始所在层 key，明确写了「角色 tab 导航 / 跟随的起点」）。这条是必须的：角色 tab 里点「跟随」的玩家，面对的很可能是**从没被安排过位置的布景头像**（`doc-00:60` 变更 #2：没点开就是布景头像）。若不落点，`following=true` 会写在一行不存在的行上（或 `layer` 为空），而 `layer_entered` 的跟随后续（§3.6.2）下次才补——中间那一帧画布上什么都没多出来，"点了跟没反应"。
  - `home` 缺失或不在层树里 → **降级到 `map`**（`landedFromHome: false` + `console.warn`）。`map` 是唯一永远存在的层（`layers.ts:27`）。这条与 `03 §15 未知 1` 的兜底同源。
  - **只落一条 `following_changed`，不额外落 `character_moved`**：这是**同一次用户动作**（点一次「跟随」），落两条会在 `doc-21 §5.4` 的合并里变成两句人话（"老周开始跟着你走" + "老周走到地图去了"），且第二句是纯噪声。`following_changed.detail` 不带位置，**位置在 `details` 里给前端**（§6.1）。
- **`following_changed.detail` 的字段名锁死为 `{ character, name, following }`**（`00 §5.2` / `doc-21 §4.2`），**不加 `layer`**——`detail` 要自足是指"渲染人话时不必回读世界目录"，而这句话（"老周开始跟着玩家走"）本来就不含位置。加 `layer` 会与 `00 §5.2` 的冻结字段名表冲突（评审门第 2 条）。

#### 3.6.2 跨层跟移动：`layer_entered` 是兑现点

**触发链**（三步，全在 server 侧或动作层，无新进程）：

```
玩家点门牌 / 双击子场景卡（App.tsx:123-125 handleEnterGate → enterLayer）
  → POST /api/enter-layer { layer }                       (12 §2.4)
    → serviceFor(store, {type:'player'}).enterLayer({ layer })   (11/12 的 enterLayer)
      1. appendEvent('layer_entered', …)                  ← 已归 11/12
      2. carryFollowers(ctx, layer)                       ← ★ 本文新增，见下
    → eventBridge 尾部读表 → world_event × N（1 条 layer_entered + M 条 character_moved）
    → 前端 useWorld 收 world_event → 整层重取 /api/layer → presence 里有跟随者 → 头像出现
```

```ts
/** 把每一个「跟随中」的角色搬到玩家刚进入的层。返回成功移动的行 + 失败清单（0..n）。 */
async function carryFollowers(
  ctx: ActionContext, toLayer: string
): Promise<{ moved: PresenceRecord[]; failures: Array<{ character: string; reason: string }> }> {
  const followers = (await getPresence(ctx.store, undefined))            // 全层
    .filter((p) => p.following && p.layer !== toLayer);                  // 已在目标层的不动
  const moved: PresenceRecord[] = [];
  const failures: Array<{ character: string; reason: string }> = [];
  for (const f of followers) {
    try {
      const seat = await seatPresence(ctx.store, toLayer, { excludeCharacter: f.characterId });
      // 注意：每个跟随者都要 exclude 自己（正在离开旧座位），且此前落座者已进 occupancy
      const row = await upsertPresence(ctx.store, { characterId: f.characterId, layer: toLayer,
                                                    x: seat.x, y: seat.y });   // following 保持 true
      await ctx.store.appendEvent({
        type: 'character_moved', actor: { type: 'engine' }, turn: ctx.turn,
        subject: dirOfLayer(toLayer), layer: toLayer,
        detail: { character: f.characterId, name: await readCharacterName(ctx.store, f.characterId),
                  from: f.layer, to: toLayer },                            // 跨层 → 带 from
      });
      moved.push(row);
    } catch (e) {
      // 失败必须可见（REVIEW §5.5）：一人跟丢不阻止其余人跟上，但不能静默——记进 failures，
      // 由 `enterLayer` 随 `details` 上抛（console.warn 只作补充，不做唯一出口）。
      failures.push({ character: f.characterId, reason: e instanceof Error ? e.message : String(e) });
    }
  }
  return { moved, failures };
}
```

**`actor` 用 `{type:'engine'}` 还是 `{type:'player'}`？** 用 **`engine`**。理由：`doc-21 §3.2` 给 `engine` 的定义是「没有人类或 agent 发起的事件：初始化超时兜底、快照、回滚」。跟随移动**是玩家点门牌的副产物**，但玩家并没有"移动角色"这个意图——他移动的是自己。记 `player` 会让历史面板与作家读到"玩家把老周移到了 Crime Scene"，而玩家做的是"走进了 Crime Scene"。`engine` + `detail.to` 让渲染器说出正确的话：「老周跟着你进了 Crime Scene」。**这是一条准确的区分，不是分类癖。**

> 反方意见（登记评审）：`engine` 的既有例子都是"系统自己决定"。若评审认为跟随是玩家的间接意图，改成 `player` 只需改这一个字面量，但渲染模板要跟着改（`doc-21 §4.2` 的模板表里 `character_moved` 现在写的是「老周走到壁炉边去了」，对跟随者要说成「跟着你进了……」——**两张模板**，建议按 `detail.from` 是否存在 + `actor.type === 'engine'` 分派）。

**三个必须守的细节**：

1. **`following` 字段在搬运时保持不变**（`upsertPresence` 省略 `following` = 保留，§3.4）。写成 `following: true` 也能跑，但一旦将来加"跟随 A"就会静默把它改回 true；省略是**声明式的"不碰这一列"**。
2. **已经在目标层的跟随者不移动、不落账**（`p.layer !== toLayer` 过滤）。玩家反复进出同一层时，`layer_entered` 每次都落（那是视点变化），但跟随者只动一次。
3. **`carryFollowers` 在 `enterLayer` 落账之后、同一个 `turn` 里调用**（`01 §3.7` 的 C 入口 `turn: req:<uuid>`）。这样 `layer_entered` 与 M 条 `character_moved` 共享 `turn`，而合并规则（`doc-21 §5.4` 第 1 条：同 `turn` + 同 `type` + 同 `actor`）**不会**把它们并成一句（type 不同），但历史面板能把它们归进同一次换场。**顺序不能反**：先落 `layer_entered` 再搬人，作家读到的是"玩家进了 X，老周跟来了"；反了会读成"老周先到了 X，然后玩家进来"。

**这一条为什么放在本文而不是 `11`/`12`**：`carryFollowers` 的每一行都是 presence 语义（谁算"跟随中"、落哪、占位怎么算、`following` 列不动），而这些是本文的域。`11`/`12` 的 `enterLayer` 只**调**它（`presence.ts` 导出），不重新实现。

### 3.7 幂等与 no-op：什么时候不落事件

`doc-21 §1` 准入第 1 问（"它改变了世界吗？"）在两个工具上都要求显式的 no-op 分支：

| 调用 | 结果 |
|---|---|
| `move_to(watson, 'world/baker-street')`，watson 已在 baker-street 且无 `near` | `moved: false`，**不落账**，文本 `Watson is already in "Baker Street".` |
| `set_following(watson, true)`，watson 已 `following=1` | `changed: false`，**不落账** |
| `set_following(watson, false)`，watson 无 presence 行 | `changed: false`，**不落账**（且不改 world：§3.6.1 的 no-op 分支直接返回，**不写 presence 行**，REVIEW M-3） |
| `move_to(watson, 'world/baker-street/fireplace.md')`，watson 已在 baker-street 的壁炉边**且落座点不变** | `moved: true`，**落账**（算了座位，即使算出来是同一个点——"我确认你站在那"是真实意图，且判定"座位没变"要多比较一次浮点，不值） |

**为什么 no-op 也要有返回值而不是报错**：agent 在 prompt 里写的多是"确保 Watson 在 baker-street"，报错会让它以为失败并重试/换写法。返回文本说清现状（`already` + 位置）是最省 token 的正确反馈。

### 3.8 边界：进程、存在性、错误路径（任务点名）

| 边界 | 行为 | 依据 |
|---|---|---|
| **移动不存在的角色** | `not_found`：`Character not found: "characters/sherlock"` | §2.4：以 `characters/<id>/` 目录为真相 |
| **移动到不存在的层** | `not_found`：`Destination not found: "world/nowhere"` | §3.2 |
| **移动到 `player/` 或 `characters/`** | `invalid_argument`：`Destination must be a scene directory or an entity inside world/: "player/key.md"` | §3.2：不是层 |
| **`near` 越层 / 是目录** | `near_out_of_layer` | §3.3，与 `04` 同口径 |
| **角色进程没起来** | **照常成功** | 见下 |
| **`destination` = 角色自己的小天地（`characters/watson`）** | `invalid_argument`（同上，不是层） | `doc-05 §4.1`：小天地是目录不是布景，角色不在画布上"站"在自己家里 |
| **角色 id 目录存在但 `world.json` 没列** | warn 后**照常成功** | §2.4：`doc-20 §1.1` 能力不按身份裁；warn 让作者发现 manifest 漏了 |
| **`world.json` 列了但目录不存在** | `not_found` | §2.4 |
| **同一角色并发两次 `move_to`** | 后写者赢，两次都落账（各一条 `character_moved`） | `01 §7.3`：动作层不加锁；WAL 保证不出现半截行 |
| **`appendEvent` 失败（presence 已写）** | `event_failed`，**不回滚 presence** | `01 §3.6`：明确定案"不补偿、不回滚"。文案 `Character "watson" moved to "world/baker-street" but the world event could not be recorded: <err>` |
| **排座 600 格耗尽** | **不抛错**，warn + 落最后一格 | §3.9；`no_free_seat` 因此**不被 05 使用**（与 `04 §7.1` 一致：排座失败不失败整个动作） |

**「角色进程没起来能不能移动」= 能，且这是设计而非容忍**（任务点名）：

- presence 是 **`canvas.db` 的状态**（`doc-22 §6`：属于世界、进存档、跟着快照回滚），与 agent 进程**没有任何关系**——角色进程的存在只决定"他能不能自己思考与行动"，不决定"他在不在场"（`doc-00:60` 变更 #2：没点开就是布景头像，但他仍然站在画布上）；
- `move_to` 的实现里因此**没有一处** `lifecycle` / `spawnAgent` / `getCharacter` 调用（对比 `doc-20 §9` 明写 `set_following`"也不启动角色进程"）；
- 反过来验证：`apps/server/src/engine/lifecycle.ts` 只管角色会话的起停，**它不读也不写 `presence`**——两条路径今天就没有交点，本文保持这一点。

**`doc-19` 的强度要求不必为此改动**：跟随者被点开聊天时才 spawn（`doc-06 §5.4`），而"追光/在场感"是渲染层的事（`doc-19:223` 的 Dramatic Spotlight），由前端按 `presence` 画，不需要进程在线。真正的多模态增量（呼吸动效、表情差分）在遮罩里，属角色会话域。

### 3.9 空位求取：复用还是独立（任务点名）

**结论：不复用卡片排座，独立一套 `seatPresence`；但复用「算法形状 + 常量」。**

#### 3.9.1 为什么不能直接复用 `seatUnplaced`

`seatUnplaced(layerId, files)`（`local-store.ts:291-357`）的入参是 `SeatFile[]`（`{path, w?, h?}`），产出一张张 `cards` 行。它做不了 presence 的三件事：

1. **它的占用域只有 `cards`**（`local-store.ts:312-316`：`existing.map(...)`）。presence 必须**同时**避开同层卡片与同层其他角色——否则 Watson 会站在柜台的卡片上。
2. **它的锚点写死为 `SEAT_ANCHOR`**（`local-store.ts:322-329`）。presence 需要"从锚卡片中心起螺旋"（`near`）。
3. **它写 `cards` 表**。presence 要写 `presence` 表，且不能建 z_index / 不能触发 `reseatLayer`。

更根本的一点：**两者的"不变量"不同**。卡片排座的不变量是"卡片的 footprint（`cardFormOf`）之间不重叠"；presence 的不变量是"角色中心点之间不挤在一起、且不压在卡片上"。**共用函数只有两条路**——加 `isCard|isPresence` 分支（`04 §3.9.3` 已否决），或把签名降到最小公倍数（丢掉 `near` 锚点或丢掉存在的占用域）。两条都比多写一个 30 行的函数更贵。

#### 3.9.2 复用哪些（唯一真相源仍是那组常量）

从 `local-store.ts:14-46` 复用（**import，不复制**）：

| 复用 | 值 / 位置 | 为什么必须同源 |
|---|---|---|
| `spiralCells()` | `local-store.ts:23-46`，Ulam 螺旋 R→D→L→U | 座位网格与卡片是同一张纸；两套螺旋会长出互相穿插的座位 |
| `SEAT_STEP` | `96`（`local-store.ts:16`） | 同上 |
| `SEAT_PAD` | `22`（`local-store.ts:18`） | 碰撞间隙尺度必须一致 |
| `SEAT_MAX_CANDIDATES` | `600`（`local-store.ts:20`，现为模块私有，**需要导出或把 `seatPresence` 放进同一个模块**） | 兜底行为一致 |
| 碰撞判据 | `overlapsOccupied`（`local-store.ts:478-491`）的"中心距 < 半宽和 + PAD" | 同一个几何判定 |
| presence 体积 | `CARD_FORMS.sprite` = `{w:176, h:196}`（`forms.ts:33`） | 排座用的体积必须等于前端实际渲染的 halo 体积，否则视觉上仍然重叠 |

> **`SEAT_MAX_CANDIDATES` 的可见性**：它是模块私有常量。最小改动是**让 `seatPresence` 也住在 `local-store.ts`**（与 `seatUnplaced` / `reseatLayer` 并列，作为 `WorldStore` 的第 4 个排座方法），这样四个常量直接可用、不放宽模块边界。**本文取这个方案**（`01 §2.7` 的新增清单需要补一行 `seatPresence`，与 `04` 补 `seatNear` 同例）。

#### 3.9.3 算法

```ts
// local-store.ts —— 第 4 个排座方法（与 seatUnplaced / reseatLayer / seatNear 并列）
async seatPresence(
  layerId: string,
  opts: { near?: string; excludeCharacter?: string } = {}
): Promise<{ x: number; y: number; seat: { gx: number; gy: number; tries: number; exhausted: boolean } }> {
  const { w, h } = CARD_FORMS.sprite;                        // 176 × 196（forms.ts:33）
  // 占用域 = 该层的卡片行 ∪ 该层的 presence 行（排除自己：同层移动时旧座位必须让出来）
  const cards = this.queryCanvas(
    'SELECT x, y, width, height FROM cards WHERE layer = ?', [layerId]
  ).map((r) => ({ cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: r.width, h: r.height }));
  const pres = this.queryCanvas(
    `SELECT x, y FROM presence WHERE layer = ?${opts.excludeCharacter ? ' AND character_id != ?' : ''}`,
    opts.excludeCharacter ? [layerId, opts.excludeCharacter] : [layerId]
  ).map((r) => ({ cx: r.x, cy: r.y, w, h }));

  // 锚点：near 卡片的中心（该卡片无行时先给它排座再拿它当锚，同 04 §3.9.3）；
  // 否则全局 SEAT_ANCHOR。
  const anchor = opts.near ? await this.anchorOf(layerId, opts.near) : SEAT_ANCHOR;

  const occupied = [...cards, ...pres];
  let tries = 0, last = { x: anchor.x, y: anchor.y };
  for (const [gx, gy] of spiralCells()) {
    // 第 0 格 = 锚点本身：near 的锚点格留给锚（那是卡片自己的位置，必然碰撞），
    // 全局锚点格也跳过 —— 让第一张卡片的座位不被 presence 抢走（见下"为什么跳第 0 格"）
    if (tries++ === 0) continue;
    if (tries > SEAT_MAX_CANDIDATES) break;
    const cx = anchor.x + gx * SEAT_STEP, cy = anchor.y + gy * SEAT_STEP;
    last = { x: cx, y: cy };                                  // 兜底落最后一格，never the anchor
    if (!overlapsOccupied(occupied, cx, cy, w, h)) {
      return { x: cx, y: cy, seat: { gx, gy, tries, exhausted: false } };
    }
  }
  console.warn(`[seat] no free presence cell within ${SEAT_MAX_CANDIDATES} candidates in "${layerId}"; placing at last candidate`);
  return { x: last.x, y: last.y, seat: { gx: 0, gy: 0, tries, exhausted: true } };
}
```

**三个刻意的决定**：

1. **`x` / `y` 存中心点**，不是左上角。`/api/layer` 的 `presence` 直接吐 `x`/`y` 给前端画 104px 圆头像（`useWorld.ts` 的 `PresenceEntry{x,y}` 就是中心），卡片才用左上角 + `w/h`。**两种语义混用会让头像偏移半个身位**——这是最容易踩的一脚。`seatPresence` 返回的既然是中心，`upsertPresence` 原样写。
2. **第 0 格（锚点本身）永远跳过**。对 `near`，锚点格就是锚卡片自己的位置（必然碰撞，跳过只是省一次判定，也让落点在锚的"旁边"而不是锚"身上"）；对全局锚点 `SEAT_ANCHOR`，第 0 格正是**第一张卡片会被排到的位置**（`seatUnplaced` 从第 0 格开始试，`local-store.ts:326-337`）——若 presence 先占了它，那张卡片的行虽然已经落库（`ON CONFLICT(id) DO NOTHING`，`local-store.ts:346-352`）不会被搬，但 `reseatLayer`（`local-store.ts:396-404`）之后的每次重排都会从第 0 格开始试，撞上一个没人期待的角色。**跳过第 0 格让 presence 永不与卡片抢首席。**
3. **兜底落最后一格而非锚点**——与 `seatUnplaced` / `reseatLayer` 逐字一致（两处的注释都解释了理由：螺旋是一次行走，最后一格至少是"走过的最远处"；落回锚点会与锚重叠，`local-store.ts:330-343`、`:400-403`）。`exhausted: true` 进 `details.seat`，让探针能断言。

#### 3.9.4 presence 之间的碰撞判据（为什么用 sprite 体积而不是"点距"）

占用项里 presence 的 `w/h` 取 `CARD_FORMS.sprite`（176×196），走**同一个 `overlapsOccupied`**。这样两个 presence 的最小中心距是 `(176+176)/2 + 22 = 198`（横向）、`(196+196)/2 + 22 = 218`（纵向），而前端渲染的 halo 直径是 104px（`前端改造计划.md:68` 的 `PresenceNode` + `:184` 的"104px 径向渐变光环头像"）——**中心距 ≥ 198 > 104，视觉上必然不叠，且留出约 90px 的空隙**给名字标签、状态点与光晕。

若改用"点距 ≥ 常量"（如 96）：那个常量就与卡片体积脱钩了，且 `SEAT_STEP = 96` 时**任何两个相邻格都会同时被判为碰撞**，螺旋永远走不出第二步。**用 box 判定 + 复用 `overlapsOccupied` 是唯一与其它两套排座同构的做法。**

> `[推断]` 176×196 比 104px halo 大，是因为 sprite 这一类卡片本来就是"角色出场"的完整尺寸（`CARD_FORMS.sprite` 的 `chrome: 'bare'`），排座用卡片表的值让"角色"与"角色卡"在空间上等价。若评审希望 presence 更松散，改 `SEAT_PAD` 或为 presence 引入独立的 `PRESENCE_GAP` 常量即可（一个数字），但这会让两套排座的间隙不再同源。

#### 3.9.5 落座实算（用真实世界数据验证）

以下数字用 `templates/holmes-world` 的**真实 `canvas.db` 行** + 上面的算法实算得出（`SEAT_STEP=96`、`SEAT_PAD=22`、`sprite 176×196`、跳第 0 格）：

**读法**：占用域就是 `SELECT x, y, width, height FROM cards WHERE layer = ?` **的全部行**——包含该层自己的 `README.md` 门牌行（实测它确实带 `layer='world/baker-street'`）。presence 因此**不会站在门牌上**，这是对的：门牌是双击进层的热区。

**实算 1 — 进入 `world/baker-street`（该层 4 行已摆好）**。真实占用：

```
world/baker-street/README.md      center (1182.3,  845.0)  288×240   ← 门牌（不是本页卡片，但同属该 layer 行）
world/baker-street/evening.md     center ( 699.5,  611.1)  460×190
world/baker-street/late-night.md  center (1526.7,  662.9)  460×190
world/baker-street/raindrops.md   center (1125.5,  819.4)  200×168
```

| 调用 | 结果 |
|---|---|
| `move_to(watson, 'world/baker-street')`（空位） | 中心 **(1056, 540)**，格 `[1,0]`，第 2 次尝试 |
| `move_to(constable, 'world/baker-street')`（watson 已在场） | 中心 **(768, 348)**，格 `[-2,-2]`，第 21 次尝试 |
| `move_to(watson, '…/late-night.md')`（`near` 吸附） | 中心 **(1814.7, 950.9)**，格 `[3,3]`，第 31 次尝试 |
| `move_to(watson, '…/raindrops.md')`（`near`，且**排除自己旧座位**） | 中心 **(1413.5, 1107.4)**，格 `[3,3]`，第 31 次尝试 |

**注意 `near` 落点不在锚旁边**（1814.7 距 late-night 中心 288px = 3 格）：紧贴锚的那一圈全部被**锚卡片自己**或相邻卡片占掉了——这正是"锚点格留给邻居、螺旋从第 1 圈起"（`doc-06 §2.5`「以锚点为圆心，网格步进（96px）螺旋外扩，找到第一个不与任何现有 bounds 相交的座位」）的必然结果。角色站在"最近的可站处"，而不是"锚的正上方"。

**实算 2 — 进入 `world/crime-scene`（该层 2 行：门牌 + `evening.md` 中心 (922.6, 397.6)）**：

| 调用 | 结果 |
|---|---|
| `move_to(watson, 'world/crime-scene')` | 中心 **(1056, 636)**，格 `[1,1]`，第 3 次尝试 |
| `move_to(watson, 'world/crime-scene/evening.md')` | 中心 **(1210.6, 685.6)**，格 `[3,3]`，第 31 次尝试 |
| `move_to(watson, 'world/crime-scene/README.md')`（`near` 门牌） | 中心 **(986.9, 832.7)**，格 `[3,-2]`，第 26 次尝试 |

**实算 3 — 跨层**：watson 在 crime-scene 的 (1056, 636)，`move_to(watson, 'world/baker-street')` → presence **只有一行**，`layer` 被改写为 `world/baker-street`，新座位是实算 1 的 **(1056, 540)**。旧层不再有他的行（`character_id UNIQUE` 保证，§3.4）。

**关键点：排座只看目标层**——绝不把旧层的坐标搬过去。旧坐标是为旧层的布局算出来的；搬过去会把 Watson 放到 baker-street 某个恰好"在那个数字上"的位置，而那里可能正压着一张卡片。

**实算 4 — 空层（stub / 未初始化的 `map`）**：`map` 层没有任何卡片行时，`move_to(watson, 'map')` → 中心 **(1056, 540)**，格 `[1,0]`（第 0 格被跳过，所以**不是** (960, 540) 这个锚点本身——锚点留给第一张卡片，见 §3.9.3 决定 2）。

**实算 5 — 两个人**：空层里连续两次 → watson **(1056, 540)**、constable **(768, 732)**（格 `[-2,2]`，第 17 次尝试）——两者中心距 `√(288² + 192²) ≈ 346`，远大于最小中心距 198，不叠。

---

## 4. 文件与副作用

### 4.1 白名单（`01 §10.1` 的行 × 本文的列）

| 目标 | 谁写 | 语句 | 原子性 |
|---|---|---|---|
| `.airpworld/canvas.db` 的 `presence` 表 | `moveCharacter` / `setFollowing` / `carryFollowers` | 单语句 UPSERT（`ON CONFLICT(character_id)`） | 单语句天然原子；不加事务（`01 §10.1`） |
| `.airpworld/canvas.db` 的 `presence` 表（**读**） | `seatPresence` | `SELECT x, y FROM presence WHERE layer = ?` | — |
| `.airpworld/canvas.db` 的 `cards` 表（**读**） | `seatPresence` | `SELECT x, y, width, height FROM cards WHERE layer = ?` | — |
| `.airpworld/history.db` 的 `events` 表 | 两个动作 + `carryFollowers` | `appendEvent` 一次（每条事件一次） | `BEGIN IMMEDIATE`（`01 §3.2`） |
| `characters/<id>/README.md`（**只读**） | `readCharacterName` | `readFile` | — |
| `world.json`（**只读**） | `resolveDestinationLayer`（`layers`）/ `resolveHome`（`characters[]`） | `getManifest` | 进程内缓存（`01 §3.2`） |

**MUST NOT**（逐条都是硬约束，不是建议）：

- ❌ 写 `characters/<id>/**` 的**任何**文件——`doc-20 §4` 末句明文；这条是 `move_to` 与 `move` 的分界线。
- ❌ 写 `cards` 表。presence 不是卡片；给角色建 `cards` 行会让 `/api/layer` 的 `seatUnplaced`/`reseatLayer` 把它当文件卡片重排（`routes/world.ts:167-181`）。
- ❌ 启动/停止角色进程（`lifecycle.getCharacter` / `spawnAgent` / `character_start`）——`doc-20 §9` 明文 + `doc-06 §5.4`「被点击聊天时才 spawn agent」。**推论：玩家可以跟随一个从未被聊过的角色**（`doc-00:60` 变更 #2 的布景头像）。
- ❌ 在动作路由里 `writer.prompt(...)`（`doc-05 §5.1`、`doc-21 §5.5`）。跟随变化只落事件，作家下一轮自己念（`doc-21 §5.1`）。
- ❌ 移动 `world/` 下的任何文件。这是 `move`（`04`）的域。

### 4.2 写盘的副作用面（一个诚实的问题：presence 变了，前端凭什么知道？）

`presence` 住在 `canvas.db`。watcher 会继续因 SQLite 文件变化唤醒 history tail reader，但 `.airpworld/canvas.db*` 不广播 `file_changed`；presence 的可靠通知来自 `move_to` / `set_following` / `carryFollowers` 落入 `history.db` 的 `world_event`（必要时由重连 fetch 兜底）。

1. **事件是可靠通道**：`move_to` / `set_following` / `carryFollowers` 都落 `history.db` 的 `events`（§5），server 尾部读表（`00 §5.3`）→ `world_event` 帧；
2. **前端收到 `world_event` 后整层重取**：`useWorld` 的 `world_event` 分支调 `fetchLayer(layerRef.current)`，把 `character_moved` / `following_changed` 转成当前层新投影（§6.2）；
3. **`/api/layer?layer=` 每次现读 `presence`**（`world.ts:221`），所以重取一定拿到新坐标。

**这就是为什么本文不依赖"`fs.watch` 会广播 canvas.db 变了"。** watcher 只负责唤醒 tail reader；事件帧是事实通道，重连时 `ws.onopen` 再拉一次当前层，避免瞬时帧丢失。

### 4.3 写盘原子性：SQLite 事务，不是 `writeFileAtomic`

与 `09 §4.3` 同一裁决：本文没有任何文件写入，因此**不用** `01 §10.3` 的 `writeFileAtomic`（它服务 markdown）。原子性由 SQLite 单语句提供。**不要为了"与 01 一致"套一个临时文件名方案**——那是解法错配。

---

## 5. 落账（事件全字段）

### 5.1 `character_moved`（`move_to`）

`detail` 的字段名**逐字**取自 `00 §5.2` / `doc-21 §4.2`：`{ character, name, from?, to, near? }`，一个不多、一个不少。

**完整示例**（作家把 Watson 从 crime-scene 移到 baker-street 的壁炉边）：

```jsonc
{
  "seq": 42,
  "id": "evt-42",
  "projectId": "holmes-beckstreet",
  "type": "character_moved",
  "actor": { "type": "writer" },              // 角色自己调 → {"type":"character","id":"watson"}
  "layer": "world/baker-street",              // = to（目标层 id）
  "subject": "world/baker-street",            // = dirOfLayer(to)，01 §4 表
  "turn": "turn:<sessionId>:7",               // A 入口；C 入口是 req:<uuid>
  "detail": {
    "character": "watson",
    "name": "Watson",                         // characters/watson/README.md 的 frontmatter name
    "from": "world/crime-scene",              // 真跨层才出现；首次入场省略
    "to": "world/baker-street",
    "near": "world/baker-street/fireplace.md" // 只在传入且生效时出现（`near` 省略 → 键不出现）
  },
  "createdAt": "2026-09-12T06:20:11.402Z"
}
```

### 5.2 `following_changed`（`set_following`）

```jsonc
{
  "seq": 43, "id": "evt-43", "projectId": "holmes-beckstreet",
  "type": "following_changed",
  "actor": { "type": "player" },              // 角色 tab 点「跟随」是 C 入口（12 §2.4）
  "layer": "world/baker-street",              // = 角色此刻所在层；无 presence 时为 null
  "subject": "characters/watson/README.md",   // 01 §4 表：角色 README 路径
  "turn": "req:9f2c…",
  "detail": { "character": "watson", "name": "Watson", "following": true },
  "createdAt": "2026-09-12T06:21:03.881Z"
}
```

**`detail` 只有三个键**——`doc-21 §4.2` 冻结。**不加 `layer` / `x` / `y`**（§3.6.1 第 4 条）：位置对这句话没有贡献，而 `00 §5.2` 的字段名是契约（评审门第 2 条）。位置在 `details` 里给前端（§6.1）。

### 5.3 跟随移动的事件（`carryFollowers`）

每个被搬运的跟随者落**一条 `character_moved`**（`actor: {type:'engine'}`，§3.6.2），`from` = 旧层、`to` = 玩家新进的层、`near` 不出现。**为什么不是一条"批量"事件**：`doc-21 §4` 的每个 type 都描述"一件事"（「老周走到壁炉边去了」），而"三个人跟着换了场"是**三件独立的空间事实**（各自的落点不同）。批量合并交给消费侧的合并规则（`doc-21 §5.4` 第 1 条：同 `turn` + 同 `type` + 同 `actor` → 合并计数：「3 个角色跟着你换了场景」）。**这正是 `turn` 存在的意义**（`doc-21 §3.4`）。

### 5.4 落账总表（本文两行 + 一行附属）

| 事件 | 动作方法 | actor | subject | layer | detail 的 `name` 从哪来 |
|---|---|---|---|---|---|
| `character_moved` | `moveCharacter`（A/C） | 调用者 | `dirOfLayer(to)` | `to` | `characters/<id>/README.md` 的 `name` |
| `following_changed` | `setFollowing`（A/C） | 调用者 | `characters/<id>/README.md` | presence 的层（无则 `null`） | 同上 |
| `character_moved`（跟随） | `carryFollowers`（E，`enterLayer` 内） | **`engine`** | `dirOfLayer(to)` | `to` | 同上 |

与 `01 §4` 表逐字一致，第三行是本文新增的 `carryFollowers`（`engine` actor）。**已按 REVIEW 批次回写 `01 §4` 与 `01 §5`**（`01 §5` row 23）——本文与 `01` 现两处同源（见 §11 冲突 3）。

### 5.5 失败不落（`doc-21 §3.6`）

| 情形 | 落事件？ |
|---|---|
| 五个校验步骤任一步失败（`not_found` / `invalid_argument` / `near_out_of_layer`） | **否** |
| 幂等 no-op（`moved: false` / `changed: false`） | **否**（§3.7：世界没变） |
| `presence` 写成功、`appendEvent` 抛错 | **否**——`ActionError('event_failed')`，文案说清"presence 已改、账没落"。**不补偿、不回滚**（`01 §3.6` 定案） |
| `carryFollowers` 里第 2 个角色移动失败（如 `appendEvent` 抛错） | 前 N 条已落、第 N+1 条没有。**不整体回滚**——回滚要撤销已提交的 presence 行，而玩家此刻已经在新层了。逐条 try/catch 让"跟丢一个人"不阻止其余人跟上。**失败必须可见（REVIEW §5.5）**：`carryFollowers` 返回 `{ moved, failures }`（§2.1 / §3.6.2），失败角色进 `failures` 并随 `enterLayer` 的 `details` 上抛；`console.warn` 只作补充，**不许静默**（`00 §6.2`）。换场动作不因一个角色失败而失败，但"谁没跟上"要让作家/前端能看见 |

---

## 6. WS / 前端

### 6.1 `details`：给谁用（`01 §11.2` 的稳定字段）

| 字段 | 谁用 |
|---|---|
| `event` | `01 §11.2` 的兜底：前端立刻拿到这条事件（**不替代** `world_event` 帧，按 `event.id` 去重，`12 §6.4`） |
| `character` / `name` / `layer` / `from?` / `x` / `y` / `near?` / `moved` | 探针断言；前端**可选**用于乐观动画（不发 `fetchLayer` 就先把头像挪过去，与 `moveCard` 的乐观合并同例，`useWorld.ts` 的 `moveCard`） |
| `seat` | **只给探针/诊断**，不进事件、前端不用（`01 §6.3` 第 5 条：明细留返回值） |
| `following` / `changed` / `created` / `landedFromHome` | 探针断言；`landedFromHome: false` 让前端能提示"这个角色还没有自己的场景，先放在大地图" |

### 6.2 两条通道，本文不新增帧

**演出帧**：`move_to` / `set_following` **不发任何演出帧**。理由：

- 两个工具都是**状态更新**，不是"演出"——`00 §5.3` 的帧清单里没有它们的名字，而 `01 §4.1` 的纪律是"帧名与事件 type 不共用命名空间"：若给它们各造一个帧（`character_moved` / `following_changed` 帧），就与事件 type 撞名，正是 `12 §6.2` 要删 `item_moved` / `use_item_on` 裸帧的同一个错误；
- 玩家 UI 的动作演出**由 HTTP 响应体驱动**（`12 §3.3` 第 5 条："HTTP 路径不发演出帧"）。角色 tab 点「跟随」是 C 入口，前端拿 `SetFollowingDetails` 自己演（按钮变色 + toast）；
- 作家/角色调工具时，前端通过 `tool_execution_end`（`mapEngineEvent`）本来就能看到工具调用（`tool_start`/`tool_end`），加上 `world_event` 帧，信息已经够了（`12 §3.4`）。

**世界事件**：`character_moved` / `following_changed` 走 **`world_event`**（`00 §5.3` 的唯一通道），形状见 `12 §6.3`。

**前端必须改的一行**（`useWorld.ts` 的 WS `onmessage` switch）：把新事件 type 加进"整层重取"分支，理由见 §4.2：

```ts
switch (msg.type) {
  case 'file_changed':
  case 'item_moved':          // 12 会删掉这个帧，届时一并去掉
  case 'god_action':
  case 'world_event':         // ★ 新增：character_moved / following_changed / layer_entered …
    void fetchLayer(layerRef.current);
    break;
```

**为什么必须重取而不是局部合并**：`presence` 的坐标是**引擎排座的结果**，前端算不出来（它没有 `cards` 表的全量占用域）；而 `PresenceEntry` 只有 `{characterId, x, y, following}`，靠它做增量合并等于把排座算法镜像到前端（`前端改造计划.md:21` 已经镜像过一份 `lib/seat.ts` 作兜底——**那是给"渲染前先摆一下"用的，不是给"真值"用的**，两者的常量必须同源，`lib/seat.ts:1-9` 的注释自己写明了）。整层重取是 `doc-06 §2.5`「已摆放的永不重排」的代价，也是它的保障。

> **一个正面副作用**：`world_event` + 整层重取顺带修好了"角色 tab 里 `At: {char.home}` 永远显示 manifest 的初始层"这个既有问题（`RightSidebar.tsx:129`）。重取后前端若能拿到该角色的真实层（见 §6.4），`At:` 可以改成"此刻在哪"。**这一条不在 B1 范围**，但本文的 `details.layer` 让它成为可能。

### 6.3 `/api/layer` 返回 presence：现状已够，不改形状

`world.ts:221-229`：

```ts
const presence = (store.queryCanvas(
  'SELECT character_id, x, y, following FROM presence WHERE layer = ?', [layer]
) as Array<Record<string, unknown>>).map((row) => ({
  characterId: String(row.character_id), x: Number(row.x), y: Number(row.y),
  following: Number(row.following) === 1,
}));
```

与前端 `PresenceEntry{characterId, x, y, following}`（`useWorld.ts` 的 `PresenceEntry`）**逐字对齐**，本文**不改它的形状**（加字段会破坏 `12 §6.3` 的"前端契约"冻结；`name` 前端自己从 `/api/characters` 拿）。**只补一样**：`ORDER BY character_id`，让同一份世界在两次请求间返回**稳定顺序**（渲染层按数组序叠加 halo 时，顺序抖动会造成 z 序闪烁；前端没有 z 字段可用）。

### 6.4 角色 tab 的「跟随」按钮 → 同一个动作函数（任务点名：`doc-20 §12` UI 与 Agent 共用）

**现状**（三处，全部是本地假状态）：

| 位置 | 现状 |
|---|---|
| `App.tsx:30` | `followingCharacters` 是**组件 state**（`Record<string, boolean>`） |
| `App.tsx:371-377` | `onToggleFollow` 只翻转本地 state + `showToast("${charId} follow status toggled")` |
| `RightSidebar.tsx:112` | `isFollowing = followingCharacters[char.id]` —— 纯读本地 state |

**问题**：这个开关**只活在浏览器内存里**——刷新即失，作家看不见（`doc-06 §5.4`：「作家可感知跟随状态变化，叙事回应」），切场景时也没有任何东西会跟着来（`doc-06 §5.4`：「切换场景时系统把角色在场位置顺延到新层」）。**它是一条完全悬空的 UI。**

**目标形态**（`doc-20 §12`：「玩家点击与 Agent 工具进入同一后端动作」）：

```
RightSidebar.tsx  点「跟随」（现有按钮 onClick={() => onToggleFollow?.(char.id)}）
  → App.tsx  onToggleFollow={async (charId) => {
       const next = !followedFromPresence(charId);          // 真值来自 presence，不是本地 state
       const res = await fetch('/api/following', {
         method: 'POST', headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ character: charId, following: next }),
       });
       if (!res.ok) { showToast(await readError(res)); return; }   // 失败可见（00 §8）
       showToast(`${charId} ${next ? 'starts' : 'stops'} following you`);
     }}
```

```ts
// apps/server/src/routes/world.ts —— 与 /move /choice 同款（12 §3.3 的 reply 壳）
router.post('/following', async (req, res) => {
  const store = getActiveStore();
  if (!store) return res.status(400).json({ error: 'No active world' });
  const { character, following } = req.body as { character?: unknown; following?: unknown };
  if (typeof character !== 'string' || character === '') return fail 400 invalid_argument;   // §2.4：C 入口必须显式给
  if (typeof following !== 'boolean') return fail 400 invalid_argument;
  try {
    const svc = createActionService(store, { type: 'player' }, { turn: `req:${randomUUID()}` });
    const r = await svc.setFollowing({ character, following });
    res.json({ ok: true, ...r.details });          // 响应体驱动前端演出（12 §3.3）
  } catch (err) { /* ActionError → toHttp()（12 §3.3） */ }
});
```

**四条纪律**：

- **前端不再持有跟随真值**。一次 `fetchLayer` 拿到的 `presence[].following` 就是开关状态；`followingCharacters` state 删除（`App.tsx:30`、`RightSidebar.tsx:112` 的读法改为从 `worldState.presence` 派生）。**留着两份状态 = 两份真相**，而跟随恰恰是"作家也会改"的字段——作家调 `set_following` 后，本地 state 会一直显示旧值。
- **点击是 toggle 但动作不是**：前端算出 `next`（`!current`），动作层收到的是终态（`doc-20 §9`：`following` 覆盖两个方向）。并发点两次时动作层是幂等的（§3.7）。
- **actor 是 `player`**（`01 §3.5` 的 C 入口表：`/api/*` 的玩家操作用 `player`）。若走上帝模式工具栏则 `god`，但跟随不是上帝能力。
- **`12 §2.4` 现在定的是"B1 先不建 `/api/following`，因为前端没有发送点"**。本文**要求改这个裁决**：把前端那一行接上（上面的 `onToggleFollow` 就是发送点），路由同批落地。理由：不接的话，`doc-06 §5.4` 的「跟随」按钮是个**看起来能用、实际什么都不做**的按钮，而它是玩家唯一能主动表达"我要这个人跟着"的入口；`setFollowing` 也永远只能被 agent 调用——与 `doc-20 §12`"UI 与 Agent 共用"直接矛盾。**登记为 §11 冲突 1。**

### 6.5 `/api/characters` 的 `At:` 字段（可选，非 B1）

`world.ts:261-284` 现在返回 manifest 的 `c`（含 `home`），前端显示 `At: {char.home}`（`RightSidebar.tsx:129`）。**那是"他初始住在哪"，不是"他在哪"**——跟随之后这句话就是错的。建议（**不在 B1 落地**，登记 §12）：`/api/characters` 加 `presence: {layer, following} | null`，前端把 `At:` 改成"在场层 / 未在场"（`doc-06 §5.4` 末条要求"不在场就是不在场"）。

---

## 7. 错误与边界

### 7.1 错误码（`01 §7.1` 的 HTTP 映射已冻结，本文只用其中 5 个）

| 场景 | code | HTTP |
|---|---|---|
| `character` 空串 / 含 `/` / 以 `.` 开头 | `invalid_argument` | 400 |
| `destination` 空串 | `invalid_argument` | 400 |
| `destination` 是 `player/**` / `characters/**`（不是层） | `invalid_argument` | 400 |
| 省略 `character` 但调用者不是角色 agent | `invalid_argument` | 400 |
| `destination` / `near` 路径非法（绝对 / `..` / 保留前缀） | `invalid_path` | 400 |
| 角色目录不存在 | `not_found` | 404 |
| `destination` 不存在 | `not_found` | 404 |
| `destination` 是目录但不是层 | `not_found` | 404 |
| `near` 不存在 | `not_found` | 404 |
| `near` 越层 / 是目录 | `near_out_of_layer` | 422 |
| presence 写失败 | `write_failed` | 500 |
| `appendEvent` 失败（presence 已写） | `event_failed` | 500 |
| 排座耗尽 | **不抛错**（warn + 落最后一格，`details.seat.exhausted=true`） | — |

**`no_free_seat`（507）不被本文使用**——与 `04 §7.1` 一致：座位不理想远好过整个动作失败（角色已经在场了）。这个码留给"空间本身装不下"的将来语义（若评审坚持，改法是把 `templates/*/world/**` 塞满数百张卡片——不在 B1）。

### 7.2 精确错误文案（英文，`01 §7.2` 的纪律：每条带具体值）

| 场景 | 文案 |
|---|---|
| 角色 id 是路径 | `Character must be a character id, not a path: "../watson"` |
| 角色不存在 | `Character not found: "characters/sherlock"` |
| 省略 character 但调用者不是角色 | `move_to / set_following need an explicit "character" when the caller is not a character agent (AIRP_AGENT_ROLE="writer"). Writers and the player UI must name the character.` |
| 目标不存在 | `Destination not found: "world/nowhere"` |
| 目标是目录但不是层 | `Destination is a directory but not a scene: "assets/scenes"` |
| 目标在 `player/` / `characters/` | `Destination must be a scene directory or an entity inside world/: "player/copper-key.md" (player/ and characters/<id>/ are not scenes)` |
| `destination` 空 | `destination must not be empty` |
| `near` 不存在 | `near not found: "world/baker-street/fireplace.md"` |
| `near` 越层 | `near "world/other/x.md" is not in the destination layer "world/baker-street"` |
| `near` 是目录 | `near must be an entity path, not a layer directory: "world/baker-street"` |
| presence 写失败 | `Failed to move "watson" to "world/baker-street": <err>` |
| 落账失败 | `Character "watson" moved to "world/baker-street" but the world event could not be recorded: <err>` |
| 成功（进入） | `Watson walked into "Baker Street" and now stands near "fireplace.md".` |
| 成功（原地） | `Watson is already in "Baker Street".` |
| 成功（跟随开） | `Watson now follows you.` / `Watson starts following you from "Baker Street".` |
| 成功（跟随关） | `Watson no longer follows you.` |
| 幂等（跟随已开） | `Watson already follows you.` |
| 幂等（不在场 + false） | `Watson is not in the world and is not following you.` |

**文本中的层名人话化**：成功文案里的 `"Baker Street"` 是层的**显示名**（`world/baker-street/README.md` 的 frontmatter `name`），不是路径——层名读不到时退回目录名（与 `11` 的 stub 层命名同例）。**工具返回的 `text` 是给模型读的**（`00 §6.2`），`"world/baker-street"` 对模型无害，但 `"Baker Street"` 让它下一轮能直接用它而不用自己去拼。**路径仍在 `details` 里**（`doc-20 §10`：「返回后续动作需要的稳定路径」）。

### 7.3 边界清单

- **同一角色的两次并发 `move_to`**：后写者赢，两条事件都落。`character_id UNIQUE` 保证最终只有一行（不是两行）——这正是 UNIQUE 的价值：**并发下最坏的结局是"位置是后一个"，而不是"变成两个人"**。
- **`near` 指向的卡片没有 `cards` 行**（文件存在、从未被 `/api/layer` 排过座）：`seatPresence` 的 `anchorOf` **先给锚卡片排座再拿它当锚**（与 `04 §3.9.3` 同做法），锚因此一定有行。**漏了会怎样**：拿一个 `undefined` 当锚点，`anchor.x + gx * STEP` 变成 `NaN`，presence 的坐标是 `NaN` → `JSON.stringify` 出 `null` → 前端头像飞到 (0,0) 或直接崩。**这是本文最容易漏的一步，写成 MUST。**
- **`near` = `destination` 的隐式等价**（§3.3）：`move_to(watson, 'world/baker-street/fireplace.md')` 与 `move_to(watson, 'world/baker-street/fireplace.md', near: 'world/baker-street/fireplace.md')` 等价。
- **`destination` = `map` 而角色已在 `map`**：`move_to(watson, 'map')` 无 `near` → no-op（§3.7），**即使 `map` 层的坐标是 0,0**（若真有 0,0 的行，那是历史脏数据，不该由本动作"顺手修"）。
- **`set_following` 对一个从未被排过座的角色**：`following=false` → no-op（§3.6.1）；`following=true` → 落到 `home`。**两种都可能被玩家从角色 tab 触发**（那里的列表来自 `characters/` 目录扫描，`doc-05 §4.1.1`，与 presence 无关——所以"列表里有他、presence 里没有他"是常态）。
- **角色在 A 层跟随，玩家去 B 层，然后作家把角色 `move_to` 到 C 层**：`move_to` 保住 `following=true`（§3.4），所以角色现在在 C 层且仍跟随——下一次玩家换层时它从 C 跟到新层。**这是正确行为**（作家手动调度的优先级在"位置"这一维高于跟随，但没取消跟随状态）。
- **跟随者同时被 `move_to` 与 `carryFollowers` 写**：`carryFollowers` 只处理 `layer !== toLayer` 的跟随者（§3.6.2 第 2 条），刚被 `move_to` 到 `toLayer` 的角色不在其中——**不重复移动、不重复落账**。
- **`characters/<id>/README.md` 不存在**（`readCharacterName` 读不到）：降级用角色 id 当 `name`（`doc-21 §3.3` 要求 `detail` 带"当时的名字"——id 是当下能拿到的最准的名字），**不失败**。世界里的 `characters/watson/` 现在确实有 README（`templates/holmes-world/characters/watson/README.md` 的 `name: Watson`），但初始化期的角色目录可能只有 `preset.json`（`doc-11 §4` 的"若缺则补"）。
- **`characters/<id>/README.md` 是目录**（病态内容）：`readCharacterName` catch 后降级用 id。**不失败**——读不到名字不该阻止角色在场。

---

## 8. 代码落点（精确到文件与函数）

### 8.1 新建

| 文件 | 函数 / 导出 | 内容 |
|---|---|---|
| `packages/shared/src/actions/presence.ts` | `PresenceRecord` / `resolveTargetCharacter` / `readCharacterName` / `resolveDestinationLayer` / `assertNearInLayer` / `resolveHome` / `carryFollowers` / `appendFollowingChanged` | §2.4 / §3.2 / §3.3 / §3.4 / §3.6 的逻辑。**不注册工具**，被 `move-to.ts` / `following.ts` / `layer.ts` import。几何排座不在这里（`seatPresence` 是 store 方法，§3.9.2） |
| `packages/shared/src/actions/move-to.ts` | `moveCharacter` / `MoveCharacterInput` / `MoveCharacterDetails` | §3.5 的五步编排 |
| `packages/shared/src/actions/following.ts` | `setFollowing` / `SetFollowingInput` / `SetFollowingDetails` | §3.6.1 |
| `extensions/toolkit/move-to.ts` | `registerTool({name:'move_to'})` | §2.2（薄壳，无业务判断） |
| `extensions/toolkit/following.ts` | `registerTool({name:'set_following'})` | §2.2 |

### 8.2 修改

| 文件 | 函数 / 位置 | 改动 |
|---|---|---|
| `packages/shared/src/db/schema.ts` | `initCanvasDatabase`（`:28-37`） | `DROP TABLE IF EXISTS presence` + §3.4 的新 DDL（`character_id UNIQUE` + `idx_presence_layer`）。**与 `events` 的迁移同批**（`01 §8.1`） |
| `packages/shared/src/store/local-store.ts` | **`seatPresence(layerId, opts)`（新增）** | §3.9.3。与 `seatUnplaced`（`:291`）/ `reseatLayer`（`:367`）并列——**放在这个文件里正是为了直接用私有的 `SEAT_MAX_CANDIDATES` / `spiralCells` / `overlapsOccupied`**（§3.9.2） |
| `packages/shared/src/store/local-store.ts` | **`anchorOf(layerId, path)`（新增，私有）** | 取该卡片行的中心；无行时先 `seatUnplaced` 再取（§7.3 第 2 条）。`04 §3.9.3` 的 `seatNear` 需要同一个 helper——**建议抽成共享私有方法，由 `04` 与本文同批实现**（登记 §11 冲突 5） |
| `packages/shared/src/store/local-store.ts` | `SEAT_MAX_CANDIDATES`（`:20`） | 保持模块私有（`seatPresence` 同模块即可用，不必导出） |
| `packages/shared/src/store/world-store.ts` | `WorldStore` 接口 | 加 `upsertPresence` / `getPresence` / `getPresenceOf` / `seatPresence`（`01 §2.7` 的清单需补这 4 行；`seatPresence` 与 `04` 的 `seatNear` 同例，登记 §11 冲突 3） |
| `packages/shared/src/index.ts` | — | 导出 `actions/presence.js` 的 `PresenceRecord`（`12` 的 toolkit 与 `03`/`09` 可能要它；`01 §8` 的导出清单加一行） |
| `packages/shared/src/actions/service.ts` | `ActionService` | 已有 `moveCharacter` / `setFollowing` 两行绑定（`01 §2.6`，**不需要改**） |
| `packages/shared/src/actions/layer.ts` | `enterLayer` | 第 2 步调 `carryFollowers(ctx, layer)`（§3.6.2）。**这是 05 对 11/12 的唯一接口要求** |
| `apps/server/src/routes/world.ts` | **新增 `POST /following`** | §6.4。形状 `{ character, following }` → `SetFollowingDetails`，actor `player`（**要求改 `12 §2.4` 的"先不建"裁决**，§11 冲突 1） |
| `apps/server/src/routes/world.ts` | `/layer`（`:221-229`） | presence 查询加 `ORDER BY character_id`（§6.3）。**形状不变** |
| `apps/web/src/state/useWorld.ts` | WS `onmessage`（`:173-181`） | 加 `case 'world_event':` → `fetchLayer(layerRef.current)`（§6.2） |
| `apps/web/src/App.tsx` | `followingCharacters` state（`:30`）、`onToggleFollow`（`:371-377`） | 删 state；改为 `fetch('/api/following')` + 从 `worldState.presence` 派生真值（§6.4） |
| `apps/web/src/components/sidebar/RightSidebar.tsx` | `isFollowing`（`:112`） | 改从 presence 派生（props 换成 `presence` 或传一个 `isFollowingOf(charId)` 函数） |

### 8.3 不碰

- `apps/server/src/engine/lifecycle.ts`（角色进程起停与 presence 无关，§3.8）；
- `apps/server/src/engine/event-bridge.ts` 的帧映射表（本文不新增帧，§6.2；`world_event` 由 `12` 统一接线）；
- `packages/shared/src/store/layers.ts`（`layerOfDir` / `layerOfPath` 直接复用，不改）；
- `packages/shared/src/schemas/forms.ts` 的 `CARD_FORMS`（`sprite` 已存在，`forms.ts:33`）；
- `templates/holmes-world/**`（presence 表是空的，模板无需预填——角色由 `move_to` / `set_following` 就位）。

---

## 9. 与现存实现的差异

| 位置 | 现状（带行号） | 要改成 | 旧调用点怎么办 |
|---|---|---|---|
| `db/schema.ts:28-37` | `presence` 无 UNIQUE、无索引；`id` PK 无写入点 | §3.4 的新 DDL（`character_id UNIQUE` + 索引） | 无（表空。`grep -rn "INTO presence"` 零命中） |
| （全仓库） | **`presence` 只有 1 个读点、0 个写点**：`world.ts:221` 的 `SELECT` | 新增 1 个写路径（`upsertPresence`）+ 3 个读点 | `world.ts:221` 保留（只加 `ORDER BY`） |
| `apps/web/src/state/useWorld.ts` 的 `PresenceEntry` / `LayerState` | `PresenceEntry` 类型已定义；`LayerState.presence` 已接入（`useWorld.ts` 的 `LayerState` 接口） | **不改**（形状已对齐 §6.3） | — |
| `apps/web/src/App.tsx:30/371-377` + `RightSidebar.tsx:112` | `followingCharacters` 是**浏览器内存里的假状态**，刷新即失、作家看不见、切层不跟 | 改走 `POST /api/following` + 从 presence 派生（§6.4） | 删 `App.tsx:30` 的 state；`RightSidebar` 的 props 改造 |
| `apps/server/src/routes/world.ts` | **无 `/following` 路由**；`12 §2.4` 定"B1 先不建" | 建（§6.4）。理由：前端那一行接上后它就不再是死路由 | 无 |
| `packages/shared/src/store/world-store.ts:22-44` | 无 presence 方法 | 加 4 个（§8.2） | 无 |
| `packages/shared/src/store/local-store.ts` | 3 个排座方法（`seatUnplaced` / `reseatLayer` / `saveCardPosition`） | 加第 4 个 `seatPresence` | 无 |
| `local-store.ts:136-179` 的 `move()` | 落 `item_moved`、无 presence 概念 | **不动**（`04` 重写它，`move_to` 与它无关） | — |
| `event-bridge.ts:138` | 过滤整个 `.airpworld`（`canvas.db-wal` 也被滤掉） | 改成只滤 `assets/`、`sessions/`（`12`）+ **考虑再滤 `canvas.db*`**（§4.2 的隐患） | 归 `12` |
| `doc-20 §4` 末句 | 「追加角色移动事件并广播新的在场位置」 | 事件名 = `character_moved`（`doc-21 §4.2` 已定），"广播"= `details` + `world_event`（§6.2） | 无代码影响 |

---

## 10. 验收与测试

### 10.1 纯函数单测（无 I/O，MUST 写）

| 目标 | 判据 |
|---|---|
| `resolveDestinationLayer` 的分派 | 对 `{kind:'dir'}` / `{kind:'file'}` / `{kind:'missing'}` 三种 `statKind` 桩，分别得到 `layer` / `entity` / `not_found`；`'world'` → `'map'`；`'map'` → `'map'` |
| `resolveTargetCharacter` | 显式 id + 目录存在 → 返回 id；显式 id + 目录不存在 → `not_found`；省略 + `actor={type:'character',id:'watson'}` → `watson`；省略 + `actor={type:'writer'}` → `invalid_argument`；`'../x'` / `'a/b'` / `''` → `invalid_argument`（测试里 `process.env.AIRP_AGENT_ROLE` 用 `01 §2.3` 的六行降级表各跑一遍） |
| `normalizePath` 的边界 | `'/abs'` / `'a\\b'` / `'a/../../x'` / `'.airpworld/x'` → 各自抛 `invalid_path`（`01 §7.3` 的实现，本文只调用） |
| `upsertPresence` 的 SQL 分支 | `following === undefined` 时生成的 SQL **不含** `following = excluded.following`（字符串断言，纯函数抽出 SQL 构造即可） |

### 10.2 store 单测（临时目录 + 真 SQLite）

| 场景 | 判据 |
|---|---|
| `character_id UNIQUE` | 对同一 id 连插两次（第二次走 `ON CONFLICT`）后 `SELECT COUNT(*)` = 1 |
| `following` 保留 | 先 `following=1`，再 `upsertPresence({following: undefined})` → 行仍为 1；再 `{following: false}` → 0 |
| `seatPresence` 避开卡片 | 手工插一行 `cards(layer='L', x=960-230, y=540-95, w=460, h=190)`（占满首座）→ 结果**不是** (960,540) |
| `seatPresence` 避开 presence | 先插 `presence(watson)`，再给 constable 排座 → 两者中心距 ≥ 198（横向）/ 218（纵向） |
| `seatPresence` 排除自己 | 同一 watson 已有行，`excludeCharacter='watson'` → 落点**可以**与他旧座位重叠（说明旧行确实被排除了） |
| `seatPresence` 跳第 0 格 | 空层（无卡片无 presence）→ 落点 = **(1056, 540)**（格 `[1,0]`），**不是** (960,540) |
| `seatPresence` 兜底 | 用一个几乎填满的画布（密集插卡片）→ 600 格耗尽时返回 `exhausted: true` 且**不抛错**，落点是第 600 格的坐标 |
| `anchorOf` 补座 | 锚卡片无 `cards` 行 → 调用后该行存在，且 `anchorOf` 返回其中心（§7.3 第 2 条） |
| `carryFollowers` 过滤 | 三个 presence（A 跟 `layer=world/a`、B 跟随但已在目标层、C 不跟随）→ 只有 A 被搬，且落 1 条 `character_moved`（`actor.type === 'engine'`，`detail.from = world/a`） |
| `carryFollowers` 不动 following | 搬运后 A 的 `following` 仍为 1 |

### 10.3 探针 / 手测（端到端）

1. **作家移动任意角色**（`后端实现计划.md:563` 的验收行）：让作家调 `move_to({character:'watson', destination:'world/baker-street'})` → `history.db` 多一条 `character_moved`，`actor_type='writer'`，`layer='world/baker-street'`，`detail.name='Watson'`，`detail.from` **不存在**；`/api/layer?layer=world/baker-street` 的 `presence` 多一项且坐标 = 实算 1 的 (1056, 540)。
2. **角色移动自己**：开 Watson 遮罩说一句"我去贝克街"，它调 `move_to({destination:'world/baker-street'})` → 成功后 `actor={type:'character',id:'watson'}`。
3. **省略 character 的作家调用被拒**：让作家调 `move_to({destination:'map'})` → `isError:true`，文案含 `AIRP_AGENT_ROLE="writer"`，**事件表无新增行**。
4. **三种 destination 情形**：分别调 `'world/baker-street'`（目录）/ `'world/baker-street/late-night.md'`（当前层组件）/ `'world/crime-scene/evening.md'`（**别层**组件，先检验 `from` 出现且 `layer` = crime-scene）→ 前两个 `from` 只有第三个有；三个都成功。
5. **`near` 越层被拒**：`move_to({character:'watson', destination:'world/baker-street', near:'world/crime-scene/evening.md'})` → 422 `near_out_of_layer`，presence **未变**。
6. **移动到不存在的层**：`destination:'world/nowhere'` → 404，presence 未变。
7. **移动不存在的角色**：`character:'sherlock'` → 404 `Character not found: "characters/sherlock"`。
8. **角色进程没起来仍可移动**：`pgrep -f character` 为空时调 `move_to` → 成功；`ps` 仍然为空（§3.8）。
9. **目录不动**：`md5sum` 递归 `characters/watson/` 前后一致。
10. **跟随开关走 UI**：角色 tab 点「跟随」→ 200 + `following_changed`（`actor_type='player'`）；**刷新浏览器**，开关仍是开的（真值在 presence，§6.4）；作家下一轮注入的 `cast` 节（`doc-22 §3.1`）里 Watson 带"在跟随"。
11. **切层跟着来**（`doc-05 §4.1.1`）：Watson 跟随中，玩家双击 `crime-scene` 门牌 → `world_event` 收到 **1 条 `layer_entered` + 1 条 `character_moved`**（`actor_type='engine'`，`detail.from='world/baker-street'`），两次的 `turn` **相同**；画布上 Watson 的头像出现在 crime-scene 的 (1056, 636)（实算 2）。
12. **跟随者不重复移动**：玩家再进一次同一层 → 只有 `layer_entered`，**没有** `character_moved`（§3.6.2 第 2 条）。
13. **不开进程的跟随**：从没聊过的 constable 点「跟随」→ 成功落 presence 在 `home`（`landedFromHome: true`）；`ps` 里没有它的进程。
14. **`set_following(false)` 的幂等**：对从不在场的角色调 → 200 但**无事件**（§3.7）。

### 10.4 评审可读性判据

`01 §5` 表第 7/8 行（`moveCharacter` / `setFollowing`）的每一个字段，都能在本文 §2.1 找到逐字对应的定义；本文 §8 的每一行都落回一个具体文件与函数名；§5.4 的三行与 `01 §4` 逐字对照（第三行是新增，已登记）。

---

## 11. 发现的冲突 / 需要修订的上位文档

> 按 `00 §0`：不私改上位文档，只登记，评审统一裁决。

| # | 哪两份 | 哪一句 / 哪里 | 为什么矛盾 | 建议怎么改 |
|---|---|---|---|---|
| 1 | `12 §2.4` vs `doc-20 §12` / `doc-06 §5.4` | `12`：「`POST /following` …… **B1 先不建**；等前端的跟随开关真落到引擎时再加。**登记为"前端就绪后补"**」；`doc-20 §12`：「玩家点击与 Agent 工具进入同一后端动作」；`doc-06 §5.4`：「玩家可用角色 tab 开关」 | 现在那个按钮（`App.tsx:371-377`）**只翻本地 state**，是一条悬空 UI：刷新即失、作家看不见、切层不跟。不建路由 = `set_following` 永远只有 agent 能调，UI 与 Agent 就没共用 | 前端那一行（`onToggleFollow` → `fetch('/api/following')`）与路由**同批**落地。**本文要求改这个"先不建"的裁决**，理由见 §6.4 |
| 2 | `doc-06 §5.4` vs 现状 | 「切换场景时系统把角色在场位置顺延到新层」 | "系统"是谁？`12` 把进层归 `enterLayer`（只落 `layer_entered`），`11` 没有跟随逻辑，`doc-22` 只注入不搬人。**这句话目前没有落点** | 本文把落点定为 `enterLayer` 内调 `carryFollowers`（§3.6.2），并要求 `11`/`12` 的 `enterLayer` 文档引用它 |
| 3 | `01 §2.7` / `§4` vs 本文 | `01 §2.7` 的 `WorldStore` 新增清单**没有** presence 系列；`01 §4` 落账总表**没有**跟随移动那一行 | 缺这 4 个方法（`upsertPresence`/`getPresence`/`getPresenceOf`/`seatPresence`）本文无法实现；缺那一行则"跟随移动的事件"在总表里查不到归属 | **已裁决（REVIEW 批次）**：`01 §2.7` 补这 4 行、`01 §4` 补 1 行（`carryFollowers`，actor `engine`）、`01 §5` 补 `carryFollowers` 一行（row 23）。**与 `04` 补 `seatNear` 是同一次增补**。本文 §5.4 第三行据此与 `01 §4` 对齐 |
| 4 | `12 §3.6` vs 本文 §4.2 | `12` 把 `.airpworld` 过滤收紧为"只滤 `assets/` 与 `sessions/`" | 收紧后 `canvas.db-wal`（每次写 presence / 卡片 / 视点都会变）也会触发 `file_changed` → 前端**整层重取**。`move_to` 一次会多触发一次无意义重取 | 建议过滤名单加 `canvas.db` 前缀（`canvas.db` / `canvas.db-wal` / `canvas.db-shm`）：这些文件的语义变化自有 `world_event` / `card_position` / `canvas_patched` 帧覆盖。**若评审认为"宁可多刷不可漏刷"，保留现状也可接受**（幂等，只是带宽）——但需在 `12` 写明这是有意的 |
| 5 | `04 §3.9.3` vs 本文 §3.9.3 | `04` 的 `seatNear` 要"在 `near` 的卡片旁边找座位"，本文的 `seatPresence` 要"锚卡片无行时先给它排座再取中心" | 两处都需要同一个能力："给一个路径拿到它的卡片中心，没有就先排座"。各写一份会分叉（比如一处先排座、一处返回 `null`） | 建议在 `local-store.ts` 抽一个共享私有 `anchorOf(layerId, path): Promise<{cx, cy}>`，`seatNear` 与 `seatPresence` 都调它。**已与 `04` 对齐**（其 `§3.9.3` 同样要求"锚卡片不存在时先排座"） |
| 6 | `doc-20 §4` vs `doc-21 §4.2` | `doc-20 §4`：「成功后追加**角色移动事件**并广播新的在场位置」 | 未点名事件 type；`doc-21 §4.2` 定的是 `character_moved`，`doc-20 §5` 还在说 `item_moved`（`01 §13` 冲突 1 已登记同类） | 改 `doc-20 §4` 末句为「追加 `character_moved` 事件；前端从 `world_event` 帧重取 `/api/layer` 得到新位置」 |
| 7 | `00 §5.2` vs 本文 §3.6.1 | `00 §5.2` 的 `following_changed` = `{ character, name, following }` | 前端要"跟随者的落点"（§6.1），而 `detail` 里没有 | **不是冲突，是设计**：位置在 `ActionResult.details` 里给 C 入口（`01 §11.2`），`detail` 保持三键。`00 §5.2` 不动 |
| 8 | `doc-02 §？` / 三处 `presence` 的既有描述 | `doc-06 §5.4` 说跟随的角色画布上"就是普通头像（类光标+圆形头像）"；`前端改造计划.md:184` 说 104px 光环头像 | 两处描述是否冲突？ | **不冲突**：`doc-06` 是"不额外做演出"（语义），前端计划是"渲染尺寸"（实现）。本文按 104px 半径的**点**语义（§3.9.4），排座体积另取 `CARD_FORMS.sprite` |

---

## 12. 仍然未知 / 留给评审拍板的

1. **`character_moved` 的 `subject` 用层目录还是角色 README？** 本文照 `01 §4` 表取 `dirOfLayer(to)`（层目录），理由是"这条事件在讲哪个空间"；但 `following_changed` / `character_talked` 都取角色 README（`01 §4` 表）。**同一个角色相关的两类事件用两个不同的 `subject` 基准**，会让 `doc-21 §5.4` 的合并规则 2（"同 `subject` 的连续 `entity_edited` 只留最后）在角色域上无法跨类型工作。`[推断]` 影响很小（角色域没有 `entity_edited`），但值得一句话拍板。

2. **`carryFollowers` 的 `actor` 是 `engine` 还是 `player`？** 本文定 `engine`（§3.6.2 的理由：玩家移动的是自己，不是别人）。若评审认为跟随是玩家的间接意图，改字面量即可，但 `doc-21 §4.2` 的渲染模板要分两套（按 `actor.type==='engine'` + `detail.from` 分派）。

3. **跟随人数上限**（`doc-06` 末尾待设计 #11 自己问了：「一个玩家最多跟几个角色？……MVP：任意数量跟随」）。本文按 MVP 不设上限——`carryFollowers` 遍历全部跟随者。**风险**：若 8 个角色同时跟随，一次换层落 1+8 条事件，作家的事件段（`doc-21 §5.2` 上限 12）会被跟随移动占掉大半。**建议**：先不设上限，实测若噪声大，加"只注入前 N 个 + 一句'另外还有 M 人跟着'"（归 `doc-21 §5.4` 的合并规则，不归本文）。

4. **`presence` 的 `x`/`y` 是中心还是左上角？** 本文定**中心**（§3.9.3 决定 1），依据是前端 `PresenceEntry{x,y}` 画的是圆心。**但 `cards` 表存左上角**——两套语义并存。若 `03` 的 `view_canvas` 或 `09` 的 `arrange` 将来要统一处理"卡片与角色"，这个不一致会变成一处需要对两个字段做符号运算的地方。**建议**：保持（改 `cards` 的语义代价远大于收益），但在 `00 §4` 或 `12` 的契约里写一句"cards 存左上角、presence 存中心"。

5. **`world.json` 的 `characters[].home` 是否该在 `set_following(true)` 时被"兑现"？** 本文只在**无 presence 行**时用它当落点（§3.6.1）。另一种设计是"每次 `following=true` 都先回 `home`"——但那会让"作家把 Watson 安排到 crime-scene，玩家点跟随"把 Watson 拽回 baker-street。本文取前者。

6. **`/api/characters` 要不要带 presence**（§6.5）：`At:` 现在显示的是 `home`。这不在 B1 的验收行里（`后端实现计划.md:563` 只要求 `move_to` 可用），但它是"角色 tab 看起来正确"的最后一环。**建议留到前端计划**。

7. **`[推断]` `statKind` 尚未冻结**：§3.2 的 `resolveDestinationLayer` 依赖 `03 §14 冲突 1` 请求冻结的 `statKind(relPath)`。`03` 已向 `01` 提出。若 `01` 不接受，退路是：目录判据用 `store.listFiles(destination)` 非空 + `destination` 不以 `.md` 结尾——**这条退路在 stub 空目录上会失败**（`listFiles` 对空目录与不存在都返回 `[]`，`03 §7.4` 实测），而那正是本文 §3.2 第 4 条要支持的合法情形。**因此 `statKind` 是本文的硬依赖，请评审优先拍板。**

---

## 13. 结构对照（`00 §7` 的 12 节 → 本文）

| `00 §7` | 本文 |
|---|---|
| 1 一句话与定位 | §1 |
| 2 签名与参数 | §2 |
| 3 行为契约（逐步） | §3 |
| 4 文件与副作用 | §4 |
| 5 落账 | §5 |
| 6 WS / 前端 | §6 |
| 7 错误与边界 | §7 |
| 8 代码落点 | §8 |
| 9 与现存实现的差异 | §9 |
| 10 验收与测试 | §10 |
| 11 发现的冲突 | §11 |
| 12 仍然未知 | §12 |

**本文的四个"定清"（任务书点名）的落点**：`character` 省略的默认自己 → §2.4；presence 表评估与"只更新 presence 不动目录" → §3.4 / §4.1；空位求取方案与碰撞判据 → §3.9；跟随的运行时语义与跨层跟移动 → §3.6。三个 destination 情形 + 跨层 case 的完整行为示例 → §3.2（推导表与代码）+ §3.9.5（实算 1/2/3）。
