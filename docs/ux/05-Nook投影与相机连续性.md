# A05 — Nook 投影与相机连续性

> 状态：设计稿，**不实现代码**。owner：UX 舞台批次 A05。
> 
> 本文只负责 Nook 与 layer/dialogue 之间的 active projection、相机记忆、互动接缝及验收；不重新定义 Nook API、`flowColumns`、footprint schema 或布局权限。
> 
> 现状行号按 2026-09-13 工作树复核；实现或合并后若行号漂移，必须按符号重定位并回写本文。

## 1. 一句话定位

**Nook 是与 layer 并列、但永远只有一个拥有 Canvas 焦点的舞台投影：进入时保存调用者的空间与相机，退出时按嵌套记忆恢复；它复用 layer 的卡片、动作和真实 footprint 通道，不复制 `useWorld`、WS 或第二套几何。**

## 2. 权威文档与职责边界

### 2.1 必须服从的权威

1. `docs/ux/00-共同上下文.md` §2、§4.2、§4.3、§4.5–§4.7、§7、§8：一个 active projection、Depth、动作语义、Nook/相机记忆、WS 单路径及优先级。
2. `docs/ux/03-Chrome与公开状态.md`（NEW，A03）关于 Nook active 时底层 Canvas inert、全局 Stop/公开 writer state、Escape 与 focus owner；A05 只消费该 Chrome Interface，不复制 close/restore。
3. `docs/nook/00-共同上下文.md` §3.1–§3.8、§4、§5：`/api/nook` 与 `LayerState` 形状、`characters/<id>` 身份、Nook 入口、footprint 与动作边界。
4. `docs/nook/02-前端视图与入口.md` §2、§3.5–§3.8、§6–§12：`NookView` 的调用侧、空态、事件、现有 prop 转发及退出行为。
5. `docs/layout/00-共同上下文.md` §3–§5：`flowColumns`、真实 `w/h`、phantom、Chalk 拖拽锁及布局归属。
6. `docs/layout/02-幻影与演出接线.md` §2–§3：幻影临时座位、真实卡接管和切层竞态。
7. `docs/perform/00-共同上下文.md`：演出帧、phantom、`writer_delta`、`show_frame` 的唯一时序。
8. `docs/doc-06-演出与交互设计.md` §4–§5：小天地存在证据、角色与门的动作语义。

发生冲突时，先按 `docs/ux/00` 的稳定系统原则与跨 Module 契约，再按上述专题冻结文档；现有代码只是证据，不自动成为设计真相。

### 2.2 Module / Interface / Implementation / Depth / Seam / Adapter / Leverage / Locality

| 术语 | A05 定义 |
|---|---|
| Module | `App` 的投影切换与相机事务；`NookView` 的 Nook 取数/空态/本地 footprint；`Canvas` 的空间交互；`useCamera` 的共享相机驱动。 |
| Interface | `LayerState`、`Canvas` 的现有 props、`CameraApi`、`FootprintScheduler` 及 `NookView` 现有回调。字段和请求体不在本文重定义。 |
| Implementation | React 挂载/卸载顺序、DOM 标记、相机槽位编排、调度器接线；落地时才决定具体 React state 组织。 |
| Depth | `background → stage → entity → performance → chrome → dialogue`；Nook 不发明另一套 z-index。 |
| Seam | layer ↔ nook、layer/nook ↔ dialogue、`App` ↔ `NookView`、Canvas ↔ `useCamera`、DOM 测量 ↔ footprint 写回。 |
| Adapter | `/api/layer` 或 `/api/nook` 到同一 `LayerState`；Nook 只替换取数 Adapter，不替换动作语义。 |
| Leverage | 一个 Canvas、一个共享相机、一个 WS 入站点和同一动作回调，可令 layer/Nook 行为保持同构。 |
| Locality | 相机记忆按投影身份隔离；footprint 只提交当前投影自己的 `items`；`document` 全局查询不得成为跨投影数据源。 |

## 3. 现状证据：今天已经有什么、缺什么

