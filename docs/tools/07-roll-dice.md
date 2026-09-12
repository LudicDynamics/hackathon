# doc-tools/07 `roll_dice` 与 expect 表达式

> 状态：**设计（2026-09-12）**，待评审。本文只写设计，不改代码。
> 权威层级：`00-共同上下文.md`（冻结契约）> `doc-21-事件表协议.md` > `doc-20-agent工具与互动字段协议.md` > `doc-19-多模态与游戏性交互升级.md` > 本文。
> 关联：`00-共同上下文.md` §5.2/§5.3/§6.2/§9/§10（`roll_resolved` detail、帧名、已知问题 2）；`doc-20 §2.2/§7/§12`（本文主判据）；`doc-21 §1/§3.3/§3.6/§4.3`（准入三问、detail 自足、失败不落、god 伪造）；`doc-19 §3.3`（骰子仪式）；`doc-06 §2.6`（骰子卡渲染）；`doc-05 §3.1`（骰子协议、剧情判定不写骰子）；`doc-09 §背景`（待设计 #4 骰子演出节奏）；`doc-22 §3.1`（事件段消费 `roll_resolved`）；`01-动作内核与事件落账.md` §2.2/§2.4/§2.6/§2.7/§3.1/§3.6/§7/§11（本文全部形状来自它）。
> 边界：`roll_dice` 的 **schema 形状归 06**（`RollDiceSchema` 五字段，本文一字不改）；**回写器归本文**（`patchRollDiceResult`，06 已确认它是 B1 唯一的前置 frontmatter 就地改写）；`/api/dice` 路由与 WS 帧映射**归 12**（本文给契约与形状）；组件是 `roll_dice` 的宿主归 10。

---

## 1. 一句话与定位

**`roll_dice` 不是"掷一个骰子"，而是"让引擎就某个实体的检定做一次不可伪造的随机裁决"：实体在 frontmatter 里声明 `type/desc/expect`，引擎读文件 → 真随机 → 按 `expect` 判定 → 回写 `result/passed` → 落 `roll_resolved` → 广播演出。三种入口（玩家点击 / 作家 / 角色）走的是同一个函数，一行代码都不重复。**

它在 `doc-20` 里的位置：`§2.2`「`roll_dice` 是实体声明、引擎裁决」+ `§7`「工具只接收实体路径」。本文是这两条的落地，也是 `00 §10` 问题 2（"骰子规则有两份实现"）的收编方案。

调用者三类（加上帝伪造是第四个入口），共用同一个动作函数：

| 入口 | 调用者 | actor | 进程 | 走什么 |
|---|---|---|---|---|
| A | 作家 agent | `{type:'writer'}` | agent 进程（`AIRP_AGENT_ROLE=writer`） | `extensions/toolkit/roll-dice.ts` → `rollDice` |
| A | 角色 agent | `{type:'character', id}` | agent 进程（`AIRP_AGENT_ROLE=character:<id>`） | 同上（同一个扩展文件被两个进程各加载一次） |
| C | 玩家 UI 点击骰子卡 | `{type:'player'}` | server 进程 | `POST /api/dice` → `createActionService` → `rollDice` |
| C | 上帝伪造结果（`doc-14` 待设计 #5） | `{type:'god'}` | server 进程 | `POST /api/dice { forcedResult }` → 同一个 `rollDice` |
| E | —— | —— | —— | 引擎**不**自动掷骰。落盘时绝不掷（`doc-05 §3.1` 明写） |

**为什么必须收编**：`apps/server/src/routes/world.ts:344-397` 今天自己实现了一整套——自己算骰面上限（`:357`）、自己用正则抠第一个数字当阈值（`:362`）、自己用 `startsWith` 判运算符（`:365-369`）、自己 `stringifyChalk` 回写（`:379`）。而作家/角色的 `roll_dice` 工具一旦落地，就会是**第二套**。`doc-20 §2.2` 那句"三种入口必须进入同一个引擎裁决函数"就是判据：两套实现立刻违反它，且两份会以不同的方式对 `2d6` 出错（见 §9）。

**这条链路上唯一的"真随机"**：`roll_dice` 是整个 B1 动作层里唯一使用随机源的动作（`01 §2.2` 的 `ActionContext.rng` 就是为它加的）。其余工具都是确定性的，这一点决定了本文的测试策略（§10）。

**"剧情判定不写骰子"是设计边界，不是遗漏**（`doc-05 §3.1`）：结果由剧情说了算时，作者直接写进正文（"这一刀没能劈开锁"），根本不写骰子。因此 `expect` 解析器**不需要图灵完备**——它只需要表达"这次检定过没过"，且必须能被作者一眼看懂、被引擎一眼拒掉。本文的语法刻意压到最小（§2.2）。

---

## 2. 签名与参数

### 2.1 动作层（`packages/shared/src/actions/roll-dice.ts`）

形状由 `01 §2.6` 冻结，本文只填 `RollDiceInput` / `RollDiceDetails`：

```ts
// packages/shared/src/actions/roll-dice.ts
import type { ActionContext, ActionResult } from './types.js';

export interface RollDiceInput {
  /** 世界根相对路径、POSIX、无前导 './'、无绝对路径（00 §2.1）。必须是一个已存在的单文件 .md。 */
  path: string;
  /**
   * **仅 god 可用**（doc-21 §4.3）。上帝模式伪造结果时传这个值。
   * 非 god 传它就是 `dice_forced_not_allowed`（403）——绝不静默忽略（01 §2.4）。
   * 必须是整数且在骰子值域内（`diceRange`），否则 `invalid_argument`（400）。
   */
  forcedResult?: number;
}

export async function rollDice(
  ctx: ActionContext,
  input: RollDiceInput
): Promise<ActionResult<RollDiceDetails>>;

export interface RollDiceDetails {
  /** == input.path（稳定 id）。 */
  path: string;
  /** 实体此刻的名字（`entityName`，06 §2.3）。用它渲染，不回读文件（doc-21 §3.3）。 */
  name: string;
  /** 实体声明的骰子表达式，原文，如 "1d100"。 */
  dice: string;
  /** 实体声明的检定名，如 "Pick the rusted lock"。 */
  desc: string;
  /** 实体声明的通过条件原文，如 ">50"。 */
  expect: string;
  /** 引擎产生的最终点数（多骰为**和** + modifier）。 */
  result: number;
  /** 按 expect 判定的结果。 */
  passed: boolean;
  /** 每一颗骰子的点数（`1d100` → `[62]`，`2d6` → `[3,4]`）。前端演骰面用。 */
  rolls: number[];
  /** 每颗骰子都是最大面（`1d20` 的 20、`2d6` 的 6+6）。演出层据此放大成功。 */
  crit: boolean;
  /** 每颗骰子都是 1。演出层据此演大失败。 */
  fumble: boolean;

  /** true = 这一点数由 god 的 `forcedResult` 伪造（actor 为 god 时才有意义）。前端据此只显示总和、不画单骰面（§6.2）。 */
  forged: boolean;
  /** 本事件发生在哪一层（`resolveLayer(path)`，01 §3.9）。背包内实体为 null。 */
  layer: string | null;
}
```

**`details` 的稳定消费点**（`01 §11.2` + 本文新增四个：`rolls`/`crit`/`fumble`/`forged`，见 §11 冲突 1）：

| 字段 | 谁消费 | 为什么在这 |
|---|---|---|
| `path` | 前端定位骰子卡；`event-bridge` 取 `result.path`（`01 §11.2`） | `00 §6.2` 要求稳定路径 |
| `result` / `passed` | 骰子卡落定态（`DiceRoller` 的 `rolled`） | 演出与回写同源，不重算 |
| `rolls` / `crit` / `fumble` | 骰子仪式的结算大标（`doc-19 §3.3`） | **判定归引擎**，理由见 §2.2.7 |
| `forged` | god 伪造结果的演出分支（只显示总和、不画单骰面） | 与 `actor` 同源，前端不必回读文件 |
| `dice` / `desc` / `expect` | 演出文案（"Requires: >50"、"Deduction check"） | 演出不必回读文件 |
| `layer` | 帧/响应里的层归属 | 与事件同源（`01 §3.9`） |

### 2.2 `packages/shared/src/rules/dice.ts` —— expect 表达式解析器（**纯函数，零依赖**）

这是本文的技术核心，也是 `00 §10` 问题 2 的另一半（"含手写 expect 解析"）。

**文件纪律**（与 06 的 `rules/interactive.ts` 同规）：不 import `zod`、不 import `yaml`、不 import `schemas/`、不 import `actions/`。它必须能被**任意消费者**安全 import——单测（`node --test`，无构建）、前端（只需知道 `expect` 合不合法就能提前标红）、工具壳（错误文案）。`01 §8` 已把它列进 `packages/shared/src/index.ts` 的导出（06 也照此加了 `rules/interactive.js`）。

#### 2.2.1 完整语法（EBNF）

```ebnf
(* ── 骰子类型：决定"掷几颗、每颗几面、加成几多" ───────────────────── *)
dice_type   = [ count ] , "d" , faces , [ sign , modifier ] ;
count       = digit , { digit } ;          (* 省略 = 1；范围 1..20 *)
faces       = digit , { digit } ;          (* 范围 2..1000 *)
sign        = "+" | "-" ;
modifier    = digit , { digit } ;          (* 范围 0..10000 *)
(* 分隔符 "d" 大小写不敏感（1D100 合法）；首尾空白被 trim；
   内部空白不合法（"1d100 + 5" 是坏声明，不是宽容输入）。 *)

(* ── 通过条件：决定"这个点数算不算过" ──────────────────────────── *)
expect      = or_expr ;
or_expr     = and_expr , { ws , "||" , ws , and_expr } ;
and_expr    = atom    , { ws , "&&" , ws , atom } ;
atom        = range | comparison | bare_number ;
range       = integer , ws , ".." , ws , integer ;      (* 闭区间，min <= max *)
comparison  = operator , ws , integer ;
operator    = ">" | ">=" | "<" | "<=" | "=" | "==" | "!=" ;
bare_number = integer ;                                 (* 等价于 "=" integer *)
integer     = [ "-" ] , digit , { digit } ;             (* 无小数、无指数 *)
ws          = { " " | "\t" } ;                          (* 仅此两种，无换行 *)
```

**语义**：`or_expr` 里任一组成立即 `passed`；`and_expr` 里全部成立该组才成立；`&&` 结合力高于 `||`（与所有主流语言一致，作者不需要背优先级表）。

**为什么是这套语法**（每条都对应一个具体的作者意图，不是照抄某种语言）：

| 加进来的 | 因为作者会写 | 不加的 | 因为 |
|---|---|---|---|
| `>` `>=` `<` `<=` `=` `==` | 现存的全部 5 处模板 + `doc-05 §3.1` 样例 | `&` `/` `%` 等位/算术运算 | 骰子只产出"过/不过"，算术是另一件事 |
| `!=` | "除了 50 都行"若不许写 `!=`，作者只能写 `1..49 \|\| 51..100`——**逼人造错**（数值域还得随 `type` 变） | 括号 | 没有括号就没有嵌套，语法才是正则的（§2.2.2） |
| `a..b` | `doc-06 §2.6` 的 `expect` 是"通过条件"，区间是它最自然的形态 | 变量/函数调用 | `doc-05 §3.1`：不需要图灵完备 |
| `&&` `\|\|` | 双条件（"40 到 60 之间"）在多骰与加成场景很常见 | `!`（否定整体） | `!=` + 区间已覆盖；引入 `!` 就要引入括号 |
| `50` 裸数字 | 旧解析器走到的分支（`world.ts:369` 的 `else result === threshold`）——保留为**显式语法**，不是兜底 | 比较 `desc`/`status` 里的字段 | 那会把 `rules/dice.ts` 变成表达式语言，违反上一条 |

#### 2.2.2 等价单正则（用于"这个声明能不能读"的快速预检）

整个语法是**正则的**（无括号、无嵌套），因此可以写成一条正则。它**不是解析器**——拿它预检之后仍要走 `parseExpect` 拿 AST：

```ts
// rules/dice.ts 导出；供前端与静态预检使用
const INT  = String.raw`-?\d+`;
const W    = String.raw`[ \t]*`;
const ATOM = `(?:${INT}${W}\\.\\.${W}${INT}|(?:>=|<=|!=|==|=|>|<)${W}${INT}|${INT})`;
const AND  = `${ATOM}(?:${W}&&${W}${ATOM})*`;

/** 必要条件：parseExpect(raw).ok ⇒ EXPECT_RE.test(raw)。**不是充分条件**（见下）。 */
export const EXPECT_RE = new RegExp(`^${W}${AND}(?:${W}\\|\\|${W}${AND})*${W}$`);
```

**已穷举验证的关系**（§10.1）：字符表 `{> < = ! & | . 0-9 - + 空格 a \t}` 上长度 ≤ 4 的 **69,905** 个串里，"`parseExpect` 接受但这条正则拒绝" **0 例**（必要条件成立）。

