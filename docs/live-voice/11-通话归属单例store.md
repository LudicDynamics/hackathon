# docs/live-voice/11 — 通话归属单例 store（`live-call-store.ts`）

> 状态：**设计文档（批次 L2，2026-09-15）**，作者 11 号。
> 上游契约：`docs/live-voice/10-对话框通话-共同上下文.md`（§2.1/§2.2/§2.3/§5.1/§5.3/§6，**必读全文**）、
> `docs/live-voice/00-共同上下文.md`（§2.3/§2.4/§2.9/§8/§15.4）。
> 兄弟文档：`12-CharacterModal 通话版面`（D2）、`13-门禁与回写.md`（D3）。
> 本文只覆盖**状态机与资源归属**；对话框版面归 12，门禁脚本归 13。
>
> **契约优先**：本文与 `10` 冲突时以 `10` 为准；本文发现的冲突记在 §12，不私改契约。

---

## 1. 一句话定位

把 `apps/web/src/lib/live-call.ts` 里**组件级**的 `useLiveCall`（资源在 `useRef`、字幕段在 `useRef`、卸载自动 `POST /api/live/close`）整体搬进新建的 `apps/web/src/lib/live-call-store.ts` 的 **module-level 单例**，让 nook 与角色对话框两个入口**读写同一份通话快照**，从而「至多一条通话」「跨入口自动一致」「卸载只挂断自己发起的那条」三条同时成立；`live-call.ts` 退化为**零副作用的薄 React 绑定**（re-export 4 个 hook + 类型）。

---

## 2. 签名参数

### 2.1 新建 `apps/web/src/lib/live-call-store.ts`（NEW）

```ts
/** 全局快照。未通话时 `characterId === null` 且 `phase === 'idle'`。（契约 10 §2.2） */
export interface LiveCallState {
  phase: 'idle' | 'connecting' | 'live' | 'error';
  /** 人类可读，由服务端 code 映射（`errorText`）。 */
  error?: string;
  /** 正在通话的角色 id；无通话时为 null。 */
  characterId: string | null;
  /** 发起方入口标识，取值见 §3.1。 */
  owner: string | null;
  inputText: string;
  outputText: string;
}

/** 角色真实台词（既有帧的投影，契约 10 §2.3）。 */
export interface LiveCallLines {
  streaming: string;
  lines: string[];
}

export interface StartCallOptions {
  characterId: string;
  locale: 'en' | 'ja';
  /** 发起方入口标识；`stop(owner)` 只在 owner 匹配时挂断。 */
  owner: string;
}

export interface LiveCallStore {
  subscribe(listener: () => void): () => void;
  /** 引用稳定：内容未变时返回**同一个**对象（§4）。 */
  getSnapshot(): LiveCallState;
  /** 引用稳定：同上。 */
  getLines(): LiveCallLines;
  /** 就绪门禁（`GET /api/live/config`）。未解析前 false。 */
  isAvailable(): boolean;
  /** NEW：幂等地触发一次就绪探测；`useLiveCallAvailable` 首次订阅时调用。 */
  ensureConfig(): void;
  /** 必须在用户动作里调用（getUserMedia）。已有别的角色通话时先 `stop()`。 */
  start(opts: StartCallOptions): Promise<void>;
  /**
   * 挂断。幂等。
   * - 不传 `owner`：关掉当前那条（无条件，用户显式挂断用）。
   * - 传 `owner`：**只在 owner 匹配时挂断**，否则不动也不报错（契约 10 §5.1）。
   */
  stop(owner?: string): Promise<void>;
  /** NEW：世界消失时同步自清，**不发任何网络请求**（§3.5）。 */
  clearAll(reason: 'world-unavailable'): void;
  /** NEW：惰性时钟（`TICK_MS = 250`），生产由定时器驱动，测试直接调。 */
  tick(now?: number): void;
}

/** 工厂 + 单例。工厂签名是测试缝（对齐 `createAgentActivityStore`）。 */
export function createLiveCallStore(deps?: LiveCallDeps): LiveCallStore;  // NEW
export const liveCallStore: LiveCallStore;                                 // NEW
export function resetLiveCallForTest(): void;                              // NEW
```

`LiveCallDeps`（NEW，测试缝，全部可选，缺省用真实实现）：

```ts
interface LiveCallDeps {
  now?: () => number;
  fetch?: typeof fetch;
  createPeerConnection?: () => RTCPeerConnection;
  getUserMedia?: (c: MediaStreamConstraints) => Promise<MediaStream>;
  createAudio?: () => HTMLAudioElement;
  /** 事件总线；缺省 `window`。测试注入内存实现。 */
  events?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
}
```

### 2.2 `apps/web/src/lib/live-call.ts`（保留，改写为薄绑定）

```ts
import { useSyncExternalStore } from 'react';
import { liveCallStore, type LiveCallState, type LiveCallLines, type LiveCallStore, type StartCallOptions } from './live-call-store.js';

export type { LiveCallState, LiveCallLines, LiveCallStore, StartCallOptions };

// ⚠️ 三参形式（见 §9.4）：`renderToStaticMarkup` 对使用 useSyncExternalStore 的
// 组件要求第三参 `getServerSnapshot`，否则抛 `Missing getServerSnapshot`。
// 体例照 useAgentActivity.ts:30-34 / play-hints.ts:34（本仓既有的三参写法）。
export function useLiveCallState(): LiveCallState {
  return useSyncExternalStore(liveCallStore.subscribe, liveCallStore.getSnapshot, liveCallStore.getSnapshot);
}
export function useLiveCallLines(): LiveCallLines {
  return useSyncExternalStore(liveCallStore.subscribe, liveCallStore.getLines, liveCallStore.getLines);
}
export function useLiveCallAvailable(): boolean {
  return useSyncExternalStore(liveCallStore.subscribe, liveCallStore.isAvailable, liveCallStore.isAvailable);
}
// store 的方法是模块级稳定引用，包一层只为让返回对象在重渲染间保持同一引用。
const ACTIONS = { start: liveCallStore.start, stop: liveCallStore.stop } as const;
export function useLiveCallActions(): Pick<LiveCallStore, 'start' | 'stop'> {
  return ACTIONS;
}
```

**为什么第三参就是 `getSnapshot` 本身**：单例 store 的快照是**进程内运行态**，没有「服务器渲染时该显示什么」的语义差异——SSR 只见 `phase:'idle'`（服务端本就不会通话），正是 `getSnapshot` 的返回值。故三参同体，和 `useAgentActivity.ts:32-33` 一样。

**钩子落在 `live-call.ts`、不落在 store 文件**：契约 10 §2.2 冻结 3 要求「store 无 React 依赖」，而 Store 接口里那些 hook 是**绑定层**的导出（契约 10 §6 的「落定」明确 `live-call.ts` 只 re-export 4 个 hook + 类型）。

### 2.3 常量（原样搬进 store，不导出）

`ICE_GATHERING_TIMEOUT_MS = 10_000`（`live-call.ts:64`）、`SESSION_START_TIMEOUT_MS = 20_000`（`:66`）、`SESSION_CLOSE_TIMEOUT_MS = 15_000`（`:68`）、新增 `TICK_MS = 250`（体例照 `agent-activity-store.ts:43`）。

---

## 3. 行为契约逐步

### 3.1 `owner` 的取值与语义（契约 10 §2.2 冻结 5）

**取值只有两种形态**，由**发起入口**写入，MUST NOT 由角色决定：

| owner | 发起方 | 写入点 |
|---|---|---|
| `nook:<characterId>` | nook 投影里的通话按钮 | `NookView.tsx:704-707` 的 `startCall()` 调用点改为 `start({ characterId, locale, owner: \`nook:${characterId}\` })` |
| `dialogue:<characterId>` | 角色对话框通话版面的「开始通话」 | `CharacterModal.tsx`（归 12 号） |

**语义（三条，缺一不可）**：

1. **`owner` 描述「谁开的」，不描述「谁能关」**。任何入口都可以用 `stop()`（无参）挂断当前通话——这支撑契约 10 §4.1「nook 可挂断对话框发起的那条通话」。
2. **`stop(owner)` 是生命周期守卫**：只在 `snapshot.owner === owner` 时挂断。owner 不匹配时**不动、不报错、不发网络请求**（幂等空操作）。这是支撑契约 10 §5.1「卸载只关自己发起的那条」的唯一机制。
3. **同角色接管（adopt）**：`start()` 时若已有通话且 `characterId` 相同，**只把 `owner` 改成新入口**并直接返回，**不重协商、不重开**。这样契约 10 §4.1 的「两个入口共享同一条通话」在快照上可观察（`owner` 变了，`characterId`/`phase` 不变）。

