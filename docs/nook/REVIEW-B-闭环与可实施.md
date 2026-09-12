# REVIEW-B — 闭环性 + 可实施性（N1 角色小天地 · 评审门）

> 评审人：`ReviewB`。日期 2026-09-13。范围：`docs/nook/{00,01,02,03,04,05}`（`RESEARCH-初始化链路.md` 不属 N1 实现范围，仅在其结论与本批交叉时引用）。
> **只读评审**：未改动任何被评审文件；本文是唯一产出。
> 评审基线：
> - 契约 `docs/nook/00-共同上下文.md`（现行版，含 §2.7 两行修法、§3.7/§3.7.1、§5.2 已落地函数、§3.5 尺寸裁决 `288×384`）；
> - **已落地代码**：`packages/shared/src/rules/characters.ts`（含 `nookCardPaths`）、`rules/emptiness.ts`（含 `isNookEmpty` / `directChildrenOf`）、`packages/shared/src/index.ts:15-17` 已 export；
> - 工作树 HEAD `ebf614a`（wiring A 档刚落地，`useWorld.ts` / `App.tsx` 行号已随之漂移）。
> 方法：每条「符号是否存在」用 `read`/`grep` 读源码；每条「行为」用 `node --input-type=module` 走 `packages/shared/dist` 实测。凡未经实测者标 `[推断]`。

---

## 0. 裁决（本维度：闭环性 + 可实施性）

| 文档 | 裁决 | 理由（本维度） |
|---|---|---|
| `00-共同上下文.md` | **通过**（2 处回写待办） | 每项动作都有落点与 owner；§3.7/§3.7.1 的修法可机械照抄；§5.2 已如实标注「已落地」，引用链完整。残留：§3.7 要点 4 的 owner 署名（与 01/02 现行写法不一致）、§5.3 第 6 行把 test 标题当 assert |
| `01-取数端点.md` | **有条件通过** | 主线落点具体到函数、逐行对照表可用；但 **§⑨ `:446` 的 `nookCardPaths` 单参调用实测静默返 `[]`（实现即错）**、`nookCardPaths` 标 NEW（已落地）、测试文件落点与 05 不一致 |
| `02-前端视图与入口.md` | **不通过** | **§8.4 `:395` 把 `nookIdOf(path)` 当 path→nookId 用（实测返 `null` → place 分支仍 404）**；**§④ `:236`「`Canvas.tsx` 不改」与 03 §⑧-10 及自身 §⑫-6 直接冲突 → `still` 透传没有落点**；§8.1 的 `App.tsx` 行号表全表失效；§3.5 帧序描述与契约 §3.7 已更正的事实相反 |
| `03-立绘组件.md` | **有条件通过** | 六处同步逐处给 diff、渲染/回退有完整可抄代码；但 **同一位置给出两段互斥实现**（`Canvas` 内联算 `playingPortrait` vs 调 `portraitPlayStateOf`），且 `KIND_WORD` 这个第 7 个 kind 消费点未登记 |
| `04-占位与回写.md` | **有条件通过** | 写侧门禁 diff 精确、`writeFootprints` 行匹配的实证扎实；但 **§⑫-1 建议「两边统一为 `listFiles` 全量」与已冻结的「只取直接子级」裁决相反**、**§附A 的「`isNookEmpty` 不存在 / P0 未写」已被落地代码推翻** |
| `05-验收与回归.md` | **不通过** | **A25 的子目录负向断言与已落地 `characterIdOfPath` 互斥（实测子目录返 `'ryo'`）→ 该断言无人能满足**；**`:185` 把 `isValidCharacterId` 落点写成 `apps/server`**；**A18 断言 `findings === 14` 已过期（今日实测 9）→ 正确实现会被这条判红** |

**整批裁决：不通过（需回写后复审）。** 本维度下的病因不是「写得不深」，而是三类：
① **3 处实现即错的代码片段**（`nookIdOf(path)`、`nookCardPaths` 单参、A25 负例）——照抄即错；
② **1 处改动落点自相矛盾**（`Canvas.tsx` 改不改）；
③ **行号纪律失守**——`useWorld.ts` / `App.tsx` 全体引用漂移 20–50 行，而 02 恰是**以「`useWorld` 零改动」为论证核心**的一篇，行号一漂，该论证就不再可核。

---

## 1. 必答：`storedSizeOf` / `declaredSizeOf` 在当前代码里真的拆了吗？

**答：真的拆了，且不是 F1 文档的设想——它在 HEAD 上已是既成事实。**

| 事实 | 证据 |
|---|---|
| 两个函数**各自独立存在**，且 `storedSizeOf` 内部**调用** `declaredSizeOf` | `apps/server/src/routes/world.ts:161`（`declaredSizeOf(item): {kind;w;h}`）、`:171`（`storedSizeOf(item, row)`）——后者 `:175` 调 `const declared = declaredSizeOf(item)` |
| 出现在 **F1 批次的 commit**，非本批新增 | `git log -S "function storedSizeOf" -- apps/server/src/routes/world.ts` → 仅 `b2e19e4 feat(footprint)`；`git show HEAD:...world.ts` 直接在 `:161`/`:171` 命中 |
| 语义确实分叉（不是同一函数两个名字） | `declaredSizeOf` 只读 `cardFormOf`（= `CARD_FORMS` 声明值）；`storedSizeOf` 走 `boxSizeOf(row, declared)`（`actions/canvas.ts:92`，**行值优先**），并对退化行 `console.warn`（`world.ts:176-179`） |
| 二者**消费点**正是本批要复用的坐席逻辑 | `world.ts:412`（`seatUnplaced` 入参用 `storedSizeOf`）、`:424`（`reseatLayer` 入参用 `declaredSizeOf`）、`:431`（`enriched` 用 `storedSizeOf`） |

**对任务书附带问句的更正**：`storedSizeOf` / `declaredSizeOf` **与契约 §5.3 无关**。§5.3 讲的是「**新增 kind 的六处同步点**」（`COMPONENT_KINDS` / `COMPONENT_SCHEMAS` / `CARD_FORMS` / pack / registry 核对 / 测试计数），与尺寸函数无关。footer 前一次说「已拆」是对的；把二者关联到 §5.3 属误置。
**且 01 篇 §⑨ `:640` 引用的 `declaredSizeOf`(`:161`) / `storedSizeOf`(`:171`) 行号今日复核全部准确**——这是契约 §2.x 中少数未经漂移的服务端引用。

---

## 2. 引用符号 → 是否存在 → 位置（验证表）

**方法**：`grep` 读源码 + `node --input-type=module -e "import('./packages/shared/dist/index.js')"` 实测。「存在?」为 ❌ 者才是缺陷；标 `已落地` 者说明实现已存在（文档若仍标 NEW 即为缺陷）。

### 2.1 共享层 / 服务端

