# review-A — 跨文档一致性与契约遵守（N2「nook 子场景」批次 · 评审门）

> 评审棱镜：design-first-feature-workflow §7 的第 1、2 项 —— **跨文档一致性** 与 **契约冻结遵守**（含函数签名/调用点闭环、上游修订登记、权威层级）。
> 被评文档：`docs/nook-scene/00-共同上下文.md`（下称「契约」）及其六份子文档 `01`–`06`。基准 = 契约。
> 只读纪律：评审期间**未改动**任何被评文档/契约/源码。以下所有裁定带 `file:line` 或可复现命令与输出；标 `[推断]` 者为结构性推演。
> 复核时间：2026-09-15，仓库根 `/home/yoshix7ti/projects/hackathon`。
> 方法：逐条 grep 两侧对比 + 用 `packages/shared/dist` 的既有导出与 `node -e` 局部实跑关键「修复前」行为（未跑 `pnpm build` / `pnpm test` / `pnpm probe`）。

---

## 0. 结论

**有条件通过。**

**判据**：契约冻结层的**形状本身是自洽的**（`nookSceneId` 三态、`cards.layer` 口径、门牌 `stub` 口径、错误码、空判定签名在 01–06 的**主体论述**里一致，且关键「修复前」行为我独立实跑后与 `02`/`03`/`06` 的实测一致）。但**落地面仍有 3 处必须修、否则实现者会照错的地方写代码或照错的断言写测试**（§1 阻断项 B1–B3），另有 5 处跨文档漂移与 3 处诚实性缺陷（§2 / §4）。这些都不动摇架构方向，故为「有条件通过」，条件 = §1 三条修完 + §2 表中 blocker/major 两条修完。

**重要提示（跨文档裁决已生效的部分）**：主 agent 本轮已终裁的 4 项（`nookScenePathOf` 两参版、`U6` 选择器、`C2` 不收口、i18n 三处落地）在 `01`/`04` 中**已对齐**（§3.1 复核通过）；`03` 的 import 与签名两处也已修好（§3.2 复核通过）。

---

## 1. 阻断项（必须先修才能实现）

### B1 — `06` §8.1 把 `nookSceneCards` 落在 `rules/characters.ts`（与 `01`/`02`/`03` 冲突，且违约 zero-deps）

- **位置**：`docs/nook-scene/06-验收与回归.md:789`（§8.1 落点表行 `| \`nookSceneCards(sceneId, allFiles)\` | 同上 | NEW | …|`）。
- **为什么阻断**：§8 自述「**代码落点（精确到文件与函数）**……会被逐字照抄成实现」。该行的「落点」列写「同上」，上文（`:785-788`）全为 `packages/shared/src/rules/characters.ts`。而 `nookSceneCards` 必须调 `cardsOfLayer`（`packages/shared/src/store/layers.ts:106`），其 import 链拉进 `schemas/world.ts` → zod；`characters.ts:3-6` 逐字声明 *"Zero dependencies on purpose: no zod, no yaml, no node builtins"*。照此行落地即**编译/纪律双违约**。
- **三份文档的相反口径**（各给行）：
  - `01-共享派生层.md:349-355`：`import { cardsOfLayer, childLayers } from './layers.js';` 落在 **`store/nook-layers.ts`**（`:347` 标题逐字「**NEW**，约 60 行」）。
  - `02-取数端点与门牌.md:32`：`nookSceneCards(sceneId, allFiles): string[]  NEW  store/nook-layers.ts（§5.2）`。
  - `03-占位座位与摆放.md:501`：`nookSceneCards(...)  // nook-layers.ts`。
- **`06` 自身的复述也错**：`06:777`（冲突 13）称「契约 §5.2 把它写在 `rules/characters.ts` 之下」—— 但契约 §5.2 标题（`00-共同上下文.md:390`）逐字为「### 5.2 唯一的页面成员函数（新增）」，**未指定文件**；而同层 §5.1（`:341`）与 §5.3（`:404`）都显式指定了文件。⇒ 这是 `06` 把「契约未指定」误读为「契约指定在 rules/」。
- **建议改法**：`06:789` 的落点列改为 `packages/shared/src/store/nook-layers.ts`（与 `01`/`02`/`03` 一致）；`06:777` 的「契约 §5.2 把它写在 rules/characters.ts 之下」改为「契约 §5.2 未指定文件；`01` 定为 `store/nook-layers.ts`（保 zero-deps charter）」。
- **证据**：`grep -n "nookSceneCards" docs/nook-scene/*.md`；`grep -n "eslint\|zero dependencies" packages/shared/src/rules/characters.ts`（`:3-6`）。

