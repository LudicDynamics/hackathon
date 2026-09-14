# 评审报告 — `06-前端与演出.md` + `10-事件与作家上下文.md`

> 评审人：`DullBooby`（独立评审，非设计者）。对象：`docs/command/06-前端与演出.md`（1057 行）、`docs/command/10-事件与作家上下文.md`（1144 行）。
> 冻结基准：`docs/command/00-共同上下文.md`（含 §10.14 两条效果名裁定）。核验快照：2026-09-14 工作树。
> 只读评审；发现的错误一律写进本报告，不改任何设计文档。

---

## 1. 评审判定

**`06-前端与演出.md`：有条件通过。** 设计意图、时序机制、四态复用、「毫秒级」的诚实性都成立且质量高（§4）。但有 **3 个阻断**（与 `05`/`10` 的形状冲突）与多处 `file:line` 已失效。

**`10-事件与作家上下文.md`：有条件通过。** 四处核心断言全部经我独立复现成立（§4）。阻断与 `06` 同源，另有 `events.ts` 合并规则区行号系统性偏移与一个悬空引用。

**合并阻断（两份共 3 条）：**

- **`B-1`（最重）`WorldCommandReceipt` 同名不同形，且两文各自声明同一新文件 `receipt.ts`。**
- **`B-2` `details.commands` 三份文档三套形状**（`05`/`06`/`10`）。
- **`B-3` `06 §2.2` 的 `command_log`/`command_error` 形状与权威方 `05 §2.2` 冲突**，而 `06` 自称「字段名与 `05` 对齐」。

**条件（通过前必须处理）**：`C-1` 行号失效；`C-2` 效果名/数量残留；`C-3` 悬空引用与表结构缺陷；`C-4` 量与证据等级、turn 引用的不一致。

---

## 2. 跨文档一致性核验

### 2.1【阻断 B-1】`WorldCommandReceipt` —— 两文同名、不同形、同一新文件

| | `06` | `10` |
|---|---|---|
| 定义 | `06:93-123` | `10:209-222` |
| 落点 | `packages/shared/src/commands/receipt.ts`（`06:28` NEW） | 同名同路径（`10:180` NEW） |
| 字段 | `id, status, settle, text, code?, params?, entryIndex?, steps: WorldCommandStepOutcome[], reveal, reusedEventId?, appliedBeforeFailure?` | `id, name, settle, effects: Array<{action, ok, event?: WorldEvent, error?}>` |

同一个导出名，一个含 `status/text/steps/reveal`，另一个含 `name/effects`；一个把事件 id 放 `steps[].eventIds: string[]`，另一个把**事件对象**放 `effects[].event: WorldEvent`。**两文都写 `receipt.ts` 是 NEW，且都未声明对方拥有它。**

这不是"视图不同"——是同一模块导出同名的两种不兼容形状，落地时只会实现一种，另一份的消费端静默拿到 `undefined`。

**判定**：`06`/`10`（及 `04`/`05`）必须指定该类型与 `receipt.ts` 的唯一所有者，另一份改为 `import` 或改名。**建议**：`10` 的 `effects[].event` 是渲染真源（`10:219,225`），让 `06` 消费它；或 `06` 显式声明自己消费的是另名的 `WorldCommandStepOutcome`。

### 2.2【阻断 B-2】`details.commands` —— 三份文档三套形状

| 文档 | 形状 |
|---|---|
| `05:488` | 建议 `Array<{id, ok, effects: [{action, ok, error?}]}>` |
| `10:209-222` | `Array<{id, name, settle, effects: [{action, ok, event?, error?}]}>` |
| `06:93-123` | `WorldCommandReceipts = WorldCommandReceipt[]`（含 `status/text/steps/reveal`） |

三者都指向 `ActionResult.details.commands`（`packages/shared/src/actions/types.ts:39` 核验：`details: TDetails & { event?: WorldEvent }`）。**必须先冻结 `details.commands` 的唯一形状**，三处引用改为指向它。

### 2.3【阻断 B-3】`06 §2.2` 持久形状与权威 `05 §2.2` 冲突

