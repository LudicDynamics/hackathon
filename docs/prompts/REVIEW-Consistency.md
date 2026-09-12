# REVIEW-Consistency — 跨文档一致性 + 契约冻结遵守（六维全评）

评审对象：`docs/prompts/{00,01,02,03,04,05}*.md`（设计阶段，未实现）。
方法：先抄 `00` 冻结项成清单，再用 `grep` 逐篇抽取实际用法求 diff，并回源码核对 `file:line`。
所有源码引用均为本次只读实测（2026-09-12，工作树）。

结论速览：**2 个 BLOCKER、5 个 MAJOR、7 个 MINOR/NIT**。冻结契约的主体（常量名 / slot 名 / deny 名单 / 语言分层 / `<world>` 裁决）**全部遵守**，问题集中在**编号与数字的实测值不自洽**、**跨篇引用的幽灵符号**、以及 **`04` 自身范围自相矛盾**。

---

## 0. 冻结项清单（从 `00` 抄出，逐字）

| # | 冻结项 | `00` 出处 | 冻结值 |
|---|---|---|---|
| F-1 | 4 个常驻常量名 | `00-共同上下文.md:111-114` | `WRITER_INSTRUCTION` / `CHARACTER_INSTRUCTION` / `SCENE_INIT_INSTRUCTION` / `NOOK_INIT_INSTRUCTION`（外加 `NEXT_STEP_RULES`:115、`CHARACTER_NEXT_STEP_RULES`:116） |
| F-2 | 4 个 slot 名 | `00:111-114` | `writer-char`（别名 `writer-instruction`）/ `system-char`（别名 `char-instruction`）/ `scene-init-instruction` / `nook-init-instruction` |
| F-3 | 平台级 skill 目录 | `00:170-172, 178-180` | `<repo>/skills/`，目录名 + `name` 一律 ASCII 小写 kebab-case，**英文**（`component-narration` / `tool-craft`） |
| F-4 | 世界级 skill 目录 | `00:173-176, 178-180` | `<world>/skills/`（与 `world/` 同级）；**目录名英文**，`<world>` 前缀取**目录名** |
| F-5 | `<world>` 裁决 | `00:182-184` | 取**目录名**，**不取** `world.json.id`（`holmes-world-style` ≠ `holmes-beckstreet-style`） |
| F-6 | `tools.deny` 名单 | `00:128-130, 141` | 14 名：`recall retrieve memorize revise forget relocate associate trigger consolidate retrace set_time awaken get_state state_update` |
| F-7 | 语言分层 | `00:84-89` | 平台级 = 英文；世界级**正文/description 跟随世界语言**；目录名与 `name` 恒 ASCII |
| F-8 | 常驻层唯一编辑入口 | `00:107-119` | `extensions/instructions.ts`；MUST NOT 在世界模板 preset 里另抄平台口径 |
| F-9 | 装配形状（items 顺序） | `00:125-165` | writer/character 五项；初始化器 = instruction + `skills`（刻意无 `tools`） |

---

## 1. 冻结项 → 各篇实际用法 → 一致性

