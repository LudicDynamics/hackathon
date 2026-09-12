# REVIEW-A — 跨文档一致性 + 契约冻结遵守（N1 角色小天地 · 评审门）

> 评审人：`ReviewA`。日期 2026-09-13。范围：`docs/nook/{00,01,02,03,04,05}`。
> 只读评审；本文是唯一产出。所有结论带 `file:line`；凡未经实测者标 `[推断]`。
> 评审基线：契约 `docs/nook/00-共同上下文.md`（现行版，含 §5.2「补充落地：`nookCardPaths` / `directChildrenOf`」由主 agent 2026-09-13 广播）、已落地代码 `packages/shared/src/rules/characters.ts`（B 档 commit `99ae55d`）+ `rules/emptiness.ts`。

---

## 0. 裁决（本维度）

| 文档 | 裁决 | 理由 |
|---|---|---|
| `00-共同上下文.md` | **通过**（3 处回写待办） | 契约本体自洽；§3.7 已撤回错误广播、§5.2 已补落地函数。仅残留 §3.7 要点 4 的归属署名与 §5.3 行号措辞两处需回写 |
| `01-取数端点.md` | **有条件通过** | 主线正确；但 `nookCardPaths` **arity 写错一处（单参调用，会静默返空）**、`characterIdOfPath` 语义与 05 冲突、`§2.3` 标题重复 |
| `02-前端视图与入口.md` | **不通过** | §8.4 把 `nookIdOf` 当「path→nookId」用（**签名错，落地即返 null**）；§④「`Canvas.tsx` 不改」与 03/§⑫-6 直接冲突；§3.5 仍留契约已撤回的帧序描述 |
| `03-立绘组件.md` | **有条件通过** | 六处同步/渲染/回退扎实；但 **`CARD_FORMS.portrait` 写 `288×384`，与契约冻结的 `360×480` 不一致**，且已写进 diff（非仅登记） |
| `04-占位与回写.md` | **有条件通过** | 写侧门禁与 01/契约一致；但 §附A「`isNookEmpty` 不存在」**已被落地代码推翻**、§⑫-1 建议「`listFiles` 全量」与冻结核裁相反 |
| `05-验收与回归.md` | **不通过** | **A25 的负向断言与已落地 `characterIdOfPath` 语义互斥**（子目录返回 `'ryo'`，A25 要求 404）；§3.2 把 `isValidCharacterId` 落点写成 `apps/server/src/routes/world.ts`，与契约/自身 §4.2 冲突 |

**整批裁决：不通过（需回写后复审）。** 无一处是「未知冒充已定」，但存在 3 处**实现即错**的文档（`nookCardPaths` 单参调用、`nookIdOf(path)` 误用、A25 与落地函数互斥）与 1 处**契约冻结被私改**（03 的 `portrait` 尺寸）。

---

## 1. 必答：`nookCardPaths` 出现在哪些文档？签名是否一致？

| 文档 | 位置 | 写法 | 一致？ |
|---|---|---|---|
| `00-共同上下文.md` | §5.2 补充落地（`:297-300`） | `nookCardPaths(allFiles: readonly string[], nookId: string): string[]`；实测例：输入 5 项 → `['characters/ryo/desk.md']` | ✅ 与落地代码逐字一致 |
| `01-取数端点.md` | §2.1 `:27`、§2.4 `:102` | `nookCardPaths(allFiles: string[], nookId): string[]`，标 **NEW** | ⚠️ 参数**去掉了 `readonly`**（落地是 `readonly string[]`）、且**标 NEW**（已落地，应标「已存在」） |
| `01-取数端点.md` | §③ 步骤 4 `:159`、§⑨ `:446`、§⑨伪码 `:663` | 两处**双参**调用（正确）；**§⑨ `:446` 单参**：`nookCardPaths(await store.listFiles(nook))` | ❌ **arity 不一致**，单参调用时 `nookId === undefined` → `directChildrenOf(files, undefined)` 走 `dir === ''` 分支失败 → 返回 `[]`（静默） |
| `02 / 03 / 04 / 05` | — | **零出现**（grep 实测） | ⚠️ `05` 的「直接子级」断言（A1/A8 否定子目录卡）**隐含依赖**它，但全篇未点名 → 断言与实现之间的可追溯链断裂 |

**结论**：签名**不完全一致**。落地签名 = `(allFiles: readonly string[], nookId: string): string[]`（`packages/shared/src/rules/characters.ts:65`）。`01` 需：(1) `:27/:102` 改标「已存在」并补 `readonly`；(2) `:446` 补第二个实参 `nook`（应为 `nookCardPaths(await store.listFiles(nook), nook)`）；(3) `04/05` 在引用「直接子级」处点名此函数。实测行为与契约例一致（`node -e` 走 dist 复核过）。

---

## 2. 跨文档符号 / 路径 / 字段名对照表

失信单元格标 ❌，需统一标 ⚠️。