> **给 12 号的说明**：若对话框需要在 store 层暴露「当前通话角色」给 rail 过滤用，**不需要**——ActivityRail 直接吃 `character:<id>`（`CharacterModal.tsx:880` 既有用法），store 无需新增字段。

### 3.2 `start(opts)` 逐步

1. **用户动作门禁**：`start()` 只由点击路径调用（`NookView.tsx:704`）。**漏了会怎样**：`getUserMedia` 在挂载时跑 → 浏览器弹权限、静默开通话、按分钟计费（契约 10 §3.1 冻结 2 / `00` §2.9）。
2. **就绪门禁**：`!isAvailable()` → 记 `phase:'error'` + `error = errorText(new LiveClientError('unavailable'), locale)`，**直接返回**，不开麦克风。**漏了会怎样**：`available:false` 的服务器上仍会弹麦克风权限，随后在 `/api/live/session` 拿到 503——`00` §2.9 要求「不渲染入口」，store 这层还得再兜一次。
3. **重入短接 / adopt**：`phase ∈ {connecting, live}` 且 `characterId === opts.characterId` → **改 `owner` 后返回**（§3.1 第 3 条）。**漏了会怎样**：连点两次按钮开两条 WebRTC 连接，后端 `close(characterId)` 只收得掉一条，另一端成为孤儿 sideband。
4. **换角色先收**：`characterId` 不同且已有活跃通话 → `await stop()`（**无参**，无条件）。**漏了会怎样**：两路角色语音叠加，玩家分不清谁在说；且双倍计费（契约 10 §2.1 理由 1 与 3）。
5. **重置本地账面**：清空 `pendingInput/pendingOutput`、`pendingLines/pendingStreaming`、`startedGate`、`closedGate`；`commitState({ phase:'connecting', characterId, owner, inputText:'', outputText:'', error: undefined })`。**漏了会怎样**：上一通的字幕残留在新通话里（玩家听到的和看到的不是同一句）。

   ⚠️ **MUST 同步提交，不等 tick**（契约 10 §9「补充冻结」）：`phase`/`error`/`characterId`/`owner` 一律走 `commitState`（§4.3），**MUST NOT** 让它们经 250ms 惰性 tick。理由：`CharacterModal` 的 `callActiveRef.current = callActive`（12 号 `:811`）与 5 处 TTS 门（`:388/:400/:406/:555/:608`）**在同一事件循环内**读快照——若 `start()` 成功后要等一个 tick 才可见，那些调用点会在 store 更新前各触发一次，**漏掉一次 TTS 门**（通话中仍发 `/api/tts`，两路音频叠加）。同理第 10 步的 `setPhase('live')` 也是同步 `commitState`。
6. **取麦克风**：`navigator.mediaDevices?.getUserMedia` 缺失 → `LiveClientError('mic_unsupported')`；`NotAllowedError`/`SecurityError` → `mic_denied`；其余 → `mic_unsupported`（沿用 `live-call.ts:349-357`）。**漏了会怎样**：`err.name` 未分类会把「用户拒绝」报成「浏览器不支持」，玩家不知道去改权限。
7. **建 peer / audio / 数据通道**：顺序 MUST 与现状一致——**先 `pc.createDataChannel('oai-events')` 并挂 `message` 监听，再 `createOffer`**（`live-call.ts:377-386`）。**漏了会怎样**：`session.started` 可能在监听挂上之前到达，`start()` 白等 20s 后报连接失败。
8. **单发 SDP**：`await waitForIceGathering(pc, ICE_GATHERING_TIMEOUT_MS)` 后取 `pc.localDescription?.sdp`；为空 → `connection`。**漏了会怎样**：SDP 不带候选，走完 10s 超时仍失败（没有 trickle 通道）。
9. **`POST /api/live/session`**，body `{ character, sdp, language }`（键集冻结，`13 §2.2`）。**漏了会怎样**：`check:bodies` 报 `key-drift`。
10. **`setRemoteDescription({ type:'answer', sdp })`**，随后 `waitForSignalOrTimeout(startedGate, SESSION_START_TIMEOUT_MS)`。**只有 `session.started` 才把 phase 推到 `live`**；HTTP 200 不算（`live-call.ts:405-411`）。**漏了会怎样**：UI 显示「通话中」但媒体轨根本没通，玩家对着空气说话。

    这里用 **`commitState({ phase:'live' })`（同步）**，**MUST NOT** 经惰性 tick——与第 5 步的 ⚠️ 同一条（契约 10 §9「补充冻结」）。
11. **`audio.play()`**，失败吞掉（autoplay 被拦时字幕仍可见，`live-call.ts:412-414`）。
12. **任一步失败** → `releaseLocal()` + `fail(err)`。**但**若失败来自 `no_active_world`（`readJson` 已派发 `airp:world-unavailable`），**MUST 由 §3.5 的代次守卫吞掉这次 `fail`**。

### 3.3 `stop(owner?)` 逐步

1. `phase === 'idle'` → 返回（幂等）。
2. **owner 守卫**：传了 `owner` 且 `committed.owner !== owner` → **直接返回**（不动、不报错、不发请求，契约 10 §2.2 冻结 5）。
3. **向会话要 close**：数据通道 `readyState === 'open'` 时发 `{ type: 'session.close' }` 并 `await waitOrTimeout(closedGate, SESSION_CLOSE_TIMEOUT_MS)`。**漏了会怎样**：静默会话把挂断卡足 15s（或永久，若无超时）。
4. **`POST /api/live/close`**，body `{ character }`（键集冻结）。失败吞掉（`live-call.ts:448-456`）。**漏了会怎样**：服务端 handle 与 sideband 泄漏，下一通 `open()` 走 `closeAll()` 自愈但这通的钱已经花了。
5. `releaseLocal()`；把 `startedGate/closedGate` 收束；清空账面；`commitState` 置回 `phase:'idle'`（`inputText/outputText/error` 一并清空）。**漏了会怎样**：`NookView.tsx:732-753` 的「通话中」胶囊不会消失。

### 3.4 帧与字幕逐步（契约 10 §2.3）

1. **store 订阅 `window` 的 `airp:character-frame`**（单一监听，模块级，整个进程一份）。`useWorld.ts:786/801/818` 是唯一派发点。**MUST NOT 新开 WS、MUST NOT 新增帧名**（`00` §2.8）。
2. 过滤：`isCharacterFrame(detail)` 且 `detail.characterId === committed.characterId`，类型**正向**写成 `frame.type === 'character_delta' | 'character_message' | 'character_idle' | 'error'`（`13 §2.1` 要求正向以便门禁可读；`NookView.tsx:200-206` 同形）。`error` 是 `CharacterFrame` 联合的成员（`character-frame-queue.ts:8`，`source:'character'` 时合法）。**漏了会怎样**：别的角色的台词混进当前通话字幕。
3. 语义（前三条沿用 `NookView.tsx:199-207`，本批只搬不改）：`character_delta` → `pendingStreaming += delta`；`character_message` → `pendingLines.push(text)`、`pendingStreaming = ''`；`character_idle` → `pendingStreaming = ''`。三者都置 `linesDirty = true`、`armClock()`。**`error` 例外**——见第 6 步。
4. **不直接改 `committed`**：写进 `pending` 缓冲，`armClock()`，由 `tick()` 提交（§4）。**漏了会怎样**：逐 token 帧每个都 `notify()` → nook 与对话框每 token 各重渲染一次（契约 10 §2.3 的节流约束）。
5. **展示次序**（契约 10 §2.3，沿用 `NookView.tsx:759-792`）：`lines` → `streaming` → **仅当 `streaming === ''` 时** `outputText` → `inputText`。同一句不得打印两次。

6. **`error` 帧 → `committed.error`（本批新增，契约 10 §9.1(b) 裁决）**：当 `phase ∈ {connecting, live}` 且帧为 `error`（`source:'character'`）时：

