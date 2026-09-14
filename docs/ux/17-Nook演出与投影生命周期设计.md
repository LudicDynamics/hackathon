# UX17：Nook 演出与投影生命周期设计

> 状态：设计阶段，待主代理评审；本文只负责 Nook `PerformanceLayer`、`airp:show-frame` 唯一消费、camera 与 active projection。
>
> 共同地基：必须服从 `docs/ux/15-下一批共同上下文.md`、`docs/ux/00-共同上下文.md`，不改变权威层级、事件边界、FocusOwner、唯一 show listener、active projection 唯一性或“权威结果确认后才演出”。

## 一句话定位

**Layer 与 Nook 共享一个稳定挂载的 `PerformanceLayer`、一个 `airp:show-frame` listener 和一个 module-scope `useCamera` 驱动；两者永不同时挂 Canvas，CharacterModal 只是覆盖在当前 stage 上的 overlay，不产生第二个舞台真相。**

本设计的直接结论：

1. `PerformanceLayer` 不再放在普通 layer 分支内部；由 `App` 的 `.prototype-world` 稳定宿主只挂一份，既服务 layer 也服务 Nook。
2. `useWorld.ts` 继续是唯一 WS 消费点，`show_frame` 继续只转发一次 `airp:show-frame`；NookView 不创建 WS、不添加 show listener。
3. layer/Nook 的 Canvas 分支保持互斥。Nook 切换时先清理瞬时 show，再卸载旧 Canvas，挂载新 Canvas；禁止用 `hidden`、`opacity:0`、`visibility:hidden` 保留第二 Canvas。
4. `CharacterModal` 选择 **overlay-only**：它有 `role="dialog"`/`aria-modal="true"`，但没有 `data-airp-projection-active`、没有 Canvas、没有 camera owner；底层 layer/Nook stage 保留唯一 active marker，同时 `aria-hidden=true`、`inert=true`。
5. camera 仍由现有 `useCamera` 共享驱动与 `lib/camera.ts` 的 `CameraMemoryStack` 编排；slot 必须按 `layer:<id>`、`characters/<id>`、`dialogue:<id>:<caller-slot>` 隔离，不能再写固定 `dialogue`/`layer` 槽。

## 1. 范围、权威层级与不负责的事

### 1.1 权威层级

冲突按以下顺序裁决：

1. 世界文件、实体 frontmatter、动作层权威结果；
2. `docs/ux/15-下一批共同上下文.md` 与 `docs/ux/00-共同上下文.md`；
3. `docs/nook/00-共同上下文.md`、`docs/nook/02-前端视图与入口.md`、`docs/perform/00-共同上下文.md`、`docs/perform/05-演出库.md`；
4. `docs/ux/02-舞台Depth与演出归属.md`、`docs/ux/05-Nook投影与相机连续性.md`、`docs/ux/06-Agent演出状态与角色剧场.md`、`docs/ux/07-声画偏好与性能接缝.md`；
5. 当前源码实现；
6. 浏览器表现只能作为证据，不能反过来制造事实。

演出只能投影已接受的帧和当前 stage，不能写文件、追加事件、修改 `LayerState`、把 DOM 存在当作世界成功。

### 1.2 本文负责

- App 普通 layer/Nook 互斥 Canvas 的挂载与卸载时序；
- 唯一 `PerformanceLayer` 宿主、唯一 `airp:show-frame` listener、`liveCtx` 生命周期、show replacement/cleanup；
- Nook 的演出上下文、Nook active marker、`aria-hidden`/`inert`；
- `useCamera` 与 `CameraMemoryStack` 的 layer/Nook/dialogue 交界；
- CharacterModal 作为 overlay-only 时的 stage 连续性与回放验收；
- show、camera、Nook 请求和卸载之间的错误、取消、stale 保护。

### 1.3 本文不负责

- 新增 WS 帧、HTTP payload、世界事件 type 或第二个动作反馈 store；
- Nook API、`LayerState`、footprint body、`flowColumns`、真实卡片坐标和 phantom 权限；
- CharacterModal 的分页、TTS、角色 frame schema；本文只规定其如何覆盖 stage；
- 新的 FocusOwner。仍复用 App 现有 `focusCoordinator` 的 `nook` 与 `character-dialogue` owner；
- 音频 schema 或隐藏页主轨策略。`lights_out` 已有的 `setAmbient` cleanup 仍归演出/音频契约。

## 2. 现状证据

### 2.1 App 当前 layer/Nook 分支与 marker

| 事实 | 代码证据 | 影响 |
|---|---|---|
| App 用 `nookChar` 互斥挂 Nook 或 layer | `apps/web/src/App.tsx:940-969`：`{nookChar && (...)}` 与 `{!nookChar && (...)}` 两个分支 | 这是本设计的互斥基线；不得改为两个常驻 Canvas 再用 CSS 隐藏。 |
| layer 宿主有 active marker、dialogue 时隐藏并 inert | `apps/web/src/App.tsx:969-975`：`data-airp-projection="layer:${layer}"`、`data-airp-projection-active="true"`、`aria-hidden`、`inert` | stage marker 目前属于 App layer wrapper。 |
| Nook wrapper 有 projection 属性，但 active marker 在 NookView 内层 | `App.tsx:941-947`；`NookView.tsx:438-447` | marker owner 不对称；本设计保留“layer wrapper / NookView root 各一处”的单 owner 规则，并禁止 App Nook wrapper 再加 active marker。 |
| Nook 内部 root 当前恒有 active marker | `apps/web/src/components/nook/NookView.tsx:439-447` | `inactive` 只影响 `aria-hidden`/`inert`，不删除 stage marker；marker 表示舞台投影，不表示当前 focus owner。 |
| Nook 当前只挂 `Canvas`，没有 `PerformanceLayer` | `apps/web/src/components/nook/NookView.tsx:520-584`，尤其 `:563-583` | Nook 的 show 当前无法同构消费；不能在 NookView 内另建 WS 或第二 listener。 |
| layer 的 `PerformanceLayer` 当前在 layer branch 内 | `apps/web/src/App.tsx:1018-1027` | layer→Nook 会卸载 show root；若直接把第二份放进 Nook，会产生 listener/liveCtx 竞争风险。需要改成 App 稳定宿主。 |

### 2.2 `airp:show-frame` 当前路径与 show store