### B2 — `06` §N2-A19 的 `directChildDirsOf` 断言与其唯一实现（`05`）返回值口径相反 ⇒ 该断言必红

- **位置**：`docs/nook-scene/06-验收与回归.md:443`：
  `assert.deepEqual(directChildDirsOf([dir, \`${dir}/a\`, \`${dir}/a/b\`, 'characters/other'], dir), [\`${dir}/a\`]);`
- **为什么阻断**：期望值是**完整路径** `['characters/ryo/a']`。而唯一实现定义在 `docs/nook-scene/05-初始化与空判定.md:48-57`：
  ```ts
  const rest = d.slice(prefix.length);
  if (rest === '' || rest.includes('/') || rest.startsWith('.')) continue;
  out.add(rest);        // ← 返回【裸段名】，不含前缀
  ```
  `05:46` 的 doc 亦逐字写「直接子目录**名**（不含路径前缀、不含 `dir` 自身）」；`06:457` 自己复述的语义（`rest.includes('/')` / `rest === ''`）也是裸段名口径。**只有 `:443` 这一行写成完整路径。**
- **实测**（跑 `05` 的逐字实现）：
  ```
  $ node -e "…directChildDirsOf(05 的实现)…"
  ["a"]            ← 与 06:443 期望的 ["characters/ryo/a"] 不等
  ```
- **后果**：`06` §10.2 把它列为验收用例，实现者照 `05` 落地 ⇒ 断言**修复后仍红**，且会被误判为「实现错」。
- **建议改法**：`06:443` 的期望改为 `['a']`（或把该断言移到 `05` 的 §10.2，由 `05` 自带裸段名用例）。二者取一，且**只能有一个权威语义**。
- **证据**：上述 `node -e` 输出；`05:46/48-57`。

### B3 — `04` §③步骤 12 仍写单参 `nookScenePathOf(state.layer)`（漏改残留）

- **位置**：`docs/nook-scene/04-前端视图与导航.md:372`：「**实现**：当前段 = `nookScenePathOf(state.layer)`（`state.layer` 是完整 id，本就是 `nookScenePathOf` 的定义域）」。
- **为什么阻断**：契约 §5.1 已终裁**两参**：`nookScenePathOf(sceneId: string, nookId: string): string | null`（`00-共同上下文.md:374`，裁决段 `:377-381`）。`04` 自身其余各处均已对齐两参（`:139` 调用、`:148-149` 用例、`:503` 签名表、`:509-519` 语义边界表），`01-共享派生层.md:61/336/419` 亦已全对齐。此处是**唯一**漏改点。
- **后果**：按此行实现 ⇒ TS 编译错（少第二实参）；即便补齐 `nookId`，该行也没说 `nookId` 从哪来（`state.layer` 反推需 `characterIdOfPath`，而 `04:153` 已明确「`characterIdOfPath` 不需要了」）—— 两处自相矛盾。
- **建议改法**：改为 `nookScenePathOf(state.layer, nookIdOf(characterId))`（与 `:139` 的 `handleEnterGate` 同源），或直接引用步骤 3 的 `nookId` 变量。
- **证据**：`grep -n "nookScenePathOf" docs/nook-scene/04-前端视图与导航.md`（`:372` 是唯一单参形态）。

---

## 2. 逐条一致性问题表

