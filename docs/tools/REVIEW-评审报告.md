# B1 工具面设计评审报告

> 状态：**评审完成（2026-09-12）**。评审对象：`docs/tools/00`（冻结契约）+ `01`–`12`（工具与接线设计）。
> 方法：5 个独立视角的评审子代理（跨文档一致性 / doc-20 语义 / doc-19 强度 / 可实施性 / 反模式与风险）各自产出 findings，**逐条由主控对照原文与真实代码核实**，去重后给出裁决。
> 裁决语义：**ACCEPT**（真问题，必须修）| **REJECT**（误报）| **DEFER**（真问题但可留到实现期/赛后）。

---

## 0. 总裁决

12 篇设计**质量高、互为地基、诚实登记了大量冲突**；接口层（`00` + `01`）的设计是扎实的。但评审暴露出一类**系统性问题**：

> **`01` 的 §5 方法表被立为"契约"，却没有被下游逐行核对。** 12 篇文档里，凡 01 §5 与下游工具文档的同一条目，**几乎每一处都对不上**（`linkCards` / `arrangeCards` / `getComponent` / `showComponent` / `viewCanvas` / `createEntity` / 三个 layer 方法 / `carryFollowers`）。这不是笔误，是**"冻结契约"实际没冻结**。

另有 4 条**会直接导致运行时错误或构建失败**的硬缺陷（DROP TABLE、`HTTP_STATUS` 缺键、`resolvePath` 拒绝 `.airpworld`、`resolveAgentActor()` 漏参），以及一条**演示链路硬断点**（`bg:` 路径前缀）与一条**违反"不静默降级"的自相矛盾**（`move` 的 `near` 被忽略）。

**结论：设计方向通过，但必须先做一轮"契约对齐 + 硬缺陷修复"再进实现。** 详单见下。

---

## 1. BLOCKER（不修则实现做错/返工/构建失败）

### B-1 `HTTP_STATUS` 缺 `dice_already_rolled` —— `packages/shared` 编译失败
- **出处**：`01 §2.4`（枚举 17 个成员）vs `01 §7.1`（`Record<ActionErrorCode, number>` 字面量只有 16 键）。
- **证据**：枚举含 `dice_already_rolled`（`01:164`）；字面量 `783-799` 行无此键。`Record<ActionErrorCode, number>` 在 `tsc -b` 下是穷尽性检查 → **`pnpm build` 直接失败**。
- **裁决**：**ACCEPT（blocker）**。07 §11 冲突 4 独立发现同一处。
- **修法**：`01 §7.1` 补 `dice_already_rolled: 409`。

### B-2 `resolvePath` 的保留前缀规则拒绝所有 `.airpworld` 路径
- **出处**：`01 §7.3` 的 `if (segs.some((s) => s.startsWith('.')) || segs.includes('node_modules')) throw invalid_path`。
- **证据**：同一文档 `§10.1` 白名单要求 `generateImage` 写 `<worldRoot>/.airpworld/assets/**`；`§2.7` 新增 `readFileBase64` 读同一子树；`11 §3.2` 步骤 6 调 `writeFileAtomic('.airpworld/assets/gen/….png', Buffer)`；`03 §6.3` 写 `.airpworld/eye/<hash>.png`。**每个 `.airpworld/...` 的第一段就以 `.` 开头 → 全被拒。**
- **裁决**：**ACCEPT（blocker）**。功能与自身白名单直接冲突。
- **修法**：保留前缀规则改为"**拒绝 `..` 与 `node_modules`，但放行 `.airpworld`**"（`.airpworld` 是唯一的允许隐藏根，且它已是世界的一部分）。或提供独立的系统路径入口（`writeAsset`）。

### B-3 `resolveAgentActor()` 漏传 env —— `choose` / `roll_dice` 的事件 actor 恒为 writer
- **出处**：`01 §2.3` 冻结 `resolveAgentActor(raw: string | undefined)`；`06 §2.4`（`06:342`）与 `07 §2.3`（`07:491`）都写 `actor: resolveAgentActor()`（无参）。
- **证据**：对照 12 §8.3 用的是 `resolveAgentActor(process.env.AIRP_AGENT_ROLE)`；05/08 用 `serviceFor(ctx)`。无参 → `raw` 恒 `undefined` → 按 01 §2.3 降级为 `{type:'writer'}` + 告警。
- **后果**：角色 agent 调 `choose`/`roll_dice`（doc-20 §1.1 明确允许）时，事件 `actor_type` 记成 `writer`；而 doc-21 §5.1 的作家游标读取**排除 `actor_type = writer`** → 角色自己的动作被作家当"自己写的"过滤掉。
- **裁决**：**ACCEPT（blocker）**。
- **修法**：`06 §2.4` / `07 §2.3` 的工具壳改为 `resolveAgentActor(process.env[AGENT_ROLE_ENV])`（或统一用 `agentActor()` helper）。

