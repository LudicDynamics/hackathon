# docs/hooks/REVIEW-评审报告 — B2/B3 注入设计批次

> 评审门（design-first 流程第 7 步）。6 个独立视角 × ~3900 行设计文档。
> **判决：`incorrect` —— 不得进入实现。** 机制层（`context` 接缝、放弃差分、条目上限）三个评审都确认**正确且难得**；缺陷集中在**跨篇契约一致性**与**语义闭环**。
>
> 本轮最重要的产出不是这份报告，而是 **`tools/check-hooks-docs.mjs`**——它把"冻结契约"变成可机械核验的东西（B1 复盘第一教训）。本报告里 4 类 blocker 中 3 类该脚本**已经能自动抓到**。

---

## 0. 一句话结论

**机制选对了，契约漂了，闭环断了。** 六个独立审查者各自独立发现同一批问题——这正是 B1 复盘说的「并行写文档的固有失效模式」的再现，而这次我们**第一次有了机械核验手段**在实现前抓住它。

---

## 1. 已机械核验的缺陷（`node tools/check-hooks-docs.mjs`）

| # | 缺陷 | 状态 |
|---|---|---|
| **M-1** | **barrel 导出 union 不成立**：6 篇给出 4 种互不相同的清单，**union = 10 条**。06 自称"共五行、必须一次合入"，却漏了它自己 import 的 `render/state.js`/`render/sections.js` 与 `inject/*`。漏导出的后果是**静默的**（`extensions/` 运行时拿不到，无编译期护栏） | 脚本已抓 |
| **M-2** | **哨兵串三重定义**：`00:100` 写 `[World state: unchanged this turn]`，`00:116`/01/02/03/06 写 `[World state: nothing to report yet]`（角色版 `nothing has happened here yet`）。探针 A1–A4 全按该前缀计数，任何 golden 测试都无法通过 | 脚本已抓 |
| **M-3** | **`EventLine` 幽灵符号**：04 声明 `NextStepEvent = Pick<EventLine, ...>` 并说 03 拥有它，但 03 只有 `EventWindowLine`；全批次无 `EventLine` 定义。`render/next-step.ts` **无法编译** | 脚本已抓 |
| **M-4** | **`extensions/loader.ts` 引错**：真路径是 `vendor/pi-rp/packages/coding-agent/src/core/extensions/loader.ts` | 脚本已抓 |
| **M-5** | 6 处把**待建文件**当既存文件引用而未标 NEW（`useViewpointReport.ts` 等）——测试/实现者会去找不存在的文件 | 脚本已抓 |

**脚本还是它自己最好的证明**：它在我手动修 checker 的过程中，当场抓出了我引入的 `index.ts` 正则误报与 `.json`→`.js` 截断。

---

## 2. Blocker（多审查者独立收敛）

### B-1 barrel union —— 4 份清单、ownership 规则互相矛盾（RevHonesty/RevClosure/RevConsistency/RevImplementability）
见 M-1。**且所有权规则对立**：`01:530`/`02:446`/`05:369` 说"谁先落地谁加自己几行、后者追加"，`06:481` 说"必须合并成一次编辑、只由一个负责方落"。**修法：契约里定义唯一 union（10 条）+ 唯一负责方。**

### B-2 `EventLine` 幽灵符号（RevHonesty/RevClosure/RevConsistency/RevImplementability）
见 M-3。**修法：统一为 `EventWindowLine`，删掉 `EventLine` 与 `mergeEventWindow` 两个幽灵名。**

