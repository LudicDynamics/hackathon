# docs/nook-scene/review-C —— 可实施性 / 闭环性 / 可机械核验（评审 C）

> 2026-09-15。评审者：`N2ReviewC`。**只读**：不改任何被评审文档、契约或源码。
> 棱镜：`design-first-feature-workflow §7` 第 4/5 项（可实施性、可机械核验）＋该 skill 的「可机械核验的不变量」一节。
> 不评命名一致性（review-A）、不评语义够不够味（review-B）。
> 所有 `file:line` 与命令输出均于 2026-09-15 在本机 `/home/yoshix7ti/projects/hackathon` 实测；标 `[推断]` 的除外。

---

## 0. 结论

**有条件通过（conditional pass）。**

判据：

- 本批**架构切法是可实施的**：`nookSceneOfPath` 的 `MAP_LAYER` 兜底陷阱确已被真正解决（`01 §3.3` 自写最长前缀 + `characters/` 子树闸，**非复制粘贴**，实测通过）；`listDirs` 进入 `WorldStore` 接口（契约 §8 P7）给了**可落地**的解法，`03` 的 layout 守卫在接口补签名后**可编译**。
- 但存在 **4 条阻断项（blocker）** 与 **7 条 major**，其中两条阻断项会让**验收门（design-first-feature-workflow §7 的第 5 项）失效**：一条是 `06` 的核心断言在任何实现下都会误红（`<Canvas>` 正则跨块吞并 JSDoc），一条是 `06` 承诺的「机械不变量」章节**整节不存在**（文中 6 处交叉引用指向空），而「修复前失败」的两条关键断言（`N2-A4`/`02` 的文件路径 404）**在任何实现下都绿**（假绿）。
- 另有 **2 处跨文档签名不一致**（`isValidNookScenePath` / `nookScenePathOf` 在 `03` 与 `04` 的残留），属于「契约一改未全处同步」的典型——其中 `03 §8.2` 的 import 落点把 `nookSceneOfPath` 写进了**错误的模块**（`rules/characters.js` 而非 `store/nook-layers.js`），会被**逐字照抄**成编译错误。

⇒ **修完 4 条 blocker 后可进入实现。**

---

## 1. 阻断项（blocker）

### B1 —— `06 §3.7` 的 `N2-A26` 核心断言在任何实现下都会误红（`<Canvas>` 正则跨块吞并 JSDoc）

**位置**：`docs/nook-scene/06-验收与回归.md:433-437`。

`06` 的断言逐字是：

```js
const canvases = nook.match(/<Canvas\b[\s\S]*?\/>/g) ?? [];
assert.ok(canvases.length >= 2, ...);
for (const c of canvases) assert.match(c, /onEnterGate=/, '...');
```

**为什么阻断**：`NookView.tsx:32` 的**文件头 JSDoc 里有一句散文** `It reuses the layer \`<Canvas>\` wholesale:`（逐字，含字面量 `<Canvas>`），而紧随其后的**下一个 `/>`** 出现在 `:502`（`NookView.tsx` 第一个自闭合块）。⇒ 第一条正则 match 从 `:32` 一路吞到 `:502`，**长 18964 字符**，把两处真实 `<Canvas>` 也一并吃掉。

**实测**（本机，逐字命令与输出）：

```text
$ node --input-type=module -e '... records /<Canvas[\s\S]*?\/>/g matches ...'
match 0: lines 32-502, len 18964, has onEnterGate= false   ← JSDoc 吞并两处真实 Canvas
match 1: lines 560-578, len 773,  has onEnterGate= true
match 2: lines 602-625, len 941,  has onEnterGate= true
```

我在**模拟「正确实现」之后**（给两处真实 `<Canvas>` 各加 `onEnterGate={handleEnterGate}`）复跑同一断言：

```text
added onEnterGate to 2 real Canvas elements
  match 0: len 18964, has onEnterGate= false
  match 1: has onEnterGate= true
  match 2: has onEnterGate= true
=> loop assertion would FAIL on 1 match(es) even after a correct fix
```

⇒ **`N2-A26` 在正确实现下仍会红**（`match 0` 没有 `onEnterGate=`）。这不是「修复前失败」，是**断言本身的缺陷**：实现者会得到一个永远无法变绿的测试，进而（a）怀疑自己的接线，或（b）把断言改松——两种结果都破坏门禁。**`N2-A26` 是 06 点名的非空性判据之一**（`06:141`），它红则整批不能收口。

**建议**：把溯源锚定在**真实的 JSX 元素**上，而不是散文里的 `<Canvas>`。最小改法——先剥掉注释再匹配，或直接按元素起始行匹配：

```js
const canvases = nook.match(/^\s*<Canvas\b[\s\S]*?^\s*\/>/gm) ?? [];
```

（`^` + `m` 让 `<Canvas` 必须出现在行首，`NookView.tsx:32` 的散文不满足；实测两处真实 `<Canvas>` 均在行首空白后。）

**证据**：`NookView.tsx:32`（`<Canvas>` 散文）＋ `:502`（首个 `/>`）＋ `:560` / `:602`（两处真实 `<Canvas>`）；命令见上。

---

### B2 —— `06` 承诺的「机械不变量」章节整节缺失，6 处交叉引用悬空

**位置**：`docs/nook-scene/06-验收与回归.md:13`、`:132`、`:133`、`:134`、`:197`、`:799`。

`06 §1` 逐字承诺本文含「**一组双向相等的机械不变量（含本文跑过的命令与输出）**」（`:13`），并在结论段再承诺「**提案前自己跑过**（§6 四条含命令与输出）」（`:799`）。但 `06` 的章节序列是：

```text
## 1 … ## 2 … ## 3 … ## 4 文件与副作用 ## 5 落账
## 6 WS / 前端（跨端契约两端同批点名）   ← :498
## 7 错误边界                          ← :513
```

**没有 `§6.x` 的不变量节**（`grep "^### 6\." 06` 零命中）。而正文 4 处引用它：

| 行 | 逐字引用 | 指向 |
|---|---|---|
| `:132` | `deriveNookLayers` 的 **key 集 === `listDirs(nookId)` 集**（双向相等，**§6.1**） | 不存在 |
| `:133` | 见 **§6.2 实测输出** | 不存在 |
| `:134` | 若直接复用 `layerOfPath` → `'map'`（静默错误）**【§6.3 实测】** | 不存在 |
| `:197` | 门牌集 —— 双向相等，不用「包含」（见 **§6 不变量**） | 不存在 |