> ⚠️ **反向不成立，且这正是 `parseExpect` 必须存在的理由**：纯正则表达不了"区间上界 ≥ 下界"，所以 `"60..41"` `"5..1"` 这类会被这条正则**放行**（实测 6 例），而 `parseExpect` 判它们 `invalid_field_value`。任何"用正则做最终判定、跳过 `parseExpect`"的实现都是错的。

#### 2.2.3 函数签名

```ts
export interface DiceSpec {
  count: number;      // 1..20
  faces: number;      // 2..1000
  modifier: number;   // -10000..10000
}

export interface DiceAtom {
  op: '>' | '>=' | '<' | '<=' | '=' | '!=' | 'range';
  /** range 之外是阈值。 */
  value?: number;
  /** 仅 range。 */
  min?: number;
  max?: number;
}
export interface ExpectAst {
  /** 顶层 OR；组内 AND。`anyOf[0]` 永远非空。 */
  anyOf: DiceAtom[][];
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** 解析 `roll_dice.type`。错误文案英文、带原文（00 §6.2）。 */
export function parseDiceType(raw: string): ParseResult<DiceSpec>;

/** 解析 `roll_dice.expect`。**不是图灵完备**：只支持 §2.2.1 的 EBNF。 */
export function parseExpect(raw: string): ParseResult<ExpectAst>;

/** 判定。纯、确定、无随机。 */
export function evaluateExpect(ast: ExpectAst, result: number): boolean;

/** 理论值域（含 modifier）。forcedResult 的合法性检查、UI 显示 "1..100" 用。 */
export function diceRange(spec: DiceSpec): { min: number; max: number };

/** 掷一次。`rng` 必须显式传入——可复现性的唯一入口（§2.2.9）。 */
export function rollOnce(
  spec: DiceSpec,
  rng: () => number
): { rolls: number[]; result: number; crit: boolean; fumble: boolean };
```

**边界与上限的为什么**（每条都是一个具体的失败模式）：

| 上限 | 值 | 为什么 |
|---|---|---|
| `count` | 20 | 真正的理由是**误写保护**：`200d6` 几乎总是把 `2d6` 多打一个 0，而一个静默掷 200 颗骰的检定会让演出层画 200 个骰面 |
| `faces` | 1000 | `1d10000` 说明作者想错了（`doc-05 §3.1`：剧情判定直接写正文）。1000 足够任何百分位表达 |
| `modifier` | ±10000 | 与 faces 同量级即可；再大就是笔误 |
| `integer` 位数 | 15 | 防 `Number` 精度静默丢位：`">9007199254740993"` 会被 `Number()` 变成别的数，判定结果就错了。超长 → `invalid_field_value` |

#### 2.2.4 `roll_dice.type` 用例表（30 例：10 合法 + 20 非法）

`ok` = `parseDiceType(raw).ok`。全部经实现验证（§10.1）。

| # | 输入 | ok | 说明 |
|---|---|:--:|---|
| 1 | `1d100` | ✅ | 规范形式；现存模板 5 处全是这个 |
| 2 | `1d20` | ✅ | |
| 3 | `2d6` | ✅ | 多骰，`result` 是**和** |
| 4 | `4d6+2` | ✅ | 正加成 |
| 5 | `2d10-1` | ✅ | 负加成 |
| 6 | `d100` | ✅ | 省略 `count` = 1 |
| 7 | `1D100` | ✅ | `d` 大小写不敏感 |
| 8 | `" 1d100 "` | ✅ | 首尾空白被 trim |
| 9 | `20d1000+10000` | ✅ | 三个上限同时取满 |
| 10 | `1d100\u00a0`（尾随 NBSP） | ✅ | 被 `String.prototype.trim()` 剥掉（NBSP U+00A0 在 JS 的 WhiteSpace 表内）；trim 只作用于首尾，与第 23 例的"内部空白不合法"不矛盾 |
| 11 | `1d1` | ❌ | `faces < 2`（1 面骰没有随机性） |
| 12 | `0d6` | ❌ | `count < 1` |
| 13 | `1d0` | ❌ | `faces = 0` |
| 14 | `21d6` | ❌ | `count > 20` |
| 15 | `1d1001` | ❌ | `faces > 1000` |
| 16 | `1d6+10001` | ❌ | `modifier > 10000` |
| 17 | `100d100` | ❌ | `count` 三位数超上限（"多打了一个 0"的典型） |
| 18 | `d6+` | ❌ | 悬空符号 |
| 19 | `1d100x` | ❌ | 尾随垃圾字符 |
| 20 | `100` | ❌ | 纯数字，没有 `d`——作者想写阈值，写错了字段 |
| 21 | `1d` | ❌ | 缺 `faces` |
| 22 | `dd6` | ❌ | 双 `d` |
| 23 | `1d100 + 5` | ❌ | 内部有空格；正确写法 `1d100+5` |
| 24 | `1d6*2` | ❌ | 乘法不在语法里（`doc-05 §3.1`：不需要图灵完备） |
| 25 | `3d6+1d4` | ❌ | 两个骰子项（要组合请用两个实体 + 两条事件） |
| 26 | `1d100.5` | ❌ | 小数面 |
| 27 | `5d` | ❌ | 缺 `faces` |
| 28 | `+1d6` | ❌ | 前置符号（加成只能在后） |
| 29 | `1d100-` | ❌ | 悬空减号 |
| 30 | `""` / `"   "` | ❌ | 空（`RollDiceSchema.type` 有 `.default('1d100')`，但空串不是缺失，是坏声明） |

> **第 10 例的取舍说明**：实现是 `parseDiceType` 先 `raw.trim()` 再匹配 `^(\d{0,2})d(\d{1,4})(?:([+-])(\d{1,5}))?$/i`。`trim()` 剥掉 U+00A0，因此该输入**实测被接受**。这依赖 JS 规范的 WhiteSpace 表而非本文的 EBNF（EBNF 只写 `" " | "\t"`）。**这是一处实现比 EBNF 宽松的地方**：要么接受（现状，省一行代码），要么把 trim 换成 `/^[ \t]+|[ \t]+$/g` 的显式剥离（严格对齐 EBNF）。**建议接受**——NBSP 出现在 frontmatter 里几乎总是编辑器插入的不可见字符，宽容它比因它拒绝一个本来正确的骰子声明更实用。登记 §11 冲突 5。

错误文案（逐字，`invalid_field_value`）：

```text
roll_dice.type "1d100x" is not a valid NdM[±K] expression
roll_dice.type "21d6" is out of range (count 1..20, faces 2..1000, modifier ±10000)
roll_dice.type is empty
```

#### 2.2.5 `roll_dice.expect` 用例表（35 例：15 合法 + 20 非法）

`ok` = `parseExpect(raw).ok`；`passed` 由 §2.2.6 的单测表覆盖。全部经实现验证（§10.1）。

| # | 输入 | ok | 说明 |
|---|---|:--:|---|
| 1 | `>50` | ✅ | 规范形式；模板 5 处 + `doc-05 §3.1` 样例 |
| 2 | `>=60` | ✅ | 含等号 |
| 3 | `<30` | ✅ | |
| 4 | `<=5` | ✅ | |
| 5 | `=50` | ✅ | 精确 |
| 6 | `==50` | ✅ | `=` 的别名（容错，不做第二套语义） |
| 7 | `!=50` | ✅ | 不等于——没有它，作者要写 `1..49 \|\| 51..100`，那是逼人造错 |
| 8 | `50` | ✅ | 裸数字 = 精确 50（保留为显式语法，见 §2.2.1） |
| 9 | `> 50` | ✅ | 运算符后可有空白 |
| 10 | `41..60` | ✅ | 闭区间：41 与 60 都算过 |
| 11 | `30..30` | ✅ | 退化区间 = 精确 30 |
| 12 | `>=40 && <=60` | ✅ | AND |
| 13 | `>80 \|\| <20` | ✅ | OR |
| 14 | `>=40&&<=60&&!=45\|\|=1` | ✅ | 混合；`&&` 结合力高于 `\|\|`（45 不过；1 与 50 过） |
| 15 | `>50 && <100` | ✅ | 两个比较的 AND |
| 16 | `>abc` | ❌ | 阈值非数字 |
| 17 | `""` | ❌ | 空（06 的 `RollDiceSchema.expect` 已加 `.min(1)`） |
| 18 | `>` | ❌ | 运算符无操作数 |
| 19 | `50..` | ❌ | 开区间（不是本语法的一部分） |
| 20 | `..50` | ❌ | 开区间 |
| 21 | `60..41` | ❌ | **区间倒置**——纯正则放行、解析器必须拒（§2.2.2） |
| 22 | `>=40 &&` | ❌ | 悬空 AND |
| 23 | `\|\|` | ❌ | 无操作数 |
| 24 | `>50 >60` | ❌ | 两个比较缺连接词（**最危险的一类**：作者以为写了 AND） |
| 25 | `50 60` | ❌ | 两个裸数字 |
| 26 | `>50 # 注释` | ❌ | 尾随垃圾；注释不是语法的一部分（YAML 层已能写注释） |
| 27 | `1..2..3` | ❌ | 链式区间 |
| 28 | `&&50` | ❌ | 前置连接词 |
| 29 | `>50,<60` | ❌ | 逗号不是连接词 |
| 30 | `$gt` | ❌ | Mongo 风格运算符 |
| 31 | `true` | ❌ | 布尔不是数字 |
| 32 | `1e3` | ❌ | 指数写法（`Number('1e3')` 是 1000，宽容会静默改变语义） |
| 33 | `3.5` | ❌ | 小数阈值——骰子结果是整数，`>3.5` 等价 `>=4`，但要作者写清楚 |
| 34 | `==` | ❌ | 运算符无操作数 |
| 35 | `>50 \|\|` | ❌ | 悬空 OR |

错误文案（逐字，`invalid_field_value`；与 `01 §7.2` 表里的"expect 坏"一致）：

```text
roll_dice.expect ">abc" is not evaluable; expected e.g. ">50", ">=60", "<30", "=50", "41..60", ">=40 && <=60", ">80 || <20"
```

**文案里带例子是刻意的**：这条错误会直接进模型的上下文。`01 §7.2` 的纪律是"每条文案 MUST 带具体路径/参数值"；这里额外给合法样例，因为配额不足的模型看到"不合法"会乱猜重试，看到样例会照抄。

#### 2.2.6 判定语义用例表（20 例，验证 `evaluateExpect`）

| # | expect | result | passed | 说明 |
|---|---|---|:--:|---|
| 1 | `>50` | 50 | false | 严格大于边界 |
| 2 | `>50` | 51 | true | |
| 3 | `>=60` | 60 | true | 含等号边界 |
| 4 | `<30` | 29 | true | |
| 5 | `<30` | 30 | false | |
| 6 | `<=5` | 5 | true | |
| 7 | `=50` | 50 | true | |
| 8 | `!=50` | 49 | true | |
| 9 | `!=50` | 50 | false | |
| 10 | `50` | 50 | true | 裸数字 |
| 11 | `41..60` | 41 | true | 下界含 |
| 12 | `41..60` | 60 | true | 上界含 |
| 13 | `41..60` | 61 | false | |
| 14 | `>=40 && <=60` | 40 | true | AND 两个边界都含 |
| 15 | `>=40 && <=60` | 61 | false | |
| 16 | `>80 \|\| <20` | 85 | true | OR 左支 |
| 17 | `>80 \|\| <20` | 50 | false | OR 两支都不成立 |
| 18 | `>=40&&<=60&&!=45\|\|=1` | 45 | false | AND 组被 `!=45` 否掉，且 45 ≠ 1 |
| 19 | `>=40&&<=60&&!=45\|\|=1` | 1 | true | OR 右支救回 |
| 20 | `>=40&&<=60&&!=45\|\|=1` | 50 | true | AND 组全成立 |

#### 2.2.7 crit / fumble：判定归引擎，演出归前端（**本文定案**）

`doc-19 §3.3` 要 CRITICAL / FUMBLE 大标，但**没定谁算**。**本文定案：引擎算，走 `details`；前端只负责演。**

**理由（三条，逐条可证）**：

1. **今天的实现是错的，且错在只有引擎才知道的地方**：`apps/web/src/components/narrative/DiceRoller.tsx:121-126` 硬编码 `result >= 95 → crit` / `!passed && result <= 5 → fumble`。这对 `1d100` 碰巧对，对 `1d20`（自然 20 才是大成功）与 `2d6`（双六才是）**全错**。
2. **让前端算，就要前端再解析一次 `NdM[±K]`**——那是**第二套约定、第二个进程**，正是 `00 §8` 反模式与 `doc-20 §12` 明禁的形态。而且前端只看总数（`result`），`2d6` 的 `[6,6]` 与 `[5,7]`（不可能，但 `4d6+2` 的 `[5,6,6,6]` 与 `[6,6,6,5]` 可能）无法区分。
3. **crit/fumble 是"骰子显示了什么"，不是"结果意味着什么"**。前者是引擎的事实（它知道每颗骰子），后者是演出的判断（前端可以决定 `1d100` 掷 3 但 `>50` 也照样给个"擦边"的灰调）。

