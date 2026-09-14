# 合并 main 到 niko：骰子奖励、双语模板与七海语音（含合并后修复）

> 合并 `271cb3c` · 父提交 `aad5bf3`（ours，niko）与 `65fa09d`（theirs，`origin/main`）· 作者 niko · 2026-09-14
> 来源分支：`origin/main`（C1 世界命令设计批次、Niko 功能迁移 `1ddb7e0`/`a1ac282`、presence/right rail、live voice、归档）。
> 依据：`docs/command/08-迁移与收敛.md` §7.3 推荐「合进来再重构」（乙方案）。本合并落地后，`main` ← `niko` 为快进。
> 本登记为补写。重放时发现 `271cb3c` 按原样提交**无法编译**，且有多处静默丢失；修复与本登记在同一提交里。

## 1. 这次合了什么

- **对方（main）带来的**：`agent-activity` / ActivityRail / AgentActivityLog 重写；presence、CharacterRail（删除 `RightSidebar`）；live voice（`routes/live.ts`、`live-session.ts`）；`declared-actions.ts` 的 main 版重写（Niko 功能迁移）；D10 舞台与物理；`world-editions` 工具与测试；`.agents/skills` 决策技能组；C1 世界命令设计文档。
- **我方（niko）带来的**：七海本机 TTS 与设置面板（`aad5bf3`）；同槽多份材料 `maxItems`（`bb4511f`）；`runDeclaredRoll` 骰子奖励与百分骰；七组英日双语模板与 `pre-bilingual-2026-09-14` 归档；Holmes 提交反馈；DeepSeek 配置。
- **两侧同时改的**：176 个冲突文件——代码 61、文档 43、模板/归档 72。代码里约一半整份取 main，其余是两侧混合；模板/归档里取 main 33、取 niko 6、删除 4、混合 29。

## 2. 冲突处理

### 2.1 原合并的结构决策（重放 `aad5bf3` + `65fa09d` 后观察到的）

- **代码外壳取 main**：`declared-actions.ts`、`provider-config.ts`、D10 三件套、`agent-activity.ts`、`ime.ts`、`play-hints.ts`、`item-action-draft.ts`、`writer-beat-guard.ts`、`world-editions.mjs`/测试、`DeclaredActionDialog.tsx`、`WriterResult.tsx` 等整份取 main——main 已在 `1ddb7e0` 以自己的形状重写了这些 niko 功能。
- **UI 混合**：`App.tsx`、`Canvas.tsx`、`CharacterModal.tsx`、`NookView.tsx`、`EntityInteractions.tsx`、`TtsSettings.tsx`、`useWorld.ts`、`messages.json` 等两侧混合，以 main 外壳为主。
- **内容取 niko**：现行 `templates/*` 按 niko 的双语版本（英文路径，如 `world/london-map/...`），firstsnow 进入归档。

### 2.2 合并后修复（本次实施）

