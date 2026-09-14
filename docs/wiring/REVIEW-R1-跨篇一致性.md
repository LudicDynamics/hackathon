# REVIEW-R1 — 跨篇一致性审查

> 审查对象：`docs/wiring/01`–`05` 五篇设计文档，基准为冻结契约 `docs/wiring/00-共同上下文.md` 与唯一真相源 `docs/tools/12-工具注册与路由统一.md §6.2`。
> 方法：逐条读源码复核 `file:line`；门禁数字用 `node tools/check-ws-contract.mjs`（基线 14 findings）与直接 import `compare()`（`tools/check-ws-contract.mjs:180`）手算。
> 只读审查，未改任何源码/文档；未跑全量 build/test。

---

## 一、结论速览

| # | 严重度 | 一句话 |
|---|---|---|
| R1-1 | **BLOCKER** | `00 §3` 明文说"`useWorld` 对 `character_*` 帧按 `msg.characterId` 路由"，与 01/02/03 统一冻结的"无条件 dispatch、路由在 App"正面冲突；三篇子文档无一登记此冲突 |
| R1-2 | **MAJOR** | 门禁残留数算错：02 §10.1 与 04 §10.2 都写"A 档后剩 8 条 dark"并逐一列举，**漏了 `writer_delta`**；实际 = **9 条** |
| R1-3 | **MAJOR** | 01 §3 步骤 10 说"喂给**既有** `streamLine`"，03 §3 步骤 3 说"`streamLine` **整体删除**，不能复用"——同一函数的存亡两篇相反 |
| R1-4 | **MAJOR** | 01 §6.3/§3 步骤 9 冻结"用 **ref** 存 `activeModalCharId`"，03 §8.2/步骤 1 用 **state + deps**；接缝挂在两种机制上 |
| R1-5 | **MAJOR** | 05 R10 的目标 `docs/hooks/00-共同上下文.md:251` **不是** `chalk_landed` 引用（全 `docs/hooks/` grep `chalk_landed` 零命中），该回写项指向不存在的断言 |
| R1-6 | **MINOR** | 05 R5 目标行号错：收工检查表 P3 行在 `:549`，`:551` 是 P5 |
| R1-7 | **MINOR** | 05 R7 只点名 2 个文件，实际至少 8 个 `docs/tools/*.md` 都带同一类漂移行号，回写面漏了大半 |
| R1-8 | **MINOR** | 05 R6 区间 `427-431` 差一行：`show_frame` 断言实际在 `docs/prompts/05:432` |
| R1-9 | **MINOR** | 04 §2.1 用 `（00 §2.1）` 支撑"路径语义"，但 `00 §2.1` 是"服务端发射面"，全文无路径前导规范 |

**放行判断：不放行。** R1-1 是冻结契约与全部子文档的直接冲突，必须先改 `00 §3`（或改三篇的接缝描述并登记）才能进实现；R1-2 的门禁数字是验收判据本体，写错等于验收失效。其余 MAJOR 是"同一处两个作者/两种机制"，实现时会二选一而另一篇的验收断言落空。R1-1、R1-2 修完即可放行（R1-3/4 在同一轮回写里一并改）。

---

## 二、必查清单逐条结论

1. **同一处代码被两篇同时认领** —— **无重复认领、无落空**。`useWorld.ts` switch 的两个作者是**线级不重叠**：02 写 `case 'world_event'` + 删两条死监听（02 §8 落点表 `:277-281`），03 写三个 `character_*` case（插在 `case 'tool_end'` `:309` 之后，03 §8.1）。01 §8.0 第 9–11 行把 `useWorld`/`App`/`CharacterModal` 三处标为"03"，02 §9 第 9 行也自述"02 只划边界、不实现；由 A3 加三字面量 case"，两篇一致指向唯一作者 03。**但见 R1-3/R1-4：01/03 对同一落点写了互斥的实现细节。**

2. **接缝形状逐字一致** —— **是**。01 §6.2（`:132-135`）、02 §6.1bis（`:225`）、03 §2.1/§8.1（`:374-378`）三处均为 `airp:character-frame` + `detail: msg` + **无条件** `case` 三连；无一处写"有条件 dispatch"。**但基座 `00 §3:81` 与三者冲突（R1-1）。**