| 事实 | 代码证据 | 影响 |
|---|---|---|
| WS 只有一个 `useWorld` ingress | `apps/web/src/state/useWorld.ts:500-513` 创建 `onMessage`；`useWorld.ts:782-793` 创建并保存唯一 socket | Nook 只能复用此 ingress。 |
| `show_frame` 只派发一次 DOM 事件 | `apps/web/src/state/useWorld.ts:772-775`：`window.dispatchEvent(new CustomEvent('airp:show-frame', { detail: msg }))` | 不新增 Nook 事件、不在 NookView 直接监听。 |
| `PerformanceLayer` 有 module `active`、`listeners`、`seq`、`liveCtx` | `apps/web/src/components/performance/PerformanceLayer.tsx:43-70` | show 生命周期是模块态，不能复制到 Nook 局部 state。 |
| `performShowFrame` 当前会先渲染新 show，再在 `:453-456` 清理同一 resource key 的旧 show | `PerformanceLayer.tsx:422-456` | 目标 replacement 顺序必须在实现中改为先完成旧 show cleanup，再注册新 show；设计不能把目标行为写成现状。 |
| timer 以 `id` 清理 active show 和 caption | `PerformanceLayer.tsx:468-494` | show 不因 React render 重置；切 projection/unmount 必须额外调用 `cancelShow`。 |
| listener 在组件 effect 中注册并在 cleanup 中注销 | `PerformanceLayer.tsx:556-565` | 目标是全 App 只有一份注册；不能让 layer/Nook 各注册一份。 |
| 当前 `liveCtx` cleanup 会直接设 `null` | `PerformanceLayer.tsx:538-554` | 稳定单实例可以避免重叠；实现仍需按 owner token 保护旧 cleanup 不清掉新 context。 |
| 当前只在 `layer/frozen` effect cleanup 时调用 `cancelShow` | `PerformanceLayer.tsx:556-567` | `hidden/effects/reduced` 变化不会自动清理已有 DOM，是本设计的修复重点，见 §9 的修复前失败断言。 |

### 2.3 camera 与 Canvas 当前事实

> 用户指定的 `apps/web/src/hooks/use-camera.ts` 在当前仓库不存在。实际 hook 是 `apps/web/src/state/useCamera.ts`；当前源码引用也明确使用 `./state/useCamera.js`（`apps/web/src/App.tsx:44-46`），本文以下均按实际文件引用。

| 事实 | 代码证据 | 影响 |
|---|---|---|
| camera target/current、默认视图和 flat memory 在 module scope | `apps/web/src/state/useCamera.ts:36-45` | 不能在 NookView 建第二 camera singleton。 |
| `CameraApi` 只有 `flyTo/save/restore/getCam/getTarget/getViewport/subscribe` 与两个 ref | `useCamera.ts:54-75` | show 和 Canvas 必须共享这一个 API。 |
| 只有拥有 `worldRef` 的 Canvas 实例启动 rAF；App-level hook 不启动第二 rAF | `useCamera.ts:120-158` | 稳定宿主 `PerformanceLayer` 可调用同一 `useCamera`，但不能持有第二 `worldRef`。 |
| Canvas 在 `currentLayer` 变化时保存旧 slot、恢复新 slot | `apps/web/src/components/canvas/Canvas.tsx:200-208` | Nook 必须传响应的 `state.layer`，不能传父 layer。 |
| Canvas framing 只调用 `camera.flyTo`，不写卡片坐标 | `Canvas.tsx:210-239` | camera movement 不得反写首帧排版。 |
| `CameraMemoryStack`、`cameraSlot` 已存在 | `apps/web/src/lib/camera.ts:89-118,128-136` | 复用现有内部 seam，不再设计 `camera.save('dialogue')`。 |
| slot 形状已由 `cameraSlot` 定义 | `lib/camera.ts:92-95`：layer=identity、nook=`characters/<id>`、dialogue=`dialogue:<id>:<callerSlot>` | 所有进入/退出必须使用 `projectionTarget`。 |
| App 已创建 stack 并按 layer 更新 current | `apps/web/src/App.tsx:255-273` | stack owner 继续是 App。 |
| App 已使用 stack 进入/退出 Nook | `App.tsx:287-318` | 需补 transition guard、show cleanup 和 Nook key，不另造 Nook camera。 |
| App 已使用 stack 进入/退出 dialogue | `App.tsx:852-875,894-911` | 保留 caller 为 layer 或 Nook；CharacterModal 不直接操作 camera。 |

### 2.4 Nook 请求、stale 与卸载当前事实

- `/api/nook` 返回值被归一为 `LayerState`，且 `layer` 直接取响应值：`apps/web/src/components/nook/NookView.tsx:118-148`；不得从 `characterId` 代替响应的 `state.layer` 作为 Canvas 数据源。
- `mountedRef`、`reqSeqRef` 在 `NookView.tsx:212-230` 负责卸载和 last-request-wins；`load` 在 `:232-251` 只接受仍 mounted 且 seq 匹配的响应。
- `airp:layer-init` listener 在 `:257-271`、`airp:world-event` listener 在 `:323-360` 均有注销；Nook 不应新增第二个同义事件。
- Nook footprint scheduler 在 `:366-393` dispose；ResizeObserver/font gate 在 `:398-425` disconnect/cancel；这两个清理必须继续绑定 Nook root 生命周期。
- Nook 当前 Canvas 的 `currentLayer={state.layer}` 是正确的：`NookView.tsx:563-566`。但它当前没有透传 `effectsEnabled`、`hidden`、`reducedMotion`、`allowChalkDrag`、`assetUrl` 等 layer Canvas 生命周期/互动参数（现状证据：`NookView.tsx:564-583` 对比 `Canvas.tsx:42-79`），本设计只要求补齐与 active projection/声画门禁直接相关的既有 props；动作 parity 的完整契约仍由 `docs/ux/04`/Nook owner 回写。

### 2.5 CharacterModal 当前事实

- CharacterModal 根是 `role="dialog"`、`aria-modal="true"`，没有 `data-airp-projection` 或 active marker：`apps/web/src/components/overlay/CharacterModal.tsx:780-790`。
- 关闭是 220ms closing transaction，之后才调用 App 的 `onClose`：`CharacterModal.tsx:489-494`；不能在按下 Escape/close 时直接卸载底层 stage。
- App 以 `activeCharacter` 条件挂载，并将 `onOpenNook` 交给 `openPrivateSpace`：`apps/web/src/App.tsx:1237-1260`。
- App 通过 `focusCoordinator` 同步 `character-dialogue` owner：`App.tsx:170-183,340-347`；Escape 由 App topmost 路由，`App.tsx:567-610`，CharacterModal 不应另装 document-level Escape。

### 2.6 现有测试的边界

- `apps/web/test/active-projection.test.mjs:9-17` 静态断言 layer/Nook 互斥分支、App 内一处 `<Canvas>`/`<PerformanceLayer>` 字面量；`:19-26` 分别检查两个文件中的 marker、Nook 不调用 `useWorld`/`WebSocket`/`useCamera`、root-scoped dragging 查询。它不能证明运行时 Canvas 数量、listener 数量或 dialogue inert。
- `apps/web/test/depth-performance.test.mjs:26-39` 覆盖 admission 接缝和 resource takeover；没有 Nook 挂载、hidden 变化或 projection switch。
- `apps/web/test/app-nook-camera-contract.test.mjs:11-27` 覆盖 Nook callback、事件重取和 root card observer；`:70-75` 覆盖 camera slot/clear 的源码契约。
- `apps/web/test/camera-memory-stack.test.mjs:19-65` 已覆盖 layer→Nook、Nook→dialogue 的 nested stack 和跨 world clear；仍缺真实 browser mount/marker/Canvas 回放。

## 3. Active projection 与 CharacterModal 决策

### 3.1 Stage projection 的唯一不变量

本设计把 active projection 定义为**当前拥有 Canvas 与舞台事实 DOM 的 stage root**，只允许以下两种：

```ts
// NEW：仅前端内部诊断/测试形状，不是 HTTP/WS 字段。
type ActiveStageProjection = `layer:${string}` | `nook:${string}`;
```