| # | 严重度 | 位置 | 问题 | 证据 / 建议 |
|---|---|---|---|---|
| A-1 | **major** | `05-初始化与空判定.md:431` | 「契约 §5.4 逐字写 `hasInitProduct(files, dir, 'nook')`（3 参）……契约的**签名示例未同步**，请主 agent 更新」——**契约 §5.4 已经同步**：`00-共同上下文.md:466-476` 已是 `isNookEmpty(files, dir, dirs)` / `hasInitProduct(files, dir, kind, dirs)` / `directChildDirsOf(dirs, dir)`。把「已定」写成「未决」。 | 同类残留：`01-共享派生层.md:497/523` 仍称契约 §5.1 写 `(scene: string)` 并「请主 agent 裁决」，而 `00:356` 已是 `string \| null \| undefined`。建议把这两条冲突行标注「已于 2026-09-15 消解」 |
| A-2 | **major** | `02-取数端点与门牌.md:436` | 「翻译 MUST 用 **`nookSceneParent`/`isNookSceneId`**（`01`）」——与契约 §5.1 的**唯一**转换函数 `nookScenePathOf` 相左；契约 `00:372` 逐字「`nookSceneParent` 不能兼任（吃完整 id、返完整 id）」。按此行实现会让 `04` 绕开冻结实现并自拼字符串。同文档 `:520` 又称「`nookSceneParent` 属于 `04` 的导航」——旧口径。 | 建议改为「MUST 用 `nookScenePathOf(target, nookId)`」 |
| A-3 | **major** | `06-验收与回归.md:26`（+`:925/934/525`）vs `01-共享派生层.md:407` | 同一批纯函数测试被两份文档各自声明为不同 **NEW** 文件：`06` = `packages/shared/test/nook-scene.test.mjs`；`01` = `packages/shared/test/nook-layers.test.mjs`。两份「新增文件清单」互斥。 | 建议 `01` 改为引用 `06` 的文件（或 `06` 吸收 `01` 的用例） |
| A-4 | minor | `06-验收与回归.md:26 / §8.1 / §3.0` | 验收面**漏了 `nookScenePathOf`**（契约 §5.1 第五条冻结函数、`04` 进门/面包屑的唯一转换，且带 `''` vs `null` 易错双关）。`grep -c nookScenePathOf docs/nook-scene/06-验收与回归.md` → **0**。 | 建议在 `06` §2.1/§8.1 补一行，并加至少一条断言（三态：`'office'` / `''` / `null`） |
| A-5 | minor | `00-共同上下文.md:612-615`（§7） | §7 四行修订中，**`docs/footprint/00-共同上下文.md` 那行没有任何子文档认领**（`grep -rn "footprint/00" docs/nook-scene/0[1-6]*.md` 只命中 `03:3` 的「上游冻结」与 `05:4` 的层级声明，均非修订动作）。其余三行有落点：`nook/00 §3.1` → `02:536`；`nook/01 §⑪` → `06:943-961`；`doc-11 §4.1` → `05:186`。`03`（写侧 owner）的 §④/§⑨ 未登记该行。 | 建议 `03` 补登记（或 §7 该行注明 owner=主 agent） |
| A-6 | minor | `01-共享派生层.md:37` vs `:257` | 同一文档内计数不一致：§2.1 标题「新增 **5** 个函数」，§4 文件表「新增 **4** 个纯函数」。`nookScenePathOf` 收编后 `:257` 未更新。 | 建议统一为 5 |
| A-7 | nit | `04-前端视图与导航.md:607 / :610` | 冲突表出现**两条同号 `C2`**（前者「请 `01` 复核」，后者「已裁决：不收口」）——把裁决结果当新行追加而非就地更新。正文多处「见 §⑪ 冲突 C2」撞两个目标。 | 建议合并为一条，或把后者改号为 C2′ |
| A-8 | nit | `05-初始化与空判定.md:460`（§⑫ 待拍板 5）vs `01-共享派生层.md:371`（§8.3） | `05` 仍把「`listDirs` 是否跳 `node_modules`」列为待 `01` 拍板；而 `01` §8.3 已写成冻结改动（「**MUST 补上 `node_modules` 跳过**」，契约 §5.4 P8 亦已裁决）。 | 建议 `05` 标注「已由 `01` §8.3 落定」 |
| A-9 | nit | `05-初始化与空判定.md:4` vs 实际层级 | `05:4` 声明的上游层级把 `docs/init/doc-11` 置于 `docs/footprint/00` **之后**，契约 §0（`00:12-19`）的层级是 1 契约 > 2 nook/00 > 3 footprint/00 > 4 doc-11 —— 一致，无冲突；仅记录复核通过 | — |

### 2.1 已复核**一致**的关键口径（无需改）