| 冻结项 | 01 | 02 | 03 | 04 | 05 | 判定 |
|---|---|---|---|---|---|---|
| F-1 常量名 | `WRITER_INSTRUCTION`（`01:20`） | `CHARACTER_INSTRUCTION`（`02:6,22`） | `SCENE_INIT_INSTRUCTION`/`NOOK_INIT_INSTRUCTION`（`03:25`） | 不引用常量 | 4 名全列（`05:44`） | **通过**（与 `extensions/instructions.ts:53,68,79,98` 逐字一致） |
| F-2 slot 名 | `writer-char`/别名（`01:22-23`） | `system-char`/别名（`02:23,27`） | `scene-init-instruction`/`nook-init-instruction`（`03:26,31`） | 不提 slot | `writer-char`/`system-char`（`05:88,149,203`） | **通过**（与 `instructions.ts:116,121,128,133,140,147` 逐字一致） |
| F-3 平台级目录名 | — | — | — | `component-narration`/`tool-craft`（`04:24,28,44-45`） | 同名（`05:1059-1060`） | **通过**（全 ASCII kebab-case，无中文目录名残留） |
| F-4 世界级目录名 | — | — | — | `holmes-world-style`/`-plot`、`firstsnow-style`/`-plot`（`04:46-49`） | 同（`05:1061-1062`） | **通过** |
| F-5 `<world>` 取目录名 | — | — | — | 明确按目录名（`04:55,630`） | 不涉及 | **通过**（无一篇写反；`04:630` 引的 `world.json.id` 实测为 `holmes-beckstreet`/`firstsnow-radio`，与文档一致） |
| F-6 deny 14 名 | — | — | — | 提到 deny 但不列名 | `05:70-85,131-146,185-200` 三处 + `05:557-560` 常量 + `05:911-914` | **通过（程序化核对）**：三份 JSON、`DENIED`、`FORBIDDEN_TOOL_NAMES` **集合与顺序均与 `00:128-130` 逐字相等** |
| F-7 语言分层 | 正文全英文（`01:36-147`，无 CJK） | 正文全英文（`02:189-225`） | 正文全英文（`03:273-338`） | 平台级英文、世界级跟随（`04:44-49,412` 日文实例） | 不涉及 | **通过** |
| F-8 唯一编辑入口 | 落点 `instructions.ts:53-66`（`01:20-21`） | `instructions.ts:68-77`（`02:6`） | `instructions.ts:79-111`（`03:25`） | 不涉及 | JSON 里无提示词正文（`05:375`） | **通过** |
| F-9 items 顺序 | 引 `presets/writer.json:16-20`（`01:23`） | 引 character items（`02:25,27`） | 初始化器 items 冻结（`03:31-33`） | 不涉及 | writer/character 五项 + init 两项（`05:87-98,148-159,253-259`） | **通过**（与 `00:131-156` 逐字一致；`presets/writer.json:15-31`、`presets/character.json:15-22`、`scene-init.json:8-19`、`nook-init.json:8-19` 实测吻合） |

**契约冻结遵守（维度 2）总结：没有一篇私改共享形状**。slot id/slot 名、常量名、语言分层、`<world>` 裁决、deny 集合均未被私改；`04:491` 与 `05:1101` 都把「角色给几级 `--skill`」**明标为待拍板**而非已定，符合 `00 §6.1`。

---

## 2. 问题清单（分级，带两侧 `file:line`）

### BLOCKER

**B1 — 作家首行断言与 01 的新正文互斥，探针永远红。**
- `05-装配与验证.md:894-895`：`WRITER_FIRST_LINE = "You are the Writer of the AIRP interactive narrative world. You are the world's lead director."`（这是**现状** `extensions/instructions.ts:53` 的旧首行，实测逐字如此）。
- `05-装配与验证.md:961`：`check('messages[0] starts with WRITER_INSTRUCTION', system.startsWith(WRITER_FIRST_LINE));`
- `01-作家提示词.md:36`：新正文首行 = `You are the Writer of the AIRP interactive narrative world, and its lead director. The player`。
- 两篇都声称正文「逐字可用」（`01:31` / `05:50`）；`05 §10` 的 landing 顺序要求两者**同批**提交（`05:1042`）。因此按设计落地后，`probe:prompt` 的**首条断言必红**——这是设计层面自相矛盾，不是实现细节。修法：`05:894-895` 的常量改为 01 的实际首行（或改判据为「含 `You are the Writer of the AIRP interactive narrative world`」）。

**B2 — `04` 的 `whitechapel` 范围自相矛盾，且其自身验收门 `A4` 依赖未定项。**
- `04-skill体系.md:40-51`：**「本批要落地的具体清单（6 个目录）」**，并在 `:51` 明写「其余世界（`whitechapel` / `cthulhu` / …）本批**不写**」。
- `04-skill体系.md:504`（D5）：`templates/firstsnow/`、`templates/whitechapel/` **各新增 style + plot 两份**。
- `04-skill体系.md:641`（§⑩-1 倾向）：「holmes-world / firstsnow / **whitechapel** 各带两份」。
- `04-skill体系.md:610`（A4）：断言 `templates/whitechapel/skills/*/SKILL.md` 存在且无 CJK。
- 即：清单说 6 个目录（不含 whitechapel），D5/A4/§⑩ 说要 8 个（含 whitechapel）。若按 6 目录实现，**A4 这个"硬门"必然空过或报错**；若按 8 目录实现，与 `:51` 的「本批不写」冲突。这是设计冻结层面的 blocker：必须先裁决 whitechapel 在不在本批，并让 `:40` / `:51` / `:504` / `:610` / `:641` 五处一致。

### MAJOR

