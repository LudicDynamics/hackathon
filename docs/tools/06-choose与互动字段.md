# doc-tools/06 `choose` 与互动字段通用 schema

> 状态：**设计（2026-09-12）**，待评审。本文只写设计，不改代码。
> 权威层级：`00-共同上下文.md`（冻结契约）> `doc-21` > `doc-20` > 本文。本文冻结的两样东西**下游不许私改**：① `packages/shared/src/schemas/frontmatter.ts` 的导出形状（`entityName` / `EntityFrontmatterSchema` / `InteractiveFieldsSchema` / `parseFrontmatter` 的返回）；② `interactive` 归一化块的字段名（前端、`look_at`、`choose`、`roll_dice` 都读它）。
> 关联：`00-共同上下文.md` §2/§4.2/§5.2/§7/§9/§10（契约、事件、文档结构、已知问题 1）；`doc-20` §2/§2.1/§2.2/§2.3/§3/§6（本文的主判据）；`doc-21` §1/§3.3/§3.6/§4.3（事件准入、`detail` 自足、失败不落）；`doc-09` §待设计 1/2/3（choice/status/折叠）；`doc-05` §3.1/§7.4（互动字段与渲染路由）；`doc-06` §2.6（渲染原则）；`doc-10` E12/§4.3/§8.2（组件 schema「小内核 + kind 自带 extra」、落盘组件骨架、frontmatter 解析器归属）；`doc-19` §3.3（骰子仪式）。
> 边界：`roll_dice` 的**裁决函数与 `expect` 解析器归 07**（`packages/shared/src/rules/dice.ts`）；`roll_dice` 的**回写器归 07**（`patchRollDiceResult`）；`link/arrange` 的画布状态归 09；组件注册表归 10；`/api/*` 路由改造与 WS 映射归 12。本文只定 **schema 形状 + `choose` 语义 + 渲染协议字段**。

---

## 1. 一句话与定位

**`choose` 是把"某个行动者选择了这个公开动作"变成一条世界事件的最薄动作——它不改文件、不删选项、不假定后果；它只做三件事：重读实体、在可见选项里认领一个选项、落 `choice_selected`。**

配套的是 `packages/shared/src/schemas/frontmatter.ts` 的重构：把 `choice / roll_dice / status` 从 `ChalkFrontmatterSchema` 里**摘出来变成实体通用**（`doc-20 §2` 明文要求，`00 §10` 问题 1 认领），并把解析器从手写 YAML-lite 换成真 YAML 解析器——否则"通用"只是名义上的：今天任何非 `status.data / choice / roll_dice` 的嵌套对象都被**静默丢弃**（`frontmatter.ts:45-118`，实例如 `bgStyle`），组件注册表要用的 `accepts` / `marks` / `rows` 会重蹈同一个坑（10 文档 §9.1 D6 已记）。

在 `doc-20` 里的位置：`§2.1`「组件需要可互动能力时，作者直接在该组件的 frontmatter 写 `choice`，不再额外设计 `interact` 工具」+ `§6`（`choose` 的语义契约）。本文是这两条的落地。

三类调用者（`doc-20 §6` 最后一句：**玩家点击 UI、作家调用和角色调用共用同一动作函数**）：

| 入口 | 调用者 | 进程 | actor | 本文给什么 |
|---|---|---|---|---|
| A 动作层工具 | 作家 agent / 角色 agent（`extensions/toolkit/choose.ts` 薄壳） | agent 进程 | `process.env[AGENT_ROLE_ENV]` → `resolveAgentActor(...)`（01 §2.3） | §2.4 工具壳定义 |
| C 玩家 UI 路由 | `apps/server/src/routes/world.ts` 的 `POST /api/choice` | server 进程 | `player` | §2.5 路由形状（实现归 12） |
| 引擎 | 暂无（组件 handler 若将来要程序化选择，走同一个 `chooseOption`） | — | 调用者决定 | §4 保证零副作用即可被安全复用 |

**它不认识的**：HTTP、WebSocket、pi-rp。它只认识 `ActionContext` + `ChooseOptionInput`（01 §2.2 冻结）。

---

## 2. 签名与参数

### 2.1 动作函数（`packages/shared/src/actions/choose.ts`）

```ts
import type { ActionContext, ActionResult } from './types.js';
import type { WorldEvent } from '../schemas/events.js';

export interface ChooseOptionInput {
  /** 世界根相对路径、POSIX、无前导 './'（00 §2.1）。一个带 choice 的实体。 */
  path: string;
  /**
   * 1-based 可见序号、选项文本、或选项 id。见 §3.2 的解析顺序。
   * 序号与文本两个入口都合法（doc-20 §6：「可传 look_at 输出中的序号或完整文本」）。
   */
  choice: string | number;
}

export interface ChooseOptionDetails {
  /** == input.path（规范化后）。 */
  path: string;
  /** 该实体**此刻**的名字（entityName），事件里的 name 也是它（doc-21 §3.3）。 */
  name: string;
  /** **解析出来的**选项文本，不是调用者传进来的原始串（§3.2 第 4 步）。 */
  choice: string;
  /** 1-based，与 look_at 打印的序号、UI 按钮上的序号**完全同一个数**（01 §2.5 冻结）。 */
  index: number;
  /** 解析那一刻的可见候选数。UI 可用它校验自己的列表是否过期。 */
  count: number;
  event?: WorldEvent;
}

export async function chooseOption(
  ctx: ActionContext,
  input: ChooseOptionInput
): Promise<ActionResult<ChooseOptionDetails>>;
```

**为什么 `choice` 的数字是 1-based**：`doc-20 §3.2` 的 `look_at` 输出是 `1. Open the lid`，玩家在 UI 上看到的是同一个序号。三处（`look_at` 文本、UI 按钮、`detail.index`）必须是同一个数，任何一处 ±1 都是靠人肉换算维持的一致性，迟早错位。01 §2.5 已把这条写进 `choice_selected.detail` 的注释。

**为什么 `details.choice` 是解析结果而不是原始输入**：调用者可能传 `2`、可能传大小写不同的文本、可能传 `id`。事件 `detail.choice` 必须回答"到底选了哪一条"（`doc-21 §3.3` 自足），所以事件里存**解析出来的 label**，原始输入不留（要排查就查会话记录 `entries`）。

### 2.2 共享 schema（`packages/shared/src/schemas/frontmatter.ts`，重构后全量）

这是本文的核心交付物。**依赖决策**：引入 `yaml`（`2.9.x`，与 pi-rp 同 major —— `vendor/pi-rp/packages/coding-agent/package.json:67` 也是 `2.9.0`），理由与实测证据见 §9.1。

```ts
import { z } from 'zod';
import { parseDocument } from 'yaml';
import { buildInteractiveFields, entityName, type InteractiveFields } from '../rules/interactive.js';

/* ────────────────────────────────────────────────────────────────────────────
 * 1. 互动字段：三个键，所有可渲染实体通用（doc-20 §2）
 * ──────────────────────────────────────────────────────────────────────────── */

/** status.data 的值域：扁平标量。嵌套**不允许**，理由见 §3.5。 */
export const InteractiveValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
export type InteractiveValue = z.infer<typeof InteractiveValueSchema>;

/**
 * 实体的可见状态（doc-20 §2.3）。
 * **不是状态系统**：它就是该实体 frontmatter 里的一个键，读它 = 读那个文件。
 * 没有 get_state / set_state / state_update / watch_state，也永远不会有。
 */
export const StatusSchema = z.object({
  /** 键值对快照。键序 = 作者书写顺序（YAML 保序），前端按此渲染表格。 */
  data: z.record(z.string(), InteractiveValueSchema),
  /** 可选的人话标题（折叠表格的表头）；缺省前端用 "Status"。 */
  label: z.string().optional(),
  /**
   * 赛后扩展位：图表化（doc-07 赛后 #9「status 图表化」）。
   * B1 解析并透传，**前端一律渲染为折叠表格**；写 chart 不报错，也不生效。
   */
  chart: z.enum(['bars']).optional(),
}).passthrough();
export type Status = z.infer<typeof StatusSchema>;

/**
 * 一个选项。MVP 字段集 = label + id + when + hint。
 * then 是**赛后扩展位**，B1 谁都不应用它（§3.5 末）。
 */
export const ChoiceOptionSchema = z.object({
  /** 选项文本。玩家看到的就是它，look_at 打印的也是它。 */
  label: z.string().min(1),
  /**
   * 稳定键（可选）。序号会随 status 变化而漂移，id 不会——UI/Agent 拿不准时用它（§3.2 优先级 1）。
   */
  id: z.string().min(1).optional(),
  /** 条件选项：`key == value` / `key != value`，读本实体自己的 status.data（§3.5）。 */
  when: z.string().min(1).optional(),
  /** 给玩家的一句提示（灰字，附在按钮下方）。look_at 用 `— hint` 打印。 */
  hint: z.string().optional(),
  /**
   * 赛后扩展位：选定后的后置动作（doc-09 待设计 #1）。
   * 形状刻意**不是**一套组件命令语言（doc-20 §2.1 明文禁止），只允许"改自己的 status"。
   * **B1 没有任何代码应用它**：choose 不写文件（§3.1 第 5 步），choice_selected 事件本身就是触发器，
   * 由确定性组件 handler 或作家决定后果。
   */
  then: z.record(z.string(), InteractiveValueSchema).optional(),
}).passthrough();
export type ChoiceOption = z.infer<typeof ChoiceOptionSchema>;

/** 选项组。**两种书写形式都合法**，归一化后是同一个形状（§3.3）。 */
export const ChoiceSchema = z.union([
  /** 简写：纯文本数组。现存世界模板与 holmes-world 全是这一种。 */
  z.array(z.union([z.string().min(1), ChoiceOptionSchema])),
  /** 完整形式：需要 mode / allow_free / free_hint 时用。 */
  z.object({
    /** MVP 只实现 single；'multi' 在 B1 抛 unsupported（§7）。 */
    mode: z.enum(['single', 'multi']).optional(),
    options: z.array(z.union([z.string().min(1), ChoiceOptionSchema])),
    /** 自由输入兜底：选项组**不消失**，旁边多一个"自己写"的入口（§3.6）。 */
    allow_free: z.boolean().optional(),
    /** 自由输入框的 placeholder。 */
    free_hint: z.string().optional(),
  }).passthrough(),
]);
export type Choice = z.infer<typeof ChoiceSchema>;

/**
 * 实体声明的骰子（doc-20 §2.2：实体声明、引擎裁决）。
 * **形状由 07 冻结，本文一字不改**：作者只写 type/desc/expect，
 * result/passed 由引擎回写（07 的 patchRollDiceResult）。
 */
export const RollDiceSchema = z.object({
  type: z.string().min(1).default('1d100'),
  desc: z.string().min(1),
  /**
   * 引擎可读的比较式，**必须带引号**：">50"（doc-05 §3.1）。
   * 不引号时 YAML 会把它当块标量头并**静默给出空串**（实测，见 §11 冲突 5），
   * 因此这里加 .min(1)：空 expect = 坏声明，不是默认 >50。
   * 语法（>50 / >=60 / <30 / =50）与解析器归 07。
   */
  expect: z.string().min(1),
  result: z.number().optional(),
  passed: z.boolean().optional(),
}).passthrough();
export type RollDice = z.infer<typeof RollDiceSchema>;

/** 三个通用互动字段的集合。空对象合法（绝大多数实体没有互动字段）。 */
export const InteractiveFieldsSchema = z.object({
  choice: ChoiceSchema.optional(),
  roll_dice: RollDiceSchema.optional(),
  status: StatusSchema.optional(),
}).passthrough();
export type InteractiveFieldsRaw = z.infer<typeof InteractiveFieldsSchema>;

/* ────────────────────────────────────────────────────────────────────────────
 * 2. 实体本身：小内核（doc-10 E12），渲染类型**不在**这里判定
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * 每个落盘实体的最小内核。**只有形状，没有语义**：
 * type 是自由字符串，不去枚举——新增 type 是留位（doc-10 E12：不该是全局封闭清单）。
 * 「实体是什么、谁来渲染」由 cardKindOf / resolveComponentKind（forms.ts，10 拥有）回答；
 * 本文**不另建一套** kind 判定，避免第二套约定（00 §8）。
 */
export const BaseEntitySchema = z.object({
  /** chalk | component | note | letter | gate | readme | asset | …（自由字符串，留位）。 */
  type: z.string().optional(),
  /** type === 'component' 时的渲染器 key（10 的注册表 key）。 */
  component: z.string().optional(),
  /** 卡面标题（chalk/component/letter/note 用）。 */
  title: z.string().optional(),
  /** 人话名（README / gate 用；evening.md 这类用文件名兜底）。 */
  name: z.string().optional(),
}).passthrough();

/**
 * 实体通用 frontmatter = 内核 ∩ 互动字段，未知键全部保留。
 *
 * 写法说明（对 doc-20 §2 的一处**实现修正**，见 §11 冲突 4）：
 * doc-20 §2 写的是 `BaseEntitySchema.and(InteractiveFieldsSchema).passthrough()`。
 * 在 zod 3.25（本仓 zod@3.25.76）上 .and() 返回 ZodIntersection，**没有 .passthrough()
 * 方法**，照抄会直接编译不过。两种等价写法都实测保留未知键（bg / bgStyle / 自定义键）：
 *
 *   z.intersection(BaseEntitySchema.passthrough(), InteractiveFieldsSchema.passthrough())
 *
 * 取后者：两侧显式 .passthrough() 把"未知键保留"写成意图，而不是依赖 .and() 的隐式行为。
 */
export const EntityFrontmatterSchema = z.intersection(
  BaseEntitySchema.passthrough(),
  InteractiveFieldsSchema.passthrough()
);
export type EntityFrontmatter = z.infer<typeof EntityFrontmatterSchema>;

/* ────────────────────────────────────────────────────────────────────────────
 * 3. 解析入口
 * ──────────────────────────────────────────────────────────────────────────── */

export interface ParsedFrontmatter {
  /**
   * 原始 frontmatter，**无 schema 过滤**（bg / bgStyle / 将来组件自带的
   * accepts / marks / rows 全在这里）。缺块或 YAML 语法错时为 null。
   */
  frontmatter: Record<string, any> | null;
  /** 正文，与输入在闭合 --- 之后逐字节相同。 */
  body: string;
  /** 类型化收口（内核 + 互动字段）。frontmatter 为 null 时也为 null。 */
  entity: EntityFrontmatter | null;
  /**
   * 归一化后的互动字段块。**永不为 null**（无互动字段时三个键都是 null）；
   * 前端 / look_at / choose / roll_dice 都读它，不各自去 raw frontmatter 里挖。
   */
  interactive: InteractiveFields;
  /** 非致命问题（YAML 语法、字段形状、坏 when）。干净解析时为空数组。 */
  errors: string[];
}

export function parseFrontmatter(rawContent: string): ParsedFrontmatter;

/** 实体此刻的名字。三个读者共用一份规则（§3.7）：事件 detail、look_at 标题、错误文案。 */
export { entityName };
```

