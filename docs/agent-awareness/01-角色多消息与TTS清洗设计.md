# Agent 感知统一改造：角色多消息与 TTS 清洗设计

> 本篇只设计角色 agent 的 turn/message 聚合、`character_delta` / `character_message` / `character_idle` 语义、角色工具活动在角色 surface 的边界，以及 TTS 可朗读文本清洗和语音时序。
>
> 冻结地基：`docs/agent-awareness/00-共同上下文.md`（尤其 §2、§4、§5）。本篇**不修改**任何共享帧的名称、字段或 `agent_activity` 形状；与冻结契约冲突的内容只登记在 §12，等主 agent 评审后统一回写。
>
> 现状锚点复核：2026-09-13。行号会漂移；实现阶段必须按符号名复核。

---

## 1. 一句话定位

把角色回复从「一条不断被覆盖的字符串」改成「一个 turn 内按 assistant message 顺序封存的文本序列」：`character_delta` 只增长当前 message，`character_message` 只封存当前 message 的权威文本，`character_idle` 才封口整个 turn；页面显示原台词（仅剥离 `[emo: tag]` 控制标签），TTS 始终通过 shared 的 `sanitiseTtsText` 只朗读清洗后的文本。

这条边界同时解决两种不同问题：

- 工具循环中的前台词、工具后的回应不能因第二个 `character_message` 覆盖而丢失；
- 括号动作、`[emo: tag]` 等展示控制内容不被送进语音服务。

角色工具活动只作为角色遮罩附近的 `agent_activity` 胶囊输入，不进入文本聚合、不进入台词分页、不进入 TTS；全局胶囊 UI 归其他子文档，本篇不设计。

---

## 2. 共享边界与现状事实

### 2.1 不改变的上游语义

上游 pi-rp 明确规定：`message_update` 只携带增量事件，客户端要在 `message_start` 与增量之间自行组装，`message_end.message` 是权威最终值（`vendor/pi-rp/packages/coding-agent/docs/rpc.md:1077-1129`）。扩展层也明确 `message_start` / `message_end` 会对 assistant 与 toolResult 触发，而 `message_update` 只对 assistant 流式触发（`vendor/pi-rp/packages/coding-agent/docs/extensions.md:614-620`）。

一次 turn 可能是：

```text
turn_start
  assistant message 1: text_delta* → message_end
  tool_execution_start → tool_execution_end
  assistant message 2: text_delta* → message_end
  tool_execution_start → tool_execution_end
  assistant message 3: text_delta* → message_end
turn_end / agent_settled
```

`message_end` 是**message 边界**，不是 turn 边界。只有 `agent_settled` 映射出的 `character_idle` 是整轮封口。

### 2.2 现有 AIRP 映射

| 事实 | 代码证据 | 本设计的含义 |
|---|---|---|
| 文本块会被拼成一个 assistant message 文本 | `apps/server/src/engine/event-bridge.ts:21-30` 的 `messageText` 只保留 `type === 'text'` 并 `join('')` | 同一 message 的多个 text block 只能封存一次 |
| 角色 `text_delta` 映射为 `character_delta` | `event-bridge.ts:95-107` | `delta` 是新增片段，不是累计快照 |
| assistant `message_end` 当前映射为 `character_message` | `event-bridge.ts:120-141` | 该 `text` 是该 message 的权威值；不能拿它替代整轮累计值 |
| `agent_settled` 当前映射为 `character_idle` | `event-bridge.ts:250-252` | `idle` 才能解除本 turn 的工作态 |
| 角色帧由 `useWorld` 原样转发 | `apps/web/src/state/useWorld.ts:423-429` | `useWorld` 不拼文本、不做去重、不落账 |
| App 按当前角色归属后下推最近帧 | `apps/web/src/App.tsx:242-258` | 实现时必须保留帧顺序；不能只把最后一条 message 当 turn 结果 |
| 当前 Modal 的文本真相是单个 `lineRef` | `CharacterModal.tsx:141-153` | 这是本篇要替换的覆盖根因 |
| 当前 `character_message` 会把 `lineRef` 直接替换 | `CharacterModal.tsx:576-595`，尤其 `:591-592` | 第二个 assistant message 会抹掉第一个 message |
| 当前分页器只接收一个 `raw` 字符串 | `apps/web/src/components/overlay/dialogue-pages.ts:50-82` | 聚合层输出有序 raw 序列后再交给分页器 |
| 当前 TTS body 直接使用 `page.text` | `CharacterModal.tsx:252-289`，`fetch('/api/tts')` 在 `:265-269` | 这里必须先调用 shared 清洗函数 |
| 当前服务端先检查 raw text，再截断/hash | `apps/server/src/routes/tts.ts:257-310` | 必须改为服务端幂等清洗后再空校验、截断、hash、合成 |

### 2.3 角色工具活动的边界