**M1 — 幽灵符号 `holmes-voice`（无定义处，破坏闭环）。**
- `05-装配与验证.md:251`：实测结论称角色 `messages[0]` 含「平台级 `tool-craft` 与世界级 **`holmes-voice`** 两个名字」。
- 但 `04:46-47` 定义的世界级 skill 是 `holmes-world-style` / `holmes-world-plot`；全仓 grep `holmes-voice` **仅命中这一行**（本次实测）。即文档给出了一个**没有任何定义处**的 skill 名。若这是 `/tmp/airp-wire/charpost.json` 里手搓测试件留下的名字，则它既污染了"实测基线"，又无法由本批设计复现。修法：改为 `holmes-world-style` 并复核 `charpost.json`。

**M2 — 92 行 vs 94 行：同一"实测事实"两个值。**
- `00-共同上下文.md:47`（F7）：作家补三 slot + deny 后 `messages[0]` 「**从 19 行涨到 94 行**」。
- `05-装配与验证.md:18`（基线表目标行）：`messages[0]` 行数 = **92**；`05:873` 探针注释亦写 "the target assembly gives 92 lines + 24 tools"。
- 两处都标为真 spawn 实测（`00:34` / `05:11`），却给出不同的作家目标行数且无一句解释。虽 `05:967` 的断言是 `> 40` 的宽松下界（不受此影响），但**冻结契约里的"实测事实"出现两个值**本身就是诚实性/一致性问题，必须回测统一（并注明是否含/不含哪一段）。

**M3 — `available_skills` 断言三方互斥（闭环断裂）。**
- `04-skill体系.md:615`（A9）：断言「**作家**真 spawn 后 `messages[0]` 的 `<available_skills>` 同时含平台级与世界级 skill 的 name」。
- `05:727-989` 的 `probe-prompt.mjs` 全文**没有任何** `<available_skills>` 断言（只查 `- look_at:` / `- chalk:` / 行数 / 禁用名 / 工具面）。
- `05:1064` 却写「`probe-prompt.mjs` 断言 `<available_skills>` **只在角色探针里出现**」——而本批**没有任何角色探针文件**被定义（`05 §9` 只新建 writer 探针）。
- 三方（04 的 A9 / 05 的探针代码 / 05 的正文说明）对"谁断言 skills 清单"各执一词。必须指定唯一落点并补上对应代码。

**M4 — `04 §3.4` 剧情 skill 声称「逐字可用」但只给了填空骨架。**
- `04-skill体系.md:116`（节标题）：`## ③ 正文（逐字可用）`。
- `04:448-477`：`<world-dir>-plot/SKILL.md` 只有「中括号是填空位，落盘时全删」的模板骨架；`04:479,481` 的 holmes/firstsnow plot 正文只有**散文描述**（"正文写 … 一条主线、三条可查线索…"），**没有逐字正文**。
- 对比 `04:365-444` 的 style skill 给了 holmes 英文与 firstsnow 日文**完整正文**。
- 后果：本批要交付的 6 个 skill 里，**plot 两份没有可落盘内容**。要么把 `③` 改为「逐字可用」只覆盖 3.1/3.2/3.3 并单列 plot 为待产，要么补齐 plot 正文。属"只登记不做到"的语义未兑现。

**M5 — `05` 自查未把 `04` 新增的第四道门纳入落地顺序（两个"装配"真相源）。**
- `04:603`：`08` 节验收落点 = **新增 `tools/check-skills.mjs`**，「与 `00 §8` 的三条门并列」。
- `05:1023-1079` 的落地顺序 / commit 切分表里，**完全没有 `check-skills.mjs`**（`05` 只列 `probe-tools.mjs`/`preset-slots.test.mjs`/`probe-prompt.mjs`），`package.json` 只加了 `probe:prompt`（`05:1050`）。
- 后果：`04` 定义的 A1–A12（skill 结构/语言分层/命名唯一）没有任何文档负责把它接进命令表与 commit；`00 §8` 的"测试门"清单也没提它。谁落这个文件、何时落，无归属。

### MINOR / NIT

**m1 — `02` 的 A2 命令的 sed 区间永不闭合。**
`02-角色提示词.md:130`：`sed -n '/export const CHARACTER_INSTRUCTION/,/^`;/p'`。实测 `extensions/instructions.ts` 里**没有任何一行以 `` `; `` 开头**（常量都以 `${...}\`;` 或 `…\`;` 结尾，`:66` / `:77` 全文如此）。结束模式不匹配 → sed 打印到 EOF，`wc -l` 的结果依赖全文，不再局限于该常量。当前只有 `CHARACTER_INSTRUCTION` 带 `[emo:]`，所以侥幸得 6；一旦别处出现 emo 文本即误判。修法：结束模式改 `/^\$\{CHARACTER_NEXT_STEP_RULES\}\`;/`。

