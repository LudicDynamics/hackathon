# docs/prompts/04 — skill 体系（平台级 / 世界级）

> 状态：**设计稿（2026-09-12）**，待评审。属「作家 / 角色 / 初始化器提示词 + skill 体系」批次（见 `docs/prompts/00-共同上下文.md`，下称 `00`）。
> 一切落点、命名、语言分层、事实边界以 `00` 为准；本文只写 **skill 层的清单、正文、命名、description 与骨架**。
> 前置：`00`（冻结契约）、`doc-23`（九条写法）、`docs/hooks/00`（注入什么，本文不重复）、`docs/tools/00` + `docs/doc-20`（工具真相）、`vendor/pi-rp/packages/coding-agent/docs/skills.md`（frontmatter 规则）。
> 现状核实（2026-09-12）：**全仓不存在任何真正的 `SKILL.md`**（`find . -name SKILL.md -not -path './node_modules/*' -not -path './vendor/*'` 零命中）。现有两块只是占位 README：`skills/README.md`、`templates/holmes-world/skills/README.md`。本文是从零到有的体系设计。

---

## ① 一句话定位

**skill 层是"怎么做得好"的唯一住处：平台级写通用手艺（组件叙事、工具叙事），世界级写这个世界的文风与剧情；`description` 常驻 system prompt 决定 agent 何时去 `read`，正文按需加载。**

它不承担三件事：不是身份（→ `extensions/instructions.ts` 常驻层）、不是工具语义（→ `extensions/toolkit/*.ts` 的 `description`）、不是每轮状态（→ `docs/hooks/00` 的注入块）。判据是 `00 §3.1` 的"一条内容只住一层"。

---

## ② 落点与签名

### 2.1 目录落点（遵循 `00 §4.3`）

```
<repo>/skills/                       # 平台级 —— 英文
  component-narration/
    SKILL.md
    references/
      component-kinds.md
  tool-craft/
    SKILL.md
    references/
      chalk-styles.md
<world>/skills/                      # 世界级 —— 目录名英文；description/正文跟随世界语言
  <world-dir>-style/                 # 例：holmes-world-style/ · firstsnow-style/
    SKILL.md
    references/
  <world-dir>-plot/                  # 例：holmes-world-plot/ · firstsnow-plot/
    SKILL.md
```

**本批要落地的具体清单**（6 个 skill 目录 = 2 平台级 + 4 世界级；载体是 **6 个 `SKILL.md` 文件**）：

| tier | 目录 | `name` | 正文语言 | 世界 |
|---|---|---|---|---|
| 平台级 | `<repo>/skills/component-narration/` | `component-narration` | 英文 | 全部 |
| 平台级 | `<repo>/skills/tool-craft/` | `tool-craft` | 英文 | 全部 |
| 世界级 | `templates/holmes-world/skills/holmes-world-style/` | `holmes-world-style` | 英文 | holmes-world |
| 世界级 | `templates/holmes-world/skills/holmes-world-plot/` | `holmes-world-plot` | 英文 | holmes-world |
| 世界级 | `templates/firstsnow/skills/firstsnow-style/` | `firstsnow-style` | 日文 | firstsnow |
| 世界级 | `templates/firstsnow/skills/firstsnow-plot/` | `firstsnow-plot` | 日文 | firstsnow |

> **本批范围 = `holmes-world` 与 `firstsnow` 两个世界**（当前两条可玩竖切，`doc-24` 开头）。其余四个世界（`whitechapel` / `cthulhu` / `magic-academy` / `school-romance`）本批**不建 `skills/` 目录**——`whitechapel` 虽与 `holmes-world` 同语种，其文风与剧情仍需各自的作者判断，**后补**（§⑩-1）。**因此 §⑧ 的 A3/A4/A12 对未建目录的世界写成条件断言，不假设它们存在**（评审 B2 的裁决 ②）。

- `<world>/skills/` 与 `world/` 同级（`AGENTS.md:80`、`skills/README.md:10`）。
- 现有 `templates/holmes-world/skills/README.md` 的语义（"世界级放文风与剧情，通用手艺不放这里"）**保留**，真正的 skill 目录加在它旁边（`00 §4.3`）。
- 平台级目录名与 `name` 一律 **ASCII 小写 kebab-case**（`AGENTS.md:38`）；世界级目录名与 `name` **同样用英文 kebab-case**（`00 §4.3` 裁决 2026-09-12）——**世界语言只影响 `SKILL.md` 的内容（`description` 与正文），不影响目录名与 `name`**（`name` 是程序标识符，必须 ASCII；`description` 是喂给模型的触发文本，属世界内容）。世界级前缀取**世界目录名**（罗马字），不取 `world.json.id`：`holmes-world-style`，不是 `holmes-beckstreet-style`（`00 §4.3`；理由见 §⑨ C3）。

### 2.2 pi-rp 的加载与可见性契约（决定性事实）

| 事实 | 证据 | 后果 |
|---|---|---|
| 两级目录由 `skillArgs` 各自 `--skill <dir>` 传入；目录不存在就不传 | `apps/server/src/engine/presets.ts:110-116` | 无 skill 的世界零成本；**新增 skill 目录不需要改任何代码** |
| 作家进程带 `--skill` | `apps/server/src/engine/launch.ts:117` | 作家能看到两级 |
| **角色进程当前不带 `--skill`** | `apps/server/src/engine/launch.ts:136-137` 注释 "Characters get no `--skill`" | 角色的 skill 可见性归 `05-装配与验证.md`；本文只定"角色该拿到哪些"（§3.5） |
| `--skill <dir>` 的**根级 `.md` 文件也会被当作 skill 解析**（`includeRootFiles=true`）；含 `SKILL.md` 的目录则不再递归 | `vendor/pi-rp/.../core/skills.ts:262`（根级 `.md` 入选条件）、`:277-307`（`loadSkillFromFile`）、`:304-306`（缺 `description` → `skill: null`） | **`skills/README.md` 与 `templates/holmes-world/skills/README.md` 现在不会变成 skill**（无 frontmatter → 无 `description` → 静默跳过）。**陷阱**：哪天给这两个 README 加上 `description:`，它们会立刻变成一个名字叫 `README` 的 skill 出现在作家的 `<available_skills>` 里——登记进 §⑦ |
| system prompt 里常驻的**只有** `name` + `description` + `location` | `vendor/pi-rp/.../core/skills.ts:335-361` `formatSkillsForPrompt()` 输出 `<available_skills>` XML | **`description` 是唯一的触发器**；正文不进上下文 |
| `skills` slot 在 `read` 工具缺席时渲染为空串 | `vendor/pi-rp/.../prompt-preset/slot-renderers.ts:198-201`（`requireReadTool`） | 若哪天 preset 收窄 `selectedTools` 且不含 `read`，skill 清单**静默消失**——登记进 §⑦ |
| `name` 缺失/超 64 / 非法字符 → warning 仍加载；**`description` 缺失 → 不加载** | `docs/skills.md:141-149,176-188`；`core/skills.ts:95-123,304-305` | 没有 `description` 的 skill 是死文件 |

### 2.3 冻结的 SKILL.md 形状

```yaml
---
name: component-narration          # 必填；^[a-z0-9]+(-[a-z0-9]+)*$，≤64
description: ...                   # 必填；≤1024；决定 agent 何时读
---
```

`license` / `compatibility` / `metadata` / `allowed-tools` / `disable-model-invocation` 均可选（`docs/skills.md:141-149`）；**本批一律不写**——用不到就不要加字段（未知字段反正被忽略，`docs/skills.md:184`）。

---

### 2.4 `description` 写法（决定 agent 何时读）

`description` 是**唯一常驻**的一行（§2.2"system prompt 里只有 name + description + location"）。它写的是**触发条件**，不是内容摘要。

