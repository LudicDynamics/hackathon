# doc-21 事件表协议：事件到底记录什么

> 状态：**定案，待实现（2026-09-12）**。doc-05 §5.1 只给了一个三字段草稿 schema，doc-11 §6.1 和 doc-20 §10 各自又加了一版，三份口径不一致且都没定"什么才算事件"。本文把它收成唯一真相源。
> 关联：`doc-05-AIRP产品构想.md` §5.1（作家感知定案）、§8.5（文件即真相）、§8.6（快照回滚）；`doc-11` §6.1（初始化事件）；`doc-13`（角色连续性边界）；`doc-14`（上帝模式进事件表）；`doc-16`（快照回滚与历史面板）；`doc-20` §10（工具返回与事件）；`后端实现计划.md` §5 B2 / §6 B3 / §7 B4。
> **本文对 doc-05 §5.1 草稿有三处收紧**，见 §9。

## 0. 一句话与三条定案

**事件表是世界变化的不可变日志：它记录"文件自己看不出来的那部分"——谁干的、什么时候、之前是什么样。**

1. **事件记事实，不记句子。** 人话是渲染出来的，因为同一条事件对作家、对角色、对历史面板要说三种话。
2. **事件自足。** 一条事件必须在不回读世界目录的前提下就能渲染成人话——世界会继续变，回滚会让过去的路径指向别的东西。
3. **事件按"发生了什么"分类，不按"谁干的"分类。** 身份在 `actor` 里。这条直接退役了 `god_patched_file` / `writer_chalk` 这类身份×动作的叉乘类型。

---

## 1. 什么才算一条事件：准入三问

三问全过才落库。任何一条不过，都不落。

| # | 问题 | 不过的例子 |
|---|---|---|
| 1 | **它改变了世界吗？**（文件内容 / 文件位置 / 画布关系 / 在场 / 一次随机裁决的结果） | 相机平移、hover、展开折叠、滚动——这些只改变"我在看哪儿" |
| 2 | **它是不可推导的吗？**——即：光看世界目录的当前状态**推不出来** | "柜台上有铜钥匙"不是事件（`look_at` 看得见）；"铜钥匙**刚刚被玩家从柜台拿走了**"才是 |
| 3 | **有人会需要在事后被告知吗？** | 没有消费者的事件不落 |

### 1.1 四类东西长得像事件，但不是

这张表是本文最需要被记住的一页。

| 东西 | 它其实是 | 存在哪 | 为什么不能混进事件表 |
|---|---|---|---|
| `writer_delta` / `tool_start` / `chalk_writing` / `writer_idle` | **传输帧**（演出用，瞬时） | 只走 WS，不落库 | 一轮叙事有上千个 delta；它们不是世界变化，是世界变化的**动画** |
| 当前层 / 相机中心 / 选中项 / 背包清单 | **视点当前值** | `canvas.db` | 事件表是历史不是状态表。在历史里 replay 出"他现在在哪"是把日志当数据库用 |
| `status` 字段、frontmatter 的任何值 | **文件的一部分** | 世界目录 | 读它 = 读那个文件（doc-20 §2.3）。它是准入第 2 问的反例 |
| agent 的每句话、每次工具调用的完整参数 | **会话逐字记录** | `history.db` 的 `entries` 表 | doc-05 §8.6 已定：`entries` 存完整内容，`events` 存世界变化。**两张表，别合并** |

> **一句判据**：如果它回答的是"世界现在什么样"，它不是事件；事件回答的是"世界怎么变成现在这样的"。
>
> **但"世界现在什么样"照样要每轮注入给 agent**——它只是不走事件表。当前值怎么采、怎么去重、怎么和事件段拼在一起，见 **`doc-22-Hook注入协议.md`**。两份文档是一件事的两半：doc-21 管变化，doc-22 管当前值。

---

## 2. 事件只有三个入口

| 入口 | 覆盖什么 | 落账位置 |
|---|---|---|
| **A. AIRP 动作层工具** | `move` / `move_to` / `choose` / `roll_dice` / `use_item_on` / `set_following` / `chalk` / `delete`（doc-20 §1） | 引擎动作函数内部，**工具自己落**。玩家 UI 点击走同一个动作函数，所以 UI 与 Agent 天然同一条事件 |
| **B. 扩展的 `tool_result` hook** | agent 用**原生写工具** `write` / `edit` 改了世界 | 扩展进程里，只盯 `write`/`edit` 两个名字 |
| **C. 玩家 UI 路由** | 上帝模式的直接改写、进层、关闭直聊 | `routes/world.ts`，复用同一个 `appendEvent` |