运行时必须满足：

1. `document.querySelectorAll('[data-airp-projection-active="true"]')` 恰好一个；
2. stage active 时恰好一个 Canvas viewport；
3. `.object[data-path]` 只来自当前 Canvas，不能来自 hidden 的旧 Canvas；
4. layer active marker 由 App 的 layer wrapper 提供；Nook active marker 由 `NookView` root 提供；App 的 Nook wrapper 不再增加第二 active marker；
5. `PerformanceLayer` root 不是 stage marker，它是 `data-depth="performance"`、`aria-hidden="true"` 的共享装饰 surface；
6. dialogue 打开不新增 stage marker，不新增 Canvas，不改变 `currentLayer` 或 Nook `state.layer`。

### 3.2 CharacterModal 是 overlay-only

**结论：CharacterModal 不是 active projection，而是 overlay-only。**依据：

1. 当前根已是 fixed/dialogue 语义的 `role="dialog"` + `aria-modal="true"`（`CharacterModal.tsx:780-790`），不是 Canvas/stage root。
2. 当前根没有 `data-airp-projection-active`（`CharacterModal.tsx:780-790`），文件导入也没有 `useCamera`/`useWorld`/WebSocket（`CharacterModal.tsx:1-27`）；角色帧由 App 的 `CharacterFrameQueue` 消费路径（`CharacterModal.tsx:708-718`）归属，本文不能新增第二消费路径。
3. `docs/ux/00-共同上下文.md §4.5` 要求一个 active projection、一个 Canvas 交互焦点；`docs/ux/02-舞台Depth与演出归属.md §7.1` 把 modal 定义为压暗/虚化已有画布的 dialogue context，而不是换页。
4. App 已把底层 layer/Nook wrapper 设置 `aria-hidden`/`inert`（`App.tsx:945-947,971-975`），同时由 `focusCoordinator` 管理 `character-dialogue`；这正是“保留一个 stage、把交互焦点交给 overlay”的形状。

因此：

- CharacterModal 根保持 `role="dialog" aria-modal="true"`，不新增 active marker；
- layer/Nook active marker 在 dialogue 期间仍存在，代表唯一底层舞台，不代表当前键盘焦点；
- dialogue 打开后底层 stage 必须 `aria-hidden=true` 与 `inert=true`，PerformanceLayer 保持 `aria-hidden=true`；
- dialogue overlay 自己不可设置 `aria-hidden=true`，否则读屏无法进入角色台词；
- show 可继续投影到底层 stage，但不可以获得 pointer/focus。关闭时先完成 220ms modal closing，再由 App pop camera frame、清 frame queue、恢复底层 stage。

这与 `docs/ux/05` 当前把 `dialogue:<characterId>`列为“逻辑 projection”并建议 dialogue marker 的写法存在冲突，见 §11 C1。评审若坚持 dialogue 也必须有 active marker，需先冻结“marker 表示 focus 还是 stage”、重写本篇不变量和浏览器断言；本设计不在实现期隐式切换。

## 4. 共享接口与生命周期契约

### 4.1 不新增网络形状

继续使用真实的：

- `ShowFrame`：`packages/shared/src/actions/show.ts:21-33`，字段为 `type/component/target/targetName/links/params/durationMs/caption/actor/timestamp`；本文不加 `layer` 字段；
- `LayerState`：由 `apps/web/src/state/useWorld.ts` 与 `NookView.tsx:132-141` 使用的同一形状；Nook 的 `state.layer` 必须来自 `/api/nook` 响应；
- `airp:show-frame`：`useWorld.ts:772-775` 唯一 DOM 事件；
- `airp:world-event`、`airp:layer-init`：继续使用现有名称和唯一 ingress；
- `CameraApi`、`ProjectionTarget`、`CameraMemoryStack`：分别见 `useCamera.ts:54-75`、`lib/camera.ts:98-136`。

**ShowFrame 没有 layer 字段。**在不改变上位协议的前提下，show 的目的地是当前唯一 active stage：target show 以唯一 active Canvas 的 `.object[data-path]` 解析；target 不在当前 stage 则 no-op。targetless show 在 Nook active 时的跨层歧义列为 §12 U1，不能伪造一个新字段解决。

### 4.2 `PerformanceLayer` 的唯一 owner

继续使用现有 `PerformanceLayerProps`（`PerformanceLayer.tsx:501-512`）：

```ts
interface PerformanceLayerProps {
  layer?: string;
  frozen?: boolean;
  hidden?: boolean;
  effectsEnabled?: boolean;
  reducedMotion?: boolean;
  admission?: OverlayAdmission;
}
```

设计规定：

- App 只挂一个 `<PerformanceLayer>`，挂在 `.prototype-world` 的稳定层级，位于 layer/Nook 两个互斥分支之后、`.prototype-vignette` 之前；不挂 Canvas `worldRef`，不挂 NookView 内部；
- `layer` 继续作为 show 生命周期 identity：layer active 时传 `layer`，Nook active 时传冻结的 Nook identity `characters/${nookChar}`。这个值**只用于取消旧 show 的生命周期比较**，不是 Nook `Canvas.currentLayer` 的数据来源；Nook Canvas 仍只接受响应 `state.layer`；
- `hidden/effectsEnabled/reducedMotion` 与 App 当前 page visibility/effects/motion 一致；`frozen` 使用当前世界冻结权威值；
- `admission` 复用 App 的 `overlayAdmission`，不创建 Nook admission singleton。

`ShowCtx` 仍是 `PerformanceLayer.tsx:53-65` 的内部形状；如果实现需要把 stage identity 写进诊断，新增字段必须明确为：

```ts
// NEW，仅 PerformanceLayer 内部诊断，不导出、不进入 ShowFrame。
interface ShowCtx {
  root: HTMLElement;
  camera: CameraApi;
  still: boolean;
  hidden: boolean;
  effectsEnabled: boolean;
  admission?: OverlayAdmission;
  activeStage: ActiveStageProjection; // NEW
}
```

`activeStage` 不能成为第二个全局 projection store；它只随 App 唯一宿主的 render context 更新。

### 4.3 `liveCtx` 与 listener 生命周期

`liveCtx` 继续是 `PerformanceLayer.tsx:67-70` 的 module-local context，不新增全局事件总线。稳定单实例的行为：

1. `<PerformanceLayer>` 首次 mount：创建 root、订阅 `subscribeActiveShow`，写入 `liveCtx`，注册**一次** `window.addEventListener('airp:show-frame', onShowFrame)`。
2. App active stage 变化：只更新 context 的 `activeStage`/门禁值，不能重新注册 listener；projection 切换前后调用 `cancelShow` 清掉旧 stage 的所有 transient DOM、timer、camera subscription、ambient 临时覆盖和 admission token。
3. `airp:show-frame` 到达：listener 只调用 `performShowFrame(detail)`；不在 App、NookView、CharacterModal、Canvas 各自消费。
4. unmount：先注销 listener，再 `cancelShow('performance-unmount')`，最后清理 `liveCtx`；如果使用 owner guard，必须只清掉自己写入的 context：