### B-4 `DROP TABLE IF EXISTS events` 无守卫，每次开库清空历史
- **出处**：`01 §8.1` 把迁移落在 `initHistoryDatabase`；`LocalWorldStore` 构造函数每次都调它（`local-store.ts:63`）。
- **证据**：`01:879` 的 `DROP TABLE IF EXISTS events;` 无"仅当旧五列形状"守卫。触发点：**每次 server 重启、每次 `/api/worlds/load` 切世界**（各 new 一个 store）。
- **后果**：事件表每次启动被清空 → 世界历史、历史面板、尾部读表/游标设计所服务的一切都会丢。
- **裁决**：**ACCEPT（blocker）**。文档正文的口径是"直接改 CREATE TABLE，不写迁移脚本"（一次性），但**代码片段写得会反复 DROP**——是实现照抄即踩的坑。
- **修法**：改为**形状探测式迁移**：查 `PRAGMA table_info(events)`，只有缺 `seq`/`actor_type` 列时才 `DROP` + 重建；已是新形状则跳过。（仍可"不写迁移脚本"——这是一次性的形状检查，不是版本迁移。）

---

## 2. MAJOR（体验或一致性实质受损）

### M-1 `01 §5` 的"契约"与下游六处签名不一致（系统性问题）
- **证据（逐条核实）**：

| 01 §5 行 | 01 冻结的输入 | 下游文档实际定义 | 下游 |
|---|---|---|---|
| 2 `viewCanvas` | `mode?: 'text' \| 'image'` | `mode?: 'auto' \| 'image'` | 03 §2.2 |
| 12 `linkCards` | `{ layer, from, to, style?, label? }` | `{ op, from?, to?, id?, style?, color?, directed?, label? }`（无 layer，多 op） | 09 §2.1 |
| 13 `arrangeCards` | `{ layer, layout: 'grid'\|'circle'\|'row', paths? }` | `{ place?: …, layout?: …, w?, h? }` | 09 §2.6 |
| 14 `getComponent` | `{ name?, kind?, list? }` | `{ component?: string\|string[] }` | 10 §2.1 |
| 15 `showComponent` | `{ component, path?, props? }` | `{ component, target?, links?, params?, duration_ms?, caption? }` | 10 §2.2 |
| — `createEntity` | **不存在** | `12 §2.4.1` 新增为 god-action create 分支 | 12 |

- 此外 `02 §3` 步骤 9 仍按 01 旧形状调 `linkCards(ctx, { layer, from, to })`（缺 `op`）→ 按 09 契约会抛。
- **裁决**：**ACCEPT（major）**。`linkCards` / `arrangeCards` / `getComponent` / `showComponent` 的**下游形状更正确**（下游有完整理由，01 只是占位草稿），但"契约"被架空了。
- **修法**：以**下游为准回写 `01 §5`**（09/10 的形状），`viewCanvas` 的 mode 取 03 的 `'auto'|'image'`，`createEntity` 正式入表。并在 `00 §6` 加一句"01 §5 是索引，工具输入形状以各工具文档为准；两者不一致时以工具文档为准并回写 01"。

### M-2 `toolkit/` 文件名三处不一致（12 冻结的布局 vs 05/08/10）
- **证据**：12 §2.2 定 `following.ts` / `component.ts` / `use-item.ts`；05 §2.2 写 `set-following.ts`；10 §8.4 写 `get-component.ts`；08 §2.1 写 `use-item-on.ts`。`extensions/tools.ts` 按模块路径 import，命名必须唯一。
- **裁决**：**ACCEPT（major）**。
- **修法**：以 **12 §2.2 为准**统一（`following.ts` / `component.ts` / `use-item.ts`），05/08/10 改自己的文件名。