```ts
commitState({ phase: 'error', error: detail.message });   // 同步，不走 tick
```

   - **文本直接用 `detail.message`**，不过 `errorText`：该帧的 `message` 由服务端拼好（`index.ts:101` 的 `onVisibleFailure` → `eventBridge.broadcast({ type:'error', source:'character', … })`），没有 `code` 可映射。
   - **MUST 同步** `commitState`（与 §3.2 第 5/10 步同一条），使 12 号的 `callAlert` 在同事件循环可见。
   - **仍要收通话**：`phase:'error'` 下 `stop()` 依旧有效（§3.3 第 1 步只短接 `idle`），玩家可挂断。
   - ⚠️ **依赖 12 号同批落地**：`callAlert` 在 `.call-stage` 内，而 `showCallPanel = callActive && characterId===id`（`callActive` 只在 connecting/live 为真）→ **`phase:'error'` 时整块不渲染**（契约 10 §9.1(a) 实测）。故 `12` MUST 把 `.call-stage` 的渲染条件放宽为 `showCallPanel || (call.phase === 'error' && call.characterId === characterId)`（命名建议 `callVisible`），否则本步写进去的 `error` **看不见**。**本 store 的 3 行照写；可见性由 12 负责。**
   - **漏了会怎样**：通话中角色 agent 死亡（`00` L-C2）时，玩家在 nook/对话框里**看不到任何原因**，只能看到全局 toast（且归因不明）——违反契约 10 §7「错误显示在可见位」与 `00` §5.7。

### 3.5 世界消失自清逐步（`409 no_active_world` / `airp:world-unavailable`）

**后端已做的一半**（已实测 2026-09-15，后端零改动）：

- 世界被外部删除（`world.json` 不在）→ `routes/world.ts:478-483` 中间件 `setActiveStore(null)` + `void liveCalls.closeAll()`；
- 成功 `loadWorld` → `routes/world.ts:593` `await liveCalls.closeAll()`；
- 无活跃世界时 `/api/live/session` 直接回 `409 no_active_world`（`routes/live.ts:84-91`，`needsWorld` 中间件先拦）；
- `live-session.ts:447-449` 的 `closeAll()` 逐个 `close(characterId)`，**不杀角色 agent**（`:429-444`）。

**前端自清落点（本文冻结）**：store **订阅 `airp:world-unavailable`**，回调同步执行 `clearAll('world-unavailable')`：

1. **不发任何网络请求**。后端该关的已经关了，再发一次 `POST /api/live/close` 只会得到 409（世界已不在）。
2. `clearAll` 释放本地资源（麦克风轨 / 数据通道 / peer / Audio），清空 `committed/pending*`，`++generation`，`disarmClock()`，`notify()`。
3. `airp:world-unavailable` 由两处派发（已实测）：`airp-gateway.ts:74`（网关 `request()` 命中 `no_active_world`，并置 `worldUnavailable = true` 供 `onWorldUnavailable` 重放）与 **store 自己的 `readJson`**（原 `live-call.ts:116-118`，随 `start()` 搬进 store）。两者都是**同步 `dispatchEvent`**，所以监听器在 `readJson` 抛出 `AirpRequestError` **之前**就已经跑完。
4. **代次守卫（关键）**：`start()` 开头捕获 `const gen = generation`；`catch` 分支里 `if (gen !== generation) return;` 再 `fail(err)`。**漏了会怎样**：`clearAll` 刚把快照清干净，`catch` 立刻把它改回 `phase:'error'` + `error:'The world is no longer open.'` —— 世界已经没了，对话框却显示一条属于旧世界的错误（契约 10 §5.1 要求世界切换 MUST 调 `stop(owner)`，且降级必须**正确归因**）。`stop()` 的收尾同样带这一守卫。
5. **`clearAll` 与 `stop()` 的区别**：`stop()` 会发 close 与「会话收」的等待；`clearAll` 只做本地清零。世界消失时**必须**走 `clearAll`，因为 socket 已经死了。
6. **`useWorld.ts:305-319` 的既有监听不动**（同一事件的另一消费者），store 只是**又一个订阅者**，不改任何既有文件的行为。
7. **`loadWorld`（用户主动切世界）路径**：`App.tsx:874-892` 会 `setNookChar(null)` + `frameQueue.clear('world-change')`，nook 卸载触发 §9.2 第 6 步的 `stop('nook:<id>')`；对话框路径由 12 号的关对话框时序覆盖。**store 不额外监听 `loadWorld`**——两条卸载路径已覆盖，多一条监听就是第二份真相。


---

## 4. 快照结构与不可变更新策略（**必做 2**）

### 4.1 问题陈述

`useSyncExternalStore` 用 `Object.is` 比对 `getSnapshot` 的返回（本仓文件头原话，`agent-activity-store.ts:1-11`）：

> "The list reference only changes when the list really changes, which is what `useSyncExternalStore`'s `Object.is` check needs — and what keeps the 250ms tick from re-rendering an idle rail."

两个约束同时成立才正确：**① `getSnapshot` 反复调用必须返回稳定引用**（否则 `Object.is` 判「变了」→ 无限重渲染）；**② 字幕节流期间引用不许变**（否则节流白做，每 token 还是重渲染）。二者只有一个解：**快照对象只在内容真变时换引用。**

### 4.2 结构

```ts
// module 级闭包内（createLiveCallStore 的 let 变量，不在快照里）
const IDLE: LiveCallState = {                 // 模块常量，反复复用
  phase: 'idle', characterId: null, owner: null, inputText: '', outputText: '',
};
const EMPTY_LINES: LiveCallLines = { streaming: '', lines: [] };
let committed: LiveCallState = IDLE;          // 只读快照，永不原地改
let committedLines: LiveCallLines = EMPTY_LINES;

let inputCommitted = '';                      // 已提交的转写（用于判真变）
let outputCommitted = '';
let pendingInput = '';                        // 可变缓冲（数据通道累积）
let pendingOutput = '';
let pendingStreaming = '';                    // 帧累积（streaming）
let pendingLines: string[] = [];              // 帧累积（已提交台词）
let linesDirty = false;
```

**不变式**：

- `committed` / `committedLines` **只被整体替换**，从不原地 `push`/改字段——否则「引用没变但内容变了」会让 `Object.is` 判没变，UI 不更新。
- `getSnapshot: () => committed`、`getLines: () => committedLines`——**纯读，零分配**（不是 `() => ({...})`）。
- idle 时永远返回常量 `IDLE` / `EMPTY_LINES`，避免「无通话」也制造新对象。
- 两个 hook 各读各的（`useLiveCallState` 读 `committed`，`useLiveCallLines` 读 `committedLines`）——字幕高频、状态低频，分开订阅可避免字幕 tick 唤醒只关心 phase 的组件。

### 4.3 提交时机（两档）

| 变更 | 时机 | 理由 |
|---|---|---|
| `phase` / `error` / `characterId` / `owner` | **同步** `commitState(patch)` | 低频、玩家据此做决定（按钮态、错误提示）；延迟 250ms 会看起来卡住 |
| `inputText` / `outputText`（数据通道逐 token） | **`tick()`** | 契约 10 §2.3 的节流对象 |
| `streaming` / `lines`（既有帧，逐 token） | **`tick()`** | 同上 |

```ts
function commitState(patch: Partial<LiveCallState>): void {
  const next = { ...committed, ...patch };
  if (isSameState(next, committed)) return;   // 六字段浅比较，避免空唤醒
  committed = next;
  notify();
}
```

### 4.4 `tick(now)` —— 惰性时钟（契约 10 §2.3 冻结体例；见 §9.3）

```ts
const TICK_MS = 250;                          // 体例照 agent-activity-store.ts:43

function tick(now: number = deps.now()): void {
  // 1) 转写（数据通道）
  if (pendingInput !== committed.inputText || pendingOutput !== committed.outputText) {
    committed = { ...committed, inputText: pendingInput, outputText: pendingOutput };
    notify();
  }
  // 2) 角色真实台词：只在内容真变时换引用
  if (linesDirty) {
    committedLines = { streaming: pendingStreaming, lines: pendingLines.slice() };
    //                                        ↑ 唯一一次数组拷贝，且只在真变时发生
    linesDirty = false;
    notify();
  }
  if (!hasClockWork()) disarmClock();         // 无待提交内容即停表（idle 不空转）
}

function hasClockWork(): boolean {
  return pendingInput !== committed.inputText
      || pendingOutput !== committed.outputText
      || linesDirty;
}
```

`armClock()` 在 ingest 到任何字幕内容时调用；`hasClockWork()` 为假时 `disarmClock()`——与 `agent-activity-store.ts:56-67` 的 `armTimer/disarmTimer` 同形（`setInterval(() => tick(), TICK_MS)`）。

