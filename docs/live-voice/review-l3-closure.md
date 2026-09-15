# L3 评审门 · 闭环性评审（`review-l3-closure.md`）

> 评审人：ReviewL3Closure。角度：**闭环性——设计是否真能把每项决策落地到可执行的代码/测试。**
> 对象：`docs/live-voice/30`（L3 冻结契约）与 `31`–`35`（`HEAD=13e3c71`，2026-09-15）。
> 只读评审。所有证据为本次实测（`grep` / `node tools/check-*.mjs` / `node --test` / 自建 esbuild 探针），
> 凡是推断均标 `[INFERENCE]`。

---

## 0. 结论摘要（先给答案）

**72 小时后能不能照着这批文档把代码写出来？——能，但需要先修 3 处「看起来做完但其实做不到」。**

四张决策的闭环状态：

| 决策 | 闭环? | 关键证据 |
|---|---|---|
| 1 缺陷 1/2 本批修 | ✅ 闭环 | 修法逐字落到 `NookView.tsx`/`CharacterModal.tsx` 的具体行；探针 §5 我独立复跑 `scanSource`，规则 5/6 在**修完后**归零 |
| 2 不跨投影续存 | ✅ 闭环（三载体 cleanup 齐全） | nook `:201`、对话框 `:826`+`:544`、角色栏 `32` §3.7 —— 三个都在；**角色栏的 ref 镜像经我实测证明必需**（§4.2） |
| 3 可见性统一契约 | ✅ 闭环（**但改造后**） | `33` §5.2 穷举 9 行、`33` §7.3 的 S4b 是唯一补口；`33:290` 的 owner 拼法已在评审门中修正 |
| 4 先抽组件再接入 | ✅ 闭环 | `31` 的 props 足以组装 `32` §3 的通话卡；`31` 的 A7/A8/S3 三条自伤断言已在本轮修好 |

「看起来做完但其实做不到」的三项（全部已在本评审门内被认领，但**必须复核落地**）：

1. **`31` §6.1-A8 断言 `NookView.tsx` 不再含 `copy.liveCallConnecting`** —— 迁移后该词仍在 `:716`（call lane 保留）⇒ 断言必红。**（本轮已修，见 §6.1）**
2. **`31` §6.1-A7 断言根元素带 `data-live-call-transcript`**，而 §3.5 的组件代码块**不产出该属性** ⇒ 按文档抄代码 A7 必红。**（本轮已修，见 §6.2）**
3. **`33` §7.2 / `35` §2.5 声称「穿透 `.prototype-chrome` 会被门禁报 `pointer-events: auto`」** —— 我实测该门禁**永不触发**（property 不匹配）。**（本轮已修，见 §6.3）**

---

## 1. 决策 1：缺陷 1/2 本批修 —— 闭环 ✅

### 1.1 修法完整性验算

| 位点 | `34` 给的修法 | 我实测的落点 | 判定 |
|---|---|---|---|
| `NookView.tsx` 判据（`:183`） | 拆 `callMine` / `callVisible` / `callConnecting`（`34:88-97`） | 三个派生量全文唯一的读点是渲染层 8 处 + `:190` 的 L2 守卫 | ✅ |
| `NookView.tsx` `onClick`（`:689-696`） | `callVisible ? stop(\`nook:${characterId}\`) : start({…owner})` | `:696` 现为 `} else void stopCall();`，与文档逐字对得上 | ✅ |
| `CharacterModal.tsx` `disabled`（`:955`） | `callActive && call.characterId === characterId` | 实测 `:955` | ✅ |
| `CharacterModal.tsx` `callActive` 定义（`:139`） | 收窄为 `callTransporting && call.characterId === characterId` | `:139` 现为全局 | ✅ |

**门禁侧我独立复跑**（自建 `scanSource` 探针，喂真实 `NookView.tsx` / `CharacterModal.tsx`）：

```
规则 5（NookView）今天：2 条 finding（required 缺失 + forbid 命中 `:696`）
规则 6（CharacterModal）今天：2 条 finding（required 缺失 + forbid 命中 `:955`）
—— 喂入「修完后」的候选源码：规则 5/6 均 → 0 finding
```

⇒ 冻结 6/7 的**门禁形态可落地且不会假红**。**闭环成立。**

### 1.2 「阴影面」是否真的必须同批修？—— 必须，且 `34` 的理由成立

`34:369-392`（§7.2 S-8）主张 `callActive` 的定义收窄**不是优化而是冻结 7 的等价实现**。我逐条核验：

- `:879` 的 `callActiveRef.current = callActive;` 确实喂 8 个门：我逐点 `grep` 到 `:433 / :445 / :451 / :595 / :608 / :661 / :672 / :846`，与文档列出的 8 个**逐字一致**。
- 其中 `:846`（`handleSend`）与 `:672`（帧消费）是**行为可见**的：他角色通话时，本纸的对话框会「打字发不出去 / 帧不消费」，玩家看不出原因。