**为什么阻断**：这正是 `design-first-feature-workflow` 硬要求「② 两侧 MUST 是可精确定义的集合；③ 提议前 MUST 先跑一遍」的落点。**承诺了却不存在**，比「没有不变量」更危险：`N2-A21`（`:132`）与 `N2-A22`（`:133`）是**非空性判据的一部分**，但它们指向的「实测输出」无处可查 ⇒ 实现者无法判断自己的结果是否达标，评审也无法复核「提案前是否真跑过」。

**建议**：补齐 `§6` 三条不变量（键集双向相等 / 门牌集双向相等 / `nookSceneOfPath` 无兜底），每条带命令与真实输出。我在本报告 §5 给出了可直接引用的**实测公式与输出**。

**证据**：`grep -n "^### 6\.\|^### 3\." 06` 输出只到 `### 3.7`；`grep -n "§6\.1\|§6\.2\|§6\.3" 06` 命中 4 处但无定义。

---

### B3 —— `N2-A4` / `02` 的「`?scene=` 指向文件 → 404」是**假绿**：形状闸先拒，永远到不了 404

**位置**：`docs/nook-scene/06-验收与回归.md:115`、`docs/nook-scene/02-取数端点与门牌.md:159`、`:462`、`:669`；契约 `00-共同上下文.md:244`。

三处都断言 `?scene=<文件路径>`（如 `office/desk.md`、`unspoken.md`）必须返回 **404 `not_found`**，理由是「`scene` 指向的不是目录」。但 `02` 自己的**步骤 3**（`:111-131`）在**步骤 4**（`statKind`）**之前**放了一道逐段正则闸 `isValidNookScenePath`，而**文件路径带 `.`**，逐段正则 `^[a-z0-9][a-z0-9-]*$` 必拒：

**实测**（本机）：

```text
$ node -e '... isValidNookScenePath ...'
"office"            -> true
"office/desk.md"    -> false     ← A4 的输入在这里就被拒
"unspoken.md"       -> false     ← 02:669 A6 的输入同样
"nope"              -> true
```

⇒ `?scene=office/desk.md` 走的不是步骤 4 的 `404`，而是**步骤 3 的 `400 invalid_argument`**——**在任何实现下都不会是 404**。这条断言在修复前（今天：200 忽略 scene）**红**，所以它不是「恒绿」，但**它的期望值是错的**：实现者按 `06:115` / `02:462` / `02:524` / `02:530` 写，会得到一个**修不好**的红测试（唯一能变绿的办法是把 `isValidNookScenePath` 改成放行 `.`——那会破坏 §4.1 的冻结形状）。

**为什么这一条特别贵**：`02 §8.1` 的错误矩阵把「`?scene=office/desk.md`（指向文件）⇒ 404」与「`?scene=nosuch` ⇒ 404」并列成「**唯一新增的错误码**的两条断言」（`:530` 逐字）。其中**一条根本不可达** ⇒ 「文件 vs 不存在 vs 空」的三态区分**没有真正被测**。而契约 `00:244`（「是文件、或不存在 MUST 返回 404」）本身把两种情形写成了同一条码，掩盖了这个不可达性。

**建议**：二选一——

1. 把断言改成实际形状：`?scene=office/desk.md` ⇒ **400 `invalid_argument`**（逐段正则拒 `.`）；「文件 vs 不存在」的三态改由**合法段名但落到文件**的输入测（例如夹具里造一个**无扩展名**的文件 `characters/ryo/office`，使 `scene=office` 命中 `statKind==='file'` ⇒ 404）。**推荐这条**：它才真正测到 `statKind !== 'dir'` 分支。
2. 或在契约 §4.2 明确：含 `.` 的 `scene` 一律 400（形状优先于存在性），把 404 的适用域收窄到「合法形状、但 `statKind` 非 dir」。

**证据**：`06:115`、`02:159`/`:462`/`:524`/`:530`；实测 `isValidNookScenePath('office/desk.md') === false`。

---

### B4 —— `03 §8.2` 把 `nookSceneOfPath` import 进**错误的模块**，会被逐字照抄成编译错误

**位置**：`docs/nook-scene/03-占位座位与摆放.md:481`。

逐字：

```ts
import { isNookSceneId, nookSceneOfPath } from '../rules/characters.js';   // NEW（§5.1）
```

但 `nookSceneOfPath` 按契约 §5.3 与 `01 §2.2` 落在 **`packages/shared/src/store/nook-layers.ts`**，**不在** `rules/characters.ts`：

- 契约 `00:404`（§5.3 标题逐字含落点）：`### 5.3 唯一的 nook 树派生（新增，packages/shared/src/store/nook-layers.ts）`
- `01 §2.2:76-80` 的 import 清单逐字：`import { cardsOfLayer, childLayers } from './layers.js';` + 从 `../rules/characters.js` 只 import `characterIdOfPath, nookCardPaths, nookSceneParent`。
- 更根本地：`nookSceneOfPath` 消费 `Record<string, LayerConfig>`（`schemas/world.ts:65`），而 `characters.ts` 有**零依赖 charter**（`characters.ts:3-6` 逐字）——`01 §3.4` 正是用这条 charter 论证 `nookSceneCards` 不能放 `rules/characters.ts`。

**为什么阻断**：`03 §8.2` 是「代码落点（精确到文件与函数）」章节，它的唯一用途就是被逐字照抄。照抄后是**编译错误**（`rules/characters.js` 不导出该符号）。同一文档的 `:481` 与 `:500` 自相矛盾：

```text
:481  import { isNookSceneId, nookSceneOfPath } from '../rules/characters.js';   ← 错
:500  nookSceneOfPath(path: string, layers: Record<string, LayerConfig>): string | null;  // nook-layers.ts   ← 对
```

**交叉佐证（同一类错误的第二例）**：`03 §2.3:55` 把 `isValidNookScenePath` 写成 `(scene: string)`，而契约 `00:356`、`01:52`、`06` 均写 `(scene: string | null | undefined)`——`03` 是唯一残留的旧签名（`N2Shared` 已按契约放宽，`03` 未同步）。

**建议**：`03:481` 拆成两行：

```ts
import { isNookSceneId } from '../rules/characters.js';
import { nookSceneCards, nookSceneOfPath, deriveNookLayers } from '../store/nook-layers.js';
```

并把 `03:55` 的 `isValidNookScenePath(scene: string)` 同步为 `(scene: string | null | undefined)`。

**证据**：`00:404`、`01:76-80`、`characters.ts:3-6`、`03:55`/`:481`/`:500`。

---

## 2. 逐条对照给定棱镜的发现

### 2.1 落点精度统计（棱镜 1）

