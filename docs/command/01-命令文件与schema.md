# doc-command/01 命令文件与 schema

> 上游：`docs/command/00-共同上下文.md`（冻结契约）。冲突时以 00 为准。
> 本文只定 **`command/<id>.yaml` 长什么样、怎么被解析与校验**。
> 不拥有：`on` 字段（→ `02`）、条件表达式的**求值语义**（→ `03`）、效果的**执行**（→ `04`）。
> 本文的"现状是 X"一律带 `file:line`；本文自测得到的结论标**实测**并给复现方式；没把握的标 `[推断]`。

---

## 1. 一句话定位

**`01` 定义世界命令的声明形态与静态校验器：一份世界根下的 `command/<id>.yaml`，四个顶层 key（`name` / `desc` / `params` / `do`），strict schema——未声明的 key、未注册的效果名、未声明的参数引用一律在写入时报错，错误带行列位置，且文案足够让模型一次自修。**

它是 `02`（触发绑定）、`03`（求值执行序）、`07`（Agent 创作接口）的共同地基：三者引用到的字段名、类型、上限、错误码全部由本文冻结。

---

## 2. 完整 schema

### 2.1 文件身份：id 来自**文件名**，不来自内容

```text
<worldRoot>/command/<id>.yaml
```

| 项 | 规定 |
|---|---|
| 位置 | 世界根下的 `command/`（契约 §3.1）。MUST NOT 放在 `world/` 内任何位置 |
| 扩展名 | **恰好 `.yaml`**。`.yml` / `.md` / `.json` / `.js` 一律不接受 |
| `<id>` 来源 | **文件名**（不含扩展名） |
| `<id>` 正则 | `^[a-z0-9][a-z0-9-]{0,47}$` |
| 文件内声明 id | **MUST NOT**。YAML 顶层出现 `id:` → 硬错误 `unknown_key` |
| 编码 | UTF-8，无 BOM |
| 文件大小上限 | 32 000 字节（`MAX_COMMAND_FILE_BYTES`） |

**为什么 id 来自文件名。**

1. `AGENTS.md:62` 逐字：「稳定的世界、层、地点、人物、物品和 Chalk ID 使用 ASCII 小写 kebab-case 英文」——文件名已是全仓的稳定 id 载体（`world/london-map/04-investigation-dice.md` 的层与卡 id 就是这么来的）。
2. `apps/server/src/engine/declared-actions.ts:94（旧标 `:92`，**快照已漂移**）` 已有同级正则 `^[a-z0-9-]+$`（用于 slot id）。本模块对齐它，只多两条：**不许以 `-` 开头**（避免 `command/-foo.yaml` 与 glob/路径处理纠缠）与**长度上限 48**。
3. 文件名与内容同时能声明身份 = 第二真相源。`on.run: investigation-clue` 指向路径 `command/investigation-clue.yaml`；若文件内还能写 `id: other`，两条真相立刻可分叉。

> 正则核心集的依据：`declared-actions.ts:136`（旧标 `:128`，**快照已漂移**） 的 target 是 `^world/[a-z0-9/-]+$`，`:135` 的 character 是 `^[a-z0-9-]+$`——两处既有先例都**不含大写、不含下划线**。本模块保持同一核心集。

### 2.2 顶层：只有四个 key，strict

```yaml
name: 調査の覚え書きを発行する                    # 必填
desc: 骰子の結果に応じて覚え書きを一枚発行する     # 可选
params:                                          # 可选
  grade:
    type: enum
    values: [great, success, setback, failure]
    default: success
do:                                              # 必填，非空
  - action: give
    with:
      rewards: "{{ trigger.entry.rewards }}"
```

| key | 类型 | 必填 | 默认 | 上限 | 归属 |
|---|---|---|---|---|---|
| `name` | string | **是** | — | 80 字符 | `01` |
| `desc` | string | 否 | 无 | 200 字符 | `01` |
| `params` | map<string, ParamSpec> | 否 | `{}` | 12 项 | `01` |
| `do` | list<Step> | **是** | — | 16 步 | `01` |

**strict 的准确含义**：除上表四项以外的**任何顶层 key** → `unknown_key`，写入时拒绝。

**strict 有两条理由，缺一条都会在评审压力下被降级**（`09` 要求两条都写）：

1. **可用性侧（passthrough 陷阱）**：`dice_outcomes` 能在既有声明里"写了、没人执行、也从不报错"（**定稿快照 `9af9c9b`**：声明规模 36 / 世界包内 42 / 排除 `docs/command/` 自引用 44；**HEAD `50dd228` 已 48 / 56 / 75**——数字随世界包与代码提交漂移，**MUST 现测**，见契约 §R.25），根因是实体侧的 `EntityFrontmatterSchema` 用两个 `.passthrough()` 做 intersection（`packages/shared/src/schemas/frontmatter.ts:137-146`），`:150-166` 的注释逐字写着「NO schema filtering」。命令文件走**独立校验器**，不继承这条路。这是契约 §3.2 存在的理由，不是可调项。
2. **安全侧（上界核算必须是全函数）**：`09` 的资源上限核算函数要为 R1–R7 给出**真上界**，前提是它能**枚举所有产生成本的东西**。命令文件 strict ⇒ 未被理解的东西**不可能存在于解析成功的命令里** ⇒ 核算函数是**全函数**，上界是真上界。若命令文件是 passthrough，未知 key 会被保留、并由未来某个引擎版本赋予语义 —— 核算函数看不见它们 ⇒ 今天算出的"上界"**对未来的文件不成立**。

> **两条都要写进文档的理由**：只看第 1 条，"对 LLM 友好 / 兼容未来"这两个理由会在评审压力下把 strict 降回 `.passthrough()`。第 2 条是**降不动的**——它不是风格问题，是"上界论证成不成立"的问题。

**`name` 为什么必填、`desc` 为什么可选。** `name` 是给玩家与 Agent 看的人类可读名（对齐 GitHub Actions 的 `name:`）——命令没有正文了，`name` 是唯一的人话入口，缺了就只剩 kebab-case 的文件名。`desc` 是一句话补充，允许省略。

> **没有正文**（契约 §3.2 理由 2）。原设计的 Markdown 正文已取消：正文不受 schema 约束，会成为第二真相源（正文写"扣 2 份灯油"而 `do` 写 1 份）。说明文字由受 schema 约束的 `name` / `desc` 承载。**`name` / `desc` 也不进任何注入**（详见 §6）。

### 2.3 `params`：声明式参数，**只允许标量**

```yaml
params:
  grade:
    type: enum
    values: [great, success, setback, failure]
    default: success
  clue_path:
    type: string          # 必填（因为没有 default）
  times:
    type: number
    default: 1
  silent:
    type: boolean
    default: false
```

类型集**封闭**为四个：`string` | `number` | `boolean` | `enum`。

| ParamSpec 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `type` | `string`/`number`/`boolean`/`enum` | **是** | 四选一，其余 `invalid_param_type` |
| `values` | list<string> | 仅 `type: enum` **必填** | 2..16 项，非空 ASCII 字符串，互不重复 |
| `default` | 与 `type` 同型的**标量** | 否 | 有 `default` = 可选；无 `default` = **必填**。`enum` 的 `default` 必须是 `values` 之一 |

**没有 `required: true` 这个字段。** "必填"由"有没有 `default`"唯一决定。理由：本模块的替换模型是"每个参数 MUST 解析出一个值"，"可选且无默认值"在这个模型里**没有语义**（要么有值，要么报错）。加一个 `required` 布尔会立刻产生 `required: false` + 无 `default` 的中间态，而它只能被解释成"当成空字符串"——那正是硬门 4 要防的静默失败。

> `declared-actions.ts:12-15` 的 `MaterialSlot` 确实有 `required: boolean`。**那是 UI 槽位的语义**（玩家可以选择不放材料），与命令参数的"必须取到值"不是一回事。不沿用。

**参数名**：`^[a-zA-Z_][a-zA-Z0-9_]{0,31}$`。依据：条件语法里的 `<flatKey>` 就是扁平键（`packages/shared/src/rules/interactive.ts:70` 逐字 `<flatKey> ("==" \| "!=") <scalar>`），键名不含空格/点/等号。

**MUST NOT 使用保留根名**：`params` / `trigger` / `roll` / `choice` / `item` / `entry`。命中 = `reserved_param_name`。这些名字在 §2.5 的模板命名空间里有含义，允许覆盖等于允许参数遮蔽上下文。

**为什么 `params` 只允许标量**（主 agent 拍板 B2 的直接落地，不是我的偏好）：

- 拍板 B2 已把分解线定死：**规则住 `command/*.yaml`（一份，N 个实体共享），内容住实体自己的 frontmatter**。那 4 段日语文本、3 个奖励路径与标题正文**不是参数，是内容**——内容走 `{{ trigger.entry.* }}` / `{{ trigger.fm.* }}` 读回。
- 允许 object 参数会立刻要求一套**路径表达式子语言**（`{{ texts.great }}` 还是 `{{ texts['great'] }}`？缺键怎么办？），这是一次真实的语法面扩张，换来的却只是"把同一坨数据从一个 key 挪到另一个 key"。主 agent 的判断是对的：**那不叫迁移，叫改名。**
- 标量参数让 `{{ name }}` 的每次替换都只有一个确定结果，写入时可做全量校验（§3.4）。

**上限：12 个参数。** 依据：london-map 四档命令实测需要 8 个（`text` / `reward_path` / `reward_title` / `reward_body` / `next_label` / `next_prompt` / `back_label` / `back_target`），留 50% 余量 → 12。数量级对齐既有常量风格（`declared-actions.ts:36-40`（旧标 `:34-38`，**快照已漂移**） 的 `MAX_ACTION_PATHS = 12`、`MAX_STAGE_SLOTS = 8`）。

#### 参数值的三条硬约束（`09` R5 的前提，安全侧）

1. **单次替换上限**：任何一个 `{{ }}` 替换进来的字符串 ≤ `MAX_COMMAND_STRING`（2 000 字符）。超限 → `field_too_long`，**拒绝，MUST NOT 截断**（截断是静默数据损失，违反硬门 4）。
2. **每命令总上限**：一次替换后，该命令所有实参字符串的**总字符数** ≤ `MAX_COMMAND_STEPS` × `MAX_COMMAND_STRING`（**24 000** = 12 × 2 000）。理由：单值守法挡不住"12 条 `with.text` 每条 2 000 字符"。
3. **单次非递归替换**：被替换进来的值里若**含 `{{ }}`，MUST NOT 二次展开**。否则 `params` 会变成一条**任意深度的模板注入通道**——实体的 frontmatter 里塞一个 `{{ ... }}` 就能让命令执行期读到不该读的东西。

> 第 3 条的正确实现是**一次遍历、一次替换**：先把模板串切成"字面量段 + 引用段"，逐段求值，**求值结果一律当字面量**。不做"替换后再扫一遍"。
>
> 为什么这三条是 `09` 的 R5 前提：没有它们，`with: { text: "x".repeat(1000000) }` 是一条**合法的、静态不可量的字符炸弹**——它通过了所有形状校验。

### 2.4 `do`：效果序列

`do` 是 **list**，每项是一个**效果步**（唯一形态——**没有作者可见的循环构造**，见 §2.4.2）：

```yaml
do:
  - action: give                # 必填
    when: 'roll.passed == true' # 可选，条件表达式（语法归 03）
    with:                       # 可选，效果实参
      path: "{{ clue_path }}"
      title: "{{ trigger.fm.title }}"
```

| 字段 | 类型 | 必填 | 上限 / 约束 |
|---|---|---|---|
| `action` | string，ISO 效果名 | **是** | 必须命中 `WORLD_COMMAND_EFFECTS` 的 7 名之一（§2.4.1） |
| `when` | string | 否 | ≤ 200 字符；ASCII；MUST NOT 含嵌套 `{{ }}`（§2.5） |
| `with` | map<string, ArgNode> | 否 | 键 ≤ 16，键名 ASCII；MUST NOT 出现 `action` / `when` / `with` / `do` 这四个键 |

**步内 MUST NOT 出现 `do`** → `nested_do`。理由：表达力来自"效果 × 条件 × 参数 × 数组实参的内建展开 ×（`run`）链式"，不是缩进层数；嵌套会让静态上界论证（`09` 的资源上限）复杂化，而契约 §2.3 明确本模块是"编排"不是"编程"。

#### 2.4.1 效果名的来源（`04` 拥有，本文只定位置）

`WORLD_COMMAND_EFFECTS` 归 `04`，其定稿的 7 个名字（`04 §2.1`，`docs/command/04` 的 `WORLD_COMMAND_EFFECTS` 常量逐名相同）：

`give`(→`createEntity`) / `move`(→`moveEntity`) / `edit`(→`editEntity`) / `set_status`(→`editEntity` 的 `status.data` 窄口) / `consume`(→`editEntity` 的 `append_body` + `status`) / `enter`(→`enterLayer`) / `link`(→`linkCards`，附属，随 `give`)