**定义（写进 `rules/dice.ts`）**：

```ts
crit   = rolls.every((r) => r === spec.faces);   // 每颗都是最大面
fumble = rolls.every((r) => r === 1);            // 每颗都是 1
```

| 规则 | 说明 |
|---|---|
| **modifier 不参与** | `4d6+2` 掷出 `[6,6,6,6]` 是 crit（骰面事实）；加成的 2 不改变"骰子全是六" |
| **多骰要求全中** | `2d6` 的 `[6,5]` 不是 crit——"大成功"在双骰上就是双六 |
| **不放进事件、不放进 frontmatter** | `roll_resolved.detail` 保持 `doc-21 §4.3` 的七个字段一字不改；`RollDiceSchema` 保持 06 冻结的五字段。`details` 是它唯一的家（§11 冲突 1 已向 01 提出该表补四个字段：`rolls`/`crit`/`fumble`/`forged`） |
| **与 `passed` 正交** | 自然 20 但 `expect` 是 `=1` 时 `passed=false`、`crit=true`。两个事实各演各的 |

单测判据（§10.1 已实测 9 例）：`1d100`→`[100]` crit、`[1]` fumble、`[96]` 都否；`1d20`→`[20]` crit；`2d6`→`[6,6]` crit、`[6,5]` 否；`3d6`→`[1,1,1]` fumble；`4d6+2`→`[6,6,6,6]` crit（result = 26）。

#### 2.2.8 回写器 `patchRollDiceResult`（**就地改写，外科手术式**）

```ts
/**
 * 只改 roll_dice 块里的 result/passed 两行，**其余每一个字节原样保留**。
 * 返回新内容；不写盘（调用者用 store.writeFileAtomic，01 §2.7）。
 * 找不到 roll_dice 块 / 是行内 YAML 形式 → 抛（不是静默放弃）。
 */
export function patchRollDiceResult(raw: string, result: number, passed: boolean): string;
```

**为什么不能沿用 `stringifyChalk`**（今天 `routes/world.ts:379` 的路径）：**实测**把 `templates/holmes-world/world/baker-street/evening.md` 走一遍 `parseFrontmatter` → `stringifyChalk`，整篇 frontmatter 被重排、被无条件加引号：

```diff
-type: chalk
+type: "chalk"
 roll_dice:
-  type: 1d100
-  desc: Deduction check
-  expect: ">50"
+    type: "1d100"
+    desc: "Deduction check"
+    expect: ">50"
+    result: "62"
+    passed: "true"
```

**五个后果，全部实测**（`templates/holmes-world/world/baker-street/evening.md` 与 `README.md`，`packages/shared/dist` 2026-09-12 的构建）：

1. **`roll_dice` 的每个子键都被加上引号**（`stringifyChalk:138` 是 `"    ${rk}: \"${rv}\""`，无条件引号 + **4 空格缩进**）。用标准 YAML 库读回那个文件：`typeof result === 'string'`（`"62"`）、`typeof passed === 'string'`（`"true"`）。旧的手写 `parseFrontmatter` 恰好对这两个键做了类型还原（`:113-114`），所以今天看不出问题——**06 换真 YAML 解析器之后立刻暴露**，而那时 `parseFrontmatter` 的 `interactive.roll_dice.result` 会变成 `"62"`，`DiceRoller` 的 `typeof result !== 'number'` 守卫（`DiceRoller.tsx:49`）会把它判成畸形响应。**这是本文必须自带 `patchRollDiceResult` 的最硬理由。**
2. **`status.data` 的数字全部变成字符串**：`Sanity: 65` → `Sanity: "65"`（`:133` 同样无条件引号）。`doc-06 §2.6` 的状态表样例里有 `技术进度: 3` / `算力指数: 6` 这类数字，前端表格的类型会当场错。
3. **含双引号的 `choice` 标签写出的 YAML 不合法**：`choice: ['He said "no"']` → `- "He said "no""`——**标准 YAML 库直接抛** `Unexpected scalar at node end`（实测）。旧手写解析器靠"剥首尾引号"侥幸读对，换成真解析器后整个文件解析失败。
4. **嵌套块在解析阶段就丢了**：`bgStyle:` / `anchor:` 这类嵌套对象**不会进 `frontmatter`**（实测：`parseFrontmatter('---\ntype: chalk\nbgStyle:\n  tone: warm\n---\n')` 的 `Object.keys()` 只有 `['type']`），所以 README 的 `bgStyle` 整块在 `stringifyChalk` 的输出里不存在。README 场景还有一个更具体的伤口：`bg:` 的**行内注释被吞进值里**（`bg: "assets/…png\"   # scene backdrop…"`）——注释里那个未转义的 `"` 让值自己破坏自己。
5. **每次掷骰都在重写整篇文件的 frontmatter**（不止 `roll_dice` 块），diff 里分不清"谁改了什么"，与 `00` 硬约束 1「文件即真相」的审计意义相悖。

> **订正一处此前的 [推断]**：第 4 条原写成"`bgStyle` 会被写成一行 JSON"。**实测不是**——它在**手写解析器**那一步就丢了（`frontmatter.ts:45-118` 只认 `choice` / `status.data` / `roll_dice` 三个子结构）。06 §9.1 D6 已记同一处（组件注册表的 `accepts` / `marks` / `rows` 会重蹈）。本文不重复论证，只把结论落在这里。

**`patchRollDiceResult` 的契约（实现要点，全部已实测）**：

1. 只认**块形式** `roll_dice:`（顶格）+ 缩进子键；**行内形式** `roll_dice: {…}` → 抛（B1 的解析器与 stringify 都不产出行内形式，遇到就说明有人手写，必须明说而不是猜）。
2. **定位块**：从顶格 `roll_dice:` 行起，吃到下一个**非缩进**行为止；块尾的连续空行不属于块（不吞掉分隔空行）。
3. **子键缩进沿用文件里现有的**（以块内第一个子键的缩进为准；无子键时用 2 空格）。因此 `evening.md` 的 2 空格与 `stringifyChalk:138` 历史上写出的 4 空格文件都能正确改（实测 4 空格文件产出缩进为 4 空格的 `result: 9` 与 `passed: false` 两行，其余行原样）。
4. `result` / `passed` 已存在 → **就地替换**；不存在 → **追加到块尾**（保证"重开后重掷"与"首次掷"走同一条路径）。
5. **行尾风格跟随文件**：CRLF 文件继续 CRLF（实测无 `\r\r\n` 混入）。
6. **幂等且可反复**：`patchRollDiceResult(patchRollDiceResult(raw, 62, true), 7, false)` 只改那两行（实测）。
7. **不改文件末尾**：无尾换行的文件保持无尾换行。

**产物长什么样**（实测，`evening.md` 原文只差两行）：

```text
---
type: chalk
roll_dice:
  type: 1d100
  desc: Deduction check
  expect: ">50"
  result: 62
  passed: true
choice:
  - "Ask where the photograph came from"
status:
  data:
    photo_source: "The Constable"
---
```

（`result` / `passed` 两行是唯一新增的；原文的 `choice` / `status` / 缩进 / 行尾逐字节保留。）

**副作用即"两行"**：`result` 与 `passed`。这是对 `doc-05 §3.1`（"回写 `result / passed`"）的字面兑现——不多写一个键。

**与 `stringifyChalk` 的关系**（06 已确认）：`patchRollDiceResult` 取代它之后，`stringifyChalk`（`frontmatter.ts:123-148`）的生产调用点归零。06 定"应当删除"；本文不反对，但**删除归 06 的文件、不归本文**——本文只保证不再调它。

#### 2.2.9 真随机源：`Math.random()` 的结论

**定案：生产路径用 `Math.random()`；可复现性靠注入 `rng`，不靠换随机源。**

| 问题 | 答案 | 理由 |
|---|---|---|
| `Math.random()` 够不够随机？ | **够** | `roll_dice` 的用途是叙事紧张感（`doc-05 §3.1`），不是密码学抽样。V8 的 xorshift128+ 周期 ~2^128；攻击者猜下一次点数的收益是"在单机单人跑团里赖一次骰"——没有威胁模型 |
| 要不要 `crypto.randomInt`？ | **不要** | 它会让 `rollOnce` 变异步或引入 `node:crypto` 依赖，而 `rules/dice.ts` 的纪律是零依赖、可被前端 import。收益为零 |
| 可复现性怎么保证？ | **`rng` 显式注入**（`rollOnce(spec, rng)` + `ActionContext.rng`，`01 §2.2`） | 单测传确定序列；探针传固定序列断言 `result/passed`；生产默认 `Math.random`。**唯一入口，不打桩全局**（打桩 `Math.random` 会污染同进程的其它随机使用，且让测试彼此耦合） |
| `rng()` 返回值越界怎么办？ | **`RangeError`**（不是钳位） | `rng` 是内部接缝，不是用户输入。越界说明注入方写错了；静默钳位会让测试用例悄悄失效——那比崩掉更糟 |
| 两侧进程各自 `Math.random` 会不会撞？ | 会，但**无所谓** | 两次掷骰撞出同一个点数在叙事上完全正常；`result` 没有"必须唯一"的语义（不是 id） |

**取值公式**：`Math.floor(rng() * faces) + 1`（`rng()` 的理论返回值是 `[0,1)`）。**不做 `Math.round`**——`round` 会让首尾各占半个区间（`1d6` 出 1 的概率只有 1/12），这是"看起来完全成功的无效实现"。

### 2.3 工具壳（`extensions/toolkit/roll-dice.ts`）

```ts
import { Type } from 'typebox';
import { rollDice, AGENT_ROLE_ENV } from '../../packages/shared/dist/index.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { resolveAgentActor } from './actor.js';
import { openWorldStore } from './store.js';
import { ok, fail } from './result.js';
import { currentTurn } from './turn.js';

export function registerRollDice(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'roll_dice',
    label: 'Roll Dice',
    description:
      'Resolve a dice check an entity declares in its frontmatter `roll_dice`. ' +
      'The engine reads `type / desc / expect` from the file, rolls true random, ' +
      'judges against `expect`, writes `result / passed` back into the file and ' +
      'records the world event. Use it when an action is genuinely uncertain and the ' +
      'outcome should be left to chance — picking a lock, holding your nerve, reading ' +
      'someone. Do NOT use it when the story should simply decide the outcome: write ' +
      'that in the prose instead. The caller can never supply the result; the roll is ' +
      'always the engine\u2019s. Refuses to re-roll an entity that already has a result.',
    parameters: Type.Object(
      {
        path: Type.String({
          description:
            'World-relative path of the entity that declares roll_dice, e.g. world/manor/cellar-door.md',
        }),
      },
      // doc-20 §7: the caller may NOT submit result / type / expect. Without
      // additionalProperties:false TypeBox ACCEPTS and silently DROPS them
      // (verified: Compile(Type.Object({path})).Check({path,result:5}) === true),
      // so the model's mistake would vanish instead of failing loudly.
      { additionalProperties: false }
    ),
    promptSnippet: 'roll_dice — let the engine resolve an entity\u2019s declared dice check',
    promptGuidelines: [
      'Use roll_dice when an entity already declares a roll_dice check and the outcome should be left to chance; never invent the result yourself.',
      'Do not pass result, type or expect to roll_dice: the engine reads them from the file, so a re-stated value would only drift from the truth.',
      'If an entity already has a result, roll_dice refuses; to re-open the check, edit the old result out of the file first.',
    ],
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const store = openWorldStore(ctx.cwd);
      try {
        const result = await rollDice(
          { store, actor: resolveAgentActor(process.env[AGENT_ROLE_ENV]), turn: currentTurn(ctx) },
          { path: params.path }
        );
        return ok(result.text, result.details);
      } catch (err) {
        return fail(err); // ActionError.toToolResult(): isError + readable English reason
      }
    },
  });
}
```

**`additionalProperties: false` 不是装饰**（实测，§10.1）：TypeBox 默认**接受并丢弃**多余属性——`Compile(Type.Object({path:Type.String()})).Check({path:'a',result:5})` 返回 `true`，`args.result` 到不了 `execute`。于是模型传了 `result: 100` 时，`doc-20 §7` 会被**静默违反**：结果仍由引擎产生（安全），但模型以为自己控制了点数，下一轮会基于错误认知行动。加了这一条，pi-rp 的 `validateToolArguments`（`vendor/pi-rp/packages/ai/src/utils/validation.ts:317-349`）会直接抛 `Validation failed for tool "roll_dice": must not have additional properties`——**在 `execute` 之前、以工具错误的形式回到模型**（`agent-loop.ts:618` 那条路径）。这是 `doc-20 §7` 唯一能在工具层兑现的方式。