| 证据 | 现状 | A05 影响 |
|---|---|---|
| `App` 的 `nookChar` | `apps/web/src/App.tsx:127-129` 已有 `nookChar: string \| null`。 | 状态已有，但 active projection 事务尚未形成单一入口。 |
| 主 Canvas | `App.tsx:546-579` 无条件渲染一个 layer `Canvas`。 | 进入 Nook 不能仅追加另一个 Canvas；必须替换或严格卸载旧 Canvas。 |
| Nook 挂载 | `App.tsx:732-758` 当前把 `<NookView>` 追加在主工作区之后的 `.prototype-nook` 容器中；`:758` 仍有独立 Nook DOM，而 layer Canvas 仍在 `:547`。 | 当前工作树违反「一个 active projection」的目标，且是隐藏 Canvas/全局 `.object` 串扰的直接风险。 |
| `NookView` 取数 | `apps/web/src/components/nook/NookView.tsx:91-121` 请求 `/api/nook?character=...`；`:154-173` 有 `reqSeqRef` 的最后请求胜出。 | 取数 Adapter 正确；投影切换不能绕过 stale response guard。 |
| `NookView` 渲染 | `NookView.tsx:299-440` 以 `data-nook` 根渲染存在核心、错误/空态及 `Canvas`；正常内容 `:423-439` 把 `state.layer` 传给 Canvas。 | 可复用 Canvas，但需由 `App` 保证旧 Canvas 不同时存在。 |
| Nook scheduler | `NookView.tsx:225-256` 创建第二个 `createFootprintScheduler`；其 `widths` 仅来自 Nook `stateRef.items`，但 `measure`/`isDragging` 使用全局 DOM 查询。 | 第二 scheduler 可以存在，但必须配合单一 active DOM 或 scope root，不能靠全局查询猜投影。 |
| Canvas props | `apps/web/src/components/canvas/Canvas.tsx:19-43` 已包含 `currentLayer`、`items`、`links`、动作回调、`stillPortraits` 等。 | Nook 通过同一 Interface 接入；不在 Nook 另造卡片/拖拽 API。 |
| Canvas 相机接线 | `Canvas.tsx:109` 调用 `useCamera()`；`:143-151` 在 `currentLayer` 变化时 save/restore；`:158-182` 按真实 `.object` bounds 取景且不写坐标。 | Nook 的 `currentLayer` 必须是响应的 `characters/<id>`；取景永远只动相机。 |
| Canvas 根 DOM | `Canvas.tsx:517-584` 每个 Canvas 拥有 `camera.viewportRef`、`camera.worldRef`，`.object` 在 `:543-557` 渲染。 | 同时挂两个 Canvas 会竞争同一个 module-scope camera ref/driver 和 DOM 查询。 |
| CanvasObject | `CanvasObject.tsx:137-170` 的 shell 负责 `left/top/w/z/rotation`；`:231-290` 的根是 `.object[data-path]`，阅读、hover、键盘 Enter 和实体子动作均在这里接线。 | active projection 必须保留完整 `.object` 交互，不能以 `pointer-events:none` 隐藏整张卡。 |
| 相机存储 | `apps/web/src/state/useCamera.ts:35-44` 为 module-scope `DEFAULT_VIEW`、扁平 `CAM_MEMORY`、共享 target/current；`:53-74` 暴露 `save/restore/getCam/getTarget`；`:143-174` 负责按 key 存取。 | `useCamera` 是共享驱动，不是每个投影一个实例；平铺 key 需要由 App 编排成嵌套 stack。 |
| Layer scheduler | `apps/web/src/state/useWorld.ts:278-310` 创建 layer scheduler，`:282-304` 读取 layer ref/items；`:315-346` 给全局 `.object[data-path]` 安装 ResizeObserver。 | layer scheduler 仍属于 `useWorld`；A05 不复制 `useWorld`，但必须解决它在 Nook DOM 出现时的待刷包风险。 |
| 全局测量 | `apps/web/src/lib/footprint.ts:82-93` 的 `measureHeights(root = document)` 默认扫全局 `.object[data-path]`；`:109-112` 默认 hover 也扫全局；`:153-211` 负责 gate/debounce/POST/fingerprint。 | 同时存在隐藏 layer 与 Nook 时，测量是非局部的；必须单投影或使用 root-scoped Adapter。 |
| 全局路径查询 | `apps/web/src/components/canvas/LinkLayer.tsx:128` 使用 `document.querySelector('.object[data-path=...]')`；`Canvas.tsx:164-170/374-375/423-425` 则按其 viewport 查询。 | active projection 是正确性前提；不能让旧 Canvas 留着，因为 LinkLayer 可能命中错误副本。 |
| WS 单入口 | `useWorld.ts:349-387` 统一接收 WS；writer lane 可投影为 `airp:agent-frame`，character lane 必须投影为 `airp:character-frame`，App 是唯一公开 Agent ingress。 | Nook 不调用 `useWorld()` 或创建第二 WebSocket；Nook 只消费已归属事件。 |

## 4. Active projection 契约

### 4.1 三类 projection 的语义

A05 使用三个**逻辑**投影身份，不重新定义 `LayerState.layer`：

| 逻辑身份 | 内容 owner | Canvas 焦点 | 当前世界身份 | 退出目标 |
|---|---|---:|---|---|
| `layer:<layerId>` | `App` + `useWorld` 的 layer payload | 是 | `state.layer`（如 `map`、`world/foo`） | 上一层或 Nook |
| `nook:<characterId>` | `App` + `NookView` 的 Nook payload | 是 | 响应体 `state.layer = characters/<id>`，不得自行重拼 | 调用 Nook 的 layer/dialogue |
| `dialogue:<characterId>` | `CharacterModal`（dialogue Depth） | 否，转为 modal focus | 底层仍是当前 layer 或 Nook，不改 `currentLayer` | 进入时的 layer 或 Nook |

`dialogue` 是焦点投影而不是第二张 Canvas：底层 stage 可以保留一个 Canvas，但必须标为 inert/不可交互，并由 `CharacterModal` 获得键盘焦点。这样既保留背景连续性，又不会产生第二份 `.object`。

### 4.2 「一个 active projection」可观察不变量（NEW）

落地实现必须给投影宿主加可测试的 DOM 语义标记（建议 `data-airp-projection`、`data-airp-projection-active="true"`，均标记 **NEW**；属性名由实现评审最终冻结，不得出现同义第二套标记）。验收只依赖以下不变量：

1. 任意时刻 `document.querySelectorAll('[data-airp-projection-active="true"]')` **恰好一个**。
2. 当 active 为 `layer:*` 或 `nook:*` 时，恰好一个 Canvas viewport/`camera.viewportRef` 存在，且其 `.object[data-path]` 路径集合等于该投影 `items` 集合（不含 `.object--ghost`/phantom）。
3. 当 active 为 `dialogue:*` 时，恰好一个底层 Canvas 仍在 stage；它不得接收指针/键盘动作，dialogue 宿主才是 active focus；`.object[data-path]` 仍只有一份。
4. active 切换前后的交界 commit 不允许出现两个 Canvas viewport；不得用 `visibility:hidden`、`opacity:0` 或 CSS `hidden` 伪装卸载。
5. `document.querySelectorAll('.object[data-path]')` 的结果只能来自当前 Canvas。若未来必须保留非 active DOM，必须把 `measureHeights(root)`、hover gate、LinkLayer 查询全改成 owner-root scope；在 scope 完成前不得保留第二 Canvas。

**测试含义：**“一个 active projection”不是只断言一个 React state，也不是只断言 Nook 标题出现；必须同时断言 active marker 数量、Canvas 数量、`.object` path 集合和焦点/inert 状态。这样能抓住当前 `App.tsx:547` + `:758` 双挂载的真实失败。

### 4.3 切换事务顺序

#### 进入 Nook

1. 从角色 tab 或 dialogue 的 Nook 控件收到角色 id；先校验当前是否已有未完成的 projection transition。
   - **漏接后果：**快速连点会并发 fetch/restore，慢响应可能把旧角色投影画到新标题下。
2. 记录当前 caller（`layer:<id>` 或 `nook:<id>`）及其当前 camera target；相机槽位由 stack 统一命名，不能使用无上下文的 `'dialogue'`/`'layer'` 常量。
   - **漏接后果：**layer、Nook、dialogue 互相覆盖同一 `CAM_MEMORY` 键，退出后回不到进入前的位置。
3. 在同一个 UI transition 中撤销/停用 caller 的 Canvas focus，并卸载 caller Canvas；**不**让旧 Canvas 以隐藏方式继续留在 document。
   - **漏接后果：**两个 `camera.worldRef`、全局 `.object`、LinkLayer 和 footprint scheduler 互相命中。
