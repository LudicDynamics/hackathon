# Continue／下一步提示设计

> 状态：已实现（2026-09-14）；本文保留设计与验收契约。
> 适用：将 `origin/niko` 的可关闭 Continue／下一步提示迁移到当前主线。
> 权威：`docs/ux/08-niko功能迁移契约.md`，以及其引用的 `docs/ux/00-共同上下文.md`、`docs/agent-awareness/00-共同上下文.md`、`docs/audio/00-共同上下文.md`、`docs/tools/00-共同上下文.md`。

## 1. 一句话定位

Continue 是一个**可关闭、只在一轮 Writer 真正 settled 后出现的辅助入口**：玩家明确点击后，系统把一条受事实边界约束的下一步提示请求放入现有 Writer 输入框，玩家仍须检查并按 Send 才会开始 Writer turn；它不发现事实、不宣告完成、不直接改变世界。

这不是“自动继续故事”按钮，也不是谜题答案按钮。提示的价值是降低“现在可以尝试什么”的猜测成本；世界事实仍由文件与 `world_event` 决定，提示文本与提示 Chalk 都不能替代事实证据。

## 2. 输入／签名／类型

### 2.1 `play-hints.ts`（NEW）公开形状

```ts
export const PLAY_HINT_REQUEST: string;

export function setPlayHintsEnabled(next: boolean): void;
export function usePlayHintsEnabled(): boolean;

export type ContinueHintAvailability =
  | 'hidden-disabled'
  | 'hidden-not-settled'
  | 'hidden-error'
  | 'hidden-world'
  | 'hidden-frozen'
  | 'hidden-submit-pending'
  | 'available';

export interface ContinueHintFacts {
  enabled: boolean;
  phase: 'idle' | 'writing';
  stage: string | null;
  error: { message: string; retryable: boolean } | null;
  completionSeq: number;
  visibleSeq: number | null;
  worldReady: boolean;
  worldFrozen: boolean;
  submitPending: boolean;
  preparedSeq: number | null;
}

export function deriveContinueHintAvailability(
  facts: ContinueHintFacts,
): ContinueHintAvailability;
```

`deriveContinueHintAvailability` 是无 DOM、无时钟、无 store 的纯函数；组件只消费它。`preparedSeq` 用于防止同一 settled receipt 被重复点选：同一 `completionSeq` 已经进入输入框后，不再显示同一个入口。

`setPlayHintsEnabled` 的浏览器键固定为 `airp:play-hints`：缺失、无效或无法读取时默认开启；写入 `on`／`off` 失败只保留内存状态，不应阻断游戏。关闭只隐藏入口，不清空 Writer 草稿、历史、世界文件或事件。

### 2.2 WriterResult Props（修改设计）

```ts
interface WriterResultProps {
  worldKey?: string;
  worldReady?: boolean;
  worldFrozen?: boolean;
  submitPending?: boolean;
  onContinue?: () => boolean;
}
```

- `worldKey` 继续是世界／层投影的生命周期边界。
- `worldReady` 由 App 根据当前 manifest 与 layer payload 提供；不把“有一个 manifest”误当成可读场景。
- `worldFrozen` 与 `submitPending` 仅是入口门禁输入，不建立第二份 Writer state。
- `onContinue` 是“准备 Writer 草稿”的同步回调，返回 `true` 代表草稿已放入输入框，返回 `false` 代表没有准备成功。它**不**调用世界 API、事件表或原始 WS。

### 2.3 固定提示请求文本

`PLAY_HINT_REQUEST` 保留 niko 的语义，不缩短为含糊的“继续”命令：

```text
Give me one small next-step hint based only on what I have actually discovered and the items I carry. Read the full current scene README, including its intent, and the relevant existing records once. Say what I can try, where, and why; distinguish drafting, reviewing, and confirming an action. If an earlier action is incomplete, identify the missing step without calling it completed. Do not reveal undiscovered answers, invent clues, advance time, send anything, consume items, unlock gates, or change game state. Only write or update one short hint Chalk, then wait for my decision.
```

