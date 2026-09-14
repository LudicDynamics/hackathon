# REVIEW-R3 — 静默失败 / 反模式 / 安全审查

> 2026-09-13。审查对象：`docs/wiring/{01,02,03,04,05}.md`。
> 基准：`docs/wiring/00-共同上下文.md §7`（消毒与安全）、`§8`（反模式）。
> 方法：逐条读设计 + 到源码复核（`useWorld.ts` / `CharacterModal.tsx` / `DiceRoller.tsx` / `event-bridge.ts` / `lifecycle.ts` / `index.ts` / `routes/world.ts` / 门禁源码），实跑 `node tools/check-ws-contract.mjs`。
> 只读审查，未改任何源码/文档；未跑全量 build/test。
> 本文件由主 agent 依 `history://ReviewR3Silence` 的结构化输出补落（该 subagent 未落盘，仅返回 findings）。

---

## 结论

**overall_correctness: incorrect（confidence 0.72）** —— 冻结契约 `00 §7/§8` 本身**未被违反**（XSS 面干净：全 `apps/web/src` 无 `dangerouslySetInnerHTML`/`innerHTML`，角色台词走 React 文本节点；无第二 `new WebSocket`；无前端帧名常量表；无新增 `console.warn` 当失败可见）。但本批核心卖点是「消灭静默失败/假话」，而两条设计缺陷会直接使其失效，另有可机械核验的记账/判据硬伤。均可一轮回写修掉。

## Findings

### R3-1（P2，confidence 0.75）04 §9 与 §3 的调用顺序矛盾会让失败重新静默
同一篇给出两个互相矛盾的实现顺序：§3 第 6 步写「`closeOverlay()` **之后** `setError(msg)`」，§9 差异表写「catch → `setError(msg)` + `closeOverlay()`」（错误在前）。同时 §3 第 8 步/§8 要求在 `closeOverlay`（`apps/web/src/components/narrative/DiceRoller.tsx:98-109`）里新增 `setError(null)`。按 §9 顺序实现时 `setError(msg)` 被紧随的 `closeOverlay()` 里的 `setError(null)` 覆盖，内联错误行（`{error && <p role="alert">}`）永不渲染——A4 存在的唯一理由（把 `:161-165` 的 `console.error`+`closeOverlay()` 静默失败改成可见失败）被抹掉，且 UI 与现状逐字同形。**修法：统一为「先 `closeOverlay()`，再 `setError(msg)`」。**（已裁决 A-D2 同节一并回写，见 `local://wiring-review-arbitration.md`。）

### R3-2（P2，confidence 0.6）03 步骤 4 会把 `[` 之后的正文永久冻结
步骤 4 规则 3 的冻结正则 `/^\[[a-z:\s]*$/` 命中任何「以 `[` 开头且其后只有小写字母/冒号/空白」的行。台词正文常以方括号开头（如 `[System] …`）；当 `character_message` 整句未收完（`streamingRef` 仍真、`opts.final` 不真）时命中 → `tailOpen=true` → 该行输出为空串且泵不推进前沿。24 字符保险阀只覆盖「前缀很长」，`[System]`（8 字符）不在其内 → 纸面卡住，正是文档自己要防的「遮罩像死机」。**修法：要求前缀必须以 `[emo` 开头，或保险阀判据改为「已见 `[emo` 但无 `]`」。**

### R3-3（P2，confidence 0.85）02 §10.1 残留 DARK 计数漏掉 `writer_delta`，8 应为 9
02 §10.1（`:330`）与 04 §10.2（`docs/wiring/04-骰子与请求体.md:280`）都写「剩余 8 条 dark」。但 12 条 DARK 中 `writer_delta`（`apps/server/src/engine/event-bridge.ts:58`，与 `character_delta` 同行但是**独立 finding**）也在列。A 档只消 `world_event`+`character_delta`+`character_idle` 三条 → 残留应为 **9**。直接影响 `00 §9` 完成判据闭合。（与 R1-2 / R4-1 同源。）

