# AGENTS.md — AIRP

> 在这个仓库里干活的人与 agent 的入口手册。
> **本文与 `docs/` 都是设计真相源：架构一变，本文同步改。**
> 设计文档 2026-09-11 从 `infini-canvas` 项目迁入本仓库；`infini-canvas` 已退休，只留前端原型（见 §4）。

---

## 1. 这是什么

**AIRP（AI Role-Playing Narrative Canvas）** —— 一款 AI 互动叙事游戏。玩家在一张"活的无限画布"里以角色身份活动，作家（LLM）用 `type: chalk` 的叙事旁白统摄全场，多模态演出（视差 / 声场 / 立绘）与实体道具交互（以物解谜 / 掷骰）承担玩法主力。

一句话架构：**画布是全空间，黑板是缓冲，消息是指路牌，叙事是世界的灵魂。**

| 层 | 技术 |
|---|---|
| 前端 | React 19 + Vite + Tailwind（`apps/web`） |
| 后端 | Node + Express + ws（`apps/server`），端口 3001 |
| 共享协议 | Zod schema + 文件/ SQLite store（`packages/shared`） |
| 叙事引擎 | **pi-rp** —— `vendor/pi-rp` git submodule，独立仓库 |
| 包管理 | pnpm workspace |

### 1.1 语言规范（硬要求）

**产品一律英文，沟通与文档一律中文。**

| 范围 | 语言 | 理由 |
|---|---|---|
| 前端 UI 文案、演示内容、世界素材 | **英文** | 玩家与评委看到的一切 |
| `presets/**` 提示词、`templates/**` 世界内容 | **英文** | 喂给 AI 的 prompt 与世界内容，**连目录名与文件名一起** |
| 立绘 / 资源 / 图标等资产的文件名与说明 | **英文** | 资产清单 |
| 代码注释、报错文案、日志 | **英文** | 仓库是公开的黑客松产物，评审会直接读代码 |
| commit message、与队友/用户沟通 | **中文** | 开发者都是中国人 |
| `docs/**`、本文件、根 `README.md` | **中文** | 内部设计文档 |

黑客松官方语言是 **英文 / 日语**。判断标准：**任何可能被评委或海外玩家看到的东西 → 英文**。日语只用于日式世界的专有名词，且用罗马字（`nanami`、`sakura-academy`）。

命名一律 ASCII 小写 kebab-case（`baker-street`、`arcane-library`）；专有名词用标准英文或罗马字（`watson`、`baker-street`）。改世界内容时**目录名即 id**——**层不是声明出来的，是扫描出来的**：`world/**/` 下每个目录就是一个层，目录里的 `README.md` 是它的场景配置（有 README = 已写层；没有 = stub 懒加载层，见 doc-11 §3）。改层就是改目录名，`world.json` 里**没有** `layers`。`characters[].home`、preset 的 `options.baseDir` 同样随目录名走。

---

## 2. 目录

