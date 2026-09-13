# 组件外观模型与 schema

> 状态：实现已落地（2026-09-13）。本文定义的 schema、诊断和 registry 已分别落在 `packages/shared/src/schemas/appearance.ts` 与 `packages/shared/src/components/appearance-registry.ts`；实现继续服从 [`00-共同上下文.md`](./00-共同上下文.md) 的冻结形状、优先级、默认无背景、尺寸与降级边界。

## 一句话定位

`appearance` 是组件 frontmatter 中唯一的、严格验证的“怎么画”命名空间：用有限的英文小写 kebab-case ID 选择字体、表面、色调、装饰和动效，经过 kind 能力矩阵归一化后才可交给渲染层。

## 设计结论

1. `AppearanceInputSchema` 只校验结构、字段名和 ID 词法；具体 ID 是否被某个 kind/题材包授权，由独立 `APPEARANCE_REGISTRY` 校验，不能用现有 `passthrough()` 冒充严格验证。
2. 不扩展 `ComponentDef`：它继续描述语义、互动和 `CARD_FORMS` 联动；外观能力单独按 kind 登记，并在模块加载时与组件 schema/registry 做 key-set 对账。
3. 唯一优先级为：基础默认 → kind 默认 →（仅当实体写出 `appearance` 时）上下文 preset → 实例显式 `appearance.preset` → 实例显式维度。缺失 namespace 的旧实体不应用 context preset；显式 `{}` 才选择加入当前上下文。
4. Chalk 与 letter 共用五轴类型、校验器、preset 和诊断；不共用允许值。Chalk 默认 `surface: none`（真透明/bare ink），letter 默认 `surface: paper`、可选 `parchment`。
5. v1 不在 frontmatter 增加版本字段；代码常量 `APPEARANCE_SCHEMA_VERSION = 1`，解析结果带 `schemaVersion: 1`。未来破坏性变更须同时回写 `00`、本文件并迁移；`appearance.version` 在 v1 是未知键。
6. 顶层 `material`、`bgStyle`、`audio.theme`、旧 `ChalkStyle` 和 `CARD_FORMS[*].chrome` 均不改名、不互作别名；均不作为 `appearance.surface` 的输入。

## 2. 签名与数据形状

### 2.1 frontmatter 形状

冻结输入形状如下；它是 letter 的合法示例，不代表所有 kind 都接受这组值：


```yaml
appearance:
  preset: parchment-letter
  font: serif
  surface: parchment
  accent: rust
  ornament: seal
  motion: calm
```

缺少 `appearance` 等价于旧文件，且不应用 context preset；显式空 object `{}` 合法并表示加入当前 context preset。存在时必须是 object，不能是数组、字符串、数字或 `null`，也不能把新字段散落到顶层。

### 2.2 严格 schema（NEW）

精确落点：`packages/shared/src/schemas/appearance.ts`（NEW）。以下是实现者必须提供的签名：
```ts
export const APPEARANCE_SCHEMA_VERSION = 1 as const;
export const APPEARANCE_DIMENSIONS = ['font', 'surface', 'accent', 'ornament', 'motion'] as const;
export type AppearanceDimension = (typeof APPEARANCE_DIMENSIONS)[number];
export type AppearanceId = string & { readonly __appearanceId: unique symbol };
export const APPEARANCE_AXIS_VALUES: Readonly<Record<AppearanceDimension, readonly AppearanceId[]>> = {
  font: ['serif', 'hand', 'mono'],
  surface: ['none', 'paper', 'parchment', 'iron', 'scroll', 'panel', 'board'],
  accent: ['ink', 'rust', 'blue', 'sage'],
  ornament: ['none', 'underline', 'seal', 'ribbon', 'etched', 'route-marks', 'rules', 'ticks', 'grid'],
  motion: ['still', 'calm'],
};

export const AppearanceIdSchema: z.ZodType<AppearanceId> = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .transform((value) => value as AppearanceId);

export const AppearanceInputSchema = z.object({
  preset: AppearanceIdSchema.optional(),
  font: AppearanceIdSchema.optional(),
  surface: AppearanceIdSchema.optional(),
  accent: AppearanceIdSchema.optional(),
  ornament: AppearanceIdSchema.optional(),
  motion: AppearanceIdSchema.optional(),
}).strict();
export type AppearanceInput = z.infer<typeof AppearanceInputSchema>;

export interface AppearanceAxes {
  font: AppearanceId;
  surface: AppearanceId;
  accent: AppearanceId;
  ornament: AppearanceId;
  motion: AppearanceId;
}
```