### B-3 角色游标：无角色守卫 + 无触发方 + 无归属（RevClosure/RevConsistency/RevSemantics/RevHonesty）
三重缺陷叠加：
1. **06 §4.1/§4.2 的 `agent_start` handler 只有 `if (block && reader)`**，而**角色启动也加载扩展**（`launch.ts:129-130` 展开 `extensionArgs`），`readerOfActor` 对角色返回 `character:<id>` → **角色进程每轮把角色游标推到 `getMaxSeq()`**，正是契约 §6.2 明令禁止的"开遮罩时就推进"（崩溃/误点永久吞掉事件段）。**无任何角色守卫**，而 `06:270`/`:452` 却声称"本批只结算作家"。
2. **`character_start` 前端无发送方**（RevSemantics 独立确认：`grep -rn character_start apps/web/src` 零命中；`App.tsx:57-60` 只 `camera.save` + `setModalCharId`）。→ **B3 首开注入、冷启动窗口、开时游标高水位全部无法执行**。
3. **`character_stop` 的归属被 03 与 06 互相推诿**（`03:592` 说"归 server（06）"，`06:452` 说"由 03 定"），且前端同样无发送方；open-time 高水位 `Map` 不在任何落地表里。
→ **净效果：B3 完全跑不起来。修法：契约里写死拥有者（角色游标归 03 ≈ 事件段）并显式登记 `character_start`/`character_stop` 两个前端发送方为落地项。**

### B-4 `viewpoint.focus` DDL 冲突 + 安全盲区（RevHonesty/RevClosure/RevConsistency/RevImplementability/RevRisk）
`00 §5.1`（声称权威）冻结 `focus TEXT -- 人话方位…不是坐标`；`05 §2.2` 改成编码中心 `'x:y'` + 4 个镜像列（`focus_x/y/w/h`）。`06:368` 的探针 A6 又按 `00` 写"`focus` 人话"——**三方互斥**。**且 RevRisk 指出这是安全问题**：若真按 00 存人话，等于把浏览器来的自由文本原样灌进注入块。**修法：契约采用 05 的编码列集并**显式写明"人话是渲染产物，上不了线"**。**

### B-5 `listBackpack` 抽 helper 时字段改名，静默打断背包面板（RevHonesty/RevClosure/RevImplementability）
`02:419` 要求 `GET /backpack` 返回 `{ items: listBackpack(store) }`，抽出的 `BagItem` 是 `{path, fm, body}`；现有路由返回 `{path, filename, frontmatter, body}`（`routes/world.ts:299-306`），而前端 `RightSidebar.tsx:91` 直接吃 `item.filename`/`item.frontmatter` → **`item.filename.replace` 在 undefined 上抛 TypeError**。**修法：`BagItem` 保持 `{path, filename, frontmatter, body}`。**

### B-6 注入面安全：sanitize 是"内容的"而非"长度的"（RevRisk，无人重复）
- **INJ-01**：`layer` 只查"是否 `map` 或 `world/` 开头 + 段非空 + ≤300 字"——**不拒换行、引号、反引号、注入散文**。经 `readLayerName` 回落（`presence.ts:112-121`）把**末段原样**印进 `the player is in "<layer name>"`。全仓 grep `转义|escape|换行|控制字符` 零命中。
- **INJ-02**：`selected[]` 同样只做类型+限长，`02` 用引号原样回显。
- **INJ-03**：**"`POST /api/viewpoint` 是唯一外部输入"这个断言是假的**——`layer_files`/`cast` 印 `entityName()`（`rules/interactive.ts:383-387`，`title.trim()` **不限长**），而 `POST /api/god-action`（`routes/world.ts:669-720`）**无鉴权**接受任意 `frontmatter`/`body`，`index.ts:23` 挂了 `cors()`、`:175` 绑 `0.0.0.0`。**这是第二条注入通道，威胁模型漏了它。**
- **修法：契约新增「注入面消毒」一节**：所有进入注入块的动态文本走**同一个 `sanitiseForBlock()`**（剥换行/控制字符、收敛引号、限长），并更正"唯一外部输入"的措辞为"唯一**新增**的浏览器直连输入；世界文件与 god-action 是既有通道，对其统一消毒"。

---

## 3. Major（单审查者或两名）