### M-3 `set_following(false)` 的"no-op"分支实际 INSERT 了一条 presence 行
- **出处**：`05 §3.6.1` 分支自述"幂等 no-op … 世界没变 → 不落账"，代码却调 `upsertPresence(..., { layer: MAP_LAYER, x:0, y:0, following:false })`（`05:426`）；同文 §3.7 表又写"不落账（且不改 world）"。
- **后果**：给一个从无 presence 的角色**凭空造出一条 `layer='map'` 的 (0,0) 行** → 该角色在地图上出现一个幽灵头像，且无任何事件记录（违反 doc-21 准入第 1 问 + 00 §6.2 不静默）。
- **裁决**：**ACCEPT（major）**。三个评审视角独立命中。
- **修法**：no-presence 分支**直接返回 `changed:false`，不调 `upsertPresence`**；或若确实想落位，则必须**落 `character_moved` 事件**并改掉"no-op"的措辞。

### M-4 `move` 静默忽略 `near`（违反自身的"不静默忽略"纪律与 00 §6.2）
- **出处**：`04 §2.3` 要求 near 不满足时"报错，不静默忽略"；但 `§3.9.4` 决定同层改名 + near → "忽略 near 并 warn"（`console.warn`），`§3.9.3` 决定 `seatNear` 耗尽也只 `console.warn`。
- **后果**：作家收到成功消息、以为物件摆到了柜台边，实际落在别处；`MoveEntityDetails` 无 `nearIgnored`/`seat.exhausted` 标志可暴露。对照 05 有 `details.seat.exhausted`。
- **裁决**：**ACCEPT（major）**。
- **修法**：`details` 加 `nearIgnored?: true` / `seat: { exhausted: true }`，返回文本显式说明"near 被忽略"；耗尽至少让模型可见。

### M-5 `lock` 的 `accepts.itemKinds` 与真实铜钥匙不匹配（演示 money shot 失效）
- **出处**：`10 §2.1` 的模板示例印 `itemKinds: [key]`；§15.2 的匹配规则拿 item 的 `type`/`component` 比 `itemKinds`、`tags` 比 `itemTags`。
- **证据**：铜钥匙是 `type: note` + `tags: [key]`（doc-10 E1），没有 `component: key`。按模板生成的 lock **永远匹配不上** → 前端不加 `puzzle-target-ready` 高亮 → doc-19 §3.1 的拖拽目标对玩家不可见。
- **裁决**：**ACCEPT（major）**。10 §14.5 的正例其实是对的（`itemKinds:[note], itemTags:[key,…]`）——是 §2.1 模板写错了。
- **修法**：`10 §2.1` 模板改为 `itemKinds: [note]` + `itemTags: [key]`；并在 §15.2 明确"`itemKinds` 比 `type`，`itemTags` 比 `tags`"。

### M-6 `container` 有 `use_item=是` 与 `status.data.opened` 约定，却没有确定性 handler
- **出处**：`10 §14.4` 给 container 标 `use_item = 是` 并定义 `opened`；`08 §8.4` 只为 `lock` 规定 MUST handler。
- **证据**：doc-19 §7 的 0:30–1:30 演示节拍是把铜钥匙丢在**铁箱（container）**上、期待爆出怀表与便签。没有 handler → 丢失于动作当下无任何可见变化（`status.data.opened` 不会翻转）。
- **裁决**：**ACCEPT（major）**。08 §13 的补救设计（"把即时性全堆在 <100ms 的 ①"）对 container 目标整条失效。
- **修法**：给 container 补确定性 handler（翻 `opened`、落 `entity_edited`），或把 node-19 的演示目标改回 `lock` 并在模板里写明。

### M-7 08 与 10 的 handler 权限契约互相矛盾（各自都声称"逐字一致"）
- **证据**：`10 §15.3` 纪律 2 允许 handler 用 `store` 的 `writeFileAtomic` **/ `move` / `appendEvent`** 改世界；`08 §3.4` 纪律 5 明文"handler MUST NOT 创建/移动/删除实体，唯一允许的世界改动是重写 target 自己的 frontmatter"。08 §8.1 又说"与 10 §15.3 逐字一致"。
- **后果**：按 10 写的 handler 可以移动物件 → 违反 08 §3.1"事件只落一次"的保证（handler 的 move 会再落一条 `entity_moved`，与 `use_item_on` 的因果顺序倒置）。
- **裁决**：**ACCEPT（major）**。
- **修法**：以 **08 为严**（handler 只改 target 自己的 frontmatter），10 §15.3 纪律 2 删掉 `move`/`appendEvent`；两处措辞复述同一条。

