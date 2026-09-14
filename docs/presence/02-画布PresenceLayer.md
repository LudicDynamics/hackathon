# docs/presence/02 — 画布 PresenceLayer：把「在场」画到坐标上

> 状态：设计（2026-09-14），待评审。本文只写设计，不改代码。
> 权威层级：`docs/presence/00-共同上下文.md`（冻结契约，下称「契约」）> 本文。
> 本文 MUST NOT 改动契约 §2–§4 的形状、语义与阈值；发现的差异写进 §11，不回改契约。
> 每一条「现状是 X」都带 `file:line`（基于本文作者亲自读过的源码）；不确定的标 `[推断]`。
> 边界（契约 §5 表第 2 行）：本文拥有 `PresenceLayer` 组件、头像几何与素材、点击直聊、`pointer-events`
> 接缝、阻尼入场/滑行、Depth 归属；MUST NOT 触碰侧栏 UI、服务端形状、排座算法、`.object` 卡片契约。

---

## 1. 一句话定位

**`PresenceLayer` 是画布上「同场景角色」的唯一渲染者：它把投影产出的 `in-scene` 角色画在
`presence.x/y` 这个中心点上，用 CSS 过渡（`transform`/`opacity`）而不是状态机来表达「跟上来」，并且
不是卡片——不挂 `.object`、不进拖拽、不进 footprint、不进相机取景。**

它不产生任何世界事实（不写文件、不写 SQLite、不发 WS、不落事件），只是一次投影。

---

## 2. 签名与参数

### 2.1 新组件（NEW）

```ts
// NEW — apps/web/src/components/canvas/PresenceLayer.tsx
import type { CharacterPresenceView } from '../../lib/presence.js';

export interface PresenceLayerProps {
  /** 契约 §4.1 的唯一投影，App 传入。本层只做过滤（`state === 'in-scene'`）+ 渲染，
   *  MUST NOT 从 `state.presence` / `characters` 重新推导。 */
  presence: CharacterPresenceView[];
  /** 玩家当前层；切层时用它给节点换 key，从而「入场」而不是「跨层滑行」。 */
  layerId: string;
  /** 单击头像 = 直聊；未传时节点降级为不可交互的静态标记（Nook 等无对话入口的宿主）。 */
  onOpenCharacterModal?: (charId: string) => void;
}

export const PresenceLayer: React.FC<PresenceLayerProps>;
```

### 2.2 纯函数模块（NEW，可单测）

把几何与阈值从组件里抽出来，组件只剩 DOM 与事件（契约 §4.1：投影与渲染都必须可测）。

```ts
// NEW — apps/web/src/lib/presence-node.ts（owner: 本文 / 02）
// 与 04 的 `apps/web/src/lib/presence.ts`（投影 owner）是两个文件：这里只算像素与时长。

export const PRESENCE_NODE_ATTR = 'data-presence-node';
export const PRESENCE_NODE_CLASS = 'presence-avatar';   // 见 §11 C-2：不复用 `.presence-orb`

export const PRESENCE_SLIDE_MS = 480;                                  // 契约 §4.2
export const PRESENCE_SLIDE_EASE = 'cubic-bezier(.22,.61,.36,1)';      // 契约 §4.2
export const PRESENCE_EXIT_MS = 260;                                   // 契约 §4.2
export const PRESENCE_EXIT_EASE = 'ease-out';                          // 契约 §4.2
export const PRESENCE_ENTER_MS = 360;                                  // 契约 §4.2
export const PRESENCE_ENTER_OFFSET_PX = 8;                             // 契约 §4.2
export const PRESENCE_STAGGER_MS = 60;                                 // 契约 §4.2
export const PRESENCE_STILL_MS = 120;                                  // 契约 §4.2 的「≤120ms」上界

export interface PresenceMotionPrefs {
  /** `prefers-reduced-motion`（契约 §4.2 已裁决：唯一的动效开关输入之一）。 */
  reducedMotion: boolean;
  /** 页面可见（契约 §4.2 / `docs/ux/00 §4.7`：不可见时降级，恢复后重新允许）。 */
  pageVisible: boolean;
}

/** true = 允许位移阻尼；false = 只允许透明度即时/≤120ms。 */
export function presenceMotionAllowed(prefs: PresenceMotionPrefs): boolean;

/** 节点的位置（世界像素，**中心点**）：`translate3d(${x}px, ${y}px, 0)`。
 *  y 非有限数时回退 `0`（防御服务端脏行，不抛错、不渲染到 NaN 坐标）。 */
export function presenceRootTransform(view: CharacterPresenceView): string;

/** 渲染次序（契约 §4.2「跟随带过来的…错峰排在最后」的唯一实现处）：
 *  先非跟随者（按 `views` 数组序），再跟随者（按 `views` 数组序）。
 *  调用方渲染前先跑一次它，把结果的下标当作 `order` 传给 descriptor——
 *  「谁排最后」只在这里定义一次，descriptor 不重复实现。纯函数、不改入参。 */
export function presenceRenderOrder(
  views: CharacterPresenceView[]
): CharacterPresenceView[];

/** 入场描述子：`order` = `presenceRenderOrder()` 结果里的下标（0 起，单调）；
 *  `delayMs` = `order × stagger`；`offsetPx` = 8 或 0；`durationMs` = 360 或 ≤120。 */
export function presenceEntryDescriptor(
  order: number, view: CharacterPresenceView, prefs: PresenceMotionPrefs
): { delayMs: number; offsetPx: number; durationMs: number };
```

