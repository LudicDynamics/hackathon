# L3 评审门 · 跨文档一致性与契约对齐（`ReviewL3Consistency`）

> 只读评审。评审对象：`30`（L3 冻结契约，主 agent 亲写）与 `31`/`32`/`33`/`34`/`35`（子代理产出）。
> 评审角度：**跨文档一致性与契约对齐**（不是枚举行号精确性，也不是重跑探针）。
> 现状核对日：2026-09-15。所有「实测」为本评审在工作树上**亲自执行**的结果（命令与输出见 §5）。
> 严重级：**阻断 / 高 / 中 / 低**。

---

## 0. 一句话

**两条阻断级不一致**（`33`↔`32` 的 S4b owner 拼法；`35`↔`32`/`30` 的 UF-3a 计数），
**两条高级不一致**（`35`↔`30` 的 §11 未决 6 裁决状态；`33`↔`30`/`34` 的 V-1 裁决状态），
外加 5 条中级（编号/ID/规则数账/门禁论据/盲键清单）与 2 条低级。
**其中 A1、A2 已由主 agent 当场裁决（冻结 10 / 计数更正），本文记录其书面向量。**

---

## A. 逐份核对：31/32/33/34/35 是否与冻结契约 `30` 一致

### A1【阻断】同一控件，两份文档给出**不一致的 owner**：S4b 会「渲染出来、点了没用」

- `33` §7.3（今日 `:284-292`）：
  ```tsx
  {!nookChar && railCallOwner && (
    <button className="prototype-call-wake"
      onClick={() => void liveCallStop(`rail:${railCallOwner}`)} ... />
  )}
  ```
- `32` §4.2(3)（今日 `:376-380`）：
  ```tsx
  const railCallOwner = typeof liveCall.owner === 'string' && liveCall.owner.startsWith('rail:')
    ? liveCall.owner : null;          // ← 已含 'rail:' 前缀
  {!nookChar && shell.immersive && railCallOwner && (
    <button className="prototype-call-wake" onClick={() => void liveCallStop(railCallOwner)} ... />
  )}
  ```

`33` 的写法把前缀**再拼一次** ⇒ 实际调用 `stop('rail:rail:<id>')` ⇒ `live-call-store.ts` 的守卫
`if (owner !== undefined && committed.owner !== owner) return;`（今日 `:642`）**静默 return**。
后果：唤醒按钮**永远不挂断**，`33` §5.2 情形 C 的空集性补丁**当场失效**，而外观与「按钮存在」类断言全绿。
`32` §4.2 明写「`33` §7.3 已给精确形状，本文**照抄不另立**」⇒ **实现方抄 `33` 就中招**。

另附一处（同一代码块内）：`33` 的片段**没有** `shell.immersive &&` 守卫（靠 CSS `display:none`），`32` 有 ⇒ 32 声称的「照抄」实际不成立。

> 主 agent 已核实并按 `30` 新增 §5.4 冻结 10 定案：`railCallOwner` MUST 是**已含前缀**的完整 owner，调用方 **MUST 原样传递**。
> **本文的补充要求**：`33` §7.3 的代码块是**被抄写源**，必须与 `32` 逐字同形；否则契约冻结的是「原样传递」，而唯一给出完整定义的地方仍是错的。

### A2【阻断】UF-3a 计数：`35` 六处说「3→4」，`32`/`30` 说「逐字不变仍 3」

- `35` 的六处（今日行号）：§0 `:14`、§0 表 `:22`、§3-T2 `:286`、§7.1 结论 `:390`、§8 落点 `:424`、§11-W1 `:507`、§12-C1 `:565`、§9 差异表 `:451`、§10-A6 `:479`。
- `32` §2.2/§2.4/§5.3-T2/§9-D6（今日 `:58`/`:122`/`:445`/`:550`/`:557`）与**已被主 agent 更正的 `30` §7:245**：`available && entry.canTalk` 双门控 ⇒ **计数仍 3、零测试改动**，并写明「**MUST NOT 改成 4**（改成 4 会让该断言变红）」。