`06:149` 逐字：「形状的权威定义在 `05 §2.2`；下面是 `06` 渲染所依赖的那个子集，**字段名与 `05` 对齐**」。实际**不对齐**：

| 字段 | `05`（权威） | `06` | 差异 |
|---|---|---|---|
| 幂等键名 | `key`（`05:41`） | `commandKey`（`06:154,168`） | **键名不同** |
| `command_log[]` 状态 | `status: partial\|done`（`05:45`） | `settle: ran\|reused\|resumed\|failed`（`06:155`） | **字段名与取值域都不同** |
| `steps[]` 声明位 | `at`（`05:51`） | `decl`（`06:160-165,183`） | **键名不同** |
| `steps[]` 事件 | `event: string\|null`（`05:53`） | `eventIds: string[]`（`06:161-166`） | **标量 vs 数组** |
| `steps[].targets`/`.ok` | **不存在** | 必需（`06:182,184`） | `05` 无此二字段 |
| `command_error` 形态 | **单数对象**，`05:85` 逐字「单数，不是数组」 | **数组**（`06:167-175,185-189`） | **数组 vs 单数** |
| `command_error.pending` | `int`＝`do.length - steps.length`（`05:81`） | `boolean`（`06:174,189`） | **类型不同** |

**判定**：`06` 要么把 §2.2 的示例与表格改成 `05` 的字段名，要么删掉「字段名与 `05` 对齐」并改为「`05` 未定稿的前向请求」。**现状会让 `06` 的渲染代码在 `05` 的权威形状上全部读到 `undefined`，§2.2 表格的"缺省/非法时 UI 怎么做"整列失效。**

### 2.4 一致且正确的跨文档引用（核验通过）

- `06:385` 与 `10 §2.1/§11 冲突 2` 对 `detail.by` 的否决**完全一致**，与契约 §5.1 修订版一致。✅
- `06:379`/`10:675` 事件类型不新增、`detail.command` 为唯一判据——与契约 §5.2 一致。✅
- `10:155,750,770` 复用 `03` 的 `WORLD_COMMAND_EFFECT_BUDGET`（=24），与 `03:575` 一致。✅（但见 `C-4c`）
- `06:404-405,436` 不做 `command_result`/`choice_result` 新帧——帧名唯一真相源引用正确。✅

---

## 3. 契约冻结遵守核验

| 冻结项 | `06` | `10` |
|---|---|---|
| 不新增事件类型 | ✅ `06:379` | ✅ `10:675` |
| `detail.command` 唯一归属键、不用 `detail.by` | ✅ `06:382,385` | ✅ `10:36-46,679` |
| actor = 触发者 | ✅ `06:380` | ✅ `10:676` |
| turn 复用触发者 | ⚠️ `06:381` 引用了被 §10.7 证伪的「一个 HTTP 请求共享一个 turn」（见 `C-4b`） | ✅ `10:677`（`10 §3.6.3` 未依赖同 turn 合并） |
| 执行位置在动作层 | ✅ `06:299` | ✅ `10:15` |
| 能力集 ⊆ 动作层 | ⚠️ `06:81` 名单过期（见 `C-2`） | ⚠️ `10:217` 数量过期 |
| 不擅改契约 | ✅ 仅提回写建议（`06:302,917`） | ✅ `10:1032` 声明「由主 agent 回写」 |
| 不把 `[未拍板]` 写成既定 | ✅ `06 §12.1`、`10 §12.1` 保留标记 | ✅ |

**契约侧无实质违规。** 两份都严守了"提案而非擅改"。

---

## 4. 语义兑现 / 需求强度（任务书的 8 个重点）

### 4.1 重点 1 — 「毫秒级」诚实性：**兑现，本批次最诚实的一节** ✅

`06 §3.3`（`06:280-302`）**正面拆穿契约 §1.1**：分三个指标（引擎落盘 ①／同步回执 ②／整层重取 ③），逐条给量级与证据，结论「**只有前半段（落盘）在现状下自动成立；"玩家看到"走的是百毫秒级的整层重取**」，并给对契约的**具体改法**（`06:921-923`）。这正是契约 §1.2「快不是根本理由」留给 `06` 的空间。