### 2.3 对 `Canvas` props 的最小增补

只加一个可选 prop，别的都不动：

```ts
// apps/web/src/components/canvas/Canvas.tsx —— CanvasProps 内新增（放在 `items` 之后）
/** 画布在场头像的输入（契约 §3.1/§4.1）。缺省 `[]` = 不渲染任何头像（Nook 路径天然如此）。
 *  只有 `state === 'in-scene'` 的角色会出现在这里；本层不再做成员判定。 */
presence?: CharacterPresenceView[];
```

---

## 3. 行为契约（逐步）

### 3.1 渲染骨架

| # | 步骤 | 漏了会怎样 |
|---|---|---|
| 1 | 从 props 取 `presence`，过滤 `state === 'in-scene' && position !== null` | 把 `elsewhere` / `absent` 的角色也画出来——契约 §2.2 判定表被破，玩家在 A 场景看到 B 场景的人 |
| 2 | 每个在场景条目 → 一个节点，`key = \`${layerId}:${view.id}\``，位置 = `presenceRootTransform(view)` | 不换 key 时切层会复用同一个 DOM 节点，`transform` 产生 480ms **跨层滑行**（契约 §4.2 明禁：跨层坐标无几何意义）；用 `name` 当 key 会因重名/改名错位（`AGENTS.md §3` 路径与显示名分离） |
| 2b | 排序：`presenceRenderOrder(views)` 一次算定次序（非跟随者在前、跟随者在后），节点按该次序渲染，`order` 就是它的下标 | 用数组序直接当 `order` 时，跟随者与旁人在同一起跑线上，跟随者永远不会「错峰排在最后」（契约 §4.2）——这是最容易与 `01` 各写一套的一处 |
| 3 | 节点是**居中锚定**：外层壳承担 `translate3d(x,y,0)`，内层用 `translate(-50%,-50%)` 把 104px 盒子的中心对到 `(x,y)` | `presence.x/y` 被当成左上角，头像整体偏移半个身位——契约 §3.1 与 `docs/tools/05 §3.9.3` 决定 1 点名的最容易踩的一脚 |
| 4 | 素材解析：`view.avatar` 经 `assetUrl()`；无头像/加载失败 → 首字母圆牌 | 空图裂图标；且丢失「这个位置站的是谁」的唯一线索 |
| 5 | 跟随中：节点右下角挂状态图标（非按钮、`aria-hidden`），可及名称里带上 NEW 文案 `Following you` | 玩家看不出「他正在跟着我」，跟随的唯一可见证据消失（契约 §1 判据 2） |
| 6 | 单击 → `onOpenCharacterModal?.(view.id)`；未传 handler 时节点渲染成静态 `div` | 画布头像点了没反应（`docs/ux/00 §4.3`：角色头像遵守单击进入对话语义） |
| 7 | 位置变化时只改 `transform`，过渡由 CSS token 给；**不重建节点** | 每帧改 `left/top` 触发布局（`AGENTS.md §5`），大场景里拖慢整层 |

### 3.2 阻尼与延迟（阈值逐字取自契约 §4.2，不得自行改动）

| 场景 | 本文实现 | 时长 / 曲线 |
|---|---|---|
| **同层坐标变化**（`move_to` / `carryFollowers` 后重取） | 节点 key 不变 → 外层壳 `transform` 过渡滑行 | `480ms cubic-bezier(.22,.61,.36,1)` |
| **切层：离场** | 上一帧在场景、本帧不再在场景的条目 → 生成「离场快照」节点（保留旧坐标），淡出后卸载 | `260ms ease-out`，`opacity → 0`，且 `pointer-events: none` |
| **切层：入场** | key 变化 → 新节点挂载：淡入 + `8px` 上浮，按索引错峰 | `360ms cubic-bezier(.22,.61,.36,1)`，`stagger 60ms` |
| **切层：跟随带过来的角色** | `view.arrivedByFollow === true` → 同样走入场分支（**不**滑行），错峰排在最后 | 同入场：`360ms` / `8px` / `60ms`，排序时排在所有非跟随条目之后 |
| **侧栏成员状态翻转** | 不属本文；220ms 静默期是 04 的 `usePresence` 返回字段（04 内部唯一持有），本文只消费结果 | — |
| **Reduced motion / 页面不可见** | `presenceMotionAllowed() === false` → 位移过渡取消，入场退化为透明度 `≤120ms`，无 stagger | 契约 §4.2 末行（**已裁决**：presence 阻尼不受 `effectsEnabled` 控制） |

**为什么 `effectsEnabled` 不在输入里（契约 §4.2 裁决，2026-09-14）**：`App` 的 `effectsEnabled` 默认是 off
（`App.tsx:138-140`：`localStorage.getItem('airp:effects') === 'on'`，未设置即 `false`），而它 gate 的是
**环境装饰**——粒子（`Canvas.tsx:113` 的 `setParallax(0,0)`、`:584` 的 `ambient`）、指针视差（`:318`）、
动态背景（`SceneBackdrop.tsx:38/50/57/61`），开关文案就是 "Particles, parallax and animated backgrounds"
（`App.tsx:745`）。presence 的入场/滑行/淡出是**承载信息的状态过渡**（「谁跟过来了」），不是装饰：
与装饰开关绑定等于「关了特效就再也看不出谁在跟随」，正好废掉这一批特意要的阻尼感。
因此 `PresenceLayer` 的 props 里**没有** `effectsEnabled`，`presenceMotionAllowed` 只吃
`reducedMotion` 与 `pageVisible` 两个输入。