**关键性质（可测）**：一次 tick 之间，`getSnapshot()`/`getLines()` 返回**同一个引用**；内容没变时 `tick()` **一次 `notify()` 都不发**。测试直接 `store.tick(1000)`，**不需要真定时器、不需要 rAF**——这是选型的核心收益。

> 注：`now` 参数在本 store 里**不参与计算**（无 TTL 推进）。保留它只为与 `agent-activity-store.tick(now)` 同形，且给未来可能的「连接超时推进」留缝；若评审认为无用，可去掉参数——**不影响任何契约**。

### 4.5 帧监听与节流的关系

§3.4 的帧处理**只写 `pending*` 并置 `linesDirty`**，绝不 `notify()`：

```ts
function onCharacterFrame(event: Event): void {
  const detail = (event as CustomEvent).detail;
  if (!isCharacterFrame(detail)) return;
  if (detail.characterId !== committed.characterId) return;
  if (detail.type === 'character_delta') pendingStreaming += detail.delta;
  else if (detail.type === 'character_message') { pendingLines.push(detail.text); pendingStreaming = ''; }
  else if (detail.type === 'character_idle') pendingStreaming = '';
  else if (detail.type === 'error') {
    // §3.4 第 6 步：不缓冲、同步提交，使 12 号的告警位同事件循环可见。
    if (committed.phase === 'connecting' || committed.phase === 'live') {
      commitState({ phase: 'error', error: detail.message });
    }
    return;
  } else return;
  linesDirty = true;
  armClock();                                 // 不 notify；tick 才 notify
}
```

**漏了会怎样**：若在 ingest 里直接 `notify()`（现状 `NookView.tsx:200-202` 每帧一次 `setState`），nook 与对话框两个订阅者每 token 各重渲染一次；nook 里还挂着画布与足迹调度器（`NookView.tsx:416-418`），代价被放大。

### 4.6 `applyTranscriptDelta` 与 `CaptionSegment` 的取舍

数据通道分派（原 `live-call.ts:274-305`）搬到 store，`session.input_transcript.delta` / `session.output_transcript.delta` → 纯字符串拼接进 `pendingInput`/`pendingOutput`。

**`CaptionSegment`（`live-call.ts:32-36`）删除**：它攒 `start_ms`/`end_ms` 只「供诊断」（`:251-256` 的 JSDoc 原话 "are retained alongside the text for diagnostics"），**全仓无一读取点**（已实测 grep：`startMs`/`endMs` 仅出现在 `live-call.ts` 自身的定义与赋值处）。判定依据不是它无用，而是它是唯一一处「攒了从不读」的状态——搬进单例后它会被永久持有（进程寿命），成为纯负担。**展示文本是 delta 的精确拼接，与现状等价**（`segments.map(p => p.delta).join('')` == `+=`）。**若将来确需时间边界**，正确做法是让服务端 sideband 把它写进会话 jsonl（真相源），而不是在前端攒。


## 5. 文件与副作用

| 文件 | 动作 | 副作用 |
|---|---|---|
| `apps/web/src/lib/live-call-store.ts` | **NEW** | 模块级单例；一个全局 `airp:character-frame` 监听、一个 `airp:world-unavailable` 监听、一个 250ms 定时器（惰性）、三个 `fetch`（`/api/live/config`、`/api/live/session`、`/api/live/close`） |
| `apps/web/src/lib/live-call.ts` | 改写（**542 行** → 约 40 行） | **零副作用**：无 `fetch`、无监听、无定时器；只 re-export |
| `apps/web/src/components/nook/NookView.tsx` | 改读 store（归本批 D1；注意在途改动） | 删本地 `callLines` state 与 `handleCharacterFrame`（`:195-212`）；新增 owner 卸载 effect |
| `apps/web/src/components/overlay/CharacterModal.tsx` | 归 12 号 | 通话版面 + `stop('dialogue:<id>')` 时序 |
| `apps/web/src/lib/messages.json` | 归 12 号 | 无 |

**副作用清单（store 的全部）**：`window.addEventListener` × 2（`airp:character-frame`、`airp:world-unavailable`）、`setInterval` × 1（250ms，惰性）、`fetch` × 3（其中 `/api/live/config` 只发一次）、`getUserMedia` × 1（每次 start）、`new RTCPeerConnection()`/`new Audio()` × 1（每次 start）。**无 DOM 渲染副作用、无定时器泄漏**（disarmClock 覆盖）。

**MUST NOT**：`apps/server/**`、`packages/shared/**`（本批后端零改动，契约 10 §6）；`App.tsx`/`NookView.tsx` 的在途行段（`worldId` / `NookPortrait` / chrome 隐藏）。

---

## 6. 落账

- **store 自己不落任何盘**。通话的真相仍由后端写：角色回合进 `.airpworld/sessions/char-<id>.jsonl`（`00` §10.5 验收），世界改动走动作层 + `world_event`/`file_changed`（不变量 3）。
- **快照是进程内运行态**，与 `agent-cursor.ts:409` / `overlay-admission.ts:26` 同级，**MUST NOT** 成为第二份全局真相、新 WS 帧或世界文件（契约 10 §2.1 的 MUST NOT）。
- **账目边界**（store 内部，生产不读）：
  - `generation: number` —— `start()` 时递增，`clearAll()`/`stop()` 收尾时递增；唯一用途是 §3.5 的代次守卫。
  - `armed: boolean` —— 是否开过 peer（对应现状 `armedRef`，`live-call.ts:186-187`），只用于「从未通话的卸载不发 close」。
  - `startedGate` / `closedGate` —— `{ promise, resolve }` 一次性闸门，替代 `startedRef`/`closedRef`（`live-call.ts:183-184`）。
  - `activeLocale: 'en' | 'ja'` —— 由 `StartCallOptions` 带入，供 `errorText` 用（现状是 hook 参数）。
- **不落账的**：`inputText`/`outputText`/`lines` 一律**不持久化**（挂断即清，§3.3 第 5 步）。**漏了会怎样**：下一次通话显示上一次的台词，玩家无法区分轮次。

---

## 7. WS 前端（帧消费面）

- **零新增帧名**（`00` §2.8 / 契约 10 §8 反模式 4）。store 消费既有四帧 `character_delta` / `character_message` / `character_idle` / `error`，由 `useWorld.ts:786`（error 帧 `:801`、turn_aborted `:818`）派发的 `airp:character-frame` 中继送达。**`error` 的消费是本批新增的 3 行**（§3.4 第 6 步），不是新帧——`error` 早已在契约表内。
- **登记面（归 13 号，本文确认口径）**：
  - `check-ws-contract.mjs:48-59` 的 `CONSUMERS` **增列** `apps/web/src/lib/live-call-store.ts`，**保留** `:57` 的 `live-call.ts` 那行——扫描是逐文件 `read(rel)`（`:183`），文件存在即安全；`live-call.ts` 薄绑定后贡献 0 帧，但登记的价值在将来（`13 §2.1`）。
  - store 里帧过滤用**正向** `frame.type === 'character_delta'`（门禁可读，`13 §2.1` 冻结）；数据通道分派**保持带点** `case 'session.started'`（否则 `consumedFrom`，`:136-146`，把 `'started'` 读成帧名 → 假 ghost）。
  - **新基准（本批生效，契约 10 §9.1 已实跑）**：`clean (27 emitted, 25 consumed, 27 in contract)`。`consumed` 从 L 批的 24 抬到 25——净新增仅 `writer_message`（`writer-state.ts` 增列），**与本 store 无关**；store 的新帧字面量与 `useWorld` 同名去重，贡献 0 新增。**MUST NOT** 写成「输出不变」（那句在基准更新后已失效）。
- **`check-request-bodies.mjs`**：三个 `fetch` 随 `start/stop` 搬进 store → `:101-105` 与 `:107-111` 两处 `BODIES.file` **MUST 改为 `apps/web/src/lib/live-call-store.ts`**（键集与 `doc` 不动，`BODIES.length` 仍 11）。**本文确认这是 11/13 的共同结论**（`13 §2.2`）；薄绑定后 `live-call.ts` 不可能再持有 `start`/`stop`，故 `file` 必改——否则 `bodyKeysFor` 回 `null` → `compare` 报 2 条 `missing-call`（`check-request-bodies.mjs:224`）。
- ⚠️ **`GET /api/live/config` 刻意不登记**（脚本头注释 `:32-35`、`:97-99` 即此口径）；它由 `ensureConfig()` 发起，`bodyKeysFor` 扫不到也不报错。
- **`live-call.ts` 保留与否**：见 §9.4（**必须保留为薄绑定**，三条理由 + 反方成本）。

