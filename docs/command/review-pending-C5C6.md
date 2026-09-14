# 评审门报告：`[C-5]`（36 个 `dice_outcomes` 实体文件的迁移路线） + `[C-6]`（`{{ trigger.fm.* }}` 读取面）

> 评审者：`RevPendingC5C6`（独立于提案人）
> 日期：2026-09-14
> 证据等级：**E2（源码/内容逐行读 + 本机实测命令）**。无 E3（按约束未跑项目级构建/测试）。
> 纪律：§10.16——凡带 `file:line`/数字/集合的论断一律自测；与提案不符处以实测为准。
> 全部实测命令与输出摘要见 §3。

---

## 0. 判定（唯一、明确）

| 项 | 判定 |
|---|---|
| **`[C-5]`** | **选路线 ④（规则上移、内容留原地），且必须叠加路线 ③ 作为老存档的读时兜底。** 形态取 **D-1**（通用效果组合：`give` + `edit`）。**但不是原样照搬 08 §4.1 的样本**——该样本含两处与本批冻结契约冲突的写法（见 §4 阻断项 B-1/B-2），落地前 MUST 修。 |
| **`[C-6]`** | **选 (a) 全开**。但 **09 给出的两条理由都不成立**（实测证伪，见 §3 Anchor-4 与 §5），必须换成正确理由后回写。**并且 `[C-6]` 的适用范围 MUST 显式排除 `from:`**（否则会误伤路线 ④，见 §5）。 |

**`[C-5]` 的完整形态（判定，不是建议）**：

1. **主路径 ④**：24 个活模板加 `on.roll_resolved`（4 档），`dice_outcomes` 整块不动；命令 `command/investigation-outcome.yaml` 一份/世界。
2. **叠加 ③**：`expandDiceOutcomes` 只服务"无 `on.roll_resolved`"的实体（= 老存档 + 归档）。删除条件机械可核验（`grep`）。
3. **① 不采用**（它把玩家可见文本搬进 `.yaml`，而打包链不翻译 `.yaml` → 真回归；见 Anchor-1）。
4. **② 否决**（双执行器、双倍结算、不可逆）。
5. **落地前 MUST 修 B-1（fold 键冲突）与 B-2（`append_body` 嵌套位置）**，否则 ④ 的样本在**全部 144 个档位**上被拒绝（Anchor-2）。

**`[C-6]` 的完整判定**：

- 选 **(a) 全开**（读取面 = 触发实体自己的整份 frontmatter）。
- **(b) 与 (c) 都不采用**：(b) 把实体字段命名绑死在翻译工具的 `humanKeys` 清单上（隐藏耦合），(c) 与契约 §3.3.2「只占三个 key」冲突——**但这两条是 09 给的理由，我另有理由**（见 §5）。
- **`[C-6]` 的适用范围 MUST 写成「只约束 `{{ trigger.fm.* }}` 插值面，不约束 `on.<hook>[].from`」**。否则若把 (b) 的白名单扩到 `from`，路线 ④ 的 `from: dice_outcomes` 会在写入时被拒（`dice_outcomes ∉ humanKeys`，实测）——**把 C-5 和 C-6 真正耦合起来的正是 `from`，不是 `trigger.fm`**（本报告新发现 NF-2）。

---

## 1. 四路线完整对比表（含"什么都不做"）

> **口径声明**：`00 §9.2` 的候选表里 A（什么都不做）与 B（硬编码）是**整个模块**的候选；本表比的是**迁移路线**。"什么都不做"作为**基线行**列出，不与四条路线混用。

| 维度 | **0. 什么都不做** | **① 就地翻译** | **② 新旧并存** | **③ 语法糖（读时展开）** | **④ 规则上移、内容留原地** |
|---|---|---|---|---|---|
| 做法 | 36 个文件保持"无人执行"的声明 | 24 个活模板把 `dice_outcomes` 改写进 `command/*.yaml`（含全部内容） | 引擎同时识别 `dice_outcomes` 与 `on`+`command/` | `dice_outcomes` 保留为公开语法，读取时纯函数展开成 `on`+命令 | 实体加 `on.roll_resolved`（12 行/文件），内容留在 `dice_outcomes`，命令经 `trigger.entry.*` 读回 |
| **玩家价值** | **零**。掷骰只落点数，卡面只变按钮、无结果文本、无奖励（`SKILL.md` 承诺不兑现） | 兑现 | 兑现 | 兑现 | 兑现 |
| **复杂度（引擎）** | 0 | 低（纯内容搬移） | **最高**：两个执行器 + 并存期"谁先谁后"仲裁 | 低：一个纯函数 `expandDiceOutcomes`（可单测、可删） | 低：一份共享命令 + 现有效果集 |
| **失败形态** | **静默**（`dice_outcomes` 写了没人执行也不报错） | 迁移脚本可机械完成；风险在 `git` 看不见处（存档 / `.yaml` 翻译） | 同一张卡两套语义 → **双倍结算**（玩家被重复发奖）；作者面对"两种写法都行、推荐哪种说不清" | 糖被慢慢加厚成第二套 schema（需写死天花板 + 冲突检测兜底） | 区间被写**两次**（`min/max` 数据 + `when` 规则），漂移风险；`from` 跨字段校验不受 strict 保护（§4.5 缺口4） |
| **可逆性** | — | **对模板高**（`git revert`）；**对已存档玩家不可逆** | **低**：一旦开始，内容侧继续产旧语法，退出成本递增 | **最高**：删掉展开函数即可 | **高**：删 `on` 块即回到基线（骰子照掷、作家照叙述，硬门7）；`dice_outcomes` 还在，可被 ③ 接管 |
| **内容/运营成本** | 0 | 24 文件 ×(−79..96 / +约83) ≈ **−1989/+2000 行**；**MUST 改打包工具**（玩家可见文本进不翻译的 `.yaml`） | 0 | **0 行内容改动、0 行工具改动** | **+288 行 / 0 删除**（**但见 B-1：该数字依赖 fold 策略**）；**0 行工具改动** |
| **它挡住了什么** | 挡住 `dice_outcomes` 兑现（本模块存在的唯一直接理由） | 挡住"模板内容零搬迁"；逼出 `.yaml` 本地化通路 | 挡住"单一语义源"（契约 §1.4） | 挡住"单一公开语法"（语法面变两套） | 挡住"+288/0 删除"的**绝对性**（B-1 迫使要么改 fold 策略、要么删静态 `choice_actions`） |
| **覆盖老存档**（`.gitignore:12`，`git grep` 不可见） | — | **否** | 是 | **是**（唯一手段） | **否**（MUST 叠加 ③） |
| **双语发布链**（Anchor-1） | 不影响 | **必须改工具**（约 15–25 行 + 新增翻译期 LLM 输入面） | 视命令是否承载文本而定（`[未实测]`） | **零改动**（展开在内存中，无 `.yaml` 文件） | **零改动**（人类可见文本 100% 回 `.md`） |