**`text` 的形态**（英文，`00 §6.2`：说清发生了什么 + 稳定路径）：

```text
Rolled 1d100 for "Pick the rusted lock" (world/manor/cellar-door.md): 62 — passed (>50).
Rolled 2d6+2 for "Hold the line" (world/inn/barricade.md): 4+3+2 = 9 — failed (>=12).
Overwrote the previous result (62) with a forged 7 for "Pick the rusted lock" (world/manor/cellar-door.md).
```

失败时由 `ActionError.toToolResult()` 产出（§7），`isError: true`，**不落事件**。

### 2.4 `RollDiceInput` 为什么只有 `path`（+ 仅 god 的 `forcedResult`）

`doc-20 §7` 明文："工具只接收实体路径。引擎以该实体当前的 `roll_dice` 为真相，不接受调用者重复提交 `type / expect`，避免 UI、Agent 参数与文件内容漂移。" 因此：

| 参数 | 收 | 为什么 |
|---|:--:|---|
| `path` | ✅ | 唯一真相源 = 那个文件 |
| `type` / `expect` / `desc` | ❌ | 调用者转述 = 第二份真相。作者改了 `expect` 而工具参数没改，判定就会用一个文件里不存在的条件——而且**事件里记的也是错的** |
| `result` | ❌ | `doc-20 §2.2`："调用者不能把 `result` 作为参数传入；随机结果永远由引擎产生" |
| `forcedResult` | ⚠️ 仅 `god` | 唯一的例外，由 `doc-21 §4.3` 的 `actor_type='god'` 授权。非 god 传它是硬错误，不是忽略 |

**"不按身份裁能力"与"god 才能伪造"不矛盾**（`doc-20 §1.1` 的边界）：`doc-20 §1.1` 说的是"角色不应因身份被剥夺工具"，即**能力门禁**；`forcedResult` 是**真相门禁**——它防的是"一个叙事参与者声称随机结果是某个值"，而这正是 `doc-20 §2.2` 最后一句要保护的"随机裁决的一致性"。上帝模式本来就通过 `edit` 能改文件里的 `result`（`doc-14` 待设计 #2），这里只是给它一条**会落事件**的正路。

---

## 3. 行为契约（逐步）

`rollDice` 的前后步骤来自 `01 §3.1` 的五步骨架（解析输入 → 读取现状 → 落盘 → 落账 → 返回），中间是本文独有的核心。

### 3.1 逐步表

| # | 步骤 | 漏了会怎样 |
|---|---|---|
| 1 | **校验路径**：非空、世界根相对、POSIX、无 `..`、非保留前缀（`01 §7.3` 的收紧版 `resolvePath`）。 | 模型给的路径可以逃出世界根（`01 §9` 首行，B1 唯一安全修复）。 |
| 2 | **校验 `forcedResult` 的调用者**：`forcedResult !== undefined` 且 `ctx.actor.type !== 'god'` → `dice_forced_not_allowed`（403）。此时**还没读文件**。 | 一个玩家/作家能伪造任意点数，`doc-20 §2.2` 的随机一致性当场失效。 |
| 3 | **读取源文件**：`store.readFile(path)`；不存在 → `not_found`。`parseFrontmatter`（06 版）得到 `frontmatter / interactive / errors`。 | 不重读就落账 = 相信调用者转述的内容，而 `doc-20 §7` 明写"引擎以该实体当前的 `roll_dice` 为真相"。 |
| 4 | **取骰子声明**：`interactive.roll_dice == null`（归一化后不存在、或 `desc`/`expect` 缺/空）→ `not_interactive`（带 `errors[0]`）。本步骤**不再产出 `malformed_entity`**——那是"整块 frontmatter 坏"的码（与 06 §3.3/§7.1 对齐）。 | 落一条没有检定的 `roll_resolved`，事件 detail 里的 `desc`/`expect` 只能是编的。 |
| 5 | **解析类型与条件**：`parseDiceType` / `parseExpect`（§2.2）。任一失败 → `invalid_field_value`（**带字段名与原文**）。 | 把 `>abc` 静默当 `>50`（旧实现的 `threshold = 50` 兜底，`world.ts:363`），作者以为写对了，实际判定是另一个条件。 |
| 6 | **重掷门禁**：`interactive.roll_dice.result !== undefined` → 按 §3.3 分流：非 god = `dice_already_rolled`（409）；god 且带 `forcedResult` = 放行（覆盖）；god 不带 = `dice_already_rolled`。 | `doc-20 §7` 的 MVP 规则失效：玩家可以反复点直到掷过为止——**骰子从此不是风险，是刷新按钮**。 |
| 7 | **产出点数**：`forcedResult !== undefined` → `result = forcedResult`，`rolls = [forcedResult]`，先按 `diceRange` 校验（越界 → `invalid_argument`）；否则 `rollOnce(spec, ctx.rng ?? Math.random)`。 | 上帝传 120 给 `1d100` 也能落账，事件里的点数不可能由那个骰子产生。 |
| 8 | **判定**：`passed = evaluateExpect(ast, result)`。 | —— |
| 9 | **组装新内容**：`patchRollDiceResult(raw, result, passed)`（§2.2.8），**只改 `roll_dice` 块的两行**。 | 用 `stringifyChalk` 全量重发 = 每次掷骰都改写作者的文件（§2.2.8 实测）。 |
| 10 | **落盘**：`store.writeFileAtomic(path, next)`（`01 §2.7`）。失败 → `write_failed`（500），**原文件未动**。 | 半截 frontmatter 被 server 的 `fs.watch` 看到并广播，前端缓存一个语法残骸。 |
| 11 | **落账**（§5）：`appendEvent({ type:'roll_resolved', … })`，**一次、只一次**。失败 → `event_failed`（500），**不回滚文件**（`01 §3.6`）。 | 世界变了但作家/角色/历史面板不知道（`doc-21 §1` 第三问判死）。 |
| 12 | **返回** `{ text, details }`：`details` 含 §2.1 全部字段 + `event`。 | 前端要么回读文件（多一次 I/O、且可能读到别人后来的写），要么没有骰面可演。 |

**步骤 10 与 11 的顺序不可换**：文件是真相（`00` 硬约束 1），事件必须描述一个**已经发生**的变化。反过来的话，`event_failed` 会变成"事件说掷了、文件却没改"——比现在的"文件改了、事件没落"更坏（前者会让作家基于一个不存在的结果叙事，而下一轮 `look_at` 又看不到它，作家会以为自己在幻觉里）。

### 3.2 与 `choose` / `use_item_on` 的对称性

三者都是"一个动作落一条事件"，但落点完全不同，这是刻意的：

| | 改文件 | 改 canvas.db | 落事件 | 随机源 |
|---|:--:|:--:|:--:|:--:|
| `choose`（06） | ❌ | ❌ | ✅ `choice_selected` | ❌ |
| `roll_dice`（本文） | ✅ 只改 `roll_dice` 块 | ❌ | ✅ `roll_resolved` | ✅ |
| `use_item_on`（08） | ❌ | ❌ | ✅ `use_item_on` | ❌ |

`roll_dice` 是 **B1 唯一"有随机源"且"就地改写 frontmatter"** 的动作。前者决定它的测试策略（§10），后者决定它必须自带回写器——06 已确认不提供通用 patcher：`choose` 什么都不回写，`roll_dice` 是唯一一处，**一份实现、一个约定**。

### 3.3 重掷的判定、文案与重开方式

`doc-20 §7`："MVP 对已有 `result` 的骰子拒绝再次投掷，作者需要重开时先编辑掉旧结果。" 本文把它定清：

| 情形 | 结果 | 文案 |
|---|---|---|
| `result` 不存在 | 正常掷 | —— |
| `result` 存在，actor 是 `player` / `writer` / `character` | `dice_already_rolled`（409） | `"world/inn/cellar-door.md" already has a rolled result (62, passed); edit the file to remove it, then roll again` |
| `result` 存在，actor `god`，**不带** `forcedResult` | `dice_already_rolled`（409） | 同上（god 的普通点击与玩家同规——见理由 2） |
| `result` 存在，actor `god`，**带** `forcedResult` | 覆盖（**放行**） | `Overwrote the previous result (62) with a forged 7 for "Pick the rusted lock" (world/inn/cellar-door.md)` |

**god 为什么能覆盖**（三条理由；登记在 §11 冲突 2）：

1. `doc-21 §4.3` 明文要"上帝模式伪造结果时仍走同一个 type，靠 `actor_type = god` 区分"——如果 god 也必须先手改文件才能伪造，这条路径**在落地当天就是死代码**，而它存在的意义正是那条规则。
2. 禁掷规则的**目的**是"防玩家反复刷新直到过"（`doc-20 §7` 的语境是玩家点击）。它不是创作限制——god 本来就通过 `edit` 能改任何字节（`doc-14` 待设计 #2），禁掉 `forcedResult` 只是把人赶回手改文件，那条路反而**不落事件**（`00 §4.2` 的 B 入口只兜 `write`/`edit`，且 B1 不实现）。
3. 仍然是**一条代码路径、一个事件类型**：伪造与真掷的差别只在 `actor_type`，正是 `doc-21 §0` 第三条定案（事件按"发生了什么"分类，身份进 `actor`）的用法。

**god 的普通点击为什么不记 `god`**（与 §5.2 同一条规则）：`actor_type='god'` 是"这一掷是伪造的"的标记（`doc-21 §4.3`）。若 god 模式的普通掷骰也记 `god`，这个标记退化成"当时开着上帝模式"，历史面板再也分不出哪条是伪造。

**重开的正规做法**（写进 preset 提示词与错误文案）：

```text
agent: edit world/inn/cellar-door.md          # 删掉 roll_dice.result 与 roll_dice.passed 两行
agent: roll_dice { path: "world/inn/cellar-door.md" }   # 现在可以重掷
```

**不提供 `reset` 参数**：那是"让 `roll_dice` 顺手改文件语义"的滑坡——重开是**作者编辑声明**，不是**引擎重掷**。两件事混进一个工具，模型会开始用 `roll_dice({reset:true})` 当"再来一次"，`doc-20 §7` 的门禁就白设了。

**`result` 存在但 `passed` 缺失**（手写坏了）：按"已有 result"处理（`dice_already_rolled`）。判定用"有 `result`"而不是"有 `result && passed`"，因为前者是"这个检定已被裁决过"的唯一可靠信号。

**判定发生在读文件之后、掷骰之前**：这样 `dice_already_rolled` 的文案能带出旧结果（"already has a rolled result (62, passed)"），比一句"不能重掷"有用得多——模型据此知道要 `edit` 什么。

---

## 4. 文件与副作用

### 4.1 白名单（超出即 bug，与 `01 §10.1` 同纪律）

| 路径 | 操作 | API |
|---|---|---|
| `<worldRoot>/<path>`（一个既有 `.md`） | **就地改写 `roll_dice` 块内的 `result` / `passed` 两行** | `store.writeFileAtomic` |
| `<worldRoot>/.airpworld/history.db` | 追加一行 `roll_resolved` | `store.appendEvent` |

**不碰**：`canvas.db`（掷骰不改画布状态——骰子卡的位置是卡片自己的事，由 `arrange`/排座管）、任何其它文件、任何目录、`.airpworld/assets/`。

### 4.2 写盘原子性

改写既有文件 **MUST** 用 `writeFileAtomic`（`01 §2.7`：同目录临时文件 + `rename`，失败时原文件未被触碰）。不是可选的：

- server 进程有一个 `fs.watch` 递归监视世界目录（`event-bridge.ts:136`）；`writeFile` 的"先截断再写"会让它看到**一个半截的 frontmatter**，于是前端的 `file_changed` 刷新可能解析出一个语法残骸；
- agent 进程被 kill 时留下半截文件，下一轮 `look_at` 读到 `roll_dice:` 后面什么都没有。

**临时文件名带 pid + 随机段**（`01 §10.3`）：agent 与 server 两侧可能同时掷同一实体（玩家点得快 + 作家在同一轮里也调了），固定 `.tmp` 名会互相踩。

### 4.3 CRLF / 缩进 / 行尾的保留

`patchRollDiceResult` 是**字节级外科手术**，不重新序列化 YAML。因此：

| 文件特征 | 结果 |
|---|---|
| CRLF 行尾 | 保持 CRLF（实测无 `\r\r\n`） |
| `roll_dice` 子键 2 空格缩进（模板现状） | 保持 |
| `roll_dice` 子键 4 空格缩进（`stringifyChalk:138` 的历史产物） | 保持（以块内第一个子键为准） |
| 其它键、注释（README 的 `bg:` 行有行内注释）、`bgStyle` 嵌套块 | **逐字节不变** |
| 文件末尾无换行 | 不变（只改块内两行） |

**实测证据**（§10.1）：`evening.md` 原文与 `patchRollDiceResult` 结果**逐行对比只差两行**；把这两行删掉就与原文**逐字节相同**。

