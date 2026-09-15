# review-B — 语义兑现、需求强度与诚实性（N2「nook 子场景」）

> 评审三棱镜之三：`design-first-feature-workflow` §7 第 3 项（**需求强度 / 语义兑现**）与第 6 项（**诚实性**）。
> 只读评审。2026-09-15。**每条裁定带 `file:line` 或可复现命令与实测输出**；无法实测的标 `[推断]`。
> 基准：`docs/nook-scene/00-共同上下文.md`（下称「契约」）。**契约可能错，本报告以证据为准。**

---

## 0. 结论

**有条件通过。**

判据：

- **设计方向正确**（子场景通路存在、不递归三处成立、「有卡无 README 的目录不该被打成 UNWRITTEN」这条修复方向对）；这部分我**独立复算后同意**（见 §3、§4）。
- 但有 **3 条必须在实现前修掉的 blocker**（全是**文档层**的修，不是重设计）：
  1. **契约/06 的核心夹具事实已失效**（`writing/` 在指定夹具里已不存在，实际是 `meta/`）⇒ 验收 A8/A11 在指定夹具上无法产生断言的期望，且一颗未登记的新门牌会静默产生。
  2. **契约 §4.3 的「真正空目录」括注与它自己已裁决的「不加 `hasDeeper`」互斥** —— 「结论对而理由错」，读者会照括注做下一个决定。
  3. **`stub` 门牌的 `UNWRITTEN · walk in, and it will be written →` 文案承诺「走进去就会写」，而契约 §6 结构性不实现子场景 stub 初始化** ⇒ 每张 stub 门牌都在说谎。
- 另有 1 条 major（**进门后作者写的正文不可见**：4 / 4 个有 README 的作者子场景进门即空白画布）与 2 条 minor（`04` 单参调用残留；`05` 把「等价」写成已定而 `06` 登记为不同源）。

---

## 1. 需求证据兑现：逐个 fixtake 走一遍

**⚠️ 前提修正（实测）**：任务书说「`templates/exp/characters/elias/` 下真的存在 5 个作者手写的子场景」。**当前工作树上不是 5 个**：

```text
$ find templates/exp/characters/elias -maxdepth 1 -type d | sort
.../elias  .../elias/.pi  .../elias/balcony  .../elias/living-room
.../elias/meta            ← 契约从未提及
.../elias/office  .../elias/parallel-timeline
（writing/ 不存在）
$ find templates/exp/characters/elias/meta -type f
templates/exp/characters/elias/meta/agent_selfframework.md   （唯一文件，mtime 02:47）
$ git status --short templates/exp/characters/elias/
 D .../writing/agent_selfframework.md
 D .../writing/clarify.md
 D .../writing/prd_portrait_engine.md
?? .../meta/
 M .../README.md
 M .../preset.json
```

⇒ 作者把 `writing/` 的 3 个 md **搬走了**（`agent_selfframework.md` 进新目录 `meta/`，另两个从工作树消失），并换掉了根 `README.md` 的正文。**契约 §1（`00:31-38`）与 `06 §2.2`（`06:40-53`）记的是搬迁前的树**，两处都自称「实测」。

| fixtake | 现状（实测） | N2 后**父场景**表现 | N2 后**进门**表现 | 判定 |
|---|---|---|---|---|
| `unspoken.md` | 根的直接子级卡 | 一张 note 卡 | — | ✅ 不变 |
| `balcony/` | `README.md`（`name: 阳台 · 下班后`，正文 2 段） | 门牌（真实 frontmatter + 真实 body，`kind=gate`） | 200、`scene`=该 README、`items: []` ⇒ **画布空白** | ⚠️ 门牌对，进门后作者正文不可见（§4） |
| `living-room/` | `README.md`（`name: 客厅 · 十点以后`） | 同上 | 同上 | ⚠️ 同上 |
| `office/` | `README.md`（`name: 办公室 · 工作日`，**完整正文**） | 同上 | 同上 | ⚠️ 同上 |
| `parallel-timeline/` | `README.md`（`name: 平行时间线 · 2024年7月`） | 同上 | 同上 | ⚠️ 同上 |
| `writing/` | **已不存在** | — | — | ❌ 契约/06 的核心 fixture 失效（§5） |
| `meta/` | `agent_selfframework.md`（无 README，1 个 md） | **会多出一张名为 `meta` 的门牌**（`stub=false`） | 200、`scene:null`、1 张卡 | ❌ 未登记（契约只登记了 `chat-history/`） |
| `chat-history/` | 只在 gitignored 的 `worlds/*` | 门牌（`stub=true`） | 见 P6 | ⚠️ 已登记待拍板 |