契约 §9 要求「精确到文件与函数，新符号标 `NEW` 并给签名」。逐文档统计：

| 文档 | 落点章节 | 精度 | 停在抽象层的条目 |
|---|---|---|---|
| `01` | §8.1–8.5 | **高**（文件 + 函数 + 行号 + 完整实现体） | 无 |
| `02` | §9.1–9.3 | **高**（handler 内 11 步逐行 + import 清单） | 无 |
| `03` | §8.2–8.7 | **高**（含 clean-cutover 的 import 删减） | 无（但 B4 落点错模块） |
| `04` | §8.1–8.4 | **高**（15 行符号表 + 落点行号） | 无 |
| `05` | §8.1–8.3 | **高**（8 条符号表 + `init-command.ts` 伪码 diff） | 无 |
| `06` | §8.1–8.5 | **中** | `06:590` 的 `directChildDirsOf` 只写「同上」（`emptiness.ts`），未给行号；`06:559-560` 的「场景校验」「场景存在性」只写「NEW 调用点」不给函数名（可接受，因 handler 内联） |

**结论**：落点精度整体达标，**未发现「在路由层处理」这类抽象粒度**。唯一结构性问题是 B4（`03 §8.2` 落点写在错模块），属「精确但错误」，比「含糊」更危险。

### 2.2 「示例即代码」自检：不存在的符号清单（棱镜 2，最高优先级）

我把各文档片段里的每个符号逐一对源码 `grep`。**结果：没有一个不存在的符号**——本批文档在这一点上做得很好。以下是我验证过的关键符号（全部**真实存在**）：

| 符号 | 位置（实测） | 引用它的文档 |
|---|---|---|
| `dirOf` / `cardsOfLayer` / `childLayers` / `layerOfPath` | `layers.ts:46` / `:106` / `:121` / `:130` | 01/03/05 |
| `MAP_LAYER` 兜底 `let best = MAP_LAYER;` | `layers.ts:131`（逐字） | 01/03 |
| `nookCardPaths(allFiles, nookId)` | `characters.ts:90` | 01/02/03 |
| `characterRootConfigOf` 的 `filename.includes('/')` 早退 | `characters.ts:70` | 01 |
| `DirectChildrenOf` / `isNookEmpty` / `hasInitProduct` | `emptiness.ts:19` / `:48` / `:63` | 05/06 |
| `SEAT_ANCHOR = { x: 960, y: 540 }` | `local-store.ts:35` | 02/03 |
| `layoutOccupied` / `cardsInLayer` | `local-store.ts:508` / `:1972` | 02/03 |
| `seatUnplaced` / `reseatLayer` / `getLayerCards` / `writeFootprints` / `placeCard` / `getCanvasVersion` / `queryCanvas` | `local-store.ts:981` / `:1084` / `:966` / `:1255` / `:1657` / `:1369` / `:482` | 02/03/06 |
| `pageOfLayer` | `world-store.ts:284` | 03/06 |
| `assertCardExists` / `assertCardPath` / `seatDeclaredRows` | `canvas.ts:128` / `:115` / `:417` | 03/06 |
| `readLayerItems` / `appearanceContext` / `readLayerBg` / `readLayerAudio` / `rotOf` / `declaredSizeOf` / `storedSizeOf` | `world.ts:420` / `:431` / `:314` / `:400` / `:164` / `:241` / `:251` | 02 |
| `createWorldRouter` 5 参 | `world.ts:460` | 06 |
| `EventBridge` 可 `new` | `event-bridge.ts:401` | 06 |
| `createActionService(store, actor, opts)` | `actions/service.ts:137` | 06 |
| `LocalWorldStore` 构造于 `worldRoot` + `close()` | `local-store.ts:209` / `:2324` | 06 |
| `Canvas.onEnterGate?` | `Canvas.tsx:76` | 02/04 |
| `CanvasObject.isGate` / `gateTarget` / `requestEnter` | `CanvasObject.tsx:205` / `:235` / `:238` | 02/04 |
| `CardRenderer` 门牌分支 + `UNWRITTEN` | `CardRenderer.tsx:142` / `:159-160` | 02/04/06 |
| `NookView.isEmpty` 逐字 | `NookView.tsx:468` | 04/05/06 |
| `App.tsx:223 nookChar` / `:379 setNookChar(characterId)` | `App.tsx:223` / `:379` | 04 |
| `App.tsx:1251 onEnterGate` | `App.tsx:1251` | 02/04 |
| `data-depth-surface="world"` | `Canvas.tsx:618` | 04 |
| `check-i18n` / `check-request-bodies` / `check-merge` 等 script | `package.json:31/32/34/37/39` | 04/06 |

**唯一「引用了不存在的东西」的案例**是我在 `04 §U6` 的历史记录里看到的**自曝笔误** `[data-nook-canvas]`——`04` 已明确标注「该属性不存在，本文初稿笔误」并删改（`04` 步骤 11 / §U6）。这属**已修复**，不计为 finding。

**结论**：**不存在符号清单为空**。这是本批最强的一项。

### 2.3 `layerOfPath` 兜底陷阱是否真被解决（棱镜 3）

**是。** `01 §3.3` 的实现（`:336-341`，逐字）：

```ts
export function nookSceneOfPath(path: string, layers: Record<string, LayerConfig>): string | null {
  // ① 必须先确证 path 落在 characters/<id>/ 子树内
  if (characterIdOfPath(path) === null) return null;
  // ② 最长前缀匹配，但【无 toplevel 兜底】
  let best: string | null = null;
  for (const id of Object.keys(layers)) {
    if (path === id || path.startsWith(`${id}/`)) {
      if (best === null || id.length > best.length) best = id;
    }
  }
  return best;
}
```

- **自写最长前缀**（不是复制粘贴 `layerOfPath`）：与 `layerOfPath`（`layers.ts:130-139`）相比，**去掉了 `let best = MAP_LAYER;` 初值**、**去掉了 `if (id === MAP_LAYER) continue;`**、**加了 `characters/` 子树闸**。三处差异都是语义性的，符合契约 §5.3「不得复制粘贴」的取舍要求（`01 §3.3` 亦给出「为何不抽 core」的完整论证：改 `layers.ts` 承重函数收益为零、风险非零）。
- **`01` 已声明不改 `layers.ts`**，与契约 §3 决定 5 一致。

**竞态实测（不同角色的同名子场景）**——我按 `01 §3.1`/`§3.3` 的实现逐字重写后在真实形状的树上跑：