### M-8 `character_talked.turns` 没有生产者
- **出处**：`12 §3.5` 说 turns 由前端给，并点名 `"CharacterModal.tsx:158 已有消息计数上下文"`。
- **证据（实测）**：`CharacterModal.tsx:158` 是 `onSendMessage?.(msg);`，组件无消息计数；`grep -rn character_stop apps/web/src` **零命中** —— 前端根本不发 `character_stop`。`App.tsx` 的 `closeCharacterModal` 只清 modal id。
- **后果**：`turns` 恒回落 1，`character_talked.detail.turns` 契约静默退化。
- **裁决**：**ACCEPT（major）**（口径错误 + 缺口）。12 §12.5 自己也怀疑了前端可信度，但没查证"前端有没有这个计数器"。
- **修法**：要么在 `CharacterModal` 加计数并在关遮罩时发 `character_stop`（登记为前端任务），要么 server 侧按 `character_prompt` 转发次数计（12 自己否决了它）——**必须在评审记录里明确选一个**，不能留"假设前端有"。

### M-9 `bg:` 路径前缀不一致 —— "生图 → 看到图"演示链路的硬断点
- **出处**：`11 §11 冲突 2`。模板 README 写 `bg: "assets/scenes/…"`（无 `.airpworld/` 前缀），`routes/world.ts:465` 按世界根解析 → `<worldRoot>/assets/…` → 不存在 → 404 → `SceneBackdrop` 回退材质皮肤。
- **证据**：`find templates -type d -name assets` 无命中；四个模板 README 全是这种写法。
- **后果**：生图上线后"图生成了但底图不换"。12 §12.8 也把它登记为"硬断点"却未排期。
- **裁决**：**ACCEPT（major）**。
- **修法**：统一到 `.airpworld/assets/…` 全路径（改模板 README + `SceneBackdrop` 注释 + 前端计划 §524），或在 `readLayerBg` 补前缀并在 `00 §2.1` 写明简写规则。**11 推荐前者，采纳。**

---

## 3. 一致性小项（ACCEPT，minor，但必须一并改否则实现期对不上）

