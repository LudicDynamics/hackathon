# 评审门裁定：`[C-2]`（命令文件是否落 `entity_created`）与 `[C-3]`（角色 Agent 能否创建命令）

> 评审：`RevPendingC2C3`（2026-09-14）。证据等级 = **E2（静态读码，逐条实测 `file:line`）**。
> 本报告**只读** `docs/command/**` 与源码，未修改任何文档/代码。方案拥有者：`07`。
> 纪律：§10.16 —— 凡带 `file:line`/数字的裁定都可被推翻；本报告推翻 `07` 的**三处**论据（含其推荐路线的一条支撑）。

---

## 1. 判定（唯一、明确）

| 项 | 判定 | 一句话理由 |
|---|---|---|
| **`[C-2]`** | **方案 A：不落账。** 命令文件的创建/编辑**不产生任何世界事件**。 | `entity_created` 的全部现存消费者都把它读成"世界里多了一个**东西**在某个场景里"，而命令既不是东西也没有场景。落账不是"多一条中性记录"，是**向玩家弹一条假话**。 |
| **`[C-3]`** | **方案 A：只有 writer / initializer scope 能写 `command/`。角色**MUST NOT**创建世界命令。** | 命令是**全局规则**（契约 §3.2 冻结），而 `07 §12.2` 自己承认方案 B 的命名空间限制是"写入时而非引用时"的——**它不约束作用域**。一个保证不了自己目标的限制不值得引入它与上位反模式的冲突。 |

**两个判定互相独立，不耦合**：`[C-3]` 选 A 之后，`[C-2]` 选 B 的唯一"互补价值"（命名空间补归因）也随之消失。

---

## 2. `[C-2]` 逐条实测

### 2.1 现有落账机制（逐字行号）

`extensions/world-context.ts`（全文 **106 行**）：

```
:80   pi.on('tool_result', async (event, ctx) => {
:81     const tracked = writes.get(event.toolCallId);
:82     writes.delete(event.toolCallId);
:83     if (!tracked || event.isError) return;
:84     const store = worldStore(ctx);
:85     const { frontmatter: fm } = parseFrontmatter(await store.readFile(tracked.file));
:86     const name = String(fm?.title ?? fm?.name ?? path.basename(tracked.file, '.md'));
:87     const layer = await store.resolveLayer(tracked.file);
:88     const actor = agentActor();
:89     const turn = currentTurnAnchor(ctx);
:90-99  （README 特判 → layer_initialized）
:102    const kind = fm?.type === 'chalk' ? 'chalk' : fm?.type === 'letter' ? 'letter' : fm?.type === 'note' ? 'note' : 'other';
:103    await store.appendEvent({ type: tracked.existed ? 'entity_edited' : 'entity_created', actor, turn,
:104      layer: layer ?? undefined, subject: tracked.file, detail: { path: tracked.file, name, kind } });
```

**成立。** `:102` 的 `kind` 由 `fm?.type` 推，`fm` 为 null 时落 `'other'`。`07 §5.1` 的逐行推演与实测一致。

> **更正一处文档锚点**：`07`（及契约 §3.1、`01 §4`）把 `resolveLayer` 写作 `local-store.ts:836-846`。**实测在 `:859-873`**（`async resolveLayer` 定义于 `:859`，非层早退在 `:861-864`）。偏移 23 行。收口时一并修。

### 2.2 命令文件走同一个 `tool_result` 会怎样——**实测**

| 环节 | 实测结果 | 判定 |
|---|---|---|
| `:85 parseFrontmatter(<一个 yaml 文件>)` | `{ frontmatter: null, body: <整份 YAML>, errors: [] }`（`FM_BLOCK` 要求 `---` 从字节 0 开始，`frontmatter.ts:175`） | 成立 |
| `:87 resolveLayer('command/x.yaml')` | **`null`**（`local-store.ts:861-864`：`normalized !== WORLD_DIR && !startsWith('world/')` → `return null`） | **成立** |
| `:102 kind` | `'other'`（`fm` 为 null） | 成立 |
| `:104 appendEvent` | **会成功，不抛** | **成立** |

**关键更正（推翻任务书与 `07` 的隐含前提）**：

