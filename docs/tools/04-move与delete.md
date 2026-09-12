# doc-tools/04 `move` 与 `delete`

> 状态：**设计（2026-09-12）**，待评审。本文是 B1 工具面里唯一涉及**引用图**的一篇。
> 权威层级：`00-共同上下文.md`（冻结契约）> `doc-21-事件表协议.md` > `doc-20-agent工具与互动字段协议.md` > `doc-10-组件协议与官方组件清单.md` > 本文。
> 关联：`01-动作内核与事件落账.md` §2.5/§2.7/§6/§10.2（本文全部形状与 `refs.ts` 接口来自它）；`doc-20 §5`（`move` 语义）；`doc-05 §8.3`（move pass 三件事、dangling 兜底态）；`doc-10 E5/E13`（可移动性与线条不派生）；`doc-06 §2.5`（排座纪律）；`doc-21 §4.1`（`entity_moved` / `entity_deleted`）。
> 本文**只写设计，不改代码**。

---

## 1. 一句话与定位

**`move` 是唯一的世界物件搬移入口，`delete` 是唯一的世界内容删除入口；两者都先走同一套引用扫描，再落一条自足事件。**

- `move({ from, to, near? })` —— `doc-20 §5`。剧情上的**拿取 / 放下 / 摆放 / 给予**是同一件事的四个词：一个 `.md` 文件从一个目录搬到另一个目录。缺了引擎，四次搬移就是四次 `bash mv`，每次都会踩同一个 404。
- `delete({ path })` —— `doc-20 §1.1` 能力表 + `后端实现计划 §4`。删内容必须经过引擎，否则引用图会留下一片谁也认不出的悬空路径。
- 调用者有**三类**，共用同一份动作函数：作家 agent（`writer`）、角色 agent（`character:<id>`）、玩家 UI（拖拽走 `POST /api/move`，`player`）。上帝模式的直接删写走 `/api/god-action`（`god`），也复用 `removeEntity`。

**为什么这两件事必须由引擎做而不是原生文件工具**：`bash mv` 只搬了一个文件；世界里还有**第二张图**——别的 `.md` 里指向它的 md link / frontmatter 路径键（`gate.target` / `bg` / `path`…）/ 裸文件名提及，以及 `canvas.db` 里的 `cards` 行与 `links` 端点。搬文件不改这些，画布上就会出现"一张指向空气的卡片"和"一条断掉的线"（`doc-05 §8.3` 的教训来源）。

本文同时承载 `editEntity`（`01 §2.1` 把它与 `removeEntity` 放在同一个 `delete.ts`，因为它不注册独立工具，只服务 B2 hook 与 C 入口）与 `packages/shared/src/actions/refs.ts` 的**实现设计**（接口由 `01 §6.2` 冻结）。

---

## 2. 签名与参数

### 2.1 动作层（`packages/shared/src/actions/`，形状由 `01 §2.6` 冻结）

```ts
// actions/move.ts
export interface MoveEntityInput {
  /** 世界根相对路径、POSIX、无前导 './'、无绝对路径（00 §2.1）。必须是一个已存在的单文件 .md。 */
  from: string;
  /** 目标路径。允许给层目录，引擎补文件名（§3.7）。 */
  to: string;
  /** 可选。一个实体路径，必须与最终目标同层（doc-20 §5 的"放回柜台"）。 */
  near?: string;
}
export async function moveEntity(
  ctx: ActionContext, input: MoveEntityInput
): Promise<ActionResult<MoveEntityDetails>>;

export interface MoveEntityDetails {
  /** 稳定新路径 == `to` 的最终解析值（目录目标已展开）。 */
  path: string;
  from: string;
  to: string;
  /** 移动前读到的名字（frontmatter title，缺省 = 文件名去 .md）。事件里的 name 也是它。 */
  name: string;
  near?: string;
  /** 被就地重写的文件数（== rewroteFiles.length）。 */
  rewrote: number;
  /** 无法重写的引用记录数（== danglingRefs.length）。 */
  dangling: number;
  /** 明细：被改写的文件路径，排序去重。给前端/探针，不进事件（01 §6.3 第 5 条）。 */
  rewroteFiles: string[];
  /** 明细：断链记录。前端拿它渲染"已被带走……"兜底态（doc-05 §8.3）。 */
  danglingRefs: DanglingRef[];
  /** `near` 传了但不生效（同层改名）时置 true——不静默忽略（§3.9.4）。 */
  nearIgnored?: true;
  /** 排座结果；`SEAT_MAX_CANDIDATES` 耗尽时 `exhausted: true`——不静默（§3.9.3）。 */
  seat?: { exhausted: boolean };
  /** 'moved' 的 `event` 由包装层挂在 ActionResult 上（01 §2.2），不在 Details 里。 */
}
```

```ts
// actions/delete.ts  （01 §2.1 把 editEntity 也放在这个文件）
export interface RemoveEntityInput { path: string; }   // 01 §5 冻结：单数路径，一个动作一个实体
export async function removeEntity(
  ctx: ActionContext, input: RemoveEntityInput
): Promise<ActionResult<RemoveEntityDetails>>;

export interface RemoveEntityDetails {
  path: string;
  name: string;              // 删除前读到的名字
  dangling: number;          // 指向它的引用数（删除没有 rewrote —— 理由见 §3.2）
  danglingRefs: DanglingRef[];
}

export interface EditEntityInput {
  path: string;
  frontmatter?: Record<string, any>;   // 浅合并；值为 null 表示删这个键
  body?: string;                       // 整段替换；缺省 = 不动正文
}
export async function editEntity(
  ctx: ActionContext, input: EditEntityInput
): Promise<ActionResult<EditEntityDetails>>;
export interface EditEntityDetails { path: string; name: string; kind: string; }
```

`removeEntity` 的入参**保持 `string` 而非 `string[]`**（`01` 定案）：一个实体一条 `entity_deleted`，而 `detail` 必须自足（带此刻的 `name`）——批量会让一次调用要么产出 N 条事件，要么产出一条说不出名字的 `detail`。UI 多选删除时由路由循环调用。

### 2.2 工具层（`extensions/toolkit/move.ts` / `delete.ts`，`00 §6.2` 冻结形状）

```ts
pi.registerTool({
  name: 'move',
  label: 'Move',
  description:
    'Move one world entity file to a new path. Use it for every take / drop / place / give: ' +
    'picking a key up (world/inn/key.md -> player/key.md), handing a letter over ' +
    '(characters/watson/letter.md -> player/letter.md), or putting something back ' +
    '(player/key.md -> world/inn/key.md, near world/inn/counter.md). ' +
    'The engine moves the file, rewrites every reference that pointed at it, migrates its ' +
    'canvas card, seats it by `near` or in a free cell, and records the change. ' +
    'Never use bash mv or write to move an entity: that breaks references silently. ' +
    'Move a character with move_to; move only handles object files.',
  parameters: Type.Object({
    from: Type.String({ description: 'World-relative path of the entity to move, e.g. "world/inn/key.md".' }),
    to: Type.String({ description: 'World-relative destination, e.g. "player/key.md". A layer directory is accepted and the filename is kept.' }),
    near: Type.Optional(Type.String({ description: 'An entity path in the destination layer to seat the moved card next to, e.g. "world/inn/counter.md".' })),
  }),
  promptSnippet: 'move(from, to, near?) — take / drop / place / give one entity file through the engine',
  promptGuidelines: [
    'Use move to take, drop, place or give an entity; never use bash mv or write for that.',
    'Use move with `near` to put an object back next to a specific card in the destination scene.',
    'Use move_to to move a character; move only moves object files.',
  ],
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    const svc = getActionService(ctx);          // toolkit/store.ts + toolkit/actor.ts（归 12）
    try { return ok(await svc.moveEntity({ from: params.from, to: params.to, near: params.near })); }
    catch (err) { if (err instanceof ActionError) return err.toToolResult(); throw err; }
  },
});
```

`delete` 同形：`parameters: Type.Object({ path: Type.String(...) })`，`execute` 调 `svc.removeEntity`。它的 description 必须点名"用 `delete` 而不是 `bash rm`，否则引用会变成断链"，并把断链后果说清。

### 2.3 `near` 的语义边界

- `near` **必须属于最终目标层**：`resolveLayer(near) === resolveLayer(finalTo)`，不等则 `ActionError('near_out_of_layer')`（文案见 `01 §7.2`）。与 `b1-design-05` 的 `move_to` 同一条口径（已对齐）。
- `near` 必须是**实体/卡片路径，不是层目录**：`near: 'world/baker-street'` → `near_out_of_layer`（`move_to` 侧同样处理）。
- `near` 必须**已存在**。它的卡片行不存在时，引擎先给它排座再拿它当锚（§3.9）。
- 不满足就**报错，不静默忽略**——否则作家以为摆到了柜台边，实际落在画布中心。

---

## 3. 行为契约（逐步）

### 3.1 `move` 的九个步骤

顺序不可换（`01 §3.1` 五步骨架在 `move` 上的展开）。每步的"漏了会怎样"就是它存在的理由。