```text
apps/
  server/src/
    index.ts            # Express + WS 入口（/api、静态托管 apps/web/dist、端口 3001）
    routes/world.ts     # /api/worlds/load, /move, /dice, /use-item, /freeze, /god-action
    engine/
      launch.ts         # spawn 参数单一来源（preset / --session-dir / --continue / env），服务端与探针共用
      lifecycle.ts      # Agent 生命周期编排（单例复用 / spawn / warmup / 崩溃退避重启 / stopAll）
      event-bridge.ts   # 引擎事件 → WebSocket 广播（mapEngineEvent 纯映射 + file_changed 单 watcher）
      brief-builder.ts  # buildSceneInitBrief / buildNookInitBrief（动态 brief）
      presets.ts        # preset 安装到 <worldRoot>/.airpworld/prompt-presets/；skillArgs 拼 --skill
  web/src/
    lib/ui-shell.mjs       # Header / journal 独立显隐、人物分区与测量后排版
    lib/effects-clock.mjs  # 视差逐帧合并与粒子限帧调度；停止时取消任务
    scene-shell.css        # 素材版世界 UI：暖纸栏、玩家身份与人物圆牌
    lib/                   # camera（插值相机）/ collide（软碰撞）/ seat（排座镜像）
    state/                 # useCamera（相机与层级记忆）/ useWorld（层数据 + WS + 落库）
    components/canvas/     # 无限画布（相机 / 卡片渲染 / 关系线）
    components/narrative/  # chalk 叙事卡、骰子
    components/overlay/    # 角色特写遮罩
    components/sidebar/    # 右侧边栏（背包 + 角色）
    components/god/        # 上帝模式工具栏
packages/shared/src/    # world / frontmatter / components / events schema + store + sqlite
presets/                # 提示词预设：writer, character, scene-init, nook-init
extensions/             # 项目级 pi-rp 扩展：注册专用指令槽（writer-char, system-char, scene-init-instruction 等）
skills/                 # 项目级 skills：跨世界通用手艺（生图 / 组件叙事 / 节奏 / 玩法咬合）
templates/              # 开箱世界模板；含 wuwu / whitechapel / divergence / firstsnow 四个素材版世界
  <world>/skills/       # 世界级 skills：该世界自己的文风与剧情，与 world/ 同级、随包分发
worlds/                 # 脚手架产出的玩家世界（.gitignore）
tools/scaffold.mjs      # 模板 → 新世界
tools/migrate-canvas-worlds.mjs # worldlines-canvas 四世界 → AIRP 文件系统模板 + WebP 素材
tools/probe-writer.mjs  # 全链路探针（pnpm probe）
tools/pi-rp.mjs         # pi-rp 子模块工作流（pnpm pi status|build|update|commit，见 §7.2）
docs/                   # 设计文档（真相源）
vendor/pi-rp/           # 叙事引擎 submodule
```

---

## 3. 架构

```mermaid
graph LR
  W["apps/web<br/>React 无限画布"] -->|"HTTP /api/*"| S["apps/server<br/>Express + ws"]
  S -->|"WebSocket 事件流"| W
  S --> L["engine/lifecycle<br/>进程编排"]
  L -->|"JSONL commands / stdio（pi-rp RpcClient）"| P["vendor/pi-rp<br/>pi 引擎（作家 / 角色 agent）"]
  P -->|"write / edit 工具写盘"| FS["世界目录<br/>*.md + world.json"]
  S --> FS
  S --> DB[".airpworld/<br/>canvas.db + history.db"]
  P -.->|"读取"| PR["presets/*.json<br/>→ .airpworld/prompt-presets/"]
```

### 3.1 单轮管线（作家）

Hook 注入场景上下文 → chalk 落正文 → edit 回写 frontmatter → write/edit 演化场景物件 → 轻量收敛。
**chat history 不进画布，只有 chalk 落板。**

### 3.2 文件即真相

默认服务入口载入 `templates/wuwu`（Fogwharf）。前端世界外 Header 与 journal 默认收起；场景画布首次显示测量实际内容边界，修正遮挡后通过原坐标 API 保存，初始镜头按窗口适配。素材版根场景采用叙事与证物分区；当前实现每次重新载入页面会重新整理根场景，保留手动排版是后续验收项。

世界目录本身就是真相源，**没有独立状态文件**。`status.data` / `choice` / `roll_dice` 是实体通用 frontmatter，不局限于 chalk；玩家 UI、作家与角色通过同一个引擎动作层触发互动。**`status` 不是状态系统，它只是某个实体（含 chalk）的一份快照**——读它 = 读那个文件。
分层存储：**内容走文件系统，架构状态与历史走 SQLite**（`canvas.db` / `history.db`）。