三条实现纪律：

- **只用 `transform` / `opacity`**（可合成属性）。MUST NOT 过渡 `left` / `top`（`AGENTS.md §5`）。
- **不新建常驻 rAF、不每帧创建对象**：一切都由 CSS transition 驱动；JS 只做两件一次性的事——挂载时读一次偏好、
  离场时 `setTimeout(…, 260)` 清理快照（与 `PhantomLayer.tsx:36` 的 `EVICT_FADE_MS`、`:53` 的 `window.setTimeout` 同款）。
- **stagger 是挂载时算一次的 inline 值**（`presenceEntryDescriptor().delayMs`），不是每帧重算。
  次序由 `presenceRenderOrder(views)` 一次算定：**先非跟随者、再跟随者**，两组内部都按 `presence` 数组序。
  数组序来自 `/api/layer` 的 `ORDER BY character_id`（契约 §3.1），所以两次请求之间不抖；
  而「跟随者排最后」由 `presenceRenderOrder` 独占实现（契约 §4.2 的「错峰排在最后」），
  descriptor 只做 `order × 60ms` 的乘法。**这条纪律只覆盖次序的来源，不覆盖跟随者的位置**——
  跟随者不在数组序里占位，是被搬到末尾的。

### 3.3 离场快照（展示层，不是状态）

切层时旧层的头像不该「啪」地消失——契约 §4.2 要求它保留快照淡出。实现方式：

1. 组件内部保存一个只读的 `exiting: { key: string; view: CharacterPresenceView }[]`（局部展示状态，坐标就在 `view.position` 里）；
2. 每次 `presence` / `layerId` 变化时与上一帧的在场集合做差：消失的条目进 `exiting`，`setTimeout(260ms)` 后移除；
3. 快照节点**保留旧的世界坐标**（它在旧层的位置），`aria-hidden="true"`、`pointer-events: none`、**渲染成 `div`
   而不是 `button`**——三个条件缺一不可：
   - 少了 `pointer-events: none`，一个正在消失的幽灵会截获点击，玩家点到的角色已经不是他以为的那个；
   - 少了 `aria-hidden`，屏幕阅读器会念出一个已经不在场的角色；
   - 渲染成 `button` 会让「不可交互」变成口头承诺（焦点仍可达）。

**MUST NOT 进入 `items` / `presence` 状态**（契约 §4.2 末段）：

- `items` 是服务端 seat 过的卡片行（`useWorld.ts:28-44`），presence 进去会被 `store.seatUnplaced` /
  `store.reseatLayer` 当卡片重排（`apps/server/src/routes/world.ts:781`、`:787` 是这两条既有重排路径）；
- `state.presence` 是 `/api/layer` 的真相快照（`useWorld.ts:55-60`），往里塞一个「正在消失的人」等于伪造在场——
  下一次 `world_event` 重取会把它冲掉，于是这个假状态既不可靠也不必要。

---

## 4. 文件与副作用

### 4.1 白名单

| 目标 | 谁写 | 说明 |
|---|---|---|
| `apps/web/src/components/canvas/PresenceLayer.tsx` | NEW（本文） | 组件本体 |
| `apps/web/src/lib/presence-node.ts` | NEW（本文） | 纯几何/阈值 |
| `apps/web/src/components/canvas/presence-layer.css` | NEW（本文） | 组件局部样式（对齐 `PropCard.tsx:5` 的 `import './prop-card.css'` 惯例） |
| `apps/web/src/components/canvas/Canvas.tsx` | 最小增补 | 新增 `presence?` prop、一处 import、一处挂载、指针分派里两行早退 |
| `apps/web/src/App.tsx` | 一行 | 把 `presenceViews` 传进 `<Canvas>`（投影由 04 产出） |
| `apps/web/src/lib/messages.json` | NEW 一条 | `Following you` 的 zh-CN / ja（`check:i18n`） |

**零副作用**：不写文件、不写 SQLite、不发 WS、不落事件、不碰 `localStorage`、不调度 `fetch`。

### 4.2 MUST NOT

- ❌ 给节点加 `object` / `object--ghost` 类或 `data-path` 属性（契约 §4.3；理由见 §6.1）。
- ❌ 自造 `z-index` 数字（`docs/ux/00 §4.2` 末句；用 `--depth-entity-*`，见 §5）。
- ❌ 过渡 `left` / `top`、新建常驻 rAF、每帧创建对象（§3.2）。
- ❌ 在前端计算角色坐标或把坐标灌回服务端（契约 §5 全局 MUST NOT 第 7 条；`docs/tools/05 §2.3`）。
- ❌ 复用 / 覆盖 `.presence-orb`：那是 `CanvasObject.tsx:53-61` 的 `SpriteFig` 用的「卡片内角色实体」几何
  （`scene-shell.css:43-44`，72px），与本文的自由坐标头像不是同一套。本文用 `.presence-avatar`。


---

## 5. Depth 与合成

- 节点根使用**既有 token** `--depth-entity-base`（`apps/web/src/index.css:25`，值 4）——与 `.object` 同属
  `entity` 深度带（`docs/ux/00 §4.2`）；hover 时可升到 `--depth-entity-focus`（`index.css:26`，值 30）。
  **不新增 `--depth-*` token、不写数字 literal**：`tools/check-ux-contract.mjs` 会扫 `apps/web/src/**/*.{tsx,css}`
  的 `z-index:` / `zIndex`（`docs/ux/02 §4.3`；`apps/web/test/layout-depth-seam.test.mjs:38-54` 已有同款断言），
  只认 `var(--depth-…)`。