`strict()` 必须保留：`className`、`css`、`backgroundUrl`、`version` 等未知键进入诊断且不生效；写入校验还必须接收 `kind` 并检查 registry 存在性/适配性。正则只保证词法，读取 resolver 宽容回退，写入 validator 严格拒绝。输入不允许 token 名、CSS class、CSS、HTML、脚本、数据 URI 或路径；`surface: none` 是明确的受控无表面值，不是“省略”的别名。

### 2.3 验证和 resolver 输出（NEW）

验证类型仍落在 `packages/shared/src/schemas/appearance.ts`；唯一 resolver 由 `02-主题包与渲染解析.md` 实现，不能在其他模块重算：

```ts
export type AppearanceDiagnosticCode =
  | 'invalid-shape' | 'unknown-key' | 'invalid-id'
  | 'unknown-preset' | 'unsupported-preset' | 'unknown-material'
  | 'unknown-dimension-value' | 'unsupported-dimension'
  | 'conflicting-combination' | 'legacy-collision' | 'registry-invalid'
  | 'token-missing' | 'component-view-missing';

export interface AppearanceDiagnostic {
  code: AppearanceDiagnosticCode;
  path: string;                         // e.g. appearance.font
  input?: AppearanceId | string;        // 仅短 ID，不回显原始 YAML/CSS
  fallback: AppearanceId | 'ignored' | 'kind-default';
  message: string;                       // 代码文案可被上层翻译
}
export type AppearanceValueSource =
  | 'base' | 'kind' | 'context-preset' | 'explicit-preset' | 'explicit' | 'legacy' | 'fallback';

export interface AppearanceResolution {
  schemaVersion: typeof APPEARANCE_SCHEMA_VERSION;
  kind: string;
  values: AppearanceAxes;                // 五轴均已验证
  warnings: AppearanceDiagnostic[];
  details: {
    preset: { requested?: AppearanceId; applied?: AppearanceId; source: 'none' | 'context' | 'explicit' };
    dimensions: Record<AppearanceDimension, { value: AppearanceId; source: AppearanceValueSource }>;
    fallbackCount: number;
  };
}
export type AppearanceValidation =
  | { ok: true; value: AppearanceInput; issues: [] }
  | { ok: false; value: null; issues: AppearanceDiagnostic[] };
export function validateAppearanceInput(raw: unknown, kind: string): AppearanceValidation; // NEW；词法 + registry/kind 适配
```

`warnings`/`details` 是可观察契约，服务端探针可以断言其非空、`code`、`path`、最终 `values` 和 `fallbackCount`；不能只 `console.warn`。诊断不得回显完整 YAML、CSS 或 URL。

### 2.4 registry 形状（NEW）

精确落点：`packages/shared/src/components/appearance-registry.ts`（NEW）。它是代码/受信任题材包的 allowlist，不从 world frontmatter 动态注册：

```ts
export interface AppearanceKindCapabilities {
  kind: string;
  defaults: AppearanceAxes;
  allowed: Readonly<Record<AppearanceDimension, readonly AppearanceId[]>>;
  conflicts: readonly AppearanceConflict[];
}
export interface AppearanceTokenSet {
  fontFamily: string;
  ink: string;
  muted: string;
  surface: string;
  border: string;
  shadow: string;
  radius: string;
  ornament: string;
  motionDuration: string;
  contrastOn: string;
}

export interface AppearanceConflict {
  dimensions: readonly [
    { dimension: AppearanceDimension; value: AppearanceId },
    { dimension: AppearanceDimension; value: AppearanceId },
  ];
  fallback: 'kind-default';
  reason: string;
}
export interface AppearancePresetDefinition {
  id: AppearanceId;
  values: Partial<AppearanceAxes>;
  kinds: readonly string[] | 'all';
}
export interface AppearanceRegistry {
  schemaVersion: typeof APPEARANCE_SCHEMA_VERSION;
  kinds: Readonly<Record<string, AppearanceKindCapabilities>>;
  presets: Readonly<Record<string, AppearancePresetDefinition>>;
  tokens: Readonly<Record<AppearanceDimension, Readonly<Record<string, AppearanceTokenSet>>>>;
  materialPresets: Readonly<Record<string, AppearanceId>>;
}
export const APPEARANCE_REGISTRY: AppearanceRegistry; // NEW
export function appearanceCapabilitiesOf(kind: string): AppearanceKindCapabilities | null; // NEW
export function appearancePresetOf(id: string): AppearancePresetDefinition | null; // NEW
export function componentAppearanceDocOf(kind: string): {
  kind: string;
  defaults: AppearanceAxes;
  allowed: Readonly<Record<AppearanceDimension, readonly AppearanceId[]>>;
  presets: readonly AppearanceId[];
} | null; // NEW

```
`materialPresets` 的 v1 最小登记数据（material ID 属于世界/层 schema，不与 appearance ID 共用命名空间）：