> **自检（MUST 机械核验）**：本文列出的效果名集合与 `04` 的 `WORLD_COMMAND_EFFECTS` **双向相等**（不是包含关系）。测试断言：`new Set(本文清单)` 与 `new Set(WORLD_COMMAND_EFFECTS)` 逐名相同。**`run` 不在集合内**（§2.4.4）。

**本文不复制这张映射表**（复制就会漂移），只要求它作为模块级常量导出（§8.1）并在校验时被查询；未命中即 `unknown_action`。

#### 2.4.2 为什么没有 `foreach`：数组实参 + 引擎内有界展开（主 agent 二次裁定）

**作者不写循环，也不写下标。** 迭代发生在效果实现内部，对作者不可见：

```yaml
# command/investigation-clue.yaml —— 一份命令，N 个实体共享
do:
  - action: give
    with:
      rewards: "{{ trigger.entry.rewards }}"    # 整个数组，静态路径，无下标、无循环
```

```yaml
# 实体 04-investigation-dice.md 的 frontmatter 里 —— 内容留在实体
on:
  roll_resolved:
    - when: "1..12"
      run: investigation-clue
      from: dice_outcomes
```

三条好处各对应一个硬门：

| 好处 | 对应 |
|---|---|
| 存量 144/144 档零改动可译（`08` 实测：每档 `rewards` 恰好 1 项） | `[C-5]` 工作量不增 |
| `rewards` 的 schema 上限 3 保持有效，且 Agent 写 2 项时两项都生效 | 契约 §6「Agent 当场创作」 |
| **上界静态可界定**：迭代次数 = 实体数组长度 ≤ 实体 frontmatter 的 schema 上限 | `09` 的资源上限论证 |

**它不是图灵完备**：没有 `while`、没有动态上界、没有作者可见的循环构造，迭代次数由 schema 上限决定。契约 §2.3 只禁**无界**形式。

**因此本 schema 里没有 `foreach` 步、没有 `max` 字段、不存在嵌套深度问题，也没有字面量内联数组。**

#### 2.4.3 实参的值类型与两类受限数组形态

`with` 的每个值是 `ArgNode`：

| ArgNode | 允许 | 说明 |
|---|---|---|
| `string` | ✅ | 纯字面量，或含 `{{ }}` 的模板串 |
| `number` / `boolean` | ✅ | 仅字面量 |
| `map<string, ArgNode>` | ✅ | 嵌套映射，深度 ≤ 6（`edit` 写 `frontmatter` 需要） |
| 字面量内联数组（`paths: [a, b]`） | ❌ `arg_literal_array` | 字面量数组是**内容**，内容住实体 |

数组以一种**受限形态**进入实参：**整个标量就是一个模板引用，且该引用在运行期解析为数组**（`"{{ trigger.entry.rewards }}"`）。**不允许下标** `rewards[0]`，不允许循环。

**两类数组消费形态（命名冻结，`04` 采用；`01` 只留声明位，不猜）：**

| | 契约 A：**`list-args`**（数组迭代） | 契约 B：**`fold-args`**（数组折叠） |
|---|---|---|
| 语义 | N 个**独立效果**，各自有前置检查与成功/失败 | **1 个结构性写入**，整个数组变成一个对象 |
| 数量 | 迭代次数 = 输入长度（≤ schema 上限） | 恒为 1 次写入 |
| 失败 | 逐项独立；第 2 项失败不回滚第 1 项 | 整体成功或整体失败 |
| 例 | `give: "{{ trigger.entry.rewards }}"` | `options → choice.options + choice_actions` |
| 上界锚点 | 实体的 `rewards` ≤ 3 | 实体的 `options` ≤ 2 |
| `05` 的 step 回执 | **每项各占一个 `step`** | **只占一个 `step`** |

**`01` 的职责**：每个效果在 `04` 的效果表里**声明自己接受 scalar / list-args / fold-args**，并**声明自己产出几条事件**（`03` 算注入预算、`05` 算 step 粒度的输入）。`01` 在写入时校验"实参形态与该效果的声明匹配"，不匹配即 `arg_shape_mismatch`。**哪些效果接受哪种数组形态由 `04` 决定，本文不猜。**

#### 数组长度上限 MUST 进**实体侧**的 Zod schema（`09` R10 的唯一锚点）

迭代次数 = 数组长度，而数组来自**实体 frontmatter**。因此 `09` 的 R10 论证（"迭代次数由不受信一侧**无法改写**的量决定"）**唯一锚点就是实体侧 schema 的上限**：

```ts
// packages/shared/src/schemas/frontmatter.ts —— 实体侧，上限 MUST 在这里，不能只写在文档里
rewards: z.array(RewardSchema).max(3),
options: z.array(OptionSchema).max(2),
```

依据：`origin/niko:apps/server/src/engine/declared-actions.ts:410`（旧标 `:147`，**快照已漂移**） 逐字 `if (!Array.isArray(rewards) || rewards.length > 3)` ——**这是既有实现的真实上限，可直接沿用**。
`options` 的**旧上限是 12**（同一函数 `:140` 逐字 `x.options.length > 12`），**本文把它收紧到 2**，依据是 `08` 实测"144/144 档位恰好 2 项"。**这是一次主动收紧，不是照抄既有值**——`09` 若认为 12 是可接受的资源上界，本文可以改回 12（代价：`fold-args` 的折叠次数上界从 2 变 12）。

> **为什么这条必须由本文写下来**：`01` 的 strict schema 是这条论据的**守卫**——但它守的是**命令文件**这一侧；数组长度活在**实体**那一侧。若上限只写在 `04` 的文档里而没进 Zod，一个手写实体 frontmatter 就能带 500 项 `rewards`，**R10 当场失效**，`09` 的上界论证变成空话。
>
> `09` 已把它列为四条硬前提之一（失守则本模块改判"仅本地自部署"）。**归属提醒（契约 §R.16）**：实体侧 `rewards` / `options` 的 schema 上限由 **`02` 拥有并实现的 `parseOnBindings`** 校验（同一个实体对象内、纯同步、无 I/O），**`07` 在写入时调用它**；`04` 提供上限数字。**`parseOnBindings` 解析的是实体上的 `on`，不是命令文件**——本文定的是命令文件的 schema，两个 parser 不同。
>
> **注意一个真实的错位**：`rewards` 与 `options` **今天没有 Zod 定义**——`dice_outcomes` 是被 passthrough 保留的裸数据（这也正是本文 §11.3 登记的那半个缺口）。所以这条上限**不是"改一个数字"，是"新建实体侧 schema"**，工作量归 **`02`（schema 与解析）+ `07`（写入时接线）**。

#### 2.4.4 链式触发**不在 `do` 里**：用 `on` 数组

**`do[]` 只装效果。`action` MUST 是 `WORLD_COMMAND_EFFECTS` 的 7 名之一，没有第 8 个 `run`。**

要让一次触发跑两个命令，**在实体的 `on` 数组里并列声明**（`02` 拥有该字段）：

```yaml
# 实体 frontmatter —— 链式 = 同一 hook 下的多条绑定，按声明顺序执行
on:
  roll_resolved:
    - when: "1..60"
      run: award-investigation-note
    - when: "61..100"
      run: log-investigation-setback
```

**为什么 `do` 里不提供 `run`**（评审已裁定，本文跟随 `03`，撤回我此前广播的"允许，深度 1"）：

1. `on` 数组**已经能表达**同一需求，且它的顺序语义、条数上限（`WORLD_COMMAND_HOOK_ENTRIES_MAX`，`03 §575` / `02`）、幂等游标（`05` 的 `on.<hook>[entry.index]`）**都已定义**；
2. `do` 内的 `run` 换来的是一个需要**运行期深度门 + 环检测**的可变状态——为一个已有表达方式的需求引入新机制，正是契约 §8 反模式 5；
3. **静态可分析性**：跨命令关系全部收在实体的 `on` 里，`09` 的成本核算只需读一处。

**本文据此收窄**：`01` 不再定义 `do` 内的链式语义。`self_recursion` / `invalid_run_target` 两个码**保留**——`on.<hook>[].run` 仍可能指向自己或写成非字面量，那是 `02`/`07` 在**绑定侧**的校验，它们复用本文 §7.3 的码与文案。
### 2.5 模板引用：`{{ }}`，单一扁平命名空间 + **静态路径**

**语法**：`{{` + 可选空格 + 路径 + 可选空格 + `}}`。
**路径** = `segment ( '.' segment | '[' 整数 ']' )*`，`segment` = `[A-Za-z_][A-Za-z0-9_]*`。

```yaml
      rewards: "{{ trigger.entry.rewards }}"                        # 整串引用（数组）
      body: "覚え書き：{{ trigger.entry.text }}（{{ roll.result }}）"  # 行内子串引用
      title: "{{ trigger.entry.rewards[0].title }}"                 # 静态下标
```

**替换规则（两条，由"是否整串"决定）**：

| 情形 | 结果 |
|---|---|
| 标量**整串**就是 `{{ path }}` | 取引用值**本身的类型**（number / boolean / array 保持原类型） |
| `{{ path }}` 是标量**的一部分** | 一律拼成字符串（number/boolean 用规范字面量）。数组不允许出现在行内子串里 → `array_in_inline_template` |

**命名空间（保留根名，封闭）**：

| 根 | 含义 | 归属 |
|---|---|---|
| `params` | 本命令声明的参数。`{{ params.grade }}` 与简写 `{{ grade }}` 等价 | `01` |
| `trigger` | 触发实体：`trigger.path` / `trigger.name` / `trigger.fm.<key>[.<key2>]` | 语法 `01`，变量集 `02` |
| `trigger.entry` | 绑定声明 `from:` 选中的那条数组项（主 agent 裁定 A） | `02` |
| `roll` | 骰子事实：`roll.result` / `roll.passed` / `roll.crit` / `roll.fumble` / `roll.dice` / `roll.expect` / `roll.rolls` / `roll.layer` | `02`，对齐 `RollDiceDetails`（`packages/shared/src/actions/roll-dice.ts:25-50`） |
| `choice` | 选择事实 | `02` |
| `item` | `use_item_on` 的事实 | `02` |

**`{{ }}` MUST NOT 嵌套**（主 agent 裁定 A）。`{{ dice_outcomes[{{ entry }}] }}` 非法 → `malformed_template`。原因是静态分析：内层下标动态 = 上界不可静态界定，直接砸掉 `09` 的资源上限论证。正确写法是 `trigger.entry` + 静态下标。

> **`[C-6]` 的 scope（契约 §11.2 硬要求 2，MUST 照写）**：读取面的收窄与否 **只约束 `{{ trigger.fm.* }}` 插值面，不约束 `on.<hook>[].from`**。原因是把 `[C-5]`（迁移路线 ④）与 `[C-6]` 真正耦合起来的是 **`from:`**（`from: dice_outcomes` 读的 key ∉ `humanKeys`），不是 `trigger.fm`——`08 §4.1` 的最终样本一个 `trigger.fm.*` 都没有。若把 `[C-6]` 的 scope 扩到 `from`，路线 ④ 会在写入时被拒。**判定为 (a) 全开**（读触发实体任意 frontmatter 字段），本文的命名空间表因此不设白名单；但**本文只定语法与位置**，读取面是否收窄的裁定归 `09`。

**数组值的两条消费约束**（求值归 `03`，消费归 `04`）：

- **整串引用才可产出数组**。行内子串引用一个数组 → `array_in_inline_template`。理由：`"a{{ arr }}b"` 需要一套数组→字符串的序列化约定，那是不必要的语法面。
- **顺序 MUST 保留**。`fold-args` 折叠出的对象键序依赖数组顺序，而 `05` 的 `plan` 摘要依赖稳定键序。求值器 MUST NOT 重排。

#### 为什么选 `{{ }}` 而不是 `$name` / `${name}`（含实测代价）

1. **LLM 写对率**：GitHub Actions 用 `${{ }}`，Ansible/Jinja/Helm 用 `{{ }}`——训练语料密度最高的一档。本模块的核心产品主张是"Agent 当场创建命令"（契约 §6），写对率直接决定它成不成立。
2. **与既有内容不冲突**：`dice_outcomes` 的 36 份既有声明里没有模板语法，无迁移债。
3. **代价必须诚实登记（实测）**：`{{` 出现在 YAML **标量开头**时，`yaml@2.9.0` **不报错**，而是把它解析成一个 flow map：

| 源码 | `doc.errors` | `toJS()` |
|---|---|---|
| `path: {{ p }}` | `[]` | `{"path":{"{ p }":null}}` |
| `path: "{{ p }}"` | `[]` | `{"path":"{{ p }}"}` |
| `desc: a{{ p }}b` | `[]` | `{"desc":"a{{ p }}b"}` |
| `desc: 追記{{ p }}する` | `[]` | `{"desc":"追記{{ p }}する"}` |
| `desc: \|` + 缩进块 | `[]` | `{"desc":"{{ p }}\n"}` |
| `path: {{ p }}x` | `['UNEXPECTED_TOKEN']` | 仍返回 map |