---

## 8. 错误边界

沿用 `00` §8 与契约 10 §7，**一条不改**。store 侧的具体兑现：

| 失败 | store 行为 | 落点 |
|---|---|---|
| `available:false` | `start()` 立即 `fail(LiveClientError('unavailable'))`，`error` = `liveErrorUnconfigured` | `errorText`（原 `:528-542`） |
| 麦克风被拒 | `commitState({ phase:'error', error: mic_denied 文案 })`，**留在错误态**（不静默回 idle） | `start()` 第 6 步 |
| `character` 非法 / nook 不存在 | `AirpRequestError` → `ERROR_COPY_KEYS` 映射（`invalid_argument` → `liveErrorRequest`，`not_found` → `liveErrorCharacter`） | `readJson` + `errorText` |
| `409 no_active_world` | `readJson` 派发 `airp:world-unavailable` → store 自清；**代次守卫吞掉 `fail`** | §3.5 |
| sideband 挂不上（`502 sideband_failed`） | 服务端已零残留（`live-session.ts:397-409`）；前端 `AirpRequestError` → 无映射键 → `liveErrorGeneric`；通话收掉 | `readJson` + `errorText` |
| 通话中角色 agent 死亡 | 既有 `error` 帧（`source:'character'`）经 `useWorld.ts:801` 进 `airp:character-frame`；store **本批消费它**（见 §12-C4 的裁决修正） | §3.4 第 6 步 + §12-C4 |
| 挂断时会话已断开 | `waitOrTimeout` 15s 上限；`POST /api/live/close` 失败吞掉（`live-call.ts:448-456`） | `stop()` 第 3-4 步 |

**MUST NOT**：用 `console.warn` 当失败可见（`docs/tools/00` 硬约束 4）。所有失败都经 `errorText` → `committed.error` → 两个 UI 的 `role="alert"`（`NookView.tsx:741-747` / 12 号的对话框）。

**`available` 探针失败也是「不可用」**：`ensureConfig()` 的 `catch` 置 `available = false`（沿用 `live-call.ts:221-223`）。**漏了会怎样**：网关不通时 `available` 停在初始 `false` 与「探测失败」同值——行为一致，但若中途从 true 变 false，需 `notify()` 才能让两个入口同时隐藏按钮。

---

## 9. 代码落点（精确到文件与函数）

### 9.1 逐个函数迁移映射表（**必做 1**）

| # | 现有符号（`apps/web/src/lib/live-call.ts`） | 行 | store 内新形态 | 说明 |
|---|---|---|---|---|
| 1 | `useLiveCall(opts)` | `:163-489` | **删除**，拆成 store 单例 + `live-call.ts` 的 4 个 hook | 组件级 → 模块级 |
| 2 | `interface CaptionSegment` | `:32-36` | **删除** | 只攒不读 → §4.6 |
| 3 | `interface LiveConfig` | `:47-53` | 原样搬 | `/api/live/config` 响应形状 |
| 4 | `interface LiveSessionResponse` | `:55-61` | 原样搬 | `/api/live/session` 响应形状 |
| 5 | `ICE_GATHERING_TIMEOUT_MS` | `:64` | 原样搬（不导出） | 10s |
| 6 | `SESSION_START_TIMEOUT_MS` | `:66` | 原样搬 | 20s |
| 7 | `SESSION_CLOSE_TIMEOUT_MS` | `:68` | 原样搬 | 15s |
| 8 | `ERROR_COPY_KEYS` | `:72-80` | 原样搬 | code → `UI_COPY` 键 |
| 9 | `class LiveClientError` | `:83-90` | 原样搬（不导出） | 四码 |
| 10 | `numOrUndefined` | `:92-94` | **删除** | 仅服务 `CaptionSegment` |
| 11 | `readJson<T>(response)` | `:106-122` | 原样搬，**保留** `no_active_world` → `airp:world-unavailable` 派发 | `start()`/`ensureConfig()` 共用 |
| 12 | `waitForIceGathering(pc, ms)` | `:130-155` | 原样搬 | 单发 SDP |
| 13 | 就绪 effect（config 探测） | `:215-231` | `ensureConfig()` + `useLiveCallAvailable()` | 幂等、去重 in-flight |
| 14 | `airp:character-frame` effect | `:233-249` | store 构造期**挂一次**的模块监听 `onCharacterFrame` | store 无 React |
| 15 | `frameHandlerRef` + `onCharacterFrame` 回调 | `:196-197`、`:163-167` | **删除**：改为 `getLines()` 快照 | NookView 不再自建 lines |
| 16 | `setPhase` | `:199-202` | `commitState({ phase, error: phase === 'error' ? keep : undefined })` | 同步提交 |
| 17 | `fail(error)` | `:204-210` | `fail(error)` 内部调 `errorText` + `commitState` | 带 §3.5 代次守卫 |
| 18 | `applyTranscriptDelta(channel, message)` | `:258-270` | 写 `pendingInput`/`pendingOutput` + `armClock()` | 节流 |
| 19 | `onDataChannelMessage(event)` | `:274-305` | 原样搬（带点 case 保持） | 两个闸门由 ref 改闭包变量 |
| 20 | `teardownLocal()` | `:308-328` | `releaseLocal()`（同逻辑，改名） | 停轨、关 dc/pc、清 audio、`armed = false` |
| 21 | `start` | `:330-420` | `store.start(opts)` | 见 §3.2 |
| 22 | `stop` | `:422-466` | `store.stop(owner?)` | 见 §3.3；**新增 owner 守卫**（现状无） |
| 23 | 卸载 effect（自动 close） | `:469-486` | **删除**；由**调用方**卸载时 `stop(owner)` | 契约 10 §5.1 |
| 24 | `waitOrTimeout(promise, ms)` | `:494-508` | 原样搬 | 永不 reject |
| 25 | `waitForSignalOrTimeout(promise, ms)` | `:512-525` | 原样搬 | 返回 boolean |
| 26 | `errorText(error, locale)` | `:528-542` | 原样搬（store 内 `activeLocale`） | locale 由 `StartCallOptions` 带入 |
| 27 | 三个 `fetch` | `:219`、`:395`、`:449`/`:478` | store 内 | `:478` 的 `keepalive` 兜底**保留**，但只在 owner 匹配时发 |
| 28 | `LiveCallState`（4 字段） | `:39-45` | 搬进 store，**扩到契约 10 §2.2 的 6 字段** | 新增 `characterId` / `owner` |
| 29 | `TICK_MS` + `tick(now)` | — | **NEW** | §4.4 |
| 30 | `clearAll(reason)` | — | **NEW** | §3.5 |
| 31 | `ensureConfig()` | — | **NEW** | §2.1 |
| 32 | `createLiveCallStore(deps)` / `resetLiveCallForTest()` | — | **NEW** | 测试缝，体例照 `agent-activity-store.ts:45`/`:192-195` |

**迁移总量核对**：现状 **542 行**的**全部**符号在表内有归宿——**28 行**现有符号（含题目点名的 14 个：`useLiveCall`、`teardownLocal`、`start`、`stop`、`onDataChannelMessage`、`applyTranscriptDelta`、`waitForIceGathering`、`waitOrTimeout`、`waitForSignalOrTimeout`、`errorText`、`readJson`、`LiveClientError`、`ERROR_COPY_KEYS`、三个常量）**全部**在表中，**无遗漏符号**；另 **4 项新增**（`TICK_MS`+`tick`、`clearAll`、`ensureConfig`、工厂/重置缝）。生产路径上由 `useLiveCall` 一个 hook 变为「1 个单例 + 4 个 hook」。

> ⚠️ **行锚更正（2026-09-15，评审 MagicLoon 实测，主 agent 复核）**：本表初版有 12 处行号尾部错（`LiveCallState :39-43→39-45`、`LiveConfig :45-51→47-53`、`LiveSessionResponse :53-59→55-61`、`readJson :106-120→106-122`、`useLiveCall :163-491→163-489`、就绪 effect `:215-231→215-229`、`applyTranscriptDelta :258-272→258-270`、`teardownLocal :308-327→308-328`、`start :330-416→330-420`、`stop :422-457→422-466`、`waitForSignalOrTimeout :512-525→512-526`、`errorText :528-543→528-542`），并把全文行数 **543 误写为 542**（实为 542，本行已改）。**符号归宿本身零遗漏**（14 个点名符号全在表内），错的只是尾部行号——**但行号是下游唯一入口，错一行就改错行**。
>
> **NookView 行锚的偏移不统一，MUST NOT 套用「+20」**（评审 MagicLoon 实测）：守卫 `217-226`→**194-206**；`callLines` 处理 `195-207`→**176-188**；hook 调用 `208-212`→**189-193**；`startCall` `705`→**690**；`stopCall` `706`→**691**；`import` `11`→**12**。**实现前现读现用，MUST NOT 照抄本文任何行号。**