**结论**：④ 与 ③ 在"内容零搬迁 / 工具零改动 / 覆盖存档"三项上是仅有的两条干净路线，且**互补**（④ 治活模板的无损与单一数据源，③ 治存档）。① 的"打包工具必须改"与"玩家可见文本进不翻译的 `.yaml`"使它不适合做唯一手段；② 不可逆、可双结算，否决。

---

## 2. `[C-5]` 与 `[C-6]` 的依赖闭合（**与 09 登记的方向不符**）

09 §12.3 第 6 条（`09:1054`）逐字登记：「路线 ④ 的可行性**直接依赖 `[C-6]` 选 (a)**。若 `[C-6]` 选 (b)/(c)，路线 ④ 的成本会显著上升甚至不成立。」

**实测：这条依赖在 ④ 的最终形态下不成立于 `trigger.fm`，而成立于 `from`。**

证据（`08 §4.1` 的最终样本，`docs/command/08-迁移与收敛.md:312-321`）：

```yaml
do:
  - action: give
    with: { rewards: "{{ trigger.entry.rewards }}" }
  - action: edit
    with:
      path: "{{ trigger.path }}"
      frontmatter: { dice_grade: "{{ grade }}", append_body: "{{ trigger.entry.text }}" }
      choice: "{{ trigger.entry.options }}"
```

**该命令一个 `trigger.fm.*` 都没有**——它读的是 `trigger.entry.*`（由 `on.roll_resolved[].from: dice_outcomes` 在绑定期解析，`08:428-436`）。`trigger.fm.*` 只出现在**更早的映射表行**（`08:92`，`{{ trigger.fm.dice_outcomes }}`），而那一行已被裁定 A + 方向三取代（`08:421-422` 把这两种旧形状列为"已否"）。

**所以真正的耦合点在 `from`**：`from: dice_outcomes` 读的 key **不在 `humanKeys` 里**（实测 `humanKeys.has('dice_outcomes') === false`，`tools/localize-world-editions.mjs:18`）。若 `[C-6]=(b)` 的"白名单 key"被理解为**约束所有 frontmatter key 访问**（含 `from`），则 ④ 在**写入时**就被拒——这才是"④ 依赖 (a)"的真实机制。

**闭合力向（判定）**：
- **C-5=④ ⇒ C-6=(a)** 仅当 ④ 的 `from` 读的 key 需纳入 `[C-6]`；本报告要求 **`[C-6]` 明确 scope 为 `trigger.fm.*` 插值面、不覆盖 `from`** → 此时 **C-5=④ 不要求 C-6=(a)**，二者解耦。
- **C-6=(a) ⇒ C-5=④** 不成立：任何命令都可能用 `trigger.fm.*`（`01:142` 的 `{{ trigger.fm.title }}`、`01:988` 的 `{{ trigger.fm.next_prompt }}`），与骰子无关。

**给收口的一句话**：把 09 §12.3#6 与契约 §11 的措辞从"路线 ④ 直接依赖 `[C-6]`=(a)"改为"**路线 ④ 依赖的是 `from:` 的读取面被 `[C-6]` 显式豁免**；若 `[C-6]` 选 (b)/(c) **且** scope 含 `from`，则 ④ 在写入时被拒"。

---

## 3. 四条 anchor 实测结果

### Anchor-1 —— 双语打包链静默排除 `.yaml`：**成立（机制与提案逐字一致）**

**实测命令与输出**：

```bash
$ sed -n '33p;35p;36p' tools/localize-world-editions.mjs
const isText = f => /\.(md|json)$/.test(f) && !(f.startsWith('assets/') && f.endsWith('.json'));
const readDocument = (f, raw) => f.endsWith('.json') ? JSON.parse(raw) : (() => { const p = parseFrontmatter(raw); ... return { fm: p.frontmatter ?? {}, body: p.body }; })();
const renderDocument = (f, doc) => f.endsWith('.json') ? JSON.stringify(doc, null, 2) + '\n' : Object.keys(doc.fm).length ? md(doc.fm, doc.body) : doc.body;

$ grep -n 'filter(isText)' tools/localize-world-editions.mjs       # collect() 的过滤点
114:      for (const f of (await filesUnder(root)).filter(isText)) {

$ grep -n '!isText(f)' tools/localize-world-editions.mjs           # build() 的复制点
192:      if (!isText(f)) { await fs.copyFile(path.join(root, f), out); continue; }
```

