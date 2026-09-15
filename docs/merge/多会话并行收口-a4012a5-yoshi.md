# 多会话并行开发收口合并 — a4012a5

> **登记的 merge commit**：`a4012a5`（`Merge remote-tracking branch 'origin/main'`）。
> **parents**：`ff5a29b`（本地 ours，本轮收口提交）/ `6ae6704`（theirs，`origin/main` 远端最新）。跑 `git show a4012a5` 可自证。
> **来源分支**：`origin/main`（远端已前进 4 个提交，本地在并行开发中领先 10 个）。

## 1. 这次合了什么

本地因多会话并行开发领先 `origin/main` 10 个提交，远端在此期间前进 4 个。双向 merge。

**对方带来的**（4 个提交）：

| 提交 | 内容 |
|---|---|
| `0bd76c5` | Exp：33 个层 README 的选项搬进各层 `00-hub.md`，房间内部才看得到「看 / 开 / 回」 |
| `5c6c644` | 服务端：加载世界时打一行日志——追查「场景自己跳回去」是哪个标签页 / 会话切了世界 |
| `e414059` | 互动：声明动作弹窗改为按下指针即关，不再依赖 `click` |
| `6ae6704` | 文档：README 改名 Living Canvas - worldlines，GitHub 首页英文版 + 中文版 |

**我方带来的**（本轮多会话收口，10 个提交）：

| 提交 | 作者会话 | 内容 |
|---|---|---|
| `41d187f` | RattyHorse | presence 收口核验——B1–B6 逐条带证据，验收矩阵登记状态与真缺口 |
| `e7fdef0` | FunnyDragonfly | command C7 效果层码归属 + C8 写入目标校验归属 + C6/C9/C10 收口核验 |
| `1c9721e` | Main | 骨架屏不再为「不属于任何层」的路径占座（`isLayerDir` 判据） |
| `5bf22b1` | Main（EffectiveLlama） | POST `/api/world-settings` 改为 patch 语义 |
| `bb245c7` | Main | 设置保留服务端整个对象 + 恢复被误删的 `reconcileLanded` |
| `c18122b` | 01a0a151 | nook 子场景——门牌、进入、摆放、初始化门 |
| `8905b87` | Main | 恢复误删的 `forwardWorldEvent` 调用（`bb245c7` 引入的回归） |
| `98aa6cf` | 01a0a151 | agent-activity 的 `memory` 操作 |
| `79427f9` | RattyHorse | presence B10 窄屏裁切修复 + B3 转发行为守卫 |
| `ff5a29b` | Main（QuerulousWalrus / SquealingGuan） | 骨架屏收口裁决 + C19 第 1 档 `dice_reward` 落地 |

## 2. 冲突处理

**机械冲突：0 个。** `git merge origin/main --no-edit` 无冲突块。

**唯一重叠文件 `apps/server/src/routes/world.ts` 不冲突**：远端改 `:606-610`（加载世界日志），本地改 `:5-13`（import）与 `:541-557`（settings handler）——**区间不相交**，`ort` 策略自动合并。

## 3. 验证

### 3.1 连接面自查（AGENTS.md §5「不能只看冲突块」）

逐项按**生产端 / 消费端成对**检查，而非只看冲突块：

| 面 | 检查 | 结果 |
|---|---|---|
| WS 帧 | `pnpm check:ws` | clean（28 emitted / 26 consumed / 28 in contract） |
| HTTP body | `pnpm check:bodies` | clean（11 routes pinned） |
| i18n 键 | `pnpm check:i18n` | PASS |
| 文档路径 / 符号 | `pnpm check:docs` | clean（8 docs / 16 symbols / 110 paths） |
| 删除文件 | `git diff --diff-filter=D a4012a5^1 a4012a5` | **空**（无删除被吞） |
| preset slot | `git diff a4012a5^1 a4012a5 -- presets/` | **空** |
| 角色音色 / 素材 | `git diff --name-only a4012a5^1 a4012a5 -- assets/` | **空** |
| 子模块指针 | `git diff a4012a5^1 a4012a5 -- vendor/` | **空**（双方均未动子模块） |

### 3.2 全量验证（合并后，非分支上）

| 命令 | 结果 |
|---|---|
| `pnpm build` | ✅ 通过 |
| `pnpm test` | ✅ **1468 tests / 1468 pass / 0 fail / 0 skipped** |
| `pnpm check:ws` | ✅ PASS |
| `pnpm check:bodies` | ✅ PASS |
| `pnpm check:docs` | ✅ PASS |
| `pnpm check:i18n` | ✅ PASS |

**双向回归闭合**：`8905b87` 恢复了 `bb245c7` 误删的 `forwardWorldEvent(msg)` 调用；RattyHorse 的 `apps/web/test/world-event-forwarding.test.mjs`（8 例、真行为驱动）对 HEAD 全绿，B5 投影转发回归已闭合。

## 4. 遗留与已知事项

- **未跟踪目录 `docs/2026-09-15-exp-mingyue/`**：另一会话（`01a0a151`）的纯设计批次（新目录、无代码），**有意留待设计评审门过后再提交**，未纳入本次合并。
- **`/tmp` tmpfs 耗尽**：`pnpm test` 曾报 `ENOSPC`（4.9G tmpfs 被 `airp-*` 测试残留塞满）。已清理；**这是测试卫生缺陷**（测试不清理自己的临时目录），已登记待查，不影响本次合并正确性。
- **`origin/niko` 被 force-update**（`ca47a2d...6c52d2e`）：与本分支无关，未受影响。