```text
--- RACE: same-named sub-scene in another character ---
  nookSceneOfPath('characters/ryo/office/desk.md', eliasTree) -> null      ✅ 不误匹配
  nookSceneOfPath('characters/ryo/office',         eliasTree) -> null      ✅
  nookSceneOfPath('characters/elias/office/desk.md', eliasTree) -> "characters/elias/office"  ✅
  nookSceneOfPath('characters/ryo/x.md',           eliasTree) -> null      ✅ 不是 'map'
  nookSceneOfPath('world/inn/a.md',                eliasTree) -> null      ✅ 不是 'map'
  nookSceneOfPath('player/bag/i.md',               eliasTree) -> null      ✅ 不是 'map'
```

**结论**：**不会误匹配**。原因是 `deriveNookLayers`（`01 §3.1` 步骤 1）的 `.filter(d => d === nookId || d.startsWith(\`${nookId}/\`))` 已把 `characters/ryo/**` 从 elias 的树里剔除，且 `01 §U4` 明确记录了 `+ '/'` 防前缀错觉（`elias` 不误配 `elias-x`）。**`01 §U4` 的论证与我的实测一致。**

同时我用真实 dist 复现了兜底陷阱本身（对照）：

```text
$ node --input-type=module -e 'import { layerOfPath } from "./packages/shared/dist/store/layers.js" ...'
   characters/elias/office/desk.md -> "characters/elias/office"
   characters/elias/unspoken.md    -> "characters/elias"
   characters/ryo/other.md         -> "map"    ❌ 静默兜底（契约 §5.3.1 断言成立）
   world/inn/a.md                  -> "map"
   player/bag/item.md              -> "map"
```

⇒ 契约 §5.3.1 的实测证据**成立**，`nookSceneOfPath` 的 `string | null` 返型是**必要**的。

### 2.4 实现顺序与依赖硬阻塞（棱镜 4）

**P7（`listDirs` 不在 `WorldStore`）确有解，且 `03` 的守卫在补签名后可编译。**

- 契约 §8 P7 的裁决是「二选一，由 `01` 定」，`01 §2.3:30-31` / `§8.4` 明确接手**方案 1**：

```ts
// world-store.ts:159 之后  接口补签名（LocalWorldStore 已有实现，接口零成本）
listDirs(prefix?: string): Promise<string[]>;
```

- **实测确认接口缺口存在**：`grep listDirs packages/shared/src/store/world-store.ts` **零命中**；`grep -rn "implements WorldStore" packages/shared/src` 只命中 `LocalWorldStore`（`local-store.ts:200`）⇒ **补签名不需要改任何既有实现体**，是零风险改动。`listDirs` 的真实实现就在 `local-store.ts:349`（逐字 `async listDirs(): Promise<string[]>`，无参，从 `resolvePath(WORLD_DIR)` 起步）⇒ `01 §8.3` 的泛化（`prefix = WORLD_DIR` 默认参数）**保留唯一既有调用点 `scanLayers`（`:455`）逐字节不变**——我核对了 `grep -n "listDirs" local-store.ts`：唯一调用是 `:455 const dirs = await this.listDirs();`（无参）⇒ **默认参数确实零破坏**。
- **`03` 的守卫可编译性**：`03 §3 步骤 4` 第 0 步建树用 `await store.listDirs(nookId)`，`store` 是 `ctx.store: WorldStore`（`actions/types.ts:11`）；接口补签名后 `deriveNookLayers(nookId, await store.listDirs(nookId), readFm)` **可编译**。`03 §⑪ 冲突 1` 明确登记「这是 C3 的硬前置」，并给了不推荐的退路（③/④ 全改 `dirOf(p) + isNookSceneId`，免建树）。**有人真的解了。**
- **`05` 不受 P7 影响**（契约 §5.4 已实测）：`init-command.ts:198` 的 `store = worldStore(ext)` 返 **`LocalWorldStore`**（`deps.ts:27` 逐字 `export function worldStore(ctx: ExtensionContext): LocalWorldStore`）⇒ `store.listDirs(dir)` 在扩展侧**本来就有**。我读 `deps.ts:27` 确认。

**结论**：**无未解硬阻塞**。唯一的实施顺序约束是 `01` 必须先落接口签名，`03` 才能编译——契约 §6 的 N2a→N2c 顺序已正确表达。

### 2.5 可机械核验的不变量：我自己跑的公式与结果（棱镜 5）

`design-first-feature-workflow` 硬要求「① 双向相等而非并集；② 两侧可精确定义；③ 提议前先跑」。`06` 承诺了但**缺失**（B2），故我按 `01 §10` 给出的 I1–I6 自行定义并跑：

**夹具**（真实形状：`characters/elias` 的 5 个真实子场景 + 一个完全空的 + 他角色同名子场景 + `world/**`）：

```text
dirs = ['characters/elias', 'characters/elias/balcony', 'characters/elias/living-room',
        'characters/elias/office', 'characters/elias/parallel-timeline', 'characters/elias/writing',
        'characters/ryo', 'characters/ryo/office',        ← 他角色、同名子场景
        'world/inn']
readFm = d => d === 'characters/elias/office' ? { name: '办公室 · 工作日' } : null
```

**I1（键集双向相等）—— 实测通过**：

```text
I1 keys          = characters/elias,characters/elias/balcony,characters/elias/living-room,
                   characters/elias/office,characters/elias/parallel-timeline,characters/elias/writing
I1 expected      = characters/elias,characters/elias/balcony,characters/elias/living-room,
                   characters/elias/office,characters/elias/parallel-timeline,characters/elias/writing
I3 无越界 key    = true     （characters/ryo* 与 world/* 均被滤掉）
```

**I2（parent 链）—— 实测通过**：

```text
tree['characters/elias'].parent          = null
tree['characters/elias/office'].parent   = 'characters/elias'
```

**I4（路径 → 场景 === dirOf(p)）—— 实测通过**：

```text
characters/elias/office/desk.md  -> "characters/elias/office"  | dirOf = "characters/elias/office"  ✅
characters/elias/unspoken.md     -> "characters/elias"         | dirOf = "characters/elias"         ✅
characters/elias/writing/note-a.md -> "characters/elias/writing" | dirOf = "characters/elias/writing" ✅
```

**I6（返回值要么 null 要么是树的 key）—— 实测通过**（见 §2.3 的竞态表）。

**门牌集与成员集 —— 实测通过**：

```text
doors(root)   = characters/elias/balcony,characters/elias/living-room,characters/elias/office,
                characters/elias/parallel-timeline,characters/elias/writing   （5 个，稳定字典序）
doors(office) = []                                      （叶子场景无门牌）
cards(root)   = characters/elias/unspoken.md             （排掉 README/identity/personality/memory/preset.json）
cards(office) = characters/elias/office/desk.md          （排掉自身 README）
cards(writing)= characters/elias/writing/note-a.md,note-b.md   （无 README 的子场景）
```