> `entityName` 的**实现**在 `rules/interactive.ts`（无依赖纯函数），此处只 re-export，让调用者永远从 `schemas/frontmatter.js` 拿同一个函数名。07 的 `roll_resolved.detail.name` 也用它（已对齐）。

### 2.3 `rules/interactive.ts`（新建，**零依赖**：不 import zod、不 import yaml）

```ts
// packages/shared/src/rules/interactive.ts
export const CHOICE_LIMIT = 12;          // 解析上限（§7 边界）

export interface NormalizedOption {
  /** 1-based。**可见列表**里的序号（§3.5：when 为假的不占号）。 */
  index: number;
  label: string;
  id?: string;
  when?: string;
  hint?: string;
  /** 解析那一刻的可见性。false = 条件不成立，UI 与 look_at 都不显示。 */
  visible: boolean;
}
export interface NormalizedChoice {
  mode: 'single' | 'multi';
  allowFree: boolean;
  freeHint?: string;
  /** 全部选项（含 invisible），顺序 = 作者书写顺序。index 按可见列表编号（§3.5）。 */
  options: NormalizedOption[];
}
export interface InteractiveFields {
  status: { data: Record<string, string | number | boolean | null>; label?: string; chart?: 'bars' } | null;
  choice: NormalizedChoice | null;
  roll_dice: { type: string; desc: string; expect: string; result?: number; passed?: boolean } | null;
}

/** 单条件判据语法（§3.5）。只认 `key == value` / `key != value`；其余 fail-closed。 */
export function evalWhen(when: string, statusData: Record<string, unknown> | null): boolean;

/** raw frontmatter → 归一化互动字段。**唯一**的提取处，parseFrontmatter 调它。 */
export function buildInteractiveFields(raw: Record<string, any> | null | undefined): InteractiveFields;

/** 可见选项（按可见序重编号）。UI / look_at / choose 都调它，编号因此不可能漂移。 */
export function visibleChoiceOptions(choice: NormalizedChoice): NormalizedOption[];

/** 解析一个选择：id → 精确 label → 大小写不敏感 label → 序号。见 §3.2。 */
export function resolveChoice(
  choice: NormalizedChoice,
  input: string | number
): { option: NormalizedOption } | { error: 'not_found' | 'out_of_range' };

/** title → name → basename 去 .md（§3.7）。 */
export function entityName(fm: Record<string, any> | null | undefined, path: string): string;

/** look_at 的 [Status]/[Choices]/[Dice] 文本块（doc-20 §3.2 的格式，03 直接调）。 */
export function formatInteractiveText(raw: Record<string, any> | null | undefined): string;
```

**为什么单独一个 `rules/` 目录而不是塞进 `schemas/`**：`schemas/frontmatter.ts` 会 import `yaml`，而"选项怎么编号、`when` 怎么判、名字怎么取"是**纯规则**——07 的 `rules/dice.ts` 已经在这个位置（01 §8 把它列进 `index.ts` 导出）。两者同层，单测不需要任何解析器、任何临时目录。**`rules/` 不许 import `schemas/`**（单向），这样它永远可被任意消费者安全 import。

### 2.4 工具壳（`extensions/toolkit/choose.ts`）

```ts
import { Type } from 'typebox';
import { chooseOption, AGENT_ROLE_ENV } from '../../packages/shared/dist/index.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { resolveAgentActor } from './actor.js';
import { openWorldStore } from './store.js';
import { ok, fail } from './result.js';
import { currentTurn } from './turn.js';

export function registerChoose(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'choose',
    label: 'Choose',
    description:
      'Pick one of the public options an entity declares in its frontmatter `choice`. ' +
      'Use it when the player (or your character) takes one of the listed actions — ' +
      'opening the piano lid, forcing the cellar door, telling Watson your theory. ' +
      '`path` is the entity, `choice` is either the 1-based number or the exact text ' +
      'printed by look_at. This does NOT change the file, remove the option, or decide ' +
      'what happens next: it records that the choice was made, and the world reacts later.',
    parameters: Type.Object({
      path: Type.String({ description: 'World-relative path of the entity, e.g. world/manor/music-room/piano.md' }),
      choice: Type.Union([Type.String(), Type.Number()], {
        description: '1-based option number, or the option text exactly as look_at printed it',
      }),
    }),
    promptSnippet: "choose — take one of an entity's declared options",
    promptGuidelines: [
      'Use choose when the player picks one of the options an entity printed in look_at; never invent an option that is not listed.',
      'Use choose (not write/edit) to record a selection: the writer reacts to the choice_selected event, the file itself stays untouched.',
    ],
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const store = openWorldStore(ctx.cwd);
      try {
        const result = await chooseOption(
          { store, actor: resolveAgentActor(process.env[AGENT_ROLE_ENV]), turn: currentTurn(ctx) },
          { path: params.path, choice: params.choice }
        );
        return ok(result.text, result.details);
      } catch (err) {
        return fail(err); // ActionError.toToolResult()（01 §2.4）：isError + 可读英文原因
      }
    },
  });
}
```

`result.text` 的形态（英文，`00 §6.2`：说清发生了什么 + 给稳定路径）：

```text
Watson chose "Open the lid" (option 1 of 2) on "The Closed Piano" (world/manor/music-room/piano.md).
```

### 2.5 玩家 UI 入口（`POST /api/choice`，实现归 12）

```ts
// 请求（前端）
POST /api/choice   { path: "world/manor/music-room/piano.md", choice: 1 }
//                 choice 也可以传 label 或 id；前端优先传 id，无 id 时传 label（§3.2 的漂移理由）

// 200
{ ok: true, path, name, choice: "Open the lid", index: 1, count: 2, event: { seq, id, type: 'choice_selected', … } }
// 4xx（ActionError.toHttp()，01 §2.4）
{ ok: false, code: 'choice_not_found', error: 'Choice 3 is out of range for "…/piano.md" (2 visible options)' }
```

```ts
// routes/world.ts —— 形状已冻结，落地归 12（与 /move /dice /use-item 同一批改）
router.post('/choice', async (req, res) => {
  const store = getActiveStore();
  if (!store) return res.status(400).json({ error: 'No active world' });
  try {
    const svc = createActionService(store, { type: 'player' }, { turn: `req:${randomUUID()}` });
    const r = await svc.chooseOption({ path: req.body.path, choice: req.body.choice });
    res.json({ ok: true, ...r.details });
  } catch (err) {
    if (err instanceof ActionError) return res.status(err.httpStatus).json(err.toHttp().body);
    res.status(500).json({ ok: false, code: 'internal', error: String(err) });
  }
});
```

**三个入口共用同一个 `chooseOption`**（`doc-20 §6` 最后一句）：UI 点击、作家调用、角色调用进的都是 §2.1 那个函数，因此不存在"UI 一套 choice 语义、agent 另一套"的可能。**路由侧 MUST NOT 自己再解析一遍 choice**（`00 §8` 反模式第 1 条）。


---

## 3. 行为契约（逐步）

`chooseOption` 的步骤。前两步来自 01 §3.1 的五步骨架（解析输入 → 读取现状），第三步是本文独有的核心，第四五步回到骨架（落账 → 返回）。

### 3.1 逐步

| # | 步骤 | 漏了会怎样 |
|---|---|---|
| 1 | **校验路径**：非空、世界根相对、POSIX、无 `..`、非保留前缀（01 §7.3 的 `resolvePath` 收紧版）。 | 模型给的 `path` 可以逃出世界根（01 §9 首行，B1 唯一安全修复）。 |
| 2 | **读取源文件**：`store.readFile(path)`；不存在 → `not_found`。`parseFrontmatter` 得到 `frontmatter / entity / interactive / errors`。 | 不重读就落账 = 相信调用者转述的文件内容，而 `doc-20 §6` 明写"引擎重新读取源文件并确认选项仍然存在"。 |
| 3 | **取互动字段**：`interactive.choice` 为 null → `not_interactive`（`errors[0]` 附进 message，让调用者看到坏在哪）。此时**不回退**去猜 raw frontmatter（§3.3 说明了为什么不可能需要回退）。 | 把一个没有选项的实体当成有选项，落一条无意义的 `choice_selected`。 |
| 4 | **解析选择**（§3.2）：在**可见选项**里认领一条。命中 → 记下 `label` 与 `index`；未命中 → `choice_not_found`。 | 直接落调用者传的字符串 = 事件里可能是一个不存在的选项，作家据此写出不存在的剧情。 |
| 5 | **落账**（§5）：`appendEvent({ type: 'choice_selected', … })`，**一次、只一次**。 | 世界变了（玩家做了选择）但作家/角色/历史面板都不知道（`doc-21 §1` 第三问判死）。 |
| 6 | **返回** `{ text, details }`：英文、带稳定路径、带解析出的 label 与 1-based index。 | 模型只看到 "Done."，下一句就瞎指一个路径。 |

