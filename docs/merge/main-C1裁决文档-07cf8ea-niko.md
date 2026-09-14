# 合并 origin/main 到 niko：C1 待拍板裁决与安全台账（文档）

> 合并 `07cf8ea` · 父提交 `d4e0a8b`（ours，niko）与 `a71623a`（theirs，`origin/main`）· 作者 niko · 2026-09-14
> 来源分支：`origin/main` 在 `271cb3c` 之后新增的一个 yoshi 文档提交 `a71623a`（C1 待拍板 6 项全部裁决 + 既有安全台账）。
> 目的：让 `niko` 包含 `origin/main` 的全部内容，随后 `main` 快进到 `niko`（`docs/command/08-迁移与收敛.md` §7.3）。

## 1. 这次合了什么

- **对方带来的**：`a71623a`，只有文档，共 7 个文件：`docs/command/00-共同上下文.md`、`docs/command/review-pending-C1.md`、`review-pending-C2C3.md`、`review-pending-C4.md`、`review-pending-C5C6.md`、`docs/现有安全待办台账.md`，以及 `docs/00-文档骨架.md` 的一行。
- **我方带来的**：自 `65fa09d` 以来 `niko` 的全部提交：`271cb3c` 合并及其修复、七海本机语音与按角色音色、DeepSeek V4、Vercel 部署、实时语音输入、骰子动画与绒布骰盒、界面修复等。
- **两侧同时改的**：只有 `docs/00-文档骨架.md`。

## 2. 冲突处理

先用 `git merge-tree --write-tree niko origin/main` 在不碰工作区的情况下试合并：**0 冲突**。

唯一两侧都改过的 `docs/00-文档骨架.md` 由 git 自动合并：`niko` 侧自分叉点新增的 2 行、`main` 侧新增的 1 行，合并结果里全部保留，无需手工裁决。

**静默丢失自查**：

- 合并结果相对 `niko` 父提交：没有删除任何文件。
- 相对 `main` 父提交：少 3 个文件，是 `niko` 在 `e4a139a` 移走的 `docs/TTS设置面板.md`、`docs/doc-15-世界模板规范与开局引导.md`、`docs/doc-16-快照回滚与事件历史.md`。这 3 个移动早在 `271cb3c` 的登记里写过，不是本次丢失。
- 本次只有文档变化，没有代码、WS 帧、请求体或翻译键的变动。

## 3. 验证

```bash
git merge-tree --write-tree niko origin/main   # → 退出码 0，无冲突
pnpm check:merge                                # → PASS
```

- 只改文档，未重新构建；合并前 `niko`（`d4e0a8b`）已通过全量构建、相关测试和各项门禁。
- **未决/遗留**：`a71623a` 的 C1 裁决可能影响 `docs/merge/niko-骰子奖励与双语模板-271cb3c-niko.md` §2.3 里的待裁决项（如 `dice_outcomes` 与命令模块），尚未逐条对照。
