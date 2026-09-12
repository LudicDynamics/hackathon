# doc-tools/02 `chalk`

> 状态：**设计（2026-09-12）**，待评审。本文只写设计，不改代码。
> 权威层级（`00-共同上下文.md` §0）：`00` > `doc-21`/`doc-22` > `doc-20` > `doc-10` > `doc-19` > 本文。
> 本文服从 `01-动作内核与事件落账.md` 冻结的 `ActionContext` / `ActionResult` / `ActionError` / 服务方法名（`writeChalk`）；`WriteChalkInput` 的字段名与必选性**照 `01 §5` 表第 3 行逐字填形状，不增不改**（§2.2），只把该行的 `frontmatter?: ...` 填成 `ChalkFrontmatterInput`。
> 关联：`doc-20` §1（能力分发）、§2（互动字段属于所有实体）、§10（工具返回）、§12（实现落点）；`doc-05` §3.1（互动 frontmatter 活样例）、§5（单轮管线四阶段）、§9.1；`doc-06` §2.2（落定 vs 擦除）、§2.6（互动字段渲染）；`doc-07` §2 风险表（≤200 字 / frontmatter 格式错）、§3 D1 验收；`doc-08`（`append_to` 治理）；`doc-11` §3.3（开场 chalk）；`doc-21` §4.1（`entity_created`/`entity_edited`）；`doc-22` §3.1（`recent_chalk` 按 mtime）；`前端改造计划.md` §T4.10（`anchor`）、§T3.4（演出通道）。

---

## 1. 一句话与定位

**`chalk` 把一段叙事正文变成一个真实的世界文件：工具内部替调用者做完「命名、骨架、分隔、落账、连线」五件事，把格式责任从提示词挪进代码。**

`doc-20` 里的位置：`chalk` 是动作层唯一「写正文」的工具（其余工具动作画布、presence、互动字段或引用关系）。它的三个调用者：

| 调用者 | 场景 | actor |
|---|---|---|
| 作家主 agent | 单轮管线 Phase ①「正文落板」（`doc-05 §5`）：玩家说一句话 → 落一篇 chalk | `{type:'writer'}` |
| 角色 agent | 直聊期间在世界或自己的小天地落字（`doc-20 §1.1`） | `{type:'character',id}` |
| 初始化子代理 | 首次进入 stub 层 / 空小天地时落「开场 chalk」（`doc-11 §3.3`） | `{type:'writer'}`（子代理继承父 env，`00 §3`） |

玩家 UI **不**调用 `chalk`：上帝模式新增物件走 `POST /api/god-action`（`actor: god`），它的 chalk 分支是**独立的另一条路径**（`App.tsx:233-235` 手拼 `---\ntype: chalk\n---\n` 后 POST，路由 `world.ts:431-447` 直接 `writeFile` + 落旧 `god_action`），本文 §9 定为**收编进 `writeChalk`**。

> **为什么是「最重要的一个」**（`后端实现计划.md:262` 原话）：D1 验收的唯一硬判据就是「玩家说一句话 → 作家写一条 chalk（带 frontmatter）到场景目录 → 画布淡入旁白 + 选项卡片组」（`doc-07 §3 D1`、`后端实现计划.md:228`）。chalk 不通，整条叙事主循环就不算跑通。

---

## 2. 签名与参数

### 2.1 工具面（冻结于 `doc-20` 表格 / `后端实现计划.md:262`）

```ts
chalk({
  path?: string;        // 显式落盘路径；省略 = 默认命名约定
  content: string;      // 正文（Markdown，不含 frontmatter）
  link_to?: string;     // 顺手建一条关系线的对端
  append_to?: string;   // 续写到已有的 chalk 尾部
}): ToolResult
```

**四个参数，不增不减。** 这是 `doc-20` 表格与施工单逐字一致的签名，本文**不**给工具加 `title` / `status` / `choice` / `layer` 参数。两个直接后果，本文认领并写清：

1. **互动字段不通过 `chalk` 参数进入**。它们的入口是 `doc-05 §5` 的 **Phase ②**：作家在 Phase ① 用 `chalk` 落正文，再用原生 `edit` 往同一篇文件注入 `status` / `choice` / `roll_dice`（§9.3 的完整论证）。这**不**削弱工具——`chalk` 仍然负责 frontmatter 的**骨架**（`type` / `title`），Phase ② 只往骨架上加键。
2. **`title` 不是工具参数**。骨架里的 `title` 由工具从 `content` 首个非空行推导（§2.5）；模型想把标题写别样，就在正文第一行写它——**正文进画布之前本来就要有一个像标题的句子**，这不是妥协，是让模型少填一个字段。

> **为什么不在工具面开口子**：`00 §6.3` 明禁「造内建工具的同义词」的同一精神——工具面越小，模型越不会犹豫用哪个入口。一旦 `chalk` 能写 `choice`，它就和 `doc-05 §5` 的 Phase ② 变成两个都能写互动字段的入口，作家纪律里「Phase ② 负责注入」那句当场失效。

**动作层（本文 §2.2）比工具面宽**，因为动作层有两个额外调用者：

- **C 入口（server 路由）**：`/api/god-action` 的新增物件弹窗会一次交全（`title` / `content` / 可选的 `choice`）。
- **E 入口（初始化子代理）**：`doc-11 §3.3` 的开场 chalk 若一次写完更省一次 `edit`。

两者都用**动作层**（`createActionService(...).writeChalk({...})`），而不是新增工具参数。工具面仍是那四个。

### 2.2 动作层（本文定义；字段名严格对齐 `01 §5` 表第 3 行，不增不改）

`01 §5` 的冻结行：`{ path?: string; title: string; body: string; layer?: string; frontmatter?: ...; clientRef?: string }`。本文把它填成完整形状（**不改任何字段名与必选性**）：

```ts
// packages/shared/src/actions/chalk.ts
export interface WriteChalkInput {
  /** Body markdown, frontmatter already stripped by the caller. REQUIRED. */
  body: string;

  /**
   * Title. Drives both the frontmatter `title` and the default filename slug.
   * REQUIRED at this layer (01 §5): the TOOL shell derives it from the body's
   * first non-empty line when the model omits it (§2.5) — normalization belongs
   * to the transport edge, not to the action.
   */
  title: string;

  /**
   * Explicit world-relative target. Omitted => `<layer>/NN-<slug>.md` (§2.4).
   * Mutually exclusive with `appendTo` (§2.3 case C).
   */
  path?: string;

  /**
   * Layer directory the default naming applies to, world-relative
   * (`world/baker-street`). Required whenever `path` is omitted — a
   * transport-free action cannot know "where the caller is" (§7.1).
   */
  layer?: string;

  /**
   * Interactive fields + rendering variants, written into frontmatter verbatim.
   * SHAPE OWNED BY doc-tools/06 (§2.7) — never re-declared here.
   */
  frontmatter?: ChalkFrontmatterInput;

  /** Append to this existing path instead of creating a new file (§2.3 case C). */
  appendTo?: string;

  /** Create one canvas link from the new chalk to this endpoint (§2.3 case D). */
  linkTo?: string;

  /** Opaque correlation id echoed back in `details` (god-mode optimistic UI). */
  clientRef?: string;
}

/** The keys `writeChalk` understands; unknown keys in `extra` are passed through. */
export interface ChalkFrontmatterInput {
  /** 06's `StatusSchema` — verbatim. */
  status?: { data: Record<string, unknown> };
  /** 06's `ChoiceSchema` — verbatim. */
  choice?: string[];
  /** 06's `RollDiceSchema` — verbatim; `result`/`passed` only on an explicit engine writeback. */
  roll_dice?: { type?: string; desc: string; expect: string; result?: number; passed?: boolean };
  /** Rendering variants the tool does not interpret: `anchor` / `font` / `big` / `color` / `card`. */
  extra?: Record<string, unknown>;
}
```

> **`frontmatter` 是一个容器，不是第二份 schema**：`status` / `choice` / `roll_dice` 三个键的形状**逐字引用 `doc-tools/06`**（`doc-20 §2` 的 `InteractiveFieldsSchema`），本文只负责把它们写进 YAML、并保证 `type` / `title` 不被它们覆盖（§12 待定项 6）。`extra` 是「工具不解释、原样写」的逃生门（`anchor` 等，`前端改造计划.md §T4.10`）。

工具壳参数 → 动作层字段的映射（**工具面只有四个参数**，其余字段由工具壳推导）：

| 工具参数 | 动作层字段 | 处理 |
|---|---|---|
| `content` | `body` | 原样；工具**不**替调用者塞 YAML |
| `path` | `path` | 原样 |
| `append_to` | `appendTo` | 原样 |
| `link_to` | `linkTo` | 原样 |
| （推导） | `title` | 取 `content` 首个非空行（§2.5） |
| （推导） | `layer` | 从 `ctx` 的当前层注入（§2.3 的 A 形态；§12 待定项 1） |
| （不传） | `frontmatter` | 工具面**不提供**；互动字段走 Phase ② 的 `edit`（§2.1/§9.3）。C / E 入口直接调动作层时可传 |

### 2.3 冲突组合（本文定案）

四个可选参数两两组合，只有四种合法形态；其余一律 `invalid_argument`，**不猜**：

| # | 组合 | 语义 | 结果 |
|---|---|---|---|
| **A** | 只有 `body`(+`layer`) | 默认命名新建 | `<layerDir>/NN-<slug>.md` |
| **B** | `body` + `path` | 显式命名新建 | 校验后写 `path`；已存在 → `already_exists` |
| **C** | `body` + `appendTo` | 续写既有 chalk | 追加到 `appendTo`；`appendTo` 不存在 / 不是 chalk → 报错 |
| **D** | `body` + `path` + `linkTo`（A/B/C 均可加） | 新建/续写 + 顺手连线 | 落账后再调 `linkCards` |

**`path` 与 `appendTo` 同时给**：`appendTo` 是「往哪儿追加」，`path` 是「新建到哪儿」——两者是**互斥的意图**，同给无解。定案：`ActionError('invalid_argument', 'chalk accepts either path (create) or append_to (append), not both')`。
*为什么报错而不是「append 优先」*：静默取一个会让调用者以为按另一个执行了。`doc-07` 的单轮管线里作家刚写完 Phase ① 又赶上 Phase ②，参数混用是真实可能的；报错是唯一能教对它的方式。

### 2.4 落盘路径约定（`00 §2.3` 冻结）

**默认路径 = `<layerDir>/NN-<slug>.md`。**