**这一层没有任何写文件步骤**——这是 `doc-20 §6`「选择不会自动删除其他选项，也不会假定后果」的直译：不删选项（那要改文件）、不应用 `then`（那是"假定后果"）、不改 `status`（那是"假定后果"）。**`choose` 是 B1 全部动作里唯一零落盘的动作**，副作用只有一条事件（§4）。

### 3.2 选择的解析顺序（`resolveChoice`，纯函数）

输入可以是 `string | number`，规则**按此顺序**，先命中先返回：

1. **`id` 精确匹配**（选项声明了 `id` 时）——漂移免疫的入口，UI 首选。
2. **`label` 精确匹配**（区分大小写）。唯一命中即返回；多条同 label → 视为未命中（不猜）。
3. **`label` 大小写不敏感匹配**。同上，多条同 label → 未命中。
4. **数字序号**：`input` 是 number，或是**纯数字字符串**（`"2"`）时，按 1-based 取可见列表第 `index` 条。越界 → `out_of_range`。
5. 全部未命中 → `not_found`。

**为什么文本先于数字**（实测行为，已跑过）：① 一个选项文本恰好是 `"2"` 是极小概率，但**真出现时它必须能被选中**——文本在先，`"2"` 就能认领那一项；数字在先则它永远选不到。② `label` 精确匹配是大小写敏感 + 要求唯一命中，把"传文本"的歧义全挡在数字之前。③ 数字入口仍然完整可用：`choice: 2`（number）**一律**取可见列表第 2 条，与 label 内容无关。

**由此产生的一条精确语义**（写在这里以防实现者"优化"掉）：同一个 `"2"` 字符串与数字 `2` 在"选项文本就是 `"2"`"这一种内容下会指向**不同选项**——字符串 `"2"` → label 为 `"2"` 的那一项；数字 `2` → 第 2 项。**这是刻意的**：调用者传字符串就是"我说的是文本"，传数字就是"我说的是序号"。要完全避开歧义就用 `id`（规则 1）。**实测确认**：选项为 `['2', 'Open the lid', 'Run']` 时 `resolveChoice(g, '2')` 命中 label `"2"`（index 1），`resolveChoice(g, 2)` 命中 `'Open the lid'`（index 2）。

**为什么在可见列表里解析**：§3.5 的 `when` 会让某些选项在某一刻不可见。若按"声明顺序"解析，`look_at` 打印的 `1.`/`2.` 与 `choose` 认领的第 2 条会是**不同的选项**——这是整套协议里最容易出的错。三处都调 `visibleChoiceOptions()`，编号由同一个函数产生，**不可能漂移**。

### 3.3 归一化（`buildInteractiveFields`）

raw frontmatter → `interactive` 块。三件事：

**① 两个 choice 书写形式归一**：

```yaml
# 简写（现存模板全部是这种；8/8 个带 choice 的模板文件都是纯字符串数组）
choice:
  - "Ask where the photograph came from"
  - "Go to the orchard alone to investigate"
```
```yaml
# 完整形式（piano 示例，doc-20 §2.1）
choice:
  - Open the lid
  - label: Play the unfinished nocturne
    when: lid == open
    hint: needs the lid open first
```
两者都归一成 `{ mode: 'single', allowFree: false, options: NormalizedOption[] }`。简写里的字符串 → `{ label }`。**同一数组里两种形式可以混写**（实测 `yaml` 正确解出 `["a", {label:…, when:…}]`），所以老文件加一个条件选项只需要把那一项改成对象，不必重写整个数组。

**② `status.data` 保序**：YAML 保留键的书写顺序（实测 `templates/holmes-world/world/baker-street/evening.md` 的 `photo_source → orchard_clue → case_progress` 原序读出）。前端折叠表格按此顺序渲染，作者因此**用书写顺序控制呈现顺序**——不需要额外的 `order` 字段。

**③ 坏字段不崩、不静默**：任一子结构不合法（`choice: 3`、`status.data.a` 是对象、`roll_dice` 缺 `expect`）→ **该键在 `interactive` 里为 null**，同时往 `errors` 推一条人话。raw `frontmatter` 里原值**原样保留**（永不丢，`doc-10 §8.2` 的教训），`read` 仍能读到、作家仍能改。**绝不做"半个 widget"**（前端计划 T1.6 纪律 3）。**归一化后为 null 的键一律走 `not_interactive`**（"这个实体身上没有可选的东西"）；`malformed_entity` 只用于**整块 frontmatter 坏**（无块或 YAML 语法错），不用于单个互动字段的形状坏——与 07 §3.1 步骤 4 对齐。

**为什么不需要"回退到 raw 去猜"**：`interactive` 是 raw 的确定性函数，两者不会互相矛盾——`interactive.choice === null` 就意味着 raw 里的 `choice` 确实不成形状，此时 `choose` 报 `not_interactive` 是准确的，而不是"解析器偷懒"。

### 3.4 `status` 的字段设计（回答 doc-09 待设计 #2 的第一半）

| 问题 | 定案 | 理由 |
|---|---|---|
| value 类型 | `string \| number \| boolean \| null`（扁平标量） | 前端表格单元格只能是标量；`true` / `3` / `"车库期"` 都能直接渲染，`null` 渲染成 `—`。 |
| 嵌套 | **不允许** | ① `status` 是"组件的一份快照"，不是状态机（`doc-20 §2.3`）；② 折叠颗粒（doc-09 #3）还没定，嵌套会逼现在就定；③ §3.5 的 `when` 判据是**扁平键**，嵌套键写不出条件。要嵌套 = 要另一个实体，或把键名拉平（`lid_hinge: loose`）。 |
| 图表化 | `chart` 字段**解析并透传**，B1 一律渲染折叠表格 | doc-07 赛后 #9 明确是赛后项。字段先占位，避免将来加字段时又要动 schema。 |
| 与折叠表格的边界 | `status.data` **就是**表格的行；`status.label`（可选）是表头；**没有第三层** | 边界句：`data` 的每个键 = 一行，值 = 单元格；除 `label` 外没有任何元信息进表格（其余键被 `.passthrough()` 保留在 raw 里，但不进表格）。 |
| 与实体 `title` | 无关，**不互相覆盖** | 时间印章（前端计划 T3.6）从"最新 chalk 的 `status.data.time`"取，那是**读者的选择**，不是 schema 的规则。 |

**`status` 不是什么**（`doc-20 §2.3` 定案，非暂缓）：不是独立文件、不是状态机、没有 `get_state / set_state / state_update / watch_state`。本文的 schema 就是这条定案在代码层的形状：`status` 只是 `EntityFrontmatterSchema` 的一个可选键。

**对嵌套的一个具体交代**：`status.data.a` 是对象 → `StatusSchema` 拒 → `interactive.status === null` → `errors` 记一条。这条**不是"暂不支持"**：若评审判定嵌套该支持，改法是 `data: z.record(z.string(), InteractiveValueSchema)` → `z.record(z.string(), z.any())` 并让前端渲染成嵌套列表，代价是 `when` 的判据要扩语法。**登记在 §12 拍板项**，不在 B1。

### 3.5 `when`：条件选项（回答 doc-09 待设计 #1 的核心项）

**语法**（刻意极小，`rules/interactive.ts::evalWhen`）：

```text
when := <flatStatusKey> ( "==" | "!=" ) <scalar>
```

- 左值只查**本实体自己的** `status.data`；键不存在 = 取值 `undefined`。
- 右值按 YAML 标量比较：`true`/`false` → boolean，数字字面量 → number，带引号或含字母 → string。比较前两侧都做一次同样的标量归一，因此 `when: lid == open` 与 `when: "lid" == "open"` 等价。
- **没有** `and` / `or` / `<` / `>` / 括号 / 函数调用。要两个条件 → 两次选择（选 A 后作家把 B 的 `status` 改到 `open`）。

**不合法或未知的表达式 → 该选项不可见（fail-closed）**，同时在 `parseFrontmatter` 的 `errors` 里记一条，`look_at` 在 Choices 块尾补一行：

```text
[Choices]
1. Open the lid
(hidden: "Play the unfinished nocturne" — malformed when "lid === open")
```

**为什么 fail-closed 而不是 fail-open**：显示与解析共用 `visibleChoiceOptions()`，两种失败模式都只影响"显示不显示"。fail-open（条件不成立也显示）会让玩家点到一个**门锁着却写着"进去"**的按钮——这是对玩家撒谎；fail-closed 最坏是暂时少一个入口，而错在作者，`look_at` 那一行把它交回给作家自己修（**agent 自愈，玩家看不见坏状态**）。

**为什么 `when` 进 MVP 而不是像 doc-09 说的"赛后再补"**：因为**不做 `when` 就没有稳定的编号**。只要一个字面量 `when` 出现在内容里而解析器忽略它，`look_at` 打印的序号、UI 显示的按钮、`choose` 认领的选项就会按三套不同的列表编号——这正是整套协议唯一不能错的地方。`evalWhen` 是 ~20 行零依赖纯函数，把它算进 MVP 比"以后再说"更省事也**更少出错**。登记为对 doc-09 的一处收窄，见 §11 冲突 2。

**与 `status` 的耦合方向**：`when` 读 `status`，`choose` **不写** `status`。所以一次选择**不会**让别的选项自己变可见——那是 `doc-20 §6`「不假定后果」的要求。让选项活起来的是作家（或组件 handler）：它读到 `choice_selected` 事件后 `edit` 那个实体的 `status`，下一次 `look_at` / 刷新时 `when` 自然翻转。**这条链路闭环，且每一环都在文件里看得见。**

**`then` 为什么只是扩展位**：`then: { lid: open }` 看着诱人（"选完就开盖"），但 apply 它就意味着 `choose` 要改文件——那立刻违反 `doc-20 §6`（不假定后果）与 `doc-21 §2` 的"事件是唯一变更来源"（一次点击产出事件 + 一次静默改写）。正确的形态是**组件 handler**：它订阅 `choice_selected`，检查 `then` 或自己的规则，再走 `editEntity` 落一条 `entity_edited`。**B1 不实现 handler，`then` 只是让作者能先把它写下来而不报错。**

### 3.6 `allow_free`：自由输入兜底（回答 doc-09 待设计 #1 的另一项）

**分工**：`allow_free: true` + `free_hint` 是**给前端的声明**，不是给 `choose` 的参数。

- UI：选项组**不消失**（`doc-06 §2.6` 的"选项是快捷方式不是唯一通道"），在选项组下方渲染一个"自己写"入口，placeholder 取 `free_hint`。
- 玩家在自由输入框里打的字**不走 `choose`**：它走已有的玩家→作家通道（前端计划 T3.4：纸条折起飞出 → 作家湿墨流式），也就是 `doc-05 §2` 的"对话通道"。
- 因此**不落 `choice_selected`**：没有"某个公开选项"被选中。落一条会污染事件表（`doc-21 §1.1` 第四行：agent/玩家的话归 `entries` 表）。

**没有 `allow_free` 的实体**（绝大多数）：UI 只渲染选项按钮。**玩家依然能在主画布自由打字**——那不在本文范围（前端计划 T3.4 的"主画布折叠 pill"）。所以 `allow_free` 不是"能不能自由输入"的开关，只是"这张卡的选项组下方要不要多一个提示性的写入口"。

### 3.7 实体名字的规则（`entityName`，三处共用）

```ts
entityName(fm, path) = fm.title?.trim() || fm.name?.trim() || basename(path, '.md')
```

