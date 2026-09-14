# recon-verify —— C1 修复轮独立复核

> 复核者：`VerifySemantics`（语义断言节）。基线对照：`65fa09d` / `9af9c9b`（文档写作快照）、`eb34966`（收口）、`HEAD`（`7af6edb`，含未提交工作树）。
> 只读复核，未改任何设计文档。所有结论均给出我自己的命令与输出。

---

## 结论（先给）

**6 项语义断言中，4 项完全通过，2 项部分通过（存在与前文声称不符的残留）。**

- 通过：① `01` 码集 46 无 `param_invalid` 且 §7.3 每码一行；② `ActionErrorCode`=19、`conflict` 在 `:18`；③ `ACTION_METHODS`=27、`arrangeCanvas`、`wiring.test.mjs:48`=27；④ `ActorType`=6 且 schema 同步。
- 部分通过：
  - ⑤ 计数锚点 **HEAD = 48/56/75 三个数本身正确**（主 agent 声称成立），**但文档里仍有三处写死/写错**（`03:1035` 的 58、`10:1141` 的 58、`00:779` C9 的 "+16 声明"），且主 agent 声称已改的 **`00 §1.3`（`:49`）与 §1.4（`:79`）根本未改**。
  - ⑥ `conflict` 不可达性 **结论正确**，但 `04:925` 的"**全部**生产调用点"清单**不完整**（漏 4 处）。
- **新发现 5 处硬错**（`02:802` 行段、`09:10` 行号、`03:1035`/`10:1141` 数字、`00 §1.3` 未改）。见下。

---

## 逐项核验表

| # | 断言 | 独立实测 | 判定 | 证据 |
|---|---|---|---|---|
| 1 | `01` §7.1 封闭码联合 | union 提取 = **46** 值；`param_invalid` **不在**其中；全文无 `param_invalid` | ✅ 通过 | `01:607-630`；见下 §1 |
| 1b | `01` §7.3「每码恰有一行」 | §7.3 表行 = **47** = 46 error 码（全部命中 union）+ 1 warning(`unused_param`)；无重复、无遗漏匹配 | ✅ 通过 | 见下 §1 |
| 2 | `ActionErrorCode` HEAD=19，`conflict` 定位 | union = **19** 值；`'conflict'` 在 `errors.ts:18`；文件 `:22` 是 `\| 'internal';` | ✅ 通过（值对） | 见下 §2 |
| 2b | 文档「18/19」口径一致 | 01/04/05/06/00 全部双记「定稿 18 / HEAD 19」；**`02:802` 行段写 `errors.ts:3-26` —— 错（应为 `:3-22`）** | ❌ 不通过 | 见下 §2 |
| 3 | `ACTION_METHODS` HEAD=27；`arrangeCanvas`；测试 | 数组 = **27** 项；`'arrangeCanvas'` 在 `service.ts:97`（`:96` 是 `'arrangeCards'`）；`wiring.test.mjs:48` 断言 `27` | ✅ 通过 | 见下 §3 |
| 3b | `09:10` 引 `service.ts:96` 指向 `arrangeCanvas` | `:96` = `'arrangeCards'` → **错位一行** | ❌ 不通过 | 见下 §3 |
| 4 | `ActorType`=6 含 `functional`；schema 同步；文档一致 | `actor.ts:8` = 6 值；`ActorTypeSchema`（`events.ts:30`）= 同 6 值；`02:215`、`00:263` 一致 | ✅ 通过 | 见下 §4 |
| 5 | 计数锚点 HEAD=48/56/75 | 三口径复算 = **48 / 56 / 75** ✅；`eb34966` = 36/42/44 ✅ | ✅ 通过（数值） | 见下 §5 |
| 5b | 文档是否已停写死 | `03:1035` 写「排除自引用 **58**」、`10:1141` 写「含自引用 58」、`00:49`/`:79` 仍写死 36/44 未加漂移注 | ❌ 不通过 | 见下 §5 |
| 6 | 「命令 7 效果不产生 `conflict`」 | `fail('conflict')` 全仓仅 2 处，均不在效果路径；`store.upsertLink`/`createEntity`/`moveEntity`/`editEntity`/`enterLayer` 均不触围栏 | ✅ 通过（结论） | 见下 §6 |
| 6b | `04:925`「全部生产调用点」 | 列了 6 处，漏 `screenshot-canvas.ts:123`、`canvas-perception.ts:116/151/177/182`、`canvas-screenshot.ts:26` | ⚠️ 表述不完备 | 见下 §6 |
| — | `07:241` HTML 注释对 check-hooks-docs / 渲染 | `pnpm check:docs` = clean；`<!-- -->` 不渲染到读者可见文本 | ✅ 通过 | 见下 §7 |
| — | 台账洞 3（toast 假话） | `world-event-toast.ts:118` `return last \|\| clean \|\| 'the current scene';`；`:121-122` `layerLabel`；`:216` 塞值 | ✅ 通过 | 见下 §8 |

