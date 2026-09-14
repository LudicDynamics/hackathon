# 03 — Chalk 交互锁与上帝模式

## 一句话定位

把“Chalk 能否被 Canvas 拖动”从 `attention` 中拆成独立的 God Hand 编辑状态：非上帝模式只拦截 Chalk 的卡片拖拽，不拦截阅读、choice、dice、use-item；上帝模式显式开启后才允许 Chalk 拖动，而幻影始终不可拖。

## 1. 现状证据与边界

- `Canvas` 的 viewport 在 `apps/web/src/components/canvas/Canvas.tsx:239-267` 通过 `target.closest('.object')` 统一创建 `CardDragSession`；目前只排除 `button, a, input, select, textarea, [data-no-drag]`，没有 `kind === 'chalk'` 的权限判断。
- Canvas 的 pointer dispatcher 绑定在同一 viewport 的 `onPointerDown/onPointerMove/onPointerUp/onPointerCancel`（`Canvas.tsx:505-515`）；因此 Chalk 锁必须在 pointerdown 的唯一入口判断，不能只给卡片加 CSS 或在 `CanvasObject` 再挂一套监听。
- `CanvasObject` 的根节点在 `apps/web/src/components/canvas/CanvasObject.tsx:231-290` 负责阅读点击、Enter 阅读、hover/focus，以及 `EntityInteractions`；`EntityInteractions` 根节点带 `data-no-drag`（`CanvasObject.tsx:289`，`apps/web/src/components/narrative/EntityInteractions.tsx:83-85`）。
- `CardRenderer` 明确由 `ChalkCard` 绘制 Chalk，而 choice/status/dice 归 `CanvasObject` 上的 `EntityInteractions` 单一持有（`apps/web/src/components/canvas/CardRenderer.tsx:108-120`）。这保证锁拖拽时不会误关互动组件。
- App 当前只有 `Attention = 'ambient' | 'authoring'`（`apps/web/src/App.tsx:76`），并以 `attention` 控制 authoring chrome（`App.tsx:681-685`）。写行动按钮也会切换它（`App.tsx:654`），全局 Enter 进入写行动也会切换它（`App.tsx:301-333`）；所以 `attention === 'authoring'` 不是上帝之手授权。
- 当前 `GodModeToolbar` 仅呈现/切换世界 freeze（`apps/web/src/components/god/GodModeToolbar.tsx:4-35`），并没有 Chalk 编辑开关。它目前挂在 `attention === 'authoring'` 分支中（`App.tsx:681-685`）。
- `PhantomLayer` 的 `.object--ghost` 使用 `pointer-events: none`（`apps/web/src/components/canvas/PhantomLayer.tsx:19-20,80-83`），幻影没有真实 path；本篇不得把 God Hand 例外扩展到幻影。
- `moveCard` 先乐观更新本地 item，再调用 `airpGateway.moveCard`，失败时回滚（`apps/web/src/state/useWorld.ts:208-225`）。后端 `/api/card/position` 以 `{ type: 'player' }` 调 `arrangeCards({ place })`，成功后广播既有 `card_position`（`apps/server/src/routes/world.ts:830-852`）。

本篇只设计前端交互授权状态与事件分流；不改变 `flowColumns`、自动批次、幻影座位或服务端鉴权。布局几何必须遵守 `docs/layout/00-共同上下文.md:98-163`，Chalk 权限与幻影边界遵守 `00:167-185`、`00:189-195`。

## 2. 冻结状态与跨端接线

### 2.1 独立状态

App 新增以下状态（**NEW**，实现时放在 `apps/web/src/App.tsx` 的 App state 区，不写入世界文件、`cards.metadata` 或 WS）：

```ts
// NEW
const [isGodHandOpen, setIsGodHandOpen] = useState(false);

// NEW
const handleToggleGodHand: () => void = () => {
  setIsGodHandOpen(open => !open);
};
```

`allowChalkDrag` 是传给 Canvas 的派生布尔值（**NEW**）：

```ts
// NEW
const allowChalkDrag: boolean = isGodHandOpen;
```

它只表示“本次 Canvas 是否允许 Chalk 进入卡片拖拽状态”，不表示用户身份、不表示 HTTP 权限，也不替代 `attention`、`worldFrozen` 或 writer 状态。默认值必须为 `false`，未知值/缺失 prop 必须 fail closed。

### 2.2 Canvas 接口

扩展 `CanvasProps`（**NEW**）但不改变现有回调含义：