```js
// node --input-type=module
isText("command/investigation-outcome.yaml") = false
forbidden.test("command/investigation-outcome.yaml") = false     // 不被 forbidden 排除 → 会被复制
```

```js
// 用 dist 的 parseFrontmatter 直接喂一份 command YAML
const yaml = "name: Investigation outcome\ndesc: >\n  Materialise.\nparam/mnt/s/n  grade: { type: string }\nd/mnt/o/n  - action: give\n";
const p = parseFrontmatter(yaml);
p.errors.length === 0        // 不报错
p.frontmatter === null       // fm 为空
p.body === yaml              // 整份 YAML 被当成正文 body
```

**追一遍完整流程的结论**（任务点名的"不要只读正则"）：

| 步骤 | `.md` | `.json` | `.yaml` |
|---|---|---|---|
| `collect()` `:114` 过滤 `isText` | 进队列 | 进队列 | **不进队列** |
| `readDocument` `:35` | `parseFrontmatter` | `JSON.parse` | （到不了；若被 `isText` 收进来则走 `else`：`fm=null`、`body=整份 YAML`，**已实测**） |
| `mapText` `:39-50` `key === 'body'` 分支 | 按空行切段翻译 | — | （若被收进来：**整份 YAML 作为一个 body 段送 LLM 翻译**） |
| `renderDocument` `:36` | `md(fm, body)` | `JSON.stringify` | （`Object.keys(fm).length===0` → 原样写回 `doc.body`） |
| `build()` `:192` 复制 | — | — | **`!isText` → 原样 `copyFile`，保持源语言，无报错** |

**→ "静默漏翻译"成立**：`.yaml` **不进翻译队列**，但**会被复制**进双语版（`command/` 不在 `forbidden` `:19` 里，实测），于是译文版世界里命令保持源语言、**零报错**。

**"翻译了会不会写坏"**：`readDocument` 的 `else` 分支会把整份 YAML 交给 `mapText` 的 `body` 分支（按空行逐段送 LLM）→ **结构必被改写**（YAML 的缩进/键序/`>` 折叠块会被当散文翻译）。所以正确做法是"**要么不收 `.yaml`、要么给 `.yaml` 写完整三分支**"，收一半最坏——这正是 §3.4d 主张 2 的工作量所在。

**`humanKeys` 复核**（`:18`）：`{name,title,description,label,free_hint,hint,intent,blocked,desc,text,prompt,content,genre,tags,date,contract}`。路线 ④ 的人类可见文本键 `text` / `title` / `prompt` / `desc` **全部在内**（实测 `humanKeys.has('text')===true`）→ **④ 把内容留在 `.md` 里确实继续走现有翻译通路**。

**反向测（①②③各自要不要改工具）**：
- **① 必须改**：它把"4 段结果文本 + 3 路径 + 3 标题 + 3 正文 + 2 label + 1 prompt"搬进 `command/*.yaml`——**玩家可见文本进不翻译的 `.yaml` = 真回归**（不只是 `name`/`desc` 摘要）。成本 = §3.4d 主张 2（约 15–25 行 + 一条新测试 + 一条新 LLM 输入面）。
- **③ 不用改**：`expandDiceOutcomes` 在内存中合成 `on`+命令，**不产生 `.yaml` 文件** → 打包链看不到它。
- **② 视形态**：若并存的"新语法"命令承载内容则同 ①，否则同 ③。**`[未实测]`**（文档未冻结②的命令形态）。

**→ 判定：成立。** 但**它支持 ④ 与 ③，不单独支持 ④ 相对 ③**——③ 同样零工具改动。提案把 (b) 说成"路线 ④ 的第三条理由"是对的（它把 ① 排除掉），但**不是 ④ 相对 ③ 的理由**。

### Anchor-2 —— 路线 ④ 的表达力：**部分成立（语法面够；但 08 §4.1 的样本在 144/144 档上被本批契约拒绝 → 阻断）**

**我独立重译两档**（不用 08 的译文）：

**（甲）普通档 —— `templates/wuwu/world/harbor-chart/04-investigation-dice.md` 第 1 档（2d10，`min:2 max:4`）**：逐字段对照

| 旧字段 | 值（截断） | ④ 的表达 | 逐字可译？ |
|---|---|---|---|
| `min:2`/`max:4` | `2..4` | `on.roll_resolved[0].when: "2..4"`（`parseExpect` 原子 `2..4`，`rules/dice.ts:154-160`） | ✅ |
| `text` | "Sounds of investigation echo…" | `append_body: "{{ trigger.entry.text }}"` | ✅（经 `append_body` 追加，`04 §3.5`） |
| `options[0]` `id:play-result` `action:{kind:writer,prompt:…}` | — | `choice: "{{ trigger.entry.options }}"` 折叠 → `choice.options[0]={id,label}` + `choice_actions['play-result']={kind:writer,prompt}` | ⚠️ **见阻断 B-1** |
| `options[1]` `id:back` `action:{kind:enter,target:world/harbor-chart}` | — | 折叠出 `choice_actions['back']` | ⚠️ **与实体已有静态 `choice_actions.back` 冲突** |
| `rewards[0]` `{path,title,body}` | `world/harbor-chart/investigation-setback.md` | `give: { rewards: "{{ trigger.entry.rewards }}" }`（`list-args`，`04 §2.6`） | ✅ |

