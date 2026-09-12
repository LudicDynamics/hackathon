# REVIEW-Implementability — 维度 5（可实施性）+ 维度 6（诚实性）

> 评审人：`Implementability`。对象：`docs/prompts/00..05`（设计稿，实现未开始）。
> 方法：逐块抽码实跑解析（`JSON.parse` / `node --check` / `tsc` / 真 `parseFrontmatter`）、逐名核对符号存在性、逐行核对行号、逐条复算"实测数据"。
> 只读。除本文件外未改动任何文件。所有结论附 `file:line`；未直接观测者标 `[推断]`。

## 0. 结论摘要（按严重度）

| 级别 | 数量 | 代表 |
|---|---|---|
| **BLOCKER** | 5 | B1 02 正文含裸反引号、无转义说明，照文档"逐字可贴"必编译失败；B2 05:254 的"实测"与 `charpost.json` 产物不符；B3 05:1040/1199 把 14 说成 8；B4 05:18/22 的行数口径自相矛盾；B5 §9.1 断言"现在会红 2 个"与实测 3 个/表格"绿"冲突 |
| **MAJOR** | 3 | B6 `04:369` 的 `holmes-world-style` frontmatter 引擎解不开→skill 静默丢弃；M1 `check-skills.mjs`（04 A1–A8/A10–A12）无落点、无 commit、无入口；M2 三处 `promptSnippet` 修正无归属 |
| **MINOR** | 5 | m1 `05:419` 引 `context.ts:80` 指向错行且本次未复现；m2 `useWorld.ts` 路径/行号（`hooks/` vs `state/`，276-318 vs 277-319）；m3 `AGENTS.md:169` 引用漂移（真约定在 `:258`）；m4 `05:108` 引 `core/tools/state-update.js` 应为 `.ts`（dist 相位未标）；m5 `05` 内部 `§8.1/§8.2` 交叉引用指向已重编号的节；另 04 §⑦ 表仍以 whitechapel 为例（与 §2.1 新裁决矛盾） |
| **NIT** | 3 | 02:69 "约 60 行" 与实际 34 行不符；01:25 "≈1350 词" 与实测 1349 一致（通过）；04:586 同一 whitechapel 残留 |

**六个维度总体判定：跨文档一致性 通过（除 1 处已修的 ghost 名）；契约冻结遵守 通过；语义兑现 通过；闭环性 不通过（`check-skills.mjs` 断链）；可实施性 不通过（B1/B5）；诚实性 不通过（B2/B3/B4 + 若干"登记当做到"）。**

---

## 维度 5：可实施性

### 5.1 代码块逐个"可解析 / 不可解析"与依据

抽取方式：按 ``` 围栏（含 4 反引号）逐块取出，JS 跑 `node --check`，JSON 跑 `JSON.parse`，TS 用 `tsc --noEmit`，YAML 头用引擎真解析器 `vendor/pi-rp/.../dist/utils/frontmatter.js`。

| 文档·块 | 语言 | 结果 | 依据 / 备注 |
|---|---|---|---|
| 05 #0 (writer.json) | json | **可解析** | `JSON.parse` 通过（4088B）。与 `presets/writer.json:1-32` 只差新增顶层 `tools` 与两个 item——`hiddenOverrides` 逐字相同（脚本比对 confirmed）。 |
| 05 #1 (character.json) | json | **可解析** | 同上（3398B）；`hiddenOverrides` 与 `presets/character.json:6-14` 逐字相同。 |
| 05 #2 (世界侧 preset 模板) | json | **可解析** | 3680B；占位符 `<character-id>`/`<Display Name>` 存在，替换后 `JSON.parse` 通过；其 `hiddenOverrides` 与 `templates/holmes-world/characters/watson/preset.json:6-14` **逐字相同**。 |
| 05 #4 (`launch.ts` 插入行) | ts | 片段（不可独立解析，**预期**） | 3 行 `args` 片段，含 `...`；`node --check` 报 `Unexpected token '...'` 属正常（非完整语句）。**行号核对见 5.3，通过**。 |
| 05 #5 (注释替换) | ts | 片段（不可独立解析，**预期**） | 纯注释块。 |
| 05 #6 (§9.1 probe 断言块) | js | **可解析** | `node --check` exit 0。 |
| 05 #7 (15 个 snippet 文本) | 无语言（纯文本） | n/a | 逐条与源码比对：**14 条逐字相符**，另有 1 条（`view_canvas`）同文件第二处 `promptSnippet`（`extensions/toolkit/look-at.ts:88`）。 |
| 05 #8 (`preset-slots.test.mjs`) | js | **可解析** | `node --check` exit 0；**实跑**（`REPO_ROOT` 替换为本仓）→ 5 测试中 3 红 2 绿，与 §9.2 的"修复前红"表**完全一致**（见 5.4）。 |
| 05 #9 (`prompt-dump-provider.ts`) | ts | **可解析** | `tsc` 仅报无法解析 `@earendil-works/pi-ai/compat`（沙箱路径问题）；同一 import 在 `tools/inject-probe-provider.ts:23` 已在生产使用，故**语法/类型面通过**。`fs.writeFileSync` 内联 JSON 对象无未转义反引号。 |
| 05 #10 (`probe-prompt.mjs`) | js | **可解析** | `node --check` exit 0。 |
| 05 #12 (`probe-prompt-character.mjs`) | js | **可解析** | `node --check` exit 0。 |
| 05 #11 (package.json 一行) | json | **不可独立解析（预期）** | 片段 `"probe:prompt": "..."`，无外层 `{}`——文件标注为"接入 package.json 一行"，可接受。 |
| 05 #3/#13/#14 | bash | n/a | 命令块。 |
| 03 #0/#1（两个 TS 常量） | ts | **可解析** | `node --check` exit 0；且**反引号已正确转义**（`\`` ×20 / ×4），可直接落盘。 |
| 01 #0（作家正文） | text | **可直接粘贴** | 出发文块内 **反引号 0、`${` 0**，落进模板串无需转义。**通过**。 |
| **02 #3（角色正文）** | text | **不可直接粘贴** | 见 **B1**。 |
| 04 #1/#5/#8（骨架，含 `[填空位]`） | yaml/markdown | 骨架，非成品 | 预期。`#6` 见 **B6**。 |
| 04 #3/#4（`component-narration` / `tool-craft`） | markdown | **frontmatter 可解析** | 引擎真解析器 `parseFrontmatter`：`name`/`description` 均读出，`descLen` 310 / 348，≤1024。**通过**。 |
| 04 #6（`holmes-world-style` 实例） | markdown | **frontmatter 不可解析** | 见 **B6**。 |
| 04 #7（`firstsnow-style` 实例） | markdown | **frontmatter 可解析** | `descLen` 108。**通过**。 |