```ts
// NEW field in CanvasProps
allowChalkDrag?: boolean;
```

完整组件输入形状仍是现有 `CanvasProps`（`apps/web/src/components/canvas/Canvas.tsx:19-38`）加上述可选字段。App 在 `Canvas` 调用点（`App.tsx:518-547`）显式传 `allowChalkDrag={isGodHandOpen}`，不要让 Canvas 读取 App 的 `attention` 或任何全局单例。

### 2.3 GodModeToolbar 开关

把开关放入 God Hand chrome，由 `GodModeToolbar` 同时展示 freeze 和编辑状态。新增 props（**NEW**）：

```ts
// NEW fields in GodModeToolbarProps
allowChalkDrag: boolean;
onToggleChalkDrag: () => void;
```

建议使用原生 `button type="button"`，以 `aria-pressed={allowChalkDrag}` 表示 toggle 状态，标签明确写出“Enable Chalk editing / Disable Chalk editing”（可由现有 i18n 传入 labels）。开关改变 `isGodHandOpen`，不改变 `attention`；关闭 God Hand 的 close 按钮同时关闭编辑状态，避免离开上帝 chrome 后留下不可见的编辑开关。

开关不是安全权限：恶意调用 `/api/card/position` 仍可能直接请求服务端；真正的 actor/认证授权必须另行设计。本篇只定义可信 UI 的交互语义，遵守 `docs/layout/00-共同上下文.md:183-185`。

## 3. 代码落点（实现顺序）

1. **App 状态与接线：** 在 `apps/web/src/App.tsx:108` 附近新增 `isGodHandOpen`，在 `App.tsx:518-547` 的 `Canvas` 调用点传 `allowChalkDrag={isGodHandOpen}`；在 `App.tsx:654` 的写行动按钮、`App.tsx:301-333` 的全局键盘处理和 `App.tsx:681-685` 的 close 分支中保持 attention 与 God Hand 状态分离。
2. **Canvas 输入口：** 在 `apps/web/src/components/canvas/Canvas.tsx:19-38` 的 `CanvasProps` 增加 prop，在 `Canvas.tsx:82-100` 解构；在 `Canvas.tsx:239-267` 的唯一 pointerdown dispatcher 中，interactive-child guard 之后、`CardDragSession` 创建之前执行 Chalk guard；`Canvas.tsx:297-402`、`404-449` 不另造拖动或持久化路径。
3. **CanvasObject 交互面：** `apps/web/src/components/canvas/CanvasObject.tsx:137-149` 保持现有回调接口，`CanvasObject.tsx:231-290` 继续提供阅读、focus 与 `EntityInteractions`；不在 CanvasObject root 增加独立拖拽监听。
4. **God 控件：** 在 `apps/web/src/components/god/GodModeToolbar.tsx:4-35` 增加 Chalk 编辑 toggle props 与可访问 button；freeze 回调和 `worldFrozen` 语义不与 `isGodHandOpen` 合并。
5. **幻影与持久化：** `apps/web/src/components/canvas/PhantomLayer.tsx:80-83` 保持 `.object--ghost` 非指针目标；God Chalk 仍通过 `Canvas.tsx:404-449` 的 `onMoveCard`，`apps/web/src/state/useWorld.ts:208-225` 和 `apps/server/src/routes/world.ts:830-852` 不改事件/actor 形状。

## 4. 行为步骤（每步说明漏了会怎样）


### 4.1 开启与关闭

1. App 初始 `isGodHandOpen=false`，并向 Canvas 传 `allowChalkDrag=false`。**漏掉默认 false 会怎样：**普通玩家首次点击 Chalk 就可能进入拖拽，违反 `00:169-175`。
2. 用户通过 God Hand toolbar 的键盘或指针可达 toggle 开关；开关更新 `isGodHandOpen`，并把 `allowChalkDrag` 传入 Canvas。**漏掉显式开关会怎样：**只能依赖 `attention` 猜权限，写行动会意外解锁 Chalk。
3. 用户关闭开关或离开 God Hand chrome 时，`isGodHandOpen=false`；已有 drag session 按现有 pointer 生命周期完成/取消，新 pointerdown 立即重新受锁。**漏掉关闭回写会怎样：**界面显示已退出上帝模式但仍能启动新的 Chalk 拖动，形成状态欺骗。
4. `attention` 继续独立控制 writer/authoring 的视觉 chrome；写行动按钮与全局 Enter 仍可切换 authoring，但绝不写 `isGodHandOpen=true`。**漏掉独立状态会怎样：**玩家输入行动时 Chalk 解锁。