| material | context preset |
|---|---|
| `parchment` | `parchment-letter` |
| `warm` | `parchment-letter` |
| `kraft` | `letter-kraft` |
| `stub` | `chalk-signal` |

`letter-kraft` 是 v1 官方 preset：`letter`、`font:hand`、`surface:paper`、`accent:sage`、`ornament:ribbon`、`motion:calm`。context preset 只在实体显式存在 `appearance` 时参与；不适用 kind 时按 02 规则诊断并继续回退。

`componentAppearanceDocOf` 是作者/`get_component` 的只读选项查询面，不扩展 `ComponentDoc` 的语义字段，也不能注册新值。加载时 fail loud 检查：五轴齐全且 default 在 allowlist；preset key 与 ID 一致且值合法；`preset.kinds` 必须是 `kinds` 的子集（或 `'all'`）；conflict 引用合法轴值；`materialPresets` 的目标 preset 存在且 material ID 只来自已知 world material；token 元数据完整且对比度目标可消费；kind 覆盖 `chalk` 与当前 `COMPONENT_KINDS`（`packages/shared/src/schemas/components.ts:12-40`）；独立 registry 与 `COMPONENT_REGISTRY` 做差集诊断。缺声明的新增 kind 不得悄悄采用全局默认。

## 3. 维度类型与能力

### 3.1 基础默认

| 维度 | 基础默认 | 边界 |
|---|---|---|
| `font` | `serif` | 字体档位，不是任意 `font-family` |
| `surface` | `none` | 无表面/透明的起点 |
| `accent` | `ink` | 受控色调，不是 CSS color |
| `ornament` | `none` | 不增加正文结构 |
| `motion` | `calm` | 受控动效档位，不带时长/关键帧 |
基础默认不是所有 kind 的最终默认；每个 kind 必须声明安全 defaults。缺失 `appearance` 时只使用 base/kind defaults；显式 `{}` 才允许继续应用 context preset。

### 3.2 Chalk 与 letter

| kind | `font` | `surface` | `accent` | `ornament` | `motion` | 默认 |
|---|---|---|---|---|---|---|
| `chalk` | `serif`, `hand`, `mono` | `none`, `paper` | `ink`, `rust`, `blue`, `sage` | `none`, `underline` | `still`, `calm` | `serif/none/ink/none/calm` |
| `letter` | `serif`, `hand` | `paper`, `parchment` | `ink`, `rust`, `blue`, `sage` | `none`, `seal`, `ribbon` | `still`, `calm` | `serif/paper/ink/none/calm` |

两者共用内核，不共用值：Chalk `none` 是硬性默认，不能被通用卡片壳补成纸面；letter 不允许 `none`，以保留信件载体。`font: hand` 是新受控 ID，不是直接读取旧顶层字段。`seal` ornament 只表示装饰，不改 letter 的 `seal` 语义字段；`underline` 不把 Chalk 正文拆成互动实体。

### 3.3 其他 kind 能力摘要

每个 registry entry 必须写完整五轴 allowlist；下表是 v1 的最小默认/家族约束：

| kind / 组 | 默认 surface | font（至少） | ornament（至少） |
|---|---|---|---|
| `note` | `paper` | `serif`, `hand` | `none`, `underline` |
| `lock`, `container`, `trap`, `mechanism`, `anchor` | `iron` | `serif`, `mono` | `none`, `etched` |
| `map` | `scroll` | `serif`, `hand` | `none`, `route-marks` |
| `book`, `ledger`, `photo`, `cipher`, `diary`, `thread` | `paper` | `serif`, `mono` | `none`, `rules` |
| `clock`, `tape` | `panel` | `mono`, `serif` | `none`, `ticks` |
| `instrument`, `board` | `board` | `mono`, `serif` | `none`, `grid` |
| `portrait` | `none` | `serif` | `none` |