| 符号 / 形状 | 契约 00 | 01 | 02 | 03 | 04 | 05 | 落地代码 | 结论 |
|---|---|---|---|---|---|---|---|---|
| `nookId` = `characters/<id>` | §3.2 ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | 一致 |
| `GET /api/nook?character=<id>` | §3.1 ✅ | ✅ | ✅ | — | — | ✅ | 未实现 | 一致 |
| `POST /api/card/footprint` nook 分支 | §3.3 ✅ | 引用 ✅ | 引用 ✅ | — | ✅ | ✅ | 未实现 | 一致 |
| `isValidCharacterId` 落点 | `rules/characters.ts` §5.2 ✅ | ✅ `:44` | ✅ `:388` | — | ✅ `:32` | ✅ §4.2 `:652` | `rules/characters.ts:24` ✅ | ⚠️ **05 §3.2 `:185` 仍写「定稿于 `apps/server/src/routes/world.ts`，可从 `apps/server/dist/routes/world.js` import」** → 与契约/自身 §4.2 冲突 |
| `nookIdOf` 语义 | 入参**裸 id** → `characters/<id>` | ✅ `:54` | ❌ **§8.4 `:395` 写 `nookIdOf(place.path)`（传 path）**；`:405` 又写 `nookIdOf(\`${layer}/\`)`（传目录串） | — | — | ✅ §4.2 | `:35` 仅接受合法 id | ❌ **02 两处误用**：对 `characters/ryo/diary.md` 与 `characters/ryo/` 均返回 `null` |
| `characterIdOfPath` 语义 | `characters/<id>` 或 `characters/<id>/…` → id（§5.2 `:288`） | ✅ §2.2 `:60-64`（子目录返 `'ryo'`，明确否定「段数=3」） | 提及 ✅ | — | — | ❌ **§A25 `:608` 注释与 W13 `:947` 写「段数必须正好 3」；`:611` 断言子目录卡 **必须 404** | `characters.ts:46`：**子目录返回 `'ryo'`**（实测） | ❌ **05 与落地函数互斥**（见 §4 问题 1） |
| `nookCardPaths` | `(readonly string[], nookId)` §5.2 | ⚠️ `(string[], nookId)` + 一处单参 | — | — | — | — | `:65` ✅ | ⚠️ 见 §1 |
| `directChildrenOf` | §5.2 补充（`emptiness.ts:19`） | — | — | — | — | — | `emptiness.ts:19` ✅ | ⚠️ nook 侧文档仅 00 提及 |
| `isNookEmpty` | — | — | — | — | ❌ **附A.1「全仓 grep 零命中」「P0 纯函数未写」** | — | **已存在** `emptiness.ts:36` | ❌ **04 附A 断言已被推翻** |
| `arrangeCards` place 分支 | §3.7（**署名 02**） | ✅（01 自认 owner） | ✅（§8.4：01 实现） | — | 引用「02/01」 | ✅ A23 | `canvas.ts:457-464` | ⚠️ **契约未回写归属**，三篇写法不一 |
| `arrangeCards` layout 分支 | §3.7.1 ✅ | ✅ | ✅ | — | — | ✅ A25 | `canvas.ts:487-533` | ✅（仅行号漂移，见 §3.5） |
| `cards.layer` = 完整 nookId | §3.3 ✅ | ✅ | ✅ `:194` | — | ✅ §9.3 | ✅ A11 | — | 一致 |
| `LayerState` 八键 | §5.1 ✅ | ✅ 步骤 8 | ✅ §3.3 | — | — | ✅ A2 | `useWorld.ts:39-48` | 一致 |
| `CanvasProps` 新增 prop 名 | 未写 | — | ❌ **§⑫-6 `:504` 称 `still`** | ✅ **§③-4 称 `stillPortraits`** | — | — | 未实现 | ❌ **02/03 对同一个 prop 用两个名字** |
| `Canvas.tsx` 是否改 | — | — | ❌ **§④ `:236`「不改」** | ✅ §⑧ `:10`（`stillPortraits`/`playingPortrait`/`still` 透传） | — | — | — | ❌ **02 自相矛盾**（§⑫-6 又要求它开口） |
| `portrait` `CARD_FORMS` 尺寸 | ❌ 冻结 `360×480`（§3.5 `:165`） | — | 记「现行版 360×480」`:470` | ❌ **`288×384`**（`:86`、§③-1 `:164`/`:174`） | — | 记「360×480」`:489` | 未实现 | ❌ **03 私改契约冻结值**（见 §4 问题 4） |
| `portrait` 六处同步 | §5.3 ✅ | — | — | ✅ §2.1 | — | ✅ §3.9 | 未落地（`COMPONENT_KINDS.length === 18`，实测） | 一致 |
| 测试口径 `node --test`（非 `pnpm test`） | §7 ✅ | ✅ §12.1 | ✅ §⑩-10 | ✅ §⑩ | ✅ §⑩ | ✅ §8.3 | — | 一致（`pnpm test` 已消解） |
| `index.ts` barrel 警告行号 | `:44-46` §5.2 `:291` | `:44-46` `:71` | — | — | `:42-44` `:32` | `:42-44` `:654` | **实际 `:49-50`** | ⚠️ 三个文档三个数字，全过期 |
| 断言编号 `A<n>` | — | A1–A20（`§12.2`） | 引用 A13/A23 | 引用 A25 | 引用 A7/A13 | ❌ **A1–A27，含义完全不同** | — | ❌ **两套 `A<n>` 命名空间冲突** |