3. **`UseWorldApi` 结论一致** —— **是**。01 §6.2（`:142`）"不加任何字段"、02 §3.9（`:161-169`）"不新增"、03 §2.2（`:29-31`）"不加成员（与 02 已对齐）"，三篇同结论。

4. **去重/重取边界** —— **一致**。02 §6.1bis 声明角色帧"不进去重、不进 refetch"；03 §8.1 的 case 体只有一行 `dispatchEvent`（`:373-379`），无 `fetchLayer`、不碰 state、不碰 `seenEventIdsRef`。互证成立。

5. **转发集合** —— **集合逐字一致，排版有意不同**。02 §3.5（`:120-143`）的目标集合 = `00 §5`（`:100-110`）= `docs/tools/12 §6.6:683-689`：`file_changed` + `card_position` + `world_event{entity_*}`。01 §6.2（`:139`）"不进转发集合"与之相容；04 §6（`:177-187`）"`dice_result` 不转发/不消费"与 02 §11-7（`:364`）"归 B 档"相容。02 §3.5 另建议把 `world_event` 的转发挪进 case、判重之后调用——这是**已声明的排版差**（":156 实现排版（推荐，非契约改动）"），可观测集合不变；但它确实改变了"重复 `world_event` 是否仍转发"（`00 §5` 字面版会转发重复帧，02 版不会），属 02 有意收口，不计为缺陷。

6. **门禁计数自洽性** —— **不自洽，见 R1-2**。手算（`compare()` 直接驱动，`emitted` 取契约 24 项、`consumed` 取 `useWorld.ts` 8 项）：基线 **14**；只落 02 后 **11**；A 档全部落地（02+03）后 **9**，残留为 `writer_delta, chalk_writing, chalk_landed, canvas_patched, dice_result, image_generation_progress, image_landed, writer_idle, show_frame`。02 §10.1 与 04 §10.2 的"8 条"均漏 `writer_delta`。

7. **`docs/footprint/`、`docs/audio/`、`docs/hooks/` 引用抽查** —— 抽 7 条**全部命中**：`docs/audio/02 §3.8`（`:243 playStinger`）、`docs/audio/04 §3.2`（`:78`）、`docs/audio/00:327`（stinger 行）、`docs/hooks/03 §4.3`（`:480`）、`docs/hooks/00 §14`（`:300`）、`docs/tools/09 §6.4`（`:511`）、`docs/tools/00 §6.2`（`:281`，04 §7.3 引 `:311/:318` 亦命中）。**唯一反例：04 §2.1 的 `（00 §2.1）`（R1-9）。** `docs/footprint/` 仅被 00 §2.2/01 §4 以 `lib/footprint.ts` 形式提及，未引小节号，无悬空。

8. **05 回写清单 R1–R10 与现状比对** —— R1/R2/R3/R4/R7/R8/R9 的位置与现状**吻合**（R1 三处 `核实更正` 已验证：`hooks/00:193`、`hooks/03:517`、`hooks/06:294`；R8 `doc-21:25,204` 两处删除断言属实；R9 `后端实现计划:80,204`"只广播 `file_changed`"属实）。**R10 目标不存在（R1-5）**；R5/R6 行号有偏（R1-6/R1-8）；R7 覆盖面过窄（R1-7）。另有 `体检 §6` 第 8 项（`后端实现计划:525` `WS_COMMANDS`）未进 R 清单、被降级为 05 §7 冲突 3——05 已说明理由（"不是过期而是未来"），不计缺陷。

---

## 三、Findings

### R1-1（BLOCKER）冻结契约 `00 §3` 与 01/02/03 的路由归属正面冲突

**两侧原文**

- `docs/wiring/00-共同上下文.md:81`：

  > **前端契约**：`useWorld` 对 `character_*` 帧按 `msg.characterId` 路由到对应角色；缺失时按"当前打开的角色遮罩"兜底（单角色世界仍可跑）。