实测复核（真 `dist` 函数 + 真 fixture）：

```text
$ node -e '…nookCardPaths / cardsOfLayer against templates/exp/characters/elias…'
root cards: ["characters/elias/unspoken.md"]
balcony  cards= []  has README= true
living-room cards= []  has README= true
office   cards= []  has README= true
parallel-timeline cards= []  has README= true
writing  → 目录不存在（ENOENT）
```

**⇒「全部可见」只成立于「可见为门牌」；而「可用」只对有卡无 README 的 `writing/` 型成立，可 `writing/` 本身在指定夹具里没了。** 4 间有 README 的房间进门后**看不见任何东西**（§4）。

---

## 2. `stub` 语义的独立判定（含「是否同意主 agent 裁决」）

### 2.1 我同意的部分

**`stub` 作为 flag 的口径 —— `stub = (无 README) && (无直接卡)`，我同意。** 证据补强：

- 层口径是「无 README ⇒ `stub:true` + body `'This scene has not been written yet.'`」（`routes/world.ts:828-838`，仅以 `readFile` 成功与否判）。照抄到 nook 会让 `writing/` 型目录（有卡无 README）被打成 `UNWRITTEN` —— **对一间有内容的房间说谎**。修复方向正确。
- 主 agent 否决 `02` 初稿的 `hasDeeper` 收窄条件，**方向我同意**：`stub` 描述的是「这间屋子自己的门面」，不是「它下面有多深」。
- 消费者确实存在，不是死字段：`CardRenderer.tsx:143` `const isStub = frontmatter?.stub || false;` ⇒ `:159-160` 的 meta 文案。

### 2.2 我不同意／必须补的两点（本报告核心产出）

**(a) 契约把 `stub` 解释成「真正空目录」，与它批准的「不加 `hasDeeper`」互斥。**

契约原文（`00:257`）：

> `stub = true` **当且仅当**该子目录**既无 README 又无任何卡**（**真正空目录**）。

而 `02:226` / `06:119` 明确裁决「**不加** `hasDeeper`」，即 `characters/elias/a/` 只有 `b/c.md`、自身无 README 无卡时 **`stub === true`** —— 这个目录**不是**「真正空目录」：走进去看得见门牌 `b`。⇒ 括注「（真正空目录）」**为假**。

这正是 `design-first-feature-workflow` 警告的**「结论对而理由错」**：结论（`stub` 按字面）可能对，但**理由**（「真正空目录」）是错的，而下一个读者会照这个理由做决定（例如据此把 `stub=true` 的目录当作「可以安全重建/初始化」的空房）。**MUST 删掉或改写该括注**，写成「该目录自身无门面」。

**(b) 更要命的是文案：`stub=true` 的门牌会打出「走进去就会写出来」，而本批结构性做不到。**

```text
CardRenderer.tsx:159-160
  const meta = isStub
    ? (ja ? 'まだ白紙 · 一歩先から物語が生まれる →' : 'UNWRITTEN · walk in, and it will be written →')
    : (ja ? '場面 · 入口' : 'SCENE · ENTRANCE');
```
契约同时冻结（`00:574`）：

> **门牌的 stub 初始化**（「走进去就把它写出来」）：层有（`doc-11 §3`），nook 子场景**本批不做**。