界面通过现有 `t(PLAY_HINT_REQUEST)` 取得 locale 版本，再交给既有 Writer prompt 接缝；英文是 fallback。该 prompt 是玩家点击后生成的**请求草稿**，不是服务端事实，也不是自动提交授权。

## 3. 行为契约（逐步；每步含漏接后果）

### 3.1 只接受真正 settled 的 receipt

1. `WriterResult` 订阅 `useWriterState()`，不得订阅 `window` 的 `airp:agent-frame`。只有 `writer.phase === 'idle'`、`error === null`、`stage !== null`、`completionSeq > 0`，且当前 receipt 的 `visibleSeq === completionSeq` 时，才把入口候选交给纯函数。
   - **漏接后果：** 初始空闲状态、仅收到 `agent_progress busy:false`、旧 receipt 或尚未封口的消息会错误显示 Continue，玩家会以为上一轮已完成。
2. `writer_idle` 是封口依据；`completionSeq` 是幂等 receipt 身份。`writer_message` 只提供最后一段可显示文本，不自行制造 settled。
   - **漏接后果：** 按下 Continue 可能和仍在执行的 tool loop 重叠，或者同一 `writer_idle` 造成两次入口。
3. `writer.error`（含 `error` 与 `turn_aborted`）清除 receipt 和入口，即使 `phase` 已回到 idle；socket/world reset 造成 `stage === null` 时同样清除。
   - **漏接后果：** 失败／中断会被包装成“下一步”，掩盖未完成行动或让玩家重复提交无效请求。

### 3.2 点击只准备草稿，不自动执行

1. 入口只在 `deriveContinueHintAvailability(...) === 'available'` 时渲染，并有可操作名称“Continue · next-step hint”，不是泛称“确认”。
2. 点击时组件先用一次性 ref 记录当前 `completionSeq`，调用 `onContinue()`；App 将 `t(PLAY_HINT_REQUEST)` 放入现有 writer input，展开 authoring chrome，并把焦点移到输入框。
3. 回调成功后将该 receipt 标为 `preparedSeq`，入口隐藏／禁用；玩家可以阅读、修改或清空这段草稿。只有表单 Send 才调用既有 `submitWriterText`，再由 `sendToWriter` 发送 `writer_prompt` 并调用唯一 `beginWriterPrompt`。
   - **漏接后果：** Continue 直接发 prompt 会把“提示请求”伪装成玩家已经确认的行动；没有 `preparedSeq` 会让双击或重复点击在输入框中叠加同一长 prompt。
4. 点击后的草稿不是世界变更。未点击 Send 即离开场景、关闭 Writer、切换语言或切换世界，只丢弃未提交的展示状态；不得落 `world_event`、消耗物品、移动实体或启动 Writer。
   - **漏接后果：** 玩家仅查看辅助就改变世界，违反“提示是辅助，不是事实”的边界。
5. 玩家按 Send 后沿用当前提交门禁：`writerLocked || writerPendingRef.current` 直接拒绝；非空文本才进入 `sendToWriter`。成功后 Writer state 进入 writing，Continue 立即因 busy 隐藏。
   - **漏接后果：** UI 与 Writer state 分叉，重复点击可能产生多个 `writer_prompt` 或把请求排队。
6. 若准备回调返回 `false`，不标记 `preparedSeq`；保留入口并由 App 给出具体原因。这里不自动重试。
   - **漏接后果：** 一次失败被假装成已准备，玩家看不到可用恢复路径；或静默重试造成未知提交。

### 3.3 成功、错误、中断与回访