> **`kind` 是必填，但 `'other'` 是合法值——所以方案 B 在 schema 层没有任何门槛。**
> `EventDetailSchemas.entity_created = z.object({ path, name, kind: z.enum(['chalk','component','note','letter','other']), summary optional })`（`packages/shared/src/schemas/events.ts:43-48`）。`'other'` **在枚举里**，dev 模式 `appendEvent` 的 `safeParse`（`local-store.ts:666-679`）因此通过。
> `layer` 可为 null：`AppendEventArgs.layer?: string`（`events.ts:131`），存储列 `WorldEventSchema.layer: z.string().nullable()`（`events.ts:118`）。且 `player/**` 的写入**今天就已经**是 `layer: undefined`——先例存在。
>
> ⇒ **`[C-2]` 不是"能不能落"的问题，是"落了之后消费者读到什么"的问题。** 任务书设想的硬门槛（"若必填且无合法值，方案 B 不可行"）**不成立**；`07 §5.1` 也从未这样主张（它正确地写了"会成功"）。判 A 的理由因此**全部落在语义与消费者上**，不在 schema 上。

### 2.3 消费者的存在性——**逐条实测（含两处 `07` 未列的）**

| 消费者 | `file:line` | 读到 `command/x.yaml` 会怎样 |
|---|---|---|
| ① 作家注入渲染 | `render/events.ts:210-228` | `kind:'other'` → `default` 分支 → `The world created "x.yaml" (command/x.yaml).`（`pathPhrase`（`:154-160`）对 `command/` 不特判，原样印路径） |
| ② 玩家 toast | `apps/web/src/lib/world-event-toast.ts:214-217` + `:121-123` + `:176-177` | **`07` 未列。** `validDetail` 的 `ENTITY_KIND_VALUES`（`:35`）含 `'other'` → 画像通过 → 弹 `Created "x.yaml". The object is now in {layer}.`，而 `layerLabel(event)`（`:121-123`）在 `event.layer === null` 时返回 **`'the current scene'`** |
| ③ 前端 chrome 全量重载 | `useWorld.ts:387-401`（转发集合含 `entity_created`）→ `App.tsx:464` `onWorldEvent` → `loadChromeData()` | 写命令触发一次画布/chrome 重取 |
| ④ 画布卡片座位排序 | `apps/server/src/routes/world.ts:762-766` | **`07` 未列。** `getEvents(1000)` 扫全表，取 `entity_created.detail.path` 建 `eventOrderByPath`。`command/**` 永不匹配画布条目 → **map miss，无害** |
| ⑤ 事件表广播 | `event-bridge.ts:486-495` | 无条件广播为 `world_event` 帧（无 type 过滤）→ ②③ 因此真的会触发 |

**逐条判定**：
- ① 「作家注入里多一句假事实」——**部分成立，且 `07` 说反了适用对象**。见 §2.4。
- ② 「玩家 toast」——**成立，且比 `07` 描述的严重**：不是"历史面板里多一行"，是**每次写命令都向玩家弹一条断言"对象现在在'当前场景'里"的假话**。`07 §5.1` 表格把严重度写成"低但真实（不该触发画布刷新）"，**低估了**，因为它漏了这个消费者。
- ③ 成立。
- ④ 无害（不构成反对理由）。
- ⑤ 是 ②③ 的使能条件，本身中性。

### 2.4 【新发现 1】`07 §5.1` 的第一条后果对 **writer** 不成立——`excludeActor`

`07:469` 逐字：「作家每写一份命令，都会在自己的 `dynamics` 段看到一条"世界创建了一个东西"」。

**实测证伪**：作家注入的事件读带 `excludeActor: actor`，而 `actor` 就是作家自己。

```
packages/shared/src/inject/collect.ts:251   excludeActor: actor,
packages/shared/src/inject/collect.ts:126   !(e.actor.type === opts.excludeActor.type && (e.actor.id ?? '') === (opts.excludeActor.id ?? ''))
packages/shared/src/store/local-store.ts:770-774   where.push(`NOT (actor_type = ? AND COALESCE(actor_id, '') = ?)`)
packages/shared/src/inject/collect.ts:229   const actor = opts.actor;   ← extensions/context.ts:103 的 resolveAgentActor(env)
docs/hooks/00:178   「**作家**：`getEventsSince(cursor, { excludeActor: { type: 'writer' } })`——不把自己刚写的念给自己听」
```

⇒ **作家写命令 ⇒ 那条 `entity_created` 的 `actor_type='writer'` ⇒ 被排除 ⇒ 作家注入里不出现。** `07` 的这条后果**对 writer 是假的**。