**m2 — `02` 引用了不存在的文件 `CharacterMatch.tsx`。**
`02-角色提示词.md:166`（"发现的冲突"表）：「解析正则 `CharacterMatch.tsx:61`」。实际解析器在 `apps/web/src/components/overlay/CharacterModal.tsx:61`（本次实测），全仓无 `CharacterMatch.tsx`。同句后半已给出正确路径，属笔误，但出现在承重的冲突条目里。

**m3 — `03` 的 vendor 路径未给全（可实施性）。**
`03:29,36,56,123` 引 `prepare.ts:250-256` / `prepare.ts:178-180` / `spawn.ts:96-98` / `run.ts:81-98` / `prepare.ts:27`，均未冠 `vendor/pi-rp/packages/coding-agent/src/core/subagent/`。这些文件不在 `apps/` 下（本次实测：`apps/server/src/engine/prepare.ts` **不存在**），单看 `03` 无法定位。`00`/`05` 都写了完整 `vendor/pi-rp/...` 前缀，建议 `03` 对齐。（行号本身核对通过。）

**m4 — `04` 自身对 skill 数量的三个说法。**
`04:40`「6 个目录」、`04:500`（D1）「新增 **4** 个 skill 骨架（2 平台 + 每世界 2 个）」、`04:227`（`00` 侧）「2 平台 + 每世界 2 个」。若 2 个世界则共 6，D1 的"4"与之矛盾（且未说明是否把 style/plot 各算 1）。与 B2 相关但独立。

**m5 — `00 §4.2` 的角色 items 示例块把 `profile` 混进"冻结形状"。**
`00-共同上下文.md:148-156` 的 character items JSON 块内含 `{ "kind": "slot", "id": "profile", "slot": "file", … } // 世界侧已有`。`05:163` 与 `05 §9.2` 的测试 (2) 却要求**仓库兜底不得含 `file` slot**（`presets/character.json:15-22` 实测确无）。仅凭 `00` 实现者可能在兜底里加上 `profile`。注释已标"世界侧已有"，故降为 MINOR，但冻结契约的示例块与正文口径应一致（建议把 `profile` 移出该块或明确标注"仅世界侧"）。

**m6 — `03` 的 A6 grep 与其正文不自洽（已自认）。**
`03:160` 的 `grep -E 'chalk|…'` 会对正文里的 `type: chalk`（`03:282`）命中；`03:161` 括注承认需加豁免/改写。断言以现状文字**直接跑会红**。已登记，属可接受，但应把最终命令写成可直接执行的形式。

**m7 — `00 §9` 说"12 节"，实际列出 10 节。**
`00:270`：「每篇 MUST 有的结构（**12 节**）」后列 10 项（一句话定位/落点/正文逐步/与现状差异/与注入块分工/工具对照/错误与边界/验收断言/发现的冲突/仍未知待拍板）。各篇正文也按 10 节落地（如 `01:8,16,31,171,191,209,241,256,276,287`）。数字与内容不符，建议改"10 节"。

**NIT — `05` 子节编号错位。**
`05:731` 是 `#### 8.3.1` / `05:854` 是 `#### 8.3.2`，但它们挂在 `## 9. 验收断言`（`05:435`）下的 `### 9.3`（`05:727`）里。应为 `9.3.1` / `9.3.2`（且与既有 `§8.3 本批不做` 撞号，易误读）。

**NIT — `04:148-149` 的 kind 枚举与其自称的"18 个 kind"未对账。**
`04:107,189,202,535` 反复说"18 个 kind"，但 `04:148-149` 的 behaviour kind 只列出 16 个名字（lock/container/trap/instrument/board/clock/cipher/diary/photo/ledger/map/book/thread/anchor/tape/mechanism）。注册表完整清单**不在本次只读范围**，故此项标为**未能核对**（不是断言错误）。建议 04 给出 18 的确切枚举来源（`get_component` 索引快照）。

---

## 3. 维度 6：诚实性专项