| | 写法 |
|---|---|
| ✅ 好 | `description: Use when choosing what carries a piece of the scene — when plain chalk is enough, when the thing must be a note the player can pick up, when it must be a sealed letter that opens into a second layer, and when to look up a component kind's schema with get_component first.` |
| ❌ 坏 | `description: Helps with components.`（`docs/skills.md:172-174` 的 Poor 例是 `Helps with PDFs.`，此处同构照搬；`00 §3.3` 亦点名不写"帮助处理组件"） |
| ❌ 坏 | `description: 组件叙事相关的手艺与技巧。`——没有"什么时候"，agent 无法判断该不该读 |
| ⚠️ 半坏 | `description: Covers components, letters, notes, and chalk.`——列了名词但没给"什么时候轮到它"，等于让 agent 自己猜 |

三条可操作的写作规则（对应 §⑧ A6/A7）：

1. **以触发词开头**：`Use when…` / `<世界名>の文章を書く前に読む`。doc-23 §2.3 的判据精神——给可当场自问自答的条件，不给形容词。
2. **点名具体工具与具体组件 kind**："a note the player can pick up" / `move_to` / `show` / `roll_dice`。泛化词（"helps with" / "related to"）是坏味道。
3. **世界级要写"第二次触发"**：`…and again whenever a turn comes out sounding wrong`。理由：文风 skill 的价值常在**写歪之后**被想起（§⑩-4 待定它是否该推广到平台级）。
4. **`description` 里出现裸的冒号+空格（`: `）时，整条必须用双引号包起来**——否则 YAML 会把它读成嵌套映射并抛 `Nested mappings are not allowed in compact mappings`（评审 B6 实测复现，见下）。

**长度**：≤1024 字符（硬限），但实际应控制在**一到三句**——它每轮都在 context 里，是 token 成本最低、收益最高的一段，也是最不该啰嗦的一段。

#### 2.4.1 裸标量陷阱（B6，实测）

`holmes-world-style` 的初稿写的是裸标量 `description: … Holds the world's register: the fog-damp…`，**pi-rp 的真解析器直接 reject**：

```
THROW holmes-world-style: Nested mappings are not allowed in compact mappings at line 2, column 14
```

**为什么比报错更糟**：`core/skills.ts:318-323` 把解析异常 catch 成一条 warning，返回 `skill: null`——**这份 skill 静默消失**（不在 `<available_skills>`、不报错），于是 §⑧ A9 的断言永远不会成立，而 agent 只是"少了一份文风指导"却看不出原因。

**修法（二选一）**：① 把 `: ` 换成别的东西（如破折号或句号）；② 整条 `description` 用**双引号**包起来（本文的 `holmes-world-style` 已改用 ②）。**注意**：引号内不能出现未转义的 `"`。

**落盘前必须实跑**（核验命令，§⑧ A13）：

```bash
# 从仓库根跑；每个路径都会打印 OK <path> string，否则抛错/打印非 string
node --input-type=module -e '
import { readFileSync } from "node:fs";
import { parseFrontmatter } from "./vendor/pi-rp/packages/coding-agent/dist/utils/frontmatter.js";
for (const f of process.argv.slice(1)) {
  const fm = parseFrontmatter(readFileSync(f, "utf8")).frontmatter;
  if (typeof fm.description !== "string") throw new Error(`${f}: description is ${Array.isArray(fm.description) ? "array" : typeof fm.description}`);
  console.log("OK", f, "string", fm.description.length);
}' <每份 SKILL.md 路径…>
```

四份本文给出的 `description` 已用该解析器实跑：`component-narration` OK、`tool-craft` OK、`firstsnow-style` OK、`holmes-world-style` 修后 OK（见 §⑧ A13）。

### 2.5 渐进披露（长料放 `references/`）

```
component-narration/
├── SKILL.md              # 判据 + 常见错误；≤120 行（§⑧ A5）
└── references/
    ├── component-kinds.md   # 18 个落盘 kind 的索引快照 + secondLayer 七形态
    └── worked-examples.md   # 一个 letter / 一个 lock 的完整落盘样例
```

- **正文只放判据**：`SKILL.md` 回答"怎么选"，`references/` 回答"这个 kind 的字段叫什么"。
- **引用方式是相对路径**：`read references/component-kinds.md` —— pi-rp 要求相对 skill 目录解析（`docs/skills.md:131-135`、`core/skills.ts:345`），写绝对路径在别的机器上会断。
- **不要把 REFERENCES 写成第二份 SKILL.md**：`references/` 里的东西是"读到了才有用"的长表，不是每轮都该在的规则。判据同 doc-23 §2.8：常驻薄、细则胖。
- **平台级的 `references/` 可以没有**（`tool-craft` 的 `chalk-styles.md` 是可选的，因为风格表本身只有 5 行，塞正文也小）；**世界级建议有**（世界文风常有 20+ 条正反例）。

## ③ 正文（§3.1/3.2/3.3 逐字可用；§3.4 是待产骨架，由世界作者补写）

> **本节 = 2 份平台级 skill 的逐字正文 + 2 份世界级"文风"的逐字正文（骨架 + 两种语言的完整实例）**；世界级"剧情"（§3.4）本批只给**结构与两例 `description`**，其正文需各自的作者判断（写"这个世界在讲什么、什么还不能早说"是内容创作，不是设计文档能代劳的），**落地时按骨架补写**——评审 M4 登记的口径问题在此收敛：§3.1/3.2/3.3 逐字可用，§3.4 是待产骨架。
> 平台级两份 = 英文；世界级两份 = 英文（holmes-world）与日文（firstsnow）。

### 3.1 平台级 `component-narration/SKILL.md`

````markdown
---
name: component-narration
description: Use when choosing what carries a piece of the scene — when plain chalk is enough, when the thing must be a note the player can pick up, when it must be a sealed letter that opens into a second layer, and when to look up a component kind's schema with get_component first. Covers the click and the second layer.
---

# Narrating with components

A component is not a different kind of story. It is another voice of the narration: the player
reads a note the way they read a passage of chalk, except a note is a *thing* that can be picked
up, and a letter is a thing whose inside only exists once it is opened. Choose the carrier by what
the player must be able to *do* with the text, not by how important the text feels.

## The four carriers

**chalk — the default.** Anything the player only has to read: a scene's first look, a beat of
prose, the outcome of an action. If the passage is not a thing and hides nothing, it is chalk.

**note — a thing with a surface.** Keys, tickets, scraps, object cards. Use it when the player must
be able to carry it, hand it over, or use it on something. A note has no second layer: everything
the player will ever read sits on the card face.

**letter — a sealed thing.** Use it when there is a *surface* and an *inside*: the card face shows a
title and a one-line preview, and opening it reveals the full body and a signature. If the reveal is
the point of the beat, the reveal needs the second layer.

**a behaviour kind — a mechanism.** One of the sixteen gameplay kinds: `lock`, `container`, `trap`,
`mechanism`, `map`, `clock`, `tape`, `anchor`, `instrument`, `board`, `book`, `ledger`, `photo`,
`cipher`, `diary`, `thread`. These carry gameplay: they react, they hold things, they open when used.
**Call `get_component` with the kind before you write one** — it returns the exact frontmatter fields
for that kind and a minimal example.

## Criteria (ask these in order)

1. Must the player keep it, give it, or apply it to something? → **note** (or the behaviour kind
   that owns the reaction). If no, continue.
2. Is there something hidden behind the surface that the player should open? → **letter**.
   Everything else, continue.
3. Does it react on its own — a lock that opens, a container that holds, a board that has a state?
   → **`get_component` first**, then write the kind it names.
4. Otherwise → **chalk**.

