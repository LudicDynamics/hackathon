# origin/main 合入 —— 夜辉 D10 模型发布（fangsunjian 素材批次）

> 合并 `877c350` · 父提交 `45fb186`（ours=合并纪律批次）与 `35456e6`（theirs=origin/main）· 作者 yoshi · 2026-09-13
> 来源分支：`origin/main`（fangsunjian 推的 `assets/models/arcane-d10/`）
> **本纪律生效后的第一次合并**（首份按 §2 格式写的登记）。

## 1. 这次合了什么

- **对方带来的**：`assets/models/arcane-d10/`（夜辉 D10）——Blender 工程 `.blend`、`.glb`、纹理/预览 PNG、重建脚本 `build_d10.py`/`finalize_d10.py`、`validation.json` 与 `README.md`；并相应扩了 `.gitignore` 的白名单、更新了 `AGENTS.md` §2 目录树与 §7.8 素材口径、`assets/README.md`。
- **我方带来的**：合并登记纪律批次（`docs/merge/`、`tools/check-merge-log.mjs`、`.githooks/pre-push`、`AGENTS.md §6.6`）。
- **两侧同时改的**：`AGENTS.md` 与 `.gitignore`（都改在 §7.8 素材口径一带）。

## 2. 冲突处理

**无冲突——git 自动合并成功。** 两侧改的是 `AGENTS.md` 同一节的**相邻但不同行**（对方改 §7.8 的白名单行与目录树白名单注释，我方加 §6.6 与 §4 索引），自动合并把两边都留了。

| 文件 | 两侧各是什么 | 裁决 |
|---|---|---|
| `AGENTS.md` | 对方：§7.8 白名单加 `assets/models/`、目录树注释改「白名单 audio/、skills/ 与已批准的 D10 模型」；我方：§6.6 + §4 索引 + §6.1/§6.3/§6.4 交叉引用 | 自动合并（两边都保留，已 `git show` 核对 §6.6 与对方 §7.8 白名单行**同时存在**） |
| `.gitignore` | 对方加 `!assets/models/…` 白名单；我方无改动 | 取对方 |

**静默丢失自查**（§3.3，**首次真用**）：

- 两侧改同文件但无冲突 → 必须核实**没有一边被吃掉**。逐项 `git show 877c350:AGENTS.md` 确认：`§6.6 合并必须登记` 在、`assets/models/arcane-d10` 白名单行也在。
- `git diff --diff-filter=D 45fb186 877c350`：**无删除**。
- 二进制资产（`.blend`/`.glb`/`.png`）：`git cat-file -s` 抽查非零，未被 LFS/ignore 意外吞掉（`.gitignore` 白名单对已跟踪文件无效，属正常）。

**无连接面漂移**：本条不涉 WS 帧 / HTTP body / i18n 键 / 工具注册 / preset slot，故相关门禁的通过是「未被波及」而非「覆盖了本条」——仍一并跑了。

## 3. 验证

```bash
pnpm build            # → PASS
pnpm test             # → 655/655
pnpm check:merge      # → 绿（此时新 merge 尚无登记 → 写本文件后转绿）
pnpm check:docs       # → clean（AGENTS.md 路径引用含新增 assets/models/ 解析通过）
pnpm check:ws check:bodies check:i18n check:skills check:voices   # → 全 PASS
```

**浏览器冒烟**：无需（纯素材 + 文档 + gitignore，不涉运行时路径）。

**未决/遗留**：
- `assets/models/**` 的白名单是**逐文件**列举的（`.blend`/`.glb`/`.png`/`.py`/`README.md`/`validation.json`）——**新增 D10 类资产要记得同步扩白名单**，否则新文件静默不入库。已登记，未改（属对方素材批次的维护口径）。
- `ExtractText`/MCP 本机配置与日志仍然 ignore（对方 README 已写明），符合 §7.8。