### 3.4 v1 官方 preset

preset 也只能来自这一张 registry；以下 ID 是本批示例和验收 fixture 的最小官方集合：

| ID | kind | values |
|---|---|---|
| `chalk-signal` | `chalk` | `font:hand`, `surface:none`, `accent:rust`, `ornament:underline`, `motion:calm` |
| `parchment-letter` | `letter` | `font:serif`, `surface:parchment`, `accent:rust`, `ornament:seal`, `motion:calm` |
| `iron-archive` | 物件组 | `font:mono`, `surface:iron`, `accent:ink`, `ornament:etched`, `motion:still` |

漏登 preset、preset 值超出 kind allowlist 或 preset ID 重复时，registry 检查必须 fail loud；前端不能自行补一份表。

例如 `lock` 默认 `surface: iron` 只表达受控绘制 token；`CARD_FORMS.lock` 仍决定 `176×176` 占位（`packages/shared/src/schemas/forms.ts:76-80`），appearance 不能改尺寸。

## 4. 组合矩阵与优先级

### 4.1 v1 可达矩阵

先单轴 allowlist，后组合矩阵；未列出的 surface/ornament 对非法：

| kind | surface | 可搭配 ornament |
|---|---|---|
| `chalk` | `none` | `none`, `underline` |
| `chalk` | `paper` | `none`, `underline` |
| `letter` | `paper` | `none`, `seal`, `ribbon` |
| `letter` | `parchment` | `none`, `seal`, `ribbon` |
| `note` | `paper` | `none`, `underline` |
| `map` | `scroll` | `none`, `route-marks` |
| 物件组 | `iron` | `none`, `etched` |
| 时间组（`clock`/`tape`） | `panel` | `none`, `ticks` |
| 工艺组（`instrument`/`board`） | `board` | `none`, `grid` |
| 文本组 | `paper` | `none`, `rules` |
| `portrait` | `none` | `none` |

`accent` 只允许 kind allowlist；v1 `motion` 只允许 `still`/`calm`，不开放会改变布局或长期占用资源的 `lively`。任何外观组合都不得改变互动字段、路径、事件或 `CARD_FORMS`。

### 4.2 逐步行为契约（每步的漏项后果）

1. 对 raw `appearance` 调 `validateAppearanceInput(raw, kind)`；写入调用必须拒绝 registry 未登记/不适用的 ID，读取 resolver 对同一结果宽容回退。
   - **漏了会怎样：** 数组、未知键或 `font: Serif` 可能被后续误当 token/class，形成注入或跨模块不一致。
2. 以基础默认填满五轴，再以 kind defaults 覆盖并记录 source。
   - **漏了会怎样：** 未声明轴会因页面/题材或调用者不同而漂移，旧文件不再有稳定默认。
3. 应用上下文 preset，再应用实例显式 preset；**只有 `appearance` namespace 存在时**才进入 context 阶段。每个 preset 先检查存在、适用 kind、轴值和组合。
   - **漏了会怎样：** 世界/层主题会绕过 kind 能力，或在旧实体未声明外观时悄悄改皮；非法 preset 还可能让不同客户端各自解释。
4. 按 `font → surface → accent → ornament → motion` 应用显式维度；不在 allowlist 的轴回 kind default并诊断。
   - **漏了会怎样：** 拼写错误会“看似选中”但实际使用未知样式，作者无法解释结果。
5. 运行组合矩阵；冲突中的后轴重置为 kind default，并添加 `conflicting-combination`。
   - **漏了会怎样：** `chalk + surface:none + ornament:seal` 可能在不同 renderer 中互相覆盖或遮挡正文。
6. 输出完整五轴 `values`、`warnings`、`details`；`fallbackCount` 等于实际回退次数。
   - **漏了会怎样：** 前端只能猜测是否接受输入，测试无法抓住静默降级。

非法 preset：不存在 → `unknown-preset` 并忽略；kind 不适用 → `unsupported-preset` 并忽略；显式维度仍可在 kind default 上生效。可信 registry 自身非法 → `registry-invalid` 并启动/构建失败。

### 4.3 冲突示例

```yaml
# Chalk 不能使用 letter seal；最终 ornament = none，并有 unsupported-dimension
appearance:
  surface: none
  ornament: seal
```

