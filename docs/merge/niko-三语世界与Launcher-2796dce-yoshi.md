# niko 远端三语世界 / Launcher / 部署 合并 — 2796dce

> **登记的 merge commit**：`2796dce`（`Merge remote-tracking branch 'origin/niko'`）。
> **parents**：`27c7580`（本地 ours，含 C1 画布整理设计 + 分散红用例修复）/ `7b4518c`（theirs，`origin/niko` 远端最新）。跑 `git show 2796dce` 可自证。
> **来源分支**：`origin/niko`（nikoloside 的功能与修复线，也是远端 `main` 的合入源）。

## 1. 这次合了什么

把 `origin/niko` 自 `e4aefdc`（上一轮合并的对方父）起的 **14 个提交** 合并进本地 `main`。

**方向与原因**：上一轮合并后继续推送时，`git fetch` 发现 `origin/niko` 又前进了 14 个提交（641 文件 / +18264 −8013），含七个世界的中文版、世界 Launcher 三版迭代、Remotion 发布视频工程与子路径部署。明月裁定「按远端走」，故合并。

**对方带来的**（14 个提交）：

| 提交 | 内容 |
|---|---|
| `a025a70` | 界面：看不了正文的卡片不显示「よく調べる」 |
| `bb00fd8` | 界面：世界 Launcher——各世界以玻璃砖并排展示，随时可回到这里 |
| `0d22f39` | 修复：Launcher 提交里 `App.tsx` 的改动插错了位置 |
| `7a7e293` | 界面：世界 Launcher 第二版——无限砖墙、任意方向滚动、三语同步 |
| `0249c33` | 功能：Agent 光标——作家与角色调用工具时，指针移到它正在处理的 md / 文件夹 |
| `fc31d24` | 界面：顶部路径单行省略；打开的背包盖在角色栏上面 |
| `6127c56` | 新增：发布视频工程（Remotion）与大文件忽略规则 |
| `e03c676` | 界面：世界 Launcher 第三版——卡片视频、专属音乐、更顺的滚动与性能优化 |
| `a13a152` | 界面：世界 Launcher 音乐换成魔王魂「ヒーリング17」，并加署名 |
| `43b477c` | 世界：七个世界的中文版（zh-CN）模板 |
| `c8ba736` | 界面：Agent、服务连接与语音设置面板接入中日文 |
| `c0af309` | 角色：七海、雪村澄、Seraphina 的 preset 补齐工具禁用表 |
| `32a550f` | 文档：发布视频脚本大纲 v2；占位配乐 wav 不入库 |
| `7b4518c` | 部署：支持挂在 URL 子路径下（`AIRP_WEB_BASE`）与 VPS 座位部署配置 |

**我方带来的**（本轮合并前的本地提交，均**未被丢掉**，见 §3 自查）：

| 提交 | 内容 |
|---|---|
| `fa91c11` | 修 7 个分散的既有红用例（含 `first-snow-closing` 的中文「回合」泄漏、`fm.tsx` 恢复冻结稳定 ID 优先） |
| `27c7580` | docs：画布重叠治理与整理 Agent 设计批次（另一会话产出） |
| `4b16524` | first-snow 三语目录统一为 kebab-case（**本合并后**的收尾提交） |

## 2. 冲突处理

**机械冲突：0 个。** `git merge --no-ff origin/niko` → `Merge made by the 'ort' strategy`，无冲突块。

**但「零冲突」不等于「无误」——实测发现 2 类真实问题，已在本合并的收尾提交中修掉**：

### 2.1 命名冲突（结构性，必须由人裁决）

远端 `43b477c` 把初雪英语版目录定为 **`first-snow`**，并新增 `first-snow-zh`；而**上一轮合并**（`8864e24`）我刚把该目录统一回了 `firstsnow`（依据当时的「规范名 = `firstsnow`」裁定）。