---

## 5. 落账

### 5.1 事件：`roll_resolved`

`detail` 的字段名 **100% 来自 `00 §5.2` / `doc-21 §4.3`**，本文一字不改：

| 字段 | 值 | 来源 |
|---|---|---|
| `type` | `'roll_resolved'` | 冻结 |
| `actor` | 调用者（god 伪造时 `god`） | `01 §3.5` |
| `subject` | `path` | `01 §3.9`：`roll_dice` 的主语就是那个实体 |
| `layer` | `store.resolveLayer(path)`（`01 §3.9`；背包/小天地内为 `null`） | 层窗口过滤用（`doc-21 §5.2`） |
| `turn` | A 入口 = `currentTurn(ctx)`；C 入口 = `req:<uuid>`（`01 §3.7`） | 合并锚 |
| `detail.path` | `input.path` | `00 §5.2` |
| `detail.name` | `entityName(fm, path)`（06 §2.3：`title → name → basename`） | `00 §5.2` |
| `detail.dice` | `roll_dice.type` 原文，如 `"1d100"` | `00 §5.2`（字段名是 `dice`，不是 `type`/`rollType`） |
| `detail.desc` | 声明里的 `desc`，如 `"Pick the rusted lock"` | `00 §5.2` |
| `detail.expect` | 声明里的 `expect` 原文，如 `">50"` | `00 §5.2` |
| `detail.result` | `number` | `00 §5.2` |
| `detail.passed` | `boolean` | `00 §5.2` |

**`detail` 里没有的东西，以及为什么**：

- **没有 `rolls` / `crit` / `fumble`**：`00 §5.2` 的字段名是冻结的，加字段要同时给渲染模板（`doc-21 §4` 末）与评审。它们是**演出原料**，走 `details` 帧（§6），不进历史。
- **没有正文、没有 `expect` 的解析结果**：`00 §5.2`"不存正文"。判定条件已经以原文形式在 `expect` 里，渲染器不必知道它是不是 `>=`。
- **没有 `forced` / `forged` 标志**：`actor_type === 'god'` 就是那个标志（`doc-21 §4.3`）。**再加一个布尔是第二份真相**，且两份会漂移（god 用不带 `forcedResult` 的普通掷骰时 `forced:false` 而 `actor:god`）。伪造的演出标记只存在于 `details.forged`（演出原料，不进历史），事件里仍然只有 `actor_type`。
- **没有第二个路径**：`subject` 与 `detail.path` 同值，够合并规则（`doc-21 §5.4` 第 1/2 条）用。

人话模板（`doc-21 §4.3` 逐字）：「玩家掷骰：检定「推理检定」掷出 62（>50 通过）」。

### 5.2 `actor` 与四类入口的对应

| 入口 | `actor` | 历史面板/注入里怎么读 |
|---|---|---|
| 玩家点击骰子卡 | `{type:'player'}` | 「玩家掷骰：…」 |
| 作家调用 | `{type:'writer'}` | 渲染器按 `actor` 换人称（`doc-21 §3.5`：同一条事件对三个读者说三种话） |
| 角色调用 | `{type:'character', id}` | 「他掷骰…」 |
| 上帝伪造 | `{type:'god'}` | 「世界自己变了一下」+ 历史面板可筛（`doc-21 §3.2`） |

**C 入口的 actor 规则（与 12 约定并已登记）**：`POST /api/dice` 的 actor 是 `player`；**只有带 `forcedResult` 时才是 `god`**。理由见 §3.3 末。

### 5.3 失败不落（`doc-21 §3.6`）

| 失败 | 落事件？ |
|---|---|
| 路径非法 / 文件不存在 / 无 frontmatter / 无 `roll_dice` / 坏 `type` / 坏 `expect` | ❌ |
| `dice_already_rolled` / `dice_forced_not_allowed` / `invalid_argument`（`forcedResult` 越界） | ❌ |
| `write_failed`（落盘失败，文件未动） | ❌ |
| `event_failed`（**落盘成功、`appendEvent` 抛错**） | ❌ —— 世界变了但账没落。按 `01 §3.6`：**不回滚、不补偿**，文案说清事实 |

**`event_failed` 的文案**（`01 §3.6` 形状 + 本文补 `roll_dice` 的具体事实）：

```text
File "world/inn/cellar-door.md" was updated with result 62 but the world event could not be recorded: <cause>
```

**为什么这里不回滚**（与 `01 §3.6` 一致，但骰子有特殊性）：把文件改回"没有 result"会让**那个点数消失**。玩家重掷会得到另一个点数——比"文件与事件不一致"更坏，因为它擦掉了一次不可复现的随机结果，而"刚刚掷出 62"这件事可能已经在玩家的屏幕上演完了。正确处置是让不一致可见（历史面板缺一条，作家下一轮 `look_at` 看到 `result` 已在），人工可修。

### 5.4 注入侧怎么念（`doc-22 §3.1`，本文不需要改它）

`doc-22 §4` 的事件段样例里已经有这一行（`:114`）：「玩家掷骰：检定「推理检定」掷出 62（>50 通过）」。渲染器读 `detail` 的七个字段即可，**不回读世界目录**（`doc-21 §3.3`）。合并规则（`doc-21 §5.4` 第 1 条：同 `turn` + 同 `type` + 同 `actor` 合并计数）对骰子天然弱——同一轮里掷三次同一个实体会被并成一句，但实际不会发生（第一次就落了 `result`，后两次被 §3.3 拒掉）。**这是 `dice_already_rolled` 门禁顺带带来的好处，不是它的目的。**

---

## 6. WS 与前端

### 6.1 帧名冲突的落实（`00 §5.3`）

**这是全仓唯一一处"事件 type 与演出帧同名"的历史遗留。** `00 §5.3` 已冻结处理：

| 通道 | 名字 | 带 event 行？ |
|---|---|---|
| 世界事件（历史） | `{ type:'world_event', event }`，`event.type === 'roll_resolved'` | ✅（尾部读表拿到的行） |
| 演出帧（瞬时） | `{ type:'dice_result', … }` | ❌（只走 WS） |

**`roll_resolved` 从此不再作为帧名出现**。今天 `routes/world.ts:390` 广播 `{type:'roll_resolved', event, result, passed}`——改成 `dice_result`（字段名对齐 §6.2），事件部分交给尾部读表的 `world_event`（`01 §11.5`，归 12）。

**为什么不把帧名改成别的**（比如 `dice_rolled`）：`00 §5.3` 已冻结 `dice_result`，改它就是改冻结契约。本文只落实。

### 6.2 `dice_result` 帧与 HTTP 响应的字段（**同一套名字**）

**(a) A 入口（作家 / 角色调用）** —— 帧由 `tool_execution_end` 产生，`event-bridge.mapEngineEvent` 消费工具 `details`：

```ts
// event-bridge.ts 新增分支（形状归 12；这里是 07 要求的字段）
if (event.toolName === 'roll_dice' && !event.isError) {
  const d = event.result?.details ?? {};
  push({
    type: 'dice_result',
    source,                       // 'writer' | 'character'
    path: d.path,
    name: d.name,
    dice: d.dice,
    desc: d.desc,
    expect: d.expect,
    result: d.result,
    passed: d.passed,
    rolls: d.rolls,               // 演骰面
    crit: d.crit,                 // 大成功大标
    fumble: d.fumble,             // 大失败大标
    forged: d.forged,             // god 伪造：只显示总和、不画单骰面
    layer: d.layer,
  });
}
```

依据：`tool_execution_end` 的 `result` 整块带 `details`（`vendor/pi-rp/packages/agent/src/agent-loop.ts:767-775` 与 `:785`：`details: finalized.result.details`），`DiceRoller` 已经在读 `details`（今天经 HTTP，将来两条路同形状）。

**(b) C 入口（玩家点击）** —— 帧不存在（HTTP 没有 WS 通道），前端从**响应体**拿同样的字段：

```jsonc
// 200 OK —— POST /api/dice { path }
{ "ok": true, "path": "world/manor/cellar-door.md", "name": "The Cellar Door",
  "result": 62, "passed": true, "rolls": [62], "crit": false, "fumble": false, "forged": false,
  "layer": "world/manor",
  "event": { "seq": 42, "id": "evt-42", "type": "roll_resolved", "…": "…" } }
```


**god 伪造的 `rolls` 只含总和**：`forcedResult` 给定后 `result = forcedResult` 且 `rolls = [forcedResult]`（§3.1 步骤 7），它不是逐颗骰面——一个声明 `2d6` 的检定被伪造成 7 时，`rolls` 是 `[7]` 而不是两颗骰。前端 MUST 按 `details.forged === true` **只显示总和、不画单骰面**（否则会把 `[7]` 当成一个 7 面骰的骰面）。`forged` 是为这个分支加的演出标记，与事件里的 `actor_type='god'` 同源（§5.1 已说明事件本身不加该布尔）。
**两条路的字段名逐字相同**（响应体 = `ActionResult.details` 的展开，`01 §11.2`）。前端因此只需要一个"骰子结算对象"类型，不必区分来源。

**`details.event` 与尾部读表是同一行的两副本**（`01 §11.2`）：前端**必须按 `event.id` 去重**，否则一次掷骰会演两遍。

### 6.3 前端要的契约变更（**归前端计划，本文只给判据**）

| 现状 | 要改成 | 证据 |
|---|---|---|
| `DiceRoller.tsx:152-154` POST `{filePath, rollType, expect}` | POST `{ path }` | `doc-20 §7` 禁止调用者提交 `type/expect`；`filePath` 名字也不对（`00 §2.1` 的路径参数一律叫 `path`） |
| `DiceRoller.tsx:121-126` 前端算 `result>=95`/`result<=5` | 读 `crit` / `fumble` | §2.2.7（`1d20`/`2d6` 全错） |
| `DiceRoller.tsx:46-51` `parseDiceVerdict` 只认 `{result, passed}` | 放宽到可选 `rolls/crit/fumble`，仍是边界守卫 | 响应体变宽了；守卫该保留（它是防"服务端返回畸形 JSON"的） |
| `fm.tsx:122-132` 把整个 `roll_dice` 对象展开进 `rollDice` prop | 无变化 | `dice.desc` / `dice.expect` / `dice.result` / `dice.passed` 都仍在 |
| `useWorld.ts:207-208` 注释 "…roll_resolved ignored here" | 加 `case 'world_event'`：若 `event.type === 'roll_resolved'` 就 `fetchLayer` | 帧名改 `dice_result` 后，事件只在 `world_event` 里来；不处理就**骰子卡永远不显示别人掷出的结果**（§11 冲突 3） |
| `DiceRoller` 的"已有 result 就不进仪式"（`:59-63`） | 保持 | 与 §3.3 的门禁同源——UI 允许点、引擎返回 409 是两套判定，必须在同一处收敛 |

**`DiceRoller` 不用大改**：它已有全屏压暗、蓄力条、1.2s 翻滚、crit 金光 / fumble 猩红（`doc-19 §3.3` 的全部要素，`前端改造计划 §0.2` 记 T2.3 已达成），只需把"谁算 crit"从它手里拿走、把请求体缩成 `{path}`。这是本文刻意守住 `doc-19 §3.3` 演出强度的地方。

### 6.4 演出时序（与 `doc-19 §3.3` 对齐，不需要新机制）

```text
玩家按住骰子卡 → 蓄力条 + 音高升高（前端，DiceRoller.startCharge）
  → 释放 → 立刻 POST /api/dice（**权威点数先定**）
  → 同时开始 1.2s 翻滚动画 + dice-roll 拟音
  → 两者都完成才结算（DiceRoller.tsx:113 settleIfReady 已经这么写）
  → result/passed/rolls/crit/fumble 落地 → 大标 + 全屏震颤 + 湿墨旁白
```

**两条从 `doc-06`/`前端改造计划` 继承的硬纪律**（`前端改造计划 §T2.3` 引 `app/docs/ARCHITECTURE.md`）：

1. **权威点数先由服务端定，滚动只是视觉；蓄力与翻滚都不得参与判定。** 本文的实现正好满足——`rollDice` 在 HTTP 响应里就返回了 `result`，动画只是等它（`DiceRoller.tsx:74-77` 的 `pendingRef` 与 `settleIfReady` 就是为此写的）。
2. **跳过演出不改变任何已判定的结果**（`前端改造计划 §T2.0` 的 `skip` 语义："不撤销已提交的命令、不重掷骰子"）。`rollDice` 已经落了盘与账，动画只是回放。

**A 入口没有"蓄力"**：作家/角色调用时玩家不在场，`dice_result` 帧应该**直接演结算**（骰子翻滚 + 大标），不要一个需要按住的蓄力条——没有手去按。这需要 `DiceRoller` 支持一个"免蓄力"模式（归前端计划；判据就是"这条帧的 `source` 是 `writer`/`character` 时跳过 `charging` 相位"）。

---

## 7. 错误与边界