- 与卡片同处 `entity` 带意味着「谁能盖住谁」由 DOM 顺序 + 各自 z 决定。这里不是问题：`seatPresence`
  的占用域同时包含该层 `cards` 行与该层其他 presence 行（`docs/tools/05 §3.9.3`），角色与卡片的最小中心距
  `(176 + w)/2 + 22`，几何上不重叠，所以覆盖关系不承载信息。
- DOM 顺序上 `PresenceLayer` 挂在 `Canvas.tsx:537-579` 的世界变换层内、`{items.map(…)}` **之后**、
  `{ghost && …}` **之前**：卡片先画、头像随后（同 z 时头像在上），而 ghost / `PhantomLayer` 仍是世界坐标里
  最后画的（`PhantomLayer.tsx:20-21` 的定位不变）。
- **合成成本**：节点 ≤ 角色数（世界角色量级，个位数），全部合成属性过渡，无 backdrop-filter、无 canvas。
  满足 `AGENTS.md §5`「新增全屏 canvas 或动画层前先评估合成成本」。

---

## 6. 前后端 / WS 接缝

### 6.1 为什么绝不挂 `.object` / `data-path`（契约 §4.3）

`.object` 不是一个类名，是五套机制的**入口选择器**，全部按 `.object` 找元素：

| 机制 | 现状落点 | 挂上 `.object` 的后果 |
|---|---|---|
| 卡片拖拽 | `Canvas.tsx:251` `target.closest('.object')` → 建 `CardDragSession` | 头像可以被拖走，拖完还会 `onMoveCard` 把角色路径当卡片行写给服务端 |
| 软碰撞推挤 | `Canvas.tsx:374-388` `querySelectorAll('.object')` + `pushFrom` | 拖一张卡片会推开附近的角色头像，而角色位置是服务端排座的唯一真相 |
| footprint 测量 | `apps/web/src/lib/footprint.ts:84` `root.querySelectorAll('.object[data-path]')`、`useWorld.ts:391-393` 的 `ResizeObserver` 观察集 | 头像高度会被当成卡片 footprint 上报，污染整层的尺寸真相 |
| 相机取景 | `Canvas.tsx:165` `viewport?.querySelectorAll('.object')` → `:168-177` 只按这些盒算 bounds | 新场景取景会把「某角色恰好站得远」算进画面边界，第一帧取景漂移（与 `Canvas.tsx:154-158` 注释里那个「首次拖拽跳位」同类的坑） |
| hover 强升层 | `apps/web/src/scene-shell.css:45` `.object:hover, .object:focus-within { z-index: 1000 !important }` | 头像 hover 直接跳到未登记的 1000 之上，与 `docs/ux/02 §4.3` 冲突 |

**如何确保（可机械核验）**：

1. 节点根写 `data-presence-node` + `className="presence-avatar"`，两条都用常量 `PRESENCE_NODE_ATTR` /
   `PRESENCE_NODE_CLASS` 从 `lib/presence-node.ts` 取，组件里不写字面量（防手滑）。
2. 静态断言：`PresenceLayer.tsx` 的源码**不含** `object`、`data-path` 这两个子串（见 §10.1）。
3. 运行时断言（浏览器验收，04 执行）：拖动一张卡片时头像的 bounding box 不变；`document.querySelectorAll('.object').length`
   在挂载前后不变。

### 6.2 数据来源（只读）

```
/api/layer 的 presence（含 x/y，契约 §3.1）
  → useWorld.fetchLayer → state.presence（useWorld.ts:55-60，逐字对齐，不增字段）
  → 04 的投影（CharacterPresenceView[]，含 220ms 稳定窗口）
  → App 传 <Canvas presence={presenceViews}>
  → <PresenceLayer presence layerId onOpenCharacterModal>
```

- **不新增 WS 帧**（契约 §5 第 1 条）。`world_event` → 整层重取已由 `useWorld.ts:430-453` 覆盖，画布自动更新，
  本文一行都不用改。
- **Nook 路径天然为空**：`NookView.tsx:459` / `:504` 渲染 `<Canvas>` 时不传 `presence`，默认 `[]`，
  与 `/api/nook` 恒返回 `presence: []`（`world.ts:659-661`）一致（契约 §2.5）。

### 6.3 指针接缝（对 `Canvas` 的唯一行为改动）

现状：头像不挂 `.object` 时，`handlePointerDown` 的 `.object` 分支不命中，
**直接落到视口 pan/pinch 分支**（`Canvas.tsx:283-307`）——点头像会同时开始一次平移会话。

修法（一行早退，插在 `Canvas.tsx:249` 的 `void unlock()` 之后、`:251` 的 `.object` 判断之前）：

```ts
// PresenceLayer nodes are not cards and never start a card-drag or a viewport
// pan: the avatar's click is the dialogue entry (docs/ux/00 §4.3).
if (target.closest(`[${PRESENCE_NODE_ATTR}]`)) return;
```