它**只在角色写命令时成立**（writer 排除的是 `{type:'writer'}`，角色事件照进）——而**角色能不能写命令正是 `[C-3]`**。所以：
- 若 `[C-3]` 选 A（本报告判定）→ ① **整条后果不存在**；
- 若 `[C-3]` 选 B → ① 成立，且句子会是 `the character "watson" created "x.yaml" (command/x.yaml).`——**这恰好是"一个角色的局部行为改变了世界"被写进作家上下文的具体形态**（见 §4 的交叉论证）。

**这条把 `[C-2]` 与 `[C-3]` 的依赖方向钉死**：`[C-2]` 方案 B 的最大语义代价（假事实）**只有 `[C-3]` 选 B 时才存在**。两案不是平行选项。

### 2.5 「不做账的真实代价」——审计面**今天不存在**

`07 §5.2` 方案 A 自认的 reopen 触发条件是「世界里发生了哪些规则变更」的审计面。**实测：该消费方不存在。**

`git grep` 级核对：`entity_created` 的全部消费者 = §2.3 的①–⑤（渲染 / toast / chrome / 座位排序 / 广播）。**没有任何一个做审计**。历史面板（`doc-21 §5.3`、`doc-16`）在本工作树**无前端实现**（`apps/web/src` 无读取事件表的路由或组件；`CharacterModal.tsx:37` 逐字 "No chat history"）。

⇒ 方案 A 的"代价"是一条**面向未来的**代价（将来要做审计时需另开一条路），**不是今天的损失**。这与 `07` 的自述一致，可以确认。

### 2.6 `[C-2]` 结论

**选方案 A。** 理由（按强度）：
1. `entity_created` 的**主要消费者是玩家可见的 toast**（§2.3②），它在 `layer === null` 时硬编码断言"在当前场景"——**方案 B 不改 toast 就是每次写命令弹一条假话；改 toast 就要动 i18n 消息键与 `layerLabel` 的 null 语义**，成本远超 `07` 的估计（它只提到"改渲染器"）。
2. 落账的收益**今天为零**（§2.5：无审计消费方），而命令的**溯源已经由 git 提供**（契约 §6.3：命令随世界分发、可 `read`）。
3. 方案 B 的假事实在 writer 侧**不成立**（§2.4）——即"凡与命令相关的事件都带 `detail.command`"这条"无例外规律"**买不到它承诺的一致性收益**。

**残留代价（如实登记）**：命令的创建**不进事件表**。若将来出现审计需求，唯一路径是给命令一个**独立的事件类型**（需同时改枚举 + `EventDetailSchemas` + 渲染模板，`events.ts:4-7` 明写这个代价）——**MUST NOT** 复用 `entity_created`，理由见 §2.3②。

---

## 3. `[C-3]` 逐条实测

### 3.1 现有权限模型（逐字行号）

```
packages/shared/src/actions/actor.ts:128   export function assertNookMutationAllowed(
packages/shared/src/actions/actor.ts:135     const characterId = characterIdOfPath(path);
packages/shared/src/actions/actor.ts:136     if (characterId === null) return;      ← 非 characters/** 一律放行
packages/shared/src/rules/characters.ts:46-56   characterIdOfPath：只认 'characters/' 前缀，否则 null
```

⇒ **`command/**` 走过这道门时是无操作。** `07 §12.2` 第 2 条成立。

### 3.2 命令的写入路径 vs 权限门——**是同一条钩子**

```
extensions/world-context.ts:50   pi.on('tool_call', ...)          ← 「怎么跟制作区分」的答案：不区分
extensions/world-context.ts:51   if (event.toolName !== 'write' && event.toolName !== 'edit') return;
extensions/world-context.ts:54-56  路径门禁（今天：非 content 前缀或非 .md → block）
extensions/world-context.ts:57-66  assertNookMutationAllowed(...) ← nook 门在这里，同一函数内
extensions/world-context.ts:9-14   scopeFromEnvironment(actor)    ← 身份只从这里进
```

**同一条**：`nook 权限门` 与 `写入门禁` 都在 `tool_call` 内，身份只经 `scopeFromEnvironment`（`:9-14`，白名单 `character|initializer|player|engine|writer-top-level`）与 `agentActor()` 进入。

⇒ **`[C-3]` 的落点就是 `:54` 那条路径判定旁边**——这是可实现的，也是 `07 §2.1 第 2 条`主张把落点留在 `classifyWorldWritePath` 之外的原因（加入口参数会污染纯函数契约）。

### 3.3 `07 §12.2` 说的"分类结果 + 身份的函数"——**分类器在今天的工作树里不存在**

