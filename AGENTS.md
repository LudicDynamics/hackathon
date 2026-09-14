# AGENTS.md — AIRP

> 这是仓库级入口手册：只放所有 Agent 在每次工作前都必须知道的项目意图、架构不变量和协作规则。专项契约与实现细节放在 `docs/`、模块目录和 skills 中，不在这里重复。
> **本文与 `docs/` 都是设计真相源：架构一变，本文同步改。**

## 1. 项目定位

AIRP（AI Role-Playing Narrative Canvas）是一款 AI 互动叙事游戏：玩家在无限画布中探索世界，作家 Agent 负责叙事，多模态演出和实体互动负责玩法。

一句话架构：**画布是全空间，黑板是缓冲，消息是指路牌，叙事是世界的灵魂。**

| 层 | 位置 |
|---|---|
| 前端 | `apps/web`：React 19 + Vite + Tailwind |
| 后端 | `apps/server`：Node + Express + ws，默认端口 3001 |
| 共享协议与动作层 | `packages/shared`：Zod schema、文件/SQLite store、动作服务 |
| Agent 引擎 | `vendor/pi-rp`：git submodule，独立仓库 |
| 扩展与提示词 | `extensions/`、`presets/`、`skills/` |
| 世界模板与存档 | `templates/`、`worlds/` |

## 2. 必须保持的架构不变量

### 文件和事件是真相源

- **文件即真相**。世界正文、实体、互动字段以世界目录中的文件为真相源；不要引入第二份叙事状态文件。
- 内容存文件系统；画布布局、历史、事件和游标等架构状态存 `.airpworld/` 下的 SQLite。
- 写世界的动作必须经过动作层并落事件；`fs.watch` 只能触发重取，不能代替事件落账。
- 玩家 UI、作家 Agent、角色 Agent 和扩展工具共享 `createActionService(store, actor)` 的动作语义。
- 不新增 `get_state`、`set_state`、`state_update`、`watch_state` 或同类状态命名空间。
- 动作工具如果已经通过动作层执行并落账，`tool_result` 只能兜原生 `write`/`edit`；两份名单必须互斥，否则同一笔 chalk 或文件修改会被重复记账。
- 作家上下文的读取、渲染和游标推进必须以轮边界为单位；注入成功后才推进作家游标。角色流程不得误推进作家游标，相关代码必须守卫 `actor.type === "writer"`。
- `status.data`、`choice`、`roll_dice` 是实体文件的 frontmatter，不是独立状态系统；不要把它们扩展成第二套状态真相。

### 高风险边界

- 世界路由发现当前存档被外部删除时，必须解除失效 store、停止 Agent 和监听，并以 `409 no_active_world` 通知前端清空画布、打开世界选择；不要自动恢复被删除的存档。
- 世界列表和连接设置不依赖活跃世界。`/api/connection-settings` 只允许本机访问，密钥不回显，并保存到后端 `.env.local`。
- `GET /api/tts/config` 只暴露配置就绪状态、模型和默认音色；浏览器语音开关由前端控制。未配置时不得发起合成请求，并只提醒一次。

### 世界、层与小天地

- `world/**/` 下的目录就是层；层由目录树扫描得到，不在 `world.json` 中声明。
- 层改名必须同步路径引用、角色归属、Gate、物品门槛、图片路径、存档定位和测试；不能只改目录名。
- `characters/<id>/` 是独立的角色小天地，不是层；通过 `/api/nook` 及 `NookView` 处理，不要让它进入普通层派生。
- `/api/enter-layer` 不直接启动作家轮；未写场景的入口走 I1 初始化器，玩家选项是否启动作家由每世界 `autoWrite` 设置决定。契约见 `docs/settings/00-共同上下文.md`。
- 父层只展示自己的 Markdown 和直接子层的门牌，不要递归把子场景内部卡片铺到父层。当前层的 `README.md` 可作为 `scene` 返回，但不能恢复成独立的固定入场面板；旧 README-only 场景若需要可读正文或选项，必须建立场内实体。
- Gate 的物品门槛比较稳定的精确文件路径；不要用显示标题或模糊名称代替路径。nook 同样只取角色目录的直接子级卡片。

### Agent、注入与通信