---

## 3. 逐条问题（含 `file:line` + 建议修法）

### 3.1 【MAJOR / 02】`nookIdOf` 被当成「path → nookId」使用

- 位置：`docs/nook/02-前端视图与入口.md:395`（§8.4 代码块，`:394` 是同一误用的注释）
  ```ts
  const layer = (await store.resolveLayer(place.path)) ?? nookIdOf(place.path);
  //    nookIdOf(path) = path 属于 characters/<id>/ 时返回 `characters/${id}`，否则 null
  ```
- 位置：`docs/nook/02-前端视图与入口.md:406`（§8.4 收口机制）
  ```ts
  const nookId = layer !== undefined ? nookIdOf(`${layer}/`) : null;
  ```
- 事实：契约 §5.2 `:287` 与落地 `packages/shared/src/rules/characters.ts:35-37` 的 `nookIdOf(id)` 只接受**裸 id**（正则 `^[a-z0-9][a-z0-9-]*$`）。实测 `nookIdOf('characters/ryo/diary.md') === null`（含 `/` 必失败）。照 §8.4 实现 → place 分支对 nook 路径仍 `not_found`，A23 永红。
- 与之对照，`01` 的写法是对的：`nookIdOf(characterIdOfPath(place.path) ?? '')`（`:357`）、`nookIdOf(characterIdOfPath(\`${layer}/\`) ?? '')`（`:429`）。
- 建议修法（02 §8.4 两处同步）：
  ```ts
  const layer = (await store.resolveLayer(place.path)) ?? nookIdOf(characterIdOfPath(place.path) ?? '');
  ```
  ```ts
  const nookId = layer !== undefined ? nookIdOf(characterIdOfPath(`${layer}/`) ?? '') : null;
  ```
  并在 §8.4 的「判据统一走契约 §5.2 的同一份 `nookIdOf`/`isValidCharacterId`」一句里补上 `characterIdOfPath`——它是**唯一**能吃 path 的那个。

### 3.2 【MAJOR / 01】`nookCardPaths` 单参调用（会静默返空）

- 位置：`docs/nook/01-取数端点.md:446`
  ```ts
  : nookCardPaths(await store.listFiles(nook));
  ```
- 事实：落地签名 `nookCardPaths(allFiles, nookId)`（`characters.ts:65`）必填第二参。单参 → `nookId === undefined` → `directChildrenOf(files, undefined)` 的 `dir === ''` 判断走 `''` 分支，前缀不等 → 返回 `[]`。layout 分支「不传 paths」时**静默排出 0 张卡**，与 A25 期望的 200 矛盾。
- 建议修法：
  ```ts
  : nookCardPaths(await store.listFiles(nook), nook);
  ```

### 3.3 【MAJOR / 01】`nookCardPaths` 标 NEW 且签名少了 `readonly`

- 位置：`docs/nook/01-取数端点.md:27`、`:102`、`:264`、`:631`
- 事实：函数已落地（`characters.ts:65`，`index.ts:15` 已 export）；契约 §5.2 `:297-300` 已补记。主 agent 2026-09-13 广播明确要求「01 篇的实现落点里 `nookCardPaths` 应标为**已存在**（非 NEW）」。
- 建议修法：四处 `NEW` → `已存在（B 档 99ae55d）`；签名统一为 `nookCardPaths(allFiles: readonly string[], nookId: string): string[]`。

### 3.4 【MAJOR / 02 vs 03】`Canvas.tsx` 改不改，两篇直接冲突

- `docs/nook/02-前端视图与入口.md:236`：「`apps/web/src/components/canvas/Canvas.tsx` | **不改** | —」
- `docs/nook/03-立绘组件.md:751`（§⑧ 表第 10 行）：「`Canvas.tsx` … 加 `stillPortraits?: boolean` + `playingPortrait` 计算 + `still` 透传 | 03」
- `docs/nook/02-前端视图与入口.md:504`（§⑫-6）又承认「`still` 必须经 `Canvas` 透传」。
- 影响：实现者按 02 §④ 的「不改」清单提交 → 只改 03 → 两篇的责任矩阵对不上；反之若改，02 的「文件与副作用」表对上游撒谎。且 §⑫-6 与 §④ 在**同一篇内**打架。
- 建议修法：02 §④ 该行改为「**改**（`stillPortraits?` prop + `still` 透传；**owner = 03**，02 只依赖）」，并把 §⑫-6 的 prop 名统一为 `stillPortraits`（见 §3.5）。