`tool_start` / `tool_end` 是现有工具通道，主要仍服务 writer footprint（`useWorld.ts:408-422`）。本篇不把它们伪装成角色台词，也不把原始 `toolName`、args、文件全文送进角色纸。

角色可见工具动作只消费冻结的 `agent_activity`：

- 过滤条件：`source === 'character'` 且 `agentId` 的值为 `character:<characterId>`（实际字符串形如 `character:nanami`）；
- `subject` 只能由服务端白名单产生；角色 surface 不重新解释原始参数；
- started/completed/failed 胶囊不改 `CharacterTurnBuffer`，不产生 `DialoguePage`，不调用 TTS；
- 角色关闭时由 activity rail 所属前端逻辑收束未完成胶囊；本篇不设计 rail UI；
- `character_idle` 是 agent turn 的终止事实，不得用 activity completed 推断 idle。

`turnId` 只标识一次 agent turn，`activityId` 只标识一项工具活动；二者都不是 assistant message 的替代 ID，也不参与文本拼接或 TTS cache key。角色 rail 原样遵守冻结帧的 `source` / `agentId` / `turnId` / `activityId`，本篇不重新命名、合并或推导这些身份字段。

角色 rail 的生命周期纯函数归 `apps/web/src/lib/agent-activity.ts`：必须导出并统一使用 `ACTIVITY_COMPLETE_TTL_MS = 2400`、`ACTIVITY_FAILED_TTL_MS = 4500`、`ACTIVITY_STALE_TTL_MS = 90000`、`MAX_VISIBLE_ACTIVITIES = 3`；去重、归并和过期清理必须可由 `node:test` 直接调用。本篇只规定角色文本聚合不得读取或改写这些活动状态，不复制其常量或 UI 逻辑。

这样可保证「工具做了什么」与「角色说了什么」两条感知路径相邻但不混线。

---

## 3. 接口与签名

### 3.1 共享 TTS 清洗 helper（NEW）

唯一实现落点：`packages/shared/src/rules/tts-text.ts`；必须在 `packages/shared/src/index.ts` 增加显式 export。前端和服务端都从 `@airp/shared` 导入同一个函数；禁止在 `CharacterModal`、`routes/tts.ts` 或测试中复制括号正则。

```ts
// packages/shared/src/rules/tts-text.ts
export function sanitiseTtsText(raw: string): string;
```

函数是纯函数、无 I/O、无日志、无 locale 状态，满足：

- `sanitiseTtsText(sanitiseTtsText(raw)) === sanitiseTtsText(raw)`；
- 输入包含前导 `[emo: tag]` 时移除一个或连续多个控制标签；已由 `parseEmoTag` 剥离的页面再次调用不会改变结果；
- 去除成对动作括号及其内容后 `trim()`；
- 对未配对或交叉括号按 §5 的冻结 fail-closed 语义返回空串；
- 不修改传入的原字符串，也不把清洗结果回写角色显示文本。

`packages/shared/src/index.ts` 是 shared 公共面；漏掉 export 会导致 server/web 一端偷偷出现第二份实现，属于构建前就应阻断的接线错误。

### 3.2 角色 turn 聚合纯函数（NEW）

建议仍放在零 React 的 `apps/web/src/components/overlay/dialogue-pages.ts`，与既有分页纯函数同模块，避免从 `.tsx` 直导 React。若实现者认为文件职责过宽，可拆为 `character-turn.ts`，但必须保留下列签名和单一消费点；拆分需在实现同批回写本文。

```ts
export interface CharacterTurnBuffer {
  /** 已封存的非空 assistant message，按上游 message_end 顺序。 */
  messages: string[];
  /** 当前尚未收到 message_end 的 delta 拼接。 */
  openDelta: string;
  /** 是否已经收到本 turn 的 character_idle。 */
  ended: boolean;
}

export type CharacterTurnFrame =
  | { type: 'character_delta'; delta: string }
  | { type: 'character_message'; text: string }
  | { type: 'character_idle' };

export interface CharacterTurnProjection {
  buffer: CharacterTurnBuffer;
  /** messages + openDelta，message 间用一个换行边界连接。 */
  rawText: string;
  messageClosed: boolean;
  turnClosed: boolean;
  changed: boolean;
}

export function createCharacterTurn(): CharacterTurnBuffer;
export function consumeCharacterFrame(
  buffer: CharacterTurnBuffer,
  frame: CharacterTurnFrame
): CharacterTurnProjection;
export function resetCharacterTurn(): CharacterTurnBuffer;
```

`CharacterFrame` 仍由 `CharacterModal.tsx:63-68` 声明并保留 `characterId`、`timestamp`、`error` 等字段；交给纯函数前只取上述三类字段。不要为了聚合给共享帧新增 `messageId`、`turnId` 或其它字段。

### 3.3 Modal 内部状态

在 `CharacterModal.tsx:141-160`，用 `turnBufferRef: React.MutableRefObject<CharacterTurnBuffer | null>` 替代 `lineRef` 作为文本真相；`pagesRef` 仍是页状态真相。`lineRef` 可以保留为兼容命名，但不得再承载整轮唯一文本。

