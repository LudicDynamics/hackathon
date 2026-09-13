# docs/audio/04 Foley 与 stinger 触发

> A1「音频接线」批次子文档之一。MUST 先读 `docs/audio/00-共同上下文.md`（冻结契约）。
> 本文只写**触发点接线**（既有 foley 调用点核对、`page-turn` 落点、`[emo:]` → stinger）；
> `lib/audio.ts` 的引擎内部实现归 `02`，前端状态贯通归 `03`，素材声明/缺口归 `05`。

---

## 1. 一句话定位

**本文把「游戏里已经在响的 9 个交互声」逐条核实成 `file:line`，并新增一条 `[emo:] → playStinger(emo)` 的瞬时情绪音接线（绝不碰 BGM 主轨）。**

范围边界（写死，防越界）：

| 属本文 | 不属本文（指向） |
|---|---|
| 9 条既有 `playFoley` 调用点的核实与素材对应 | `FoleyName` 联合类型的定义（`02`） |
| `page-turn` 调用点定位（或如实判为不存在） | 采样链 / decode 缓存 / failCached（`02`） |
| `CharacterModal.tsx` 的 `playStinger(mood)` 接线 | `playStinger` 的引擎实现（`02`） |
| `Emotion` 类型归属决策 | `useAudio` surface 扩展（`03`） |
| stinger 素材缺口（仅登记，细节交 `05`） | README 声明方案 / 5 世界缺口（`05`） |

---

## 2. 签名 / 参数 / 类型

本文**不新增任何导出符号**。引用的符号唯一定义处：

```ts
// ── 定义处：apps/web/src/lib/audio.ts（owner = 02） ──
export type FoleyName =
  | 'paper-slide' | 'bag-pack' | 'dice-roll' | 'unlock' | 'pen-scratch'
  | 'gate-open' | 'crit-chime' | 'fumble-break'
  | 'page-turn';                                    // NEW（02 加；素材已存在）
export type Emotion = 'normal' | 'smile' | 'shock' | 'sad' | 'angry' | 'thinking'; // 契约 §5.1

/** 瞬时情绪 sting：与主轨正交，播完即止。Emotion 是封闭联合，无 null 态。 */
export function playStinger(emo: Emotion): void;     // NEW（02 实现）

/** 既有，签名冻结；语义扩展为「采样优先 → 合成兜底」（02）。 */
export function playFoley(name: FoleyName, intensity?: number): void;
```

**调用点只做「传参 + 触发」，不做任何解析、不做 fetch、不碰 URL。**
URL 解析全在服务端（`01`）；采样/缓存全在引擎（`02`）。

---

## 3. 行为契约逐步

### 3.1 既有 foley 调用链（核对，不新增）

每一步 = 一次 `playFoley(name)` 调用：

1. **拖拽移动中** → `Canvas.tsx:256` `playFoley('paper-slide', Math.min(1, spd / 2))`
   - 节流：仅当距上次 ≥ 80ms（`Canvas.tsx:253` `now - slide.t >= 80`）；`intensity` 随指针瞬时速度线性缩放。
   - **漏了会怎样**：拖拽全程无声，纸感消失；但节流一旦被删会变成每帧一次 → 声爆。
2. **拖拽落定** → `Canvas.tsx:310` `playFoley('bag-pack')`（`settleDrag` 内，`persist && s.moved` 才响）
   - **漏了会怎样**：卡片落下没有「落袋」重音，交互缺闭合感；条件 `persist && s.moved` 若丢，取消拖拽/N 击也响。
3. **右键开径向菜单** → `Canvas.tsx:403` `playFoley('paper-slide', 0.8)`
   - 在 `handleContextMenu` 里，`onOpenRadialMenu?.(...)`（`:404`）之前。
   - **漏了会怎样**：菜单弹出无声。
4. **掷骰开始** → `DiceRoller.tsx:142` `playFoley('dice-roll')`（`rollDie` 内，tween 启动后）
   - **漏了会怎样**：骰子翻滚无哗啦声，只剩视觉。