| # | 步骤 | 漏了会怎样 |
|---|---|---|
| 1 | **规范化并校验 `from` / `to` / `near`**：路径纪律（`00 §2.1` + `01 §7.3` 的双层 `resolvePath`）；`from` 必须存在、是单文件、`.md`、basename 不是 `README.md`（`00 §2.4`）；`from === to` → `invalid_argument`。 | `path.join(worldRoot, '../etc')` 逃出世界根，`move` 变成越权写入通道。README 被搬走 = 一个层失去身份：目录还在，门牌没了。 |
| 2 | **读 `from` 的原始内容 + frontmatter**，取 `name`（`title` ?? basename 去 `.md`）与 `oldDir`（第 7 步自身重定基要用）。 | 落账时得回读世界目录取名字，而文件已经不在原处（`doc-21 §3.3` 明禁回读）。 |
| 3 | **解析最终目标**：`to` 是层目录时展开为 `<to>/<basename(from)>`（§3.7）；目标已存在 → `already_exists`（**绝不覆盖**）。 | `fs.rename` 是覆盖语义：一个同名物件会**静默吃掉**另一个。 |
| 4 | **`near` 校验**（§2.3）并规范化。 | 卡片摆到别的层里，或摆到画布中心而作者以为摆到了柜台边。 |
| 5 | **`rename(from, to)`** —— 唯一的物理动作。 | 无。 |
| 6 | **引用重写**：`scanRefs(store, from, to)` → `rewriteRefs(...)`，两趟、只改记录的偏移（§3.6）。 | 引用图断裂：别的 md 里的 md link / frontmatter 路径键（`gate.target` / `bg` / `path`…）全部 404。 |
| 7 | **自身重定基**：被移动文件**自己的相对引用**在新目录里必须重算（§3.6.5）。 | `player/key.md` 里的 `[船票](./boat-ticket.md)` 搬到 `world/inn/` 后指向 `world/inn/boat-ticket.md`——一个不存在的位置。现状实现**完全没做**这一步。 |
| 8 | **画布迁移**：`renameCardPosition(from, to)`，跨出画布边界则 `dropCard(from)`（§3.8）。 | 同一张卡片出现两个座位（两个 id 指向同一个文件）；或背包物件被静默 relayer 到 `map` 层（§3.8 的现状 bug）。 |
| 9 | **排座**（仅当最终目标在层树内）与**落账**：`appendEvent('entity_moved', { from, to, name, near?, rewrote, dangling })`，`subject = to`，`layer = resolveLayer(from) ?? resolveLayer(to)`；返回 `{ text, details }`。 | 世界变了但作家/角色/历史面板都不知道（`doc-21 §1` 第三问判死）。 |

`move` 的动作函数**只做校验 + 编排**：物理搬移与引用重写落在 `WorldStore.move`（`01 §2.7` 保留该签名），画布落 `canvas.db`，事件落 `history.db`。

### 3.2 `delete` 的七个步骤

| # | 步骤 | 漏了会怎样 |
|---|---|---|
| 1 | 校验 `path`：存在、单文件、`.md`、basename 不是 `README.md`。 | 删掉一个层的门牌，目录变孤儿；或删掉一整个层目录。 |
| 2 | 读内容 + frontmatter，取 `name`。 | 事件无法自足（`doc-21 §3.3`）。 |
| 3 | **`scanRefs(store, path, path)`（只扫，不改）**，得到断链清单（§3.6.4 的 body-mention 判定 + §3.6.8 的 reason）。 | 断链记录为空：前端不会给"已被带走……"兜底态，作家看不出世界少了什么。 |
| 4 | **`dropCard(path)`**：删 `cards` 行 + 级联删掉触及它的 `links` 行（`b1-design-09` 冻结的方法）。 | 画布上留一张指向空气的卡片，`links` 留一条死线。 |
| 5 | `deleteFile(path)`。 | 无。 |
| 6 | `appendEvent('entity_deleted', { path, name })`，`subject = path`，`layer = resolveLayer(path)`。 | 玩家/作家不知道东西没了；`doc-21 §4.1` 的人话「铜钥匙不见了」永远不出现。 |
| 7 | 返回 `{ text, details }`，`details.danglingRefs` 供前端马上给兜底态。 | 前端要等下一帧 `world_event` 才知道该把引用渲染成断链。 |

**删除为什么不改指向它的文件**：`move` 改引用是因为**引用意图没变、只是位置变了**，引擎有唯一正确答案。删除没有正确答案——引用它的作者得自己决定那句叙事改成什么（"那把钥匙被人拿走了"还是一整段重写）。引擎的职责是**把断链报出来**（`dangling` + 前端兜底态 + 事件），不是替作者编句子。这与 `01 §6.3` 第 2 条（`body-mention` 永不自动改写）是同一条原则。

### 3.3 `editEntity` 的最小契约

不注册工具，只服务三处：B2 的 `tool_result` hook（agent 用原生 `edit` 改世界后落 `entity_edited`）、C 入口的 `/api/god-action`（上帝改写）、以及将来程序化改 frontmatter 的地方。

**B 入口（`tool_result` hook）的落账口径**（`00 §4.2` / `01 §4` 对齐，m-14）：hook 只兜原生 `write` / `edit`，**`editEntity` 只管 `entity_edited`**——原生 `edit` 改已有实体落 `entity_edited`；原生 `write` 新建实体落 **`entity_created`**（`12 §2.4.1` 的 `createEntity` 同形）。**handler（`use_item` 等）不得产事件**（`08 §3.4` 的严口径）。B1 只定口径，hook 本身 B2 落地。

1. 校验 `path`；读内容，记 `name` 与 `kind`（`eventKindOf(frontmatter, filename)`，重写前后不变）。
2. 合并 frontmatter（浅合并，`null` 值删键）与/或替换 body（缺省 = 不动正文）；**用 `writeFileAtomic` 写回**（`01 §10.3`）。
3. `appendEvent('entity_edited', { path, name, kind })`，`subject = path`（`01 §3.9`；这是 `doc-21 §5.4` 合并规则第 2 条生效的前提）。
4. **不做引用扫描** —— 理由同 §3.2。

**`eventKindOf(fm, filename): 'chalk' | 'component' | 'note' | 'letter' | 'other'`**（本文导出，见 §8.1）：`gate` / `sprite` / `type: component` → `component`；无法判定 → `other`。它的输出是 `00 §5.2` 的 `entity_created.detail.kind` 封闭五值枚举，与 `cardKindOf`（`chalk/gate/letter/note/sprite/default`，`forms.ts:44`）**不是同一个集合**。`12 §2.4.1` 的 `createEntity` 复用本 helper。

### 3.4 失败语义（`01 §3.6` 在本文的实例化）

任何一步失败 → 抛 `ActionError`，**不落事件**。第 5–9 步之间失败时"文件已动、账没落"**不回滚文件**——回滚 `rename` 会覆盖玩家在同一瞬间的另一次搬移（`01 §10.2` 定案）。

特别地：**第 8 步的画布迁移失败不再只 warn**。现状 `routes/world.ts:298-302` 把失败吞成一行日志，结果正是那句注释本来在防的 bug（同一卡片两个座位）。改成抛 `ActionError('internal', 'Entity moved but its canvas card could not be migrated: ...')`，让不一致立刻可见。

### 3.5 `move` 的调用者矩阵

| 剧情 / UI 动作 | `from` | `to` | `near` | actor |
|---|---|---|---|---|
| 玩家拿起钥匙 | `world/inn/key.md` | `player/key.md` | — | `player` |
| 角色拿起钥匙 | `world/inn/key.md` | `characters/watson/key.md` | — | `character:watson` |
| 角色把信交给玩家 | `characters/watson/letter.md` | `player/letter.md` | — | `character:watson` |
| 把钥匙放回柜台 | `player/key.md` | `world/inn/key.md` | `world/inn/counter.md` | `player` |
| 作家把证据摆到桌上 | `player/ticket.md` | `world/baker-street` | `world/baker-street/evening.md` | `writer` |

前四行逐字来自 `doc-20 §5` 的表；第五行演示 §3.7 的目录目标 + `near`。

### 3.6 引用重写的算法（`refs.ts` 实现，接口见 `01 §6.2`）

#### 3.6.1 为什么是两趟

`scanRefs`（只读）先算出**全部** `RefSite`（带 `start`/`end` 字符偏移），`rewriteRefs` 再按偏移替换。一趟"边走边改"会让后面所有偏移失效——这正是现状 `replaceAll` 错误的第二个根源。**扫描与改写必须分开**，因为改写本身会改变字节长度。

#### 3.6.2 `scanRefs(store, from, to)` —— 第一步：枚举候选文件

```
files = await store.listFiles()          // 已过滤 .airpworld / node_modules / 点开头（local-store.ts:91-109）
candidates = files.filter(f =>
     f.endsWith('.md') || f === 'world.json'
  || f.endsWith('.json') || f.endsWith('.yml') || f.endsWith('.yaml')   // [决策] 见 §11 冲突 2
)
fromBase = basename(from)                // 'copper-key.md'
fromNoExt = fromBase.replace(/\.md$/, '')  // 'copper-key'
```

**候选预筛（廉价、宁松勿紧）**：读文件前先用一次原文 `includes(fromBase) || includes(fromNoExt) || includes(from)` 判"这个文件有没有可能提到它"。预筛只是省 I/O，**不是判定**——命中它的文件才进精确扫描，精确扫描才决定是不是真引用。反过来（预筛判无 → 跳过）会漏，所以预筛条件必须宽于真实判定。

#### 3.6.3 `scanRefs` —— 第二步：在一个文件里定位四类 span

对每个候选文件，按**同一个遍历顺序**产出 `RefSite[]`，互不重叠：