**支点事实全部核验成立**：
- 重取确由 `case 'file_changed'` 与 `case 'world_event'` 触发（当前树 `useWorld.ts:428-429`/`:431-454`）；
- `event-bridge.ts:16` `TAIL_POLL_MS=1000`、`:18` `WATCH_DEBOUNCE_MS=150` ✅；
- HTTP 路由**确实不发演出帧**：`world.ts:1133` 逐字「The HTTP path sends NO presentation frame…」✅（`06 §11.2` 三入口裁决成立）。

> **`C-4a`**：`06:286` 给 ① 标 `[推断]，未 profile`，而 `03 §7.2/§7.3`（`03:641-644`）**给了实测表**（典型 `≈4 ms`、上限 24 效果 `≈29 ms`）并结论「毫秒级，但是**几十毫秒**」。两文对**同一个量**给了不同量级（个位数 vs 几十）与**不同证据等级**（未 profile vs 实测）。`06` 应改引 `03 §7.2`。

### 4.2 重点 2 — 三种结果 + 四态复用：**兑现** ✅

`06 §7.6`（`06:588-618`）对成功/执行失败/命令写错**各有完整 UI 描述**（三处共用同一位置与结构，只换 `tone`，`06:512` 说明这是为了让"回执出现了"成为可断言事实）。`06 §7.2`（`06:489-502`）把 6 个 `status` 映射进**现有四态**（已核 `action-feedback.ts:3` 逐字 `['accepted','conflict','rejected','failed']`），`06:836` 用 `assert.equal(ACTION_FEEDBACK_STATUSES.length, 4)` **机械禁止第五态**。**没有发明第五态。** ✅

`06 §7.1` 的"模型文案与玩家文案 MUST 是两个字符串"（`06:485`）+「`resumed` 有模型文案、无玩家文案」（`06:487`）是人机信息分层的正确落地。

### 4.3 重点 3 — 与骰子演出的时序合并：**兑现** ✅

`06 §3.1`（`06:227-260`）给完整 sequenceDiagram；`§3.4`（`06:325-351`）给逐毫秒数字表；`§8.3`（`06:685-739`）给 `reveal-gate` 完整签名与两处接线。**剧透窗口被正确识别**（`file_changed` 150ms / `world_event` 10~50ms 均早于 `ROLL_MS=1200`）。我核验 `ROLL_MS=1200`（`DiceRoller.tsx:6`）、`SETTLE_MS=1300`（`:7`）、`HIGHLIGHT_MS=800`（`DiceCeremony.tsx:29`）、`STILL_ROLL_MS=180`（`:25`）全部准确 ✅。

**自洽**：`WATCHDOG_MS=3500 ≥ ROLL_MS+SETTLE_MS=2500` ✅，`06:1009` 自认魔数并建议由常量计算——诚实。**§10.1 的非空性断言是真非空**：DOM 断言逐条覆盖 `reveal[]`，并给 `ROLL_MS=0` 反例防绕过（`06:791`）。✅

### 4.4 重点 4 — `10` 的 `excludeActor` 前提：**钉住且修复侧正确** ✅

独立核验：
- `inject/collect.ts:251` 逐字 `excludeActor: actor` ✅（`10:579` 准确）；
- `store/local-store.ts:745-748` 逐字 `NOT (actor_type = ? AND COALESCE(actor_id, '') = ?)` ✅（`10:580` 准确）；
- 冷启动 JS 侧同判据 `collect.ts:126` ✅（`10:590` 准确）。

**T5a/T5b 切分正确**：T5a（`10:897-910`）明写「修复前后都通过——它记录的是既有事实，价值是**钉住前提**」；T5b（`10:912-925`）才是本模块的修复。`10:927` 明确「"作家不重复发奖"是机制断言不是行为断言，E3 属实现批次」——**证据等级声明合规**。✅

### 4.5 重点 5 — `next-step` 回归修法：**我复现了 bug，修法成立** ✅