## What each mistake looks like

- **A key written as chalk** → the player can never pick it up; every later "use the key" line is a
  dead end they cannot act on.
- **A sealed letter written as a note** → the whole text lands on the card face, there is nothing to
  open, and the click the scene was built around does nothing.
- **A component kind written from memory** → an unregistered kind falls back to a plain note, so the
  card renders bare with none of the planned sizes or interactions and the mechanic never exists.
  `get_component` costs one call and removes this class of failure entirely.
- **Everything written as a letter** → the world turns into a mailbox; the player spends the scene
  opening things instead of living in it.

## The second layer

The second layer is a modal the player opens by clicking the card. For a letter, the layer is the
four-part form: **title** (card face) → **preview** (the card-face teaser) → **body** (the full text,
either the `body` field or the markdown body — either is legal) → **sign** (the signature line). The
card face and the inside are two different surfaces: write the teaser so it makes the player want the
inside, and put nothing in the teaser that the inside is supposed to reveal.

Interactive fields — `status`, `choice`, `roll_dice` — can ride on *any* landed entity, chalk
included. They are not part of this skill: see `tool-craft` for how and when to attach them.

For the full set of landed kinds and the second-layer forms, read `references/component-kinds.md`.
````

**`references/component-kinds.md`（渐进披露的长料，不在本批正文门内）** 内容 = `get_component` 索引模式的产物快照（一 kind 一行：kind / purpose / click / secondLayer / movable）＋ seven `secondLayer` 形态表。**不把 18 个 kind 的完整 schema 抄进 `SKILL.md`**：那是 `get_component` 的活（`docs/tools/10 §1`：注册表是唯一真相源，工具是它的只读门面）。

> **18 的出处（本次实测）**：`packages/shared/src/components/registry.ts:14-21` 的 `ALL = CORE_PACK ∪ ADVENTURE ∪ MYSTERY ∪ CHRONICLE ∪ CRAFT ∪ ROOM`。逐 pack 数：`core.ts` 2（`note`/`letter`）+ `packs/adventure.ts` 5（`lock`/`container`/`trap`/`mechanism`/`map`）+ `packs/mystery.ts` 4（`book`/`ledger`/`photo`/`cipher`）+ `packs/chronicle.ts` 3（`clock`/`tape`/`anchor`）+ `packs/craft.ts` 2（`instrument`/`board`）+ `packs/room.ts` 2（`diary`/`thread`）= **18 落盘 kind**，与 `docs/tools/10 §14.4`（"落盘组件全表（18 个）"）逐数吻合。§3.1 正文里的"sixteen gameplay kinds" = 18 减去 core 的 `note`/`letter`。`SHOWS`（`performances.ts:15`）的 7 个演出**不是 docked component**（`registry.ts:43` 强制两者不相交），不计入 18。

**逐步意图与"漏了会怎样"**（正文各段存在的理由）：

| 段 | 写它的理由 | 漏了 / 写错会怎样 |
|---|---|---|
| "组件是旁白的另一种声音" | 用户原话"组件也是旁白的一种" | 作家把组件当成"跟叙事并列的另一套系统"，于是要么不用，要么用成装饰 |
| 四载体逐条判据 | doc-23 §2.3：给判据不给形容词 | 作家按"这段重要不重要"选载体 → 信件满天飞 |
| 判据按顺序问 | doc-23 §2.6：给默认 + 例外 | "你可以 A 也可以 B"→ 随机挑，同一情形两次落不同载体 |
| 每条"用错了会怎样" | doc-23 §2.2：坑写成后果 | 只写"note 用于物件"没写"chalk 写的钥匙永远拿不起来" → 边界情形被绕过 |
| `get_component` 前置 | `extensions/toolkit/component.ts:34-36` 的 guideline；`docs/tools/10:201` 的静默降级 | 凭记忆写 schema → 未注册 kind 落回 note，机制从未存在（**最贵的失败：看起来完全成功**） |
| 第二层四段形态 | `doc-10:33-41` E2（v2 letter 实证） | 把 reveal 写进 preview → 点开是空的，点击语义死掉 |
| "互动字段不归本文" 的指路 | doc-23 §2.9：重复的规则只写一遍 | 与 `tool-craft` 各写一份，改一处漏一处 |
| 尾部指路 references | doc-23 §2.8 | 18 个 kind 的完整 schema 灌进常驻 description，或塞爆 SKILL.md 正文 |

### 3.2 平台级 `tool-craft/SKILL.md`

````markdown
---
name: tool-craft
description: Use when you want a passage to do more than state facts — a chalk style that carries a mood, a character walking across the canvas mid-scene, a one-off performance that lands a beat, an interactive choice the player can press, a dice check left to chance, or a line between two cards. Each section gives when it is right and what a wrong use costs.
---

# Craft: making the canvas perform

The resident rules tell you *that* every turn lands its narration on the canvas. This skill is about
*how* the tools can carry meaning — and each section says what happens when the use is wrong, so you
can tell a good use from a plausible-looking one.

## Chalk carries a mood

A chalk file's frontmatter can carry a rendering variant. They ride along as extra keys on the chalk
file, written in the same edit that adds the interactive fields — the `chalk` tool itself only writes
`content`.

| Want | Write on the chalk | Why this is the right one |
|---|---|---|
| A hand-written voice — a character's own note, a scrawl, a marginal line | `font: hand` | The renderer switches to the handwriting stroke; the player sees *who wrote it* before reading it |
| One phrase that must land harder than the passage around it | `big: true` (or `size: big`) | A display scale, not emphasis markup — it changes the card, not the sentence |
| A specific point size | `size: 18` | Escape hatch when `big` is too blunt |
| Ink that carries the world's colour code | `color: rust` / `blue` / `sage` (or `tone:`) | rust = the writer's echo and the player's own line, blue = note links, sage = world gates |
| Force a paper card surface (rare) | `card: true` | Most chalk should stay bare ink; a card is for the rare passage that is itself an object |

**What a wrong use costs.** A style is a property of the *file*, not of the sentence: applying
`font: hand` to narration that is not a character's writing makes the player look for an author who
is not there. And the chalk tool will not take a style as a parameter — trying to pass one is a sign
you are fighting the two-phase pipeline instead of using it.

**Do not fake age.** `collapsed` and `aged` are read from the frontmatter, but the world ages a
passage from the file's own age; writing them by hand freezes a lie into the file (a passage that is
"old" the moment it lands). If a memory should fade, let time do it.

For the full style table and worked examples, read `references/chalk-styles.md`.

## Walking a character through a scene

Use `move_to` when a character enters a scene, crosses to another, or comes to stand beside a
specific object — the character who is being talked about should be *present*, so the player can see
and click them. Pass `near` to stage them at the object they are discussing.

`move_to` moves only their presence on the canvas. It never moves files and never starts their
process.

**What a wrong use costs.** Narrating a character's entrance without `move_to` leaves them visible
nowhere: the prose says they walked in, the canvas shows an empty room, and the player cannot reach
them. Using `move` instead is worse — `move` is for object *files*, so you would be relocating their
folder while their presence stays where it was.

## One-off performances

Use `show` for a beat that should land *right now* and leave nothing behind: a stage light on a
target, the room going dark, fireworks over a spot, a storm of threads from several cards to one, a
splash of ink, a large die rolling into frame.

The seven performances, and which need a `target`:

| Performance | Lands | Needs `target` |
|---|---|---|
| `spotlight` | the canvas dims; a warm beam falls on the target | yes |
| `lights_out` | the scene darkens to night | no |
| `fireworks` | particles burst above the canvas | no |
| `evidence_burst` | threads run from each card in `links` to the target | yes |
| `camera_focus` | the camera flies to the target, canvas stays lit | yes |
| `ink_burst` | one splash of ink spreads across the target card | yes |
| `roll_ceremony` | a large die rolls into frame — **it does not show a result** | no |