（复现：`cd packages/shared && node --input-type=module -e "import {parseDocument} from 'yaml'; ..."`，用仓库自带的 `yaml@2.9.0`。`packages/shared/package.json` 的 dependencies 只有 `yaml` 与 `zod` 两项，**零新增依赖**。）

即：**"忘了加引号"不是 YAML 语法错误，是又一种"写了、不报错"的静默失败**。因此：

> **`{{` 出现在标量开头的所有位置 MUST 加引号**（双引号或单引号皆可）。**行内（前面有非 `{` 字符）与块标量（`|` / `>`）不需要引号。**

而"静默"这件事**必须由我们自己的结构性检测兜住**，不能指望 YAML 报错。检测规则见 §3.2，它是**必需机制**（错误码 `unquoted_template`），不是"下次注意"。

**`$name` / `${name}` 的对比**：实测 `path: ${grade}` 在**任何位置都合法**、零冲突。这是 `{{ }}` 唯一实打实输掉的一项。不翻案（主 agent 已两次拍板），但登记在 §12。

### 2.6 `when` 条件表达式

| 项 | 规定 |
|---|---|
| 类型 | string |
| 长度上限 | 200 字符 |
| 字符集 | ASCII `^[\x20-\x7E]*$`（含非 ASCII → `non_ascii_machine_field`） |
| 语法权威 | `packages/shared/src/commands/condition.ts` 的 `parseCondition(src, profile)`（`03` 拥有）。**本文不复制语法表**，避免两处漂移 |
| 本文拥有 | 位置（`do[i].when`）、上限、ASCII 约束、"写入时能验到哪一步"的边界 |
| 本文不拥有 | 算子集、区间语义、`status.*` 求值、`unresolved_ref`（→ `03`） |

区间语法统一采用 `parseExpect` 形式（`packages/shared/src/rules/dice.ts:196`；区间原子 `41..60` 见 `:154-160`）：`on.roll_resolved[].when: "13..60"`、`do[].when: "roll.result >= 61"`。**结构化的 `min`/`max` 双键不进新 schema**（论证见 §9.2，迁移见 `08`）。

### 2.7 人类文本 vs 机器字段（翻译污染的硬界）

`tools/localize-world-editions.mjs:38` 逐字纪律：「Human fields only. IDs, conditions, paths and shared compaction prompts stay byte-for-byte.」命令文件写死**同一条界**：

| 分类 | 字段 | 约束 |
|---|---|---|
| **人类文本** | `name`、`desc` | 允许任意 Unicode。MUST NOT 含 `{{ }}`。进翻译通路 |
| **机器字段** | `params` 的**键名**、`enum` 的 `values`、`do[].action`、`do[].when`、`do[].with` 的**键名**、`with` 内模板串的路径、`on.<hook>[].run` 的命令 id | MUST 匹配 `^[\x20-\x7E]*$`；含非 ASCII → `non_ascii_machine_field` |
| **值（看归属）** | `with` 里的**纯字面量字符串** | 若其键名属既有 `humanKeys`（`title`/`body`/`label`/`text`/`prompt`/`desc`/`content`/`hint`…，见 `tools/localize-world-editions.mjs:18`）→ 人类文本，允许非 ASCII；否则按机器字段判 |

**可机械核验的判据**：

- `name` / `desc` 之外，**任何键名**含非 ASCII → `non_ascii_machine_field`；
- **任何含 `{{` 的字符串**含非 ASCII 且**非** humanKey 位置 → `non_ascii_machine_field`；
- `with` 的**纯字面量**值在非 humanKey 位置含非 ASCII → `non_ascii_machine_field`。

> **不要对 `with` 的字面量做无差别拒绝**——36 个待迁移文件的奖励正文与追加文本**必然含日语**。无差别规则会让它们一个都翻译不了。这条边界是 `03` 提出、本文收窄后的版本。
>
> **背景事实**（主 agent 复核）：`tools/localize-world-editions.mjs:33` 的 `isText = f => /\.(md|json)$/` 不含 `.yaml`，`:114` 的 `collect()` 按它过滤。**所以 `command/*.yaml` 今天不进翻译队列**，其 `name`/`desc` 在译文版世界里会保持源语言——除非 `08` 主张改工具。这是 `[C-5]` 的补充论据；本文只把界限写死，不改工具。

### 2.8 上限表

风格对齐 `apps/server/src/engine/declared-actions.ts:36-40`（旧标 `:34-38`，**快照已漂移**）（`MAX_ACTION_PATHS` / `MAX_STAGE_SLOTS` / `MAX_SLOT_PATHS` / `MAX_REVIEW_SELECTIONS` / `MAX_SNAPSHOT_LENGTH`——**一组 `const MAX_*`，不是散落的魔法数字**）。

| 常量 | 值 | 依据 |
|---|---|---|
| `MAX_COMMAND_ID_LENGTH` | 48 | kebab-case 名可读性；与层/卡 id 同量级 |
| `MAX_COMMAND_NAME_LENGTH` | 80 | 命令名是列表项，比 `declared-actions.ts:97`（旧标 `:95`，**快照已漂移**） 的 `slot.title` 上限 200 更严 |
| `MAX_COMMAND_DESC_LENGTH` | 200 | 一句话。同一处 `:95` 的上限 |
| `MAX_COMMAND_FILE_BYTES` | 32 000 | 对齐 `declared-actions.ts:40`（旧标 `:38`，**快照已漂移**） 的 `MAX_SNAPSHOT_LENGTH = 32000` |
| `MAX_COMMAND_PARAMS` | 12 | london-map 四档命令实测需 8，留 50% 余量 |
| `MAX_COMMAND_STEPS` | **12** | **不是本文的数字**——引 `03 §6.2` 的 `WORLD_COMMAND_STEP_LIMIT = 12`（契约 §R.17/§R.13：阈值只存在一处；`03` 的 T11 断言 13 步在**写入时**被拒，用 16 会让那条断言静默失效）。存量四档 × 2 效果 = 8，仍在其下 |
| `MAX_COMMAND_EFFECTS` | = `MAX_COMMAND_STEPS` | 命令 `do[]` 的**声明**效果数，与步数同量（`01` §3.1 的 S11）。**MUST NOT 与 `03` 的 `WORLD_COMMAND_EFFECT_BUDGET = 24`（**每次触发**跨命令展开后的总效果数）混同** |
| `MAX_COMMAND_STRING` | 2 000 | `declared-actions.ts:146`（旧标 `:138`，**快照已漂移**） 的 `input.text.length <= 8000` 是整段 agent 回复；命令内单值是片段 |
| `MAX_COMMAND_ARG_DEPTH` | 6 | 实测 `edit` 写 `choice_actions` 是 4 层（`frontmatter`→`choice_actions`→`play-result`→`kind`/`prompt`），留 2 层余量 |
| `MAX_COMMAND_ARG_KEYS` | 16 | 与 `MAX_COMMAND_PARAMS` 同量级 |
| `MAX_COMMAND_REFS` | 24 | 引用数上限，防"引用爆炸" |
| `MAX_COMMAND_WHEN_LENGTH` | 200 | 一条区间/比较表达式 |
| `MAX_ENUM_VALUES` | 16 | enum 成员数 |
| `MAX_RUN_DEPTH` | 1 | `run` 链深度；见 §2.4.4 |
| `MAX_COMMAND_TOTAL_CHARS` | **24 000** | 替换后该命令所有实参字符串总长；见 §2.3 硬约束 2。**由 `MAX_COMMAND_STEPS × MAX_COMMAND_STRING` 推导**（契约 §R.17 重算），不是独立数字 |
| `MAX_ARRAY_REWARDS` | 3 | **实体侧** schema 上限；**沿用既有实现的值**（`origin/niko:declared-actions.ts:410`（旧标 `:147`，**快照已漂移**） 逐字 `rewards.length > 3`）。`09` R10 的锚点 |
| `MAX_ARRAY_OPTIONS` | 2 | **实体侧** schema 上限，取「迁移实测 144/144 档位恰好 2 项」为值。**注意 niko 的旧上限是 12**（`declared-actions.ts:403`（旧标 `:140`，**快照已漂移**） 逐字 `x.options.length > 12`）——收紧到 2 是本文的主动决定，论证见 §2.4.3 的专节 |

---

## 3. 行为契约逐步（每步写"漏了会怎样"）

### 3.1 校验步骤 S1–S12

**S1. 计算 id。** 从写入路径 `command/<id>.yaml` 推出 `<id>`：取 basename → 去 `.yaml` → 验正则。
> 漏了会怎样：`command/Investigate Clue.yaml` 被接受 → `on.run: investigate-clue` 永远找不到它，而**两边都不报错**（实体侧 `on` 是 passthrough，见 §11.3）。

**S2. 读入并做字节级检查。** UTF-8 解码；长度 ≤ 32 000 字节。
> 漏了：一个 2 MB 的命令在每次触发时被完整解析，且在 `09` 的资源上限论证里没有上界。

**S3. `parseDocument` 并先检查 `doc.errors`。** 不用 `parse`，用 `parseDocument`（对齐 `packages/shared/src/schemas/frontmatter.ts:195`），因为要那条**带行列位置**的 `errors` 数组。
> 漏了会怎样（**实测**）：`name: a` / `name: b` 两条重复 key，`doc.errors` 报 `DUPLICATE_KEY`（`linePos: [{line:2,col:1},{line:2,col:2}]`），但 **`toJS()` 依然成功返回 `{name:"b"}`**——静默"后者胜"。顶层写两次 `do:` 会**静默丢掉第一个**。这正是 `parseFrontmatter` 用 `parseDocument` 而不是 `parse` 的原因（`frontmatter.ts:191-193` 注释逐字：「we want the `errors` list (failure must be visible)」）。

**S4. 校根是 mapping。** `doc.toJS()` 的结果必须是普通对象。
> 漏了：根是数组的 YAML 会让后续每一处取字段都变成 `undefined`，报出一串无关错误。

**S5. 结构性检测未加引号的 `{{`**（`unquoted_template`）。规则见 §3.2。
> 漏了会怎样（**实测**）：`path: {{ p }}` **完全静默**地变成 `{"path":{"{ p }":null}}`，一路通过 Zod——因为它不是未知 key，是个值——最终在执行期变成一次空路径扣除。

**S6. Zod strict 校验（`safeParse`，不是 `parse`）。** 顶层 `strictObject`；`do[]` 每项一个 `strictObject`；`with` 用 `z.record`。
> 漏了：`rewardz:` 这种拼错的顶层 key 被静默保留——**就是 `dice_outcomes` 的现状**。

**S7. 效果名命中注册表 + 实参形态匹配。** 每个 `action` 必须在 `WORLD_COMMAND_EFFECTS` 里；实参形态（scalar/list-args/fold-args）必须与该效果的声明一致。
> 漏了：`action: rewardz` 静默变成一次 no-op。这是本模块**最危险**的单点——44 个文件级别的历史重演。

**S8. 引用解析。** 收集全部 `{{ }}`，逐条查根名、参数声明、上下文成员名。
> 漏了：`{{ gradee }}` 静默替换成空串 → 一次扣除 0 份灯油却报告成功。

**S9. `when` 校验。** 参数替换成占位值 → `parseCondition`。
> 漏了：`when: "roll.result >"` 这类残句的执行期行为取决于 `03` 的 fail-closed 实现，而作者在写入时看不到任何提示。

**S10. `run` 链校验。** 目标 id 合法性 + 自递归 + `with` 键名（尽力跨文件）。
> 漏了：`run: <自己>` 造成无限递归。

**S11. 静态展开。** 计算效果数量上界（每步 1；`list-args` 项按被引用数组的 schema 上限计）。上界 ≤ 32。
> 漏了：一份 16 步 × list-args 的命令宣称"32 个效果"而实际可能是 48，静态上界论证失效。

**S11b. 数组实参的长度上界必须可查。** 对每个 `list-args` / `fold-args` 实参，MUST 能指出它引用的数组在**实体侧 schema** 里的上限（`MAX_ARRAY_REWARDS = 3` / `MAX_ARRAY_OPTIONS = 2`）。若引用的是 `trigger.fm.*` 里的**任意 key**（`04` 的某效果把整个数组交给引擎），则上限 MUST 由 `07` 的实体侧 schema 提供；查不到上限 = `unknown_array_bound`。
> 漏了会怎样：`09` 的 R10（迭代次数由不受信一侧无法改写的量决定）**失去唯一锚点**。命令文件侧完全合法，但实体的 frontmatter 可以带 500 项 `rewards` → 一次触发产生 500 次写入。**这是本文与 `09` 的接缝**，见 §2.4.3 的专节。

**S12. 产出 `WorldCommandSpec` + warnings。** 全部错误一次性返回。

**顺序的重要性**：S3 必须在 S6 之前（否则 Zod 面对的是 `toJS()` 的静默产物）；S5 必须在 S6 之前（否则 `unquoted_template` 会被报成一条看不懂的 `invalid_type`）。