4. 切换 active marker 为 `nook:<id>`，然后挂载 `NookView`；由 `/api/nook` 响应给出 `state.layer`。
   - **漏接后果：**Nook 可能显示了内容却仍以 layer 的 active 标识/相机 key/footprint layer 提交。
5. 响应成功后以 `state.layer` 作为 Nook Canvas 的 `currentLayer`，只调用 `camera.restore(nook-slot)`；没有记忆时使用 `DEFAULT_VIEW`，不要在 Canvas framing 中写卡坐标。
   - **漏接后果：**Nook 与 caller 共用一个视角，或首次进入时 framing 反向修改真实落位。
6. 等 Canvas 字体稳定、真实 bounds framing 完成后再允许交互；空态仍是有效 active projection，不得退回 layer Canvas。
   - **漏接后果：**首帧坐标/高度不稳定，玩家拖拽和 footprint 写回采用过时的尺寸。

#### 离开 Nook

1. 返回按钮或 Esc 只进入 App 统一的 close transaction；NookView 不自挂第二个 keydown listener。
   - **漏接后果：**一个 Esc 同时触发 Nook close 与 `handleReturnToParent`，玩家回到错误 layer。
2. 先保存当前 `nook:<id>` 的 camera target，再恢复调用者 `layer:<id>` 槽位；恢复 key 来自 stack 顶部，不能从当前 `useWorld.layer` 猜。
   - **漏接后果：**Nook 最后一次平移丢失，或 `currentLayer` 尚未变化时 restore 到错误槽位。
3. 卸载 Nook Canvas，切回 caller active marker；layer caller 重新挂载后只接受自己的 `LayerState` 与相机记忆。
   - **漏接后果：**退出瞬间两份 `.object` 被全局测量，或 Nook 卡在 layer 里短暂可拖。
4. 退出后调用既有 `useWorld.refresh()` 作为 layer 事实兜底，不为 Nook 新造事件/WS；若 caller 是 dialogue，则先关闭 dialogue，再恢复其底层投影。
   - **漏接后果：**退出时看见旧文件；或者把 Nook 关闭误当世界事件落账。

#### 进入/离开 Dialogue

1. 从 layer 或 Nook 的角色实体进入 dialogue 时保存**当前底层 projection**（不是固定 `'dialogue'`），将 camera slot 与 `dialogue:<characterId>` 绑定。
   - **漏接后果：**从 Nook 对话返回时恢复到 layer，或者多角色连续对话互相覆盖。
2. 保持底层只有一个 Canvas；将底层 projection 标为非交互/`inert`，挂载一个 `CharacterModal` dialogue focus；不改变 `currentLayer`、Nook `state.layer` 或 footprint `layer`。
   - **漏接后果：**对话期间仍可拖卡/点击门，动作落到遮罩背后的场景。
3. `useWorld` 的角色 lane 只派发 `airp:character-frame`；`airp:agent-frame` 仅保留 writer lane。App 的 identity router 丢弃缺失/不匹配的 `characterId` 后，将帧送入 `CharacterFrameQueue`（UX06 §4.2）；Nook 不监听原始 WS。
   - **漏接后果：**同一 `character_delta` 被多个 modal 消费，或角色台词串到错误角色。
4. `closeCharacter` 只结束当前 dialogue、发送既有 `character_stop`（若已有 active character）、清理 frame 并恢复底层 projection；它不负责 `setNookChar`，也不负责 layer ↔ Nook 转换。
   - **漏接后果：**关闭角色遮罩意外退出 Nook，或调用 `camera.restore('dialogue')` 把底层视角覆盖掉。

## 5. Camera memory stack

### 5.1 设计形状

`useCamera` 继续是共享驱动与 flat `CAM_MEMORY` Interface；A05 只在 `App` 侧增加一个编排语义 **`CameraMemoryStack`（NEW）**，不把第二个 singleton 塞进 NookView。

`type Projection = 'layer' | 'nook' | 'dialogue'`（NEW，内部相机/active projection 枚举；不作为 HTTP/WS 字段）。
每个 stack frame（**`CameraMemoryFrame`，NEW；内部设计形状，不是 API 响应字段）都是**进入前 active projection 的 caller snapshot**，不是目标 projection 的占位：

- `caller`: `layer` / `nook` / `dialogue` + identity；
- `target`: 即将进入的 projection + identity；
- `slot`: caller snapshot 的诊断名：`layer:<layerId>`、`nook:<characterId>`、`dialogue:<characterId>:<callerSlot>`；
- `targetSnapshot`: 进入目标时要恢复的 commanded target；不存在则走默认镜头；
- `savedAt`: 仅用于诊断，不参与世界事实。

**唯一操作形状：**
```ts
// NEW App-owned transition seam.
pushTransition(target: { projection: Projection; identity: string; slot: string }): void;
popTransition(expectedCaller: { projection: Projection; identity: string }): CameraMemoryFrame;
restoreProjection(frame: CameraMemoryFrame): void;
restoreTarget(target: { projection: Projection; identity: string; slot: string }): void;
```

每次进入先 `pushTransition(current → target)`，再切 active projection；每次退出只 `popTransition(expectedCaller)` 并 `restoreProjection(frame)`。stack top 永远是“当前 active projection 的 caller snapshot”，不会把 dialogue frame 与 caller frame 混为一谈。

| 操作 | stack 变化 | 目标恢复 | 禁止事项 |
|---|---|---|---|
| 初次进入 layer | 空 → 无 caller frame | `layer:<id>` 无记忆则 default | 不从 DOM bounds 推算并写卡位 |
| layer → Nook | push caller `layer:<id>` | `nook:<characterId>` snapshot 或 default | 不复用 caller slot，不改 `useWorld.layer` |
| Nook → dialogue | push caller `nook:<characterId>` | `dialogue:<characterId>:nook:<characterId>` snapshot 或 default | 不把 Nook 变成第二 `useWorld` |
| dialogue → Nook | pop expected caller `nook:<characterId>` | restore popped Nook snapshot | 不恢复固定 `dialogue` 槽 |
| Nook → layer | pop expected caller `layer:<id>` | restore popped layer snapshot | 不用 Nook 响应覆盖 caller layer state |
| layer → dialogue | push caller `layer:<id>` | `dialogue:<characterId>:layer:<id>` snapshot 或 default | 不让 dialogue 改 layer 游标 |
| 世界切换 | 清空旧 world 的 stack | 新 world 初始 layer default | 不跨 world 复用同名 slot |