且这不是「忘了做」，是**结构上做不到**：`05:110-116` 已实测论证 `init` 的 `dir` 恒为 `characters/<id>`，装不下 `characters/<id>/office`。⇒ **每一张 `stub=true` 的门牌都在向玩家承诺一件本批不可能发生的事**；玩家走进去看到空画布、无任何可提交控件（`04:633-636` 自认「玩家看不到出路」）。

- 「门牌口径诚实」修的是 **flag**；**文案的诚实**没修，而文案才是玩家读到的那句。
- `04 §U3` 把它登记为「已知并被接受的范围边界」—— 但**范围边界不等于可以说谎**：本批不做子场景 init ⇒ 就不该用「will be written」这种承诺性文案。

> **对「有没有反例推翻主 agent 裁决」的回答**：我**不**推翻他的 **flag** 裁决；我推翻的是**契约给这个 flag 写的定义（括注 (a)）**与**契约保留的 `CardRenderer` 承诺文案（b）**。这两处他未裁决，而它们让同一张门牌同时说「这里没写」与「走进去会写」。

---

## 3. 不递归：三处核对（全部遵守）

| 处 | 遵守 | 证据 |
|---|---|---|
| `02` 端点组装 | ✅ | `02:190-207` 只对 `doorIds`（= `nookSceneDoors` 直接子级）`Promise.all`；`nookSceneCards` 非递归 |
| `03` layout 分支 | ✅ | `03:326-331` 省略 paths 时 `nookSceneCards(layer, await store.listFiles(layer))`；`cardsOfLayer` 精确 `dirOf(f)===dir` |
| `04` 前端 `isEmpty` | ✅ | `NookView.tsx:468` `items.length===0 && scene===null`；门牌进 `items` ⇒ 「只有门牌」的房间不显示空态 |

另核两条易漏：
- `arrangeCards` place（`03:213`）用 `dirOf(place.path)`，**不**吸子树卡；`dirOf` 无斜杠返 `''`（`layers.ts:48`）⇒ `isNookSceneId('')` 假 ⇒ 回落 `resolveLayer`，零回归。
- `nookSceneOfPath` 去 `MAP_LAYER` 兜底是**必要**的：实测 `layerOfPath('characters/ryo/other.md', {characters/elias,…}) → 'map'`（`layers.ts:131` 逐字 `let best = MAP_LAYER;`），`06 §N2-A23` 的负向断言锁得住。

**⇒ 没有一处棋子式递归铺开。**

---

## 4. 语义兑现的核心缺口：进门后看不见作者写的字

**实测**：`NookView.tsx` 里 `state.scene` 只有三个消费者，**都不是渲染正文**：

```text
$ grep -n "state.scene" apps/web/src/components/nook/NookView.tsx
129:      scene: body.scene ?? null,                                 ← 仅解包
458:  const sceneFrontmatter = state?.scene?.frontmatter ?? null;    ← 只取 frontmatter
468:  const isEmpty = ... state.scene === null;
$ grep -rn "scene?.body|scene\.body|MarkdownText" apps/web/src/components/nook/
（零命中：nook 目录没有 MarkdownText，也没有读 scene.body 的地方）
$ grep -n "scene" apps/web/src/components/canvas/Canvas.tsx   ← Canvas 无 scene prop
（无命中）
```

`statusLineOf(sceneFrontmatter)`（`nook-status.ts:34`）= `status.data` 或 `frontmatter.title`。而 `office/README.md` 的 frontmatter 是 `type/name/portrait`（**无 `title`、无 `status`**）⇒ **状态行为空**。

⇒ **走进 `office`：顶栏只有角色名，画布空白，作者写的「上班时间的我。领带收紧……」一个字都不显示。** 同路径适用于 `balcony` / `living-room` / `parallel-timeline` —— **4 / 4 个有 README 的房间**。

作者那些字**能**被看到，但只在**父场景的门牌**上：`CardRenderer.tsx:164` `plainExcerpt(body)` 一行摘要 + `:183-187` 的 `.gate__detail`（`index.css:1387`，`:1410` hover 展开）全文。即：

