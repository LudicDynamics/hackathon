# REVIEW-Semantics — 语义兑现 / 需求强度 / 闭环性（独立评审）

> 评审对象：`docs/prompts/00`–`05`（6 份设计文档，实现尚未开始）。
> 本文只评审，不改任何被评审文件。落点/行号一律本次实测（2026-09-12）。
> 重点维度 = **3 语义兑现/需求强度** + **4 闭环性**；六个维度逐项给结论。

---

## 0. 结论速览

| 维度 | 结论 | 关键发现 |
|---|---|---|
| 1 跨文档一致性 | **通过（有 2 处 MINOR）** | `writer-char` / `system-char` / `component-narration` / `holmes-world-style` 全批一致；`holmes-voice`（05:251）、`arrange 归 04`（01:235/237 vs 04:565）两处断链 |
| 2 契约冻结遵守 | **通过** | 未见私改落点常量 / slot 名 / 语言分层；英文正文实测 0 CJK |
| 3 语义兑现 / 需求强度 | **不通过（1 BLOCKER + 1 MAJOR）** | 01 逐条兑现；**02 正文没有任何 skill 指路**，且正文逐个教了工具用法——与用户要求、与其自身 §2 声明、与 00 §3.2 三方冲突 |
| 4 闭环性 | **不通过（1 MAJOR）** | 01 正文提到的工具/skill/注入块全部有唯一定义处；**02 的 A2 断言（sed 区间）实测必红** |
| 5 可实施性 | **基本通过（1 BLOCKER 同 4、若干 NIT）** | 正文逐字可贴、落点区间精确；A2 断言的 sed 终止模式写错，无法落地 |
| 6 诚实性 | **不通过（1 MAJOR）** | 02 §⑩-3 把"正文只提指路见平台级 skill"写成既成事实，正文里根本不存在这句话（"登记当做到"） |

**必须实现前修掉的（BLOCKER）**：B1（02 正文缺 skill 指路 → 用户明确要求未兑现 + 与自身 §2 自相矛盾）、B2（02 §⑧ A2 断言的 sed 区间错误，实测 7≠6）。

---

## 1. 用户要求 → 正文原句证据表（维度 3 主表）