- 放在 `unlock()` **之后**：点头像仍然解锁音频上下文（与点任何地方一致）。
- 放在 `.object` 判断**之前**：presence 与卡片永不同时命中，顺序只要明确即可。
- `handleContextMenu`（`Canvas.tsx:499-516`）也要加同一早退：空白右键菜单的判断为
  `target.closest('.object') || target.closest('button, a, input')`，头像都不命中 → 会弹径向造物菜单。
  **这不可接受**（右键一个角色却弹出「造物菜单」），因此在 `:501` 的条件里追加
  `|| target.closest(\`[${PRESENCE_NODE_ATTR}]\`)`（返回 = 保留浏览器原生菜单）。

### 6.4 i18n

- 可及名称复用**既有 key** `Talk to {name}`（`apps/web/src/lib/messages.json:574`；`App.tsx:791` 已是同款用法），
  **不新增**。
- 跟随状态图标需要 NEW key：`Following you`（zh-CN「跟随中」/ ja「同行中」），按 `check:i18n` 补全两语。
- 无新增玩家可见错误文案（见 §7）。

---

## 7. 错误与边界

| 情形 | 行为 | 英文文案 / 断言 |
|---|---|---|
| `avatar` 缺失 | 渲染首字母圆牌（`view.id[0].toUpperCase()`），参照 `App.tsx:786-797` 的既有做法 | 无文案（纯降级） |
| `avatar` 解析出的 URL 404 / 解码失败 | `<img onError>` 切到首字母圆牌，且 `failedSrc` 是**字符串**不是布尔，`avatar` 变了自动复位（同 `CanvasObject.tsx:104-118` 的 `failedSrc` 范式） | 无文案 |
| `presence` 条目在 `characters` 里找不到（悬空行） | **不渲染**（没有名字、没有头像，画出来是一个无法解释的圆）；每个 id 只 `console.warn` 一次 | `[presence] presence entry has no character in the manifest; skipping "watson"`（诊断；它不对应任何玩家动作，不适用契约 §5 第 6 条） |
| `x` / `y` 非有限数 | `presenceRootTransform` 回退 `translate3d(0px, 0px, 0)`，节点仍渲染（不抛错、不产生 `NaN` 坐标把节点丢到画布外） | 无文案 |
| 角色数 = 0 | 组件 `return null` | 无文案 |
| `onOpenCharacterModal` 未传 | 节点渲染成 `<div>`（不可点、无 `tabindex`），**不**渲染成 disabled button——disabled 会让「为什么点不了」变成一个谜 | 无文案 |
| 页面不可见（`document.hidden`） | `presenceMotionAllowed → false`：只保留透明度、且即时；恢复可见后重新允许 | 无文案 |
| 离场快照超时清理被打断（组件卸载） | `useEffect` 清理里 `clearTimeout`，不留悬挂定时器 | — |

---

## 8. 代码落点

| 符号 | 文件 | NEW / 既有 |
|---|---|---|
| `PresenceLayer` / `PresenceLayerProps` | `apps/web/src/components/canvas/PresenceLayer.tsx` | NEW |
| `PresenceAvatar`（组件内私有，负责一个头像的 DOM） | 同上 | NEW |
| `useDocumentVisible`（私有薄 hook，`visibilitychange`，只给驻留节点切 `data-still`） | 同上 | NEW |
| `presenceMotionAllowed` / `presenceRenderOrder` / `presenceRootTransform` / `presenceEntryDescriptor` / 8 个阈值常量 / `PRESENCE_NODE_ATTR` / `PRESENCE_NODE_CLASS` | `apps/web/src/lib/presence-node.ts` | NEW |
| `.presence-avatar*` 样式（含 `@media (prefers-reduced-motion: reduce)` 与 `[data-still="true"]` 覆盖） | `apps/web/src/components/canvas/presence-layer.css` | NEW |
| `CanvasProps.presence?` | `apps/web/src/components/canvas/Canvas.tsx:19-44` | 既有（加一行） |
| `<PresenceLayer …/>` 挂载 | `Canvas.tsx:537-579`（世界变换层内，`{items.map}` 之后、ghost 之前） | 既有位置 |
| `handlePointerDown` 早退 + `handleContextMenu` 早退 | `Canvas.tsx:248-252` / `:499-503` | 既有（各加一行） |
| `presence={presenceViews}` | `apps/web/src/App.tsx:694-720` | 既有（加一行） |
| `useStill` | `apps/web/src/lib/motion.ts:28` | 既有（直接复用，不重写 reduced-motion 探针） |
| `assetUrl` | `CanvasObject.tsx:64-70`（模块私有） | 既有——`App.tsx:106-115` 是同名私有实现；`PresenceLayer` 复用前者（`[推断]`：更省一次改动；若要收敛成公共模块由 01 视觉语法篇决定） |

---

## 9. 与现状差异（逐条带 `file:line`）