5. **掷骰结算**（`settleIfReady`，`DiceRoller.tsx:113`）
   - 大成功（`passed && result >= 95`）→ `:123` `playFoley('crit-chime')`
   - 大失败（`!passed && result <= 5`）→ `:126` `playFoley('fumble-break')`
   - 其余 → 无声（`setEffect(null)`，`:128`）
   - **漏了会怎样**：掷骰结果失去听觉落差。注意：**「落定」与「结果」是同一处**（`settleIfReady` 一次性 fire），合并了 cube tween 与服务端 verdict 两条时序（`DiceRoller.tsx:113-116`）。
6. **径向菜单创建提交** → `RadialMenu.tsx:105` `playFoley('pen-scratch')`（`handleSubmit` 内，`onCreate` 前）
   - **漏了会怎样**：新建卡片无「落笔」声。
7. **径向菜单选类型** → `RadialMenu.tsx:179` `playFoley('paper-slide', 0.6)`（卫星按钮 `onClick`）
   - **漏了会怎样**：选类型无反馈。
8. **物件拖到目标上** → `CardRenderer.tsx:115` `playFoley('unlock')`（`handleTargetDrop` 内）
   - **这条就是 `use_item_on` 的听觉反馈**（见 §8 冲突 2）。
   - **漏了会怎样**：拖物件到目标上只有 toast 和 CSS burst（`:116`），听觉上「没解锁成」。

### 3.2 `[emo:] → playStinger`

`CharacterModal.tsx` 的 `streamLine(fullText, mood)`（定义 `:95-96`）分两拍：

```text
第 1 拍（:101）  setEmo('thinking')          # 思考态，无声
      ↓ thinkMs = 100–400ms（:103）
第 2 拍（:106）  setEmo(mood)                # 立绘切到真实情绪
                 playStinger(mood)           # ← NEW：与 setEmo 同一 tick
```

1. **情绪切换瞬间**：在 `CharacterModal.tsx:106` `setEmo(mood)` 之后**紧邻**插入 `playStinger(mood)`。
2. **时序**：**立绘切换与 stinger 同 tick 触发**（先 `setEmo(mood)` 再 `playStinger(mood)`，同一同步块内，React 批处理下用户无感先后）。
   - 依据：`[emo:]` 是「这句台词的表演」（`extensions/instructions.ts:45`：*"At the very start of every line of dialogue"*），stinger 应贴住「台词开始显现」这一刻，而非 `thinking` 态。
3. **绝不 `setBGM`**（契约 §6.2 / 反模式 1）：`[emo:]` 只做瞬时 sting，`< 1.5s`，播完即止；主轨 `bgm` 由层 README 声明驱动（`03`）。
   - **漏了会怎样**：若误接 `setBGM`，每次对话都会把整张场景配乐切走 → 违反 galgame 惯例，且与层 BGM 打架。
4. **上下文未解锁时**：`ctx.state !== 'running'` → `playStinger` **drop（no-op，不排队）**（已与 `02` 对齐，见 `02` §3/§6）。
   - **漏了会怎样**：若照契约 §7 的「挂起后补播」，会在 `unlock()` 时刻补一个与当时情绪无关的错拍 sting。
5. **素材缺失时**：`playStinger` 静默 no-op（引擎 failCached），**不影响主轨**（契约 §6.2）。
   - **注意**：stinger **没有合成兜底**——引擎的合成器只实现了 8 条 foley 声（`audio.ts:475-569`），没有 stinger 声源。故 §7 的「素材失败 → 合成器顶上」**不适用于 stinger**（见 §7）。

---

## 4. 文件与副作用