```yaml
# letter 不允许 iron；最终 surface = paper，并有 unsupported-dimension
appearance:
  surface: iron
  ornament: seal
```

```yaml
# map 的 seal 不在 allowlist；最终 ornament = none，并有 unsupported-dimension
appearance:
  ornament: seal
```

`appearance.surface: ../assets/paper.css` 先命中 `invalid-id`，最终回 kind default；绝不进入 `/api/asset` 或 CSS 解析。

## 5. 旧 frontmatter / 新 appearance 解析矩阵

现状：通用实体 schema 当前保留未知字段（`packages/shared/src/schemas/frontmatter.ts:117-142`）；`parseFrontmatter` 原样保留 raw 且将 schema 问题写入 `errors`（`:180-235`）；旧 `chalkStyleOf` 读取 `font`/`color`/`tone`/`big`/`size`/`card`/`chrome`（`packages/shared/src/schemas/forms.ts:157-193`）。所以 passthrough 不是 appearance strict validator。
`EntityFrontmatterSchema` 与各 component schema 可以引用同一个可选 `AppearanceInputSchema`；兼容读取必须仍经过 `validateAppearanceInput(raw, kind)`。当 `appearance` 缺失时，legacy adapter 仅把 `font`/`color`/`tone`/`card`/`chrome` 映射到对应外观轴并标记 source=`legacy`；`big`/`size`、`collapsed`、`aged` 永远保留为 Chalk 的 legacy 字段，不进入 appearance。当 `appearance` 存在时，显式 preset/轴优先，legacy 外观轴仅产生 `legacy-collision` 诊断并被忽略。这样不让旧 passthrough 成为验收入口，也为 05 的清理提供确定口径。
| 输入 | 旧解析现状 | 新 validator/resolver | 边界 |
|---|---|---|---|
| `type: chalk`，无样式字段 | 正常；旧 Chalk 是 bare serif/透明 | Chalk defaults，`surface=none`，warnings 空 | 旧视觉不变 |
| `type: chalk` + 顶层 `font: hand` | passthrough 保留；`chalkStyleOf` 为 hand | appearance 缺失，01 不把顶层 font 当新输入 | 05 负责兼容适配 |
| `type: chalk` + `appearance: {font: hand}` | raw/entity 可保留 | `font=hand`，其余 Chalk defaults | 新内容唯一写法 |
| 顶层 `font: hand` + `appearance: {font: serif}` | 两边均被旧 parser 保留 | `appearance` 显式轴优先，legacy axis 被忽略并报告 `legacy-collision`（fallback=`ignored`） | 不静默合并 |
| letter + `appearance: {font: hand, surface: parchment, ornament: seal}` | `LetterKindSchema` 当前仅收语义并 passthrough（`packages/shared/src/schemas/components.ts:93-99`） | 三轴合法，得到 letter values | ornament 不改语义 `seal` |
| letter + 顶层 `material: warm` / `bgStyle: paper` | 旧 parser 保留相邻字段 | appearance 缺失则 letter defaults；两字段不参与 | 不迁移为实例外观 |
| letter + `appearance: {font: Serif}` | YAML 可解析但 ID 不合法 | `invalid-id`，font 回 `serif`，warnings 非空 | 不自动小写 |
| `appearance: {css: '...'}` 或 `surface: '../x.css'` | 旧 passthrough 可能原样保留 | 读取：`unknown-key`/`invalid-id`、保留 raw 但不生效；写入：严格拒绝、不发 `entity_edited` | 不进前端、不发资源请求 |
| README/gate/sprite 声明 appearance | parser 可保留 | 无能力 entry，报告 kind unsupported，使用既有视觉默认 | 非 docked 不冒充 component |
| `world.json.audio.theme` | world schema 独立字段（`packages/shared/src/schemas/world.ts:51-54`） | 不读取、不覆盖 appearance | 音频批次负责 |


## 6. 文件与副作用

### 6.1 精确代码落点

本文的代码落点已实现；以下清单继续作为唯一归属表：