| # | 现状 | 本文之后 |
|---|---|---|
| D1 | 画布完全不渲染 presence：`state.presence` 全仓唯一消费点是 `App.tsx:418` 取 `characterId` 算「见过谁」 | 新增 `PresenceLayer` 消费 `CharacterPresenceView[]`，把 `in-scene` 角色画在 `(x,y)` |
| D2 | `CanvasProps`（`Canvas.tsx:19-44`）没有 presence 输入 | 新增可选 `presence?: CharacterPresenceView[]` |
| D3 | `handlePointerDown`（`Canvas.tsx:248-252`）只认 `.object` 与交互子元素，其他一律落到视口 pan（`:283-307`） | 新增 `[data-presence-node]` 早退，点头像不再起 pan |
| D4 | `handleContextMenu`（`Canvas.tsx:499-503`）对非 `.object` 目标弹径向造物菜单 | 头像上右键保留原生菜单 |
| D5 | 既有头像渲染是「卡片里的 sprite」：`CanvasObject.tsx:53-61` 的 `SpriteFig` 用 `.presence-orb`（`scene-shell.css:43-44`，72px），且**必须是 `.object` 的子节点**才被看见 | 自由世界坐标头像走 104px halo 材质（`index.css:1384-1390`），类名 `.presence-avatar`，**不**是卡片 |
| D6 | 阻尼阈值只存在于契约 §4.2 | 落成 `lib/presence-node.ts` 的具名常量，供测试逐字断言 |
| D7 | Nook 复用 `Canvas` 时不传 presence（`NookView.tsx:459`） | 行为不变：默认 `[]`，与 `world.ts:659-661` 的 `presence: []` 对齐 |
| D8 | `docs/前端改造计划.md:68/267-269` 计划把该组件放在 `cards/PresenceNode.tsx` 并做 `echoing` 态 | 本批次落 `canvas/PresenceLayer.tsx`；`echoing` 不做（无帧、无状态源，见 §11 C-3） |

---

## 10. 验收测试

新增 `apps/web/test/presence-layer.test.mjs`（`node --test` 单个文件即可，见 §12）。

### 10.1 非空性用例（今天必失败）

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// 与 layout-depth-seam.test.mjs 同款：源码文本 + 纯函数断言，不需要 DOM。
const src = await readFile(new URL('../src/components/canvas/PresenceLayer.tsx', import.meta.url), 'utf8');
const canvas = await readFile(new URL('../src/components/canvas/Canvas.tsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/components/canvas/presence-layer.css', import.meta.url), 'utf8');
const jiti = await import('../../../vendor/pi-rp/node_modules/jiti/lib/jiti.mjs').then(m =>
  m.createJiti(import.meta.url, { moduleCache: true, tryNative: false }));
const node = await jiti.import('../src/lib/presence-node.ts');

test('presence nodes are placed at the CENTRE (presence.x/y), not a top-left', () => {
  assert.equal(
    node.presenceRootTransform({ id: 'watson', state: 'in-scene', position: { x: 1056, y: 540 } }),
    'translate3d(1056px, 540px, 0)'
  );
  // 脏坐标不产生 NaN 位移
  assert.equal(
    node.presenceRootTransform({ id: 'x', state: 'in-scene', position: { x: NaN, y: 1 } }),
    'translate3d(0px, 0px, 0)'
  );
});

test('only in-scene characters render; absent/elsewhere are not drawn', () => {
  assert.match(src, /state === 'in-scene'/);   // 过滤条件存在
  assert.match(src, /position/);               // 位置取自投影，不从别处推导
  assert.doesNotMatch(src, /state\.presence/); // 不绕过投影
  assert.doesNotMatch(src, /items\b/);         // 不挂进 items
});

test('presence nodes never become cards: no .object / data-path, and the node attr is a constant', () => {
  assert.doesNotMatch(src, /\bobject\b/);
  assert.doesNotMatch(src, /data-path/);
  assert.match(src, /PRESENCE_NODE_ATTR/);
  assert.match(src, /PRESENCE_NODE_CLASS/);
  assert.equal(node.PRESENCE_NODE_CLASS, 'presence-avatar'); // 不复用 .presence-orb（§11 C-2）
});

test('Canvas mounts PresenceLayer inside the world transform layer and guards the pointer seams', () => {
  assert.match(canvas, /<PresenceLayer\b/);
  assert.match(canvas, /presence\?: CharacterPresenceView\[\]/);
  assert.match(canvas, /closest\(`\[\$\{PRESENCE_NODE_ATTR\}\]`\)/); // 拖拽 + 右键两处早退
  assert.equal((canvas.match(/closest\(`\[\$\{PRESENCE_NODE_ATTR\}\]`\)/g) ?? []).length, 2);
  // 挂载点在世界变换层内：`<PresenceLayer` 出现在 `<LinkLayer` 之后、`</div>` 收口之前
  const world = canvas.slice(canvas.indexOf('<div ref={camera.worldRef}'), canvas.indexOf('<ParticleLayer'));
  assert.ok(world.includes('<PresenceLayer'));
});

test('damping thresholds match contract §4.2 verbatim', () => {
  assert.equal(node.PRESENCE_SLIDE_MS, 480);
  assert.equal(node.PRESENCE_SLIDE_EASE, 'cubic-bezier(.22,.61,.36,1)');
  assert.equal(node.PRESENCE_EXIT_MS, 260);
  assert.equal(node.PRESENCE_EXIT_EASE, 'ease-out');
  assert.equal(node.PRESENCE_ENTER_MS, 360);
  assert.equal(node.PRESENCE_ENTER_OFFSET_PX, 8);
  assert.equal(node.PRESENCE_STAGGER_MS, 60);
  assert.equal(node.PRESENCE_STILL_MS, 120);
});

test('displacement is NOT gated by the Effects toggle (contract §4.2 ruling)', () => {
  // 非空性：按旧口径实现（把 effectsEnabled 当输入）会失败。
  // 「Effects off 状态下阻尼仍照常生效」——Effects 是装饰开关，presence 是信息过渡。
  assert.equal(
    node.presenceMotionAllowed({ reducedMotion: false, pageVisible: true }),
    true
  );
  assert.doesNotMatch(src, /effectsEnabled/);   // props/实现里都不该出现
  assert.match(src, /data-still/);              // reduced-motion 的运行时降级开关
  assert.doesNotMatch(canvas, /<PresenceLayer[^>]*effectsEnabled/); // 也不通过 Canvas 透传
  assert.doesNotMatch(src, /localStorage/);     // 不自己读偏好
});