| 口径 | 各处写法 | 结论 |
|---|---|---|
| `nookSceneId` 形状（无前导/尾随 `/`，逐段 kebab） | 契约 `§4.1`（`00:198-207`）；`02:106-131`；`03:53-58`；`01:49-61/311-340` | **一致** |
| `cards.layer` = 完整 nookSceneId | 契约 `§4.4`（`00:260-268`）；`03 §③步骤1`（`:150-176`）；`06 A18/A24`（`:129/135`） | **一致** |
| 门牌 `stub = 无 README ∧ 无直接卡`；`body: ''` | 契约 `§4.3`（`00:236-252`）；`02 步骤 6b`（`:239-250`）；`06 A8/A10`（`:119/121`） | **一致** |
| 错误码 `400 invalid_argument` / `404 not_found` / `409 no_active_world` | 契约 `§4.2`（`00:240-242` 附近）；`02 §8.1`（`:461-472`）；`03 §7.1/7.2`（`:446-465`）；`04 §⑦`（`:390` 附近）；`06 §7`（`:756-771`） | **一致**（409 已完成跨批更正） |
| `scene` 省略或 `''` ⇒ 角色根 | 契约 `§4.2`；`02 步骤 3`（`:110-131`）；`04 步骤 0`（`:82-88`）；`06 §13-4`（`:1030` 附近） | **一致** |
| `deriveNookLayers(nookId, dirs, readFm)` 第二参数是 `dirs` | 契约 `§5.3`（`00:404-425`）；`01:91-95`；`02 §9.2`（`:515`）；`03:61-66` | **一致** |

---

## 3. 对主 agent 本轮三维「已裁决项」的独立复核

### 3.1 `nookScenePathOf` 两参版是否全处对齐 —— **基本对齐，一处漏改（= B3）**

`grep -n "nookScenePathOf" docs/nook-scene/*.md` 逐处判读：

| 位置 | 形态 | 判定 |
|---|---|---|
| `00:288`（§4.6 进门牌） | `nookScenePathOf(target, nookId)` | ✅ 两参 |
| `00:366-367`（§5.1 doc 例） | 两参 + `→ 'office'` / `→ ''` | ✅ |
| `00:374`（签名） | `(sceneId: string, nookId: string): string \| null` | ✅ |
| `00:377-381`（裁决段） | 明确否决单参版 | ✅ |
| `01:61` 签名 / `01:336` 实现 / `01:419` T4b 用例 | 两参，实现 `sceneId === nookId ? '' : sceneId.slice(nookId.length + 1)` | ✅（`''` = 根、`null` = 越界） |
| `02:32/513` | 未使用（`02:520` 自述不 import） | ✅ 无漂移 |
| `04:53` import / `:139` 调用 / `:148-149` / `:503` / `:509` / `:513` | 两参 | ✅ |
| **`04:372`** | **`nookScenePathOf(state.layer)` 单参** | ❌ **漏改（B3）** |
| `03` | 不涉及（`03` 用 `dirOf` + `isNookSceneId` 的等价式） | ✅ |

**⇒ 主 agent 的「契约一改必须全处同步」考点确实命中一处残留：`04:372`。** 其余全部到位。

### 3.2 `03` 的两处 blocker 是否已修 —— **均已修**

- `03:483`（§8.2 import 增补）现为：
  ```ts
  import { characterIdOfPath, isNookSceneId, nookIdOf } from '../rules/characters.js';
  import { deriveNookLayers, nookSceneCards, nookSceneOfPath } from '../store/nook-layers.js';
  ```
  `nookSceneOfPath` 已归 `nook-layers.js`，与 `03:501`（§8.5）、契约 §5.3 一致 ⇒ **修好**。
- `03:54` 现为 `isValidNookScenePath(scene: string | null | undefined): boolean;`（注释标「契约 §5.1 裁决 C1」）⇒ **修好**。

### 3.3 `02` 的 N2-A4 file 分支 —— **已按方案②修，但 `06` 侧未同步（我与主 agent 结论不同处见下）**

`02:159/162-166/468-469/676/690/748-750` 已完整改为「无扩展名文件 fixture ⇒ `statKind === 'file'` ⇒ 404」，并显式写明「含 `.` 的输入恒 400」。`02:676` 的 A6 与 `:677` 的 A6b 已分开。

**⚠️ 我的独立复核与主 agent 判定一致的部分**：`isValidNookScenePath('office/desk.md') === false`、`('unspoken.md') === false`（我用 `node -e` 跑 `02` 的逐字正则实现复现，见下），故带扩展名场景**永远到不了 `statKind`**。
```
$ node -e "…RE=/^[a-z0-9][a-z0-9-]*$/; isValidNookScenePath 同 02/01 实现…"
"office/desk.md" false      "unspoken.md" false      "office" true
```

**但 `06` 未同步**（我报为 §1 外的 A-10，见下）：

