# doc-09 通用互动 frontmatter 完整 schema（待完善）

> 状态：**归属与工具协议已定案，字段细节待设计**。doc-20 §2 是互动字段的上位协议。
> 关联：doc-05 §3.1（frontmatter + 骰子协议）、doc-06 §2.6（渲染原则）、doc-10（组件 schema）、doc-20（Agent 工具与 `look_at`）。

## 背景与现状（已定案，不重谈）

- 三者（choice / status / roll_dice）是**所有落盘实体通用的互动字段**，不局限于 chalk；类 md 表格渲染、可折叠、随所属实体走；
- **无独立状态文件、无状态栏、无 state 工具**（doc-00 变更记录 #4）：`status` 只是**该实体（含 chalk）的一份快照**，读它 = 读那个文件。`get_state / set_state / state_update / watch_state` **绝对不做**（doc-20 §2.3）；
- roll_dice **骰子协议已定稿**（doc-05 §3.1）：作者写 `type`/`desc`/`expect`（不写 `result`）；玩家点击或 Agent 调用 `roll_dice` → 引擎真随机掷出并按 expect 判定 → 回写 result/passed → 落定显示 + `roll_resolved` 事件；
- 前端渲染管线（解析 frontmatter → 渲染 → 交互回写）在 doc-06 §2.6 给出了原则，缺完整协议。
- 导言中的第一个可操作入口就是 Chalk，不新增 `type: chunk`；Chalk frontmatter 承载 RP / Choice / Dice 与移动机会，具体拿物 / 使用 / 切层继续走 note/item、component、gate 协议。
- Agent 的 `look_at` 剥离原始 frontmatter，但必须把三种互动字段格式化成可读、可继续调用的文本块（doc-20 §3）。

## 待设计清单

### 当前前端接线（2026-09-12）

所有画布 Markdown 形态由 `CanvasObject → EntityInteractions` 接一次通用互动区；类型渲染器只负责外观。整块实体 hover / 键盘聚焦显露行动，字段可钉住；容器透明、优先在右侧浮出，按视口与其他实体占用比较左侧/下方，不占正文高度。普通文档提供查看/收取，门提供进入，人物提供交谈；`portable: false` 禁止默认收取。收取走 `/api/move`，同名目标拒绝覆盖。没有字段也可提供类型默认行动。

`actions: string[]` 仍是带源文件路径的文字请求，走 writer_prompt，不解释成代码、移动或已安装技能。`choice` 走 `POST /api/choice { path, choice }`：玩家与 Agent 共用 `createActionService().chooseOption`，重读源文件、按 status 条件验证可见选项，落 `choice_selected` 并通过 `world_event` 广播；路由不强启 Writer。前端共享 `buildInteractiveFields` 归一化规则，显示 label/index/hint，优先提交稳定 id；骰子只提交 `{ path }`，裁决规则从文件读取。自由输入专用入口与 multi 的完整呈现仍待补齐。

Chalk 的 `anchor` 仅控制临时高亮与虚线，可指向同层文件路径或文件名（省略 `.md` 兼容）；悬停离开与卸载清理。与持久关系线分开，不是正文阅读 tooltip。

带 Prompt 的技能、RP、扩写已是产品方向，但结构化字段（技能 id、参数、适用角色、确认与权限、完成回执）仍需定案；本次只把已有文字动作带实体上下文交给作家，不新增伪协议。

| # | 项 | 说明 |
|---|---|---|
| 1 | **choice 完整字段** | 选项文本、单选/多选、**条件选项**（按前置 status 过滤可见性）、选项选定后的**后置动作**（更新哪些 status / 作为玩家下一轮输入推进）、**自由输入兜底**（玩家不想选任何选项、想自己打字时怎么办——选项卡组是否消失、怎么跟打字共存） |
| 2 | **status 数据形态** | value 类型（string / number / bool / compound）、嵌套是否允许、**图表化**（doc-07 赛后 #9"status 图表化"）、status 与折叠表格的呈现边界 |
| 3 | **折叠交互** | 默认展开还是折叠、折叠颗粒（三段各自折叠 vs 整体）、choice 是否只挂在最新一段上 |
| 4 | **骰子演出特效的节奏**（并入项，原 doc-06 §7 待定） | 纸骰弹跳/旋转 → 落定的**时长/帧/缓动**，"展开本身就是内容"的节奏设计（参照 doc-04 §6 登录墙节奏：5.5s→1.4s→3.1s + 240ms 错开） |
| 5 | **统一渲染管线完整协议** | 任意实体 → frontmatter 解析 → 类型渲染器 + 通用互动渲染器 → 玩家/Agent 动作 → 引擎回写 → 重新渲染；含出错路径 |
| 6 | **`look_at` 文本 formatter** | 与前端共用互动字段语义；隐藏原始 YAML，稳定输出 status/choice/dice 与实体路径，不为不同 Agent 另造解释 |

## 边界

- 不引入独立状态文件/状态栏，也不引入任何 state 读写工具（绝对不做，非暂缓；doc-20 §2.3）；
- 骰子判定由引擎做（按 expect 比较）；前端与 Agent 工具只是两个触发入口；
- 剧情判定不写骰子，直接写正文（doc-05 §3.1）。
- `choice` 点击可以作为下一轮玩家行动输入，但不得隐式冒充空间移动；需要进入地点时，选择结果应显式解锁 / 指向一个 gate，再由玩家执行跨层动作（doc-20 §2.3）。

> **标记：待办**。MVP 只实现最小集：choice 单选卡 + status 折叠表 + roll_dice 骰子卡（协议已就绪），chart 化与条件选项赛后再补。