**独立复核（本评审实读源码，两条门各自充分）**：
1. `character-rail.test.mjs:157` 渲染的是 `view({ state: 'absent' })`，而 `character-rail.mjs:23` 是 `canTalk: inScene` ⇒ `absent ⇒ canTalk=false`（`UF-0` 今日 `:47-49` 逐字断 `absent.canTalk === false`）⇒ 麦克风不渲染；
2. 静态渲染下 `isAvailable()` 恒 `false`（`live-call-store.ts:495-505` 的 `ensureConfig` 只在 `subscribe` 时触发）⇒ 第一道门也关。

⇒ 计数**逐字 3**。`35` §10-A6 的失败定位还写着「`fail` 指向 UF-3a ⇒ **计数没改 4**」——**改 4 反而会让测试红**，这条自相矛盾。

> 主 agent 已裁决「`32` 对、`35` 错」，并要求 `35` 全文更正。**本文确认该裁决的实测依据成立**（§5 复现）。

### A3【高】明月的四项决策：`31`–`35` 全部遵守，但**决策 3 的收口说明在下游过期**

| 决策 | 下游落实 | 一致性 |
|---|---|---|
| 1 缺陷 1/2 并入本批 | `34` 全文；`30` §4.1/§4.2 冻结 6/7/7b | ✅ 一致 |
| 2 不开跨投影续存 | `32` §3.7（`rail:` cleanup）、`33` §5.1 L1 三支、`30` §2.3 | ✅ 一致 |
| 3 可见性门做成一份统一契约 | `33` 出清单；`35` §11-W28 登记 `33 §9.1` 为权威 ID | ⚠️ **`33` 自身未跟上 `30` 的两次修订**，见 A4 |
| 4 先抽公共组件再接第三处 | `31` 抽组件；`32` §3.3 只消费；`30` §3.2 冻结 4 | ✅ 一致 |

### A4【高】`33` 未跟上 `30` 的两次修订（§5.2 空集性、§5.3 冻结 9）

主 agent 修订过 `30` 两处：**§5.2**（空集性证伪 + 冻结 8b）与 **§5.3 冻结 9**（nook `error` 态必修）。下游跟上情况：

| 下游 | 是否跟上 | 证据 |
|---|---|---|
| `32` §11-W1 | ✅ 已登记证伪 | `:730` 引「`33` §5.2 情形 C」并承认 `30` §5.2 推论不成立 |
| `35` §12-C9 | ✅ 已登记 | `:573` 记录主 agent 已认错并给出 S4b |
| **`33` 自己** | ❌ **未跟上** | `33 §13 V-3`（`:524`）仍**逐字引用 `30` §5.2 的旧句**「不靠新宿主，靠生命周期绑载体——…窗口 MUST 为空集」，并建议主 agent「补一句」；而该句在今天的 `30` 里**已不存在**（`grep 不靠新宿主 docs/live-voice/30-*.md` 零命中），`30` 已改写为冻结 8b。`33` 引的是一段**已被删除的契约文字**。 |
| **`33` 自己** | ❌ **未跟上冻结 9** | `33 §13 V-1`（`:514`）写「**本文不裁**（越界到 `31`/`32` 的生命周期范围），只登记」；`33 §14`（`:545`）仍列「2. **V-1 是否本批修** —— 属 `DesignDefects` 的裁决面，本文只登记」。而 `30 §5.3 冻结 9` 已裁定 **本批必修**，`34 §6` 已给出修法。⇒ `33` 的「仍未知」表**两项已过期**（V-1 与 §9.3 之外）。 |

### A5【中】冻结条款引用核对

| 引用 | 存在性 | 结论 |
|---|---|---|
| `30` §2.2 / §2.3 / §2.4（冻结 1/2/3） | 存在 | ✅ 各份引用正确 |
| `30` §3.2 / §3.3（冻结 4/5） | 存在 | ✅ `31` §9、`35` §2.3 引用正确 |
| `30` §4.1 / §4.2（冻结 6/7） | 存在 | ✅ `34` 头部与正文引用正确 |
| `30` §5.2（冻结 8） | 存在 | ✅ |
| `30` §5.3（冻结 9） | 存在（新增） | ⚠️ `33` **未引用**（见 A4） |
| `30` §5.4（冻结 10） | 存在（新增） | ⚠️ `32`/`33` **未引用**（见 A1） |
| `30` §7.1（引用纪律） | 存在（今日 `:252`） | ✅ 但 **`31` 全文零引用**（`grep §7.1 docs/live-voice/31-*.md` 零命中），而 `31` 通篇用裸行号（`:174`/`:744`/`:982`）⇒ 与本批引用纪律不符（`31` 头部只写了「行号会漂」，没引 §7.1） |
| `33` §6.2 的 B2 | ❌ **锚点错** | `32` 三处引「`33` §6.2 的 B2」（今日 `32:18`/`:86`/`:243`），但 **B2 定义在 `33` §6 引言**（`:227`），`§6.2` 是「为什么缺口 1 不能靠角色栏常驻绕过」（`:245`）。应引 `33 §6`（或 §6 的 B2 定义处） |