- **`title` 优先**：chalk / component / letter / note 的卡面标题就是它。
- **`name` 兜底**：README 类实体（`type: readme`）带的是 `name` 不是 `title`（`templates/holmes-world/world/baker-street/README.md:3`），而**门牌是一个合法的 `choice` 目标**（"推开这扇门"写在 README 上说得很自然），所以只认 `title` 会让这类实体的事件 `name` 退化成文件名。
- **basename 兜底**：无 frontmatter 的便签（`templates/holmes-world/world/baker-street/raindrops.md` 就是这种）。

**为什么必须是共享函数而不是各写一行**：`choice_selected` / `roll_resolved` / `use_item_on` / `entity_moved` 的 `detail.name` 都要求"当时的名字"（`doc-21 §3.3`）。四处各写一遍 = 四个地方可能对同一个文件给出四个不同的名字，历史面板会显示四个"不同"的东西。**07 已确认复用这个函数**（`rules/interactive.js`）。

### 3.8 幂等与重复选择

**同一选项可以被重复选择，`choose` 不拦。** 理由：

- `doc-20 §6` 只说了"不删其他选项、不假定后果"，没说"选过的不能再选"；
- 拦它需要"已选过"的状态——而 `status` 是实体自己的快照、事件是 append-only 日志（`doc-21 §6`），**没有第三个地方可以存这个状态**，引擎内存态又会违反"文件即真相"；
- "同一轮点两次同一个选项"在 UI 上是可防的（按钮点完置灰/转场），不需要 schema 或引擎参与。

**不做去重**：`choice_selected` 是"发生了一次选择"的事实（`doc-21 §1` 准入第 1 问），两次点击就是两个事实。合并发生在注入侧（`doc-21 §5.4` 规则 1：同 `turn` + 同 `type` + 同 `actor` → 合并计数），不在写入侧。

---

## 4. 文件与副作用

### 4.1 `choose` 的副作用白名单

| 目标 | 动作 | 原子性 |
|---|---|---|
| `<worldRoot>/**/*.md` | **读**（第 2 步） | — |
| `<worldRoot>/.airpworld/history.db` 的 `events` 表 | **写**：追加一条 `choice_selected` | SQLite 事务（01 §3.2 的 `BEGIN IMMEDIATE`） |

**写盘：无。** `choose` 不创建、不修改、不删除任何文件，也不碰 `canvas.db`。这一条是 §3.1 末句的直接落地，**也正是它区别于 `roll_dice` 的地方**：`roll_dice` 要回写 `result / passed`（07 的 `patchRollDiceResult` + `writeFileAtomic`），`choose` 什么都不回写。

**由此可推出两条可以随时验收的性质**：

1. `choose` 前后对同一个文件做 `md5sum`，**必然相同**；
2. 把 `history.db` 换成只读（或让 `appendEvent` 抛错），**文件系统没有任何变化**——事件落账失败不会留下半完成状态（01 §3.6 `event_failed` 的语义在这里天然成立）。

### 4.2 写入顺序

唯一一步是 `appendEvent`。它失败 → 抛 `ActionError('event_failed')` → **不落、无半完成**。不存在"文件已改账没落"的窗口（那是 `moveEntity` 才有的问题，01 §10.2）。

### 4.3 与 `writeFileAtomic` 的关系

**不需要。** `choose` 不写文件，因此 01 冻结的 `writeFileAtomic` 与本文无关。这条明确写出来是为了让实现者不去"顺手补一个原子写"——**没有要保护的写**。

---

## 5. 落账

### 5.1 事件全字段（`choice_selected`）

依 `00 §5.2` 与 `doc-21 §4.3` 的冻结形状（01 §2.5 已落成 zod）：

```ts
{
  type: 'choice_selected',
  actor: { type: 'player' | 'writer' | 'character' | 'god', id?: string },  // 00 §3；character 才有 id
  //   ↑ 三个入口各自的身份：UI → player；作家 → writer；角色直聊 → character:<id>；上帝模式代点 → god
  subject: 'world/manor/music-room/piano.md',   // = path（01 §4 表：choice_selected 的 subject 是 path）
  layer: 'world/manor/music-room',              // = store.resolveLayer(path)（01 §3.9）
  //   ↑ path 在 player/** 或 characters/<id>/** 时为 null —— 那两种情况其实是合法的（背包里的东西也能带 choice）
  turn: 'turn:<session>:<n>',                   // 合并锚（01 §3.7）；C 入口是 'req:<uuid>'
  detail: {
    path: 'world/manor/music-room/piano.md',
    name: 'The Closed Piano',                   // **当时的名字**（entityName，§3.7）；detail 自足（doc-21 §3.3）
    choice: 'Open the lid',                     // **解析出来的 label**（§2.1），不是调用者的原始输入
    index: 1,                                   // **1-based 可见序号**（01 §2.5 冻结：与 look_at 打印的是同一个数）
  },
}
```

**`detail` 四键一个都不能少**（`00 §5.2` 冻结）：少 `name` 就要回读世界目录才能渲染人话（`doc-21 §3.3` 明禁）；少 `index` 就说不出"这是他今天的第几个动作"；少 `path` 历史面板的条目点不到实体；少 `choice` 事件段只能渲染成"玩家做了一个选择"。

**`detail` 里 MUST NOT 出现的东西**：选项的 `hint`（是给玩家的辅助文字，不是发生的事实）、`then`（未被应用）、`count`（这是 `details` 的字段，不是事件字段）、选项全文列表（`doc-21 §3.3` 末：不存正文，事件只带 path + name + 至多一行摘要）。

### 5.2 失败不落（`doc-21 §3.6` / `00 §4.2`）

| 失败 | 事件 | 说明 |
|---|---|---|
| `not_found`（文件不存在） | **不落** | 世界没有变化。 |
| `not_interactive`（无 choice 或 choice 坏） | **不落** | 同上。 |
| `choice_not_found` / `out_of_range`（选项对不上） | **不落** | 同上。选错一个不存在的选项没有改变世界。 |
| `invalid_path` / `invalid_argument`（路径非法、`choice` 是空串） | **不落** | 调用错误，不是世界事件。 |
| `event_failed`（落账本身失败） | **不落** | 无半完成（§4.2）。 |

**`layer_init_failed` 是唯一例外**（`doc-21 §3.6`），与本文无关。

**为什么"选错选项"不能落一条 `choice_selected` 记下这次尝试**：`doc-21 §1` 准入第 2 问——"光看世界目录推不出来"是它过审的条件，而"有人点了一个不存在的按钮"这种事实**没有消费者**（第三问）。作家拿到它只会写出"玩家犹豫了一下"，而那是编的。**失败必须可见**（`00` 硬约束 4）：可见性靠 `isError: true` + 可读原因，不靠事件表。

### 5.3 `turn` 的取值

- A 入口（agent 工具）：`currentTurn(ctx)`——与同一轮里 `chalk` / `move` 落的事件**同一个 turn**，因此"作家这一轮写了板书、也替角色做了一次选择"会在注入时合并成一段（`doc-21 §5.4` 规则 1）。
- C 入口（UI 路由）：`req:<uuid>`，一次 HTTP 请求一个锚。玩家连点三个选项 → 三份不同 `turn` → **不合并**（它们确实是三个独立时刻的决定），这与 01 §14 拍板项 3 里"一次工具调用 = 一个 turn"的讨论是同一件事，取"请求 = 锚"，理由是玩家连点的三次选择在叙事上就是三个节拍。

---

## 6. WS / 前端

### 6.1 两条通道（`00 §5.3` 冻结）

```
① 演出帧（瞬时）  扩展 execute 的返回值 details → pi-rp tool_execution_end.result → server
② 世界事件（历史）appendEvent 写 history.db → server 尾部读表 → WS { type: 'world_event', event }
```

**`choice_selected` 只走 ②。** 它没有对应的演出帧——理由：帧是"世界变化的动画"（`doc-21 §1.1` 第一行），而一次选择本身没什么可演的；真正要演的是**选择的后果**（作家落新 chalk → `chalk_writing` / `writer_delta` / `chalk_landed` 帧），那是另一条链路的事。

**本文因此不在 `details` 里放 `frame`**（那是 `showComponent` 的字段，01 §11.2）。

### 6.2 `details` 里 server / 前端消费的字段（稳定契约）

```ts
ChooseOptionDetails = { path, name, choice, index, count, event? }
//                      ↑ 01 §11.2 要求的 path；event 让前端在尾部读表延迟时也能立刻拿到这条事件
```

| 字段 | 谁用 |
|---|---|
| `path` | 前端定位/高亮那张卡片（`00 §6.2` 要求返回后续动作需要的稳定路径）。 |
| `name` / `choice` / `index` | 前端微演出文案（"You chose: …"）；`index` 用于把刚点的那个按钮置灰/落定。 |
| `count` | 前端校验自己的选项列表是否过期（若比 UI 上的少，说明 status 变过，应重取该卡）。 |
| `event` | 兜底同 01 §11.2：**与 `world_event` 帧会重复，前端 MUST 按 `event.id` 去重**。 |

### 6.3 前端渲染协议（`doc-06 §2.6` / `doc-05 §7.4` 的字段约定）

**前端实现归前端计划**（T1.6），本文只冻结它需要的字段与三条纪律。

**渲染位置与形态**：三个互动字段渲染成**类 md 表格块**（不是 HTML 组件），**绑在所属实体下方**，可折叠。`chalk` 只是示例——`component` / `note` / `letter` / `gate` 全都要渲染（`doc-05 §7.4` 的渲染路由表）。

**前端需要的字段约定**（就是 `interactive` 块，`parseFrontmatter().interactive`）：

```ts
// 前端：一次 parse，三块直接用，不再各自挖 raw frontmatter
const { interactive } = parseFrontmatter(raw);
interactive.status        // { data: {key: scalar}, label?, chart? } | null
interactive.choice        // { mode, allowFree, freeHint, options: NormalizedOption[] } | null
interactive.roll_dice     // { type, desc, expect, result?, passed? } | null
```

| 字段 | 前端渲染 | 现有实现的对应处（要改） |
|---|---|---|
| `status.data` | **折叠表格**（键值对）。hover 偷看 / 点击钉住（前端计划 T1.6 纪律 1）；未知键**不丢弃**是解析器已经保证的（`.passthrough()` + `interactive` 只取形状对的键）。 | `apps/web/src/lib/fm.tsx:93-120`（现在标题硬编码 `World State Snapshot (n)`，应改读 `status.label`）。 |
| `choice.options`（**过滤后**） | **选项卡片组**。渲染 `visible: true` 的项，序号用 `index`（**不是数组下标**，否则有 `when` 时全错）。`hint` 作灰字副行。 | `apps/web/src/lib/fm.tsx:134-163`（现在直接 `frontmatter.choice.map`，既不过滤也不认对象）与 `apps/web/src/App.tsx:149-155`（现在 `onSelectChoice` 只 toast + `sendToWriter`，**没有落到事件表**）。 |
| `choice.allowFree` | 选项组下方"自己写"入口，placeholder = `freeHint`。 | 无（新增）。 |
| `choice.mode === 'multi'` | B1 前端**按 single 渲染**并在控制台 warn 一次；引擎侧 `choose` 会抛 `unsupported`（§7）。 | 无（新增，赛后）。 |
| `roll_dice` | 骰子卡 → `DiceRoller`（已有）。`result/passed` 都在时显示落定态。 | `apps/web/src/lib/fm.tsx:122-132` 已经这么接了；它 POST 的 `/api/dice` 参数要改成只传 `{ path }`（归 07/12）。 |
| `errors` | **不渲染**。它是给作家与排查用的；玩家侧坏字段只表现为"那一个块不出现"（绝不半吊子 widget）。 | 无（新增）。 |

**三条纪律**（前端计划 T1.6 已有，此处与 schema 对齐）：