**B1（BLOCKER）— 02 角色正文含裸反引号，照文档"逐字可贴"必编译失败。**
`02-角色提示词.md` §附（`:183` 起）声明"逐字可贴"，但正文块（同文档 `第 3 个 text 块`）含 **1 处裸反引号**：`` — run `look_at` on it once before ``。
实测：把该块**原样**包进 `export const CHARACTER_INSTRUCTION = \`…\`;` → `tsc` 报 `TS1005: ',' expected`（2 处）。而 `01:33` 与 `01:268` 明确写了"正文内不含反引号（实测 0），可直接逐字粘贴…无需转义"——**01 有这个说明，02 没有**（`grep 反引号/转义` 在 02 中零命中，只有 §⑧ A8 提到"反引号包裹"形态）。
修法（择一）：在 02 §附 加一行与 01:33 同款的转义说明（`` 落盘时 `\`` ``）；或把该处反引号改成引号。
依据：`docs/prompts/02-角色提示词.md:183`（"逐字可贴"）vs `docs/prompts/01-作家提示词.md:33`（01 的对应说明）。实测 `tsc /tmp/pastecheck/bad02.ts`。

**B6（MAJOR，兼 B1 同类）— 04 #6 `holmes-world-style` 的 frontmatter 用引擎真解析器解不开。**
用 `vendor/pi-rp/.../dist/utils/frontmatter.js` 的 `parseFrontmatter`（与 `core/skills.ts:285` 同一条路径）实测：

```
THROW holmes-world-style  Nested mappings are not allowed in compact mappings at line 2, column 14
```

`04-skill体系.md` 的 `holmes-world-style` 实例块（`04:369` 附近）`description:` 值是**裸标量却内含 `: `**（"…Holds the world's register: the fog-damp second person…"），YAML 解析报错。`core/skills.ts:318-323` 的 `catch` 会把该文件**静默丢弃**（`skill: null` + warning）——即"skill 存在但永不加载"。
对照：`component-narration`/`tool-craft`/`firstsnow-style` 三个实例均解析通过；`firstsnow-style` 的日文 description 无 `: ` 故无事。**唯 `holmes-world-style` 中招**。
修法：把 `description` 用 YAML 块标量或引号包裹（全批统一），并在 §⑧ A1 把"用真 `parseFrontmatter`"写死（现在 A1 只说"解析 YAML 头"，未指定严格度，故该缺陷在文档自证里**不会红**）。依据：`docs/prompts/04-skill体系.md:369-371`；`vendor/pi-rp/packages/coding-agent/src/core/skills.ts:285,318-323`。

### 5.2 符号存在性逐名核对

| 符号（文档引用处） | 声明处（实测） | 判定 |
|---|---|---|
| `WRITER_INSTRUCTION` | `extensions/instructions.ts:53` | ✅ |
| `CHARACTER_INSTRUCTION` | `:68` | ✅ |
| `SCENE_INIT_INSTRUCTION` | `:79` | ✅ |
| `NOOK_INIT_INSTRUCTION` | `:98` | ✅ |
| `NEXT_STEP_RULES` | `:37` | ✅ |
| `CHARACTER_NEXT_STEP_RULES` | `:46` | ✅ |
| `installPreset` | `apps/server/src/engine/presets.ts:32` | ✅ |
| `skillArgs(repoRoot, worldRoot): string[]` | `presets.ts:110` | ✅ 签名与文档一致 |
| `extensionArgs(repoRoot, worldRoot?): string[]` | `presets.ts:124` | ✅ |
| `writerLaunch(repoRoot, worldRoot, vendorCliPath): LaunchSpec` | `launch.ts:105` | ✅ |
| `characterLaunch(repoRoot, worldRoot, vendorCliPath, characterId): LaunchSpec` | `launch.ts:139` | ✅ 四参一致 |
| `LaunchSpec.args/env` | `launch.ts:14-21` | ✅ |
| `RpcClient`（`{cliPath,cwd,args,env,provider,model}`） | `vendor/pi-rp/packages/coding-agent/dist/index.js:52` → `modes/rpc/rpc-client.ts:81` | ✅ 六个 option 全存在（`rpc-client.ts:37-50`） |
| `RpcClient.start()` / `.prompt()` / `.waitForIdle(timeout?)` / `.stop()` | `rpc-client.ts:88,273,647,159`（dist `:499`） | ✅ 全部存在，`waitForIdle(30000)` 合法 |
| `createAssistantMessageEventStream` @ `@earendil-works/pi-ai/compat` | `tools/inject-probe-provider.ts:23` 同款 import | ✅ 先例在产 |
| `AIRP_TOOLS` / `AIRP_TOOL_NAMES`（15，顺序冻结） | `extensions/tools.ts:48,67` | ✅ 15 个、顺序与 05:23-29 的 `EXPECTED_TOOLS` 段一致 |
| `AIRP_TOOLS[].tool.promptSnippet` | 14 个文件各 1 处（`extensions/toolkit/*.ts`） | ✅ 15 个非空、全单行 |
| `installPreset` 调用点（仅 2 处） | `launch.ts:106`（writer）、`:146`（character） | ✅ 与 05 §8.3 边界 1 一致 |
| `buildSceneInitBrief` / `buildNookInitBrief`（无调用点） | `apps/server/src/engine/brief-builder.ts:11,46`；全仓 grep 仅定义 + dist 声明 | ✅ 与 03 §⑨ 冲突 2 一致 |
| **`presets/scene-init.json` / `nook-init.json` 从未被 installPreset** | 全仓 `find -name scene-init.json` 只命中 `presets/` | ✅ 与 05 §8.3 边界 1、C2 一致 |