1. `packages/shared/src/schemas/appearance.ts`（NEW）：Zod schema、轴/ID、诊断类型、`validateAppearanceInput`；纯函数，不读文件或前端。
2. `packages/shared/src/components/appearance-registry.ts`（NEW）：registry、preset/kind definitions、自检及四个查询 API；不改变 `COMPONENT_REGISTRY` dispatch/handler。
3. `packages/shared/src/schemas/components.ts:65-75,83-91`：ComponentCore/兼容 note 引用可选 namespace；语义字段及 passthrough 保持。
4. `packages/shared/src/schemas/frontmatter.ts:117-142`：通用实体引用同一 namespace；YAML/互动错误处理不改。
5. `packages/shared/src/components/registry.ts:23-53`：独立 appearance registry 与 `COMPONENT_REGISTRY`/`COMPONENT_SCHEMAS` 做对账；不得复制外观字段进 `ComponentDef`。
6. `packages/shared/src/index.ts:1-7,36`：显式导出 NEW schema/registry；barrel 无 glob，漏导出会使 server/web 无法调用。
7. 02 在服务端唯一 resolver 接缝调用；04 只消费 `AppearanceResolution.values`。01 不添加 WS frame、动作函数或事件类型。

### 6.2 副作用边界

解析是纯函数，不写磁盘、不请求网络、不加载任意路径。registry 只在启动/构建时注册，世界 frontmatter 和 agent 不能修改 allowlist。实例 `appearance` 随实体 markdown 一起落盘；无独立 appearance 数据库/状态文件。可缓存解析结果，但缓存键必须含世界/实体路径、kind、输入及 registry 版本，缓存不是新真相源。任何轴都不能改变 `CARD_FORMS` 尺寸、碰撞、排座或测量。

## 7. 落账与事件

外观声明是实体文件内容；作者通过既有 write/edit 变更，沿用当前 history event 机制。解析/刷新不产生事件，不新增 `appearance_changed`、`style_update` 或第二状态通道；换肤不改变 actor、路径、事件和 `world_event` 语义。诊断只进入 `warnings/details`，供探针、开发诊断和迁移验收使用，不作为持久化事件。`look_at` 如展示摘要，须展示已验证 ID/显示名，不把 raw YAML 当唯一 UX（具体由 05 定义）。

## 8. WS 与前端边界

服务端/02 的唯一 resolver 接收 raw frontmatter、已解析 kind、世界/层上下文，输出 `AppearanceResolution`；边界前不得发未经验证值。前端/04 只消费 `values`（五轴 ID）和安全诊断摘要，不直接读原始 `appearance`，不解析 `material`/`bgStyle`/`audio.theme`，不在 React 重复 Zod 校验。ID 只能由前端受信任 token map 映射，不拼接任意 class/CSS。`surface:none` 必须最终保持 Chalk 透明/bare ink；外观不改变交互、WS 语义或 footprint。

## 9. 错误边界

| 错误 | 处理 | 可观察性 |
|---|---|---|
| YAML syntax / 非 mapping | 沿用 `parseFrontmatter.errors`，视为无可用 frontmatter | 既有 errors，不伪造主题 |
| 缺失或 `{}` | 纯默认解析 | warnings 空，source 为 base/kind |
| null/数组/字符串 | 整 namespace 不生效，使用 kind defaults | `invalid-shape`，path=`appearance` |
| unknown key | 非法键 ignored，合法轴保留；逐键诊断 | `unknown-key`，不只日志 |
| 大写/空格/斜杠/URL/空字符串 | 该轴回 kind default | `invalid-id`，精确 path |
| 未登记值 | 该轴回 kind default | `unknown-dimension-value` |
| kind 不支持值/preset | 回 kind default/忽略 preset | `unsupported-dimension`/`unsupported-preset` |
| 组合冲突 | 按固定轴顺序回冲突后轴 kind default | `conflicting-combination` + details |
| registry 不一致 | 启动/构建 fail loud | `registry-invalid` + 明确异常 |
| 浏览器不支持 motion / token 缺失 | 04 回安全 token，语义照常可读 | fallback 必须可断言；不可白屏 |

未知键的“保留合法轴”仅限严格 namespace 内的键错误；任何未经 allowlist 的值都不能进 `values`。若评审要求未知键令整个 namespace 回退，必须先修订 `00` 与本文件，不能由实现者自行选择。

## 10. 与现状差异