> **玩家要读这间屋子的正文，得站在**外面**把鼠标悬在门上；走进去反而什么都没有。**

这与产品承诺（契约 §3「子场景 = 真画布」、`02 §①`「让 `04` 复用 `<Canvas>`」）之间有一条没人写的缝：**画布只画 `items`，而这 4 间屋子的 `items` 恰好为空**。

**判定**：不是 `02`/`04` 的实现疏漏（它们按契约交付），而是**契约层的需求缺口**：契约冻结了 `scene`（`00:246`），却没冻结「`scene` 在画布上怎么呈现」；而 N1 的旧呈现（`docs/nook/02 §3.3 step 7` 的「`state.scene` → `scene` prop」）**在当前工作树上已不存在**（`tools/no-scene-panel.test.mjs:7` 断言 `Canvas`/`App`/`NookView` MUST NOT 出现 `SceneChalk|sceneCopy`；实测 `SceneChalk.tsx` 已删）。⇒「进门看空白」是 N1 遗留机制的放大，**但 N2 把它从「根场景伴生现象」变成「主路径」**（作者内容全在子场景 README 里），而**六份文档无一处登记或裁决**。

**最低要求（实现前拍板）**：要么给子场景画布渲染 `scene`（标题 + 正文，哪怕只读），要么在契约显式写「子场景 README 是门牌素材，进门后不在画布上呈现」并接受「4 间主房空白」。

---

## 5. 「修复前失败」断言的独立复核（我自己跑的）

用 `packages/shared/dist`（已构建）跑真函数，不跑项目级命令：

```text
characterIdOfPath('characters/elias/office/desk.md')  → 'elias'；nookIdOf('elias') → 'characters/elias'
  ⇒ arrangeCards place 修复前 layer = 'characters/elias'（根场景，非 404）      ✅ 与 06:N2-A12 一致
characterIdOfPath('characters/elias/office/')          → 'elias'（尾斜杠不返 null）
  ⇒ 形状闸 MUST 用 isNookSceneId，不能靠 characterIdOfPath                       ✅ 与 06:N2-A28 一致
layerOfPath('characters/ryo/other.md', {characters/elias,…}) → 'map'
  ⇒ nook 守卫若复用 layerOfPath 会静默放过                                      ✅ 与 06:N2-A23 / §5.3.1 一致
isNookEmpty([elias/preset.json, elias/office/README.md], 'characters/elias') → true（危险）
hasInitProduct(同, 'characters/elias', 'nook')                               → false
  ⇒ 契约真值表 B 行（hazard）成立                                                ✅ 与 06:N2-A19/A20 一致
/^[a-z0-9][a-z0-9-]*$/.test('office/desk.md') → false（同 'unspoken.md'）
  ⇒ 「scene 指向文件 ⇒ 404」用带扩展名输入永不可达                                ✅ 与主 agent 已修的 N2-A4 一致
nookCardPaths(<elias 全 md>, 'characters/elias') → ['characters/elias/unspoken.md']
  ⇒ 根 items 修复前只有 1 项（A0 前提成立）                                       ✅
按 canvas.ts:615 逐字推演 layout ④：owner = nookIdOf(characterIdOfPath(p))
  p='…/office/desk.md' ⇒ 'characters/elias' ≠ 'characters/elias/office' ⇒ not_found  ✅ 与 06:N2-A13/A15 一致
  （此条为代码表达式逐字推演，未起 ActionService，标 [推断]）
```

### 假绿检查

- `06 §⑦` / `04 §10.4` 的「`arrangeCards` MUST NOT 把修复前写成 404/400」告诫**已被遵守**（A12/A14 断 `details.layer` 的**值**，A13/A15 断 `not_found` + 逐字文案）。✅
- **唯一剩下的假绿面是 A8/A11**：它们指定的夹具 `templates/exp/characters/elias/writing/` **今天不存在**，而 `06 §2.2` 又明令 MUST NOT 用 `worlds/exp-default`（含 `chat-history/`）⇒ **这两条断言在当前被指定的夹具上无法成立**（要么红，要么逼实现者现场造目录，从而绕开「用作者真写的素材」这一验收初衷）。**blocker，修法**：重建 `writing/`（把 `meta/agent_selfframework.md` 等搬回并补另两个），或把断言改指到 `worlds/*` 里**仍存在 `writing/`** 的存档（实测 `worlds/exp-*` 多数有 `writing/`）并显式处理 `chat-history/`。