### 4.2 pointerdown 分流

在 `Canvas.tsx:239-267` 现有 interactive-child guard 之后、创建 `CardDragSession` 之前加入 Chalk guard。建议的条件（**NEW**，若抽成 helper 必须保持完整签名）为：

```ts
// NEW
function canStartCardDrag(
  item: LayerItem | undefined,
  target: HTMLElement,
  allowChalkDrag: boolean,
): boolean;
```

语义：先保持既有 interactive-child 检查；`item` 缺失时返回 false；若 `item.kind === 'chalk' && !allowChalkDrag`，返回 false；已知非 Chalk 才返回 true。非 God Chalk 的 pointerdown 必须**跳过卡片拖拽分支并落入既有 blank viewport pan 分支**：不能调用 `e.preventDefault()`，不能创建 `CardDragSession`、`raiseObject`、`dragging-item` 或拖拽链接高亮。这样拖过 Chalk 时画布仍可平移，静止点击仍由 Chalk 阅读/互动接管。**漏掉任一项会怎样：**若直接 return，画布会在 Chalk 上失去平移；若进入卡片分支，卡片仍会视觉移动或邻居被 push，玩家看到“点 Chalk 后页面被拖走”的假互动。

God Chalk 和非 Chalk 维持现有行为：创建 session，4px 位移门槛后才捕获 pointer（`Canvas.tsx:319-338`），并在 `settleDrag` 中通过既有 `onMoveCard` 持久化（`Canvas.tsx:404-449`）。**漏掉复用现有 session 会怎样：**会出现第二套拖拽坐标、push/relax 或 moveCard 语义，破坏单一坐标写入接缝。

interactive child 优先级高于 God Hand：即使上帝模式打开，choice、dice、use-item、按钮、链接、输入框及任何 `data-no-drag` 子树都不得启动卡片拖拽。**漏掉优先级会怎样：**点击 choice/dice 会被 viewport 捕获为移动，控件无法提交或焦点丢失。

### 4.3 Chalk 阅读与互动

- 非 God 模式点击 Chalk 的空白可读区域仍由 `CanvasObject` 的 click 打开/关闭阅读（`CanvasObject.tsx:236-241`）；小于 6px 的点击判定仍保留。dispatcher 不得在锁分支阻止 click 冒泡。
- 非 God 模式 choice、dice、use-item 仍由 `EntityInteractions` / `CardRenderer` 的现有回调工作；`data-no-drag` 只阻止卡片拖动，不是 `pointer-events:none`。
- Chalk 根节点继续保持 `tabIndex={0}`；根节点 Enter 的阅读语义（`CanvasObject.tsx:241`）不因锁而改变。交互子控件使用原生键盘语义，焦点落在控件时不由 Canvas 启动拖动。
- God 模式只新增 Chalk 拖动能力，不改变阅读/choice/dice/use-item；God Hand 不应成为“只能编辑、不能体验”的模式。

### 4.4 幻影

`.object--ghost` 即使 `isGodHandOpen=true` 也不可点击、不可拖动、不可创建 `CardDragSession`。`pointer-events:none` 继续是防线；不得给幻影伪造真实 path 或调用 `moveCard`。**漏掉这点会怎样：**临时生成投影可能被写成真实坐标，随后 `reconcileLanded` 又被服务器座位覆盖，出现跳位或把不存在的 `phantom:*` 发给 `/api/card/position`。

幻影 seat 仍由 00 规定的同一 `flowColumns` 计算，落地是座位过户而非第二次排版；本篇不新增 WS 帧（`docs/layout/00-共同上下文.md:189-195`）。

## 5. 事件矩阵

