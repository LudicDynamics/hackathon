# origin/niko 模板分发 —— 六个体验版模板改名 *-playtest 进 Git

> 合并 `60be734` · 父提交 `b7f1ab1`（ours=main）与 `7e1ea97`（theirs=origin/niko）· 作者 yoshi · 2026-09-13
> **事后补登记**（立法当天回溯）。

## 1. 这次合了什么

niko 在这个提交里把**六个当前体验版模板纳入 Git 分发**：把原模板目录改名为 `*-playtest`（`wuwu-playtest` / `whitechapel-playtest` / `divergence-playtest` / `first-snow-jp-playtest` / `magic-academy-playtest` / `unwritten-door-playtest`），无后缀目录保留为旧素材版 / 原型。**改动 360 个文件**（大量是改名 + 媒体）。

- **对方带来的**：六个 `*-playtest` 体验版模板（含媒体）与 `AGENTS.md` 的模板条目更新。
- **我方带来的**：交互后果统一文档（`b7f1ab1`）与 settings/i18n 批次。
- **两侧同时改的**：12 个文件（见 §2）。

## 2. 冲突处理

| 文件 | 两侧各是什么 | 裁决 | 理由 |
|---|---|---|---|
| `AGENTS.md` | 对方改在模板条目（~line 99/103）；我方改在文首注、§3.1、§4、§6.3 等 | **两边全留** | 区域不重叠 |
| `apps/web/src/App.tsx` | 我方 `AgentSettings` 加 `settings`/`onSaveSettings` props；对方新加 `TtsSettings` 组件 | **两行都留**（`<AgentSettings … />` + `<TtsSettings />`） | props 与组件各是各的，取并集 |
| `templates/*-playtest/characters/*/README.md` | 对方模板**从未声明 `voice:`**；我方无 | **不在此处解，按 §3 单独补** | 见下 |
| 其余 9 个（`.gitignore` / `README.md` / `routes/world.ts` / `CharacterModal.tsx` / `index.css` / `airp-gateway.ts` / `useWorld.ts` / 三份验收 doc） | 两侧各自追加 | 取并集 | 纯追加 |

### 静默丢失自查（**本条真抓到两处**）

`60be734` 合完，两条门禁红——**都不是冲突块**：

1. **`check:voices` 红**：对方六个 `*-playtest` 模板的角色 README **一个 `voice:` 都没有** → 合并后**同世界角色全撞服务端默认 `Cherry`**（门禁 V4 正确报红）。**处置**：按**同名角色在老模板里的既有定妆**补齐 9 个（`nanami`→`gentle-calm`、`sumi-yukimura`→`warm-cheerful`、`librarian`→`wise-elder`、`seraphina`→`playful-teasing`、`old-mo`→`rustic-storyteller`、`silver-kite`→`deep-magnetic`、`vera`→`sassy-spunky`、`watson`→`wise-elder`、`young-ryo`→`warm-energetic`）——**不是新拍板，是让体验版与素材版一致**。
2. **`check:bodies` 红**：**门禁自身的假阳性**——`CharacterModal.tsx:253` 的 JSDoc 里写着 `` `fetch('/api/tts'` ``，先于真调用命中 route → 误报调用点搬走。**处置**：修门禁跳过注释行（详见 `813c0f3` 条目 §2.5），并反向验证。

**修复提交**：`8d6fc83`（补 9 处音色 + 修 `check:bodies` 注释误报）。

## 3. 验证

```bash
pnpm build                              # → PASS
pnpm test                               # → 641/641
pnpm check:ws check:bodies check:docs check:skills check:voices check:i18n check:emotions
pnpm probe probe:tools probe:inject probe:prompt probe:init
pnpm typecheck:extensions               # → 全 PASS
```

**浏览器冒烟**：Auto-write 三态 `<select>` 在 Agents 面板渲染（默认 `off`）；改 → POST → 服务端读 → 落盘，往返成功。

**未决/遗留**：无。
