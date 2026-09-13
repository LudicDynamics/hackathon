# origin/niko 合入 main —— 代码质量审查与修复报告（2026-09-13）

> 明月点名：无脑合并会带进 bug，要系统清点 niko 侧代码质量、对照 main 的冻结契约；
> 特别指出 `docs/footprint/`、`docs/wiring/` 是 main 迭代的真相源。
> 做法：6 个只读 scout 按模块并行清点 → 汇总定级 → 主代理逐条实测复现 → 修复 → 全量验证。

分叉点 `3ccff23`；main 侧 `de85b0b`；niko 侧 `origin/niko`；merge `813c0f3`。
修复 commits：`8f77799`（13 处回归）、`c7db908`（4 处收尾 + 门禁 + 文档）、
`0032d58`（Esc 返回）、`22675c8`（Take 按钮）。

---

## 1. 你报的「拖拽松手后闪现」——根因与修复

**根因**：`Canvas.tsx` 的 `frame()` effect（niko 新增）在首帧把卡按
`separateBounds` **重排并回写 x/y**（`onMoveCard` → `POST /api/card/position`），
这是**第三处碰撞真相源**（违反 `docs/footprint/00 §5.1` / `AGENTS §7.5` 第 7 条）。
它与拖拽松手的 `relaxAll`（main 的既定 2D 松弛）布局不一致，于是**首次拖拽
松手瞬间整层跳位**——实测四张卡同时跳，连未被推挤、远处的 `harbor-chart`
也从 1120,608 跳到 1242,624。

**因果 A/B 验证**（同一棵树、同一拖拽脚本、清空 `canvas.db`）：

| `frame()` | mouseup 后 `guild-license.offsetTop` |
|---|---|
| 启用 | 350 → 207（跳） |
| 禁用 | 恒定 350（不跳） |

**修复**：该 effect 只保留 `camera.flyTo` 取景，删掉位置重写与持久化，并改走
`whenFontsSettled()`（原用裸 `document.fonts.ready`，`docs/footprint §3.5` 明禁）。
修后实测：松手后**只有被拖的卡**响应碰撞，其余零位移。

> 教训：我最初怀疑是 `CanvasObject` 的 hover 走 React state（§7.6②），A/B 后
> 证明**不是**。第一直觉不可信，要 A/B。

---

## 2. 已修回归清单

### 2.1 第一批 `8f77799`（13 处）

| 严重度 | 位置 | 问题 |
|---|---|---|
| BLOCKER | `airp-gateway.ts` | `godAction` 发 `filePath`、`useItem` 发 `itemPath/targetPath`，服务端读 `path`/`item,target` → 道具拖拽与径向造物**静默 400**（curl 复现：gateway 形状 400 / 服务端形状 200） |
| BLOCKER | `CanvasObject.tsx` | chalk 被移出 `0deg` 白名单 → 叙事板带随机倾斜（§7.5③，三 agent 独立报） |
| BLOCKER | `ChalkCard.tsx` | widgets 全搬进 hover 浮层，但**场景入口 Chalk 渲染在 `.object` 之外、没有该浮层** → 子场景 README 的 choice/status/roll_dice 全失 |
| BLOCKER | `CanvasObject.tsx` | `reading` 态把卡宽改成 `max(item.w,500)` → 第四处碰撞权威 + 测量污染 |
| BLOCKER | `footprint.ts` | 膨胀态未被测量门禁覆盖（契约 §3.5） |
| MAJOR | `Canvas.tsx` | `effectsEnabled` 连 `ParticleLayer` 一起卸载 → fireworks 演出不可见（perform/05 §4.4） |
| MAJOR | `App.tsx` | 作家输入条丢 writing 锁，Enter 会排进作家 |
| MAJOR | `App.tsx` | `scene={null}` → `SceneChalk` 永久空转 |
| MAJOR | `scene-shell.css` | `.object:hover{z-index:1000}` 压过拖拽的 40（§7.5⑥） |
| MAJOR | `event-bridge.ts` | `stopReason:'aborted'`（点 Stop）被当错误帧弹红字 |
| MAJOR | `chalk-anchor.ts` | 锚线在 `pointermove` 上做 4 次 `offset*` 读（§7.6③） |
| MAJOR | `useWorld.ts` | 生图等待床 `setAmbient('rain')` 永不归还（perform/03 §3.1） |
| MAJOR | `world-context.ts` + `init-command.ts` | init 子代理原生 write 触发 fallback 落一条 `layer_initialized`，命令 step6 又落一条 → **`probe:init` 红** |

### 2.2 第二批 `c7db908`（4 处收尾）

- **`check-request-bodies.mjs` 门禁盲区（根因级）**：它只认内联
  `fetch(...JSON.stringify)`，gateway 的 `json('POST',{...})` 形状**四条路由全扫
  不到**（`bodyKeysFor` 返回 null）——这正是两条活 BLOCKER 能静默进 main 的机械
  原因。补识别 + 钉 7 条路由。**反向验证**：把 `godAction` 改回 `filePath`，
  门禁立刻 KEY-DRIFT（exit 1）。