⇒ **不修会怎样**：`S-7` 文案说「On a call」却可点（点了会**挂断别人再开自己**，是换了个入口的误挂）+ 8 个门静默短路。这**不是**可以顺延的小瑕疵，`34` 升格为「必修」的裁定**证据充分**。

⚠️ **但闭环有一处缺口（我报，中）：`34 §8.4 T4b` 仍标「可选但推荐」（`:539`）**，而 `30 §11` 第 8 行已把「`callActive` 定义收窄」定为**本批必修**。冻结项不能只靠「可选」的回归测试守着。

### 1.3 16 行扫描表（S-1..S-16）有无遗漏？—— 我对全仓做了独立枚举，**结论：无遗漏**

`34:344` 声明的扫描面 = «`useLiveCall*` 的调用方（2 个组件）+ store 自身»。我独立跑了等价枚举：

```
useLiveCallState|Lines|Actions|Available 的调用点（全仓）：
  apps/web/src/components/nook/NookView.tsx
  apps/web/src/components/overlay/CharacterModal.tsx
  apps/web/src/lib/live-call.ts          ← 定义处，非消费点
```

且：

```
grep -rn "live-call-store.js|liveCallStore" apps/web/src --include=*.ts --include=*.tsx
  → 只有 apps/web/src/lib/live-call.ts:25（唯一 import 处）
grep -rn "api/live" apps/web/src/components/
  → 零命中
```

⇒ `34` §7.1 的 S-1..S-16 **覆盖了今天全部出现「用全局快照回答归属」的位置**。**待 L3 落地后新增的两个面**（`CharacterRail.tsx`、`App.tsx` 的 S4b）`34:393`（§7.3）也明确交接给了 `32`/`33`，不是遗漏而是划界。

**唯一可挑剔的一处（低）**：`34` 的扫描表把 `NookView.tsx` 的 `:722`（live 徽标）与 `:731`（error alert）**并入了 S-3 那一条**（8 个渲染位点里含它们），但 `34:181` 又把 `:731` 单独称为「第二个泄漏」。同一 hunk 内两个编号指同一行——**只影响可读性，不影响正确性**。

---

## 2. 决策 2：不跨投影续存 —— 闭环 ✅（三载体 cleanup 齐全）

### 2.1 三载体 cleanup 逐一核验

| 载体 | cleanup | 实测 | 带 owner? |
|---|---|---|---|
| nook | `NookView.tsx:201` `useEffect(() => () => void stopCall(\`nook:${characterId}\`), …)` | ✅ 逐字命中 | ✅ `nook:` |
| 对话框 | `CharacterModal.tsx:826` cleanup + `:544` (`handleClose` 内先挂断) | ✅ 两处都在；`:544` 的 `void stopOwnedCall()` 早于 `onClose()` | ✅ `dialogue:` |
| 角色栏（NEW） | `32` §3.7（`:305-318` 的代码块） | 尚无实现，设计已给 | ✅ `rail:` |

⇒ **没有任何载体漏 cleanup。** 决策 2 的 L1 引理（`33:131`）在三个支上都有落点。

### 2.2 角色栏 cleanup 的 ref 镜像 —— 我实测证明它**必需**，且实测通过

`32` §3.7 的 cleanup 判据是 `railOwnsCallRef.current`（渲染期镜像），理由是「`[stop]` 依赖下闭包捕获首渲染的值」。这条如果我判断错了，会导致「角色栏通话中进 nook 不挂断 ⇒ 静默计费」。我用**真 esbuild + renderToStaticMarkup** 搭了一个探针（把 `32` 的设计补丁进 `CharacterRail.tsx` 的副本），实测：

```
available=true  state=absent   actions=3  hasStartCall=false   ← UF-3a 用的视图
available=true  state=in-scene actions=4  hasStartCall=true
available=false state=absent   actions=3  hasStartCall=false
available=false state=in-scene actions=3  hasStartCall=false
```

**两条独立结论**：

1. **UF-3a 计数逐字不变（仍 3）** —— `available` 关 + `canTalk=false` 两道门**各自独立**成立（`available=false&in-scene` 也是 3）。`32 §2.2` 实测正确，`35` 已更正的「逐字不变仍 3」正确。
2. 该探针同时证明 **`32` 的通话卡渲染条件 `railCallVisible` 从 `views` 里取 `railCallName` 不会影响渲染**（`railCallVisible` 只读 `call.owner`）。

我进一步复现 `32 §10.3` 的 A5 断言（他角色通话）：

```
FOREIGN: dataRailCall=true  hasDisabledAttr=false  startCallLabel=true  actions=4
OWN-live: card=true  hangupLabel=true  cls=true
OWN-error: card=true closeLabel=true  alert=false
ABSENT: startCall=false
```

⇒ **A3 / A5 / A6 的判据可执行**。A3/A4 的 `aria-label="Hang up · Alpha"` / `"Close · Alpha"` 也在我的探针里命中。