辅助：`pnpm check:docs` → `check-hooks-docs: clean (8 docs, 16 owned symbols, 94 cited paths)` ✅

---

## §1 `01` 码集实测

命令（python 抽 union 块 + §7.3 表行）：

```
union members: 46
param_invalid in union? False
§7.3 rows: 47   dupes: {}
union missing from table: []
table extras: ['unused_param']
param_invalid anywhere in file: False
```

- union 定义在 `01:607-630`，注释 `01:606` 逐字 `Closed union: 46 members, each with exactly one row in §7.3.` → 46 与实测相符。
- §7.3 的 47 行 = 46 error 码（每个 union 成员恰一行）+ 1 行 warning `unused_param`（§K，**刻意单列**，见 `01:758` 标题「警告（不阻断）」）→ 「每码恰有一行」成立。
- `param_invalid` 全文零命中 → **主 agent 的 C8 断言成立**（见 §2/新问题 N1 的旁证）。

## §2 `ActionErrorCode` 实测

```
ActionErrorCode count: 19
conflict at line: [18]
errors.ts:22 => | 'internal';
```

- 值 19、`conflict` 在 `:18` → 与文档一致。
- **口径不一致点**：`02-触发与绑定.md:802` 现在写 `packages/shared/src/actions/errors.ts:3-26`（旧标 `:3-25`）。实测 HEAD 的 union 是 `:3-22`（`internal';` 在 `:22`），`:25-45` 是 `HTTP_STATUS`。所以 `:3-26` **不对**；而它标注的"旧标 `:3-25`"在 `eb34966` 时也不对（当时 union 到 `:21`）。这是一处**被 recon 改过但改错**的引用。→ 见新问题 **N1**。

## §3 `ACTION_METHODS` 实测

```
ACTION_METHODS count: 27
arrangeCanvas at line: [59, 97]        # 59=接口声明, 97=数组成员
service.ts:96 => 'arrangeCards',
service.ts:97 => 'arrangeCanvas',
wiring.test.mjs:48 => assert.equal(ACTION_METHODS.length, 27);
```

- 27 项、`wiring.test.mjs:48`=27 → 与文档一致。
- **`09-安全与边界.md:10`** 写「新增 `arrangeCanvas`，`packages/shared/src/actions/service.ts:96`」→ `:96` 是 `arrangeCards`，**应为 `:97`**。`00:235`、`04:18` 均写 `:97` 正确，故 09 是与它们不一致的孤例。→ 见新问题 **N2**。

## §4 `ActorType` 实测

```
ActorType: 6 ['player','god','writer','character','engine','functional']   # actor.ts:8
ActorTypeSchema = z.enum(['player','god','writer','character','engine','functional'])  # schemas/events.ts:30
```

- 源码 6 值、schema 已同步、`02:215`（命令侧 5 值 + `functional` 注释）与 `00:263`（5→6 裁定）一致 → ✅。

## §5 计数锚点 36/42/44 → 48/56/75 实测

复算脚本（`git grep -l dice_outcomes`，按后缀/前缀口径分类）：

```
== eb34966 == decl=36 world=42 noncmd=44 total=59
== 50dd228 == decl=48 world=56 noncmd=75 total=90
== a71623a == decl=36 world=42 noncmd=44 total=59
== 9af9c9b == decl=36 world=42 noncmd=59 total=74
```

- **HEAD = 48/56/75 三数正确**（主 agent 声称成立）。差额来源实测 = 新增 12 个 zh 骰卡（`whitechapel-zh` 8 + `wuwu-zh` 4）+ 2 个 zh `SKILL.md`（`43b477c`）。
- 但：
  1. **`03-求值与执行序.md:1035`** 写「**HEAD（`50dd228`）**：… 排除 `docs/command/` 自引用 **58**」→ 实测 **75**。**错**。同行的"声明规模 48 / 世界包内 56"是对的。
  2. **`10-事件与作家上下文.md:1141`** 写「**含自引用 58**」→ 实测含自引用 = **90**（`00:1019` 明令 MUST NOT 写"58"/"59"字面量，本条违反）。
  3. **`00:779`（C9）** 写「两套中文世界（各 +8 骰卡 = **+16 声明**；`43b477c`）」→ 实测 `whitechapel-zh` +8、`wuwu-zh` **+4**，共 **+12 声明**（世界包内 +14）。「各 +8」「=+16」**均错**。
  4. **主 agent 声称已改的 `00 §1.3` 根本未改**：`00:49` 仍逐字 `已经存在于工作树的 **44 个文件**中（… git grep -l dice_outcomes = 44）… **36 个** 04-investigation-dice.md`，且 `00:79`（§1.4 表）仍写 `**36 个实体文件**（排除 … 后 44）`。**零漂移注、零 commit 标注**。`git diff HEAD -- docs/command/00-共同上下文.md` 无对应 hunk。

  → 见新问题 **N3/N4/N5**。