---

## 6. 契约本身的错误（含自称「实测」的）

| # | 位置 | 断言 | 实测 | 性质 |
|---|---|---|---|---|
| B1 | `00:31-38`「现状事实（非推断）」/ `06:40-53` | `elias/` 下有 5 个子场景（含 `writing/`） | 4 个 + **`meta/`**；`writing/` 不存在 | **事实已失效**（自称实测） |
| B2 | `06:47` | `.shot_cloud.png .shot_still.png` 在根 | `git status` 显示两者 `D`（已删） | 事实已失效 |
| B3 | `00:257` | `stub` 真值 ⟺「**真正空目录**」 | 与 `02:226` 的「不加 `hasDeeper`」互斥（只有孙目录时 `stub=true` 而目录非空） | **自相矛盾**（§2.2a） |
| B4 | `00:509-510` | 「前端空态**天然同源**……既有结构自带」 | `06:962` 自认「**不是完全同源**」；实测 `isNookEmpty(['…/preset.json','…/cover.jpg'], dir)===false` 而前端 `items` 空 + `scene===null` ⇒ `isEmpty===true` | 措辞过强（与 06 冲突，F6） |
| B5 | `00:84` | `world/` 对空目录出门牌、nook 也要（用 `listDirs`） | 成立（`listDirs` 是目录行走，实测 `out.push` 在递归前，`local-store.ts:363-364`） | ✅ 无误 |
| B6 | `00:257` 末段 | 「nook MUST NOT 照抄层的 body 那句」 | 与 §6「不做子场景 stub 初始化」合读 ⇒ 保留 `UNWRITTEN` 文案即矛盾 | 结论对、**配套缺失**（§2.2b） |

---

## 7. 诚实性问题清单（逐份）

| # | 文档 | 问题 | 严重度 |
|---|---|---|---|
| F1 | `00 §1/§2.2`、`06 §2.2` | 把**已失效的目录树**写成「2026-09-15 实测」，并据此指定验收夹具；真实存在的 `meta/`（新门牌）**未登记** | **blocker** |
| F2 | `00 §4.3`（`:257`） | 「（真正空目录）」括注与已批准的 `hasDeeper` 否决互斥 —— 结论对而理由错 | **blocker** |
| F3 | `00 §4.3` + `§6` | 保留 `stub` 门牌的 `UNWRITTEN · walk in, and it will be written` 文案，同时明令不做子场景 stub init ⇒ 承诺不可兑现（`04 §U3` 只记成「范围边界」） | **blocker** |
| F4 | `04 §10.1` 表 #3、`§9 ##7` | 「双击门牌 ⇒ 画布换成 office 的卡」—— `office/` **没有卡**（实测 `cardsOfLayer(office)===[]`），该 smoke 期望恒为空 | major |
| F5 | `04 §③` 步骤 12（`:372`） | 「实现：当前段 = `nookScenePathOf(state.layer)`」**单参**，与冻结的两参签名（`00:374`）不符 ⇒ TS 编译错；同文 `:139`/`:148-149`/`:509` 均为两参（**同文档不自洽**） | major |
| F6 | `05 §⑥`（`:230`） | 「它**已与**收紧后的 `isNookEmpty` **等价**」写成**已定**；`06:962` 却登记「不是完全同源」（`scene` 非 null 但 `items` 空、或根只有 `preset.json`+`cover.jpg`） | minor |
| F7 | `05 §⑫ 待拍板` 与 `06 §13` | 五条待拍板（`chat-history`、空子目录是否算产物、前端可见集 ⊂ 后端内容集、`listDirs` 跳不跳 `node_modules`、`.pi` 之外运行期目录）**已在两文档各自登记**，但**契约 §8 只登记了 P6**（`chat-history`），另四条契约层无条目 ⇒ 「谁拍板、拍完往哪写」不明 | minor |
| F8 | `02 §⑩ A0` 夹具块（`:655-663`） | 期望的 6 项里含 `characters/elias/writing/README.md` —— 夹具里没有 `writing/` ⇒ 该期望**不可达**（同 F1/F4 根因） | major |
| F9 | `06 §3.6`（`:459`） | 「漏 A20 → W2 兜底把…判为**失败**」—— `05 §⑪-8`（`:438`）已实测更正：nook 分支 `fallback` 是 `'none'`（`init-command.ts:348`），**不走 W2 兜底**。`06` 未同步该更正（同文档 `§3.6` 正文用的是对的说法，只有这行的「W2 兜底」措辞残留） | minor |