### 3.2 `unquoted_template` 的精确检测规则（**实测验证过**）

不用正则扫原文（会误报行内合法用法），而是走 CST：

> 遍历 CST。**任何 Pair 的 `key` 不是 Scalar 节点**（即 key 本身是 Map/Seq）→ 这里本该是标量却被解析成了 flow map → 报 `unquoted_template`，位置取该 key 节点的 `range[0]` 经 `LineCounter.linePos`。

实测覆盖（`yaml@2.9.0`，仓库自带）：

| 输入 | 命中 | 位置 |
|---|---|---|
| `path: {{ p }}` | ✅ | `L5C14` |
| `when: {{ p }}` | ✅ | `L4C12` |
| `- {{ p }}`（裸列表项） | ✅ | `L3C6` |
| `paths: [ {{ a }}, "b" ]` | ✅ | `L5C17` |
| `path: {{}}` | ✅ | `L5C14` |
| `path: "{{ p }}"` | ❌ 正确写法 | — |
| `desc: a{{ g }}b`（行内） | ❌ 合法 | — |
| `desc: \|` + 缩进块 | ❌ 合法 | — |
| `path: { p }`（真的 flow map，非模板） | ❌ 不误报 | — |
| `"{{ p }}": 1`（带引号的地图键） | ❌ 合法 | — |

**关键点**：`path: { p }`（单花括号的真 flow map）与 `path: {{ p }}`（未加引号的模板）在 CST 上**形态不同**——前者 key 是 Scalar `p`，后者 key 是 Map。所以这条规则**不误报真 flow map**，同时**不依赖** YAML 报错。

### 3.3 位置 API（实测，写实现时照抄）

```ts
import { parseDocument, LineCounter } from 'yaml';

const lc = new LineCounter();
const doc = parseDocument(raw, { logLevel: 'silent', lineCounter: lc });
// node.range = [start, valueEnd, nodeEnd]
const pos = node?.range ? lc.linePos(node.range[0]) : undefined;  // → { line, col }
```

**三个实测坑**：

1. `Document` **没有** `rangeToLinePos` 方法（`typeof doc.rangeToLinePos === 'undefined'`）。位置只能从 `LineCounter` 拿。
2. `doc.options.lineCounter` 是内部字段，能取到，但**不要依赖它**——显式传入 `LineCounter` 并保留自己的引用。
3. `YAMLError` 自带 `linePos` 数组（`DUPLICATE_KEY` → `[{line:4,col:1},{line:4,col:2}]`），**错误直接用 `e.linePos[0]`**，不需要再查 CST。

`logLevel: 'silent'` 是必须的：`parseFrontmatter` 已为同一原因这么做（`frontmatter.ts:195`）——扩展的 stdio 是 RPC 通道，yaml 的 stderr 输出会污染它。

### 3.4 写入时能验 / 只有运行时能验（**这是一张诚实表，不是一个承诺**）

`parseWorldCommand` 是**纯静态**的（`07` 硬需求：同步、无 fs/db/网络）。它只能验到左列的东西。

| 写入时**能**验 | 写入时**验不了**（归谁） |
|---|---|
| YAML 语法、重复 key、根是 mapping | 引用的实体文件是否真实存在（`03` 执行期） |
| 顶层 key 封闭（strict）、`name`/`desc` 长度 | `with` 里的路径参数是否指向真实文件（`04` 执行期） |
| 效果名命中 `WORLD_COMMAND_EFFECTS` | 被 `run` 的命令文件是否存在（`07` 尽力 / `03` 必须） |
| 实参形态（scalar/list/fold）与效果声明匹配 | 数组实参**运行期**的真实长度（只知 schema 上限） |
| `{{ }}` 里 `params` 名是否已声明（**解析期硬错误**） | `status.*` 的键是否存在（`03` 的 `unresolved_ref`——命令共享、实体各异） |
| `{{ }}` 里 `roll.*` / `trigger.*` 成员名是否在 `02` 的冻结表里 | 任何运行期值域（如库存是否真的够） |
| `when` 的**语法**、`when` 内非 ASCII | `when` 的**求值结果** |
| 未加引号的 `{{`（结构性检测，§3.2） | 跨文件 `run` 环（执行期深度门兜底） |
| 自递归 `run: <自己>` | 数组实参解析出来到底是不是数组（归 `03` 求值器） |
| 标量参数替换后的 `when` 语法复验 | — |

**参数化 `when` 的写入时复验**：`do[].when` 允许含 `{{ param }}`。步骤：把每个引用按**声明的类型**替换成规范化占位值（`string`→`"x"`、`number`→`0`、`boolean`→`true`、`enum`→`values[0]`），再过 `parseCondition`。因为类型已声明，这一替换**覆盖所有可能的取值形态**，语法合法性因此是**完全判定**的（不是近似）。未声明的引用在此步即 `unknown_param_ref`。

**这张表的用途**：`07` 的 `block.reason` 只能说"写入时验过的部分通过"；`03`/`04` 执行期 MUST 保留自己的失败通道。**任何文档不得声称"写入时已全量校验"。**

### 3.5 漏了某一步会怎样（汇总）

见 §3.1 每步的"漏了会怎样"。三处最贵的：

1. **S5 漏** → 一次静默的空路径扣除（实测：YAML 不报错）。
2. **S7 漏** → 效果名拼错静默 no-op = `dice_outcomes` 的历史重演。
3. **S3 漏** → 重复 key 静默后者胜（实测：`toJS()` 成功）。

### 3.6 校验器选型：Zod + 手写的混合（不是二选一）

**选 Zod 管形状。** 三个依据：

1. **本模块落在 `packages/shared`，那正是 Zod 的地盘。** `packages/shared/src/schemas/` 全部是 Zod（`frontmatter.ts`、`events.ts`、`world.ts`、`components.ts`…），`packages/shared/package.json` 的 dependencies 只有 `yaml` 与 `zod` 两项——**零新增依赖**。`declared-actions.ts:72-153`（旧标 `:70-145`，**快照已漂移**） 的手写白名单写在 `apps/server/src/engine/` 里，那里的惯例不适用于 `packages/shared`，**它不是本文该抄的先例**。
2. **`.strict()` 就是"unknown key = reject"的现成实现**（实测）：`z.strictObject({...}).safeParse({a:'x', b:1})` → `[{code:'unrecognized_keys', keys:['b'], path:[], message:"Unrecognized key(s) in object: 'b'"}]`。契约 §3.2 理由 1 要的正是这个，**不需要手写**。嵌套同样生效：`do[0]` 里多一个 key → `path: ['do', 0]`。
3. **`safeParse` 天然给错误数组**，每条带 `path`——正是 §7.1 要的形状（`07` 硬需求：错误数组而不是 throw-first）。

**代价必须如实写下来（这不是免费的）**：Zod 的默认文案对 LLM 不友好。实测 `z.string()` 收到 number → `"Expected string, received number"`；缺字段 → `"Required"`。这正是 `07` 要避免的。所以：

> **本文的每一条错误都必须由 `{ message: ... }` 或 `superRefine` 显式提供**，再与 Zod 的 `path`、CST 的 `line`/`column` 一起组装成 `WorldCommandDiagnostic`。**逐字段配文案的工作量是真实的**，不当作免费。

**手写白名单的合理用武之地只剩三处**，本文照用：

- **S3/S4/S5 之前的手工检查**（YAML `errors`、根是否 mapping、结构性 `{{`）——Zod 看不到 CST；
- **S7 的注册表查询**（跨模块常量）与 **S8 的引用解析**（跨字段引用）——它们是"跨字段约束"，`superRefine` 写出来比显式代码难读；
- **S9 的占位替换**——需要先改字符串再解析，不是纯形状问题。

**混合而不是二选一**：Zod 管**形状**，手写管**跨字段与跨文件**。这与 `frontmatter.ts` 的做法一致——它用 Zod 校验形状（`:219` 的 `EntityFrontmatterSchema.safeParse`），用 `buildInteractiveFields` 手写跨字段逻辑（`:217`）。

---

## 4. 文件与副作用

**本文描述的解析器本身没有任何副作用**：`parseWorldCommand` 不写文件、不读文件、不落事件、不发帧、不读时钟、不调 rng。这是它与 `07` 的写入钩子共享的前提。

| 动作 | 写哪些文件 | 改哪些 key | 归属 |
|---|---|---|---|
| 解析命令 | **无** | 无 | `01`（本文） |
| 创建命令 | `command/<id>.yaml` | 整份文件 | `07` |
| 编辑命令 | `command/<id>.yaml` | 整份文件 | `07` |
| 删除命令 | 删除 `command/<id>.yaml` | — | `07` |

**命令文件本身不进任何层**：`command/` 不在 `world/` 下，`deriveLayers` 只保留 `world/**`（`packages/shared/src/store/layers.ts:61-63`），`resolveLayer` 只认 `world/**`（`packages/shared/src/store/local-store.ts:951-965`（旧标 `:859-873`，**快照已漂移**）；非层早退在 `:953-956`（旧标 `:861-864`，**快照已漂移**））。因此 `resolveLayer('command/x.yaml')` 返回 `null`——这条直接影响 `[C-2]`（命令文件创建是否落 `entity_created`；**`[C-2]` 已判 A：不落账**，归 `07`）。

**命令文件随世界分发**：`tools/localize-world-editions.mjs:19` 的 `forbidden` 正则已排除 `.airpworld` / `.pi` / `node_modules` / `.env*`，`command/` 不在其中，会被打包复制。契约 §6.3 的口径成立。

---

## 5. 落账（事件类型、detail、actor、turn）

**本文的解析路径不落任何事件。** 命令文件的**创建 / 编辑 / 删除**是否落账是 `[C-2]`（`07` 提案、评审门拍板），本文**不预先定案**。

命令**执行**产生的效果事件，其 `actor` / `detail` / `turn` 全归契约 §5 与 `04`：

- `actor` = 触发者（`player` / `writer` / `character`），**不是 `engine`**（契约 §5.1）；
- `detail.command = '<id>'`（主 agent 裁定 1：**没有 `detail.by`**）。裁定理由：`detail.by` 已被 `layer_initialized` 占用且是**闭枚举** `z.enum(['writer','player','engine'])`（`packages/shared/src/schemas/events.ts:99`），dev 模式 `appendEvent` 对 detail 跑 `safeParse`（`packages/shared/src/store/local-store.ts:760-771`（旧标 `:668-679`，**快照已漂移**））→ 写 `'command'` 会炸。一个 `detail.command` 携带的信息更多且零碰撞；
- `turn` 复用触发者的 turn（契约 §5.3）；
- **不新增事件类型**（契约 §5.2，十五个封闭类型见 `packages/shared/src/schemas/events.ts:9-25`）。

**本文对落账的唯一贡献**：`WorldCommandSpec.id` 就是 `detail.command` 的取值，且 MUST 等于文件名（§3.1 的 S1）。

> **`detail.by` 是这个批次的第二个"闭枚举 + 校验"坑**（第一个是实体侧 passthrough）。两者同源：既有 schema 在保护自己的同时，也在惩罚"顺手新增一个语义相近的键"。命令文件的 strict schema 与实体侧 `on` 的关系见 §11.3。

---

## 6. WS / 前端消费面（兼：`name` / `desc` 的作用与它们**不进**什么）

| 问题 | 答案 |
|---|---|
| 正文写什么、给谁看？ | **没有正文**（契约 §3.2 理由 2）。`desc` 取代它 |
| `desc` 长度上限？ | 200 字符（§2.8） |
| 它们进任何注入吗？ | **不进。** 见下 |

**`name` / `desc` 不进作家注入、不进玩家 UI、不进 WS 帧。** 三条理由：

1. **会自动漂移的第二真相源。** 主 agent 裁定 §3.2 理由 2 的原文就是这条：正文可以写"扣 2 份灯油"而 `do` 写 1 份。`desc` 是同一类风险，只是它受了 schema 约束（长度、无模板），所以**危害被限制在"作者被误导"**——不足以成为拒绝字段的理由（作者就在看 `do`），但**足以成为"不许它流向玩家"的理由**。
2. **无界上下文。** 命令数量随世界增长；自动注入 = 每一轮注入里塞进 N 条与当前场景无关的命令说明。契约 §1.2 的分工原则是"确定性的后果由代码执行，不确定性的意义由 Agent 叙述"——命令说明是**代码的说明**，不是叙事。
3. **硬门 8（先公开后执行）的落点在别处。** 命令造成的代价与回报 MUST 在玩家决定之前可见——但那份公开文本住在**触发实体自己的正文**里（`templates/whitechapel-jp/world/london-map/04-investigation-dice.md:99-105` 就是它：四档概率与后果写在卡正文）。**命令文件不是公开面**，它是规则面。

**它们流向哪里**（三个真实消费者）：

| 消费者 | 形态 | 归属 |
|---|---|---|
| 写入时的错误/警告文案 | `command/<id>.yaml` 的名字出现在 `block.reason` 里 | `07` |
| Agent 想知道"这个命令做什么" | 直接 `read` / `look_at` 那个 YAML 文件 | `07` |
| 命令清单（若 `06` 要做） | 列表项的人类可读名 | `06` |