| 文件 | 行 | 现状 / 改动 | 副作用 |
|---|---|---|---|
| `apps/web/src/components/canvas/Canvas.tsx` | `:9` | `import { unlock, playFoley }` | 无改动 |
| | `:256` | `playFoley('paper-slide', …)` | 已存在 |
| | `:310` | `playFoley('bag-pack')` | 已存在 |
| | `:403` | `playFoley('paper-slide', 0.8)` | 已存在（菜单开，见 §8 冲突 1） |
| `apps/web/src/components/narrative/DiceRoller.tsx` | `:123/:126/:142` | `crit-chime` / `fumble-break` / `dice-roll` | 已存在 |
| `apps/web/src/components/god/RadialMenu.tsx` | `:105/:179` | `pen-scratch` / `paper-slide` | 已存在 |
| `apps/web/src/components/canvas/CardRenderer.tsx` | `:115` | `playFoley('unlock')` | 已存在（`use_item_on` 反馈，见 §8 冲突 2） |
| | `:200` / `:249` | letter 模态开/关 | **候选** `page-turn` 落点（§7.2，未拍板） |
| `apps/web/src/components/overlay/CharacterModal.tsx` | `:27` | 本地 `type Emotion` | **删除**，改 import（§7.1/§7.4） |
| | `:106` | `setEmo(mood)` | **其后加** `playStinger(mood)` |
| `apps/web/src/App.tsx` | `:157-178` | `handleItemDropOnTarget`（`/api/use-item`） | **无 foley、无需改**（反馈在 `CardRenderer:115`） |

**零 WS、零落盘、零 HTTP（调用点侧）**：所有触发都是本地 WebAudio 一次性发声，不产生世界事件。
（与 `01`/`03` 的落账链路正交；foley 不进 `events` 表。）
**注意**：`playStinger(emo)` 的**素材 URL 由 `02` 引擎内部构造**（`/api/audio?path=stinger%2F<emo>.mp3`），
**本文的调用点只传 `emo`，不拼 URL、不做解析**（评审裁定，见 §10）。

---

## 5. 落账 / WS 联动

**无。**

- `playFoley` / `playStinger` 是纯前端 WebAudio 调用，不写 `canvas.db` / `history.db`，不发 WS 帧。
- 触发它们的**世界动作**（拖卡落定、掷骰、use_item_on）各自已有落账链路（B1 批次：`roll_resolved` / `use_item_on` / `entity_moved`），与声音**无关**、不耦合。
- 声音失败**不得**影响动作落账（声音是旁路，不是事务一环）。

---

## 6. 错误边界

| 场景 | 行为 | 依据 |
|---|---|---|
| `playFoley` 传入非 `FoleyName` 字符串 | **编译期**拒绝（封闭联合），无运行期路径 | `audio.ts:15-23` |
| `playStinger` 传入非 `Emotion` | 同上（`Emotion` 封闭联合，无 `null`） | 契约 §5.1 |
| 音频上下文未解锁 / 未 running | `playFoley` 短路 no-op（`if (!initAudio() \|\| !master) return`，`audio.ts:469`）；`playStinger` **drop**（不排队） | `audio.ts:469`；`02` §3 |
| stinger 素材 fetch/decode 失败 | 静默 no-op + failCached；**无合成兜底**（引擎无 stinger 声源） | `audio.ts:475-569` 无对应 case |
| foley 素材失败 | 回落合成引擎（合成代码 MUST 保留，契约 §5.2） | `audio.ts:468-570` |
| 同一 tick 多声叠加（如落定 + 结果） | 允许叠加；`playStinger` 纯叠加、不淡出主轨 | 契约 §5.3 |

**关键**：stinger 与 foley 的降级**不对称**——foley 有合成兜底，stinger 没有。这是 `02` 必须显式声明的差异，不可默认。

---

## 7. 代码落点（精确到文件与函数名）

### 7.1 `[emo:] → playStinger`（唯一新增接线）

**文件**：`apps/web/src/components/overlay/CharacterModal.tsx`