| # | 严重度 | 位置 | 问题 |
|---|---|---|---|
| A-10 | **major** | `06-验收与回归.md:115 / :716 / :722` | `06` 仍把「`?scene=office/desk.md`（指向文件）→ **404 `not_found`**」写进 N2-A4 与 §7 错误码表，并称「N2-A3 + N2-A4 是新 error face 的两条断言」。这既与 `02` 修正后的 400 口径相左，也是**假绿断言**（修复前该输入返回 200 根场景，非 404）——正是在 `06 §7`（`:772-773`）自陈的假绿形态。`06:191` 已正确写「恒返 400，永不 404」，但总表 `:115` 与错误码表 `:716` 未同步。 |

（注：`06:115` 的正文现已部分更正为「无扩展名文件 → 404；含 `.` 恒 400」，但表格同行的**修复后期望**列仍写「404（无扩展名文件）/ 400（含 `.`）」，与 `:115` 首句「→ **404 `not_found`**」并存；`:716` 的错误码表行仍逐字为「`?scene=office/desk.md`（指向文件）→ `404 not_found`」+「N2-A4（新增）」，未按 `02` 改成 400/无扩展名文件。**建议统一为 `02` 的口径**。）

### 3.4 权威层级 —— 无子文档引用被显式修订掉的旧条文

逐处比对契约 §7 与子文档引用：
- `02:536` 引用「`docs/nook/00 §3.1`」时明确标注「**冻结 §4.3 对它的修订**」✅（未当现行条文用）。
- `06:943-961` 处理「N1 §⑪」时明确「结论对而理由错，只换理由、不动结论」✅，且**未**把理由改掉（`06` 不给 N1 结论翻案）✅。
- **无**任何子文档引用「小天地没有子层门牌」这条已失效理由作为论据。
- **一处边缘**：`02:436` 引用 `nookSceneParent`（见 A-2）虽非「被修订掉的旧条文」，但绕开了 §5.1 指定的唯一实现 —— 归入 A-2。

---

## 4. 契约（`00-共同上下文.md`）本身的错误

我按任务书的「权威通道必须可被推翻」逐条实查契约自称实测的部分：

| # | 契约位置 | 契约断言 | 我的独立复核 | 判定 |
|---|---|---|---|---|
| E1 | `00:67` / §2.2 | `resolveLayer()` 对 `characters/**` 返 `null`，逐字注释在 `local-store.ts:951-956` | `grep -n "async resolveLayer" packages/shared/src/store/local-store.ts` → **`:951`**；语义与注释吻合 | ✅ 成立 |
| E2 | `00:242` | 未加载世界是 **409 `no_active_world`**，`/nook` 在 `needsWorld` 白名单（`routes/world.ts:498`）；handler 内 `:675-676` 是死代码 | 实读 `routes/world.ts:507` 的 `needsWorld` 数组确实含 `'/nook'`；`:509-510` 逐字 `return res.status(409).json({ code: 'no_active_world', … })`。契约写的 `:497-512`/`:498` 是**成稿基线行号**，当前工作树为 `:507`/`:509`（漂移 +9~+11），但**结论成立** | ✅ 成立（行号漂移，已由 `02 §9.1` 的漂移提示覆盖） |
| E3 | `00:169/626`（§2.6/P2） | `characterRootConfigOf` 对深层路径逐字返回 `null`（`characters.ts:70`） | 实读 `characters.ts:62-80`：`if (filename.includes('/')) return null;` 位于 **`:70`** | ✅ 成立 |
| E4 | `00:155`（§2.3） | `listDirs()` 唯一调用点是 `scanLayers`（`local-store.ts:455`）；`walk` 只跳点开头（`:360`），`listFiles` 跳 `node_modules`（`:331`） | 实读：`listFiles` walk 在 `:331` 逐字 `if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;`；`listDirs` 的 walk 逐字 `if (entry.name.startsWith('.')) continue;`，位于 **`:360`**；`grep -n "listDirs()" local-store.ts` → `:455 const dirs = await this.listDirs();` | ✅ 成立（P8 不对称属实） |
| E5 | `00:258`（§2.5） | `arrangeCards` 对 `characters/elias/office` **不 400，而是静默指向根场景** | **实跑**（`node --input-type=module` + 真 `LocalWorldStore` + `arrangeCards`）： `place → details.layer = 'characters/ryo' | row.layer = 'characters/ryo'`（子场景路径落根）；`layout(显式子场景 layer) → not_found "characters/ryo/unspoken.md" is not on layer "characters/ryo/office"`；`layout(paths only) → OK layer='characters/ryo'`；`layout(尾斜杠) → not_found` | ✅ 成立，且与 `02 §10.1`/`03 §⑩`/`06 §3.5` **逐字一致** |
| E6 | `00:441-443`（§5.3.1） | `layerOfPath` 无匹配兜底 `'map'`（`layers.ts:131`） | **实跑**：`layerOfPath('characters/ryo/other.md', eliasTree) → 'map'`；`('world/inn/a.md') → 'map'`；`('player/bag/i.md') → 'map'`；实读 `layers.ts:131` 逐字 `let best = MAP_LAYER;` | ✅ 成立 |
| E7 | `00:456-475`（§5.4） | `isNookEmpty`/`hasInitProduct` 的 hazard 真值（内容全在子目录 ⇒ 判空/判未产出） | **实跑**（`packages/shared/dist/rules/emptiness.js`）：`B isNookEmpty = true`、`B hasInitProduct(nook) = false`；`F isNookEmpty([preset], empty-subdir) = true` | ✅ 成立 |
| E8 | `00:456` | 契约写 `isNookEmpty(files, dir)` = 直接子级全是 `.json`（`emptiness.ts:59-61`） | 实读 `emptiness.ts:48-50` 才是定义（`:48 export function isNookEmpty`），`:59-61` 是 `hasInitProduct` 的注释区 | ⚠️ **行号错**（`05:425` 已自行登记为冲突 3：「契约 §5.4 写 `:59-61`，实测为 `:48-50`」） |