`StagePage`（现有 `CharacterModal.tsx:89-90`）应增加一个仅供请求竞态校验的 `voiceText?: string`（或等价 request token），但不改变页面对外数据：

```ts
type StagePage = DialoguePage & {
  voiceUrl?: string;
  voiceState: VoiceState;
  /** 当前 pending/ready 请求实际使用的 sanitiseTtsText(page.text)。 */
  voiceText?: string;
};
```

权威 `character_message` 修正已经封口的页面时，必须清掉 `voiceUrl`、`voiceText` 并重置 `voiceState='idle'`；返回结果只有在 `voiceTurnRef` 仍相同且 `sanitiseTtsText(page.text) === requestedText` 时才可写回。否则旧请求可能在新文本上错误播放。

建议保留的边界函数：

```ts
function beginCharacterTurn(): void;
function ingestCharacterFrame(frame: CharacterFrame): void;
function projectTurnPages(buffer: CharacterTurnBuffer): void;
function settleIfDrained(): void;
```

`beginCharacterTurn` 在 `handleSend` 和首个真实 delta/message 到达时建立新 buffer；`ingestCharacterFrame` 是三类角色帧的唯一入口；`projectTurnPages` 把 `rawText` 交给 `parseEmoPages`，不改变页面显示原文（除既有 `[emo: tag]` 控制标签解析）。

---

## 4. Turn/message 行为契约（逐步与漏了会怎样）

### 4.1 新 turn 建立

1. 玩家发送 `character_prompt`，清空上一轮仍可见的页队列、当前页索引和语音令牌，并调用 `resetCharacterTurn()`。
   - 漏了：上一轮最后一句会与新轮混在同一页队列，或上一轮在途 TTS 播进新轮。
2. 真实帧先到也必须建立 buffer；没有假设一定先收到 `character_start` 或 `message_start`，因为这两者不在当前浏览器角色帧 union 中。
   - 漏了：非流式客户端只发 `character_message` 时会卡在 thinking。
3. mock greeting 不是 turn buffer，不进入 `messages`、`openDelta`、WS payload 或 agent 上下文；真实首帧到达时整块退场，沿用 `docs/tts/00 §7`。
   - 漏了：本地引导语会被当成角色真实话，污染显示或 TTS。

### 4.2 `character_delta`

1. 将 `frame.delta` 追加到 `openDelta`；不把它当累计快照，不追加到 `messages`。
   - 漏了：每个增量被重复拼接，或第二次 delta 替掉第一段。
2. `projectTurnPages` 重新生成当前 turn 投影：`messages` 依次保留，`openDelta` 作为最后一个仍可能增长的 message。
   - 漏了：工具前的文字无法与后续 message 共存。
3. `parseEmoPages(rawText, { final: false })` 仍只以 `\n` 封页；末尾未闭合行不预取 TTS。
   - 漏了：半句被提前朗读，或 `\n` 后页面无法翻动。
4. 若 `openDelta` 只有空白，不生成页；保留 buffer 状态等待后续 delta。
   - 漏了：工具循环产生一张空白页，玩家必须翻过它才能继续。

### 4.3 `character_message`

`message_end.message` 是当前 assistant message 的权威值，**不是整轮累计值**。

1. 若 `openDelta === frame.text`：把这段文本封存一次，清空 `openDelta`；不得再次 append。
   - 漏了：典型的 delta + message_end 会出现 `HelloHello`。
2. 若 `openDelta !== ''` 且与 `frame.text` 不同：丢弃该 message 的增量投影，以 `frame.text` 替换并封存一次；这是上游“final message authoritative”语义，不是追加。
   - 漏了：丢包时会形成 `partial + authoritative`，正文和 TTS 都重复。
3. 若 `openDelta === ''` 且 `frame.text.trim() !== ''`：将 `frame.text` 作为一个新的 assistant message 追加。即使与上一条文字相同，也不得按内容去重，因为它可能是工具循环后的合法第二条相同回复。
   - 漏了：两个相同但真实存在的 assistant message 会被错误压成一句。
4. `frame.text.trim() === ''` 时不追加 message、不建空页；保持等待工具循环或 idle。
   - 漏了：纯工具 message_end 会产生无意义 TTS 400。
5. `character_message` 后仍可继续收到工具帧和新的 `character_delta`；它只把当前 message 关上，不设置 `ended`。
   - 漏了：第一个 message_end 会过早亮输入框，工具后的角色回应进不了当前 turn。
6. 每次封存后，以 `messages.join('\n') + openDelta` 投影分页。插入的换行只作为 assistant message 之间的演出边界，不回写原始 message，不进 agent history。
   - 漏了：相邻 message 没有可辨识页面边界；不应直接覆写 `messages[messages.length - 1]`。