**（乙）最复杂档 —— `templates/whitechapel-jp/world/london-map/04-investigation-dice.md` 第 4 档（1d100，`min:96 max:100`）**：语义最重的一档（失败档，`writer` prompt 最长，`rewards.path` 与第 3 档**共用** `investigation-setback.md` 但 `body` 不同）

| 旧 | ④ | 备注 |
|---|---|---|
| `min:96/max:100` | `when: "96..100"` | ✅ |
| `text`（长句） | `append_body: "{{ trigger.entry.text }}"` | ✅ 上限需 `03` 定数字，超限拒绝不截断（`04 §3.5`） |
| `options[].action.kind: writer`（prompt 极长） | 折叠进 `choice_actions['play-result']` 当**数据** | ✅（§5 三分法），但见 B-1 |
| `rewards` 与相邻档共用 path | `give` 用 `trigger.entry.rewards`（本档 body 不同） | ✅ 一次掷骰只命中一档，不自撞 |

**结论：语法面能表达全部语义**（`min`/`max`、`text`、`options[].{id,label,action}`、`rewards[].{path,title,body}` 逐项落点齐备）。

**但 —— 阻断 B-1（本题的实质结论）：08 §4.1 的命令样本会被 04 §2.6 的 `fold-args` 键冲突检测拒绝，且是 144/144。**

```bash
$ python3  # 解析全部骰卡
templates cards: 24  bands: 96   bands refused by fold-clash: 96
（含 archive：36 cards / 144 bands；options 含 'back' 的档 = 144/144；
  实体静态 choice_actions 键 = {'back'} 的卡 = 36/36；交集 = 144/144）
ALL band option ids: ['back', 'play-result', 'read-clue']
ALL static choice_actions keys: ['back']
intersection: ['back']
```

`08 §4.1` 的命令写 `choice: "{{ trigger.entry.options }}"`（折叠**全部** options，含 `back`），而 `08 §4.1` 同时说"`choice` / `choice_actions` 三块同样不动"（`08:299`）——**实体静态 `choice_actions.back` 仍在**。`04 §2.6`（`04:284-285`）逐字：折叠出的 id 与实体已有 `choice_actions` 键**有交集 → `already_exists` / 409，整体不写**。

**后果**：每一次触发、每一档，`edit` 的折叠被整体拒绝 → **`choice`/`choice_actions` 从不写回 → 玩家看到按钮不变的卡**，路线 ④ 的**功能不减验收线当场失败**，而所有技术指标（解析成功、`give` 成功、部分落账）都是绿的。

**这不是"翻不动"，是"样本与契约互相矛盾"**，且**它不只打击 ④**——任何在运行时"折叠 options 到既有 `choice_actions`"的路线（①③④）都踩它（niko 原实现是**覆盖**，`declared-actions.ts:204-205`，所以今天不踩）。修复二选一：

- **(i) 改 04 的 fold 策略**：折叠值与既有键**逐值相等时放行（幂等 no-op）**，只在**不等**时拒绝。实测本仓 144 档里 `back` 的折叠值与静态值**逐字节相等**（`{'kind':'enter','target':'world/harbor-chart'}` / `{'kind':'enter','target':'world/london-map'}` 实测相同）→ (i) 即可零改动放行。
- **(ii) 迁移时删掉实体静态 `choice_actions`**：则 `08` 的"**0 删除 / +288 行**"不再成立（需写入 §4.2/§10.4 的代价列）。

**判定：部分成立。** 语法面无缺口；**但 08 §4.1 的样本在本批冻结契约下 144/144 失败，必须在落地前修（阻断 B-1）**。这一条**独立于提案人的论据**（提案人相反地声称"在已实测的 144 档位上折叠是安全的（无 key 冲突）"，`08:342`——**该断言实测为假**：144 档全部 `back` 冲突）。

### Anchor-3 —— 工作量数字：**部分成立（144/144 成立；"全仓 44"不成立）**

**实测命令与输出**：

```bash
$ python3  # 解析 36 个 04-investigation-dice.md
files: 36 bands: 144
rewards len dist: {1: 144}          # 144/144 恰好 1 项   ✅ 与 08 §2.3 一致
options len dist: {2: 144}          # 144/144 恰好 2 项   ✅
keysets: {('max','min','options','rewards','text'): 144}     # 单键集，一个不缺一个不多 ✅
top keysets: {('choice','choice_actions','dice_outcomes','roll_dice','title','type'): 36}  # ✅
option action keysets: {('kind','prompt'): 24, ('kind','target'): 144, ('kind','paths'): 120}
text != rewards[0].body 的档: 0      # 正文与奖励 body 逐字相同
```

**分母说明**：
- `templates/**/04-investigation-dice.md` = **24**（会被拷进新世界）；
- `archive/**/04-investigation-dice.md` = **12**（已冻结，不被拷贝）；合计**声明规模 36**、档位 **144**。
- **`144/144` 两个论断成立**，且 keyset 唯一（与 `03` 实测的"两切面不矛盾"一致）。

**但"计数锚点"这条不成立**（`08 §2.1`，`08:34`）：