### 7.1 失败模式全表

`ActionErrorCode` 全部取自 `01 §2.4`（**本文不新增 code**；`dice_forced_not_allowed` 是 01 应本文请求加的）。

| # | 情形 | code | HTTP | 事件 |
|---|---|---|---|:--:|
| 1 | `path` 空 / 非字符串 | `invalid_argument` | 400 | ❌ |
| 2 | 路径绝对 / 含 `..` / 反斜杠 / 保留前缀 | `invalid_path` | 400 | ❌ |
| 3 | 文件不存在 | `not_found` | 404 | ❌ |
| 4 | 路径是目录 | `not_found` | 404 | ❌ |
| 5 | 无 frontmatter 块 | `malformed_entity` | 422 | ❌ |
| 6 | 无 `roll_dice` 字段 | `not_interactive` | 422 | ❌ |
| 7 | `roll_dice` 缺 `desc` / `expect`（归一化后为 null） | `not_interactive` | 422 | ❌ |
| 8 | `type` 不可解析（`1d100x`） | `invalid_field_value` | 422 | ❌ |
| 9 | `expect` 不可解析（`>abc`） | `invalid_field_value` | 422 | ❌ |
| 10 | 已有 `result`，非 god | `dice_already_rolled` | 409 | ❌ |
| 11 | 非 god 传 `forcedResult` | `dice_forced_not_allowed` | 403 | ❌ |
| 12 | `forcedResult` 非整数 | `invalid_argument` | 400 | ❌ |
| 13 | `forcedResult` 越出 `diceRange` | `invalid_argument` | 400 | ❌ |
| 14 | 原子写失败（磁盘/权限） | `write_failed` | 500 | ❌（原文件未动） |
| 15 | `appendEvent` 失败 | `event_failed` | 500 | ❌（**文件已改**，§5.3） |
| 16 | 其它意外（YAML 解析器内部错等） | `internal` | 500 | ❌ |

> ⚠️ **`01 §7.1` 的 `HTTP_STATUS` 表漏了 `dice_already_rolled`**（类型是 `Record<ActionErrorCode, number>`，会因此编译不过；实测枚举 17 项、表 16 项）。**已裁决（REVIEW B-1）：`01` 补 `dice_already_rolled: 409`**。登记在 §11 冲突 4。

### 7.2 精确错误文案（英文，逐字）

```text
Path must not be empty
File "world/inn/nope.md" not found
"world/inn/door.md" has no YAML frontmatter block
"world/inn/door.md" declares no roll_dice check
"world/inn/door.md" declares roll_dice but is missing "expect"
roll_dice.type "1d100x" is not a valid NdM[±K] expression
roll_dice.expect ">abc" is not evaluable; expected e.g. ">50", ">=60", "<30", "=50", "41..60", ">=40 && <=60", ">80 || <20"
"world/inn/door.md" already has a rolled result (62, passed); edit the file to remove it, then roll again
A forged dice result requires actor 'god', got 'writer'
forcedResult must be an integer, got 62.5
forcedResult 120 is outside the range of 1d100 (1..100)
Failed to write "world/inn/door.md": <cause>
File "world/inn/door.md" was updated with result 62 but the world event could not be recorded: <cause>
```

与 `01 §7.2` 的关系：路径类 / `near` 类 / 无 frontmatter / 骰子声明坏 / 骰子类型坏 / expect 坏 / 伪造结果 / 伪造值越界 这 8 条**逐字来自 `01 §7.2`**（01 的表就是应本文请求写的）；本文补了"无 `roll_dice` 字段"、"已掷"、"落盘失败"、"落账失败"四条，其中后两条的 `<cause>` 是 `01 §2.4` 的 `ActionError` 形状。

**纪律**（沿用 `01 §7.2`）：每条文案 MUST 带**具体路径/参数值**。`Not found` 这种无主语的句子会让模型在下一轮盲目重试。

### 7.3 边界情形的逐一裁决

| 情形 | 裁决 | 理由 |
|---|---|---|
| `path` 指向目录（`world/inn`） | `not_found`（不是 `invalid_path`） | 目录是**合法**的路径；只是它不是骰子实体。`invalid_path` 留给"路径本身不合规范"（绝对路径、`..`） |
| `path` 指向 `README.md` | 允许（只要它声明了 `roll_dice`） | `00 §2.4` 禁止的是**移动** README，不是读它。README 是 gate 的实体，`gate` 是完全合法的骰子宿主（`06` 的 `choice` 同理） |
| `path` 指向 `player/**` 或 `characters/<id>/**` | 允许 | 任意实体都能声明骰子（`doc-20 §2`）。事件 `layer` 为 `null`（`01 §3.9`），角色侧层窗口看不到（`doc-22 §3.2`） |
| `type` 有而 `desc` 空 | `not_interactive`（归一化后 `roll_dice` 为 null） | `desc` 是演出文案与事件 `detail` 的必需字段（`00 §5.2`）；空的 `desc` 让声明的 `roll_dice` 归一化失败，视同"没有骰子声明"（06 §3.3/§7.1 口径） |
| `expect` 有而 `type` 缺 | `type` 走 `RollDiceSchema` 的 `.default('1d100')`，**合法** | 06 冻结的 schema 就是 `.default('1d100')`；这是唯一一个"可以缺"的字段 |
| 同一实体的 `roll_dice` 块被手写坏（行内 YAML） | `patchRollDiceResult` 抛 → `malformed_entity` | 见 §2.2.8 要点 1。**不猜**——猜错会改写作者的整个 frontmatter |
| 文件在读取与写入之间被另一方改了 | 不做乐观锁（后写者赢） | `01 §7.3`：动作层不加锁，与"文件即真相"一致。**登记**：one-file 并发重掷的窗口极小（§12 第 2 项） |
| `forcedResult` = 区间内的合法值但 actor 是 `player` | `dice_forced_not_allowed`（403） | 门禁在"调用者身份"，不在"值合不合法" |
| `forcedResult` 给了但文件里已有 `result`，actor 是 `god` | 放行（覆盖） | §3.3 |
| 实体在 `roll_dice` 之外没有其它互动字段 | 正常 | 骰子与 `choice`/`status` 互相独立（`doc-20 §2`） |
| `expect` 是全 0 星号等怪异但合法的组合（`0..1000`） | 合法，永远 `passed` | 语法上合法就接受。**"永远通过的检定"是作者的意图，不是引擎的错**——但 `doc-05 §3.1` 已经把"剧情判定"排除在骰子外，这种声明应当由提示词劝阻 |
| 掷出 `result` 后玩家立刻再点 | 409（`dice_already_rolled`） | §3.3；UI 侧 `DiceRoller` 的"已有 result 不进仪式"（`:59-63`）已经先拦一道 |

### 7.4 与路径纪律的关系（`00 §2.1`）

`path` MUST 是**世界根相对路径**（`world/manor/cellar-door.md`），经 `store.resolvePath`（`01 §7.3` 的收紧版）。`roll_dice` 不自己拼绝对路径（`00 §2.1` 明文）。绝对路径、`../`、反斜杠、保留前缀（`.airpworld/`、`node_modules/`、点开头）一律 `invalid_path`——**这是 `01` 唯一与"权限"有关的检查，且它防的是路径语义错误，不是身份门禁**（`doc-20 §1.1`）。

---

## 8. 代码落点（精确到文件与函数）

| 文件 | 函数/导出 | 改动 | 归属 |
|---|---|---|---|
| `packages/shared/src/rules/dice.ts` | `parseDiceType` / `parseExpect` / `evaluateExpect` / `diceRange` / `rollOnce` / `patchRollDiceResult` / `EXPECT_RE` / 全部类型 | **新建**（§2.2）。零依赖 | 07 |
| `packages/shared/src/actions/roll-dice.ts` | `rollDice` + `RollDiceInput` / `RollDiceDetails` | **新建**（§2.1、§3） | 07 |
| `packages/shared/src/actions/service.ts` | `createActionService` | 绑定 `rollDice`（`01 §2.6` 已预留，无改动） | 01 |
| `packages/shared/src/index.ts` | — | 加 `export * from './rules/dice.js'`（`01 §8` 已列；**01 拥有该文件的编辑权**，本文不碰） | 01 |
| `extensions/toolkit/roll-dice.ts` | `registerRollDice(pi)` | **新建**（§2.3） | 07 |
| `extensions/tools.ts` | 注册入口 | 调 `registerRollDice(pi)`（归 12 的统一注册骨架） | 12 |
| `apps/server/src/routes/world.ts` | `POST /dice`（344-397） | **整段重写**：删掉自己算骰面（`:357`）、自己解析 expect（`:360-369`）、自己 `stringifyChalk`（`:379`）、自己 `appendWorldEvent`（`:382`）、自己广播 `roll_resolved`（`:390`）；改成 `createActionService(store, actor, {turn:'req:'+uuid}).rollDice({ path, forcedResult })` + `ActionError.toHttp()` + `dice_result` 帧 | 12 |
| `apps/server/src/engine/event-bridge.ts` | `mapEngineEvent`（`tool_execution_end` 分支） | 加 `roll_dice` → `dice_result` 帧（§6.2）；**不改** `.airpworld` 过滤（那是 12 的 `watchWorld`） | 12 |
| `apps/web/src/components/narrative/DiceRoller.tsx` | `parseDiceVerdict` / `settleIfReady` / fetch body | 见 §6.3 表 | 前端计划 |
| `apps/web/src/state/useWorld.ts` | `ws.onmessage` | 加 `world_event` 分支（§6.3） | 前端计划 |

**本文不新增任何 action 方法**（`01 §5` 的方法表够用）；不新增事件类型（`roll_resolved` 已在十五个里）；不新增 `ActionErrorCode`（`dice_forced_not_allowed` 已由 01 加）。

### 8.1 实施顺序（依赖方向）

```text
1. rules/dice.ts（纯函数 + 单测 §10.1）      ← 无依赖，先做
2. actions/roll-dice.ts（调 1 + store）      ← 依赖 1 与 01 的 store/appendEvent
3. extensions/toolkit/roll-dice.ts（工具壳） ← 依赖 2 与 12 的 toolkit helper
4. routes/world.ts 收编 /dice                ← 依赖 2 与 12 的 service 装配
5. event-bridge.ts 加 dice_result 分支       ← 依赖 3（工具 details）
6. 前端改请求体与 crit/fumble               ← 依赖 4/5
```

**第 1 步可以立刻做且能独立验收**（`node --test` 跑纯函数），这是本文刻意把解析器抽成 `rules/` 的原因之一。

---

## 9. 与现存实现的差异

### 9.1 逐项对照（现状均带 `文件:行`）