**传输重复的限制**：当前 `character_message` 帧没有 `messageId`；本篇不私加字段。实现不得把“内容相同”当通用去重键，因为那会丢掉合法的同文 message。需要防止网络层同一帧重复时，应在上游提供可用的帧去重身份并另行修订共享契约；本篇只保证 delta 与其对应 message_end 不重复。

### 4.4 `character_idle`

1. 若 `openDelta.trim() !== ''`：将其作为最后一个 assistant message 封存一次；这覆盖 message_end 丢失的尾帧救援路径。
   - 漏了：最后一段文字只显示到 delta，无法封口、无法预取 TTS、phase 永远 streaming。
2. 若 `openDelta` 为空：不改已封存 messages；idle 只封口 turn。
   - 漏了：纯工具轮会清掉玩家刚看完的台词，或凭空增加空页。
3. 设置 `ended = true`，对末页执行 `parseEmoPages(..., { final: true })`，开始尚未请求的末页 TTS 预取。
   - 漏了：末行没有换行时永远不会成为页，输入框无法在最后一句后启用。
4. `settleIfDrained()` 必须同时满足：`ended === true`、当前页是最后页、末页 sealed、页内逐字已追平；否则保持演出态。
   - 漏了：收到 idle 就立即亮输入框，玩家还没读完前台词就被新输入覆盖。
5. 已结束 buffer 收到迟到 delta 时不得回写已封口 turn；下一轮必须由 `beginCharacterTurn` 显式建立。
   - 漏了：旧 WS 帧会污染新轮第一页。

### 4.5 工具循环

工具开始、进行中、结束期间：

- 不清空 `messages`，不改 `openDelta`；
- 不把工具结果的 `details`、文件全文或模型思考送进 `parseEmoPages`；
- 只让角色 `agent_activity` rail 显示白名单动作；
- 若工具循环中有空 assistant message，保持无页；
- 工具后新的 assistant message 按 §4.3 追加到同一 turn。

漏了任一项，玩家会看到工具参数冒充台词、工具胶囊被 TTS 朗读，或前一句在工具动作期间消失。

---

## 5. TTS 清洗纯函数与异常括号语义

### 5.1 清洗顺序（唯一顺序）

调用输入与显示输入严格分离：

```text
角色页原文（display text；页面仍保留动作文字）
→ 移除前导 [emo: tag] 控制标签（helper 自身也做，保证幂等）
→ sanitiseTtsText：扫描并移除动作括号片段
→ trim 空白
→ 前端为空：voiceState='failed'，不发 POST
→ 前端非空：POST /api/tts，body.text = 清洗文
→ server 收到后再次 sanitiseTtsText
→ server 空校验
→ 截断 → language/voice 解析 → hash → 缓存/合成
```

前端预清洗是避免空请求和延迟；服务端重清洗是安全边界，不能相信浏览器。两边必须 import 同一 `@airp/shared` helper，不得各写一套正则。

`parseEmoPages` 仍负责页面显示的情绪解析和标签剥离（当前 `dialogue-pages.ts:32-38,50-82`）；TTS helper 再认一次 `[emo: tag]` 是有意的幂等防线，不是把清洗文回写到 `DialoguePage.text`。

### 5.2 配对括号扫描规则

推荐用栈扫描而不是多个独立正则，避免嵌套和跨行时不同正则互相覆盖。四类配对固定为：

| 开 | 闭 | 处理 |
|---|---|---|
| `(` | `)` | 删除整段（含括号） |
| `（` | `）` | 删除整段（含括号） |
| `[` | `]` | 删除整段（含括号）；前导 `[emo: tag]` 先按控制标签消费 |
| `【` | `】` | 删除整段（含括号） |

栈允许同类或跨类**正确嵌套**，例如 `（a (b) c）说` 删除后为 `说`；连续动作 `(a)（b）好` 删除后为 `好`；空括号 `()好` 删除后为 `好`；括号内换行 `(a\nb)好` 删除后为 `好`。括号内部内容、换行和括号本身全部属于不可朗读动作片段。

`[System] hello` 的 `[System]` 是普通方括号动作而非情绪控制标签，删除后为 `hello`。只有行首、闭集格式的 `[emo: tag]` 才是控制标签；helper 对合法/未知小写 tag 的处理必须与现有 `parseEmoTag` 口径一致并保证不朗读标签本身。

### 5.3 异常括号：冻结的 fail-closed 语义

`docs/agent-awareness/00 §5.3` 已冻结此安全边界：为避免把动作内容、半截标签或模型控制文本送进厂商，异常括号一律 fail-closed：

- 只有开括号：整次清洗返回 `''`；不猜测括号后的文字是台词；
- 只有闭括号：整次清洗返回 `''`；不把前面的半句送去 TTS；
- 交叉类型，例如 `([动作）` 或 `[动作)`：整次清洗返回 `''`；
- 栈无法闭合、跨换行仍未闭合：同样返回 `''`；
- helper 不抛异常，不记录日志；调用方将空结果视为“本页无语音”，显示原文仍保留。