1. **hover 偷看，点击钉住**（`status` 折叠）；
2. **解析失败 → 整块降级为纯文本**，不半吊子渲染 —— schema 侧对应"该键 `interactive.*` 为 null"；
3. **mini-markdown 纯 DOM 构建**，不用 `dangerouslySetInnerHTML`。

**前端选择动作的目标形态**（供前端计划对齐，实现归前端）：

```
点击选项 → 立即（乐观）把该按钮置灰 → POST /api/choice { path, choice: id ?? label }
        → 200：保留置灰；其它选项保留（引擎不删它们，UI 也不删）
        → 4xx：恢复按钮 + 显示 toast（不静默吞）
同时：纸条折起飞出 → 作家获得 choice_selected 事件（doc-06 §2.1 的时间轴）
```

**关键纪律：UI MUST NOT 自己删掉其它选项**。选项只能由作家 `edit` 那个实体的 frontmatter 改变；UI 的乐观置灰只是**本地视觉状态**，刷新后以文件为准（"文件即真相"）。这条防的是"UI 以为选完该消失"——`doc-20 §6` 明写不删，UI 跟着删就会与文件不一致。

---

## 7. 错误与边界

### 7.1 失败模式全表

所有失败走 `ActionError`（01 §2.4），**一律 `isError: true` / HTTP 4xx-5xx，绝不静默降级成成功**（`00` 硬约束 4）。

| 条件 | `code` | message（英文，MUST 带具体值） | fallback |
|---|---|---|---|
| `path` 空串 | `invalid_argument` | `Path must not be empty` | 无 |
| `path` 绝对 / 含 `..` / 反斜杠 / 保留前缀 | `invalid_path` | 01 §7.2 的四条文案 | 无 |
| 文件不存在 | `not_found` | `Entity not found: "world/inn/door.md"` | 无 |
| 无 frontmatter 块 | `malformed_entity` | `"world/inn/door.md" has no YAML frontmatter block` | 无 |
| 有 frontmatter 但无 `choice` | `not_interactive` | `"world/inn/door.md" has no choice group; nothing to choose` | 无 |
| `choice` 存在但形状坏 | `not_interactive` | `"…/door.md" declares choice but it is malformed: <errors[0]>` | 无 |
| `choice: 3`（既不是数组也不是对象） | `not_interactive` | 同上 | 无 |
| 选项组为空（可见 0 条） | `choice_not_found` | `"…/piano.md" has no visible options right now (2 defined, all filtered by when)` | 无 |
| 序号越界 | `choice_not_found` | `Choice 4 is out of range for "…/door.md" (3 visible options)` | 无 |
| 文本/id 对不上 | `choice_not_found` | `Choice "Open the lid" does not match any option of "…/door.md" (3 visible options: "Open the lid", …)` | 无 |
| `choice` 是空串 | `invalid_argument` | `choice must not be empty` | 无 |
| `choice` 是 number 但非整数（`1.5`） | `invalid_argument` | `Choice number must be a positive integer, got 1.5` | 无 |
| `choice` 是 number 且 ≤ 0 | `choice_not_found` | 序号越界文案（0 与 -1 都是越界，不是参数错——UI 可能传 0-based 的下标，这条文案要能提示它） | 无 |
| `mode: 'multi'` | `unsupported` | `"…/door.md" declares a multi-select choice; B1 only supports single-select` | **无**（§7.3） |
| `when` 表达式不合法 | （**不是错误**） | 该选项不可见，`errors` 记一条，`look_at` 显示 `(hidden: ...)` | fail-closed |
| `appendEvent` 失败 | `event_failed` | 01 §3.2 的文案 | 无（§4.2） |

> **归一化口径（与 07 对齐）**：`malformed_entity` 只表示"整块 frontmatter 坏/缺失"；互动字段本身的形状坏（`choice: 3` / `status.data.a` 是对象 / `roll_dice` 缺字段）在归一化后为 `null`，一律报 `not_interactive`（§3.3 ③）。

**文案纪律**（01 §7.2）：每条 MUST 带**具体路径与具体值**。"Choice not found" 会被模型下一轮盲目重试，而 `Choice 4 is out of range … (3 visible options)` 会让它立刻改成 1/2/3。

### 7.2 边界

| 边界 | 处理 |
|---|---|
| **选项数上限** | 解析时取**前 12 个可见选项**（`CHOICE_LIMIT`），超出部分在 `errors` 记一条。理由：选项是给玩家/agent 的动作清单，不是数据表；`doc-22 §10` 已定"条目上限"是注入层的通用手段。**第 13 个之后的选项 `choose` 也选不到**（解析与显示同源），文案会说 `only the first 12 are selectable`。 |
| **选项文本超长** | 不截断（它是叙事文本，截断会改变语义）。UI 侧换行即可。 |
| **选项文本重复** | 解析时**两条都保留**（序号仍能区分），但按 label 解析时因"多条同 label"而**判未命中**（§3.2 规则 2/3）→ 提示调用者改用序号或 `id`。 |
| **`when` 键不存在于 `status.data`** | 取值 `undefined`；`when: lid == open` 且无 `lid` 键 → 不相等 → 不可见（fail-closed）。想"默认可见"就**不要写 `when`**，而不是写一个依赖缺省值的条件。 |
| **`choice` 挂在 README 上** | **合法**（门牌的"推开这扇门"）。`resolveLayer('world/inn/README.md')` = `'world/inn'`（01 §3.9），事件进该层窗口，完全正确。`entityName` 会取 `name`（§3.7）→ 门的事件叫 "Baker Street" 而不是 "README"。 |
| **`choice` 挂在 `player/**` 上** | **合法**。背包里的东西也能带选项（"用这把钥匙"）。`layer = null`（01 §3.9）→ 不进任何层窗口 → 玩家口袋里的选择不会被角色"听见"。 |
| **`choice` 挂在 `characters/<id>/**` 上** | 同上，合法，`layer = null`。 |
| **选项里含 `:` 或 `#` 等 YAML 特殊字符** | 写作时引号包裹即可；未引号时 YAML 报语法错 → `errors` 有值、`frontmatter === null` → `malformed_entity`（整块 frontmatter 坏，§7.1）。这是**正确行为**（坏 YAML 不该被猜）。 |
| **同时两个 agent 调 `choose` 同一个选项** | 都成功，落两条事件（§3.8）。不加锁（01 §7.3：动作层不加锁）。 |
| **`path` 指向目录** | `not_found`（`readFile` 会失败）——文案带路径，不说 "EISDIR"。 |

### 7.3 `mode: 'multi'` 为什么抛 `unsupported` 而不是"当 single 处理"

`doc-09` 说 MVP 只做 choice 单选卡。把 `multi` 当 single 处理是**静默降级**：作者写了多选，玩家却只能点一个，而没有任何地方提示这件事。`unsupported` 是 01 冻结里专门为这种情况准备的值（"合法但本阶段未实现"），它**同时**在工具返回里可见（作家会读到并改写法）、在 HTTP 里可见（前端能提示）。

**`unsupported` 不是 `not_interactive`**：实体有选项组，只是这个模式没实现。混用会让错误文案说错原因。

### 7.4 `choice_not_found` 与 `not_interactive` 的区分

- `not_interactive`：**这个实体身上没有可选的东西**（无 choice 或坏）。
- `choice_not_found`：**有选项，但你指定的那个不在**（越界 / 对不上 / 全被 `when` 挡了）。

两者都是 422（01 §7.1），但文案与调用者的下一步不同：前者让作家去**写**一个 choice，后者让调用者**改参数**。混成一个码会让 agent 做错事。

---

## 8. 要实现/修改的代码落点

| 文件 | 函数 / 导出 | 改动 |
|---|---|---|
| `packages/shared/src/schemas/frontmatter.ts` | 全量重写 | 见 §2.2。删 `ChalkFrontmatterSchema` / `ChalkStatus` / `ChalkFrontmatter`；保留 `RollDiceSchema` / `StatusSchema` 名字（07 与前端已在用）；新增 `InteractiveFieldsSchema` / `BaseEntitySchema` / `EntityFrontmatterSchema` / `InteractiveValueSchema` / `ChoiceOptionSchema` / `ChoiceSchema` / `ParsedFrontmatter`；`parseFrontmatter` 换成 yaml 版（§9.2）。 |
| `packages/shared/src/rules/interactive.ts` | **新建** | 见 §2.3。零依赖纯函数：`buildInteractiveFields` / `visibleChoiceOptions` / `resolveChoice` / `evalWhen` / `entityName` / `formatInteractiveText` / `CHOICE_LIMIT`。 |
| `packages/shared/src/actions/choose.ts` | **新建** | `chooseOption`（§2.1、§3）+ `ChooseOptionInput` / `ChooseOptionDetails`。只调 `store.readFile` 与 `store.appendEvent`。 |
| `packages/shared/src/actions/service.ts` | `createActionService` | 绑定 `chooseOption`（01 §2.6 已预留，无改动）。 |
| `packages/shared/src/index.ts` | — | 加 `export * from './rules/interactive.js'`（与 01 已加的 `./rules/dice.js'` 并列），让 `extensions/` 与前端都能直接 import。 |
| `extensions/toolkit/choose.ts` | **新建** | 工具壳（§2.4）。 |
| `extensions/tools.ts` | 注册 | `registerChoose(pi)`（归 12 的统一注册入口）。 |
| `apps/server/src/routes/world.ts` | `POST /api/choice` | **新建路由**（§2.5）；同时删掉现有 `POST /dice`（344-397）里自己解析 expect / 掷骰 / `stringifyChalk` 的部分（归 07/12）。 |
| `apps/web/src/lib/fm.tsx` | `renderFrontmatterWidgets` | 改读 `interactive`（§6.3）；`choices.map` 改成渲染过滤后的 `NormalizedOption[]`。 |
| `apps/web/src/App.tsx` | `handleSelectChoice` | 从"toast + `sendToWriter`"改成 **`POST /api/choice`**（149-155 行现在完全不落事件表）。 |
| `apps/web/src/state/useWorld.ts` | — | 无（`sendToWriter` 保留给自由输入，`doc-05 §2` 的对话通道）。 |
| `packages/shared/src/schemas/components.ts` | `BuddyComponentSchema` | `status: z.string()`（33 行）与互动字段 `status: {data}` 同名冲突。按 doc-10 E0，`buddy` **不是组件**（不在 10 的注册表里），此 schema 无消费者 → **建议删除**；若保留必须改名（登记 §11 冲突 6）。 |

**为什么 `rules/interactive.ts` 不放在 `schemas/`**：见 §2.3 末。一句话：它必须能被**没有 yaml 依赖的消费者**（07 的 `rules/dice.ts`、前端、单测）import。

---

## 9. 与现存实现的差异

### 9.1 依赖决策：手写 YAML-lite → 真 YAML 解析器（评估结论）

**结论：换。** 引入 `yaml`（`2.9.x`），与 pi-rp 同 major —— `vendor/pi-rp/packages/coding-agent/package.json:67` 是 `"yaml": "2.9.0"`，pi-rp 自己的 frontmatter 解析器就用它（`vendor/pi-rp/packages/coding-agent/src/utils/frontmatter.ts:1` `import { parse } from "yaml"`）。同 major 意味着**两侧对同一份文件的解释一致**，这是"扩展与 server 共享世界目录"架构下的硬要求。

**实测证据（本次设计期真跑过，不是推演）**：