- `extensions/context.ts` 的每轮注入是临时请求上下文，不得使用会持久化并逐轮累积的消息接缝代替它。
- 注入由状态块、事件增量和下一步组成；重计算在轮边界完成，handler 只读取缓存并拼装文本。详细契约见 `docs/hooks/00-共同上下文.md`。
- `useWorld` 是前端唯一 WebSocket；新增帧必须同时更新服务端发射面、前端消费面和 WS 契约文档，并运行 `pnpm check:ws`。
- Agent 资源发现必须隔离；修改 `launch.ts`、preset 或扩展加载逻辑前，先检查 `docs/后端实现计划.md` 和 `vendor/pi-rp/packages/coding-agent/docs/` 的对应文档。
- 模型解析通常遵循 CLI 显式覆盖 → 已有会话记录 → settings 默认值；只改 `settings.json` 不会改变已经存在会话的模型。排查“改了默认模型却没生效”时，先检查 launch 参数和会话文件，不要盲目改用户目录。
- 两条 launch spec 必须保留 `--no-extensions --no-skills --no-context-files --no-prompt-templates --no-themes`；这些开关隔离的是自动发现，不影响显式传入的 extension/skill。缺失时，世界包扩展、上溯发现的仓库 `AGENTS.md` 或本机 skills 可能被意外注入 Agent。
- AIRP 使用仓库内 `.pi/agent/` 作为 `PI_CODING_AGENT_DIR`，不要通过修改 `~/.pi/agent/` 试图改变 AIRP 配置。模型覆盖顺序和世界级 `.airpworld/settings.json` 的优先级以 `launch.ts` 与 pi-rp 文档为准。
- `context` handler 不得重新扫描目录、读取数据库或重复渲染；这些重活只在 `agent_start` 的轮边界缓存一次。

## 3. 语言、命名和内容规则

- 稳定的世界、层、地点、人物、物品和 Chalk ID 使用 ASCII 小写 kebab-case 英文；显示标题、正文、人物显示名和提示词随世界语言。
- 代码注释、日志和报错使用英文；`docs/**`、根 `README.md`、本文件和开发者沟通使用中文——开发者都是中国人，产品面向的客户使用英文 / 日语。
- 路径与显示名分离。不要用显示标题作为稳定路径或关联 ID。
- 世界内容改动必须同时检查所有引用；优先使用现有迁移工具和测试，不手工留下旧路径兼容层。

## 4. 修改前的文档入口

先读与改动最接近的冻结契约，再读实现。不要在 `AGENTS.md` 中复制专项文档。

| 改动范围 | 先读 |
|---|---|
| 工具、动作层、互动字段 | `docs/tools/00-共同上下文.md`、`docs/doc-20-agent工具与互动字段协议.md` |
| 每轮注入、游标、上下文 | `docs/hooks/00-共同上下文.md` |
| WS 帧、前端消费、请求体 | `docs/前端接线体检.md`、`docs/wiring/00-共同上下文.md`、`docs/tools/12` |
| 演出通道、幻影、writer delta | `docs/perform/00-共同上下文.md` |
| 组件骨架屏、`card_writing`、幻影第三档 | `docs/skeleton/00-共同上下文.md`、`docs/perform/00-共同上下文.md` |
| Agent activity、角色 turn、TTS 动作过滤 | `docs/agent-awareness/00-共同上下文.md` |
| 初始化器、`airp-init`、空场景 | `docs/init/00-共同上下文.md` |
| 角色小天地 | `docs/nook/00-共同上下文.md` |
| 卡片尺寸、footprint、排座 | `docs/footprint/00-共同上下文.md`、`docs/layout/00-共同上下文.md` |
| 音频与素材 | `docs/audio/00-共同上下文.md`、`docs/assets/00-共同上下文.md`、对应 `assets/skills/*/SKILL.md` |
| TTS 与音色 | `docs/tts/00-共同上下文.md`、`docs/tts/07-音色别名映射.md` |
| prompt、preset、skill | `docs/prompts/00-共同上下文.md`、`docs/doc-23-提示词写作规范.md` |
| 每世界设置 | `docs/settings/00-共同上下文.md` |
| pi-rp 引擎 | `vendor/pi-rp/packages/coding-agent/docs/` 对应文档；仓库内操作使用 `pnpm pi` |

根入口和完整设计索引见 `docs/00-文档骨架.md`。如果代码与当前文档冲突，先确认哪一份是该领域标注的冻结契约，不要凭旧实现猜语义。

## 5. 不能省略的工程教训

这些规则看起来具体，但它们分别对应过数据重复、能力静默丢失、运行旧代码、布局跳动、性能回退和 Agent 越权等真实故障；修改相关模块时必须保留。

### pi-rp 与 preset

- 设计 pi-rp 侧功能时先读上游文档，再读源码确认，最后才决定是否修改引擎。不要用仓库里的旧实测结论替代引擎当前行为。
- `--preset` 接受 preset id，不接受文件路径；`tools.allow` 只过滤已有工具，不会把工具加入工具集；文件槽使用 `onMissing: "skip"`，否则 `onMissing: "error"` 可能让整个 Agent 启动失败。
- preset 的系统提示词进入 `items` 或显式注册的 AIRP slot，不要添加不存在的顶层 `system` 字段或臆造内建 slot。平台提示词正文以 `extensions/instructions.ts` 为源，不能在各模板 preset 中复制多份。
- 修改 `vendor/pi-rp` 必须在当前仓库的 vendored 副本中进行。子模块 HEAD 改变后，`dist` 可能仍是旧产物；只提交指针而不重建会让运行时静默执行旧代码。`pnpm pi status` 报 stale 或指针未对齐时，先修复再继续。