1. 正常 settled 后入口只绑定当前 `completionSeq`，receipt 的七秒可见窗口沿用现有 `WriterResult` 行为。
2. error／abort、socket close、world change、world unavailable、world frozen、正在提交或正在 writing 时入口不显示；已经准备但未发送的文本不得被自动发送。
3. 切层或 `worldKey` 改变时清空 `visibleSeq`、`preparedSeq` 与 receipt timer。重新回到旧层不回放旧 Continue；只有新一轮在当前投影中 settled 才产生新入口。
4. 重复 `writer_idle` 不递增 completion；同一 `completionSeq` 只能准备一次。重复点击由 DOM disabled 与 ref 双重防护，不能依赖点击事件顺序。
   - **漏接后果：** 回访时旧提示穿透到新世界，或双击产生两个 prompt；这会让玩家无法判断哪一轮在工作。

### 3.4 提示内容与事实边界

1. Writer 读取当前场景 README 全文（含 `intent`）以及相关已有记录一次，并只根据实际可发现内容与当前携带物品给一个小步建议；当前背包的文件／路径是输入事实，不由前端猜测。
2. 提示应区分“可以起草”“可以查看”“确认后执行”三种状态；缺少前置事实时说“还缺少……”，不能把推断写成已发现。
3. Prompt 明确禁止剧透未知答案、编造线索、推进时间、发送、消耗、解锁或改变游戏状态。允许的最小产物是一个短提示 Chalk 的创建或更新；该文件若由 Writer 正常写入，仍须走既有动作／事件链，并只能证明“提示记录存在”，不能证明谜题已解、玩家已确认或世界已推进。
4. Continue UI 不监听／解释 `world_event` 来决定显示，也不从 tool_start、文件 watcher、文件名存在或 Writer 文案推测“发现”。
   - **漏接后果：** 入口会把模型猜测、文件存在或临时活动当成世界真相，产生不可回溯的错误引导。

## 4. 文件与副作用

| 文件 | 设计变更 | 副作用／明确不做 |
|---|---|---|
| `apps/web/src/lib/play-hints.ts`（NEW） | 偏好 store、`PLAY_HINT_REQUEST`、纯 availability selector | 仅浏览器 localStorage；不写世界、不发 WS |
| `apps/web/src/components/WriterResult.tsx` | 继续使用 `useWriterState`；增加 availability 门禁、Continue 按钮、preparedSeq 生命周期 | 继续只显示 ephemeral receipt；不复制 Writer 内容、不监听原始帧 |
| `apps/web/src/App.tsx` | 在现有 WriterResult 接线 `worldReady/worldFrozen/submitPending/onContinue`；增加“准备 prompt”回调 | 不增加 writer state，不直接操作事件表或动作层；Send 仍走现有提交函数 |
| `apps/web/src/lib/messages.json` | 增加按钮、开关、说明、冻结／无世界／准备失败等 en/zh-CN/ja key | 不把系统状态翻译成角色台词；不改变世界内容 |
| 现有 settings surface（由 App／settings owner 协调，**不在本功能文档指定 `TtsSettings.tsx`**） | 增加 `Show Continue / next-step hints` switch，调用 `setPlayHintsEnabled` | 关闭仅影响本浏览器入口可见性；不影响进度、草稿、Writer 或音频底层 |

不新增 `WriterResult` 的 result store、`window` 帧通道、hint-specific event、HTTP route、事件表写入或自动 retry。

## 5. 状态／事件模型

### 5.1 UI 状态机

```text
hidden (disabled / no world / initial idle / no receipt)
  └─ writer_idle + error:null + completionSeq新值 + worldReady + not frozen
       → available
available ── Continue ──→ prepared (输入框已有可编辑 prompt)
prepared ── Send ──→ writing（既有 Writer state）
writing ── writer_idle ──→ available（新 completionSeq）
writing ── error/abort ──→ hidden-error
available/prepared ── world change / layer change ──→ hidden-world
```

`prepared` 是 WriterResult 的局部 UI 投影，不是 Writer 真相；Writer state 仍只有 `idle | writing`。若 App 在准备阶段发现 world frozen 或没有 socket，不应伪造 prepared 成功。

### 5.2 事件口径