| 被引符号 | 引用处 | 存在? | 实测位置 / 备注 |
|---|---|---|---|
| `declaredSizeOf` | 01 §⑨ `:640`、§③ 步骤 6 | ✅ | `routes/world.ts:161`（**行号准确**） |
| `storedSizeOf` | 01 §⑨ `:640`、§③ 步骤 6 | ✅ | `world.ts:171`（**准确**） |
| `readLayerBg` | 01 §③ 步骤 5 `:182` | ✅ | `world.ts:190`（准确）；返回 `{src,tone,grain}` 与契约 §5.1 同形 |
| `readLayerAudio` | 01 §③ 步骤 5 `:183`、04 §2.3 | ✅ | `world.ts:274`（准确）；签名 `(fm, store, audioRoot)` 与 01 调用一致 |
| `AUDIO_ROOT` | 01 §③ 步骤 5 | ✅ | `world.ts:300`（准确，闭包内 `const`） |
| `rotOf` | 01 §③ 步骤 6、§⑨ `:640` | ✅ | `world.ts:84`（准确） |
| `boxSizeOf` | 01 §⑨ `:640`、04 §2.3 | ✅ | `actions/canvas.ts:92`（`export`，`world.ts:11` 已 import） |
| `pageOfLayer` | 01 §③ 步骤 4（作**反面**引用） | ✅ | `local-store.ts:1497`；`listFiles()` 无 prefix 在 `:1498` ✅ |
| `seatUnplaced` | 01 §2.1 `:28`、§6.4、04 §2.3、05 §4.2 | ✅ | `local-store.ts:580`（准确）；`580-657` 范围准确 |
| `reseatLayer` | 01 §2.1、04 §2.3、05 §3.7 | ✅ | `local-store.ts:690`（准确） |
| `seatNear` | 01 §6.4 边界表、05 §4.2 | ✅ | `local-store.ts:1157`（准确） |
| `writeFootprints` | 04 §2.3、05 §4.2 | ✅ | `local-store.ts:855-911`；**04 引 `:875-881`（无行跳过）实测准确** |
| `applyPlaceCard` | 00 §3.7.1、04 附B | ✅ | `local-store.ts:1010-1038`；**行号准确**，实测「不反查 layer、直写实参」（`:1015-1017`/`:1033-1037`） |
| `placeCard` / `placeCards` | 01 §⑨ `:641`、05 §4.2 | ✅ | `local-store.ts:970` / `:979`（**准确**） |
| `getLayerCards` | 01 §③ 步骤 6 | ✅ | `local-store.ts:565`（准确）；`WHERE id IN (…)` **无 layer 条件**（`:568-571`） |
| `statKind` | 01 §③ 步骤 3、04 §2.3 | ✅ | `local-store.ts:196`（准确）；三态、不抛 |
| `listFiles` | 01 §③ 步骤 4、04 附A | ✅ | `local-store.ts:210-233`；**递归**（`walk` 下钻 `:220-221`）✅ |
| `resolveLayer` | 00 §2.1、01 §⑥.2、04 §9.1 | ✅ | `local-store.ts:550-556`；对 `characters/**` 返 `null`（`:552-555`）✅ |
| `SEAT_ANCHOR` / `SEAT_PAD` | 05 §4.2 `:639-640` | ✅ | `local-store.ts:21` / `:25`（**准确**，均 export） |
| `overlapsOccupied` | 05 §3.7、§8.2 | ✅（**模块私有**） | `local-store.ts:1574`（准确，**无 export**；05 已知并自行复刻） |
| `isValidCharacterId` | 全部六篇 | ✅ **已落地** | `rules/characters.ts:24`；barrel `index.ts:15` |
| `nookIdOf` | 01 §2.2、02 §8.4、04 §2.2、05 §2.2 | ✅ **已落地** | `rules/characters.ts:35`；**只吃裸 id** |
| `characterIdOfPath` | 01 §2.2、02 §8.4、05 §4.2 | ✅ **已落地** | `rules/characters.ts:46`；**子目录也返回 id**（实测） |
| `nookCardPaths` | 01 §2.1 `:27`、§2.4 `:102`、§③ `:159`、§⑨ `:446`、`:663` | ✅ **已落地** | `rules/characters.ts:65`，签名 `(allFiles: readonly string[], nookId: string)` |
| `directChildrenOf` | 00 §5.2 补充 | ✅ **已落地** | `rules/emptiness.ts:19` |
| `isNookEmpty` | 04 §⑫-3、附A.1/A.3 | ✅ **已落地** | `rules/emptiness.ts:48`；签名 `(files: readonly string[], dir: string)`——**不接 store** |
| `hasInitProduct` | —— | ✅ | `rules/emptiness.ts:63` |
| `buildNookInitBrief` | 04 附A.2 #1 | ✅ | `brief-builder.ts:46`（**无调用点**，04 描述准确） |
| `recordLayerInitialized` / `recordLayerInitFailed` | 04 附A.2 #9/#10 | ✅ | `actions/layer.ts:105` / `:146`；注册 `:174`/`:177`（**全部准确**） |
| `NOOK_INIT_INSTRUCTION` 槽 | 04 附A.2 #3 | ✅ | `extensions/instructions.ts:302` 注册，正文 `:239-`（04 写 `:301-305`/`:239-`，准确） |
| `installPreset` | 04 附A.2 #2 | ✅ | `engine/presets.ts:32`；调用点 `launch.ts:106`（writer）/`:149-152`（character）——04 描述准确 |
| `AIRP_TOOLS` | 04 附A.2 #6 | ✅ | `extensions/tools.ts:48-64`（04 写 `:48-` ✅） |
| `spawnAgent` 真实调用 | 04 附A.2 #5 | ✅（**零调用**） | 全仓仅两处注释（`toolkit/actor.ts:13`、`rules/emptiness.ts:54`）——04 准确 |
| `DEFAULT_TURN_TIMEOUT_MS` | 04 附A.2 #7、RESEARCH `:46` | ⚠️ | **存在但行号错**：引 `lifecycle.ts:28`，实际定义在 `:48`（`:28` 是无关注释） |
| `useWorld.moveCard` | 00 §3.7、02 §3.5、05 §3.11 | ✅ | `apps/web/src/state/useWorld.ts:165-189`；catch 回滚 `:185-188`（02/05 引 `:161-164`，**已漂移**） |
| `createFootprintScheduler` | 02 §3.6 | ✅ | `apps/web/src/lib/footprint.ts:93`（准确） |
| `measureHeights` | 02 §3.6 | ✅ | `lib/footprint.ts:73`（准确） |
| `CARD_FORMS` | 03 §2.1、05 §4.2 | ✅ | `schemas/forms.ts:64`（18 个组件行） |
| `COMPONENT_KINDS` | 03 §2.1(1)、05 §3.9 | ✅ | `schemas/components.ts:12-37`（尾项 `'thread'` 在 `:36`） |
| `COMPONENT_SCHEMAS` | 03 §2.1(2)、05 §3.9 | ✅ | `schemas/components.ts:218-237`（**准确**） |
| `COMPONENT_REGISTRY` | 03 §2.1(5) | ✅ | `components/registry.ts:23-25`（准确） |
| `SHOW_REGISTRY` | 03 §2.1(5) | ✅ | `components/registry.ts:27`（准确） |
| `ThreadKindSchema` | 03 §2.1(2)、§⑧ 表 | ✅ | `components.ts:209-212`（03 写 `:201-212 + :213-237`，**准确**；插入点 `:212`/`:213` 之间正确） |
| `ComponentCoreSchema` | 03 §2.1(2)、§③-3 | ✅ | `components.ts:65`；`title` 必需 `:69`（准确） |
| `ClickOutcome` | 03 §③-2 | ✅ | `components/types.ts:20`（准确）；**`'look'` 全仓零使用**（实测 19 个 `click:` 值无 `look`）✅ |
| `SecondLayer` 七档 | 03 §③-2 | ✅ | `types.ts:23-30`（准确） |
| `ComponentDef.movable` 注释 | 03 §③-2 | ✅ | `types.ts:86`（准确） |
| `componentDocOf` / `relatedOf` | 03 §③-2 | ✅ | `registry.ts:118` / `:109-115`（准确） |
| `chalkStyleOf` 的 `card:` 分支 | 03 §③-1 | ✅ | `schemas/forms.ts:186`（准确：`f.card === true \|\| f.chrome === 'paper'`） |
| `CardChrome` 词汇 | 03 §③-1 | ✅ | `forms.ts:37-47`（准确） |
| `craft.ts` 的 `movable:false` | 03 §③-2 | ✅ | `packs/craft.ts:18` / `:46`（准确） |
| `LayerLink` / `PresenceEntry` | 01 §③ 步骤 7 | ❌ **[推断]** | **shared 与 server 均无此类型**（grep 零命中）；只存在于 `apps/web/src/state/useWorld.ts:24`/`:32`。见 §4 N9 |
| `LayerState` / `LayerItem` | 全部 | ✅ | `apps/web/src/state/useWorld.ts:39-48` / `:10-22`（准确） |
| `createWorldRouter` | 05 §4.2 `:650` | ✅ | `routes/world.ts:289`（准确）；**5 参签名**与 05 §8.2 的 `mountWorld` 调用逐参吻合 |
| `EventBridge` | 05 §4.2 | ✅ | `engine/event-bridge.ts`；`world_event` 广播点 `:289`（01 §7.1 引 `:280`，**漂移 9**） |
| `LAYOUT_MODES` | 01 §6.3.1 | ✅ | `schemas/canvas.ts:90`；使用 `actions/canvas.ts:483-484` |