### 9.2 `NookView.tsx` 的落点（仅通话相关行段）

1. `:11` `import { useLiveCall }` → 改 4 个 hook（路径不变，仍 `live-call.js`）。
2. `:195-207`（`callLines` state + `handleCharacterFrame`）**删除**；改 `const callLines = useLiveCallLines();`。
3. `:208-212` → `const call = useLiveCallState(); const callAvailable = useLiveCallAvailable(); const { start: startCall, stop: stopCall } = useLiveCallActions();`
4. `:705` `void startCall()` → `void startCall({ characterId, locale: locale === 'ja' ? 'ja' : 'en', owner: \`nook:${characterId}\` })`。
5. `:706` `void stopCall()` → **无参**（用户显式挂断，可挂断对话框发起的那条，契约 10 §4.1）。
6. **新增** owner 卸载 effect：

```ts
useEffect(() => () => { void stopCall(`nook:${characterId}`); }, [characterId, stopCall]);
```

7. **守卫放宽（契约 10 §4.3 冻结，评审 F3 补入）**：`:213-225` 的 `handleOpenCharacterModal` 守卫 MUST 从「任何通话中」放宽为「**同一角色**在通话」：

```ts
const callInProgress = call.phase === 'connecting' || call.phase === 'live';   // 保持
const sameCharacterOnCall = callInProgress && call.characterId === id;        // 放宽点
// setNotice(copy.liveCallModalBlocked) + return 只在 sameCharacterOnCall 时执行
```

   - **为什么必须改**：L 批的 `call.phase` 是 nook 自己的组件 state，`callInProgress` 天然只指当前角色。L2 单例后 `call` 是**全局快照**，`callInProgress` 退化为「**任何**角色在通话」→ 会挡住**所有**角色的对话框，与契约 10 §4.1 第 3 条直接冲突。
   - **漏了会怎样**：角色 A 通话中，玩家点角色 B 的头像 → 被 `liveCallModalBlocked` 挡住，提示还写「通话中不能打开对话」（其实是 A 在通话，与 B 无关）。**误挡 + 归因错误**。
   - **不违反 §4.2 的互斥**：互斥粒度是**角色**（与后端 `live-session.ts:382-386` 的「每角色至多一条」同粒度）；点 B 的通话按钮时 store 的 §2.2 冻结 1 会先挂断 A。
   - **MUST NOT** 在 `App.tsx` 的 admissions 层另加守卫——那会变成第二处真相（契约 10 §4.3 明确）。

**漏了会怎样（第 6 条）**：离开 nook 投影后通话续存 = 静默计费（契约 10 §2.2 冻结 5 / `00` §2.9）。

**注意在途改动**：`NookView.tsx` 当前有别的会话在改 `NookPortrait`/`worldId`/chrome 隐藏。本批**只动上述 7 段行**，MUST NOT 抢占其他行。且引用的行锚（`:195`/`:208`/`:213`/`:705`）**偏移约 +20 行**（契约 10 §4.3 配套校验，评审 F9）——实现前 MUST 按当时工作树重锚，**MUST NOT 照抄本文件行号**。

### 9.3 节流选型：250ms 惰性 tick（**契约 10 §2.3 已冻结**）

契约 10 §2.3 **已冻结**为「照 `agent-activity-store.ts` 的 **250ms 惰性 tick** + 只在内容真变时换引用」体例（`10:129` 的原文）。**本文的实现与契约一致，不是偏离。**（初版本文按更早的「rAF 或 ~50ms 合并」措辞把 250ms 记为偏离，该措辞已被契约更新取代；评审 F7 已核。）

选型理由三条（为什么这个体例是对的，而非「我们在偏离契约」）：

1. **有测试先例且可测**：`agent-activity-store.ts:100` 的 `tick(now)` 被测试**直接调用**（`agent-activity.test.mjs` 整组都这么跑），无需真定时器/rAF。rAF 在 Node 测试环境里不存在，会把节流路径变成不可测。
2. **引用稳定有既有保障**：`agent-activity-store.ts:1-11` 的文件头注释把「引用只在真变时换」这条不变量写明了，且全仓已照此跑了很久（`dice-ceremony.ts` / `writer-state.ts` 同形）。照抄=零新增风险。
3. **与成本/体验无冲突**：250ms 是最坏情况下的字幕延迟，帧本身仍**逐 token 累积**（`pendingStreaming += delta`），只是提交合并。目的是「限制重渲染频率」，250ms 满足且更省（idle 停表）。

**§4 的引用稳定约束与本节一致**——这是本节真正的结论。

### 9.4 `live-call.ts` 保留为薄绑定还是删除？（**必做 5**）

**结论：保留为薄绑定（约 40 行），不删除。** 三条理由，逐条可核验：

1. **`tools/check-ws-contract.mjs:57` 已把它登记为 CONSUMER**，且 `:54-56` 的注释**已按其当前语义写明**（「The hook filters `character_delta`; NookView branches on all three」）。删文件 → 该行指向不存在的文件 → `read(rel)` 抛 `ENOENT`（`:183` 无 try）→ **`check:ws` 直接崩，而不是报 finding**。保留文件、让那行贡献 0 帧，是 `13 §2.1` 的落定，也是唯一不使门禁崩溃的形态。
2. **`check-request-bodies.mjs` 的两处 `file`（`:101-108`）改成指向 store** 后，`live-call.ts` 不再需要持有 `fetch`——所以它**可以**做到零副作用；这与「store 无 React 依赖」互补：**store 无 React，绑定层无副作用**，职责正交。
3. **保留 = 调用方 import 路径不变**（`NookView.tsx:11` 仍 `from '../../lib/live-call.js'`，12 号的对话框同样）。删文件要把所有 import 改指 `live-call-store.js`，而 store 文件**会从 React 的视角导出 hook**——那正好违反契约 10 §2.2 冻结 3「store 无 React 依赖」（要么 store import React，要么 workspace 出现一个「名字叫 store 但住着 hook」的文件）。

**反方（删除）的成本**：① 改 `check-ws-contract.mjs:57` 一行（可做，但那是 13 号的文件）；② 两个组件的 import 路径各改一行；③ 门禁「历史登记」的那行注释语义要重写。**收益**：少一个文件。**判定：收益不足以覆盖①的门禁崩风险与「store 里不能有 React」的选址纠缠**——保留。

**薄绑定 MUST 保持零副作用**：除 `useSyncExternalStore` 外不得有监听/定时器/fetch。**绑定体例是三参形式**（`getServerSnapshot` = `getSnapshot`，见 §2.2 与 §11.2）：本仓既有的三参先例是 `useAgentActivity.ts:30-34` 与 `play-hints.ts:34`；**`agent-cursor.ts:412` 是两参**，生产可用，但 `renderToStaticMarkup` 下会抛 `Missing getServerSnapshot`——本批**取三参**，故不引它作体例。**判定依据**：一旦 `live-call.ts` 有任何副作用，`check-request-bodies` 的 `file` 指针就又该指回来了，§9.4 的整个论证失效。

---

## 10. 与现状差异（汇总）

| 维度 | 现状 | 本批 | 影响面 |
|---|---|---|---|
| 资源所有权 | 组件 `useRef`（`live-call.ts:174-187`） | store module 变量 | 两个入口共享一条通话的前提 |
| 快照 | 组件 `useState`，每次逐 token `setState` | module `committed` + 250ms 惰性 tick | 重渲染频率 ↓ |
| `characterId` | hook 参数，绑组件生命周期 | 快照字段，跨组件存活 | 契约 10 §4.1 自动一致 |
| 字幕 | 组件 state + `onCharacterFrame` 回调 | store `getLines()` | NookView 删 state |
| 帧监听 | 组件 effect，随组件挂卸 | 模块级挂一次 | 一个进程一个监听 |
| 卸载 | 无条件 `POST /api/live/close`（`:469-486`） | 按 owner 判定后 close | 契约 10 §5.1 |
| 世界消失 | 仅 `readJson` 转发 DOM 事件，**无人消费** | store 订阅并自清 + 代次守卫 | 契约 10 §5.1、`00` §2.4 冻结 3 |
| 节流 | 无（每帧 notify） | 250ms 惰性 tick（**契约 10 §2.3 已冻结**体例，§9.3） | 无需偏离说明 |
| `CaptionSegment` | 攒 `start_ms`/`end_ms`，从不读 | 删除 | §4.6 |
| `live-call.ts` | **542 行**，含状态机 + 资源 + 两个 fetch | ~40 行纯 re-export（§9.4） | 门禁 `file` 指向 store |
| `LiveCallState` | 4 字段（`00 §15.4`） | 6 字段（契约 10 §2.2：+`characterId`/`owner`） | `00 §15.4` 的旧形状作废（契约 10 §1 的表未列这条——见 §12-C2） |