- Continue 点击本身：**无 `world_event`、无 `agent_activity`、无 Writer frame**。
- 玩家随后明确 Send：现有 `writer_prompt` WS 请求；Writer state 的 `beginWriterPrompt` 是接受后的唯一开始点。
- Writer 处理中的工具活动：继续由 `useWorld.ts → agentActivityStore` 处理，不由 hint 组件消费。
- Writer 写入／更新提示 Chalk：按既有动作／原生写入的事件规则落账（若实际成功），可能出现 `entity_created`／`entity_edited`；此事件表示内容记录变化，不表示“提示正确”“谜题解决”或玩家确认。
- 事件事实仍由文件和 `world_event` 提供；hint selector 不反向读取事件表。

## 6. 前后端接线

### 6.1 前端唯一链路

```text
useWorld.ts
  ├─ acceptWriterFrame(frame)
  │    └─ writer-state.ts（唯一 Writer snapshot）
  └─ world state（worldReady / worldFrozen）

WriterResult
  └─ deriveContinueHintAvailability(snapshot + App props)
       └─ onContinue → App.prepareWriterHint()
            └─ input draft + focus（不发送）
                 └─ existing form submitWriterText()
                      └─ useWorld.sendToWriter()
                           ├─ sendSocket({ type:'writer_prompt', message, layer })
                           └─ beginWriterPrompt(normalized)
```

当前 `sendToWriter` 已在 `apps/web/src/state/useWorld.ts:262-287` 检查空文本／busy、发送 `writer_prompt`、再调用 `beginWriterPrompt`；Continue 不得复制这些检查或改成另一条 transport。`useWorld.ts` 仍是唯一 WS 消费入口；组件不得增加 `airp:agent-frame` listener。

### 6.2 App 准备回调的约束

建议新增局部函数 `prepareWriterHint(prompt: string): boolean`（NEW），其行为与当前主线的输入聚焦接缝一致：检查 `manifest`、`state`、`worldFrozen`、`writerLocked`；设置非沉浸 Writer chrome；写入 `writerRef.current.value`；`requestAnimationFrame` 后 focus；返回 true。它**不得**调用 `sendToWriter`。如果 current input 已有玩家文字，需先由产品拍板“替换”或“追加”；本设计建议替换为提示草稿并在 UI 明示“Review and press Send”，避免把两个意图黏成一次提交。

### 6.3 后端边界

后端无需为 Continue 新增 route 或协议字段。Writer 收到的只是一个普通 `writer_prompt`；服务器／引擎按既有 Writer turn、工具权限、事件落账和活动帧契约处理。任何 hint-specific 约束若无法由 prompt 与现有工具语义保证，必须以失败／不确定呈现，不能由前端宣布成功。

## 7. 错误边界与用户文案

第一层文案遵循“当前状态 → 可核验原因 → 当前下一步”，并区分系统状态、玩家草稿与 Writer 内容。以下是建议的固定 key 和英文基准文案；zh-CN／ja 必须表达相同责任、确定性和动作，不逐词牺牲含义。

| 情况 | 文案（英文基准） | 行动与边界 |
|---|---|---|
| 可用按钮 | `Continue · next-step hint →` | 点击只准备可编辑 prompt，不是完成／发送 |
| 设置关闭 | `Off hides the Continue button. Saved on this browser; your game progress is unchanged.` | 入口隐藏；不删除草稿或进度 |
| 准备成功 | `Next-step hint draft ready. Review it, then press Send.` | Writer 输入获得焦点；尚未启动 turn |
| 初始／无 settled receipt | `Finish the current action first to ask for a next-step hint.` | 不显示按钮时可供 live region／帮助说明使用；不能把空闲当完成 |
| Writer 忙碌 | `The writer is working. Wait for this turn to settle.` | 不排队、不打断；沿用 input disabled |
| 提交竞态 | `The writer is already working.` | `sendToWriter` 的既有 busy 结果；不重复发送 |
| 无世界／层未就绪 | `Load a world and wait for the scene to appear before asking for a hint.` | 不准备草稿、不调用 Writer |
| 世界暂停 | `The world is paused. Continue is unavailable until time flows again.` | 等待 `world_thawed`；不绕过 freeze |
| 连接失败 | `Connection lost. Please try again.` | 现有 `WriterPromptAcceptance`／`writer-state` 错误；无静默 retry |
| Writer 失败 | `The writer could not finish this turn.` | 不显示 Continue；若 retryable，沿用现有 Retry writing |
| 中断 | `The writer stopped this turn. Completed changes are kept; this action is not confirmed complete.` | 不显示 Continue；保留已落盘内容，不宣告行动完成 |
| 只收到活动／tool 成功 | `The writer is still processing this turn.` | 活动不是完成，也不是世界变化 |
| 提示产物存在 | `A hint record was written; it is guidance, not proof that the puzzle is solved.` | 只有可核验 `entity_created/edited` 时才能说记录存在；不能说“发现了” |