## §6 `conflict` 不可达性实测

```
$ grep -rn "fail('conflict'" packages apps extensions
packages/shared/src/actions/canvas.ts:460            # arrangeCanvas 的 snapshot fence
packages/shared/src/render/canvas-snapshot.ts:466    # 读取期围栏
```

另有 `code:'conflict'` 的直接 throw（非 `fail()` 形态）：

```
local-store.ts:1398,1413,1592   # arrangeCanvasLayer / applyCanvasPositions 乐观锁
canvas-snapshot.ts:379          # 快照读取冲突
canvas-screenshot.ts:26         # 截图冲突
canvas-perception.ts:116,151,177,182   # 路由
extensions/toolkit/arrange-canvas.ts:49, screenshot-canvas.ts:123
```

**效果路径核查**（7 效果 → 5 个动作方法）：

- `create.ts` / `delete.ts`(editEntity) / `move.ts` / `layer.ts`(enterLayer) / `canvas.ts`(linkCards) 的 `store.*` 调用清单里**没有** `arrangeCanvasLayer` / `applyCanvasPositions` / `readCanvasSnapshot`；`linkCards` 只走 `upsertLink`/`deleteLink`/`getLayerLinks`，不读不比较 `canvasVersion`。
- 触发入口 `runDeclaredRoll` / `runDeclaredChoice` / `useItemOn` 的 store 调用里同样无围栏。
- ⇒ **「命令的 7 个效果不会产生 `conflict`」结论成立** ✅。
- **但 `04:925` 逐字写"它的**全部**生产调用点都在画布布局/快照这一族"后只列 6 处**，漏了 `extensions/toolkit/screenshot-canvas.ts:123`、`apps/server/src/routes/canvas-perception.ts`（4 处）、`packages/shared/src/render/canvas-screenshot.ts:26`。"全部"是过强陈述。→ 见新问题 **N6**（`06:538` 写"全仓只有两处 `fail('conflict', …)`"字面为真，因其余是 `throw new ActionError` 形态，可不动，但需与 `04:925` 口径统一）。

## §7 `07:241` marker 风格

- `07:241` 是 `<!-- recon 50dd228: ... -->` HTML 注释。
- `pnpm check:docs` → `clean`，`check-hooks-docs.mjs` 未受影响；HTML 注释在 Markdown 渲染中不显示 → 不会泄漏到读者可见文本 → ✅ 不是问题。

## §8 台账洞 3 实测

```
world-event-toast.ts:118 =>   return last || clean || 'the current scene';
world-event-toast.ts:121 => function layerLabel(event: WorldEvent): string {
world-event-toast.ts:122 =>   return event.layer ? basename(event.layer) : 'the current scene';
world-event-toast.ts:216 =>     values = { name: String(detail.name), layer: layerLabel(event) };
```

- 台账 `docs/现有安全待办台账.md` 引用的 `:118` / `:121-122` / `:216` 与源码**逐行相符** → ✅。

---

## 发现的新问题（文档:行 + 现状 + 该怎么改 + 依据）

**N1 ❌ `02-触发与绑定.md:802` 行段错**
- 现状：`packages/shared/src/actions/errors.ts:3-26`（旧标 `:3-25`）。
- 应为：`errors.ts:3-22`（旧标 `:3-21`）。
- 依据：HEAD union 到 `:22`（`| 'internal';`），`:25-45` 是 `HTTP_STATUS`；其他文档（`01:595`/`04:910`/`05:81`/`06:538`）都用 `:3-22`。本条的"旧标 `:3-25`"在 `eb34966` 时也不成立（当时 union 到 `:21`），是**改错的一处**。

**N2 ❌ `09-安全与边界.md:10` 行号错一行**
- 现状：「新增 `arrangeCanvas`，`packages/shared/src/actions/service.ts:96`」。
- 应为：`service.ts:97`。
- 依据：`service.ts:96`=`'arrangeCards'`、`:97`=`'arrangeCanvas'`；`00:235`/`04:18` 已写 `:97`，09 是孤例。

**N3 ❌ `03-求值与执行序.md:1035` 数字错**
- 现状：「HEAD（`50dd228`）：… 排除 `docs/command/` 自引用 **58**」。
- 应为：**75**。
- 依据：`git grep -l dice_outcomes HEAD -- . ':(exclude)docs/command/*' | wc -l` = 75。