### 画布布局与性能

- 卡片宽度的唯一声明来源是 `CARD_FORMS`；高度以 `cards.width/height` 和前端实测 footprint 协作决定。禁止在第三处重新计算 `cardFormOf` 作为碰撞尺寸，也禁止落入通用的 `280/180` 默认尺寸。
- `Canvas` 的取景 effect 只能移动相机，不能把首帧排版结果回写卡片坐标；否则首次拖拽可能让整层跳位。
- 高频 `pointermove` 不得进入 React state；拖拽循环内不得读取 `offsetHeight`、`getBoundingClientRect` 等会强制同步布局的属性。使用测量缓存和视口缓存。
- 新增全屏 canvas 或动画层前先评估合成成本；隐藏页面时应跳过不必要的帧，粒子和网格不能退回固定巨型贴图或每帧创建昂贵对象。

### 合并、资源和静默失败

- 合并检查不能只看冲突块；合并可能在无冲突的行中丢掉 WS 发送方、前端消费方、i18n 键、角色音色或 preset slot。必须按生产端/消费端成对检查，并运行对应门禁。
- `assets/audio/**`、`assets/skills/**` 和已批准的模型目录属于入库素材；`assets/worlds/**` 与 `assets/_inbox/**` 是车间产物，不是发布位。音频变更同步 `PLAN.md` 和 `CREDITS.md`；角色情绪素材变更同步 `character-media.json` 并运行素材门禁。
- 文档中的路径、行号和目录职责也会失效；移动代码或改职责后运行 `pnpm check:docs`，不要保留“看起来还能用”的旧路径说明。

---

## 6. 工程安全规则

### 并行协作

- 把工作区中别人未提交的修改视为在途工作；不要 `stash`、`checkout`、`restore`、格式化或覆盖它们。
- 提交前先看 `git status`，只暂存自己改动的文件或 hunk；禁止 `git add .` 和 `git add -A`。
- **提交时必须只暂存自己的改动**：按文件或 hunk 使用 `git add <自己修改的路径>` / `git add -p`，不得因为文件里混有自己的改动就整文件暂存；提交前用 `git diff --cached --name-only` 和 staged diff 核对，确认没有带入其他 Agent 或用户的未提交内容。**不得以工作区还存在其他暂存或大批改动为借口不提交自己的改动**；必须拆分并及时提交属于自己的文件或 hunk。绝不使用 `git add .`、`git add -A` 或等价的全量暂存命令。
- 同一文件有重叠修改时先协调归属；不要把别人的改动顺手带进提交。
- 不要假设只有一个分支或一个 Agent 在推送；修改别人分支前先沟通。

### Git 与合并

- commit 后立即 push；push 前先 fetch。
- 远端有新提交时使用 merge，不要 rebase 已被他人拉取的提交；禁止 force-push `main`。
- 每次 merge 必须在同一个提交中登记到 `docs/merge/<title>-<merge短哈希>-<作者>.md`，并运行 `pnpm check:merge`。完整流程见 `docs/merge/00-合并纪律.md`。
- 合并后按连接面检查 WS、HTTP body、i18n、音色、preset 和删除文件，不能只看冲突块。

### 构建和生成物

- 修改 `packages/shared/src` 或 `apps/web/src` 后必须运行 `pnpm build`；生产端读取的是对应 `dist`，类型检查不能替代构建。
- 修改 `vendor/pi-rp` 时使用 `pnpm pi build` 或 `pnpm pi commit`，同时确认子模块工作区没有别人的修改。
- `extensions/` 由 jiti 直接执行 TypeScript；不要手工生成或提交同名 `.js` 文件，也不要把扩展编译产物放进 `extensions/`。

## 7. 验证

根据改动范围运行最小充分验证，不要把无关失败归因于自己的改动：

```bash
pnpm build
pnpm test
pnpm check:ws
pnpm check:bodies
pnpm check:docs
pnpm check:i18n
pnpm check:merge
```

涉及 Agent、提示词、初始化、素材或引擎时，再运行对应的 `pnpm probe:*`、`pnpm check:*` 或专项测试。改动引擎或 preset 后确认探针没有 `not found`、`unknown slot` 等警告。

UI 改动应启动实际应用并验证用户路径；行为改动应运行覆盖该契约的测试或探针。不要只以类型检查或单个文件编译作为完成证明。

## 8. 高频入口

- 全栈开发：`pnpm dev`
- 仅后端：`pnpm --filter @airp/server dev`
- 全量构建：`pnpm build`
- 全量测试：`pnpm test`
- 全链路探针：`pnpm probe`
- pi-rp 状态与构建：`pnpm pi status`、`pnpm pi build`
- 设计文档总索引：`docs/00-文档骨架.md`
- 代码与文档发生架构变化时，必须同步更新对应的冻结契约，而不是只改本文件。