| # | 缺陷 | 来源 |
|---|---|---|
| **A-1** | **`quiet` 判据使"无事发生、别硬编"这条死代码**：`facts.quiet = window.events.length === 0 && sections.length === 0`，但 `bag`/`recent_chalk` 只要世界非空就恒有 → `sections.length === 0` 只在**全空世界**成立，而那正是 `renderState` 短路成哨兵、**根本不打印 next_step** 的情形。**改由事件窗口单独判定 `quiet`** | RevSemantics |
| **A-2** | **角色冷启动"先限量再按层过滤"**：`getEvents(caps*3)`=全局最近 36 条 DESC 后 `.filter(layer)`——`getEvents` **不按层过滤**（`local-store.ts:475`）。火热层场景下过滤后可为 0 → **刚打开的角色被告知"这里无事欠答"**。应走**按层查**（`idx_events_layer` 已存在） | RevHonesty/RevSemantics |
| **A-3** | **视点 TTL 会连带删掉 `layer_files`/`cast`**：`deps.layer` 派生自 `viewport?.layer`，TTL 10 分钟无心跳（前端只在**语义变化**时报，`useCamera` 空闲帧不发布）。玩家静坐 11 分钟 → 三节全缺席。**且 `00` 的失败表只承诺"`viewpoint` 节缺席"，未登记级联** | RevSemantics |
| **A-4** | **`standing` 的 `home` 回落永不生效**：`resolveHome`（`presence.ts:203-213`）**永不返回 null**，恒回落 `{layer: MAP_LAYER, fromHome:false}` → `standing` 节**永不缺席**，未摆放角色被稳定告知"你在 `map`、right where you belong"。应改读 `.fromHome` | RevHonesty |
| **A-5** | **`standing` 硬编码"玩家就在你面前"却不比层**：角色层来自 presence、玩家层来自 viewpoint，前端允许从任意处点开角色（`RightSidebar.tsx:146`）→ 角色在 `garden`、玩家在 `baker-street` 时仍印 `The player is here with you.`——**B3 空间锚定唯一的当前值陈述是假的** | RevSemantics |
| **A-6** | **`context` handler 有两份互斥冻结实现**：`01 §2.1` 有（1）过滤旧块（2）用 `ctx.sessionManager.getSessionId()` 读缓存；`06 §2.3` 直接 `[...event.messages, block]` + 零参 `stateBlockForThisTurn()`。**丢过滤 → "每请求恰好一份"的本地不变量失效**（探针构造不出该场景，抓不到） | RevConsistency/RevHonesty |
| **A-7** | **06 用同步单参调 `renderState`/facts**：`renderState(sections, nextStepFactsFrom(sections))`，而 `01` 冻结的是 `buildNextStepFacts(deps, sections): Promise<NextStepFacts>`（需事件窗口备忘录 + 解析后的层）→ **把 Promise 当 `NextStepFacts` 用** | RevConsistency |
| **A-8** | **`world_rolled_back` 是否被 03 过滤，03 与 04 相反**：`03:232` 说"必须能被作家念到"，`04:367` 说"在注入前就被 03 过滤，本函数不重复过滤" | RevHonesty |
| **A-9** | **热路径 `getEventsSince` 无 LIMIT**：`local-store.ts:408-429` 是 `SELECT * WHERE seq > ? ORDER BY seq ASC` **无 LIMIT**，截断发生在 `renderEventWindow` 之后 → `00 §4.2`"上限是有界性唯一保证"对**读取**不成立。游标在 steer/followUp 轮不推进，长会话每轮重读不断增长的范围 | RevRisk |
| **A-10** | **每建一个 `LocalWorldStore` 就跑带 `DROP TABLE` 的探测式 DDL**（`local-store.ts:63-73`），而 `06 §5.4` 允许扩展**再开第二个连接** → 形状探测一旦漂移，扩展会 DROP 服务端正在服务的 `presence`/`links` 表。WAL + `busy_timeout` **不挡 DDL**。契约须写明"扩展侧 store 不得触发 DDL 重建" | RevRisk |
| **A-11** | **`EventWindowLine` 的 `count` 缺 `character_moved`**：`MERGE_EXEMPT` 未含它，落到通用 `The engine did this N times.`；而 `carryFollowers`（`presence.ts:225-268`）对**每个跟随者**追加一条同 turn 同 actor 的 `character_moved` → **日常流程可复现**（跟随者跨层） | RevSemantics |
| **A-12** | **交互三模板硬编码 "The player"**：`choice_selected`/`roll_resolved`/`use_item_on` 都可被 writer/god actor 触发（`extensions/tools.ts:55` 的 `roll_dice` 在作家工具面；`/api/dice` 强制时 actor=`god`）→ 作家把自己刚做的选择读成"玩家做的"，且 `04` 的队尾判定不带 actor 检查，进一步指示它去回应自己 | RevSemantics |
| **A-13** | **`"…and N more; the rest are on record"` 承诺一个作家打不开的记录**：游标已推到 `getMaxSeq()`，被折叠的事件永不重现，且**没有历史面工具**（`tools.ts` 无） | RevSemantics |
| **A-14** | **C2「你关着时这里变了」永不触发**：`unseenCreation` 只看 `layer_initialized`/`layer_init_failed`（scene-init 子代理产出），而"作家关着时写的内容"只产生 `entity_created`/`entity_edited` → C2 沉默，角色收到 C3"无事欠答"，随后可自相矛盾 | RevSemantics |
| **A-15** | **`00 §3.1` 的 `Section.key` 注释把 `next_step` 列为 key**，与 §8/01/02 的 `SectionKey` 联合类型直接矛盾 | RevHonesty |
| **A-16** | **冻结示例印了渲染器产不出的卡片名**：`00:92`/`02:502`/`02:526` 是 `from the counter into their bag`，而 `03` 的 `detail` 拿不到显示名（`schemas/events.ts:51-58`），只能印路径。**按 00 写 golden 测试必失败** | RevSemantics |
| **A-17** | **`character_moved` 印层 id 而非地名**：`detail.from/to` 是层 id（`move-to.ts:110-122`/`presence.ts:249-261`），`pathPhrase` 未映 `world/<layer>` → `from world/baker-street into world/garden`；`map` 更退化成 `into map` | RevSemantics |
| **A-18** | **`03:582` 断言"`packages/shared` 今天没有测试目录"是假的**——有 **12 个** tracked `.mjs` 测试与既定约定（`node --test`） | RevImplementability |
| **A-19** | **06 的 `agent_start` 骨架不可用**：写局部 `cachedBlock` 从不调 01 的 `writeTurnBlock`（null 守卫成死代码）、TDZ 自引用 `sections`、凭空发明 `nextStepFactsFrom`、跳过 `makeSectionDeps` | RevImplementability |
| **A-20** | **`readViewpoint()?.layer ?? null` 丢 `''→null` 语义**：`currentLayer` 现约定空串层回落 null，新写法让合法空串层穿过所有 `deps.layer === null` 守卫 | RevImplementability |
| **A-21** | **02 说 `context` handler 调 `renderState`，01 说它**不得**（只读缓存串）** | RevImplementability |
| **A-22** | **`05 §3.4` 推荐 `../../packages/shared/dist/render/viewpoint.js`**——深度只对 `extensions/toolkit/*` 正确（`extensions/context.ts` 须 `../packages/shared/dist/index.js`），且**绕过 barrel**，与 01/06 明文要求的 barrel 约定对立 | RevConsistency |
| **A-23** | **`DEFAULT_EVENT_CAP` 被 03 派给 02 的 `render/sections.ts`，而 02 从未声明该符号** | RevConsistency |
| **A-24** | **`02 §6/§11` 的 `render/viewpoint.ts` 导出面不完整**（缺 `decodeViewRect`/`VIEWPOINT_MIN_INTERVAL_MS`，而 `05:489` 前端 import 后者） | RevConsistency |
| **A-25** | **`05` 路由返回 `at: v.at` 但 `sanitizeViewpoint` 无 `at`**；`writeViewpoint` 返回值被丢弃 | RevImplementability |
| **A-26** | **`01` 的 handler 传 `ctx.sessionManager`，但 `01 §2.1` 签名只收 `(event)`** | RevImplementability |
| **A-27** | **`ordinalOf` 在真实模板上恒 null**：`templates/holmes-world/world/baker-street/` 文件名**无前导数字**（`evening.md`/`raindrops.md`），而 `02:371` 已冻结"截断须在排序后"却把排序正则留到"实现时实测" | RevHonesty |