**`isNookSceneId` 边界 —— 实测通过**：

```text
"characters/elias"          -> true
"characters/elias/office"   -> true
"characters/elias/office/"  -> false    ✅ 尾斜杠拒（§4.1）
"characters/elias//office"  -> false    ✅ 空段拒
"characters/elias/.pi"      -> false    ✅ 点开头拒
"characters/Bad"            -> false    ✅ 大写拒
```

⇒ **`01 §10` 定义的不变量形式是对的、双向相等、且可机械核验**。问题不在公式，而在 `06` **没有把它落地**（B2）。

### 2.6 假绿断言清单（棱镜 6）

逐条审 `06 §3.0` 的 A1–A28，标出**在任何实现下都绿（假绿）**或**期望值错误（永红/修不好）**：

| ID | 问题 | 性质 | 判据 |
|---|---|---|---|
| **N2-A4** | `?scene=office/desk.md` 期望 404，实际步骤 3 的 400 | **期望值错误（不可达）** | 见 **B3** |
| **N2-A7** | 「不递归」的否定断言修复前**天然成立**（今天零门牌 ⇒ 子目录的卡本就不在） | **假绿（vacuous）** | `06:118` **自己已标注**「vacuous → 本条不构成非空性判据」✅ **诚实，不计 finding** |
| **N2-A16** | 越界守卫「仍 `not_found`」——修复前**也是 `not_found`** | **假绿（vacuous）** | 06 标注为「负向逃逸」护栏（`:127`），但**它修复前后同值** ⇒ 无法证明「没有这个修复就会失败」。**属负向护栏，可接受**（06 已声明这类是「只在不该做的事被做错时红」） |
| **N2-A23** | 越界 → null——修复前**函数不存在**（红） | **非假绿** ✅ | 06 已注「若直接复用 `layerOfPath` 则返回 `'map'`」，**这才是它的鉴别力** |
| **N2-A25** | 不落事件——修复前后都是 0 | **假绿（vacuous）** | `06:136` **自己已标注**「vacuous 相等，不构成非空性判据」✅ 诚实 |
| **N2-A24** | 零迁移——修复前「子场景行不存在」⇒ 断言 `sub.layer === 'characters/ryo/office'` **会红** | **非假绿** ✅ | 断言的是**值**不是 status，正确 |
| **N2-A26** | 前端门牌接线 | **恒红（修不好）** | 见 **B1** |

**结论**：**唯一真正的假绿缺陷是 B3（N2-A4）**。`06` 对 vacuous 项（A7/A25）**主动标注**，这是诚实性上的加分。`N2-A16` 是设计上接受的负向护栏（06:141 明说「只在不该做的事被做错时红」）。

**同类风险提醒**：`02 §10.1` 的 `A0`（`:645-660`）三条断言的**修复前**判据是「`office.body.items` 与 `root.body.items` 逐字相同」，我核对 `02` 自己给出的修复前实测（`:150-155` 的 spike 输出：`?scene=office` 与 root 都返回 `['characters/elias/unspoken.md']`）⇒ **A0 的三条修复前确实失败**（`assert.notDeepEqual` 失败、`layer` 不等、`items` 只有 1 项）✅ **正确**。`02` 还专门在 `:668` 写明「**不要**把 A0 写成修复前 404（那会假绿）」——**这是本批最好的假绿意识**。

### 2.7 验收夹具的稳定性（棱镜 7）

**`06 §2.2` 的夹具判据基本正确，但有两处需要修正。**

**（a）`templates/exp` 是否干净：确认干净 ✅**

- 实测 `ls -a templates/exp` **无 `.airpworld/`**（`06:66` 逐字断言成立）；
- 实测 `templates/exp/characters/elias/` 只有 `.pi` / `.shot_cloud.png` / `.shot_still.png` 三个点开头项，**无 `chat-history/`**；
- 实测 `find templates -name 'chat-history'` **零命中**；`find worlds -maxdepth 4 -name 'chat-history'` 命中 **`worlds/exp-default/characters/elias/chat-history`** ⇒ `06:98` 与契约 §8 P6 的断言**成立**（它只在 gitignored 的 `worlds/`）。

**（b）`06:59` 的「干净首选存档」结论，与我的实测不符 ❌**

`06 §2.2` 逐字断言：

```text
| worlds/exp-35bbc20f | 无（只有 4 行 world/*/README.md，layer=map） | ✅ 干净，首选 |
```

我用 `sqlite3` 复跑全部 `worlds/*/.airpworld/canvas.db`，`worlds/exp-35bbc20f` 的 `cards` 表确实是 4 行 `world/*/README.md`（layer=`map`），**无 elias 行** ⇒ **该断言属实**。

但 `06 §2.2` 的表**漏了一整个存档**：实测 `worlds/` 下有 **34 个世界**，其中 `exp-011eec73` / `exp-27e82a64` / `exp-656f1c7d` / `exp-675a13dd` / `divergence-3b71382f` 等**同样无 elias 行**。**这只是「表不全」，不影响结论**（`06` 已声明用 `templates/exp` 建临时世界，不依赖 `worlds/`）。

**真正的风险点（`06` 未覆盖）**：`06 §2.2` 的单子里，**`exp-default` 与 `exp-27e0d860` 被标为「脏」（各 1 行）**，但**它们的 `cards.layer` 是 `characters/elias`**——若实现者图省事直接用 `worlds/exp-default` 当夹具（`02:676` 已明确禁止：「**MUST NOT 用 `worlds/exp-default`**，它有 `chat-history/`」），两件事会同时发生：

1. `seatUnplaced` 的 `ON CONFLICT(id) DO NOTHING` 会跳过已有的 `characters/elias/unspoken.md` ⇒ **「首次排座」的断言（A12/A13/A15）会假绿**；
2. `chat-history/` 会让根场景**多出一张假门牌**（`items` 精确集合断言 A6/A8 会红，且**红的原因与所要测的契约无关**）。

⇒ **`06` 与 `02` 的口径一致且都禁止了**（`06:66/98`、`02:676`），**这条风险已被正确登记**，我不计为 finding。但**建议**把 `06:57-64` 的表换成「按 `cards` 表是否为空」的统一判据，避免实现者以为「表里没列出的存档也脏」。

**（c）`watson` 污染源：`06` 已正确禁止 ✅**