**结论：05 §2「冻结符号名」一表的 9 个名字全部有唯一定义处，签名一致；`RpcClient` 构造参数与 `waitForIdle` 存在性均通过。此维度通过。**

### 5.3 落点精度：行号区间核对

| 文档主张 | 实测 | 判定 |
|---|---|---|
| 05:321「在 `...extensionArgs(repoRoot, worldRoot),`（**第 164 行**）之后、`],`（**第 165 行**）之前插入」 | `launch.ts:164` = `...extensionArgs(repoRoot, worldRoot),`；`:165` = `],` | ✅ **精确命中** |
| 05:328「注释 `:135-137`（"Characters get no `--skill`"）」 | `launch.ts:135-137` 正是该两行注释 | ✅ |
| 05:44「`characterLaunch`（`launch.ts:139`）」 | `:139` | ✅ |
| 05:44「`presets.ts:32,110,124`」 | 32/110/124 | ✅ |
| 05:44「`instructions.ts:37-111`」（四个常量区间） | 37（`NEXT_STEP_RULES`）〜 111（`NOOK_INIT_INSTRUCTION` 末行） | ✅ |
| 01:20「`WRITER_INSTRUCTION`（`:53-66`）」 | `:53`-`:66`（`${NEXT_STEP_RULES}\`;` 在 66） | ✅ |
| 01:187「`NEXT_STEP_RULES`（`:37-42`）」 | 37-42 | ✅ |
| 02:22「`CHARACTER_INSTRUCTION`（`:68`）」/ `:24`「拼入 `:77`」/ `:26`「人格 slot（`watson/preset.json:21-31`）」 | 68 / 77 / `templates/holmes-world/characters/watson/preset.json:21-31` 正是 `profile` slot | ✅ |
| 02:38「替换现有 5 条（`:70-75`）」 | `:70-75` 正是 5 条 | ✅ |
| 03:25「`SCENE_INIT_INSTRUCTION`（`:79-96`）/ `NOOK_INIT_INSTRUCTION`（`:98-111`）」 | `:79`-`:96`（96 为 `[Report]` 三行句）与 `:98`-`:111` | ✅ |
| 03:26「slot 注册（`:139-143` / `:146-150`）」 | `:139-143`（scene-init）/`:146-150`（nook-init） | ✅ |
| 03:56「`prepare.ts:196` 取 `messages.slice(-0)`」 | `vendor/.../subagent/prepare.ts:196` 正是 `inheritHistory > 0 ? …slice(-inheritHistory) : []` | ✅ |
| 05:444「`probe-tools.mjs:107-110` 之后、`:111` 之前插入」 | `:107-110` = `no synonym tools` check；`:111` = `for (const [name, props] of Object.entries(...))` | ✅ |
| 05:526「`every tool has a promptSnippet`（`:102`）… `promptGuidelines`（`:103-106`）」 | `:102` / `:103-106` | ✅ |
| 05:444「`check(...)`（`:74-78`）与 `container`（`:93-95`）」 | `:74-78` 是 check；`:93` 是 container | ✅（`container` 实际 93 起，94-95 为后续，属容差） |
| 05:318 附近「`:155-165`」 | 现文件 `:155-165` = `args: [` 起至 `],` | ✅ |
| 05:163「`docs/doc-11:408,435`"两处同源"」 | `docs/doc-11:408` 与 `:435` 正是"逐字一致（两处同源）" | ✅ |
| 05:419「`extensions/context.ts:80` 的 barrel import 解析失败」 | `extensions/context.ts:75-84` 是**import 列表**，`:80` 落在 `makeSectionDeps` 一行 | **MINOR**：`:80` 不指向报错点；且该失败**本次未能复现**（探针均从仓库根解析、全部跑通）。属"无法核验的反向证据" |
| 03:123「`prepare.ts:27` `DEFAULT_SUBAGENT_TOOLS`」 | `prepare.ts:27` | ✅ |
| 03:36「`prepare.ts:178-180`（R1 继承）/ `spawn.ts:96-98`（R2 customTools）」 | `prepare.ts:178-180` = `extensionTools` 三元；`spawn.ts:96-98` = `tools: options.tools ?? […DEFAULT_SUBAGENT_TOOLS, …customTools]` / `inheritExtensionTools:false` | ✅ |
| 04:61「`presets.ts:110-116`」/ `:62`「`launch.ts:117`」/ `:64`「`core/skills.ts:262,277-307,304-306`」/ `:65`「`skills.ts:335-361`」/ `:66`「`slot-renderers.ts:198-201`」 | 110-116 ✅；117 ✅；262/277-307/304-306 ✅；335-361 ✅；198-201 ✅ | ✅ |
| 04:551-563 工具真相行号 | `chalk.ts:79` ✅、`choose.ts:26-28` ✅、`roll-dice.ts:31-40` ✅、`move-to.ts:22-24` ✅、`show.ts:29-32` ✅、`delete.ts:18-21` ✅、`use-item.ts:19-24` ✅ | ✅ |
| 05:105「`core/tools/state-update.js:18,73` 注册 `state_update`/`get_state`」 | `:18` = `name: "state_update"` ✅；**`:73` = `name: "get_state"`** ✅，但**源码扩展名是 `.ts`**（`src/core/tools/state-update.ts`），dist 回落到 `.js`。文档写 `.js` 指向 dist，**可接受但未标注**（属 **MINOR**） |
| 02:105-109「`CharacterModal.tsx:61` 正则 / `:64` 闭集回落 / `:62` 无标签 / `:118-123` stinger / `:182` 整条调用」 | `:60-65` = `parseEmoTag`（正则在 `:61`）✅；`:32` = `EMO_TAGS` ✅；`:119-123` = `playStinger(mood)` ✅；`:182` = `parseEmoTag(pick.text)` ✅ | ✅ |
| 02:160/174「`CharacterModal.tsx:174-184` handleSend / `:40-47` FALLBACK」 | `:174` = `const handleSend` ✅；`:40-47` = `FALLBACK_REPLIES` ✅ | ✅ |
| 00 §5.1 / 05 §8.3「`useWorld.ts:276-318` switch」 | 实际文件是 **`apps/web/src/state/useWorld.ts`**（不是 `hooks/`），`switch (msg.type)` 在 `:277`，`file_changed` 在 `:277`，块延伸到 `:319` | **MINOR**：文件路径 `hooks/useWorld.ts` 不存在（实为 `state/useWorld.ts`，02/00 写对了路径、05 §8.3 未给路径）；`:276-318` 与 `:277-319` 差一行 |
| 05:531「`AGENTS.md:169` 的既有约定（`node --test`）」 | `AGENTS.md:169` 是"参考项目"表行；`node --test` 约定实际在 `AGENTS.md:258`（角色 preset 同步表内） | **MINOR** 引用漂移 |
| 05:1234「`AGENTS.md:83-88, 175-179`」 | `:83-88` = `tools/` 目录说明 ✅；`:175-179` = 常用命令块 ✅ | ✅ |