```ts
// 顶部 import 区（:1-2 附近）新增：
import { playStinger } from '../../lib/audio.js';
import type { Emotion } from '../../lib/audio.js';   // 取代 :27 的本地定义

// :27 删除本地 `type Emotion = …`；:29 的 EMO_TAGS 保留（仍用于 :54 的白名单校验）。

// streamLine 内（原 :106 附近）：
      streamTimer.current = window.setTimeout(() => {
        setPhase('streaming');
        setEmo(mood);
        playStinger(mood);          // ← 新增：与立绘同 tick，绝不 setBGM
        let i = 0;
```

- **不碰 URL**：只传 `playStinger(mood)`；`/api/audio?path=stinger%2F<emo>.mp3` 的构造归 `02`（见 §4/§10）。
- 作用域：`streamLine`（`CharacterModal.tsx:95`）是**唯一** `setEmo(mood)` 处（`:101` 的 `setEmo('thinking')` 是另一处、不发声）。
- 不新增函数、不加 effect、不加 state。

### 7.2 `page-turn` 落点 —— **如实：当前不存在翻页交互**

定性结论：**`letter` 第二层模态（`CardRenderer.tsx:196-259`）是单页阅读层，没有任何分页/翻页结构。**

- 该模态是「点击信件 → 打开浮层 → 读全文 → 收起」：`onClick={() => setLetterOpen(true)}`（`:200`）；浮层内容一次性渲染 `frontmatter.body || body`（`:240`）；关闭为「Fold & Put Away」按钮（`:249`）与遮罩点按（`:227`）。
- doc-10 E9 的**翻页语义属于 `book`（`secondLayer: 'pages'`）**，见 `docs/protocols/doc-10-组件协议与官方组件清单.md:766`（`book` 行：*"有页。允许：翻页（二级层分页）"*）与 `:914`。**`book` 组件在前端尚未实现**：`apps/web/src/components/` 下无 `DetailPanel.tsx`、无分页渲染器（`glob` 全目录仅 `ChalkCard/DiceRoller/RadialMenu/…`）。
- **所以 `page-turn` 没有精确落点。本文不编造。**

**给评审的候选落点**（若坚持本批接线，二选一；均为语义近似，非真翻页）：

| 候选 | `file:line` | 语义 | 评估 |
|---|---|---|---|
| A. letter 打开 | `CardRenderer.tsx:200`（`setLetterOpen(true)`） | 「展开一张纸页」 | 与既有 `paper-slide` 语义重叠；单页信 ≠ 书页，诚实说**偏牵强** |
| B. letter 收起 | `CardRenderer.tsx:249`（关闭按钮） | 「把纸页折起来」 | 同上 |

**本文建议（待拍板，§11 未决 1）**：**本批不接线**，`FoleyName` 保留 `'page-turn'`（素材已存在、类型免费），与 `'gate-open'` 一样先做「已声明、未接线」；等 `book`/`pages` 二级层落地时再在分页翻页处接线。理由：为一个不存在的交互硬找落点 = 制造「有声但没发生事」的假反馈。

### 7.3 既有 9 条：**不改**（契约 §6.1「核对，不新增」）

不改 `Canvas.tsx` / `DiceRoller.tsx` / `RadialMenu.tsx` / `CardRenderer.tsx:115` 任何调用。

### 7.4 `Emotion` 类型归属 —— **决策：提升到 `lib/audio.ts`，删除本地定义**

- **决策**：`Emotion` MUST 定义在 `apps/web/src/lib/audio.ts` 并 `export`（由 `02` 落），`CharacterModal.tsx` 改为 `import type`。
- **依据（非过度设计，是契约强制）**：契约 §5.1 已冻结 `export type Emotion` 属于 `audio.ts` 的 surface（`playStinger(emo: Emotion)` 的形参类型必须与调用方同源）。`audio.ts` 已是 `FoleyName` / `BGMood` 的家，类型内聚于此是**最小正确位置**。
- **不上升 `packages/shared`**：`Emotion` 只服务前端渲染层（CSS class `emo-*`，`index.css:382-411`）与 WebAudio，**无跨进程消费者**；`extensions/instructions.ts:45` 的 emo 清单是**自然语言提示词字符串**，不是 TS 类型，共享化无收益（反成耦合）。
- **落地**：`CharacterModal.tsx` 删 `:27`，`:29 EMO_TAGS` 保留，`:53` 的 `as Emotion` 与 `:54` 的白名单校验不变。