**独立复现**：`computeNextStep`（`next-step.ts:106-134`）逐行读：
```
111:  const tail = events.length > 0 ? events[events.length - 1] : null;
114:  const owed = tail && tail.actor?.type !== 'writer' ? INTERACTIVE_TAIL[tail.type] : undefined;
127:  if (owed !== undefined) return owed;
131:  if (facts?.unseenCreation === true …) return CASE_UNSEEN_CREATION;
132:  if (facts?.quiet === true) return CASE_QUIET;
133:  return '';
```
`INTERACTIVE_TAIL`（`:71-75`）只含 `choice_selected/use_item_on/roll_resolved`。以 `events=[roll_resolved, entity_created(command)]`：`tail=entity_created`→`owed=undefined`；掷骰不生成的层→`unseenCreation=false`；`quiet = window.events.length===0`→`false` → **`return ''`**。**与 `10 §3.7.1`（`10:434`）逐字一致。T1 的"修复前 = `''`"成立。** ✅

**修法成立**：`actTail`（跳过命令行回取 `roll_resolved`）+ `hasSettledCommand` + 序 `1′/1″`（`10:440-454`）逻辑闭合。`1″` 对"cap 折叠抹掉 act、只剩命令事件"用 `CASE_ACT_SETTLED` 兜底而不猜类型——**比退回 `CASE_QUIET`（说谎）或 `''`（整节消失）都诚实**，`10:458/460` 的论证成立。✅

### 4.6 重点 6 — 预算按 `list-args` **展开后**条数：**兑现** ✅

`10 §2.6`（`10:153-175`）明确「`10` 不定义自己的预算常量，直接引 `03` 的 `WORLD_COMMAND_EFFECT_BUDGET`」，给出量纲前提：**一个效果恒 ≤1 事件**，故展开后上界 = 效果数上界 = 24；并**把这条依赖写成硬约束**（`10:175`：若将来把 `list-args` 展开挪出预检期，守卫会静默失效）。这与契约 §10.11「MUST 按展开后条数算」**逐字对齐** ✅。`10:1080` 更把"预检期计入数组长度"的依赖显式登记。**这是对契约要求最完整的一处兑现。**

> **`C-4c`（次要）**：`10:159` 用 `import { WORLD_COMMAND_EFFECT_BUDGET } from '../commands/effects.js'`——而 `extensions/toolkit/roll-dice.ts:3` 的既有惯例是从 `'../../packages/shared/dist/index.js'` 导入。`10` 的路径是**包内相对导入**（`collect.ts` 位于 `packages/shared/src/inject/`），语法上自洽；但 `03` 未确认 `effects.ts` 会**导出**该常量（`04:1141` 列 `effects.ts` 的导出面时未含它）。`03`/`04` 需确认导出面。

### 4.7 重点 7 — 主语渲染模板是否符合 `events.ts` 风格 ✅

**符合。** 我核验：
- `events.ts:139-152` 的 `actorPhrase` 五个返回值确实**全部首字母大写**（`The player`/`The narrator`/`The world itself`/`the character "…"`/`The engine`）——**注意 `character` 分支首字母是**小写**（`the character "x"`）**，所以 `10:139-141` 的 `lowerFirst` 注释「All five `actorPhrase` returns start with a capital」**是错的**（第 4 个不以大写开头）。
- 但 `10:131` 的示例 `subjectPhrase({type:'character', id:'watson'}, 'x') -> 'The world, after the character "watson" acted,'` 恰好**没有**依赖 `lowerFirst` 处理既有小写（它是新拼的 `The world, after ` + 原样小写短语），所以**结果正确、注释错误**。
- **`C-3d`**：`lowerFirst` 若被真正用于 `character` 分支会产出错误文本（把 `the character "x"` 再降首字母还是 `the character…`，无害），但该函数对本用例**是死代码**。建议删掉 `lowerFirst` 或修正注释。