**结论：落点精度整体优秀（二十余处行号仅 3 处漂移，均为 MINOR）。`launch.ts:164/:165`、`instructions.ts:79-96/98-111`、`probe-tools.mjs:107-110` 三处**关键**插入点全部精确命中。**

### 5.4 给出的 JSON/TS 片段能否直接用

- **四份 preset JSON + 世界侧模板：可以直接落盘。** 解析通过，`hiddenOverrides` 与现状逐字一致，`items` 形状与 `00 §4.2` 冻结一致。
- **`preset-slots.test.mjs`：可以直接落盘并已实跑。** 实跑结果 = §9.2 `710-720` 的"修复前红"表**逐格吻合**：

| §9.2 声称 | 实跑 |
|---|---|
| (1) writer 五 slot **红** | ✖ 红 |
| (2) character 五 slot **红** | ✖ 红 |
| (3) 初始化器不含 `tools` **绿** | ✔ 绿 |
| (4) world 侧 parity **红** | ✖ 红 |
| (5) slot 名注册 **绿** | ✔ 绿 |

（2 绿 3 红，与文档一一对应。测试内部 `registeredAirpSlots()` 正则实测 disco 到 6 个 slot，满足 `>= 6` 断言。）
- **`probe-tools.mjs` 断言块：可以直接插入，但断言与现状冲突（B5）。**
- **01/03 正文：可以直接落盘**（03 已转义、01 无反引号）。**02 正文落盘即编译失败（B1）。**
- **04 的四个 skill 实例：三份可落盘，`holmes-world-style` 会被引擎静默丢弃（B6）。**

**B5（BLOCKER）— §9.1 新增断言与"现状绿"表格自相矛盾，且"2 个"的说法与实测 3 个冲突。**
`05:483` 表列"snippet 以工具名开头 | **现在：绿（15/15）**"，但**相邻的修正框** `05:486` 与 `05:497` 明说"现状**就是这样**（`use_item_on` 不以名字开头）→ **红**"、"现在会红 **2** 个"。三处互相打架。
实测（脚本抽取源码拼接 snippet，`node /tmp/snip.mjs`）：**3 个**不以工具名开头——`use_item_on`（`extensions/toolkit/use-item.ts:36`）、`get_component`（`component.ts:33`）、`generate_image`（`generate-image.ts:64`）。`:520` 的"实测后有 3 个"是对的，`:497` 的"现在会红 2 个"是错的，`:483` 表格的"绿"也是错的。
**可实施性后果**：实现者按 `:483` 的表会以为插入后即绿，实跑得 3 红；且 §9.1 的插入代码块本身**无红绿开关**（它只断言，不修 snippet），故这不是"设计未定"而是"文档内部三口径"。
修法：把 `:483` 表格的该行改为"现状 **红（3 个）**"，`:497` 的"2 个"改"3 个"；并把 snippet 修正落到明确归属（见 MAJOR M2）。

**B2（BLOCKER，诚实性）— `05:254` 的"改完后实测"与 `charpost.json` 产物不符。**
`05:254` 称 `charpost.json` 里 `<available_skills>` 含"平台级 `tool-craft` 与**世界级 `holmes-world-style`** 两个名字"。
实测该产物（`/tmp/airp-wire/charpost.json`，脚本 `/tmp/airp-wire/charpost.mjs:13-17` 硬写两个 fixture skill 名）：

```
charpost.json 含 tool-craft: True
charpost.json 含 holmes-world-style: False
charpost.json 含 holmes-voice: True      ← 产物里实际是 holmes-voice
```

即 05 已把 `04` 裁决后的正确名（`holmes-world-style`）回填进这句"实测"叙述，但**产物没有重跑**——`charpost.json` 里仍是旧 fixture `holmes-voice`。这属"事后修文不复查数据"：读者据此以为 holmes-world 的世界级 skill 实测已进 prompt。**须重跑探针并落新产物，或把该句改回产物真值。**（`REVIEW-Consistency.md:64` 把 `holmes-voice` 记为"ghost 符号"——真正的问题是**实测证据链与文本不同步**，不是符号本身。）

