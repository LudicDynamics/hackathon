# c1收口同步远端main — 7c79544

> **登记的 merge commit**：`7c79544`（`Merge remote-tracking branch 'origin/main'`）。
> **parents**：`eb34966`（本地 C1 收口）/ `12166e2`（`origin/main` 合入点）。跑 `git show 7c79544` 可自证。

## 1. 这次合了什么

把 `origin/main` 的 31 个提交合并进本地 `main`。本地当时领先 1 个提交（`eb34966` 的 C1 收口），远端领先 31 个。

**方向与原因**：`git push` 被拒（non-fast-forward）→ 按 `AGENTS.md §6.2` 「远端有新提交时用 merge，不要 rebase」执行 merge，未 rebase。

**远端带进来的主要内容**（与本批次无关，属他人开发）：

| 主题 | 代表提交 |
|---|---|
| 语音输入改为 OpenAI 实时转写 | `da6e32c` |
| 角色本机音色配置 / STT 流 | `462a21d`、`apps/server/src/engine/stt-stream.ts` |
| 骰盒素材与 D10 骰子动画修复 | `d4e0a8b`、`dec3785` |
| 角色栏悬停与标题省略 | `18af9ed` |
| DeepSeek V4 Flash 模型配置 | `0b12bd0` |
| Vercel 部署 | `06d799d`、`Dockerfile.vercel`、`tools/start-vercel.mjs` |
| 体验工具集 | `tools/experiences/*.mjs`、`tools/*.test.mjs` |
| **把我们的 C1 裁决合并进 `niko` 分支** | `07cf8ea`、`12166e2` |

最后一条值得单记：另一位开发者已把本批次此前的 `a71623a`（C1 待拍板 6 项裁决 + 安全台账）**合并到 `origin/niko`**，而 `niko` 又被合回 `main`。所以本次合并**不是单纯的上游同步**——它把本批次的工作经由 `niko` 绕回 `main`。核对结果：`docs/command/` 未被远端改动（见 §3），两条路径没有互相覆盖。

## 2. 冲突处理

**无冲突。** `git merge origin/main --no-edit` 一次成功，`git diff --name-only --diff-filter=U` 为空。

合前预演 `git merge-tree` 报告 0 个冲突标记；合后逐项核对：

| 检查项 | 结果 | 依据 |
|---|---|---|
| `docs/command/` 是否被远端改过 | **否** | `git diff --name-only HEAD...origin/main -- docs/command/` 为空 |
| 我的 11 份收口是否完好 | **是** | `git diff --name-only HEAD~1 HEAD -- docs/command/` 为空 |
| `docs/00-文档骨架.md` 是否冲突 | **否**（远端改了、本地未改） | 远端改动在文件头部（`README.md` 主题入口、双语模板入口两段），与我在 `a71623a` 之后的还原无关 |

**一个必须按纪律核对的点**：`AGENTS.md §6.5` 要求「合并检查不能只看冲突块」。本批次改了 `docs/command/` 下的 10 份设计文档，属纯文档路径，**不含 WS 帧、HTTP body、i18n 键、角色音色或 preset slot**——即无生产端/消费端成对接口。但本批次**大量引用**了这些接口的 `file:line`（`useWorld.ts`、`App.tsx`、`event-bridge.ts`、`world-context.ts` 等）。远端这 31 个提交**动了其中若干文件**，所以那些行号引用可能已漂移。

**处置**：这**不是本次合并引入的缺陷**——设计文档的行号本就是快照（`06`/`10` 收口时已按要求标注「工作树可能有未提交改动」并实测给新行号）。但漂移面**确实扩大了**。已登记为遗留项（见 §3），属实现批次的核对范围，不在本次合并就地修。

## 3. 验证

**门禁**（合并后重跑）：

```text
pnpm check:docs   → check-hooks-docs: clean (7 docs, 15 owned symbols, 85 cited paths)
pnpm check:merge  → ALL MERGE-LOG ASSERTIONS PASSED
pnpm check:i18n   → ok i18n keys: 160 used keys resolve with full zh-CN/ja translations
```

`check:i18n` 的 7 条 warn（`Dismiss`、`They are not here right now.` 等无字面 `t('…')` 调用点）是**既有未接线键**，与本批次无关，且不属本批次范围。

**内容完整性**：

- `docs/command/` 的 11 份文档在合并中**逐字节未变**（上表）。
- 本次合并未修改任何文件内容（`git merge` 无冲突 → 无手工编辑）。

**遗留项（明确不在本次合并修）**：

1. **设计文档里的 `file:line` 引用可能因这 31 个提交而漂移**。实现批次开工前 MUST 按当时工作树重测（`06`/`10` 已建此机制，其余文档同理）。特别是 `apps/server/src/engine/launch.ts`、`apps/server/src/routes/world.ts`——两者都在远端的改动文件列表里，而本批次多处引用。
2. `[C-4]` 的 POST fail-open 修复（`world.ts`）与 `docs/settings/00` 的回写——属实现批次，与本次合并无关。
3. `§11.3 C7`（06 的 6 个孤儿 `command_*` 错误码归属）——属实现批次。