> **`name` 为什么必填**：它是上面三个消费者唯一的人话入口。`desc` 可选。
>
> **`name` / `desc` MUST NOT 含 `{{ }}`**（`name_has_template`）。它们是人类文本，不是模板；含 `{{` 会立刻引入 §2.5 的引号歧义，而这两个字段**恰好不该有任何运行期行为**。

### 6.1 WS / 前端消费面

**本文无独立消费面。** `command/*.yaml` 不渲染、不进画布、不进层、不发 WS 帧——它不是 entity（§4）。

三处**间接**关联，均**不归本文**：

| 关联 | 说明 | 归属 |
|---|---|---|
| **失败可见** | 命令**写入期**校验失败玩家看不到（那是 `07` 的 `block.reason`）；**执行期**失败才进 `command_error`（实体 frontmatter，契约 §3.3.2） | `05` + `06` |
| **错误码是 `command_error` 的取值来源之一** | 本文 §7.3 右列就是"玩家侧文案"的初稿，`06` 可直接采用或改写 | `06` |
| **`details.commands` 回执** | 触发动作的 `details` 里每个效果的 `ok` / `error` 来自执行期；**写入期**的 `parseWorldCommand` 错误**不进** `details` | `04` + `05` |

> **一条边界要说清**：本文的 `errors[].code` 是**写入期**的封闭码集；执行期的错误码集**不是本文的**（`04` 的效果错误来自 `ActionErrorCode`，`packages/shared/src/actions/errors.ts:3-22`（旧标 `:3-21`，**快照已漂移**） 的 19 个）。§7.3 右列的玩家侧文案只用于"一条已通过写入校验的命令在执行期失败"这一情形——例如命令引用了一个**当时不存在但写入时无法验证**的文件（§3.4 的右列）。
>
> **为什么这条边界值得写下来**：把两个码集混起来会让 `06` 的文案表出现"永远不可能到达的条目"，也会让 `05` 的幂等键设计误以为写入期校验足以保证执行期安全。**它不足以保证**（§3.4 是本文对这个断言的正式否认）。

---

## 7. 错误边界

### 7.1 结果类型（`07` 硬需求：错误**数组** + 封闭 code 联合）

```ts
/** NEW. Closed union: 46 members, each with exactly one row in §7.3. */
export type WorldCommandErrorCode =
  // A. 文件与 YAML
  | 'invalid_command_id' | 'file_too_large' | 'yaml_syntax' | 'yaml_duplicate_key' | 'root_not_mapping'
  // B. 未加引号的模板
  | 'unquoted_template'
  // C. 顶层字段
  | 'unknown_key' | 'missing_key' | 'name_empty' | 'name_has_template'
  // D. params
  | 'params_not_mapping' | 'too_many_params' | 'invalid_param_name' | 'reserved_param_name'
  | 'invalid_param_type' | 'invalid_param_default' | 'enum_empty' | 'enum_too_many' | 'enum_duplicate'
  // E. do 的形状
  | 'do_not_list' | 'do_empty' | 'too_many_steps' | 'step_not_mapping'
  | 'step_missing_action' | 'unknown_action' | 'nested_do' | 'too_many_effects'
  // F. 实参
  | 'with_not_mapping' | 'unknown_arg' | 'missing_arg' | 'arg_not_string'
  | 'arg_literal_array' | 'arg_shape_mismatch' | 'arg_too_deep' | 'arg_reserved_key'
  // G. 模板引用
  | 'malformed_template' | 'unknown_param_ref' | 'unknown_context_ref' | 'array_in_inline_template'
  // H. when
  | 'invalid_when' | 'non_ascii_machine_field'
  // I. run
  | 'invalid_run_target' | 'self_recursion'
  // J. 共享上限与安全上界
  | 'field_too_long' | 'too_many_refs' | 'unknown_array_bound';

export type WorldCommandWarningCode = 'unused_param';

/** NEW. One diagnostic. `line`/`column` are 1-based, present whenever the CST has a position. */
export interface WorldCommandDiagnostic {
  code: WorldCommandErrorCode | WorldCommandWarningCode;
  /** Model-facing English, ONE sentence: what is wrong + what the correct form is. */
  message: string;
  /** Dotted path into the file, e.g. `do[2].with.rewards`. */
  path: string;
  line?: number;
  column?: number;
}

export type WorldCommandParseResult =
  | { ok: true; command: WorldCommandSpec; warnings: WorldCommandDiagnostic[] }
  | { ok: false; errors: WorldCommandDiagnostic[]; warnings: WorldCommandDiagnostic[] };
```

**为什么 46 个而不是"一个 `invalid` 码"**：每条 `code` 对应一种**不同的修复动作**（补字段 / 改名字 / 加引号 / 减数量 / 标注上限）。`07` 把整份数组拼进 `block.reason` 让模型**一轮修完**；粗粒度的码会让模型只能猜。这是 `07` 硬需求"多错并报"的代价面，如实计。

### 7.2 文案的三条硬规则

1. **MUST 带 `line` / `column`**（主 agent 硬要求）。来源见 §3.3；`YAMLError` 用 `e.linePos[0]`，CST 节点用 `lc.linePos(node.range[0])`。
2. **MUST 说清"期望什么 + 一个合法例子"**，不是 `Invalid input`。
3. **MUST 英文、单句、无栈信息。** 玩家侧文案（`06`）是**另一套**，见 §7.3 右列。

### 7.3 逐错误文案表

格式：**code** — 模型侧文案（英文，`{...}` 为占位） — 玩家侧文案（仅**执行期**可达的码需要；`—` 表示玩家永远看不到，因为写入时就被挡住）。

#### A. 文件与 YAML

| code | 模型侧文案 | 玩家侧 |
|---|---|---|
| `invalid_command_id` | `The filename "{name}" is not a valid command id. Command ids are ASCII kebab-case, 1-48 chars, e.g. "command/award-clue.yaml".` | — |
| `file_too_large` | `command/{id}.yaml is {n} bytes; the limit is 32000. Split it into separate commands and declare them as separate entries under the entity's on.<hook> array.` | — |
| `yaml_syntax` | `line {l}, column {c}: YAML parse error - {detail}. Fix this line first; nothing below it could be checked.` | 这个世界命令写错了，暂时无法执行。 |
| `yaml_duplicate_key` | `line {l}, column {c}: duplicate key "{key}". YAML silently keeps only the LAST one and drops the rest - remove all but one.` | 同上 |
| `root_not_mapping` | `command/{id}.yaml must be a mapping of top-level keys (name, desc, params, do), but its root is a {type}.` | 同上 |

#### B. 未加引号的模板

| code | 模型侧文案 | 玩家侧 |
|---|---|---|
| `unquoted_template` | `line {l}, column {c}: unquoted "{{{{". A YAML value that STARTS with "{{{{" is read as a flow map, not text - quote it: "{{{{ {ref} }}}}". Inline use (a{{{{ x }}}}b) and block scalars (|) need no quotes.` | 同上 |

#### C. 顶层字段

| code | 模型侧文案 | 玩家侧 |
|---|---|---|
| `unknown_key` | `line {l}, column {c}: unknown field "{key}". Allowed top-level keys: name, desc, params, do. Did you mean "{near}"?` | 同上 |
| `missing_key` | `command/{id}.yaml is missing "{key}". A command needs "name" (a human-readable name) and a non-empty "do".` | 同上 |
| `name_empty` | `"name" must not be empty. Give the command a human-readable name, e.g. "Award the investigation note".` | — |
| `name_has_template` | `"name" must be plain text; it is shown to the author, never evaluated. Move "{{{{ ... }}}}" into the step args.` | — |

#### D. `params`

| code | 模型侧文案 | 玩家侧 |
|---|---|---|
| `params_not_mapping` | `line {l}: "params" must be a mapping of parameter name to its declaration, e.g.` + `params:` / `  grade:` / `    type: enum` / `    values: [success, failure]` | — |
| `too_many_params` | `declares {n} parameters; the limit is 12. Content that varies per entity belongs in the entity's own frontmatter - read it with "{{{{ trigger.fm.* }}}}".` | — |
| `invalid_param_name` | `parameter name "{name}" is invalid. Use letters, digits and underscore, starting with a letter, max 32 chars.` | — |
| `reserved_param_name` | `parameter "{name}" collides with a built-in namespace. Reserved: params, trigger, roll, choice, item, entry.` | — |
| `invalid_param_type` | `parameter "{name}" has type "{type}"; allowed types are string, number, boolean, enum.` | — |
| `invalid_param_default` | `the default for "{name}" must be a {type} - got {got}. An enum default must be one of its own "values".` | — |
| `enum_empty` | `parameter "{name}" is type enum but has no "values". List at least 2 allowed values.` | — |
| `enum_too_many` | `parameter "{name}" has {n} enum values; the limit is 16.` | — |
| `enum_duplicate` | `parameter "{name}" repeats the enum value "{value}".` | — |

#### E. `do` 的形状

| code | 模型侧文案 | 玩家侧 |
|---|---|---|
| `do_not_list` | `line {l}: "do" must be a list of steps. Each step starts with "- ".` | 同上 |
| `do_empty` | `"do" must contain at least one step.` | 同上 |
| `too_many_steps` | `has {n} steps; the limit is 16.` | — |
| `step_not_mapping` | `line {l}: do[{i}] must be a mapping starting with "action", e.g.` + `- action: give` | — |
| `step_missing_action` | `line {l}: do[{i}] has no "action". Allowed effects: {effects}. Add one, e.g.` + `- action: give` | 同上 |
| `unknown_action` | `line {l}, column {c}: unknown effect "{action}". Allowed effects: {effects}. Did you mean "{near}"? Effects are verbs (give, take, edit, enter), never action-method names (createEntity, moveEntity).` | 这个世界命令用了引擎不认识的效果，暂时无法执行。 |
| `nested_do` | `line {l}: do[{i}] has "do" inside a step. Steps are flat - put the inner steps at the top level, or hand the whole array to an effect that iterates it.` | — |
| `too_many_effects` | `expands to {n} effects; the limit is 32.` | — |

#### F. 实参

| code | 模型侧文案 | 玩家侧 |
|---|---|---|
| `with_not_mapping` | `line {l}: do[{i}].with must be a mapping, e.g.` + `with:` / `  rewards: "{{{{ trigger.entry.rewards }}}}"` | — |
| `unknown_arg` | `line {l}: "{effect}" does not take the argument "{key}". It takes: {args}.` | 同上 |
| `missing_arg` | `line {l}: "{effect}" requires the argument "{key}".` | 同上 |
| `arg_not_string` | `line {l}: do[{i}].with.{key} must be a string. Quote a template: rewards: "{{{{ p }}}}"` | — |
| `arg_literal_array` | `line {l}: do[{i}].with.{key} is a literal array. Content lives in the entity, not the command - pass it as "{{{{ trigger.entry.{key} }}}}".` | — |
| `arg_shape_mismatch` | `line {l}: "{effect}" expects a {expected} for "{key}", but "{{{{ {ref} }}}}" resolves to an array. Use a scalar, or pass the array whole as "{{{{ {ref} }}}}".` | 同上 |
| `arg_too_deep` | `line {l}: do[{i}].with.{key} nests {n} levels; the limit is 6.` | — |
| `arg_reserved_key` | `line {l}: do[{i}].with must not contain "{key}"; action / when / with / do are reserved at the step level.` | — |

#### G. 模板引用

| code | 模型侧文案 | 玩家侧 |
|---|---|---|
| `malformed_template` | `line {l}, column {c}: bad template "{raw}". Use "{{{{ name }}}}" or "{{{{ trigger.fm.title }}}}". Templates do not nest - write "{{{{ trigger.entry.rewards }}}}" instead of "{{{{ dice_outcomes[{{{{ i }}}}] }}}}".` | 同上 |
| `unknown_param_ref` | `line {l}, column {c}: "{{{{ {ref} }}}}" is not declared. Declared parameters: {names}. Declare it under "params", or read the entity's own field with "{{{{ trigger.fm.{ref} }}}}".` | 同上 |
| `unknown_context_ref` | `line {l}, column {c}: "{{{{ {ref} }}}}" is not a known context value. Known roots: params, trigger, roll, choice, item.` | 同上 |
| `array_in_inline_template` | `line {l}, column {c}: "{{{{ {ref} }}}}" is an array and cannot be embedded in a larger string. Pass it as the whole value:` + `rewards: "{{{{ {ref} }}}}"` | 同上 |

#### H. `when`

| code | 模型侧文案 | 玩家侧 |
|---|---|---|
| `invalid_when` | `line {l}, column {c}: do[{i}].when is not evaluable - {detail}. Expected a range or comparison, e.g. "13..60", "roll.result >= 61", "status.lid == open".` | 同上 |
| `non_ascii_machine_field` | `line {l}, column {c}: "{field}" is a machine field and must be ASCII. Only "name" and "desc" may contain non-ASCII text.` | — |