### 3.5 【MAJOR / 02 vs 03】同一个 `CanvasProps` prop 两个名字

- `docs/nook/02-前端视图与入口.md:504`：`still` 应是 **`CanvasProps`** 的可选 prop。
- `docs/nook/03-立绘组件.md`（§③-4 diff）：`CanvasProps` 加 **`stillPortraits?: boolean`**，`CanvasObjectProps` 加 `still?: boolean`。
- 事实：03 的写法是对的（两个不同层级的 prop 需要不同名字：画布级 vs 叶子级）。02 把叶子级的 `still` 说成画布级。
- 建议修法：02 §⑫-6 改「`stillPortraits` 应是 `CanvasProps` 的可选 prop（`CanvasObjectProps.still` 由 `Canvas` 计算后透传）」。

### 3.6 【MAJOR / 05】A25 的负向断言与已落地 `characterIdOfPath` 语义互斥

- 位置：`docs/nook/05-验收与回归.md:608-615`
  ```js
  // 复核不是「改松 resolveLayer」：子目录卡仍 MUST 404（01 §2.2：characterIdOfPath 段数 ≠ 3 → null）
  await assert.rejects(
    () => service.arrangeCards({ layout: { mode: 'grid', paths: ['characters/ryo/letters/unsent.md'] } }),
    (err) => { assert.equal(err.code, 'not_found'); return true; }, …);
  ```
- 事实：落地 `characterIdOfPath('characters/ryo/letters/unsent.md')` 实测返回 `'ryo'`（不是 `null`）——函数**没有**「段数必须 = 3」的约束（`characters.ts:46-53` 只取第一段）。契约 §5.2 `:288` 也写 `characters/<id>/… → id`。故按落地函数实现 nook 分支后，该 layout 调用会**成功**，`assert.rejects` **必红**。
- 同时 `docs/nook/01-取数端点.md:61-62` 明确写「子目录卡 `characterIdOfPath` **仍返 `ryo`** → 走 nook 分支，**成功**」，并逐字否定「段数必须 = 3」是**过度约束**。`docs/nook/01-取数端点.md:618` 同结论。
- 影响：05 与 01 对同一函数给出**相反**的行为断言；`05` 的 A25 若照抄进测试，会逼实现者要么改坏 `characterIdOfPath`（违反契约与 B 档实现），要么让 A25 永久红。
- 建议修法（择一，需主 agent 拍板）：
  - **(a) 保持落地语义**：删掉 §3.12 最后一段的 `assert.rejects`，改为正向断言「子目录卡的 layout **成功**且 `details.layer === 'characters/ryo'`」——但这样 A25 就失去了「不是把 `resolveLayer` 改松」的护栏。更精确的护栏应换成**跨 nook** 的负例（A19/`05` 未登记）：`{layout:{layer:'characters/ryo', paths:['characters/other/diary.md']}}` → 必须 `not_found`。
  - **(b) 改 `characterIdOfPath` 为「段数 = 3」**：需 B 档回改已落地函数 + 契约 §5.2 回写，且会让「拖子目录卡」404（01 §2.2 已判定这是错的）。**不推荐**。
- 无论选哪条，`05:947`(W13) 与 `05:608` 的「段数必须正好 3」措辞都必须改掉。

### 3.7 【MAJOR / 04】附A 断言 `isNookEmpty` `P0 纯函数未写`——已被落地推翻

- 位置：`docs/nook/04-占位与回写.md` 附 A.1「现状：**判定函数不存在**。全仓库 `grep isLayerEmpty|isNookEmpty|isEmptyDir` 零命中（`packages/shared/src`、`apps/server/src` 实测）」；附 A.2 表第 4 行「空判定 `isNookEmpty` ❌ P0 纯函数未写」；附 A.3「P0（缺一不可）1. `isNookEmpty(store, id)` 纯函数」。
- 事实：`packages/shared/src/rules/emptiness.ts:36` **已存在** `isNookEmpty`（实测 `typeof isNookEmpty === 'function'`），`index.ts:16` 已 export；`isLayerEmpty`、`directChildrenOf`、`hasInitProduct` 同批落地。
- 影响：04 的「最小闭环清单」把已完成项列为 P0 缺口 → 后续批次重复实现或误判前置未满足。
- 建议修法：A.1/A.2#4/A.3#1 改「✅ 已落地（B 档 `rules/emptiness.ts:36`）；**签名是 `isNookEmpty(files: readonly string[], dir: string)`，取 `store.listFiles` 输出，不是 `(store, id)`**」——注意签名形状与 04 写的 `isNookEmpty(store, id)` 不同（纯函数不碰 store），需一并更正。

### 3.8 【MINOR / 04】§⑫-1 建议「`listFiles(prefix)` 全量」与冻结核裁相反