三语格局下，`first-snow` / `first-snow-jp` / `first-snow-zh` 才有自洽命名，故明月裁定**按远端走**。收尾提交 `4b16524` 执行：删除 `templates/firstsnow/`、取远端 `templates/first-snow/`、恢复被上一轮误删的 `skills/first-snow-play/SKILL.md`。三个目录现各 **67 文件**。

> ⚠️ 教训：`world-editions.mjs` 的 **family key** 仍是 `firstsnow`（英文版 *id*），而**目录名**是 `first-snow`。这两者是不同层级，先前混为一谈导致了这次反复。

### 2.2 远端遗留的红测试（对方树上就是红的）

`apps/server/test/preset-slots.test.mjs` 的锚点断言仍指向旧路径 `templates/firstsnow/characters/sumi-yukimura/preset.json`。**实测确认远端 `origin/niko` 自己的树上这条也是红的**（在 `origin/niko` 的 detached worktree 里跑同一测试 → 1 fail），故属远端遗留，非本次合并引入。收尾提交改为 `templates/first-snow/…`。

### 2.3 静默丢失自查（按连接面成对检查，不只查冲突块）

| 面 | 结果 |
|---|---|
| 我方提交存活 | `fa91c11` / `27c7580` 均在 `2796dce` 历史中 |
| 我方 preset 修复未被回退 | `templates/first-snow/characters/{nanami,sumi-yukimura}/preset.json` 的 `tools.deny` = **14**（来自对方 `c0af309`，与我方上一轮的回填一致） |
| `magic-academy/seraphina` | `tools.deny` = **14**（对方 `c0af309` 也补齐了，与我方 `aa56fd2` 一致） |
| 删除文件 | `git diff --diff-filter=D 27c7580 2796dce` 相对我方无意外删除；相对对方删除项均为 Launcher 迭代的旧文件 |
| WS 帧 | `pnpm check:ws` → clean（27 emitted / 24 consumed / 27 in contract） |
| HTTP 请求体 | `pnpm check:bodies` → clean |
| i18n 键 | `pnpm check:i18n` → ok |
| 文档引用 | `pnpm check:docs` → clean |

## 3. 验证

```bash
pnpm build        # → PASS
pnpm test         # → 1037/1037 PASS（本合并收尾后）
pnpm check:ws     # → PASS clean (27 emitted, 24 consumed, 27 in contract)
pnpm check:docs   # → PASS clean
pnpm check:i18n   # → PASS ok
pnpm check:bodies # → PASS clean
pnpm check:merge  # → PASS（本登记文件即为其断言对象）
```

**只读预演证据**（合并前，在 detached worktree 中）：`git merge --no-commit --no-ff origin/niko` → 0 冲突；`pnpm build` → PASS；`preset-slots` / `world-editions` 各 1 红（即 §2.1/§2.2 两处，非本合并引入）。

**浏览器冒烟**：世界 Launcher 三版、Agent 光标、背包层级、路径省略属 UI 改动，由对方带来的改动与现有测试覆盖；未逐项手工验收。

## 4. 未决 / 遗留

- **`pnpm check:ux` 当前红（13 findings）**：全部来自远端新增的 `apps/web/src/components/world-launcher.css` 里 13 处**未注册的数值 `z-index`**。这些是 `.world-launcher` 内部的**局部堆叠上下文**（`z-index: 0..5`），与全局 depth token 语义不同，但 `tools/check-ux-contract.mjs` 的 DEPTH 规则按「裸数值 `z-index`」无差别提取。**远端自己的树上同样是红的**（门禁遗留，非本合并引入）。已由并行会话 `优化前端组件布局与交互` 接手处理。
- **`unwritten-door` 的 pre-existing 失败**已由并行批次修掉（`fa91c11` 之后 `pnpm test` 全绿）。
- **`templates/wuwu/**` 的游玩状态污染**已在本轮之前回退（`.airpworld/history.db` 的 `actor_type: player` 事件把 run 结果写回模板），不属本次合并。