**B3（BLOCKER，诚实性）— §9.3 表把"14 个 forbidden 全部在册"写成"8 个"。**
`05:1040` 与 `05:1199` 的"修复前"列写 `不含 recall/memorize/…` = **❌ 红（8 个在册）**。
实测 `charpre.json` / `wire.json`（35-tool 基线）：**14 个 forbidden 名全部在册**（`recall, retrieve, memorize, revise, forget, relocate, associate, trigger, consolidate, retrace, set_time, awaken, get_state, state_update` 逐一命中，脚本 json 比对）。
另有一处算术越界：`05:395` 与 `:395` 上下文写"`tools.deny` 实测把 35 → 24"。而 35 里只有 14 个是 forbidden，**35-14 = 21 ≠ 24**：deny 同时**解除了 3 个内建（`grep`/`find`/`ls`）的隐藏**（实测：`denyonly.json` 比 `wire.json` 多出 `grep,find,ls`，少掉 14）。文档把这条记成单纯的"deny 减法"，会让人误以为 deny 只做减法——**这条是 `tools` slot 之外的第二次副作用（applyResourcePolicy 把内建 default 从 4 个放到 7 个）**，值得写明。
修法：`8 个在册` → `14 个在册`；`35 → 24` 补一句"= 35 − 14 denied + 3 内建解除隐藏（`grep/find/ls`）"。

**B4（BLOCKER，诚实性）— §9.3 行数口径三处冲突。**
同一份 05 里：`05:15-18` 基线表目标列写 **92–94**；`00:47` F7 写"从 19 行涨到 **94 行**"（证据列 `wire-fixed.json`）；而 `wire-fixed.json` 实测 **94 行且含 `Be concise`**（即 **F9 未修**的产物），`frozen-fixed.json` 实测 **92 行且不含**（F9 已修）。故 00:F7 把"F9 未修"的 94 当成了"本批目标"。
`05:22` 的脚注（M2）自己发现了这点并给了 92/94/125 三口径，但它把 94 归给"`Main` 在补齐并修好 pi-rp 后实测"——**与产物矛盾**：修好 pi-rp 的是 92 行的 `frozen-fixed.json`，94 行的是未修的 `wire-fixed.json`。
**可实施性后果**：探针已按下界 `> 40` 写（好），但 `00 §2 F7` 这条"地基事实"数值错误，会被后续文档继续引用。
修法：`00:47` 改为"92 行（F9 已修）/ 94 行（F9 未修）"，并注明取证文件。

### 5.5 落地顺序 / 同 commit 完整性

`05 §10`（`:1205-1262`）要求的同批清单核对：

| 项 | 在 §10 表内？ | 判定 |
|---|---|---|
| `extensions/instructions.ts`（四常量正文） | ✅ `:1224` | 通过 |
| `presets/writer.json` | ✅ `:1225` | 通过 |
| `presets/character.json` | ✅ `:1226` | 通过 |
| **9 份 world-side `characters/*/preset.json`** | ✅ `:1227`（写"9 份"） | 通过（实测目录里**确为 9 份** templates + 1 份 `worlds/test-school` 豁免，与 §3.3 清单吻合） |
| `characterLaunch` + `--skill` + 注释 | ✅ `:1228` | 通过 |
| 三个测试/探针文件 | ✅ `:1229-1232` | 通过（已含新 `probe-prompt-character.mjs`） |
| `package.json`（`probe:prompt`） | ✅ `:1233` | 通过 |
| `AGENTS.md` | ✅ `:1234` | 通过 |
| pi-rp 子模块指针 + dist | ✅ 第 0 步 `:1209-1218` | 通过（**实测**：`vendor/pi-rp` 是 submodule，`git status` 显示 ` M packages/coding-agent/src/core/prompt-preset/loader.ts` 一处改动；dist **gitignored**（`tools/pi-rp.mjs:5-13` 的注释明写），故"指针 + 重建 dist"两步都是必需的，文档表述正确） |
| **`tools/check-skills.mjs`（04 A1–A12）** | ❌ **不在表内** | **MAJOR M1** |
| **三处 `promptSnippet` 修正（`use_item_on`/`get_component`/`generate_image`）** | ❌ **不在表内** | **MAJOR M2** |
| **`brief-builder.ts` 字段修正（03 §⑨ 冲突 2/3/4）** | ❌；03 声明"不在归属内" | 见 M4 |

**M1（MAJOR，闭环性）— `check-skills.mjs` 断了闭环。**
`04 §⑧` 把 A1–A8/A10–A12 交给"新增 `tools/check-skills.mjs`"，并自己列了交接风险（`04:604-606`）。但：
- `00 §8` 只列三条门，无 `check-skills.mjs`；
- `05 §10` 的 commit 表、`05:1260` 的收工自检、`package.json` 新增行（`05:1053`）**全都没有它**。
全仓 `grep check-skills` 只命中 04 自己与两份 review。
**判定：这不是"真待拍板"**——04 已把"是否做第四条门"交给评审，但在**未落定前，04 §⑧ 的 A1–A12 不能计入本批的机械核验**。04 自己写了那句诚实性要求（"否则降级为 checklist，不得声称已有机械核验"），**该降级必须在 00/04 顶部同步声明**，否则 `00 §8` 自称"三条门覆盖全批"而 skill 层实际无门。

**M2（MAJOR，归属）— snippet 修正无归属方。**
`05:501/523` 说"三处 snippet 需在 **01/04 篇**定稿时统一成 `<name>(…) — …` 形状；05 只登记"。但实测 `grep use_item_on\(item, target\)|generate_image\(prompt\)` 在 01/04 中**零命中**——01/04 都没认领。§12-2 把形状列为"待拍板"。**这是阻断项而非真待拍板**：`05:459-461` 的断言会红 3 个，而没有任何一篇文档承诺修那 3 个 snippet，且 `05 §10` 的 commit 表里也没有 `extensions/toolkit/*.ts`。若不裁决，第 1 个 commit 落地后 `probe:tools` 即红，且无人知道归谁修。