**诚实性总评**：「仍未知待拍板」的**数量与坦诚度都好**（`01 §12`、`02 §⑫`、`03 §⑫`、`04 §⑫`、`05 §⑫`、`06 §13` 都列了，且明确区分「已裁决」与「未拍板」）。真正的问题不是「隐瞒」，而是 **F1 型：事实漂移后未回写**（自称实测的树变了），以及 **F2/F3 型：把「理由」与「承诺」留在原处不去动它**——正是 `design-first-feature-workflow` 点名的两类。

---

## 8. 总体判断（一段话）

这套设计**方向是对的、工程自觉高于平均**：不递归三处一致、`stub` 的 flag 口径确实修掉了层口径对「有卡无 README」房间的谎、修复前失败的断言多数经我独立复算成立且避开了「写 404 得假绿」的坑。但**它离「让作者已写的子场景内容被玩家看见并可用」还差两步**：第一步是**事实层**——契约与 `06` 指定的核心夹具（`writing/`）已随作者搬目录而失效，真实存在的 `meta/` 会静默变成一张没人登记的门牌，三条 blocker 全由此而来；第二步是**承诺层**——`stub` 门牌仍在打「walk in, and it will be written」，而本批结构性不做子场景 init，且 4 / 4 间有 README 的作者房间进门后是空画布（作者正文只能靠在门外 hover 读到）。**修完 F1/F2/F3（+F4/F5 顺带）即可放行进入实现，无需重设计。**

---

## 9. 发现清单（按严重度，带 `file:line`）

1. **[blocker]** 契约与 `06` 的夹具事实失效（`writing/` 已不存在、`meta/` 未登记）—— `docs/nook-scene/00-共同上下文.md:31-38`、`docs/nook-scene/06-验收与回归.md:40-53`。
2. **[blocker]** `stub` 的「真正空目录」括注与已批准的 `hasDeeper` 否决互斥 —— `docs/nook-scene/00-共同上下文.md:257`。
3. **[blocker]** `stub` 门牌文案承诺「走进去就会写」vs 契约 §6 不做子场景 init —— `docs/nook-scene/00-共同上下文.md:257`、`docs/nook-scene/00-共同上下文.md:574`。
4. **[major]** 进门后 `scene` 正文不渲染（4 / 4 作者房间空白）—— `docs/nook-scene/00-共同上下文.md:246`（`scene` 冻结）无对应呈现契约。
5. **[major]** `04` 的单参 `nookScenePathOf(state.layer)` —— `docs/nook-scene/04-前端视图与导航.md:372`。
6. **[major]** smoke 期望「office 的卡」而 office 无卡 —— `docs/nook-scene/04-前端视图与导航.md:561`。
7. **[minor]** `05`「已等价」vs `06`「不是完全同源」—— `docs/nook-scene/05-初始化与空判定.md:230`。
8. **[minor]** `06` 残留「W2 兜底」措辞（nook 实为 `fallback:'none'`）—— `docs/nook-scene/06-验收与回归.md:459`。