| 位置 | 现状 | 要改成 | 迁移影响 |
|---|---|---|---|
| `routes/world.ts:344-397` | 整段 `/dice`：自己掷、自己解析、自己回写、自己落账、自己广播 | 全部删，改调 `rollDice` | 前端 `DiceRoller` 的请求体与响应字段变（§6.3）；响应从 `{ok,result,passed}` 变成完整 `RollDiceDetails`（超集，不破坏） |
| `routes/world.ts:357` | `Number(rollType.split('d')[1]) \|\| 100`——**只按第一段 `d` 之后取整** | `parseDiceType` | `2d6` 今天被算成 `1d6`（`split('d')[1]` = `'6'`），且 `rollType` 来自**请求体**（可被调用者篡改）→ 与文件漂移。修好后骰子由文件决定 |
| `routes/world.ts:360-369` | 正则抠第一个数字当阈值 + `startsWith` 判运算符；**无法解析则默认阈值 50** | `parseExpect` + `evaluateExpect` | `>abc` 今天静默变成 `>50`；修好后 `invalid_field_value`。**这是"失败不静默"（00 硬约束 4）最直接的一处兑现** |
| `routes/world.ts:362` | `expect.match(/(\d+)/)` 取**第一个**数字 | `parseExpect` | `>=40 && <=60` 今天只取 `40`，`&&` 后半段被忽略——一条"40 到 60 之间"的声明变成"≥40"。修好后语义正确 |
| `routes/world.ts:365-369` | 不支持 `41..60` / `!=` / `&&` / `\|\|` / 裸数字以外的任何形式 | 完整语法（§2.2.1） | 老写法（`>50` 等）**全部仍然合法**，无需迁移任何现有模板（实测 `templates/` 5 处全是 `>NN`，§9.1） |
| `routes/world.ts:357` | `rollType` 默认 `'1d100'`（请求体兜底） | 从文件读 `type`（`.default('1d100')` 由 06 的 schema 提供） | 请求里不再有 `rollType`（§2.4） |
| `routes/world.ts:379` | `stringifyChalk(frontmatter, body)` **全量重发整个 frontmatter** | `patchRollDiceResult` | 实测会重排、JSON 化、吞掉 `bg` 的行内注释（§2.2.8）；修好后**只改两行** |
| `routes/world.ts:380` | `store.writeFile`（截断写） | `store.writeFileAtomic` | `fs.watch` 不再可能看到半截文件（§4.2） |
| `routes/world.ts:382-388` | `appendWorldEvent('roll_resolved', {filePath, rollType, expect, result, passed})`——**无 `actor`、无 `layer`、无 `subject`、无 `turn`；字段名是 `filePath`/`rollType`** | `appendEvent`（`01 §2.7`） | 字段名必须换成 `00 §5.2` 的 `path`/`dice`/`desc`/`expect`/`result`/`passed`。旧行（history.db 里已有 4 条 `roll_resolved`）**不迁移**（`doc-21 §7`：世界目录还没真实存档，直接改 `CREATE TABLE`） |
| `routes/world.ts:395` | 错误全变 500 + `err.message` | `ActionError.toHttp()` | 409/422/403 的语义今天全丢成 500，前端无法区分"已掷"与"崩溃" |
| `routes/world.ts:390` | 广播 `{type:'roll_resolved', event, result, passed}` | `{type:'dice_result', …}` + 事件走 `world_event` | `00 §5.3` 冻结；前端 `useWorld.ts:207-208` 今天明确忽略它（注释写着），所以**改名不破坏任何现有消费** |
| `packages/shared/src/schemas/frontmatter.ts:3-9` | `RollDiceSchema` 在 `ChalkFrontmatterSchema` 里（chalk 专属） | 由 06 抽成实体通用（形状不变） | 本文引用它，不修改（06 §2.2 已定） |
| `packages/shared/src/schemas/frontmatter.ts:108-117` | `parseFrontmatter` 手写 YAML-lite，`roll_dice` 块硬编码 4 空格无关的 `indexOf(':')` | 06 换成真 YAML 解析器 | 本文的 `patchRollDiceResult` **不依赖解析器**（它按行改），所以两件事可以分别落地 |
| `packages/shared/src/schemas/frontmatter.ts:135-139` | `stringifyChalk` 写 `roll_dice` 子键用 **4 空格** | 06 定"统一 2 空格"（`stringifyChalkFile`） | 与本文无关（本文不调它），但历史文件里的 4 空格会被 `patchRollDiceResult` 正确保留（§4.3） |
| `apps/web/src/components/narrative/DiceRoller.tsx:121-126` | 前端算 crit/fumble（阈值写死 95/5） | 读 `details.crit`/`details.fumble` | §2.2.7 |
| `apps/web/src/components/narrative/DiceRoller.tsx:151-155` | POST `{filePath, rollType, expect}` | POST `{path}` | §2.4；今天的 `rollType`/`expect` 完全无视文件内容，是"两份真相"的活体标本 |

### 9.2 旧事件行的处置

`templates/holmes-world/.airpworld/history.db` 里已有 4 条旧格式 `roll_resolved`（`{"filePath":…, "rollType":…, "expect":…, "result":…, "passed":…}`）。**不迁移、不重写**：

- `doc-21 §7` 明文"世界目录还没有真实存档 → 直接改 `CREATE TABLE`，不写迁移脚本"；
- 旧行在 `detail` 里缺 `path`/`name`/`dice`/`desc`，任何按新形状渲染的渲染器都会渲染出一句缺主语的假话。**它们属于"B0 之前的史前记录"**，历史面板（`doc-16`，赛后）读到时可以按 `detail.path == null` 跳过。
- 模板目录会随 `pnpm scaffold` 复制到新世界。**建议在 01 的建表迁移里顺手清空 `templates/*/.airpworld/history.db` 的 `events` 表**（模板不是存档）。

### 9.3 与 `doc-20 §12` 实现落点表的对照

`doc-20 §12` 写"`apps/server/src/engine/` 注册工具并注入调用者身份"——本文的实现落点比它更具体：工具在 `extensions/toolkit/roll-dice.ts`（`00 §6.1` 的文件布局），身份来自 `AIRP_AGENT_ROLE`（`00 §3`，`launch.ts` 注入，归 12）。`doc-20 §12` 的那句话是 B0 时代的口径（当时以为工具注册在 server），**以 `00 §6.1` 为准**。这不构成冲突——`doc-20` 自己的 §12 表里后来也写了 `extensions/tools.ts`。

---

## 10. 验收与测试

### 10.1 纯函数单测（无 I/O，**必须写**，`01 §12.1` 已把 `expect` 解析器列为判据）

**测试设施**：仓库现在**没有任何自测**（`find` 无 `*.test.*`，`package.json` 无 vitest/jest）。02 已提出用 `node --test`（Node 内建、零依赖）跑 `packages/shared/test/*.test.ts`。本文沿用该方案（**不新建第二套测试设施**）；`rules/dice.ts` 零依赖，因此**不需要 tsx/jiti 之外任何东西**。

| # | 目标 | 判据 |
|---|---|---|
| 1 | `parseDiceType` 用例表 | §2.2.4 全 30 例的 `ok` 逐一断言 |
| 2 | `parseExpect` 用例表 | §2.2.5 全 35 例的 `ok` 逐一断言 |
| 3 | `evaluateExpect` 判定表 | §2.2.6 全 20 例的 `passed` 逐一断言 |
| 4 | 正则与解析器的一致性 | §2.2.2：`parseExpect(raw).ok ⇒ EXPECT_RE.test(raw)`，在穷举语料上（本文实测 69,905 串、0 违例） |
| 5 | `diceRange` | `1d100` → `{1,100}`；`2d6+2` → `{4,14}`；`2d10-1` → `{1,19}`（实测 `2d6+2` = `{min:4,max:14}`） |
| 6 | `rollOnce` 确定性 | 注入固定序列 `[0, 0.5, 0.9999999]` → `1d100` 首次 = `rolls:[1], result:1, crit:false, fumble:true`（实测） |
| 7 | `rollOnce` 边界 | `rng()===0` → 最小面；`rng()→1⁻` → 最大面（`1d6` 的 6，不是 7） |
| 8 | `rng()` 越界 | `rng()===1` → `RangeError`（实测） |
| 9 | crit/fumble 表 | §2.2.7 的 9 例：`1d100`→`[100]`/`[1]`/`[96]`；`1d20`→`[20]`/`[19]`；`2d6`→`[6,6]`/`[6,5]`；`3d6`→`[1,1,1]`；`4d6+2`→`[6,6,6,6]`（实测全过） |
| 10 | `patchRollDiceResult` 外科手术 | 对 `evening.md` 原文：结果与原文**逐行只差两行**；删掉那两行后与原文字节相同（实测通过） |
| 11 | `patchRollDiceResult` 幂等/反复 | `patch(patch(raw,62,true),7,false)` 的两行分别是 `result: 7` / `passed: false`（实测） |
| 12 | `patchRollDiceResult` 追加 | 对无 `result`/`passed` 的文件（`cthulhu/opening.md`）追加到块尾、缩进 2 空格、不碰 `choice`/`status`（实测） |
| 13 | `patchRollDiceResult` CRLF | CRLF 文件保持 CRLF 且无 `\r\r\n`（实测） |
| 14 | `patchRollDiceResult` 路径的坏输入 | 无 frontmatter / 无 `roll_dice` 块 / 行内 YAML → 抛（各一条） |
| 15 | **回写后的值类型**（这条是 `patchRollDiceResult` 的存在理由） | 把 §2.2.8 的 `patchRollDiceResult` 结果用**标准 YAML 库**读回：`roll_dice.result` 是 `number`（不是 `"62"`）、`passed` 是 `boolean`；同一文件走 `stringifyChalk` 时这两者是字符串（实测） |
| 16 | **`stringifyChalk` 的退场**（回归防线） | 断言生产代码里没有 `stringifyChalk` 的调用点（§10.5 判据 3）；保留一条测试记录它写出的 YAML 对含引号 `choice` 会解析失败（实测），以防有人"顺手复用" |

**本文的全部表格都是实测产物**（不是设计意图的推演）：§2.2.4（30 例——`1D100` 与 `20d1000+10000` 是在这一轮把 `modifier` 正则从 `\d{1,4}` 提到 `\d{1,5}` 并给 `d` 加 `i` 标志后才成立的）、§2.2.5（35 例）、§2.2.6（20 例）、§2.2.7（9 例）、§2.2.2（69,905 串穷举，必要条件 0 违例）、§2.2.8（5 组不变式 + 4 组坏输入 + 4 空格缩进文件）、§2.2.3（TypeBox 的 `additionalProperties` 行为：默认**接受并丢弃**多余属性，实测三组）、§2.2.8（`stringifyChalk` 的五个后果，用 `yaml@2` 读回验证）。**实现时这些表就是测试用例，逐行抄。**

### 10.2 动作层单测（临时目录 + 真 SQLite，`01 §12.2` 的形状）

| # | 场景 | 判据 |
|---|---|---|
| 1 | 正常掷（`rng` 定序列） | 文件里 `roll_dice.result === 62` 且 `passed` 正确；`history.db` 多一条 `roll_resolved`，`detail` 七个字段齐、`detail.name` 是 `title`（不是文件名） |
| 2 | 再掷一次 | `dice_already_rolled`（409），且**事件表只多了一条**（`01 §12.3` 第 3 条已把这条列为探针判据） |
| 3 | `forcedResult` + `actor:{type:'player'}` | `dice_forced_not_allowed`（403），**文件未改、无事件** |
| 4 | `forcedResult: 7` + `actor:{type:'god'}` | 文件 `result === 7`；事件 `actor_type === 'god'`；行为与人话文本含 "forged" |
| 5 | `forcedResult: 120`（`1d100`） | `invalid_argument`（400），文案含 `1..100` |
| 6 | 无 `roll_dice` 的实体 | `not_interactive`（422），无事件 |
| 7 | `expect: ">abc"` | `invalid_field_value`（422），文案含 `">abc"`，**无事件、文件未改** |
| 8 | 写盘失败（只读目录） | `write_failed`（500），**原文件字节不变**；`writeFileAtomic` 的临时文件被清掉 |
| 9 | `appendEvent` 失败（伪造一个抛错的 store） | `event_failed`（500），**文件已改**（断言 `result` 已写入）——把"不补偿"这个决定锁进测试 |
| 10 | 其它键未被触碰 | `evening.md` 的 `choice` / `status` / `type` 与原文逐字节相同；`bgStyle` 块（README 场景）也一样 |

### 10.3 端到端探针（`tools/probe-writer.mjs` 加一步）

现有探针（`pnpm probe`）已经会 spawn writer、断言 preset 解析、`LocalWorldStore` 读写、`parseFrontmatter`。**加 Probe 5：骰子全链路**：

```js
// 1. 直接在 store 上跑动作层（不必起 agent，快且确定）
const svc = createActionService(store, { type: 'player' }, { turn: 'probe', rng: seqRng([0.61]) });
const r = await svc.rollDice({ path: 'world/baker-street/evening.md' });
assert(r.details.result === 62 && r.details.passed === true, 'rng 序列 0.61 → 1d100 掷出 62');
// 2. 文件真的被改了，且只改了两行
const after = await store.readFile('world/baker-street/evening.md');
assert(after.includes('result: 62') && after.includes('passed: true'));
assert(after.replace(/^\s*result: 62\n|^\s*passed: true\n/gm, '') === rawBefore, '除此之外逐字节不变');
// 3. 事件真的落了，且 detail 自足
const ev = (await store.getEvents(1))[0];
assert(ev.type === 'roll_resolved' && ev.detail.path === 'world/baker-street/evening.md');
assert(typeof ev.detail.name === 'string' && ev.detail.name.length > 0);
// 4. 重掷被拒，且没有多落事件
const n = (await store.getEvents(100)).length;
await assert.rejects(() => svc.rollDice({ path: 'world/baker-street/evening.md' }), /already has a rolled result/);
assert((await store.getEvents(100)).length === n, '失败不落事件（doc-21 §3.6）');
```

**这四条是"叙事主循环的骰子支线没坏"的唯一硬判据**：掷出 → 落盘 → 落账 → 不重掷，全程确定（注入 `rng`）。

### 10.4 手测场景（演示动线）

| 场景 | 期望 |
|---|---|
| 玩家在 holmes-world 点「Roll the Dice」（`world/baker-street/evening.md`，`>50`） | 全屏仪式 → 翻滚 1.2s → 落定显示点数与 Check Passed/Failed → 卡片显示结果，按钮消失 |
| 同一张卡再点 | 没有按钮可点（`DiceRoller:59-63` 的 `rolled` 早退） |
| 上帝模式伪造（`forcedResult: 100`） | 金光大标（`1d100` 的 100 是 crit）；历史面板那条带 god 标签 |
| 让作家在同一轮里对一个未掷的实体调 `roll_dice` | 画布上**立刻**演一次结算（`dice_result` 帧），不需要玩家按任何东西 |
| 把 `expect` 改成 `>=40 && <=60` | 掷出 62 → Failed（旧实现会判 62 ≥ 40 → Passed，行为差异可见） |
| 把 `type` 改成 `2d6`、`expect` 改成 `>=10` | 掷出两颗骰的和，演出显示 `rolls` |