**state 绝对不做（架构不相容，非排期）**：不引入 `get_state` / `set_state` / `state_update` / `watch_state`，不引入状态文件、状态命名空间、状态栏。理由：那会产生第二个真相源——agent 绕过 `edit` 改状态时 `fs.watch` 与事件表都看不见，同时打穿"文件即真相"与"事件是唯一变更来源"两条地基。详见 `docs/doc-20` §2.3。

### 3.3 preset 即 Agent 人格

初始化只有一个可委托 profile（`scene-init`），作家委托（R1）与引擎直唤（R2）共用它，靠**动态 brief** 区分任务。详见 `docs/doc-11`。

**层由目录树扫描得出**，不在 `world.json` 里声明：`world/**/` 的每个目录是一个层，目录里的 `README.md` 是它的场景配置。父层页面只显示自己目录的 md + **每个直接子层的门牌**（子层 README，或无 README 的 stub 门），绝不伸进子层内部——这是「子场景的卡全糊在基层上」那个 bug 的根因。派生逻辑在 `packages/shared/src/store/layers.ts`（纯函数，前后端共用）。

---

## 4. 文档导航

主入口 **[`docs/00-文档骨架.md`](docs/00-文档骨架.md)**（全量清单 + 阅读建议）。最常看的几份：

| 文档 | 什么时候看 |
|---|---|
| `docs/doc-05-AIRP产品构想.md` | **产品设计起点**——要理解任何设计的动机，先看它 |
| `docs/doc-06-演出与交互设计.md` | 动交互 / 演出层 |
| `docs/doc-07-AIRP黑客松作战计划.md` | Fri–Tue 执行看板、分工、未分配任务、排期与风险 |
| `docs/doc-11-场景与小天地初始化协议.md` | 初始化协议（**已定案**，含 preset 骨架与 pi-rp 源码级约束） |
| `docs/doc-20-agent工具与互动字段协议.md` | 作家/角色共享工具、互动字段、移动/选择/骰子/跟随协议（**已定案**） |
| `docs/doc-04-视觉设计风格.md` | 前端视觉基准（**§10 为准**） |
| `docs/doc-19-多模态与游戏性交互升级.md` | 视听动升级定案（评委导向） |
| `docs/doc-20-四世界可玩剧本与生成式关卡设计.md` | **四世界内容设计入口**：导言 Chalk / 首个行动反馈、行动与情感双线、Chalk 生成式关卡闭环、四个世界的可玩剧本与上帝模式样板 |
| `docs/前端改造计划.md` | `apps/web/` 的施工单 |
| `docs/后端实现计划.md` | `apps/server/` + `extensions/` 的施工单（引擎接通 / 工具面 / Hook 注入 / 角色上下文） |
| `docs/doc-08~18` | 各专题（多为待完善），实现对应模块前再读 |

**参考实现（都在本项目的兄弟目录，不进本仓库）**：

| 项目 | 是什么 | 学什么 |
|---|---|---|
| `~/projects/worldlines-rivet` | 同构架构：世界包 + 多 agent + pi-rp 引擎，已跑生产 | **后端**：`services/gateway/` 的协议单一事实源 / WS 外壳 / 会话域三层切法、`launch.mjs` 启动参数单一来源。**注意：它的"角色上下文分层"（state/knowledge/scene_brief 组装）是它自己的多角色编排配套，AIRP 明确不搬**（逐条取舍见 `docs/后端实现计划.md` §2） |
| `~/projects/infini-canvas` | 前端原型与旧设计文档（已退休） | **前端**视觉语汇与交互机制。它的 `worldlines-canvas/` 用的是另一套 harness + Python 后端，**引擎部分不迁移** |

**前端原型不进本仓库**：`画布世界v1-yoshi.html`、`画布世界v2-niko.html`、`角色-yoshi.html`、`角色-世界v3.html/`、`assets/` 都在 `infini-canvas` 项目里——把它 clone 到本项目的兄弟目录即可对照。文档里出现的原型文件名一律指那里。

---

## 5. 常用命令