> "正文原句"= 01 的 `docs/prompts/01-作家提示词.md:35-148` 与 02 的 `docs/prompts/02-角色提示词.md:188-226` 两个 ```text 块内的逐字英文。

| # | 用户硬要求 | 正文原句证据（⚠️ = 缺失或不足） | 结论 |
|---|---|---|---|
| W1 | 作家单轮第一步：理解玩家**输入（意图）** | 01:43-44 `"1. Read the player's intent, not their words. Work out what the player is trying to change in the world."` | ✅ 兑现，且给了判据（"想改变世界的什么"）而非形容词 |
| W2 | 读**注入的场景状态**看清场景 | 01:49-52 `"2. Read the world before you write. The state block above describes the turn you just received: the player's viewpoint, this layer, who is present, the bag, recent writing, what has changed."` + `"It is an index, not the world."` | ✅ 兑现；六节全部点到（viewpoint/layer_files/cast/bag/recent_chalk/dynamics），且点名 `look_at`/`read` 而非泛泛 "examine" |
| W3 | 写叙事，chalk 展开旁白 | 01:57-62 `"3. Write the turn with chalk. chalk lands a real markdown file on the canvas and records the world event; text that lives only in your reply never reaches the player, and the canvas stays empty."` + `"One beat per chalk"` | ✅ 兑现，含失败后果 |
| W4 | 活用组件 | 01:64-68 `"Not all of a passage is prose. A letter the player can open, a locked door, a piano, a notice pinned to a wall — these are entities … Look up the kind's contract with get_component before you author a new one, and create or rewrite it with write or edit."` | ✅ 兑现（含 `get_component` 前置 + 四例载体） |
| W5 | **组件也是旁白** | 01:65-66 `"an entity on the canvas is narration the player can hold"` | ✅ 兑现（这句就是用户原话的落地） |
| W6 | 把行动权还给玩家（choice / 骰子） | 01:75-77 `"4. Hand the turn back. End by giving control back to the player through the world, not by asking for it in prose. Declared choice options in an entity's frontmatter become the buttons the player presses; a declared roll_dice check leaves the outcome to chance."` | ✅ 兑现 |
| W7 | 最后一句**收束到景物或他人行动** | 01:80-82 `"Close the passage on something concrete: a detail of the scene that has moved, a hand already reaching, a light going out. The camera rests on the world; the options below carry the decision."` | ✅ 兑现（"a hand already reaching" = 他人行动；"a light going out" = 景物） |
| W8 | **元叙事红线：绝不写"你打算怎么做？"** | 01:106 `"Never write \"What do you do?\", \"What will you do?\", or \"It's up to you.\""` | ✅ 兑现，并给了**可判定测试**：`"if the sentence describes nothing that is happening, and only asks the player to decide, cut it"` |
| C1 | 角色主要职责 = 用自己的口吻说话 | 02:195 `"Your one standing duty is to speak as yourself."` | ✅ 兑现 |
| C2 | 角色说的话**对玩家就是叙事** | 02:195 `"Your lines are not commentary on the scene … for the player, your words ARE the scene."` | ✅ 兑现（逐字对应） |
| C3 | **每句换行** | 02:200 `"Write every sentence on its own line. Finish the thought, then break to a new line before the next one; never let two sentences share a line"` | ✅ 兑现，且给出机制理由（逐行流式） |
| C4 | **切换情绪句前面 `[emo: tag]`** | 02:207 `"Tag your first line, and tag any line whose mood differs from the line before it; a run of lines in the same mood can share the single tag that opened it."` | ✅ 兑现，且比现状（"every line"）更贴用户口径 |
| C5 | `[emo: tag]` 写法精确到解析器能认 | 02:203-209 六个 tag 逐字 `[emo: normal] [emo: smile] [emo: shock] [emo: sad] [emo: angry] [emo: thinking]`；闭集与 `apps/web/src/lib/audio.ts:37`、顺序与 `CharacterModal.tsx:32` 一致（实测） | ✅ 兑现（六 tag 唯一集合实测 = 6，见 §6 附表"02 C4 六 tag 唯一集合"行） |
| C6 | **工具是能力不是职责** | 02:212 `"Tools are how you touch the world, not a job title. You are not required to use any of them on any given turn"` | ✅ 兑现 |
| C7 | **鼓励用工具证明活在世界里** | 02:212 `"A character who only ever talks is a voice; a character who acts is someone who lives here."` | ✅ 兑现 |
| C8 | 场景**新剧情**要主动去看一眼 | 02:213 `"- look_at — the page you were opened with may name something new … One look_at on that path tells you what actually changed; do not react to a summary of a thing you have not looked at."` | ✅ 兑现 |
| S1 | 作家：细则进 skill，常驻层只写基本通用的 | 01:144-147 `"Doing it well — pacing, building a passage out of components, the creative uses of the tools … belongs to the skills; read the one whose description matches what you are about to do. The world's voice and its plot threads are skills too."` | ✅ 兑现（且正文**不含**任何具体 skill 名，实测 A6 通过） |
| S2 | **角色：细则进 skill，常驻层只写基本通用的** | ⚠️ **缺失**：02 正文（`02-角色提示词.md:188-226`）里 `skill` 一词**零命中**（实测 `grep -i skill` 退出码 1）。角色没有任何"详细用法见 skill"的指路。 | ❌ **BLOCKER B1** |
| S3 | 角色：常驻层**不逐个教工具用法** | ⚠️ **违反**：02:213-219 逐条列了 7 个工具（`look_at/chalk/move_to/show/use_item_on/move/choose`）各自"When to use"，这正是 `00 §3.2:78` 明写的"**不放**：工具逐个用法（→ 工具层 description + 细则层）" | ❌ **MAJOR B3**（与 02 自身 §2 声明冲突，见 §3 维度 3） |

**需求强度反例（"能跑"vs"够味"）**：

- 未发现被写弱的条目：四条 writer 步骤与全部角色格式要求都带**可自问自答的判据**或**失败后果**，不是形容词（对照 doc-23 §2.3 的判据要求，实测每条都有 "how a passage ends up contradicting the room…" 这类后果句）。
- 唯一"强度被削弱"的地方是 S2/S3：用户明确要"角色也用 skill 学详细用法"，结果 02 把详细用法**内联进了常驻层**、同时**删掉了指路**——两个方向都错。修法见 B1/B3。
- `<=200 words` 硬上限被换成判据（01:289 §⑩-1 已**披露**为待拍板，非隐瞒）→ 可接受。

---

## 2. 工具名核验（实际并集，构造后逐名比对）

**实际并集构造**（本次实测，非照抄文档）：

- AIRP 15：`extensions/toolkit/*.ts` 的 `name: '<x>'` → 实测恰好 15 个：
  `arrange, chalk, choose, get_component, delete, set_following, generate_image, link, look_at, view_canvas, move_to, move, roll_dice, show, use_item_on`
  （`grep -rn "name: '" extensions/toolkit/*.ts | wc -l` = **15**）
- 内建 9：`read, bash, edit, write, grep, find, ls, subagent, subagent_profiles`（`00 §8:249-250` 的冻结基线）
- **并集 = 24 名。**

**比对结果（对 01 / 02 两段正文逐词扫描）：**

| 文档 | 正文出现的工具名（∩ 并集） | 并集外工具名 | 禁用名（`get_state`/`set_state`/`state_update`/`watch_state`/`recall`/`retrieve`） |
|---|---|---|---|
| 01 正文（01:35-148） | `bash, chalk, choose, edit, get_component, look_at, move, move_to, read, roll_dice, show, subagent, subagent_profiles, use_item_on, write`（15 名，全部 ⊆ 并集） | 无 | **0 命中** ✅ |
| 02 正文（02:188-226） | `bash, chalk, choose, look_at, move, move_to, show, use_item_on, write`（9 名，全部 ⊆ 并集） | 无 | **0 命中** ✅ |

**逐名核对与 `00 §5` 事实表（本次读源码复核，非照抄）：**

| 工具 | 正文断言 | 源码真相（实测） | 判定 |
| `look_at` | "renders an entity or a whole layer as the player sees it, interactive blocks included" | `extensions/toolkit/look-at.ts:19-23` description：玩家可见视图、隐藏原始 YAML、保留 status/choice/roll dice | ✅ |
| `read` | "raw file when you need exact frontmatter" | `look-at.ts:23` "Use read when you need the raw frontmatter to edit it." | ✅ |
| `chalk` | "lands a real markdown file … records the world event"；"Pass the body alone — the tool writes the type: chalk frontmatter" | `chalk.ts:37` description 明写 "names the file, writes the `type: chalk` frontmatter, and records the world event"；`chalk.ts:72-79` 不传 `frontmatter` | ✅ |
| `chalk` 参数 | `append_to` / `path` | `chalk.ts:42-60` 参数 `content/path/link_to/append_to` | ✅ |
| `edit`（Phase ② 写互动字段） | "Add those fields to the same file in a second pass with edit" | `chalk.ts:79` 注释 "interactive fields arrive in Phase ② via `edit`" | ✅ |
| `get_component` | "look up the kind's contract before you author a new one" | `component.ts:20-22` "Look up a canvas component kind: its purpose, its frontmatter fields, and a minimal example. … Read-only" | ✅ |
| `write`（造组件） | "create or rewrite it with write or edit" | `component.ts:38` guideline "before writing or editing any file with frontmatter `type: component`" | ✅ |
| `use_item_on` | "an item is applied with use_item_on … update the entities it touched" | `use-item.ts:20-23` "the item is NOT consumed or moved (call move for that)" | ✅（正文只说"应用"，另行要求演化） |
| `move` | "An object file moves with move" | `move.ts:20-26` 物件文件 take/drop/give；"Move a character with move_to" | ✅ |
| `move_to` | "a character's presence moves with move_to" | `move-to.ts:20-24` "This only moves their presence on the canvas — it never moves files" | ✅ |
| `choose` | "records the selection and nothing more: it does not advance the story, delete the other options, or decide the consequence" | `choose.ts:27-28` 同义逐字 | ✅ |
| `roll_dice` | "takes only the file path"；"never pass one" | `roll-dice.ts:31-35` 仅 `path`；`:36-39` 注释 caller 不得传 result/type/expect | ✅ |
| `expect` 引号 | `expect: ">50"` | `packages/shared/src/schemas/frontmatter.ts:80-83` 注释 "MUST be quoted" | ✅ |
| `show` | "performs once and writes nothing" | `show.ts:29-31` "It is pure staging — nothing is written, no card is created" | ✅ |
| `bash`（反模式） | "an entity moved with bash mv … skips the filename convention and the world event log" | `move.ts:25-26` "Never use bash mv or write to move an entity" | ✅ |
| `subagent` + `scene-init` | "Delegate that to the scene-init profile with subagent (check subagent_profiles …)" | `presets/scene-init.json:3,6` `id: "scene-init"`、`delegatable: true`；`vendor/.../core/subagent/extension.ts:19` `isDelegatable` 按 `p.delegatable === true` | ✅ |

**结论**：`01`/`02` 正文提到的**每一个**工具名都在实际并集内，无幻影工具、无禁用名。**通过。**

**词法扫描的一个陷阱（供实现期断言参考）**：`01:44` 的 `"delete the other options"` 里的 `delete` 是英文动词，不是 `delete` 工具。任何"抽取正文已知工具名断言 ⊆ 白名单"的机械断言（如 `02 §⑧ A8` 的做法）必须只认**反引号包裹**或**行首 `- name —` 形态**，否则会把这个动词误报成工具名。`01` 未给 A8 类断言，故 01 无风险；02 的 A8 只测自己正文且其正文无此歧义词，**但该断言若被复制到 01 会立刻误红** → 见 MINOR M6。

---

## 3. 维度逐项结论（六个维度）

### 维度 1 — 跨文档一致性：**通过（2 MINOR）**

| 检查项 | 实测 | 结论 |
|---|---|---|
| `writer-char` vs `writer-instruction` | `00 §4.1:111` 定 canonical `writer-char` 别名 `writer-instruction`；`01:22`、`presets/writer.json:18-19`、`extensions/instructions.ts:116,121` 三处一致 | ✅ |
| `system-char` vs `char-instruction` | `00 §4.1:112`；`02:23`；`presets/character.json:19`；`instructions.ts:128,133` 四处一致 | ✅ |
| `component-narration` vs 旧中文名 | `00:171`、`04:24,44,124`、`05:1059` 全用 `component-narration`；中文 `组件叙事/` 只在 `04:501` 作为"待回写的旧示例"出现 | ✅ |
| `holmes-world-style` vs `holmes-beckstreet-style` | `00:184`、`04:46,55,369,630`、`04` C3 裁决 全用目录名 | ✅ |
| `tool-craft` | `00:172`、`04:28`、`05:1060` 一致 | ✅ |
| **`holmes-voice`（幽灵符号）** | `05:251` 称实测里"世界级 `holmes-voice` 两个名字都在"，而全批定义的 holmes 世界级 skill 名是 `holmes-world-style`/`holmes-world-plot`（`04:46-47`）。全仓 grep `holmes-voice` 仅命中这一行 | ❌ **MINOR M1**（与 `REVIEW-Consistency.md` M1 同源，建议按该报告修） |
| **`arrange` 归属** | `01:235/237` 称 `link`/`arrange` 的创意用法"归 `04-skill体系.md`"；`04:565,642` 明写 `arrange` **本批不做 skill** | ❌ **MINOR M2**（悬空指路） |

其余（槽位、deny 名单、`CharacterModal.tsx`/`audio.ts` 行号、`presets.ts`/`launch.ts` 行号）全批一致，本次实测复核通过。

### 维度 2 — 契约冻结遵守：**通过**

逐条对照 `00` 冻结项，**未发现任何一篇私改共享形状**：

- 落点常量名：`01`/`02` 只引用 `WRITER_INSTRUCTION`/`CHARACTER_INSTRUCTION`/`NEXT_STEP_RULES`/`CHARACTER_NEXT_STEP_RULES`，与 `extensions/instructions.ts:37,44,53,68` 逐字一致 ✅
- slot 名：`writer-char` / `system-char` / `scene-init-instruction` 与 `instructions.ts:116,128,140` 一致 ✅
- 语言分层：`01` 正文实测 CJK = 0、`02` 正文实测 CJK = 0（`re.findall(r'[\u4e00-\u9fff]')` 逐段）→ 平台口径英文 ✅；`04` 世界级跟随世界语言（firstsnow=日文）与 `00 §3.3:87-89` 例外条款一致 ✅
- 反模式：`00 §7.1`（世界模板不另抄平台口径）被 `01 §⑨ C4` 强化而非违反 ✅
- `02 §2:30` 明确写"装配关系（本批冻结，本文只引用）" ✅

**通过。**

### 维度 3 — 语义兑现 / 需求强度：**不通过**（1 BLOCKER + 1 MAJOR）

见 §1 表。`01` 逐条兑现（W1–W8、S1 全部 ✅）。`02` 在 C1–C8 全部兑现，但：

- **S2 缺 skill 指路** → BLOCKER B1（用户明确要求未兑现）。
- **S3 常驻层逐个教工具** → MAJOR B3（违反 `00 §3.2` 且与自身 §2 冲突）。

**通过项须明写**：W4/W5（组件也是旁白）与 W7（收束到景物/他人行动）——这两条最容易被敷衍成形容词，实测 01 都给了**可执行形状**而非形容词，判为真兑现。

### 维度 4 — 闭环性：**不通过**（1 MAJOR）

**4.1 工具名唯一性**：见 §2，01/02 正文提到的每个工具名都在 24-名并集内，且各有唯一定义处（`extensions/toolkit/*.ts` + `extensions/tools.ts` 单点注册）。**通过。**

**4.2 注入块分节名是否真被 `docs/hooks/00` 定义**（不假设，实测）：

| 引用处 | 声称 | 实测 | 结论 |
|---|---|---|---|
| `01 §⑤:193-197` | 六节 `viewpoint/layer_files/cast/bag/recent_chalk/dynamics` + `next_step` 归 `docs/hooks/00 §3.2` | `docs/hooks/00-共同上下文.md:57-65` 表正是这六 key + `next_step`；`:49` 说明 `next_step` 不在 `SectionKey` 联合 | ✅ |
| `02 §⑤:73-77` | 五段 `Standing / In this layer / Also here / Recently, in the world` + 末行 | `docs/hooks/00:71-75` 角色 4 节；节标题字面在 `docs/hooks/00:101`；`standing` 精确输出在 `docs/hooks/02-分节表与渲染.md:239-260` | ✅（`02:76` 引 `docs/hooks/02:239-260` 与实测一致） |
| `01 §⑤:195` | `docs/hooks/00 §3.2` 的节 | 同上 | ✅ |

**通过。**

**4.3 每个动作是否落到具体函数/文件**：01 的 step 3/4/两阶段/骰子/委托全部有 `file:line`（`chalk.ts:79`、`roll-dice.ts:31-40`、`frontmatter.ts:80-83`、`presets/scene-init.json`）→ 通过。02 的工具行也各有 `file:line`（`move-to.ts:18-24`、`show.ts:29-32`、`choose.ts:26-28`、`use-item.ts:20-23`）→ 通过。

**4.4 "细则见 skill" 是否有对应 skill**：01 的泛指句不点具体 skill，无悬空名 ✅。`01 §⑩-5` 的跨篇假设（"skill description 足够具体"）由 04 兑现——实测 `04:124` 的 `component-narration` description 点名 `plain chalk`/`note`/`letter`/`get_component`，`04:209` 的 `tool-craft` description 点名 `move_to`/`show`/`choice`/`roll_dice`/`link` → **假设成立** ✅。

**4.5 但 02 的验收断言自身不闭环 → MAJOR B2**：见下节 §5-B2。

### 维度 5 — 可实施性：**基本通过**

- 落点区间精确：`01 §2:24` 引 `extensions/instructions.ts:53-66`（实测常量正是 53-66 ✅）；`02 §2:24` 引 `:68-77`（头部 68、插值 77 ✅）。
- 正文"逐字可贴"：两段均为完整英文常量体，段落标题与现有 `[Performance Discipline]` 同风格 ✅。
- `02 §⑧ A7` 的 `! grep -qE ...` 前置 `!` 是**有效 shell**（非 `set -e` 下的裸 `!` 取反可工作）✅。
- **BLOCKER B2（同维度 4）**：`02:130-131` 的 A2 断言 `sed -n '/export const CHARACTER_INSTRUCTION/,/^\`;/p'` 的**终止模式永远不匹配**——`extensions/instructions.ts:77` 的收尾行是 `${CHARACTER_NEXT_STEP_RULES}\`;`，**不以反引号开头**，故 sed 区间跑到 EOF（实测覆盖 84 行），`grep -o '\[emo: [a-z]*\]' | sort -u | wc -l` 返回 **7**（多吞了 `instructions.ts:129` registerSlot description 里的 `[emo: tag]`），而断言写 `# 期望 6` → **必然失败**。
- NIT M5：`01:33,268` 的 A7 要求"反引号已转义"，但 01 正文内部反引号数 = **0**（只有两行围栏）→ 该机械改动为空操作，说明文字可删。
- NIT M7：`01:25` 称新正文 "正文 ≈1150 词英文"，实测 **1350 词**；`02:67` 称"约 60 行常驻正文"，实测 **39 行 / 1110 词**。数字不影响实施，但会误导评审。

### 维度 6 — 诚实性：**不通过（1 MAJOR）**

**通过项（须明写）**：

- `[推断]` 有标：`01:245` `"[推断：失败文案以 fail() 包装为准]"` ✅；`00 §2` 全表标"实测"并给探针方法 ✅。
- 待拍板 != 已定：`01 §⑩`（5 项）、`02 §⑩`（5 项）、`04 §⑩`（6 项）、`05:1101` 均以"倾向 / 待定 / 留评审"措辞列出，未伪装 ✅。
- 跨端断链未粉饰：`02 §⑧:160` 与 `02 §⑩-1:175` 明写"改 `CHARACTER_INSTRUCTION` 今天不会改变玩家看到的任何字"，并给三条 `file:line`（实测 `CharacterModal.tsx:174-184` 发完即读 `FALLBACK_REPLIES`、`event-bridge.ts:59,70` 只发不消费 → 复核通过）✅。
- stinger 素材缺口如实披露（`02 §⑦-6:110`，"正文不承诺会响"）；实测 `assets/audio/stinger/` **不存在** ✅。

**不通过项 → MAJOR B4（"登记"当"做到"）**：

`02 §⑩-3:177` 写：**"本文正文不依赖世界级 skill（人格来自 file slot），只提『指路见平台级 skill』"**。
实测：02 正文（`:188-226`）**完全没有**任何"指路见平台级 skill"的句子（`skill` 零命中）。这是一句把**尚未写入正文的意图**陈述为**正文已有事实**——正是本任务点名要查的"把登记当做到"。它与 B1 是同一根因的两面（B1 = 用户要求未兑现；B4 = 文档谎称已兑现）。

---

## 4. BLOCKER 汇总（带 `file:line` 与修复建议）

### B1 — 02 正文明文缺失 skill 指路（用户要求未兑现 + 自身声明矛盾）· BLOCKER

- **证据**：`docs/prompts/02-角色提示词.md:188-226`（正文块）中 `skill` 零命中（实测 `grep -i skill` 退出码 1）。
- **冲突三方**：
  1. 用户硬要求：`角色/作家都用 skill 学"详细用法"，提示词里只写基本但通用的`；
  2. `02:30` 自身声明："因此**本正文不需要逐个教工具用法**——工具名与一句 snippet 由 `tools` slot 进 system prompt，细则进平台级 skill"；
  3. `00 §3.2:76,78`：常驻层**放**"指路（'细则见 skill X'）"，**不放**"工具逐个用法"。
- **修复建议**：在 `[Your hands in this world]` 段末加一句与本批口径一致的指路（英文，不点具体 skill 名以防改名），例如：
  `For the deeper craft behind these — staging a scene, shaping a beat the player wants to press — read the skill whose description matches what you are about to do.`
  并同步把 §2/§⑩-3 的措辞改为"正文已含指路句"。

### B2 — 02 §⑧ A2 断言的 sed 终止模式错误，断言必红 · BLOCKER

- **证据**：`docs/prompts/02-角色提示词.md:130-131`
  `sed -n '/export const CHARACTER_INSTRUCTION/,/^`;/p' extensions/instructions.ts | grep -o '\[emo: [a-z]*\]' | sort -u | wc -l   # 期望 6`
- **实测**：`extensions/instructions.ts:77` 收尾行 = `${CHARACTER_NEXT_STEP_RULES}\`;`，**不以 `` ` `` 开头**，区间不终止 → 跑到 EOF（84 行），匹配到 `instructions.ts:129` 的 `[emo: tag]`，实测结果 **7**（本次实测输出：`[emo: angry] [emo: normal] [emo: sad] [emo: shock] [emo: smile] [emo: tag] [emo: thinking]`）。
- **修复建议**：终止模式改为 `/\${CHARACTER_NEXT_STEP_RULES}`;$/`，或改用常量名锚定 + `awk` 提取（更稳）。改后应回到 6。

### MAJOR B3 — 02 正文逐个教工具用法，违反 00 §3.2 且与自身 §2 自相矛盾

- **证据**：`02:213-219` 逐条列 `look_at/chalk/move_to/show/use_item_on/move/choose` 的 when-to-use；`02:30` 与 `00 §3.2:78` 都禁止常驻层放"工具逐个用法"。
- **后果**：`messages[0]` 里同一工具出现两份（`- name: snippet`（`tools` slot）+ 正文清单），改一处漏一处（doc-23 §2.9）；且与 01 的克制策略（只指路）不一致，读者会以为两篇遵循不同契约。
- **修复建议**：二选一，须与 01 统一——
  (a) 删掉 02 的逐条工具清单，只留"工具是能力不是职责 / 鼓励用工具"两条原则 + B1 的 skill 指路；或
  (b) 若确要保留具身清单，则先改 `00 §3.2`（放宽角色侧常驻层）并声明这是**有意例外**，否则 02 就是单方面违约。

### MAJOR B4 — 02 §⑩-3 把未写入的正文内容陈述为既成事实

- **证据**：`02:177` 称正文"只提『指路见平台级 skill』"，实测正文无此句（同 B1）。
- **修复建议**：随 B1 一起改；在 B1 落地前，该句必须降级为"**待补**：正文将加入指路句"。

---

## 5. MINOR / NIT 清单

| # | 级别 | 位置 | 问题 | 建议 |
|---|---|---|---|---|
| M1 | MINOR | `05-装配与验证.md:251` | `holmes-voice` 幽灵 skill 名，无定义处（全批定义的是 `holmes-world-style`/`holmes-world-plot`） | 与 `REVIEW-Consistency.md` M1 一并修：改为实测真实名或删除该括号 |
| M2 | MINOR | `01:235, 01:237` vs `04:565, 04:642` | 01 说 `link`/`arrange` 创意用法归 04；04 明确 `arrange` 本批不做 skill | 01 改为"`link` 归 04；`arrange` 本批不做 skill（归 `description`）" |
| M3 | MINOR | `02:42-48` vs `02:188-226` | §③ 意图表用段名 `[Who this page is for]` / `[Emotion tags]` / `[Silence is a turn]`，正文实际标题是 `[Where you come from]` / `[How your face is shown]` / `[When you say nothing]`；`02:168` 也引用了不存在的 `[Silence is a turn]` | 统一段名（正文标题为准），否则实现者按意图表找不到锚点 |
| M4 | MINOR | `02:27` | 引"`00` §4.2 F8"，但 F8 定义在 `00 §2`（`:48`），不在 §4.2 | 改为 `00 §2 F8` |
| M5 | NIT | `01:33, 01:268` | A7 要求"反引号已转义"，实测正文内部反引号 = 0，为空操作 | 删掉或改为"若有反引号需转义" |
| M6 | NIT | `02:154`（A8） | 断言的工具白名单写成"15 AIRP + `read/bash/edit/write`"（4 内建），与 `00 §8:249` 的 24 = 15+9 口径不符；且"抽出已知工具名"的机械做法会把 `01:44` 的动词 `delete` 误判为工具 | 白名单改用 24 名并集；只认反引号包裹或 `- name —` 形态 |
| M7 | NIT | `01:25`（≈1150 词）/ `02:67`（约 60 行） | 实测 01 = 1350 词、02 = 39 行/1110 词 | 校正数字 |
| M8 | NIT | `02:166` | §⑨-1 正文里写成 `CharacterMatch.tsx:61`，正确文件名是 `CharacterModal.tsx`（同句后半已写对） | 统一为 `CharacterModal.tsx:61` |

---

## 6. 附：本次实测清单（可复现的机械检查）

| 检查 | 命令/方法 | 实测结果 |
|---|---|---|
| 01 正文 CJK | `python3 re.findall('[\u4e00-\u9fff]', body)` | 0 ✅ |
| 02 正文 CJK | 同上 | 0 ✅ |
| 01 A2 元叙事串 | `'Never write "What do you do?"' in body` | True ✅ |
| 01 A4 四锚顺序 | `find()` 单调 | 382 < 781 < 1401 < 2630 ✅ |
| 01 A5 引号骰子 | `'expect: ">50"' in body` | True ✅ |
| 01 A6 指路句（归一空白后） | `re.sub(r'\s+',' ',body).find('belongs to the skills')` | 7179 ✅（raw `includes` 会漏，01 已注明） |
| 01 A9 残留 | `'Communicate minimally' / 'Inject frontmatter:'` | 均 False ✅ |
| 01 A3 与 NEXT_STEP_RULES 交集 | 切句归一后集合交 | **0** ✅ |
| 02 A1 六 tag | `grep "\[emo: $t\]"` for 6 tags | 全中 ✅ |
| 02 C4 六 tag 唯一集合 | 正文 `[emo: xxx]` 提取 | 恰 6（normal/smile/shock/sad/angry/thinking）✅ |
| 02 A5 越界词 | `your pocket|your bag|your viewport|your camera|get_state|...` | 0 命中 ✅ |
| 02 A7 注入块标题词 | `Standing|Also here|Recently, in the world|World state`（对常量体） | 0 命中 ✅ |
| 02 与 CHARACTER_NEXT_STEP_RULES 交集 | 切句归一后集合交 | **0** ✅ |
| **02 A2（原样）** | `sed -n '/export const CHARACTER_INSTRUCTION/,/^\`;/p' ... wc -l` | **7（≠ 期望 6）→ 必红** ❌ |
| 02 正文 skill 指路 | `grep -i skill`（正文区间） | **0 命中** ❌ |
| AIRP 工具数 | `grep -rn "name: '" extensions/toolkit/*.ts \| wc -l` | 15 ✅（与 `00 §8` 基线一致） |
| `promptSnippet` 覆盖 | 每个 `name:` 后均有 `promptSnippet` | 15/15 ✅（`actor/deps/result/turn/image-pi-provider` 非工具定义，不计） |
| `scene-init` profile | `presets/scene-init.json:3,6` | `id: "scene-init"` + `delegatable: true` ✅ |
| `includePiDefaultGuidelines` 修复 | `loader.ts:352` `typeof … === "boolean"` / `slot-renderers.ts:132` `!== false` | 已修，语义一致 ✅ |
| `assets/audio/stinger/` | `ls` | 不存在 ✅（02 §⑦-6 披露属实） |
| 全仓 `SKILL.md` | `find`（排除 node_modules/vendor） | **0**（04:6 的现状核实属实）✅ |

**未做**：未跑全量 build/test/lint（遵守硬约束）；以上均为单文件 grep / python 单段 / `sed` / `ls` 级快速检查。