---

## 4. 少数派 / 低优先（DEFER）

- `INJECT-04`（RevRisk）：`settleTurnCursor` 与组装同处一个 `try`，其 catch 把 `cachedBlock` 置 null → 未来若游标结算抛错会把**已建好的块**也丢掉（今天不抛，latent）。
- `02 §3.2` `cast` 锚点是否含子层门卡留白（RevHonesty）。
- ClickHouse… 无。

---

## 5. 三张清单

### 5.1 契约（`00`）必须自己改的（主控亲自动手，因为它是权威）
1. §4.3 哨兵：**唯一为 `[World state: nothing to report yet]`**（角色 `nothing has happened here yet`），删 §4.1 的 `unchanged this turn`。
2. §5.1 DDL：**采用 05 的编码列集**（`focus` = `'x:y'` 中心 + `focus_x/y/w/h`），显式写明**人话是渲染产物、上不了线**。
3. §3.1 `Section.key`：注释删 `next_step`（它不在节表内，由装配器追加）。
4. §4.1 线格式示例：换成 `02 §7.1` 的逐字副本（去掉 `README.md`、用条列表语法、事件段用**路径形式**句子）。
5. **新增 §14「注入面消毒」**：`sanitiseForBlock()` 统一规则 + 更正"唯一外部输入"措辞。
6. **新增 §15「barrel union」**：10 条唯一清单 + 唯一负责方。
7. §6.2：角色游标**归属写死**（事件段 03 拥有）+ 登记 `character_start`/`character_stop` 前端发送方为落地项。