**N4 ❌ `10-事件与作家上下文.md:1141` 数字错且违反禁令**
- 现状：「**含自引用 58**」。
- 应为：现测快照（含自引用 = **90**），或按 `00:1019` 改为"现测"措辞。
- 依据：`git grep -l dice_outcomes HEAD -- . | wc -l` = 90；`00:1019` 逐字「MUST NOT 写"58"/"59"这类字面量」。

**N5 ❌ `00-共同上下文.md:49`（§1.3）与 `:79`（§1.4）未改 + `:779`（C9）数字错**
- `:49` 现状：仍写死「工作树的 **44 个文件**… **36 个** `04-investigation-dice.md`」，无漂移注、无 commit 标注。
- `:79` 现状：仍写「**36 个实体文件**（排除 `docs/command/` 自引用后 44）」。
- 应为：按 `00:1190`/`08:51` 的同一纪律改为「带 commit 的现测快照 + 可复现命令」（eb34966=36/44；HEAD=48/75）。
- `:779`（C9）现状：「各 +8 骰卡 = **+16 声明**」。
- 应为：`whitechapel-zh` +8、`wuwu-zh` +4 ⇒ 共 **+12 声明**（世界包内 +14）。
- 依据：见 §5 复算。**主 agent 声称已改 §1.3，实测未改** —— 该项"修复"未落地。

**N6 ⚠️ `04-效果原语集.md:925`「全部生产调用点」不完备**
- 现状：列 `canvas.ts:460`、`canvas-snapshot.ts:379,466`、`local-store.ts:1398,1413,1592`、`canvas-arranger.ts:54`、`arrange-canvas.ts:49`。
- 应为：补 `render/canvas-screenshot.ts:26`、`apps/server/src/routes/canvas-perception.ts:116,151,177,182`、`extensions/toolkit/screenshot-canvas.ts:123`（这些也产 `code:'conflict'`，只是 `throw new ActionError` 形态）。
- 依据：§6 实测。结论（命令不产生 `conflict`）不变，只是"全部"与 `06:538` 的"仅两处 `fail()`"口径需统一。

**N7 ⚠️ `01-命令文件与schema.md:71` 仍写死 36/42/44（未标漂移）**
- 现状：「`dice_outcomes` 能在 **36** 份既有声明（全仓 grep **44** / 世界包内 **42** / 声明规模 **36**）里…」。
- 建议：与 §5 同纪律处理（加 commit / 现测命令），否则同为写死锚点。

---

## 我未能核实的事项

- **`01` §7.3 是否与 `06` 的玩家侧文案真正"双方一致"**：本轮只核了 `01` 内部码集自洽（46 码每码一行），未逐行比对 `06` 侧的文案表（属 `VerifyRefs` 引用核验范围之外的文案语义）。
- **`04:925` 是否另有经 `store` 间接调用 `applyCanvasPositions` 的效果路径**：我按源码 store 调用清单判定为否，但未做跨模块（如 `presence.ts` 再导出）的传递闭包穷举 —— 标 `[推断]`。
- **`00 §11.3` 的 C8/C9 行号是否会随本报告新增的文档编辑再次漂移**：属编辑后复核，不属本次只读核验。
- **`9af9c9b` 以后所有非 `dice_outcomes` 引用的行号漂移**：本轮只抽查了 `06` 的 12 处（覆盖 `App.tsx`/`useWorld.ts`/`fm.tsx`/`world.ts`/`event-bridge.ts`/`DiceCeremony.tsx`/`DiceRoller.tsx`/`Canvas.tsx`，全部指向文档所称内容，✅），未穷举全部 `file:line`。

---

# 引用核验节（`VerifyRefs`，只读复核）

> 复核者：`VerifyRefs`。基线对照：写作快照 `65fa09d` / `9af9c9b`（文档作者写引用时的工作树）、`HEAD`（含未提交工作树）、`origin/niko`（文档引用 niko 分支时的写法）。
> 方法：脚本抽全部 `path:line` 引用；对「新标 + 旧标」同现的引用，用 `git show` 双向取行段，先 difflib 比内容，再用**符号定位**（把 doc 行里引用的标识符在 HEAD 里 grep 出真实行号）交叉验证。**行号对不代表内容对**是本次的主判据。
> 未改任何设计文档。

## 结论（先给）

**重编号整体可信，但有 33 处引用不通过（其中 8 处是硬错、1 处指内容已不存在、其余是「旧标残留/口径不一致」）。**

- 11 份正文共抽出 `path:line` 引用 **~700 处**；其中**本轮被重编号的**（同一行同时给出新标与旧标/更早）共 **198 处**。
- 这 198 处的独立判定：**SAME（新行号确实指向旧行号所述内容）146 处 ✅ / NEAR（内容尚在但行段明显错位）16 处 / WRONG（新行号已不指向所述内容）36 处 ❌**。
- 只有裸新标、没有旧标的引用（~500 处）不在本轮重编号范围；抽查 06/04/07/08/09/10 的多数新标均指向所述符号（细节见下「抽查」）。