“Your action has been processed.” 是当前 `WriterResult.tsx:39` 的无正文 fallback，可继续作为中性 fallback；不得在 hint 场景替换成“Puzzle solved”“You discovered…”等越权结论。

## 8. 代码落点

1. **`apps/web/src/lib/play-hints.ts`（NEW）**
   - 复用 niko `origin/niko:apps/web/src/lib/play-hints.ts:1-16` 的 key、订阅和 `PLAY_HINT_REQUEST` 语义；补 `deriveContinueHintAvailability` 与可测试的 storage 读取 helper。
   - 不导出 `sendToWriter`、不拥有 Writer phase、不接收 WS frame。
2. **`apps/web/src/components/WriterResult.tsx`**
   - 保留当前 receipt timer 与 `useWriterState` projection（现状 `:5-40`）。
   - 将 availability 计算放在 render 纯投影；将 `preparedSeq`／一次点击 guard 放在局部 ref；渲染 receipt 与 Continue 的同一 scene status 区，不创建第二个 Activity／Writer 面板。
   - 把 `onContinue` 签名从无参 void 扩为返回 boolean，并在 `worldKey` 改变时清除 prepared 状态。
3. **`apps/web/src/App.tsx`**
   - 当前 `WriterResult` 位于 scene metadata（现状 `:714-720`）；在同一处传递 `worldReady`、`worldFrozen`、`submitPending`。
   - 当前提交函数 `submitWriterText`（现状 `:479-500`）保持为唯一 Send 接缝；`writerLocked`（现状 `:187-195`）继续含 Writer busy、submit pending、worldFrozen。
   - 新增准备 hint 的局部函数并接到 `onContinue`，不能把它接到 `sendMessage` 或事件表。
4. **`apps/web/src/lib/messages.json`**
   - 增加按钮、设置说明、准备／失败／冻结／无世界文案的完整三语条目，并让 `translate` 的英文 key fallback 保持可用（现状 `apps/web/src/lib/i18n.ts:10-13`）。
5. **设置 surface**
   - 与负责音频设置的实现者协调，把 toggle 放到既有 settings dialog，不重复造设置 store；`setPlayHintsEnabled` 是唯一偏好写入口。

## 9. 与现状差异