---

## 8. 与现状差异（带 `file:line`）

| # | 契约 / 任务书写 | 现状实测 | 判定 |
|---|---|---|---|
| 1 | 契约 §6.1 表：`RadialMenu.tsx :105` = **菜单开** | `RadialMenu.tsx:105` 实为 `playFoley('pen-scratch')`（`handleSubmit` 创建提交）；**菜单开**在 `Canvas.tsx:403` `playFoley('paper-slide', 0.8)` | **§6.1 行号/事件错配**（见 §10 冲突 1） |
| 2 | 契约 §6.1 表：`use-item.ts` — 使用道具 | **该文件不存在**（`find apps -name '*use-item*'` 零命中）。`use_item_on` 走 `App.tsx:157-178` `handleItemDropOnTarget` → `POST /api/use-item`，**该函数内无 `playFoley`**；其听觉反馈实际来自 `CardRenderer.tsx:115`（拖到目标上时 `unlock`） | **§6.1 文件名错 + 反馈点在别处**（见 §10 冲突 2） |
| 3 | 契约 §6.2：`setEmo(mood)` 在「`:113`」 | 实测 `setEmo(mood)` 在 `CharacterModal.tsx:106`（`streamLine` 定义于 `:95-96`） | **§6.2 行号过期**（见 §10 冲突 3） |
| 4 | 契约 §6.1 计数「9 条」 | 实测 `playFoley` 调用表达式 **9 个**（`Canvas:256/310/403`、`DiceRoller:123/126/142`、`RadialMenu:105/179`、`CardRenderer:115`） | 数量吻合；**分布与表中 file:line 不符** |
| 5 | `gate-open` | 素材存在（`assets/audio/foley/gate-open.mp3`）、`FoleyName` 含之（`audio.ts:21`），但**全仓 0 调用点** | 类型/素材「已声明、未接线」，本批不动 |
| 6 | `page-turn` | 素材存在（`assets/audio/foley/page-turn.mp3`），`FoleyName` **缺**（`audio.ts:15-23` 仅 8 项），且**无翻页交互**（§7.2） | 加类型（`02`）但**无落点**；见 §11 未决 1 |
| 7 | 契约 §6.2 的 stinger 素材路径 `assets/audio/stinger/<emotion>.mp3` | 该目录**不存在**（`ls` 报 No such file）；契约 §2.2 已补 `stinger/` 目录定义（见 §10） | **已消解**：契约 §2.2 补 `stinger/`；素材缺口归 `05` |

**素材对应核对（全部匹配，无缺失、无类型不符）**：

| 调用名 | 素材文件 | 状态 |
|---|---|---|
| `paper-slide` | `assets/audio/foley/paper-slide.mp3` | ✓ |
| `bag-pack` | `assets/audio/foley/bag-pack.mp3` | ✓ |
| `dice-roll` | `assets/audio/foley/dice-roll.mp3` | ✓ |
| `unlock` | `assets/audio/foley/unlock.mp3` | ✓ |
| `pen-scratch` | `assets/audio/foley/pen-scratch.mp3` | ✓ |
| `crit-chime` | `assets/audio/foley/crit-chime.mp3` | ✓ |
| `fumble-break` | `assets/audio/foley/fumble-break.mp3` | ✓ |
| `gate-open` | `assets/audio/foley/gate-open.mp3` | ✓（但 0 调用点） |
| `page-turn` | `assets/audio/foley/page-turn.mp3` | ✓（但无落点） |

（溯源见 `assets/audio/CREDITS.md:64-76`，全部 CC0。）

---

## 9. 验收测试（可执行断言）