**M3（MAJOR，诚实性）— §9.1 的"证明它不是假绿"一节含错。**
`05:527` 用"词边界 + 已知工具集…**不是裸 grep**"论证保留名断言不被误触发。但**文档给的代码块本身**（`:466-478`）用的正是 `RESERVED_TOOL_NAMES.has(name)`——这段论证是对的，属**通过**。真正错的是同段"现有 `:107-110` 的正则**抓不到 `state_update`**"——这条**实测通过**（`node -e` 验证 `state_update` 不匹配 `.*_state`）。

**M4（MAJOR，诚实性）— 03 的 `brief-builder.ts` 修正是"登记+建议"，但同文档 §⑩-2 把它写成待拍板，而它其实是 blocker。**
03 §⑨ 冲突 3 说"把 `brief-builder.ts:54` 的 `2–3` 改成 `2–4`（**该函数无调用点，改动零成本**）"，§⑩-2 又列进"待拍板"。实测 `brief-builder.ts:54` = `2–3 markdown files`，而 03 正文（新写的 `NOOK_INIT_INSTRUCTION`）说 `2–4`。因该函数**确无调用点**（全仓 grep 仅定义 + dist `.d.ts`），这条**不阻断本批**——属**真待拍板**（等 R2 接线那批再定），判定为**不是阻断项**。

### 5.6 未通过项清单（维度 5）

| 编号 | 级别 | 一句话 |
|---|---|---|
| B1 | BLOCKER | 02 正文裸反引号，照"逐字可贴"落盘即 `tsc` 失败 |
| B5 | BLOCKER | §9.1 新增断言"现在会红 2 个"→ 实测 3 个；同页表格却写"绿"，三口径 |
| B6 | MAJOR | 04 `holmes-world-style` 的 frontmatter 真解析器解不开 → skill 被静默丢弃 |
| M1 | MAJOR | `check-skills.mjs` 无落点/无 commit/无入口，A1–A12 断链 |
| M2 | MAJOR | 3 处 snippet 修正无归属，`probe:tools` 落地即红且无人认领 |
| m1 | MINOR | 05:419 `context.ts:80` 指向错行且本次未复现 |
| m2 | MINOR | `useWorld.ts` 路径/行号（`hooks/` vs `state/`；276-318 vs 277-319） |
| m3 | MINOR | `AGENTS.md:169` 引用漂移（真约定在 `:258`） |
| m4 | MINOR | 05:105 `state-update.js` 应写 `state-update.ts`（dist 相位未标） |
| m5 | MINOR | 05 内部 `§8.1/§8.2` 交叉引用指向已重编号的节（`8.1` 现为 F9 说明、`9.x` 才是断言） |

---

## 维度 6：诚实性

### 6.1 `[推断]` / `待拍板` / `存疑` 全量抽取与判定

抽取全部 28 处标记，逐项判定"阻断项 vs 真待拍板"：

| 出处 | 内容 | 判定 |
|---|---|---|
| `00 §5.1`（末段） | "[推断：接线属 `docs/前端改造计划.md`]" | ✅ 已标 `[推断]`，且**实测确认**零消费（`grep` 到 `writer_delta`/`character_delta` 只命中 `apps/server`）。诚实 |
| `00 §6.1`（角色 `--skill` 一级 vs 两级） | 倾向两级 | **真待拍板**（机制已验、两条路都 1 行） |
| `00 §6.2`（`tool-guidelines` 要不要） | 倾向要 | **真待拍板**；且 04 §2.4/§⑤ 已按"要"写，自洽 |
| `00 §6.3`（新增 skill 数量/命名） | 暂定 2+2/世界 | **真待拍板**；04 已细化为 6 目录 |
| `00 §6.4`（世界级 skill 随 scaffold 生成？） | 未定 | **真待拍板**；05 §5.3 结论"不改 scaffold"自洽 |
| `01 §⑩-1`（`<=200 words`） | 倾向先靠判据 | 真待拍板 |
| `01 §⑩-2`（`view_canvas` 点名） | 倾向不加 | 真待拍板 |
| `01 §⑩-3`（显式 path 撞名） | 待试玩 | 真待拍板 |
| `01 §⑩-4`（`isLayerEmpty` 精确判据） | 倾向粗判据 | 真待拍板 |
| `01 §⑩-5`（与 04 的 description 接口） | 跨篇依赖 | **真待拍板**，且 04 A7 给了机械核验（A7 实测：`component-narration` 命中 3 个触发物、`tool-craft` 2 个，≥2 通过），依赖已兑现 |
| `02 §⑩-1`（回话链路未接通） | 升级为冻结事实 | ✅ 诚实且加了三条 `file:line`（实测三条全对） |
| `02 §⑩-2`（`[emo: normal]` 是否每行） | 待定 | 真待拍板 |
| `02 §⑩-3`（角色给不给世界级 skill） | 引 00 §6.1 | 真待拍板（同 00 §6.1） |
| `02 §⑩-4`（括注） | 待试玩 | 真待拍板 |
| `02 §⑩-5`（stinger 素材缺失） | 本批不覆盖 | ✅ 诚实（实测 `assets/audio/stinger/` 不存在） |
| `02 §⑦-1` | `chalk.ts:14-18` 的失败文案标 `[推断：失败文案以 fail() 包装为准]` | ✅ 已标 |
| `03 §⑩-1`（初始化器用 `chalk` 还是 `write`） | **拍板前正文不点名 chalk** | ✅ 诚实：03 正文实测只出现 `type: chalk` frontmatter 类型名、无 `` `chalk` `` 工具名，与"不点名"一致 |
| `03 §⑩-2/3/4/5` | brief 字段增补 / 父层路径 / 超时值 / 兜底归属 | 真待拍板（其中 §⑩-2 见 M4） |
| `04 §⑩-1..5` | scaffold 生成 / 更多 skill / age 硬度 / 二次触发 / 边界漂移 | 真待拍板（§⑩-6 已关闭：`04:654` 记"✅ 已裁决"） |
| `05 §12-1..5` | 见下 | 混合，逐项判 |