```bash
$ git grep -l dice_outcomes HEAD -- | wc -l
58                                  # ← 08 §2.1 写"全仓 grep 命中 44 / HEAD = 43"
$ git grep -l dice_outcomes HEAD -- | grep -v ':docs/command/' | wc -l
44
$ git grep -l dice_outcomes HEAD -- 'docs/command/*' | wc -l
14                                  # ← 08 的分解式 36+6+1+1 漏掉了这 14 条自引用
```

**08 §2.1 的"全仓 grep 命中 44"实际是"排除 `docs/command/` 后的计数（36 卡 + 6 SKILL + 1 工具 + 1 骨架）"**。加上本批次新增的 `docs/command/` 自引用（14 条），**当前工作树与 HEAD 的真实全仓命中都是 58**。§R.25 的整个目的是**计数可机械核验**，而这两行给出的命令输出**不可复现为所写的数字**。子计数 **36 / 42（世界包内 = 36+6）/ 声明规模 36 全部正确**（实测世界包内 = 42）。

**判定：部分成立。** `144/144` 成立；**"全仓 44 / HEAD 43"不成立（实测 58），须按"排除自引用 44 / 含自引用 58"改写**。

### Anchor-4 —— `[C-6]` 读取面是否构成越权：**部分成立（读取面真实存在且比 09 说的更大；09 的两条理由都不成立）**

**任务点名的具体回答（不停在抽象说法）**：

**1) `on` 能写在 `player/**` 或 `characters/<id>/**` 的实体上吗？** **能。** 三个触发点都不做 nook/layer 门：

- `rollDice` 只经 `store.readFile(path)` 读文件（`roll-dice.ts:117-119`），路径由 `resolvePath` 校验（拒绝对路径 / `..` / 隐藏段 / `node_modules`，`local-store.ts:140-177`），**不拒 `player/` 或 `characters/<id>/`**；
- `chooseOption`、`useItemOn`（`use-item.ts:178` 的 `assertEntityPath`）同样只做通用路径校验，无 nook 门；
- `on` 是实体 `.md` frontmatter 的顶层键（`02 §2.1`，`02:24`），**本批文档没有任何"`on` 只能住在 `world/`"的限制**（全仓 grep 无此约束）。

**2) `on` 写在 nook 内卡片上时，`trigger.fm.*` 能读到什么？**

**该卡片自己的整份 frontmatter**，包括 `characters/<id>/identity.md` / `personality.md` / `memory.md` / `unspoken.md` 这类**角色私人小天地内容**。实测这些文件的 frontmatter 没有任何"隐藏"标记，且它们**被 nook 门当作"角色配置 / 生活痕迹"保护**：

```
# packages/shared/src/rules/characters.ts 的 characterRootConfigOf（:66-91）
README.md / identity.md / personality.md / memory.md  → 四份 immutable 配置
# actor.ts:123-156  assertNookMutationAllowed —— 写侧对 characters/<id>/** 设四门
# nookCardPaths（:96-110）把四份配置从 nook 页面成员里剔除
```

即：**nook 内容在"写侧"受 `assertNookMutationAllowed` 保护（`actor.ts:113-156`），在"读侧"也有分层（`nookCardPaths` 把 `identity/personality/memory` 从玩家可见页面里剔除，`characters.ts:96-110`）。而 `trigger.fm.*` 绕过了读侧分层**——它读的是触发实体自己，若 `on` 写在 `characters/ryo/memory.md` 上，命令能读到 `memory.md` 的整份 frontmatter。

**3) `on` 写在 `player/**` 物件上时？** `player/` 不是层（`resolveLayer` 返回 `null`，`local-store.ts:859-873`），玩家"背包"里的物件 frontmatter（如 `portable`、`status.data`）都能被 `trigger.fm.*` 读到。

**4) 越权面是否真实？** **是，但越权的"出口"被效果集堵住**：

- **读面**：`trigger.fm.*` 能读触发实体的任意 frontmatter（含 nook 私有内容、`player/` 物件状态）——**比 09 的"触发实体在画布上、玩家能点开"更宽**：**`characters/<id>/memory.md` 这类不在画布上的 nook 卡片不是"玩家能点开的实体"**（`nookCardPaths` 明确把它们排除出 nook 页面）。
- **出口**：要外泄，读到的值必须经 `{{ }}` 进**效果参数**。`04` 的 7 效果里 `give`（写文件）、`edit`（写文件）、`set_status`（窄口 `status.data`）、`move`、`consume`、`enter`、`link`——**没有"回显给玩家"的效果**。所以**"能读"不直接等于"能说出去"**——09 的第 2 条（`09:601`）**这一半是对的**。

**但 09 的第 1 条理由（`09:600`「触发实体已经在画布上，玩家能点开它」）不成立**——对 nook 私有卡片与 `player/` 物件，它们**不在画布上**。所以 09 的结论（选 (a)）**可以成立，但不能靠那条理由**。

**→ 判定：部分成立。** 读取面真实存在、且**比 09 描述的更大**（含 nook 私有卡片）；09 的第 1 条理由被实测证伪，第 2 条（出口被效果集堵住）成立。**结论 (a) 我仍同意，但理由必须换**（见 §5）。

---

## 4. 阻断项（落地前 MUST 修）与 §10.16 的裁定说明

### B-1（阻断）—— `08 §4.1` 的 fold 折叠会在 144/144 档位被 `04 §2.6` 键冲突检测拒绝

见 Anchor-2。**两条修复路径**（任选其一，但必须选）：