test('reduced motion / hidden page: no displacement, opacity only, <=120ms', () => {
  assert.equal(node.presenceMotionAllowed({ reducedMotion: false, pageVisible: true }), true);
  for (const prefs of [
    { reducedMotion: true, pageVisible: true },
    { reducedMotion: false, pageVisible: false },
    { reducedMotion: true, pageVisible: false },
  ]) {
    assert.equal(node.presenceMotionAllowed(prefs), false);
    const d = node.presenceEntryDescriptor(0, { id: 'w', state: 'in-scene', arrivedByFollow: false }, prefs);
    assert.equal(d.offsetPx, 0);                            // 不位移
    assert.equal(d.delayMs, 0);                             // 无 stagger
    assert.ok(d.durationMs <= node.PRESENCE_STILL_MS);      // ≤120ms
  }
});

test('followed-in characters are treated as an entry and staggered last', () => {
  const on = { reducedMotion: false, pageVisible: true };
  // 次序由 presenceRenderOrder 唯一决定：非跟随者在前、跟随者在后，两组内部保持数组序。
  const views = [
    { id: 'a', state: 'in-scene', arrivedByFollow: true },
    { id: 'b', state: 'in-scene', arrivedByFollow: false },
    { id: 'c', state: 'in-scene', arrivedByFollow: true },
    { id: 'd', state: 'in-scene', arrivedByFollow: false },
  ];
  assert.deepEqual(node.presenceRenderOrder(views).map(v => v.id), ['b', 'd', 'a', 'c']);
  // order 是 presenceRenderOrder 结果的下标，所以跟随者一定拿到更大的 delayMs。
  const ordered = node.presenceRenderOrder(views);
  const lastPlain = ordered.findLastIndex(v => !v.arrivedByFollow);
  const firstFollower = ordered.findIndex(v => v.arrivedByFollow);
  assert.ok(firstFollower > lastPlain, 'every follower must come after every non-follower');
  const follower = node.presenceEntryDescriptor(firstFollower, ordered[firstFollower], on);
  const plain = node.presenceEntryDescriptor(lastPlain, ordered[lastPlain], on);
  assert.ok(follower.delayMs > plain.delayMs, 'followed-in nodes must sort last');
  assert.equal(follower.offsetPx, node.PRESENCE_ENTER_OFFSET_PX); // 入场，不跨层滑行
  // stagger 是纯乘法，order 单调即可
  assert.equal(
    node.presenceEntryDescriptor(3, ordered[3], on).delayMs,
    3 * node.PRESENCE_STAGGER_MS
  );
});

test('CSS: semantic depth only, transform/opacity only, reduced-motion override present', () => {
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const value of [...rules.matchAll(/z-index\s*:\s*([^;}\n]+)/g)].map(m => m[1])) {
    assert.match(value, /^var\(--depth-[a-z0-9-]+\)\s*(?:!important)?$/);
  }
  assert.doesNotMatch(rules, /transition[^;}]*\b(left|top)\b/);
  assert.match(rules, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.doesNotMatch(src, /requestAnimationFrame/); // 无常驻 rAF
});