`camera.save` 的值是 commanded target（`useCamera.ts:167-169`），验收必须同时允许 rAF 中的 `sharedCurrent` 过渡；连续性比较应以 `getTarget()` 为主、以 `getCam()` 在 settle 后复核，不能在动画中要求瞬时相等。

### 5.3 当前覆盖风险

- `App.tsx:486-496` 的 `openCharacter` 当前固定 `camera.save('dialogue')`。
- `App.tsx:513-517` 的 `closeCharacter` 当前固定 `camera.restore('dialogue')`。
- `App.tsx:753-758` 的 `onOpenNook`/Nook close 回调直接各自 `camera.save(layer)`、`camera.restore(layer)`，没有 caller stack。
- `App.tsx:317-353` 的 Esc handler 直接 `setNookChar(null); camera.restore(layer); void refresh()`，与 CharacterModal/按钮路径重复状态事务。

这些路径必须收敛到一个 App-owned transition Adapter（**`openNook`、`closeNook`、`enterDialogue`、`closeDialogue`，均为 NEW 语义名；实现可沿用既有 handler 名但不能保留多份逻辑**）。NookView 只发 `onClose`，CharacterModal 只发 `onClose`/既有 `onOpenNook` 意图，不直接操作 camera。

## 6. Layer / Nook 互动 parity 矩阵

“Parity”指同一动作在两种 projection 上具有相同的动作语义、事实优先顺序、失败可见性、回滚规则和相机/footprint 接缝；不意味着 Nook 获得 layer 专属的门或新建 UI。

| 动作语义 | layer | Nook | 统一断言与漏接后果 | 责任 |
|---|---|---|---|---|
| `inspect`：点击/键盘 Enter 查看 note、letter、chalk 正文 | `CanvasObject` 根的阅读状态（`CanvasObject.tsx:231-241`） | 必须相同；`state.items` 直接喂同一 CanvasObject | 点击不应移动卡或写事件；漏接会让 Nook 只能“看见”不能阅读。 | `Canvas`/`CanvasObject`，A05 验收 |
| `act.choice` | `onSelectChoice` → 既有选择请求 | `NookView.tsx:434-437` 转发同一回调 | 先等权威结果再演出；失败须 DOM 可见文案。漏接会造成 Nook 卡可读但不可行动。 | `App`/动作层；Nook 只 Adapter |
| `act.roll_dice` | `onDiceRolled`，由同一结果/演出通道消费 | `NookView.tsx:435-438` 转发 | 不能因 Nook 另造骰子帧；漏接会出现 Nook 与 layer 不同的成功节拍。 | perform/UX；A05 验收 |
| `act.take_item` | `onTakeItem` → 既有 `/api/move`，失败回滚/通知 | `NookView.tsx:437` 转发；路径保持 Nook path | README 门面仍不可拿取；失败不能只 console。漏接会丢物或误移 README。 | nook 02 + action |
| `act.move`：普通实体拖拽 | Canvas viewport 的 `CardDragSession`（`Canvas.tsx:247-280`）→ `moveCard` | 必须同一路径；`POST /api/card/position` 仍由动作层 nook 分支接住 | 事实结果先于成功演出；失败回滚。漏接会“拖了又弹回”，且不能新造坐标端点。 | layout 负责几何/权限；nook 01 负责 arrange 分支 |
| `act.move`：Chalk | 非 God 不创建 session；God 才可拖（layout 00 §5，`Canvas.tsx:258-279`） | 与 layer 完全相同，不因 Nook 解锁；phantom 永远不可拖 | 不能以 `attention` 代替 God 权限，不能给 `.object--ghost` 例外。 | layout |
| `present`：背包物品 → 可接收目标 | layer 的 `onItemDropOnTarget`/`use-item` 语义 | **必须可用**：Nook 透传 Canvas 已有 `onItemDropOnTarget`，请求仍走既有 `use-item` 语义 | 成功/失败顺序、回滚、玩家可见文案与 layer 相同；漏接会使 Nook 的物品只可观看、不能交互。不得新造 Nook 路由或 body。 | App/NookView 接线；动作层 |
| `enter`：门卡单击/双击语义 | gate 目标由 `CardRenderer.tsx:122-181` 交给 `onEnterGate`；layer 遵守 doc-06 双击进入 | **不适用且必须不产生 gate**：Nook 不把 `characters/<id>` 当 layer；若脏数据出现 gate，显示明确不可进入反馈，不发 `enter-layer` | 门的 enter 规则仍由 layer 保持；Nook 的“不适用”是数据/语义边界，不是静默成功。漏接会把角色目录误当场景树。 | nook 00/UX 04 |
| `act.character`：角色头像/实体进入 dialogue | layer sprite → `onOpenCharacterModal` → `CharacterModal` | **必须相同**：Nook 中的角色实体也由 `onOpenCharacterModal` 进入同一 `CharacterModal`；caller frame 为 `nook:<id>` | dialogue 进入/退出、Agent frame 归属、相机恢复与 layer 相同；漏接会让 Nook 里的角色成为不可对话的装饰。 | App/NookView；A03/A06 |
| `act.create/delete/arrange layout` | God 工具/Agent 动作 | Nook UI 本批不提供新建/删除；Agent `arrangeCards` 的 nook place/layout 分支由 nook 01 接通 | 不新增 Nook UI 和请求体；漏接服务端分支会让 Agent 整理 Nook 404。 | nook 01；layout 不改 API |
| `cancel`：阅读/演出/对话退出 | 既有 Card/CharacterModal close 语义 | Nook close 只退出 Nook；dialogue cancel 返回 Nook，且复用同一 close transaction | 退出必须恢复正确 stack frame；漏接会从 Nook Esc 穿透到父 layer。 | App/A05 |

**Parity 结论（已冻结）：** Nook 必须与 layer 共享 `inspect`、所有适用的 `act`（choice、dice、take、实体动作）、`present`、`cancel` 及 dialogue 进入/退出；`enter` 的 gate 仅对 layer 适用，Nook 必须拒绝/不可生成 gate，不是缺失实现。普通拖拽与 God Chalk 权限也完全一致。任何尚未在 `NookView.tsx:424-439` 透传的既有可选回调，都是必须补齐的接线，不得继续登记为“可选功能”或静默 no-op。

## 7. Hidden Canvas、全局 `.object` 与 footprint scheduler

### 7.1 主规则：不保留隐藏 Canvas