- `layerDir`：显式 `layer` 参数，或 `path` 的目录部分。**目录就是层**（`layerOfPath`，`layers.ts:126-135`）；`layer=map` → `world/`。
- `NN`：两位零补序号，取该目录内已有 `^\d\d-` 前缀文件名的**最大号 + 1**，从 `01` 起。`01-rainy-night.md` / `02-counter.md`（`后端实现计划.md:353-354` 的 Hook 注入样例就是这个形态）。
- **`slug`**：`title` → 小写 → 每段连续非 `[a-z0-9]` 字符折成一个 `-` → 去首尾 `-` → 截 32 字符；结果为空则用 `chalk`。例：`The Closed Piano` → `the-closed-piano`；`The lid gives way.` → `the-lid-gives-way`（句点被折掉）；`雨夜` → `chalk`。截断上限 32 与前端 `App.tsx:221` 的 `slice(0, 32)` 对齐。
- 历史遗留的无序号 chalk（模板里 `evening.md` / `late-night.md` / `raindrops.md`）**不迁移**（`00 §2.3` 末句）：序号只在**新建**时分配，引擎对既有文件只读不改名。

**显式 `path` 的校验**（顺序固定，先校验后写，`01 §3.1` 第 1–2 步）：

1. 世界根相对、POSIX `/`、无前导 `./`、无绝对路径、无 `..`（`00 §2.1`）；
2. 首段 MUST 是 `world` / `player` / `characters`（写入位置白名单）；`.airpworld/` 与任何 `.` 开头段拒绝（`00 §2.5`）；
3. 若目标以 `README.md` 结尾 → `not_movable`（README 是层的身份，`00 §2.4`）；
4. 目标**已存在** → `already_exists`（不覆盖）。**唯一例外**：已存在且 `appendTo` 指向它（case C）。
5. 目标扩展名 MUST 是 `.md` → 否则 `invalid_path`。

> **「报错不覆盖」的判据**：`00 §2.3` 原文「显式 path 冲突时 MUST 报错而不是覆盖」。覆盖等于把一篇别人的板书静默销毁，而事件表只记了一条 `entity_created`——历史面板会渲染出一句假话（`doc-21 §3.3` 的第一个理由）。要改一篇已有 chalk 用 `edit`，要续写用 `append_to`。

### 2.5 `title` 推导（工具面不开参数，骨架自己算）

工具面没有 `title`（§2.1），但动作层与 frontmatter 骨架都要求它（`01 §5` required + §4.2 恒有）。工具壳负责推导：

```ts
function deriveTitle(body: string): string {
  const firstLine = body.split('\n').map(l => l.trim())
    .find(l => l && !l.startsWith('#') && !l.startsWith('---'));
  return (firstLine ?? 'Chalk').slice(0, 60);
}
```

*理由*：正文的第一句本来就是这一段的标题（`doc-05 §5` 的单轮管线里，作家写的是「本轮剧情正文」，它开头那句就是读者看到的第一眼）。推导而非新增参数，让模型少填一个字段、让 API 面保持不变。C / E 入口若想给更短的标题，直接调动作层传 `title`——工具面的 `chalk` 不需要它。

### 2.6 `link_to` 指向什么（本文定案）

`link_to` 是**关系线的对端**：新建 chalk 连一条线到 `linkTo` 指向的实体。

- `linkTo` 是**世界根相对路径**（`00 §2.1`），指向本层的一个卡片（`world/<layer>/<file>.md`）；目录路径也接受，解析为该层的门牌 README。
- 端点 = `{ from: <新建 chalk 的 path>, to: linkTo }`，`layer` = 新建 chalk 所在层。
- **跨层拒绝**：`linkCards` 的 `layer` 是单层画布状态（`links.layer`，`db/schema.ts:19-26`），跨层线没有画布可依附 → `ActionError('invalid_argument')`。要表达跨层关系，用「在目标层再落一篇 chalk」。
- 样式默认 `'solid'`，可经 `input.frontmatter.extra.linkStyle` 覆盖（工具仅作透传，样式枚举归 09）。
- **线的方向**：`from` = 新建的 chalk，`to` = `link_to` 指向的东西。语义是「这段字在讲它」，与 `doc-05 §5`「正文里出现线索词 → 指向右侧物件卡的动态关系线」同向。
- **`doc-10 E13` 的纪律不变**：线**不**从 md 派生（不解析正文里的 `[钥匙](./钥匙.md)`），只是 `link_to` 显式给了才建。前端可以**建议**（`doc-05 §5` 的「自动建议」），决定权在调用者。
- **`link_to` 不落事件**（`01 §4.1`）：canvas 状态不产生事件，只广播 `canvas_patched` 帧。新建 chalk 全程**只落一条** `entity_created`。若 `linkCards` 抛错，见 §7.3（部分成功 + 可见警告，不置 `isError`）。

### 2.7 互动字段的唯一入口（本文定案）

**互动字段的形状归 `doc-tools/06`**（`00` §6.4 分工表 + `b1-context.md:75` 明文）：`InteractiveFieldsSchema = { choice, roll_dice, status }`（`doc-20 §2`）。本文**不定义第二份 schema**，动作层的 `ChalkFrontmatterInput` 只是这三个键的引用容器。

**入口只有两条，且都不是 `chalk` 工具的参数**（§2.1）：

| 入口 | 谁用 | 怎么进文件 |
|---|---|---|
| **Phase ② 的 `edit`** | 作家 agent（`doc-05 §5`） | 原生 `edit` 往已有 chalk 的 frontmatter 加键；走 B 入口落 `entity_edited` |
| **动作层的 `frontmatter` 字段** | C 入口（god-action）、E 入口（初始化子代理） | `svc.writeChalk({ …, frontmatter: { choice, status, roll_dice } })` |

> **这样分工的收益**：`chalk` 的工具面保持 `doc-20` 的四参数签名不变，而「谁写互动字段」在 `doc-05 §5` 的两段式里有唯一答案。§9.3 解释为什么这不与「工具一次写完骨架」冲突。

**`type` / `title` 与 `frontmatter` 的优先级**：`frontmatter.extra` 里若出现 `type` 或 `title`，直接 `ActionError('invalid_argument')`——它们由工具独占（§12 待定项 6）。

---

## 3. 行为契约（逐步）

`writeChalk` 遵守 `01 §3.1` 的五步骨架，展开为十步；每步写「漏了会怎样」。

| # | 步骤 | 漏了会怎样 |
|---|---|---|
| 1 | **解析输入**：`body` 非空且是 string；`path`/`appendTo` 互斥检查；路径过 `00 §2.1` 纪律 | `path.join(worldRoot,'/etc/x')` 跳出世界根；`title` 为 `undefined` 时 YAML 写出 `title: undefined` |
| 2 | **判定形态**（A/B/C/D，§2.3） | 混用参数时静默取一个，调用者以为执行的是另一个 |
| 3a | **A/B 形态求目标路径**：`layer` → 目录；列目录（`store.listFiles(layerDir)`）算下一个 `NN`；`title` → slug | 序号撞车 → 覆盖别人的板书；slug 含非 ASCII → 文件名在 Windows/WSL 间不一致 |
| 3b | **C 形态读目标**：`store.readFile(appendTo)` → `parseFrontmatter` → 必须 `fm.type === 'chalk'` | 把一篇 letter/README 续写成 chalk，那篇实体当场变类型，前端渲染器错配 |
| 4 | **读现状并校验**：目标存在性；`linkTo` 端点存在性；本层目录存在 | 先写后校验 = 半完成状态（`01 §3.1` 第 2 步） |
| 5 | **拼 frontmatter**：`type: chalk` + `title`（工具必写）+ `frontmatter` 里给了的互动字段/`extra`（C/E 入口），**按冻结顺序**（§4.2） | 顺序乱 → 前端 formatter 与 `look_at` 块形状不一致（两者共用一份 schema） |
| 6 | **渲染整文件文本**：`stringifyChalkFile()`（§4.3 新 writer）或 append 分支的拼接 | 每次都加引号 / status.data 全转字符串（现状，见 §9.1） |
| 7 | **落盘**：新建 → `store.writeFile`（新文件）；append / 任何改写既有文件 → `store.writeFileAtomic`（`01 §2.7`） | agent 被 kill 留下半截 markdown，下一轮 `look_at` 读到语法残骸；`fs.watch` 广播瞬时半成品 |
| 8 | **落账**：`store.appendEvent` **恰一次**（§5） | 世界变了但作家/角色/历史面板都不知道（`doc-21 §1` 第三问判死） |
| 9 | **顺手连线**（仅 `linkTo`）：调 `linkCards(ctx, { op: 'create', from: <新 chalk 路径>, to: input.linkTo })` | 线没建，但调用者以为建了 → 下一轮叙事引用一条不存在的线 |
| 10 | **返回 `{ text, details }`**：英文、说清发生了什么、带稳定路径（§2 表） | 模型只看到 "Done."，下一句瞎指一个路径（`01 §3.1` 第 5 步） |

**失败语义（贯穿十步）**：任何一步抛 `ActionError` → **绝不落事件**（`01 §3.6`），**绝不吞掉降级成成功**。第 7 步以后失败的处理见 §7。

### 3.1 `append_to` 续写的分隔与标题处理（本文定案）

| 问题 | 定案 | 理由 |
|---|---|---|
| **分隔** | 单个空行（`\n\n`），**不插 `---` 分隔线** | `---` 在 md 里是 `<hr>`，也是 frontmatter 的定界符——插进去会让下一版 `parseFrontmatter` 的 `^---\n([\s\S]*?)\n---\n?` 正则（`frontmatter.ts:30`）在正文中间误配。空行是 chalk 内部段落的自然分隔 |
| **标题** | 续写时**不改** frontmatter 的 `title`；正文里的 `# H2` 原样保留 | 一篇 chalk 只有一个 title（它是卡片标题/文件名来源）。续写是「同一篇文章多一段」，不是「新建一章」 |
| **正文尾随空白** | 追加前把既有 body 的尾部空白 `trimEnd`，再拼 `\n\n` + 新 body `trimEnd` | 否则连续续写会累积空行，前端 `whitespace-pre-wrap`（`ChalkCard.tsx:55`）把它渲染成越来越大的空隙 |
| **mtime** | 自然更新——续写就是一次真实写盘，`fs.watch` 会触发 | `doc-22 §3.1` 的 `recent_chalk` 节**按 mtime 取最近 8 篇**：续写让它重新成为「最近板书」，这正是想要的（刚续的那篇就是刚发生的） |
| **序号** | **不变**——文件不重命名、序号不重排 | 序号是路径的一部分，改它等于一次 `move`（要引用重写、卡片迁移、`entity_moved` 事件）。续写不是移动 |
| **`NN` 分配** | 续写不参与「下一个空号」的计算（它不新建文件） | 否则每续一次就把序号往上顶，同层序号出现空洞，Hook 注入的清单看着像删过东西 |
| **`choice` / `roll_dice`** | 用 `input.frontmatter` 里**本次给的**覆盖同名字段；本次没给则保留既有值（工具面不给这些参数时，`frontmatter` 为 `undefined`，即**全部保留**） | 续写的典型用法是「上一轮的选项用完了，换一组新的」（`doc-09` 待设计 #1 的「choice 是否只挂最新一段」在 MVP 定为「覆盖」） |
| **`status.data`** | **浅合并**：`{...existing.data, ...incoming.data}` | status 是「该实体的快照」，续写往往是「时间推进了、阶段没变」——整体替换会丢掉没重报的键 |