**风格一致**：`10:384` 指出 `layer_initialized` 逐字 `The layer "X" was instantiated by the ${by} (${n} files).`（已核 `events.ts:363`）——**"世界自己动过"确为既有语域**，"破坏沉浸"的担心的确不成立（注入块是事实块，非叙事文本）。`10 §3.6.4` 的"零回归面"（`subjectPhrase(a,null)===actorPhrase(a)`）是强保证。✅

### 4.8 重点 8 — 伪 helper / 假字段 / 不存在的符号

| 符号 | 判定 |
|---|---|
| `06` `parseCommandReceipts`/`receiptLine`/`receiptsFingerprint`（`06:204-214`） | 均标 `NEW`，落点 `06:664`。✅ |
| `06` `reveal-gate` 的 `deferReveal/releaseReveal/isRevealHeld/WATCHDOG_MS` | 均标 `NEW`，落点 `06:665`。✅ |
| `10` `commandOf`/`subjectPhrase`/`lowerFirst`/`actTail`/`hasSettledCommand`/`commandReceiptText` | 均标 `NEW` 带签名。✅ |
| `10` `CASE_CHOICE_SELECTED_SETTLED` 等四条（`10:255-258`） | 均标 `NEW`，`10 §3.7.3` 给逐字文本。✅ |
| **`10:701` 引用 `§7.3 的 `command_text``** | **❌ 悬空**：`10` 全文的 §7.3 是降级表（`10:709-723`），无 `command_text`；`docs/command` 全仓 grep `command_text` **零命中**。见 `C-3a`。 |
| **`10:52-68` `commandOf` 的判据含「`detail.by` is NOT consulted」** | 正确且与 §2.1 一致。✅ |
| **`06:124-131` 注释「没有 `commands` 键与 `commands: []` 是两件事」** | 概念正确；但 `06:128` 说「前者 = 这个实体没有声明 `on.<hook>`」——与 `10:1122` 的 `[C-10d]` 一致。✅ |

**结论**：**无伪造符号**。唯一的悬空引用是 `command_text`（`C-3a`）。

---

## 5. 闭环性

### 5.1【C-3a】`command_text` 悬空引用

`10:701` 逐字：「它没有面向玩家的文案（**§7.3 的 `command_text`** 是模型侧文案）」。
- `10` 的 §7.3 是降级表（`10:705-723`），**不含 `command_text`**；
- `docs/command/` 全仓 grep `command_text`：**零命中**；
- `docs/`（含 `docs/tools`、`docs/hooks`）内亦无该符号的定义。

**判定**：一个被引用为"模型侧文案"的符号**没有定义处**。要么是笔误（应指 §7 表的"给模型看的文案"列），要么是删除后未同步。**必须修**，否则实现者会去找一个不存在的渲染分支。

### 5.2 其余闭环性核验（通过）

- `06` 引用的每个 `file:line` 中，**函数名/常量名侧全部可定位**（`parseRollDiceDetails`、`ingestPlayerRoll`、`stageCeremony`、`diceStageDisplay`、`ACTION_FEEDBACK_STATUSES`、`CONFLICT_CODES`/`REJECTED_CODES`…），仅**行号**偏移（见 §6）。
- `10` 引用的每个符号都有唯一定义处，且 `10:750` 明确标注 `WORLD_COMMAND_EFFECT_BUDGET`「`03` 拥有」、`10:753` 标注三处接线「`02` 接线，`10` 提供函数」——**归属清晰**。✅
- `06:628` 标注 `extensions/toolkit/roll-dice.ts:47-53`「无需改动——它已原样透传 `details`」。**核验成立**：`roll-dice.ts:50` 逐字 `return ok(result as { text: string; details: RollDiceDetails })` ✅。**这是 `06 §6.2a` 的关键，且它对了。**

---

## 6. `file:line` 抽查台账 —— 核验 31 条，**9 条不准确**（29%）

> 任务书要求「报告我核验了 X 条，其中 Y 条不对」。此为完整台账。判定标准：引用行是否落在所述构造上。

### 6.1 不准（9 条，`#6`/`#11` 为对照）