Nook 进入时必须卸载 layer Canvas，返回时卸载 Nook Canvas；禁止 `display:none`/`visibility:hidden`/`opacity:0` 留下第二份 Canvas。

理由有四层：

1. `measureHeights` 默认扫 `document.querySelectorAll('.object[data-path]')`（`footprint.ts:82-93`），隐藏层可能变成 0 高、旧高或仍被查询。
2. `useWorld` 和 Nook scheduler 都以全局 `.object` 判定 dragging/hover（`useWorld.ts:302-304`、`NookView.tsx:247-250`、`footprint.ts:109-112`）。
3. `LinkLayer` 用 `document.querySelector`（`LinkLayer.tsx:128`），重复 path 时命中顺序不再表达 active projection。
4. 两个 `Canvas` 都调用 `useCamera`，module-scope `worldRef` 的最后 effect owner 不等于玩家看到的 owner（`useCamera.ts:119-156`）。

### 7.2 scheduler 接缝

- layer scheduler 的 owner 仍是 `useWorld`（`useWorld.ts:278-310`）；A05 不让 NookView 再调用 `useWorld()`。
- Nook scheduler 可复用 `createFootprintScheduler`（`NookView.tsx:225-256`），但其 `widths` 只能来自 Nook `state.items`，POST 的 `layer` 必须是响应 `state.layer`，不能从 `characterId` 自造另一个形状。
- 两个 scheduler 即使同时存活，也只允许**一个 active Canvas DOM**。layer scheduler 在 Nook active 时不得把 Nook 的测量结果提交为 layer：最小安全条件是 layer paths 与 Nook paths 不相交；更稳妥的 Implementation 是在 projection transition 期间取消待 flush，并让 scheduler 的 `measure`/`isHovering` 使用 owner root。
- `measureHeights(root)` 已有 root 参数（`footprint.ts:82`），因此推荐建立 `FootprintProjectionAdapter`（NEW）把 active projection root 注入 `measure`，并让 `isHovering` 查询同一 root；不得新增第三个 footprint schema 或第二套 POST body。
- Nook 首次测量必须经过 `whenFontsSettled` 与每卡 `ResizeObserver`（`NookView.tsx:258-287`）；`document.hidden` 由 scheduler gate 阻断，不能在 hidden 时永久 dispose。
- `cards.width/height` 仍归 `docs/footprint/00` 与 Nook 04；A05 只保证“谁测量、何时测量、只提交 active projection 的 boxes”。
- `chalk_landed`/`image_landed` 仍只是座位过户，不得因 Nook scheduler POST 而播放成功反馈；`tool_end` 失败仍由既有 phantom eviction 和玩家可见错误处理。

### 7.3 调度遗漏的可见后果

| 遗漏 | 玩家/系统后果 |
|---|---|
| 进入 Nook 仍保留 layer Canvas | global `.object` 可能把 layer 的 hover/height/path 与 Nook 混在一起；“一个 active projection”直接失败。 |
| Nook 沿用 layer scheduler 的 `widths` | Nook `.object` path 不在 layer map，flush 为空；长 Chalk/portrait 的真实高度永不回写。 |
| 未等 fonts | 首次换行高度偏小，错误 `cards.height` 进入下次排座。 |
| 未观察 payload 新卡 | writer/初始化后重新取数，新增卡只得到声明尺寸。 |
| scheduler 不 reset/取消旧 layer packet | 退出/进入快速切换时，旧投影的 debounce 包可能在新 DOM 上执行；即使当前 path 不相交，也会隐藏错误。 |
| 用 `opacity:0` 替代卸载 | 用户看不见的卡仍可被 `querySelectorAll`、LinkLayer 或相机 frame 命中。 |

## 8. App/NookView/Canvas 的责任落点

### 8.1 `App`（唯一投影事务 owner）

精确落点：

- 状态：`apps/web/src/App.tsx:127-129` 的 `nookChar` 附近；增加/收敛 active projection 与 stack 的 **NEW** 内部语义。
- layer Canvas：`App.tsx:546-579`；不能和 Nook Canvas 并存。
- `openCharacter`：`App.tsx:486-496`；改为保存当前 caller frame，不写固定 `'dialogue'`。
- `closeCharacter`：`App.tsx:513-517`；只关闭 dialogue 并恢复 caller。
- Esc：`App.tsx:317-353`；Nook 分支只调用统一 `closeNook`，不能重复 save/restore/refresh。
- CharacterModal 接线：`App.tsx:732-755`；`onOpenNook` 只传递意图给 App transaction。
- Nook 接线：`App.tsx:758`；改为 active projection 互斥分支，并传既有 layer callbacks；不得把 Nook 逻辑塞进 `useWorld`。

### 8.2 `NookView`（Nook Adapter 与本地测量 owner）

精确落点：

- `NookViewProps`：`apps/web/src/components/nook/NookView.tsx:29-47`；不得新增第二 WebSocket/第二 `useWorld`。现有 `locale`、`onRequestInit` 已在工作树出现，和 `docs/nook/02 §2.2` 的旧形状有差异，见 §11。
- 请求与 stale guard：`NookView.tsx:91-121/154-173`；只消费 `/api/nook` 响应的 `state.layer`。
- `airp:world-event`：`NookView.tsx:213-223`；整 Nook 重取，不新增事件名。
- scheduler：`NookView.tsx:225-256`；保留 Nook widths map，按 active root 改善测量 scope。
- ResizeObserver/font gate：`NookView.tsx:258-287`；只触发 scheduler notify，不写坐标。
- Canvas props：`NookView.tsx:423-439`；与 layer 相同的动作接线不得被 Nook 内部重写。

### 8.3 `Canvas` / `CanvasObject`（共享空间 Interface）

- Canvas 相机与 framing：`Canvas.tsx:109-182`；framing 只能 `camera.flyTo`，不得调用 `onMoveCard`、`separateBounds` 或写 `left/top`。
- Canvas pointer dispatcher：`Canvas.tsx:247-303`；layer/Nook 使用同一 Chalk God guard、交互子元素 early return 和拖拽 state。
- Canvas DOM：`Canvas.tsx:517-584`；active marker/owner root（若实现需要）必须在这里与 `camera.viewportRef` 同一宿主，phantom 继续 `pointer-events:none`。
- CanvasObject shell 与操作：`CanvasObject.tsx:137-170/231-290`；`.object[data-path]` 是可测量和 LinkLayer 的实体边界，不能用全局 shell 覆盖 `surface:none` Chalk。