**`append_to` 的语义边界（`doc-08` 治理）**：`append_to` 是「同场景连续小段连成一篇文章」（`doc-08` 定案表第 1 行）。它**不**是「跨层归档」——`journal/` 已撤销（`doc-12` 文末），剧情一律落在发生它的那一层。续写目标 MUST 与新建目标同层（`appendTo` 的目录 = 新建形态下会用的目录，否则 `invalid_argument`），这条防的是「把 A 层的字续到 B 层」这种会让 `layer` 落账错位的调用。

### 3.2 落账时机与 `doc-07` Phase ② 的关系（§9.3 的落地）

**两段式不是二选一，是分工**：

1. **Phase ①（`chalk`）**：工具**必写骨架**（`type: chalk` + `title`），**不写**互动字段（工具面无此参数，§2.1/§2.7）。作家在这一步只管把正文写好。
2. **Phase ②（`edit`）**：作家用原生 `edit` 往同一篇 chalk 注入 `status` / `choice` / `roll_dice`（`doc-05 §5` 阶段②），也可顺带润色正文。它走 **B 入口**（`tool_result` hook 兜 `write`/`edit`，`00 §4.2`），落 `entity_edited`。

**所以「frontmatter 在正文阶段还是回写阶段写」的定案是：骨架在正文阶段（工具保证），互动字段在回写阶段（Phase ② 的 `edit`）。** `doc-07` 的风险表写的是「**格式错**由 Phase ② 兜底」——工具把「格式」这件事从提示词里拿走了（`type` / `title` + `yamlScalar` 的引号规则），Phase ② 要兜的只剩「互动字段的内容」。见 §9.3 的完整论证。

---

## 4. 文件与副作用

### 4.1 改哪些文件

| 形态 | 写 | 读 |
|---|---|---|
| A（默认命名新建） | `store.writeFile(<layerDir>/NN-slug.md)` —— **新文件，可直接写** | `store.listFiles(layerDir)`（算序号）、`linkTo` 端点存在性 |
| B（显式新建） | `store.writeFile(path)` | 目标存在性、`linkTo` |
| C（append） | `store.writeFileAtomic(appendTo)`（**改写既有文件，MUST 原子**，`01 §2.7`） | `store.readFile(appendTo)`、`parseFrontmatter` |
| D（+link） | 另写 `canvas.db` 的 `links` 表（经 `linkCards`） | — |

**只碰三种目录**：`world/**`（层内板书）、`player/**`（玩家小天地）、`characters/<id>/**`（角色小天地）。`characters/<id>/` **根目录本身即小天地**（`00 §2.2`），所以角色的「作品.md」（`doc-05 §8.2`）走的就是这个分支。

### 4.2 `type: chalk` frontmatter 骨架（本文定案，字段名与顺序冻结）

**下文是 chalk 文件的完整字段集与 YAML 物理顺序**（前端 formatter、`look_at`、Phase ② 的 `edit` 都按这个顺序读）。`chalk` 工具**实际只写 1–2 两行**（`type` / `title`）；3–6 是 Phase ② 或 C/E 入口补的。writer 保证：**无论谁先写，最终文件的键序就是这个**。

```yaml
---
type: chalk                       # 1. 恒有 — 工具写；渲染类型判定（cardKindOf, forms.ts:49）
title: The Closed Piano           # 2. 恒有 — 工具写；卡片标题 + 默认文件名 slug 来源
anchor: "world/manor/keys.md"     # 3. 可选 — frontmatter.extra：贴在哪个实体身侧（前端改造计划 §T4.10）
roll_dice:                        # 4. 可选 — 互动字段，形状归 06
  type: 1d100
  desc: Pick the rusted lock
  expect: ">50"
choice:                           # 5. 可选 — 同上
  - Open the lid
  - Play the unfinished nocturne
status:                           # 6. 可选 — 同上
  data:
    lid: closed
    tune: unknown
---
```

- **`type` / `title` 恒有、由工具写**：它们是「这是 chalk」与「这段字叫什么」两件事，且是文件名的来源（§2.4）。
- **互动字段的位置在 `title` 之后**：`doc-09` 明确三者「类 md 表格渲染、可折叠、随所属实体走」，渲染在**正文下方**；YAML 里放在 body 前面，视觉顺序自然。`buildFrontmatter` 按此顺序拼；Phase ② 的 `edit` 加键时**插在 `title` 之后、`---` 之前**，不追加到末尾（`doc-23` 的 preset 提示词纪律，§11 冲突 3）。
- **`component` / `material` / `bg` 一概不写**：它们是 README/组件的控制字段。chalk 的渲染变体（`font: hand` / `big` / `color`）经 `frontmatter.extra` 透传，`chalkStyleOf`（`forms.ts:88-101`）已认得。
- **不写 `created` / `mtime` / `seq`**：mtime 由文件系统给（`doc-22` 的 `recent_chalk` 直接用它）；序号在文件名里；时间戳不是 chalk 的字段。
- **不写 `result` / `passed`**：骰子结果由引擎在 `roll_dice` 时回写（`doc-05 §3.1`「作者不写 result」）。C/E 入口显式传了 `frontmatter.roll_dice.result` 时才透传（初始化场景罕见但合法）。

### 4.3 格式化：新 writer `stringifyChalkFile`

**现状 `stringifyChalk`（`frontmatter.ts:123-148`）不够用**，四处硬伤：

| 现状 | 行 | 问题 |
|---|---|---|
| `choice` 每项 `"${item}"` 强制加引号 | `:128` | 选项里含 `"` 时不转义 → 写出的 YAML 自己破坏自己（`choice: ["say "hi""]`） |
| `status.data` 每项 `"${sv}"` 强制加引号 | `:133` | **数字变字符串**：`资金_万美元: 1.5` → `"1.5"`，`doc-06 §2.6` 的样例里 `技术进度: 3` / `算力指数: 6` 全是数字，前端表格类型当场错 |
| `roll_dice` 缩进 `    ${rk}:`（**4 空格**） | `:138` | 其余子块用 2 空格（`:128`/`:131`），YAML 里子键缩进不一致——手写解析器（`parseFrontmatter` 走 `line.indexOf(':')`）侥幸能读，任何标准 YAML 库会炸 |
| 其它键 `JSON.stringify(v)` | `:141` | `title: "x"` 尚可，但 `big: true` 写成 `true`、`size: large` 写成 `"large"`——与 `parseFrontmatter:69-81` 的「带引号才当字符串」规则**合得上**（这是它唯一做对的地方） |

**定案：新增 `stringifyChalkFile`（同文件，不删旧函数——`routes/world.ts:379` 的 `/dice` 回写还在用，`12` 收编后旧函数自然退役）**：

```ts
// packages/shared/src/schemas/frontmatter.ts
/**
 * Scalars: quote ONLY when the bare form would stop round-tripping
 * (empty / leading-trailing space / looks numeric / looks boolean / has ': ' or '#'
 * or starts with a YAML indicator). `parseFrontmatter` reads quoted => string,
 * bare numeric => number (frontmatter.ts:69-81), so this keeps status.data types.
 */
export function yamlScalar(v: unknown): string;

/**
 * Key order FOLLOWS the insertion order of `frontmatter` (the tool builds it in
 * the frozen order of §4.2). Never sorts, never drops unknown keys.
 * Nested blocks are indented with 2 spaces — the same depth everywhere.
 */
export function stringifyEntityFrontmatter(
  frontmatter: Record<string, any>,
  interactive: Record<string, any>
): string;               // returns the `---…---` block WITHOUT the trailing blank line

/** Full file: frontmatter block + blank line + body + trailing newline. */
export function stringifyChalkFile(fm: Record<string, any>, body: string): string;
```

**四条的落地**：

1. **冒号/井号/数字/布尔/引号**：`yamlScalar` 只在必要时加双引号，并转义内部 `"` 与 `\`。`expect: ">50"` 仍带引号（`>` 是 YAML 折叠标量指示符）；`desc: Pick the rusted lock` 不带；`result: 62` 不带。
2. **`status.data` 保留类型**：`1.5` → `1.5`，`true` → `true`，`"(未定名)"` → `"(未定名)"`（含括号本身不触发引号，但它是字符串——无引号会被读成字符串，round-trip 成立，所以不加）。
3. **缩进统一 2 空格**：`status:\n  data:\n    k: v`、`roll_dice:\n  type: …`、`choice:\n  - Open the lid`（选项仅在必要时加引号，同 1）。
4. **不排序、不丢键**：`extra` 里的 `anchor` / `font` / `hue` 原样走到末尾；未知键（将来 `doc-09` 加字段）也不会被静默吞掉——`parseFrontmatter` 的 `passthrough` 语义（`ChalkFrontmatterSchema` 现在就是 `.passthrough()`，`frontmatter.ts:23`）在 writer 侧对偶成立。

> **`parseFrontmatter` 的两处缺口**（本文登记，实现时一并补齐，属本工具范围因为 chalk 是它的主消费者）：
> - **`type: chalk # 注释`**：`:52-55` 只 `indexOf(':')` 再 `trim`，`#` 之后的内容会进值里 → `type` 变成 `"chalk # 注释"`，`cardKindOf` 当场认不出是 chalk。建议剥 `#` 前的值（引号内的 `#` 不剥）。
> - **空 `choice:`**（无条目）→ `frontmatter.choice = []`，前端渲染空选项组。建议空数组在渲染侧跳过（前端 `lib/fm.tsx`），解析侧保留。

### 4.4 写盘原子性

| 场景 | API | 理由 |
|---|---|---|
| 新建（A / B） | `store.writeFile` | 新文件不存在，没有「读到半截」的窗口 |
| 续写（C） | `store.writeFileAtomic` | 改写既有文件；`01 §2.7` 冻结「same-dir tmp + rename，失败时原文件不动」 |
| `linkCards` | `canvas.db` 事务 | 归 09 |