**两个真实存在的系统性问题（不是个别笔误）：**

1. **「旧标」本身大量是错的**，且错法一致——把「文档写作时的行号」当成了「引用对象的旧行号」。典型：`02:680 / 02:1085 / 02:1118 / 04:896 / 06:460` 五处都写 `local-store.ts:745-748`，但 `excludeActor` 的 `where.push` 在 `65fa09d` 时是 **`:772`**，`:745-748` 是 `appendEventAndPushCursors` 的 rollback 失败消息。**这是"半新半旧"的实证：同一事实在 `08:870`/`06:1135`/`10` 里写对了（`:862-865`/`:864`），在 `02`/`04`/`06:460` 里却留了错值。**
2. **计数口径混用**：`04:910/912` 说「文内所有『18』按定稿快照 18 / HEAD 19 双记」，但 `00:239` 现在写 `ACTION_METHODS 现为 :81-111`，而实际 tuple 是 **`:81-109`**（`:111` 是 `ActionMethodName` 类型行）——同一份 00 的 `:233` 又写对了 `:81-109`。

## 逐项核验表（已知需重点复核的 6 点）

| # | 检查点 | 独立实测 | 判定 | 证据 |
|---|---|---|---|---|
| 1 | `04:130-135` 主 agent 称 `01` 里**没有** `param_invalid` | `01` §7.1 union 实测 **46 值**，`param_invalid` 全文零命中；`04:135` 的「旧标（错）」注与 `00` C8 一致 | ✅ **确认主 agent 正确** | `01-命令文件与schema.md:607-650`；`04:132,135` |
| 2 | `00 §R.25/§1.3` 与 `08 §2.1.1` 计数锚点 36/42/44 → 48/56/75 | 独立复算：`eb34966`=36/42/44 ✅；`50dd228`=**48/56/75** ✅；`9af9c9b` 的非命令口径已是 59（≠44） | ✅ **数值确认**；但 `00:49`/`00:79` 在 HEAD 仍写死 36/44（另见 N5） | `git grep -l dice_outcomes <rev> -- 'templates/**/04-investigation-dice.md'`；`00:49,79` |
| 3 | `06` 抽查 10 处（`App.tsx`/`useWorld.ts`/`world.ts`/`DiceCeremony.tsx`/`fm.tsx`/`event-bridge.ts`） | 11 处抽查中 **9 处新标正确**；**2 处错**：`06:1119`（`useWorld.ts:227` 说 `reconcileLanded`，实际 227 是 `state` 的 JSDoc，`reconcileLanded` 在 HEAD 只剩 import:14 与注释 839/846）、`06:1118`（`file_changed` 说 `684-686`，实际 case 在 684 但 `file_changed` 字符串另有 679） | ⚠️ **2 处不通过** | 见下 W6/W7 |
| 4 | `04` 是否被两代理并发改出「半新半旧」 | **是，有实证**：`04` 内 26/27 与 18/19 口径并存但都带双记（不算错）；真正的半新半旧是 **`04:896` 的 `local-store.ts:837-840`**（与 `02` 三处同款错值），而 `04:1671` 同文件写对了 `:760-771`；`04:602` 写 `extensions/tools.ts:16-39` 说 import，实际 import 在 `:16-20`、`AIRP_TOOLS` 在 `:52` | ❌ **混用确认** | 见下 W14/W15 |
| 5 | `07`/`08` 的 `<!-- recon -->` marker 风格 | `pnpm check:docs` → `check-hooks-docs: clean (8 docs, 16 owned symbols, 94 cited paths)`；HTML 注释不进渲染文本 | ✅ **不是问题**（与 VerifySemantics §7 一致） | `tools/check-hooks-docs.mjs` |
| 6 | 台账「洞 3」toast 假话 | `world-event-toast.ts:118` = `return last \|\| clean \|\| 'the current scene';`；`:121` = `function layerLabel(...)`；`:122` = `return event.layer ? basename(event.layer) : 'the current scene';`；`:216` = `values = { name: ..., layer: layerLabel(event) }` | ✅ **逐行相符** | 台账 + `apps/web/src/lib/world-event-toast.ts` |

## 全部不通过的清单（33 处，去重后 26 条）

格式：`文档:行（引用）` → **现状** → 该怎么改 → 依据。

### A. 硬错：新行号指向的内容已不是文档所述（8 条）