### 8.4 `useCamera` / footprint（现有低层 Interface）

- `useCamera.ts:35-44/53-74/143-174` 只负责共享 target/current、slot save/restore、viewport/world refs；stack 的 caller/return 语义由 App NEW Adapter 负责。
- `footprint.ts:82-93/102-211` 只负责注入式测量、debounce、visibility/busy/dragging/hover gates、fingerprint 和 POST；不负责判断 layer/nook/dialogue。
- `useWorld.ts:278-346` 仍是 layer scheduler 唯一 owner；A05 不复制它的 WS 或 writer busy 计数。

## 9. 错误边界与回退

| 边界 | 必须行为 | 漏接后果 |
|---|---|---|
| `/api/nook` 400 非法 id | 错误态可见，不自动重试；不改变 caller projection/camera。 | 错误角色 id 反复请求，旧 Nook 标题与内容串联。 |
| `/api/nook` 404 不存在 | 错误态可见；保留旧 `state` 以避免闪白，但 active identity 仍是请求中的 Nook。 | 用户以为已进入另一个角色的房间。 |
| 网络/5xx | Nook `nookRetry` 可见；caller 相机不丢；重试仍由 `reqSeqRef` 守卫。 | 临时断网变成空房间或 silent console warning。 |
| 切换时慢响应 | 只接受最后 request seq；旧 response 不得写 state、footprint layer 或相机。 | A 的卡出现在 B 的 Nook。 |
| Nook 拖卡 404/动作失败 | `moveCard` 乐观位置回滚，显示玩家可见反馈；不播放成功音效。 | 卡留在假位置，玩家误以为落定。 |
| footprint POST 失败 | `FootprintScheduler.last.ok=false`，保留本地显示并给开发诊断/玩家可理解的状态入口；不把失败当成功。 | 下一次布局仍用错误占位而无人发现。 |
| dialogue 帧缺失/characterId 不匹配 | App 的单一 frame router 丢弃并记录可见错误；不喂当前 modal。 | 旧角色台词演到新角色遮罩。 |
| gate 出现在 Nook | 不调用 `enterLayer` 把 `characters/<id>` 当场景；呈现明确不可进入反馈或在数据校验处拒绝。 | 进入请求必失败且看似 Nook 本身坏掉。 |
| phantom 在 Nook | 只显示当前 layer 匹配的临时演出，`.object--ghost` 永远不可拖；真实卡到达后 evict/过户。 | phantom 越过投影边界或成为第二坐标事实。 |
| Esc/返回重复触发 | transition token（NEW，内部诊断）使同一 close 事务幂等；只恢复一次。 | 相机 restore 两次、refresh 乱序、层树再退一层。 |

## 10. 测试与浏览器截图矩阵

### 10.1 单元/集成测试：怎样证明「一个 active projection」

新增测试工件建议落点（均 **NEW**；不在本文实现）：

- `apps/web/test/active-projection.test.mjs`：挂载 App 的 layer → Nook → layer 与 dialogue 流程。
- `apps/web/test/camera-memory-stack.test.mjs`：用 `CameraApi.getTarget/getCam` 验证嵌套保存/恢复。
- 现有 `apps/server/test/nook-routes.test.mjs`、`packages/shared/test/nook.test.mjs` 继续承担 `GET /api/nook`、footprint 门禁、arrange place/layout、坐席非空性；不要在 A05 重写 Nook API shape。

**必须有的主动失败测试（没有修复时会红）：**

1. **双挂载红测：**在当前 `App.tsx:547` layer Canvas 与 `:758` Nook append 的形态下，点击 Nook 入口后断言 active marker 不是恰好一个、或 `.object[data-path]` 同时包含 layer 与 Nook 两组路径；修复后必须为一组。仅断言“Nook 文案出现”不能通过这条。
2. **隐藏 DOM 红测：**让 layer Canvas 使用 `hidden/opacity:0` 保留，再 mount Nook；调用 `measureHeights()`/LinkLayer 查询，断言结果包含旧 layer path 即失败。实现后的测试要求旧根不存在，或 root-scoped measure 只返回 active Nook path。
3. **相机覆盖红测：**先在 layer A 平移到非 default target，再进入 Nook、在 Nook 平移、进入 dialogue、关闭 dialogue、退出 Nook；断言最终 layer A `getTarget()` 等于进入前 target，Nook slot 等于 Nook 离开前 target。固定 `'dialogue'` 单槽实现会在多角色/嵌套情形失败。
4. **响应竞态红测：**先发角色 A，再发角色 B；让 A 延迟响应且最后到；断言 active marker、标题、Canvas items 和 footprint layer 仍是 B。
5. **scheduler 非空红测：**Nook 中有一个真实高于声明值的 `.object[data-path]`，字体 settle 后触发 ResizeObserver；断言 POST `layer === state.layer` 且 boxes 只含 `characters/<id>/...`。widths 若仍读 layer，则 boxes 为空，测试必红。
6. **dialogue focus 红测：**对话期间断言恰好一份 Canvas、底层 root `inert`（或等价不可交互标记）且焦点在 dialogue；尝试 pointer/Enter 不得触发 move/read。关闭后焦点回到底层 active projection。

**回归断言：**

- `CanvasObject` 的 inspect、Enter、choice、dice、take、present 与 dialogue 入口/退出在 layer/Nook 两种 items fixture 上结果相同；Nook 的 gate 不适用且不能发 enter-layer。
- 非 God Chalk 不进入 `CardDragSession`；God 才能拖；phantom 永远不可拖。
- `GET /api/nook` 不落事件；不新增 WS 帧名，`pnpm check:ws` findings 相对实现基线不新增。
- `cards.width/height` 只由现有 footprint 合同回写；A05 不更改 `flowColumns`、`cards.metadata` 或 `POST /api/card/footprint` body。
- `document.hidden`、Effects off、Reduced motion 时不增加非必要循环；portrait ≤1 的断言沿 Nook 03/UX 07。

### 10.2 浏览器回放：写便签 → world_event/重取 → 角色批注 → 再次进入

这是 `docs/doc-06-演出与交互设计.md §4.2–§4.3` 的关键端到端证明，不得用 mock state、只改 React state 或只截一张“有便签”的图代替。`NookNoteComposer`（NEW）通过 `POST /api/nook-note`（形状见 `docs/ux/00 §4.5.1`）提交，服务端以 player actor 调用共享 `writeChalk` action（`packages/shared/src/actions/chalk.ts:388-500`），而不是让前端直接写文件、复用 god-only 路由或创建第二个 Nook 数据库。角色批注仍通过既有角色 Agent 文件写入与事件广播路径完成。