- 位置：`docs/nook/04-占位与回写.md:311`：「建议两边统一为「`listFiles(prefix)` 全量」，待 `01` 拍板。」
- 事实：契约 §5.2 补充落地 `:298-300` 已裁「**不含子目录，只取直接子级**」，且 `nookCardPaths` 已按此落地。01 §⑪ 也裁「不收」。
- 建议修法：改为「已裁（契约 §5.2 + `nookCardPaths`）：**只取直接子级**；回写 `items` 口径统一为 `nookCardPaths(await store.listFiles(nookId), nookId)`」。

### 3.9 【MINOR / 02, 05】契约已撤回的「帧先广播」描述仍留三处

- `docs/nook/02-前端视图与入口.md:167`：「`card_position` 帧先广播成功、HTTP 随后 404」
- `docs/nook/05-验收与回归.md:511`：「`card_position` 帧先广播、HTTP 随后 404」
- `docs/nook/05-验收与回归.md:558`：「（card_position 帧先广播、HTTP 随后 404）」
- 事实：契约 §3.7 已留痕更正——广播在 `await arrangeCards` **成功之后**（`routes/world.ts:609-611` 实测：`const r = await …arrangeCards(…)` → `eventBridge.broadcast(…)` → `res.json`），抛错时**不发帧**；「弹回去」的成因是前端乐观更新回滚。`01 §⑬ 冲突 7` 已同款更正。
- 影响：02/05 若照此描述去「去重帧」是白费力气（不改行为，只改叙事），且与契约文本矛盾。
- 建议修法：三处改为「动作层抛错 → 路由 404 → **不发帧**；前端 `useWorld.moveCard` 乐观更新回滚 → 表现为弹回」。

### 3.10 【MAJOR / 03】`CARD_FORMS.portrait` 写 `288×384`，与契约冻结的 `360×480` 不一致

- 位置：`docs/nook/03-立绘组件.md:86`（§2.1(3) diff）、`:164`+`:174`（§③-1 裁决）、`:437`（CSS 注释 `(288×384)`）
- 事实：契约 §3.5 `:165` 冻结 `CARD_FORMS.portrait = { label: 'Portrait', w: 360, h: 480, chrome: 'bare' }`。03 把它改写为 `{ w: 288, h: 384, chrome: 'bare' }` 并**直接写进实现 diff**，而非只登记冲突。
- 影响：契约 §0 权威层级第 1 条（本文件冻结的形状）要求子文档「MUST NOT 自行改动」。若照 03 的 diff 落地，`05 §3.9 :489` 与 `02 §⑪-6 :470` 引用的「现行版 `360×480`」即失效，且 05 fixture 若用到该行需同步。比值（3:4）一致，仅绝对值分歧——但**数值是冻结值**。
- 建议修法：二选一，**由主 agent 拍板**：
  - 维持契约 `360×480` → 03 §2.1(3) diff / §③-1 / CSS 注释全部改为 `w: 360, h: 480`；
  - 采纳 03 的 `288×384` → **先把契约 §3.5 回写为 `288×384`**，再让 02 §⑪-6 / 05 §3.9 同步（现两处均记 `360×480`）。

### 3.11 【MINOR / 05】`isValidCharacterId` 落点在同一篇内自相矛盾

- 位置：`docs/nook/05-验收与回归.md:185`：「`isValidCharacterId(id: string): boolean` 是唯一正则实现处（`NookRoute01` 2026-09-13 定稿于 `apps/server/src/routes/world.ts`，导出，可从 `apps/server/dist/routes/world.js` import）」
- 位置：同篇 `:652`：「**不是** `apps/server/dist/routes/world.js`——…**`packages/shared/src/rules/characters.ts`**」
- 事实：落地在 `packages/shared/src/rules/characters.ts:24`，`index.ts:15` 已 export。
- 建议修法：`:185` 改为「落点 `packages/shared/src/rules/characters.ts`（契约 §5.2），测试 `import { isValidCharacterId } from '../dist/index.js'`」。

### 3.12 【MINOR / 01 vs 05】两套 `A<n>` 断言编号命名空间冲突

- `docs/nook/01-取数端点.md` §12.2 用 A1–A20（A1 = 不存在角色 404，A8 = 子目录排除，A16 = place）。
- `docs/nook/05-验收与回归.md` §3.0 用 A1–A27（A1 = 200 + 非空，A8 = footprint 200，A16 = portrait registry）。
- 事实：`02:504`/`03`/`04` 在正文里引用了 A13/A23/A25，而 `01` 的 `§12.2` 同名编号含义完全不同。跨篇引用「A13」无法判定指谁。
- 建议修法：05 的编号加前缀（如 `N1-A13`），或 01 §12.2 改为「本片断言 `01-A<n>`」并在 05 §3.0 逐一列出映射表。

### 3.13 【MINOR / 01】`§2.3` 标题重复且正文不同