| 现状事实 | 设计差异 |
|---|---|
| 当前 `WriterResult` 只有 `worldKey` prop、从 `useWriterState` 读取、receipt 以 `completionSeq` 控制（`apps/web/src/components/WriterResult.tsx:1-40`） | 增加 App 门禁 props 与 derived Continue；不改 Writer state 真相 |
| 当前 receipt 在 idle、`completionSeq` 新增且无 error 时显示，七秒后消失（`WriterResult.tsx:20-40`） | Continue 与该 receipt 同生命周期；初始 idle、失败、冻结、无世界、提交竞态均隐藏 |
| 当前 Writer state 的唯一开始函数是 `beginWriterPrompt`（`apps/web/src/lib/writer-state.ts:84-92`）；`writer_idle` 才结束并递增 completion（`:210-222`） | Continue 不自行改变 phase；Send 经 `sendToWriter` 进入同一开始点 |
| 当前 error／abort 也递增 `completionSeq`，并清空 message（`writer-state.ts:190-209`） | 额外要求 `error !== null` 时绝不显示 Continue，避免失败 receipt 被误认为 settled |
| 当前 App 的 `writerLocked` 包含 writing、submit pending 和 `state?.worldFrozen`（`apps/web/src/App.tsx:187-195`）；当前 Send 由 `submitWriterText` 调 `sendToWriter`（`:479-500`） | Continue 复用这些锁；准备草稿不调用 Send，避免绕过 pending guard |
| 当前 `sendToWriter` 先发 `writer_prompt`，再 `beginWriterPrompt`，失败返回 `transport-closed`／`busy`／`invalid`（`apps/web/src/state/useWorld.ts:262-287`） | 不新增 transport；提交失败沿用这些真实文案与 retry 行为 |
| 当前 `useWorld` 将 Writer 帧送入 `acceptWriterFrame`，并消费 `agent_activity`（`apps/web/src/state/useWorld.ts:415-481`） | WriterResult 不增加原始帧 listener；activity 不是 hint 可用依据 |
| niko 实现直接监听 `airp:agent-frame`、本地维护 `active/progress/result`，且按钮条件只有 `hintsEnabled && onContinue`，未使用 `canContinue`（`origin/niko/apps/web/src/components/WriterResult.tsx:7-42`） | 迁移其开关与 prompt 语义，但改为 writer-state selector；修复“未 settled 也显示按钮”和双套生命周期冲突 |
| niko App 的 `onContinue` 调 `prepareWriter(t(PLAY_HINT_REQUEST))`（`origin/niko/apps/web/src/App.tsx:446-462,673`） | 保留“点击先准备、Send 才提交”的玩家确认语义，但适配当前 `submitWriterText` 接缝；不引入 niko 的旧 writer state 或 raw frame listener |
| 当前 i18n `translate` 以 key 作为英文、缺失译文回退 key（`apps/web/src/lib/i18n.ts:10-13`），当前 messages 没有 Continue hint 三语条目 | 同批补齐新增 key，运行阶段由主线按契约执行 `pnpm check:i18n`；本设计阶段不运行验证命令 |

## 10. 验收测试（纯函数、组件、浏览器）

### 10.1 纯函数测试（建议 `apps/web/test/play-hints.test.mjs`）

通过 jiti 载入 `play-hints.ts` 的纯导出，使用表格 fixture；每条都必须是没有该门禁就会失败的非空断言：

1. `{ phase:'idle', stage:null, completionSeq:0, visibleSeq:null, worldReady:true, ... }` → `hidden-not-settled`。
2. settled 成功 receipt `{ phase:'idle', stage:'Ready for your next action', error:null, completionSeq:3, visibleSeq:3, worldReady:true, worldFrozen:false, submitPending:false, preparedSeq:null, enabled:true }` → `available`。
3. `phase:'writing'`、`submitPending:true`、`worldFrozen:true`、`worldReady:false`、`enabled:false` 各自都不得返回 `available`，并断言对应 reason。
4. error／abort snapshot（`error` 非 null，即使 completionSeq 新增）→ `hidden-error`；证明失败不会产生 Continue。
5. `visibleSeq !== completionSeq`、`stage:null`、`completionSeq` 未变化 → 不可用；重复 `writer_idle` 不产生新可用 receipt。
6. `preparedSeq === completionSeq` → 不可用；不同 completionSeq 可重新可用。
7. storage 缺失／非法值默认 true；`setPlayHintsEnabled(false)` 写入 `off`，再设 true 写入 `on`；storage 抛错时函数仍返回内存状态。
8. `PLAY_HINT_REQUEST` 纯文本必须包含“只基于已发现／携带物品”“不要剧透／改变世界”“只写一个短 hint Chalk／等待玩家决定”等边界句，防止未来文案删掉安全约束。

### 10.2 WriterResult 组件／接线测试

在现有组件测试基础上新增可执行的组件契约测试（可用浏览器组件 harness；若沿用源码契约测试，必须断言语义而非只断言字符串）：