```ts
// NEW，PerformanceLayer.tsx 内部 helper；不导出。
const installLiveContext = (ctx: ShowCtx): (() => void) => {
  // 写入 ctx，并在 cleanup 时仅当 liveCtx === ctx 时清空。
  // 不能让旧 effect cleanup 清掉后一次 render 写入的新 ctx。
};
```

5. `liveCtx === null` 时 `performShowFrame` 返回 `false`；不得把事件缓存到 Nook 或下一层，也不得在没有 stage 的时候创建 DOM。

### 4.4 show replacement、资源和 cleanup

保留现有 `ActiveShow`、`activeShow()`、`performShowFrame()`、`cancelShow()`（`PerformanceLayer.tsx:43-97,422-497`）：

- 同 resource key（例如 `spotlight/lights_out` 的 `dim`）先调用旧 `cleanup`，再注册新 show；
- 异 resource key 可并行，但所有 show 都必须绑定当前 stable root；
- `caption` 必须与 show 一起 cleanup；
- `evidence_burst` 的 camera subscription 必须在 cleanup unsubscribe，线条只在 PerformanceLayer 自有 SVG，不进入 `LinkLayer.registry`；
- `lights_out` 恢复进入前 `audioDebugState().ambient`；不碰 App 所有的 BGM；
- timer 必须按 `id` 判断，旧 timer 不能删除新 replacement；
- target 不存在、component 未知、帧形状非法都返回 `false`，不猜中心、不 fly camera、不写 DOM；开发诊断不能替代玩家可见动作错误。

为避免隐藏页或 preference 切换留下残留：

- `document.hidden`、`effectsEnabled=false`、`reducedMotion=true` 时，现有 active transient show 必须按最保守规则 cleanup；
- 这些门禁变化不能只更新 `liveCtx`，必须使 `activeShow()` 归零、show root 内临时 DOM 归零、camera subscription 归零；
- 重新可见/重新开启 Effects 不重播旧 `ShowFrame`，只等待下一条新帧；
- 若产品最终决定某类 show 在 Effects off 保留静态事实，必须由上位 A02/A09 提供明确 static adapter；本文不把 `aria-hidden` 的装饰 caption 当事实反馈。

## 5. 精确挂载与逐步生命周期

### 5.1 稳定挂载点

实现只调整 `apps/web/src/App.tsx` 的 `.prototype-world` 结构（现状 `:940-1031`）：

```tsx
<section className="prototype-world" ...>
  {nookChar && <div className="prototype-nook" ...><NookView ... /></div>}
  {!nookChar && <div data-airp-projection={`layer:${layer}`} data-airp-projection-active="true" ...><Canvas ... /></div>}

  {/* 唯一 PerformanceLayer：与上面两种 stage sibling，不能放进任一分支。 */}
  <PerformanceLayer
    layer={nookChar ? `characters/${nookChar}` : layer}
    frozen={state?.worldFrozen === true}
    hidden={!pageVisible}
    effectsEnabled={effectsEnabled}
    reducedMotion={reducedMotion}
    admission={overlayAdmission}
  />
  <div className="prototype-vignette" aria-hidden="true" />
</section>
```

上面只使用仓库已有 `PerformanceLayer`、`pageVisible`、`effectsEnabled`、`reducedMotion`、`overlayAdmission`、`state.worldFrozen` 符号；`characters/${nookChar}`只作 show cleanup identity。NookView 内不得再写 `<PerformanceLayer>`，App layer 分支内原 `:1020-1027` 的实例必须移除。

**漏了会怎样：** 如果 stable host 不存在，Nook active 时 `liveCtx=null`，show 帧被跳过；如果两个分支各挂一份 listener，同一帧会触发两次 renderer/音效，且后写入的 `liveCtx` 会让旧 root cleanup 误清新 root；如果挂在 `worldRef`，camera transform 会缩放压暗层、丝线和 focus。

### 5.2 进入 Nook：layer → Nook

1. App 的 CharacterRail 或 CharacterModal 的 `onOpenNook` 进入唯一 `openPrivateSpace`；先检查已有 transition 是否完成。**漏了会怎样：**快速点 A→B 会在同一 camera stack 上重复 push，慢响应可能用 A 的内容覆盖 B。
2. 以当前 `cameraStack.current()` 得到 caller（`layer:<id>` 或当前 `nook:<id>`），创建 `projectionTarget('nook', characterId)`；调用 `cancelShow('enter-nook')`，再 `cameraStack.pushTransition(target)`。**漏了会怎样：**旧 spotlight/ink/camera show 会在新 stage 上写入，旧灯光、timer 或 ambient override 残留。
3. 先令 caller Canvas 失去 active projection，再提交 `setNookChar(characterId)`；不得先保留 layer Canvas 做 CSS 淡出。**漏了会怎样：**全局 `.object[data-path]`、`LinkLayer`、footprint 和共享 `worldRef` 同时命中两份 DOM。
4. 给 NookView 增加 `key={nookChar}`，确保 A→B 是旧 Nook 卸载、新 Nook 挂载，而不是旧 `state` 在新标题下继续显示。**漏了会怎样：**A 的 `state.items`、scheduler 和 Nook camera 会短暂服务 B。
5. `NookView` 通过 `/api/nook?character=...` 获取响应；只有 `result.ok` 且 `state.layer` 已确认后，Canvas 才以 `currentLayer={state.layer}` 渲染。**漏了会怎样：**自行拼 `characters/<id>` 会让数据层与 footprint 层 identity 漂移。
6. Nook root 成为唯一 active marker：`data-airp-projection="nook:<id>" data-airp-projection-active="true"`；stable PerformanceLayer 使用共享 camera，但不成为 marker。**漏了会怎样：**测试看到 Nook 有内容却仍把 layer 当 active，show target、焦点和辅助技术树会串台。
7. `cameraStack.restoreTarget(projectionTarget('nook', characterId))` 由 App transition 负责；没有记忆时使用 camera default，Canvas framing 只 `flyTo`，不写 x/y。**漏了会怎样：**Nook 首次进入复用 caller 的视角，或 framing 反向修改卡片事实。
8. Nook 的 `/api/nook` 失败时保留既有 state（当前 `load` 行为 `NookView.tsx:246-250`），显示 `role=alert`；不得 restore 到不存在的 Nook、不得清掉 caller camera。**漏了会怎样：**404/断网会变成空房间并丢失返回现场。
9. 字体和 ResizeObserver 稳定后才允许 footprint scheduler flush；当前 root-scoped measure/observer 继续使用 `NookView.tsx:366-425`。**漏了会怎样：**新 Nook 首帧以错误高度回写，长 Chalk 之后重排跳位。

### 5.3 离开 Nook：Nook → layer