### 2.3 A4 / T3c 的 `role="alert"` 断言 —— 我实测**通过**，但各有一处条件性脆点（低）

我补了 §3.2 里 `role="log"` 与 error 分支的 `<p role="alert">`，重跑探针：

```
OWN-error: card=true  closeLabel=true  alert=true
FOREIGN:   dataRailCall=true  roleAlert=false  hasDisabledAttr=false  startCallLabel=true
```

⇒ **A4 的 `/role="alert"/` 与 T3c-1 的 `doesNotMatch(/role="alert"/)` 两向都成立**（`CharacterRail.tsx` 今天 `role="alert"` 零命中，`32` 只新增一处且在 error 分支）。**不是缺陷。**

脆点（`[INFERENCE]`，低）：`NookView.tsx` 里 `role="alert"` 有 **3 处**（`:648` 的 `error` 属性区、`:678` 的 `notice`、`:733` 的 `call.error`）⇒ `34 §8.2 T3c-1` 的 `doesNotMatch(/role="alert"/)` 在 harness 把 `error`/`notice` 也置非空时会假红。文档的 bootstrap 未规定这两个 prop 的取值，**建议在 T3c 的 bootstrap 注释里写明「只注入 call 快照，`error`/`notice` 保持空」**，把这条脆点钉死。

---

## 3. 决策 3：可见性统一契约 —— 闭环 ✅（S4b 落点已一致）

### 3.1 `33` 的 S4b 真能落地吗？—— 能，但需要 App 接三样东西（文档已写全）

`33 §7.3` 的 S4b 要求 App 级挂一个**不带 `prototype-chrome`** 的元素。`32 §4.2`（`:353` 的「精确改动（3 处）」）列的是：

1. `import { useLiveCallActions, useLiveCallState } from './lib/live-call.js';`
2. `const liveCall = useLiveCallState(); const { stop: liveCallStop } = useLiveCallActions(); const railCallOwner = …`
3. S4b 元素 + `prototype.css` 两条规则

我逐条核验：

- App **今天对 `live-call` 零 import**（实测 `grep -c` = 0）⇒ 第 (1)(2) 步是**必需的新增**，不是重复。
- `App.tsx:167` 有 `const { locale, setLocale, t } = useLocale();` ⇒ S4b 的 `t('Hang up')` **可用**（不需要额外接线）。
- `App.tsx:1137` 的根 `.airp-prototype`（8 空格缩进的 `<div>`）**先于** `<main>`（`1138`）—— S4b 放在 `:1311-1319` 的 edge-wake 之后，缩进层级相同，**定位上下文正确**（`.prototype-workspace { position: absolute; inset: 0 }`）。

⇒ **S4b 的 3 处接线完整，不遗漏。**

### 3.2 两份文档对 S4b 落点是否一致？—— **本轮已一致**（此前不一致，属阻断项，已被 `Consistency` 抓到）

| 项 | `32 §4.2` | `33 §7.3` | 一致? |
|---|---|---|---|
| onClick | `liveCallStop(railCallOwner)` | 现为 `liveCallStop(railCallOwner)`（`:290` 已修） | ✅ |
| 渲染条件 | `{!nookChar && shell.immersive && railCallOwner && …}` | `{!nookChar && railCallOwner && …}`（`:291`）+ CSS `.is-immersive … { display: block }` | ✅ **语义等价**（`33` 用 CSS 门，`32` 用 JS 门；两者都是「仅沉浸下可见」） |
| `railCallOwner` 定义处 | `32 §4.2(2)` 定义 | 假定外部已定义 | ✅（`30 §5.4` 冻结 10 把定义钉在 `32`） |

### 3.3 `33 §5.2` 的穷举完备吗？—— 完备，但 A′ 的**可达性是内容条件**（文档已如实标注）

`33:146` 声明「三种互斥主情形 + 一个子分支」。我核验了 A′（`:5.2 情形 A′`）依赖的入口：`NookView.tsx` 的 `<Canvas>` **不传 `presence`** ⇒ nook 内没有 `PresenceLayer` 头像；他角色对话框的唯一入口是**画布上的 sprite 卡**（`CanvasObject.tsx:344-347`），**取决于世界内容**。`33:5.2 A′` 原文已逐字标注「这是内容可达，不是任何世界都可达」⇒ **诚实且完备**。

`33:245` 自报「9 行中 7 行否、2 行是」——我逐行数了 §6.1 的表，**确实是 9 行**。✅

### 3.4 S4b 的落地顺序 —— 已写清，且**我实测 P4 今天必红**（顺序纪律正确）

`33 §9.1` 的 P4 与 `35 §2.5` 的落地条件一致（**MUST 与 S4b 同批**）。我复跑：

```
P4（.is-immersive .prototype-call-wake + display:block）在今天（S4b 未建）
  => 1 条 finding：".is-immersive .prototype-call-wake must declare display: block"
```

⇒ **先加 P4 会立刻红**，`35` 的顺序纪律**实测成立**。✅

