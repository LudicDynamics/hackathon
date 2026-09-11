# AIRP (AI Role-Playing Narrative Canvas)

> 一个让玩家像角色一样活在“活的无限画布世界”里的 AI 互动叙事游戏。
> 设计文档见 **[`docs/`](docs/)**（入口 [`docs/00-文档骨架.md`](docs/00-文档骨架.md)；2026-09-11 从已退休的 `infini-canvas` 项目迁入）。开发手册见 **[`AGENTS.md`](AGENTS.md)**。

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
├── templates/             # 预设世界模板
│   ├── holmes-world/      # 悬疑推理：Fog Over Baker Street
│   ├── school-romance/    # 校园恋爱：Sakura Academy
│   ├── magic-academy/     # 魔法学院：Emberglass Academy
│   └── cthulhu/           # 诡异惊悚：Mists of Innsmouth
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
# 从模板创建玩家专属世界
node tools/scaffold.mjs --template holmes-world --out worlds/my-holmes
# 可选模板: holmes-world, school-romance, magic-academy, cthulhu
```

### 4. 启动本地全栈开发
```bash
# 同时启动后端 API/WS 与前端 Vite 画布
pnpm dev
```
- 前端地址：`http://localhost:5173`
- 后端服务：`http://localhost:3001`