| 文件 | 两侧各是什么 / 原合并结果 | 裁决 | 理由 |
|---|---|---|---|
| `apps/server/src/engine/launch.ts`、`routes/world.ts` | 两侧 import 行都保留 → 重复标识符，server 编译失败 | 去重 | 机械 |
| `apps/server/src/engine/declared-actions.ts` | 整份取 main，niko 的 `runDeclaredRoll`（骰子奖励）与 `maxItems` 消失；`/api/dice` 仍调用 `runDeclaredRoll` | 保留 main 实现；补回 `runDeclaredRoll`/`outcomes()` 作兼容垫片；补回 `maxItems`、槽容量校验、选择上限 12 | 08 §7.3「合进来之后不删、不改功能」；`dice-rewards`、`material-review` 测试 |
| `routes/world.ts` `/choice`、`/material-review` | niko：`/choice` 回填 `world`，`/material-review` 世界不符返回 409；main：无此校验，响应为嵌套 `{ ok, details }` | 补回回填与 409；响应改走 `reply()` 平铺 | 防止换世界后旧面板串档；`docs/wiring/00` §6 响应体为 `{ ok, ...details }`，前端 `actionDetailsOf` 两种形状都读 |
| `EntityInteractions.tsx`、`DeclaredActionDialog.tsx` | main 版一槽一件，请求体没有 `world` | 补回 `world` 字段与同槽多份（`slotCapacity`、逐件移除）；删除没人传的 `inline` 残留 | 与服务端、`check:bodies` 的 5 键契约一致 |
| `overlay/CharacterModal.tsx` | 取 main 版，`/api/tts` 请求体丢了 `characterId`/`emotion` | 补回两键和本机回落告警 | `check:bodies` 5 键契约；本机音色路由依赖 `characterId` |
| `routes/tts.ts` | 混合后保留 main 的清洗与步骤编号，丢了 niko 的 `local-tts` import 与「七海本机优先」分支，`readLocalTtsConfig` 引用悬空，server 编译失败 | 在 main 版上补回 import 与本机分支（放在缓存查找之前） | 8 项本机 TTS 测试在 niko 侧通过、合并后失败 |
| `routes/connection-settings.ts` | 字段表取 main 那一行，丢了 niko 的 4 个 `AIRP_TTS_LOCAL_*` 字段，七海本机配置存不进去 | 补回 4 个字段 | `local-tts-settings` 测试在 niko 侧通过、合并后失败 |
| `extensions/tools.ts` | `writer-beat-guard.ts` 整份取 main（只导出 `registerWriterToolCallGuard`），但 `tools.ts` 两侧的 import 与调用都保留，作家加载扩展即报错、反复重启，`/api/agent-settings` 返回 503 | 删除 niko 的 `registerWriterBeatGuard` import 与调用，只保留 main 的工具调用上限 | 引擎以 main 为准（niko 裁定）；main 文件头写明有意去掉「一轮一张 Chalk」等限制，因为会挡住场景初始化。浏览器冒烟时发现，单元测试不加载扩展所以没抓到 |
| `apps/web/src/prototype.css` | main `ed71622` 给 Canvas 包了一层 `data-airp-projection`，`.prototype-world > .relative:first-child` 不再命中，包装层高度为 0，画布整块被裁掉 | 同一条规则加上 `> [data-airp-projection]` | main 侧已有的缺陷，不是本次合并引入；浏览器冒烟时 A/B 验证 |
| `scene-shell.css` 深度层 | main 的空 overlay 层（z=30）和挂在世界层之后的氛围粒子层都铺满画布、接收鼠标事件，卡片收不到悬停与点击 | overlay 层与 `[data-depth-surface="background"]` 设为 `pointer-events: none` | main 侧已有缺陷；两层只放展示内容 |
| `prototype.css` 暮色可读性 | main 的 token 化删掉了 niko 全部 `is-dusk` 规则，板书、右上角标题、悬停浮层在暗色照片上看不清；`prototype-vignette` 没有样式 | 用 main token 补回 niko 的板书、标题、悬停浮层、暗角规则；纸色卡片保持 main 设计 | niko 裁定「之前没有这个问题」 |
| `apps/web/src/main.tsx` | `unlockOnFirstInteraction()` 三边都没人调用，只有画布按下或打开对话框才解锁 AudioContext，BGM 一直静音 | 入口调用一次 | 浏览器实测：点击后 AudioContext 变为 running，主题曲播放 |
| `narrative/EntityInteractions.tsx` | 浮层参照容器找 `[aria-label="Infinite canvas"]`，三边都已不存在，退回到随相机移动的世界层，`max-height` 被算小、浮层截断 | 改用 `.depth-surface--world`（画布根） | 三边都有的潜在缺陷 |
| `apps/web/src/App.tsx` `readme` | main 的覆盖层放行用 `manifest && state && readme` 判世界就绪，但 `readme` 只在 `state.items` 里找，而 `/api/layer` 把本层 README 放在 `scene`；所有子场景都判为未就绪，角色对话与掷骰被拒（"The world is unavailable"） | `readme` 先取 `state.scene`，再退回 `items` | main 侧已有缺陷；浏览器实测进入角色对话、TTS 连通 |
| `apps/web/src/lib/audio.ts` 语音起音 | 混合时保留了 niko 的 `attack` 参数与 `VOICE_ATTACK`，但语音 `playClip` 调用丢了第五个参数，退回 1.5s 音乐淡入，台词开头被吞；niko 的对应测试随 `audio-volume.test.mjs` 取 main 一并丢失 | 补回 `VOICE_ATTACK` 参数，并从 niko 移植回测试 | niko 反馈 TTS 开头被吞、有渐入 |
| `TtsSettings.tsx` | 取 main 版，`NanamiTtsSettings` 不再挂载；`refresh` 残留 niko 的 `setHasError` | 挂回七海面板；`refresh` 用 main 的 `setError` | 组件还在、消费端没了，是合丢了一半 |
| `lib/messages.json` | 冲突解决丢了 niko 独有的 68 个键 | 补回现有代码仍在用的 37 键，加上 stash 里七海角色音色在途的 8 键；其余 31 键所属 UI 已被 main 替换，不补 | `check:i18n` 两个父提交都绿、合并后变红 |
| App、WriterBar、ChalkCard、NookView、phantom-seat、DiceCeremony、Canvas、BagItemDialog、`dice-preview.tsx` | 混合时丢了声明或 import，web 有 31 个 TS 错误 | 逐个补回来源侧的声明；Canvas 补回 niko 的悬停聚焦肖像 | 机械 |
| `components/AgentActivity.tsx` | niko 独有、无引用，依赖的 API 已被 main 重写 | 删除 | main 的 ActivityRail / AgentActivityLog 已替代 |
| `tools/experiences/holmes.mjs` | main 短版和 niko 长版首尾相接，模板字符串没闭合 | 整份取 niko | 现行 whitechapel 模板和 `holmes-playtest` 都按 niko 路径 |
| `tools/install-experiences.mjs` | 丢了 `nookProfilePaths` 的 import | 补回 | 三个测试 ReferenceError |
| `archive/.../whitechapel-playtest/characters/watson/preset.json` | 两个父提交一致（`characters/watson`），合并结果写成 `characters/silver-kite` | 取父提交 | 串世界 |
| `archive/.../firstsnow/**`（14 份） | niko 已把 firstsnow 归档；目录改名检测把 main 的现行模板内容盖进了归档 | 从 niko 归档恢复 | 归档是冻结快照 |
| `declared-action-web`、`writer-result-placement`、`markdown-presence` 测试 | 断言 main 的旧形状，或 niko 的单行正则 | 按合并后形状更新（`world`、同槽多份、跨行 `WriterResult`、MarkdownText 接受 `narrative`） | 保留测试原本要保护的意图 |