**What a wrong use costs.** `show` writes nothing, creates no card, records no event. Using it to
"place a letter" or "put down a lock" produces a performance and then nothing: the card never exists,
and the player waits for something that is not there. Forgetting `target` on the four that need it
does not degrade — the call fails outright. And `roll_ceremony` is an entrance only: the number
belongs to `roll_dice`, never to the ceremony.

## Letting the player press something

Use a `choice` list on an entity when the player should be able to act on *that thing* — open the
piano lid, force the cellar door, tell Watson your theory. Use `roll_dice` on an entity when the
outcome is genuinely uncertain and should be left to chance.

Both are frontmatter on the entity, so they arrive by the same route as the chalk styles above — not
through the `chalk` tool's parameters.

**What a wrong use costs.** `choose` records that a choice was made and nothing else: it does not
change the file, remove the option, or decide what happens next. If you write the turn as if the
choice advanced the world by itself, the world never moves and the player is left on a cliff that
the engine was never going to resolve. `roll_dice` reads `type` / `desc` / `expect` from the file and
the engine produces the result — you cannot pass one in. A result written into your prose is your
invention; the engine's roll will contradict it in front of the player.

Leave a check to chance only when the story should not simply decide the outcome. If you already know
what happens, write it in the prose and do not attach dice.

## Drawing a relationship

Use `link` to make a relationship visible: a road on the map, a lead, a trail from a clue to where it
led, a line between two characters' doors. A line is canvas state, not a file — do not try to write
one in markdown.

**What a wrong use costs.** Both endpoints must be cards on the *same* layer. A cross-layer line is
never rendered, so the connection you meant to make is invisible; the player learns nothing and the
canvas looks like you forgot.
````

**逐步意图与"漏了会怎样"**：

| 段 | 写它的理由 | 漏了 / 写错会怎样 |
|---|---|---|
| 开篇"resident rules 已管什么" | doc-23 §2.8：说清不归本文管的事 | skill 与常驻层各写一遍"必须用工具落板"（doc-23 §2.9） |
| chalk 风格表 | 用户原话"用不同字体的 chalk 表达情绪" | 作家只用裸 chalk，场景永远是同一种声音 |
| 每个风格的"为什么" | doc-23 §2.1：规则跟机制理由 | 只有风格名 → 作家拿 `big` 当"重点"到处用 |
| 配色一行 | `docs/doc-04:182` 的语义分工 | rust/blue/sage 被当装饰色随机用，世界失去色彩语言 |
| 不要伪造 age | `docs/tools/02:483`（`collapsed`/`aged` 不由工具管） | 作家手写 `aged: true` 把"刚落下就陈年"的假象冻进文件 |
| `move_to` 判据 + `near` | `extensions/toolkit/move-to.ts:22-24` | 叙事里角色进门、画布上没有他；或误用 `move` 搬了文件夹 |
| `show` 七演出表 | `packages/shared/src/components/performances.ts:15-100`；`show.ts:64-67` | 用 show 放信 → 卡永不存在；漏 target → 调用直接失败 |
| `roll_ceremony` 单独点出 | `performances.ts:87-89` 注释 | 作家以为演出即掷骰，把结果当表演写 |
| choice / roll_dice 的"不做什么" | `choose.ts:26-28`、`roll-dice.ts:36-39` | 选完自动推进的幻觉；或自编骰子结果 |
| link 同层约束 | `link.ts:85-87` | 跨层线永不渲染 → 玩家什么都没学到 |
| 指路 references | doc-23 §2.8 | 风格全表塞进 SKILL.md 正文，常驻 description 被撑爆 |

### 3.3 世界级模板：文风（`<world-dir>-style/SKILL.md`）

**骨架（`‹…›` 是填空位，落盘时全删；**不要用 `[…]` 做填空位**——YAML 会把中括号读成**数组**，`skills.ts` 里 `description.trim()` 随即抛错并**静默丢弃整份 skill**，见 §2.4.1）**：

```markdown
---
name: <world-dir>-style
description: "‹什么时候读——例如「写这个世界任何一段散文之前」，再加第二次触发「调子不对时回来读」›"
---

# ‹世界名›的腔调

## 这是什么声音

‹两三句：谁在说话、对谁说、离得多远。用这个世界的语言写。›

## 三条硬判据（可当场自问自答）

1. ‹人称 / 距离的判据，例："这一句是在对玩家说话，还是在替玩家看？"›
2. ‹句长的判据，例："这句能不能再短一半？能，就切。"›
3. ‹意象来源的判据，例："这个比喻来自这个世界里存在的东西吗？"›

## 意象库

- 从这个世界的物件、天气、声音里取：‹列举›
- 不要从这个世界没有的东西里取：‹列举›

## 禁忌

- ‹文体禁忌，例："不要用解释性从句替玩家总结情绪。"›
- ‹叙事禁忌，例："不要把未发生的事写成已经发生。"›

## 正反例

> 好：‹一段 1–2 句›
> 坏：‹同一情形写坏的一段，并一句话说它坏在哪›
```

**英文实例（`templates/holmes-world`，英文世界）**：

```markdown
---
name: holmes-world-style
description: "Read before writing any prose for Fog Over Baker Street — narration, a letter, a note, or a character's line — and again whenever a turn comes out sounding wrong. Holds the world's register — the fog-damp second person, sentences that are allowed to end short, and what this world never says out loud."
---

# The voice of Fog Over Baker Street

## What this voice is

Second person, close and a little cold: the reader is Holmes's eyes, and the street is always
slightly wet. The prose notices the physical before the emotional — the fog on the glass before the
fear. Nothing is explained to the reader that Holmes would have seen for himself.

## Three hard criteria

1. Is this sentence telling the reader how to feel? Cut the instruction; keep the object.
2. Can this sentence end three words earlier? Fog hides more than it says.
3. Does this image come from a thing Holmes can touch — a lamp, a key, a damp envelope — or from
   outside the world? If it is outside, replace it.

## Imagery

- From: streetlamps, fog, wet wool, the smell of a burnt wick, carriage wheels, ink gone violet with
  age.
- Not from: anything modern, anything the reader would have to be told about.

## Never

- Never name the deduction before the evidence is on the page.
- Never let a character explain the plot to the reader.
- Never write a feeling that a physical detail could carry instead.

## In practice

> Good: The envelope was damp through; the ink had run at one corner, as if it had been read in a
> hurry and on the way somewhere else.
> Bad: Holmes felt a deep unease, because he instinctively knew this letter meant trouble.
```

**日文实例（`templates/firstsnow`，日文世界——`world.json.locale = "ja"`，`templates/firstsnow/world.json:9`）**：

```markdown
---
name: firstsnow-style
description: 初雪ラジオの文章を書く前に読む。ナレーション、chalk、手紙、ノート、キャラクターの台詞すべてに効く世界の声。調子がずれたと感じたときにもう一度読む。距離のある二人称、短い文、雪と電波の比喩、言わないことの扱い方。
---

# 初雪ラジオの声

## この声は何か

二人称、近いのに触れない。読者は深夜ラジオのディレクターで、ガラスの向こうに七海がいる。
感情を名づけず、音と温度で置き換える。言えなかったことは、言わなかったまま残す。

## 三つの判据

1. この一文は、感情を説明しているか。していたら、物に置き換える。
2. この一文は、あと五文字短くできるか。できるなら切る。
3. この比喩は、この世界にあるもの——雪、電波、リクエスト票、カセット、放送の残り時間——から
   来ているか。外から来ていたら、この世界のものに替える。

## 意象

- 使う：初雪、電波、ノイズ、チューニングのずれ、冷たいガラス、九十秒、録音の赤いランプ。
- 使わない：この世界に無いもの、説明が必要なもの。

## 禁じ手

- 結論を先に書かない。答えは、証拠のあとに。
- 登場人物に、読者へ筋書きを説明させない。
- 言えなかった告白を、地の文が代わりに言ってしまわない。

## 例

> 良い：テーブルの上で、リクエスト票の端が、少しだけ折れていた。誰かが、何度も開いた折り目だった。
> 悪い：七海は、十年前の約束をまだ覚えているのだろうかと、複雑な気持ちになった。
```