- `docs/wiring/01-角色身份.md:132-135`（§6.2 冻结代码）与 `docs/wiring/03-角色流式.md:374-378`（§8.1）：

  > `case 'character_delta': case 'character_message': case 'character_idle':` → `window.dispatchEvent(new CustomEvent('airp:character-frame', { detail: msg }));`
  > 01 `:64`：**无条件**…体内不改任何 React state；01 `:146`（§6.3）：归属在 `App`。
  > 02 `:225`（§6.1bis）：三个 case 体内无条件 dispatch…**过滤/归属在 App**…不在 useWorld。

**为什么是真矛盾**：`00 §0` 规定 `00` 是本批跨端形状的权威层，子文档"MUST 遵守，MUST NOT 自改"。`00 §3:81` 把路由职责挂在 `useWorld` 上，而三篇子文档统一把它挪到 `App`（理由是"`useWorld` 无条件派发，缺失 id 也要能兜底"，01 §3 步骤 8 的"为什么无条件"）。按 `00` 字面实现，`useWorld` 会自己按 `characterId` 过滤——那正是 01/03 明确禁止的形状（它会让无 id 的旧帧直接哑掉、且日志上"帧被吞"无处可查）。三篇子文档的「发现的冲突」章节（01 §11、02 §11、03 §11）**都没有登记这一条**，所以这不是"已裁决的分歧"，而是**漏登记的失配**。实现者只要照着 `00` 写，接缝就错。

**修法建议**：改 `00 §3:81`（它是唯一错的一侧），把主语从 `useWorld` 换成 `App`：

```markdown
**前端契约**：`useWorld` 对 `character_*` 帧**无条件**转发（`airp:character-frame`，`detail` = 原始帧）；
`App` 按 `detail.characterId ?? 当前打开的角色遮罩` 归属到对应 `CharacterModal`（缺失 id 时兜底；单角色世界仍可跑）。
```

改完在同回合广播给 01/02/03 三篇（`00 §10` 协作规则第 2 条）。

---

### R1-2（MAJOR）门禁残留数算错：A 档后是 9 条 dark，不是 8

**两侧原文**

- `docs/wiring/02-事件消费与去重.md:330`：

  > A 档全部落地后剩余 **8 条 dark**：`writer_idle`、`chalk_writing`、`chalk_landed`、`canvas_patched`、`image_generation_progress`、`image_landed`、`show_frame`、`dice_result`

- `docs/wiring/04-骰子与请求体.md:280`：

  > A 档完成后仍然残留的 **8 条 DARK** 全在 `docs/wiring/00 §1` 的"不做"清单里：`writer_idle`、`chalk_writing`、`chalk_landed`、`canvas_patched`、`image_generation_progress`、`image_landed`、`show_frame`、`dice_result`

- 对照 `docs/wiring/00-共同上下文.md:32`（不做清单**含** `writer_delta` 的湿墨演出）与 `:151`（完成判据："findings 从 14 降到只余 `show_frame` + 明确登记为后续的暗帧"）。

**为什么是真矛盾**：`node tools/check-ws-contract.mjs` 基线 `14 findings / 8 consumed / 24 in contract`（退出码 1）。`KNOWN_DARK`（`tools/check-ws-contract.mjs:70-83`）共 12 条，其中 `world_event`、`character_delta`、`character_idle` 由本批消除，`show_frame` 结构标记仍报（`:0`）。用 `compare()` 直接驱动手算：

```
baseline(A档前)              = 14
只落 02                       = 11
A 档全部（02+03）             = 9
残留 = writer_delta, chalk_writing, chalk_landed, canvas_patched,
       dice_result, image_generation_progress, image_landed,
       writer_idle, show_frame
```

`writer_delta` 既未被 02/03 消费，`KNOWN_DARK` 里也有它，更没有进 `INTENTIONALLY_UNCONSUMED`——它必然留在残留里。02/04 的列举把它漏了，于是两篇的残留枚举与 `00 §1/§9` 的算术都对不上（14 − 2 ghost − 3 dark = 9 ≠ 8）。注：`docs/wiring/前端接线体检.md:183` 的 A 档描述写了"接 `writer_delta`…"，这可能是 02/04 误按"writer_delta 属 A 档"来算的依据；但 `00 §1:32` 已把 `writer_delta` 划入不做，体检是只读参考（`00 §0` 第 4 层），以 `00` 为准。