| # | 问题 | 出处 | 修法 |
|---|---|---|---|
| m-1 | `no_free_seat` HTTP：01 是 **507**，12 §7.1（自称以 01 为准）写 **409** | 01 §7.1 / 12 §7.1 | 12 改回 507（或 01 改 409 并同步两处，二选一并统一） |
| m-2 | `not_movable` HTTP：01/04 = **409**，12 写 **422** | 01 §7.1 / 12 §7.1 | 12 改 409 |
| m-3 | "无 frontmatter 块" → 06 §7.1 映射 `not_interactive`，01 §2.4 与 07 §7.1 映射 `malformed_entity` | 06 / 01 / 07 | 统一为 `malformed_entity`（06 改） |
| m-4 | `roll_dice` 缺字段 → 06 §3.3 归一化后 `roll_dice=null`（永远走 `not_interactive`），07 §3.1 步骤 4 却想走 `malformed_entity` | 06 / 07 | 明确：**归一化后缺失 = `not_interactive`**；`malformed_entity` 只用于"整块 frontmatter 坏"。07 改 |
| m-5 | `entity_created.detail.kind` 封闭五值枚举 vs `cardKindOf` 返回六值（`chalk/gate/letter/note/sprite/default`） | 00 §5.2 / 12 §11 冲突 3 / 04 §3.3 | 抽 `eventKindOf(fm, filename)` 做显式映射（`gate`/`sprite`/`component`→`component`；`default`→`other`），04 导出、12 复用 |
| m-6 | `view_canvas` 的图片缓存 key `(COUNT(*), SUM(x+y))` 非单射（镜像/互换布局同 key）→ 可能供给过期画布 | 03 §6.3 | 用更健壮的 revision（如 `SELECT group_concat(id||x||y) ...` 的 hash），或直接不做缓存（mode:'image' 已 defer） |
| m-7 | `01 §9` 的旧调用点清单漏 `tools/probe-writer.mjs:67`（`appendWorldEvent`）——而 `pnpm probe` 是必过门 | 01 §9 | 清单补 `probe-writer.mjs:67`；实现顺序里把探针迁移排进 |
| m-8 | `01 §9` 把 `item_moved` 广播的行号写成 `event-bridge.ts:303`，实际是 `routes/world.ts:303` | 01 §9 | 改行号归属 |
| m-9 | `07 §8` 说"01 §5 的 **24** 个方法够用"，实际 22 行 | 07 §8 | 改 22（或让 01 明确方法数） |
| m-10 | `link` 的 delete-with-(from,to) 命中多行：09 §3.1 说"全删并报数"，09 §7 说 `invalid_argument` | 09 | 二选一：**建议 `invalid_argument`（要求传 id）**，删掉 §3.1 的"全删" |
| m-11 | `placeCard(path, box)` 签名无 `layer`，但 SQL 写 `cards.layer NOT NULL` | 09 §4.2/§3.2 | 签名补 `layer` 或注释明确由内部 `resolveLayer(path)` 推导 |
| m-12 | `12 §2.4` 说 `/card/position` 返回 `{canvas, changed}`，09 §6.1 是 `{kind, action, layer, cards, path?}` | 12 / 09 | 统一为 09 的形状（12 的 mapEngineEvent 骨架已在读 `details.kind`） |
| m-13 | `use_item_on` 事件 detail 多出未登记的 `reason`；`details` 多 `presentation` 但 `UseItemOnDetails` 未声明 | 08 §8.1/§6.1/§2.2 | 把 `reason`/`presentation` 正式写入 08 的类型与 00 §5.2 增补说明，或删掉 |
| m-14 | `entity_created` 归属：10 §5 说 `write`/handler 也产它，但 00 §4.2 的 B 入口只兜 `write`/`edit`（且 01 §4 把 B 入口记为 `entity_edited`） | 10 / 00 / 01 | 明确：原生 `write` 产 `entity_created`（B 入口），handler 不得产事件（按 m-7 取 08 口径） |
| m-15 | `06 §2.2` 声明 `status.chart` 解析并透传，但归一化类型 `{data,label?}` 无 `chart` | 06 | 归一化类型加 `chart?`，否则"透传"是假话 |
| m-16 | `06 §10.1` 测试期望 `---\n---\n` → `frontmatter:{}`，与 §9.2 的"`frontmatter:null`，行为同旧"冲突 | 06 | 测试期望改成 `null` |
| m-17 | `02` 删 `link_to`/`append_to` 两键，`04 §3.6.3` 仍把它们当引用点重写 | 02 / 04 | 统一：键删掉后，`RefKind` 里的 `link_to`/`append_to` 也删（或 02 保留键并把线交给 canvas.db）——**建议按 09 冲突 4 的 B 案**：`link_to` 是工具参数不是持久键 |
| m-18 | 10 §15.3 handler 代码调 `restringify(fm, body)`，全批次无此函数定义 | 10 | 改为 02 冻结的 `stringifyEntityFrontmatter(frontmatter, interactive)`（或明确其归属） |
| m-19 | `02 §2.1` 引入 `clientRef`（god 乐观 UI 回显），但 `WriteChalkDetails` 无此字段、无消费者 | 02 | 要么在 `details` 里回显，要么删掉 |
| m-20 | `10 §8.2` 让 `forms.ts::cardKindOf` import `components/registry.ts`，而 registry 又 import `CARD_FORMS` → ESM 循环 + 加载期副作用 | 10 §8.2/§13.4/附录 B | 断环：`CARD_FORMS` 保持叶子、registry 单向依赖它；`cardKindOf` 的委托用惰性/纯函数方式 |
| m-21 | `01 §2.1` 把 expect 解析器写在 `actions/roll-dice.ts`，07 §2.2 定在 `rules/dice.ts`（单一真相源） | 01 / 07 | 采纳 07（`rules/dice.ts`，零依赖、前端可 import），01 的注释改掉 |
| m-22 | `01 §8` 的 barrel 导出清单开放（"内部模块不必全导出"），但扩展按 `shared/dist/index.js` 全量 import | 01 §8 / 12 §8.3 | 明确列出必须导出的公共面（types/errors/actor/service/rules/dice） |
| m-23 | `entity_moved.detail.kind` 与 `cardKindOf` 再叠加；`eventKindOf` 需 04 导出供 12 用 | 12 §11 冲突 3 | 同 m-5 |
| m-24 | `12 §3.6` 的尾部读表：in-flight drain 跨世界切换会写回旧 `lastSeq` | 12 §3.6 | drain 闭包捕获 worldRoot/epoch 标记，切世界后丢弃旧 drain 的结果 |

---

## 4. DEFER（真问题，但可留到实现期或赛后）