**固定回放步骤：**

1. 用 `docs/nook/05-验收与回归.md §2.2` 的真实非空 Nook fixture（不得使用被探针污染的 `watson`），从 layer 进入 `nook:<characterId>`；记录进入前 layer camera target、active marker 和 Nook `state.layer`。
   - **漏接后果：**回放从错误入口开始，无法证明“重进仍存在”，也无法归因是 Nook projection 还是 layer cache。
2. 在 Nook 中用 `NookNoteComposer`（NEW）提交一条 `NookNoteInput`，例如 `A note left in the room — A05 replay <id>`；内部必须走 `POST /api/nook-note`，提交按钮在 writer busy、world frozen 或连接不可用时遵守既有 disabled 语义。
   - **漏接后果：**输入看似成功但没有可追踪文件事实，后续 `world_event`/重取无法证明真实写入。
3. 服务端成功写入 Nook 根目录的便签文件后，先出现权威事件/帧（`world_event`，其事件类型由实际动作决定），再经既有 `airp:world-event` 转发路径触发 Nook 整体重取；浏览器 Network 必须看到重取 `/api/nook?character=<id>`，而不是组件本地 append。
   - **漏接后果：**只在当前 DOM 添加便签会在退出/刷新后消失；不经过 `world_event`/重取也无法证明事件源是文件系统。
4. 重取成功后，Nook 的 active marker、camera slot、`.object[data-path]` 唯一性保持不变；新便签以真实 `state.items` 出现并进入当前 Nook footprint scheduler，测量完成后按现有 `/api/card/footprint` 写回。
   - **漏接后果：**重取会把 Nook 换成 layer，或把新便签显示出来却不进 footprint，下一次排版仍用声明尺寸。
5. 进入同一角色 dialogue；角色 Agent 读取当前 Nook 文件清单并通过既有 `writeChalk`/edit 写入对该便签的批注。批注产生新的文件事实和 `world_event`/`file_changed`，Nook 在对话期间可以暂时被 dialogue Depth 压暗，但不得卸载或复制第二个 Nook Canvas。
   - **漏接后果：**角色批注只存在对话泡泡里，退出 dialogue 后没有世界痕迹；或者因关闭 dialogue 重新创建 projection 而丢失相机连续性。
6. 关闭 dialogue 回到同一 `nook:<characterId>`，确认便签与角色批注均来自重取后的 `state.items`；不以 `CharacterModal` 私有 state 作为内容来源。
   - **漏接后果：**对话看起来完成，但 Nook 画布仍是旧快照；玩家无法理解角色确实回应过。
7. 退出 Nook 回到进入前 layer，再次通过角色 tab 第 4 按钮进入同一 Nook；第二次 GET 返回的 `items` 必须仍包含原便签及批注，且 active marker 恰好一个、Canvas 恰好一个、Nook camera slot 恢复到上次离开的位置。
   - **漏接后果：**内容只在一次会话内存在，说明写入没有落到文件真相源或 Nook 重取/身份匹配错误。

**回放通过条件：**

- Network/事件记录顺序为“玩家提交 → 权威写入结果 → `world_event`/`file_changed` → `/api/nook` 重取 → 新 `.object` 渲染”，不能把 `chalk_landed`/`image_landed` 当写入成功证明。
- 角色批注至少能在第二次进入 Nook 的真实 `items` 中通过 `path` 与正文断言；文本内容不由测试直接注入 React state。
- 回放期间 projection 不超过一个 active Canvas；dialogue 只改变 focus/Depth，不改变 Nook 的 `state.layer` 或 camera caller frame。
- 失败（写入、事件、重取、批注任一失败）必须在玩家可见的错误边界中结束，不能截取成功截图后再补日志。

### 10.3 浏览器截图验收

截图必须由构建后的 `apps/web/dist` 伺服路径完成；Vite dev 的 HMR 只能作为调试证据。桌面基线 `1440×960`，窄桌面至少 `900×960`，移动 `390×844`，每张记录 world、character、active projection、相机 target、是否 reduced-motion。

| ID | 视口/步骤 | 截图必须证明 | 同时做的 DOM/行为断言 |
|---|---|---|---|
| S-A05-01 | 桌面 1440×960，进入 layer map | layer 纸面、Chrome、真实 cards 正常，首列在视口内。 | active marker = `layer:map`；Canvas=1；`.object` path 只属 map。 |
| S-A05-02 | 桌面 1440×960，角色 tab 第 4 按钮进入有陈设 Nook | 角色存在核心、Nook 陈设、返回按钮同一舞台；无旧 layer 卡透出。 | active marker = `nook:<id>`；Canvas=1；GET `/api/nook` 200；无 layer DOM。 |
| S-A05-03 | 桌面窄屏 900×960，Nook → 返回 layer | 返回后原 layer 构图/缩放/平移连续，不能回 default。 | `getTarget()` 等于进入 Nook 前 snapshot；refresh 不改变 active identity。 |
| S-A05-04 | 移动 390×844，进入 Nook | 核心条、返回按钮、Canvas 不被安全区/底部控件遮挡；空态也有清晰中心文案。 | active marker=1；无横向滚动；焦点可经键盘/辅助技术到返回。 |
| S-A05-05 | 桌面，Nook 内拖一张普通 note/letter | 拖拽、推开邻居、放下反馈与 layer 相同；失败不会留假位置。 | POST `/api/card/position` 200；items path/x/y 与服务端一致；失败 fixture 回滚。 |
| S-A05-06 | 桌面/移动，Nook 内拖 Chalk（非 God/God 两档） | 非 God Chalk 仍可读/互动但不显示可拖成功；God 显式打开后可拖；ghost 不可拖。 | `CardDragSession` 创建条件与 layer 相同；`.object--ghost` pointer-events none。 |
| S-A05-07 | layer 中点角色 sprite 打开 dialogue | dialogue 纸面/角色立绘压在 `dialogue` Depth；底层 scene 仍可辨但不可操作。 | active dialogue marker=1；Canvas=1；底层 inert；`characterId` 不匹配帧不显示。 |
| S-A05-08 | Nook 中点角色实体打开 dialogue，再关闭 | 从 Nook 对话回 Nook，不跳 layer；关闭后 Nook 相机与进入 dialogue 前相同。 | stack top/returnTo 为 `nook:<id>`；不调用固定 `'dialogue'` restore；Nook 与 layer 的 dialogue 回调一致。 |
| S-A05-09 | layer 里点门：单击、双击、键盘 Enter 各一档 | 门只按 doc-06 的进入语义工作；inspect 不等于 enter。 | 单击/双击结果与 UX 04 矩阵一致；Nook 中不存在门时不发 enter-layer。 |
| S-A05-10 | layer 与 Nook 的 present item 各一档 | 背包物品拖到目标后的反馈、成功/失败文案一致；两种 projection 均可完成 present。 | `onItemDropOnTarget` 在两边均接线；结果事实与失败反馈一致，不允许 Nook 静默吞掉。 |
| S-A05-11 | Nook 有真实 `portrait`，桌面 + 移动 | portrait 外壳按 row `w/h`，视频/静态回退、Reduced motion、hidden 状态不破坏相机或布局。 | `.portrait__video` ≤1；实际高度经过 fonts/ResizeObserver；hidden 不 flush。 |
| S-A05-12 | 快速 A→B Nook、Esc、返回按钮连续点击 | 最后一角色获胜、只出现一个 Canvas/核心条，未发生父 layer 额外退栈。 | reqSeq/transition token 丢弃旧响应；active marker 恰一；camera stack 深度回到预期。 |
| S-A05-13 | 桌面 1440×960，执行 §10.2 完整写便签回放并再次进入 Nook | 便签出现、角色批注在 dialogue 后揭示；退出再进仍保留，两次进入不是浏览器缓存假象。 | Network/事件序列完整；第二次 GET 的 `items` 正文包含便签与批注；active marker/Canvas 各恰一个。 |