`writeFileAtomic` 的 `rename` 是**同目录**操作（POSIX 原子），跨目录会退化成 copy+unlink。这就是 `01 §2.7` 写「same-dir tmp」的原因；chat 续写同目录改写，满足。

---

## 5. 落账（`entity_created` + 可能的 `entity_edited`）

### 5.1 事件全字段

**A/B/D-新建形态 → 恰一条 `entity_created`**（`00 §5.2` / `doc-21 §4.1` 的字段名冻结）：

```ts
await store.appendEvent({
  type: 'entity_created',
  actor: ctx.actor,                                   // writer | character:<id>
  subject: path,                                      // 新建路径（01 §4 表第 1 行）
  layer: await store.resolveLayer(path),              // 01 §2.7；world/ 下的层 id
  turn: ctx.turn,                                     // 01 §3.7 的锚
  detail: {
    path,                                             // 稳定 id
    name: title,                                      // 当时的名字（doc-21 §3.3）
    kind: 'chalk',                                    // 00 §5.2 的封闭枚举
    summary: firstLine.slice(0, 120),                 // 至多一行；不存正文（doc-21 §3.3）
  },
});
```

- **`name` 用 `title`，缺省用文件名 slug**（`01 §4` 表最后一行明文：`frontmatter title，缺省用文件名 slug`）。
- **`summary` 只放一行**：`doc-21 §3.3`「不存正文」+ `00 §8` 反模式「事件只带 path + name + 至多一行摘要」。取正文首个非空行，截 120 字符。
- **`layer` 用 `resolveLayer(path)`**：`world/**` 返回层 id；`player/**` 与 `characters/**` 返回 `null`（`01` 冻结：背包与角色小天地不是「层」）。`null` 合法——`layer_entered`/`layer_initialized` 之外的许多事件都是 `null`（`01 §3.9`）。

**C 形态（append）→ 恰一条 `entity_edited`**：

```ts
await store.appendEvent({
  type: 'entity_edited',
  actor: ctx.actor,
  subject: appendTo,
  layer: await store.resolveLayer(appendTo),
  turn: ctx.turn,
  detail: {
    path: appendTo,
    name: existingTitle,                              // 改动前读到的 title（01 §4 表）
    kind: 'chalk',
  },
});
```

**为什么 append 是 `entity_edited` 而不是 `entity_created`**：`doc-21` 准入第一问「它改变了世界吗」——续写改的是**已存在的文件**，`entity_created` 的人话模板是「《02-柜台》落成了」（`doc-21 §4.1`），说续写会让作家以为多了一篇；`entity_edited` 的「《01-雨夜》被改过了」才是事实。

**`link_to` 不落第二条事件**：`01 §4.1` 明文 `linkCards` 不落事件（canvas 状态是「当前值」，`doc-21 §1.1` 第二行）。新建 chalk 全程**只有一条** `entity_created`；`b1-design-01` 的复核回执同此口径。

### 5.2 `turn` 与 `actor`

| 入口 | `turn` | `actor` |
|---|---|---|
| A（工具） | `turn:<sessionId>:<turnIndex>`（`01 §3.7`，工具壳从 `currentTurnAnchor(ctx)` 取） | `AIRP_AGENT_ROLE` → `resolveAgentActor` |
| C（god-action 收编后） | `req:<randomUUID()>`（一次请求一个锚） | `{type:'god'}` |

**同一轮落三篇 chalk 用同一个 `turn`**：合并规则（`doc-21 §5.4` 第 1 条）会把它们合成「作家刚落了 3 篇板书」，而不是三行。这正是 `turn` 锚存在的理由（`doc-21 §3.4`）。

### 5.3 失败时不落

十步里任何一步抛 `ActionError` → **不落事件**（`doc-21 §3.6`）。两种「写了一半」的失败单列在 §7。

---

## 6. WS 与前端

### 6.1 前端现在的路径（基线事实）

`event-bridge.ts` 已经有 chalk 的**两帧**，键在 **`toolName`** 上，与本工具天然对齐：

| 时机 | 帧 | 证据 |
|---|---|---|
| `tool_execution_start`（`toolName==='chalk'`） | `{ type:'chalk_writing', source, toolCallId }` | `event-bridge.ts:63-70` |
| `tool_execution_end`（`toolName==='chalk'\|\|'write'`） | `{ type:'chalk_landed', source, path? }`，`path` 从 `args.path ?? result.path` 取 | `event-bridge.ts:71-87` |

### 6.2 工具 `details` 里带什么（本文定案，`01 §5` details 冻结 + 本节加字段）

```ts
export interface WriteChalkDetails {
  path: string;              // 最终落盘路径（稳定 id）—— 前端与模型都用它
  created: boolean;          // true = 新建；false = append
  appended: boolean;         // 与 created 互补（两个都给，调用者读哪个都行）
  name: string;              // = title，落账 detail.name
  layer: string | null;      // resolveLayer(path)
  /** Opaque correlation id echoed back from `WriteChalkInput.clientRef` (god-mode optimistic UI, m-19). */
  clientRef?: string;
  link?: { from: string; to: string };            // 仅当 linkTo 给了，且 linkCards 成功
  /** Present ONLY when a link was requested but linkCards threw (§7.3). Never both. */
  linkFailure?: { to: string; code: string; message: string };
  long?: boolean;            // true = body 超出 §7.4 的 200 字符纪律（只提示，不拒绝）
  event?: WorldEvent;        // 01 §2.2：ActionResult 的 event（append 时是 entity_edited）
}
```

- **`path` 必须有**：`event-bridge.ts:83-84` 的 `result.path` 正是从它取。当前工具不存在时，这条路只靠 `args.path` 兜（`event-bridge.ts:84`）——**默认命名时 `args.path` 恒为 undefined**，帧就丢了路径。`details.path` 是这块的修复。
- **`created` / `appended` 两个布尔都给**：`b1-design-01` 回执确认 details 形状；互补字段是刻意的冗余，避免调用者写 `!created` 还得推理。

### 6.3 server 侧要不要加映射（本文的取舍）

**定案：B1 不加新帧名，只补一个细节。**

理由链：

1. `doc-21 §7` / `00 §5.3` 冻结「帧名与事件 type 不共用一个命名空间」——演出帧是瞬时传输帧，世界事件统一包在 `world_event` 里。
2. `chalk_landed` / `chalk_writing` 是**既有帧**（`后端实现计划.md:209-211` 已把它们列为合成帧清单的一部分），前端 `useWorld.ts` 现在**不消费**它们（只认 `file_changed` / `item_moved` / `god_action`，`useWorld.ts:171-181`），消费落在 `前端改造计划.md §T3.4` 的演出通道。
3. 工具想推帧只能靠 `details` 或落事件（`00` 硬约束），而 `details` 经 `tool_execution_end.result` 流到 server 的 `onEvent`（`00 §1` 图）——**这正是 `event-bridge.ts:83` 已经在读的字段**。

**唯一要补的**：`event-bridge.ts:84` 的 `args?.path ?? resultPath`——当 `chalk` 默认命名（无 `args.path`）时，`resultPath` 必须来自 `details.path`。现状 `result.path` 直读顶层，而 `details` 在 `result.details` 里。**修法**（归 `12`，本文只登记）：

```ts
// event-bridge.ts:83-85 before:
const resultPath = typeof event.result === 'object' && event.result !== null
  ? (event.result as Record<string, any>).path : undefined;
// after（兼容两种形状：工具结果可能把 details 平铺或嵌套）:
const r = event.result as Record<string, any> | null;
const resultPath = r?.path ?? r?.details?.path ?? undefined;
```

> 这是本文对 `12` 的**唯一**请求，登记在 §11。`chalk_writing` 不需要任何改动：`tool_execution_start` 时 `args` 就是模型给的原始参数，帧只需要表达「笔尖落下了」。

### 6.4 前端拿到后演什么（现状即目标，不新造）

| 帧 | 演出 | 出处 |
|---|---|---|
| `chalk_writing` | 红杆铅笔的笔尖飞到书写点；纸条飞出意象 | `doc-06 §2.1`、`doc-07 §3 D3` |
| `writer_delta` | chalk 逐字湿墨流式 | `event-bridge.ts:46-50`、`doc-06 §2.1` |
| `chalk_landed`（带 `path`） | 幻影壳 → 内容落地 → 座位过户；湿墨洇干 | `doc-10 E3`、`前端改造计划.md §T3.4` |

**画布刷新走的是另一条**：`chalk` 落盘后 `fs.watch` 触发 `file_changed`（`event-bridge.ts:136-148`）→ `useWorld.fetchLayer` 重取本层（`useWorld.ts:179-181`）→ 新文件出现在 `items` 里 → 未排座卡片经 `seatUnplaced` 得到座位（`world.ts:164-169`）→ `ChalkCard` 渲染（`ChalkCard.tsx`）。**演出帧与数据刷新是两条独立通道**，这正是 `doc-21 §1.1` 第一行的意思（帧是动画，不是变化）。

### 6.5 收起 / 风化不由工具管（划界）

**收起（`collapsed` / `aged`）不由工具管**：`doc-10 E2` 的「记忆风化」是前端按「年龄」渲染（`chalkStyleOf` 的 `collapsed` / `aged`，`forms.ts:95-100`）。工具在这一环只提供一个事实——**文件的 mtime**（它决定「年龄」），不写任何 `collapsed` / `aged` 键。`doc-08` 的 `fold_chalk` / `type: scenario` 是**赛后**的治理工具，B1 不做（`doc-08` 文末标记）。


---

## 7. 错误与边界

全部走 `ActionError`（`01 §2.4`），**抛错 = 不落事件、不静默降级**。文案英文（`00 §6.2`）。

### 7.1 完整失败表