- 位置：`docs/nook/01-取数端点.md:44` 与 `:50` 两处 `### 2.3 GET /api/nook 的入参`。
- 差异：`:44` 版写「服务端用 `nookIdOf(id)` 拼 nookId」；`:50` 版写「服务端拼 `characters/${id}`」。按契约 §5.2 与 01 §③ 步骤 3，实现是 `const nookId = \`characters/${id}\``（不调 `nookIdOf`），故 `:50` 版是对的。
- 建议修法：删去 `:44` 那一段（保留 `:50`），或把两段合并为一。

### 3.14 【MINOR / 00, 04, 05】`index.ts` barrel 警告行号三处过期且互不相同

- 契约 §5.2 `:291` 写 `index.ts:44-46`；04 `:32` 与 05 `:654` 写 `index.ts:42-44`；实际注释在 `packages/shared/src/index.ts:49-50`。
- 建议修法：统一改为 `index.ts:49-50`（或去掉行号改符号引用——契约 §5.6 自己的纪律就是「行号漂移以符号名重定位」）。

### 3.15 【MINOR / 00 vs 01/02/04】`arrangeCards` nook 分支的 owner 署名未统一

- 契约 §3.7 要点 4：署名 **02**（「`02-前端视图与入口` own 前端入口与这条摆放通路」）。
- `01-取数端点.md:2`（头部）与 `02 §8.4 :389`：两篇自行对齐为 **01 实现**。
- `04 §④ :45`：「`arrangeCards`（§3.7 归 `02`/`01`）」——未决。
- 影响：交付时两个 owner 都可宣称「不是我」，或两边各改一版（正是契约 §3.7 要点 4 明令禁止的）。
- 建议修法：主 agent 回写契约 §3.7 要点 4 为「**01 实现**（与 01 的服务端动作层同侧）；02 只消费」，并让 04 §④ 同步。

### 3.16 【MINOR / 03 vs 02, 05】`portrait` 六处同步的测试计数：03 说 6 个 `18`，契约/05 说「5 处」

- 契约 §5.3 表第 6 行与 `05 §3.9 :456` 均写「**5 处**：`:35/:37/:96/:180/:192`」。
- `03 §2.1(6) :138` 实测纠正：`grep -n "18"` 命中 **5 行、6 个 `18`**（`:37` 行内两个），且 `:35` 是 **test 标题**不是 assert——并指出契约把它列为 assert 不精确。
- 事实：contract §5.3 现文仍写「`:35`（`assert.equal(kinds.length,18)`）」——与代码不符（`:35` 是 `test('T2: the registry holds 18 kinds…')`）。03 的纠正正确。
- 建议修法：契约 §5.3 第 6 行按 03 的实测表回写（区分标题/文案/assert），05 §3.9 表头「共 5 处」改为「6 个 `18`（5 行）」。

---

## 4. 契约冻结遵守（逐条）

| 冻结项 | 遵守者 | 违逆者 |
|---|---|---|
| `nookId = characters/<id>`，`?character=<裸 id>` | 01/02/03/04/05 ✅ | — |
| `GET /api/nook` 复用 `LayerState` 形状、`scene` 缺 README 不合成 stub | 01 ✅；02 §3.8 空态 ✅ | — |
| `cards.layer = 完整 nookId` | 01/02/04 ✅ | — |
| `POST /api/card/footprint` 只加 nook 分支、不改形状 | 04 ✅（01 §4/§⑥ 亦只读引用） | — |
| `arrangeCards` 两条分支同型修法、`resolveLayer` 语义不动 | 01 ✅；02 §8.4 代码 ❌（`nookIdOf(path)` 误用） | 02 |
| `portrait` kind：`pack/字段/回退/性能` | 03 ✅ | — |
| **`CARD_FORMS.portrait = 360×480`** | — | **03（写 `288×384`）❌** |
| 唯一校验函数三/四处调用 | 01/04 ✅；02 §8.4 ❌（另起 `nookIdOf(path)` 语义） | 02 |
| 不新增帧 / 不新增事件 `type` | 全部 ✅ | — |
| 不改 `docs/prompts/03` 提示词 | 全部 ✅（`NOOK_INIT_INSTRUCTION` 未被任何篇改动） | — |
| `pnpm test` → `node --test` | 全部 ✅ | — |

---

## 5. 必须回写的文档清单