**行为不变的部分（MUST NOT 顺手改）**：三个常量、`ERROR_COPY_KEYS` 映射、`readJson` 的 err 处理、`waitForIceGathering` 的单发策略、数据通道分派语义、`errorText` 的 fallback 链、`start()` 的 12 步次序、`stop()` 的 close 次序。

---

## 11. 验收测试（**必做 6**）

> ⚠️ **实测前提（2026-09-15，主 agent 确认）**：`apps/web/test/` 下 **`CharacterModal` 与 `live-call.ts` 目前零单元测试**（grep 无命中）。所以下列断言**全部需要新建测试文件**，不得引用不存在的既有测试。
>
> **新建文件**：`apps/web/test/live-call-store.test.mjs`（体例照 `agent-activity.test.mjs`：`jiti` 动态 import TS 源码 + `node:test` + 零 React/DOM）。
> **可借鉴体例**：`voice-engine.test.mjs`（jiti import TS + 纯函数断言）、`agent-activity.test.mjs`（store + `tick(now)` 直调）、`audio-volume.test.mjs:9-32/103-151`（**注入 `globalThis.window`/`globalThis.fetch` 的 stub 后 finally 还原**——store 的 `deps` 缝就是为替代这套 stub 而设计）。

### 11.1 可机械核验的断言

| # | 断言 | 怎么测 | 证明什么 |
|---|---|---|---|
| A1 | **单例**：`liveCallStore === liveCallStore`，且 `createLiveCallStore()` 两次得到互不影响的实例 | 两次 `store.getSnapshot()` 是**同一引用**；`Object.is(snapshot, snapshot)` 为 true | `getSnapshot` 引用稳定（§4） |
| A2 | **至多一条通话**：`start({A})` 后 `start({B})`，`getSnapshot().characterId === 'B'` 且 `phase !== 'idle'` 只有一个角色 | 注入 fake `getUserMedia`/`RTCPeerConnection`（deps），数 `createPeerConnection` 调用次数；断言第一次 `stop()` 已跑（计数 close fetch = 1） | 契约 10 §2.1、§2.2 冻结 1 |
| A3 | **两个入口共享同一条通话（核心）**：`start({characterId:'nanami', owner:'nook:nanami'})` 成功后，再 `start({characterId:'nanami', owner:'dialogue:nanami'})` → **不新建 peer、不重发 `/api/live/session`**，且 `owner` 变为 `'dialogue:nanami'` | 数 `createPeerConnection` = 1、`/api/live/session` POST = 1；断言 `snapshot.owner === 'dialogue:nanami'` 而 `characterId`/`phase` 不变 | 契约 10 §4.1「两个入口自动一致」——**这条即「两个入口共享同一条通话」的证明** |
| A4 | **owner 不匹配时不挂断**：`start({owner:'nook:x'})` 后 `stop('dialogue:x')` → `phase` 不变、close fetch 计数 = 0、无异常抛出 | 断言 `phase` 与调用前一致；断言 fetch spy 收到 0 次 `/api/live/close` | 契约 10 §2.2 冻结 5、§5.1 |
| A5 | **owner 匹配时挂断**：`stop('nook:x')` → `phase:'idle'`、close fetch = 1、本地资源全释放（轨 `stop()` 被调） | 断言 fake track 的 `stop()` 调用数 = 1；`characterId === null` | §3.3 |
| A6 | **`stop()` 无参无条件**：`start({owner:'dialogue:x'})` 后 `stop()` → 挂断 | 断言 `phase:'idle'` | 契约 10 §4.1（nook 挂断对话框那条） |
| A7 | **字幕节流：同帧引用不变** | 注入 3 次 `airp:character-frame`（`character_delta`）；`getLines()` 在三次之间**返回同一引用**；调 `tick(1000)` 后引用变化且 `streaming === 'abc'` | 契约 10 §2.3、§4.4 |
| A8 | **`tick()` 内容未变时不换引用、不 notify** | 记录 `subscribe` 回调调用次数；连调两次 `tick()` → 第二次 0 次 notify，引用不变 | §4.4「idle 不空转」 |
| A9 | **`lines` 只在真变时换引用** | `character_message` 后 `tick()` → `lines.length === 1`；再 `tick()` → **同一引用** | §4.2 不变式 |
| A10 | **世界消失自清**：派发 `airp:world-unavailable` 后 `phase === 'idle'`、`characterId === null`、**close fetch 计数 = 0** | 派发 DOM 事件后断言；fetch spy 只应看到 0 次（后端已关） | §3.5 |
| A11 | **代次守卫**：`start()` 挂起在 `/api/live/session` 期间派发 `airp:world-unavailable`，随后该 fetch reject → 快照**保持 idle**，不出现 `phase:'error'` | deps 注入可控 promise；断言最终 `phase === 'idle'` 且 `error === undefined` | §3.5 第 4 条 |
| A12 | **`isAvailable` 门禁**：config 返回 `{ok:true, available:false}` → `start()` 不调 `getUserMedia`，`phase:'error'`，`error` 非空 | 数 `getUserMedia` = 0 | §3.2 第 2 步、`00` §2.9 |
| A13 | **麦克风被拒分类**：`getUserMedia` 抛 `DOMException('x','NotAllowedError')` → `error` 为 `liveErrorMicDenied`；抛其他 → `mic_unsupported` | 断言两种 error 文案（`UI_COPY.en`） | §3.2 第 6 步 |
| A14 | **只有 `session.started` 才 live**：数据通道回 `session.closed`（非 started）→ 20s 超时前不置 live；回 `session.started` → `phase:'live'` | 用 fake data channel 触发 message | §3.2 第 10 步 |
| A15 | **store 无 React 依赖**：读取 store 源码文本，断言**不含** `from 'react'` / `require('react')` | `readFileSync` + `assert.doesNotMatch`（体例照 `active-projection.test.mjs:9` 读源码文本） | 契约 10 §2.2 冻结 3 |
| A16 | **`live-call.ts` 零副作用**：读取其源码文本，断言不含 `fetch(`、`addEventListener`、`setInterval` | 同上（源码文本断言） | §9.4 |
| A17 | **`stop()` 幂等**：idle 时 `stop('nook:x')` / `stop()` 均无异常、close fetch = 0 | 断言 | 契约 10 §2.2 冻结 2 |
| A18 | **`check:bodies` 仍绿**：`node tools/check-request-bodies.mjs` exit 0 且输出 `clean (11 route(s) pinned)` | 跑脚本 | §7 的 `file` 改指后键集未漂 |
| A19 | **`error` 帧进快照（非空性）**：`phase:'live'` 时注入 `{type:'error', source:'character', characterId:<当前>, message:'sideband lost'}` → `getSnapshot().phase === 'error'` 且 `error === 'sideband lost'`。**删除 §3.4 第 6 步的 3 行时此断言必须变红** | 派发 `airp:character-frame` 后断言；同时断言 `phase` 变化**不经 `tick()`**（同步可见） | 契约 10 §9.1(b)、§3.4 第 6 步 |
| A20 | **`start()` 成功后同步可见（非空性）**：fake 数据通道回 `session.started` 后，**不调 `tick()`** 直接断言 `getSnapshot().phase === 'live'` | 断言同步性（这是 12 号 5 处 TTS 门的前提） | 契约 10 §9「补充冻结」 |

### 11.2 React 绑定的可测性（评审 F3：两参在 `renderToStaticMarkup` 下会抛）

**实测（UnderlyingRat，契约 10 §9.2）**：`renderToStaticMarkup`（本仓渲染断言的**唯一可用手段**——`card-skeleton-render.test.mjs:28`、`character-rail.test.mjs:100` 都用 `await import('react-dom/server')`）对使用 `useSyncExternalStore` 的组件**要求第三参 `getServerSnapshot`**，缺失直接抛 `Missing getServerSnapshot…`。**两参形式**（`agent-cursor.ts:412` / `App.tsx:273` / `phantom.ts:233` / `writer-state.ts:220-224`）在生产可用，在**测试里只会抛或只会 skip**。