**⇒ 契约自称「实测」的部分，我逐一复核后未发现被推翻的结论**（E1–E7 全部成立；唯一瑕疵 E8 是行号，且已被 `05` 登记）。契约在**工艺上**是可信的；本轮真正的缺陷集中在**子文档之间的落地面同步**（§1/§2）。

**另记一条契约的「措辞精度」问题（非错误，但会被误读）**：契约 §5.2（`00:390`）未指定 `nookSceneCards` 的文件落点，而 §5.1/§5.3 都指定了 —— 这个不对称正是 B1 与 `06:777` 误读的根因。建议在 §5.2 标题补「（新增，`packages/shared/src/store/nook-layers.ts`）」。

---

## 5. 诚实性检查（「未决 vs 已定」）

**做对的**（值得肯定，也是本批的亮点）：
- `02`/`03`/`05`/`06` 都显式区分「已裁决消解」与「仍未知待拍板」，且把被推翻的初稿结论**记录在案**（如 `02 §⑪冲突3`、`03 §⑪3b`、`05 §⑪8`、`06 §12`）。这符合「权威通道必须可被推翻」。
- `06 §13-2/§13-3` 如实登记两个口径缺口（空子目录算不算产物、前端可见集 ⊂ 后端内容集），并明确「不强行断言相等」——诚实。
- `02 §⑫ U2` 明确写「已裁决：不批准 `hasDeeper`，按字面实现」，并在实现段删掉该条件 —— 未把否决写成待办。

**遗漏 / 把已定写成未决的**（3 处，均已在 §2 列条目）：
1. **`05:431` + `01:497/523`**：契约签名**已同步**（`00:356/466-476`），但这两处仍请求主 agent 去同步（A-1）。
2. **`05:460`**：`node_modules` 跳过**已由 `01 §8.3` 落定**，`05` 仍列为待 `01` 拍板（A-8）。
3. **`04:610` vs `:607`**：C2 的「已裁决」与「待裁决」两条并存（A-7）——同一事实被同时写成已定与未定。

**各文档「仍未知待拍板」清单的完整性**：`01`（U1–U5）、`02`（U1–U8）、`03`（1–5）、`04`（U1–U7）、`05`（1–6）、`06`（1–6）**格式齐全**，且都指向具体的产品/权限决策而非实现细节。**未发现「假装已定」的未决项**（这是设计与评审里更贵的一类）。唯一需补的是：**`06` 应补一条「`nookScenePathOf` 的三态语义由谁验收」**（现为真空，见 A-4）。

---

## 6. 三条最关键的「修复前失败」断言的独立复核（任务书 §4）

我自己动手跑了三条（用 `packages/shared/dist` 既有导出 + 真 `LocalWorldStore` + `arrangeCards`）：