---

## 4. 决策 4：先抽公共组件 —— 闭环 ✅

### 4.1 `31` 的 props 足以组装 `32` §3 的通话卡吗？—— 足以

`31 §3.2` 的 `LiveCallTranscriptProps = { lines: LiveCallLines; call: Pick<LiveCallState,'outputText'|'inputText'|'phase'>; className?: string }`。

`32 §3.2`（`:176-210`）的组装：

```tsx
{railCallVisible && (
  <div className={`character-rail__call character-rail__call--${call.phase}`} data-rail-call="" role="log">
    …
    {call.phase === 'error' && call.error
      ? <p className="character-rail__call-alert" role="alert">{call.error}</p>
      : <LiveCallTranscript lines={lines} call={{ outputText: call.outputText, inputText: call.inputText, phase: call.phase }} className="character-rail__call-transcript" />}
    <button … onClick={() => void stop(`rail:${call.characterId}`)} …/>
  </div>
)}
```

我逐项代入：`lines` ✅（`useLiveCallLines()`）、`call.*` 三字段 ✅（`useLiveCallState()`）、`className` ✅。**没有一处需要组件不提供的 props**（状态条、挂断按钮全在宿主）。

⇒ **决策 4 的边界（不含状态条/挂断按钮）不会导致 `32` 组装不出来。** ✅

### 4.2 三处接入的**唯一性**是否有机械证据？—— 有，`31 §6.3` 的 A8/A10 是关键

`31:386` 的 A10（外盒 `data-nook-zone="transcript"` 仍在）与 `33 §9.1` 的 P2（nook 无 `prototype-chrome`）互补，二者不重复。✅

⚠️ **A8 与 `33 §9.1` P1/P3 的互补**：`33:424` 已说明「`check:ux` 不覆盖渲染面，两者各守一半」。**边界清晰。** ✅

### 4.3 ⚠️ `31 §3.5` 的 CSS 与 `index.css:857` 的 `.call-placeholder` 有一处属性丢失（低）

| | `index.css:857`（现） | `31 §3.3` 的 `.live-call-transcript__placeholder`（`:131`） |
|---|---|---|
| `margin` | `0` | `0` ✅ |
| `font-style` | `italic` | `italic` ✅ |
| `font-size` | **`.95rem`** | **缺** |
| `color` | `var(--muted)` | `var(--muted)` ✅ |

`31 §3.3` 把 `.call-placeholder` 归为「结构性样式」并搬进组件 CSS，但**漏了 `font-size: .95rem`**（`:857` 实测）。这会让对话框通话的空态文案从 `.95rem` 掉到继承值（`.call-stage__transcript` 的 `1.12rem`）⇒ **空态文案与真台词同号，视觉上「没在等」。** `31:247` 只点名了 `.call-line--player .call-speaker` 这一条易漏项，**漏了这条**。`[INFERENCE]` 无测试拦得住（`character-modal-call-ui.test.mjs` 不断 CSS）。

**建议**：组件 CSS 补 `font-size: .95rem`，或在 `31 §4.4` 的 C-清单里显式登记为「有意的视觉收敛」（二选一，别默默丢）。

---

## 5. 测试可执行性：挑 5 条最容易出错的，逐条实跑/静态验证

我按「最容易出错的 = 断言与它引用的东西之间没有机械对齐」挑，**5 条里有 3 条实际会红**（全部已在本轮被认领，此处给出我的独立证据）：

### T-1 `31 §6.1-A8`：断言不复存在的东西 —— **必红**（高）

```
$ grep -c "copy.liveCallConnecting" apps/web/src/components/nook/NookView.tsx
2          # :716 (call lane，N-3 明确保留) + :754 (字幕段，迁移时删)
```

`31:386` 原文（本轮已修）：A8 断言「不再含 `copy.liveCallConnecting`」⇒ 迁移后仍出现 1 次 ⇒ **A8 红**。修法正确：删去该词、只留 `liveCallThem`/`liveCallYou`。

### T-2 `31 §6.1-A7`：断言了代码没产出的东西 —— **必红**（高）

`31:343` 断言「根元素带 `data-live-call-transcript`」，但 `31 §3.5` 的组件代码块（原文 `:164`）是 `<div className={…}>`，**不产出任何 data 属性**；只有 `31 §3.6` 的钩子表说有。**三处不一致。** 本轮 `31:166` 已改为 `<div data-live-call-transcript="" className={…}>`。✅

### T-3 `31 §6.2-S3`：断言踩红自己的文档 —— **必红**（高）

`31:366-367` 断言 `assert.doesNotMatch(src, /\bowner\b/)` + `/characterId/`，而 `31 §3.2` 的 props JSDoc（原文 `:90`）逐字写着「MUST NOT 传 owner / characterId」。**同一个 `.tsx`。** 本轮 JSDoc 已改为「MUST NOT 传归属字段（角色 id / 通话持有者）」。✅ 我认同 `33:424` 的取舍：**不要 `stripComments`**（那会掩盖这类缺陷）——改措辞是对的。