### 10.5 评审可读性判据

1. **`/dice` 路由里不再有任何随机数、任何 `expect` 字符串处理**（`grep -n 'Math.random\|expect' apps/server/src/routes/world.ts` 在 `/dice` 段落里为空）。
2. **`roll_dice` 这个字符串在 `apps/server/` 里的出现次数 == 1**（event-bridge 的帧映射）。
3. `grep -rn 'stringifyChalk' apps/ packages/ --exclude-dir=node_modules` 在生产路径里为空。
4. §2.2.4 / §2.2.5 两张表的每一行都能在 `test/dice.test.ts` 里找到同名断言。

---

## 11. 发现的冲突 / 需要修订的上位文档

| # | 两份/哪一句 | 为什么冲突 | 建议怎么改 | 状态 |
|---|---|---|---|---|
| 1 | `01 §11.2` 的 details 表 vs 本文 §2.2.7 | 01 冻结了 `rollDice: result/passed/dice/expect` 四个字段，而 crit/fumble 必须由引擎算（否则前端重解析 `NdM`，见 §2.2.7） | 该行补四个字段：`+ rolls: number[]`、`+ crit: boolean`、`+ fumble: boolean`、`+ forged: boolean`（`forged` 是本次新增，给 god 伪造的单骰面演出分支）。**01 已收工，请求未获答复**；报告 D-10 认作"B1 只需定帧契约（已定）"，故按本文已定形状落地 | **已定（报告未反对）** |
| 2 | `doc-20 §7`（"已有 `result` 拒绝再次投掷"）vs `doc-21 §4.3`（"上帝伪造结果仍走同一个 type"） | 若严格禁掷，god 的伪造入口必须先手改文件才能用，而手改（`edit`）走 B 入口、**B1 不实现**（`00 §4.2`），于是伪造路径落地即死代码 | 本文已在 §3.3 定案：**禁掷只对 `player`/`writer`/`character`，god + `forcedResult` 放行**。若评审不同意，需在 `doc-20 §7` 补一句"god 伪造结果时不受此限"，否则两份文档对同一情形给出相反规则 | **本文已裁决**，建议 `doc-20 §7` 补一句 |
| 3 | `00 §5.3`（帧名改 `dice_result`）vs `apps/web/src/state/useWorld.ts:207-208` | 前端**今天明确忽略** `roll_resolved`（注释写着），改名后事件只在 `world_event` 里来。若前端计划只改帧名映射、不给 `useWorld` 加 `world_event` 分支，**骰子卡永远不显示结果**（只有本机点击的那一次因为读了 HTTP 响应而显示） | 前端计划补 `case 'world_event'`：`event.type === 'roll_resolved'` 时 `fetchLayer(layerRef.current)`。**归前端计划**，本文只登记 | 需前端计划认领 |
| 4 | `01 §7.1` 的 `HTTP_STATUS` 表 vs `01 §2.4` 的 `ActionErrorCode` 枚举 | 类型是 `Record<ActionErrorCode, number>`，**枚举 17 项、表只有 16 项——缺 `dice_already_rolled`**，实现时 `tsc` 会直接报错（缺属性） | 补 `dice_already_rolled: 409,`。这是笔误级问题，但会让 01 的代码骨架第一次编译就失败 | **已裁决（REVIEW B-1）**：归 01，补 `dice_already_rolled: 409` |
| 5 | 本文 §2.2.1 的 EBNF（`ws = " " \| "\t"`）vs 实现（`raw.trim()`） | `String.prototype.trim()` 按 JS 规范的 WhiteSpace 表（含 NBSP U+00A0、行分隔符等），比 EBNF 宽。实测 `"1d100\u00a0"` 被接受 | 两条路：① 接受（现状），把 EBNF 改成 `ws = JS WhiteSpace`；② 严格化（`/^[ \t]+` 与 `[ \t]+$/` 两个锚定剥离）。**建议 ①**——宽容不可见字符比因它拒掉一个本来正确的声明实用。**若评审要严格，改的是 `rules/dice.ts` 一行** | 待评审拍板 |
| 6 | `doc-06 §2.6` / `doc-05 §3.1` 的 `roll_dice` 注释（"必须带引号"）vs 06 §11 冲突 5 | 两处都写"必须带引号"但**没说为什么**：`expect: >50`（无引号）在 YAML 里是**块标量头**，YAML 库静默给出空串——此时 `parseExpect('')` 报 `invalid_field_value`，而**作者看到的是"我的声明没错，引擎却说解析不了"** | 06 已认领（其 §11 冲突 5 建议给两处注释补一句理由 + `expect` 加 `.min(1)`）。本文的 §7.2 文案已经能指明"expect 是空的"，但**错误文案无法告诉作者"检查 YAML 引号"**——建议在 `malformed_entity`/`invalid_field_value` 的文案尾追加一句 `(unescaped YAML block scalars arrive empty; quote the expression)`。**归 06/01**，本文只登记 | 归 06 |
| 7 | `doc-20 §12` 表（"`apps/server/src/engine/` 注册工具"）vs `00 §6.1`（工具在 `extensions/tools.ts`） | B0 时代口径 vs 冻结契约 | 以 `00 §6.1` 为准（`doc-20 §12` 自己的表里也写了 `extensions/tools.ts`，所以只是同一张表内的措辞漂移）。**不需要改**，登记以免实现者照着 `apps/server/src/engine/` 找工具 | 登记 |
| 8 | `templates/*/.airpworld/history.db` 的旧 `roll_resolved` 行 | 4 条旧行的 `detail` 是 `{filePath, rollType, …}`，缺 `path`/`name`/`dice`/`desc`；新渲染器会渲染出缺主语的假话 | `doc-21 §7` 说不迁移。**建议模板里的 `events` 表直接清空**（模板不是存档，`pnpm scaffold` 会把它复制给每个新世界）。归 01 的建表迁移 | 归 01 |
| 9 | `doc-09` 待设计 #4（骰子演出节奏）vs `前端改造计划 §T2.3` | `doc-09` 把"骰子演出特效的节奏"列为待设计项，但前端计划已记 T2.3 **达成**（1.2s 翻滚、蓄力、crit/fumble 特效都在 `DiceRoller` 与 `index.css:610-729`） | `doc-09` 该条可以标"已实现，数值见 `前端改造计划 §T2.3` 与 `DiceRoller.tsx` 的 `CHARGE_MS/ROLL_MS/SETTLE_MS`"。**不改文档，登记**以免有人重新设计一遍 | 登记 |

**评审裁决回填（2026-09-12，源：`REVIEW-评审报告.md`）**：冲突 **4** 与报告 B-1 是同一处，**已裁决**——`01 §7.1` 补 `dice_already_rolled: 409`（归 01）。冲突 **5**（NBSP 宽容）报告未拍板，维持"待评审"。冲突 **1**（`details` 加 `rolls`/`crit`/`fumble`）报告 D-10 认作"B1 只需定帧契约（已定）"，本批未再裁，本文按已定形状保留并增补 `forged`（见 §6.2 的伪造单骰面说明）。冲突 **2**（god 覆盖）已在本文 §3.3 裁决，报告未反对。本批按报告改动的正文：`§2.3` 工具壳改 `resolveAgentActor(process.env[AGENT_ROLE_ENV])`（B-3）、`§3.1` 步骤 4 与 `§7.1`/`§7.3` 的归一化口径改 `not_interactive`（m-4，与 06 对齐）、`§8` 的方法数措辞去掉硬编码数字（m-9）。

---

## 12. 仍然未知 / 留给评审拍板的

1. **`details` 加 `rolls`/`crit`/`fumble` 是否获 01 接受**（§11 冲突 1）。**01 已收工，请求未获答复 → 评审裁决。** 若拒绝，退路是 `details.roll = { rolls, crit, fumble }`——仍然解决"前端重解析骰子表达式"的问题，只是形状不同。**两种形状都不阻塞实现**（前端只在 `update()` 里读一个字段名）。

2. **同一实体在两个进程同时掷**（`01 §7.3` 的并发决定）：本文不做乐观锁。窗口极小（两次掷骰之间要隔着一次 HTTP 往返或一次模型决策），且后果是"后写者赢"——一条 `roll_resolved` 的 `result` 与文件里的不一致。**若评审要求序列化**，最小修法是在 `LocalWorldStore` 加按路径的 `Map<string, Promise>` 串行队列（`01 §14` 第 6 条已登记同一问题）。**本文倾向不做**（一个演示单机游戏不需要），但要登记。

3. **`patchRollDiceResult` 是"按行改文本"还是"用 YAML 库改 AST"**：本文选按行（保真度最高、零依赖、与 06 换 YAML 解析器的决定**解耦**）。代价是：如果作者的 `roll_dice` 块里有**块标量**（`expect: |` 多行）或**锚点**（`&x`），按行改可能改错位置。**这两种写法本文不支持**（`expect` 是单行表达式；`desc` 也是），遇到时按"块内第一个子键的缩进"改仍会命中 `result`/`passed` 两行本身，**实测不会误伤**。但若将来 `roll_dice` 支持嵌套字段，需要重新评估。**登记为已知限制。**

4. **`crit`/`fumble` 的阈值是否要可配置**：本文定死"全最大面 / 全 1"。`doc-19 §3.3` 没有提阈值配置，而"可配置阈值"会把 `RollDiceSchema` 从五字段扩成六字段（违反 06 冻结）。**建议不做**；若某个题材要"12 以上算大成功"，那是 `expect` 的事（写 `>=12`，`crit` 仍表示骰面事实）。

5. **`expect` 是否该支持引用 `status.data`**（如 `>status.difficulty`）：**不做**。`doc-05 §3.1` 的"剧情判定写正文"已经排除了这个方向，且它会让 `rules/dice.ts` 依赖 `status` 的解析（引入依赖、破坏零依赖纪律）。**登记为明确不做**。

6. **`dice_already_rolled` 的文案要不要带**（§3.3 已定）**以及要不要提供一个 `roll_dice({ path, reset: true })`**：本文明确不做 `reset`（理由见 §3.3 末）。若评审认为"玩家想重掷"是常见需求，正确的修法是**让作家用 `edit` 清掉旧结果**（那会落 `entity_edited`，历史可见），而不是给骰子工具开后门。**请拍板确认"不做 reset"。**

7. **`templates/` 里 5 处 `expect` 全是 `>50`/`>55`**（实测：`grep -rn "expect" templates/` 命中 5 处，全是 `>NN`）。语法扩展后**没有任何模板需要迁移**，但也没有任何模板**演示**新语法（区间 / AND）。是否要在演示世界（holmes-world 的某个场景）里放一个 `41..60` 或 `>=40 && <=60` 的骰子，让评委在现场看到"引擎真的在按复杂条件判定"？**本文建议加一处**（例如 `world/abandoned-orchard/evening.md` 改成 `>=40 && <=60`），但改模板内容**不在本文的实现范围**（世界内容先按 `doc-24-五世界可玩Demo体验设计` 评审后再细化）。**请评审决定。**

8. **`roll_resolved` 是否要在 `doc-22` 的"下一步"段里被特别对待**：`doc-12 #6` 要一段"未回应的玩家动作"祈使句（"掷出 14，这一结果还没有被叙事回应"）。骰子天然是"最需要被回应"的事件（`doc-12:32` 已经把 `roll_resolved` 列进触发条件）。**本文不实现注入**（归 B2/`doc-22`），只登记"骰子事件的注入优先级应当高于普通 `entity_edited`"这一判断。

**评审裁决回填（2026-09-12）**：第 2 项（同一实体并发掷）与报告 **D-4 DEFER** 同口径——B1 不做乐观锁，留实现期；第 8 项（骰子事件的注入优先级）报告归 **D-10 / 前端与 B2**，B1 只定帧契约。

---

## 13. 结构对照（`00 §7` 的 12 节 → 本文）

| `00 §7` | 本文 |
|---|---|
| 1 一句话与定位 | §1 |
| 2 签名与参数 | §2（含 §2.2 解析器全语法与 3 张用例表） |
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

**任务书四项验收自检**：① 裁决函数（三入口同源）→ §1 表 + §2.1 + §8；② `expect` 解析器完整语法 + ≥12 用例 → §2.2.1（EBNF）+ §2.2.2（正则）+ §2.2.4（30 例）+ §2.2.5（35 例）+ §2.2.6（20 例）；③ 掷骰规则（拒重掷/重开）→ §3.3；④ 真随机源 → §2.2.9；⑤ 工具只收 `path` → §2.3（`additionalProperties:false` 实测证据）+ §2.4；⑥ `roll_resolved` 全字段 + god 伪造 → §5.1 + §5.2 + §3.3；⑦ 演出 + 帧名落实 → §6.1 + §6.2 + §6.4；⑧ crit/fumble 归属 → §2.2.7（引擎算 + 三条理由）。