- **(i) 首选：改 `04 §2.6` 的 fold 策略为"逐值相等即幂等放行"**。理由：折叠值与静态 `choice_actions.back` 在本仓**逐字节相等**（实测），此时覆盖与放行**产生同一世界状态**，硬门 3（不篡改已结算事实）不被违反；只有在**不等**时才拒绝（那时才是真覆盖）。
  - ⚠️ **这条需要同步改 `04 §2.6` 的契约与 `04` 的 T-15 用例**（`04:1494-1508` 现在断言"有交集一律拒绝"，需改为"有交集且值不等才拒绝"）。
- **(ii) 备选：迁移时删掉实体静态 `choice_actions`**。则 `08 §4.2`/`§10.4` 的"**0 删除 / +288 行**"必须改成"**+288 行 / −N 行**"（每个骰卡删 3 行静态 `choice_actions`），且**注释 5.3 不是语法糖**（`08 §5.3`）的论证要重述。

**归属**：`04`（fold 契约拥有者）+ `08`（迁移数字拥有者）。**这是 `[C-5]` 路线 ④ 的唯一硬阻断**——不修，④ 在存量上**功能归零**。

### B-2（阻断）—— `08 §4.1` 把 `append_body` 写进了 `frontmatter:` 块内（嵌套位置与 `04 §3.5` 冲突）

`08:318-320` 逐字（`frontmatter:` 在 `:318`，`append_body:` 在 `:320`）：

```yaml
      frontmatter:
        dice_grade: "{{ grade }}"
        append_body: "{{ trigger.entry.text }}"
```

而 `04 §3.5`（`04:520-533`）与 `04 · 改动表`（`04:1149-1150`）逐字把 `append_body` 定义为 **`EditEntityInput` 的顶层字段**（与 `frontmatter` / `body` 平级、互斥），**不是 `frontmatter` 的子键**：

```ts
// 04 §3.5 的准确形态
interface EditEntityInput {
  path: string;
  frontmatter?: Record<string, unknown>;
  body?: string;
  append_body?: string;   // ← 顶层，与 frontmatter 平级
}
```

**后果**：按 `08 §4.1` 的写法，`append_body` 会作为 `frontmatter` 的一个键**被写进实体 frontmatter**（`delete.ts:196-201` 的浅合并），而**正文永不被追加**——`dice_outcomes[].text` 的玩家可见回归（08 §4.5 缺口 1 明令"这一条不能丢"）**静默发生**。同时 `04 §4.4`（`04:682`）的"`body` 与 `append_body` 互斥"检查**永远不触发**。

**修复**：`08:318-320` 改为顶层：

```yaml
      frontmatter: { dice_grade: "{{ grade }}" }
      append_body: "{{ trigger.entry.text }}"
      choice: "{{ trigger.entry.options }}"
```

**归属**：`08`。**这是纯文档错误**（`04` 已冻结正确形态），但**照 08 的样本落地就是静默回归**，故列为阻断。

### 非阻断：`on.roll` vs `on.roll_resolved`（hook 名）

`08` 全篇用 **`on.roll`**（`08:91,170-173,207,282,326,...`，36 处），而 `02`（hook 名拥有者）与 `03` 冻结的是 **`on.roll_resolved` / `choice_selected` / `use_item_on`**（`02:50,90,310,873`；契约 §N-6）。

**这已被 `02` 自己登记为失败形态**（`02:1275` 逐字：「未知 hook 名（`on.roll` 而非 `on.roll_resolved`）→ hook 永不命中，命令永不执行」）。所以 **`08` 的样本若逐字落地，`on.roll` 会被 `parseOnBindings` 判为 `on_unknown_hook`，命令永不执行**。

**判定**：**非阻断**（`08 §4.5` 自己写了"若 `01`/`02` 定稿变化，结论不变，只是拼写变"，`08:231`；且 `01:336` 也用 `on.roll[]` 作为**示意**缩写）。但**落地前必须按 `02` 的冻结名统一改写**，否则样本不可执行。**归属**：`08` + `01`（`01:336` 的示意也应改）。

### 对主 agent 倾向的裁定：**不推翻，但两条支撑理由要修正**

- **路线 ④ 本身**：**同意**（见 §1 对比表 + Anchor-1/2）。**未被推翻**。
- **理由 (a)"搬家量最小、规则唯一"**：**部分不成立**。B-1 证明"搬家量最小"在**当前 fold 契约下不成立**（要么改 fold 契约、要么删静态 `choice_actions`）；"规则唯一"也不精确——④ 把区间写了**两次**（`08 §9.2` 注已诚实承认）。
- **理由 (b)"双语发布链对 `.yaml` 会静默漏翻译"**：**成立**（Anchor-1 实测），**但它同样排除 ③ 吗？不排除**——③ 不产生 `.yaml`，也零工具改动。所以 (b) 是**"④ 与 ③ 相对 ①② 的优势"**，不是"④ 相对 ③ 的优势"。**主 agent 用它做"④ 优于全部三条"的论据，是过度外推。**

**建议的措辞修正**：把 ④ 的推荐理由从"两条独立理由"改为 **"① 被 Anchor-1 排除（玩家可见文本进不翻译的 `.yaml`）；② 被双结算与不可逆排除；剩下 ④ 与 ③ 互补（④ 治活模板、③ 治存档），④ 因'内容零搬迁 + 单一数据源'作主路径，③ 因'覆盖存档'作兜底"**。

---

## 5. 若我推翻主 agent 的倾向 —— 本节单列