**A 与 B 的名单必须互斥**，否则 `chalk` 会被落两次（自己一次、hook 再一次）。判据：**经过引擎动作函数的工具自己落账，hook 只兜原生工具。**

### 2.1 `fs.watch` 不产生事件

现在 `event-bridge.ts` 的 watcher 广播一条无差别 `file_changed`。它**继续只做前端重取的触发器，永不写事件表**。两个理由：

- 同一次写会被 A/B 入口和 watcher 各落一条，去重要靠时间窗猜；
- watcher 看不见 `actor`。靠"当时哪个 agent 活着"倒推是猜，而 `actor` 是事件里最不能猜的字段。

### 2.2 已知缺口：`bash` 绕过一切

Agent 用 `bash mv` / `bash cat >` 改世界，A 和 B 都看不见——事件表里不会有这条，作家和角色下一轮不会被告知，只有前端会因为 watcher 刷新一下。

**不做技术封堵**（封了就砍掉 doc-20 §1 的开放创作层）。缓解两条：提示词明确要求"移动物件用 `move`、写内容用 `write`/`chalk`，不要用 `bash` 改世界文件"；`look_at` 的清单是兜底——角色总能看见文件现在的样子，只是不知道它是什么时候变的。**这个缺口登记在案，不假装它不存在。**

---

## 3. 记录格式

```sql
CREATE TABLE events (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,  -- 游标的唯一依据
  id         TEXT NOT NULL UNIQUE,               -- evt-xxxxx，对外稳定 id
  project_id TEXT NOT NULL,
  type       TEXT NOT NULL,                      -- 封闭枚举，见 §4
  actor_type TEXT NOT NULL,                      -- player | god | writer | character | engine
  actor_id   TEXT,                               -- 角色 id；其余为 NULL
  layer      TEXT,                               -- 发生在哪一层（角色侧过滤靠它）
  subject    TEXT,                               -- 主要目标路径（稳定 id，可为 NULL）
  turn       TEXT,                               -- 合并锚：同一轮 / 同一批动作
  detail     TEXT NOT NULL,                      -- JSON，按 type 定形，见 §4
  created_at TEXT NOT NULL
);
CREATE INDEX idx_events_seq   ON events(project_id, seq);
CREATE INDEX idx_events_layer ON events(project_id, layer, seq);

CREATE TABLE read_cursors (
  reader     TEXT PRIMARY KEY,                   -- 'writer' | 'character:<id>'
  seq        INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 3.1 `seq`：游标不能建在时间戳上

现在 `getEvents` 是 `ORDER BY created_at DESC LIMIT ?`，而 `created_at` 是毫秒精度的 ISO 串。一轮作家叙事里连着落三个文件，三条事件的毫秒完全可能相同——用时间戳做"自上次以来"的游标，就会重复念一条或漏掉一条。**自增整数 `seq` 是唯一可靠的游标**；`created_at` 只用于显示。

### 3.2 `actor`：五个值，`god` 单列的理由

`player` / `god` / `writer` / `character` / `engine`。

`god` 不是第二个玩家，更不是第二个 agent（doc-14 边界明文：没有独立的上帝 agent）。它单列只因为**渲染口径不同**：上帝改动对作家应该说成"世界自己变了一下"，而不是"玩家做了什么"——玩家角色此刻并不在场做这件事。历史面板也要能一眼筛出上帝改动（doc-16 待设计 #2 的条目标签）。

`engine` 用于没有人类或 agent 发起的事件：初始化超时兜底、快照、回滚。

### 3.3 `detail`：必须自足

**渲染人话时不许回读世界目录。** 所以 `detail` 里除了路径，还要带**当时的名字**：

```json
{ "from": "world/inn/copper-key.md",
  "to":   "player/copper-key.md",
  "name": "铜钥匙" }