1. **覆盖现状**：walk `templates/**` + `worlds/**` 的 **49 个 `.md`**，其中 **34 个有 frontmatter**。yaml 版解析：**0 个 YAML 错误**，对 `EntityFrontmatterSchema`（§2.2 的形状）**0 个 schema 错误**。即现有内容**零破坏**。
2. **修好的东西**：与今日手写解析器逐文件 diff，**唯一差异是 5 个文件**，全部是**变好**：
   - `templates/holmes-world/world/README.md`：`bg` 从 `"assets/…png\"   # world-map backdrop (README = scene config, see doc-10 E0)"`（**把行内注释和引号一起吞进值里**）变成 `"assets/…png"`；顺带 `bgStyle` 从**丢失**变成 `{tone: warm, grain: parchment}`，`compass` 从字符串 `"true   # compass = …"` 变成 boolean `true`。
   - `templates/holmes-world/world/{baker-street,abandoned-orchard,crime-scene}/README.md` 与 `templates/magic-academy/world/README.md`：同上（`bg` 干净 + `bgStyle` 恢复）。
   **`bg` 这一条是现成的 bug**：`apps/server/src/routes/world.ts:44-48` 现在必须手工 `replace(/\s+#.*$/, '')` 去剥注释（注释原文还写着 "parser keeps them verbatim"）——换了解析器，这段补丁**可以删**。
3. **`bgStyle` 的 tone/grain 也**现在靠 `world.ts:52-53` 的正则 `raw.match(/^\s*tone:\s*(\S+)/m)` 从原文里刨——换解析器后 `bgStyle.tone` / `bgStyle.grain` 直接可用，这两条正则可以删。
4. **嵌套/复杂类型**（这是不换就解决不了的）：
   - `bgStyle: { tone, grain }` → 一层嵌套 map；
   - 10 号文档 §14 注册表要的 `accepts: { itemKinds: [...] }` → 嵌套 map；
   - `marks: [{label, x, y}]`（地图）、`rows: string[][]`（账本）、`pages: [...]`、`states: [...]` → **list of maps / list of lists**。
   "手工补一层嵌套对象解析"（10 文档 §8.2 的建议做法）**只能修 `bgStyle` 这一类**，上面其余全部照丢。用一个真解析器一次全解决。
5. **坏 YAML 变成可诊断的**：手写解析器对畸形输入一律产出**半个对象且不报错**（实测：`expect: >50` → 手写器给出字符串 `">50"`，yaml 给出 `""` **并带一条 error**）。yaml 版把 `doc.errors` 逐条收进 `errors`，于是"坏在哪"第一次变成**可见事实**（`00` 硬约束 4：失败不静默）。这也是 §3.3 ③ 能成立的前提。

**成本与风险**：

| 项 | 评估 |
|---|---|
| 依赖体积 | `yaml@2.9.0` 是零依赖包（实测 `pnpm add yaml@2.9.0 --filter @airp/shared` 成功且**只加一个包**）。 |
| 现网可用性 | 实测可安装（3.5s）。**离线环境**无法装（`ERR_PNPM_NO_OFFLINE_META`）——评审若要求全离线构建，回退方案见下。 |
| 性能 | frontmatter 是文件头几十行且**只在读文件时跑一次**；相对 `fs` I/O 可忽略。caret 频率：`/api/layer` 每层每卡一次。 |
| 语义差异 | **只有一处需要作者注意**：`expect` 必须带引号（§11 冲突 5）。实测现存 5 处 `expect:` **全部已带引号**。 |
| 类型漂移 | yaml 会把 `on` / `off` / `yes` / `no` 解成**字符串**（实测，非 boolean）、`007` 解成 `7`、`~` 解成 `null`。现存内容在这些位置上没有踩到（实测 34 文件的键类型清单：`string/boolean/null/object/array`，无意外）。**这条要写进 §10 的迁移检查。** |

**回退方案（评审若要零新依赖）**：保留手写解析器，但**必须**把"嵌套对象整块静默丢弃"改成**报错**（`errors` 里记一条、`frontmatter` 里保留 raw 文本）——否则 `bgStyle` / `accepts` / `marks` 会继续无声消失。代价：`marks` / `rows` / `pages` 这类 list-of-list 依然不可用，10 的注册表要删功能。**本文推荐换解析器**，回退方案登记在 §12。

### 9.2 `parseFrontmatter` 改造前 vs 改造后

**改造前**（`packages/shared/src/schemas/frontmatter.ts:29-121`，逐字现状）：

```ts
export function parseFrontmatter(rawContent: string): { frontmatter: Record<string, any> | null; body: string } {
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: null, body: rawContent };

  const yamlBlock = match[1];
  const body = match[2];
  const frontmatter: Record<string, any> = {};

  const lines = yamlBlock.split(/\r?\n/);
  let currentKey: string | null = null;
  let currentSubKey: string | null = null;   // ← 声明了，从未被赋值（死变量）
  let inStatusData = false;
  let inChoice = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!line.startsWith(' ') && !line.startsWith('\t')) {
      // ... 顶层 key：只有 choice/status/roll_dice 有分支；其余走"YAML-lite 标量"猜测
      //     key === 'bgStyle' → val 为空串 → else if (val) 不成立 → frontmatter.bgStyle 根本没赋值
    }
    if (inChoice && line.trim().startsWith('- ')) { /* push 字符串 */ continue; }
    if (currentKey === 'status' && line.trim().startsWith('data:')) { inStatusData = true; continue; }
    if (inStatusData && currentKey === 'status') { /* key: value，Number 猜测 */ continue; }
    if (currentKey === 'roll_dice') { /* key: value，result/passed 特判 */ }
    // ← 其余所有缩进行（一层嵌套对象、list of map）落到这里，被整块丢弃
  }
  return { frontmatter, body };
}
```

**问题清单（每一行都能在实现里指出来）**：

| # | 位置 | 问题 |
|---|---|---|
| 1 | `:42-43` + `:64` | 顶层 `key:` 空值不赋值 → `bgStyle:` **整块丢**（10 文档 §9.1 D6 已记）。 |
| 2 | `:87-117` | 只有 `choice` / `status.data` / `roll_dice` 三个分支有子结构解析，**其余缩进行直接落到循环末**（无 `else`，静默丢弃）。 |
| 3 | `:93-96` | `status` 下除 `data:` 以外的子键（`label`）会被 `inStatusData` 之后的分支当成 data 项收进去。 |
| 4 | `:87-91` | `choice` 只认 `- ` 开头的字符串；**对象形式的选项**（`- label: …`）会走 `:64` 的标量分支或直接丢。 |
| 5 | `:103 / :113` | `status.data` 与 `roll_dice` 的标量靠 `isNaN(Number(v))` 猜类型 → `"007"` 变 `7`，`"true"` 在 `status.data` 里**保持字符串**（与顶层 `:71-81` 的规则不一致）。 |
| 6 | `:103` | 值里的引号被 `replace(/^["']|["']$/g,'')` 剥掉，但**行内注释保留**（`bg` 的 bug，§9.1 证据 2）。 |
| 7 | 全文 | 畸形 YAML **不报错**：`expect: >50` 给出 `">50"`（错值无警示），缩进错乱给出半个 map。 |
| 8 | `:41` | `currentSubKey` 死变量。 |
| 9 | `:30` | 正则 `^---\r?\n…` 要求 frontmatter 必须从**第 0 字节**开始（BOM `\uFEFF` 会让整块丢失，见 §12.10），且 `([\s\S]*?)\r?\n---` 要求闭合围栏前**至少一个字符** —— 因此**零内容块 `---\n---\n` 不匹配**，整份原文被当成 `body`。**这不是改造引入的**：新实现沿用同一个正则，行为零变化（实测旧实现与预期一致）。登记为已知边界而非缺陷。 |

**改造后**（全文）：

```ts
import { z } from 'zod';
import { parseDocument } from 'yaml';
import {
  buildInteractiveFields, entityName,
  type InteractiveFields,
} from '../rules/interactive.js';

/* ... §2.2 的全部 schema 定义 ... */

/** frontmatter 块的分割。与旧实现同一个正则 —— 这块从来没坏过，不改。 */
const FM_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/** 无互动字段时的规范空块。永不返回 null，消费者不必到处判空。 */
const EMPTY_INTERACTIVE: InteractiveFields = { status: null, choice: null, roll_dice: null };

export function parseFrontmatter(rawContent: string): ParsedFrontmatter {
  const match = rawContent.match(FM_BLOCK);
  if (!match) {
    return { frontmatter: null, body: rawContent, entity: null, interactive: EMPTY_INTERACTIVE, errors: [] };
  }
  const [, yamlBlock, body] = match;
  const errors: string[] = [];

  /**
   * parseDocument 而不是 parse：我们要 errors 列表（doc-21 §1 的"失败不静默"）。
   * logLevel: 'silent' —— 错误我们自己收集并呈现，不让 yaml 往 stderr 打warning
   *   （扩展跑在 agent 进程的 stdio 上，任何 stderr 噪音都会污染 RPC 通道观感）。
   * maxAliasCount: 100 —— 防 billion-laughs（frontmatter 是 LLM 写的，不完全可信）。
   */
  const doc = parseDocument(yamlBlock, { logLevel: 'silent', maxAliasCount: 100 });
  for (const e of doc.errors) errors.push(e.message.split('\n')[0]);

  let raw: Record<string, any> | null = null;
  try {
    const js = doc.toJS({ maxAliasCount: 100 });
    // 注：零内容块（---\n---\n）根本进不到这里 —— FM_BLOCK 的 `([\s\S]*?)\r?\n---`
    // 要求闭合围栏前至少有一个字符，所以它连 match 都不成立（实测，与旧实现一致）。
    // 能到这里而 js 为 null 的是「只有注释/空行」的块（---\n# c\n---\n），那是合法的空
    // frontmatter，给 {} 而不是 null，让"有块"这个事实不丢。
    raw = js === null || js === undefined ? {} : (typeof js === 'object' && !Array.isArray(js) ? js : (errors.push('Frontmatter must be a YAML mapping, got a list'), null));
  } catch (e) {
    errors.push(String((e as Error)?.message ?? e));
  }

  // YAML 语法坏 → frontmatter 视为没有（与旧实现"没有块"同路径），但 errors 有值：
  // 这是刻意的 —— 半个 frontmatter 比没有 frontmatter 更危险（会渲染出错误的卡片类型）。
  if (errors.length > 0) {
    return { frontmatter: null, body, entity: null, interactive: EMPTY_INTERACTIVE, errors };
  }

  const entity = EntityFrontmatterSchema.safeParse(raw);
  if (!entity.success) {
    for (const i of entity.error.issues) errors.push(`${i.path.join('.') || '(root)'}: ${i.message}`);
  }

  return {
    frontmatter: raw,                       // 无过滤：bg / bgStyle / accepts / marks 全在
    body,
    entity: entity.success ? entity.data : null,
    interactive: buildInteractiveFields(raw),
    errors,
  };
}

export { entityName };
```

**前后对照（同一份输入的行为差异）**：

| 输入 | 旧 | 新 |
|---|---|---|
| `bgStyle:\n  tone: warm\n  grain: parchment` | `{}`（`bgStyle` 丢，无报错） | `{ bgStyle: { tone: 'warm', grain: 'parchment' } }` |
| `bg: "a.png"   # comment` | `"a.png\"   # comment"`（引号+注释一起吞） | `"a.png"` |
| `compass: true   # c` | `"true   # c"`（字符串！`if (fm.compass)` 为真，`=== true` 为假） | `true` |
| `expect: >50` | `">50"`（**错得看不出来**） | `""` + `errors:['Block scalar header includes extra characters…']` |
| `choice:\n  - label: X\n    when: k == 1` | 丢/半解析 | `[{label:'X', when:'k == 1'}]` |
| `status.data.a` 是对象 | `{a: {…}}`（原样塞进 data） | `interactive.status = null` + `errors[…]`，raw 保留 |
| `title:` （空值） | 键不出现 | `title: null` → `.optional()` 下 `entity.title === null`；前端 `fm.title?.trim()` 已安全 |
| `---\n# c\n---\n` 只有注释的块 | `frontmatter: {}`（yaml 无键可给；旧实现也走 `:31`→`null` 之外的路径，实测旧实现给 `{}`） | `frontmatter: {}` + `interactive` 空块 |
| `---\n---\n` **零内容**块 | `frontmatter: null`，**`body` 是整份原文**（正则不匹配） | **同**（正则一字未改，行为零变化） |
| 无 frontmatter | `frontmatter: null`，`body` 原文 | 同（零行为变化） |
| CRLF | 同 | 同（正则已容 `\r?\n`，body 保留 `\r\n`） |