### 3.4 世界级模板：剧情（`<world-dir>-plot/SKILL.md`）—— **待产骨架**

> **本小节不是逐字正文**（§③ 开头的口径说明）：剧情写的是"这个世界真正在讲什么、哪一步现在还不能说"，那需要世界作者的知识，设计文档只能给**结构与写它的判据**。下面给骨架 + 两例 `description`（可直接落盘）+ 每节填什么的指引；`holmes-world-plot` / `firstsnow-plot` 的正文由各自世界的作者按骨架补写。
>
> **补写时的判据**（照 doc-23 §2.3/§2.7）：`## 现在悬着什么` 里每一条都要能回答"下一步玩家能查到什么"，不是"故事的答案"；`## 不能早说的` 每一条都要写"现在说了会毁掉什么"；`## 结尾的形状` 不写台词、只写形状。

**骨架**：

```markdown
---
name: <world-dir>-plot
description: "‹什么时候读——例如「决定这一场往哪去」，或「玩家问了一个关于世界的问题时」；不是每轮必读›"
---

# ‹世界名›的剧情脉络

## 一句话

‹这个世界真正在讲的那件事，一句。›

## 现在悬着什么

- ‹未解的问，及其"还差什么才能解"——不是答案，是"下一步能查到什么"。›

## 不能早说的

- ‹必须留到后面的揭示；以及为什么现在说会毁掉它。›

## 门与钥匙

- ‹通往别处的层 / 门卡 / requires.items 门槛，及它们现在开不开。›

## 结尾的形状

‹这个 Demo 会在哪里、以什么动作收束——不是具体台词，是形状。›
```

**英文实例（holmes-world）**：`name: holmes-world-plot`，`description: Read when deciding what a scene is moving toward, or when the player asks a question about the case itself. Not every turn.`；正文写 Lady Adler 失踪案的一条主线、三条可查线索、三个"现在还不能说"的事实、以及"玩家把线索摆上板的那一刻"作为收束形状。

**日文实例（firstsnow）**：`name: firstsnow-plot`，`description: この場面がどこへ向かうかを決めるとき、あるいはプレイヤーが世界そのものについて尋ねたときに読む。毎ターンではない。`；正文写"十年の約束と、今夜の約束"两条线、`world/intro/request-slip.md` 的リクエスト票作为钥匙、以及"初雪が降る前に答える"为止的形状。

> **注意（与 `00 §3.4` 的裁决一致）**：剧情类世界级 skill **只给作家（与初始化器）**，不给角色。角色的 skill 见 §3.5。

### 3.5 角色该拿到哪些 skill（对 `00 §3.4` 的落地）

`00 §3.4` 拍板：**给，但只给"工具具身"类平台 skill，不给剧情/文风。** 落地方式：

- 机制上，`--skill` 传的是**目录**（`presets.ts:112`），不是单文件；两级目录一起传就无法在目录粒度上按角色裁剪。
- 因此角色的分流**靠 `description`**：`component-narration` / `tool-craft` 的 description 写的是"怎么演"，角色会被它命中；`<world>-style` / `<world>-plot` 的 description 写的是"怎么写这个世界的散文 / 剧情往哪去"，角色读它没有意义（角色没有全知视角，`docs/hooks/00 §3.3`：角色不注入 `bag`、不报玩家相机）。
- **这是 `00 §6.3` 的"倾向：给两级，靠 description 分流"**。本文同意该倾向，理由：目录粒度裁剪需要改 `skillArgs` 签名（新增第三参数），而 `description` 分流零代码。**待评审拍板。**
- 若评审选"只给平台级"：`characterLaunch` 传 `<repo>/skills` 即可，签名不变（`launch.ts:139` 的 spec 里加一行）。两条路都不阻塞本文的其他内容。

---

## ④ 与现状差异（带 `file:line`）

| # | 现状 | 本文 |
|---|---|---|
| D1 | 全仓零个 `SKILL.md`（`find` 零命中）；`skills/` 下只有 `README.md` | 新增 **6 份** `SKILL.md`（2 平台级 + `holmes-world` 2 份 + `firstsnow` 2 份，见 §2.1 清单） |
| D2 | `skills/README.md:20` 曾用中文目录名 `组件叙事/` 举例 | 目录名与 `name` **统一 ASCII kebab-case**（`component-narration/`、`tool-craft/`）。`00 §4.3` **已裁决并改**（§⑨ C1）；`skills/README.md` 亦已由 `Main` 回写（§⑨ C1 的残留项已关闭） |
| D3 | `skills/README.md:30` 的示例 `description` 是中文，平台级 skill 是英文内容 | 平台级 `description` 英文；世界级 `description` 跟随世界语言（`00 §3.3`；`name` 仍英文，见 §2.1） |
| D4 | `templates/holmes-world/skills/README.md` 只是说明 | 保留，旁边新增 `holmes-world-style/`、`holmes-world-plot/` |
| D5 | `templates/holmes-world/skills/` 只有说明性 README（无真 skill）；`templates/firstsnow/` **完全无 `skills/` 目录** | 两世界各新增 style + plot 两份（共 4 份）；目录名英文、正文语言跟随 `world.json.locale`（`firstsnow` = `ja`，`holmes-world` = 英文）。`whitechapel` / `cthulhu` / `magic-academy` / `school-romance` **本批不动** |
| D6 | `characterLaunch` 不传 `--skill`（`launch.ts:136-137` 注释） | 归 `05-装配与验证.md` 的 `--skill` 接线；本文只定"角色该看到什么"（§3.5） |
| D7 | `tools/scaffold.mjs:61` 用 `fs.cp(srcTemplate, targetDir, {recursive:true})` 整体拷模板 | **模板自带 skill 就自然随 scaffold 分发**——不需要改 scaffold（`00 §6.4` 的答案见 §⑩-1） |
| D8 | 别处（`doc-05` 骨架、`doc-12`）提到"skill 走懒加载"但无具体清单 | 本文补全清单、命名、正文、description 写法 |

---

## ⑤ 与注入块的分工（明确不重复什么）

`docs/hooks/00` 的注入块每轮给：`viewpoint` / `layer_files` / `cast` / `bag` / `recent_chalk` / `dynamics` / `next_step`（作家 6 节 + 下一步）。skill **一句都不复述它们**：

| 注入块负责 | skill 负责 | 判据 |
|---|---|---|
| 这一层现在有**哪些**卡（路径 + 一行摘要，`hooks/00 §3.2` `layer_files`） | 要落哪一种载体（§3.1 的四载体判据） | 注入说"有什么"，skill 说"该造什么" |
| 现在是**谁在场**（`cast`） | 怎么让一个角色**进场演出**（`move_to`，§3.2） | 同上 |
| 最近**变了什么**（`dynamics` 的人话事件） | 怎么让变化**可见**（`show` / `link`） | 注入是事实，skill 是手法 |
| 末尾一句"什么还悬着"（`hooks/00 §8`） | 用什么节奏收束（choice 落点 / 最后一句收在景物或他人行动） | **两者措辞零重叠**（doc-23 §2.9） |
| 每轮的**世界状态** | 这个世界的**文风与剧情**（世界级 skill） | 状态是变量，文风是常量 |