这是“宁可这一页无声，不把异常动作送厂商”的确定性契约。不得为正常台词单独豁免，也不得把异常内容送去 TTS。

### 5.4 清洗行为矩阵

| 输入 | 显示 | `sanitiseTtsText` 结果 | 前端请求 |
|---|---|---|---|
| `[emo: smile] 好啊` | `[emo]` 隐藏，显示“好啊” | `好啊` | 发一次，body.text=`好啊` |
| `（笑了一下）好啊` | 原文显示 | `好啊` | 发一次 |
| `(laughs) Sure` | 原文显示 | `Sure` | 发一次 |
| `【把信递给你】拿着` | 原文显示 | `拿着` | 发一次 |
| `[System] hello` | 原文显示 | `hello` | 发一次 |
| `（笑）` | 原文显示 | `''` | 不发；保留无语音 stinger 语义 |
| `()（ ）好` | 原文显示 | `好` | 发一次 |
| `（a (b) c）好` | 原文显示 | `好` |
| `(a)（b）好` | 原文显示 | `好` |
| `(a\nb)好` | 原文显示 | `好` |
| `hello (` | 原文显示 | `''`（fail-closed） | 不发 |
| `hello )` | 原文显示 | `''`（fail-closed） | 不发 |
| `([动作）好` | 原文显示 | `''`（fail-closed） | 不发 |

---

## 6. TTS 请求、缓存与语音时序

### 6.1 `prefetchVoice(page, i)` 的落点与行为

落点是 `CharacterModal.tsx:252-289` 现有 `prefetchVoice`，由 `syncPages` 在页封口处触发（当前 `:336-382` 的 `sealed` 分支）。调整为：

1. `const text = sanitiseTtsText(page.text)`；若为空，设置 `page.voiceState = 'failed'`，不进入 pending，不调用 fetch，并由已有无语音 stinger 分支处理。
   - 漏了：纯动作页打出 400，或把 `（笑）` 读出来。
2. 非空才设置 pending；同一页 voiceState 不是 idle 时直接返回。
   - 漏了：delta 与 message_end 的同步更新会对同页发多次请求。
3. 保持请求体的机械门禁写法，唯一 body 文本是清洗结果：

```ts
const res = await fetch('/api/tts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text, voice, language }),
});
```

4. 以 `voiceTurnRef` 令牌**和请求文本快照**丢弃旧结果；回包写回前再次确认 `sanitiseTtsText(page.text) === requestedText`。当前页才 `playVoice(url)`，已翻走的页只预热不播放。
   - 漏了：上一轮的音频在新轮或新角色遮罩里响；权威 `character_message` 修正后，旧文本的回包也可能污染新页。
5. 收到 `truncated:true` 只接受当前服务端结果，不重试；缓存 key 已按截断后的清洗文本稳定寻址。
   - 漏了：长页造成重试风暴。
6. 失败（503/502/504）、decode 失败或 helper 空结果都进入 failed；文字照常显示，真实页保留无语音 stinger；mock 页仍按 `docs/tts/00 §7.3` 不响 stinger。
   - 漏了：语音失败会让整轮卡死，或错误胶囊替代角色台词。

### 6.2 服务端 `/api/tts` 幂等重清洗

落点是 `apps/server/src/routes/tts.ts` 的 POST handler（当前 `:247-343`）和 `packages/shared` helper：

1. 读取 `rawText`，只校验类型是 string；
2. `const text = sanitiseTtsText(rawText)`；
3. `text.trim() === ''` 返回既有 `400 { ok:false, code:'invalid_argument', ... }`；
4. 对清洗后的 text 截断，设置 `truncated`；
5. 再做 voice/language 解析、`hashOf(model, voice, languageType, text)`、cache lookup、合成。

漏掉第 2 步会产生安全漏洞：恶意/旧客户端可把动作内容写进厂商请求和 cache key；同时“前端 cleaned”与“服务端 raw”会出现两份语音缓存。

同一页面“原文请求”和“清洗文请求”不得由前端各发一次；前端只发一条 cleaned 请求。若旧客户端发 raw，server 清洗后仍命中与新客户端相同的 cache key。TTS 仍不落 `events`、不发 WS、不开 agent history。

### 6.3 页与音频时序

1. `\n` 封口或 `character_message`/`character_idle` 封口时立即预取该页 cleaned text；未封口页不预取。
2. 页面成为当前页时先 `stopVoice()`，再根据 voiceState 播 ready URL；pending 则等待就绪，已翻走只缓存不播放。
3. 页面内仍由 `charDelay` 逐字显示；清洗只影响语音，不影响打字机节奏。
4. 页面无语音时按既有 stinger 规则；activity rail 文案永远不调用 TTS。
5. 新 turn、角色关闭、切换角色时增加 voice token、停止当前 voice、丢弃在途响应。

完整时序：