1. 返回按钮或 App topmost Escape 只调用同一个 `closeNook`；NookView 不增加 keydown listener。**漏了会怎样：**一次 Escape 同时触发 Nook close、parent layer 返回和 camera restore。
2. `closeNook` 先令 show owner `cancelShow('leave-nook')`，再用 `callerProjectionRef` 和 `cameraStack.popTransition(expectedCaller)`；只有 pop 返回 frame 才 `restoreProjection(frame)`。**漏了会怎样：**重复点击会 restore 两次，或将 Nook target 写回 parent layer。
3. 在切换 active marker 前卸载 Nook Canvas；Nook scheduler dispose、ResizeObserver disconnect、world/init listener remove、mounted/seq guard 生效。**漏了会怎样：**旧 `/api/nook` 或 footprint Promise 在 layer DOM 上 setState/POST。
4. `setNookChar(null)` 后 layer branch 重新挂载，Canvas 只消费原 layer payload；`void refresh()`仍作为回到 layer 的事实兜底，不替代 camera restore。**漏了会怎样：**返回后旧 layer 内容、phantom 或坐标缓存遮住真实重取。
5. 稳定 PerformanceLayer 在 branch 切换期间不卸载；但其 active list 已被 `cancelShow` 清空，下一条帧只会定位新 Canvas。**漏了会怎样：**稳定 root 虽只有一份，旧 show 仍会写入新 stage，形成视觉残留。

### 5.4 进入/退出 dialogue：layer 或 Nook → overlay-only CharacterModal

1. `openCharacter` 取得 caller `projectionTarget('layer', layer)` 或 `projectionTarget('nook', nookChar)`，push `projectionTarget('dialogue', character.id, caller.slot)`；清 `frameQueue` 后才设置 `activeCharacter`/发送 `character_start`。现有落点 `App.tsx:852-875` 保留。**漏了会怎样：**上一角色的末帧会在新 modal 中开场，退出会 restore 到错误 caller。
2. 底层 stage 不卸载，只设置 wrapper `aria-hidden=true`、`inert=true`；active marker 数量仍为一；CharacterModal 挂载并取得 `character-dialogue` focus owner。**漏了会怎样：**读屏和 pointer 可以同时访问底层卡、门和 Nook 按钮。
3. stable PerformanceLayer 保持 mounted，`aria-hidden=true` 的 show root 仍可在底层 stage 播放非交互视觉；它不成为 dialogue marker，不抢焦点。**漏了会怎样：**为了对话再挂一份 show listener，writer frame 会重复演出或旧 show 不可清理。
4. CharacterModal 的角色帧继续沿 `useWorld → App → frameQueue → CharacterModal`，本设计不改 `airp:character-frame`；show frame 也不改成角色 listener。**漏了会怎样：**同一 WS 帧有两条归属路径，TTS/stinger/页游标重复。
5. 关闭由现有 220ms `closing` 完成后调用 `closeCharacter`；App 发送 `character_stop`、release admission、`frameQueue.clear('close')`、pop/restore caller，再清 `activeCharacter`。**漏了会怎样：**相机先跳、voice/timer 后停，或一次 Escape 关闭两层。
6. 对话期间如果有 show 帧：其 target 必须在唯一底层 Canvas；visual show 可继续作为背景，`camera_focus` 只能改变共享 camera target，不得写布局坐标；dialogue close 的 `restoreProjection` 将 camera 恢复到 caller snapshot。**漏了会怎样：**show 把角色对话变成第二 camera 真相，关闭后回不到进入前视点。

### 5.5 dialogue → Nook（Visit private space）

1. 先停止角色 voice/timer、等待现有 CharacterModal closing transaction；不要同时保留 CharacterModal 与 Nook。
2. App pop dialogue caller frame，再以同一 caller（layer 或 Nook）push Nook target；`setActiveCharacter(null)` 与 `setNookChar(id)` 在同一 transition commit 内完成。
3. `cancelShow` 的边界：dialogue overlay 本身不是 stage 切换，普通 dialogue close 不清后台 show；但 dialogue→Nook 是 stage identity 切换，必须清 transient show。
4. Nook 成为唯一 active marker；新 Nook root/key、request seq、footprint scheduler 与 camera slot 均以目标角色身份重新开始。

**漏了会怎样：**如果 modal 还在，屏幕会有两个可访问 dialog/stage；如果先设 Nook 再 pop dialogue，stack 顶部会变成错误 caller，回退到 layer 时 camera 跳层。

## 6. Layer ↔ Nook ↔ Dialogue 回放矩阵

| 回放 | active stage / marker | Canvas 与 show | camera 行为 | 退出与失败 |
|---|---|---|---|---|
| layer idle → layer show | `layer:<id>` 恰一个 | stable `PerformanceLayer` 唯一 listener；target 从当前 `.object[data-path]` 解析；同 resource replacement | `camera_focus` 只调用共享 `flyTo`，不写卡坐标 | duration 到期 cleanup；layer change/freeze cancel 全部 transient |
| layer → Nook | layer marker 卸载，Nook marker 恰一个 | 旧 Canvas 卸载；stable show root 保留但 active show 先清零；Nook Canvas 复用同一 `PerformanceLayer` | push layer caller；restore Nook slot/default；Canvas 只以响应 `state.layer` 为 currentLayer | 404/网络失败保留 caller；stale A response 不得写 B |
| Nook idle → Nook show | `nook:<id>` 恰一个 | spotlight/lights_out/ink/threads 均定位 Nook `.object`；evidence 线仍是 transient SVG；无第二 listener | `camera_focus` 作用于 Nook 的共享 camera；不创建 Nook camera | show 到期 cleanup；Nook unmount/projection switch cancel |
| layer → dialogue | layer marker 仍唯一但 stage `aria-hidden/inert` | modal overlay-only；PerformanceLayer 仍在底层，show 不可 pointer/focus | push layer caller → dialogue slot；modal 不调用 useCamera | close 220ms 后 pop/restore；角色错帧只 notice，不污染 stage |
| Nook → dialogue | Nook marker 仍唯一但 root `inactive`/inert | Nook stage 保留一份 `.object`；modal 不生成 Canvas/marker；背景 show 可继续 | push Nook caller → `dialogue:<char>:characters/<char>` | close 回 Nook，不回 layer；失败不清 Nook state |
| dialogue → Nook | dialogue root 卸载，Nook marker 恢复可交互 | dialogue 期间的 transient show 不带入新 Nook；stage 切换前统一 cancel | pop dialogue caller，再 push Nook target；恢复 Nook slot | stale close token 不得再 pop parent |
| Nook → layer | Nook marker 卸载，layer marker 恢复 | Nook show root 内 DOM/activeShow 全空；layer 新 Canvas 唯一可测 | pop Nook transition，restore layer caller target | refresh 兜底；重复 close 幂等 |
| layer → Nook → dialogue → Nook → layer | 每一步最多一个 marker、一个 Canvas | `airp:show-frame` 始终同一 listener；每次 stage identity 变化清 transient show | stack 深度按 push/pop 对称，最终回到 layer 原 target | 任何中途失败都保留当前 caller，不跨世界复用 slot |
| hidden/effects off/reduced 中的任意 stage | marker 不改变；Canvas 仍可读但非必要装饰停止 | stable listener 仍在但 gated；active show/临时 DOM 清零；不补播旧 frame | 不因偏好门禁改变 camera slot 或卡坐标 | 恢复后只接受新帧；facts/错误/aria 仍可见 |

## 7. 跨端接线与副作用边界

### 7.1 WS / 事件

1. `useWorld.ts` 继续创建唯一 WebSocket、解析 writer/world/show/character 帧；不向 Nook 增加 `new WebSocket`。
2. `case 'show_frame'` 继续只在 `useWorld.ts:772-775` 派发 `airp:show-frame`。
3. stable `PerformanceLayer` 是唯一 `window` show listener；NookView、Canvas、CharacterModal、Chrome 不监听该事件。
4. Nook 的内容变化继续经现有 `airp:world-event` listener 重取；当前 `NookView.tsx:323-360` 的事件筛选和 cleanup 保留。
5. dialogue 角色帧继续由现有 App identity router 过滤；本设计不把 show 帧混进 `CharacterFrameQueue`。