### 2.2 前端

| 被引符号 | 引用处 | 存在? | 实测位置 / 备注 |
|---|---|---|---|
| `Canvas` / `CanvasProps` | 02 §8.3、03 §③-4 | ✅ | `components/canvas/Canvas.tsx:16-32`（**准确**）；6 必填 + 9 可选——**02 §⑫-1 的逐一核查与源码一致** |
| `CanvasObject` / `CanvasObjectProps` | 03 §③-4 | ✅ | `CanvasObject.tsx:69-79`（props，准确）/`:81-90`（解构，准确）/`:123-176`（返回体，03 写 `:123-175`，差 1）/ sprite 分支 `:144-163`（准确）/ `CardRenderer` 分支 `:164-173`（准确） |
| `onOpenCharacterModal?.(charId)` | 02 §⑫-1 | ✅ | `CanvasObject.tsx:148`（准确，**只在 sprite 分支**） |
| `onItemDropOnTarget?.()` | 02 §⑫-1 | ✅ | `CanvasObject.tsx:117`（准确） |
| `onEnterGate?.(target)` | 02 §⑫-1、§⑪-3 | ✅ | `CanvasObject.tsx:169` → `CardRenderer.tsx:166`（准确） |
| `onDropItemToScene` 显式判空 | 02 §⑫-1 | ✅ | `Canvas.tsx:420`（准确） |
| `onOpenRadialMenu?.()` | 02 §⑫-1 | ✅ | `Canvas.tsx:442`（准确） |
| `CardRenderer` note 分支 | 03 §③-4、§⑨ | ✅ | `CardRenderer.tsx:267-291`（准确）；**确无 image/video 分支**（实测）✅ |
| `CardRenderer.tsx:165-166` 的 gate target | 02 §⑪-3 | ✅ | `:140` 判 gate、`:166` 取 target（准确） |
| `SceneBackdrop.tsx:28-34 / :55-74` | 03 §③-4 | ✅ | `failedSrc` 范式 `:29-33`、video/img 分支 `:55-74`（**准确**） |
| `SceneChalk.tsx:31` | 02 §⑦ | ✅ | `:31` `if (!scene) return null;`（准确） |
| `ParticleLayer.tsx:108` | 03 §③-6、§⑨-5 | ✅ | `:108` `if (document.hidden …) return;`（准确） |
| `matchMedia` 零命中 | 03 §⑨-5 | ✅ | 实测 `apps/web/src` 零命中 ✅ |
| `<video>` 唯一处 | 03 §⑨-2 | ✅ | 实测只有 `SceneBackdrop.tsx:57` 一处 ✅ |
| `.portrait-*` 遮罩块 | 03 §⑨-3、§⑩-7 | ✅ | `index.css:315`(`.portrait-stage`)/`:325`(`.portrait-slot`)/`:327`(`width: min(40vh, 26vw, 360px)`)/`:341`/`:362`/`:426`——**行号与 CSS 值全部准确** ✅ |
| `.portrait__*` BEM 零冲突 | 03 §⑨-3 | ✅ | 实测 `index.css` 无 `portrait__` 命中 ✅ |
| `index.css:1186/1187` 插入点 | 03 §③-5 | ✅ | `:1186` 空行、`:1187` 起是 `/* 6. material skins`（准确） |
| `sprite__name` 先例 | 03 §③-5 | ✅ | `index.css:1173-1185`（准确） |
| CSS 变量 `--kai/--rust/--cream/--hair/--paper/--sage/--ink/--ink-2/--shadow-far` | 03 §③-5 的 CSS | ✅ | 逐个实测均在该文件定义 ✅ |
| `door-open` 图标 | 02 §8.2 | ✅ | `apps/web/node_modules/lucide-react/dist/esm/icons/door-open.mjs` 存在 ✅（备选 `armchair.mjs` 亦存在） |
| `i18n.ts` en/ja 各 32 键 | 02 §⑨ 表 | ✅ | 实测 `en:` 段 32 个键 ✅ |
| `RightSidebar.tsx:6-25 / :138-169 / :122` | 02 §2.4/§8.2/§⑪-2 | ✅ | props `:6-25`、动作行 `:138-169`、头像 fallback `:123`（02 写 `:122`，差 1；fallback 串 `/assets/characters/portraits/lady_1.png` **一字不差**） |
| `routes/world.ts:553` 的 fella fallback | 02 §⑪-2 | ✅ | `:553` `'/assets/characters/portraits/fella_1.png'`（准确） |
| `App.tsx` 落点全体 | 02 §8.1 `:324-329` | ⚠️ | **行号全表失效**，见 §3.1 |
| `useWorld` 落点全体 | 02 §3.6/§⑥/§⑨ | ⚠️ | **漂移 20–50 行**，见 §3.2 |
| `motion-clip.mjs:417` 含 `-an` | 03 §④-2 | ⚠️ | 实际 `:415`（漂移 −2）；结论（无音轨）成立 |

### 2.3 kind 的跨边界消费点（`portrait` 新增后逐一核对 dispatch 点）

| 消费点 | 位置 | 对 `portrait` 的行为 | 判定 |
|---|---|---|---|
| `resolveComponentKind` 循环 | `components/registry.ts:75-78` | `ALL` 顺序试 `match`；03 §2.1(4) 已给 `match` → **命中** | ✅ 已闭环 |
| `COMPONENT_SCHEMAS` 尺寸守卫 | `registry.ts:51-53` | 03 §2.1(2) 已给 schema → **不再 throw** | ✅ |
| `CARD_FORMS` 加载期守卫 | `registry.ts:31` / `:42` | 03 §2.1(3) 已给行 | ✅ |
| `accepts` ↔ `useItemTarget` 守卫 | `registry.ts:47-49` | 03 明确「`accepts` MUST 缺席」，两者皆假 | ✅ |
| `CanvasObject` 渲染分派 | `CanvasObject.tsx:144`（`kind==='sprite'` → else `CardRenderer`） | 03 §③-4 加并列分支，**覆盖** | ✅ |
| `COMPONENT_KINDS` ↔ 注册表键集 / `ComponentKind` 联合 | `components.test.mjs:38`、`components.ts:39` | 03 §2.1(1) 加 | ✅ |
| **`KIND_WORD` 文本视图词表** | **`render/layer-page.ts:21-28`** | **无 `portrait` 键 → `KIND_WORD[kind] ?? KIND_WORD.default` → 文本视图把立绘称作 `file`** | ❌ **未登记（第 7 个同步点）**，见 F-12 |
| `Minimap` 的 kind 着色 | `chrome/Minimap.tsx:121/123` | 只特判 `gate`，其余同色 | ✅ 无需分支 |
| `Canvas.tsx:112` gateOrdinal | `Canvas.tsx:112` | 只挑 `gate` | ✅ |
| `CanvasObject.tsx:140` 旋转三元 | `:140` | 只特判 `chalk`/`sprite`（03 §③-5 明确要求**不**加 `portrait`） | ✅ |
| `render/events.ts:216` | 只特判 `chalk` | ✅ 无关 |