`06:69` 逐字「MUST NOT 用 `watson`（N1 §3.7.1：`templates/holmes-world` 的那行是子代理探针写的）」。我核对 `docs/nook/04-占位与回写.md:371` 的证据撤回记录 —— **一致**。

**额外夹具污染源（我发现的，`06` 未点名）**：`tools/probe-init.mjs:34` 逐字 `const TEST_WORLD = path.join(REPO, 'archive/templates/pre-bilingual-2026-09-14/holmes-world')`，`:186 const characterId = 'watson'`；它 `emptyNook` 时 `fs.rmSync(..., { recursive: true })` 删除 watson 目录下**所有非 json**（`:59-64`）。⇒ **`probe:init` 会破坏 `archive/templates/.../holmes-world/characters/watson/` 的目录结构**。本批若跑 `pnpm probe:init`（`06:736` 说「不用跑」，但实现者可能跑），watson 会更脏。**这加固了「必须用 `templates/exp` + 临时世界」的纪律**，`06` 的结论正确。

**结论**：夹具判据方向正确，`06 §2.2` 的表需补全，但**没有会产出假绿的夹具缺口**。

### 2.8 门禁命令完整性（棱镜 8）

`AGENTS.md §7:143-153` 的门禁集合逐字是：

```bash
pnpm build
pnpm test
pnpm check:ws
pnpm check:bodies
pnpm check:docs
pnpm check:i18n
pnpm check:merge
```

`06 §11:726-734` 列了：`pnpm build`、`check:docs`、`check:bodies`、`check:ws`、`check:i18n`、`check:merge`、`node --test <file>`。

**核对结果**：

- ✅ **`pnpm build` 在列，且 `06:34`/`§10.2` 明确要求「改了 `packages/shared` 必须先 build」**——这正是 `AGENTS.md §6.5:138` 逐字「修改 `packages/shared/src` 或 `apps/web/src` 后必须运行 `pnpm build`；生产端读取的是对应 `dist`，类型检查不能替代构建」。**这一点 `06` 做对了。**
- ⚠️ **`pnpm test` 未列，`06:734` 用 `node --test <file>` 替代，理由「只点名单文件跑，不跑全量」**。但 `06` 同时改了 **既有的 `packages/shared/test/init-rules.test.mjs` 与 `apps/server/test/nook-routes.test.mjs`**，并**新增 3 个测试文件**。`AGENTS.md §7` 要求 `pnpm test`（root `package.json:20` 逐字存在 `"test": "node --test packages/shared/test/ apps/server/test/ apps/web/test/ tools/*.test.mjs"`）。⇒ **这一处是真正的门禁缺口**：本批改了共享契约（`isNookEmpty` 签名加参、`listDirs` 加参），**全量测试是唯一能证明「没有把别处的调用点改红」的手段**。
  - **注意**：`05 §10.4:404` 逐字声称「root `package.json` 无 `test` script——`docs/nook/01` §⑬ 冲突 1 已实测登记」。**该断言已过时/错误**：`package.json:20` **确有** `"test"` script（且 `docs/nook/01:740` 也写「没有 `test` script」，同样过时）。这是**从 N1 继承的旧断言未复核**——正是「权威通道可被推翻」的又一例。**必须修**：`05 §10.4` 与 `06 §11` 应把 `pnpm test` 列入门禁。
- ⚠️ **`pnpm typecheck:extensions`（`package.json:30`）未列，而本批改 `extensions/toolkit/init-command.ts`**（`05 §8.2`）。`AGENTS.md §7:156` 说「涉及 Agent、提示词、初始化…再运行对应的 `pnpm probe:*`、`pnpm check:*` 或专项测试」。⇒ **`05` 新增的 `store.listDirs(dir)` 调用在扩展侧的类型正确性，唯一机械证明是 `pnpm typecheck:extensions`**（`extensions/tsconfig.json` 实测存在）。**建议列入。**
- ⚠️ **`pnpm probe:init` 是否该跑**：`06:736` 说「不用跑（本批不加工具、不加帧、不改提示词）」。但 `05` **改了 `init-command.ts` 的空判定判据**（`isNookEmpty`/`hasInitProduct` 加参 + 收紧语义）——这正是 `AGENTS §7:156` 点名的「初始化」面。`tools/probe-init.mjs:184-207` 有 `nook init` 用例（`:192 { kind: 'nook', target: characterId }`），**它正是本批改动的回归面**。⇒ **`06:736` 的「不用跑」判断偏窄**，建议至少跑 `probe:init` 的 nook 用例（它自带「删掉所有非 json 制造空 nook」的前置，`:59-64`）。
- ✅ `check:ws` / `check:bodies` / `check:docs` / `check:i18n` / `check:merge` 均在列，理由也正确（本批不新增帧名、footprint body 不变、6 篇新文档必跑 docs、NookView 新增文案、多子代理并行需 merge log）。

**结论**：门禁清单**不完整**（漏 `pnpm test`、漏 `typecheck:extensions`；`probe:init` 判断偏窄），且 `05 §10.4` 的「无 `test` script」是**被证据推翻的旧断言**。属 **major**。

---

## 3. 契约本身的错误（`00-共同上下文.md` 被证据推翻的断言）

| # | 契约断言 | 证据 | 性质 |
|---|---|---|---|
| **C-1** | §4.2:244「`scene` 指向的不是目录（**是文件、或不存在**）MUST 返回 404」 | 「是文件」在实现下**不可达**：含 `.` 的 `scene` 被步骤 3 的逐段正则先拒 ⇒ **400**。见 **B3** | **「结论对而理由错」**——404 的**存在性**判据正确，但把「文件」并进来造了一条不可达断言 |
| **C-2** | §5.1:356 `isValidNookScenePath(scene: string \| null \| undefined)` | `03 §2.3:55` 仍写 `(scene: string)` | **跨文档未同步**（`01 §C1` 已登记并解决，`03` 未同步）——见 **B4** 交叉佐证 |
| **C-3** | 契约未点名 `05` 的签名更新 | 契约 §5.4:454 的代码块写的 `hasInitProduct(files, dir, kind: 'scene' \| 'nook')` **不含 `dirs`**，而 `05 §2.1`/`§⑪ 冲突 5` 已改成 4 参**必填** | **契约签名滞后于 `05`**：`05 §⑪ 冲突 5` 已自行登记「请主 agent 在 §5.4 代码块把两个签名更新为含 `dirs` 的形式，否则实现者会按 3 参写、被 TS 拒绝」。**该请求尚未落地**（我核契约 §5.4 仍只有 `isNookEmpty(files, dir, dirs)` 一条给了 `dirs`，`hasInitProduct` 的代码块在 `00:474` 附近只给 `directChildDirsOf`）[推断：契约可能在别处有更新，但我按 `00:454-480` 逐行核未见 4 参 `hasInitProduct`] |