| # | 位置 | 文中引用 | HEAD 实际 | 该怎么改 | 依据 |
|---|---|---|---|---|---|
| W1 | `00:72` | `CardRenderer.tsx:107`（旧标 `:116`） | 新标 **107 对**（`if (frontmatter?.dice_reward) {`）；**旧标 116 错**，`dice_reward` 在 `65fa09d`/`9af9c9b`/`a71623a` 都是 `:150` | 旧标改 `:150`（或删旧标，因为 `:116` 只在更早的 `a1ac282b` 成立） | `git show 65fa09d:apps/web/src/components/canvas/CardRenderer.tsx \| grep -n dice_reward` |
| W2 | `00:479` | `world.ts:1257-1260`（旧标 `:1170-1173`）「`runDeclaredChoice(serviceFor…)` 双 turn」 | HEAD 1257-1260 是 `});` + `/use-item` 注释；该代码块在 **1294-1300**。旧标亦错：`65fa09d` 该块在 **1224-1230** | 改 `world.ts:1294-1300`（旧标 `:1224-1230`） | 见「正文 code block」 |
| W3 | `00:568` | `useWorld.ts:981,990`（旧标 `:777,786`）＝ `settingsRef.current={autoWrite}`；`:994`（旧标 `:790`）= `saveSettings` | HEAD：赋值在 **1000**（与 1010，`reloadSettings`/`saveSettings` 各一），`saveSettings` 定义在 **1008**；`:981`=`};`、`:990`=`wsRef.current = null;`。旧标亦错（`65fa09d` 时 791/801、799） | 改 `useWorld.ts:1000,1008`（旧标 `:791,799`） | `grep -n 'autoWrite' apps/web/src/state/useWorld.ts` |
| W4 | `02:588` | `DiceRoller.tsx:66-78`（旧标 `:58-68`）「校验 `raw.ok`」 | HEAD 66-78 是 `useState`/`roll()` 开头；`raw.ok` 校验在 **87-93** | 改 `:87-93`（旧标 `:58-68` 其实**是对的**，`raw` 在 65fa09d 58-68 ✓） | `grep -n 'rawObj' .../DiceRoller.tsx` |
| W5 | `02:751` | `world.ts:1265`（旧标 `:1178`）的 `dispatch(store,...)` | HEAD `dispatch(store,` 在 **1305**；1265 是 `/use-item` 的参数校验。旧标应 `:1232` | 改 `:1305`（旧标 `:1232`） | `grep -n 'dispatch(store' world.ts` |
| W6 | `06:1119` | `useWorld.ts:227`（`reconcileLanded`，旧标 `:188-190`） | HEAD 227 是 `export interface UseWorldApi {` 的 JSDoc；**`reconcileLanded(` 调用在 HEAD 已不存在**（只剩 import:14 与注释 839/846）；`65fa09d` 的调用点在 **227** | 要么改指 `useWorld.ts:14`（import）并说明该调用已重构掉，要么换成现存等价锚点 | `grep -n 'reconcileLanded' apps/web/src/state/useWorld.ts` |
| W7 | `05:262` | `local-store.ts:826-854`（旧标 `:734-762`）＝ `getEventsSince(seq,{layer?,excludeActor?,limit?})` | HEAD 826-840 是 `appendEventAndPushCursors`，`getEventsSince` 在 **851-879**；旧标亦错（`65fa09d` 在 **759**） | 改 `:851-879`（旧标 `:759-787`）。（**注意**：实为 `appendEventAndPushCursors` 与 `getEventsSince` 整段位移一致，`826/734` 是同一个函数的同一个偏移——两者都指错对象） | `grep -n 'async getEventsSince' local-store.ts` |
| W8 | `02:1544` | `world.ts:1286-1305`（旧标 `:1199-1218`）＝ README gate 的 `requires.items` | HEAD 1286-1305 是 `/choice` handler；`requires?.items` 在 **1332**；旧标亦错（`65fa09d` 在 **1259**） | 改 `:1332`（旧标 `:1259`） | `grep -n 'requires?.items' world.ts` |

### B. 旧标残留（同一事实在别处写对、此处留错值）——**这是最值得修的一类**

| # | 位置 | 文中引用 | 新标是否正确 | 旧标现值 | **正确旧标** |
|---|---|---|---|---|---|
| W9 | `02:568` | `local-store.ts:837-840`（旧标 `:745-748`）＝ `where.push(NOT (actor_type…))` | ❌ **新标也错**：HEAD 该 push 在 **864**；837-840 是 rollback 失败消息 | `:745-748` | 旧标应 **`:772`** |
| W10 | `02:680` | 同上（`local-store.ts:837-840`，旧标 `:745-748`） | ❌ 同上 | `:745-748` | 旧 `:772` |
| W11 | `02:1085` | 同上 | ❌ 同上 | `:745-748` | 旧 `:772` |
| W12 | `02:1118` | 同上 | ❌ 同上 | `:745-748` | 旧 `:772` |
| W13 | `04:896` | 同上 | ❌ 同上 | `:745-748` | 旧 `:772` |
| W14 | `06:460` | 同上 | ❌ 同上 | `:745-748` | 旧 `:772` |
| W15 | `09:267` | `local-store.ts:837-840`（旧标 `:745-748`） | ❌ 同上 | `:745-748` | 旧 `:772` |