**我没有推翻 ④。** 但**我推翻 `09` 的两条 [C-6] 理由，且我推翻 `08` 的"折叠安全"断言**。逐条：

### 被推翻 1：`08:342`「在已实测的 144 档位上，`fold-args` 折叠是安全的（无 key 冲突）」

**证据**：144/144 档的 `options` 含 `id:back`，而 36/36 卡的静态 `choice_actions` 键集 = `{'back'}` → **交集 144/144**（实测命令见 Anchor-2）。**该断言为假。**

**建议改选**：B-1 的 (i)（改 fold 为"逐值相等即放行"）。**被推翻的是"折叠安全"这一条理由**（它被 04 用来支持"拒绝 + 可见错误"的严格性，也被 08 用来论证迁移零风险）。**修 04 的 fold 策略后，④ 的样本才可执行。**

### 被推翻 2：`09:600`「触发实体已经在画布上，玩家能点开它（`look_at` 的语义就是"看到这个实体的全部"）」

**证据**：
1. `look_at` 的实体块（`renderEntityBlock`，`render/layer-page.ts:157-169`）只打印 `[path]` + `title` + `body` + 交互文本——**不打印任意 frontmatter**。所以"`look_at` 让玩家看到实体的全部"**对 frontmatter 为假**（它看的是 body 与互动字段）。
2. 更重要的是：**`characters/<id>/memory.md` / `personality.md` / `identity.md` 这类 nook 卡片根本不在画布上**（`nookCardPaths` 明确把四份配置从 nook 页面成员剔除，`characters.ts:96-110`；它们不是 `world/` 下的层成员）。**"玩家能点开它"对它们不成立。**

**建议改选**：**仍选 (a)，但换理由**。正确的理由应是：

> **`trigger.fm.*` 的读取面不构成越权，因为它的"出口"被效果集堵死**——`04` 的 7 个效果里**没有任何"把读到的值回显给玩家"的效果**（`give`/`edit`/`set_status`/`move`/`consume`/`enter`/`link` 全部写文件或改状态）。**能读不等于能说出去**（这一条 09 写对了）。**需补的一条**：`set_status` 写 `status.data`、`edit` 写任意 frontmatter —— 若一条命令把读到的 nook 私有值写进**触发实体自己的可见 frontmatter**，玩家**下一次 `look_at` 该实体时**就能看到（`fm.tsx` 渲染 `choice`/`status`）。**所以"无回显效果"这个论证有一个缺口**：`edit` 可以把读到的值搬到**任何可读实体的 frontmatter**。

**→ 我的 [C-6] 判定仍是 (a)，但附一条硬要求**：`04` 的 `edit` 效果 MUST 有一条**写入目标限制**——命令 `edit` 的目标 MUST 是**触发实体自己或 `trigger.entry` 指向的路径**（静态可查的一部分），MUST NOT 允许"把 `trigger.fm.*` 的值写进另一个任意路径"（否则 `trigger.fm.*` 就是一个**经 `edit` 中转的、可跨实体传播的读取通道**）。这是把 `09` 的"能读不等于能说出去"**从口头论证升级为机制**。**归属**：`04`（效果契约）+ `01`（写入期校验）。

### 被推翻 3：09 §12.3#6 / 契约 §11 的"④ 直接依赖 [C-6]=(a)"

见 §2。**真正耦合点是 `from`，不是 `trigger.fm`。** 建议改选：`[C-6]` 明确 scope 只覆盖 `trigger.fm.*` 插值面、**显式豁免 `from`**。

---

## 6. 残留风险（无论选哪条路线）

| # | 风险 | 状态 |
|---|---|---|
| R-1 | **`worlds/` 存档在落地时的真实内容未知**（`.gitignore:12` 不可追踪）。今天命中 0，但这是"此刻"的事实。 | `[未实测]` — 必须靠 ③ 兜底，不能靠"到时候看" |
| R-2 | **打包链对 `.yaml` 的确切行为**：若 ④ 只留 `name`/`desc`，那两字段的漏翻译是"元数据未本地化"，玩家不可见——**可接受**。但 `08 §3.4d` 主张 2 若被选（给 `.yaml` 写三分支），**新增的翻译期 LLM 输入面**在云端多租户下是一条新的不受信通路（归 `09`）。 | `[推断]` |
| R-3 | **`range` 重叠致静默 `reused`**（`08 §16.2` 的 `overlapping_command_when`）：`commandKey` 不含 `args`，同一 `(source,hook,command,fact)` 的两条 entry 只跑第一条。**存量无重叠**，但 Agent 写新命令会有。 | `[推断]`（依赖 `01` 落地该写入期检查） |
| R-4 | **B-2 若只改文档不改实现**：`append_body` 若真按 `08 §4.1` 的嵌套写法实现，正文追加静默失效。 | **需落地期机械核验**（`04` 已有 T-6 用例，`04:1289-1298`） |
| R-5 | **`trigger.fm.*` 经 `edit` 跨实体传播**（见 §5 被推翻 2 的缺口）：无写入目标限制时，读面可被"搬运"出去。 | `[推断]` — 建议 `04` 补硬要求 |
| R-6 | **归档（12 文件）的 `2d10` vs 活模板 `1d100` 骰型差异**（`08 §2.2` E 组）：③ 的展开函数 MUST 不假设单一骰型。 | 实测存在（E 组 = `2d10`，A/B 组 = `1d100`） |

---

## 7. `08`/`09` 文档中与我的结论不符之处（附 `file:line`，供收口）