#### I. `run`

| code | 模型侧文案 | 玩家侧 |
|---|---|---|
| `invalid_run_target` | `line {l}: "run" needs "command" as a literal kebab-case id, e.g.` + `command: award-clue` + `It must not contain {{{{ }}}}.` | 同上 |
| `self_recursion` | `line {l}: do[{i}] runs "{id}" - this command itself. That never terminates.` | — |

#### J. 共享上限

| code | 模型侧文案 | 玩家侧 |
|---|---|---|
| `field_too_long` | `line {l}: {field} is {n} characters; the limit is {max}.` | — |
| `too_many_refs` | `has {n} template references; the limit is 24.` | — |
| `unknown_array_bound` | `line {l}: "{{{{ {ref} }}}}" resolves to an array whose length has no declared upper bound, so this command has no static cost bound. Iterate a field with a schema limit (dice_outcomes.rewards, choice.options).` | 这个世界命令无法确定规模，暂时不执行。 |

#### K. 警告（**不阻断**，但 MUST 出现在 `block.reason` 里）

| code | 模型侧文案 |
|---|---|
| `unused_param` | `parameter "{name}" is declared but never referenced. Not an error - but an unreferenced parameter is usually a typo.` |

**`field_too_long` 的 `{field}` 取值**：`"name"` / `"desc"` / `do[{i}].when` / `do[{i}].with.{key}`。上限分别是 80 / 200 / 200 / 2000。合并成一条码的理由：**修复动作完全相同**（缩短），只有字段名与上限不同；而"缩短"这个动作本身不需要 4 个不同的码来区分。

**`near`（拼写建议）**：对顶层 key 与效果名，取**编辑距离 ≤ 2** 的最近候选（候选集就是该分类的合法名单）。无候选时**整句 `Did you mean …?` 省略**，不留空壳。

**`unused_param` 为什么是警告而不是错误**：声明了但没用的参数**不改变执行结果**，只让读者困惑。升成错误会与 `07` 的"允许 Agent 先写好命令再逐步接线"冲突。**但它必须可见**——静默是硬门 4 反对的。

---

## 8. 代码落点

全部落在 `packages/shared/src/commands/`（契约 §4.1 冻结，不是 `apps/server/src/engine/`）。

| 文件 | 内容 | 归属 |
|---|---|---|
| `packages/shared/src/commands/world-command.ts` | **NEW**：本文全部类型 + `parseWorldCommand` + `canonicalCommandStepText` + `commandIdOfPath` | `01` |
| `packages/shared/src/commands/effects.ts` | **NEW**：`WORLD_COMMAND_EFFECTS`、效果名 → `ACTION_METHODS` 映射、每个效果的实参 schema、**数组消费形态声明**（scalar/list-args/fold-args）、**产出事件条数声明** | `04` |
| `packages/shared/src/commands/condition.ts` | **NEW**：`parseCondition(src, profile)` / `parseCommandWhen(expr)` | `03` |
| `packages/shared/src/index.ts` | 加 3 行 `export * from './commands/*.js';` | `01` |

> `packages/shared/src/index.ts:65-67`（旧标 `:64-66`，**快照已漂移**） 逐字：「TS `export *` has no glob, so every new module MUST be added here by hand — a missing line is a SILENT unreachable module」。**漏了这 3 行，命令模块在扩展侧（经 `shared/dist/index.js` 导入）就不可达，而且不报错。**

### 8.1 `01` 新增的符号（完整签名）

```ts
/* ── 上限常量（风格对齐 declared-actions.ts:36-40（旧标 `:34-38`，**快照已漂移**）） ─────────────────────── */
export const MAX_COMMAND_ID_LENGTH = 48;
export const MAX_COMMAND_NAME_LENGTH = 80;
export const MAX_COMMAND_DESC_LENGTH = 200;
export const MAX_COMMAND_FILE_BYTES = 32000;
export const MAX_COMMAND_PARAMS = 12;
// 12 = 03 §6.2 的 WORLD_COMMAND_STEP_LIMIT（契约 §R.17：阈值只存在一处）。
export const MAX_COMMAND_STEPS = 12;
export const MAX_COMMAND_EFFECTS = MAX_COMMAND_STEPS;
export const MAX_COMMAND_STRING = 2000;
export const MAX_COMMAND_ARG_DEPTH = 6;
export const MAX_COMMAND_ARG_KEYS = 16;
export const MAX_COMMAND_REFS = 24;
export const MAX_COMMAND_WHEN_LENGTH = 200;
export const MAX_ENUM_VALUES = 16;
export const MAX_RUN_DEPTH = 1;
/** Post-substitution total across every arg of one command (§2.3 hard rule 2). */
export const MAX_COMMAND_TOTAL_CHARS = MAX_COMMAND_STEPS * MAX_COMMAND_STRING;
/**
 * ENTITY-SIDE schema bounds, NOT command-file limits. They are the anchor of
 * `09`'s R10 argument (iteration count is decided by a quantity the untrusted
 * side cannot rewrite). They MUST live in the entity's Zod schema, e.g.
 * `rewards: z.array(RewardSchema).max(MAX_ARRAY_REWARDS)`.
 */
export const MAX_ARRAY_REWARDS = 3;
export const MAX_ARRAY_OPTIONS = 2;

export const COMMAND_ID_RE: RegExp;   // /^[a-z0-9][a-z0-9-]{0,47}$/
export const PARAM_NAME_RE: RegExp;   // /^[a-zA-Z_][a-zA-Z0-9_]{0,31}$/
export const ARG_KEY_RE: RegExp;      // /^[\x20-\x7E]+$/
/** Reserved roots. `params` MUST NOT collide with these (§2.3). */
export const RESERVED_ROOTS: readonly string[];  // ['params','trigger','roll','choice','item','entry']
/** Matches one `{{ path }}`. Path = ident ('.' ident | '[' digits ']')*. */
export const TEMPLATE_RE: RegExp;

/* ── 声明形态 ──────────────────────────────────────────────────────────── */
export type WorldCommandParamType = 'string' | 'number' | 'boolean' | 'enum';

export interface WorldCommandParamSpec {
  type: WorldCommandParamType;
  /** `enum` only. 2..16 ASCII, unique. */
  values?: readonly string[];
  /** Absent ⇒ the parameter is REQUIRED (§2.3). */
  default?: string | number | boolean;
}

/** A literal, a template string, or a nested map. Depth ≤ MAX_COMMAND_ARG_DEPTH. */
export type WorldCommandArgNode =
  | string
  | number
  | boolean
  | { readonly [key: string]: WorldCommandArgNode };

export interface WorldCommandStep {
  /** An ISO effect name from WORLD_COMMAND_EFFECTS (`04`). */
  action: string;
  /** Condition expression; syntax owned by `03`, position owned here (§2.6). */
  when?: string;
  /**
   * `NEW` — `when` 编译后的 AST（`03` 的 `parseCommandWhen`），由本文的校验在写入时挂上，
   * **可选**（`when` 缺省时它缺省）。`03` 的执行器读它，从而不必在运行期重新解析。
   * MUST NOT 参与 `canonicalCommandStepText`——它是运行期派生物，不是声明形态；
   * 进摘要会让 `05` 的 `plan` 把求值器版本卷进去（违反 `plan` 的 provenance 定义）。
   */
  whenAst?: ConditionAst;
  args: Readonly<Record<string, WorldCommandArgNode>>;
  /** 1-based line of this step's `action:` node, for error copy (§3.3). */
  line: number;
}

> **`ConditionAst` 的引入是 type-only**：`import type { ConditionAst } from './condition.js';`（归 `03`）。`01` 是纯声明层，**MUST NOT** value-import 求值器——那会把整个 `condition.ts` 拖进任何 import 本文的模块，且违反 §9.1 的"`01` 零 I/O、纯函数"定位。

export interface WorldCommandSpec {
  /** Derived from the FILENAME, never from the content (§2.1). */
  id: string;
  /** Required, ≤ MAX_COMMAND_NAME_LENGTH, no `{{ }}`. Human text (§6). */
  name: string;
  /** Optional, ≤ MAX_COMMAND_DESC_LENGTH, no `{{ }}`. Human text (§6). */
  desc?: string;
  params: Readonly<Record<string, WorldCommandParamSpec>>;
  /** Declaration order. MUST NOT be re-sorted: index = `05`'s step cursor. */
  steps: readonly WorldCommandStep[];
}

/* ── 入口（唯一） ───────────────────────────────────────────────────────── */
/**
 * NEW. Parse and validate `command/<id>.yaml`.
 *
 * PURE and SYNCHRONOUS: no fs, no network, no clock, no rng. The caller derives
 * `id` from the file path (`command/<id>.yaml` → `<id>`); it is NEVER read from
 * the content. `raw` is the WHOLE file.
 *
 * Collects EVERY problem instead of throwing on the first (`07`): the caller
 * joins the array into one `block.reason` so the model fixes the file in a
 * single round trip.
 */
export function parseWorldCommand(id: string, raw: string): WorldCommandParseResult;

/**
 * NEW. Deterministic, pure, sync. Canonicalises the DECLARED steps WITHOUT
 * resolving any template:
 *   1. `{{ x }}` normalises to `{{x}}` (inner whitespace removed, not evaluated);
 *   2. map keys sort by code unit; LIST ORDER IS PRESERVED (order is semantic —
 *      `fold-args` key order and `05`'s `plan` digest depend on it);
 *   3. scalars serialise as JSON literals; newlines normalise to `\n`.
 *
 * `05` uses `sha256(canonicalCommandStepText(step)).slice(0, 8)` as
 * `CommandLogEntry.plan` — a PROVENANCE digest, never an idempotency key.
 */
export function canonicalCommandStepText(step: WorldCommandStep): string;

/**
 * NEW. Derive `<id>` from a world-root-relative path.
 * Returns null when the path is not `command/<id>.yaml` with a legal `<id>`.
 */
export function commandIdOfPath(path: string): string | null;
```

### 8.2 为什么 `parseWorldCommand` 必须是纯同步函数

`07` 的硬需求，两个调用点**必须共享同一次判定**：

1. `extensions/world-context.ts` 的 `tool_call` 钩子（`:50-56`）——那里**只有待写文本，没有 store 事务**；
2. 动作层执行时**二次调用**——防 `bash` 绕过写入门禁塞进非法命令（`extensions/world-context.ts` 只拦 `write`/`edit`，见契约 §6.2 的安全事实）。

因此"这个效果名存在吗"这类查询**MUST 是模块级常量**，不是运行时依赖注入。这也是 `WORLD_COMMAND_EFFECTS` 必须导出为常量的原因（§2.4.1）。

---

## 9. 与现状的差异（现状 file:line → 目标）

| # | 现状 | 位置 | 目标 |
|---|---|---|---|
| 1 | `dice_outcomes` 的 36 份既有声明**写了但引擎零实现**（`grep dice_outcomes` 于 `packages/shared/src`、`apps/server/src`、`apps/web/src`、`extensions` 全无命中） | 36 份声明（全仓 grep 44 / 世界包内 42） | 迁移为「实体 `on` + `command/*.yaml`」；路线归 `[C-5]` |
| 2 | 区间用 `min`/`max` 双键 | `templates/whitechapel-jp/world/london-map/04-investigation-dice.md:17-18,38-39,57-58,76-77` | 统一为 `"1..12"`（§9.2） |
| 3 | 分档规则硬编码两遍 | `origin/niko` `declared-actions.ts:424`（旧标 `:154`，**快照已漂移**） 与 `:179` | 规则只有一份（`command/*.yaml`），内容住实体（拍板 B2） |
| 4 | 骰型/档数/效果种类全是白名单 | `origin/niko` `declared-actions.ts:400,437`（旧标 `:137,167`，**快照已漂移**）（旧标 `:137,167`，**快照已漂移**） | 效果名注册表（`04` 的 7 名）+ 任意区间语法 |
| 5 | 效果原语硬编码在 server engine | `apps/server/src/engine/declared-actions.ts:19-25`（旧标 `:17-23`，**快照已漂移**） 的 `Recipe` | 9 个 ISO 效果名落在 `packages/shared/src/commands/effects.ts`，映射到 `ACTION_METHODS`（`packages/shared/src/actions/service.ts:81-109`（旧标 `:80-107`，**快照已漂移**）） |
| 6 | 未知 key 静默保留（passthrough） | `packages/shared/src/schemas/frontmatter.ts:137-146` | 命令文件 strict（本文）；**实体侧 `on` 仍无保护 → §11.3** |
| 7 | 骰子结果只能被 HTTP 路径触发 | `origin/niko:apps/server/src/routes/world.ts:1190`（旧标 `:950`，**快照已漂移**） vs `extensions/toolkit/roll-dice.ts:49` | 触发点在动作层（契约 §4.1），两条入口同一行为 |
| 8 | 幂等靠正文 marker | `origin/niko` `declared-actions.ts:468`（旧标 `:198`，**快照已漂移**） 的 `<!-- resolved-dice:62 -->` | 归 `05`（`command_log`）；本文的 `do` MUST NOT 承担幂等状态 |
| 9 | `detail.by` 会撞闭枚举 | `packages/shared/src/schemas/events.ts:99` 的 `z.enum(['writer','player','engine'])` | **只留 `detail.command`**（主 agent 裁定 1）；命令文件的 schema 里没有任何 `by` |
| 10 | 命令文件的所有权在 server engine | `apps/server/src/engine/declared-actions.ts:72-153`（旧标 `:70-145`，**快照已漂移**） 的 `parseRecipe` 手写白名单 | `packages/shared/src/commands/world-command.ts` 的 Zod + 手写混合（§3.6） |