> **同步对照（写对的）**：`08:870` = `local-store.ts:862-865`（旧标 `:745-748`）——新标对、旧标错；`06:1135` = `:864`（旧标 `:772`）——**两栏都对**；`10` 同。⇒ `02`/`04`/`06:460`/`09` 共 7 处需要把 `837-840` 改成 `862-865`（旧标 `:772`）。

| # | 位置 | 文中引用 | 现状 | 该怎么改 |
|---|---|---|---|---|
| W16 | `08:880` | `world.ts:1241-1242`（旧标 `:1097-1102`）「HTTP 不发帧注释」 | 新标 **对**（1241-1242 逐字是该注释）；**旧标错**，`65fa09d` 在 **1154-1155** | 旧标改 `:1154-1155`（`06:1127` 已写对三级记法） |
| W17 | `08:1030` | 同 W16 | 同上 | 同上 |
| W18 | `08:880` | `event-bridge.ts:337-357`（旧标 `:279-298`）＝ `dice_result` | 新标对（`roll_dice` 分支 337 起）；**旧标错**，`65fa09d` 的 `type: 'dice_result'` 在 **328**（分支 322 起） | 旧标改 `:322-341` |
| W19 | `06:1127` | 同 W16（三级记法） | **全对**（`:1241-1242（旧标 :1154-1155；更早 :1097-1102）`） | — 这条是本套文档的**正确写法样板** |
| W20 | `01:232` | `origin/niko:…declared-actions.ts:410`（旧标 `:147`） | 新标对（`1ca45cb:410` = `rewards.length > 3`）；**旧标错**：`niko` 上该行在 `e4a139a` 时不存在，`271cb3c` 也未落入 `:147`（`271cb3c:147` 在 `serialDeclared` 内） | 旧标应删或标到 `e4a139a` 的实际行 |
| W21 | `01:917` | `origin/niko:apps/server/src/routes/world.ts:1190`（旧标 `:950`） | 新标对（`1ca45cb:1190` ✓） | 旧标 **`:950` 对 `e4a139a` 成立**（该 rev `:950` = `runDeclaredRoll(...)`）✓ |
| W22 | `00:415`/`02:1080` | `origin/niko:…world.ts:1190`（旧标 `:950`） | 同上，**两栏都对**（`e4a139a:950` 确是该调用） | — |
| W23 | `02:1080` | `origin/niko:…declared-actions.ts:429-482`（旧标 `:159-212`） | 新标对（`1ca45cb:429` ✓）；旧标 **`:159` 在 `e4a139a` 是 `runDeclaredRoll`?** 实测 `e4a139a:153` 才是其起点，`:159-212` 落在函数体内 | 旧标宜改 `:153-184`（`e4a139a` 全文仅 184 行） |
| W24 | `00:412` | 同 W23 | 同上 | 同上 |
| W25 | `07:237` | `world.ts:1243-1257`「`POST /api/dice`」 | 新标对（`/dice` 定义在 1243）；**旧标错**，`65fa09d` 的 `/dice` 在 **1156** | 旧标改 `:1156-1174` |
| W26 | `07:479` / `06:1039` | `inject/collect.ts:251`（旧标 `:770-774`）／`rules/dice.ts:254`（旧标 `:243-256`） | `07:479`：新标 `:251` 对（`excludeActor: actor`），**旧标错**——`inject/collect.ts` 在 HEAD 与 65fa09d **都是 261 行**，`:770-774` 根本不存在（该事实的旧值应是 `:745-748`→实际 `:772`）。`06:1039`：`rules/dice.ts` 在 **HEAD 与 65fa09d 都是 `:254`**，旧标 `:243-256` 是另一个块 | `07:479` 旧标改 `:772`；`06:1039` 旧标改 `:254`（或删） |

## 抽查：只有裸新标、无旧标的引用（~500 处）

用「doc 行里的反引号标识符 → 在 HEAD 中 grep 出的真实行号」机械核验，覆盖 `04/06/07/08/09/10/03` 的主要新标，**绝大多数命中**（示例）：