```bash
pnpm install                                    # 装依赖（含 submodule）
pnpm build                                      # 编译全仓库
pnpm probe                                      # 全链路探针，PASSED 才算地基没坏
pnpm dev                                        # 全栈开发（web 5173 / server 3001）
pnpm pi status                                  # pi-rp 子模块 + dist 新鲜度体检（见 §7.2）

node tools/scaffold.mjs --template holmes-world --out worlds/my-holmes
pnpm --filter @airp/server dev                  # 只起后端
```

---


### 5.1 pi-rp agent 配置（`.pi/agent/`）

引擎 spawn 时由 `launch.ts` 注入 `PI_CODING_AGENT_DIR=.pi/agent/`（与 worldlines-rivet 同款），**不用** `~/.pi/agent/`——否则每台机器跑的是各自的 provider，行为会漂。

- `.pi/agent/models.json` = provider 与 API key；**不入库**（本仓是公开的黑客松产物，钥匙不能进 git）。从队友的 checkout 拷一份，或指向 wl 的 `~/.projects/worldlines-rivet/.pi/agent/`。
- 缺这个文件不报错：pi-rp `ModelConfig.load` 对 `ENOENT` 静默回落内建 provider（只是没有自定义模型可选）。`pnpm probe` 走离线确定性 provider，**不需要**它。
- 探针的真模型分支（`AIRP_PROBE_REAL=1`）与手工全链路演示才需要真 provider。

---

## 6. 开发纪律

### 6.1 提交即推送（硬要求）

**`git commit` 之后立刻 `git push`，不要攒在本地。**

- push 前先 `git fetch`，确认与远端的关系。
- 远端有新提交 → **merge**，不要 rebase 别人已经拉过的分支。
- **绝不 `force-push` `main`。**

**并发下的暂存纪律**（工作区经常同时有多个 agent 在改，已实际发生过）：

- 提交前先 `git status` 看清本次改动范围，**只 add 自己动过的文件/目录**——`git add .` / `git add -A` 会把别人没写完的改动一起卷走；
- 提交前 `git diff --cached` 复核暂存内容，提交信息写清这次改了什么；
- 双方改到同一文件：改动不重叠时用 `git add -p` 只暂存自己的 hunk；改在同一处拆不开时先协调归属，别擅自带走对方的改动；
- 改完就提交，别攒大堆。

### 6.2 分支：可能多人多线并行

不要假设只有你一个人在推。

- 动别人的分支之前先打招呼；协作时各自开分支（如 `feat/<主题>` / `dev-<名字>`），做完合回 `main`。
- 长期分支收工前先同步 `main`，别让分叉攒大。
- **`main` 必须保持可编译、可跑**（`pnpm build` + `pnpm probe` 通过）。

### 6.3 架构文档必须跟着代码走

改了架构就必须在**同一个 commit** 里改文档，不留"回头补"：

| 改了什么 | 必须同步改 |
|---|---|
| 目录 / 模块职责 / 数据流 | 本文（`AGENTS.md`）§2 §3 |
| 协议（frontmatter / WS 消息 / API 路由） | `packages/shared` schema + `docs/doc-09` 或 `doc-05` |
| 提示词 / preset / 初始化流程 | `presets/*.json` + `docs/doc-11`（**骨架与文件必须逐字一致**） |
| 交互 / 演出 / 视觉 | `docs/doc-06` / `doc-04`（视觉以 §10 为准） |

文档里已被推翻的说法**直接改掉**，不要另起一段解释——`docs/archive/` 才是存废案的地方。

### 6.4 收工自检

```bash
pnpm build && pnpm probe
```

改动涉及引擎或 preset 时，额外确认探针里**没有 `not found` / `unknown slot` 警告**。

### 6.5 Build 红线：改了 src 不 build，运行时会静悄悄跑旧代码

**构建产物不入库，只对本机生效。** 类型检查过了 ≠ 运行时生效——这一条踩过，代价是一整天的错误结论。