### A6【中】`30` §11 已被重写，下游仍按旧版引用（含一处**结论级矛盾**）

`30 §11` 今日标题为「**未决项的裁决（2026-09-15 设计收口后回填）**」（`:304`），表格逐条给出裁决；mtime `13:35`，**晚于 `31`/`33`/`35`（12:34/12:59/13:00）**。

- `35 §11-W1`（`:507`）仍写「`30` §11「仍未知」（`:241-249`）」，行号区间已落空（该区间今日是 §5.2/§5.3 正文），标题也已是「未决项的裁决」。
- **结论级矛盾**：`30 §11` 第 6 行已裁 **「不在场角色能否发起通话」= MUST NOT（与 orb 共用 `entry.canTalk`）**；而 `35 §13` 第 4 条（`:583`）仍写「**本批仍未裁决**。它会影响 §2.5 是否需要加第 8 条规则」。**同一件事，契约说已裁，门禁文档说未裁。**
- `32` §2/§3.3/§3.4/§3.5/§12 与 `35 §11-W1` 继续用「`30` §11 未决 N」编号引述；因 `30 §11` 的表格行号 1–6 与旧编号**一一对应**，语义尚可解析，但措辞（「未决」）已与契约标题不符，属**口径漂移**。

---

## B. 交叉引用一致性

### B1【中】`31` ↔ `34`：nook 空态 hunk `:750-755` 的落地顺序仍未写死

- `31` §4.2 Step N-1/N-3（`:249-260` 一带）：把 `data-nook-zone="transcript"` 内层整块换成 `<LiveCallTranscript>`，并**删除** `copy.liveCallThem/You/Connecting` 的 5 处字幕用法；空态由组件按 `phase` 二选一（`Connecting…` / `Listening…`）。
- `34` §3.3（今日 `:131-144`）：在**同一 hunk** 里改空态，用 `copy.liveCallConnecting` 与 **`copy.liveCallStop`**。
- `34` 自己承认重叠（§10-W3）并把选择推给集成者（§12 第 3 条「**归集成者**」）。

**两处不一致的实质**：`34` 的 else 分支占位文案是 `copy.liveCallStop` = **「Hang up」**（`legacy-ui-copy.ts:50`），而 `31` 的收敛结果是 **「Listening…」**。即：不是「同一件事两处写」，而是**同一 hunk 产出两个不同的可见文案**。`34` §10-W3 只说了「MUST NOT 两处同时改」，**没有说选哪个**；主 agent 已要求 `34` 写死，本文确认该要求必要。

### B2【中】`32` ↔ `33`：挂断入口的位置与 `available` 门控**方向一致**，但 `33` 的 L2 行落后于 `32` 的裁定

- `33 §10` L2（`:450`）：「**不预设** `UF-3a` 计数改动…方案取舍归 `DesignRailEntry`（她文档会给两方案对比 + 裁定）」；L3（`:451`）：cleanup 用 `stop(\`rail:${view.id}\`)`。
- `32` §2.4 已裁定**方案 A（门控）**，§3.7 的 cleanup 用 **ref 镜像判据 + `stop(\`rail:${call.characterId}\`)`**（`callRef`，不是 `view.id`）。
- ⇒ `33` 的 L3 写法（每次渲染取 `view.id`）与 `32` 的最终形状**不同源**；`33` 未回写「已裁定」。方向不冲突（都带 owner），但两文档对同一 cleanup 给出两套判据，实现方需自行择一。
- 另：`32` §1/§2.4 引「`33` §6.2 的 B2」的锚点错，见 A5。