| 断言（来源） | 断言原文声称的「修复前」 | 我的实测输出 | 判定 |
|---|---|---|---|
| `06 N2-A12`（place 写错页） | 「成功但 `details.layer === 'characters/ryo'`（写错场景）」 | `place -> details.layer = characters/ryo | row.layer = characters/ryo` | ✅ **一致**（非 404，是值错 —— `06 §3.5` 的更正正确） |
| `06 N2-A15`（layout 省略 paths） | 「`not_found`：`"characters/ryo/unspoken.md" is not on layer "characters/ryo/office"`」 | `layout explicit nook layer (no paths) -> FAIL not_found | "characters/ryo/unspoken.md" is not on layer "characters/ryo/office".` | ✅ **逐字一致** |
| `06 N2-A23` / 契约 §5.3.1（无兜底） | 「若直接复用 `layerOfPath` → `'map'`（静默错误）」 | `layerOfPath('characters/ryo/other.md', eliasTree) = map`；`world/inn/a.md` → `map`；`player/bag/i.md` → `map` | ✅ **一致** |

**假绿排查**：`02 §10.1 A0` 的告诫（「不要把 `?scene=` 写成修复前 404」）**成立**——我实读 `routes/world.ts:694-706`，`/nook` handler 逐字只读 `req.query.character`，从不读 `req.query.scene`，故 `?scene=office` 修复前**确实返回 200 根场景**。
**发现一处尚未清除的假绿**：`06:115/:716/:722` 的 N2-A4（`office/desk.md` → 404）——见 A-10。

---

## 7. 总体判断

**架构与契约冻结层是可靠的，落地面的同步还差最后一公里。**

本轮最有价值的产出不是推翻契约（我实查其自称实测的 7 条结论，**全部成立**），而是**发现「冻结后的传播」有洞**：契约一改，`04`（单参残留）与 `06`（`nookSceneCards` 落点、`directChildDirsOf` 返回值口径、A4 的 404）三处没有跟上，而这三处恰好都落在「会被逐字照抄成实现/验收」的章节里（`04 §③`、`06 §8`、`06 §10`）——正是 design-first-feature-workflow 所警告的「契约改了、消费面没改」的典型。修法都很机械（各改 1–2 行），不涉及重新设计。

**放行条件**：
1. 修 B1（`06:789` 落点 + `06:777` 措辞）、B2（`06:443` 期望值）、B3（`04:372` 补第二实参）；
2. 修 A-1/A-2/A-3/A-10（四条 major），其中 A-10 直接关系到「假绿断言」这条设计阶段硬要求；
3. 建议同步 A-4（`nookScenePathOf` 无验收）与 A-5（§7 的 footprint 行无认领）。

上述 1–2 完成后，本批可进入实现。

---

## 附：复核用的命令与输出（可复现）

```bash
# 签名/符号跨文档对比
grep -rn "nookScenePathOf" docs/nook-scene/
grep -rn "nookSceneCards" docs/nook-scene/ | grep -i "characters.ts\|nook-layers\|rules/"
grep -c "nookScenePathOf" docs/nook-scene/06-验收与回归.md      # → 0
grep -rn "docs/nook/00\|docs/nook/01\|docs/init/doc-11\|docs/footprint/00" docs/nook-scene/

# 源码锚点（行号复核）
grep -n "export function isNookEmpty\|export function hasInitProduct\|export function isLayerEmpty" packages/shared/src/rules/emptiness.ts
grep -n "let best" packages/shared/src/store/layers.ts
grep -n "async listFiles\|async listDirs\|async statKind\|async resolveLayer" packages/shared/src/store/local-store.ts
grep -n "listFiles\|listDirs\|statKind" packages/shared/src/store/world-store.ts
grep -n "needsWorld\|no_active_world" apps/server/src/routes/world.ts

# 「修复前」行为实跑（未跑 pnpm build/test/probe）
node -e "…isValidNookScenePath 逐字实现…"        # office/desk.md → false；unspoken.md → false
node -e "…dist/rules/emptiness.js…"               # B: isNookEmpty=true, hasInitProduct=false
node -e "…dist/store/layers.js layerOfPath…"      # 越界 → 'map'
node --input-type=module -e "…LocalWorldStore + arrangeCards…"
  # place  -> layer = characters/ryo      （写错页）
  # layout(显式子场景, 无 paths) -> not_found "characters/ryo/unspoken.md" is not on layer "characters/ryo/office".
  # layout(paths only) -> OK layer = characters/ryo
  # layout(尾斜杠) -> not_found
```