| # | 问题 | 裁决理由 |
|---|---|---|
| D-1 | `event_failed` 的处理（不回滚、不补偿）是否够（01 §14.1） | 语义取舍，规划已定"报错说清"；实现期若无问题即成立 |
| D-2 | `turn` 锚粒度（一轮 3 篇 chalk 合并 vs 一次工具调用一个 turn）（01 §14.3） | 属可调参数，实测后定 |
| D-3 | `snapshotWorld`/`rollbackWorld` 的实现 | doc-16 已定赛后，B1 只留 store 支撑 |
| D-4 | 同一文件并发写（后写者赢） | 单玩家世界，实测后再说 |
| D-5 | `scene-init`/`nook-init` 子代理的 actor 归 `writer`（01 §14.7） | 可接受；doc-21 无 init 专属 actor 值 |
| D-6 | `arrange` 是否改 `w/h`（09 冲突 1） | 09 已给"只改 x/y/z、w/h 归 CARD_FORMS"的结论，与 AGENTS §7.5 一致 → **实质已解，非缺** |
| D-7 | 画布状态（link/arrange）要不要落事件（09 冲突 2） | 09 结论"不落，只广播 `canvas_patched`"与 doc-10 E13 一致 → **已解** |
| D-8 | `view_canvas` 的 image 模式整体 | B1 抛 `unsupported` 是诚实降级；`mode` 保留是接口完整 |
| D-9 | `generate_image` 的 provider 选型与真模型参数（11 §12） | 需真 key 实测，设计已给可实施方案与 fail-loud 路径 |
| D-10 | 前端对 `dice_result`/`show_frame`/`world_event` 的消费（12 §12.4、INT 报告） | 归前端计划；B1 只需定帧契约（已定） |

---

## 5. REJECT（评审误报，登记备查）

| # | 误报 | 为什么不是问题 |
|---|---|---|
| R-1 | "`arrangeCards` 的 `layer` 参数矛盾" 中的部分指控 | 09 已自登记并给理由；属 M-1 的一部分，不是独立问题 |
| R-2 | "`link_to`/`append_to` 是 chalk frontmatter 键" | 02 §9.5 已定"删掉这两键"，09 冲突 4 已裁决为工具参数——属 m-17 |
| R-3 | "`03 §6.3` 的缓存 key 不单射"（RISK 视角） | 属实但 **mode:'image' 在 B1 抛 `unsupported`**，缓存代码 B1 不实现 → 归 DEFER（并入 m-6 的实现期注意） |
| R-4 | "`01 §5` 方法数是 24"（XD 视角） | 只 07 一处笔误，属 m-9 |
| R-5 | "01 未全导出 actions 破坏扩展 import" | 属 m-22（需要明确导出面，但不是"无法实现"） |

---

## 6. 结构性结论（给实现阶段的指令）

1. **先做契约对齐，再写代码**：`M-1`（01 §5 回写）+ `M-2`（文件名）+ 全部 `m-*` 的一致项，一次性改完 12 篇文档。这些是纯文档改动，成本低、收益是"实现时不必二次决策"。
2. **`00` 需要三处增补**（`01 §13` 冲突 5 已提出）：`WorldStore` 补 `resolveLayer` / `getAllReadCursors` / `writeFileAtomic` / `readFileBase64` / `writeFile(Buffer)` / `statKind`；`§2.2` 注释补"`.airpworld/assets` 是内容、不可遍历"；`§5.2` 允许 `detail` 带 `component`/`secondLayer` 可选键。
3. **四条硬缺陷（B-1..B-4）必须在实现前写进文档的最终稿**——尤其 B-2/B-3 是实现者照抄即错的形状问题。
4. **演示链路必须能跑通**：M-9（bg 前缀）、M-5（lock 匹配）、M-6（container handler）三条合起来决定"拖钥匙开锁"这个 money shot 是否成立。**建议实现优先级：lock + container + bg 前缀修复。**
5. **`use_item_on` 的打断取舍（08 §13）**：08 推荐"C = 不打断，靠事件 + 作家下一轮"。评审认可**不违反 doc-05 §5.1 定案**的取向，但要求 08 在文档里明写"若彩排发现反馈延迟不可接受，升 A（`followUp`）"的**触发条件与改法**，避免实现期各写各的。

---

## 7. 评审方法学记录

- 5 个子代理独立评审 → 62 条原始 findings → 主控对照原文与真实代码逐条核实 → 去重为 4 blocker + 9 major + 24 minor + 10 defer + 5 reject。
- 所有 `文件:行` 与代码断言均经主控在真实仓库中复核（`probe-writer.mjs:67`、`CharacterModal.tsx:158`、`index.ts` 六个分支、`HTTP_STATUS` 字面量、`DROP TABLE` 行等）。
- 一致性问题高度重复（`arrangeCards` 被 11 条 findings 命中、`set_following` no-op 被 3 个视角独立命中），说明不是个案而是系统性未对齐。