1. 渲染 settled receipt 时有一个 `writer-continue` button；初始 idle、writing、error、worldFrozen、worldReady=false、submitPending 和 hints off 均无 button 或 disabled 且带状态说明。
2. 点击一次调用 `onContinue` 恰好一次、button 随即 disabled／隐藏；再次 click 不增加调用次数；回调返回 false 时保留可重试入口且不假装已准备。
3. `worldKey` 改变会清除 receipt 与 prepared guard；旧 completionSeq 不在新世界显示 Continue。
4. 设置从 on→off 时入口立即消失，Writer draft 与世界事实不被清空；on→off 不产生 WS 或 `world_event`。
5. 接线静态断言：`WriterResult` 只 import `useWriterState`／`usePlayHintsEnabled`，不得包含 `addEventListener('airp:agent-frame'`；App 只有一个 `WriterResult`，且 `onContinue` 进入准备函数而非直接事件 API。

### 10.3 浏览器路径（桌面与 390×844 窄屏）

1. 加载一个有当前场景 README 的世界，等待场景与 Writer idle；首次页面不显示 Continue。
2. 输入一个最小合法行动并 Send；观察 activity／Writer working，确认 Continue 在 writing 阶段不可见且输入 disabled。
3. 等到 `writer_idle` 且有 receipt；确认按钮出现在同一 scene status 区，文案明确是“next-step hint”，不遮挡 canvas、输入框或 activity rail。
4. 点击 Continue 一次：输入框出现本地化 prompt，焦点落在输入框，收到“Review it, then press Send”；网络面板／测试 spy 证明此点击没有发送 `writer_prompt`、没有新增 `world_event`。
5. 不发送，切换层或打开／关闭设置；确认未产生世界变化，旧入口不穿透新 layer；再打开 Continue setting，开关状态只在当前浏览器保存。
6. 重新完成一轮，点击 Continue 后修改草稿，再明确 Send；确认只出现一次 Writer turn；收到 settled receipt 后可以出现下一次 Continue。
7. 触发错误、Stop／abort、断网、world unavailable、world frozen：确认入口消失，首层文案分别说明“未完成／连接丢失／世界暂停”和可行下一步；不显示“已解决”。
8. 390×844 + 键盘：Tab 顺序为 Continue → Writer input → Send（隐藏时不进 tab order）；Enter 在 focused Continue 上只准备草稿，不提交；输入框 composition（IME）期间 Enter 不触发提交；Escape 关闭设置／退回当前 chrome，不丢已落盘事实。按钮具备可见 focus、`aria-label`、`aria-live=status` receipt，窄屏不依赖 hover。
9. Effects off、Reduced Motion、静音与页面隐藏只去掉装饰，不影响 Continue 文本、键盘路径、Writer 提交和世界事实可见性。

以上浏览器路径是验收设计，不在本设计阶段运行命令或构建。

## 11. 发现的冲突／需要修订的上位文档