**注**：契约 §2.3/§2.5/§5.3.1/§5.4.1 的四处「初稿被实测推翻、已修正」**经我复核全部成立**（`listDirs` vs `listFiles` 的空目录对照、两处门禁行为不同、`MAP_LAYER` 兜底、座位作用域按 `cards.layer`）。契约在自曝错误上**是诚实的**。

---

## 4. 诚实性检查：各文档「仍未知待拍板」是否完整

| 文档 | 待拍板节 | 诚实性 | 备注 |
|---|---|---|---|
| `01` | §12 U1–U5 | **好** | U1（`chat-history` 算不算场景）如实标「本文如实当场景、不设黑名单」；U5 如实记录「已裁决，覆盖本文初稿」 |
| `02` | §⑫ U1–U8 | **好** | U6（`bg.video` 是否置 null）如实标「本片裁决如实透传…请拍板」；U8 主动要求 `06` 修正 `docs/nook/01 §12.3` 的失效结论 |
| `03` | §⑫ 1–5 | **好** | 第 1 条把初稿待拍板项**划掉并注明「已由 02 确认，不再是待拍板项」**——这是**正面**的诚实性 |
| `04` | §⑫ U1–U7 | **好** | U2 给了「反例条件（若这些成立，本文改建议）」——**可被推翻**的裁决才是好裁决 |
| `05` | §⑫ 1–6 | **好** | 第 1 条把「最关键的产品未知项」的两个方向代价都列了 |
| `06` | §13 1–6 | **好** | 但 §13-5 建议「`nookSceneDoors` MUST sort」标「未拍板（倾向明确）」——而 `01` 已逐字委托 `childLayers`（有 `.sort()`）⇒ **该未决项实际已消解**，属「把已定写成未定」的**反向**不诚实（轻微） |

**发现一处「把未决写成已定」**（棱镜要求专门报）：

- `04 §⑩ 10.4` 的源码级断言里有一条 `assert.match(app, /setNookScene\(null\)/)`，注释写「**至少一处复位**」。但 `04 §⑨ 步骤 9` 逐字要求复位**覆盖四个 `setNookChar` 位点**（`:379`/`:398`/`:506`/`:890`），其中 `:379` 是**唯一非 null 换值点**、**必须显式**。而 `assert.match(app, /setNookScene\(null\)/)` **只验证「至少一处」**——`04 §⑨` 的实现（1 个 effect + `:379` 一处显式）恰好产生 2 处 `setNookScene(null)`，**任何只写 1 处的实现也能通过**。⇒ **该断言弱于它自己的设计契约**（`04` 自己也在 `§⑩` 表 #8 标了「修复前无该状态」，所以它不是假绿，但**它无法证明 `:379` 那条 C5 修复**）。**建议**：追加 `assert.match(app, /setNookChar\(characterId\);\s*\n\s*setNookScene\(null\)/)` 或直接计数 `setNookScene(null)` ≥ 2。属 **minor**。

**其余未决项均完整**：`chat-history` 的归属（跨 4 篇一致登记）、空子目录算不算内容（`05` 双向代价）、前端可见集 ⊂ 后端内容集（`04`/`06` 一致）、`items` 排序（`02`/`06` 一致）。**没有发现把关键未决项藏起来的情况。**

---

## 5. 我实测的不变量公式与输出（供 `06` 补 §6 直接引用）

（见 §2.5。此处给**可直接抄进 `06 §6` 的命令形式**。）

命令（纯函数，不需 store、不需 build）：

```bash
node --input-type=module -e '
import { dirOf, cardsOfLayer, childLayers } from "./packages/shared/dist/store/layers.js";
import { nookCardPaths } from "./packages/shared/dist/rules/characters.js";
// ... 按 01 §3.1–§3.4 重写 deriveNookLayers / nookSceneDoors / nookSceneOfPath / nookSceneCards ...
'
```

实测输出（关键行）：

```text
I1 keys        == listDirs(nookId) 的子树集            → true（双向相等）
I2 root.parent == null; office.parent == 'characters/elias'  → true
I3 所有 key 在 nookId 子树内                            → true
I4 nookSceneOfPath(p) === dirOf(p)（3 条真实路径）      → true
I6 返回值 ∈ (null ∪ tree.keys)                          → true（无 'map'）
doors(root)   = 5 个直接子场景（字典序稳定）
doors(office) = []（叶子）
cards(root)   = [unspoken.md]（排 4 配置文件 + preset.json）
cards(office) = [office/desk.md]（排自身 README）
cards(writing)= 2 个 note（无 README 的子场景）
```

**对照（修复前/直接复用 `layerOfPath`）**：

```text
layerOfPath('characters/ryo/other.md', eliasTree) -> 'map'   ❌
layerOfPath('world/inn/a.md',          eliasTree) -> 'map'   ❌
```

⇒ **`nookSceneOfPath` 的 `string | null` 是承重契约，`06` 应把上表作为 §6.1/§6.3 的「实测输出」落地。**

---

## 6. 「修复前失败」断言的独立复核（棱镜 4/6 的合流）

我独立跑/复核了 3 条最关键的断言：

**① `arrangeCards` place 对子场景 —— 复核任务书的「修复前 not_found」为误**

我读 `canvas.ts:527` 逐字：

```ts
const nookId = nookIdOf(characterIdOfPath(place.path) ?? '');
const layer = nookId ?? (await store.resolveLayer(place.path));
```

`characterIdOfPath('characters/elias/office/desk.md')` 只取第一段 ⇒ `'elias'` ⇒ `nookIdOf('elias')` = `'characters/elias'` ⇒ **非 null**、**不报错**，把子场景的布局请求当成根场景执行。⇒ `03 §2.6`/`06 §3.5` 的更正（「成功但 `details.layer === 'characters/elias'`」，非 404）**成立**；`06:123` 的 A12 断言用**值**而非 status，**正确**。✅

**② `?scene=` 被忽略 —— 复核 `02 §10.1 A0` 为真失败**

我读 `/nook` handler（`world.ts:674-701`）：逐字只读 `req.query.character`，`layer` 恒填 `nookId`。`02:150-155` 给出的修复前 spike 输出（root 与 `?scene=office` 都返回 `['characters/elias/unspoken.md']`）与该代码一致 ⇒ A0 的三条断言修复前**必红** ✅。

**③ `isNookEmpty`/`hasInitProduct` 的 hazard —— 我自己在 dist 上跑了**