> 静态断言先行（验证统一在最后做，本文不执行）。

**A. 调用点集合断言**

```bash
grep -rn "playFoley\|playStinger" apps/web/src --include=*.tsx --include=*.ts
# 期望：playFoley 命中 {Canvas:256,310,403; DiceRoller:123,126,142; RadialMenu:105,179; CardRenderer:115}
#       playStinger 命中 {CharacterModal:<新增行>}
```

**B. `Emotion` 唯一定义断言**

```bash
grep -rn "type Emotion" apps/web/src
# 期望：仅 apps/web/src/lib/audio.ts 一处（CharacterModal.tsx 已改 import）
```

**C. 反模式断言（`[emo:]` 不改主轨）**

```bash
grep -rn "setBGM" apps/web/src
# 期望：仅 lib/audio.ts（定义 + unlock 内默认）；CharacterModal.tsx 零命中
```

**D. 行为断言（浏览器，契约 §7 的可断言处）**

1. 打开角色遮罩 → 发一条消息 → 回复解析出非 `normal` emo → 断言 `audioDebugState().bgm` **前后不变**，且 stinger 轨有活动（sting 已发声）。
2. `[emo: normal]` 行：断言**不打断主轨**（是否发声见 §11 未决 2）。
3. 拖一张卡 → 听到 `paper-slide`；松手 → `bag-pack`；右键空白 → `paper-slide`；径向菜单选类型 → 另一记 `paper-slide`；提交新建 → `pen-scratch`。
4. 掷骰 → `dice-roll`；大成功/大失败 → `crit-chime` / `fumble-break`，普通结果 → 无声。
5. 把背包物件拖到卡上 → `unlock` + toast（`App.tsx:172`）。

**E. 降级断言**

- 删/改坏 `foley/dice-roll.mp3` → 掷骰仍响（合成兜底），`audioDebugState().loaded` 不含该 URL，`console.warn` 带 URL。
- 无 `assets/audio/stinger/*.mp3` 时 → 对话**完全无声但不报错**，`audioDebugState().bgm` 不变。
- 无声手势前触发 stinger（ctx suspended）→ `unlock()` 后**不补播**（drop 语义，`02` §3）。

---

## 10. 发现的冲突 / 需修订的上位文档

> 契约 §0 纪律：发现与上位文档矛盾，**不沉默、不改契约形状**。
> **状态**：本文 §8 复核出的 5 处偏差**已由主 agent 核实并回写入契约**（契约勘误广播）。
> 原「冲突 1/2/3」已消解——契约 §6.1 现为逐条 `grep` 实测过的权威表，与本文 §3.1/§8 逐字一致。
> **契约 §6.1 是权威源，本文 04 是该轮触发点核对的唯一权威源。**

**已消解（契约已回写，记录留痕）**：

| 原编号 | 旧契约写法 | 修正后 | 回写处 |
|---|---|---|---|
| 1 | `RadialMenu.tsx :105` = 菜单开 | `:105` = `pen-scratch` 提交；菜单开 = `Canvas.tsx:403` | 契约 §6.1 |
| 2 | `use-item.ts` = 使用道具 | 文件不存在；落点 = `CardRenderer.tsx:115`（`unlock`） | 契约 §6.1 |
| 3 | `setEmo(mood)` 在 `:113` | 实为 `CharacterModal.tsx:106` | 契约 §6.2 |
| 4 | `BGMMood` | 正名 `BGMood`（`audio.ts:25`）；**新增裁定**：`setBGM` 对外签名改为 `(ref: string\|null)`（收 URL，与 `setAmbient` 对称），`BGMood` 降为**合成兜底内部**枚举（URL 推断 mood）。本文 §4/§7 的「`[emo:]` 绝不 `setBGM`」不受影响——它禁的是**调用**，与签名无关 | 契约 §5.1/§5 |
| 5 | `assets/audio/stinger/` 无定义 | 契约 §2.2 新增 `stinger/<emo>.mp3`（6 情绪待产出）；不走裸名解析，情绪枚举直映射；缺则静默 no-op | 契约 §2.2 |