| # | 文档引用 | 声称 | 实际 | 严重度 |
|---|---|---|---|---|
| 1 | `06:147,577` 「toast 3 秒后消失（`App.tsx:219-226`）」 | `:219-226` = toast 逻辑 | 实际 toast 在 **`App.tsx:235-242`**（`notify` 回调）；`:219-226` 是 `closeNook`。**HEAD 同样是 `:230-233`。** | 中 |
| 2 | `10:286,341,788` 「合并键 `events.ts:284-296`」 | `:284-296` = 规则 1 的 `sameKey` | 实际 `sameKey` 在 **`events.ts:473-479`**；`:284-296` 是 `character_talked` 模板 | **高** |
| 3 | `10:287` 「`events.ts:274-276,296-299`」 | 相邻段 `prev.open` 判定 | 实际 `:484`（`prev.open=false`）/`:491`（`open:true`）；`:274-276` 是 `character_moved` | **高** |
| 4 | `10:289` 「规则 3 键 `created.detail.path===moved.detail.from`（`events.ts:346-365`）」 | `:346-365` = 规则 3 | 实际规则 3（COLLAPSE-CREATE-MOVE）在 **`events.ts:534-554`**；`:346-365` 是 `layer_entered`+`layer_initialized` 模板 | **高** |
| 5 | `10:295` 「规则 4 `groups.slice(-caps)`（`events.ts:367-372`）」 | `:367-372` = cap 折叠 | 实际 `slice(-caps)` 在 **`events.ts:560`**，cap 段在 `:556-561`；`:367-372` 是 `layer_init_failed`/`world_snapshot` | **高** |
| 6 | `10:288` 「`MERGE_EXEMPT`（`events.ts:60-71`）」 | `:60-71` | **✅ 正确**（`MERGE_EXEMPT` 确在 `:63-71`）——列入对照 | — |
| 7 | `06:288,919` 「`useWorld.ts:427-449`」 | world_event 重取 | 当前树在 **`:431-454`**；HEAD 在 `:431` | 低 |
| 8 | `06:448,668` 「`case 'file_changed'`（`useWorld.ts:424-425`）」 | `:424-425` | 当前树 `:428-429`；HEAD `:428` | 低 |
| 9 | `06:276` 「`reqSeqRef` 只保留最后一个（`useWorld.ts:171-175`）」 | `:171-175` | 实际 `fetchLayer` 的 seq 守卫在 **`:193-198`**；`:171-175` 是 toast 重置 | 中 |
| 10 | `06:446` 「`dice_result` 帧（`useWorld.ts:584-587`）」 | `:584-587` | 实际 `case 'dice_result'` 在 **`:656-660`** | 中 |
| 11 | `10:636` 「角色游标关遮罩推开（`apps/server/src/index.ts:263`）」 | `:263` | **✅ 正确**（`settleTurnCursor(activeStore, \`character:${key}\`, opts)` 确在 `:263`） | — |

> 说明：`#6`、`#11` 为对照项（均正确，列在表内是为了呈现判定标准的一致性）。**真正的偏差 9 条**，集中在 `10` 的 `events.ts` 行号（`#2-5`，全部落在**同一文件的相邻模板区**）与 `06` 的 `useWorld.ts`/`App.tsx` 行号（`#1,7,8,9,10`）。

### 6.2 准确（20 条，抽样列举）