**skill 也不复述常驻层**（`00 §3.2`）："必须用 chalk 落板"、"不要伪造引擎"、"世界无变化就不要硬写"都在 `WRITER_INSTRUCTION`（见 `01-作家提示词.md`）。`tool-craft` 只在开篇一句声明"resident rules 已管落板"，不把纪律抄第二遍。

**skill 更不复述工具 `description`**（`00 §3.1` 工具层）：工具的"何时用/何时别用"一句话版在 `extensions/toolkit/*.ts` 的 `description`（进 function schema，每轮都在，`00 §2 F4`）；skill 只加**创意用法与判据**（chalk 风格表、七演出表、move_to 的叙事时机）。这条分工因 `includePiDefaultGuidelines` 的 bug 修复而更硬：**工具级的"何时别用"必须每轮在（guideline），不能只指望 skill**（`00 §6.2` 的倾向）。


### 5.1 为什么这两块进 skill 而不是常驻层（doc-23 §2.8）

判据是 `00 §3.1` 的三问：**"我是谁 / 每轮都要守的规矩" → 常驻层；"这件事怎么做得好"（可举例、可长、偶尔才用） → 细则层。**

| | `component-narration`（组件叙事） | `tool-craft`（工具叙事） | 反证 |
|---|---|---|---|
| 是"每轮都要守"吗？ | 否——只有落新东西的那一轮才需要选载体 | 否——只有要演出时才需要风格/演出/骰子 | 若写进常驻层，每轮都付 token，而多数轮次用不上 |
| 能举长例吗？ | 能——四载体各一段判据 + 18 个 kind 的字段 | 能——5 行风格表 + 七演出表 + `references/` | 常驻层塞长例 = 每轮都读全文（doc-23 §5："常驻层不怕长，怕含糊"，但也**不该塞只有偶尔才用的长表**） |
| 会与新世界/新组件漂移吗？ | 会——注册表加 kind 就要改 | 会——演出表加一项就要改 | 常驻层因此需要一个"改了组件就同 commit 改 `instructions.ts`"的纪律；skill 只需改 skill 文件，边界更干净 |
| 是身份吗？ | 否 | 否 | 身份与硬约束在 `WRITER_INSTRUCTION`（见 `01-作家提示词.md` §③） |

**因此**：常驻层只留一句**指路**（"细则见 skill，读与你正在做的事相符的那一份"，`01-作家提示词.md` §③ 的 `[Where the rest is written down]`），两份 skill 承担全部细则。这条分工的兑现依赖 §2.4 的 `description` ——**description 写泛了，常驻层的指路句就指不到任何东西**（`01-作家提示词.md` §⑩-5 登记的跨篇依赖，§⑧ A7 给它加了机械核验）。

**所以两份 skill 的判据必须与常驻层"零重叠"**：常驻层说"落板要用工具、不要伪造引擎"，skill 只说"在能落的东西里选哪一个、怎么让它演出效果"。同一句话写两处 = doc-23 §2.9。

---

## ⑥ 工具对照 `docs/prompts/00 §5` 事实表

两份平台 skill 提到的每个工具，逐条核对：

| skill 提到 | skill 里的断言 | 代码真相 | 一致？ |
|---|---|---|---|
| `chalk` | 只写 `content`，风格与互动字段走 frontmatter extra / Phase ② 的 `edit` | `extensions/toolkit/chalk.ts:79`（"interactive fields arrive in Phase ② via `edit`"）；`packages/shared/src/actions/chalk.ts:53-56`（`extra` 透传） | ✅ |
| `chalk` 风格键 | `font: hand` / `big` / `size` / `color|tone` / `card` | `packages/shared/src/schemas/forms.ts:176-190` `chalkStyleOf` | ✅ |
| `collapsed` / `aged` | 不由作家手写；由文件年龄驱动 | `docs/tools/02:483`（"收起/风化不由工具管…工具只提供 mtime"）；键确实被 `forms.ts:187-188` 读（那是渲染侧） | ✅（见 §⑩-3 的措辞待定） |
| `get_component` | 写任何 `type: component` 前先查；不查会静默降级 | `extensions/toolkit/component.ts:34-36`；`docs/tools/10:201`（未注册 kind 落回 `note`） | ✅ |
| `move_to` | 只动 presence，不动文件、不启进程 | `extensions/toolkit/move-to.ts:22-24` | ✅ |
| `move` | 移动**物件文件**，与 `move_to` 不是一回事 | `extensions/toolkit/move-to.ts:48` guideline；`00 §5` 对照表 | ✅ |
| `show` | 七演出，不写文件不落账 | `packages/shared/src/components/performances.ts:15-100`；`extensions/toolkit/show.ts:29-32` | ✅ |
| `show` 的 `target` | spotlight / evidence_burst / camera_focus / ink_burst 必需 | `performances.ts:27,65,72,84` 的 `requiresTarget: true` | ✅ |
| `show` `roll_ceremony` | 不掷骰，只演出入场 | `performances.ts:87-89` 注释 | ✅ |
| `choose` | 只记"选了"，不改文件、不删选项、不决定后果 | `extensions/toolkit/choose.ts:26-28` | ✅ |
| `roll_dice` | 调用者不能传 `result`/`type`/`expect` | `extensions/toolkit/roll-dice.ts:36-39` | ✅ |
| `link` | 线是 canvas 状态不是文件；两端必须同层 | `extensions/toolkit/link.ts:21-27`、`:85-87` | ✅ |
| `use_item_on`（仅 references 可能带，正文未展开） | 不消耗不移动物件 | `extensions/toolkit/use-item.ts:11-14` | ✅ |

**未提及（刻意）**：`write` / `edit` 的具体用法归工具 `description`；`look_at` / `view_canvas` 归常驻层与 `description`（`01-作家提示词.md` §⑥）；`generate_image` / `delete` / `arrange` / `set_following` 本批不做 skill（§⑩-2）。

---

## ⑦ 错误与边界

| 情形 | 行为 / 后果 | 处理 |
|---|---|---|
| `description` 缺失或全空白 | **skill 不加载**（`core/skills.ts:304-306`） | 机械核验兜住（§⑧ A1） |
| `description` > 1024 字符 | warning，仍加载（`docs/skills.md:182`） | 核验兜住（§⑧ A1） |
| `name` 非法 / > 64 | warning，仍加载（`docs/skills.md:180-181`） | 核验兜住（§⑧ A1） |
| 两个 tier 出现同名 skill | warning，**保留先找到的那个**（`docs/skills.md:188`） | 命名空间刻意分开：平台级 `component-narration`/`tool-craft`，世界级 `<world-dir>-*`，前缀天然不撞 |
| `skills` slot 在 `selectedTools` 不含 `read` 时渲染空串 | 作家看不到任何 skill，`read` 也调不了（`slot-renderers.ts:198-201`） | preset 的 `tools.deny` 不删 `read`（`00 §4.2` 的 deny 名单只有中文记忆/state 工具），当前不触发；**新收窄 `selectedTools` 时必须复查** |
| 世界级 skill 语言与 `world.json.locale` 不一致 | 不报错，只是文风指导读起来错位 | 核验（§⑧ A3/A4）：`firstsnow`（`locale: ja`）的 style skill 必含 CJK；`holmes-world`（无 `locale`）的必不含。**条件断言**——只查存在 `skills/` 目录的世界 |
| `SKILL.md` 里引用 `references/` 相对路径 | pi-rp 要求相对 skill 目录解析（`docs/skills.md:131-135`、`core/skills.ts:345`） | 写作纪律：只写 `references/xxx.md`，不写绝对路径 |
| 目录不存在 | `skillArgs` 不传该 `--skill`（`presets.ts:113`） | 零成本；不存在不报错也不提示 |
| 长料塞进 `SKILL.md` 正文 | 每次读它都付全价，违背渐进披露 | 核验：正文行数上限（§⑧ A5） |
| **`skills/` 根级的 `.md` 被当 skill 加载** | 根级 `.md` 也算候选（`includeRootFiles=true`，`core/skills.ts:262`）；无 `description` 静默跳过（`:304-306`），**有 `description` 就会变成一个名为 `README` 的 skill** | 保留 `skills/README.md` 的说明用途，**不给它加 frontmatter `description`**；核验（§⑧ A12）断言 `<available_skills>` 里没有 `README` |