```text
character_delta* ──► openDelta ──► newline 封页 ──► sanitise ──► POST 预取
       │
character_message ──► authoritative 封存一次 ──► 最后一页封口/预取
       │
character_idle ──► 封存尾 delta + turn ended ──► 页面逐字追平 ──► done/input enabled
       │
页面成为当前页 ──► stopVoice ──► ready 则 playVoice；否则 pending 等待/失败 stinger
```

---

## 7. 文件副作用、事件与落账

| 动作 | 文件/运行时副作用 | 是否落账/发帧 |
|---|---|---|
| 聚合 `character_delta`/`character_message`/`character_idle` | Modal 内存 ref/state、页队列 | 不新增 DB 行，不新增 WS 帧 |
| 角色工具 `agent_activity` | 角色 rail 的临时胶囊状态 | 不落 `history.db`，不进角色页/TTS |
| `sanitiseTtsText` | 无副作用纯计算 | 不发帧、不写盘 |
| `POST /api/tts` | 命中或原子写 `<worldRoot>/.airpworld/tts-cache/<hash>.wav` | 不落 events、不进 agent history |
| `playVoice`/`stopVoice` | Web Audio 语音通道 | 不落账 |
| `localStorage` greeting | 仅 mock greeting 的既有 key | 不属于本设计的角色文本 |

服务端完整上游错误继续使用既有 `tts_unconfigured` / `tts_upstream` / `tts_timeout`；前端不把错误消息当角色台词。TTS 清洗为空属于 `invalid_argument`（server 防线）或前端不请求（预检路径），而不是伪造一段空音频。

---

## 8. 前端接线

1. `useWorld.ts:423-429` 继续原样 dispatch 三类角色帧，不拼接、不去重；它也不得把 `agent_activity` 转成角色台词。
2. `App.tsx:242-258` 继续按 `characterId`/当前 active character 过滤并保证顺序。若 React state 传递导致同步 burst 丢帧，实现应把 incoming 改为按到达顺序的 queue；不可退回“只存最后一个 frame”。这属于接线补强，不改变帧 payload。
3. `CharacterModal.tsx` 的 frame effect（当前 `:539-635`）只调用 `ingestCharacterFrame`：
   - delta → `consumeCharacterFrame`，更新 open message；
   - message → authoritative 封存，不结束 turn；
   - idle → 封口 turn；
   - error → 既有错误页路径，不进入角色 message buffer。
4. `syncPages`（当前 `:336-382`）消费 `projection.rawText`；不得继续用单个 `character_message.text` 作为整轮输入。
5. `prefetchVoice`（当前 `:252-289`）先 `sanitiseTtsText`；页面渲染仍使用 page.text。
6. 角色 rail 只读取 `agent_activity`，按 `agentId=character:<id>` 隔离；关闭角色时由 rail 终止 started 胶囊。不能把 rail 文案拼到 `rawText`。
7. `dialogue-pages.ts` 继续提供 `parseEmoPages`、`charDelay`、`clampPageIndex`；新增聚合函数必须无 React、可由测试直接导入。

---

## 9. 错误边界与降级

| 情形 | 角色页面 | TTS | 工具活动 |
|---|---|---|---|
| 只有工具、无 assistant 文本 | 保留上一页，不建空页，idle 后回到 done/idle | 不请求 | 仍显示角色 activity |
| delta 后 message_end 同文 | 一段文本 | 只请求一次 | 不受影响 |
| delta 与 message_end 不同 | 以 message_end 权威值修正当前 message | 失效旧页请求，按新文重取 | 不受影响 |
| 多 message + 工具循环 | 所有非空 message 按序保留 | 每页最多一次，按清洗文预取 | 不进入 TTS |
| message_end 空文本 | 无空页 | 不请求 | 不结束 turn |
| idle 丢失尾 message_end | 用 openDelta 封口 | 尾页照常预取 | idle 封口仍是最终边界 |
| TTS helper 返回空 | 显示原文、可翻页 | 不 POST，failed/stinger | 不朗读 |
| TTS 503/502/504 | 文字照常 | failed/stinger，不重试 | activity 不受污染 |
| 服务端收到 raw 动作文本 | 页面不变 | 重清洗；空则 400，不写 cache | 不受影响 |
| unmatched/crossing bracket | 原文不变 | fail-closed 空串、不送厂商 | 不受影响 |
| 在途请求跨 turn/切角色返回 | 页面只接受当前 token | 丢弃结果 | rail 按 agentId 隔离 |
| 缓存 wav 缺失/解码失败 | 页面不消失 | no-op，不伪造音频 | 不受影响 |

---

## 10. 与现状差异