**修法建议**：改 02 §10.1 与 04 §10.2，各补 `writer_delta` 并改数字为 9（残留清单本身以 `00 §9` 措辞为准）：

```markdown
A 档全部落地后剩余 **9 条 dark**：`writer_delta`、`chalk_writing`、`chalk_landed`、`canvas_patched`、`dice_result`、`image_generation_progress`、`image_landed`、`writer_idle`、`show_frame`——全部是 `00 §1` 明列的不做项或 B 档。
```

---

### R1-3（MAJOR）`streamLine` 存亡：01 说保留喂入，03 说整体删除

**两侧原文**

- `docs/wiring/01-角色身份.md:71`（§3 步骤 10，行为契约）：

  > **`CharacterModal` 消费**（实现归 03，见 §8 边界说明）：把帧文本喂给**既有 `streamLine`**（`CharacterModal.tsx:106-144`），删除假回复库调用点（`:180-186`）。

- `docs/wiring/03-角色流式.md:127` 与 `:133`（§3 步骤 3）：

  > 现状 `streamLine(fullText, mood)`（`:106-144`）**不能复用**，必须重写驱动器：
  > …所以：**保留它的韵律与沉思窗，替换它的输入契约**。`streamLine` **整体删除**（不是保留旁路）。

- 03 §8.3 落点表 `:409`：`| :106-144 | **删 `streamLine`**，替换为 `beginStream()` + `pump()` + `settleIfReady()` + `armTurnWatchdog()` |`

**为什么是真矛盾**：两篇描述的是**互斥**的改造。01 冻结的行为契约是"帧文本 → 既有 `streamLine(fullText, mood)`"（整句驱动）；03 的整个 A3 设计恰恰是"拆掉整句驱动、换成可增长缓冲 + 节拍泵"，并明说 `streamLine` **不能复用、整体删除**。01 §8.0 已把该落点判给 03，所以实现只会照 03 做——01 §3 步骤 10 与 01 §10 验收（若照其写）就成了作废断言；更实际的风险是：01 的"漏了会怎样"链（步骤 8→9→10）把"接缝通了"定义为"喂进 `streamLine`"，实现者按 01 自检会漏掉 03 真正的驱动器重写。

**修法建议**：改 01 §3 步骤 10 的落点句（01 是只在服务端 1–8 落点的篇，前端 9–11 归 03），改为指向 03 的驱动器、不再点名 `streamLine`：

```markdown
10. **`CharacterModal` 消费**（实现归 03，见 §8 边界说明）：03 把真实帧喂进**重写后的流式驱动器**（`beginStream`/`pump`，`docs/wiring/03-角色流式.md §3 步骤 3`），删除假回复库调用点（`CharacterModal.tsx:180-186`）。
```

---

### R1-4（MAJOR）`activeModalCharId` 归属机制：01 冻结 ref，03 用 state+deps

**两侧原文**

- `docs/wiring/01-角色身份.md:146`（§6.3）与 `:58`（§3 步骤 9）：

  > 用 **ref** 存当前遮罩 id（避免把订阅扔进依赖数组反复重挂），`detail.characterId ?? ref.current` 相等才转发；无遮罩且无 id → 丢弃。

- `docs/wiring/03-角色流式.md:89` 与 `:102`（§步骤 1 代码）：

  > 在既有的 world-event 订阅 effect（`App.tsx:148-152`）之后新增一个同形状的 effect，deps = `[activeModalCharId]`：
  > …`}, [activeModalCharId]);`
  > 且 `:110`："用 `activeModalCharIdRef` 替代 deps → 也行，但多一个 ref 要同步"