**边界（本批不做）**：不给 skill 加 `allowed-tools` / `disable-model-invocation`；不写 `scripts/`（无需要执行的脚本）；不建 skill 之间的依赖图。

### 7.1 明确不做什么

| 不做 | 为什么 |
|---|---|
| **不建 skill 注册表 / manifest / 索引文件** | pi-rp 的发现是**扫目录**（`core/skills.ts:431-435`；`--skill <dir>` 递归找 `SKILL.md`，`docs/skills.md:37-38`）。加一份手写索引 = 第二个真相源，删一个 skill 忘了改索引就永久失联（doc-05 §8.5 的同一精神） |
| **不建"作家可见 / 角色不可见"的 skill 权限字段** | pi-rp 没有这个字段（`docs/skills.md:141-149` 的全部 frontmatter）；`00 §3.4` 的分流靠 `description`（§3.5）。造一个隐藏字段要求引擎在多处保持正确——正是 `skills/README.md:38` 拒绝的那条路 |
| **不把 skill 正文塞进 system prompt** | 那会炸 prompt 缓存（`docs/hooks/00 §2` 第 3 条同款理由），且推翻渐进披露（`docs/skills.md:71`） |
| **不做 skill 的 A/B 或自动生成** | 同 doc-23 §5："赛时规模不需要，凭具体失败案例改就够" |
| **不写 `scripts/`** | 无需要执行的脚本；skill 全是给模型读的判据 |
| **不给每个工具都建一个 skill** | 工具的"何时用/何时别用"归 `description`（每轮在，`00 §2 F4`）；只有"创意用法 + 判据"才配得上一个 skill（§⑩-2 的待定里逐个说明） |
| **不在世界级 skill 里写平台手艺** | 那会让同一个世界换 tier 就丢手艺；`templates/holmes-world/skills/README.md:5` 已明写"通用手艺不放这里" |
| **不在平台级 skill 里写文风/剧情** | 全世界共享的内容写一次，写在世界级就要在 N 个世界里各维护一遍（doc-23 §3.1 的"跨 N 个模板必然漏改"） |

---

## ⑧ 验收断言（可机械核验）

> **落点 = 新增 `tools/check-skills.mjs`**（纯文件断言，无引擎），承担 A1–A8、A10–A12（**全部是纯文件检查，不需要 spawn**）。**A9 例外**：它是端到端断言，落点不在本文件，而应并入 `00 §8` 第 3 条的 `tools/probe-prompt.mjs`（那里已真 spawn 作家并 dump `messages[0]`，加一行 `assert(text.includes('<available_skills>') && text.includes('component-narration'))` 即可）。
>
> **交接（评审 M3/M5）**：`00 §8` 目前只列三条门（`probe-tools.mjs` / `preset-slots.test.mjs` / `probe-prompt.mjs`），**没有 `check-skills.mjs`**。本文登记为 **第四条门**，归属建议：与 `00 §8` 其余三条同批、同 `package.json` 脚本（`check:skills`）+ 同 commit 落地；**若评审判定本批不做第四条门，则 A1–A12 降级为"实现阶段的 checklist"，不得声称已有机械核验**（诚实性要求）。

| # | 断言 | 核验方式 |
|---|---|---|
| **A1** | 每个 `**/SKILL.md` 有合法 frontmatter：`name` 命中 `^[a-z0-9]+(-[a-z0-9]+)*$` 且 ≤64；`description` 非空且 ≤1024 | 解析 YAML 头，正则 + 长度 |
| **A2** | 平台级两份 `SKILL.md` 的 **`description` 与正文**均无 CJK（`!/[\u4e00-\u9fff\u3040-\u30ff]/`） | `AGENTS.md` §1.1（平台口径英文） |
| **A3** | `templates/firstsnow/skills/*/SKILL.md` 的 **`description` 与正文**均含 CJK（`/[\u3040-\u30ff]/` 命中）；`name` **不含** CJK | 世界级跟随世界语言、`name` 恒 ASCII（`00 §3.3`、`00 §4.3`）；证明语言分层真的落地。**条件断言**：目录存在时才检查（本批它一定存在，见 §2.1） |
| **A4** | **条件断言**：对每个存在 `skills/` 目录的世界，其 `SKILL.md` 正文语言与该世界 `world.json.locale` 一致——`locale: "ja"`（`firstsnow`）→ 正文含 CJK；`locale: "en"`/缺省（`holmes-world`，及将来补上的 `whitechapel`）→ 正文无 CJK | 条件式而非固定清单：本批只建 `holmes-world`/`firstsnow` 的目录（§2.1），断言不得假设 `whitechapel` 目录存在（评审 B2） |
| **A5** | 每份 `SKILL.md` 正文 ≤ 120 行；长表只在 `references/*.md` | 渐进披露纪律（`00 §3.3`） |
| **A6** | `description` **不含**泛化词：`/helps? with\|关于.*的帮助\|misc/i` | `docs/skills.md:162-174` 的 good/bad |
| **A7** | 平台级两份 `description` **点名**至少两个具体触发物（`note` / `letter` / `chalk` / `move_to` / `show` / `choice` / `roll_dice` / `link` 至少命中 2） | 决定 agent 何时读；兑现 `01-作家提示词.md` §⑩-5 的跨篇假设 |
| **A8** | 任何 `SKILL.md` 不含非法工具名：`!/get_state\|set_state\|state_update\|watch_state/` | `00 §5`、`00 §7.3` |
| **A9** | 作家真 spawn 后 `messages[0]` 的 `<available_skills>` 同时含平台级与（若世界有）世界级 skill 的 `name` | 复用 `00 §8` 第 3 条要新建的 `tools/probe-prompt.mjs`（`00 §2` 的 dump provider 手法：真 spawn `vendor/pi-rp/.../dist/cli.js` + 落盘 wire payload）；世界的 skill 目录经 `--skill`（`presets.ts:112`） |
| **A10** | 名字全局唯一（平台级 ∪ 世界级，跨全部 `templates/*`） | 排序后 `uniq -d` 为空 |
| **A11** | 每份 `SKILL.md` 的 `SKILL.md` 所在目录名 **逐字等于** frontmatter 的 `name` | 目录名与 `name` 一致（`00 §4.3` 的命名裁决）；pi-rp 本身不强制（`docs/skills.md:143` 明确允许不同），故这正是**我们自己的**约定，必须由测试守住 |
| **A12** | `skills/` 与其世界级对应目录的**根级 `.md`**（`README.md`）**不出现在** skill 清单中 | 目录级 `SKILL.md` 之外的根级 md 也会被解析（`core/skills.ts:262,277-307`）。**两种核验都可**：纯文件版 = 断言 `skills/*.md` 无 frontmatter `description`（README 保持无 frontmatter 即天然不入选）；端到端版 = 并入 A9 的探针，断言 `<available_skills>` 里没有 `name` = `README` 的条目。**倾向后者**（与 A9 同一处 spawn，零额外成本） |
| **A13** | 每份 `SKILL.md` 能用 **pi-rp 的真解析器** `parseFrontmatter`（`vendor/pi-rp/packages/coding-agent/dist/utils/frontmatter.js`）解析且 `description` 是 **string**（不是 array、不抛错） | 评审 B6：裸 `: ` 会抛 `Nested mappings…`、`[…]` 会变成 array → 两者都在 `skills.ts:304-306/318-323` 被静默丢成 `skill: null`。**A1 的正则/长度检查看不出来，只有真解析器能拦**。实现：`assert(typeof parseFrontmatter(readFileSync(f)).frontmatter.description === 'string')` |