**05 §12 逐项判定：**

| 项 | 内容 | 判定 |
|---|---|---|
| 1 | 一级 vs 两级 `--skill` | **真待拍板**（机制已验证：`charpost.json` 两级都进 `<available_skills>`——实测 console 确认） |
| 2 | 三处 snippet 形状 | **实为阻断项**（M2）：断言会红 3 个，且**无归属**、不在 commit 表。**伪装的待拍板** |
| 3 | `probe:prompt` 是否并入 `probe` | 真待拍板（小） |
| 4 | `tools.deny` 通配 vs 字面 14 | **真待拍板**，且已按冻结写字面（诚实） |
| 5 | 初始化器 `installPreset` 接线归谁 | **真待拍板**，且 05 §8.3 边界 1 明确划出本批不做（诚实） |
| 6 | `instructions.js` 处置 | 已关闭（实测 `find extensions -name '*.js'` 为空） |

### 6.2 "登记当做到"专项检查

| 主张 | 实测 | 判定 |
|---|---|---|
| 05 §3 说 `brief-builder.ts` 字段修正"属 03 篇" | 03 §⑨/§⑩ 只"登记+建议"，**未改**（文件 mtime 未变，内容仍是 `2–3`/无 `[Missing Files]`） | ✅ 诚实：03:264 明写"本文只登记 + 建议，不改该文件" |
| `skills/README.md` 回写（04 C1/C2） | 实测已回写：`:20` 已是 `component-narration/`、`:25-27` 已加 ASCII 裁决段 | ✅ 做到了（04 记 C1/C2"✅ 已关闭"，与实测吻合） |
| 04 C7「`instructions.js` 已解决」 | `find extensions -name '*.js'` 空；`presets.ts:137-146` 优先 `.ts` 跳过 `.js` 孪生（实测代码在） | ✅ 做到了 |
| 00 §2 F9 的 pi-rp 修复「已修并重建 dist」 | `git -C vendor/pi-rp diff` 恰一处 6 行改动；**dist 已重建**（`dist/core/prompt-preset/loader.js:308-309` 含 `typeof … === "boolean"` 新逻辑） | ✅ 做到了 |
| **05:254「实测 `<available_skills>` 含 `holmes-world-style`」** | **产物里是 `holmes-voice`** | ❌ **登记当做到**（B2） |
| **05:1040/1199「8 个在册」** | 实测 14 个 | ❌ 数据不实（B3） |
| **00:47 F7「94 行」归给本批目标** | 94 行产物是 **F9 未修**的；已修的是 92 行 | ❌ 口径错（B4） |
| `05 §9.3「现状 19 行 / 现状不含 retrieve」` | 实测 `wire.json`：19 行、35 工具，**`messages[0]` 文本里 `retrieve` 零命中**；该词只在 `context.tools` 的 schema 侧（`nodeny.json` 的 `tools` 数组里才有） | ✅ **通过**（文档口径正确：`05:1044` 的"三个'不含 X'断言单独在现状下是绿的"**成立**。我先前一次 shell 转义曾误判为 True，复算后撤销。） |
| `04 §⑧ A9` 与 `05 §9.3` 的口径差 | 05 §9.3 确实在 `:98-108` 加了 `<available_skills>` + 动态读 `<repo>/skills/*/SKILL.md` 的断言；但 04 A9 的原文要求"含 `component-narration`"被替换为"读目录里存在的任何 skill" | **MINOR**：05 的写法更稳（04 落地前 vacuous、落地后自动生效），且 `:100-101` 注释自陈"Vacuously true until 04 lands"——**诚实**；但 04 A9 原文未同步，两处措辞不同 |

### 6.3 诚实性总评

**做得好的**：`[推断]` 标注规范（00 §5.1、02 §⑦、05 多处）；"本批不做/边界"专节（05 §8.3）明确划出前端消费、初始化器接线，避免了"提了就是做了"；03 对 `brief-builder` 只登记不改、04 对 C1/C2 的回写、C7 的关闭都有可核验的状态；`frozen.mjs`/`charpre.json`/`charpost.json` 等产物确实存在且**大部分可复现**（行数、工具数、`- look_at:`、`Be concise` 我逐项复算，多数吻合）。

**做得差的（均在本报告 BLOCKER 档）**：
1. **实测数据在修文后未复跑**（B2/B3/B4）：文档把"改文案"当成了"数据也对"，共 3 处数值/产物不符。
2. **降级兑现未在上位同步**（M1）：`check-skills.mjs` 未落地，04 自己写了"不得声称已有机械核验"，但 00 §8 的"三条门"口径仍像覆盖全批。
3. **§9.1 表与正文修正框三口径**（B5）：表格写"绿"、修正框写"红 2 个"、实测 3 个——同一页三个答案。

---

## 维度 1：跨文档一致性

| 检查点 | 结果 |
|---|---|
| `writer-char` vs `writer-instruction` | **通过**：`00 §4.1` 定 `writer-char` 为主、`writer-instruction` 为别名；`extensions/instructions.ts:116,121` 两个都注册；四份 preset 用 `writer-char`。全批一致。 |
| `system-char` vs `char-instruction` | **通过**（`:128,133`） |
| `component-narration`（新名）vs 旧中文 `组件叙事` | **通过**：`skills/README.md:20` 已回写为 ASCII；04 C1 关闭 |
| `holmes-world` vs `holmes-beckstreet` | **通过**：00 §4.3 与 04 C3 均裁"取目录名"；全批写 `holmes-world-style`。**唯** 05:254 一处残留旧 fixture 名 `holmes-voice`（=B2） |
| 9 份 world-side preset 清单 | **通过**：5 处清单（05:232-240、00 §4.2、04 §5.1）一致；实测目录恰好 9 份 + 1 豁免 |
| `scene-init-instruction` / `nook-init-instruction` | **通过** |
| `tools`/`tool-guidelines`/`skills` slot 名 | **通过**：四份 preset 与两份探针一致 |
| 14 名 deny 名单 | **通过**：`00 §4.2`、05 §3.1/§3.2/§3.3、两份探针、`preset-slots.test.mjs` 的 `DENIED` 五处**逐字一致**（脚本比对） |
| `preset-slots.test.mjs` 文件名 | **通过**：00 §9-2 与 05 §9.2 同名 |
| `probe-prompt.mjs` / `prompt-dump-provider.ts` / `probe-prompt-character.mjs` | **通过**：05 §2/§9.3/§9.4/§10 一致 |
| `check-skills.mjs` | **不通过**：04 有、00/05 无（M1） |