| # | 文件:行 | 原文（摘要） | 实测结论 | 性质 |
|---|---|---|---|---|
| 1 | `08:342` | 「在已实测的 144 档位上，`fold-args` 折叠是安全的（无 key 冲突）」 | **假**：144/144 档与静态 `choice_actions.back` 冲突 | **P0 阻断（B-1）** |
| 2 |  `08:318-320` | `append_body` 写在 `frontmatter:` 块内 | 与 `04 §3.5`（顶层字段）冲突；落地即静默回归 | **P0 阻断（B-2）** |
| 3 | `08:34` | 「全仓 grep 命中 44 / `git grep HEAD` = 43」 | **实测 HEAD = 58（含 `docs/command/` 14 条自引用）；排除自引用 = 44** | P1（计数锚点不可复现） |
| 4 | `08:91,170-173,207,282,326` + `01:336` | `on.roll[]` | `02:50,90,310` 冻结为 `on.roll_resolved`；`02:1275` 自认 `on.roll` = hook 永不命中 | P1（落地前统一） |
| 5 | `08:92` | `rewards`「参数按值取自 `{{ trigger.fm.dice_outcomes }}`」 | 已被裁定 A + 方向三取代（`08:421-422` 自列为"已否"）；最终形态读 `trigger.entry.*` | P2（陈旧行，易误导） |
| 6 | `09:600` | 「触发实体已经在画布上，玩家能点开它（`look_at` 看到全部）」 | **假**：`look_at` 不打印任意 frontmatter；nook 私有卡片不在画布上 | P1（[C-6] 理由错） |
| 7 | `09:601` | 「能读不等于能说出去」 | **成立**，但**不完整**：`edit` 可把读到的值写进别的实体的 frontmatter（跨实体搬运） | P1（需补写入目标限制） |
| 8 | `09:1054` / 契约 §11 | 「路线 ④ 直接依赖 `[C-6]` 选 (a)」 | 方向不准：④ 的 `trigger.fm` 用量为 **0**；真正耦合点是 `from`（`dice_outcomes ∉ humanKeys`） | P1（依赖闭合需改写） |
| 9 | `08 §10.4` / `09 §9.2` 的"删掉 `command/` 即回退" | 可逆性表述 | **本文档范围内已由 `[C-4]` 评审裁定重写**（删目录 = 禁用形态，不是干净回退）——**本条与 08 的路线表（`08:768` 表格"可逆性：删掉 `on` 块即回到今天"）口径一致，不冲突** | 已由 C-4 覆盖，仅登记 |

---

## 8. 独立于提案人论据的新发现（本条为验收项）

| # | 新发现 | 证据 | 影响 |
|---|---|---|---|
| **NF-1** | **`fold-args` 键冲突在存量上 144/144 命中**（提案人相反地称"无冲突"） | 实测：`options` id 集 = `{back, play-result, read-clue}`，静态 `choice_actions` 键集 = `{back}`，交集 144/144 | **④ 的直接阻断**；需改 `04` fold 策略 |
| **NF-2** | **C-5 与 C-6 的真实耦合点是 `from`，不是 `trigger.fm`**（推翻 `09 §12.3#6` 的依赖方向） | `08 §4.1` 最终命令 `trigger.fm` 用量 0；`from: dice_outcomes` 的 key `dice_outcomes ∉ humanKeys`（`:18`） | 收口措辞；`[C-6]` scope 须豁免 `from` |
| **NF-3** | **`09` 的"不越权"论据被 `look_at` 实测证伪**：`look_at` 只渲染 body+互动字段，**不渲染任意 frontmatter**（`render/layer-page.ts:157-169`）；且 nook 私有三文件（`identity/personality/memory`）**被 `nookCardPaths` 排除出 nook 页面**（`characters.ts:96-110`），**不在画布上** | 逐行读 `renderEntityBlock`、`nookCardPaths` | 选 (a) 需换理由（见 §5） |
| **NF-4** | **`.yaml` 若被"收一半"（只加进 `isText`、不改 `readDocument`/`renderDocument`）会写坏**：`readDocument` 的 `else` 把整份 YAML 当 body，`mapText` 的 `body` 分支按空行切段送 LLM | 实测 `parseFrontmatter(yaml)` → `fm=null, body=yaml`；`mapText` body 分支逐段 `translate` | 主张 2 的"工作量"评估必须含"三分支"，不是"改一行正则" |
| **NF-5** | **`08` 的计数分解漏了本批次自身的 `docs/command/` 14 条引用**：真实全仓 = 58（HEAD 与工作树相同） | `git grep -l dice_outcomes HEAD` = 58；排除 `docs/command/` = 44 | §R.25 的"机械可核验"必须显式排除/包含自引用 |

---

## 9. 验收自查（对照本报告）

- [x] 报告落盘 `docs/command/review-pending-C5C6.md`。
- [x] `[C-5]` 唯一判定 = **路线 ④ + ③ 兜底**（§0）。
- [x] `[C-6]` 唯一判定 = **选 (a)**（§0、§5），附 scope 豁免 `from`。
- [x] 四条 anchor 均有实测命令与输出摘要（§3）。
- [x] 至少两条独立新发现（§8，共 5 条 NF-1..NF-5）。
- [x] 若推翻主 agent 倾向：单列 §5（推翻的是 09 的两条理由与 08 的 fold 断言，**不推翻 ④ 本身**）。
- [x] 未修改 `docs/command/**`（除本报告）、未改代码、未跑项目级构建/测试。
