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