### B3【中】`33` ↔ `34`：V-1/V-5 的归属**跟上了**，但只跟到一半

- `34` §6 明确裁定 V-1 **本批必修**，并在 §7 把 V-5 作为承重反证引用（`:291`/`:300`）⇒ `33`→`34` 方向一致。
- 反向（`33` ← `34`）**未回写**：`33 §13 V-1`/`§14` 仍写「本文不裁 / 待 `DesignDefects`」（见 A4）。**这是一条单向闭环**——被引用方更新了，引用方没有。

### B4【低】`35` ↔ 各部门：同一份 `ux-contract.json` 的规则 ID 两套写法

`35 §11:420`（落点表）用 **`visibility.rail-keeps-chrome`** / **`visibility.nook-inner-zones-have-no-chrome`**；
`35 §2.5:213-214` 与 `35 §8:420` 之外的表用 **`visibility.rail-root-keeps-chrome`** / **`visibility.nook-lanes-carry-no-chrome`**（= `33 §9.1` 的权威 ID）。
同一文档内两套 ID 指向同两条规则 ⇒ 将来 `ux-contract.json` 只能落一套，另一套成为悬空引用。

### B5【低】`30` §5.1 与 `33` §3.2 对 G-B 的行号区间不同（`:176-179` vs `:176-180`）

实测 `prototype.css` 的 `.is-immersive .prototype-chrome` 块为 `:176-180`（含收尾 `}`）。属低危偏差，但本批纪律是「符号 + 当前行号」，同一符号应给同一区间。

---

## C. 未决项闭环（`30` §11 六条，逐条检查下游裁决与相互矛盾）

| # | `30` §11 裁决（今日 `:322-327`） | 下游裁决 | 是否矛盾 |
|---|---|---|---|
| 1 入口形态 | 方案 A + `available && entry.canTalk` 双门控 | `32` §2.4 ✅ 同 | ✅ |
| 2 字幕宿主 | 通话卡内，消费 `31` props | `32` §3.3、`31` §3.2 ✅ 同（接口逐字一致） | ✅ |
| 3 `useLiveCallFor` | 不需要 | `32` §12-4 ✅ 同 | ⚠️ `30 §6` 落点表（`:242`）仍写「**可能新增派生 hook…待设计**」⇒ 契约内**同一件事两处口径**（§6「待设计」vs §11「不需要」） |
| 4 nook zh-CN 回落 | 本批仅登记 | `31` §5.3、`35` §2.3 ✅ 同 | ✅ |
| 5 orb 徽标 | 不加 | `32` §3.4 ✅ 同 | ⚠️ `32 §12-1` 仍写「**待评审确认**」；`30` 已裁 ⇒ 下游自列为未决 |
| 6 不在场能否发起 | **MUST NOT** | `32` §3.5 ✅ 同 | ❌ **`35 §13-4`（`:583`）仍写「本批仍未裁决」** ⇒ 与契约直接矛盾（见 A6） |

**另**：`33 §14` 的 6 条「仍未知」中，第 2 条（V-1 是否本批修）与第 6 条推进已分别由 `30 §5.3`、`35 §2.4` 处置，但 `33` 未标注；第 1 条（S4b 视觉形态）与 `32 §12-3`（通话卡视觉形态）都挂「needs designer」，**两处描述的是两个不同元素**（App 级唤醒控件 vs rail 内通话卡），没有被同一份文档收口 ⇒ 视觉面的未决落在两处。

---

## D. 编号 / 路径 / ID 一致性

### D1【中】`ux-contract.json` 规则数账：三处口径，含一处**互斥**

| 出处 | 账 |
|---|---|
| `33 §12 R5`（`:483`） | 18 → **21**（P1-P3） → **23**（+归属两条） → **24**（+fetch） → **25**（+P4） |
| `30 §10.8`（`:298`） | 「规则数为 **23**（**+P4 则 24**）」 |
| `35 §2.5`（`:220`） | 18 → **23** → `24` → `25`（+P4） |
| `35 §9`（`:447`） | 「…若 S4b 的 P4 落则 **`25` 或 `26`**」 |