### T-4 `34 §8.1 T3a`：`callVisible` 在测试里是「重写一遍」，不是「读被测代码」—— **可执行但无守卫力**（中）

`34:413-431` 的 T3a 在**测试文件里重新定义**了 `callVisible`：

```js
const callVisible = call.characterId === characterId && (call.phase === 'connecting' || …);
assert.equal(callVisible, false, …);
```

它断言的是**这段局部代码**，不是 `NookView.tsx` 的判据。⇒ **删掉 `NookView.tsx` 里的修法，T3a 依然绿。** 文档自己承认「组件层归 T3c」（`34:442` 的非空性说明指的是「把判据退回去会红」，但退回去的是**测试里的判据**）。`[INFERENCE]` 这不是错误，而是「store 层重放」的正当写法——**但它不构成缺陷 1 的回归守卫**，真正的守卫是 T3c。**建议**在 T3a 的名字/注释里写明「本条不守卫组件层，守卫在 T3c」，避免验收时误以为 T3a 绿 = 缺陷 1 已防回归。

### T-5 `32 §10.3 A5`：`assert.doesNotMatch(html, /\sdisabled=/)` —— **可执行且我们的探针通过**（低）

我的探针输出 `hasDisabledAttr=false` ✅。这个写法很妙（`\s` 避开 `aria-disabled=`），**实测有效**。

⚠️ **但它有反作用面**：`CharacterRail.tsx` 今天有 `disabled={pending}`（`:150`）与 `disabled={nookOpen}`（`:160`）。A5 用 `doesNotMatch(/\sdisabled=/)` ⇒ **若 `pendingFollowing` 非空（`view.following` 处于 pending），A5 会假红**。`[INFERENCE]` 默认 `pendingFollowing: new Set()` 时安全，**但断言意图与实现耦合**。建议收窄为 `/disabled=/.test(microButtonOf(html))`。

### 附：我实测的验收基线（供实现阶段对照）

| 命令 | 实测（今天，`HEAD=13e3c71`） |
|---|---|
| `node --test apps/web/test/character-rail.test.mjs` | `pass 12 / fail 0 / skipped 11`（**渲染组整组 skip**） |
| `node --test apps/web/test/character-modal-call-ui.test.mjs` | `pass 16 / fail 0 / skipped 0` |
| `node --test apps/web/test/live-call-store.test.mjs` | **`pass 26`**（`34` 头部已更正为 26，正确） |
| `node tools/check-ux-contract.mjs` | `clean (18 rules, 140 files)` |
| `node tools/check-i18n.mjs` | `ok 279 used / 443 entries` + **164 条 warn**，exit 0 |
| `node --test apps/web/test/{nook-portrait,active-projection,app-nook-camera-contract}.test.mjs` | `8 / 5 / 7 pass`，全 0 skip |

⚠️ **验收清单的基线数字已过期**：`35 §10 A9` 写「今天 `fail 0 / skipped 11`」里的 11 正确，但 `35 §1`/`§0` 的 `274 used / 435 entries`、`138 files` 是上一提交的值；今日实际 **279 / 443 / 140**。`32 §5.1`（`:426`）也仍写 `274 used / 435 entries`。**主 agent 已广播归各文档更新**——此处登记为**仍未全部落地**。

---

## 6. 「看起来做完但其实做不到」清单（本角度最重要的一节）

### 6.1 `31` A7/A8/S3 三条自伤断言 —— 已修，但**修法必须随代码一起落地**

三条共同点（`Fix31` 也认同）：**断言与它引用的源码/代码块之间没有机械对齐步骤**。修完之后：

- A7 现在依赖 §3.5 的根 `<div>` 带 `data-live-call-transcript` ⇒ **实现方抄 §3.5 时必须带上该属性**（文档已把「两处 MUST 同改」写进 A7 本身）。
- A8 现在只断 `liveCallThem`/`liveCallYou` ⇒ 但 `NookView.tsx` 迁移后仍会有 `copy.liveCallThem` 吗？`31 §4.2 N-3` 说删 `:754/:758/:764/:773/:779` 五处 ⇒ 剩下 `:716/:718/:728` 的 `liveCallConnecting`/`liveCallStop`/`liveCallLive` ⇒ **A8 不再含 `liveCallThem`/`liveCallYou` 成立** ✅（我实测这两个词今天在 `:758/:764/:773/:779`，全部属于 N-3 的删除面）。
- S3 现在需要 JSDoc 不含 `owner`/`characterId` 子串 ⇒ **新 JSDoc「归属字段（角色 id / 通话持有者）」不含这两个 ASCII 词** ✅（我核对过）。

⇒ **三条修法自洽，闭环。** ⚠️ **但必须提醒实现方**：`31` 的组件源码里**不得**出现 `characterId` 这个词（包括注释、变量名、类型参数），否则 S3 红——这是 `31` 刻意的设计（`:370` 自己写了「MUST NOT 为让它变绿而放宽」）。