test('exiting snapshot is non-interactive and outside world state', () => {
  // 快照分支带 aria-hidden；快照用 div 不用 button
  assert.match(src, /aria-hidden/);
  assert.doesNotMatch(src, /setState\(?\s*\(?\s*(?:s|state)\s*=>\s*\(\{\s*\.\.\.s/); // 不写回世界状态
});
```

### 10.2 浏览器验收（由 04 的矩阵执行，本文给出断言）

1. 同场景角色渲染于 `/api/layer` 的 `presence.x/y`：读头像中心与 `presence` 值比对（容差 1px）。
2. 不在场 / 在别处的角色：`document.querySelectorAll('[data-presence-node]').length` 等于在场景角色数（不多不少）。
3. 头像**不匹配** `.object` 选择器：`[data-presence-node].matches('.object') === false`，且
   `document.querySelectorAll('.object').length` 不因它变化。
4. 拖一张卡片时头像的 bounding box 不变（证明不进软碰撞），且头像的 `offsetWidth/Height` 不出现在
   footprint 上报里。
5. `move_to` 同层位移：位置在 ≈480ms 内到位，且变化的是 `transform` 而不是 `left/top`。
6. 切层：旧层头像淡出 260ms 后从 DOM 消失；新层头像淡入 + 上浮 8px，错峰 60ms；**无**跨层滑行
   （新节点首帧即在新坐标）。
7. **Effects off 状态下阻尼照常生效**（非空性：按旧口径实现会失败）——在 header 关掉
   "Particles, parallax and animated backgrounds"（`App.tsx:745`）后重跑第 5/6 条，结果不变。
8. `prefers-reduced-motion: reduce`（Playwright `emulateMedia`）或页面不可见时：位置瞬时到位，
   无中间帧位移、无 stagger。
9. 单击头像 → `CharacterModal` 打开（`docs/ux/00 §4.3` 的直聊语义）。
10. 头像上右键**不**弹径向造物菜单；点头像**不**触发任何 pan（`cardDragRef` 与 `dragRef` 都保持 `null`）。

---

## 11. 发现的冲突 / 需要修订的上位文档

| # | 冲突 | 证据 | 建议 |
|---|---|---|---|
| **C-1（已裁决）** | 契约 §4.2 原把「Effects off」列为降级条件，而 `App` 的 `effectsEnabled` **默认是 off**（`App.tsx:138-140`：`localStorage.getItem('airp:effects') === 'on'`，未设置即 `false`），且它 gate 的是**环境装饰**（粒子 `Canvas.tsx:584`、指针视差 `:318`、动态背景 `SceneBackdrop.tsx:38/50/57/61`；开关文案 `App.tsx:745`）。照字面实现 ⇒ 默认状态下阻尼全程关闭，「跟上来」的体验默认不可见 | `App.tsx:138-140`、`App.tsx:745`、契约 §4.2 末行 | **已裁决，契约 §4.2 已改写**：presence 阻尼 MUST NOT 受 `effectsEnabled` 控制，降级输入只有 `prefers-reduced-motion` 与页面可见性。本文已同步：`PresenceLayer` 无该 prop、`presenceMotionAllowed` 无该输入、§10 的非空性断言包含「Effects off 下阻尼仍在」 |
| **C-2** | `.presence-orb` **已被占用**（`CanvasObject.tsx:53-61` 的 `SpriteFig`，样式 `scene-shell.css:43-44`，72px，卡片内几何）。复用它会与「自由世界坐标头像」两套几何互相污染 | `CanvasObject.tsx:53-61`、`scene-shell.css:43-44`；ProjectionGate 已 IRC 提示 | 本文用 `.presence-avatar` + `data-presence-node`，与 `.presence-orb` 明确分家。**不需要改动契约**，但请在 §4.1 的投影注释里补一句「消费方自起类名」以免后来者误用 |
| **C-3** | `docs/前端改造计划.md:267-269`（T1.5）设计画布 presence 含 `echoing` 态（作家落笔时全场头像进回音态）。本批次**没有**对应的帧/状态源：`docs/tools/12 §6.2` 是帧名唯一真相源，契约 §5 全局 MUST NOT 第 1 条禁止新增帧，04 的投影里也没有该字段 | `docs/前端改造计划.md:267-269`、契约 §5 第 1 条 | 本批次不做 `echoing`（也不做「在线绿 / 回音锈红」双色状态点）。请主代理确认：是在本期登记为「超出批次范围」，还是给 04 的投影加一个字段（那需要先有帧，属契约变更） |
| **C-4** | `apps/web/src/scene-shell.css:45` 的 `.object:hover, .object:focus-within { z-index: 1000 !important }` 是未登记的 literal z-index（既有问题，非本批次引入） | `scene-shell.css:45`、`docs/ux/02 §4.3` | 归 01 视觉语法篇的登记清单；本文只需保证**不加重它**（不与 `.object` 混用类名，所以头像不会命中这条 1000；`.presence-avatar` 自带 `:hover` 规则） |
| **C-5** | `docs/ux/00 §4.3` 说「角色头像遵守单击进入对话语义」，`docs/doc-06 §5.4` 原说「点头像 = 导航」。契约 P-1 已裁为「单击 = 直聊」，但 `doc-06`/`doc-05` 的回写尚未落地 | 契约 §7 P-1、`docs/ux/00 §4.3` | 回写义务在 `03`（角色栏）同款；本文只按新口径实现，不重复登记 |
| **C-6（本稿自相矛盾的修正，P-17）** | 初稿的 §2.2 签名只吃 `index`、§3.2 又把 `index` 定死为 `presence` 数组序，而 §10.1 却断言 `index=0` 的跟随者 `delayMs > index=99` 的非跟随者——按签名实现用例必红，按用例实现签名与纪律都要改 | 初稿 §2.2 / §3.2 / §10.1 三处 | **已修正**：把「谁排最后」抽成独立的纯函数 `presenceRenderOrder(views)`（NEW），descriptor 的入参由 `index` 改为 `order`（= 该函数结果的下标），descriptor 只做 `order × 60ms`。§3.1 新增步骤 2b、§3.2 的 stagger 纪律补明「数组序只管组内、跟随者是被搬到末尾的」、§10.1 的用例改为先断言 `presenceRenderOrder` 的分组结果再断言 `delayMs` 单调——签名、纪律、用例三者自洽 |

---

## 12. 仍未知 / 待拍板

只有一条真正待定；其余两条已在 2026-09-14 的裁决中关闭，列出以免后来者重新纠结：

1. **[待定] 窄屏（≤390px）的头像尺寸**：默认 104px（三处一致，见下），若 04 的窄屏验收要求缩到 72px，
   只改 `presence-layer.css` 的 `--presence-avatar-size` 一个变量。相邻角色中心距最小 198px
   （`docs/tools/05 §3.9.4`），在 390px 宽、z=0.95 的视口里约显示 2 个——这决定缩不缩。
2. **[已裁定] 头像尺寸 = 104px**：`docs/doc-04-视觉设计风格.md:195`、`docs/前端改造计划.md:68` 与
   `index.css:1384-1390` 的 `.sprite__halo` 三处一致。排座按 `CARD_FORMS.sprite` 的 176×196
   （`docs/tools/05 §3.9.4`），与头像直径无关，所以它只是 CSS 变量。
3. **[已裁定] `assetUrl` 不收敛**：`App.tsx:106-115` 与 `CanvasObject.tsx:64-70` 是两份同名私有实现，
   抽公共模块属独立清理、**不在本批次**；本文直接复用既有实现，不新增第三份。