`30` 的「+P4 则 24」与 `35 §9` 的「25 或 26」**互斥**（差 1–2）。`35 §9` 的「25 **或** 26」本身不确定，因 `35` 第 7 条 fetch 规则是 SHOULD（未定）。
`30 §10` 是验收判据（契约），下游必须与它对齐；现状**没有一份文档的账能同时满足另两份**。

### D2【中】`33` 给出的「P3 会抓 `pointer-events: auto`」的论据**实测不成立**

`33 §7.2`（`:266-273`）与 `35 §2.5`（`:224`）都写：「若实现者写成 `.is-immersive .prototype-chrome.<新类> { … pointer-events: auto !important; }`，`css-declaration` 规则会**同时**报一条 finding」，并把它称为「**有意的摩擦**」，作为「MUST NOT 穿透」的**第二个独立理由**。

**本评审实测（用 `tools/check-ux-contract.mjs` 的 `scanSource` + 真实 `ux-contract.json`）**：
- 候选 A（含 `.is-immersive .prototype-chrome.character-rail--on-call { display: block; pointer-events: auto !important; }`）在 `prototype.css` 上 ⇒ **findings 为空**。
- 原因：`auto` 反模式检测用的正则锚在该规则自己的 `expect.property` 上（`check-ux-contract.mjs:187-191`：`new RegExp(\`${property}\\s*:\\s*auto\\b\`)`），而 P3/P4 的 `property` 是 `opacity`/`display`；全仓唯一 `property: "pointer-events"` 的规则（`ghost.pointer-events`）**target 是 `index.css`**，不覆盖 `prototype.css`。
- 唯一真会报的是「P3 找不到 `opacity: 0 !important`」——但那在候选 A 里**仍在**。

⇒ 「穿透路线会新增一条 finding」**不是事实**；`MUST NOT 穿透` 仍由 §5.0 的 CSS 引理（`opacity` 祖先不可救回）充分支撑，但第二条理由与「有意摩擦」的门禁设计**不成立**，会让实现方误判门禁行为。

### D3【中】`35` 的新 i18n 守卫漏掉**间接索引**的盲键

`35 §2.3.2`（`:144-153`）的姿态是「8 个盲键 = 今天的完整清单」，判定正则 `/copy\.([A-Za-z_]\w*)/` 只抓 `copy.<标识符>`。

但 `live-call-store.ts` 的 `errorText` 除了 `copy.liveError*` 直接读，还有**间接读** `copy[key]`（`:273-274`，`key` 来自 `ERROR_COPY_KEYS`，`:118-126` 映射到 `liveErrorWorld` / `liveErrorCharacter` / `liveErrorRequest` / `liveErrorVoice` / `liveErrorOffer`）。本评审实测这些值在 `messages.json` 中的存在性：

```
liveErrorWorld      ("The world is no longer open.")           → 0 命中
liveErrorRequest    ("The call request was rejected.")          → 0 命中
liveErrorVoice      ("This character has no usable voice.")     → 0 命中
liveErrorOffer      ("The audio offer was refused by the voice service.") → 0 命中
liveErrorCharacter  ("This character has no ikigai to call from.")      → 1 命中
liveErrorMicDenied  → 1 命中
```

⇒ 至少 4 个键在 zh-CN 下同样静默回落英文，却**既不在 `BLIND_KEY_BASELINE`，也不会被新守卫抓**（正则匹配不到 `copy[key]`）。**这条门禁恰恰是为「登记现状 + 不再扩大」而建的**，漏项会让 `35 §10-A3` 的「8 registered blind key(s)」被读成「盲区只有 8 个」。
（`35 §2.3.1` 的表把 store 读点写成 4 个键，与源码里的 5 个映射键 + 1 个默认键不符，属同一漏项。）

### D4【中】文档编号与文件名：一致；但 `30` 头部权威层级表**未列 `35` 的门禁 ID 出处**

`30` §1 表把 `31`–`35` 统称「L3 设计文档（子代理产出）」，未区分 `33`（可见性契约，含 P1–P4 门禁源）与 `35`（门禁与回写）。`35 §11-W28` 已声明「`33 §9.1` 的 P1–P4 是本文 §2.5 表第 1-4 行的**权威 ID**」⇒ 这份「谁是权威」的约定**只存在于 `35` 内**，契约 `30` 未登记 ⇒ 第三方难以判断 ID 冲突时以谁为准（正是 A6/D1 的根源之一）。