### 6.2 `33 §7.2` / `35 §2.5` 的「门禁兜底」不存在 —— 已修（高）

两文原称「穿透 `.prototype-chrome` 的 CSS 会被报 `pointer-events: auto`」。我读了门禁实现的真实判定式：

```js
// tools/check-ux-contract.mjs:189
if (new RegExp(`${e.property}\\s*:\\s*auto\\b`).test(body)) add(…)
```

即 **只在该规则自己的 `property === 'pointer-events'` 时触发**。我实测两种情形：

```
P3（property=opacity）喂给含 pointer-events:auto 的候选 CSS → 0 finding
P4（property=display）喂给同一段                  → 0 finding
P3+P4（真实组合，含 canonical 规则仍在）           → 0 finding
判据 reverse-check：把 property 换成 'pointer-events' → 立刻 2 条 finding
```

⇒ **原论断为假**。`33:268-278` 与 `35` 已改为「本批**无**门禁兜底」，并指出「若将来要机械拦，须新增一条 `pointer-events` 规则且同步改规则数口径」。✅ **这是本批最危险的一条**——实现方会误以为有兜底而放心走错路。

### 6.3 `30 §4.2 冻结 7b` 是**必修**，但守卫它的测试被标为**可选**（中）

见 §1.2。`30 §11` 第 8 行裁「本批必修」，而 `34 §8.4 T4b` 仍标「可选但推荐」。**冻结项与回归守卫的标签必须一致**，否则实现阶段可能只做 `:955` 的字面量（冻结 7），留下 S-7/S-8。

**建议**：把 `34 §8.4` 的 T4b 从「可选但推荐」改为「MUST（冻结 7b 的守卫）」，或由 `35` 补一条 `required-source: [\"const callActive = callTransporting && call.characterId === characterId;\"]`（`34 §12` 第 2 项已把这条交给 `DesignGates`，**至今未落**——实测 `grep` 零命中）。

### 6.4 S4b 的验收断言**只覆盖「渲染」，不覆盖「点了有用」（高）

`30 §5.4 冻结 10` 明确要求「MUST 有一条断言证明唤醒按钮在 `owner === 'rail:X'` 时**真的调用 `stop('rail:X')` 并生效**（不是只断言按钮存在）」。但我扫了全部文档，**S4b 的验收只有两条**：

- `32 §10.3 A7`（`:708`）：`checkVisibility(...) === true` + 「点它 ⇒ `phase === 'idle'` 且 close 计 1」——**这条是浏览器冒烟（人工）**。
- `35 §10 A12`：人工/浏览器清单里含一句「不存在『通话存在但无可见挂断入口』」。

⇒ **没有一条静态/自动化断言**能证明「`liveCallStop(railCallOwner)` 传的是完整 owner」。这正是 `33 §7.3` 出错（`rail:rail:<id>`）而**所有断言照绿**的原因——**冻结 10 的验收要求与实际测试清单不一致**。

**建议**（可机械落地）：在 `live-call-store.test.mjs` 补一条与 T3a 同型的测试：

```js
test('S4b: the wake button hangs up with the FULL owner', async () => {
  const h = await harness();
  await liveCall(call(h, { characterId: 'nanami', owner: 'rail:nanami' }));
  // 模拟 S4b：从快照取 owner，原样传（MUST NOT 再拼前缀）
  const owner = h.store.getSnapshot().owner;         // 'rail:nanami'
  await h.store.stop(owner);
  assert.equal(h.store.getSnapshot().phase, 'idle');
  assert.equal(h.state.closePosts, 1);
});
```

外加一条源码断言钉住 onClick 的字面形态（`30 §5.4` 已给判据：`() => void liveCallStop(railCallOwner)`）。

### 6.5 空态文案（`34` 与 `31` 的 C-1）——**冲突已消解**，闭环 ✅

`34 §3.3`（`:132-140`）现在写死「本 hunk 由 `31` 的 `LiveCallTranscript` 接管，本文不再提供任何空态实现，**落地顺序无关**」，并给了 `31` 不落地时的回落路径（照 `31 §3.5` 第 3 步的 `phase` 二选一，MUST NOT 用 `copy.liveCallStop`）。`34 §10-W3`（`:680`）同步登记为「已裁定」。⇒ 原 `34 §3.3` 的 `copy.liveCallStop`（＝「Hang up」）误用**已删除**。**冲突真存在过、现已消除，顺序已写清。** ✅

---

## 7. V-1 闭环核验 —— 修法与阴影面**不矛盾**，定义相容

**问题**：`33 §13 V-1` 登记「nook + `phase:error` 无挂断入口」，`34` 裁「本批必修」并给修法。两者对 `callVisible` / `callActive` 的定义是否相容？

**我的核验**：