| # | 目标 | 位置 | 改成 | owner |
|---|---|---|---|---|
| R1 | 契约 `00` §3.5 | `:165` | ✅ **已裁决：`288×384`**（契约已改）；02 `:470`、05 `:489`、03 `:86/:164/:174` 一律按 `288×384` 同步 | 02/03/05 |
| R2 | 契约 `00` §3.7 要点 4 / §3.7.1 | `:212`/`:224` | ✅ **已裁决：明确 01**（去掉「或 02」）；02 只 own 前端入口 | 主 agent |
| R3 | 契约 `00` §5.3 表第 6 行 | `:313` | ✅ **已裁决**：改为「**5 行 / 6 个 `18`，其中 4 个是 assert**；`:35` 是 test 标题」 | 主 agent |
| R4 | 契约 `00` §5.2 / `04 :32` / `05 :654` | — | ✅ **已裁决：删行号改符号引用**（契约 §5.2 已落笔）；04/05 一并改 | 主 agent/04/05 |
| R5 | `01` §2.1/§2.4/§④/§⑨ | `:27 :102 :264 :631` | `nookCardPaths` 标「已存在」+ 补 `readonly` | 01 |
| R6 | `01` §⑨ 伪码 | `:446` | 补第二实参 `, nook` | 01 |
| R7 | `01` §2.3 | `:44-49` | 删重复段（保留 `:50` 版） | 01 |
| R8 | `05` §3.0 / `01` §12.2 | 全表 | ✅ **已裁决：05 加 `N1-` 前缀**（如 `N1-A13`），02/03/04 引用处同步 | 05/02/03/04 |
| R9 | `02` §8.4 | `:395 :406` | `nookIdOf(characterIdOfPath(...) ?? '')`（Main 已实测确认 §3.1） | 02 |
| R10 | `02` §④ | `:236` | ✅ **已裁决**：`Canvas.tsx` **改**（`stillPortraits?`+`playingPortrait`+透传 `still`），owner=03；02 只 own 调用侧 `<Canvas stillPortraits={reduceMotion} />` | 02 |
| R11 | `02` §⑫-6 | `:504` | ✅ **已裁决**：`CanvasProps.stillPortraits`（画布级）/ `CanvasObjectProps.still`（卡级） | 02 |
| R12 | `02` §3.5 / `05` §3.11 | `02:167`、`05:511 :558` | ✅ **已裁决**：删「帧先广播」；`02:167` 点名 02 owner 落笔 | 02 / 05 |
| R13 | `03` §2.1(3)/§③-1 | `:86 :164 :174` | 尺寸与契约 R1 结论同步 | 03 |
| R14 | `04` 附A | A.1 / A.2#4 / A.3#1 | `isNookEmpty` 改「✅ 已落地」，签名更正为 `(files, dir)` | 04 |
| R15 | `04` §⑫-1 | `:311` | 「已裁：只取直接子级，用 `nookCardPaths`」 | 04 |
| R16 | `05` §3.2 | `:185` | `isValidCharacterId` 落点改 `rules/characters.ts` | 05 |
| R17 | `05` §3.12 A25 | `:608-615` | ✅ **已裁决**：保持落地 `characterIdOfPath` 语义；护栏换成**跨 nook 负例** `{layout:{layer:'characters/ryo', paths:['characters/other/x.md']}}` → `not_found`；删「段数必须正好 3」 | 05 |
| R18 | `05` §4.2 | `:652` | 函数清单补 `nookCardPaths`（已落地） | 05 |
| R19 | `05` §3.0 | 全表 | 断言编号与 `01 §12.2` 建立映射 | 05 |
| R20 | `05` §3.9 | `:456` | ✅ **已裁决**：改「5 行 / 6 个 `18`，其中 4 个是 assert」 | 05 |

---

## 6. 闭环性（断言 ↔ 实现落点一一对应）

逐条查 `05 §3.0` 的 A1–A27 是否有唯一实现落点：

| 断言 | 实现落点 | 闭环？ |
|---|---|---|
| A1–A6, A17, A26 | 01 `GET /api/nook` | ✅ |
| A7 | 01「不落事件」（无实现，仅约定） | ✅ |
| A8–A12 | 04 footprint nook 分支 | ✅ |
| A13/A14/A27 | 01 `seatUnplaced` 两行修复 | ✅ |
| A15/A16 | 03 六处同步 | ✅ |
| A18–A20 | CLI 门禁 | ✅ |
| A21 | 05 §8.1 探针（05 自 own） | ✅ |
| A22 | 已有 `/api/asset` | ✅ |
| A23/A24 | 01/02 归属未定（见 §3.15） | ⚠️ |
| **A25** | 01/02 + **与落地 `characterIdOfPath` 互斥**（见 §3.6） | ❌ |

**漏项**：无「断言了但无人实现」的项；`A25` 是反向问题（**没人能实现**）。补一条建议：加「跨 nook layout 必须 404」的负向断言，替换 A25 现有负例（护栏目的不变，且与落地函数自洽）。

---

## 7. 诚实性核查

- 抽查 `01 §⑫ A13` 声明的实测输出（`distinct positions: 2 / distinct centers: 1 / distinct z: 1`，`01:546-552`）——与契约 §2.7 的 `1/3` 现象描述**同一现象、不同 fixture**，`01` 已自陈差异，未见编造。
- 抽查 `05 §3.10 A22`：「05 只登记 `[手测]`/可选断言」——确实未冒充自动断言 ✅。
- 抽查 `03 §10.8`：「MUST NOT 用 `ffprobe` 的 `alpha_mode` tag 当证明」——与 `SKILL.md` 警告一致 ✅。
- 抽查 `00 §2.5`：「`pnpm test` 不存在」——实测 `package.json` scripts 无 `test` ✅。
- **未发现「把未知伪装成已定」**。已知未决项（`portrait` 尺寸、A23 归属、`useStill` 落位）均显式标「待拍板」。