### D5【低】`34` 的元数据（自报实测）与工作树不符

`34` 头部（`:5`）：「行号实测于 2026-09-15 的工作树（`NookView.tsx` **993 行** / `CharacterModal.tsx` **1141 行** / `live-call-store.ts` **737 行**）」；§8.5（`:556`）与 §9.6（`:649`）：「`live-call-store.test.mjs` **42 pass**」。

**实测**：`812` / `1083` / `736`（`wc -l`），`live-call-store.test.mjs` **26 tests / 26 pass / 0 skipped**（`node --test`）。
`32`/`33` 头部写的 `812`/`1083`/`737` 分别正确/正确/差 1。正文引用的**行号本身是对的**，只有这句「实测行数/用例数」是假的 ⇒ 会误导后来者对「哪份文档的基线可信」的判断。

---

## E. 一致性总评

### 已自洽（可直接进入实现）

1. **三载体模型与归属语义**：`30` §2.2/§2.3/§2.4 与 `32`（`rail:<id>`、逐行判据）、`33` §5.1/§5.2（L1 三支）、`34` §2/§3/§4（Q1 vs Q2 的判据拆分）**逐条一致**，无矛盾。
2. **公共组件接口**：`31` §3.2 的 props 签名与 `32` §3.3「我只消费这一个签名（`31` §3.2 冻结）」**逐字同形**；`31` §3.6 的「不发 `data-nook-zone`、不加 role」与 `32` §3.2「`role="log"` 由载体外盒承担」**接口闭合**。
3. **缺陷 2 的谓词**：`30` §4.2 冻结 7 / 冻结 7b 与 `34` §4.3/§4.5 的六格证明、`10:187` 与 `12:77` 的同步修订（`git diff` 已核实）**一致**。
4. **承重反例（MUST NOT 统一生命周期）**：`30` §5.2、`33 §5.2 A′`、`34 §4.5`、`35 §12-C10` 四处对 `hangUp` 无条件 `stop()` 的说法**一致**。
5. **门禁口径**：`31`（0 键/0 帧）、`32`（0 键/0 帧）、`34`（0 键/0 帧）、`35` §2.1/§2.2（`28/26/28`、`11 routes` 不变）与 **本评审实测**（`check-ws-contract: clean (28 emitted, 26 consumed, 28 in contract)`、`check-request-bodies: clean (11 route(s) pinned)`、`check-ux-contract: clean (18 rules, 140 files)`）**一致**。
6. **`30` §5.2 的证伪与修正**：`30`（冻结 8b）、`33`（S4b 形状）、`32`（S4b 接线）、`35`（P4 落地顺序）四处**方向一致**（唯一瑕疵是 A1 的 owner 拼法）。

### 必须修后才能实现

| 序 | 修什么 | 归属 | 严重级 |
|---|---|---|---|
| 1 | `33 §7.3` 的 S4b onClick 改为**原样传递** `railCallOwner`（与 `32 §4.2` 逐字同形）；补 `shell.immersive &&` 与否须两处一致（A1） | `DesignVisibility` | **阻断** |
| 2 | `35` 全文六处「UF-3a 3→4」改为「**逐字不变仍 3**」+ 理由（双门控 + UF-3a 用 `absent` 视图）；**修正 §10-A6 的失败定位**（A2） | `DesignGates` | **阻断** |
| 3 | `33 §13 V-3` 删掉对 `30 §5.2` **已删除句子的引用**；`§13 V-1`/`§14` 补「已由 `30 §5.3` 冻结 9 裁定本批必修」（A4） | `DesignVisibility` | 高 |
| 4 | `35 §13-4` 的「未决 6 仍未裁决」改为「已裁（`30 §11` 第 6 行）」；`35 §11-W1` 的 `30 §11 :241-249` 改为「`30` §11 裁决表」（A6） | `DesignGates` | 高 |
| 5 | `34 §3.3` 的空态文案**写死**（`Listening…` 或 `Hang up`），并显式声明与 `31` C-1 的先后（B1） | `DesignDefects` | 中 |
| 6 | 统一 `ux-contract.json` 规则数账（以 `30 §10.8` 为准），并让 `33 §12 R5`/`35 §2.5`/`35 §9` 三处收敛到同一个数（D1） | `DesignGates` | 中 |
| 7 | `33 §9.1` 的 P1/P2 ID 与 `35 §11:420` 的旧名二选一，全文统一（B4） | 双方 | 中 |
| 8 | 删除或改写「穿透路线会被 `css-declaration` 的 `auto` 检测报 finding」的论据（实测不成立），改回只保留 CSS 引理这一条理由（D2） | `DesignVisibility` + `DesignGates` | 中 |
| 9 | `35 §2.3.2` 的盲键守卫补上**间接索引**路径，或把 `liveErrorWorld/Request/Voice/Offer` 计入基线并说明正则的已知盲点（D3） | `DesignGates` | 中 |
| 10 | `34` 头部元数据与 §8.5/§9.6 的用例数改为实测值（`812/1083/736`、`26 pass`）（D5） | `DesignDefects` | 低 |
| 11 | `31` 头部补引 `30 §7.1`（引用纪律）；`32` 三处「`33` §6.2 的 B2」改锚到 `33 §6`（A5） | `DesignSharedComponent` / `DesignRailEntry` | 低 |