### 9.3 迁移影响：现有调用点逐个交代

**全部调用点**（`grep parseFrontmatter|stringifyChalk` 实测结果，排除 `node_modules`/`dist`）：

| 调用点 | 现在怎么用 | 迁移动作 |
|---|---|---|
| `apps/server/src/routes/world.ts:4` | `import { … parseFrontmatter, stringifyChalk … }` | `stringifyChalk` 的**生产调用只剩 1 处**（见下行 `/dice`），随 07 的 patcher 上线即删。 |
| `world.ts:43-48`（`readLayerBg`） | `parsed.frontmatter?.bg` + **手工剥行内注释** + 判断空串 | **改**：`parsed.frontmatter?.bg` 直接可用（已是干净的 `"assets/…png"`），**删掉 `replace(/\s+#.*$/, '')` 那两行**。 |
| `world.ts:52-53`（`readLayerBg` 的 tone/grain） | 两条正则从 raw 文本刨 `tone:` / `grain:` | **改**：`parsed.frontmatter?.bgStyle?.tone ?? 'warm'` / `.grain ?? 'parchment'`，**删掉两条正则**。这正是 10 文档 §9.1 D6 与本文证据 3 的合流点。 |
| `world.ts:139-140,145-146,246-250,273-274`（`/layer`、`/backpack`、`/characters`） | 解构 `{ frontmatter, body }` 后原样给前端 | **不动**（多返回的 `entity`/`interactive`/`errors` 被忽略；`frontmatter` 现在更完整，前端只会变好）。**可选增强**（归 12）：把 `interactive` 一起放进 `LayerItem`，前端就不用再解一遍——但 `interactive` 可在前端从 `frontmatter` 本地算（`rules/interactive.ts` 是纯函数、可被前端 import）。**本文建议不放**：payload 更小、且单一真相（raw）只过一层。 |
| `world.ts:350-379`（`POST /dice`） | `parseFrontmatter` → 自己掷骰 → 自己解析 expect → `stringifyChalk(frontmatter, body)` → `writeFile` | **整段删，改调 `rollDice`**（归 07 + 12）。**`stringifyChalk` 生产调用点归零。** |
| `packages/shared/src/store/local-store.ts:9,200`（`scanLayers`） | `parseFrontmatter(README).frontmatter` 取 `name`/`material`/`stub` | **不动**（返回形状超集兼容）。**顺带收益**：README 的 `bgStyle` 从此也在这里被正确解析（虽然 `layers.ts` 只用 `name/material/stub`）。 |
| `tools/probe-writer.mjs:8,132`（探针） | `parseFrontmatter(...).frontmatter?.type !== 'chalk'` 断言 | **不动**（`frontmatter.type` 语义未变）。**加一条断言**（§10）。 |
| `apps/web/src/**` | **完全不 import `parseFrontmatter`**（实测：web 只 import `@airp/shared/forms` 的三个纯函数，因为 index 会拉 `node:sqlite`） | **不动。** 前端要 `interactive` 时有两条路：① 走 `@airp/shared/forms` 同款的子路径导出（给 `rules/interactive` 加一个 `exports` 条目）；② server 侧已在 payload 里带 `frontmatter`，前端用同一个纯函数本地算。**本文建议 ①**（纯函数 + 类型统一，且前端不必依赖 server 的 payload 形状）。归前端计划。 |

**`stringifyChalk` 的下场**：`frontmatter.ts:123-148`。它今天只有一个生产调用者（上面 `/dice` 那一行）。07 的 `patchRollDiceResult` 取代它之后，**这个函数应当删除**：它用 `JSON.stringify(v)` 重发每个键（`:141`），会把 `expect: ">50"` 写成 `expect: ">50"`（可）但把 `bgStyle` 写成 `bgStyle: {"tone":"warm"}`（**JSON 化的 YAML，能解析但难看且每次回写都在改写作者的文件**）——正 07 指出的问题。**保留它会诱使实现者再用一次。**

### 9.4 对 10 号文档 / 前端计划的接口交代

- **10 号 §8.2 / §9.1 D6 / §11 冲突 #3 的"加通用一层嵌套对象解析"** → 由本文的解析器替换**一次解决**，不需要 10 再改解析器。10 的 `accepts` / `grid` / `lines` / `marks` / `rows` / `pages` / `states` 全部**直接经 `frontmatter.*` 拿到**。已与 10 对齐（见 §11 冲突 3）。
- **`BuddyComponentSchema` 的 `status`** → §11 冲突 6。
- **前端 `lib/fm.tsx`** → §6.3 的字段表。

---

## 10. 验收与测试

### 10.1 纯函数单测（无 I/O，必须写）

`packages/shared/src/rules/interactive.ts` 与 yaml 版的 `parseFrontmatter` 一起，是 B1 里最好测的一块。

| 目标 | 判据 |
|---|---|
| `evalWhen` | `k == 1` 对 `{k:1}` 真、`{k:2}` 假、`{}` 假；`k != 1` 三者相反；`k == true` 对 `{k:true}` 真；`k == open` 对 `{k:'open'}` 真；**不合法表达式**（`k === 1` / `k > 1` / 空串）一律假；未引号数字 `1` 与 `"1"` 等价。 |
| `visibleChoiceOptions` | 2 选项、第 2 条 `when: lid == open`：`{lid:'closed'}` → 只返回第 1 条，且 `index === 1`；`{lid:'open'}` → 返回 2 条，`index === 1/2`（**不是 1/3**）。 |
| `resolveChoice` | 对同一选项组：`1` / `'1'` / `'Open the lid'` / `'OPEN THE LID'` / `'open-the-lid'`(id) 全命中同一条；`4` → `out_of_range`；`'Nope'` → `not_found`；`0` / `-1` → `out_of_range`；两条同 label → `not_found`；全被 `when` 挡 → `not_found`。 |
| `resolveChoice` 数字消歧 | 选项 `['2', 'Open the lid', 'Run']`：`'2'`（字符串）→ label `'2'`(index 1)；`2`（number）→ `'Open the lid'`(index 2)。**这一条防的是实现者"顺手把数字提前"**。 |
| `entityName` | `{title:'X'}` → `'X'`；`{name:'Y'}` → `'Y'`；`{}` + `world/inn/copper-key.md` → `'copper-key'`；`{title:'  '}`（纯空白）→ 落到 basename。 |
| `buildInteractiveFields` | 简写数组 == 完整对象（同选项集）；`choice: 3` → `choice: null`；`status.data.a` 是对象 → `status: null`；`roll_dice` 缺 `expect` → `roll_dice: null`；空 frontmatter → 三个全 null。 |
| `formatInteractiveText` | 对 `evening.md` 的实际内容断言输出 == `doc-20 §3.2` 的格式（`[Status]` / `[Choices]` / `[Dice]` 三块，序号从 1）。 |
| `parseFrontmatter`（yaml 版） | ① `bg: "a.png" # c` → `bg === 'a.png'`；② `bgStyle` 嵌套可读；③ `expect: >50` → `errors.length === 1` 且 `frontmatter === null`；④ `---\n---\n` → `frontmatter === null`（零内容块不匹配 `FM_BLOCK`，`body` 是整份原文；与 §9.2 一致）；⑤ 无 frontmatter → `frontmatter === null` 且 `body` **逐字节等于输入**；⑥ CRLF 与 LF 结果等价；⑦ `maxAliasCount` 生效（10 万条 alias 的 bomb 不 OOM）。 |

### 10.2 store 单测（临时目录 + 真 SQLite）

| 场景 | 判据 |
|---|---|
| 正常选择 | 建一个带 2 选项的实体 → `chooseOption({path, choice:2})` → 事件表恰好 +1 条；`type='choice_selected'`；`detail.index===2`；`detail.choice` == 第 2 个 label；`subject===path`。 |
| **零落盘** | 选择前后对目标文件 `md5sum` **相同**（§4.1 性质 1）。 |
| 选项已消失 | 选完用 `editEntity` 删掉 `choice` → 再 `chooseOption` 同一 path → 抛 `not_interactive`，且**事件表条数不变**。 |
| 序号漂移 | 2 选项 + 第 2 条 `when: lid == open`；`status.data.lid='closed'` 时 `chooseOption({choice:2})` → `choice_not_found`；改成 `'open'` 后 → 成功且 `index===2`。 |
| 失败不落 | 四种失败（`not_found` / `not_interactive` / `choice_not_found` / `invalid_path`）各跑一次，事件表条数**全部不变**。 |
| `layer` | `world/inn/door.md` → `detail` 的 `layer === 'world/inn'`；`player/ticket.md` → `layer === null`。 |
| `when` 全挡 | 2 条全带 `when` 且都不成立 → `choice_not_found`，文案含 `no visible options` 与两个计数。 |

### 10.3 探针 / 手测（端到端）

1. **UI 三入口同源**：`templates/holmes-world` 起世界 → 画布上点 `evening.md` 的选项 1 → **断言 `history.db` 里出现一条 `choice_selected`，`actor_type='player'`，`detail.choice` 等于该选项文本**。（现在这条断言**必然失败**：`App.tsx:149-155` 只 toast + `sendToWriter`，一条事件都不落。）
2. **作家入口**：让作家对同一个实体调 `choose` → 事件 `actor_type='writer'`；**两个入口的事件 `detail` 形状逐字段相同**（证明"共用同一动作函数"）。
3. **角色入口**：角色直聊期间调 `choose` → `actor_type='character'` 且 `actor_id` 非空。
4. **零落盘**：第 1 步前后对 `world/baker-street/evening.md` 做 `md5sum`，**相同**。
5. **失败可见**：POST `/api/choice` 传一个不存在的序号 → 4xx + 英文原因；**对比 `history.db` 条数不变**；**对比 `GET /api/layer` 返回的卡片没有任何变化**。
6. **`bgStyle` 回归**：`GET /api/layer?layer=world/baker-street` 的 `bg.src` **不含** `#` 与引号（现在是含的）。
7. **探针增强**：`tools/probe-writer.mjs` 在断言 `frontmatter.type === 'chalk'` 之后，加一条 `parseFrontmatter(landed).interactive.choice?.options.length >= 1`（把"互动字段真的被通用解析了"钉进全链路探针）。

### 10.4 评审可读性判据

本文 §2.2 的 schema 代码块能被逐条对照 `doc-20 §2` 的三条要求：① 互动字段在**独立** schema 里（不再是 `ChalkFrontmatterSchema` 独占）；② `EntityFrontmatterSchema` 由 `BaseEntitySchema` 与它组合（`00 §10` 问题 1 的闭环）；③ 解析器对所有实体**统一提取**（`interactive` 块，与渲染类型解耦）。缺一条 = 问题 1 没修完。

---

## 11. 发现的冲突 / 需要修订的上位文档

> 按 `00 §0`：不在本文私改上位文档，只登记，评审统一裁决。