---

## 8. 评审员结论

本批文档的**事实密度与自我留痕质量都高于一般水平**（契约的「撤回广播」、01 §⑬ 冲突 7、05 §11.6 的独立复现，都是好实践）。不通过的原因不是「写得浅」，而是**冻结契约在落地过程中被多处私下偏移，且这些偏移已经写进了可执行 diff**：

1. 02 §8.4 的 `nookIdOf(path)`（签名误用，落地即返 null）；
2. 01 §⑨ 的 `nookCardPaths(单参)`（落地即静默返空）；
3. 03 的 `288×384`（覆盖契约冻结的 `360×480`）；
4. 05 A25 的负向断言（与已落地 `characterIdOfPath` 互斥，无法同时满足）；
5. 02 §④ 的「`Canvas.tsx` 不改」（与 03 及 02 §⑫-6 冲突）。

其中 (4) 需要一次**契约级裁决**（子目录卡归属语义），其余四项是机械回写。R1–R20 全部落地后，本维度可复审通过。


---

## 附：本评审的机械核验（`node -e` 走 `packages/shared/dist`，2026-09-13）

```
$ node -e "import('./packages/shared/dist/index.js').then(m=>{…})"
kinds 18                        # portrait 未落地
has portrait false
characterIdOfPath('characters/ryo')                  -> 'ryo'
characterIdOfPath('characters/ryo/letters/unsent.md') -> 'ryo'      # ← A25 的断言与它互斥（§3.6）
characterIdOfPath('characters/README.md')            -> null
nookCardPaths(['characters/ryo/desk.md'])                       -> []          # ← 单参静默返空（§3.2）
nookCardPaths(['characters/ryo/README.md','characters/ryo/desk.md',
               'characters/ryo/sub/deep.md'],'characters/ryo')  -> ['characters/ryo/desk.md']
typeof isNookEmpty -> function   # ← 04 附A「不存在」已被推翻（§3.7）
```

`packages/shared/src/rules/characters.ts:65` 的落地签名：
`nookCardPaths(allFiles: readonly string[], nookId: string): string[]` —— `nookId` **必填**。


---

## 9. 裁决回执（Main，2026-09-13，评审后广播）

| 编号 | 裁决 | 本报告的对应条目 |
|---|---|---|
| 裁决 1 | `CARD_FORMS.portrait` **= `w:288, h:384, chrome:'bare'`**（初稿 `360×480` 作废）；契约 §3.5 已改，02/03/05 一律按 `288×384` | §3.10、R1、R13 |
| 裁决 2 | **保持已落地 `characterIdOfPath` 语义**（只取第一段，子目录返 id）；05 的 A25 护栏换成**跨 nook 负例**（`layer:'characters/ryo'` + `paths:['characters/other/x.md']` → `not_found`） | §3.6、R17 |
| 确认 | §3.1（02 的 `nookIdOf(path)`）、§3.2（01 的单参 `nookCardPaths`）、§3.3（01 标 NEW）、§3.4/§3.5（`Canvas.tsx` 归属与 prop 名）、§3.7（04 附A `isNookEmpty`）、§3.9（帧先广播）、§3.11（05:185 落点）**均由 Main 逐条实测确认** | R5–R16、R18 |

**仍未获裁决者**：R2（契约 §3.7 要点 4 的 owner 署名）、R3（§5.3 第 6 行 `18` 计数措辞）、R4（`index.ts` 行号）、R7/R8（01 的重复小节与断言编号）、R12 的一部分（02 侧删除）、R19（A 编号映射）、R20（05 §3.9 计数措辞）。这些不影响本维度的其余结论。


### 9.1 第二轮裁决回执（Main，2026-09-13）——残项全部闭合

| 编号 | 裁决 | 落地状态 |
|---|---|---|
| R2 | `arrangeCards` owner **明确 01**（契约 §3.7 要点 4 + §3.7.1，去掉「或 02」） | Main 回写契约 |
| R3 / R20 | `components.test.mjs` 改为「**5 行 / 6 个 `18`，其中 4 个是 assert**」（`:35` 是 test 标题） | Main 改契约 §5.3；05 §3.9 跟随 |
| R4 | **删行号改符号引用**（三处行号全错，实测注释在 `index.ts:49-50`） | Main 已落笔；04/05 跟随 |
| R8 / R19 | **05 加 `N1-` 前缀**（`N1-A13` 等），02/03/04 引用处同步 | 05 落笔，02/03/04 跟随 |
| R7 | 01 §2.3 删重复标题（保留 `:50` 版正文） | 01 落笔 |
| R12 | `02:167` 删「帧先广播」 | 02 落笔 |

**本报告的全部 20 条回写项至此均已裁决或分配 owner，无悬空项。** 我这边不再有新增发现；实现前的门禁结论不变：**整批不通过 → 完成 R1–R20 回写后可复审通过。**