| 文档 | 定义 | 用途 |
|---|---|---|
| `34:97`（nook 修法） | `callVisible = callMine && (callInProgress \|\| call.phase === 'error')` | nook 的**渲染/入口**判据 |
| `34:275`（对话框收窄） | `callActive = callTransporting && call.characterId === characterId` | 对话框的**门 + 文案 + `callActiveRef`** |
| `CharacterModal.tsx:146`（现状） | `callVisible = (callActive \|\| call.phase === 'error') && call.characterId === characterId` | 对话框的**版面**判据 |

三个定义**互相相容**，且 `34:97` 与 `:146` **逐字同款**（文档自己指出这点，`33:5.3` 称 `:146` 为「正确范式」）。修法**不引用** `34` §4.5 的收窄定义（那是对话框侧），只引用 `callInProgress`（**保留全局语义**）+ `callMine`。

⇒ **V-1 的修法与阴影面不矛盾**：nook 侧只拆渲染判据、保留 `callInProgress` 给 `:190` 的 L2 守卫（`34:187` 明确「MUST NOT 改成 `callVisible`」，理由充分——那里问的是「**即将被打开的 id**」而不是「本 nook」）。**闭环。** ✅

### 7.1 ⚠️ 迁移落盘后曝出的活矛盾：`34 §3.3` 的 `:744/:746` 是**过度延伸**（高，已裁修法 1）

**发现时点**：`ImplDefects` 落盘后，我复核 `NookView.tsx` 发现字幕 lane 门成了 `callVisible`（`:762`），而 `31 §4.2 Step N-2`（`31:262`）**明文要求保留 `callInProgress`**。

**实测后果**（自建组件探针，`phase` 分别喂，其余全空）：

```
phase=live  & 无台词 => Listening…
phase=error & 无台词 => Listening…      ← 字幕区宣称「聆听中」
phase=connecting     => Connecting…
```

同一 `error` 快照下 call lane（`:749-756`）**同时**渲染 `role="alert"` ⇒ 玩家同屏看到「聆听中…」与一条错误告警**并存**：**文案说谎**。比 `31:263` 当时预言的「空字幕区」更差——不是空，是**错的**。

**定性的关键**：**V-1 的修复只在 call lane 的按钮判据**（`:717-737` 用 `callVisible`），**挂断按钮不在字幕 lane 里** ⇒ 字幕 lane 的门改不改，都不影响「玩家点不点到挂断」。`34:130` 把 `:744` `:746` 一并改成 `callVisible` **超出了 V-1 的需要**。

**裁定（主 agent，采纳本报告的修法 1）**：字幕 lane 门回退为 `callInProgress`；call lane 的 `callVisible` 不动。⇒ **V-1 仍满足 ∧ `31` N-2 的原始约束仍满足。**

**为什么这条值得单列**：它是本批**新的失败模式**——「**过度延伸的修复**」：为修 A 顺手改了相邻的行，引入一个比原缺陷更显眼的可见缺陷。`§6` 的四条是「断言没有判别力」，这条是「变更没有边界」。**评审面教训**：审「修法」时不仅要问「改的行够不够」，还要问「**改的行是不是都必要**」。

⚠️ **一处遗留（低）**：`34 §12` 第 5 项自问「`error` 时 nook 该用 `Hang up` 还是 `Close`」——`33 §5.3` 与 `34 §3.5` 的矩阵都说 nook 用 `Hang up`（沿用 `callVisible` 分支），而对话框用 `Close`。**nook 今天没有 `Close` 键的用法**，`34` 默认不加键（正确，避免动 i18n 账）。**结论一致，登记项可关闭。**

---

## 8. 落地顺序：`34` 自报的「nook 空态 hunk 与 `31` 的 C-1 必须二选一」——**冲突已消解**

**评估**：

- **冲突是否真存在**：**曾经存在**（`34 §3.3` 原稿自造空态 + `copy.liveCallStop` 误用），**现已消除**——`34:136` 写死「本 hunk 由 `31` 接管」，`:138` 写「落地顺序无关」，`:140` 给了 `31` 不落地时的回落路径。⇒ **不再是二选一**。✅
- **顺序是否写清**：**写清了**。三处给出同一顺序纪律：
  - `33 §9.1` P4：MUST 与 S4b 同批（我实测 P4 单独先加必红 ✅）。
  - `35 §2.5` 第 7 条规则：`call.no-component-fetches-live-api` 的 target 含未建的 `LiveCallTranscript.tsx` ⇒ MUST 与组件同批（`35:406`/`584` 已写）。
  - `35 §3-T7.1`：`define` 修 bootstrap MUST 与 T2 同批（我实测 skip 属实 ✅）。

**唯一未写死的顺序**：`35 §12-C8` 的 `files` 软断言（`≥140`）与「规则数 23 硬断言」——`35:220` 已给唯一口径（18 → 23；若 `34 §12` 第 2 项的收窄规则落则 24；若 P4 落则 25）。⚠️ **但 `34 §12` 第 2 项的规则至今无人认领**（实测 `grep` 零命中），所以 `23` 与 `24` 之间的选择**在实现阶段仍是活的**——这可能让验收时「23 硬断言」与实际规则数打架。**建议**在 `35` 明写：本批规则数**冻结为 23 + P4（S4b 落地时）= 24**，`34 §12` 第 2 项的收窄定义规则**顺延到下一批**（或明确并入 24）。