当前 `ComponentCoreSchema` 只收 `type/component/title/preview/body/age` 并 `passthrough()`（`packages/shared/src/schemas/components.ts:65-75`），`ComponentDef` 只有语义和交互字段（`packages/shared/src/components/types.ts:68-95`），`CARD_FORMS` 是现有占位/基础卡面源（`packages/shared/src/schemas/forms.ts:1-5,64-100`）。本设计新增严格 namespace、独立 registry、kind 能力矩阵、resolver 输出和诊断；不改变旧字段的现有兼容读法，不改变 registry dispatch、事件、交互或尺寸。

## 11. 验收测试

测试建议落点：`packages/shared/test/appearance-schema.test.mjs`（NEW）、`packages/shared/test/appearance-registry.test.mjs`（NEW），纳入根 `pnpm test` 的 shared test glob；本设计批不执行项目级验证。

- `AppearanceInputSchema.safeParse({font: 'hand', surface: 'none'})` 与空 object 成功；`font: 'Hand'`、`surface: '../x.css'`、`css: '...'`、`version: 1` 失败/诊断，未经验证值不进 `values`。
- registry 五轴 defaults 均在 allowlist；preset key 与 ID 一致；kind key 覆盖 `chalk + COMPONENT_KINDS`。
- 旧 Chalk 无 appearance 得 `surface=none`；新 Chalk `{font: hand}` 得 hand；letter `{font: hand, surface: parchment, ornament: seal}` 三轴保留且 `kind=letter`。
- 未知 preset 有 `unknown-preset`、显式 font 仍生效且 `fallbackCount > 0`；非法组合有非空 warnings 和安全 fallback。
- 解析前后 `choice/status/roll_dice/accepts` 深相等，`CARD_FORMS[kind].w/h` 深相等；material/bgStyle/audio.theme fixture 互不影响。

### 11.1 修复前必失败的非空性断言

> 对 `type: component, component: letter, appearance: {surface: parchment, ornament: seal}`，当前 `LetterKindSchema` 仅 passthrough（`packages/shared/src/schemas/components.ts:93-99`），旧实现不会产出带五轴 `values` 的 `AppearanceResolution`。测试必须断言：`expect(resolveAppearance(...).values).toEqual(expect.objectContaining({surface: 'parchment', ornament: 'seal'}))`，且 `warnings` 为数组；修复前 `values` 非空断言失败，修复后才通过。禁止将其放宽为“返回 undefined/501 即可”。

## 12. 发现的冲突与需修订上位文档

1. `docs/doc-10-组件协议与官方组件清单.md:107` 将皮肤归题材包，但 `ComponentDef` 当前无外观字段（`packages/shared/src/components/types.ts:68-95`）。本设计选择独立 registry；建议 doc-10 改为题材包提供受信任 preset/ID、kind 能力由独立 registry 声明。
2. `packages/shared/src/schemas/forms.ts:157-193` 的 `ChalkStyle` 与新 font/accent/surface 重叠。建议 doc-09/doc-10/05 说明旧字段只作兼容输入，唯一新归一化入口为 validator + resolver；不在 01 复制 style table。
3. `docs/doc-04-视觉设计风格.md:178-190,224-226` 同时描述统一墨画布/token 与材质皮肤重做。建议补充世界/层 `material`、场景 `bgStyle`、组件 `appearance.surface` 三层边界，并注明 Chalk 透明硬约束。
4. `components.ts:65-75,93-226` 与 `frontmatter.ts:117-142` 的 `passthrough()` 会让未知 appearance 字段长期存在；建议实现专门 validator/诊断门禁，不能把 passthrough 当严格验收。
5. `00-共同上下文.md:63-85` 未列 `schemaVersion`；本设计刻意不把版本放进 frontmatter。若评审要求作者声明版本，必须先回写 00 的形状、未知键和迁移规则，再改本文件。

## 13. 当前批次外的后续范围

- v1 世界/层 context 已冻结：02 通过 registry `materialPresets` 映射，layer material 优先于 world material；不再由 route 传入 context preset。
- v1 排除运行时/世界自定义题材包；未来若引入，另立扩展设计并在构建时合入唯一 registry，禁止 frontmatter 自注册。
- `componentAppearanceDocOf(kind: string)` 已决定作为 `get_component` 的可选 details 输出；它只提供可用写法/schema/ID/组合/世界语言说明，不扩展 `ComponentDef`，实例正文和 frontmatter 仍由 `read`/`look_at` 读取。
- v1 accent allowlist 固定为 `ink/rust/blue/sage`；新增色彩、gate/sprite appearance、字号/字距和数值 motion 均另立后续设计，不进入本批。