### R3-4（P2，confidence 0.7）03 冲突 1 的 `error` seam 会把 writer 错误灌进角色遮罩
冲突 1 建议把 `case 'error'` 的所有帧无条件转发进 `airp:character-frame`。但 `error` 非只属角色：`apps/server/src/index.ts:99`/`:112` 的 writer 错误是 `{type:'error', source:'writer', message}`，**不带 `characterId`**。按 03 §3.1 的 App 过滤器，遮罩已开时这条 writer 错误会被绑到当前 Modal，渲染成角色台词。**修法：`case 'error'` 内加 `if (msg.source === 'character' && typeof msg.characterId === 'string')` 再 dispatch，或把 writer 错误留 `default`。**（已裁决 A-err，采纳带 guard。）

### R3-5（P3，confidence 0.55）03 空 turn 的兜底只在 watchdog 超时后出现，仍是静默失败
步骤 5 把沉默兜底限定在 watchdog 超时后，步骤 6 又在 `handleSend` 同步进 `thinking` 并起 watchdog，§6.2 又要求关闭窗口内的收尾帧不消费。合起来：角色进程真死（`index.ts:145` 回 error 帧、前端不消费）时，玩家看到既无报错、又不可输入、也不知要等 95s 的遮罩。**修法：接 `error` 帧（R3-4）后 watchdog 降为最后兜底。**（已裁决 A-silence：升为本批必做。）

### R3-6（P3，confidence 0.8）05 §6 的 grep 零命中判据按字面永远不可能通过
§6 验收第 2 条要求 `grep -rn "sampleReplies" docs/` 为空，但 `docs/` 下实跑 12 处命中（5 文件）：`docs/development/后端实现计划.md:80`、只读的 `docs/wiring/前端接线体检.md`、05 自身、及其它评审产物。即使 R2 改写完成，该 grep 仍不可能为空 → 验收判据字面必然红，实现者只能跳过。**修法：收窄扫描面到被回写目标，显式排除 `docs/wiring/05-*.md` 与 `docs/wiring/前端接线体检.md`。**（与 R4-2 同源。）

### R3-7（P2，confidence 0.85）05 R10 定位不存在
R10 指向 `docs/hooks/00-共同上下文.md:251` 的 `chalk_landed` 引用——该行不含 `chalk_landed`（全 `docs/hooks/` grep `chalk_landed` 零命中），也不含任何 `useWorld` 引用。真正需随 02 变动的 `useWorld` 行号引用在 `docs/hooks/05-视点链路.md:72,512,524`。**修法：R10 重定向到该三处，或删除。**（与 R1-5 同源。）

### R3-8（P3，confidence 0.5）01 §10.2 的单测从 dist 导入，不 build 测不到新函数
`characterIdFromClientKey` 单测放进 `apps/server/test/map-engine-event.test.mjs`，但该测试 `:11` 是 `import { mapEngineEvent, messageText } from '../dist/engine/event-bridge.js'`——**从编译产物 import**。新增的第四参与 `characterIdFromClientKey` 导出只存在于 `src/`；不先 build 则 dist 仍旧代码，断言失败或 import 不到符号。而 `00 §10` 又要求跳过全量 build。**修法：§10.2/§10.4 明写前置 `pnpm --filter @airp/server build`。**（与 R2/R4-4 同源。）

## 硬约束核对（全部通过）
- `00 §7`：`apps/web/src` 无 `dangerouslySetInnerHTML`/`innerHTML`；03 的角色台词只经 React 文本节点与 `parseEmoTag`。✅
- `00 §8.1`：前端无第二套帧名常量表（`case` 字面量即契约）。✅
- `00 §8.2`：`useWorld.ts:258` 仍是唯一 `new WebSocket`。✅
- `00 §8.3`：设计未新增「`console.warn` 当失败可见」路径；但 R3-5 指出空 turn 兜底仍是变体静默失败（已升必做）。⚠️（由 A-err 修）
- `00 §8.4`：未把 `world_event` 消费写成第二套事件语义。✅