| 事件/目标 | `isGodHandOpen=false` | `isGodHandOpen=true` | 必须保留的副作用 | 禁止的副作用 |
|---|---|---|---|---|
| pointerdown Chalk 根空白 | 不创建 `CardDragSession`，跳过卡片分支并允许既有 viewport pan | 按现有流程创建 session | reading click、hover/focus 仍可用 | 非 God 下卡片 DOM 移动、push、persist |
| pointerdown Chalk choice | 不拖；interactive child 继续走原生控件路径 | 不拖 | choice 回调、焦点、反馈 | `dragging-item`、moveCard |
| pointerdown Chalk dice | 不拖；interactive child 继续走原生控件路径 | 不拖 | roll 回调/键盘操作 | 卡片拖拽 |
| pointerdown Chalk use-item / `data-no-drag` | 不拖；interactive child 继续走原生控件路径 | 不拖 | HTML5 item drop 与使用动作 | viewport drag |
| click / Enter Chalk 根 | 阅读照旧 | 阅读照旧 | `reading` 状态切换 | 因锁而 `preventDefault` |
| pointerdown 非 Chalk 卡根 | 现有拖拽 | 现有拖拽 | push/relax 与 moveCard | 变更非 Chalk 语义 |
| pointerdown 幻影 | pointer-events none | pointer-events none | 无 | click、drag、moveCard |
| God Hand toggle button | 关闭→打开/打开→关闭 | 同左 | `aria-pressed`、可见状态、焦点 | 改 attention 或 freeze 意外状态 |
| writer action button / 全局 Enter | 只切 `attention=authoring` | 只切 authoring，不自动关/开 God Hand（建议离开 God chrome 时显式关） | writer focus 与提交 | 以 authoring 推导 drag permission |
| pointerup/cancel 非 God Chalk | 无 session，走空白/子控件现有路径 | 已开启 session 按现有 settle/cancel | 清理 session/class | 新增第二次持久化 |

## 6. 输入、输出与副作用

### 输入

- App 的 `isGodHandOpen: boolean`（仅 UI 状态）。
- Canvas 的 `allowChalkDrag?: boolean`（缺省 false）。
- pointer 事件目标、`itemsByPath` 查到的 `LayerItem.kind`、现有 interactive-child 标记。
- God Hand toggle 的原生 click/keyboard activation。

### 输出

- 允许时：既有 `CardDragSession`，DOM 临时位置、邻居 push/relax，最终调用 `onMoveCard(path, x, y)`。
- 拒绝卡片拖拽时：不创建 `CardDragSession`、不改变卡片坐标、不调用 `onMoveCard`；根空白事件可继续进入 viewport pan，Chalk 自己的 click、focus、子控件处理不被阻断。
- God Hand 开关的可见/可访问状态，以及 `allowChalkDrag` 的 React prop 更新。

### 副作用边界

- 允许拖动后的跨端闭环仍是：Canvas `onMoveCard` → `useWorld.moveCard` 乐观更新 → `airpGateway.moveCard` → `POST /api/card/position` → 服务端 `arrangeCards({ place })` → 既有 `card_position` → `useWorld` 消费；不新增事件帧。
- 前端拒绝拖动不得发请求、不得写文件、不得写 metadata、不得写 WS。
- God Hand 状态是会话内 React state；刷新/重新挂载默认关闭，除非未来另有明确持久化契约。本篇不把它写进世界状态。

## 7. 错误边界与诚实性

1. **缺 prop / 非布尔输入：** Canvas 按 false 处理；实现应在边界归一化而不是默认放开。[推断] 若 TypeScript 保证布尔，运行时仍应保守处理。
2. **item 缺失或 path 未命中：** `canStartCardDrag` 返回 false；不得把未知节点当成 Chalk 或可拖卡片，也不得发送 position 请求。重新取数后由真实 `LayerItem` 决定其行为。
3. **服务端拒绝/网络失败：** 继续由 `useWorld.moveCard` 回滚（`useWorld.ts:219-224`）；锁 UI 不吞异常，也不显示“已保存”假状态。[推断] 若产品需要可见失败提示，应复用既有 notice 通道，不在本篇扩展新事件。
4. **God Hand 关闭中的活动拖拽：** 权限在 pointerdown 时采样；已有 session 不在中途改变坐标算法，pointerup/cancel 走既有收尾，关闭后新的 pointerdown 必须拒绝。这避免半个 session 被切换导致残留 `pushed`/链接高亮；是否要强制取消并恢复原始 DOM 位置属于待拍板项（见第 11 节）。
5. **这不是鉴权：** `/api/card/position` 当前固定 actor `player`（`world.ts:830-845`），任何能调用接口的客户端都可能提交位置。`isGodHandOpen` 只限制本 UI 的拖拽入口，不能作为服务器安全边界或权限证明。
6. **幻影路径：** `phantom:*` 不进入 `onMoveCard`；真实落地后以服务器坐标接管，不因开关状态二次排版。

## 8. 键盘与可访问性验收设计

