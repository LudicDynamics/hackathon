# AIRP (AI Role-Playing Narrative Canvas)

> 一个让玩家像角色一样活在“活的无限画布世界”里的 AI 互动叙事游戏。
> 设计文档见 **[`docs/`](docs)**（入口 [`docs/00-文档骨架.md`](docs/00-文档骨架.md)；2026-09-11 从已退休的 `infini-canvas` 项目迁入）。开发手册见 **[`AGENTS.md`](AGENTS.md)**。

---

## 🏛️ 核心架构与设计哲学

1. **叙事是世界的灵魂，多模态与实体交互是玩法主力**：
   - 作家的叙事旁白（`type: chalk`）统摄全场，统领视差画卷、环境拟音、角色微动与物理道具碰撞。
2. **2.5D 纸雕立体微缩剧场（Shadow Box & Parallax）**：
   - 基于 Web 标准（CSS 3D `perspective: 1200px`）实现视差景深与悬浮微尘粒子（Particle Overlay），拒绝重度 3D 泥潭。
3. **以物解谜（Point-and-Click）与大号物理掷骰**：
   - 玩家背包道具可拖拽释放到场景卡片/门卡/NPC 进行解谜（`use_item_on`，如以物开锁/出示证物）。
   - 纯 CSS 3D Cube 物理掷骰动画 + 引擎真随机判定（`expect: ">50"`）与戏剧化结算。
4. **角色特写遮罩（6 表情差分 + 懒灵魂）**：
   - 画布上轻量在场（类光标圆形头像），点击进入 galgame 式特写遮罩，启动独立角色 Agent。
   - 角色通过台词句首 `[emo: normal|smile|shock|sad|angry|thinking]` 驱动 6 情绪差分立绘即时平滑切换。
5. **文件即真相（File as Source of Truth）**：
   - 世界目录就是真相源（无独立状态文件），状态收编在叙事 frontmatter 中（`status.data` / `choice` / `roll_dice`），分层存储：内容走文件系统、架构状态与历史走 SQLite（`canvas.db` + `history.db`）。
   - **`status` 只是某个实体（含 chalk）的一份快照，读它 = 读那个文件；永不引入 state 系统**（`get_state` / `set_state` / `state_update` / `watch_state` / 状态文件 / 状态栏）——那会造成第二个真相源，绕过 `edit` 与事件表。详见 `docs/protocols/doc-20` §2.3。

---

## 📁 目录结构

```text
├── apps/
│   ├── server/            # Node.js + WebSocket + pi-rp RPC 引擎生命周期编排
│   │   ├── src/engine/    # rpc-client, lifecycle, event-bridge, brief-builder
│   │   └── src/routes/    # world 管理、移动重写、掷骰判定、上帝模式 API
│   └── web/               # React 19 + Tailwind + Vite 前端画布
│       └── src/
│           ├── components/canvas/     # 无限画布底座、单 transform、相机手势、卡片投影
│           ├── components/narrative/  # 楷体墨字 chalk、状态表、选项卡、3D 骰子
│           ├── components/overlay/    # 角色遮罩立绘 (6 表情差分) + galgame 流式对话
│           ├── components/sidebar/    # 右侧边栏：背包 (player/) + 角色 (寻道/交谈/跟随)
│           └── components/god/        # 上帝模式工具栏 (世界冻结 + 造物)
├── packages/
│   └── shared/            # WorldManifest (Zod), ChalkFrontmatter, WorldStore, SQLite Schema
├── presets/               # 提示词预设 (writer, character, scene-init, nook-init)
├── templates/             # 七个世界的正式双语模板；英文无后缀，日文通常为 -jp
│   ├── wuwu/              # 雾坞镇（英文）
│   ├── wuwu-jp/           # 雾坞镇（日文）
│   ├── firstsnow/         # 初雪电台英文版；保留历史稳定 ID
│   └── ...                # 完整清单见下方双语入口
├── archive/templates/     # 旧素材版、playtest 与技术测试模板，可恢复归档
├── docs/                  # 设计文档（真相源，入口 docs/00-文档骨架.md）
├── tools/
│   ├── scaffold.mjs       # 脚手架：模板拷贝即开世界
│   └── probe-writer.mjs   # Gate 探针：验证引擎与 RPC 全链路
├── vendor/
│   └── pi-rp/             # Git submodule 引入的 pi-rp 运行时
└── AGENTS.md              # 开发手册（架构、文档导航、开发纪律）
```