```
$ ls packages/shared/src/commands/
ls: cannot access 'packages/shared/src/commands': No such file or directory
$ grep -rn "classifyWorldWritePath\|parseOnBindings\|commandIdOfPath" packages/shared/src apps extensions
（零命中）
```

⇒ `classifyWorldWritePath` / `commandIdOfPath` / `parseOnBindings` **全是 `NEW`，尚未落地**。`07 §12.2` 描述的落点是**设计**，不是现状。这不影响判定，但收口时 `07` MUST 把"落点在分类器之外"写成"落点在 `tool_call` 的门禁分派之后"，因为分类器本身还不存在。

### 3.4 角色能否物理写到 `<worldRoot>/command/`——**能**

```
apps/server/src/engine/launch.ts:193   cwd: worldRoot           ← characterLaunch 的 cwd = 世界根
apps/server/src/engine/launch.ts:210   AIRP_AGENT_SCOPE: 'character'
apps/server/src/engine/launch.ts:208   role: `character:<id>`
```

⇒ 角色的 `cwd` 是**世界根**，`command/` 就在它的相对路径上；`LocalWorldStore.resolvePath`（`local-store.ts:136-176`）只拒绝绝对路径、`..`、反斜杠、隐藏目录——`command/x.yaml` **合法**。

⇒ `[C-3]` 选 A 时，**唯一的拦点是我们新写的那条身份判断**（今天不存在，且 `command/` 路径今天被 `:54` 误拦）。

### 3.5 角色拿得到 skill → 两个方案都不额外花常驻成本（确认 `07 §11.2`）

```
apps/server/src/engine/presets.ts:116-122   skillArgs：显式 --skill <repoRoot>/skills 与 <worldRoot>/skills
apps/server/src/engine/launch.ts:206        ...skillArgs(repoRoot, worldRoot)   ← characterLaunch 参数里
apps/server/src/engine/launch.ts:204        ...extensionArgs(repoRoot, worldRoot)
presets/character.json:42                   { "kind": "slot", "id": "skills", "slot": "skills" }
```

**成立**：角色带同一套 `--skill` + `skills` slot。`07 §11.2` 对 `docs/prompts/04 §2.2` 的过期指控正确。**这不是选 A/B 的理由**（两案同价）。

### 3.6 产品面：角色当场写规则符不符合定位

```
docs/doc-20 §1.2（逐字）：「现阶段角色不会常驻自主活动，也没有角色间主动通信：玩家打开角色直聊遮罩后，角色进程启动…玩家关闭直聊后，角色进程回收，不在后台继续行动」
extensions/instructions.ts:263（逐字）：「chalk is the one writing tool you are trusted with, and even it is a mark on the world, not a switchboard」
```

⇒ 角色的**行动窗口 = 直聊期间面对一段对话**，不是"设计一套规则"的场景。角色的人格提示词（`CHARACTER_INSTRUCTION`）通篇是**表演**约束，**零**处授予"定义世界机制"的授权。

### 3.7 【新发现 2】方案 B 的"限制"**保证不了 `07` 自己声称的目标**——这是判 A 的决定性机制

`07 §12.2` 方案 B 的**代价第 2 条自己承认**：命名空间是"写入时"的，`parseOnBindings`（`on.<hook>[].run`）**不检查前缀**，所以任何实体都能引用角色写的命令。

**实测推演这条承认的后果**：
1. 角色写 `command/watson-curse.yaml`（名字带前缀 ✓）；
2. **任意**实体（包括别的角色的实体、玩家层实体、世界层实体）写 `on: { roll: [{ run: watson-curse }] }` —— **绑定期无前缀检查，通过**；
3. 玩家**自己点掷骰**（`POST /api/dice`，契约 §2.2 末行：**不经过任何 agent 进程**）→ 触发该命令 → 效果表允许改 `world/**` 任意路径（`04` 效果集）。

⇒ **角色的一条命令，其触发与作用域都完全不受"命名空间"约束。** 命名空间只防**文件名冲撞**与**归因模糊**，**不防**"一个角色的局部意图变成全世界的执行规则"。

⇒ `07 §12.2` 自己也写了"方案 B 的'限制'比它看起来的弱"。**本报告确认：弱到不成立**——一条只约束**名字**、不约束**引用、触发、作用域**的限制，其实现成本（与 `docs/tools/00:377` 反模式正面冲突 + 在 `classifyWorldWritePath` 外新开一条身份分支 + 并发面扩大）**无法被它的收益覆盖**。

### 3.8 `[C-3]` 结论

**选方案 A（writer / initializer 专属）。角色 MUST NOT 创建世界命令。**

