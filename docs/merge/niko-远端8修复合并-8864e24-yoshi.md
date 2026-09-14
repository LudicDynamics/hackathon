# niko 远端 8 项修复合并 — 8864e24

> **登记的 merge commit**：`8864e24`（`Merge remote-tracking branch 'origin/niko'`）。
> **parents**：`52041f2`（本地 ours，T0.6 revision 保护收口）/ `e4aefdc`（theirs，`origin/niko` 远端最新）。跑 `git show 8864e24` 可自证。
> **来源分支**：`origin/niko`（nikoloside 的功能与修复线，当前也是远端 `main` 的合入源）。

## 1. 这次合了什么

把 `origin/niko` 自 `12166e2`（上次合并的对方父）起的 **8 个提交** 合并进本地 `main`。

**方向与原因**：明月通报「远程最新版又修了一些 bug」。`git fetch --all --prune` 后确认：
- 远端 `main` **未动**（仍是 `9af9c9b`，与本地已收口的内容一致）；
- 新增的 8 个提交全部在 **`origin/niko`** 上（`12166e2..e4aefdc`）；
- 本地 `main` 领先远端 `main` 3 个提交（合并事故修复的 3 个提交）。

按 `AGENTS.md §6.2` 走 merge（不 rebase）。

**对方带来的**（8 个 bugfix，全部经只读试合并 + 构建 + 定向测试复核）：

| 提交 | 修复内容 |
|---|---|
| `1efcf90` | 启动不再直接在模板上游玩；Vercel 本机 TTS 走 Tailscale Funnel |
| `275d46c` | 文档：角色对话框 GPT-Live 语音通话模式提案 |
| `9200d88` | 骰子演出被板书对话框遮住；线上 TTS 失败日志带原因 |
| `e0efa4e` | GPT Live 建会话无超时导致一直「连接中」 |
| `497aef1` | 语音输入录到静音，转写出无关短词 |
| `ff88e9c` | 连点「TAKE」发出两次移动，第二次报 500 EEXIST |
| `c1d9ed8` | 骰子动画未加载完就结算收场；结果在演出前显示在卡片上 |
| `e4aefdc` | 「よく調べる」读页只剩一行；读页里的选项按了没反应 |

**我方带来的**（本轮合并前已收口的 3 个提交，均**未被丢掉**，见 §3 自查）：

| 提交 | 内容 |
|---|---|
| `4f47421` | 修正 firstsnow 命名（`first-snow`→`firstsnow`）与 `vendor/pi-rp` 子模块指针回退 |
| `aa56fd2` | 回填 `magic-academy/seraphina` 合并丢失的平台槽 |
| `52041f2` | 为 13 条世界写路由补并发 revision 保护（T0.6） |

**两侧同时改的**：只有 `apps/web/src/App.tsx`（对方改 `handleTakeItem` 去重，我方改世界加载遵循 `manifest.entry`）。

## 2. 冲突处理

**机械冲突：0 个。** `git merge --no-ff origin/niko` → `Auto-merging apps/web/src/App.tsx` / `Auto-merging apps/server/src/routes/world.ts`，`Merge made by the 'ort' strategy`，无冲突块。

只读预演阶段 `git merge-tree` 曾把 `App.tsx` 报为 `changed in both`，实跑确认两处改动**行段正交**（对方在 `handleTakeItem` 与 `toggleFreeze` 之间，我方在 `loadWorld` 的 `enterLayer` 调用点），`ort` 自动合并成功。

**结构决策单独展开**：

- `apps/server/src/routes/world.ts`：对方在其 `reply()` 错误映射器里新增 `EEXIST → 409 already_exists`（store 的 no-clobber 保护被并发 move 抢先，属冲突而非服务端故障），并给模板拷贝加 `.airpworld`/`.pi` 过滤器；我方新增 `worldWrite` 包装 13 条路由 + `expectedRevision` 校验。裁决：**两者按设计共存**——我方的实现显式要求「所有错误仍经 `reply()`」，即把 `reply` 保留为唯一错误映射器，对方的 EEXIST 分支落点不变。合并后实测 `expectedRevision` 18 处命中、`already_exists` 1 处命中，均在。
- `apps/web/src/App.tsx`：**取并集**——保留我方的 `manifest.entry` 回落逻辑（`result.manifest.entry && result.manifest.layers?.[entry] ? entry : 'map'`）与对方的 `takingRef` 双击去重。

**静默丢失自查**（按连接面扫，不只扫冲突块）：

| 面 | 结果 |
|---|---|
| WS 帧 | `pnpm check:ws` → clean（27 emitted / 24 consumed / 27 in contract） |
| HTTP 请求体 | `pnpm check:bodies` → clean（11 routes pinned） |
| i18n 键 | `pnpm check:i18n` → ok（188 keys resolve） |
| 导出/删除文件 | `git diff --diff-filter=D 52041f2 8864e24` → **空**（我方无删除）；相对对方删除的 5 个文件全部是本轮**有意删除**（4 个 dead chrome 组件 + `templates/first-snow/skills/first-snow-play/SKILL.md` 残留），非合并丢失 |
| 文档引用 | `pnpm check:docs` → clean（7 docs / 15 owned symbols / 86 cited paths） |
| 我方三项修复存活 | `manifest.entry`=2 处、`takingRef`=4 处、`expectedRevision`=18 处、`already_exists`=1 处，均在 |

**未决/遗留**：对方带来的 `apps/web/test/voice-input.test.mjs` 与 `apps/web/test/dice-reveal-hold.test.mjs` 在**合并后的树**上实跑 9/9 通过；先前一次失败系 `/tmp` tmpfs 占满（`ENOSPC`）的环境问题，清理后消失，非代码缺陷。

## 3. 验证

```bash
pnpm build                          # → PASS（✓ built in 13.86s）
pnpm check:ws                       # → PASS clean (27 emitted, 24 consumed, 27 in contract)
pnpm check:docs                     # → PASS clean (7 docs, 15 owned symbols, 86 cited paths)
pnpm check:i18n                     # → PASS ok (188 used keys resolve)
pnpm check:bodies                   # → PASS clean (11 routes pinned)
node --test apps/web/test/voice-input.test.mjs apps/web/test/dice-reveal-hold.test.mjs   # → 9/9 PASS
node --test apps/server/test/preset-slots.test.mjs   # → 5/5 PASS（合并事故修复的命名用例）
```

**只读预演证据**（合并前）：`git worktree add --detach HEAD` + `git merge --no-commit --no-ff origin/niko` → 0 冲突；该 worktree 内 `pnpm build` → PASS。

**浏览器冒烟**：本轮为后端路由 + 前端修复的合并，未跑浏览器；UI 相关改动（骰子演出节奏、语音输入、读页选项）由对方带来的定向测试覆盖。

**未决/遗留**：
- `apps/server/test/unwritten-door.test.mjs` 有 1 个 **pre-existing** 失败（`The writer is still resolving your previous action`），在 `git stash` 掉本轮 .改动后同样复现，与本合并无关。
- `templates/wuwu/**` 有另一会话的**在途内容创作**（`dice_outcomes` 迁入实体），未纳入本次合并、未暂存、未触碰；它导致 `tools/world-editions.test.mjs` / `tools/wuwu-chalk-contract.test.mjs` / `tools/shipped-experiences.test.mjs` 当前报红，属该会话的完成度，待其收口。