> **实测（走 dist）**：`kindWordOf({type:'component',component:'portrait',title:'X'},'p.md')` → `'note'`（不是 `'portrait'`，也不是 `'file'`——因为 `cardKindOf` 今日解析不出 `portrait`，落 `note`；等 03 落地 kind 后才会变成 `KIND_WORD.default` 即 `'file'`）。**两种情形下文本视图都不会说「立绘」**。

---

## 3. 行号失效清单（旧 → 新）

> 依据：契约 §5.6「引用现状 MUST 带 `file:line`；行号漂移以符号名重定位并更新文档」。基线为今日工作树 HEAD `ebf614a`。

### 3.1 `apps/web/src/App.tsx`（02 §8.1 落点表 —— **全表失效**）

| 02 引用 | 今日实际 | 漂移 | 用途 |
|---|---|---|---|
| `:47`（`activeModalCharId` 旁） | `:47` | **0** ✅ | 新状态插入点（侥幸命中：wiring 批次在**其后**插入） |
| `:227-243`（`handleEnterGate` 旁） | `:253-279`（`handleEnterGate` 起 `:253`） | +26 | 新回调插入点 |
| `:256-264`（Esc handler） | `:281-289` | +25 | Esc 让路（**会改错位置**） |
| `:267`（`handleSelectChoice`） | `:293` | +26 | 复用回调 |
| `:284`（`handleTakeItem`） | `:310` | +26 | 复用回调 |
| `:509-549`（渲染三元） | `:535-578`（`<Canvas` 起 `:536`） | +26 | **主渲染分支插入点** |
| `:516-520`（`sceneCopy`） | `:542-546` | +26 | Canvas 实参复制 |
| `:553-567`（`RightSidebar` 传参） | `:579-593` | +26 | `onOpenNook` 传入点 |
| `:148-152`（`airp:world-event` 消费） | `:148-152` | **0** ✅ | 「既有消费者」的论证 |
| `:133-137`（toast） | `:138-142` | +5 | 02 §⑦ 的「不用 toast」论证 |

**影响**：02 的三处关键改动（Esc、渲染三元、`RightSidebar` 传参）**照抄行号会插进别人的代码块**。而 §8.1 是「精确到文件与函数」这一交付要求本身。

### 3.2 `apps/web/src/state/useWorld.ts`（02/04 引用 —— **全体漂移**）

| 引用处 | 引用值 | 今日实际 | 漂移 |
|---|---|---|---|
| 02 `:73`/§⑥/§⑨/§⑫-2（唯一 `new WebSocket`） | `:258` | **`:308`** | +50 |
| 02 §3.5 `:167`、§⑨、05 `:511`（`moveCard` 失败回滚） | `:161-164` | **`:185-188`** | +24 |
| 02 §3.6 `:200`、§⑨-6、§⑪-1（footprint 调度器） | `:187-217` | **`:237-267`** | +50 |
| 02 §⑥ `:260`、§⑨、§⑪-5（`airp:world-event` 转发） | `:268-275` | **`:318-321`**（`file_changed`/`card_position` 直发）+ **`:224-233`**（`forwardWorldEvent` 按事件 type 过滤） | 位置与**形状**都变了 |
| 02 §3.4 `:146`、§⑨（`refresh()` 导出） | `:122-124`/`:337` | 定义 `:146-148`；导出对象 `:400-410`（`refresh,` 在 `:405`） | +24 / +68 |
| 02 §3.4 `:145`（`enterLayer` 相机约定） | `:126-139` | **`:150-163`** | +24 |
| 04 §③ 步骤 2 `:59`（非 2xx 即抛） | `:198-200` | **`:248-250`**（`post` 内）；fetch 层 `:120-123` | 重构 |
| 04 §⑥ `:105`（`post` 回调 `layer: () => layerRef.current`） | `:192-206` | **`:242-256`** | +50 |

**影响（本维度最重的一处）**：02/04 的**全部「`useWorld` 零改动」论证**都锚在这些行号上（`useWorld.ts:258` 是唯一 `new WebSocket` → 故 `NookView` 不自开 WS；`:268-275` 无条件转发 → 故 `NookView` 直接消费即可）。漂移 50 行后，**结论「照抄 §⑥ 的监听写法即可复用既有转发」在今日代码上已不精确**：`world_event` 的转发现由 `forwardWorldEvent`（`:224-233`）按事件 `type` 过滤，而 02 §⑥ 的伪码监听的是 `msg?.type === 'file_changed'`。两者**恰好都还能工作**（`file_changed` 在 `:318` 仍无条件转发），但 02 引用的「那一段」已不是它描述的那一段。

### 3.3 服务端 / 共享层（少量，但落在「会改错地方」的位置）