## 维度 2：契约冻结遵守

**通过。** 逐项核对 `00` 冻结的共享形状是否被私改：
- 落点常量名（§4.1 六名）：四篇正文均引、无新增/改名；
- slot 名（§4.2）：四份 preset JSON 与两份探针严格照抄；
- 语言分层（§3.3：平台级英文、世界级随世界语言、目录名一律英文）：04 的 4 个实例**实测**全部符合（平台级 CJK 0；`firstsnow-style` 正文含 CJK；4 个目录名全 ASCII）；
- 事实边界（§5）：01/02/03 正文**实测**无 `get_state|set_state|state_update|watch_state`，无中文记忆工具名；`extensions/toolkit/*.ts` 的 snippet/guideline 亦无；
- `tools.deny` 冻结为字面 14 名：04 §⑩-4 把"改通配"标为待拍板而**未擅自改**——符合冻结。

唯二偏差：04 §⑦ 表格（`:586`）仍以 `whitechapel/skills/*` 为例，而 §2.1（`:51`）已新裁"本批不建 whitechapel 目录"——**MINOR**（表格未随新裁决更新；§⑧ A4 已改条件断言，属自相残留在 §⑦）。

## 维度 3：语义兑现 / 需求强度

**通过。** 逐条对用户原话：

| 用户要求 | 兑现处 | 判定 |
|---|---|---|
| 作家单轮四步流程 | 01 §③ `[A turn, start to finish]` 四步 + 每步"漏了会怎样"（01:152-167 表） | **通过**：实测四锚句全在且 `indexOf` 单调递增（[384,796,1435,2709]） |
| 元叙事禁令 | 01 §③ `[Do not hand the turn back by asking for it]`，含 `Never write "What do you do?"` 与 `"It's up to you."`（实测两串均在），并给可判定测试（"describes nothing that is happening…cut it"） | **通过**：非形容词，可自问自答 |
| 组件也是旁白 | 01 步骤 3 第 2 段（"an entity on the canvas is narration the player can hold"）+ 04 §3.1 开篇 + 四载体判据 | **通过**：落在常驻层（指路）+ skill（细则），不重复 |
| 角色 `[emo: tag]` 与每句换行 | 02 §③ `[One sentence per line]` + `[How your face is shown]`（六 tag 全枚举、逐字带空格方括号、失败后果三条） | **通过**：实测正文含 6 个 tag 且闭集与 `audio.ts:37` 逐字一致；每条格式要求的失败后果（立绘不动/标签上屏/静默降级）均给 |
| 工具是能力不是职责 | 02 §③ `[Your hands in this world]`（"not a job title…not required to use any of them on any given turn"） | **通过** |
| 鼓励用工具 | 同上段 + `[When you say nothing]` 与"工具段强制同页"（02 §⑦-8） | **通过**：沉默合法与鼓励用工具并存，未被裁成"别动" |
| 初始化器两处缺口（看不见历史 / 委托失败怎么回话） | 03 §③ 缺口 A/B + 两份正文的 `[If the brief is not enough]` 段 | **通过**：文本断言逐条可过（`cannot see the Writer's conversation history`、`[If the brief is not enough]`、`three-line report`、`already` 实测全在） |

**未"够味"的边角（不足以判不通过）**：02 正文实测仅 **975 词 / 34 行**，而 02:69 写"约 **60 行**"（NIT）；01 实测 1349 词 / 112 行，与 01:25"≈1350 词"吻合。

## 维度 4：闭环性

| 检查 | 结果 |
| 每个被引符号有唯一定义处 | **基本通过**：9 个冻结符号 + `RpcClient` + `AIRP_TOOLS` 全部唯一；`holmes-voice` 已被修成 `holmes-world-style`（但见 B2 的产物侧问题） |
| 每个动作落到具体函数/文件 | **部分不通过**：`check-skills.mjs`（04 A1–A12 的 12 条断言）**无文件、无 commit、无 package.json 入口**（M1）；三处 snippet 修正**无归属**（M2） |
| 断言 ↔ 落点 ↔ commit 三线闭合 | 05 §9.1/§9.2/§9.3/§9.4 四组断言均在 §10 commit 表内有对应文件（除上面两项） |

---

## 附录：本报告的实测命令与产物（可复跑）

- 块抽取 + 解析：`python3`（围栏正则）→ `node --check` / `tsc --noEmit` / `JSON.parse`；
- 04 frontmatter：`node /tmp/fm-check.mjs`（调 `vendor/pi-rp/.../dist/utils/frontmatter.js`）；
- snippet 清单：`node /tmp/snip.mjs`（14 文件拼接，含 `look-at.ts:88` 的 `view_canvas`）；
- `preset-slots.test.mjs` 实跑：`node --test /tmp/preset-slots2.test.mjs`（`REPO_ROOT` 替换本仓）；
- wire 产物复算：`/tmp/airp-wire/{wire,denyonly,nodeny,frozen-fixed,wire-fixed,charpre,charpost,canon}.json`（逐份统计 `context.tools` 长度、`messages[0]` 文本行数、forbidden 命中）；
- 契约对齐：`presets/*.json` 与文档 JSON 逐字段 `deepEqual`（脚本比对，仅 `tools` 键与 2 个 item 为新增）。