| 改了哪里 | 运行时实际读的是 | 提交前必须 |
|---|---|---|
| `vendor/pi-rp/**/src/` | `vendor/pi-rp/packages/*/dist/`（gitignored） | `pnpm pi build`（见 §7.2），或直接走 `pnpm pi commit` 的内置红线 |
| `packages/shared/src/` | `packages/shared/dist/`（`tools/*.mjs` 与服务端都 import 它） | `pnpm build` |
| `apps/web/src/` | 生产由服务端伺服 `apps/web/dist/` | `pnpm build`（vite dev 的 HMR 只证明 dev 模式对） |

判据很简单：**`import` 的是 `dist` 就必须 build**。不确定时比对 `dist/` 的 mtime，或直接 grep 新逻辑在不在产物里。

---

## 7. 关键约定与坑

### 7.1 术语：pi-rp 不是 omp

- **pi-rp** = 本项目的叙事引擎，源码在 `vendor/pi-rp`（submodule）或 `~/projects/pi-rp`。**查引擎行为一律查这里。**
- **omp / oh-my-pi** = 部分人本地跑 agent 的 harness，与本项目无关，**绝不要拿它当 pi-rp 查源码**。

### 7.2 pi-rp 子模块工作流（`pnpm pi`）

`pi-rp` 与本项目由同一批人开发、被多个项目消费，多会话并发是常态。**别手搓 submodule 命令**，一律走 `tools/pi-rp.mjs`（移植自 worldlines-rivet 的同名工具，同一个子模块、同样两个坑）：

```bash
pnpm pi status                              # 两边状态 + dist 新鲜度一览；不一致先修再干别的
pnpm pi build                               # 只重建 dist（HEAD 没动但产物旧了）
pnpm pi update [--no-build] [--no-push]     # 拉 origin/main → build → 更新本仓指针
pnpm pi commit "fix(...): …" [--no-build]   # build 红线 → 子模块 commit+push → 本仓指针 commit+push
```

两条它专门用来挡的不变量（**都已经咬过我们**）：

1. **dist 是本地产物，不随指针走**。`vendor/pi-rp/packages/*/dist/` 被 pi-rp 自己的 `.gitignore` 排除，而服务端与探针跑的是 `dist/cli.js`。HEAD 一动而 dist 没动，运行时会**毫无告警地继续执行旧构建**——实测踩过：源码里子代理默认工具集已含 `write`/`edit`，本机 dist 还停在四天前，于是"改了源码没生效"。所以**凡是动 HEAD 的路径都会重建**，`pnpm pi status` 也会报 dist 是否 STALE。
2. **指针必须等于子模块 HEAD**。HEAD 漂了（本地 main 落后、实验性 checkout 没恢复）还提交指针，等于把漂移洗白成一次正常的版本推进。`verifyPointerAligned` 直接拒绝并给出两种对齐命令。

其余纪律：

- 改 pi-rp 一律在**本项目的 vendored 副本**里改，不要另开独立克隆（`~/projects/pi-rp` 不当工作副本）；
- 发现 pi-rp 有 bug 或缺能力，**直接在子模块里补掉再 `pnpm pi commit`**——两个项目同进退，不要在 AIRP 侧绕开引擎；
- push 前必须 `fetch`；分叉先 merge；**绝不 force-push `main`**；
- 核对 remote 确实是 pi-rp 再推——**绝不把本仓库的提交推到 pi-rp**；
- `pnpm pi commit` 在子模块里是 `git add -A` 整体提交，跑之前先 `git -C vendor/pi-rp status` 确认里面没有别人的改动；
- `--no-build` 只用于纯文档等不可能影响运行时的改动；
- 新机器引导：`cd vendor/pi-rp && npm install`（**勿 `--ignore-scripts`**，否则 tsgo 等根级工具链不落地）→ `pnpm pi build`（内含 `hydrate:model-data`，要联网；跳过它 `build:offline` 会在 `check:model-data` 处失败）。