| 引用处 | 引用值 | 今日实际 | 漂移 | 备注 |
|---|---|---|---|---|
| 01 §2.1 `:22`、§⑨ `:634`（`/nook` 注册于 `/layer` 之前） | `:373` | **`:374`** | +1 | 「紧邻 `/layer`」不受影响 |
| 01 §⑦.1（`world_event` 广播点） | `event-bridge.ts:280` | **`:289`** | +9 | 论证（不分路径前缀）仍成立 |
| 01 §⑦.1（`fs.watch` 广播） | `:379-384` | **`:358-393`**（`watchWorld` 起 `:358`，广播 `:389-`） | −21 | 论证成立 |
| 04 §9.1（`POST /card/footprint` 门禁） | `world.ts:648-650` | **`:648-650`** | 0 ✅ | 门禁本体 |
| 04 §⑥（`post` 无 WS 帧注释） | `:630-632` | 注释实测在 `:645-650` | +13 [推断] | 论证成立 |
| 05 §4.2（`writeFootprints` 跳过无行） | `local-store.ts:875-881` | **`:875-881`** | 0 ✅ | |
| 04 §9.2（`WHERE id = ?`） | `:872` | **`:872`** | 0 ✅ | |
| 05 §3.7 `:438`（`reseatLayer:803` 的 `nextZ++`） | `:803` | **`:818`** | +15 | 同文件 `:807`/`:826` 的 `occupied.push` **准确** |
| 01 §6.4 边界表（`reseatLayer` 的 push） | `:807`/`:826` | **`:807`**/**`:826`** | 0 ✅ | |
| 04 附A.2 #7、RESEARCH `:46`（超时常量） | `lifecycle.ts:28` | **`:48`** | +20 | `:28` 是无关注释 |
| 01 §2.2 `:65`（`index.ts:22-23` 作 `rules/` 先例） | `:22-23` | **`:29-30`** | +7 | 今日 `:15-17` 是新加 init 段 |
| 01 §2.2 `:71` / 04 §2.2（`index.ts` no-glob 注释） | `:44-46` / `:42-44` | **`:49-50`** | +4~5 | 同一句注释被两篇引成**两个不同行号，且都错** |
| 03 §④-2（`motion-clip.mjs:417` 含 `-an`） | `:417` | **`:415`** | −2 | 结论成立 |
| 03 §④-1/§③-8（`routes/world.ts:887` `sendFile`） | `:887` | **`:889`** | +2 | |
| 03 §③-8（`/api/asset` 段） | `:877-892` | **`:879-893`** | +2 | |
| 03 §③-6（`Canvas.tsx:471-483` 唯一渲染点） | `:471-483` | **`:471-483`** | 0 ✅ | |
| 05 §3.9 / §4.2（`components.test.mjs:35/37/96/180/192`） | 原样 | **全部准确** ✅ | 0 | 见 F-09 附注 |
| 05 §8.2（`smoke-routes.mjs:57-62`、`:17-19`、`:218-220`） | 原样 | `:57-62` 挂载 ✅、`:17-19` import ✅、`:218-220` 收尾 ✅ | ~0 | 文件存在（223 行） |

**汇总**：本批行号失效率 **前端 02 篇 ≈ 100%**，**03 篇 ≈ 95% 准确**，**服务端引用 ≈ 85% 准确**。契约 §0 已写「行号有保质期，实现前用代码复核」，但 02 是把行号当作**交付物**（§8.1 落点表）与**论证依据**（§⑨ 差异表）两用，漂移后两者同时失效。

---

## 4. 未闭环的动作清单（按「谁实现、落在哪个函数、验收在哪」逐条核）

判据：① 有明确 owner；② 有具体函数落点（非笼统描述）；③ 两端同批（跨端字段两侧都有人写/读）；④ 有机械可核验的验收。

| # | 动作 | 落点是否具体 | 闭环? | 问题 |
|---|---|---|---|---|
| N1 | `GET /api/nook` 路由 | ✅ `world.ts` 私有 `readLayerItems` + `router.get('/nook')` | ✅ 闭环（01 实现 / 05 A1 验收） | — |
| N2 | `arrangeCards` place 分支 | ✅ `actions/canvas.ts:457-464` | ✅（01 实现 / 05 A23） | 02 §8.4 的片段**写错**（F-01），照它落地则不闭环 |
| N3 | `arrangeCards` layout 分支 | ✅ `:487-533` 三卡点 | ✅（01 / 05 A25） | 05 A25 的**负例互斥**（F-03） |
| N4 | footprint nook 门禁 | ✅ `world.ts:645-650` | ✅（04 / 05 A8） | — |
| N5 | `seatUnplaced` 两行修复 | ✅ `local-store.ts:653` 后 | ✅（01 / 05 A13+A27） | — |
| N6 | 前端入口（第 4 按钮） | ✅ `RightSidebar.tsx:168` 后 + `App.tsx` 回调 | ✅（02 / 05 §10.4-1） | `App.tsx` 行号全失效（F-04），但落点描述（「跟随按钮之后」）仍可定位 |
| N7 | `NookView` | ✅ `components/nook/NookView.tsx` NEW | ⚠️ **部分闭环** | 02 §3.6 自建 footprint 调度器 + 04 §⑥ 都要求 `layer = nookId`；**但前端从不写不进 `characters/**` 的 `.object`**——`measureHeights()` 扫全局（`footprint.ts:75`）能扫到，`widths()` 由 `NookView` 自建（`state.items`）也对，**这一环是通的**。真正断的是 `useStill` 的落位（03 §③-6 说 `lib/motion.ts` 或 `Canvas` 内，02 §8.3 未给）→ **两个 owner 都只说「落哪由实现者定」**，属「无 owner 的落点」 |
| N8 | `portrait` kind 六处 | ✅ 逐处 diff | ✅（03 / 05 A15+A16） | 第 7 处 `KIND_WORD` 未登记（F-12） |
| N9 | `LayerLink` / `PresenceEntry` 类型 | ❌ **类型不存在** | ❌ **未闭环** | 01 §③ 步骤 7 的伪码 `const links: LayerLink[] = []` **无法编译**；01 已自陈「不许为此在 shared 新增类型导出」→ 应写成裸 `[]` 或本地 `type` 声明。**该片段是「代码落点」章节的一部分，照抄即编译失败** |
| N10 | `still` 通路（画布级 ≤1 播放） | ❌ **矛盾** | ❌ **未闭环** | 03 §③-4/§⑧-10 改 `Canvas.tsx`（加 `stillPortraits` + `playingPortrait` + 透传 `still`）；02 §④ `:236` 白纸黑字「`Canvas.tsx` **不改**」。两者不可能同时为真（F-02） |
| N11 | `portrait` 视频/海报 URL | ✅ `assetUrl` 拼 `/api/asset?path=` | ✅（03 写 / 后端 `/api/asset` 已存在 `world.ts:879`） | 两端同批 ✅ |
| N12 | nook 初始化触发点 | ✅ 只登记（不实现） | ✅ 符合 §4 边界 | 04 的「缺口清单」里有 1 条已被落地代码推翻（F-06） |
| N13 | 空态 | ✅ `NookView` 判 `items.length===0 && scene===null` | ⚠️ | 02 §3.8 的空态判据（`items===0 && scene===null`）与 05 A17（「只有 README + preset.json」也算空态、且它 `scene` 非 null）**互斥**（F-11）；`RESEARCH-初始化链路.md:272` 已独立点出同一冲突 |
| N14 | `arrangeCards` nook 分支的**归属** | ✅ 01 已接（02 只消费） | ✅ | 契约 §3.7 要点 4 仍署名 02（F-13） |

---

## 5. 逐条问题（含 `file:line` + 建议修法）

分级：**BLOCKER** = 照抄即错 / 无法满足；**MAJOR** = 会造成返工或验证失真；**MINOR** = 措辞或失效引用。

### F-01 【BLOCKER / 02】`nookIdOf(path)` 签名误用 —— 落地后 place 分支仍 404

- 位置：`docs/nook/02-前端视图与入口.md:395`（§8.4 代码块）。
- 事实：`nookIdOf`（`packages/shared/src/rules/characters.ts:35`）**只吃裸 id**：`return isValidCharacterId(id) ? 'characters/'+id : null`。实测 `nookIdOf('characters/ryo/desk.md')` → `null`。
- 影响：`const layer = (await store.resolveLayer(place.path)) ?? nookIdOf(place.path);` 对 nook 路径永远得 `null` → `fail('not_found')` → **§3.7 声称已修的通路照抄后仍 404**，05 A23 反而变红。
- 02 自己另一处（`:394` 注释）还写着「`nookIdOf(path)` = path 属于 `characters/<id>/` 时返回…」，与该注释**同段自相矛盾**。
- 修法：改为 01 §6.3 的写法（实测通过）：
  ```ts
  const layer = (await store.resolveLayer(place.path))
    ?? nookIdOf(characterIdOfPath(place.path) ?? '');
  ```
  （实测 `nookIdOf(characterIdOfPath('characters/ryo/desk.md') ?? '')` → `'characters/ryo'`。）

### F-02 【BLOCKER / 02+03】`Canvas.tsx` 改不改 —— 同一批两篇结论相反，`still` 无落点

- 位置：`02-前端视图与入口.md:236`（§④ 表：「`apps/web/src/components/canvas/Canvas.tsx` | **不改**」）vs `03-立绘组件.md:751`（§⑧ 表第 10 行：「`Canvas.tsx` … 加 `stillPortraits?: boolean` + `playingPortrait` 计算 + `still` 透传 | 03」）。
- 同篇内 02 也自相矛盾：`02:504`（§⑫-6）说「`still` 应是 `CanvasProps` 的可选 prop、判据 `portraitPlayStateOf(items)` 由 `Canvas` 调用」——**要求改 `Canvas`**，与 §④ 相反。
- 影响：`NookView` → `Canvas` → `CanvasObject` 三层，中间那层不开口，`still` 被 React **静默丢弃**；L1（≤1 播放）/L3（reduce-motion）全部失效，**且 03 §⑩-6 的 DOM 断言会红**。这是本批最容易「看起来做完其实没接通」的一处。
- 修法：以 03 §③-4 为准，02 §④ 改成「**改**（`stillPortraits?` + `playingPortrait` + `still` 透传；owner = 03）」，并在 02 §⑧ 的 `Canvas` 实参表补一行 `stillPortraits={reduceMotion}`。prop 名统一：画布级 `CanvasProps.stillPortraits`、卡级 `CanvasObjectProps.still`。

### F-03 【BLOCKER / 05】A25 的子目录负向断言与已落地 `characterIdOfPath` 互斥 —— 该断言无人能满足

- 位置：`05-验收与回归.md:608`（注释「子目录卡仍 MUST 404（`01 §2.2`：`characterIdOfPath` 段数 ≠ 3 → null）」）、`:611`（`assert.rejects(… paths:['characters/ryo/letters/unsent.md'] …)`）。
- 事实（实测走 dist）：`characterIdOfPath('characters/ryo/letters/unsent.md')` → `'ryo'`。落地实现**只取第一段**，没有一个「段数 = 3」的判据。
- 影响：按 01 §6.3.1 的修法（`owner = nookIdOf(characterIdOfPath(p) ?? '') ?? resolveLayer(p)`），子目录卡会**成功**走 nook 分支 → `assert.rejects` **永远红**。实现者只能二选一：改坏 `characterIdOfPath`（违反 §5.2 唯一实现）或删掉这条断言。
- 注意：`01:618` 已明确「子目录卡 → 走 nook 分支，**成功**」，与 05:608 **直接对立**。
- 修法：把负例换成**真正的越界**——`layer:'characters/ryo'` + `paths:['characters/other/x.md']` → `not_found`（跨 nook）。同时删掉 `:608` 注释里的「段数 ≠ 3」。

### F-04 【MAJOR / 02】`App.tsx` 行号落点表全表失效（+26 上下）

- 位置：`02-前端视图与入口.md:328`（渲染分支 `:509-549`）、`:329`（`RightSidebar` 传参 `:553-567`）、`:325`（回调 `:227-243`）、`:8`/`:150`/`:422`（Esc `:256-264`）。
- 事实：今日 `App.tsx` 的渲染分支在 `:535-578`、`RightSidebar` 在 `:579-593`、`handleEnterGate` 起 `:253`、Esc 在 `:281-289`——全部 +26 上下（wiring A 档落地所致）。
- 影响：`§8.1` 是本篇的「代码落点」交付物，照抄行号会插错位置；`:47` 侥幸仍对，反而让人误以为全表可用。
- 修法：按符号名重定位后整体回写（见 §3.1 的表）。

### F-05 【MAJOR / 02+04】`useWorld.ts` 引用全体漂移，且 §⑥ 的「照抄这段」已不是那段

- 位置：`02:73`/`:260`/`:423`/`:426`/`:498`（引 `:258`/`:268-275`）、`02:167`/`05:511`（引 `:161-164`）、`04:59`（引 `:198-200`）、`04:105`（引 `:192-206`）。
- 事实：今日 `new WebSocket` 在 `:308`、`moveCard` catch 回滚在 `:185-188`、scheduler 在 `:237-267`；而 `world_event` 的转发已**拆成两个路径**（`file_changed`/`card_position` 在 `:318-321` 直发；`world_event` 走 `forwardWorldEvent` `:224-233` 并按事件 `type` 过滤）。
- 影响：02 §⑥ 的核心论证是「`useWorld` **零改动**，`NookView` 直接消费既有 `airp:world-event`」。论证**仍然成立**，但依据的代码位置与形状已变——不更新就不能「按符号名复核」。
- 修法：02 §⑥/§⑨、04 §③/§⑥ 的行号按 §3.2 表回写；02 §⑥ 的伪码建议加一句「`file_changed` 的转发点在 `useWorld.ts:318-321`（`world_event` 的转发另在 `:224-233`，按事件 `type` 过滤）」。

### F-06 【MAJOR / 04】附A 的「`isNookEmpty` 不存在 / P0 纯函数未写」已被落地代码推翻

- 位置：`04-占位与回写.md:322`（「**判定函数不存在**。全仓库 `grep isLayerEmpty|isNookEmpty|isEmptyDir` 零命中」）、`:324`、`:334`（表格第 4 行「❌ | **`P0 纯函数未写**」）、`:348`（最小闭环清单第 1 项 `isNookEmpty(store, id)`）。
- 事实：`rules/emptiness.ts:48` 已实现 `isNookEmpty(files: readonly string[], dir: string): boolean`（**不接 store**，B 档 commit `99ae55d`），`index.ts:16` 已 export。实测 `isNookEmpty(['characters/ryo/preset.json'],'characters/ryo')` → `true`。
- 影响：P0 清单谎报缺口 → 后续批次会把「已存在的函数」再写一遍（契约反模式 2 的同族：第二份真相）。且 `:348` 的签名 `isNookEmpty(store, id)` 与落地签名**不同**。
- 修法：`:322`/`:324`/`:334` 改为「**已由 B 档落地**（`rules/emptiness.ts:48`，签名 `(files, dir)`，不接 store），本批直接引用」；`:348` 从 P0 清单移除。

### F-07 【MAJOR / 04】§⑫-1 建议「两边统一为 `listFiles` 全量」与已冻结的「只取直接子级」相反

- 位置：`04-占位与回写.md:311`（§⑫-1：「建议两边统一为「`listFiles(prefix)` 全量」，待 `01` 拍板」）。
- 事实：该问题**已被裁决并落地**——契约 `00:298-300` 与 `rules/characters.ts:65` 的 `nookCardPaths` 就是「只取直接子级」的唯一实现；01 §⑪ 用四条理由论证「不收子目录」。
- 影响：`04` 是 footprint 写侧的 owner，它若按「全量」理解 `items`，会误判「`reseatLayer` 的 occupied 是否把嵌套卡算作邻居」——而实际 `items` 里根本没有嵌套卡。
- 修法：`:311` 改为「**已裁决**：`items` 只含直接子级（`nookCardPaths`，`rules/characters.ts:65`）；嵌套 md 既不进页面也不参与坐席。」

### F-08 【MAJOR / 05】A18 断言 `pnpm check:ws` findings 数 === 14 —— 今日实测 9，正确实现会被判红

- 位置：`05-验收与回归.md:112`（A18）、`:673`、`:831`（C6「findings === 14」）、`:839`（JSON `{"findings": 14}`）。
- 事实（今日实测，工作树未改动 WS 面）：`node tools/check-ws-contract.mjs` → `check-ws-contract: 9 finding(s) (24 emitted, 11 consumed, 24 in contract)`，退出码 1；`pnpm check:ws` 因**既有** 9 条 DARK 项**今天就是红的**（非 0 退出）。
- 影响：两条后果。① 数从 14 变 9（wiring 批次改动了转发集合 → `consumed` 上升），`=== 14` 已过期；② 更根本：**「findings 数不变」不是一条能绿的断言**——门禁今天退出码就是 1，实现者无从「通过」。
- 修法：A18 改为「findings **集合不变**（仍是那 9 条 DARK，`emitted/consumed/contract` 三数不变），且**不新增任何 finding**」；并显式写明「命令退出码 1 是既有状态，判据是 `findings.length` 与集合，不是退出码」。（契约 §7 也写「不应改变 findings 数」——同样应改成集合口径。）

### F-09 【MAJOR / 01】`nookCardPaths` 单参调用实测静默返 `[]`

- 位置：`01-取数端点.md:446`（§6.3.1 diff 内）：`nookCardPaths(await store.listFiles(nook))`。
- 事实（实测走 dist）：`nookCardPaths(files)`（缺第二参）→ `[]`（`nookId === undefined` → `directChildrenOf(files, undefined)` 的 `prefix = 'undefined/'` 不匹配任何路径 → 空数组，**不抛**）。
- 影响：layout 分支在「不传 `paths`、只给 nook `layer`」时**静默返回空路径集** → `placeCards([])` → 返回「no cards to lay out」，玩家以为小天地是空的。**这正是该 diff 要修的场景**，照抄即等于没修（且静默）。
- 修法：`nookCardPaths(await store.listFiles(nook), nook)`（01 §② `:663` 的版本是对的）。
- 附注（`nookCardPaths` 的状态标记）：01 §2.1 `:27`、§2.4 `:102`、§⑨ `:631` 都标 **NEW**，但它**已落地**（`rules/characters.ts:65`）。按主 agent 广播应改标「已存在（非 NEW）」，签名补 `readonly string[]`。

### F-10 【MAJOR / 05】`isValidCharacterId` 落点写成 `apps/server`

- 位置：`05-验收与回归.md:185`：「…**定稿于 `apps/server/src/routes/world.ts`，导出，可从 `apps/server/dist/routes/world.js` import**」。
- 事实：落点是 `packages/shared/src/rules/characters.ts:24`，barrel `index.ts:15`；05 自己 §4.2 `:652`/`:654` 写的**正确**（shared + `../dist/index.js`）。
- 影响：同篇两处结论相反；按 `:185` 写的测试会 import 失败。
- 修法：`:185` 改为「`packages/shared/src/rules/characters.ts`（`index.ts:15` 已 export）；测试 `import { isValidCharacterId } from '../dist/index.js'`」。

### F-11 【MAJOR / 02+05】空态判据两篇互斥

- 位置：`02:216`（§3.8 步 16：「`state.items.length === 0 && state.scene === null`」）vs `05:111`（A17：「`characters/sumi`（只有 README + preset.json）→ 200 且 `items === []`、**`scene` 非 null**」也要走空态）。
- 事实：按 02 的判据，`sumi`（有 README）的 `scene` 非 `null` → **不渲染空态**；而 05 A17 断言它「空」。两篇对「空房间」的定义不同。`RESEARCH-初始化链路.md:272` 独立点出同一冲突。
- 影响：这是 `nook-init` 触发点的判定输入（契约 §4 把「识别触发点」归 04），口径不统一会让 8/9 个模板角色永远不触发初始化。
- 修法：由主 agent 拍一个口径；建议与 `isNookEmpty`（`emptiness.ts:48`：直接子级**全是 `.json`** 才算空）对齐——即空态 = `isNookEmpty` 为真，与 `scene` 是否存在解耦；02 §3.8 步 16 与 05 A17 一起改。

### F-12 【MAJOR / 03】`portrait` 的第 7 个同步点：`KIND_WORD`（文本视图词表）未登记

- 位置：`03-立绘组件.md:742-747`（§⑧ 表，只列 6 处）。
- 事实：`render/layer-page.ts:21-28` 的 `KIND_WORD` 是「kind → 人话词」的表，`kindWordOf`（`:117-120`）用 `KIND_WORD[kind] ?? KIND_WORD.default`。实测：`kindWordOf({type:'component',component:'portrait'},'p.md')` → **`'note'`**（今日 kind 未落地）；03 落地 kind 后 → **`'file'`**（fallback）。**两种情形都不会说「立绘」**。
- 影响：`look_at` 的文本视图与注入块（`render/sections.ts:115` 调 `kindWordOf`）会把立绘称作「file」——这正是 03 自己的判据（「`sprite` 是头像、`portrait` 是会动的陈设」）在**文本面**的落空。且 §5.3 的「六处」若真是权威，第 7 处不登记就永远没人补。
- 修法：03 §⑧ 表加第 7 行：`render/layer-page.ts:21-28` 的 `KIND_WORD` 加 `portrait: 'portrait'`（或 `'living portrait'`）；或明确写「本批不补，文本视图仍称 `file`，登记为后续」。二者择一，MUST NOT 沉默。

### F-13 【MINOR / 00】契约 §3.7 要点 4 的 owner 署名与 01/02 现行写法不一致

- 位置：`00-共同上下文.md:196`（§3.7 要点 4：「**归属**：`02-前端视图与入口` own 前端入口与这条摆放通路」）vs `01:3-4`（01 自认 owner）、`02:386`（§8.4：「归 **01** 实现，02 只消费」）。
- 事实：两篇已互相发消息对齐并**一致**（01 实现），只有契约未回写。
- 修法：契约 §3.7 要点 4 回写为「01 实现（同侧文件 `actions/canvas.ts`），02 只消费」。

### F-14 【MINOR / 00】契约 §5.3 第 6 行把 test 标题当 assert

- 位置：`00-共同上下文.md:308`（「`:35`（`assert.equal(kinds.length,18)`）」）。
- 事实（实测 `grep -n "18" packages/shared/test/components.test.mjs`）：`:35` 是 `test('T2: the registry holds 18 kinds, …')` 的**标题字符串**，不是 assert；`:37` 里**有两个** `18`（数字 + 错误信息文案）。03 §⑪-1 与 05 §3.9 都已按实测列对，只有契约未改。
- 修法：§5.3 第 6 行按 03 §2.1(6) 的表回写（`:35` 标「test 标题」、`:37` 标「两个 `18`」）。

### F-15 【MINOR / 01】伪码引用了不存在的 `LayerLink` / `PresenceEntry`

- 位置：`01-取数端点.md:239-240`（§③ 步骤 7 代码块）：`const links: LayerLink[] = []; const presence: PresenceEntry[] = [];`
- 事实：这两个类型**在 `packages/shared` 与 `apps/server` 均不存在**（grep 零命中），只在 `apps/web/src/state/useWorld.ts:24`/`:32` —— 而 01 自己写过「**MUST NOT** 从 web 端 import…不许为此在 shared 新增类型导出」。
- 影响：片段无法编译；「代码落点」章节里的不可编译片段会被照抄。
- 修法：改成可编译形式，例如 `const links: Array<Record<string, unknown>> = [];`（或与 `routes/world.ts:495-513` 一致的本地 `type`），或直接 `links: [] as unknown[]`；并把「不许 import web 类型」的说明与片段对齐。

### F-16 【MINOR / 03】同一位置两段互斥的 `playingPortrait` 实现

- 位置：`03-立绘组件.md:384-387`（§③-4 的 diff：`Canvas.tsx` 内联 `const playingPortrait = useMemo(() => { … ps[ps.length-1].path … })`）vs `03:558-559`（§③-6：`const { playing } = portraitPlayStateOf(items);`「合成点在 `Canvas`」）。
- 事实：两者产出同样的值，但**一个不调 `portraitPlayStateOf`、一个调**；而 §③-6 又说「`portraitPlayStateOf` 是纯函数、可单测」，§⑩-6 的断言正是测它。若实现照 §③-4 写，`portraitPlayStateOf` 就**没人调用**，§⑩-6 的单测虽仍绿（纯函数自身），但代码里出现「有函数没人用」。
- 修法：取其一。建议以 §③-6 为准：`Canvas` 调 `portraitPlayStateOf(items)`，删掉 §③-4 的内联 `useMemo`（或反之，并把该函数从 §⑩-6 移除）。

### F-17 【MINOR / 01+02+05】测试文件落点三处不一致

- 位置：`01:638`（§⑨ 表第 8 行：`packages/shared/test/`（排座测试，如 `canvas.test.mjs`））、`01:753`（§12.1：「路由级：**扩展** `apps/server/test/smoke-routes.mjs`」）vs `05:24-25`（两个 **NEW** 文件 `apps/server/test/nook-routes.test.mjs` + `packages/shared/test/nook.test.mjs`）。
- 事实：`smoke-routes.mjs` 是**裸 `mjs` 无 `check()` 但有 `process.exit`** 的脚本（223 行），`05` 用的是 `node:test` 三件套。两者风格不同。
- 影响：① 实现者不知道 nook 断言写哪；② **「扩展 `smoke-routes.mjs`」会污染 `pnpm check:bodies` 的既有基线**（该文件在 `package.json:21` 的 `check:bodies` 面内）；③ 若 05 的两个 NEW 文件真的落地，`smoke-routes.mjs` 里的断言可能被复制两次。
- 修法：以 05 为准（两个 NEW `*.test.mjs`），01 §⑨ 表第 8 行与 §12.1 改为「NEW `packages/shared/test/nook.test.mjs`」/「NEW `apps/server/test/nook-routes.test.mjs`，体例照 `smoke-routes.mjs:57-62`」。

### F-18 【MINOR / 05】`node --test <目录>` 的发现规则与「`smoke-routes.mjs` 不是 test 文件」的体例并行使用

- 位置：`05:822-824`（§8.3 C4：`node --test packages/shared/test/ apps/server/test/`）、`05:27`（「`apps/server/test/*.mjs` 的样板是 `smoke-routes.mjs`」）。
- 事实（实测，Node v26.8.1）：`node --test <dir>` **只跑匹配 `*.test.mjs` / `*-test.mjs` / `*_test.mjs` / `test-*.mjs` / `test.mjs` / `test/**` 的文件**——实测目录里的裸 `smoke-routes.mjs` **不被执行**（跑 2 个文件只报了 1 个 `✔ dotted`）。
- 影响：C4 的「全量」只覆盖 `*.test.mjs`，`smoke-routes.mjs` 静默不在其中——**与 `05:24-25` 落点一致（nook 用 `*.test.mjs`）**，所以这条本身没错；但 `05` 把 `smoke-routes.mjs` 称作「样板」易让人以为它也在 C4 面内。属措辞风险。
- 修法：`05:27` 加一句「`smoke-routes.mjs` 是裸脚本、**不被 `node --test <dir>` 发现**（实测），只作体例参考；nook 的路由断言 MUST 写成 `*.test.mjs` 才会进 C4」。（顺带：`05:827` 的 C5 `pnpm probe` 与 01 §12.1 的「`node apps/server/test/smoke-routes.mjs`」是两条不同命令，也应统一说明。）

---

## 6. 必须回写的文档清单（按 owner 归口）

| 编号 | 文件 | 位置 | 改成 | owner | 对应问题 |
|---|---|---|---|---|---|
| RB1 | `02-前端视图与入口.md` | `:395` `:394` | `nookIdOf(characterIdOfPath(place.path) ?? '')` | 02 | F-01 |
| RB2 | `02-前端视图与入口.md` | `:236` | 「`Canvas.tsx` **改**（`stillPortraits?` + `playingPortrait` + `still` 透传，owner 03）」，并在 §⑧ 实参表补 `stillPortraits={reduceMotion}` | 02 | F-02 |
| RB3 | `05-验收与回归.md` | `:608` `:611` | 负例换成跨 nook（`characters/other/x.md`）；删「段数 ≠ 3」 | 05 | F-03 |
| RB4 | `02-前端视图与入口.md` | §8.1 `:324-329`、`:8` `:150` `:422` | `App.tsx` 行号按 §3.1 表整体回写 | 02 | F-04 |
| RB5 | `02-前端视图与入口.md`、`04-占位与回写.md` | 02 `:73` `:260` `:167` `:423` `:426` `:498`；04 `:59` `:105` | `useWorld.ts` 行号按 §3.2 表回写；02 §⑥ 补注「转发点在 `:318-321` / `:224-233`」 | 02, 04 | F-05 |
| RB6 | `04-占位与回写.md` | `:322` `:324` `:334` `:348` | 改为「`isNookEmpty` 已由 B 档落地（`emptiness.ts:48`，签名 `(files, dir)`）」；从 P0 清单移除 | 04 | F-06 |
| RB7 | `04-占位与回写.md` | `:311` | 改为「已裁决：`items` 只含直接子级（`nookCardPaths`）」 | 04 | F-07 |
| RB8 | `05-验收与回归.md` | `:112` `:673` `:831` `:839` | A18/C6 改为「findings **集合**不变（9 条 DARK）」，写明退出码 1 是既有状态 | 05 | F-08 |
| RB9 | `01-取数端点.md` | `:446`（+ `:27` `:102` `:631`） | 补第二实参 `, nook`；`nookCardPaths` 改标「已存在」并补 `readonly string[]` | 01 | F-09 |
| RB10 | `05-验收与回归.md` | `:185` | 落点改 `packages/shared/src/rules/characters.ts`（`index.ts:15` export） | 05 | F-10 |
| RB11 | `02-前端视图与入口.md`、`05-验收与回归.md` | 02 `:216`；05 `:111` `:302` | 空态口径统一（建议与 `isNookEmpty` 对齐） | 主 agent 裁决 → 02, 05 | F-11 |
| RB12 | `03-立绘组件.md` | §⑧ 表（`:742-747`） | 加第 7 行 `render/layer-page.ts:21-28` 的 `KIND_WORD`（补键或显式登记不做） | 03 | F-12 |
| RB13 | `00-共同上下文.md` | `:196` | §3.7 要点 4 的 owner 改为「01 实现、02 消费」 | 主 agent | F-13 |
| RB14 | `00-共同上下文.md` | `:308` | §5.3 第 6 行按 03 §2.1(6) 回写（`:35` 是 test 标题、`:37` 有两个 `18`） | 主 agent | F-14 |
| RB15 | `01-取数端点.md` | `:239-240` | 去掉不存在的 `LayerLink`/`PresenceEntry` 类型标注 | 01 | F-15 |
| RB16 | `03-立绘组件.md` | `:384-387` vs `:558-559` | 取其一（建议 `Canvas` 调 `portraitPlayStateOf`，删内联 `useMemo`） | 03 | F-16 |
| RB17 | `01-取数端点.md` | `:638` `:753` | 测试落点统一为 05 的两个 NEW `*.test.mjs` | 01 | F-17 |
| RB18 | `05-验收与回归.md` | `:27` `:827` | 注明 `smoke-routes.mjs` 不被 `node --test <dir>` 发现；统一 `pnpm probe` 与裸脚本两条命令 | 05 | F-18 |
| RB19 | `04-占位与回写.md`、`RESEARCH-初始化链路.md` | `:337` / `:46` | `DEFAULT_TURN_TIMEOUT_MS` 行号 `:28` → **`:48`** | 04 | §3.3 |
| RB20 | `03-立绘组件.md` | `:417`（`motion-clip.mjs`）、`:887`(`sendFile`) | `:417` → **`:415`**；`:887` → **`:889`**；`/api/asset` 段 `:877-892` → **`:879-893`** | 03 | §3.3 |

---

## 7. 附：本评审的机械核验（`node --input-type=module` 走 `packages/shared/dist`，2026-09-13）

```
nookIdOf('characters/ryo/desk.md')                        -> null          # ← F-01：02 §8.4 照抄即 404
nookIdOf(characterIdOfPath('characters/ryo/desk.md') ?? '') -> characters/ryo  # ← 正确写法
characterIdOfPath('characters/ryo/letters/unsent.md')     -> 'ryo'         # ← F-03：A25 负例与它互斥
characterIdOfPath('characters/ryo')                       -> 'ryo'
characterIdOfPath('characters/README.md')                 -> null
nookCardPaths(files, 'characters/ryo')                    -> ['characters/ryo/desk.md']
nookCardPaths(files)                                      -> []            # ← F-09：01 §⑨ :446 单参静默返空
isNookEmpty(['characters/ryo/preset.json'],'characters/ryo') -> true       # ← F-06：04 附A「不存在」已被推翻
typeof isValidCharacterId / nookIdOf / characterIdOfPath  -> function ×3   # ← 均已落地
kindWordOf({type:'component',component:'portrait',...})   -> 'note'        # ← F-12：KIND_WORD 无 portrait 键
```

```
$ node tools/check-ws-contract.mjs
check-ws-contract: 9 finding(s) (24 emitted, 11 consumed, 24 in contract)   # ← F-08：A18 的「=== 14」已过期
$ node tools/check-hooks-docs.mjs
check-hooks-docs: clean (7 docs, 15 owned symbols, 55 cited paths)         # ← 只扫 docs/hooks/，不覆盖 docs/nook/
$ node --test <dir-with-bare-mjs-and-dotted-mjs>       # 只跑了 *.test.mjs（裸 smoke-routes.mjs 不被发现）
```

**AI 备注**：本报告全部结论均由上述命令或源码读取支撑；标 `[推断]` 处仅两例（`LayerLink`/`PresenceEntry` 的归属、`04:630-632` 的行号）。未采用任何「未知冒充已定」的写法。