**静默丢失自查**：

- **连接面**：`check:ws` / `check:bodies` / `check:i18n` / `check:voices` / `check:docs` 全绿。
- **删除**：`RightSidebar.tsx`（main 有意删除，有测试断言它不存在）；`docs/TTS设置面板.md` 等 3 份文档（niko 在 `e4a139a` 移走）；`templates/whitechapel/characters/porter/memory.md`（niko 改、main 删，保留删除，`world.json` 已没有 porter）。
- **新增**：归档里多出 27 份 firstsnow 文件，是 main 在分叉点之后新增、被改名检测带进归档的；全部已存在于 `templates/first-snow`，没有丢，留在原处未动。

### 2.3 待裁决（按要求只登记、不改）

| # | 分歧 | 受影响测试 |
|---|---|---|
| 1 | 英文初雪版的 id：niko 的模板是 `templates/first-snow`（id `first-snow`）；main 的 `tools/world-editions.mjs`、`check-world-editions.mjs`、`world-editions.test.mjs`、`preset-slots.test.mjs` 用 `firstsnow`；另有一份残留 `templates/firstsnow/skills/first-snow-play/SKILL.md` | 世界书架只含成对模板、新建英日存档、十四个版本保全、05 §3.3 预设槽 |
| 2 | 小天地卡片：main 的 `nookCardPaths` 把角色根配置排除在卡片外；niko 的 `NOOK_FIELDS` 把 identity/relationships 等当卡片 | 13 项 `character-nooks` |
| 3 | 小天地入口：niko 在 App 里有 `resident-actions` 和 `airp_init kind: 'nook'`；main 用 CharacterRail + NookView `onRequestInit` | `choice-draft-ui` 小天地入口 |
| 4 | 选项点击传值：`fm.tsx` 里 niko 传 `choice.label`，main 传 `choice.id ?? choice.label` | `hover-actions` 画布契约 |
| 5 | 内容：wuwu Chalk 契约（`expect ">=7"`、灯油损失、介绍信、`revealState`）、六世界收尾（`tonight-letter`）、whitechapel 骰型（niko 的 `1d100` 对 main 的 `2d10`） | `wuwu-chalk-contract` 4 项、`six-world-experiences` 2 项 |

## 3. 验证

```bash
pnpm build                                   # → PASS（原 271cb3c：server、web 均编译失败）
pnpm check:ws && pnpm check:bodies           # → PASS / PASS（11 条路由）
pnpm check:i18n && pnpm check:voices         # → PASS（183 键）/ PASS
pnpm check:docs                              # → PASS
node --test apps/server/test/*.test.mjs apps/web/test/*.test.mjs \
  packages/shared/test/*.test.mjs tools/*.test.mjs   # → 1032 项：1000 通过 / 32 失败
pnpm check:merge                             # → PASS
```

- **验证环境**：以上结果都在干净 worktree（只含提交内容，不含工作区在途改动）里跑出；`vendor/pi-rp` 链接到主工作区的子模块，它比已提交的子模块指针新一点。
- **比对基线**：在临时 worktree 对两个父提交跑同一套测试（该 worktree 缺 `vendor/pi-rp` 产物，server 编译失败，失败数只作参照）：`65fa09d` 923 项中 729 通过、12 失败；`aad5bf3` 740 项中 618 通过、39 失败。原 `271cb3c` 修好编译后首轮 40 项失败；修复后 32 项，没有新增失败。
- **32 项失败的归属**：
  - 25 项是 §2.3 的待裁决分歧（初雪命名 4、小天地卡片 13、小天地入口 1、选项传值 1、内容 6）；
  - 7 项在两个父提交上也失败，不归本次合并：`choice-draft-ui` 带标签草稿、`first-snow-ending-contract` 2 项、`holmes-playtest` 独立图层、`character-nooks` 91 张卡、`nanami-tts-settings` 本地化、`unwritten-door` 作家排队。
- **工作区另有 1 项**：DeepSeek 模型形状测试只在带在途改动 `deepseek-v4-flash` 的工作区里失败，与合并无关。
- **浏览器冒烟**：未做。
- **未决/遗留**：
  - §2.3 五项待裁决；
  - 工作区在途改动（本机角色音色、DeepSeek v4、Vercel 部署）未提交；为让构建通过，给 `tts.ts` 在途代码加了一行 `?? {}`，随在途改动保留，未提交；
  - `main` ← `niko` 的快进和推送，由 niko 决定。