```

三个理由，任何一个都足够：

- 文件可能已经被再次移动、改名或删除，回读会拿到别的东西或什么都拿不到；
- 回滚之后同一路径指向的是另一个版本，历史面板会渲染出一句假话；
- 渲染发生在扩展进程的 hook 阶段，那儿做同步文件 I/O 要卡住 agent 启动。

**但 `detail` 不存正文。** chalk 的全文在文件里，逐字记录在 `entries` 表里（doc-05 §8.6）。事件只存 `path` + `name` + 至多一行来自工具参数的摘要。

### 3.4 `turn`：合并的锚

作家一轮落三篇板书、玩家连拖四件东西进背包——注入时要合并成一句，合并需要一个"它们是同一次动作"的依据。时间窗是猜的，`turn` 不是：A 入口用当前 agent 的 turn id，C 入口用一次 HTTP 请求 id。

### 3.5 不存渲染后的句子

同一条 `item_moved`：

| 读者 | 渲染成 |
|---|---|
| 作家 | 玩家把「铜钥匙」从柜台拿到了自己的背包里。 |
| 角色（老周） | 他把柜台上那把铜钥匙收走了。 |
| 历史面板 | `玩家 · 拿取 · 铜钥匙 · world/inn → player` |

写入时存一句，三个读者里至少两个拿到的是别人的话。**渲染器按 `type` 注册，和 `look_at` 的 formatter 是同一套思路**（doc-20 §3.1）。

### 3.6 失败不落

工具返回 `isError` 时不落事件。事件表是"世界变化"的日志，一次失败的移动没有改变世界。唯一例外是 `layer_init_failed`——它本身就是要被消费的事实（doc-11 §6.1）。

---

## 4. 封闭事件类型表

十五个，按"发生了什么"分组。新增类型必须同时给出 `detail` 形状和至少一个渲染模板，否则不进枚举。

### 4.1 文件与物件

| type | detail | 人话模板（作家视角） |
|---|---|---|
| `entity_created` | `{ path, name, kind: "chalk"\|"component"\|"note"\|"other", summary? }` | 「老周在柜台上留下了一封信」/ `kind=chalk` 时：「《02-柜台》落成了」 |
| `entity_edited` | `{ path, name, kind }` | 「《01-雨夜》被改过了」 |
| `entity_deleted` | `{ path, name }` | 「铜钥匙不见了」 |
| `entity_moved` | `{ from, to, name, near?, rewrote: n, dangling: n }` | 「玩家把「铜钥匙」从柜台拿到了自己的背包里」 |

`entity_moved` 取代旧枚举的 `item_moved`（名字统一到"实体"，与 doc-20 的 `move` 同义）。`dangling > 0` 时渲染追加一句"有 n 处提到它的地方现在指不着了"——这是 doc-05 §8.3 断链兜底态的作家侧对应。

### 4.2 角色与在场

| type | detail | 人话模板 |
|---|---|---|
| `character_moved` | `{ character, name, from?, to, near? }` | 「老周走到壁炉边去了」 |
| `following_changed` | `{ character, name, following: bool }` | 「老周开始跟着玩家走」 |
| `character_talked` | `{ character, name, turns: n }` | 「玩家找老周聊了一会儿」 |

**`character_talked` 只记发生过，不记内容**——一次直聊落一条（关遮罩时），不是每句一条。作家该知道"玩家去找了谁"（这是剧情节拍），不该拿到对话逐字稿（那在 `entries` 表里，且会把作家上下文撑爆）。

### 4.3 互动裁决

| type | detail | 人话模板 |
|---|---|---|
| `choice_selected` | `{ path, name, choice, index }` | 「玩家在「地窖门」上选了『撬锁』」 |
| `roll_resolved` | `{ path, name, dice, desc, expect, result, passed }` | 「玩家掷骰：检定「推理检定」掷出 62（>50 通过）」 |
| `use_item_on` | `{ item, itemName, target, targetName }` | 「玩家把铜钥匙用在了地窖门上」 |

`roll_resolved` 的 `result` 永远由引擎产生（doc-20 §2.2）。上帝模式伪造结果时（doc-14 待设计 #5）仍走同一个 type，靠 `actor_type = god` 区分——这正是 §0 第三条定案的用处。

### 4.4 空间与生成

| type | detail | 人话模板 |
|---|---|---|
| `layer_entered` | `{ layer, name, first: bool }` | 「玩家刚切到「废弃果园」层」 |
| `layer_initialized` | `{ layer, name, by, files: [...] }` | 「「废弃果园」第一次被走出来了」 |
| `layer_init_failed` | `{ layer, reason, fallback }` | 「「废弃果园」没能长出来，先摆了个空场子」 |

`layer_entered` 是**唯一入表的视点类事件**——它有叙事意义（作家要知道玩家换场了），其余视点值走 `canvas.db`（§1.1）。`first: true` 时前端可省掉一条，因为 `layer_initialized` 说的是同一件事。

### 4.5 世界级

| type | detail | 人话模板 |
|---|---|---|
| `world_snapshot` | `{ snapshot, reason }` | （不注入作家，只给历史面板） |
| `world_rolled_back` | `{ snapshot, to }` | （见 §6） |

### 4.6 从现有枚举里删掉的

| 删掉的 | 为什么 |
|---|---|
| `agent_speech` / `agent_settled` | 传输帧，不是世界变化（§1.1 第一行） |
| `world_frozen` / `world_thawed` | **不是事件类型，是演出帧**——由 `/freeze` 路由直接广播（`routes/world.ts:806`）、前端消费（`useWorld.ts`），不落事件表（`docs/tools/12` 列为保留帧）。**2026-09-12 更正**：本节原写"无写入点、无消费者，按准入第 3 问删除"，已被实现证伪 |
| `scene_transition` | 与 `layer_entered` 重复 |
| `god_action` / `god_patched_file` | 身份×动作的叉乘；改成 `entity_edited` + `actor_type: god` |
| `writer_chalk` | 同上；改成 `entity_created` + `kind: chalk` + `actor_type: writer` |
| `item_moved` | 更名 `entity_moved`（§4.1） |

---

## 5. 消费侧：三种读法，一张表

### 5.1 作家：游标增量

`read_cursors['writer']` 之后的全部事件，**排除 `actor_type = writer` 的**（不必把自己刚写的东西再念给自己听）。注入发生在 **`context` 钩子**（B2；`docs/hooks/00` §1——**不是 `before_agent_start`**，那个会累积），读取有界（`limit`），注入成功后**在轮边界**把游标推到本次最大 `seq`（`docs/hooks/00` §6.2）。

### 5.2 角色：层窗口 + 各自的游标

这是用户最早点出的那个隐藏问题——玩家推了几轮剧情，角色刚被点开，它必须知道发生了什么。

| 情形 | 取什么 |
|---|---|
| 该角色**首次**被点开（无游标） | 本层最近 **12 条**事件（**按层查**，走 `idx_events_layer`），倒序取完再正序渲染 |
| 再次被点开（有游标） | 游标之后、本层的全部事件，上限 12 条 |

同样排除 `actor_id = 自己`。**游标在关闭遮罩时推进，不是打开时**——打开时推进的话，一次崩溃或误点就把这段永久吞掉了。

12 是可调的配置，不是常量（实现落点为 `SECTION_CAPS.dynamics`，`docs/hooks/02` §2.2）。

> **事件天然就是指路牌。** 这就是 `detail` 必须带 `path` 而不只带句子的第二个理由：角色读到「《02-柜台》落成了 — `world/baker-street/02-counter.md`」，要细节自己 `look_at` 就是。B3 的"只给清单不灌全文"和本条是同一件事的两半。

### 5.3 历史面板（doc-16，赛后）

不过滤、不合并、正序全量，按 `actor_type` 打标签。它是唯一一个应该看见 `world_snapshot` 的读者。

### 5.4 合并与上限

渲染前依次执行，**顺序固定**：

1. **同 `turn` + 同 `type` + 同 `actor`** → 合并计数：「玩家把 3 件东西收进了背包」；
2. **同实体的连续 `entity_edited`** → 只留最后一条。**判据是"同一实体"，不是字面的同 `subject`**（`docs/hooks/03` §3.5）：`entity_created.subject = path` 而 `entity_moved.subject = to`，同一实体的两处 subject 永不相等，照字面落地这条规则是死代码；
3. **`entity_created` 后紧跟同实体的 `entity_moved`**（判据 `created.detail.path === moved.detail.from`）→ 只说最终落点；
4. 合并后仍超过 **12 条** → 取最近 12 条，末尾补一句 `…and N more (older events omitted)`（**只说省略，不暗示可取**——游标已推到 `getMaxSeq()`，被折叠的事件永不重现且无历史面工具；`docs/hooks/00` §4.2）。**游标照推到最新**。

第 4 条是对 doc-05 §5.1「N 轮未被提及自然过期丢弃」的收紧：**不做过期。** 过期意味着事件在表里躺着、状态是"还没被谁念过"，于是事件表多了一份隐式的消费状态；而游标已经是唯一的消费状态了。注入即消费，溢出折叠，不留尾巴。

### 5.5 事件不打断

一条事件落库**永远不触发 agent 的一轮**。doc-05 §5.1 的"不打断、不自动起 turn"是硬纪律；`routes/world.ts` 曾有三处 `writer.prompt("[System notice: ...]")` 违反它（已登记于后端实现计划 §7 T4.2，本文不重复论证）。`use_item_on` 是否破例即时响应，是 B2 注入时机的问题，**与事件无关——不论是否破例，事件照落**。

**2026-09-13 补充**：本纪律现在有**开关化的例外通道**——每世界偏好 `autoWrite`（默认 `off` = 本纪律，即本节原文；`scenes` / `scenes-and-choices` 时，进未写场景由 I1 初始化器物化、或选项后作家起一轮）。**逐交互档位表与写文档的措辞纪律见 `docs/settings/00-共同上下文.md §1bis`（唯一真相源）**。本节仍是默认档的规则，未变。

---

## 6. 与快照回滚的关系（回答 doc-16 待设计 #1）

**事件表 append-only，永不 UPDATE、永不 DELETE，回滚也不删。**

回滚只把**文件**换回快照时的样子。事件表继续向前长，并追加一条 `world_rolled_back`（`actor_type = engine`）。同时：

- **所有 `read_cursors` 推到最新** —— 否则作家下一轮会把回滚前那段历史当成"刚发生的"再念一遍；
- 回滚**不撤销叙事记忆**（doc-16 边界已定）：语义是"文件回到之前"，不是"世界没发生过"。

为什么不回滚事件表：事件表是 doc-05 §8.6 里 `diff` 的实现（"两个快照之间的事件差异"）。**能被回滚删掉的日志算不出 diff**，也没法解释"我们为什么回到了这里"。

---

## 7. 与现有代码的差距

| 位置 | 现状 | 要改成 |
|---|---|---|
| `packages/shared/src/db/schema.ts` | `events` 只有 `id / project_id / type / payload / created_at` | 加 `seq / actor_type / actor_id / layer / subject / turn`；加 `read_cursors` 表；两个索引 |
| `packages/shared/src/schemas/events.ts` | 九个类型，混着帧与动作 | 换成 §4 的十五个；`WorldEvent` 加 `actor / layer / subject / turn` |
| `local-store.ts: appendWorldEvent(type, payload)` | 无 `actor`，靠调用点自觉塞进 payload | `appendEvent({ type, actor, subject, layer, turn, detail })` |
| `local-store.ts: getEvents(limit)` | 只有 `ORDER BY created_at DESC LIMIT` | 加 `getEventsSince(seq, { layer?, excludeActor? })` + 游标读写 |
| `routes/world.ts` | 三处 `writer.prompt`；`god_action` 事件 | 删 prompt（T4.2）；改落 `entity_edited` + `actor: god` |
| `event-bridge.ts` | `broadcast({ type: 'item_moved', ... })` 与演出帧同名空间 | 事件统一广播为 `{ type: 'world_event', event }`；演出帧保留自己的名字。**帧名与事件 type 不共用一个命名空间**，否则前端分不清"这是演出还是一条历史" |
| `extensions/`（尚未建） | — | `tool_result` hook 只兜 `write` / `edit`（§2） |

`seq` 是新加的自增主键，现有 `events` 表需要迁移；世界目录还没有真实存档，**直接改 `CREATE TABLE` 即可，不写迁移脚本**。

---

## 8. 明确不做

- **不做事件总线**：事件表不是 agent 之间的通信通道。角色不"发事件给作家"，它们只是各自读同一张日志（doc-05 §4：世界内不做角色编排）。
- **不做事件驱动的自动 turn**（§5.5）。
- **不做订阅/过滤器/优先级**：读法只有 §5 那三种，硬编码，不做成配置。
- **不给事件加权限位**：作家与角色共用一张表，不做权限防备（doc-05 §4.1）。过滤只为省 token 和避免自述，不是门禁。
- **不记 diff**：doc-05 §5.1 明文——diff 是给调试者的，不是给叙事的。
- **不把状态塞进事件**：没有 `state_changed` 这种事件，`status` 是文件里的一个键（doc-20 §2.3）。

## 9. 需要同步的三处口径

本文对既有文档的收紧，落地时应在同一个 commit 里改掉：

| 文档 | 原口径 | 收紧为 |
|---|---|---|
| doc-05 §5.1 | 草稿枚举含 `player_moved_item` / `god_patched_file` / `writer_chalk` 等身份×动作类型 | §4 的十五个，身份进 `actor`（§0 定案 3） |
| doc-05 §5.1 | 「N 轮未被提及自然过期丢弃」 | 不做过期，改为注入上限折叠 + 游标即消费（§5.4） |
| 后端实现计划 §5 | 「视点来自前端动作落的事件」 | 视点当前值来自 `canvas.db`；只有 `layer_entered` 这类有叙事意义的视点变化才落事件（§1.1 / §4.4） |

## 10. 留白

- **快照打点的触发时机**（doc-16 #3）不在本文范围。本文只保证 `world_snapshot` 这个 type 存在，且是唯一被历史面板消费的世界级事件。
- **历史面板的呈现**（doc-16 #2）不在本文范围，但 §3 的字段是照着它的需要留的：`actor_type` 打标签、`turn` 分组、`created_at` 显示。
- **summary（多轮压缩）**：明确留白，作家与角色共用，不在事件层解决（后端实现计划 §6.6、doc-13）。