### 9.1 为什么区间语法统一到 `a..b`，`min`/`max` 不进新 schema

1. **同一件事不该有两个拼法**。`packages/shared/src/rules/dice.ts:154-160` 的 `range` 原子（`41..60`）与 `dice_outcomes` 的 `min: 41` / `max: 60` 是同一语义。既有实现已带：越界检查（`:158` 拒绝 inverted range）、15 位整数精度保护（`:172` 的 `INT_DIGITS_MAX = 15`）、`&&`/`||` 组合（`:85,93`）、fail-closed 错误文案（`:95-103` 的 `EXPECT_EXAMPLES`）。双键方案要**重造**其中每一项，而造出来的东西**组合不了**——`min`/`max` 无法与 `status.*` 条件写进同一个表达式。
2. **书写成本**：`when: "13..60"` 是一个值；双键是两个键 + 一次"闭区间还是开区间"的隐式约定（现有内容用闭区间，但**没有任何地方写下来过**）。
3. **strict schema 的一致性**：`do` 的每一项由 `action` 判别。若 `when` 还能是 `{min, max}`，同一位置就有两种类型，错误文案要分叉。
4. **上行下效**：`02` 已把 `on.<hook>[].when` 定为"复用 `parseExpect` 语法"。若命令侧用双键，**同一条世界规则在两个文件里写两种形状**——那正是契约 §8 反模式 3「分档规则硬编码两遍」的同构错误。

**对 36 份存量声明的影响**：内容是 `min: 1 / max: 12` 形式，迁移时机械改写为 `"1..12"`。归 `08`。**`[C-5]` 已裁定 = 路线 ④ + 叠加 ③ 兜底**（契约 §11.2），存量按该路线处理；本文只冻结"新语法是 `a..b`"。

> **一处诚实的代价**：`parseExpect` 的 `INT` 允许负数（`dice.ts:82` 的 `-?\d+`），而 `dice_outcomes` 的 `min`/`max` 是正数。这不是缺陷——`2d10 - 3` 的结果可以是负的，`roll.result` 也就可能是负数。语义由 `03` 定，本文只选语法。

### 9.2 本文**不改**的东西

- **不动 `parseFrontmatter`**（实体侧继续 passthrough，`06` 的渲染依赖它）。
- **不动 `parseExpect`**（只在 `when` 里复用它的语法，不改它的实现）。
- **不动 `declared-actions.ts`**（`08` 负责收敛）。
- **不新增事件类型、不改 `ActionContext`**（契约 §5.2 / `docs/tools/00 §4`）。
- **不改 `tools/localize-world-editions.mjs`**（§2.7 登记了 `.yaml` 不进翻译队列这一事实，改法归 `08` 的 `[C-5]`）。

---

## 10. 验收测试

### 10.1 三个**完整且合法**的 `command/<id>.yaml`

#### 例 1 —— `command/investigation-clue.yaml`：**能表达 `04-investigation-dice.md` 的四档语义**

这是本模块的最小可判别切片（契约 §9.3），也是 `08` 迁移的逐字对照。

```yaml
# command/investigation-clue.yaml
name: 調査の覚え書きを発行する
desc: 骰子の結果に応じて、ホームズの調査の覚え書きを一枚発行する
params:
  grade:
    type: enum
    values: [great, success, setback, failure]
  note_path:
    type: string
  note_title:
    type: string
  note_body:
    type: string
  next_label:
    type: string
  back_label:
    type: string
do:
  - action: give
    with:
      path: '{{ note_path }}'
      title: '{{ note_title }}'
      body: '{{ note_body }}'
      frontmatter:
        portable: true
  - action: edit
    with:
      path: '{{ trigger.path }}'
      frontmatter:
        choice:
          options:
            - id: play-result
              label: '{{ next_label }}'
            - id: back
              label: '{{ back_label }}'
        choice_actions:
          play-result:
            kind: writer
            prompt: '{{ trigger.fm.next_prompt }}'
          back:
            kind: enter
            target: world/london-map
```

**它对应的实体侧声明**（归 `02`，此处仅为让四档语义完整可读）：

```yaml
# templates/whitechapel-jp/world/london-map/04-investigation-dice.md 的 frontmatter
on:
  roll_resolved:
    - when: "1..12"
      run: investigation-clue
      from: dice_outcomes
      with:
        grade: great
        note_path: world/london-map/investigation-great-success.md
        note_title: 核心を記した覚え書き
        note_body: 核心だけでなく、次に確かめる手順まで見えた。…
        next_label: 発見の先へ進む
        back_label: 調査へ戻る
    - when: "13..60"
      run: investigation-clue
      from: dice_outcomes
      with: { grade: success, note_path: world/london-map/investigation-success.md, … }
    - when: "61..95"
      run: investigation-clue
      from: dice_outcomes
      with: { grade: setback, note_path: world/london-map/investigation-setback.md, … }
    - when: "96..100"
      run: investigation-clue
      from: dice_outcomes
      with: { grade: failure, note_path: world/london-map/investigation-setback.md, … }
```

**四档语义的逐条对照**（`04-investigation-dice.md:17-94`）：

| 原文 | 新形态 |
|---|---|
| `min: 1 / max: 12` | `when: "1..12"` |
| `text: 核心だけでなく…` | 实体正文的追加（`edit` 的 `append_body`，形态归 `04`）+ 作为 `note_body` 传给 `give` |
| `options[].action.kind: writer` | **不是效果**：`edit` 写回 `choice_actions['play-result']`，玩家点击后走现有 `runDeclaredChoice`（主 agent 架构澄清） |
| `options[].action.kind: enter` | `edit` 写回 `choice_actions['back']`；`enter` 本身**是**效果，但在这里它由**玩家点击**触发，不是命令执行 |
| `rewards[0].path/title/body` | `give` 的 `path` / `title` / `body` |
| 四个档位共享一份规则 | **一份** `command/investigation-clue.yaml`，四档只在实参上不同（拍板 B2 / 反模式 3） |

> **为什么 `options` 走 `edit` 写回而不是效果**：主 agent 的架构澄清——「命令执行的效果」与「命令写下的下一步选项」是两回事。`kind: writer` 不需要成为效果；命令只需把 `choice_actions` 这两个 **key 的数据**写回实体，那是一次 `edit`，完全在动作层内。`origin/niko` 的 `declared-actions.ts:474-475`（旧标 `:204-205`，**快照已漂移**） 正是这么做的（`editEntity` 把 `choice` 与 `choice_actions` 一起写回 source）。**这不是我编的捷径。**
>
> **两处标记为待 `04` 定稿**：`give` 的实参名（`path`/`title`/`body`/`frontmatter` 取自 `CreateEntityInput`，`packages/shared/src/actions/create.ts:25-38`，其中 `title` 目前是 `frontmatter.title` 的简写，`04` 可能压平）；`append_body` 的子形态（Main 已拍板要加，形态归 `04`）。

#### 例 2 —— `command/spend-lamp-oil.yaml`：参数 + 条件的组合

```yaml
# command/spend-lamp-oil.yaml
name: 灯油を消費して先へ進む
desc: 灯油を一回分使い、使い切ったら空瓶として残す
params:
  target:
    type: string
  needs_roll:
    type: boolean
    default: false
do:
  - action: edit
    when: 'roll.passed == true || params.needs_roll == false'
    with:
      path: '{{ target }}'
      mode: append_body
      body: |
        灯りが一度大きく揺れた。油はもう残っていない。
      frontmatter:
        status:
          data:
            oil: empty
  - action: link
    when: 'roll.passed == true'
    with:
      from: '{{ trigger.path }}'
      to: '{{ target }}'
```

演示：必填参数（`target`，无 `default`）、有默认值的 `boolean` 参数、块标量（`|`，**不需要引号**）、`when` 里的参数引用与区间/比较混合、`append_body` 的形态（归 `04` 定稿）。

#### 例 3 —— `command/log-investigation-setback.yaml`：`when` 分支 + `link` 附属效果

```yaml
# command/log-investigation-setback.yaml
name: 失敗の記録を残す
desc: 見落としを一枚の覚え書きにして、判定元のカードに線で結ぶ
params:
  note_path:
    type: string
  note_title:
    type: string
  note_body:
    type: string
  mark_fumble:
    type: boolean
    default: false
do:
  - action: give
    with:
      path: '{{ note_path }}'
      title: '{{ note_title }}'
      body: '{{ note_body }}'
  - action: link
    with:
      from: '{{ trigger.path }}'
      to: '{{ note_path }}'
  - action: set_status
    when: 'roll.fumble == true'
    with:
      path: '{{ trigger.path }}'
      data:
        fumbled: true
```

演示：三个必填参数 + 一个带默认值的 `boolean`、`when` 只守住其中一步（另两步无条件执行）、`link` 作为**附属效果**紧跟 `give`（`04`：`link` 不落事件，随 `give` 记账）、`{{ trigger.path }}` 读触发实体。

> **本例没有 `run`**：链式跑两个命令用实体的 `on` 数组表达（§2.4.4），不是 `do` 里的第 8 个 `action`。
### 10.2 三个**非法**示例及其错误文案

#### 非例 1 —— 未加引号的模板（**实测**：YAML 不报错）

```yaml
# command/broken-unquoted.yaml
name: Broken
do:
  - action: give
    with:
      rewards: {{ trigger.entry.rewards }}
```

`parseWorldCommand('broken-unquoted', raw)` → `ok: false`：

```json
[{ "code": "unquoted_template",
   "path": "do[0].with",
   "line": 6, "column": 16,
   "message": "line 6, column 16: unquoted \"{{\". A YAML value that STARTS with \"{{\" is read as a flow map, not text - quote it: \"{{ trigger.entry.rewards }}\". Inline use (a{{ x }}b) and block scalars (|) need no quotes." }]
```

**修复前 / 修复后的可观测差异**：修复前 `doc.errors` 为空、`toJS()` 给出 `{"rewards":{"{ trigger.entry.rewards }":null}}`——**写入成功、无人报错、触发时空数组**。修复后：写入被拒，模型看到位置与正确写法。

#### 非例 2 —— 效果名拼错 + 未知顶层 key + 顶层写 id

```yaml
# command/broken-effects.yaml
id: broken-effects
name: Broken
rewardz:
  - path: world/x.md
do:
  - action: rewardz
```

`parseWorldCommand('broken-effects', raw)` → `ok: false`，**一次报全 3 条**（`07` 硬需求：多错并报，模型一轮修完）：

```json
[{ "code": "unknown_key", "path": "", "line": 1, "column": 1,
   "message": "line 1, column 1: unknown field \"id\". Allowed top-level keys: name, desc, params, do. (The command id comes from the filename: command/broken-effects.yaml.)" },
 { "code": "unknown_key", "path": "", "line": 3, "column": 1,
   "message": "line 3, column 1: unknown field \"rewardz\". Allowed top-level keys: name, desc, params, do. Did you mean \"rewards\"?" },
 { "code": "unknown_action", "path": "do[0].action", "line": 6, "column": 13,
   "message": "line 6, column 13: unknown effect \"rewardz\". Allowed effects: give, move, edit, set_status, consume, enter, link. Did you mean \"give\"? Effects are verbs (give, take, edit, enter), never action-method names (createEntity, moveEntity)." }]
```

**非空性断言**：修复前 `rewardz` 顶层 key 被 passthrough 静默保留、`action: rewardz` 静默 no-op——**这个世界命令"看起来在跑"但什么也不做**，与 `dice_outcomes` 在 36 份既有声明里的状态完全同构。修复后三条错误同时可见。

#### 非例 3 —— 嵌套模板 + 未声明参数 + 字面量数组

```yaml
# command/broken-refs.yaml
name: Broken
do:
  - action: give
    with:
      rewards: "{{ trigger.entry.rewards[{{ i }}] }}"
      paths: [world/a.md, world/b.md]
      title: "{{ greetting }}"
```