### 7.3 设计 pi-rp 侧的功能前，先扫上游文档（不要从源码开始猜）

**引擎的能力分布在三个互不重叠的面上，只查一面就下结论一定会错。** 上游文档就在仓库里，`vendor/pi-rp/packages/coding-agent/docs/`（30+ 篇，与源码同仓同步，**不属于 §6.3 说的那种会过期的"实测结论"**）。

| 面 | 先读 | 能解决什么 |
|---|---|---|
| **扩展** | `extensions.md` | 事件钩子（`before_agent_start` / `tool_call` / `tool_result` / `session_compact`…）、注册工具与 slot、customType 与其策略、`spawnAgent` |
| **预设** | **`prompt-presets.md`** | system prompt 装配、内建/自定义 slot、宏、资源策略、正则规则、**隐藏提示词覆盖**、子代理委托、命令 |
| **运行时** | `environment-variables.md`、`settings.md`、`rpc.md`、`skills.md`、`state-schemas.md`、`compaction.md`、`sessions.md` | 启动参数、会话与存档、RPC 协议、技能、压缩 |

**特别是 preset 那份——里面能翻到各种意想不到的功能，很多需求根本不用写代码。** 它的目录本身就值得先过一遍：`Character Charter` / `Built-in Slots` / `Macros` / `Custom Slots via Extension` / `Resource Policies` / `Regex Rules` / `Hidden Prompt Overrides` / `Subagent Delegation` / `Commands`。

**顺序：先文档 → 再源码确认 → 确认真缺才补上游。** 两次踩过的实例：

- **压缩摘要的口径**：只查了扩展 API，看见自动触发的压缩把 `customInstructions` 硬编码成 `undefined`、`SessionBeforeCompactResult` 又没有回写口，就断言"扩展改不了自动压缩的摘要指令，要给 pi-rp 补两行"。实际入口在 preset 的 `hiddenOverrides.compaction`（五个字段，手动与自动走同一份：`agent-session.ts:3133` / `:3480` / `:4835`），而且 pi-rp 自带的文档示例**正好就是一段中文剧情总结提示词**。**引擎不缺东西，是我找错了面。**
- **子代理工具集**：照抄了本仓库文档里的旧"实测结论"，而源码当天已经改掉（§6.3 的反面教材）。

反过来，**确认真缺就直接补上游**（§7.2：在 vendored 副本里改、`pnpm pi commit` 同步指针）——不要在 AIRP 侧绕开引擎。判断"是 bug 还是设计"的标准不是有没有 JSDoc 写过，而是**这个行为跟引擎自己在别处的语义一致不一致**。

### 7.4 preset 格式铁律（实测，踩过坑）

> 写 preset 前先读上游那份 `prompt-presets.md`（§7.3）。**下面五条只是我们踩过的坑，不是 preset 能力的全集**——把它当清单会错过一大半功能。
>
> 本节管的是 **JSON 语法**。提示词**正文怎么写**（流程写全、坑写成后果、给判据不给形容词、"不做"也是合法输出、常驻薄 + 细则懒加载），见 **`docs/doc-23-提示词写作规范.md`**——动手写任何 preset 或 skill 前先读它。
>
> 另注意：**平台侧提示词正文在 `extensions/instructions.ts` 的四个导出常量里**（slot `writer-char` / `system-char` / `scene-init-instruction` / `nook-init-instruction`），preset JSON 只是装配单，用一条 `{"kind":"slot","slot":"…"}` 把它引进来。**改平台口径改那一处即可，不要逐个 preset 维护，更不要在世界模板的 preset 里另抄一份**（抄了必然改一处漏 N-1 处）。它是源码，所以"改了能力就同 commit 改提示词"（§6.3 同级要求）天然成立。