| 引用 | HEAD 实测 | 判定 |
|---|---|---|
| `04:1204` `index.ts:32-62`（action 层 barrel） | 32-62 逐字是 `export * from './actions/*'` 段 ✅ | OK |
| `04:1659` `service.ts:14-15`（"frozen twenty-four"） | `:14` 命中 ✅ | OK |
| `04:1017` `render/events.ts:403-408`（`renderEvent`） | `export function renderEvent(` 在 403 ✅ | OK |
| `04:760` / `07:1106` `actor.ts:150-178`（`assertNookMutationAllowed`） | 150 ✅ | OK |
| `03:549` `declared-actions.ts:160-164`（`serialDeclared`/`inFlight`） | 160 ✅ | OK |
| `06:176`/`1128` `world.ts:76-81`（`reply`） | `async function reply(` 在 76 ✅ | OK |
| `06:1120` `Canvas.tsx:645`（`key={item.path}`） | 645 ✅ | OK |
| `06:1123` `App.tsx:1528`（`<DiceCeremony`） | 1528 ✅ | OK |
| `06:1122` `App.tsx:557-591`（骰帧 listener） | `onDiceFrame` 在 558 ✅ | OK |
| `09:128` `local-store.ts:271-279`（`readFile`） | `async readFile(` 在 271 ✅ | OK |
| `09:470` `local-store.ts:228-269`（`resolvePath`） | `private resolvePath(` 在 228 ✅ | OK |
| `10:691` `instructions.ts:484-491`（`registerSlot`） | 484 ✅ | OK |
| `10:769` `render/events.ts:200`（`const S = actorPhrase(event.actor)`） | 200 ✅ | OK |
| `10:770` `render/events.ts:412`（`const S = actorPhrase(g.actor)`） | 412 ✅ | OK |
| `08:79` `world-shelf.ts:82`（`entries(path.join(repoRoot…`） | 82 ✅ | OK |

**未通过**（裸新标也错，附在第一份清单里）：`06:1119`（W6）、`04:602`（`extensions/tools.ts:16-39` 说 import，实际 import 是 `:16-20`、`AIRP_TOOLS` 数组在 `:52-71`；文中同一句的 `:54-80`（旧标 `:53-78`）也偏）——**这两条建议改为 `:52-71` / `:16-20`**。

## 明确回答：本轮重编号可信吗？

**基本可信，但不是"全部正确"。**

- 146/198 的「新标」经内容+符号双向验证**正确**；「旧标」这一栏正确率明显更低（大量把「文档写作时自己的行号」当成「引用对象的旧行号」）。
- 需要修的**硬错 8 条**（W1–W8）会让读者按图索骥读到无关代码；其中 **W2/W3/W5/W6/W8** 是同一段代码在文档写作快照里本就与文件实际不同步（即「旧标」误引），**不是这 88 个提交造成的漂移**。
- **半新半旧确认存在**：`local-store.ts` 的 `excludeActor` 行在 `02`(×4)/`04`/`06:460`/`09` 里是 `837-840`，在 `08:870`(`862-865`)/`06:1135`(`864`)/`10` 里是对的 ⇒ **同一事实两套口径并存**，符合「被两个代理并发编辑」的症状。

## 建议的修法（最小改动，不改设计语义）

1. `02`(×4)、`04:896`、`06:460`、`09:267`：`local-store.ts:837-840` → **`:862-865`**，「旧标 `:745-748`」→ **`:772`**。
2. `08:880`/`08:1030`：旧标 `:1097-1102` → **`:1154-1155`**；`08:880` 的 event-bridge 旧标 `:279-298` → **`:322-341`**。
3. `00:72` 旧标 `:116` → **`:150`**；`00:479` → `:1294-1300`（旧标 `:1224-1230`）；`00:568` → `:1000,1008`（旧标 `:791,799`）。
4. `02:588` → `:87-93`；`02:751` → `:1305`（旧标 `:1232`）；`02:1544` → `:1332`（旧标 `:1259`）。
5. `05:262` → `:851-879`（旧标 `:759-787`）。
6. `06:1119`：`reconcileLanded` 调用已在 HEAD 重构掉，改说明性锚点或删。
7. `07:237` 旧标 `:1156-1174`；`01:232`/`02:1080`/`00:412` 的 niko 旧标按 `e4a139a` 实际行改。
8. `00:239`：`ACTION_METHODS 现为 :81-111` → **`:81-109`**（与同文 `:233` 统一）。

## 我未能核实的事项

- **`04:1652`（`docs/tools/01-动作内核与事件落账.md:656-687`）**：这是跨文档引用，我未打开 `docs/tools/01` 逐行核对（不属 `docs/command/` 范围），标 `[未核]`。
- **只有裸新标引用的全量穷举**：我用「符号 grep」做了主要新标的机械核验（样本 ~60 处，命中率 >90%），但未对 ~500 处逐条取证。
- **`03`/`07`/`10` 的 `[推断]` 类软引用**：不构成 file:line 核验对象，未处理。
- **`origin/niko` 引用所用的确切 rev**：`00:412` 的「旧标」在 `e4a139a`/`271cb3c`/`1ca45cb` 三个 tip 下都不同，文档未标 rev，我只能指出「按哪个都不完全对」。