`10:155`（`03 §6.2` 24）、`10:580`（`local-store.ts:745-748` SQL 逐字）、`10:579`（`collect.ts:251`）、`10:590`（`collect.ts:126`）、`10:172`（`canvas.ts:204-246` 不落事件——**✅ 关键，见 §7.2**）、`10:277`（`types.ts:18-22`）、`10:636`（`index.ts:263`）、`10:384`（`events.ts:363` 逐字）、`10:401`（`events.ts:255-274` `character_moved` 特例）、`10:682`（`appendEvent.detail` 带 `command`）、`06:379`（`events.ts:9-25` 15 类型）、`06:383`（`roll-dice.ts:225-233` 8 键）、`06:446`（`App.tsx:300-326` 骰帧 listener——**接近，实际 `:338-358`**）、`06:531`（`DiceCeremony.tsx:140-160` settled 分组——**✅ 逐字正确**）、`06:681`（`dice-ceremony.ts:54` `detailsKeys`——**✅ 逐字正确**）、`06:682`（`parseRollDiceDetails` 12 键重建 `:89`——**✅ 正确**）、`06:629`（`roll-dice.ts:47-53` 透传——**✅ 正确**）、`06:306`（`world.ts:702-892` `/api/layer` 成本清单——**✅ 全部行号正确**，含 `:781` `seatUnplaced`、`:787-792` `reseatLayer`、`:740` `getEvents(1000)`）、`06:889`（`dice-ceremony.ts:277-280` `rollingFace` ceiling——**✅ 正确**）、`06:1019-1051` 的附录 30 余条（抽查 `d10-display.ts:19-50,52-77`、`DiceRoller.tsx:6-8`、`useWorld.ts:188-190` 均 ✅）。

**总评**：`06` 的**函数级/常量级**引用质量高（`declared-actions`/`event-bridge`/`world.ts`/`dice-ceremony` 的行号几乎全对），偏差集中在**频繁变动的 web 状态文件**（`useWorld.ts`/`App.tsx`——这两个文件当前工作树**确有未提交改动**，见 §6.3）。`10` 的偏差集中在 `events.ts` 的**合并规则段**。

### 6.3 偏差成因（诚实归因）

`git status` 显示 `apps/web/src/state/useWorld.ts`(+59/-12)、`apps/web/src/App.tsx`(+29/-5)、`apps/server/src/routes/world.ts`(+35/-2) **均有未提交改动**，且 `events.ts` **无改动**。因此：
- `06` 的 `useWorld`/`App` 行号偏差 **主要由并行工作树的改动造成**（非设计者失误），但设计者**未标"快照"**，读者会误以为当前有效；
- `10` 的 `events.ts` 行号偏差 **不是工作树造成的**——`events.ts` 自 `6c6492d` 未变，`10` 引的 `:284` 与实际的 `:473` 差 **189 行**。这是**引用了一个不同版本/不同文件的快照**（或凭印象写的），**必须重核**。

> **建议（对两文）**：在文首统一加「本文 `file:line` 取自 <commit>；行号仅定位提示，**以函数名为准**」。`10:756` 已有此免责，但仅限 §8 的改动清单，未覆盖 §3 的核心论证。

## 7. 诚实性

### 7.1 未知项是否被伪装成已定 ✅ 基本合规

- `06` 全文用 `[推断]` 标记未 profile 的量（`06:286-288`），`06 §12.2` 逐条列"本文自己仍未定"（5 条），`06 §12.1` 保留 `[C-1]`..`[C-5]` 标记。**未伪装。**
- `10 §12.4`（`10:1140-1144`）逐字「没有运行过任何代码路径；T1–T9 是设计断言，不是实测结果；本批次证据等级 E1，MUST NOT 声称 E3」。**与契约 §9.4 完全一致。**
- `10 §3.9.4`（`10:601-603`）登记「D 的已知缺口：若触发命令的工具调用不经过 `ActionResult.text`，回执不会出现」——**主动登记自己的失败条件**，诚实。
- `10 §12.3` 列出六条"已知但故意不做"，避免后续被读成遗漏。

### 7.2 证据等级合规性（契约 §9.4：本批次 MUST NOT 声称 E3）✅

两份**均未声称 E3**。`06 §10.1` 明确标注是"浏览器实测"的**验收设计**（未来实现时执行），并注明"修复前/修复后的可观测差异"，属 E1 设计断言。`10:1144` 显式声明 E1。✅

### 7.3 唯一一处"接近伪装成已定"的地方 ⚠️