| 触发 | code | 英文文案（`message` 逐字） | 落事件 |
|---|---|---|---|
| `body` 空 / 非 string | `invalid_argument` | `chalk needs a non-empty 'content'` | 否 |
| `path` + `append_to` 同给 | `invalid_argument` | `chalk accepts either path (create) or append_to (append), not both` | 否 |
| `path` + `layer` 目录不一致 | `invalid_argument` | `path '…' is not inside layer '…'` | 否 |
| `append_to` 与目标目录不同层 | `invalid_argument` | `append_to must stay in the same layer as the new chalk (got '…' vs '…')` | 否 |
| 路径绝对 / 含 `..` / 含 `.` 段 | `invalid_path` | `path '…' must be world-relative POSIX without '.', '..' or a leading '/'` | 否 |
| 首段不是 `world`/`player`/`characters` | `invalid_path` | `chalk can only write under world/, player/ or characters/ (got '…')` | 否 |
| 目标不是 `.md` | `invalid_path` | `path '…' must end with '.md'` | 否 |
| 目标是 `README.md` | `not_movable` | `README.md is a layer's identity, not a chalk target` | 否 |
| 目标已存在（B 形态） | `already_exists` | `'…' already exists; use append_to to continue it, or edit to change it` | 否 |
| `append_to` 不存在 | `not_found` | `append_to target '…' does not exist` | 否 |
| `append_to` 目标不是 chalk（如 `type: note` / README） | `malformed_entity` | `append_to target '…' is type '…', not 'chalk'` | 否 |
| `link_to` 端点不存在 | `not_found` | `link_to endpoint '…' does not exist` | 否 |
| `frontmatter.extra` 里有 `type` / `title` | `invalid_argument` | `frontmatter.extra must not override 'type' or 'title'` | 否 |
| 默认命名时层目录不存在 | `not_found` | `layer directory '…' does not exist` | 否 |
| 无法确定层（工具面无 `path` 也无 `layer`，且调用者没提供上下文） | `invalid_argument` | `chalk needs either 'path' or a layer directory to name the file` | 否 |
| 写盘失败 | `write_failed` | `Failed to write '…': <os error>` | 否（还没到落账） |
| 原子写失败 | `write_failed` | `Failed to write '…' atomically: <os error>`（**原文件未动**） | 否 |
| 落盘成功、`appendEvent` 抛错 | `event_failed` | `File was written but the world event could not be recorded` | 否（账没落上） |
| `linkCards` 失败（落账已成功） | — | 见 §7.3 | **是**（`entity_created` 已落） |

### 7.2 校验顺序（为什么 README 先于「已存在」报）

`README.md` 的拒绝（`not_movable`）排在**第 5 条校验**里，先于存在性检查——顺序重要：先报「README 不能当目标」比先报「已存在」更准确（README 几乎一定已存在）。这两条只对显式 `path`（B 形态）有意义：A 形态生成的 `NN-slug.md` 既不叫 README、也不可能已存在（序号是算出来的空号）。

### 7.3 落账后连线失败（本文定案）

`linkCards` 在落账**之后**（第 9 步）。它抛错时世界已经变了（文件在、事件在），只是线没建。**注意：这不是一个 `ActionErrorCode`**——失败的是第 9 步，chalk 本身成功了，所以**不抛错、不置 `isError`**，而是部分成功 + 可见警告。三种处理：

| 方案 | 结果 |
|---|---|
| 整条工具报 `isError:true` | **错**——模型以为 chalk 没落成，会重写一篇，得到两篇 |
| 静默吞掉 | **错**——违反 `00 §6.2`「错误不得静默降级」 |
| **部分成功 + 可见警告** | **定案** |

```
isError: false
content: "Wrote world/baker-street/03-lamplight.md.\nNote: could not link it to 'world/baker-street/copper-key.md' (<reason>). The chalk itself is saved."
details: { path, created: true, appended: false, name, layer, linkFailure: { to, code, message }, event }
```

- **`isError: false` 因为世界确实变了**（`doc-21` 准入第一问）：文件在、事件在，chalk 的任务完成了。报错会让模型重试并造出重复板书。
- **文案必须点名「chalk 本身已保存」**：这是模型唯一能据以决定「补一条 `link`」还是「重写」的信息。
- **`details.linkFailure` 是稳定字段**：前端/探针据此判断要不要提示「线没连上」。
- **不补偿、不回滚**：与 `01 §3.6` 对 `event_failed` 的定案同构——补偿会引入第二条失败路径。

### 7.4 长度：>200 字怎么办（本文定案，对应任务书第 9 项「字数纪律」）

**定案：工具不强制、只警告；硬上限另设 4000 字符。**

| 阈值 | 行为 |
|---|---|
| ≤ 200 字（按字符数近似，含空白） | 静默通过 |
| > 200 字 | **照常落盘**，在返回 `content` 追加一行英文提示：`Note: this chalk is N characters; the discipline says keep a single chalk short (<=200) and continue it with append_to.` `details.long = true` |
| > 4000 字符 | 照常落盘，提示同上（不截断——截断等于篡改叙事内容，比长文本更糟） |

**为什么是提示词约束而不是工具强制**（判据）：

1. **强制违反「不为难模型」的失败哲学**。`doc-07` 纪律是**创作纪律**（「一条 chalk ≤ 200 字」写在 preset 里），不是数据完整性约束。工具拒绝会逼模型把一段好叙事切成两半重写，而那两半各自可能更差（叙事完整性受损）。
2. **没有可依据的「字」定义**。中文按字、英文按词、markdown 语法算不算——`200 字` 是给人看的口径。工具用「字符数」近似是**有意的宽松**：中文 200 字 ≈ 200 字符，英文 200 字 ≈ 1200 字符，都会触发提示，但都不会拒绝。
3. **有别的闸**。`doc-08` 定案 1 的软提醒是「同层 >1000 字的 chalk 超过 N 篇（默认 30）时提示作家 fold」——**长文本的治理归 doc-08，不归 chalk 工具**。工具在这里再拦一道，就是把一个已有归宿的问题抄成两份实现。
4. **本工具的返回文本是天然的提醒位**。`doc-23 §2.4` 的「每步带判据」精神：模型看到「这篇 480 字符」比看到一条抽象纪律有效得多。

`details.long` 是给探针与前端用的稳定字段（探针可断言「D1 那篇开场 chalk 不超 200 字符」）。

### 7.5 会撞上的边界