```
1. 切出 frontmatter 块与正文（复用 parseFrontmatter 的分割正则，frontmatter.ts:30：
   /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/）
2. frontmatter 内（按行 + 缩进）：
   a. 顶层键 ∈ {path, src, bg, background, ref, home, target}:
        - key === 'target' 且 (type === 'gate' || 文件是 README.md) → 'gate-target'
        - key === 'target' 且其它 → 不是引用（sprite 的 target 是角色 id；见 §11 冲突 3）
        - 其它键 → 'frontmatter-path'
      要求值是非空标量字符串；列表项（`- xxx`）也逐项收
   b. 其它键（title / desc / expect / status.data.* / choice 列表项）→ 不产出 RefSite（最多在
      第 4 类里作为 body-mention）
   *`link_to` / `append_to` 不再是 frontmatter 键*（02 §9.5 定案：它们是 `chalk` 的工具参数），
   `RefKind` 同步删除这两个值；手写遗留的同名键**不扫、不改**（`09 §11` 冲突 4 的 B 案）。
3. 正文内：
   a. 行内 markdown link  [text](dest)          → 'markdown-link'
   b. 图片/资源  ![alt](dest)                    → 'asset-ref'
   c. HTML  <img src="…"> / <a href="…">        → 'asset-ref'
   d. 裸 basename 出现（body-mention 扫描，§3.6.4）→ 'body-mention'
4. 每个 span 记录 start/end/raw（原文切片）与 target
```

**`target` 的规范化**：`dest` 先剥离可选的 `<...>` 包裹、URL 解码、丢弃 `#fragment` 与 `?query`，然后交给 `resolveRefTarget(ref, currentFile, allFiles)`（`01 §6.2` 冻结的纯函数）：

- 绝对世界根路径（`/world/inn/key.md` 或 `world/inn/key.md`）→ 直接比对；
- 相对路径（`./key.md`、`../a/key.md`）→ 以 `dirname(currentFile)` 为基准做 POSIX 解析（**不能**用 `path.join`，它在 Windows 上会产出 `\`）；
- 解析结果必须**精确等于** `from` 才算命中——**路径段边界比较，不是 `includes`**：`world/inn/key.md.bak`、`world/inn/key.mdX`、`world/in/key.md` 全部**不命中**（这是现状缺陷 #1 的修法）；
- `resolveRefTarget` 返回 `null`（无法解析 / 歧义）→ 该 span 不产出引用，落入 §3.6.4 的 body-mention 判定。

#### 3.6.4 `body-mention`：识别，但**永不改写**

**定义**：在文件原文里，任何一处形如 `fromBase`（`copper-key.md`）或 `fromNoExt`（`copper-key`）的**出现**，只要它**不在**上一步已捕获的任何引用 span 内，且**不落在更长的路径/文件名 token 内**，就是一条 `body-mention`。

token 边界用"前后不是 `[A-Za-z0-9_./\\-]`"判定（等价于 `\b` 但把 `/`、`.`、`-` 也算作词内字符——否则 `copper-key.md` 里的 `copper` 会被单独命中）；并且要求它前后**不**构成更长的路径段（`world/inn/copper-key.md` 是引用，不是 mention）。

处理：

- `move`：**不改写**，只作为 `DanglingRef { file, target: fromBase, reason: 'ambiguous' }` 计入 `dangling`。
- `delete`：同样不改写，只计入 `dangling`。
- **正面判据（任务点名要防的误改）**：正文里写「他把`铜钥匙`落在了柜台上」——`铜钥匙` 不是 `fromBase`，连 mention 都不算，**不产生任何 RefSite**；正文里写「钥匙」（`copper-key.md` 的中文名）同理**完全不匹配**。只有**逐字出现文件名**才可能是 mention。
- **唯一允许改写的 mention 例外**：`target` 能**无歧义解析**为一个存在文件、且该文件就是 `from`（例如正文写 `[见这里](copper-key.md)`——那是标准 md link，走 `markdown-link` 而非 mention）。**纯裸文本永不自动改写**（`01 §6.3` 第 2 条）。

> **为什么 mention 不改是安全的选择**：`doc-21 §3` 反复强调"事件记事实不编句子"。改写叙事正文里的一句话，等于引擎替作者重写剧本。断链是可恢复的（作者下一轮看到 `dangling` 就能改）；被篡改的叙事是**不可发现的损失**。

#### 3.6.5 `rewriteRefs(store, from, to, sites)` —— 第三步：精确替换

```
byFile = group(sites, s => s.file)
for (file, list) of byFile:
    raw = await store.readFile(file)
    // 从后往前替换，偏移才不被前面的长度变化打乱
    for s of sortByStartDesc(list):
        replacement = buildReplacement(s, from, to, file)   // 见下
        if replacement === null:  dangling.push({file, target: s.target, reason: …}); continue
        raw = raw.slice(0, s.start) + replacement + raw.slice(s.end)
    await store.writeFileAtomic(file, raw)     // 一个文件一次写盘（01 §6.3 第 3 条）
    rewrote.push(file)
```

**`buildReplacement(site, from, to, file)` —— 按种类重算目标串**：

| kind | 替换为 |
|---|---|
| `gate-target` / `frontmatter-path` | 直接写 `to`（frontmatter 的路径键一律用世界根相对路径，`00 §2.1`）；若原值带引号则保留引号 |
| `markdown-link` / `asset-ref` | `relFrom(dirname(file), to)` 相对路径。**原值如果是相对路径，改写后仍是相对路径**（`[x](./x.md)` 保持 `./` 前缀风格）；原值如果是世界根绝对路径，改写后仍是绝对路径——**不擅自换风格**（换风格会让 diff 噪声淹没真实改动） |
| `body-mention` | `null`（永不改写） |

`relFrom(dir, target)`：以 `dir` 为基准算 POSIX 相对路径。若两者目录相同 → `./` + basename（保持 `./` 风格）；否则正常 `../` 展开。**绝不用 `path.relative`**（Windows 反斜杠）。

#### 3.6.6 被移动文件**自己**的引用（第 7 步）

搬走一个文件后，它正文里的相对引用在新目录里全部失效。做法：把**它自己**当作一个普通候选文件交给同一套 `scanRefs`——但 `from` 传的是它的**旧目录基准**，替换时用新目录基准：

```
selfSites = await scanOwnRefs(store, to, oldDir)     // 扫自身正文里的 markdown-link / asset-ref
rewriteOwnRefs(store, to, oldDir, newDir)            // 每个相对目标重定基：relFrom(newDir, absTargetOf(oldDir, ref))
```

**只重定基相对引用**：`to` 自身里的世界根绝对路径（`world/inn/x.md`）不受搬移影响，**不动**。这一趟**不落 dangling**——自身引用的修复是搬移的一部分，不是世界图的断裂。

#### 3.6.7 `world.json` 的引用（`01 §6.2` 未列，本文建议补）

`doc-05 §8.3` 明写引用重写要覆盖 "world.json 引用"。现状 `world.json` 里 `characters[].home = "world/baker-street"` 是**目录**，不是文件，`move` 一个文件不会命中。但题材包可能放文件路径。实现：`scanRefs` 对 `world.json` 做 `JSON.parse`，深度遍历字符串叶子，值**精确等于** `from` 的叶子产出一条 `RefSite{ kind: 'asset-ref' }`（复用），改写后 `JSON.stringify(_, null, 2)` 写回（保持现有缩进风格，`updateManifest` 用 2 空格）。

> **`RefKind` 是否新增 `world-json`**：`01 §6.2` 的七种里没有它，但 `asset-ref` 语义上能覆盖（"一个指向资源的路径"）。本文用 `asset-ref` 复用，**不新增枚举值**——避免改动 01 已冻结的 `RefKind`。登记在 §11 冲突 1 供评审。

#### 3.6.8 `dangling` 的 `reason` 取值

`DanglingRef.reason`（`schemas/events.ts` 定义，`01 §2.5`）只有两个值，实现按此映射：

| 情形 | reason |
|---|---|
| 裸 basename 出现在正文，无法无歧义解析为文件（§3.6.4） | `'ambiguous'` |
| 候选文件读失败（权限 / 竞态删除 / 坏编码） | `'unreadable'` |

**没有第三个值**：`from` 是已知存在（第 1 步校验过），"引用指向的路径已不存在"不是可能状态。若发现需要第三值，是 `01 §6.2` 的枚举要扩——登记为待评审（§12）。

### 3.7 目录目标展开（[决策]，需评审）

`to` 不以 `.md` 结尾 **且** `resolveLayer(to) !== null`（它确实是一个层目录）→ 展开为 `<to>/<basename(from)>`，再走第 3 步存在性校验。

- **理由**：`doc-06 §5.1` 的"背包道具拖回场景"在 UI 上天然只有层信息；`move_to` 的 `destination` 本就是目录语义（`doc-20 §4`）。让 `move` 也接受目录，提示词里就只剩一条规则（"放回去就给目录"），少一类"该写 `world/inn` 还是 `world/inn/key.md`"的犹豫。
- **边界**：`to` 不以 `.md` 结尾且 `resolveLayer(to) === null` → `invalid_argument`（`Move destination "world/inn/key" is neither a .md path nor a known layer directory`）。**不猜**。
- `doc-20 §5` 的示例全部给完整文件路径，本决策是**超集**，不违反它。评审若要收紧，删掉本小节即可（第 3 步退化为"`to` 必须是完整文件路径"）。

### 3.8 画布卡片迁移（`renameCardPosition` 的重写）

#### 3.8.1 现状审查（`local-store.ts:432-441`）

```ts
async renameCardPosition(from: string, to: string): Promise<void> {
  const layer = await this.deriveLayer(to);
  this.execCanvas('UPDATE cards SET id = ?, layer = ? WHERE id = ?', [to, layer, from]);
  try {
    this.execCanvas('UPDATE links SET from_id = ? WHERE from_id = ?', [to, from]);
    this.execCanvas('UPDATE links SET to_id = ? WHERE to_id = ?', [to, from]);
  } catch (err) { console.warn('[renameCardPosition] link migration skipped:', err); }
}
```

三个问题：

1. **`links` 的 `layer` 列不跟改**。`links` 行有 `layer`（`db/schema.ts:21`），`/layer` 路由按 `WHERE layer = ?` 查（`world.ts:210-212`）。移动后线的两个端点都换了层，`links.layer` 却留在旧层 → 线在新层查不到、在旧层端点又找不到（`LinkLayer.tsx:185` 静默跳过）→ **线凭空消失**。
2. **`deriveLayer(to)` 对非层路径返回 `'map'`**（`layers.ts:126-135` 的 `layerOfPath` 默认 `MAP_LAYER`）。把 `world/inn/key.md` 移进 `player/key.md` 会把卡片行 relayer 到 `map`——**背包物件被静默塞进大地图画布**。这是 bug（`b1-design-09` 已确认）。
3. **catch 吞错**（§3.4 已述）。

#### 3.8.2 重写后的规则（与 `b1-design-09` 对齐，已确认）

```
renameCardPosition(from, to):
  fromLayer = await resolveLayer(from)      // string | null
  toLayer   = await resolveLayer(to)        // string | null

  if toLayer === null:
    // 目标不在画布层树里（player/、characters/、世界外）：卡片离开画布
    dropCard(from)                          // 删 cards 行 + 级联删 links 端点行（09 冻结）
    return

  // 目标在层内：改 id + layer
  UPDATE cards SET id = ?, layer = ? WHERE id = ?   [to, toLayer, from]
  // links 端点跟改；线的 layer 取「仍在本层的那个端点」的层，两端都离开则删行
  UPDATE links SET from_id = ?, layer = ? WHERE from_id = ?
  UPDATE links SET to_id   = ?, layer = ? WHERE to_id = ?