---

## 🚀 快速启动

### Windows 日常更新与启动

已有本地模型配置时，双击根目录的 `Start-AIRP.cmd`，或在 PowerShell 执行 `./Start-AIRP.cmd`。
需要更新时先运行 `git pull --ff-only --recurse-submodules`，再运行这个脚本。

脚本自动安装工作区依赖、按源码时间检查并重建 pi-rp、编译项目，再重启本项目的后端。
页面由后端直接提供，打开 **http://localhost:3001/**，无需另开 Vite。
模型配置 `.env.local`、`.pi/agent/` 中的本地配置文件和 `worlds/` 存档沿用；启动不调用模型、不跑开发验收探针。
端口被其他程序占用或 Agent 正在工作时会明确停止，构建失败时保留原服务。
日志位于 `.artifacts/local-server/`；无须打开浏览器时使用 `./Start-AIRP.cmd -NoBrowser`。
Git 提示本地修改冲突时先处理冲突，脚本不会替你覆盖修改或切换引擎版本。

### 1. 编译全仓库
```bash
pnpm install
pnpm build
```

### 2. 运行健康探针
```bash
pnpm probe
# 输出 === [AIRP Gate Probe] ALL CHECKS PASSED === 即表示全链路就绪
```

### 3. 脚手架拉起新世界
```bash
# 从当前初雪日文正式版创建玩家专属世界
node tools/scaffold.mjs --template first-snow-jp --out worlds/my-first-snow
```

### 4. 启动本地全栈开发
```bash
# 同时启动后端 API/WS 与前端 Vite 画布
pnpm dev
```
- 前端地址：`http://localhost:5173`
- 后端服务：`http://localhost:3001`

### 当前双语体验入口

以下正式模板已纳入 Git，包含场景 README、Chalk、世界 skill、角色及配套图片 / 动画。拉取后可在 5173 的世界菜单里直接创建新游戏，**不需要先运行内容生成工具**；真实 AI 游玩仍需配置服务。

| 世界 | English | 日本語 |
|---|---|---|
| 雾坞镇 | [`wuwu`](templates/wuwu/) | [`wuwu-jp`](templates/wuwu-jp/) |
| 福尔摩斯 | [`whitechapel`](templates/whitechapel/) | [`whitechapel-jp`](templates/whitechapel-jp/) |
| 分支线 | [`divergence`](templates/divergence/) | [`divergence-jp`](templates/divergence-jp/) |
| 初雪电台 | [`firstsnow`](templates/firstsnow/) | [`first-snow-jp`](templates/first-snow-jp/) |
| 魔法学院 | [`magic-academy`](templates/magic-academy/) | [`magic-academy-jp`](templates/magic-academy-jp/) |
| 未写之门 | [`unwritten-door`](templates/unwritten-door/) | [`unwritten-door-jp`](templates/unwritten-door-jp/) |
| 月下之誓 | [`moonlit-contract`](templates/moonlit-contract/) | [`moonlit-contract-jp`](templates/moonlit-contract-jp/) |

`firstsnow` 是唯一保留的历史稳定英文模板 ID；其他正式模板不再使用 `-playtest`。原有旧模板和 playtest 版本已可恢复地移入 `archive/templates/pre-bilingual-2026-09-14/`，不会作为新游戏入口出现。分发与离线校验不代表世界已经通过真实 AI 通关。

正式内容直接维护在上述双语模板中。`tools/experiences/` 与 archive 仅用于历史测试和实验 fixture；不要把旧编译器产物重新放回正式模板列表。玩家存档、密钥和运行缓存继续忽略，模板更新不会自动迁移旧存档。