### 7.2 HTTP / 数据

- `/api/nook?character=<id>` 仍只读；成功返回 `LayerState`，失败保留 caller projection；
- `/api/layer`、`/api/card/footprint`、既有动作 endpoint 不改 body；Nook footprint 仍以响应 `state.layer` 为 layer identity；
- camera stack 只存在 App memory，不进入 HTTP/WS/world files；
- show DOM、caption、thread、beam、ink、temporary ambient override 都不写文件、事件、`canvas.db` 或 `LinkLayer.registry`；
- `cancelShow` 只清理 transient projection，不伪造动作 cancelled/failed。

### 7.3 Canvas / Nook 接口

NookView 继续复用现有 `Canvas`，只补齐生命周期相关的已有 props：

- `effectsEnabled={effectsEnabled}`；
- `hidden={hidden}`，其中 `hidden` 是 **NEW `NookViewProps` 可选宿主 prop**：`hidden?: boolean`，由 App 传 `!pageVisible`；
- `reducedMotion={reduceMotion}`；
- `currentLayer={state.layer}`；
- `stillPortraits={reduceMotion}`；
- 既有动作 callback 继续由 App 提供，不在 Nook 新建 adapter。

这不是新增 Canvas API；这些字段已存在于 `Canvas.tsx:42-79`，只是当前 Nook `:564-583` 没有全量接线。`allowChalkDrag`、`assetUrl`、`onEntityAction` 的完整 action parity 仍需与 UX04/Nook owner 同批回写，本文不在此创造第二动作契约。

## 8. 错误、取消、重试与卸载保护

| 边界 | 处理 | 漏接后果 |
|---|---|---|
| 畸形/未知 `ShowFrame` | `performShowFrame` 返回 false；未知非空 component 仅开发诊断；不崩 WS | 一个坏帧吞掉后续 WS 或制造半截 DOM |
| target 不在当前 stage | no-op；不猜中心、不 fly、不播 target-specific 成功音 | 追光打到错误角色/旧 layer |
| 同 resource replacement | 旧 cleanup 先执行，新 show 再加入 active | 两个 dim 相乘、caption/ambient 重复 |
| layer/Nook stage switch | App transition 先 `cancelShow`，再卸载旧 Canvas；stable root 不携带旧 active list | 新 stage 遗留旧 beam/veil/thread/camera subscription |
| world freeze | `frozen` 变化 cleanup 全部 transient；不写 world | frozen 场景仍在播放 show、背景音 override 不归还 |
| hidden | cleanup active transient；新帧不演；重见不补播 | 后台 tab 继续 DOM/timer/音效，回前台重复高潮 |
| Effects off/reduced | 统一 dispatcher 门禁；事实反馈交给动作/Chrome；装饰不留 active DOM | renderer 各自读偏好，spotlight/fireworks/ink 口径不一致 |
| stable `liveCtx` effect race | owner guard 只允许当前 context cleanup；listener 只有 stable host 注册一次 | 旧 render cleanup 把新 Nook context 置 null，show 偶发丢失 |
| Nook 400/404/network | `role=alert`；不清 caller state/camera；重试沿同一 character id、seq 递增 | 错误角色覆盖旧 Nook，或重试写回已卸载 root |
| Nook 慢响应 A→B | `mountedRef` + `reqSeqRef` 仅接受最后 seq；NookView `key`隔离组件 | A 的 state/items/footprint 出现在 B |
| move/footprint continuation | unmount 后 `mountedRef=false`；scheduler dispose；observer disconnect；catch 不回写 state | Promise 完成后给新 stage setState/POST |
| camera wrong pop / double close | `CameraMemoryStack.popTransition(expectedCaller)` 返回 null 即不 restore；App handler 先做当前 projection guard | 两次 restore 让 layer/Nook 退多层或覆盖新 target |
| dialogue wrong frame | 继续由 App `characterId` router 丢弃并 visible notice；不由 Nook/Modal fallback | 角色台词串台，关闭后 frame queue 残留 |
| CharacterModal close | 保留 220ms closing、停止 voice/timer、clear queue、发送既有 `character_stop`，最后恢复 camera | overlay 提前消失、旧语音/台词在新 projection 继续 |
| `camera_focus` 缺 target/reduced | no-op，不改变 card geometry；dialogue close 仍按 stack restore | show 反向写 layout 或 reduced-motion 下强制位移 |

### 8.1 需要清理的具体资源

- `window` 的唯一 `airp:show-frame` listener；
- `liveCtx`（只清当前 owner）；
- `activeShow` 中的 timer、caption、veil、beam、lift、ink、SVG thread；
- `evidence_burst` 的 `camera.subscribe` unsubscribe；
- `lights_out` 的 ambient ref restore；
- `roll_ceremony` 的 admission token release；
- `useCamera` viewport ResizeObserver、world rAF、camera driver unregister（`useCamera.ts:105-118,120-158`）；
- Nook `reqSeqRef`/mounted guard、world/init listeners、footprint scheduler、ResizeObserver/font rAF；
- CharacterModal voice/timer/frame queue/closing transaction；
- `CameraMemoryStack` 的 caller frame：正常 pop，world switch `clear()`（`App.tsx:700-714`已有 clear 接缝）。

## 9. 与现状差异

1. `PerformanceLayer` 从 `App.tsx:1018-1027` 的 layer branch 移到 `.prototype-world` 的 layer/Nook sibling 稳定宿主；源码中只能有一个生产 `<PerformanceLayer>`。
2. Nook 获得 layer 同源的 show surface，但不是在 NookView 中新建 listener；`NookView.tsx:563-583` 只保留 Canvas 和 Nook 局部 surface。
3. show cleanup 从“layer/frozen/unmount”扩展为“projection switch/layer/frozen/hidden/effects off/reduced/unmount”全门禁；当前 `PerformanceLayer.tsx:556-567` 未覆盖 hidden/effects/reduced。
4. NookView 增加 `key={nookChar}` 和 NEW `hidden?: boolean` 宿主 prop；其 `state.layer` 仍来自响应，不能用 key 或 prop 代替数据。
5. CharacterModal 明确是 overlay-only；保留底层 active marker、增加/验证底层 `aria-hidden/inert`，不为 modal 新增 marker。
6. layer/Nook stage identity 变化时由 App/PerformanceLayer 统一 `cancelShow`；dialogue overlay 单独打开/关闭不自动制造第二 stage，也不复制 show state。
7. 现有 Nook Canvas 尚未传 `effectsEnabled/hidden/reducedMotion` 等已有 Canvas props；本设计要求补齐这些生命周期接线，但不重新设计动作结果。
8. 用户指定的 `apps/web/src/hooks/use-camera.ts` 与当前仓库不符；实现只能修改实际 `apps/web/src/state/useCamera.ts`/`apps/web/src/lib/camera.ts` 的对应符号，不能创建同义 hook 文件。

## 10. 验收测试（含修复前必须失败的非空断言）