理由（机制性，按强度）：
1. **B 保证不了自己的目标**（§3.7）：约束名不约束引用/触发/作用域。一个不成立的限制不值得它与上位反模式的冲突。
2. **命令是全局规则**（契约 §3.2 冻结分界表）。角色的身份是"世界里的一个人"；**一个角色的局部行为改变全世界的规则**（包括玩家的骰子）与 `doc-20 §1.2` 的"仅直聊期间行动"直接冲突。
3. **与 `[C-2]` 交叉**：`[C-2]` 判 A（不落账）→ 角色若可写则**无人知道这条全局规则是谁加的**（§2.5：审计面不存在）。B 曾用命名空间"部分补回"归因，而 §3.7 证明连这个补回也不可靠。
4. **`doc-20 §1.1` 的"能力不按身份裁"不构成反证**：该条针对**世界内容**（"角色并不局限于自己的小天地"），管的是"角色能写任何**实体**"。命令是**规则**（契约 §3.2），是**另一个平面**。`docs/tools/00:377` 的反模式原文是「给角色加"**只能写自己目录**"的权限门禁」——限制**内容**的书写范围。本判定限制的是**规则平面**的进入权，**不缩小角色对任何实体的能力**。⇒ **`07 §11.3` 判定"这是真正的分类问题"是对的；本报告给出分类：两个平面，规则平面归作者。**

### 3.9 它被挡在哪一层——**工具层，不是提示词层**（附 `bash` 事实）

| 门 | 拦得住 | 拦不住 |
|---|---|---|
| **新写的身份判断（`tool_call:54` 旁）** | 角色的 `write` / `edit` 工具 | **`bash`**：`world-context.ts:51` 逐字只认 `write`/`edit`；`vendor/pi-rp/.../tools/bash.ts:90-107` 的 `exec` 直接 `spawn(shell, [...args, command], { cwd })`，**无路径/扩展名白名单** |
| — | — | 手改文件；从别的世界拷贝 |

⇒ **判定"角色不可写"在工具层成立，在物理层不成立。** 这与契约 §6.2 为 writer 登记的 `bash` 绕过**是同一道缺口**，**不是 `[C-3]` 引入的新缺口**。

⇒ 但有一条**只属于 `[C-3]`** 的加剧：角色的 `bash` 是**它自己的进程**，而 `doc-20 §1.1` 明列角色有 `bash` ✅、`presets/character.json:16-30` 的 deny 列表**不含 bash**。⇒ **一个越狱的角色既能写命令又能绕过写入门禁，而 `[C-2]` 判 A 后连事件都不留。** 这不是本批次要修的（物理隔离归 `09`），但它 MUST 被登记：**`[C-3]` 的"角色不可写"是提示词层之上、物理层之下的一条工具层约束，与 writer 侧同级。**

⇒ **不做的事**：本报告**不**提议用 shell 字符串模式匹配当门禁（`07 §3.8` 第 2 条已论证那是"看起来在管、实际漏得更多"）。`[C-3]` 的实现就是 `tool_call` 里的一条同步身份判断。

---

## 4. `[C-2]` 与 `[C-3]` 的依赖闭合

```
[C-3] = A（writer 专属）  ──►  [C-2] 方案 B 的唯一互补价值消失（无角色归因可补）  ──►  [C-2] = A
[C-3] = B（角色可写）      ──►  ①（§2.4）假事实成立 + 归因缺口真实存在            ──►  [C-2] 必须在 A 与 B 间真权衡
```

- **`[C-3]` 是 `[C-2]` 的前提**（不是反过来）：`[C-2]` 方案 B 的"补归因"收益**只在角色可写时才存在**。
- **反向依赖不存在**：`[C-2]` 选 A 不迫使 `[C-3]` 选 A（writer 自己也不需要事件溯源；git 已提供）。但**两者同向**：本报告两案都判 A，闭合无冲突。
- **`[C-2]` 判 A 的残留风险由 `[C-3]` 判 A 吸收**：若只判 A 而不判 `[C-3]`，则"角色写了全局规则且无人知"是最坏组合。**两案 MUST 同批落地。**

---

## 5. 残留风险（标 `[推断]` / `[未实测]`）