| 现状 | 问题 | 设计改动 |
|---|---|---|
| `lineRef` 是整轮唯一字符串（`CharacterModal.tsx:141-143`） | message_end 覆盖前一 assistant message | `CharacterTurnBuffer.messages + openDelta` |
| `character_message` 非空时直接 `lineRef = incoming.text`（`:591-592`） | 工具前台词丢失、delta/message_end 可能重复 | 同 message 比对后封存一次；跨 message 追加 |
| `character_idle` 只看当前 `lineRef`（`:599-613`） | 不能封存多个 assistant message，也不能区分纯工具轮 | 只封 openDelta，保留 messages，idle 封 turn |
| `parseEmoPages` 只由单 raw 字符串驱动（`dialogue-pages.ts:50-82`） | 输入源已被覆盖时分页无法补救 | 聚合投影作为唯一 raw 输入 |
| `prefetchVoice` body 使用 `page.text`（`CharacterModal.tsx:265-269`） | 动作括号会被朗读，纯动作页会发空/无效请求 | 先 `sanitiseTtsText`，空则跳过 |
| server 只对 raw 做空检验/截断/hash（`routes/tts.ts:257-310`） | 旧客户端可绕过前端清洗，缓存和厂商请求污染 | 收到后同一 helper 重清洗再继续 |
| 无 shared TTS helper | 前后端正则分叉，行为和缓存 key 漂移 | `packages/shared/src/rules/tts-text.ts` 单一实现 |
| 角色工具 activity 与台词没有明确边界 | 原始工具信息可能落入角色纸或语音 | `agent_activity` 仅 rail，永不进 buffer/TTS |

---

## 11. 验收测试与非空回归断言

### 11.1 测试文件与符号

| 测试 | 位置 | 覆盖 |
|---|---|---|
| shared 清洗纯函数 | `packages/shared/test/tts-text.test.mjs`（按 shared 既有 dist 直导体例） | 幂等、四类括号、嵌套/连续/空/跨换行、异常括号、`[emo]`、`[]` 动作 |
| 前端聚合、分页与请求状态 | `apps/web/test/voice-engine.test.mjs` | `consumeCharacterFrame`、多 message、纯工具轮、页清洗、空文本跳过、voice token |
| 服务端 TTS route | `apps/server/test/tts-routes.test.mjs` | server 重清洗、空 400、raw/cleaned 同 cache key、厂商 body 不含动作、缓存不重复请求 |
| 上游映射回归 | `apps/server/test/map-engine-event.test.mjs` | 每个 assistant `message_end` 仍产一条 `character_message`；空 text 仍过滤；`character_idle` 只来自 settled |

本篇不要求现在运行项目级 build/test；实现阶段按 04 文档统一执行。

### 11.2 旧实现必失败、新实现必通过的非空断言

以下 fixture 必须在旧 `CharacterModal.tsx:576-595` 逻辑下失败，在新 buffer 下通过：

```ts
const sequence = [
  { type: 'character_delta', delta: '先说前台词。' },
  { type: 'character_message', text: '先说前台词。' },
  // tool_start/tool_end（不进入文本 buffer）
  { type: 'character_delta', delta: '工具回来后的回应。' },
  { type: 'character_message', text: '工具回来后的回应。' },
  { type: 'character_idle' },
] as const;

let buffer = createCharacterTurn();
let projection;
for (const frame of sequence) {
  projection = consumeCharacterFrame(buffer, frame);
  buffer = projection.buffer;
}
assert.equal(projection.rawText, '先说前台词。\n工具回来后的回应。');
assert.deepEqual(
  parseEmoPages(projection.rawText).map((p) => p.text).join('\n'),
  '先说前台词。\n工具回来后的回应。',
);
```

旧实现第一次 `character_message` 会把 `lineRef` 设为“先说前台词。”，第二次会在 delta 后再把它替换成“工具回来后的回应。”，最终非空结果只剩后一段；因此上述两个 `assert` 至少一条必失败。该断言不是“数组长度大于零”的假绿，而是验证第一条具体台词没有被覆盖。

TTS 的非空回归断言：

```ts
assert.equal(sanitiseTtsText('（笑了一下）好啊'), '好啊');
// mock fetch 断言厂商收到的 input.text === '好啊'
assert.equal(await postTtsRaw('（笑了一下）好啊'), await postTtsClean('好啊'));
assert.equal(upstreamCalls, 1); // 第二次命中同一个清洗后 cache key
```

旧实现前端会将 `（笑了一下）好啊` 原样放进 body，旧 server 也会按原文 hash；因此“厂商收到 `好啊`”和“raw/cleaned 共用一次 upstream”在旧实现下必失败。

### 11.3 必须覆盖的矩阵

1. 一条 message 的多个 text block 拼接后只封存一次；
2. `delta === message_end.text` 不重复；不同则以权威值替换；
3. 三个 assistant message，工具循环夹在其间，所有非空文本有序保留；
4. 第二个 message 无 delta 只有 `character_message`，仍保留；
5. 纯工具 message + idle 不产生空页；
6. idle 直接封存未结束 `openDelta`；
7. 无换行单段仍是一页，空行丢弃；
8. `[emo: smile] （笑）好啊` 显示“好啊”但 TTS body 仅“好啊”；
9. 纯动作、空括号、连续/嵌套/跨换行括号；
10. 单开、单闭、交叉括号统一返回空串、不发 fetch，服务端同样返回 `invalid_argument`；
11. 清洗结果为空不发 fetch，服务端 raw 空返回 `invalid_argument`；
12. 页切换 stop→ready play，旧 turn 回包不播；
13. `agent_activity` started/completed/failed 不产生页、不产生 TTS、不改变 `character_idle`；
14. activity 按 `character:<id>` 隔离，切换角色不继承胶囊。