`10:1120` 的 `[C-10b]`「读取预算用哪个常量」状态栏写「**已定（`03` §6.2）**」，但契约 §11 的 `[C-*]` 清单里**没有这一项**，`03 §6.2`（`03:580`）确实给了 `COMMAND_EVENT_BUDGET_GUARD = 24`。这**不算伪装**——`03` 是常量所有者且已定稿，`10` 只是复用。但 `10` 为它编了 `[C-10b]` 这个**编号**进入"待拍板"表，又立刻标"已定"，**形式上是自我批准**。建议把 `[C-10b]`/`[C-10h]` 从"待拍板"表移出，改列入 §8.3 的"已与他模块对齐"表——**待拍板表里不该出现状态为"已定"的行**。

### 7.4 `06` 的一处轻微乐观 ⚠️

`06:302` 的「给契约的回写建议」把 §1.1 改成「毫秒级落盘、**在骰子落定的那一刻可见**」。但 §10.5（`06:850-866`）自证：**命令被禁用时** `status='skipped'`、无奖励卡；`06:300` 又说重取的延迟"此时不可见"。措辞"在落定的那一刻可见"仅在**成功**路径成立——**失败路径的"可见"是回执行，不是世界变化**。`06 §7.0` 已把三种结果分得很清，只是 §11.1 的建议句把三种情况压成了一句话。建议改法里补"（成功时结果可见；失败时以回执与 `command_error` 可见）"。

---

## 8. 汇总：必须处理项（通过前）
> **阻断（3）** — 见 §2：`B-1` 同名不同类型 + `receipt.ts` 双声明；`B-2` `details.commands` 三套形状；`B-3` `06 §2.2` 与权威 `05 §2.2` 字段名/类型/基数全不一致（且 `06` 自称已对齐）。**这三条不解决，落地时必然有一侧静默读到 `undefined`。**

> **条件（8）**
> 1. `C-1`：`06` 的 `App.tsx`/`useWorld.ts` 行号、`10` 的 `events.ts` 合并规则段行号重核（§6.1）；两文加"快照"标注。
> 2. `C-2`：`06:81` 的效果名名单改成 `04` 冻结集合；`10:217`「九个效果名」→数量对齐（`04`: 8 个 → 裁后 7 个）；`06:171` 的 `action: take` 按 §10.14(a) 改 `move`（`10:404` 的"命令通过 `take` 搬动角色"同理）。
> 3. `C-3`：`10:701` 的 `command_text` 悬空引用；`10:139-141` `lowerFirst` 注释错误且是死代码；`10`/`06` 的 `command_error` 数组 vs 单数口径。
> 4. `C-4a`：`06:286` 的引擎落盘量级改引 `03 §7.2` 的实测（≈4–29ms）。
> 5. `C-4b`：`06:381` 删掉"这一整次 HTTP 请求共享 turn"的论据（`00 §10.7` 已证伪）；`06 §3.2` 序号 1 同理。
> 6. `C-4c`：`03`/`04` 确认 `effects.ts` 导出 `WORLD_COMMAND_EFFECT_BUDGET`；`06 §11.1` 的改法句补上失败路径的"可见"口径。
> 7. `C-5`：`05:52` 的「九名」按 §10.14(b) 改 7 名。
> 8. `C-6`：`10:660` 的 `window.events.length!==0` 断言应写成 `window.events.length > 0`（虽等价，但"必须为 0 才 quiet"的读法更严谨）。

> **8 个重点的核验结论**：1 ✅（诚实性最强的一节，仅需改引 `03` 数字）、2 ✅、3 ✅、4 ✅（前提与修复侧都钉住）、5 ✅（我复现了 bug，修法成立）、6 ✅（契约 §10.11 兑现最完整的一处）、7 ✅（风格符合，`lowerFirst` 注释需修）、8 ✅（无伪造符号，仅 1 处悬空引用）。

> **核验质量总评**：`06` 的**函数/常量级证据质量高**（`declared-actions`/`event-bridge`/`world.ts`/`dice-ceremony` 行号几乎全对），偏差集中在恰有未提交改动的 web 状态文件；`10` 的**核心机制论证（`excludeActor`/`next-step`/预算/主语）全部经我独立复现成立**，偏差集中在 `events.ts` 的合并规则段行号（引了一个偏移 189 行的快照）。**两份文档的"系统性偏乐观"主要体现在 `file:line` 而非实质断言上。**