**冻结**：`live-call.ts` 的四个 hook **MUST 三参**（§2.2 的代码即最终形态），第三参 = `getSnapshot`/`getLines`/`isAvailable` 本身。体例取本仓**既有三参**先例：`useAgentActivity.ts:30-34`、`play-hints.ts:34`、`i18n.ts:28`。

| # | 断言 | 怎么测 | 证明什么 |
|---|---|---|---|
| A21 | **绑定在三参下可渲染**：用 `renderToStaticMarkup` 渲染一个消费 `useLiveCallState()`/`useLiveCallAvailable()` 的哑组件 → **不抛**，且渲染出 `phase:'idle'` 对应的标记 | `const { renderToStaticMarkup } = await import('react-dom/server');`（体例照 `card-skeleton-render.test.mjs:22-28`）。**这是 12 号 A2–A8/A3′/A13 全部渲染断言的前置** | 评审 F3、契约 10 §9.2 |
| A22 | **非空性**：把 §2.2 任一 hook 的第三参删掉 → A21 **必须变红**（抛 `Missing getServerSnapshot`） | 手动删参验证一次，然后把「第三参存在」写成源码文本断言（`assert.match(source, /useSyncExternalStore\([^)]*,[^)]*,[^)]*\)/)`） | 证明 A21 不是空转 |
| A23 | **`useLiveCallActions` 返回稳定引用**：连续两次 `renderToStaticMarkup` 之间（或同一次内两次调用）返回 `===` 的对象 | 断言引用相等 | 避免消费方 effect 依赖抖动 |

> **给 12 号**：其 A2–A8/A3′/A13 的渲染断言**依赖本条 A21 成立**（三参绑定）。若 11 号交付偏离三参，那些断言会集体抛错——**这是同批契约**。

### 11.3 门禁类验收（归 13 号跑，本文列出以便主 agent 一次验）

| # | 判据 |
|---|---|
| M1 | `pnpm check:ws` → `clean (27 emitted, 25 consumed, 27 in contract)`，exit 0（`CONSUMERS` 增列 store + `writer-state.ts` 等四个文件，`live-call.ts` 保留）。**基准 25 见契约 10 §9.1** |
| M2 | `pnpm check:bodies` → `clean (11 route(s) pinned)`，exit 0 |
| M3 | `pnpm build`（`tsc -b && vite build`）成功——本批改 `apps/web/src`，生产端读 `dist` |
| M4 | 新增 `apps/web/test/live-call-store.test.mjs` 全绿；`pnpm test` 不因本批新增失败 |

### 11.4 浏览器验收（人工，`00 §10` 的 L 批九条 + 对话框特有）

1. nook 通话中打开**同一**角色的对话框 → 对话框显示「通话中」（读 store）；点对话框挂断 → nook 胶囊消失（契约 10 §4.1）。
2. nook 通话中打开**另一**角色的对话框 → 对话框显示「空闲」；点开始通话 → nook 那条**先被挂断**（契约 10 §2.2 冻结 1）。
3. 关闭 nook 投影 → 通话自动收（owner 匹配）；关闭**对话框** → **不动** nook 那条（owner 不匹配，A4 的行为）。
4. 通话中把 `.airpworld/world.json` 外部删掉 → 通话自动收、画布清空、**不显示**「The world is no longer open.」这类旧世界错误（§3.5 第 4 条）。

---

## 12. 发现的冲突（不私改契约，请主 agent 裁决）

| # | 冲突 | 位置 | 本文处置 |
|---|---|---|---|
| ~~**C1**~~ ✅ **已消解** | ~~节流措辞「rAF 或 ~50ms」vs 250ms 惰性 tick~~ | `10 §2.3`（`10:129` 已更新） | **契约 10 §2.3 已冻结为 250ms 惰性 tick 体例**（评审 F7 核实）。本文 §9.3 已改写为「一致，非偏离」。**无需裁决**。 |
| **C2** | `00 §15.4` 的 `LiveCallState` 是 **4 字段**（无 `characterId`/`owner`），契约 10 §2.2 是 **6 字段** | `00` §15.4 vs `10` §2.2 | 契约 10 §1 的「已修订条款」表**未列 §15.4**，但 §2.2 的 6 字段明显取代它。**判定**：以 `10 §2.2` 为准（权威层级 §1：L2 范围内 `10 > 00`）。**建议**：`13` 的回写清单补一条「`00 §15.4` 的 `LiveCallState` 标注被 `10 §2.2` 取代」。 |
| **C3** | `CaptionSegment` 攒 `start_ms`/`end_ms` 而**全仓无读取点** | `live-call.ts:32-36`、`:251-256` | 本文**删除**（§4.6）。这不是契约条款（`10 §2.3` 只要求「字幕文本 = delta 精确拼接」）。若要保留时间边界，正确落点是服务端 jsonl。**请确认无别的在途会话依赖它**（已 grep 全仓 `apps/`+`packages/`，仅 `live-call.ts` 自身） |
| **C4** | **通话中角色 agent 死亡**时，既有的 `error` 帧（`source:'character'`）经 `airp:character-frame` 到达，**原设计不消费它** | `useWorld.ts:801`、契约 10 §7 表末行 | ✅ **已裁决（契约 10 §9.1(b)，前提被评审修正）**：**store MUST 消费它**——`commitState({ phase:'error', error: detail.message })`（§3.4 第 6 步）。原「不消费」的论证（`12` 号 §12-U2 引用的「置 error 后 `callAlert` 随之显示」）**被实测推翻**：`callAlert` 在 `.call-stage` 内，`showCallPanel` 只在 `connecting`/`live` 为真 → `phase:'error'` 整块不渲染。故 3 行 MUST 与「`.call-stage` 渲染条件放宽为 `callVisible = showCallPanel \|\| (phase==='error' && characterId===id)`」**同批落地**（后者 owner: 12 号）。**本 store 侧照写，可见性由 12 负责**。 |
| **C5** | 契约 10 §5.1 表格写「卸载行为：**按 owner 判定后 close**」，但**未写 nook 的卸载 effect 挂在哪** | `10 §5.1` | 本文在 §9.2 第 6 步给出落点（NookView 新增 owner 卸载 effect）。**这是对契约的实现细化，不是偏离**。 |
| **C6** | ✅ **已收进落点（评审 F3）**：契约 10 §4.3 冻结的 `NookView` 守卫放宽（`sameCharacterOnCall`），初版本文 §9.2 遗漏 | `10 §4.3`（`10:212-217`） | 已补进 §9.2 **第 7 条**（含代码 + 三条理由）。`12:308` 的反向指引（「§4.3 在 11 §9.2」）自此成立。 |

---

## 13. 仍未知待拍板

| # | 待定 | 为什么现在不能定 | 建议 |
|---|---|---|---|
| U1 | `tick(now)` 的 `now` 参数是否保留 | 本 store 暂无 TTL 推进需求；纯为体例统一 | 保留（零成本、与 `agent-activity-store` 同形）；若评审嫌噪音可去 |
| U2 | `deps` 缝的形态（是否真的需要 `createPeerConnection`/`createAudio` 注入） | 需要看 A2/A14 的测试能不能只靠 `getUserMedia` + data channel fake 写完 | 先写测试，按需增删 deps 字段；**契约不依赖此缝** |
| U3 | 对话框入口在**通话中**是否也显示「挂断」而非「开始通话」 | 归 12 号的版面；store 已提供 `owner`/`characterId`，两种都能实现 | 12 号定；store 侧无需改动 |
| U4 | `13` 是否把 `00 §15.4` 标为「被 `10 §2.2` 取代」（C2） | 回写范围属 13 号 | 建议补一行 |
| U5 | 世界**切换**（`loadWorld`）时是否需要 store 显式自清（而非依赖 nook 卸载） | 两条路径（nook 卸载 owner 守卫 / 对话框关时序）已覆盖；但若将来有「通话中直接切世界且 nook 不入栈」的路径，会漏 | **当前判定不需要**（§3.5 第 7 条）；若 L3 出现新入口，再补 `loadWorld` 监听 |
| U6 | ~~`error` 帧是否该由 store 消费~~ **已裁决** | —— | ✅ 契约 10 §9.1(b)：**进**（3 行照写），与 12 号 `callVisible` 同批；见 C4 |