> 本文只登记测试设计，不在设计阶段运行项目级 build/test/lint/check。所有 browser 测试必须真实挂载 App，不能只查源码 marker。

### 10.1 唯一 active stage 与 overlay-only dialogue

建议新增 `apps/web/test/nook-projection-lifecycle.browser.test.mjs`（NEW，测试名可在实现阶段冻结）：

1. layer fixture loaded：断言 `[data-airp-projection-active="true"]` 计数为 1，Canvas viewport 为 1，`.object[data-path]` 集合等于 layer items；
2. 点击 Nook：旧 layer Canvas 必须卸载，Nook root marker 计数仍为 1，Canvas 计数仍为 1，Nook `.object[data-path]` 只来自 Nook；App Nook wrapper 不得再出现第二 active marker；
3. 在 Nook 点角色：CharacterModal 有一个 `role=dialog[aria-modal=true]`，底层 Nook root `aria-hidden=true` 且 `inert=true`，active stage marker 仍恰为 1，Canvas 仍恰为 1；CharacterModal marker 计数必须为 0；
4. 关闭 dialogue：220ms closing 完成后 focus 回 caller，Nook root 恢复可访问/可交互，camera target 等于进入 dialogue 前 caller snapshot；
5. layer dialogue 与 Nook dialogue 各跑一遍，断言 `currentLayer`/Nook `state.layer` 未因 modal 改变。

若把 CharacterModal 错做 active projection，断言会观察到两个舞台语义或底层 marker 被错误移除；若只把底层 `aria-hidden` 留下而不加 inert，pointer/Tab 回放会落到底层 Canvas。

### 10.2 唯一 show listener、Nook show 和 replacement

1. 在 App mount 前记录 `window.addEventListener/removeEventListener` 的 `airp:show-frame` 次数；layer→Nook→layer 后，生产实例整个生命周期只注册一次并只注销一次。
2. layer active 注入一个长时 `spotlight(target)`，切到 Nook；切换完成后 `activeShow()` 必须为 `[]`，stable `.show-root` 可存在但不得有 `.show-dim/.show-beam/.show-caption`，Nook 新 frame 才能重新产生恰一组 DOM。
3. Nook active 注入合法 target `spotlight`、`ink_burst`、`evidence_burst`；每个 show 由同一个 `performShowFrame` 记录，`document.querySelectorAll('.show-root')===1`，没有 Nook 私有 listener 或第二 `activeShow` 数组。
4. 同 resource 连发两条 spotlight：`.show-dim` 和 active entry 各为 1；旧 caption/ambient/DOM 被 cleanup；异 resource 允许并行；duration 后 active 和临时 DOM 都为 0。
5. dialogue 打开时再次注入视觉 show：listener 仍只有一个，show 位于底层 stage、pointer-events 不可达，CharacterModal 仍只有一个 dialog；关闭 dialogue 后没有第二 Canvas。

### 10.3 修复前必失败：hidden 残留 show

用真实浏览器或可驱动的 PerformanceLayer harness：

1. mounted layer 上调用真实 `performShowFrame({ type:'show_frame', component:'spotlight', target:<existing path>, params:{}, durationMs:12000, actor:{type:'writer'} })`；
2. 立即把 App page visibility 设为 hidden（或把 `PerformanceLayer` 的 `hidden` prop 从 false 改为 true）；
3. **必须断言**：`activeShow().length === 0`、`.show-dim/.show-beam/.show-caption` 均为 0、任何 `camera.subscribe`/timer cleanup 已发生；重新 visible 不得增加 show/音效调用；
4. 记录基线：当前 `PerformanceLayer.tsx:540-554` 的 context effect 只更新 `liveCtx`，当前 `:556-567` 的 cleanup 只依赖 `layer/frozen`，因此修复前 active spotlight 会继续留在 `activeShow`/DOM 中；该断言应在修复前失败，证明测试不是假绿。

### 10.4 修复前/后 camera 与卸载保护

- `camera-memory-stack.test.mjs:19-65` 保留为纯 stack 断言；补 browser 回放 layer→Nook→dialogue→Nook→layer，检查 `getTarget()`（动画 settle 后再检查 `getCam()`）严格回到最初 caller target。
- 快速 Nook A→B：在 A 响应延迟时进入 B，第二次 GET 先返回；必须只看到 B marker/items/camera，A response 不得 setState、flush footprint 或创建 show。当前 `reqSeqRef` 已有静态依据 `NookView.tsx:212-250`，browser 断言补运行时闭环。
- Nook unmount 中途让 `/api/nook`、footprint、字体 Promise 完成：无 React warning、无旧 root POST、无旧 `.object`、无 active show；实现前必须用延迟 fixture 证明至少一个 continuation 会命中 stale guard。
- layer/Nook 切换期间监听 `document.querySelectorAll('.object[data-path]')` 与 Canvas 数量；任何 commit 都不得出现两个 Canvas 或重复 path。

### 10.5 非空性与回放记录

每条测试必须记录 viewport、world/layer/nook、active marker 集合、Canvas count、`.object` path 集合、camera target、`aria-hidden/inert`、WS/HTTP 时间线和玩家可见 error。不能只断 `console.warn` 或源码字符串。

## 11. 发现的冲突 / 需要修订的上位文档

### C1：CharacterModal 的 active marker 语义与 A05 不一致

- `docs/ux/05-Nook投影与相机连续性.md §4.1-§4.2` 将 `dialogue:<characterId>`列为逻辑 projection，并建议 dialogue 也持有 active marker；
- `docs/ux/15 §5` 明确 modal 是覆盖层，不能偷偷产生第二舞台真相；当前 `CharacterModal.tsx:780-790` 也只有 dialog marker，没有 projection marker；
- 本设计选择 overlay-only，保留底层 layer/Nook stage marker。

**需要主代理评审后回写：** `docs/ux/05` 将 dialogue 改为“focus overlay / 非 stage active projection”，`docs/ux/06` 明确底层 stage marker 保留且 `aria-hidden/inert`，`docs/ux/02` 的 dialogue Depth 表不得把 modal marker 当第二 stage。

### C2：A02/perform 要求 stable App host，当前 App 仍把 PerformanceLayer 放在 layer 分支

- `docs/perform/05-演出库.md §4.2、§6.3、§12.1` 要求 stable App 主区挂点；
- 当前 `App.tsx:1018-1027` 却把它放在 `{!nookChar}` 内；
- `docs/ux/02` 现状表已承认 Nook 无 PerformanceLayer（`§3.4`）。

**建议：** A02、perform/05、UX05 同批回写为“App `.prototype-world` sibling 稳定单实例”；Nook 不是第二 `PerformanceLayer`，而是共享实例的 active stage consumer。

### C3：show_frame 无 layer 字段，Nook active 时 targetless show 的归属未冻结

`ShowFrame` 的真实形状 `packages/shared/src/actions/show.ts:21-33` 没有 layer 字段；`useWorld.ts:772-775` 只逐帧派发。普通 target show 可通过唯一 DOM target 自然过滤，但 `lights_out` 等 targetless frame 在 Nook active 时无法从协议知道是否属于 Nook。