| # | 风险 | 等级 | 说明 |
|---|---|---|---|
| 1 | **`bash` 绕过**（角色与 writer 同） | **既有，本批不修** | §3.9。唯一有强制力的防线是 T3（触发时，`02`）。`[未实测]`：没有跑过真实角色进程写命令。 |
| 2 | **`AIRP_AGENT_SCOPE` 的 init 改写** | `[推断]` | `extensions/toolkit/init-command.ts:305-324` 在 spawn initializer 时临时改写 `process.env.AIRP_AGENT_SCOPE`，`finally` 里恢复。若恢复失败，scope 停在 `'initializer'` → §3 的身份判断会**放行**。`07 §12.3` 第 1 条已登记，本报告确认这条链存在但 `[未实测]`（需要一次真实 spawn + 观察）。**判定不依赖它**（正常路径下 scope 正确）。 |
| 3 | **`[C-2]` 判 A 后"命令的创建无痕"** | 已知代价 | §2.6。将来若需审计，MUST 新增独立事件类型，MUST NOT 复用 `entity_created`。 |
| 4 | **角色是否真会想写规则** | `[未实测]` | `07 §12.2` 的 reopen 条件。判 A 的理由**不依赖**它（§3.7 的机制论证独立于"角色想不想"）。 |
| 5 | **前端 toast 的 `layer === null` 语义** | `[推断]` | `layerLabel`（`world-event-toast.ts:121-123`）在 null 时回 `'the current scene'`。今天 `player/**` 的写入已走这条路径（`resolveLayer` 返回 null），所以它**可能是一个既有的措辞缺陷**，不是 `[C-2]` 引入的。判 A 后不影响。**建议 `06` 复核**（不在本报告范围）。 |

---

## 6. `07` 文档中与实测不符之处（附 `file:line`，供收口）

| # | `07` 的原文 | 实测 | 性质 |
|---|---|---|---|
| 1 | `07:469` 「作家每写一份命令，都会在自己的 `dynamics` 段看到一条"世界创建了一个东西"」 | **对 writer 不成立**：作家注入带 `excludeActor: actor`（`collect.ts:126,251`），自己的事件被排除。只在**角色**写命令时成立 | **论据错误**（§2.4，新发现） |
| 2 | `07 §5.1` 表格把"前端全量重载"列为**唯一**前端后果，严重度"低但真实" | 漏掉**玩家 toast**（`world-event-toast.ts:214-217`），它在 `layer === null` 时断言"对象在当前场景"，**每次写命令弹一条假话**。这是比"重载"严重得多的玩家可见后果 | **低估 + 漏消费者**（§2.3②，新发现） |
| 3 | `07 §5.1` 表格未列**画布座位排序**消费者（`routes/world.ts:762-766`） | 存在，但对 `command/**` 无害（map miss） | 漏列（不影响判定） |
| 4 | `07:470` 引 `useWorld.ts:373-386`、`App.tsx:364-365` | 实测 `forwardWorldEvent` 在 `useWorld.ts:387-401`，`onWorldEvent` 在 `App.tsx:464` | 行号偏移 |
| 5 | `07` 与契约 §3.1 / `01 §4` 引 `resolveLayer` = `local-store.ts:836-846` | 实测 **`:859-873`** | 行号偏移 23 行 |
| 6 | `07 §12.2` 说落点在 `classifyWorldWritePath` 之外 | 该函数**尚不存在**（`packages/shared/src/commands/` 未创建） | 表述：把设计当现状 |

---

## 7. 落地清单（判定落地时必须做的）

**`[C-2]` = A**：
- `tool_result`（`world-context.ts:80`）在 `tracked.kind === 'command'` 时**直接 return，不调 `appendEvent`**。
- MUST NOT 改 `render/**`、`world-event-toast.ts`、事件 schema。
- 验收断言：写一份合法命令前后，`getMaxSeq()` 不变（`07 §10.4 N7` 的现有断言可用）。

**`[C-3]` = A**：
- 在 `tool_call`（`world-context.ts:50`）的**命令分类分支**内加一条同步判断：`target.kind === 'command'` 且 `agentScope` ∉ `{'writer-top-level','initializer'}` → `block: true`。
- 文案（模型可读，照 `07 §2.3` R4 指名下一步）：
  `World commands are the world's rules; only the Writer writes them. Describe the consequence in your own turn instead, or leave a note the Writer will read.`
- MUST NOT 改 `assertNookMutationAllowed`（它对 `command/` 本就无操作，且它的语义是 nook）。
- MUST NOT 用 shell 字符串匹配防 `bash`（`07 §3.8` 第 2 条）。
- 验收断言：角色 scope（`AIRP_AGENT_SCOPE=character`）下送一份**合法**命令 → `{block:true}`、磁盘无文件；writer scope 下同一份 → 通过。