- God Hand toggle 是原生 button，能用 Tab 聚焦，Enter/Space 触发，`aria-pressed` 与视觉开关一致；焦点环不能被 God chrome 的样式隐藏。
- toggle 有可读名称，状态变化通过同一按钮文本或 `aria-live="polite"` status 告知，不用颜色/光标作为唯一提示。
- Chalk 根继续可 Tab 聚焦；非 God 模式不能标整个根 `aria-disabled=true`，因为这会错误表达 choice/dice/read/use-item 也被禁用。可用可见锁定提示或补充描述表达“移动已锁定”。
- 非 God Chalk 的键盘路径：Enter 阅读、Tab 进入子控件、子控件自己的 Enter/Space 执行动作；不支持键盘移动卡片，本篇不新增快捷键，避免与 App 当前 Enter 写行动冲突（`App.tsx:301-333`）。
- God 模式的键盘路径仍只保证开关与 Chalk 内已有交互可访问；若未来要支持键盘移动，必须另定义步长、焦点、边界和服务端持久化语义，不能把 pointer 拖拽暗示成已实现。
- `aria-disabled` 仅可用于真正禁用的 toggle/控件；不要对 Chalk 根或其父 canvas 设置它，也不要用 `pointer-events:none` 关闭整张 Chalk。对应冻结约束见 `docs/layout/00-共同上下文.md:169-181`。

## 9. 浏览器验收判据与非空性测试

### 9.1 浏览器验收

准备一个含至少一张 Chalk（带 choice 或 dice widget）和一张普通卡的层，并打开浏览器 DevTools network 观察 `/api/card/position`：

1. 默认进入场景，确认 God Hand 开关为 off。拖动 Chalk 根空白超过 4px：Chalk 不移动，邻卡不被 push，network 不出现 `/api/card/position`；点击/Enter 仍能打开阅读，choice/dice/use-item 可完成。
2. 点击 God Hand toggle，确认 `aria-pressed=true`、状态文本可读；拖动 Chalk 超过 4px：复用既有拖拽视觉，pointerup 后出现一次 position 请求，刷新后真实卡保持新座位。
3. God Hand 开启时点击/键盘操作 choice、dice、use-item：动作完成且不会触发 position 请求；说明 interactive child guard 优先于 God 权限。
4. 关闭 God Hand 后再次拖 Chalk：回到第 1 条；仅写行动按钮、全局 Enter 切换 authoring 不得令 Chalk 可拖。
5. 生成中出现 `.object--ghost` 时，在 God Hand 开启和关闭两种状态尝试 pointer/键盘：幻影不可点、不可拖、无 position 请求；落地后真实卡从服务端坐标接管且不跳位。
6. 网络/服务端让 position 请求失败：UI 最终回滚到 `useWorld` 旧 state，不能把“God Hand 开启”当作成功证明。

### 9.2 至少一条修复前失败的非空性用例

**测试名：`non-god chalk drag guard prevents a non-empty movement`（NEW）。**

Fixture：渲染 `Canvas`，`items` 至少包含 `chalk` 与普通 `note`，设置 `allowChalkDrag={false}`；用真实 pointer 序列在 Chalk 根的非交互区域 `pointerdown → pointermove(dx=40,dy=0) → pointerup`，并断言：

- Chalk 的 `left/top` 与 pointerdown 前相同；
- 普通 note 的 `left/top` 与 pointerdown 前相同；
- `onMoveCard` 调用次数为 0；
- 测试前置断言“指针移动非空”（`Math.hypot(40,0) > 4`），避免小抖动让测试假绿。

修复前当前 dispatcher 在 `Canvas.tsx:239-267` 对所有非交互 `.object` 创建 session，因此该 fixture 会产生非空位移/最终可能调用 `onMoveCard`，测试必失败；加 guard 后才通过。若只断言“没有请求”而不检查 DOM 位移，修复前也可能出现视觉拖动但恰好未落库，属于假绿，不能接受。

补充矩阵用例：

- `allowChalkDrag=true` 的 Chalk 根拖动应产生一次真实 `onMoveCard`（证明开关没有被永久锁死）。
- 两种 allow 值下，choice/dice/use-item 子元素都应不创建 session，并各自调用自己的回调（证明锁没有扩大到互动）。
- `.object--ghost` 无论 allow 值都不产生 pointer 事件/position 请求（证明幻影不是 God 例外）。
- `attention='authoring'` 但 `isGodHandOpen=false` 时，Chalk guard 仍失败（证明没有复用 attention）。

## 10. 与 01 / 04 的冲突单列

### 10.1 与 `01-核心几何与服务端落位.md` 的边界/潜在冲突