---

## 5. 实测记录（可复现）

```
$ wc -l apps/web/src/components/nook/NookView.tsx apps/web/src/components/overlay/CharacterModal.tsx apps/web/src/lib/live-call-store.ts
   812 / 1083 / 736                         # 34 头部自报 993 / 1141 / 737

$ node --test apps/web/test/live-call-store.test.mjs
 tests 26 | pass 26 | fail 0 | skipped 0     # 34 §8.5 自报 42 pass
$ node --test apps/web/test/character-modal-call-ui.test.mjs
 tests 16 | pass 16 | fail 0 | skipped 0
$ node --test apps/web/test/character-rail.test.mjs
 tests 23 | pass 12 | fail 0 | skipped 11    # UF-3a 所在渲染组全 skip

$ node tools/check-ws-contract.mjs
 check-ws-contract: clean (28 emitted, 26 consumed, 28 in contract)
$ node tools/check-request-bodies.mjs
 check-request-bodies: clean (11 route(s) pinned)
$ node tools/check-ux-contract.mjs
 check-ux-contract: clean (18 rules, 140 files)

# A2 的两条门（源码实读）
apps/web/test/character-rail.test.mjs:157   render([view({ state: 'absent', ... })])
apps/web/src/lib/character-rail.mjs:23      canTalk: inScene
apps/web/test/character-rail.test.mjs:51    assert.equal(absent.canTalk, false)
apps/web/src/lib/live-call-store.ts:495-505 ensureConfig 只在 subscribe 时触发

# A1 的守卫（源码实读）
apps/web/src/lib/live-call-store.ts:642     if (owner !== undefined && committed.owner !== owner) return;
docs/live-voice/33-...md:288                onClick={() => void liveCallStop(`rail:${railCallOwner}`)}
docs/live-voice/32-...md:368-380            railCallOwner = owner.startsWith('rail:') ? owner : null; liveCallStop(railCallOwner)

# D2 的门禁反证（scanSource + 真实 ux-contract.json）
候选 A（含 .prototype-chrome.<新类> { pointer-events: auto !important }）→ findings = []
原因：check-ux-contract.mjs:187-191 的 auto 正则锚在该规则 expect.property（P3=opacity / P4=display）；
     唯一 property="pointer-events" 的规则 ghost.pointer-events 的 target 是 apps/web/src/index.css。

# D3 的盲键（逐值查 messages.json）
liveErrorWorld/Request/Voice/Offer → messages.json 0 命中（盲，但不在 BLIND_KEY_BASELINE）
liveErrorCharacter / liveErrorMicDenied → 1 命中（不盲）

# A4/A6 的文档事实
grep -n "不靠新宿主" docs/live-voice/30-*.md          → 零命中（33 §13 V-3 引的是已删除的句子）
mtime: 30=13:35（晚于 31=12:34 / 33=12:59 / 35=13:00）
```

> **未核验项（标注 `[UNKNOWN]`）**：`33 §7.2` 所称的「实测已把规则喂给两段候选 CSS」其**原始实验脚本**未落盘，本评审无法复现其结论；本文只报告**用现成 `scanSource` 复跑**的结果（与 `33` 的结论相反）。