```

**`links` 遇 `toLayer === null`**：与 `cards` 不同，**不删**。`b1-design-09` 冻结的口径：一条线指向一个已离开画布的物件，是设计中的 dangling 状态（`LinkLayer.tsx:185` 保留 DB 行、不渲染）；物件回来时线自动复活。这正是 `doc-05 §8.3` "dangling 断链兜底态"在关系线域的对应。

> `dropCard(from)` 只在**卡片跨出画布边界**时调用（场景 → 背包 / 小天地）。背包内挪文件（`player/a.md` → `player/b.md`）两边都是 `null`，`dropCard` 对一行不存在的卡片是 no-op，安全。

### 3.9 排座（`near` 吸附与空位）

#### 3.9.1 纪律（`doc-06 §2.5`）

**只给没有坐标的新物件排落脚点，已摆放的永不重排。** 因此 `move` 只在两种情况下写坐标：

1. **`near` 给了**（仅当移动前后**层发生变化**，或目标本来就没有卡片行）→ 在 `near` 旁边找座位（§3.9.3）。
2. **没给 `near`，且目标是新进入的层**（目标层内没有该路径的卡片行）→ 走 `seatUnplaced`（`local-store.ts:291-357`），在层内找空位。

**移动前后同层（改名）时不动座位**：`world/inn/key.md` → `world/inn/rusty-key.md`，`renameCardPosition` 已把 `cards.id` 跟改，x/y 保持不变——玩家摆好的位置不会因为改个名就跳走。这是 `doc-06 §2.5` 的直接兑现。

#### 3.9.2 复用 `seatUnplaced`（`local-store.ts:291-357`）

已有的螺旋排座：`SEAT_ANCHOR = {x:960, y:540}`，`SEAT_STEP = 96`，`SEAT_PAD = 22`，`spiralCells()` 生成 Ulam 螺旋格（`local-store.ts:23-46`），对每格检查 `overlapsOccupied`（`:478-491`），最多 `SEAT_MAX_CANDIDATES = 600` 格，耗尽时落到**最后试过的格**（不是锚点——`:330-343` 的注释说明了两张溢出卡片会叠在同一点）。`move` **直接调用它**，不另写一份：

```ts
await store.seatUnplaced(targetLayer, [{ path: to, w, h }]);   // w/h 由 cardFormOf 给
```

`w/h` 必须来自 `cardFormOf(frontmatter, filename)`（`forms.ts:58`）——**座位尺寸与画出来的尺寸是同一张表**，这是 `world.ts:190-194` 的既有纪律。

#### 3.9.3 `near` 吸附算法（本文新增 `seatNear`）

在 `near` 的卡片旁边找座位，仍是螺旋，但**锚点换成 `near` 卡片的中心**，且**锚格留给邻居、从第 1 圈起**：

```ts
/** packages/shared/src/store/local-store.ts（04 的实现；01 §2.7 未列，见 §11 冲突 4） */
async seatNear(layerId: string, file: SeatFile, anchorPath: string): Promise<CardRecord> {
  const anchor = this.getLayerCards([anchorPath])[0];
  // 锚卡片没座位：先给它排一座，再拿它当锚（避免近旁排座在空气旁）
  if (!anchor) await this.seatUnplaced(layerId, [anchorPath]);
  const a = this.getLayerCards([anchorPath])[0];          // 重读，拿真实 x/y/w/h

  const w = file.w ?? 280, h = file.h ?? 180;
  const occupied = this.cardsInLayer(layerId).map(cardBounds);   // 本层全部卡片（含锚）
  const nextZ = this.maxZofLayer(layerId) + 1;

  let placed = { x: a.x - w, y: a.y };                    // 兜底：锚左侧一格宽
  let tries = 0;
  for (const [gx, gy] of spiralCellsAt(a.cx, a.cy)) {     // 以锚中心为原点的螺旋
    if (tries++ >= SEAT_MAX_CANDIDATES) break;
    const cx = a.cx + gx * SEAT_STEP, cy = a.cy + gy * SEAT_STEP;
    if (gx === 0 && gy === 0) continue;                   // 锚自己的格不占
    placed = { x: cx - w / 2, y: cy - h / 2 };
    if (!overlapsOccupied(occupied, cx, cy, w, h)) break;
  }
  this.execCanvas(`INSERT INTO cards (id, layer, x, y, width, height, z_index)
                   VALUES (?,?,?,?,?,?,?)
                   ON CONFLICT(id) DO UPDATE SET layer=excluded.layer, x=excluded.x,
                     y=excluded.y, width=excluded.width, height=excluded.height`,
                  [file.path, layerId, placed.x, placed.y, w, h, nextZ]);
  return { id: file.path, layer: layerId, x: placed.x, y: placed.y, w, h, z: nextZ };
}
```

要点：

- **锚点即 `near` 卡片中心**（不是 `SEAT_ANCHOR`），螺旋复用 `spiralCells()` 的步进与方向，只是平移原点。`doc-06 §2.5` 的"锚点 = 相关物件"由此兑现。
- **占用集 = 本层全部卡片**（含锚）。锚自身那一格 `continue` 跳过，但从第 1 圈开始找——邻居会落在锚的正右/正下（螺旋第一步即 `(1,0)`）。
- `ON CONFLICT DO UPDATE`（不是 `DO NOTHING`）：这是**主动摆放**，允许覆盖旧行；而 `seatUnplaced` 的 `DO NOTHING` 是"只补缺失行"的语义（`:346-351`）。两者语义不同，不能混用。
- z 取本层最大 +1（与 `seatUnplaced:302-307` 同法），保证新放下的东西在最上面。
- 失败兜底：`SEAT_MAX_CANDIDATES` 耗尽时落**最后试过的格**（与 `seatUnplaced` 一致，绝不默认落锚点——那会与锚重叠）。**不抛错**（座位不理想远好过整个 `move` 失败——物件已经搬走了），但**不静默**：`details.seat = { exhausted: true }`，返回文本显式说明"卡片落在 `near` 附近但未能完全不重叠"。

#### 3.9.4 `near` 与层变换的交互

`near` 只在移动到**新层**或目标**无卡片行**时有意义。移动到同层的新名字且传了 `near` → **忽略 `near`，但不静默**：`details.nearIgnored = true`，返回文本显式说明（`doc-06 §2.5` 说已摆放的永不重排）。[决策] 或改为报错 `invalid_argument`（`near is only meaningful when the entity changes layer`）——本文取 **忽略 + 显式报告**，理由是作家可能批量搬动时统一传 `near`，报错会让整批失败。登记 §12。

`seatNear` / `seatUnplaced` 的**归属**：`b1-design-05` 明确不共用——`move_to` 的 presence 排座占用域不同（`presence` 行 ∪ `cards` 行，且 presence 只有点没有 w/h）。**04 拥有卡片排座（`seatNear` / `seatUnplaced`），05 拥有 `seatPresence`**；两边**引用同一组 `SEAT_STEP` / `SEAT_PAD` 常量**，不各定义一份。

---

## 4. 文件与副作用

### 4.1 `move` 触碰什么（白名单，超出即 bug）

| 目标 | 动作 | 原子性 |
|---|---|---|
| `<worldRoot>/<from>` → `<worldRoot>/<to>` | `fs.rename`（同卷原子） | 单次调用 |
| 每个含 `from` 引用的 `.md`（含 `to` 自己，§3.6.6） | `writeFileAtomic` | 同目录 tmp + rename（`01 §10.3`） |
| `<worldRoot>/world.json` | 仅当某字符串叶子精确等于 `from` 时改写（§3.6.7） | `writeFileAtomic`，2 空格缩进 |
| `.airpworld/canvas.db` 的 `cards` / `links` | `renameCardPosition` / `seatNear` / `seatUnplaced` / `dropCard` | 单语句 |
| `.airpworld/history.db` 的 `events` | `appendEvent` 一条 | `BEGIN IMMEDIATE` |

> `placeCard` / `placeCards` 的签名由 09 §4.2 冻结：`placeCard(layer: string, path: string, box: { x?; y?; z? })`。`layer` **显式传入**（不靠内部 `resolveLayer(path)` 推导——`cards.layer` 是 NOT NULL，且 `player/**` 推导会落到 `'map'`，§3.8.1 问题 2 就是它）。本文的 `seatNear` / `seatUnplaced` 都显式收 `layerId`，落行时同样不推导。

**不写**：任何状态文件、`world.json` 的 `layers` 键、任何世界根之外的路径（`01 §10.1`）。

### 4.2 `delete` 触碰什么

| 目标 | 动作 |
|---|---|
| `<worldRoot>/<path>` | `deleteFile` |
| `.airpworld/canvas.db` | `dropCard(path)`：删 `cards` 行 + `DELETE FROM links WHERE from_id = ? OR to_id = ?` |
| `.airpworld/history.db` | `appendEvent('entity_deleted')` 一条 |
| 其它 `.md` | **一个字节都不改**（§3.2） |

### 4.3 命名与 frontmatter

`move` 与 `delete` **都不新建 frontmatter、不改 `type`**——搬走一件东西不会改变它是什么。`00 §2.3` 的 `NN-<slug>.md` 命名约定是 `chalk` 的；搬移一个已有文件**不改名**（保持 basename，`00 §2.3` 末段"引擎对既有文件只读不改名"）。

### 4.4 可移动实体判定（`00 §2.4` 冻结）

`move` / `delete` 的适用对象 = **一个单文件 `*.md`**，位于 `world/`、`player/`、`characters/<id>/` 之下，且 basename **不是** `README.md`。

| 输入 | 结果 | 错误码 |
|---|---|---|
| `world/inn/key.md` | ✅ | — |
| `player/old-boat-ticket.md` | ✅ | — |
| `characters/watson/letter.md` | ✅ | — |
| `world/inn/README.md` | ❌ 层门牌是层的身份 | `not_movable` |
| `world/inn`（目录） | ❌ `move only accepts a single .md file` | `not_movable` |
| `.airpworld/assets/x.md` | ❌ 保留前缀 | `invalid_path` |
| `world/inn/key`（无后缀） | ❌（`move` 的 `from`） | `invalid_argument` |
| `world/inn/key.md` 不存在 | ❌ | `not_found` |
| `world/inn/key.md` 已存在于 `to` | ❌ 不覆盖 | `already_exists` |

**引擎层不做类型白名单**：`type: chalk` / `note` / `letter` / 题材包组件一律可 `move`。`doc-10 E5` 的 `BAG_TYPES = ['note','letter']` 是**呈现层**约束（前端只把这些卡片渲染成可拖拽），本文**刻意放宽**（`00 §2.4` 已登记理由）：引擎的移动是文件语义，不能因为它认不出某个题材包组件就拒绝移动。**`gate` 天然不可移动**（它由 `README.md` 派生，而 `README.md` 不可移动）。

---

## 5. 落账

### 5.1 `entity_moved` 全字段（`00 §5.2` / `01 §2.5` 冻结）

| 字段 | 值 | 来源 |
|---|---|---|
| `type` | `'entity_moved'` | — |
| `actor` | 调用者（`player` / `god` / `writer` / `character`+id） | `01 §3.5` 的接线表 |
| `subject` | `to`（最终解析后的新路径） | `01 §3.9`（合并规则第 3 条 `entity_created` 后紧跟同 `subject` 的 `entity_moved` 靠它） |
| `layer` | `resolveLayer(from) ?? resolveLayer(to)`；两端都不在层树 → `null` | `01 §3.9` 的例外规则 |
| `turn` | 当前锚（A 入口 `turn:<session>:<n>`；C 入口 `req:<uuid>`） | `01 §3.7` |
| `detail.from` | 移动前的世界根相对路径 | 输入 |
| `detail.to` | 移动后的世界根相对路径 | 解析后的 `to` |
| `detail.name` | **移动前**读到的 `title`（缺省 = basename 去 `.md`） | 第 2 步 |
| `detail.near` | `near` 的原值（**仅当传了且生效**；未传 → 省略该键） | 第 4 步 |
| `detail.rewrote` | `rewroteFiles.length`（重写的**文件数**） | `RewriteResult` |
| `detail.dangling` | `danglingRefs.length`（断链**记录数**） | `RewriteResult` |

`layer` 的例外规则示例：`world/inn/key.md → player/key.md` 的 `layer = 'world/inn'`——角色在壁炉边必须看得见"钥匙被拿走了"（`doc-21 §3.5` 的角色读法「他把柜台上那把铜钥匙收走了」的前提）。若 `layer = null`，这条渲染例子永远触发不了（`01 §14` 待评审 #2）。

**`detail` 不存正文、不存引用明细**（`doc-21 §3.3` + `01 §6.3` 第 5 条）：计数足够渲染「有 n 处提到它的地方现在指不着了」；明细留在 `details.danglingRefs` 里给前端。

### 5.2 `entity_deleted` 全字段

| 字段 | 值 |
|---|---|
| `type` | `'entity_deleted'` |
| `actor` / `turn` | 同上 |
| `subject` | `path` |
| `layer` | `resolveLayer(path)`（`player/**` / `characters/**` → `null`） |
| `detail.path` | 被删除的世界根相对路径 |
| `detail.name` | **删除前**读到的 `title`（缺省 = basename 去 `.md`） |

**为什么 `entity_deleted` 不带 `dangling` 计数**：`00 §5.2` / `doc-21 §4.1` 的 `detail` 形状是 `{ path, name }`，**没有** `dangling`。删除会造成断链，但事件形状已冻结，**不私改**。断链信息经 `details.danglingRefs` 走 `details` 通道给前端；作家侧从"东西不见了"（`doc-21 §4.1` 的人话）就能推断引用需要修，不需要计数。登记为可讨论项（§12）。

### 5.3 `entity_edited` 全字段

`{ path, name, kind }`：`name` = 改动前读到的 `title`；`kind` = `eventKindOf(frontmatter, filename)`（本文导出，`forms.ts:44` 的 `cardKindOf` 是它的渲染侧对偶），重写后不变。`subject = path`（`doc-21 §5.4` 规则 2 生效的前提，`01 §13` 冲突 8）。

### 5.4 失败不落

任何 `ActionError` → 不落事件（`doc-21 §3.6`）。**`move` 的 `dangling > 0` 不是失败**：世界确实变了（文件已搬走），只是有引用修不干净——正常落账，`dangling` 计数就是给这件事用的。

### 5.5 `turn` 锚

`move` / `delete` 都走 `01 §3.7` 的锚。**一个 agent 工具调用 = 一次 `appendEvent`**（不批量）。玩家一次拖拽 = 一个 `req:<uuid>`。作家一轮搬三件东西 = 三条同 `turn` 的 `entity_moved` → 注入时合并成「作家把 3 件东西挪了位置」（`doc-21 §5.4` 规则 1）。

---

## 6. WS 与前端

### 6.1 `details` 里前端会消费的字段

| 字段 | 谁用 | 怎么用 |
|---|---|---|
| `path` | event-bridge / 前端 | 新路径，定位卡片 |
| `from` / `to` | 前端 | 卡片从旧位置飞到新位置（`01 §11.4` 已登记） |
| `rewrote` / `dangling` | 前端 | `dangling > 0` 时给断链提示条 |
| `danglingRefs` | 前端 | 逐条渲染"已被带走……"兜底态（`doc-05 §8.3`） |
| `nearIgnored` / `seat` | 前端 | `nearIgnored` → "已摆放的卡片不重排"提示；`seat.exhausted` → "就近落了座但可能重叠"提示（§3.9.3/§3.9.4） |
| `event` | 前端 | 与 `world_event` 帧按 `event.id` **去重**（`01 §11.2`） |

### 6.2 `item_moved` 演出帧：现状与去处

现状 `routes/world.ts:303` 广播 `{ type: 'item_moved', result }`——**帧名与事件 type 撞了同一个命名空间**（与 `00 §5.3` 冻结的 `roll_resolved` → `dice_result` 是同一类问题，`01 §13` 冲突 6 已登记）。`event-bridge.ts` 里**没有** `item_moved` 的映射（前端只靠 `file_changed` 整层重取，见 `useWorld.ts` 的 WS `onmessage` switch）。

**冻结处理（与 `01 §11.3` 一致）**：演出帧与事件 type 不共用一个命名空间。`item_moved` 帧**删除**——`entity_moved` 事件统一走 `{ type: 'world_event', event }`，前端靠 `event.type` 分派演出（`01 §11.4`）。前端已有的 `item_moved` 监听（`useWorld.ts` 的 WS `onmessage` switch）改成监听 `world_event` 且 `event.type === 'entity_moved'`。**`delete` 无演出帧**：删除是"东西不见了"，符合 `doc-21 §4.1` 的人话，靠 `world_event` + 该层重取即可；不给它造帧。（归 12 执行。）

### 6.3 前端演什么

| 事件 | 演出 | 代码现状 |
|---|---|---|
| `entity_moved` | 卡片从旧位置飞到新位置（`details.from/to`）；`dangling > 0` 时给一句"有 n 处提到它的地方现在指不着了" | `useWorld.ts` 目前只 `file_changed` 整层重取 → 改为按事件补间 |
| `entity_moved`（跨出画布） | 卡片缩进背包（`bag_pack` 拟音，`doc-19 §2`） | 无 |
| `entity_deleted` | 卡片淡出 + 该层重取；指向它的引用渲染"已被带走……"（用 `details.danglingRefs`） | 无 |
| `entity_edited` | 卡片内容闪一下（湿墨重写） | 无 |

**`danglingRefs` 是兜底态的数据源**：`doc-05 §8.3` 要求前端对断链渲染"已被带走……"。前端在渲染 md link 时，若目标路径在当前的 `danglingRefs` 集合里（或 `look_at`/`/layer` 返回的清单里不存在），就地渲染兜底文案而不是不可点的空链接。`LinkLayer.tsx:185` 已有同类做法（保留 DB 行、不渲染线），本文把它扩到 md link 文本。

---

## 7. 错误与边界

### 7.1 `move` / `delete` 的错误码（`01 §7.1` 已冻结 HTTP 映射）

| 场景 | code | HTTP |
|---|---|---|
| 空路径 / 非 `.md`（`move` 的 `from`） | `invalid_argument` | 400 |
| 路径绝对 / 含 `..` / 反斜杠 / 保留前缀 | `invalid_path` | 400 |
| `from` 不存在 | `not_found` | 404 |
| `to` 已存在 | `already_exists` | 409 |
| `README.md` / 目录 / 世界外 | `not_movable` | 409 |
| `near` 不在目标层 | `near_out_of_layer` | 422 |
| 排座 600 格耗尽 | **不抛错**，落最后一格 + `details.seat = { exhausted: true }`（§3.9.3） | — |
| rename / 引用写盘失败 | `write_failed` | 500 |
| 画布迁移失败（文件已搬） | `internal`（§3.4） | 500 |
| `appendEvent` 失败（文件已搬） | `event_failed` | 500 |

### 7.2 精确错误文案（英文，`01 §7.2` 已在表内；本文补本文独有的）

| 场景 | 文案 |
|---|---|
| 移动 README | `README.md is a layer's identity and cannot be moved: "world/inn/README.md"` |
| 删除 README | `README.md is a layer's identity and cannot be deleted: "world/inn/README.md"` |
| 移动目录 | `move only accepts a single .md file, got a directory: "world/inn"` |
| `from` 不存在 | `Entity not found: "world/inn/key.md"` |
| 目标存在 | `Target already exists: "player/key.md"` |
| 自身移动 | `Cannot move a file onto itself: "player/key.md"` |
| `near` 越层 | `near "world/other/x.md" is not in the destination layer "world/inn"` |
| `near` 是目录 | `near must be an entity path, not a layer directory: "world/inn"` |
| 目标不是 .md 也不是层 | `Move destination "world/inn/key" is neither a .md path nor a known layer directory` |
| 画布迁移失败 | `Entity moved to "player/key.md" but its canvas card could not be migrated: <err>` |
| 落账失败 | `File was moved to "player/key.md" but the world event could not be recorded: <err>` |

**纪律（`01 §7.2`）**：每条文案带具体路径值——`Not found` 会让模型下一轮盲目重试。

### 7.3 边界

- **`from === to`** → `invalid_argument`，不做空操作成功（`01 §7.3`）。
- **移动到自己所在的目录**（`world/inn/key.md` → `world/inn/key.md`）同上。
- **`move` 一个 `type: chalk` 的文件进 `player/`**：允许（引擎不做类型白名单）。前端呈现层可能不把它当背包条目（`doc-10 E5`），但**引擎不拒绝**。
- **`delete` 一个被 `world.json` 引用的文件**：允许，引用计入 `dangling`（`world.json` 不被改——删除没有正确答案，§3.2）。**注意**：与 `move` 不同，`delete` 连 `world.json` 也不改。
- **同名文件在不同目录**：`resolveRefTarget` 对裸 basename 的解析必须**唯一**，否则 `null` → dangling。例：`world/inn/key.md` 与 `world/attic/key.md` 同时存在，正文写 `key.md` → ambiguous，不改。
- **符号链接 / 不可读文件**：`readFile` 抛错 → 该文件计入 `DanglingRef{reason:'unreadable'}`，**不改写、不中断整个 move**（一个坏文件不该阻止搬移）。
- **并发同文件**：不加锁，后写者赢（`01 §7.3`、§14 待评审 #6）。
- **`delete` 不删目录**：即使是空目录也不删。删层是 `restructure` 的职责（`doc-20 §1.1` 的 `confirm_restructure`），不在 B1。

---

## 8. 代码落点（精确到文件与函数）

### 8.1 新建

| 文件 | 函数 | 内容 |
|---|---|---|
| `packages/shared/src/actions/refs.ts` | `scanRefs` / `rewriteRefs` / `resolveRefTarget` / `scanOwnRefs` / `rewriteOwnRefs` / `relFrom` / `extractRefSpans` / `RefSite` / `RefKind`（`RefKind` 与 `RefSite` 的形状由 `01 §6.2` 冻结；本文实现） | §3.6 全部算法。`extractRefSpans(raw, filename, frontmatter)` 是**纯函数**（无 I/O，可单测）；`scanRefs` / `rewriteRefs` 是 I/O 外壳。 |
| `packages/shared/src/actions/move.ts` | `moveEntity` / `MoveEntityInput` / `MoveEntityDetails` | §3.1 九步编排 |
| `packages/shared/src/actions/delete.ts` | `removeEntity` / `editEntity` + 两个 Input/Details | §3.2 / §3.3 |
| `packages/shared/src/actions/delete.ts` | `eventKindOf(fm, filename)` | §3.3；`00 §5.2` 的封闭五值映射（`chalk`/`component`/`note`/`letter`/`other`），**本文导出**，`12 §2.4.1` 的 `createEntity` 复用 |
| `extensions/toolkit/move.ts` | `registerTool({ name: 'move', … })` | §2.2 定义 |
| `extensions/toolkit/delete.ts` | `registerTool({ name: 'delete', … })` | §2.2 定义 |

### 8.2 修改

| 文件 | 函数 | 改动 |
|---|---|---|
| `packages/shared/src/store/local-store.ts` | `move(from, to)`（现 `:136-179`） | **整个重写**：删 `content.replaceAll` + `includes(oldName)`；改为 `scanRefs` → `rename` → `rewriteRefs` → `rebaseSelf` 顺序。签名不变（`Promise<MoveResult>`），保证 `routes/world.ts:296` 在 12 改造前仍能编译。 |
| `packages/shared/src/store/local-store.ts` | `renameCardPosition(from, to)`（现 `:432-441`） | 按 §3.8.2 重写：`resolveLayer` 判边界；`links.layer` 跟改；跨边界走 `dropCard`；失败抛 `ActionError('internal')`（不再 warn 吞错） |
| `packages/shared/src/store/local-store.ts` | **`seatNear(layerId, file, anchorPath)`（新增）** | §3.9.3；`01 §2.7` 的 WorldStore 新增清单未列它（§11 冲突 4） |
| `packages/shared/src/store/world-store.ts` | `WorldStore` 接口 | 加 `seatNear`（**本文扩展**，`01 §2.7` 补） |
| `apps/server/src/routes/world.ts` | `/move`（`:291-308`） | 改为 `createActionService(store, {type:'player'}, {turn: req:<uuid>})` → `svc.moveEntity`；删掉手写的 `renameCardPosition` 与 `broadcast({type:'item_moved'})`（归 12 统一改造，本文定行为） |
| `apps/server/src/routes/world.ts` | `/god-action`（`:431-455`） | `delete` 分支改调 `svc.removeEntity`（actor `god`），不再直接 `store.deleteFile`（现 `:439` 绕过引用扫描与事件形状） |
| `apps/server/src/routes/world.ts` | `/layer`（`:168-180`） | **不动**：它已有"只给无行的卡片排座"（`seatUnplaced`）+ 漂移重排（`reseatLayer`），与 §3.9.1 纪律一致 |
| `packages/shared/src/index.ts` | — | 若扩展要直接 import `refs` 的纯函数（单测/探针），加 `export * from './actions/refs.js'`（`01 §8` 只要求导出 `rules/dice.js`；本文的纯函数 `extractRefSpans` / `resolveRefTarget` 也建议导出） |

### 8.3 不动

| 文件 | 为什么不改 |
|---|---|
| `packages/shared/src/store/layers.ts` | 层派生逻辑正确（`layerOfPath` 默认 `'map'` 是**给画布用**的；`resolveLayer` 的 `null` 语义由 `01 §3.9` 在 store 层包一层实现，不改 `layers.ts`） |
| `packages/shared/src/schemas/events.ts` 的 `MoveResult` | 形状由 `01 §2.5` 冻结，本文只实现 |
| `packages/shared/src/db/schema.ts` 的 `cards` / `links` 表 | 表结构够用（`links.layer` 列已存在，§3.8.1 问题 1 是**没用它**，不是缺它） |

---

## 9. 与现存实现的差异

| 位置 | 现状（带行号） | 要改成 | 旧调用点怎么办 |
|---|---|---|---|
| `local-store.ts:136-179` `move` | `content.includes(from) \|\| content.includes(oldName)` + `replaceAll(from, to)` | 两趟 `scanRefs`/`rewriteRefs`；**裸文件名永不改写** | `routes/world.ts:296`（12 改成 action service） |
| `local-store.ts:136-179` `move` | **没有**自身引用重定基 | §3.6.6 第 7 步 | 无旧调用点（新增能力） |
| `local-store.ts:136-179` `move` | 落 `item_moved` 事件，payload `{from,to,oldName,newName,rewroteCount}` | 由 `moveEntity` 落 `entity_moved`，`detail {from,to,name,near?,rewrote,dangling}`（§5.1） | `local-store.ts:163`（随重写删除） |
| `local-store.ts:432-441` `renameCardPosition` | `deriveLayer(to)` 对非层路径返回 `'map'`；`links.layer` 不跟改；catch 吞错 | §3.8.2 | `routes/world.ts:299` |
| `local-store.ts:147-148` | `oldName = basename(from)` / `newName = basename(to)` 只用于事件 | 删掉（`detail` 用 `name`，不用改名前后 basename） | — |
| `schemas/events.ts:25-32` `MoveResult` | `ok: boolean`；`dangling: {file,target}[]` | `ok: true`；`dangling: DanglingRef[]`；加 `name` | `world.ts:296-304`（12） |
| `routes/world.ts:303` | `broadcast({ type: 'item_moved', result })` | 事件走 `{ type: 'world_event', event }`；帧名 `item_moved` 删除（§6.2） | `useWorld.ts` 的 WS `onmessage` switch 前端监听改 `world_event`（12） |
| `routes/world.ts:438-440` | `/god-action` 的 `delete` 直接 `store.deleteFile` | 走 `svc.removeEntity`（引用扫描 + 卡片级联 + 落账） | 前端 `god-action` 调用不变（12） |
| `routes/world.ts:297-302` | `/move` 手调 `renameCardPosition` 并 warn 吞错 | 由 `moveEntity` 内部编排并抛错（§3.4） | 12 删掉这段 |
| `apps/web/src/App.tsx:181-196` | `handleDropItemToScene` 只发 `{from,to}`，不传 `near` | 若落点在某个卡片旁，前端应传 `near`（`doc-06 §5.1` 的"落点碰撞"语义） | 归前端计划 |

---

## 10. 验收与测试

### 10.1 纯函数单测（无 I/O，必须写）

**`extractRefSpans(raw, filename, frontmatter)` —— 8 个用例，含 2 个误改反例。** 每个用例给定文件原文，断言产出的 `RefSite[]`（`kind` + `target`）与**不被改写**的部分。

| # | 用例 | 输入（正文 / frontmatter） | 断言 |
|---|---|---|---|
| 1 | **md link 相对路径命中** | 文件 `world/inn/notes.md` 正文 `拿去 [钥匙](./copper-key.md) 开锁`；移动 `world/inn/copper-key.md` → `player/copper-key.md` | 产出 1 条 `markdown-link`，`target` 规范化为 `world/inn/copper-key.md`（命中）；改写后正文为 `[钥匙](../player/copper-key.md)`（相对路径保持相对风格） |
| 2 | **误改反例（任务点名）** | 正文 `铜钥匙躺在柜台上，像一枚旧硬币。` —— 移动 `world/inn/copper-key.md` | **产出 0 条 RefSite**（`铜钥匙` ≠ `copper-key.md`）；正文**逐字节不变**，`rewrote === 0`，`dangling === 0` |
| 3 | **误改反例：子串不是引用** | 正文 `备份见 world/inn/copper-key.md.bak`，移动 `world/inn/copper-key.md` | 产出 **0** 条引用（路径段边界比较，`.md.bak` 不命中），正文不变，`dangling === 0` |
| 4 | **裸文件名 mention = dangling，不改** | 正文 `He left copper-key.md on the counter.`（无 link 语法） | 产出 1 条 `body-mention`（`target: 'copper-key.md'`）；**改写阶段跳过**，`rewrote === 0`，`dangling === 1`、`reason === 'ambiguous'`，正文不变 |
| 5 | **frontmatter `path` 命中（含引号）** | frontmatter `path: "world/inn/copper-key.md"` | 产出 1 条 `frontmatter-path`；替换保留引号：`path: "player/copper-key.md"` |
| 6 | **`gate.target` 命中，非 gate 的 `target` 不碰** | (a) `type: gate` + `target: world/inn/copper-key.md`；(b) `type: sprite` + `target: watson` | (a) 1 条 `gate-target`，被改写；(b) **0 条**（角色 id 不是路径），原文不变 |
| 7 | **`bg` 资源引用命中；指向别处则不命中** | (a) 移动 `world/inn/bg.png`，某 README frontmatter `bg: world/inn/bg.png`；(b) 移动 `world/inn/key.md`，同一 README `bg: world/inn/bg.png` | (a) 1 条 `asset-ref`，被改写；(b) **0 条**（`bg` 不指向被移动的文件） |
| 8 | **多引用同文件 = 一次写盘** | frontmatter `path: world/inn/copper-key.md` + 正文 `[x](./copper-key.md)` + 正文 mention `copper-key.md` | 产出 3 条 RefSite（2 可改 + 1 mention）；`writeFileAtomic` **恰好调用 1 次**；mention 未改；`rewrote === 1`（文件数），`dangling === 1`（记录数） |

### 10.2 `resolveRefTarget` 单测（`01 §12.1` 已点名）

| 用例 | 断言 |
|---|---|
| `key.md` 在 `world/inn/` 内唯一（`currentFile = world/inn/a.md`） | 返回 `world/inn/key.md` |
| `key.md` 在 `world/inn/` 与 `world/attic/` 都有 | 返回 `null`（ambiguous） |
| `../a/key.md` 从 `world/inn/notes/x.md` | 返回 `world/inn/a/key.md` |
| `./key.md` 从 `player/a.md`，存在 `player/key.md` | 返回 `player/key.md` |
| `world/inn/key.md.bak` | 返回 `null`（不是 `key.md` 的引用） |
| 绝对路径 `/etc/passwd` | 返回 `null`（越界，不解析） |

### 10.3 store 单测（临时目录 + 真 SQLite）

| 场景 | 判据 |
|---|---|
| 引用重写端到端 | `A.md` 用 frontmatter `path: world/inn/key.md` 指向 key；`store.move('world/inn/key.md','player/key.md')` 后 `A.md` 的 `path === 'player/key.md'`；`MoveResult.rewrote.length === 1` |
| 自身重定基 | `player/key.md` 正文含 `[t](./boat-ticket.md)`，`player/boat-ticket.md` 存在；移到 `world/inn/key.md` 后正文为 `[t](../player/boat-ticket.md)` |
| 卡片跨出画布 | 先 `seatUnplaced('world/inn', [{path:'world/inn/key.md',w:280,h:180}])`；`move` 到 `player/key.md` 后 `getLayerCards(['world/inn/key.md'])` 为空，且**不存在** `layer='map'` 的该卡片行 |
| `links` 端点迁移 | `links` 有一行 `from_id='world/inn/key.md'`；`move` 到同层新名后 `from_id` 与新路径一致，`layer` 同步 |
| `near` 排座 | 层内已有 `counter.md`（卡片中心 1000,540）；`seatNear('world/inn',{path:'key.md',w:280,h:180},'world/inn/counter.md')` 后 card 中心与 counter 中心距离 ≥ `SEAT_STEP`，且**不与 counter bounds 相交**（`SEAT_PAD` 起效） |
| `near` 排座不重排已在座卡片 | 先有 `counter` 与 `other` 两张已摆放卡；`seatNear` 后两者 x/y **逐字节不变**（`doc-06 §2.5`） |
| `delete` 级联 | `dropCard('world/inn/key.md')` 删 cards 行 + `links` 里触及它的两行；**另一条不相关的 links 行保留** |
| `delete` 不改其它文件 | `A.md` 引用被删的 key；`removeEntity` 后 `A.md` **逐字节不变**，`dangling === 1` |

### 10.4 事件 / 探针 / 手测（端到端）

1. **`move` 落账字段**：`POST /api/move` 移动一个被 frontmatter 路径键引用的 chalk → `history.db` 新增一条 `entity_moved`，`actor_type='player'`，`detail.rewrote >= 1`，`detail.name` 非空，`layer` 等于 `resolveLayer(from)`，`subject === to`。
2. **误改反例（任务点名，必须做）**：世界里有文件写「他把铜钥匙忘在了柜台」；`move world/inn/copper-key.md player/copper-key.md` 后**该文件逐字节不变**。用 `sha256sum` 前后比对（探针可断言）。
3. **断链可被作家感知**：把一个被裸文件名提及的文件移走 → `entity_moved.detail.dangling >= 1`；下一轮作家注入里出现「有 n 处提到它的地方现在指不着了」（B2 落地后）。
4. **删除落账**：`DELETE` 一个 `note` → `entity_deleted` 一条，`actor_type='player'`；画布 `/layer` 不再返回它，且指向它的线不再渲染。
5. **角色搬自己的东西**：角色 agent 调 `move characters/watson/letter.md player/letter.md` → 事件的 `actor_type='character'`、`actor_id='watson'`。
6. **`near` 手测**：「把钥匙放回柜台」→ 打开画布，钥匙卡片**紧贴柜台卡**，不与任何已有卡重叠。

### 10.5 评审可读性判据

`01 §5` 的方法清单里，本文认领 `moveEntity` / `removeEntity` / `editEntity` 三行（`01 §8` 表把它们标为"归属 04"）。**`refs.ts` 的五个导出名与 `DanglingRef` 字段由 01 冻结，本文实现不许改名。**

---

## 11. 发现的冲突 / 需要修订的上位文档

> 按 `00 §0`：不私改上位文档，只登记，评审统一裁决。

| # | 哪两份 | 哪一句 / 哪里 | 为什么矛盾 | 建议怎么改 |
|---|---|---|---|---|
| 1 | `01 §6.2` 的 `RefKind` vs `doc-05 §8.3` | `doc-05 §8.3` 第 2 点要求引用重写覆盖 "world.json 引用"；`01 §6.2` 冻结的七个 `RefKind` 没有 `world-json` | 枚举已冻结，本文只能用 `asset-ref` 复用（§3.6.7）——语义上不算错，但读代码的人看不出"这一条来自 world.json" | 建议 `01 §6.2` 补第 8 个值 `'world-json'`，或明写 "world.json 的字符串叶子按 `asset-ref` 处理"。本文按冻结值实现（`asset-ref`），**不擅自加枚举** |
| 2 | 本文 vs `01 §6.2` 的候选文件范围 | `01 §6.2` 未定扫描哪些文件；本文 §3.6.2 扩到 `.json` / `.yml` / `.yaml` | 题材包可能用别的格式存引用；只扫 `.md` 会漏 | 建议 `01 §6.2` 补一句候选文件后缀集；若评审认为过宽（性能），退化为只扫 `.md` + `world.json` |
| 3 | `doc-10 E1` vs `doc-05 §8.3` | `doc-10 E1` 的 `sprite` 行（角色在场演出）与 `doc-20 §1` 的 `move` 语义；`sprite` 的 frontmatter `target` 是**角色 id**，不是路径 | 若 `frontmatter-path` 把 `target` 一律当路径，`sprite` 的 `target: watson` 会被误判为引用、甚至被改写 | 本文 §3.6.3 已收窄：`target` 仅当 `type === 'gate'` 或文件是 `README.md` 时算 `gate-target`，其余 `target` **不扫**。建议 `01 §6.2` 的 `gate-target` 注释补这句 |
| 4 | `01 §2.7` 的 WorldStore 新增清单 vs 本文 | `01 §2.7` 列了五处新增（`resolveLayer` / `getAllReadCursors` / `writeFileAtomic` / `readFileBase64` / `writeFile` 放宽），**没有** `seatNear` | `near` 吸附是本文新增能力，无法只用 `seatUnplaced`（它从固定 `SEAT_ANCHOR` 起螺旋）实现 | 建议 `01 §2.7` 补 `seatNear(layerId, file, anchorPath): Promise<CardRecord>`；`01` 评审时可一并采纳。`placeCard` 的 `layer` 参数属 09 的 `WorldStore` 接口（09 §4.2 已定 `placeCard(layer, path, box)`），本文只引用不重定义（§4.1） |
| 5 | `00 §5.2` / `doc-21 §4.1` vs 本文 | `entity_deleted.detail` 冻结为 `{ path, name }`，**无 `dangling`** | 删除同样产生断链，但事件形状无法承载计数（对比 `entity_moved` 有 `rewrote`/`dangling`） | 本文按冻结形状实现（断链只走 `details`），**登记为不对称**：若要对称，需 `doc-21 §4.1` 与 `00 §5.2` 同时给 `entity_deleted.detail` 加可选 `dangling`。**不擅自加**（评审拍板） |
| 6 | `doc-10 E5` vs `00 §2.4` | `doc-10 E5`："`move()` 移动语义只适用于 note/letter"；`00 §2.4`："引擎层不额外加类型白名单"（说明是对 E5 的**刻意放宽**） | 两份文档措辞相反 | 已由 `00 §2.4` 裁决（本文服从）；建议 `doc-10 E5` 补一句"E5 是呈现层约束（`BAG_TYPES`），引擎层按 `00 §2.4` 不做类型白名单" |
| 7 | `doc-05 §8.3` vs 本文 §3.6.4 | `doc-05 §8.3` 把 dangling 描述为"前端对断链渲染『已被带走……』兜底态"；但未说**裸文件名 mention 不该被改** | 若按字面"扫描世界内所有指向被移动路径的引用…就地重写"，裸 mention 会被改，叙事被篡改 | `01 §6.3` 第 2 条已明确"body-mention 永不改写"，与本文一致；建议 `doc-05 §8.3` 补一句 |
| 8 | `doc-06 §2.5` vs 本文 §3.7 | `doc-06 §2.5` 说"锚点（相关物件**或视口中心**）"；本文的 `near` 只支持"相关物件"，视口中心未支持 | 视口中心来自 `canvas.db` 的 viewpoint（归 B2/doc-22），B1 不建 | 本文只实现"相关物件"锚点；视口中心锚点登记为 B2 后能力（§12）。建议 `doc-06 §2.5` 标"视口中心锚点依赖 viewpoint 表，B2 落地" |

---

## 12. 仍然未知 / 留给评审拍板的

1. **目录目标展开（§3.7）是否保留**：本文取"接受目录、补 basename"，是 `doc-20 §5` 的超集。若评审要严格贴 `doc-20` 的示例（只接受完整文件路径），删 §3.7 即可，其余不变。
2. **`entity_deleted` 是否要 `dangling` 计数**（§11 冲突 5）：需要同时改 `00 §5.2` 与 `doc-21 §4.1` 两处冻结形状。本文按现状实现。
3. **`near` 在同层改名时是否报错**（§3.9.4）：本文取 **忽略 + 显式报告（`details.nearIgnored = true`）**。备选是 `invalid_argument`。
4. **候选文件后缀集**（§11 冲突 2）：本文取 `.md` + `.json` + `.yml` + `.yaml`。若性能或语义上要收紧，退化为 `.md` + `world.json`。
5. **`world-json` 是否独立 `RefKind`**（§11 冲突 1）。
6. **`delete` 的墓碑 / 软删除机制**（见下方专节）。

### 12.1 墓碑 / 软删除：本文的取舍（回答任务第 4 点的评估）

任务要求评估"要不要墓碑机制"，理由是 `doc-21 §4.6` 与 `doc-05` 提到 soft-delete / 断链兜底态（前端渲染"已被带走……"）。**结论：B1 不做墓碑，直接删。理由四条**：

| 理由 | 证据 |
|---|---|
| **事件表就是墓碑** | `doc-21 §6`：事件表 append-only、永不 UPDATE/DELETE，回滚也不删。`entity_deleted` 一条把"它曾经存在、叫什么、在哪"永久记下。要"复活"或"回看"，读事件表就能重放——不需要在文件系统里留一个假文件。 |
| **兜底态在渲染层，不在存储层** | `doc-05 §8.3` 的"已被带走……"是**前端对断链的渲染**，不是一种文件状态。`LinkLayer.tsx:185` 已是实例（保留 DB 行、不渲染线）。造墓碑文件会让"文件即真相"多出一类"看起来像内容其实不是"的东西，直接违反 `doc-05 §8.2` 的五条反对理由（尤其第 5 条"纸的隐喻破"）。 |
| **`look_at` / 目录清单会被污染** | `doc-22 §3.1` 的 `layer_files` 节按目录扫描列路径。墓碑文件会出现在清单里，作家每轮都要读一个"已经没了的物件"，是长期的上下文税。 |
| **门的软删除已另有机制** | `doc-11` 的 stub 层（无 README 的目录 = "门还在、场景没写"）已经是"层级的墓碑"形态，且它靠**目录存在**表达，不靠特殊文件。物件级的"消失"没有这个需求——`doc-06 §5.2` 的演示脚本（"钥匙不见了"）靠事件 + 重取即可。 |

**但断链兜底态必须落地**（这是任务真正要的）：§6.3 已定——前端渲染引用时，目标不存在就渲染兜底文案，数据源是 `details.danglingRefs` + 当前层清单。**墓碑不是它的前提。**

**若将来要做"回收站"**（上帝模式撤销一次删除）：正确做法是**事件表 + 内容在 `entries` 表里**（`doc-05 §8.6`：`entries` 含完整内容），从事件回放恢复，而不是在文件系统里留墓碑。登记为赛后能力，不进 B1。

### 12.2 视口中心锚点

`doc-06 §2.5` 的"锚点 = 相关物件**或视口中心**"里的"视口中心"依赖 `canvas.db` 的 `viewpoint` 表（归 B2/doc-22，B1 不建）。B1 的 `near` 只支持"相关物件"。`apply` 视口锚点是 `seatNear` 再包一层（锚点从卡片中心换成 viewpoint 的焦点坐标），接口不变。登记为 B2 后能力。

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
| 10 验收与测试 | §10（含 8 个引用识别单测用例，其中 2 个误改反例） |
| 11 发现的冲突 | §11 |
| 12 仍然未知 | §12 |