- **`local-store.ts` `moveFile` 绝不覆盖**：main 用裸 `rename`（覆盖语义），niko
  改排他 `link`+`unlink` 并加测试断言 `EEXIST`。我一度按审查建议回退到裸
  `rename`，**测试立刻红**（ENOENT vs EEXIST）——查 `docs/tools/04` 步骤 3
  「目标已存在 → `already_exists`（**绝不覆盖**）」且点名批评 rename 的覆盖语义，
  才确认**排他才是契约**。最终 = 显式 `statKind` 守卫 + 单次 `rename`。
- **`model-preferences.ts`**：非法值直进 CLI argv（可让 pi-rp `findInitialModel`
  `process.exit(1)` 烧掉 lifecycle 退避）→ 加 schema 校验、fail-soft。
- 删死模块 `effects-clock.mjs`（+测试+类型+`AGENTS` 目录表引用；连带修
  `docs/ui/UI验收清单.md` 一条指向已删测试的命令）。
- 文档回写：`AGENTS §5.1`（`--model` 断言已假）、`§7.5` 新增第 8 条（取景 effect
  只许动相机）、`docs/footprint §3.5`（登记 `isInflated` 谓词）。

### 2.3 你问的「niko 漏的 main 前端功能」

| 功能 | 状态 | 处置 |
|---|---|---|
| **Esc 返回上层** | niko 的 Esc 只关浮层，**不再返回上层**（而 HintBar 文案承诺 "Alt+← / Esc to return"） | **已修** `0032d58`；实测进子层后 Esc 从「Fogwharf · Harbor Chart」回「Map」 |
| **便携卡「Take」按钮** | App 少传 `onTakeItem` → `portable:true` 的卡按钮被条件挡掉（整条链 Canvas→CanvasObject→CardRenderer 都在，只顶层断） | **已修** `22675c8`；实测 `investigator-badge.md` 的 `.note__take` 出现 |
| **Minimap（导航小地图）** | 完全未挂载；niko 外壳无同类 | **待明月定**：main 的 `docs/ui/前端改造计划.md:188` 把 Minimap 列为「已有地基」、T4.6 还规划深化，**不是该丢的**；但它是画布右下角视觉件，niko 用 breadcrumb 导航，恢复位置需按 niko 视觉重排，故不擅自加 |
| **HintBar（操作提示）** | 未挂载 | 待定，同上 |
| **LayerBadge（层徽）** | 未挂载，但 niko 的 `prototype-crumbs` 已承担「当前层」显示 | 视为**已被替代**，非丢失 |
| **RightSidebar 的 follow 开关** | 未挂载 | 非丢失：main 那只是纯本地 state + toast，不落服务端 |

---

## 3. 报告但**不改**的项（需拍板/设计分歧）

1. **`/choice` 与 `/enter-layer` 自动起作家一轮**（服务端 BLOCKER 级）
   —— `routes/world.ts` 的 `dispatch()` 在玩家选项/开门后直接
   `lifecycle.submitWriter(...)`。**违反 `doc-21 §5.5` 硬纪律**「一条事件落库永远
   不触发 agent 的一轮」与 `doc-05 §5.1`「不打断、不自动起 turn」；且 niko 同分支
   新写的 `doc-09` 也写了「路由不强启 Writer」——**代码与文档自相矛盾**。这是玩法
   决策（开门即生成），非解冲突所能定，故登记。
2. **EntityInteractions 的 hover 强制布局**（MAJOR）：hover 开浮层时对全层每张卡做
   `getBoundingClientRect`，且挂在 wheel 高频事件上（§7.6②/③ 同族）。是 niko 的新
   交互，改动有布局回归风险，登记待评。
3. `performances.ts` 那 1 行删除 = **文件末尾空行**（`git diff -w` 为空），无影响。

---

## 4. 验证（全部实跑）

- `pnpm build` ✓；`pnpm test` **605/605** ✓（少 4 条 = 删掉的 dead-module 测试）
- `probe` / `probe:tools` / `probe:inject` / `probe:prompt` / **`probe:init`** /
  `typecheck:extensions` 全 PASSED
- `check:ws` / `check:bodies` / `check:docs` / `check:skills` / `check:voices` 全绿
- 浏览器冒烟（真 Chromium + 真 server）：拖拽松手不跳层、chalk 恒 0deg、场景入口
  Chalk 带互动组件、便携卡有 Take 按钮、Esc 从子层回 map、作家输入条忙时禁用

---

## 5. 方法论教训（写给自己）

1. **冲突块数 ≠ 工作量**：9 文件 / 18 块，但 `App.tsx`、`CanvasObject.tsx` 是
   「两套演进」的结构性融合。判据是**两侧分叉后各自的增量**。
2. **A/B 是唯一硬判据**：闪现我先猜错（hover state），A/B 才定位到 `frame()`。
3. **测试红了先怀疑"谁对"**：`moveFile` 回退到 main 的裸 rename 让 niko 的测试红，
   而**测试才是对的**（docs 明确要排他）。合并里 "main 的版本" 未必是真相。
4. **门禁盲区要主动堵**：两条活 BLOCKER 能进 main，是因为门禁看不见 gateway 的
   封装形状。修完 bug 要问「门禁为什么没抓到」，然后**反向验证**门禁真能抓。
5. **子代理只读清点 + 主代理实测复现**：scout 给的 `file:line` 是线索不是结论，
   每条 BLOCKER 都由主代理 curl/浏览器复现过。