### 5.2 各篇 fixer 任务
- **01**：`quiet` 判据（A-1）；角色冷启动按层查（A-2）；`getEventsSince` 加 LIMIT 或改按层（A-9）；handler 签名与 `ctx` 一致（A-26）；barrel 引用改回指契约。
- **02**：`BagItem` 字段（B-5）；`standing` 的 `fromHome`（A-4）与层级比较（A-5）；`layer_files` 排序正则落到实测（A-27）；删 `DEFAULT_EVENT_CAP` 引用（A-23）；补 `render/viewpoint.ts` 导出面（A-24）；冻结示例改路径形式（A-16）。
- **03**：`EventWindowLine` 统一（B-2）；`character_moved` 的 merge/count（A-11）与层名（A-17）；交互三模板的 actor（A-12）；尾句承诺（A-13）；C2 判据（A-14）归 04；`world_rolled_back` 过滤定论（A-8）；测试目录假前提（A-18）；游标归属（B-3）。
- **04**：`Pick<EventWindowLine>`（B-2）；C2 判据（A-14）；交互 actor 检查（A-12 联动）。
- **05**：DDL 与 `00` 对齐（B-4）；`selected`/`layer` 消毒（B-6）；`at` 字段（A-25）；相对 import 改 barrel（A-22）；TTL 心跳或解耦 `deps.layer`（A-3）。
- **06**：barrel union（B-1）；角色守卫（B-3）；handler 体引用 01（A-6）；`agent_start` 骨架修好（A-19）；`readViewpoint` 空串语义（A-20）；`renderState` 异步（A-7）；补 `character_start`/`character_stop` 发送方（B-3）；扩展侧 DDL 禁令（A-10）。

### 5.3 门禁
- `node tools/check-hooks-docs.mjs` 必须 **clean**；
- 各篇 golden 示例必须能被 `check-hooks-docs` 的**字面量检查**覆盖（哨兵/线格式标签）。