1. **`docs/ux/08-niko功能迁移契约.md:72-76` 与 niko 原实现的生命周期冲突。** 上位契约禁止组件自行监听原始帧，并要求 Continue 从 writer-state settled／idle 投影出现；niko `WriterResult` 却在 `origin/niko/apps/web/src/components/WriterResult.tsx:15-38` 自建 `active/progress` 并监听 `airp:agent-frame`。本设计以当前 `writer-state.ts` 与 `useWorld.ts` 为准，仅迁移 prompt 与可关闭偏好语义。
2. **niko `WriterResult` 的 `canContinue` 未参与渲染。** `origin/niko/apps/web/src/components/WriterResult.tsx:12,29,41` 设置了 canContinue，却只以 `hintsEnabled && onContinue` 显示按钮，因此初始／错误／未 settled 也可能显示。建议在评审记录为迁移缺陷，本设计用 `deriveContinueHintAvailability` 修复。
3. **“点击 Continue 走 beginWriterPrompt 接缝”与 niko 的“先 prepare、再 Send”存在词义张力。** `08` §3.3 要求走现有 Writer 请求接缝，而 niko App `prepareWriter`（`origin/niko/apps/web/src/App.tsx:446-462`）只准备输入。此文选择更符合“区分 drafting/reviewing/confirming”及“不得自动推进”的两步路径：Continue 是玩家确认前的草稿准备，最终 Send 必须落到当前 `sendToWriter → beginWriterPrompt`。若评审要求单击即发送，必须先修订 `08` 并同时更新本节、测试与文案，不能在实现时悄悄改变。
4. **提示 Chalk 的“不是世界事实”与文件事件事实边界需要上位文档补一句。** `08` §2.6／§3.3 禁止把 hint 当世界事实，但 niko `PLAY_HINT_REQUEST`（`origin/niko/apps/web/src/lib/play-hints.ts:16`）又要求允许写／更新一个短 hint Chalk。建议 `docs/ux/08` 明确：Continue 点击无事件；Writer 成功写出的 hint Chalk 可产生正常 `entity_created/edited`，事件只证明提示记录存在，不证明提示内容真实、谜题解决或玩家确认。
5. **设置面板归属未冻结。** `08` §6 的 Continue 主要落点未列设置组件；niko 在 `origin/niko/apps/web/src/components/TtsSettings.tsx:48-49` 加入开关，而当前主线的 `TtsSettings` 是独立 dialog（`apps/web/src/components/TtsSettings.tsx:21-39`）。本设计只要求复用一个既有 settings surface、只调用 `play-hints.ts`，不指定由 `TtsSettings.tsx` 还是其他 settings owner 修改；请主代理在评审门确认归属并回写 `08`，不得各自新增两个偏好开关。
6. **现有 `writer-state` 把 `error/abort` 也递增 `completionSeq`（`apps/web/src/lib/writer-state.ts:190-209`），而字段名容易被误读为成功完成序号。** 本设计不修改 state；以 `error === null` 与 visible receipt 双门禁区分“terminal”与“successful settled”。若其他文档将 completionSeq 定义为只代表成功，需由主代理统一修订上位文档或这里的 selector 名称。

## 12. 仍未知／待评审拍板

1. 当前输入框已有未发送玩家文字时，点击 Continue 是替换、追加还是先询问；本设计建议替换并显示“Review and press Send”，但需与物品草稿与 App 共用实现者确认。
2. 设置 surface 是否与音频 levels 共用 dialog、Continue 开关的具体顺序和窄屏高度；需由主代理与 settings owner（当前由 AudioSettingsDesign 负责音频段）裁决，避免两个代理同改 `TtsSettings.tsx`。
3. Writer 写入 hint Chalk 的固定路径、frontmatter `type` 与是否显示在当前场景，属于世界内容／工具契约，本文不发明路径；在路径未冻结前不得在实现或测试中猜文件名。
4. “相关已有记录”的精确集合及读取次数由 Writer／hook 契约决定；本文只冻结“当前场景 README 全文 + 可核验相关记录一次”，不自行定义新的 API 或事件。
5. 提示 prompt 是否发送 locale 翻译文本（沿用 niko `t(PLAY_HINT_REQUEST)`）还是始终发送英文 canonical prompt；两者都需保持语义等价，需由产品语言策略拍板。无论选择哪项，UI key 必须有 en/zh-CN/ja 完整文案。
6. receipt 七秒窗口与 Continue 可用窗口是否完全一致，还是 hint 入口需独立 TTL；本设计沿用现有七秒，避免第二套 timer，除非可用性研究证明窄屏需要更长时间。
7. 浏览器 harness 当前是否具备可拦截 WS／事件表的 test seam 尚未核实；落地时必须提供能证明“点击无发送／无事件”的 spy，而不是只看按钮文字。
8. 页面隐藏、失焦、浏览器重载时已准备但未发送的草稿是否保留；本设计按未提交 presentation 可丢弃处理，不把草稿写入 localStorage，除非另有输入恢复契约。