**A3/A4 是"语言分层没有这个设计就会失败"的反向断言**（若世界级 skill 误用英文或平台级误用中文，测试当场红）。**A9 是"目录确实被 `--skill` 接到"的端到端证明。**

---

## ⑨ 发现的冲突 / 需修订的上位文档

| # | 冲突 | 涉及 | 建议 |
|---|---|---|---|
| **C1** | `skills/README.md` 曾用中文目录名 `组件叙事/` 举例，同文 `:29` 的 `name` 却是 ASCII；`00 §4.3` 的初稿也沿用了该中文示例 | `skills/README.md`（初稿）、`00 §4.3`（初稿） vs `AGENTS.md:38`（"命名一律 ASCII 小写 kebab-case"） | **✅ 已关闭**：`Main` 已裁决（目录名一律 ASCII kebab-case，平台级与世界级都是英文，世界语言只影响正文与 `description`），并**亲自回写了 `skills/README.md`**（现 `:20` 为 `component-narration/`、补了目录名/name 一律英文的引注）与 `00 §4.3:169-180` |
| **C2** | `skills/README.md` 的目录树写了 `references/`，但规则未成文；本文 §⑧ A5 把"长料在 references"变成硬约束 | `skills/README.md` vs 本文 | **✅ 已关闭**：`Main` 已在 `skills/README.md` 补上"**正文只放判据，长表放 `references/`**（渐进披露）"及相对路径引用约定，与本文 §2.5 措辞一致 |
| **C3** | `00 §4.3` 的 `<world>-style` / `<world>-plot` 未定 `<world>` 用目录名还是 `world.json.id` | `00 §4.3` vs `templates/holmes-world/world.json:2`（`id = "holmes-beckstreet"`）、`templates/firstsnow/world.json:2`（`id = "firstsnow-radio"`）——目录名与 id **普遍不同**（6 个模板实测） | **✅ 已裁决（`Main`，2026-09-12）：取目录名。** 理由：`AGENTS.md:38`「目录名即 id」，且 `characters[].home`、`options.baseDir` 都随目录名走。`00 §4.3:182-184` 已写死。本文全篇按 `holmes-world-style` / `firstsnow-style` 写，与裁决一致 |
| **C4** | `docs/tools/02:483` 说 `collapsed`/`aged` 不由工具管、由前端按年龄渲染；但 `forms.ts:187-188` 确实读 frontmatter 里的这两个键 | `docs/tools/02:483` vs `packages/shared/src/schemas/forms.ts:187-188` | 两者不冲突（读侧宽、写侧窄），但**文档没写清"作家写了也不算错、只是不该写"**。建议在 `docs/tools/02:483` 补一句"键被渲染器接受，但设计意图是年龄驱动；提示词不得教作家手写"。本文 §3.2 已按"不要手写"的措辞写，§⑩-3 记录了是否要在动作层报错的待定 |
| **C5** | `00 §2 F2` 说作家 `messages[0]` 另加 skills 清单（有 skill 时），而 `presets/writer.json:21-25` 已有 `skills` slot；但**全仓没有 skill 文件**，所以该 slot 现在渲染空串 | `00 §2 F2` vs 现状 | **无需修订**（`Main` 复核）：F2/F7 描述的是**接线前**的实测事实，"另加 skills 清单（有 skill 时）"括注已含条件。本文 skill 落盘后该分支自动成立（§⑧ A9 是它的端到端证明） |
| **C6** | **本文自身的 bug（评审 B6，已修）**：`holmes-world-style` 的 `description` 原为裸标量且含 `register: `，pi-rp 真解析器抛 `Nested mappings are not allowed in compact mappings`；`skills.ts` 把该异常 catch 成 warning + `skill: null` → **整份 skill 静默消失** | 本文 §3.3（已改）+ `core/skills.ts:318-323` | **✅ 已修**：改为双引号包裹（§3.3）。**同时发现并修掉一个同类坑**：骨架模板原用 `description: [填空位]`，YAML 读成 **array** → `description.trim()` 抛错 → 同样静默丢弃；已把全部填空位改为 `‹…›` 并加护栏（§2.4.1）。**六份 frontmatter 已用 `vendor/pi-rp/.../dist/utils/frontmatter.js` 的 `parseFrontmatter` 实跑，全部 OK**；新增 §⑧ **A13** 把"真解析器 + `description` 是 string"钉进验收门（A1 的正则/长度检查拦不住这两类） |

---

## ⑩ 仍未知待拍板

1. **世界级 skill 是否随 scaffold 生成？**（`00 §6.4` 的问题）
   - 现状：`tools/scaffold.mjs:61` 整体 `fs.cp` 模板目录，`skills/` 若在模板里就自然带过去。
   - 但**"模板自带"只在模板作者写了文风 skill 时成立**；玩家从零建世界时不会自动得到一份文风骨架。
   - **倾向**：本批只做"模板自带"（`holmes-world` / `firstsnow` 各带两份；其余世界后补），不做 scaffold 生成——生成需要先知道世界语言与文风，而那正是玩家的输入，不是脚手架能猜的。**留评审。**
2. **要不要给 `generate_image` / `delete` / `arrange` 也建 skill？**
   - 本批只做 2 个平台级（`00 §6.3` 暂定）。
   - **倾向**：不做。它们的用法是"何时用"而非"创意用法"，归 `description` 足够；`generate_image` 的"风格词怎么写"若试玩出现大量丑图，再单独立项。
3. **`chalk` 风格的"不要伪造 age"是否该更硬？**
   - 本文写成"不要手写 `aged`"，但 `forms.ts:187-188` 确实接受该键，工程上不报错。
   - **待定**：是否在 `chalk`/`edit` 的动作层对 `aged`/`collapsed` 报错（把它们变成纯渲染派生字段）。**倾向**：先靠提示词纪律，不动动作层（`docs/tools/02:483` 的划界是"不由工具管"，不是"禁止写"）。见 §⑨ C4。
4. **skill 的 `description` 要不要写"第二次触发"？**
   - 世界级 style 的 description 本文写了"调子不对时回来读"——这是给"第一次没读、写歪了"留的回程。
   - **待定**：平台级两份是否也该加同款回程句。**倾向**：不加——平台级手艺是"动手前查"，不是"写完再修"。
5. **`component-narration` 与 `tool-craft` 的边界是否会漂移？**
   - 互动字段（`choice`/`roll_dice`/`status`）写在 `tool-craft`，但它们是**组件与 chalk 共用的 frontmatter**，天然与 `component-narration` 相关。
   - **待定**：试玩后若作家总在"选载体"时忘了 attach 互动字段，考虑把"互动字段清单"提到 `component-narration` 的判据里，或在两份各留一句指路（当前是单向指路：`component-narration` → `tool-craft`）。
6. ~~**世界级 skill 的 `name` 前缀长度。**~~ **✅ 已裁决（`Main`，2026-09-12）：统一用世界目录名**，即 `holmes-world-style` 这类略啰嗦的形式也照用（`00 §4.3:182-184`）。理由：与 `AGENTS.md:38`「目录名即 id」一致，且切换 `world.json.id` 会引入一个与世界目录名不同的、需要额外查表的前缀。**此项关闭。**