| # | 哪两份 | 哪一句 / 哪里 | 为什么矛盾 | 建议怎么改 |
|---|---|---|---|---|
| 1 | `doc-09` §待设计 1 vs 本文 | doc-09 把"条件选项 / 自由输入兜底"列为**待设计**，并在文末「标记」里写「chart 化与条件选项赛后再补」 | §3.5 论证：不做 `when` 就**没有稳定的序号**——`look_at`、UI、`choose` 三处会按不同的列表编号，这是整套协议唯一不能错的地方；`evalWhen` 只是 ~20 行纯函数 | 把 doc-09 末句收紧为「chart 化与 `multi` 赛后再补；`when` 进 MVP（理由：序号一致性）」 |
| 2 | `doc-09` §待设计 1 vs `doc-20 §6` | doc-09 要求设计"选项选定后的**后置动作**（更新哪些 status / 作为玩家下一轮输入推进）" | `doc-20 §6` 明写「选择不会……假定后果」；把 `then` 做成会 apply 的字段就等于 `choose` 要改文件，同时违反 `doc-21 §2`（一次点击 = 事件 + 静默改写，两个变更来源） | 在 doc-09 补一句：后置动作的**执行者**是组件 handler / 作家（读 `choice_selected` 后自行 `edit`），`choice` 只声明意图（`then` 是扩展位，B1 不 apply） |
| 3 | `doc-10` §8.2 / §9.1 D6 / §11 冲突 #3 vs 本文 | 10 号文档建议「加**通用一层嵌套对象**解析（**不引入 YAML 库，保持无依赖**）」 | 一层嵌套修不了 10 自己 §14 要的 `marks: [{label,x,y}]`（list of maps）、`rows: string[][]`（list of lists）、`pages`/`states`（list）；且它继续"静默丢弃"而非报错（§9.1 证据 4/5） | 采纳本文 §9.1：换 `yaml@2`（与 pi-rp 同 major）。10 的 §9.1 D6 行与 §11 冲突 #3 改引 `06` 为修复者；三个 schema 里的 `accepts`/`marks`/`rows` 不需要 10 再动解析器 |
| 4 | `doc-20` §2 vs zod 3.25（本仓 `zod@3.25.76`） | doc-20 §2 的代码块：`const EntityFrontmatterSchema = BaseEntitySchema.and(InteractiveFieldsSchema).passthrough();` | `z.and()` 返回 `ZodIntersection`，**没有 `.passthrough()` 方法**（实测：`TypeError: BaseEntitySchema.and(...).passthrough is not a function`），照抄编译不过 | 改 doc-20 §2 为 `z.intersection(BaseEntitySchema.passthrough(), InteractiveFieldsSchema.passthrough())`（语义等价：两者都保留未知键，实测一致）。**这是 doc-20 里唯一一行不可运行的代码。** |
| 5 | `doc-05 §3.1` / `doc-06 §2.6` vs YAML 语义 | 两处都写 `expect: ">50"  # 通过条件（引擎可读比较式，必须带引号）` | **"必须带引号"是对的，但理由没人写出来**：`expect: >50`（无引号）在 YAML 里是**块标量头**，解析器不报致命错、**静默给出空串** `""`（实测 yaml 2.9 + `doc.errors` 一条）。旧手写解析器看不出这个问题（它把 `>50` 当普通文本），换解析器后**空 `expect` 会变成显式错误** | doc-05 §3.1 与 doc-06 §2.6 的注释补一句：「不引号会被 YAML 当块标量头、得到空串」；`RollDiceSchema.expect` 加 `.min(1)`（本文已加），使坏声明显式失败而非默认 `>50`。**注**：现存 5 处 `expect:` 全部已带引号，无迁移风险 |
| 6 | `packages/shared/src/schemas/components.ts:33` vs `doc-20 §2` | `BuddyComponentSchema` 声明 `status: z.string().optional()` | `status` 现在是通用互动字段 `{ data: {...} }`（doc-20 §2）。同名两义；且按 `doc-10 E0`，`buddy` **不是组件**（不在 10 §14 注册表里），该 schema 无消费者 | 删除 `BuddyComponentSchema`（连带 `BuddyComponent` 类型）；若评审要留，改名为 `statusLine`。**这是 B1 范围内的死代码清理，不是功能改动** |
| 7 | `doc-05 §3.1` / `doc-09` 背景 vs 实现现状 | 「三者是**所有落盘实体通用的**互动字段」 | 现状 `ChalkFrontmatterSchema`（`frontmatter.ts:15-23`）把三个字段锁在 chalk 上，`type: literal('chalk')` 使该 schema 对任何非 chalk 实体**直接 parse 失败**（实测） | 本文已修（§2.2）。**`ChalkFrontmatterSchema` 应当删除**而不是保留兼容——保留它就会有人继续用它去 parse 非 chalk 实体 |
| 8 | `doc-20 §2.2` vs `doc-21 §4.3` | doc-20 §2.2 的 `roll_dice` 示例只有 `type/desc/expect`；`doc-21 §4.3` 的 `roll_resolved.detail` 是 `{path,name,dice,desc,expect,result,passed}` | 字段名不同：`roll_dice.type`（文件）vs `detail.dice`（事件） | **不是冲突**，是两处不同对象（声明 vs 事件）。登记以防实现者混用：`07` 的 `detail.dice` 取 `roll_dice.type` 的值。已在 01 §2.5 的 `EventDetailSchemas` 落定 |
| 9 | `00 §5.2` 的 `choice_selected.detail` vs 本文 §5.1 | `00 §5.2`：`{ path, name, choice, index }`，未注明 `index` 的进制 | 1-based 还是 0-based 决定了 UI/agent 是否要做 ±1（最高频的接口错误） | `00 §5.2` 的 `index` 后补一句「1-based，与 `look_at` 打印的序号相同」。01 §2.5 已把这条写进代码注释（`z.number().int().min(1)`），本文 §2.1 复述 |
| 10 | `doc-04 §10.6`（视觉）vs 本文 §6.3 | 前端计划 T1.6 要求 status 折叠表格「未知键不丢弃」 | `StatusSchema.data` 是 `z.record(z.string(), scalar)` —— **任意键都收**，所以"未知键不丢"在 schema 层已经成立；但**值必须是标量**，所以 `status.data.someObj` 会被判为坏字段 | **不是冲突**，是口径澄清：`status.data` 的"未知键"指键名任意（收），值域受限（标量）。本文 §3.4 已写。10 的组件若需要结构化状态，用**自己的 kind extra 字段**（如 `lines`），不要塞 `status.data` |

**给评审的一句话**：冲突 3（解析器）、4（zod 写法）、5（`expect` 引号）里，#4 是**立刻会编译不过**的，#3 是**唯一影响 10 号文档范围**的，#5 是**唯一需要动作者写作习惯说明**的。

**评审裁决回填（2026-09-12，源：`REVIEW-评审报告.md`）**：本表各条维持"登记"性质；本批按报告改动的是正文而非本表——`06 §2.4` 工具壳改 `resolveAgentActor(process.env[AGENT_ROLE_ENV])`（B-3）、`§2.3` 归一化类型补 `status.chart?: 'bars'`（m-15）、`§7.1` "无 frontmatter 块"改 `malformed_entity`（m-3）、`§3.3`/`§7.1` 明确"归一化后 null → `not_interactive`；`malformed_entity` 只用于整块 frontmatter 坏"（m-4）、`§10.1` 零内容块的测试期望改 `frontmatter === null`（m-16）。表内冲突 3/4/5/6 的处置仍以报告对应条目为准。

---

## 12. 仍然未知 / 留给评审拍板的

1. **要不要接受新增依赖 `yaml`（§9.1）**。本文推荐"要"：实测零破坏、零依赖包、与 pi-rp 同 major。回退方案（保留手写解析器 + 把静默丢弃改成报错）**会让 10 的注册表删功能**（`marks`/`rows`/`pages` 不可用）。**这一条不拍板，10 号文档的 §14 注册表就没法定稿。**

2. **`status.data` 嵌套是否该支持**（§3.4）。本文定"不支持"（`when` 判据是扁平键，嵌套写不出条件）。若评审要求支持，代价是 `when` 语法要扩（`lid.hinge == loose`）与前端表格要支持层级 —— **建议赛后**。

3. **`choice` 选项数上限 12**（§7.2）。与 `doc-22 §10` 的 `bag`/`layer_files` 上限（同为 12）对齐，原因只是"同一个数字好记"。若实测某场景需要更多（如"选一个角色"），调 `CHOICE_LIMIT` 即可，但它同时是"可被 `choose` 选到的上限"，**调它要考虑注入体积**。

4. **选择解析顺序是否可接受**（§3.2）。本文**实现了文本优先、数字垫底**（`id` → 精确 label → 大小写不敏感 label → 数字）。利弊已实测：字符串 `"2"` 与数字 `2` 在"选项文本就是 `"2"`"时会指向不同选项（刻意，见 §3.2 那条语义）。若评审认为这太绕，两种收紧都只需改 `resolveChoice` 一处（纯函数）：① 数字提到最前；② 禁掉"纯数字字符串当序号"，要求序号必须是 number。

5. **`then` 字段要不要现在就定形状**（§3.5 末）。本文给了一个最小形状（`Record<string, InteractiveValue>`），并明确 B1 不 apply。若评审认为"写下来却不生效"比"不写"更危险，删掉该字段即可（作者改键名拉平到 `status.data` 一样能表达意图）。

6. **`allow_free` 的 UI 归属**（§3.6）。本文把它定为"选项组下方的写入口，走作家对话通道"。前端计划 T3.4 另外要"主画布折叠 pill"——两者是不是同一个控件，**归前端计划拍**（本文只保证 schema 侧有 `allow_free` / `free_hint` 两个字段可读）。

7. **`errors` 要不要进 `details` / `look_at`**。本文把它放在 `parseFrontmatter` 的返回里、`look_at` 只用来渲染 `(hidden: …)` 那行。若评审希望作家能**看到**所有解析错误（如坏 `roll_dice`），需要 `look_at` 把它也格式化出来 —— 那是 03 的渲染决定，**本文只保证数据在**。

8. **`multi` 多选的具体形态**（§7.3 抛 `unsupported`）。赛后若要实现：`choose` 的 `choice` 参数要接受数组、事件 `detail` 要加 `choices: string[]`（**这是 00 §5.2 的冻结形状变更**，要走评审）。本文按 doc-09 的"MVP 只做单选卡"处理。

9. **`doc-05 §3.1` 的示例要不要同步**。它的注释说 `expect` "必须带引号"，但示例世界 `evening.md` 也是引号的 —— 一致。唯一要改的是**补上"为什么"**（§11 冲突 5）。若评审同意，本文可以被引为那条注释的来源。

10. **手写解析器的正则（`FM_BLOCK`）没被换掉**。它容 `\r?\n` 与可选闭合换行，实测 49 文件零问题。但 `^---` 要求 frontmatter 从第 0 字节开始 —— **BOM（`\uFEFF`）会让整个 frontmatter 丢失**。现在没有 BOM 文件（实测），但代码编辑器有概率引入。本文**不改**（改了就动了一批文件的边界行为）；登记为待办：若将来出现 BOM 导致的"卡片类型全丢"，修法是 `rawContent.replace(/^\uFEFF/, '')`。

---

## 13. 结构对照（`00 §7` 的 12 节 → 本文）

| `00 §7` | 本文 |
|---|---|
| 1 一句话与定位 | §1 |
| 2 签名与参数 | §2（含 §2.2 全量 schema） |
| 3 行为契约（逐步） | §3 |
| 4 文件与副作用 | §4 |
| 5 落账 | §5 |
| 6 WS / 前端 | §6 |
| 7 错误与边界 | §7 |
| 8 代码落点 | §8 |
| 9 与现存实现的差异 | §9（含解析器改造前后对比 §9.2、迁移影响 §9.3） |
| 10 验收与测试 | §10 |
| 11 发现的冲突 | §11 |
| 12 仍然未知 | §12 |

**验收判据（任务书四项）逐条落点**：① 互动字段通用化 → §2.2 + §9.2 + §9.3；② `choice` 完整字段 → §2.2 `ChoiceSchema` / §3.2–§3.6；③ `status` → §3.4；④ `roll_dice` 形状对齐 07 → §2.2 `RollDiceSchema`（五字段不动，已与 07 双向确认）；⑤ `choose({path, choice})` → §2.1 + §3；⑥ 渲染协议字段 → §6.3；⑦ 落账与失败不落 → §5；⑧ 第三个入口 → §2.5。