截图不是唯一证据：每个截图必须附浏览器 console/network 记录、active marker/path 集合、相机 target 前后值和事件序列；“看起来只有一间房”不能替代 DOM 不变量。

## 11. 发现的冲突 / 需要修订的上位文档

1. **`App.tsx` 当前双挂载与 `docs/ux/00 §4.5` 冲突。** `App.tsx:547` 无条件保留 layer Canvas，同时 `:758` 追加 Nook。必须在实现前由 App/UX 统一切换为互斥 active projection；不能把 CSS 隐藏当修复。
2. **`docs/nook/02 §3.6` 的全局 `measureHeights()` 与 A05 的单投影/Locality 要求存在接缝。** 02 明确第二 scheduler，但当前 Nook `:233` 仍默认 global root；建议 02/04 回写为 active root Adapter，或者明确以“一次只有一个 Canvas”作为暂时充分条件并加双挂载红测。
3. **`docs/nook/02 §3.1/§3.4/§3.6` 的“camera.save(currentLayer) / restore(currentLayer)”不足以表达 nested dialogue。** 应由 A05 的 CameraMemoryStack 作为 UX 跨 Module 语义回写；不修改 `useCamera` API 与 Nook response。
4. **`docs/nook/02 §⑫-1` 仍声明 Nook 省略 `onItemDropOnTarget`、`onEntityAction`、`onOpenCharacterModal`、`onOpenRadialMenu`，与本篇已冻结的完整 parity 冲突。** 必须回写 02 的调用侧说明：Nook 复用这些既有 Canvas callbacks/动作语义，不新增 API shape、路由或请求体；`onOpenRadialMenu` 仍受 God Hand 权限与“本批不提供 Nook 新建 UI”边界约束。
5. **`docs/nook/02 §3.4` 与现状 `NookViewProps` 不完全一致。** 当前 `NookView.tsx:34` 有 `locale`，`:41-47` 有 `onRequestInit`；02 原先列 6 props。Nook initialization 由后续/既有 init 文档决定，需统一文档的“本批是否执行”口径；A05 只要求它仍服从 active projection。
6. **当前 `closeCharacter` 与 `onOpenNook` 分别操作相机，违反 `docs/ux/00 §4.5` 的可嵌套记忆要求。** 需要在 App 设计回写中声明唯一 close/open transaction；不由 CharacterModal 或 NookView 各自 restore。
7. **`docs/layout/00` 禁止 layout 拥有相机；本篇不把 camera/focus 责任下放给 layout。** 若实现者把 active projection marker 或 camera stack 放进 `flowColumns`/`phantom-seat`，应退回评审。

## 12. 仍未知待拍板

1. **active marker 的最终 DOM 属性名**：本文暂称 `data-airp-projection` / `data-airp-projection-active`（NEW）；必须只选一套并加入 browser test，不得靠 CSS class 猜。
2. **dialogue 的 inert 实现**：原生 `inert`、等价 focus trap 或其他实现；语义必须满足“底层 Canvas 不可交互、只有一个 dialogue focus”，具体 Implementation 待评审。
3. **CameraMemoryStack 的存储位置**：推荐 App 内部 ref/状态，不进入 `useWorld` 或服务器；需确认 StrictMode 重挂时 stack 不重复 push/pop。
4. **Nook present item 与角色实体 dialogue 的产品范围已冻结为必须 parity；仍未知的是既有回调如何在 `NookViewProps` 维持不改请求/数据形状的前提下完成透传。** 实现评审必须补齐接线并更新 `docs/nook/02`，不得将其降级为 conditional/no-op。
5. **layer scheduler 在 Nook active 时的挂起方式**：最小实现是旧 Canvas 卸载 + path-local widths；更稳妥的是给 scheduler 注入 active root/suspend seam。不得在实现时无记录地选择。
6. **Nook 是否允许保留底层 layer `Canvas` 以做视觉过渡**：A05 当前答案为“不允许”；如果产品坚持保留，必须先完成 root-scoped `measureHeights`、LinkLayer、hover/drag 查询及相机 driver 隔离，并修订 `docs/ux/00 §4.5`。
7. **截图 fixture 的非空角色**：遵守 `docs/nook/00 §3.7.1`，不得用被探针污染的 `watson`；由 Nook 05 的 `ryo`/`sumi` 等确证 fixture 统一。

> A05 的交付判据：实现者能用 §10.1 的主动失败测试证明“只有一个 active projection”，用 §5 的嵌套场景证明 layer/Nook/dialogue 相机不互相覆盖，用 §6 的矩阵与 §10.2 的浏览器回放证明动作不是“看似有 UI、实际没有事实通路”，并用 §10.3 的截图证明桌面/移动和进入/退出的连续体验。