| 检查 | 结论 |
|---|---|
| `[推断]` 是否标注 | **部分通过**。`01:245` 标了 `[推断：失败文案以 fail() 包装为准]`；`00:213-214` 标了 `[推断：接线属…前端改造计划]`；`05:265` 声明"`[推断]` 标推断"但正文未见 `[推断]` 实例（其结论多为实测，可接受）。 |
| "待拍板"是否被伪装成"已定" | **通过**。`00 §6`（4 项）、`01 §⑩`（5）、`02 §⑩`（5）、`03 §⑩`（5）、`04 §⑩`（6）、`05 §12`（6）逐条标注；`04:491`/`05:1101` 的角色 `--skill` 级数明确写"倾向…留评审拍板"。 |
| "登记"是否被当"做到" | **基本通过，一处例外**。`05 §8.3` 明确列"本批不做"；`03 §⑨` 只"登记 + 建议"不改 `brief-builder.ts`；`05:498` 明确"05 只登记 [snippet 需修]"。例外是 **M4**：`04 §③` 标题写"逐字可用"，plot 两份却只有骨架。 |
| 实测值与文档是否一致 | **发现 3 处不一致**：B1（首行）、M2（92/94）、M1（`holmes-voice`）。其余抽查（slot 名、deny 名单、`presets.ts`/`launch.ts` 行号、`chalk.ts:79`、`roll-dice.ts:31-40`、`CharacterModal.tsx:60-64`、`audio.ts:37`、`brief-builder.ts` 冲突 1–5、`templates/*/characters/*/preset.json` 十份清单与 item 数）**全部与源码吻合**。 |

---

## 4. 六维逐项结论

1. **跨文档一致性**：**基本通过，3 处硬伤**。名称层（常量/slot/skill 目录/deny）零分歧；数字层有 B1（首行）、M2（92/94）、m4（4/6 个骨架）、B2（whitechapel 范围）不一致。`holmes-voice`（M1）是唯一跨篇幽灵符号。
2. **契约冻结遵守**：**通过**。`00` 的 9 类冻结项在 01–05 均未被私改（见 §1 表，全部"通过"）。
3. **语义兑现 / 需求强度**：**通过（有一处待补）**。作家单轮四步 + 每步后果（`01:41-82`）、元叙事禁令带可判定测试句（`01:104-111`）、组件即旁白（`01:64-68` + `04:128-186`）、角色 `[emo: tag]` 精确到解析正则与闭集（`02:199-209`，闭集 6 个与 `audio.ts:37` 逐字一致）、"工具是能力不是职责"（`02:211-219`）、出口（`01:134-138`/`02:224-225`/`03:63`）均**真兑现而非敷衍**。待补：plot skill 的逐字正文（M4）。
4. **闭环性**：**1 处断裂**（M3 `available_skills` 三方互斥）+ **1 个幽灵符号**（M1）+ **1 个无归属文件**（M5 `check-skills.mjs`）。其余被引符号均有唯一定义处：探针/测试文件由 `05 §9` 给出完整可跑内容，skill 落点由 `04:22-49` 给出，preset 落点由 `05 §3` 给出。
5. **可实施性**：**通过（有小瑕疵）**。`05:54-100` writer JSON、`05:115-161` character JSON、`05:169-226` 世界侧模板、`05:445-476` 探针代码块、`05:532-708` 测试全文、`05:733-989` provider+探针全文均语法可落地（deny 名单已程序化验证集合与顺序一致）；`05 §5.2` 精确到 `launch.ts:164/165` 的插入点（实测吻合）。瑕疵：`03` 的 vendor 路径不全（m3）、`02` 的 sed 区间不闭合（m1）、`03` 的 A6 grep 待改写（m6）。
6. **诚实性**：**通过**（见 §3），数字不一致（B1/M2）属一致性瑕疵而非隐瞒。

---

## 5. 建议的裁决顺序（供主控）

1. 先裁 **B1**（改 `05:894-895` 的错误首行）与 **B2**（whitechapel 在不在本批，然后统一 `04` 的 5 处）。
2. 再定 **M3**（`available_skills` 断言由谁落、是否补角色探针）、**M5**（`check-skills.mjs` 谁落）。
3. 回测统一 **M2** 的 92/94，复核 **M1** 的 `holmes-voice`（很可能应改为 `holmes-world-style`）。
4. **M4**：给 plot 两份补逐字正文，或把 `04 §③` 的"逐字可用"收窄到 3.1–3.3。
5. 收尾 m1–m7、NIT。

> 未列问题即视为**通过**；本报告刻意保留"通过"项以证明已逐项核验（清单见 §1 与 §3）。