**不能静默新增 `layer` 字段。**需要 `docs/perform/00/05` 与 Nook owner 拍板：是否约定“WS 当前 active UI projection 即 show destination”，或以后由服务端协议增加受评审的来源字段。未拍板前，targetless show 只能遵循当前 active stage，不得声称跨层隔离已证明。

### C4：hidden/effects/reduced 现有 PerformanceLayer cleanup 不完整

`PerformanceLayer.tsx:540-554` 会更新 `liveCtx.hidden/effectsEnabled/still`，但 `:556-567` 的 cancel effect 只依赖 `layer/frozen`；A09 `docs/ux/07 §5.5` 要求统一门禁和清理。当前实现可留下 active show/DOM，见 §10.3 修复前失败断言。

**需要回写：** `docs/ux/02` 的 show lifecycle、`docs/ux/07` 的 PerformanceLayer 门禁、`docs/perform/05` 的 `liveCtx` 说明，明确 gate 变化的 cleanup 语义。

### C5：用户指定 camera 文件路径与仓库路径不一致

用户目标提到 `apps/web/src/hooks/use-camera.ts`，但当前仓库实际是 `apps/web/src/state/useCamera.ts`（App import `App.tsx:44-46`，hook 符号和实现 `useCamera.ts:101-204`）。

**需要回写：** 若上位文档仍写 `hooks/use-camera.ts`，改为 `state/useCamera.ts`；不要为兼容文档创建第二 hook 文件。

### C6：Nook 现有 Canvas 参数不足以证明演出偏好 parity

`NookView.tsx:564-583` 没有传 `effectsEnabled/hidden/reducedMotion`；`CanvasProps` 已在 `Canvas.tsx:42-79`声明这些已有 seam。`docs/ux/07` 的“所有 renderer 明确处理 hidden/Effects/reduced”不能由 layer 分支已传 props 推导 Nook 也安全。

**需要回写：** `docs/ux/05` 与 `docs/ux/07` 的 Nook 接线表，明确 Nook 使用同一 App preference/visibility inputs；`docs/ux/04` 的 action parity 仍由其 owner 处理，不在本文扩展。

## 12. 仍未知待拍板

1. ShowFrame 没有 layer 来源字段时，targetless show（尤其 `lights_out`）在 Nook active 下是否一律作用于当前 active stage；这是协议/perform owner 决策，不由前端猜。
2. Effects off/reduced 下 spotlight/lights_out 是否需要静态 focus/result adapter；在 static adapter 未冻结前，只能 cleanup/skip 装饰并保留动作/Chrome 事实。
3. `PerformanceLayer` stable root 的最终 DOM 顺序与 Depth token：本设计要求位于 stage sibling、低于 chrome/dialogue，但具体 `z` 由 A02/统一 checker 冻结。
4. CharacterModal overlay-only 的 marker 解释是否被产品接受；若要求 dialogue marker，必须先修改 A05/15 的 active projection 定义与所有 browser assertions。
5. `NookViewProps.hidden?: boolean` 是否由 App 显式传入，还是由 NookView 直接读取 visibility store；推荐显式宿主 prop，避免 Nook 自建全局 listener，但签名仍待评审冻结。
6. Nook `worldFrozen` 以 App `useWorld.state.worldFrozen` 为 show gate，还是以 `/api/nook` state 的 `worldFrozen` 作为 stage gate；推荐 App world authority，Nook response 只用于 Nook rendering，若两者不一致必须有可见 stale/error 诊断。
7. `openPrivateSpace` A→B 快速连点的 transition guard 是否采用内部 `transitionEpoch`；`CameraMemoryStack.popTransition` 已防错 caller，但当前 App 没有单独 token，需在实现前用 browser fixture 验证。
8. dialogue 期间的 `camera_focus` 是否允许移动底层相机；本设计允许其作为背景 show，但关闭时由 stack restore caller target。若产品不希望角色对话背景移动，应由 A02/perform 增加 show admission，而不是由 CharacterModal 私自吞帧。

## 13. 实施顺序与文档回写清单

### 13.1 实施顺序

1. **先冻结 marker 语义：** 评审确认 CharacterModal overlay-only、active marker 只属于 layer/Nook stage；同步更新 A02/A05/A06 的冲突文字。
2. **重排 App 挂点：** 将 `PerformanceLayer` 从 `App.tsx:1018-1027` 移到 `.prototype-world` 两分支之后；确认源码只有一份生产挂载。
3. **补 stable lifecycle：** 保留现有 `performShowFrame/activeShow/cancelShow`；增加 gate-change cleanup、liveCtx owner guard、projection switch cancel；不改 ShowFrame/WS。
4. **补 Nook 接线：** 给 NookView 加 `key` 和评审后的 `hidden` prop；Canvas 传既有 effects/hidden/reduced inputs；保持 `currentLayer={state.layer}` 与 root-scoped scheduler。
5. **收口 camera transition：** 以现有 `CameraMemoryStack`、`projectionTarget`、`callerProjectionRef` 为唯一 owner；补 rapid transition guard、重复 close 幂等和 stage switch cleanup；不要回到固定 `camera.save/restore('dialogue')`。
6. **浏览器回放：** 先跑 §10.3 hidden residual red test，再跑 layer/Nook/dialogue marker、Nook show、replacement、A→B stale、camera nested、unmount cleanup 矩阵。
7. **统一门禁与回归：** 只运行实现后直接相关的浏览器/聚焦测试和统一 UX/WS/docs 门禁；本设计阶段不运行项目级验证。

### 13.2 必须回写的文档

- `docs/ux/02-舞台Depth与演出归属.md`
  - 回写 stable App sibling `PerformanceLayer` 是 layer/Nook 共用 owner；
  - 回写 Nook 不新增 listener、show root 不成为 active marker；
  - 回写 CharacterModal overlay-only、底层 marker/inert/aria-hidden；
  - 回写 hidden/effects/reduced/projection cleanup 与 §10.3 red test；
  - 回写 ShowFrame 无 layer 字段的 targetless 归属未知项。
- `docs/ux/05-Nook投影与相机连续性.md`
  - 回写 Nook 进入/退出的 stable show owner、`key={nookChar}` 和 cancellation 顺序；
  - 回写 active marker owner：layer wrapper 或 NookView root 二选一，App Nook wrapper 不重复；
  - 将 dialogue 从“第二 stage active projection”改为 overlay-only focus（若评审采纳本设计）；
  - 回写 Nook hidden/effects/reduced 接线和 stable camera driver cleanup。
- `docs/ux/06-Agent演出状态与角色剧场.md`
  - 回写 CharacterModal overlay-only、底层 Canvas 保留但 `aria-hidden/inert`；
  - 回写 dialogue 期间 show 可作为背景消费但不改变角色帧路径；
  - 回写 dialogue→Nook 必须完成 modal closing、pop dialogue、push Nook，不能重叠两个 projection；
  - 回写 camera restore 与 `character_stop`/frame queue cleanup 的先后。
- 同时登记但不由本文静默修改：`docs/ux/15-下一批共同上下文.md` 的开放问题 2/3、`docs/perform/05-演出库.md` stable host/lifecycle、`docs/nook/02-前端视图与入口.md` 的 Nook action/lifecycle 接缝。任何字段、事件或协议变更必须先由主代理广播并回写所有受影响文档。