---

## 9. 逐条严重级汇总

| # | 问题 | 严重级 | 状态 | 证据 |
|---|---|---|---|---|
| 1 | `31` A8 断言 `copy.liveCallConnecting` 不存在（实际仍在 `:716`）⇒ 必红 | **高** | ✅ 本轮已修 | `grep -c` = 2 |
| 2 | `31` A7 断言 `data-live-call-transcript`，组件代码不产出 ⇒ 必红 | **高** | ✅ 本轮已修 | `31:164` vs `:225`/`:341` |
| 3 | `31` S3 断言被自己的 JSDoc 踩红（`owner`） | **高** | ✅ 本轮已修 | `31:90` vs `:366` |
| 4 | `33 §7.2`/`35 §2.5`「穿透会被门禁报」为假 ⇒ 误信有兜底 | **高** | ✅ 本轮已修 | 我复跑 `scanSource` → 0 finding |
| 5 | `30 §5.4 冻结 10` 要求 S4b「真调用并生效」的断言，**全批没有自动化断言** | **高** | ❌ **未落** | 全文档只有浏览器冒烟 A12 |
| 6 | `34 §8.4 T4b` 标「可选」，但 `30 §11` 第 8 行裁「本批必修」 | 中 | ❌ 未落 | `34:539` vs `30:335` |
| 7 | `34 §8.2 T3c-1` 的 `doesNotMatch(/role="alert"/)`：nook 另有 2 处 alert 区 ⇒ 条件性假红 | 低 | ❌ 未落 | `NookView.tsx:648/678/733`；默认 harness 下通过 |
| 8 | `31 §3.3` 迁 `.call-placeholder` 时漏 `font-size: .95rem`（`index.css:857`） | 低 | ❌ 未落 | 逐属性对比 |
| 9 | `34 §8.1 T3a` 在测试里重写 `callVisible`，不守组件层（名字易误解） | 低 | ❌ 未落 | `34:421` |
| 10 | `32 §10.3 A5` 的 `/\sdisabled=/` 会被 `pending`/`nookOpen` 的既有按钮踩 | 低 | ❌ 未落 | `CharacterRail.tsx:150/160` |
| 11 | 基线数字过期（`274/435/138` → `279/443/140`） | 低 | 部分已改 | 我实测今日值 |
| 12 | `34 §7.1` 扫描表把 `:722/:731` 并入 S-3、又在 `:181` 单列 ⇒ 编号重影 | 低 | ❌ | `34:130` vs `:181` |
| 13 | `34 §3.3` 把字幕 lane 门（`:744/:746`）也改成 `callVisible`（过度延伸）⇒ error 态字幕区显示「Listening…」与 alert 并存 | **高** | ✅ 已裁修法 1（回退 `callInProgress`；`34 §3.3` 回写；`31` N-2 补教训） | `NookView.tsx:762`；组件探针 `phase=error => Listening…` |
| 14 | `31 §4.2 Step N-2` 与 `34 §3.3` 对同一行给出**相反指令**（N-2 说「保留 `callInProgress`」，`:130` 说「改为 `callVisible`」） | **高** | ✅ 同上 | `31:262` vs `34:130` |

---

## 10. 总评

- **四张决策都能落地**：缺陷 1/2 的修法逐字可执行且**我独立复跑门禁证明修完归零**；三载体 cleanup **一个不漏**；S4b 是唯一补口且落点已一致（owner 拼法的阻断项已在评审门修掉）；公共组件的 props **足以组装第三处**。
- **「看起来做完但其实做不到」的族**共 14 条，其中 **6 条为高**（3 条自伤断言 + 1 条假门禁论断），**全部在本评审门内被认领并已落盘修复**（其中第 13/14 条为迁移落盘后新曝、主 agent 已裁修法）；**但第 5 条（冻结 10 的验收断言缺失）仍未落**——这是本批**唯一**「契约要求了、测试面没有」的闭环破口，**必须在实现前补**，否则 §7.3 那类「按钮渲染出来、点了没用」的静默失败会**照绿**通过。
- **方法学结论（我同意 Honesty/Consistency 的归纳并补充一条）**：本批所有 ❌ 都落在**字符串型断言**（计数、字面量、「会触发门禁」）这一族。**补充**：更精确的说法是「**断言与它引用的源码/编译产物之间没有机械对齐步骤**」——A7（断言了代码没写的）、A8（断言了一个仍为真的负例）、S3（断言扫的面比作者以为的宽）、§7.2（断言了门禁不做的）是同一种病的四个面。**实现阶段凡遇到这四类，必须把断言实际跑一遍再信。**