1. **顶层没有 `system` 字段**——提示词一律进 `items`。
2. **不存在内建的 `system` slot**——但可通过扩展注册专属 instruction slot（AIRP 在 `extensions/instructions.ts` 注册了 `writer-char`、`system-char`、`scene-init-instruction`、`nook-init-instruction`，各 agent 职责隔离、slot id 与 name 互不混用）。
3. **`--preset` 只认 id，不认文件路径**；配置目录由 `PI_PROJECT_CONFIG_DIR=.airpworld` 指定。发现范围是 `<configDir>/prompt-presets/` **整棵树**（2026-09-11 起递归子目录），但**树外的文件够不着**——`characters/<名>/preset.json` 仍须由引擎安装进去（`presets.ts::installPreset`）。
4. `onMissing: "error"` 是**致命的**（整个 subagent 起不来），文件槽一律用 `onMissing: "skip"`。
5. `tools.allow` 是**过滤器不是扩展器**——写 `allow:["write"]` 加不出工具，只会把现有工具集过滤成子集。

细节与全部 9 条源码级约束（含 2026-09-11 复核标注的"已失效"四条）见 `docs/doc-11` §2.3。


### 7.5 画布卡片的尺寸与旋转契约（实测，踩过坑）

**一张卡片的可见框，必须等于它的声明框。** 踩过的坑是三个尺寸来源互不协商：外壳 `.object` 用 form 表写死 `w/h`、内层组件 CSS 各自硬编码宽度（`.note` 200 / `.gate` 288 / `.letter` 224）、内容再自然撑高（chalk 声明 190px、实际 578px），于是拖拽时露出空壳、文字溢出、两张纸叠在一起。

规则（改卡片渲染前先读）：

1. **宽度只有一个真相源**：`packages/shared/src/schemas/forms.ts` 的 `CARD_FORMS`。`.object` 外壳吃 `item.w`，内层形态一律 `width: 100%`——**内层禁止写死宽度**。
2. **外壳不写死高度**：`CanvasObject` 只给 `width`，高度由内容撑开，外壳（和拖拽碰撞读到的 `offsetHeight`）自然贴合。form 表的 `h` 只服务座位排布，不是渲染高度。
3. **旋转只归外壳**：`--target-rot`（`rotOf` 派生）只写在外壳上。内层形态**禁止自带 `rotate`**（`.note` 曾自带 `-1.2deg`，与外壳叠加成 -4.2°）。**`chalk` 与 `sprite` 恒为 `0deg`**——叙事板正是"板正的板书"，不倾斜。
4. **文字不溢出**：卡面摘要走 `plainExcerpt`（剥掉 `#`/`<b>`/换行等 markdown 原文），多行用 `-webkit-line-clamp` 截断；正文绝不会以裸 markdown 源码出现在卡面。
5. **第二层阅读的标准形态 = 模态框**（`letter` 的 `letterFocus`、v3 `DetailPanel`：类型章 + 全文 + 回跳 + 续写；见 doc-10 E2/E9 与 §E11 对照表）。**点击展开是默认**，hover 只是它的替代——当卡片的**单击语义已被占用**（`gate` 单击 = 进门，不能再抢去开阅读），或形态上不适合弹模态框的组件，才改走 hover 浮层。`gate` 的 README 全文即此例：`.gate__detail` 绝对定位浮在卡片上沿、`z-index` 盖过邻卡、`pointer-events` 默认 none。**无论走哪种，"全文绝不塞进卡片撑破布局"这条不变。**
6. **z 序**：`.object` 的 `z-index` 是内联写的（服务端行序），所以交互态抬升必须 `!important`——hover `.object{z-index:30}`、拖拽 `.object.dragging-item{z-index:40}`（拖拽值必须更高，否则被邻卡 hover 盖住）。

**已知缺口**：座位排布仍按 form 表的 `h` 算碰撞，与实际渲染高度（chalk 可远超 190）不一致，多张长 chalk 可能轻微重叠。这是排列算法的独立问题，改动会触及 `local-store` 螺旋排布与已持久化座位，尚未处理。