**为什么是真矛盾**：01 §8.0 第 10 行明确把 App 落点判给 03，但 01 §6.3 又"冻结"了 App 侧的实现机制（ref + `detail.characterId ?? ref.current`）；03 的实现语义不同（state + `[activeModalCharId]` deps + 显式三分支判空）。二者**可观测行为**也不同：01 版是"ref 比较、相等才转发"，03 版是"deps 变更 → 重订阅 → 在 effect 内再次比较"，且 03 版在缺 id 分支上补写了 `activeModalCharId`（`{ ...msg, characterId: msg.characterId ?? activeModalCharId ?? undefined }`）。03 自述"ref 也行"，说明作者知道两种都可行——但 01 把它写成"冻结"，就与"实现可选"冲突了：接缝形状冻结、**机制不该冻结**。

**修法建议**：改 01 §6.3/§3 步骤 9，只冻结**可观测语义**（`characterId` 缺失时兜底到当前遮罩 id，无遮罩则丢弃），把 ref/state 交还 03：

```markdown
归属在 `App`。判据：`detail.characterId ?? 当前打开遮罩 id` 相等才下推；无 id 且无遮罩 → 丢弃。
（机制——ref 或状态 + deps——由 03 定；本文件只冻结这条判据。）
```

---

### R1-5（MAJOR）05 R10 指向一条不存在的断言

**两侧原文**

- `docs/wiring/05-文档回写.md:123-125`：

  > ### R10 — `docs/hooks/00-共同上下文.md:251` 的 `chalk_landed` 引用
  > **依据**：设计 02 若改变 `useWorld` 行号，本处引用需同批更新。

**现状**：`docs/hooks/00-共同上下文.md:251` 的实际内容是"doc-22 §6 说'扩展侧只读打开'——不成立…`LocalWorldStore`…"（关于 store 只读性），与 `chalk_landed`/`useWorld` 无关。全仓 `grep -rn "chalk_landed" docs/hooks/` **零命中**；`grep -rn "useWorld" docs/hooks/00-共同上下文.md` 亦零命中（该文件的 `useWorld` 引用在其他 hooks 篇，如 `docs/hooks/05-视点链路.md:72,512,524`）。

**为什么是缺陷**：这条"回写项"没有可回写的对象——目标文件/行号指向另一件事，且该文件里根本不存在所声称的引用。按字面执行会改错行（`hooks/00:251` 是无关段落）；不执行则 R10 永远悬空。设计 02 也确实要移动 `useWorld` 的行号语义（02 §11-1 已登记 `docs/tools/12 §6.6` 的同源漂移），所以"有引用需更新"的**意图**是对的，只是**位置**错了。

**修法建议**：把 R10 的目标从"不存在的 `hooks/00:251`"改为真实存在、且确实引用了 `useWorld` 行号的 hooks 篇（要么删掉 R10，要么重定向）：

```markdown
### R10 — `docs/hooks/05-视点链路.md:512,524` 的 `useWorld.ts:67` 引用
**依据**：设计 02 改变 `useWorld` 行号后需同批更新（同 R7 的判据）。由实现批同 commit 回写。
```

（若确认 `docs/hooks/**` 里没有任何 `chalk_landed` 引用，则该条应**删除**——它记录的是一条并不存在的假断言。）

---

### R1-6（MINOR）05 R5 的行号偏 2 行

**两侧原文**：`docs/wiring/05-文档回写.md:73`「R5 — `docs/ui/前端改造计划.md:551` 收工检查表 P3 行」。
**现状**：P3 行在 `docs/ui/前端改造计划.md:549`（`- [ ] **P3（遮罩形态已达成）**：…剩余 T3.1 服务端角色流式（前端仍为标注的本地回退）…`），`:551` 是 P5 行。
**影响**：回写时按 `:551` 定位会落到 P5（"追光与线索风暴…"），断言与动作错位。
**修法**：把 R5 的目标改为 `docs/ui/前端改造计划.md:549`。

---

### R1-7（MINOR）05 R7 的回写面漏了大半同类漂移引用