**已拍板（评审裁定）**：`stinger/<emo>.mp3` 的 URL 由 **`02` 引擎内部直拼**——
`playStinger(emo)` 内构 `/api/audio?path=stinger%2F<emo>.mp3`（与 `01` 的编码口径逐字一致）。
**04 只调 `playStinger(emo)`，不碰 URL**（触发点文档保持干净）。不违 §9.2：§9.2 禁的是「对 README 声明的**值**做解析」，
而 stinger 是**固定情绪枚举 → 固定文件**的常量模板，非数据解析。
**世界级 stinger 覆盖本批不做**（素材全缺，且需「服务端下发 6 个 URL」的新通道）——已记入契约 §13 待办。

（与本文无关但同批已实测、供评审记录：层的 `ambient`/`bgm` **不能走 manifest**——`deriveLayers` 只派生 `name`/`parent`；音频字段唯一落点是 `/api/layer`。此点归 `01`/`03`。）

---

## 11. 仍未知待拍板

| # | 项 | 现状 | 本文倾向 |
|---|---|---|---|
| 1 | **`page-turn` 落点** | 无翻页交互（§7.2）；`book` 组件未实现 | **本批不接线**，类型保留（同 `gate-open`），等 `pages` 二级层；**落点未决** |
| 2 | **`'normal'` 情绪是否发声** | `parseEmoTag` 缺 tag 时默认 `'normal'`（`CharacterModal.tsx:52`） | 倾向**发声**（引擎对缺失素材 no-op 天然兜底）；但需 `02` 确认 `stinger/normal.mp3` 是否该有素材。若嫌吵则改为「仅非 normal 发声」——**两案需拍板** |
| 3 | **stinger 素材缺口** | `assets/audio/stinger/` **不存在**（6 情绪全缺）；细节归 `05` | 契约 §13 P1：用 dlazy 补 6 条，或从 `foley/` 复用（`crit-chime`/`fumble-break`）应急 |
| 4 | **`gate-open` 是否接线** | 素材 + 类型齐、0 调用点 | 不在本批范围（契约 §6.1「不新增」）；等门卡过场（T4.3）落地再议 |

（已拍板项：「上下文挂起时 stinger」= **drop，不排队**，见 §3.2/§6 与 `02` §3；
「stinger URL 归属」= **`02` 直拼**，见 §10。）

---

## 12. 诚实性自检

- 「9 条调用点」的每个 `file:line` **均为本次 `grep -n` 实测**（`Canvas.tsx:256/310/403`、`DiceRoller.tsx:123/126/142`、`RadialMenu.tsx:105/179`、`CardRenderer.tsx:115`）。
- 契约 §6.1/§6.2 的偏差（`:105` 事件、`use-item.ts`、`:113`）**均有实测反证**，非推断。
- `page-turn` **无落点**是实测结论（`CardRenderer.tsx:196-259` 无分页结构；无 `DetailPanel.tsx`）；候选落点已标明为「语义近似的候选」而非「精确落点」。
- stinger 素材 `assets/audio/stinger/` **实测不存在**（`ls` 报 No such file）；6 情绪缺素材是事实，非猜测。
- `Emotion` 当前在 `CharacterModal.tsx:27` 本地定义；`audio.ts:25` 的类型名**是 `BGMood`**（契约初稿曾错拼 `BGMMood`，已更正为 `BGMood`）——均为实测。
- 「stinger 无合成兜底」：由 `audio.ts:475-569` 的 `switch` **无 stinger case** 推出，标 `[推断]`——确证需 `02` 确认其新增实现不再加合成声源。
- §3.2 的「stinger 与立绘同 tick」为**设计取向**（依据 `extensions/instructions.ts:45` 的表演语义），非既有实现事实；「suspended 时 drop」已由 `02`（AudioEngine）确认。