```json
[{ "code": "malformed_template", "path": "do[0].with.rewards", "line": 5, "column": 16,
   "message": "line 5, column 16: bad template \"{{ trigger.entry.rewards[{{ i }}] }}\". Use \"{{ name }}\" or \"{{ trigger.fm.title }}\". Templates do not nest - write \"{{ trigger.entry.rewards }}\" instead of \"{{ dice_outcomes[{{ i }}] }}\"." },
 { "code": "arg_literal_array", "path": "do[0].with.paths", "line": 6, "column": 14,
   "message": "line 6, column 14: do[0].with.paths is a literal array. Content lives in the entity, not the command - pass it as \"{{ trigger.entry.paths }}\"." },
 { "code": "unknown_param_ref", "path": "do[0].with.title", "line": 7, "column": 14,
   "message": "line 7, column 14: \"{{ greetting }}\" is not declared. Declared parameters: (none). Declare it under \"params\", or read the entity's own field with \"{{ trigger.fm.greetting }}\"." }]
```

**非空性断言**：修复前 `{{ greetting }}` 静默替换成空字符串 → `give` 用空标题建卡，**世界被真实改写，玩家看到一个无标题的笔记**。

### 10.3 三条**非空性**验收断言（能证明"没有这个设计就会失败"）

这三条的形态是"**修复前的可观测行为** vs **修复后的可观测行为**"，且都用本文自测的实测事实作依据。

#### 断言 1 —— 未加引号的模板**不会**被 YAML 拦住，只有本文的 S5 能拦

- **修复前**：`path: {{ p }}` 写入成功。可观测证据：`doc.errors.length === 0` 且 `toJS()` 返回 `{"path":{"{ p }":null}}`（实测）。世界命令"生效"，但 `path` 是一个 map 而不是路径。
- **修复后**：写入被拒，`errors[0].code === 'unquoted_template'` 且 `errors[0].line === 5`。
- **为什么这是非空的**：删掉 §3.2 的规则，断言立刻失败——**因为 YAML 不提供任何信号**。这不是重述"我们加了校验"，而是"这里没有任何其他东西能提供这个信号"。

#### 断言 2 —— 未注册的效果名**必须**在写入时报错

- **修复前**（现状的准确同构）：`dice_outcomes` 在 36 份既有声明里存在而引擎零命中（`grep dice_outcomes` 于 `packages/shared/src`、`apps/server/src`、`apps/web/src`、`extensions` 全部无结果）；`parseFrontmatter` 对未知 key 是 passthrough（`frontmatter.ts:137-146`）→ **写了、没人执行、从不报错**。
- **修复后**：`action: rewardz` → `unknown_action`，带候选列表与 `Did you mean "give"?`。
- **为什么这是非空的**：删掉 S7，命令文件立刻退回 `dice_outcomes` 的状态——**声明与执行之间没有任何连接检查**。

#### 断言 3 —— 声明了但未声明的参数引用**必须**是硬错误，不是空串替换

- **修复前**：`{{ greetting }}` 无任何检查，替换结果取决于实现（最宽松的实现给空串）→ `give` 建出一张空标题的卡。玩家可见、世界已被改写。
- **修复后**：`unknown_param_ref`，写入被拒；即便命令由 `bash` 绕过写入门禁塞进去，动作层执行时的二次校验（§8.2）同样拒绝。
- **为什么这是非空的**：这是硬门 4（不静默失败）在**参数**这一层的唯一落点。

### 10.4 建议的测试文件

| 文件 | 覆盖 | 归属 |
|---|---|---|
| `packages/shared/test/world-command.test.mjs` | **S1–S12 每步**的正例与反例（§3.1） | `01` |
| 同上 | **§10.2 的三个非法例**逐字比对 `code` / `line` / `column` | `01` |
| 同上 | **§10.3 的三条非空性断言** | `01` |
| 同上 | **往返性**：§10.1 三个合法例 parse → `ok: true`，且 `warnings.length === 0`（检验例子本身合法） | `01` |
| `packages/shared/test/frontmatter.test.mjs`（既有） | **不动**。本文不碰 `parseFrontmatter` | — |

> 按仓库既有惯例（`packages/shared/test/interactive.test.mjs` 用 `node --test`、无构建依赖；`packages/shared/src/rules/dice.ts:1-8` 的注释逐字说明该模块"zero dependencies on purpose"以便单测直跑），`world-command.ts` 的**核心校验逻辑 SHOULD 保持零 zod 依赖的可能性**——但这与 §3.6 的 Zod 选型冲突。
>
> **这个冲突的解法**：Zod 已经是 `packages/shared` 的直接依赖，测试环境能加载它（`packages/shared/test/` 下已有依赖 zod 的模块被测）。**`dice.ts` 的"零依赖以便单测直跑"是针对它被 web 层与扩展共享的场景**，而 `world-command.ts` **不进 web 层**（它只在扩展钩子与动作层跑）。所以本文选 Zod、不复制 `dice.ts` 的零依赖纪律——**理由是消费方不同，不是"zod 更方便"**。

---

## 11. 发现的冲突 / 需要修订的上位文档

### 11.1 与契约 §3.2 的一致性（**已由主 agent 修订，本文跟随**）

契约 §3.2 在 2026-09-14 由 `.md + frontmatter` 修订为 **独立 YAML `command/<id>.yaml`**，取消 `type: command`、取消正文、顶层 key 冻结为 `name` / `desc` / `params` / `do`。**本文完全按修订后版本写**，不登记冲突。

### 11.2 `detail.by` 与 `schemas/events.ts:99` 的闭枚举冲突（**已由主 agent 裁定 1 解决**）

- **冲突的双方**：契约 §5.1 原文要求 `detail.by = 'command'`；`packages/shared/src/schemas/events.ts:99` 把 `by` 定为 `z.enum(['writer','player','engine'])`（`layer_initialized` 使用），而 dev 模式 `appendEvent` 对 detail 跑 `safeParse`（`packages/shared/src/store/local-store.ts:760-771`（旧标 `:668-679`，**快照已漂移**））。
- **为什么矛盾**：写 `by: 'command'` 会**炸**（dev 模式），而生产模式**不会炸但会落下一个越界值**。今天不炸只因为 `recordLayerInitialized` 不在 `04` 的七个效果里——这是一个"埋着没炸的雷"。
- **建议的改法（已采纳）**：契约 §5.1 删掉 `detail.by`，只留 `detail.command`。命令文件侧没有 `by` 字段，本文不需要改。

### 11.3 实体侧 `on` 仍然**没有** strict 保护（**需要修订契约 §3.2 理由 4 的措辞**）

- **冲突的双方**：契约 §3.2 理由 1 宣称"strict schema 能拒绝未知字段——这是 passthrough 陷阱的机制性对策"；但**实体侧 `on` 住在 `.md` frontmatter 上，走的是同一个 `parseFrontmatter`**，而它对未知 key 是 passthrough（`packages/shared/src/schemas/frontmatter.ts:137-146`，`:150-166` 逐字「NO schema filtering」）。
- **为什么矛盾**：把 `dice_outcomes` 迁成 `on` 之后，**写歪的 `on`（未知 hook、`run` 拼错、`when` 语法坏）在 passthrough 下照样静默保留**。契约 §3.2 理由 4 的"机制性对策"因此**只覆盖命令文件那一半**。契约 §3.3.2 已经承认了这一点（"实体侧的 passthrough 陷阱依然存在"），但 §3.2 理由 4 的措辞没有收窄。
- **建议的改法（主 agent 已采纳并将回写）**：
  1. 把 §3.2 理由 4 的措辞收窄为 **"strict 保护仅覆盖 `command/*.yaml`"**；
  2. 在契约 §10 登记为**已登记缺口**，并明确 **`02` 拥有并实现的 `parseOnBindings`、由 `07` 在写入时调用**是**硬性依赖**（不是建议）——否则整个 C1 批次的"机制性对策"只兑现了一半。（归属以契约 §R.16 冻结口径为准。）
- **本文的立场**：`01` **不试图覆盖**这一半。命令文件的 strict 是本文的全部责任范围；实体侧由 **`02` 的 `parseOnBindings`** 补（它 MUST 同时做 `on` 的形状校验与 `from` 的跨字段校验），`07` 在写入时调用它并把错误翻译成 `block.reason`。

### 11.4 契约 §1.4「三个半拉子抽象收敛成一个」与本文的关系（**无冲突，说明边界**）

契约 §1.4 要求收敛 `Recipe` / `dice_outcomes` / `evalWhen` 三个半拉子，**不得造第四个并行机制**。本文的定位：

- `dice_outcomes` 的**区间分派** → 收敛进 `02` 的 `on` + `03` 的 `when`（语法复用 `parseExpect`，§9.1）；
- `Recipe` 的**效果表** → 收敛进 `04` 的 `WORLD_COMMAND_EFFECTS`（7 名，映射 `ACTION_METHODS`）；
- `evalWhen` 的**条件** → 归 `03` 的 `parseCondition`。

**本文只提供它们共同的声明载体**（`command/<id>.yaml` 的四个 key），不新增任何求值/执行机制。契约 §2.3 的"编排不是编程"在本文的具体体现是：**没有 `foreach`、没有算术、没有变量赋值、没有作者可见的循环**（§2.4.2）。

### 11.5 `field_too_long` 与逐字段错误码的一处设计取舍（**登记，供评审**）

本文选择把 `name` / `desc` / `when` / `with.*` 的"超长"合并为一个 `field_too_long` 码（而不是 4 个独立码）。**理由是修复动作相同**（缩短），4 个码只会让 `07` 的文案表更长。

**反向论点**：`07` 若想给玩家侧不同文案，合并会限制它。**当前判断**：这四者的玩家侧文案都是 `—`（写入时挡住），所以合并无实际损失。**若评审不同意，拆成 4 个码是纯机械改动。**

### 11.6 `arg_shape_mismatch` 的归属边界（**登记，供 `04` 确认**）

本文定义 `arg_shape_mismatch`（实参形态与效果声明不匹配），但**形态声明的内容归 `04`**。若 `04` 的最终效果表把"接受数组"改成别的表达方式，**这个码可能不需要**。本文保留它是因为：没有它，"`give` 收到一个数组但它只要标量"就**没有错误码可报**——那是一个真实的静默失败面。

**建议**：`04` 确认效果表形态声明位后，本文与 `04` 逐条对齐这个码的存在与否。

---

## 12. 仍未知 / 待拍板

### 12.1 契约 §11 的待拍板项在本文范围内的落点

| 编号 | 与本模块的关系 |
|---|---|
| `[C-5]` | **直接影响本文的示例**：36 份既有声明的 `min`/`max` → `"a..b"` 是否就地翻译、并存、还是保留为语法糖。本文只冻结"新语法"，迁移路线归 `08` / 评审门。**本文的例 1 是按"就地翻译"写的**，若选并存则例 1 仍是新语法样例、不与存量冲突 |
| `[C-2]` | 命令文件创建是否落 `entity_created`（`resolveLayer('command/…')` 返回 `null`，§4）。归 `07` |

其余 `[C-1]` / `[C-3]` / `[C-4]` 与本文无直接关系。

### 12.2 本文自己仍未定的事

1. **`{{ }}` 语法是主 agent 拍板 B2 与两次广播定下的，本文如实记录了它唯一实打实输掉的对比项**：实测 `path: ${grade}` 在 YAML 里**任何位置都合法**，而 `path: {{ p }}` 在标量开头会被静默解析成 flow map。本文**不翻案**（`{{ }}` 换来的是 LLM 写对率），但把这条登记在这里，供后续评审在"写对率 vs 静默失败面"之间重新权衡。
2. ~~**`MAX_COMMAND_EFFECTS = 32` 是推导值**~~ —— **已由契约 §R.17 关闭**：`32` 与 `16` 都被删除，`MAX_COMMAND_EFFECTS` 现在恒等于 `MAX_COMMAND_STEPS`（= `03 §6.2` 的 12），`MAX_COMMAND_TOTAL_CHARS` 由它推导（24 000）。**"单文件声明上限"是一个量，只有一处数字**；每次触发跨命令展开后的总效果数（24）是另一个量，归 `03` 的 `WORLD_COMMAND_EFFECT_BUDGET`，两者 MUST NOT 混同（§2.8）。
3. **`give` / `edit` 等的实参名尚未冻结**（例 1 的 `path` / `title` / `body` / `frontmatter` 取自 `CreateEntityInput`，`packages/shared/src/actions/create.ts:25-38`）。**归 `04`**。本文的示例在 `04` 定稿后需要一次机械核对。
4. **`append_body` 的子形态未定**（Main 已拍板要加：只追加、不删不改、幂等不靠扫正文、有长度上限）。**归 `04`**。本文例 2 用了 `mode: append_body` 作为占位形态。
5. **`name` / `desc` 的翻译支持**：本文 §2.7 登记了 `tools/localize-world-editions.mjs:33` 的 `isText` 不含 `.yaml` 这一事实，但**是否改工具归 `08` 的 `[C-5]`**。若不改，译文版世界里命令的 `name`/`desc` 保持源语言。
6. **`commandIdOfPath` 与「非 `command/` 路径」的行为**：本文定义它返回 `null`。若 `07` 需要它同时接受绝对路径或 `./` 前缀（`extensions/world-context.ts:53` 用的是 `path.relative(...)` 归一化后的相对路径），**`07` SHOULD 在调用前自行归一化**，`commandIdOfPath` 保持严格。