- `01` 负责 `flowColumns(boxes, occupied, config?)` 与服务端座位；本篇只消费已经返回的 `item.x/y/w/h`，不得在拖拽 handler、React render 或 God Hand toggle 中调用 flow geometry。若 `01` 把 Canvas 拖拽当作自动 flow 的输入，必须按 `docs/layout/00-共同上下文.md:88-96` 分开：玩家拖拽是显式 `arrange({place})`，不因开关或新批次被自动重排。
- God Hand 拖动复用 `moveCard → arrangeCards({place})`，不会把拖动后的坐标重新送进 `flowColumns`；否则玩家明确摆的位置会被新批次吞掉，违反 `00:14-16,88-96`。
- `01` 若更改 `CanvasProps` 或坐标事件名，必须与本篇的 `allowChalkDrag?: boolean` 和既有 `onMoveCard(path,x,y)` 同批对齐；本篇不另造拖拽回调。[推断] 在 `01` 未落稿前，新增 prop 的最终归属仍需评审确认。

### 10.2 与 `04-生成批次与初始化接缝.md` 的边界/潜在冲突

- `04` 定义一次 `seatUnplaced(layerId, files)` 的无 row files 为自动批次；本篇不以 God Hand 开关、`attention`、模型 turn 或 pointer 事件制造 batch id，也不写入正文或四键封闭的 `cards.metadata`（`00:73-86`）。
- 生成中的 phantom 由 `04`/perform 接线负责注册与落地，本篇只要求其始终不可拖；`chalk_landed` 不是用户拖拽，不能通过 `onMoveCard` 或 God Hand 重新排版（`00:189-195`）。
- `04` 的初始化完成后由普通 layer 读取触发服务端批量入座；即使 God Hand 开启，也不得让前端先写一个临时 Chalk 坐标再与 `flowColumns` 竞态。若 `04` 提议新增 WS 帧传权限或布局批次，本篇按 `00:47,68,195,205-206` 拒绝，改用既有 state/帧或回到评审。

## 11. 仍未知待拍板

1. `GodModeToolbar` 是将 Chalk 编辑 toggle 与 freeze 放在同一现有组件，还是抽成同区域的独立控件；无论视觉归属如何，状态必须仍是 `isGodHandOpen`，不能复用 `attention`。
2. God Hand toggle 是否要在开关关闭时强制取消已经开始的 Chalk drag，并恢复所有被 push/relax 的临时 DOM 坐标；当前建议是权限在 pointerdown 采样，允许该 session 正常结束，避免半成品恢复逻辑。若产品要求即时锁定，需先为 `CardDragSession` 冻结可恢复的原始位置集合，再实现取消。
3. 非 God Chalk 锁定提示的最终文案、图标和是否加入 `aria-describedby` 尚未拍板；不能用 `aria-disabled` 或仅颜色表达禁用，因为 Chalk 互动仍可用。
4. 是否未来提供键盘移动卡片未拍板；本批不实现、不定义步长/箭头键/actor 语义。
5. 服务端是否将来区分 `player` 与 God Hand actor 未拍板；当前 `/api/card/position` 仍以 player actor，前端锁不构成鉴权，不能在验收中声称安全隔离。
6. `allowChalkDrag` 是否必需（非 optional）待 `01`/Canvas 公共接口评审；在迁移期间可选字段必须默认 false，最终若所有调用点可同步更新，优先改为必传以减少忘接线风险。

## 12. 实现回写清单

- [ ] App 新增并只由 God Hand toggle 改写 `isGodHandOpen`；writer button、全局 Enter、Esc、world load 不得误写为 true。
- [ ] `CanvasProps` 接受 `allowChalkDrag`，App 调用点显式传值，Canvas pointerdown 在创建 `CardDragSession` 前执行 Chalk guard。
- [ ] interactive-child guard 先于 Chalk guard，非 God 拒绝分支不 preventDefault、不 capture、不改 DOM；choice/dice/use-item/reading 回归。
- [ ] GodModeToolbar 提供可访问的 toggle，状态与 `aria-pressed`/文案同步；关闭 authoring chrome 时状态不会幽灵残留。
- [ ] 幻影保持 `.object--ghost { pointer-events:none }`，不进入 `onMoveCard`。
- [ ] moveCard/server actor 仍沿既有 route；验收只证明 UI 交互锁，不宣称 HTTP 鉴权。
- [ ] 落地实现后回写本篇与 `docs/layout/00-共同上下文.md` 的变更点；任何接口名、取消策略或 actor 决策漂移都必须同批更新文档，不能只在代码里对齐。