```bash
$ node --input-type=module -e 'import { isNookEmpty, hasInitProduct } from "./packages/shared/dist/rules/emptiness.js" ...'
PRE-FIX isNookEmpty(B: content only in subdir)     = true    ← 06 期望修复后 false
PRE-FIX hasInitProduct(B)                          = false   ← 06 期望修复后 true
PRE-FIX isNookEmpty(preset only)                   = true
```

⇒ 契约 §5.4 真值表 B 行与 `06` A19/A20 **成立** ✅（`isNookEmpty` 确实误判为「空」⇒ 会触发 `nook-init` 在已布置的房间再铺一层）。

**④ footprint 门禁对多段路径 —— 我自己复算了 `slice`**

```text
layer = "characters/elias/office"  → slice('characters/'.length) = "elias/office"
  regex ^[a-z0-9][a-z0-9-]*$ → false  ⇒ 400 ✅（06 A17 修复前 400 成立）
layer = "characters/elias/office/" → slice = "elias/office/" → false ⇒ 400
  ✅（06 A28 的「footprint 修复前后都 400」成立）
```

⇒ 两处门禁**修复前行为确实不同**（`footprint` 真 400、`arrangeCards` 静默写错页），`06 §12-3` 的分开写法**正确**。✅

---

## 7. 其余发现（major / minor）

| # | 严重度 | 位置 | 发现 | 证据 |
|---|---|---|---|---|
| M1 | **major** | `06 §11:726-734` | 门禁漏 `pnpm test` 与 `pnpm typecheck:extensions`；`05 §10.4:404` 的「root 无 test script」是被推翻的旧断言 | 见 §2.8 |
| M2 | **major** | `06:736` | 「`pnpm probe` 不用跑」偏窄——`05` 改了 `init-command.ts` 的初始化判据，`tools/probe-init.mjs:184-207` 有 nook 用例正是回归面 | 见 §2.8 |
| M3 | **major** | `04 §⑩ 10.4` | `assert.match(app, /setNookScene\(null\)/)` 只验「至少一处」，无法证明 `:379` 的 C5 修复 | 见 §4 |
| M4 | **major** | `03 §2.3:55` | `isValidNookScenePath(scene: string)` 未同步契约的 `string \| null \| undefined` | 契约 `00:356` / `01:52` 对 |
| M5 | **major** | `06 §3.0:115` / `02:462/524/530` | B3 的连带：`02 §8.1` 的错误矩阵把「文件」与「不存在」并列为同一条 404，掩盖了不可达性 | 见 B3 |
| M6 | **major** | `01:257` | 「既有，**新增 4 个纯函数**」与同文 `:4`/`:64`/`:262` 的「**五个**新函数」矛盾（`nookScenePathOf` 是第五个） | `01:4` vs `:257` |
| m1 | minor | `06 §13-5:791` | 建议「`nookSceneDoors` MUST sort」标「未拍板」，但 `01 §3.2` 已逐字委托 `childLayers`（`layers.ts:127` 有 `.sort()`）⇒ **已消解**，属「把已定写成未定」 | `01:3.2` |
| m2 | minor | `02 §8.1:471` | `scene` 是目录但不可读 ⇒ 200 + 空 items，与契约 §4.2「不是空画面」有张力（`02` 自己标为「可接受」） | 已自我登记，不计 |
| m3 | nit | `05:404` | 引用 `docs/nook/01` §⑬ 作为「无 test script」的权威，但该节本身也是旧断言 | 同 M1 |
| m4 | nit | `06 §2.2:57-64` | 存档洁净表不完整（`worlds/` 有 34 个世界，表列 6 个），虽不影响结论 | 见 §2.7 |

---

## 8. 总体判断

**本批设计的**可实施性**是扎实的**：`nookSceneOfPath` 的兜底陷阱被真正解决（自写最长前缀、实测不误匹配同名子场景）、`listDirs` 进接口给了零成本可落地解法、`03` 的 layout 守卫在接口补签名后可编译——**没有未解的硬阻塞**。「示例即代码」自检也**没有一个不存在的符号**，这在六份文档的体量下是很好的成绩。`06` 在**假绿意识**上尤其突出（主动标注 vacuous 项、专门告诫不要写「修复前 404」），这是本批最值得保留的品质。

**但验收门的可机械核验面有实质缺口**：`06` 承诺的「机械不变量」章节**整节不存在**（6 处交叉引用悬空，`N2-A21/A22` 无从复核），`N2-A26` 的核心断言因 `<Canvas>` 正则跨块吞并 JSDoc 而**在正确实现下仍会红**，`N2-A4`/`02` 的「文件路径 → 404」**不可达**（被形状闸先拒成 400），`03 §8.2` 还把 `nookSceneOfPath` import 进了**错误的模块**（会被逐字照抄成编译错误）。这四条都是「照着文档做就做不对」的缺陷，**必须先修再实现**。门禁清单另漏 `pnpm test` 与 `typecheck:extensions`，而 `05 §10.4` 仍在引用一条已被证据推翻的「root 无 test script」旧断言。

**修完 B1–B4 四条 blocker（及随行的 M1/M4）、并补齐 `06 §6` 的不变量实测后，本批可进入实现。**

---

## 附：本报告使用的实测命令

```bash
# 1. layerOfPath 兜底（契约 §5.3.1 复核）
node --input-type=module -e 'import { layerOfPath } from "./packages/shared/dist/store/layers.js"; ...'

# 2. 不变量 I1–I6 + 竞态（按 01 §3.1–§3.4 重写后跑；夹具见 §2.5）
node /tmp/n2c/inv.mjs

# 3. isNookEmpty / hasInitProduct 修复前行为（06 A19/A20 复核）
node --input-type=module -e 'import { isNookEmpty, hasInitProduct } from "./packages/shared/dist/rules/emptiness.js"; ...'

# 4. A26 正则的跨块吞并（B1）
node --input-type=module -e 'import { readFileSync } from "node:fs"; const s=readFileSync("apps/web/src/components/nook/NookView.tsx","utf8"); ...'

# 5. 夹具洁净度（06 §2.2 复核）
for d in worlds/*/; do [ -f "$d/.airpworld/canvas.db" ] && { echo "--- $d"; sqlite3 "$d/.airpworld/canvas.db" "SELECT id,layer FROM cards"; }; done
find templates -name 'chat-history'   # 零命中
find worlds -maxdepth 4 -name 'chat-history'   # 只命中 worlds/exp-default/...
```

**未跑**（按硬约束）：`pnpm build` / `pnpm test` / `pnpm probe`。