| 边界 | 行为 |
|---|---|
| 同层已有 `01-…` `02-…` `04-…`（空洞） | 取 max+1 = `05`。**不填洞**——填洞会让序号与时间顺序脱钩，`recent_chalk`（按 mtime）与画布顺序（按序号）矛盾 |
| 同层已有 `99-…` | `100-…`（三位，零补只保证两位）。不去重、不报错 |
| `title` 全是非 ASCII（如「雨夜」） | slug 退化为空 → 用 `chalk` 作 slug → `03-chalk.md`。**不音译**（音译表是另一件事，`AGENTS.md §1.1` 要求文件名 ASCII） |
| `title` 含 `/` `\` `:` `*` 等 | slug 生成时剥掉（同 `App.tsx:220` 的非法字符集 `[/\\?%*:\|"<>]`） |
| `body` 含 frontmatter 定界符 `---` | 原样保留（它在正文里就是 `<hr>`）；writer 不会把它当定界符（只在整文件开头写一次） |
| `append_to` 指向本工具刚建的文件（同轮） | 合法。`turn` 相同 → `entity_created` + `entity_edited` 同锚；`doc-21 §5.4` 第 2 条只折叠「同 subject 连续 entity_edited」，一条 created + 一条 edited 不会被吞 |
| 世界目录里已有无序号 `evening.md` | 不参与编号计算，不被改名（`00 §2.3`） |

---

## 8. 要实现/修改的代码落点

### 8.1 精确到文件与函数

| 文件 | 改动 | 函数/符号 |
|---|---|---|
| `packages/shared/src/actions/chalk.ts` | **新建** | `writeChalk(ctx, input): Promise<ActionResult<WriteChalkDetails>>`；私有 `slugify` / `nextOrdinal` / `buildFrontmatter` / `renderAppend` / `composeText` / `assertPath` |
| `packages/shared/src/actions/chalk.ts` | 新建 | `WriteChalkInput` / `WriteChalkDetails` / `ChalkFrontmatterInput` 类型导出 |
| `packages/shared/src/actions/chalk.ts` | 新建 | `import { linkCards } from './canvas.js'`（§2.6 的顺手连线；**跨模块调用已获 `01` 许可**，见 `b1-design-01` 复核回执） |
| `extensions/toolkit/chalk.ts` | 新建（本文 §8.2） | `deriveTitle(body)`（工具壳的推导，**不在动作层**：动作层按 `01 §5` 收 required `title`） |
| `packages/shared/src/actions/service.ts` | 改（01 的骨架） | 绑定 `writeChalk: (i) => writeChalk(this.ctx, i)` |
| `packages/shared/src/actions/chalk.ts` | 新建 | **实现期落地**：`yamlScalar` / `stringifyEntityFrontmatter` / `stringifyChalkFile`（§4.3）落在 chalk 动作模块内（不在 `schemas/frontmatter.ts`——那是本文原设想；这三个是 chalk 专用的冻结键序整形器，与动作同生命周期）；另加一个**中性 writer** `stringifyFrontmatter(fm, body)`（peer 请求、给 10 的 handler 用）。`schemas/frontmatter.ts` 负责 `parseFrontmatter`（yaml 版，归 06）。 |
| `packages/shared/src/schemas/frontmatter.ts` | 全量重写（归 06） | `ChalkFrontmatterSchema` / `ChalkStatus` / `ChalkFrontmatter` **删除**（保留它就会有人拿去 parse 非 chalk 实体 → 直接失败，`06 §11 冲突 7`）；互动字段改由通用 `InteractiveFieldsSchema` 承担。`02` 只保留一个**动作层输入类型** `ChalkFrontmatterInput`（`actions/chalk.ts:48`），不是 schema。 |
| `packages/shared/src/index.ts` | 改 | 若 `actions/*` 需从包根导出（`writeChalk` 供 `extensions/` 用），加 `export * from './actions/service.js'`（`12` 的活；本文只登记依赖） |
| `extensions/toolkit/chalk.ts` | **新建** | `registerChalkTool(pi)`：`Type.Object` 参数、`promptSnippet`/`promptGuidelines`、`execute` 里调 `createActionService(store, actor)` 的 `writeChalk`，`ActionError` → `isError:true` |
| `extensions/tools.ts` | 改（`12` 的骨架） | import 并调用 `registerChalkTool(pi)` |
| `apps/server/src/routes/world.ts:431-447` | 改（`12`） | god-action 的 `type:'chalk'` 分支改走 `svc.writeChalk({ path: filePath, body: content, title })`，`actor: {type:'god'}`；`world.ts:441` 的 `appendWorldEvent('god_action', …)` 改落 `entity_created`（`doc-21 §4.6`） |
| `apps/server/src/engine/event-bridge.ts:81-87` | 改（`12`，§6.3） | `resultPath` 兼容 `result.path ?? result.details.path` |
| `packages/shared/src/db/schema.ts:54` | 改（`01` 的活） | `events` 表换成十列 + `seq`/`actor_type`/`detail` 等（本文只消费） |

### 8.2 工具壳的形状（`extensions/toolkit/chalk.ts` 骨架）

```ts
import { Type } from 'typebox';
import { createActionService } from '../../packages/shared/dist/index.js';  // 相对路径，非包名（00 §6.1）

export function registerChalkTool(pi: ExtensionAPI, store: WorldStore, actor: Actor, layerOf: () => string | null): void {
  pi.registerTool({
    name: 'chalk',
    label: 'Chalk',
    description:
      'Write a piece of narration onto the canvas as a real markdown file. ' +
      'Use it for what the player reads: scene description, dialogue beats, the result of an action. ' +
      'The tool names the file, writes the `type: chalk` frontmatter, and records the world event. ' +
      'Pass `append_to` to continue an existing chalk instead of starting a new one; ' +
      'pass `link_to` to draw a relation line from this chalk to something on the same canvas. ' +
      'Do NOT use bash or write to create chalk — they skip the event log and the naming contract.',
    parameters: Type.Object({
      content: Type.String({ description: 'The narration body in markdown (no frontmatter).' }),
      path: Type.Optional(Type.String({ description: "Explicit world-relative target, e.g. 'world/baker-street/03-lamplight.md'. Omit to let the tool name it." })),
      link_to: Type.Optional(Type.String({ description: 'World-relative path of a card on the same canvas to link this chalk to.' })),
      append_to: Type.Optional(Type.String({ description: 'Existing chalk path to append to instead of creating a new file.' })),
    }),
    promptSnippet: 'chalk — land narration as a real chalk file on the canvas (in-chat text never reaches the canvas).',
    promptGuidelines: [
      'Use chalk whenever the player should read a new passage of narration.',
      'Use append_to when you are continuing the same beat, rather than starting a new chalk file.',
      'Never write chalk files with write or bash: they bypass the filename convention and the world event log.',
    ],
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const layer = layerOf();                                 // §12 待定项 1；null => 走显式 path 才合法
      const svc = createActionService(store, actor, { turn: currentTurnAnchor(ctx) });
      try {
        const r = await svc.writeChalk({
          body: params.content,
          title: deriveTitle(params.content),                  // §2.5：工具面没有 title
          layer: layer ?? undefined,
          path: params.path,
          appendTo: params.append_to,
          linkTo: params.link_to,
          // no `frontmatter`: interactive fields arrive in Phase ② via `edit` (§2.7)
        });
        return { content: [{ type: 'text', text: r.text }], details: r.details };
      } catch (err) {
        if (err instanceof ActionError) return err.toToolResult();
        throw err;
      }
    },
  });
}
```

`store` 与 `actor` 由 `extensions/tools.ts` 在扩展加载时构造一次（`new LocalWorldStore(ctx.cwd)` + `resolveAgentActor(process.env.AIRP_AGENT_ROLE)`），**不是每次 execute 新建**——每个工具一次 `WorldStore` 会各自开两个 SQLite 连接（`00 §1` 的「两侧各自 new 一个」指的是**两个进程**，不是两个工具）。

### 8.3 `packages/shared/src/actions/chalk.ts` 的结构（伪代码）

```ts
export async function writeChalk(ctx: ActionContext, input: WriteChalkInput): Promise<ActionResult<WriteChalkDetails>> {
  const body = normalizeBody(input);                        // 步骤 1
  const shape = resolveShape(input);                        // 步骤 2：A|B|C
  const target = shape.kind === 'append'
    ? await readAppendTarget(ctx, shape.appendTo)           // 步骤 3b：read + parse + type check
    : await resolveNewPath(ctx, shape);                     // 步骤 3a：layer dir + NN + slug
  if (shape.kind !== 'append') await assertNotExists(ctx, target.path);   // 步骤 4
  if (input.linkTo) await assertLinkEndpoint(ctx, input.linkTo, target.dir); // 步骤 4

  const fm = buildFrontmatter(input, target, shape);        // 步骤 5（§4.2 顺序）
  const text = shape.kind === 'append'
    ? renderAppend(target.existing!, fm, body)              // 步骤 6（§3.1 分隔）
    : stringifyChalkFile(fm, body);

  if (shape.kind === 'append') await ctx.store.writeFileAtomic(target.path, text);  // 步骤 7
  else await ctx.store.writeFile(target.path, text);

  const event = await ctx.store.appendEvent({ ... });       // 步骤 8（§5.1）

  let link, linkFailure;
  if (input.linkTo) {                                       // 步骤 9（§7.3）
    try { link = (await linkCards(ctx, { op: 'create', from: target.path, to: input.linkTo })).details; }
    catch (err) { linkFailure = { to: input.linkTo, code: err.code, message: err.message }; }
  }
  return { text: composeText(...), details: { path:, created:, appended:, name:, layer:, link, linkFailure, event, long } };
}
```

**纯函数可单测的部分**（不与 I/O 混）：`slugify` / `nextOrdinal(已有的文件名列表)` / `buildFrontmatter` / `renderAppend` / `composeText` / `yamlScalar` / `stringifyChalkFile`。I/O 部分：`resolveNewPath`（listFiles）/ `readAppendTarget` / `assertNotExists` / `writeFile*` / `appendEvent`。

---

## 9. 与现存实现的差异

### 9.1 `stringifyChalk`（`frontmatter.ts:123-148`）

| 现状 | 要改成 | 迁移影响 |
|---|---|---|
| `choice` 项恒加引号，不转义内部引号 | `yamlScalar` 按需加引号 + 转义 | 输出略变（不再全引号）；`parseFrontmatter:88` 双向兼容，读写 round-trip 成立 |
| `status.data` 全转字符串 | 保留 number/bool | **前端从「全字符串」变成正确类型**——`lib/fm.tsx` 现在把 status 当字符串渲染，`1.5` 会从 `"1.5"` 变成 `1.5`，显示等价；将来图表化才真正用上（`doc-09` 待设计 #2） |
| `roll_dice` 子键缩进 4 空格 | 统一 2 空格 | 手写解析器不受影响（`indexOf(':')`）；标准 YAML 库从此能读 |
| `title` 等经 `JSON.stringify` | `yamlScalar`（多数键不加引号） | 输出更接近手写样例（模板 `evening.md:2-14` 就是无引号风格） |
| 函数只有 `stringifyChalk` | 加 `stringifyChalkFile` / `stringifyEntityFrontmatter` / `yamlScalar` | **旧函数保留**：`routes/world.ts:379` 的 `/dice` 回写还在用，`12` 收编 `/dice` 到 `rollDice` 后自然退役。**不删**（删了会让 B1 中途 `pnpm build` 失败） |

### 9.2 前端手拼 chalk（`App.tsx:233-235`）

| 现状 | 要改成 |
|---|---|
| `filePath = \`${parentDir}/chalk-${cleanSlug}.md\`` | 走 `writeChalk` 的默认命名（`NN-slug.md`）——`chalk-` 前缀是原型残留，与 `00 §2.3` 的约定冲突 |
| `fileContent = \`---\ntype: chalk\n---\n${content}\`` 手拼 | 工具写骨架 + `title` |
| `POST /api/god-action`（`App.tsx:242-247`） | 路由内改调 `svc.writeChalk(..., actor: god)`（`12`） |

**迁移影响**：上帝模式新建的 chalk 从此也进事件表（现在 `god-action` 落 `god_action` 旧类型）。`doc-21 §4.6` 已删 `god_action` → `entity_created` + `actor_type: god`（§11 冲突 8）。

### 9.3 frontmatter 在哪个阶段写（对应任务书第 8 项「与迭代的关系」）

**定案：骨架（`type` / `title`）由 `chalk` 在正文阶段写；互动字段由 Phase ② 的 `edit` 写（工具面无此参数，§2.1/§2.7）。动作层对 C / E 入口额外开放 `frontmatter` 字段作一次性写入。**

| 文档 | 原口径 | 本文的落地 |
|---|---|---|
| `doc-05 §5` 阶段① | 「`[chalk]` 写下本轮剧情正文（落盘 xxx.md）。**只专注叙事，不做复杂数值计算**」 | 工具的 `content` 就是正文；`chalk` **只**写骨架。互动字段不是它的参数（§2.1）——阶段① 的描述与工具面完全一致 |
| `doc-05 §5` 阶段② | 「`[edit]` 对刚生成的 chalk 文件二次补充：frontmatter 注入 status/choice/roll_dice」 | 走 B 入口（`tool_result` hook，`00 §4.2`），落 `entity_edited`。**这是互动字段的唯一 agent 侧入口** |
| `doc-07 §2` 风险表 | 「frontmatter 格式错由 Phase ② 的二次 edit 兜底，正文阶段不背格式责任」 | **工具把「格式」从这条里拿走了**：阶段① 产出的文件骨架一定对（`type` / `title` + `yamlScalar` 的引号规则）。Phase ② 要兜的只剩「互动字段的内容」 |
| `后端实现计划.md:262` | 「`chalk` 工具内部负责：落盘路径约定、`type: chalk` frontmatter 骨架、`append_to` 续写、`link_to` 顺手建线」 | 逐条落成本文 §2.4 / §4.2 / §3.1 / §2.6。施工单说的是**骨架**，没有说互动字段——两处一致 |

**为什么这么切**（四条理由，任一都够）：

1. **工具面是模型唯一看得见的东西**。`doc-20` 把签名冻结成四参数；本文不开口子，`doc-05 §5` 的两段式纪律就仍然是唯一纪律——**不存在「两个都能写 choice 的入口」**，也就没有「作家该用哪个」的歧义。
2. **两段式的认知价值**：阶段①「只写好东西」是 `doc-23 §2.4` 的「一次只做一件事」。把 `status`/`choice` 塞进 `chalk` 会把「想叙事」和「算数值」压回同一轮，正是 `doc-05 §5` 想避免的。
3. **格式责任已归零**：骨架由工具保证，Phase ② 的 `edit` 只是在**已知正确**的 YAML 上加键，不需要模型重新理解 YAML 缩进/引号规则。`doc-07` 那条风险从「靠 preset 纪律」降级为「工具内部实现的测试项」（§10.1 的 round-trip 测试就是它）。
4. **C / E 入口仍可一次写完**：上帝模式弹窗、初始化子代理直接调动作层传 `frontmatter`，不必先 `writeChalk` 再 `edit` 两步。工具面窄，动作层宽——这正是 `01 §2` 两层结构的用途。

**代价与迁移**：作家 preset 的「Single-Turn Pipeline Discipline」（`doc-23 §3.2`）**无需改动**——它本来就写着「Phase ② 注入 frontmatter」，现在只是「Phase ① 的 `chalk` 一定会把骨架写好，你只管给正文」。`doc-23` 里唯一值得补的一句：Phase ② 不再需要操心 YAML 形状。

### 9.4 与 `doc-08` `append_to` 治理的关系（任务书第 8 项的另一半）

`doc-08` 记着两条未定案：「`append_to` 把同场景连续小段连成一篇文章（`doc-05 §9.1` 已有参数）——**工具存在，但作家提示词骨架没教作家用它**——能力与纪律脱节」。

**本文的落地**：

1. **能力侧**：`append_to` 落成真实函数（§3.1 的七条定案——分隔/标题/mtime/序号/合并/覆盖/同层），不再是 `ChalkFrontmatterSchema` 里一个没人读的 `z.string().optional()`（`frontmatter.ts:22`）。
2. **纪律侧**：`promptGuidelines` 明写「Use append_to when you are continuing the same beat」。`doc-23 §3.2` 要求把纪律写进 preset 正文，本条是它的工具面锚点。
3. **治理侧**：`doc-08` 的软提醒（同层 >1000 字 chalk 超过 N 篇 → 提示 fold）**不变**，仍归 `doc-08`/B2 的 Hook。`chalk` 不实现阈值判断，只保证 `append_to` 产生的长文在文件层面是**一篇**（而不是 N 篇），这样 `doc-08` 的阈值按篇数统计才有意义。

> **发现的一处口径不一致**：`doc-08` 定案 1 说「>1000 字的板书基本是 `append_to` 连成的长文段——先治理长文，短板书堆一些无妨」，暗示 `append_to` 是**鼓励**的（把多段连成一篇）；而 `doc-07 §2` 纪律说「一条 chalk ≤ 200 字」。两者不矛盾（200 字是**每次落盘**的片段长度，`append_to` 是把片段连成篇），但 `doc-08` 与 `doc-07` 都该把这句话写明确。见 §11。


### 9.5 `ChalkFrontmatterSchema` 里的 `link_to` / `append_to`

现状：`frontmatter.ts:21-22` 把 `link_to` / `append_to` 定义成 **frontmatter 字段**。但它们是**工具参数**（`doc-20` 表格），不是文件里的键——一个 chalk 文件写完之后，`link_to` 的信息已经在 `canvas.db` 的 `links` 表里，`append_to` 没有留下任何痕迹（续写就是往同一个文件追加）。

**定案：从 `ChalkFrontmatterSchema` 删掉这两个键**（它们从来不是实体属性），由 `06` 的 `BaseEntitySchema` 决定实体字段集。**`link_to` 是 `chalk` 的工具参数**（不是持久 frontmatter 键）：写完文件后调 `linkCards({ op: 'create', from: <新路径>, to: link_to })`（§3 步骤 9 / §2.6），线落在 `canvas.db` 的 `links` 表里、md 里不留下这个键；`04 §3.6` 的 `RefKind` 同步删除这两个键。**迁移影响**：`grep` 全仓（排除 `node_modules`/`dist`）无 `frontmatter.link_to` / `frontmatter.append_to` 的读取点，删除无破坏。

---

## 10. 验收与测试

### 10.1 纯函数单测（无 I/O，`packages/shared` 现有构建即 `tsc -b`，无测试框架）→ 用 `node --test`

仓库现在**没有任何自测**（`find` 无 `*.test.*`，`package.json` 无 vitest/jest）。B1 的最小落地是给 `packages/shared` 加 `node --test`（Node 内建，零依赖，`node:sqlite` 已在用说明 Node ≥ 22）：

```ts
// packages/shared/test/chalk.test.ts   (node --test dist..? -> 用 tsx/jiti 直跑 ts)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, nextOrdinal, yamlScalar, stringifyChalkFile } from '../src/actions/chalk.js';
```

| 断言 | 覆盖的契约 |
|---|---|
| `slugify('The Closed Piano') === 'the-closed-piano'` | §2.4 slug |
| `slugify('雨夜') === 'chalk'`（退化） | §7.5 非 ASCII |
| `slugify('a/b:c*d') === 'abcd'` | §7.5 非法字符 |
| `nextOrdinal(['01-a.md','02-b.md','04-c.md']) === '05'` | §7.5 不填洞 |
| `nextOrdinal(['evening.md']) === '01'` | §2.4 无序号文件不参与 |
| `nextOrdinal(['99-x.md']) === '100'` | §7.5 三位 |
| `yamlScalar(1.5) === '1.5'`；`yamlScalar('1.5') === '"1.5"'`；`yamlScalar('>50') === '">50"'`；`yamlScalar(true) === 'true'` | §4.3 类型保留 |
| `stringifyChalkFile(fm, body)` 的输出 → `parseFrontmatter` **round-trip 相等**（fm 深比较、body 相等） | 本文最核心的不变量：writer 与 parser 互逆 |
| `renderAppend('old\n\n', 'new')` 尾部无累积空行 | §3.1 |
| `buildFrontmatter` 的 key 顺序 = `type,title,<extra>,roll_dice,choice,status` | §4.2 顺序冻结 |
| `buildFrontmatter({ extra: { title: 'x' } }, …)` 抛 `invalid_argument` | §2.7 工具独占键 |

**round-trip 测试尤其重要**：它是「工具保证骨架格式」这个定案唯一的正确性证明——只要 `parseFrontmatter(stringifyChalkFile(x))` 能还原 `x`，Phase ① 的骨架产物对 Phase ② 的 `edit`、对 `look_at`、对前端就是同一份东西。

### 10.2 动作层测试（有 I/O）→ 用临时世界目录

```ts
// 建 tmpdir + 最小 world.json + world/baker-street/README.md
const store = new LocalWorldStore(tmp);
const svc = createActionService(store, { type: 'writer' }, { turn: 'turn:test:1' });
```

| 场景 | 断言 |
|---|---|
| A 形态（只给 body） | 文件 `<layer>/01-<slug>.md` 存在；`parseFrontmatter` 得到 `type:'chalk'` + `title`；`getEventsSince(0)` 恰一条 `entity_created`，`detail.kind==='chalk'`、`detail.path` 对、`detail.name` 对 |
| A 连落三次 | 得到 `01/02/03`；三条事件同 `turn` |
| B 形态 + 已存在 | 抛 `already_exists`；**世界目录未变**（文件内容与 mtime 不变）；**事件表未增** |
| B 形态 + `append_to` 同给 | 抛 `invalid_argument`；无副作用 |
| C 形态续写 | 目标文件 body 变长、含 `\n\n` 分隔、frontmatter `title` 不变、`choice` 被覆盖、`status.data` 被浅合并；事件恰一条 `entity_edited`（**不是** `entity_created`） |
| C 形态指向 `note.md` | 抛错；文件未动 |
| D 形态 `link_to` | `links` 表多一行 `{from: 新path, to: linkTo, layer}`（`queryCanvas('SELECT * FROM links')`）；事件仍**恰一条** `entity_created` |
| D 形态 `link_to` 指向不存在 | 抛 `not_found`；**文件未写、事件未落**（第 4 步先于第 7 步） |
| D 形态 `link_to` 跨层 | 抛 `invalid_argument` |
| 写盘后 kill（模拟） | 用 `writeFileAtomic` 的续写路径：手工在 tmp 目录放一个 `.tmp` 残留，断言原文件仍完整 |
| `body` 为空 | 抛 `invalid_argument` |
| `path` 为 `/etc/x` 或 `../../../x` | 抛 `invalid_path` |

**探针的延伸判据**（`后端实现计划.md:228`）：`prompt("走进厨房，看看有什么")` → 收到 `tool_execution_end(chalk)` → 断言场景目录下多了 `type: chalk` 的 md → **新加两条**：① 该文件能被 `parseFrontmatter` 解析且 `frontmatter.type === 'chalk'`；② `getEventsSince(0)` 里有 `entity_created` 且 `detail.path` 指向它。②是现在探针缺的——它只查了文件，没查事件表。

### 10.3 手测场景（演示动线，`doc-19 §7`）

1. 玩家在 Baker Street 说一句话 → 作家 Phase ① 落 `01-*.md`（骨架）；Phase ② `edit` 注入 `choice` → 画布淡入旁白 + 选项卡片组（D1 验收，`doc-07 §3`）。
2. 同一轮作家落三篇（正文 + 两篇场景物件的 chalk）→ `[世界动态]` 里渲染成**一行**「作家刚落成了 3 篇板书」（验证 `turn` 合并，`doc-21 §5.4`）。
3. 作家 `chalk(append_to: '01-*.md', content: …)` → 画布上那篇**原地变长**、不新增卡片、位置不动（验证 §3.1 的序号/座位不变）。
4. `chalk(link_to: 'world/baker-street/copper-key.md')` → 画布上一根墨线连到铜钥匙卡（验证 §2.6 + `canvas_patched`）。
5. 上帝模式右键新增 chalk → 走同一函数、事件表里有 `entity_created` 且 `actor_type='god'`。

---

## 11. 发现的冲突 / 需要修订的上位文档

| # | 文档 A vs B | 具体句子 | 为什么矛盾 | 建议 |
|---|---|---|---|---|
| 1 | `doc-07 §2` 风险表 vs `后端实现计划.md:262` | A：「frontmatter 格式错由 Phase ② 的二次 edit 兜底，**正文阶段不背格式责任**」；B：「`chalk` 工具内部负责…`type: chalk` frontmatter 骨架」 | 两句读起来像「谁负责格式」。**实际不矛盾**（B 把格式从提示词拿走，A 指的是内容说漏时 Phase ② 补），但两份文档都没写清这层 | 在 `doc-23 §3.2` 的 preset 正文项里补一句：「Phase ① 的 `chalk` 工具已保证 frontmatter 骨架；Phase ② 的 `edit` 只补内容/数值，不再承担格式责任」。见本文 §9.3 |
| 2 | `doc-08` 定案 1 vs `doc-07 §2` | A：「>1000 字的板书基本是 `append_to` 连成的长文段——先治理长文」；B：「一条 chalk ≤200 字」 | 同一份纪律里既鼓励连成长文又限制每次 200 字；读者会以为二者冲突 | `doc-08` 那句加限定：「200 字是**每次落盘片段**的长度；`append_to` 把片段连成篇，篇长由 `doc-08` 的软提醒治理」。见本文 §9.4 |
| 3 | `doc-05 §5` 阶段② vs `doc-20 §2` | 阶段②：「`[edit]` 注入 status/choice/roll_dice」；`doc-20 §2`：「互动字段是通用字段，解析器统一提取」 | 阶段② 用 `edit` 裸改 frontmatter，会走 B 入口（`tool_result` hook）落 `entity_edited`；但**`edit` 没有任何校验**，写坏 frontmatter 不会被拦 | 不是硬冲突（B 入口本就是兜底设计，`00 §4.2`），本文 §2.7 已把它定为**互动字段的唯一 agent 侧入口**。`doc-23` 的 preset 应提示作家「往 chalk 注入 status/choice/roll_dice 之后，保持 YAML 形状（引用规则见 §4.3）」。**本文不改**，登记 |
| 4 | `doc-20 §12` 落点表 vs `01 §2.1` | `doc-20`：「`extensions/tools.ts` 暴露工具定义」；`01`：动作实现在 `packages/shared/src/actions/*`，`extensions/toolkit/*` 是薄壳 | 不矛盾，只是 `doc-20` 写于 `actions/` 抽出来之前 | 无需改文档，实现按 `01` 的两层 |
| 5 | `doc-06 §2.2` 的 temp chalk 8s vs `doc-10 E2` 的 12s | A（正文）：「8s 后淡出」；B（原型）：「12 秒后自动 collapsed」 | 同一语义两个数字 | `前端改造计划.md:487` 已登记「以 doc 为准（8s）」。**与 `chalk` 工具无关**（temp 是前端演出层，工具只写 perm），本文不认领 |
| 6 | `frontmatter.ts:21-22` vs `doc-20` 签名 | 现状把 `link_to`/`append_to` 当 frontmatter 字段；`doc-20` 表格里它们是**工具参数** | 实现与协议不一致 | **两个键已删，与 04 对齐**（本文 §9.5；`04 §3.6` 的 `RefKind` 同步删除这两个键） |
| 7 | `frontmatter.ts:29-121` 的解析器 vs `doc-09` 的通用互动字段 | 现状 `parseFrontmatter` **只认 chalk 的三个子结构**（`inChoice`/`inStatusData`/`roll_dice` 硬编码），而 `doc-20 §2` 要求「任何实体都能携带」 | 解析器把互动字段写死在 chalk 语义里 | 归 `06` 抽取（`00` §10 第 1 条已认领）；本文只登记「`chalk` 是它的主消费者，改的时候别退化成只认 chalk」 |
| 8 | `routes/world.ts:441` 的 `god_action` vs `doc-21 §4.6` | 现状：god 新增 chalk 落 `appendWorldEvent('god_action', { action, filePath })`，并用旧 `payload` 列；`doc-21 §4.6` 明文删掉 `god_action`（「身份×动作的叉乘」），改成 `entity_edited`/`entity_created` + `actor_type: god` | 上帝模式造的实体在事件表里没有 `kind` / `name`，`doc-22` 的事件段渲染不出人话 | `12` 收编 god-action 到 `writeChalk`（本文 §9.2）；旧类型随 `01` 的表迁移一起退役。**本文认领 `chalk` 分支** |
| 9 | `App.tsx:234` 的 `chalk-<slug>.md` vs `00 §2.3` | 前端上帝模式造名 `chalk-rainy-night.md`；契约要求 `NN-<slug>.md` | 同一目录出现两种命名风格，Hook 清单与排序都不一致 | 收编到 `writeChalk` 的默认命名（本文 §9.2）；`chalk-` 前缀是原型残留，不保留 |

---

## 12. 仍然未知 / 留给评审拍板的

1. **默认命名时「哪一层」从哪来**。动作层是 transport-free 的（`01 §2.2`），它拿不到「调用者当前在哪个层」。三种候选：① 工具壳从 `ctx` 读到当前层再传 `layer`（需要前端上报视点，归 doc-22）；② 工具面加第五个 `layer` 参数；③ 强制默认命名必须有 `path`（回退到显式）。**本文取 ①，并保留动作层的 `layer` 字段**（`01 §5` 已冻结该字段，不属于「加参数」）；② 被否决（工具面四参数不改，§2.1）。但**B1 的 D1 演示里工具第一次被调用时前端可能还没上报视点**——若 `doc-22` 的 `viewpoint` 表此刻为空，工具壳拿不到层，`chalk` 会抛 `invalid_argument` 要求显式 `path`。**待评审拍板 + B2 落地后复核**。
2. **`>200 字` 的判据取「字符数」还是「分词数」**（§7.4）。本文取字符数（宽松），但中文场景下 200 字符 ≈ 200 字是准的，英文场景下会过早提示。**待彩排用真实作家输出校准**，参数放 `world.json` 还是常量未定。
3. **`chalk` 的 description 是否要提 `path` 的全部规则**。工具描述里写太长会占上下文（`doc-23` 的纪律：提示词是缓存区，改一个字整段作废）。本文把命名规则留给工具**行为**（报错时教），description 只说「omit it and the tool names it」。**待评审确认这个取舍**。
4. **`append_to` 与 `status.data` 的浅合并**（§3.1）。浅合并意味着**删不掉一个 status 键**（作家想「阶段已完成」→ 要删键只能 `edit`）。深合并更复杂且语义不明（数组怎么并？）。**本文定浅合并 + `edit` 兜底**，请评审确认。
5. **`link_to` 是否应该支持「连到一段文本/一个坐标」**而非只有实体路径。`doc-10 E13` 的线是「两个端点」，端点在 `canvas.db` 里是 `from_id`/`to_id`（`db/schema.ts:19-26`），现在只有卡片路径一种。保留为路径。
6. **`frontmatter.extra` 的滥用风险**：它给了调用者写任意 frontmatter 键的能力（比 `doc-20` 的四参数宽）。好处是 `anchor` / `font` / `tone` 这类渲染变体不用每次加字段；风险是塞进 `type: component` 把实体写坏。**本文不给白名单**（`doc-20 §1.1` 的「能力不按身份削权」精神），但 `type` 与 `title` 是**工具独占**——`extra` 里出现这两个键直接 `invalid_argument`。请评审确认这个折中。**注意**：工具面（`chalk` 工具）拿不到 `frontmatter`，此风险只存在于 C / E 入口的直接调用。


---

## 附录 A：一个 chalk 文件的完整示例

**Phase ① 调用**（作家在单轮管线 Phase ①；工具面只有四个参数，所以这里没有 `title` / `choice` / `status`）：

```jsonc
{
  "content": "The lid gives way.\n\nA dry click that hasn't been heard in years, and under it the keys are still dusted with chalk — one of them, the E above middle C, worn bare.",
  "link_to": "world/manor/music-room/piano.md"
}
```

未给 `path` → A 形态 + 默认命名。工具壳注入 `layer = 'world/manor/music-room'`（§12 待定项 1）；该目录已有 `01-dust.md`、`02-portrait.md` → 序号 `03`；`deriveTitle` 取正文首个非空行 → `title: The lid gives way.` → slug `the-lid-gives-way`。

**Phase ① 落盘**：`world/manor/music-room/03-the-lid-gives-way.md`

```markdown
---
type: chalk
title: The lid gives way.
---

The lid gives way.

A dry click that hasn't been heard in years, and under it the keys are still dusted with chalk — one of them, the E above middle C, worn bare.
```

**Phase ②**：作家用原生 `edit` 往同一篇注入互动字段（`doc-05 §5` 阶段②；走 B 入口落 `entity_edited`）。文件变成：

```markdown
---
type: chalk
title: The lid gives way.
choice:
  - Play the worn key
  - Search the rest of the room
status:
  data:
    piano_lid: open
    case_progress: Clue found
---

The lid gives way.

A dry click that hasn't been heard in years, and under it the keys are still dusted with chalk — one of them, the E above middle C, worn bare.
```

> **引号**：以上形状**没有一处**是 `stringifyChalk` 现状会输出的——它会给每个 `choice` 项与每个 `status` 值都套上 `"`（`frontmatter.ts:128/133`）。`yamlScalar` 只在必要时加引号：`The lid gives way.` 裸写、`case_progress: Clue found` 裸写（无引号的裸串经 `parseFrontmatter:79-81` 读回仍是字符串，round-trip 成立）；若 title 写成 `Scene 2: The Piano`，含 `: ` 触发引号规则，输出 `title: "Scene 2: The Piano"`。Phase ② 的 `edit` 由模型手写 YAML，仍需遵守这套引号规则——**这就是 §11 冲突 3 登记的那点提示词纪律**。

**事件**（`getEventsSince` 里读到的那一条）：

```json
{
  "seq": 41,
  "id": "evt-41",
  "projectId": "holmes-world",
  "type": "entity_created",
  "actor": { "type": "writer" },
  "layer": "world/manor/music-room",
  "subject": "world/manor/music-room/03-the-lid-gives-way.md",
  "turn": "turn:session-abc:7",
  "detail": {
    "path": "world/manor/music-room/03-the-lid-gives-way.md",
    "name": "The lid gives way",
    "kind": "chalk",
    "summary": "The lid gives way with a dry click that hasn't been heard in years."
  },
  "createdAt": "2026-09-12T10:04:31.220Z"
}
```

（`detail.name` 用 frontmatter `title`，`detail.summary` 用正文首个非空行截 120 字符——§5.1。`getEventsSince` 的 `layer` 过滤按 `world/manor/music-room`；`doc-22 §3.1` 的 `recent_chalk` 节取到它时只列「路径 + 首行」。）

**工具返回**：

```json
{
  "content": [
    {
      "type": "text",
      "text": "Wrote world/manor/music-room/03-the-lid-gives-way.md (chalk, 155 characters), linked to world/manor/music-room/piano.md."
    }
  ],
  "details": {
    "path": "world/manor/music-room/03-the-lid-gives-way.md",
    "created": true,
    "appended": false,
    "name": "The lid gives way.",
    "layer": "world/manor/music-room",
    "link": { "from": "world/manor/music-room/03-the-lid-gives-way.md", "to": "world/manor/music-room/piano.md" },
    "long": false,
    "event": { "seq": 41, "type": "entity_created", "detail": { "path": "world/manor/music-room/03-the-lid-gives-way.md", "kind": "chalk" } }
  }
}
```

（body 是 155 字符，不触发 §7.4 的长文提示；`long: false`。`details.name` = frontmatter `title`。）

**紧接着的续写**：

```jsonc
{ "append_to": "world/manor/music-room/03-the-lid-gives-way.md",
  "content": "You press the key. The note hangs in the dust, and somewhere below the floor, something answers it." }
```

→ 同一个文件 body 变长（`\n\n` 分隔）、frontmatter 的 `title`/`choice`/`status` 未动、`details.appended === true`、事件是 `entity_edited`（`subject` 同路径，`detail.kind: 'chalk'`）。

---

## 附录 B：`chalk_landed` 帧的实际形状（收编后）

```json
{ "type": "chalk_landed", "source": "writer",
  "path": "world/manor/music-room/03-the-lid-gives-way.md",
  "timestamp": "2026-09-12T10:04:31.231Z" }
```

`path` 来自本文 §6.3 的 `details.path` 修复。前端据此做「幻影壳 → 座位过户」（`doc-10 E3`）；`file_changed` 另行触发本层重取。