**两侧原文**：`docs/wiring/05-文档回写.md:91`「R7 — `docs/tools/02-chalk.md:455`、`docs/tools/09-link与arrange.md:497` 的 `useWorld.ts` 行号」。
**现状**：同一类"`useWorld.ts` 行号已漂移"的引用至少还出现在 `docs/tools/04-move与delete.md:559,561,670`、`docs/tools/05-move-to与set-following.md:711,816`、`docs/tools/07-roll-dice.md:771`、`docs/tools/08-use-item-on.md:518,534`、`docs/tools/12-工具注册与路由统一.md:585,588,679`、`docs/tools/03-look-at与画布感知.md:986`（`grep -n "useWorld\.ts:[0-9]" docs/tools/`）。R7 只点名 2 个文件，其余同类假引用不在回写清单内。
**影响**：C 档的目标是"把已知为假的文档断言改对"（05 §1）；只修 2 处会让其余漂移引用继续误导下一位维护者，且 R7 自身推荐的"改成语义引用"若不铺开，漂移会再发生。
**修法**：在 R7 里把目标扩成"`docs/tools/**` 中所有 `useWorld.ts:<n>` 行号引用"（可用一次 `grep -rn "useWorld\.ts:[0-9]" docs/tools/` 圈定），或明确写"本次只修 02/09 两处，其余登记为后续"。

---

### R1-8（MINOR）05 R6 的引用区间差一行

**两侧原文**：`docs/wiring/05-文档回写.md:81`「R6 — `docs/prompts/00-共同上下文.md:214` 与 `docs/prompts/05-装配与验证.md:427-431`」。
**现状**：`docs/prompts/05-装配与验证.md` 的 `show_frame` 断言在 `:432`（`:429-433` 是"§8.3 本批不做/边界"块），`:427-431` 不含该句。
**影响**：定位区间不含目标句；执行回写时会先找一遍。属轻量偏差（`docs/prompts/**` 本次仅登记不改，R6 不落地）。
**修法**：把区间改为 `:432`（或 `:429-433`）。

---

### R1-9（MINOR）04 §2.1 的 `（00 §2.1）` 引用无效

**两侧原文**：`docs/wiring/04-骰子与请求体.md:25`「`path: string; // 世界根相对 POSIX 路径，无前导 './'（00 §2.1）`」。
**现状**：`docs/wiring/00-共同上下文.md §2.1` 是"服务端发射面"（帧映射、`EventSink` 缺口），全文没有任何"世界根相对 POSIX 路径 / 无前导 `./`"的规范（`grep -n "前导" docs/wiring/00-共同上下文.md` 零命中）。该约束的真实来源是服务端校验（`apps/server/src/routes/world.ts:685-687`）与 `docs/tools/07 §2.4`。
**影响**：读者按 `00 §2.1` 找不到路径语义，只能反推；不构成实现错误，但违反本批"每条断言带 `file:line`、引用必须命中"的纪律（05 §6 的 check:docs 精神）。
**修法**：把 `（00 §2.1）` 换成真实来源，如 `（docs/tools/07 §2.4；校验见 routes/world.ts:685-687）`。

---

## 四、已核验为"无矛盾"的项（免重复审查）

- `UseWorldApi` 三篇同结论（§二·3）。
- `airp:character-frame` 事件名/detail/无条件 dispatch 在 01/02/03 字面一致（§二·2）——冲突只在基座 `00 §3:81`。
- 角色帧不进 `seenEventIds`、不 refetch，02 §6.1bis 与 03 §8.1 互证（§二·4）。
- 转发集合 = `00 §5` = `docs/tools/12 §6.6:683-689`；`canvas_patched` 不转发（`docs/tools/09 §6.4:511`）；`dice_result` 归 B（02 §11-7 与 04 §6 相容）。
- 02 §8 与 03 §8.1 对 `useWorld.ts` 的编辑线级不重叠，唯一作者均为 03（01 §8.0 第 9 行与 02 §9 第 9 行一致）。
- 抽查的 7 条 `docs/audio|hooks|tools` 小节引用全部命中（§二·7）。
- 数字类：02 §3.5/§10.1 的 `consumed = 8 → 7`、基线 `14 = ghost 2 + dark 12` 与实跑一致；03 §10.1 的"A3 后 = 12"在其自身口径（只算 A3）内成立（只错在跨篇合算，见 R1-2）。