---

## 12. 发现的冲突 / 需要修订的上位文档

1. **异常括号语义已由 `docs/agent-awareness/00 §5.3` 冻结为 fail-closed**：单侧、交叉、无法闭合或跨行未闭合结构统一返回 `''`；本篇 §5.3、§5.4 与测试矩阵按此执行。shared helper、前端/server 测试和相关 TTS 文档必须同批回写，不能恢复为“保留异常内容”。
2. **`docs/tts/00-共同上下文.md §5/§6.5` 的旧文字写成“前端页文本直接进入请求”**，与 agent-awareness/00 §5 的“shared helper + server 幂等重清洗”冲突。按 agent-awareness/00 权威层级，应修订 `docs/tts/00 §5.1、§4.2、§6.5`，明确请求体与 hash 使用清洗文。
3. **`docs/tts/01-服务端路由与合成.md` §3.D 当前描述 raw text 先校验、截断、hash**，需改为导入 `sanitiseTtsText`，清洗后再空校验、截断、hash；其“非目标：不改前端”可保留，但 shared helper 是跨端契约依赖。
4. **`docs/tts/03-遮罩分页与演出.md` §3.1/§5.1 当前示例的 `prefetchVoice` 将 `page.text` 直接作为 body**，需改为 `const text = sanitiseTtsText(page.text)` 并为空跳过；显示原文与 TTS 清洗文必须并列写出。
5. **`docs/tts/05-前端接线与请求体门禁.md`** 需在请求体门禁说明中补充“`text` 是清洗后的变量值，键集仍为 `text/voice/language`”；不得为满足门禁再复制清洗逻辑。
6. **`docs/tts/06-验证与文档回写.md`** 需新增 `packages/shared/test/tts-text.test.mjs`、server raw/clean cache 等价断言，并把 fail-closed 裁决同步到矩阵；不能只测浏览器预清洗。
7. **`docs/prompts/02-角色提示词.md:214-224、226-237`** 允许动作括号且要求一句一行，但未说明“动作只在显示层存在、TTS 不朗读”。应加作者提示：动作可写，但使用成对括号；未配对会触发 fail-closed 静音；`[emo: tag]` 是控制标签，不是台词。
8. **`docs/prompts/00-共同上下文.md:207-216`** 仍把解析器锚点和未接通链路写成旧 `CharacterModal` 单字符串事实；接线后应更新为 shared sanitizer + `CharacterTurnBuffer`，保留“提示词格式不是实测模型行为”的诚实警告。
9. `docs/tools/12-工具注册与路由统一.md` 的既有 `character_message` payload 不含 messageId；本篇没有擅自添加。若后续需要网络重复帧级幂等，必须由上位契约另立字段，不可在本篇偷偷猜一个 ID。

---

## 13. 仍未知 / 待拍板

1. **聚合纯函数是否与 `dialogue-pages.ts` 同文件**：本篇推荐同文件以保持测试直导、避免 React 依赖；若拆为 `character-turn.ts`，必须同步 import、测试和 `docs/tts/03` 落点。
2. **App 是否需要事件 queue 而非 latest-frame state**：当前 WS 事件通常分 macrotask 到达，但同步 burst 是否会被 React batching 合并尚未用真实模型验证。若探针证明会丢帧，必须在 `App.tsx:242-258` 改为 FIFO queue；不能以“通常不会”作为完整性保证。
3. **没有 messageId 时的网络重复帧**：上游当前只给 `character_message.text`，相同文本既可能是重复传输，也可能是两个合法 assistant message。本批不做内容去重；若产品要求前者幂等且保留后者，需上位契约提供稳定 message identity。
4. **共享 helper 对未知 `[emo: tag]` 的闭集口径**：建议移除任何行首 `[emo: lowercase]` 控制标签，再由 `parseEmoTag` 把未知 tag 降为 normal；若主评审要求未知标签原样显示，必须同时修正 parser/helper 分工，不能只改 TTS。
5. **长页与动作清洗后的视觉提示**：页面仍按原文逐字显示；server `truncated:true` 的视觉提示归演出文档，本篇不另造 UI 字段。
6. **角色 rail 对 `agent_activity` 的取消文案与淡出计时**：本篇只规定不进文本/TTS、按 `agentId` 隔离；UI、超时、并发堆叠归前端感知文档。

实现前，以上未知必须在评审记录中明确“已裁决”或“保留为已知限制”；不得把待拍板策略悄悄写成实现事实。
