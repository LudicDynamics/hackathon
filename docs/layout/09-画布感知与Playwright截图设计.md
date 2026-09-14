# 09｜画布感知与 Playwright 截图设计
> 状态：契约已冻结，允许进入实现（2026-09-15）。本篇只负责结构化画布读取、同画布真实浏览器截图、快照身份/一致性、浏览器 gate、auth/origin/资源/错误；跨篇字段和状态严格引用 06 §4.5，不拥有坐标写入、整理动作、Agent spawn、按钮或提示词。
> 共享契约唯一真源是 `docs/layout/06-画布重叠治理与整理Agent共同上下文.md`（下称 06）。本文只负责结构化画布读取、同画布真实浏览器截图、快照身份/一致性、浏览器 gate、auth/origin/资源/错误；不负责坐标写入、整理动作、Agent spawn、按钮或提示词。
>
> 本篇按最新 06：整理写入由受控 functional Actor/Scope 通过服务端统一碰撞求解或全层 AABB 校验；模型坐标不构成安全证明。截图是视觉 evidence，不是自动完成闸。`agent_activity.phase` 仍只有 `started | completed | failed`；本篇不扩展它。D 的 `accepted → processing → arranging → verifying → landed → completed/partial/failed/conflict/cancelled` 仍是本地请求状态，C 不代替 D 产生这些状态。并发/版本/无法证明最新时必须向 D/B/E 提供独立 `conflict`，不能压成 failed/cancelled。

## 1. 一句话定位

`view_canvas` 先返回来自同一页面集合和 `canvas.db` 的可核验结构化快照，再按需使用同一用户、同一 Canvas DOM、同一 layer 与可选局部世界矩形取得真实 PNG；任何无法证明 origin、权限、浏览器、ready 或快照身份的情况都显式失败，而截图永远只是视觉证据，整理完成只能依赖最新结构化 rows 的全层 AABB 复核。

## 2. 现状证据与缺口

| 现状 | 证据 | C 的缺口 |
|---|---|---|
| `viewCanvas` 读取 layer 页面、cards、links、presence，返回 `items/overlaps/unplaced/presence` | `packages/shared/src/actions/look-at.ts:399-490`；页面成员在 `:415-425` | `items` 仅含有 row 的卡；没有快照版本、DB revision、viewpoint，unplaced 没有结构化理由 |
| `items` 坐标和尺寸来自 `CardRecord` | `look-at.ts:231-234,459-485`；`packages/shared/src/store/local-store.ts:874-886,1846-1858` | 真实 `cards.width/height`、row 所属 layer、measured/stored 来源未显式输出，不能和 declared 尺寸混用 |
| 重叠使用严格 AABB；边界相切不算 | `packages/shared/src/render/spatial.ts:28-35`；`look-at.ts:462-468` | 需要稳定排序、完整 rows、全层 overlaps 与 snapshot identity |
| store 能返回完整 LinkRecord | `local-store.ts:1305-1312`；`packages/shared/src/schemas/canvas.ts:64-75` | 当前 action 只返回 from/to/style/label（`look-at.ts:440-455`），丢失 id/layer/color/directed/z |
| presence 是角色中心点，不是卡片左上角 | `packages/shared/src/store/world-store.ts:71-82,214-217` | 要明确点语义、updatedAt，且不拿零尺寸 presence 参与 card overlaps |
| viewpoint 已有 TTL 读口，过期/缺表返回 null；公开 `focus` 只有中心点 | `world-store.ts:84-96,219-233`；`local-store.ts:1708-1759` | 不能由 focus 中心伪造 viewportRect；截图区域必须由输入决定 |
| `/api/layer` 会在读中 seat/reseat | `apps/server/src/routes/world.ts:786-877` | 普通 layer GET 不能直接作为截图页数据源；需 read-only perception 分支，unplaced 时拒绝截图 |
| footprint/viewpoint/位置与 WS 都有前端副作用 | `apps/server/src/routes/world.ts:1115-1150`；`apps/web/src/state/useWorld.ts:403-440`；`apps/web/src/hooks/useViewpointReport.ts:45-109` | perception 页必须跳过这些写入、WS 与动作 |
| image mode 当前明确 unsupported | `packages/shared/src/actions/look-at.ts:399-408`；`extensions/toolkit/look-at.ts:67-121` | 尚无 Playwright、ready、gate、origin/auth 或真实 PNG |
| server 没有 Playwright 依赖，静态页与 API 同进程 | `apps/server/package.json:10-20`；`apps/server/src/index.ts:162-170` | 需要部署依赖、server-side browser 生命周期和清理 |
| 当前 CORS 宽松、无 auth 中间件、监听 0.0.0.0 | `apps/server/src/index.ts:49-54,339-343` | 不能假定 owner cookie；截图 route 要 loopback/已有 principal gate，auth 缺失 fail-closed |
| Canvas 实际 DOM 路径为 Canvas/CanvasObject/LinkLayer/PresenceLayer | `apps/web/src/components/canvas/Canvas.tsx:569-621`；`CanvasObject.tsx:262-298` | 截图必须走这条路径，不得 server 重写 renderer；字体和实际高度要等 `whenFontsSettled`（`Canvas.tsx:202-231`） |
| Nodesign 已有同页、owner、ready、串行 gate、显式失败和 finally close | `../Nodesign/server/engine/mcp/tools/look-at-board.js:8-18,31-43,90-121`；read-board `:58-69,88-123,134-180` | 可借鉴机制，禁止照搬其 artifact/tag/lane/HTML deck；Nodesign 的先读/截图是流程纪律，不是 AIRP 完成闸 |

## 3. C 的边界与硬不变量

1. 世界文件、`canvas.db` 是真相；C 不产生第二份坐标、尺寸、links、presence、viewpoint。
2. `view_canvas` 只读：不得调用 `placeCard`、`placeCards`、`saveCardPosition`、`arrangeCards`、`writeFootprints`、`writeViewpoint`，不得发事件、`canvas_patched`、WS 或启动 Agent。
3. 浏览器只读。必须使用 AIRP 的 Canvas DOM/CSS；不能截图 API JSON，也不能在 server 重写 renderer。
4. perception 页使用同一 Canvas 组件树，但关闭 viewpoint、footprint、WS、拖拽和动作入口；若无法只读，失败，不截可能已经改过世界的页面。
5. row 的 `w/h` 是服务端当前真实 footprint；DOM 高度是视觉 evidence。截图服务不能以局部 DOM、图像观感代替最新 rows 的全层 AABB。
6. 完成结论顺序固定：服务端统一碰撞求解/原子写入 → 重新读最新结构化 snapshot → 全 layer rows AABB overlaps 为空及其它 A/E 条件。模型给的 x/y 不构成安全证明。
7. 版本变化/无法证明最新时输出机器可识别 `conflict`，不得降为 failed/cancelled；这不是新的 `agent_activity.phase`，而是 perception/整理请求的本地结果语义。

## 4. 结构化 snapshot

### 4.1 输入

当前类型（`packages/shared/src/actions/look-at.ts:73-85`）为：

```ts
export interface ViewCanvasInput {
  layer?: string;
  mode?: 'auto' | 'image';
  viewport?: { width: number; height: number };
}
```

建议扩展为以下 **NEW** 形状：

```ts
export interface CanvasWorldRect { // NEW
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ViewCanvasInput { // NEW, after review replaces current shape
  layer?: string;
  mode?: 'auto' | 'image';
  viewport?: { width: number; height: number };
  region?: CanvasWorldRect; // image only; explicit world rectangle
  around?: string;          // image only; placed row path
  margin?: number;          // image only; default 160 world px
}
```

规则：`layer` 是 `map`/`world/<dir>` layer id，不是 `map/` 路径；省略沿用 `readViewpoint()?.layer || 'map'`（`look-at.ts:250-257`）。`region` 与 `around` 互斥，region `x/y/w/h` 必须 finite 且 `w/h >= 50`；around 必须是本次已 placed path。非法输入用现有 `invalid_argument`，英文：`region must contain finite x, y, w, h with w/h >= 50.`、`Provide either region or around, not both.`。around unplaced 用 `not_found`：`Cannot frame "<path>": the item has no canvas row in the current snapshot.`。viewport 沿用 `clampViewport` 的 `[320,2560] × [240,1600]`（`look-at.ts:365-373`），clamp 不是失败。

### 4.2 身份/版本

```ts
export const CANVAS_SNAPSHOT_VERSION = 'canvas-snapshot-v1'; // NEW

export interface CanvasSnapshotIdentity { // NEW
  version: typeof CANVAS_SNAPSHOT_VERSION;
  snapshotId: string;       // opaque sha256 binding rows + source digests
  canvasRevision: string;   // digest of current canvas.db values, opaque sha256
  canvasVersion: number;    // monotonic per-layer canvas.db position version
  capturedAt: string;       // ISO; not part of either hash
}
```

- `canvasRevision` 是 canonical JSON 的 SHA-256：当前页面 rows 的 `id/layer/x/y/w/h/z` 与 footprint source、当前 layer 完整 links 的所有公开字段、presence 的 `characterId/layer/x/y/following`、`readViewpoint()` 完整公开值或 null。rows 按 id ASCII，links 按 z/id，presence 按 characterId；不能使用 SQLite 返回顺序、mtime、Promise 完成顺序、COUNT/SUM 代替。
- `snapshotId` 是 `{version, worldId, layer, canvasVersion, page-membership, canvasRevision, sourceDigests}` 的 SHA-256。sourceDigests 至少包含每个页面 path、kind、README/stub 门牌身份和 Markdown 内容 digest；否则正文/frontmatter 改变而 DB 不变时，不能证明同一个渲染输入。[推断] 可 hash 原始 file bytes，不把正文放进返回值。
- hash 不是单调序号；`capturedAt` 不进入 hash。同一状态不同时间可有相同 snapshotId。worldRoot、绝对路径、cookie、token、数据库文件名不进入可解码 identity。
- hash 仅识别读窗口；它不宣布 layout 完成。完成必须重新读最新 snapshot 并全层断言。

### 4.3 输出形状

```ts
export interface CanvasSnapshotRow { // NEW
  path: string;
  layer: string;                 // cards.layer
  kind: string;                  // same resolver as /api/layer
  x: number;
  y: number;
  w: number;                     // cards.width, real stored footprint
  h: number;                     // cards.height, real stored footprint
  z: number;
  footprintSource: 'measured' | 'stored';
}

export interface CanvasUnplacedRow { // NEW
  path: string;
  kind: string;
  sizeSource: 'declared' | 'unknown';
  declared?: { w: number; h: number }; // never actual footprint
}

export interface CanvasSnapshotLink { // NEW
  id: string;
  layer: string;
  from: string;
  to: string;
  style: string;
  color: string | null;
  directed: boolean;
  z: number;
  label: string | null;
}

export interface CanvasSnapshotPresence { // NEW
  characterId: string;
  layer: string;
  x: number; // avatar centre, not top-left
  y: number;
  following: boolean;
  updatedAt: string;
}

export interface CanvasSnapshotViewpoint { // NEW
  layer: string;
  focus: { x: number; y: number } | null;
  selected: string[];
  bagCount: number;
  at: string;
}

export interface CanvasSnapshot { // NEW
  identity: CanvasSnapshotIdentity;
  layer: { id: string; dir: string; name: string; stub: boolean };
  rows: CanvasSnapshotRow[];
  overlaps: Array<[string, string]>;
  unplaced: CanvasUnplacedRow[];
  links: CanvasSnapshotLink[];
  presence: CanvasSnapshotPresence[];
  viewpoint: CanvasSnapshotViewpoint | null;
}
```

口径：

- rows 是页面现有 `cards` rows，包含直接子层 README 门牌，不把本层 README 重复为卡。页面 membership 必须复用 `cardsOfLayer`/`childLayers`（`packages/shared/src/store/layers.ts:19-22,98-127`），与 `/api/layer` 同源。
- `w/h` 永远来自 `CardRecord.w/h`（`local-store.ts:874-886,1846-1858`），不是 CARD_FORMS declared 高；`measuredAt` 非空才标 measured，否则 stored，二者都是当前真实 row。
- rowless 不补 `(960,540)`、不进 overlaps；declared 尺寸只能作为 `declared` 诊断。unplaced 明确 path/kind/sizeSource。
- overlaps 用 `boxesOverlap` 严格 AABB（`spatial.ts:28-35`），边界相切不算；输出所有 path 对，稳定排序。presence 点和 link 线不参加 card overlaps。
- links 保留完整 LinkRecord 字段，仅当前层 `WHERE layer = ?`；端点 unplaced 的 dangling link 仍返回，不静默删。
- presence 原样返回当前层点；updatedAt 是新鲜度证据，不把 avatar box 偷加到 card overlaps。
- viewpoint 走既有 TTL/null；公开 focus 只有中心点，不能伪造 viewportRect。viewpoint.layer 可和请求 layer 不同，原样返回。

唯一读口：

```ts
export async function readCanvasSnapshot( // NEW
  store: WorldStore,
  input: { layer?: string },
  opts?: { now?: number; includeSourceDigests?: boolean },
): Promise<CanvasSnapshot>;
```

它由 `viewCanvas`、server perception route、测试共用；不 seat/reseat、不写 viewpoint、不发事件。image 始终 include source digests；否则不能声称 snapshot 证明了渲染内容。

### 4.4 摘要与结果

建议 `ViewCanvasDetails` clean-cutover 为 `CanvasSnapshot`，不同时保留同义 `items`/`rows` 两份真相；迁移 `extensions/toolkit/look-at.ts`、B/F/E 与 tests。summary text 英文首行稳定为：

```text
Canvas snapshot canvas-snapshot-v1 <snapshotId> on layer <layer>. Rows: <n>; overlaps: <n>; unplaced: <n>; links: <n>; presence: <n>.
```

`capturedAt` 不当版本；不把 unplaced/overlaps 省略成假 none。读操作无 event、无 history/canvas 写入，遵守 `ActionResult`（`packages/shared/src/actions/types.ts:30-38`）。

## 5. 真实 Playwright 截图契约

### 5.1 两层所有权和 transport

shared `ActionContext` 是 transport-free 且没有 AbortSignal（`packages/shared/src/actions/types.ts:8-26`），故：

1. shared action 只做 `readCanvasSnapshot` 与 summary。
2. `extensions/toolkit/look-at.ts` image 分支先取 summary snapshot，再向 server 内部 HTTP perception route 请求 Playwright；工具层校验返回的 final snapshot identity。

```ts
export interface CanvasScreenshotRequest { // NEW; exact shape from 06 §4.5
  worldId: string; // opaque manifest id; never absolute root
  layer: string;
  snapshotId: string;
  captureCapability: string; // short-lived server-issued opaque capability
  viewport: { width: number; height: number };
  region?: CanvasWorldRect;
}

export interface CanvasScreenshotResponse { // NEW success branch
  ok: true;
  identity: CanvasSnapshotIdentity;
  image: { data: string; mimeType: 'image/png'; width: number; height: number };
  region: CanvasWorldRect | null;
  renderedGeometry: Array<{ path: string; x: number; y: number; w: number; h: number }>;
  geometryEvidence: 'read' | 'mismatch' | 'unavailable'; // visual only
}

export interface CanvasScreenshotConflict { // NEW conflict branch
  ok: false;
  code: 'conflict';
  error: 'canvas screenshot conflicted: the canvas changed while the screenshot was being captured.';
  requested: CanvasSnapshotIdentity;
  observed: CanvasSnapshotIdentity;
}
```

`POST /api/canvas/screenshot` is the sole screenshot transport. The request accepts only active opaque `worldId`, `layer`, `snapshotId`, `captureCapability`, `viewport` and optional `region`; the capability is issued by the server for the current operation and bound to world/layer/turn with a short expiry. The route enforces same-origin/loopback, current principal or capability, ready signal, serial browser gate, and bounded timeout/rate/size. It never accepts worldRoot, SQLite path, browser URL, executablePath or proxy, and never lets a child guess the active world. PNG base64 is in-memory only and does not create a second state source.

工具结果需要：

```ts
export function okWithImage<TDetails>( // NEW
  result: { text: string; details: TDetails },
  image: { data: string; mimeType: 'image/png' },
): AgentToolResult<TDetails>;
```

模型无 image input 时 fail-closed：`screenshot_canvas is unavailable: the active model does not accept image content.` capability 由 server 为本次 operation 签发，不能由 child 或模型猜测/伪造，不能静默返回“已看图”。

### 5.2 origin、auth、world 与 exposure

当前 AIRP 没 auth middleware，静态前端由同一 Express 服务（`index.ts:49-54,162-170`），但不得把这一事实伪装成用户身份验证：

1. **origin gate**: NEW `AIRP_WEB_ORIGIN` is a complete http/https origin without path/query/userinfo. Local self-hosted dist may use `http://127.0.0.1:<PORT>`. Missing/invalid returns `screenshot_canvas unavailable: the canvas web origin is not configured.`; reject file://, arbitrary Host and guessed localhost.
2. **same-origin**: navigate only to `${origin}/?airpPerception=1&layer=...` with encoded parameters. HTTP >=400 is an explicit failure, never an error-page screenshot.
3. **auth/capability**: if auth exists, use the current request user's valid session or server-issued short-lived `captureCapability` bound to operation/world/layer/turn. Never mint by owner id, read log cookies, or treat owner as current user. Missing/expired capability or identity returns `screenshot_canvas unavailable: the current user's canvas identity is unavailable.`。
4. **exposure**: current listener/CORS defaults are not authentication; route still requires loopback or same-origin plus valid principal/capability, and limits viewport/region/body/concurrency/frequency。
5. **world**: validate active store manifest id; world switch or store close immediately invalidates capability/capture; never cross stores by worldRoot.

### 5.3 gate、lifecycle、ready

```ts
export interface CanvasBrowserGateOptions { // NEW
  signal?: AbortSignal;
  timeoutMs: number;
}

export async function withCanvasBrowserGate<T>( // NEW
  task: (browser: import('playwright').Browser, signal: AbortSignal) => Promise<T>,
  opts: CanvasBrowserGateOptions,
): Promise<T>;
```

1. screenshot_canvas 首次请求 dynamic import Playwright/lazy launch Chromium；缺 browser/dependency 直接：`screenshot_canvas unavailable: Playwright/Chromium is not available.`，不回退摘要。固定 headless 参数/deviceScaleFactor=1，不接受用户 launch args/proxy/executablePath。
2. server 进程级串行 gate，一次一个 context/page，借鉴 Nodesign gate（`look-at-board.js:31-36`）；排队 deadline，未开始即 abort：`screenshot_canvas cancelled before capture started.`。
3. 每次新 BrowserContext/Page，不复用 cookie/localStorage/IndexedDB；finally close page/context，browser 空闲 TTL/world switch close。异常不可令 gate 永久卡住。
4. URL 带 `airpPerception=1`、layer、snapshotId、region；仍渲染同一 Canvas，不写第二 renderer。
5. 等 `html[data-airp-canvas-ready="1"]`，默认 25s；超时：`screenshot_canvas failed: the canvas did not become ready within 25s.`。ready 不是 React mount：必须 layer 相同、snapshot 落 state、对象集合完成、字体 settled、region camera settled、至少一帧 rAF。
6. ready evaluate 检查 layer/snapshot dataset、无 canvas error、path 集合与 snapshot rows 对齐，读取 DOM geometry。缺 ready/identity 返回失败，不能截 loading/error 页。
7. `page.locator('[data-airp-canvas-surface]').screenshot({type:'png'})` 截真实 Canvas surface；不截 API JSON。PNG 目标尺寸等于请求 viewport、deviceScaleFactor=1。
8. capture 后 server 再读 snapshot；identity 变化最多重拍一次。仍变化返回 HTTP 409 / `code:'conflict'` / `CanvasScreenshotConflict`，把 `conflict` 交给 B/D/E；不得转换成 failed/cancelled。此检查只证明图与某个稳定读窗口对应，不判断整理完成。

### 5.4 read-only perception 前端

```ts
export interface UseWorldOptions { // NEW
  perception?: boolean;
}

export function useWorld(options?: UseWorldOptions): UseWorldApi; // NEW
```

`App.tsx` 检测 `airpPerception=1` 并传 `perception:true`：

- fetch `/api/layer?layer=...&readOnly=1`；server 该分支禁止 `seatUnplaced/reseatLayer/writeFootprints` 和一切 action，只读已有 rows。unplaced 则 route 显式拒绝，不截 fallback anchor。
- 不建立 `/ws`、不消费 activity/phantom/`canvas_patched`，跳过 `useWorld.ts:478-788` 的普通 WS effect。
- 跳过 footprint POST（`useWorld.ts:403-440`），禁 move/choice/drag/drop/init；字体/DOM 测量只读。
- `useViewpointReport(... enabled:false)`；当前 hook 会 POST `/api/viewpoint`（`useViewpointReport.ts:45-109`），perception 不得改变玩家 viewpoint。
- Canvas、CanvasObject、LinkLayer、PresenceLayer、CSS 全部沿用；只增加 `data-airp-canvas-surface`、ready/error/layer/snapshot dataset。任何临时 staging 只能 DOM/React 内存投影，不能写 DB、进入 snapshot 或影响 AABB。

### 5.5 区域和 geometry evidence

- 全层无 region：沿用 `Canvas.tsx:202-231` 的真实 object bounds framing。
- region：相机到 world rect 中心/尺寸；不在 browser script 实现 flow/避让坐标算法。
- around：server 用 snapshot row 实际 x/y/w/h + margin 计算；unplaced 不可 around。
- evaluate 可读 `.object[data-path]` 的 offset/scroll geometry，返回 renderedGeometry 和 `geometryEvidence`，仅视觉证据。DOM mismatch 可以返回 PNG + `geometryEvidence:'mismatch'`，文本：`The screenshot is visual evidence; stored row geometry still needs verification.`；B/E 必须回到最新 rows 全层 AABB。
- geometry 不可读、ready/identity 不可证明则失败；不因局部 screenshot 观感宣称无 overlap/completed。presence 仍是点，links 仍由 LinkLayer 真实渲染且结构化 links 是唯一关系真相。

## 6. 行为步骤及漏项后果

### 6.1 auto

1. 规范 layer/path 并解析默认层。漏掉会让 `map/`、`../` 走错 membership。
2. 唯一 `readCanvasSnapshot` 在同一读边界确定 membership/rows/links/presence/viewpoint/hash。漏掉会把跨写入窗口拼成不存在状态。
3. 用真实 row x/y/w/h/z 计算全层 overlaps；rowless 进 unplaced，不补坐标。漏掉会把长 Chalk/未落座误报干净。
4. 返回英文摘要 +完整 snapshot，无文件/DB/history/WS 写入。漏掉会让 Agent 无法区分读与整理成功。

### 6.2 image

1. 先 summary 得到 snapshot identity，再校验 image 参数/capability；否则无法绑定读窗口或模型看不见图。
2. 内部 HTTP 请求携带 worldId/layer/snapshotId/viewport/region，route 校验 active world/origin/auth；否则会跨 world/SSRF。
3. 串行 gate 打开同源 read-only 页面，等 ready/layer/snapshot/geometry；否则截 loading/旧层/未 settle 字体。
4. 截 Canvas surface、读取 evidence、finally close；否则浏览器/cookie 泄漏或 gate 卡死。
5. after snapshot 变化：一次重试仍变则返回独立 conflict（HTTP 409/details conflict），不是 failed/cancelled；否则返回 image + identity。
6. B 写入后必须重新 snapshot；E/复核器对全层 rows 做 AABB。截图仅辅助读图，不能完成安排。

## 7. 输入输出副作用、资源边界

| 项 | 成功 | 不发生 |
|---|---|---|
| summary | rows/overlaps/unplaced/full links/presence/viewpoint + hash | 不 seat/reseat/footprint/viewpoint/history/WS |
| image | 同 origin Canvas DOM PNG + identity + geometryEvidence | 不写 eye 文件、canvas.db、事件、Agent、WriterResult/TTS |
| route | active store read、Playwright in-memory capture | 不收 worldRoot/executablePath/proxy/script，不导航外网/file |
| perception browser | 同 Canvas/CSS，副作用关闭 | 不连 WS、不 POST footprint/viewpoint、不动作 |
| completion | 最新 snapshot 全层 AABB | C 的 screenshot/局部 DOM 不得宣布 completed |

建议上限：viewport `[320,2560]×[240,1600]`，PNG 字节上限、单 capture 30s（ready 25s）、gate queue cap、频率限制；超限 invalid_argument/unsupported，不截低清替代图。Playwright/Chromium 是部署 prerequisite，当前依赖缺失（`apps/server/package.json:10-20`）。

## 8. 并发、幂等、取消、失败

### 8.1 并发与 conflict

- snapshot 读取不是无界拼接：reader 在 DB `canvasVersion` 与 content/source digest 前后各取一次 fence；任一变化返回 HTTP 409/details `conflict`，不得用 hash 掩盖 torn snapshot。浏览器 gate 串行不替代这一 fence。
- conflict 不发 Activity frame、不扩 `phase`，D 才把它显示为独立本地 conflict 终态。C 不决定 landed/completed。

### 8.2 幂等与取消

- 同一 `{worldId,layer,snapshotId,viewport,region}` 可重复截图；默认不落盘/不缓存。若缓存，key 必须含完整 identity/viewport/region/policy，TTL 不跨 world/user。
- tool AbortSignal 传 route；req close 中止未开始/未完成 capture；已捕获但 client 断开丢弃并 finally close，不写 world。
- cancel 不是 conflict；取消不发 functional activity、不改变 canvas。异常浏览器 error 才是 failed；conflict 必须保留 conflict。

### 8.3 英文错误文案

| 条件 | code/status | message |
|---|---|---|
| layer 不存在 | not_found/404 | `No layer "<layer>" in this world` |
| 参数非法 | invalid_argument/400 | `region must contain finite x, y, w, h with w/h >= 50.` / `Provide either region or around, not both.` |
| around 无 row | not_found/404 | `Cannot frame "<path>": the item has no canvas row in the current snapshot.` |
| origin 缺失 | unsupported/501 | `screenshot_canvas unavailable: the canvas web origin is not configured.` |
| browser 缺失 | unsupported/501 | `screenshot_canvas unavailable: Playwright/Chromium is not available.` |
| auth 缺失 | unsupported/501 | `screenshot_canvas unavailable: the current user's canvas identity is unavailable.` |
| model 不收 image | unsupported/501 | `screenshot_canvas unavailable: the active model does not accept image content.` |
| page HTTP error | internal/500 | `screenshot_canvas failed: the canvas page returned HTTP <status>.` |
| ready timeout | internal/500 | `screenshot_canvas failed: the canvas did not become ready within 25s.` |
| unplaced | internal/500 | `screenshot_canvas failed: the current layer has unplaced items; seat them before requesting a screenshot.` |
| unexpected browser | internal/500 | `screenshot_canvas failed: <safe error summary>.` |
| snapshot changed | **conflict/409** | `screenshot_canvas conflicted: the canvas changed while the screenshot was being captured.` |
| queue cancellation | cancelled/transport-specific | `screenshot_canvas cancelled before capture started.` |

`conflict` is the canonical machine outcome from 06 §4.5. Screenshot failures never return a summary fallback and never claim layout completion.

### 8.4 安全

path/layer/region 走既有 gate 与 clamp，不拼 shell；Playwright 是唯一浏览器控制面。context 不共享 cookie/localStorage/IndexedDB；错误不泄漏 token/base64/worldRoot。route 只访问 active world 的静态 app 与 read-only layer endpoint。局部 region 不过滤结构化 rows/overlaps，输出明确是视觉 crop。presence/path/label 遵守现有 world-relative 和内容截断纪律。

## 9. 精确代码落点与跨篇契约

| 落点 | C 责任 | 非 C |
|---|---|---|
| `packages/shared/src/render/canvas-snapshot.ts`（NEW） | CanvasSnapshot 类型、canonical sort/hash、`readCanvasSnapshot(store,input,opts)` | 不写 store/flow/arrange |
| `packages/shared/src/actions/look-at.ts:73-104,399-490` | Input/Details、summary 调唯一 snapshot | 不调 HTTP/Playwright、不写坐标 |
| `packages/shared/src/render/layer-page.ts:259-319` | 如保留 text，消费 snapshot，不二次读 DB | 不造 page membership |
| `extensions/toolkit/look-at.ts:67-121` | image schema、summary→HTTP、AbortSignal、identity/conflict、image result | 不 spawn Agent/arrange |
| `extensions/toolkit/result.ts:13-15` | NEW `okWithImage<TDetails>(...)` | 不改变 fail 语义 |
| `apps/server/src/routes/canvas-perception.ts`（NEW）或 `routes/world.ts` | `POST /api/canvas/screenshot`、origin/auth/world gate、before/after/conflict | 不写 canvas.db/WS |
| `apps/server/src/index.ts:135-170` | 挂载 route/local exposure 审计 | 不增 WS |
| `apps/server/src/engine/canvas-browser.ts`（NEW） | NEW `withCanvasBrowserGate<T>(...)`、launch/close/ready/capture | 不造 renderer |
| `apps/server/src/routes/world.ts:786-982` | `readOnly=1` projection；普通 `/layer` 仍 A 权威 | 不负责自动布局 |
| `apps/web/src/state/useWorld.ts:29-45,207-233,403-476,478-788` | perception option、snapshot metadata、跳过 WS/footprint/write | 不实现整理算法 |
| `apps/web/src/hooks/useViewpointReport.ts:45-109` | perception 禁用 report | 不改 viewpoint 真相 |
| `apps/web/src/App.tsx:238-271,610-612,858-972` | query perception、option、surface/ready dataset | 不做 lifecycle/button |
| `apps/web/src/components/canvas/Canvas.tsx:569-621` | surface dataset、同 Canvas/CSS | 不写坐标 |
| `CanvasObject.tsx:262-298` | 保持 `.object[data-path]` geometry 可读 | 不第二状态 |
| `apps/server/package.json:10-20` / lock | 固定 Playwright/browser prerequisite | 当前不安装/运行 |

跨篇：A 负责写入与几何治理；B 消费 snapshot/image，负责受控 functional Actor/Scope、事务/取消/结果；D 负责本地请求阶段和独立 conflict 展示；E 负责真实 PNG/DOM 与最新 snapshot 全层 AABB 验收；F 负责 read→screenshot→arrange→verify prompt 顺序。C 不重定义它们。

## 10. 验收用例

本节必须至少有一条修复前必失败非空性，不运行项目级命令。

### 10.1 结构化 snapshot 非空性（修复前必失败）

fixture 同层放置：`a.md` row `(0,0,280,200,z=1)`、`b.md` row `(100,100,280,180,z=2)`（真实 overlap）；页面文件 `c.md` 无 row；完整 link（id/color/directed/z/label）；presence center；viewpoint focus 与请求 layer 不同。调用 `view_canvas({layer:'map',mode:'auto'})`，断言：identity version/hash 非空且不含 worldRoot；rows 正确含两条真实 layer/w/h/z；overlaps 非空含 `[a.md,b.md]`；unplaced 含 c 且无假坐标；links 全字段、presence x/y、viewpoint 都存在；调用前后 DB/history 行数不变。

**修复前必失败原因：**当前 action 只有 items、字符串 unplaced、裁剪 links，没有 identity/viewpoint/full rows；不是只测空数组的假绿。

### 10.2 identity 与全层几何

- 改 row h：canvasRevision/snapshotId 都变化且 overlaps 重算；只变 capturedAt：hash 不变。
- 交换 SQL 返回顺序：数组/identity 不变。
- 改 Markdown kind/body 不改 row：canvasRevision 不变、snapshotId 变化。
- viewpoint 过 TTL：viewpoint null，不被 read 刷新。
- B/A 写入后设置远离 screenshot region 的重叠 rows：E 重新读最新 snapshot，必须仍发现全层 overlap；证明局部视觉不等于完成。

### 10.3 真实 Playwright E2E 非空性（修复前必红）

真实 server + provisioned Chromium + auth fixture：请求 summary snapshotId 后 `POST /api/canvas/screenshot` viewport 800×600；断言 image.data 非空、PNG mime/尺寸正确、identity 相同、renderedGeometry 非空且含 fixture path、PNG/DOM 确实含 `.object[data-path="a.md"]`、LinkLayer、PresenceLayer，而非 JSON error page。ready 前改 row/footprint，断言 HTTP 409、`code:'conflict'`、details outcome conflict、英文 conflicted message，且不能返回 image；冲突不能被记录成 failed/cancelled Activity。错误 origin、缺 ready、缺 browser、缺 auth、unplaced 各返回明确英文错误，不返回 summary success。

**修复前必红原因：**当前无 Playwright、image 固定 unsupported、无 ready dataset、无 route；非空 PNG/真实 DOM/409 conflict 都会失败。

### 10.4 只读与 gate

- perception 页加载两次，cards/footprint/viewpoint/history/WS 写计数不变；普通 `/api/layer` 仍保留 A 的 seat/reseat。
- worldRoot/file URL/外网 origin/远端未认证请求拒绝且不泄漏绝对路径/token。
- 两并发 capture 串行；第三个 abort 后 gate 仍服务下一个，page/context/browser 无残留。
- DOM geometry mismatch 可带 PNG + `geometryEvidence:'mismatch'`，但 E 的最新全层 AABB 仍是唯一完成断言；C 不自动把 mismatch 变 failed 或 completed。

## 11. 冲突、上位文档回写、未知

### 11.1 需回写/评审

1. `docs/tools/03-look-at与画布感知.md:90-120,641-781` 仍把 image 当 B1 unsupported、建议 `.airpworld/eye/<hash>.png`；本篇改为 server Playwright + 默认内存 PNG，需回写工具/action 结果契约。
2. 当前 `ViewCanvasDetails.items` 与本篇 `CanvasSnapshot.rows` 不能并存两份真相；建议 rows clean cutover，同批迁移 toolkit/B/F/E/tests，不能隐式 alias。
3. `/api/layer` 当前 seat/reseat（`world.ts:821-877`）与 Playwright read-only 冲突；需 readOnly projection，普通 `/layer` 仍 A 唯一自动排座接缝。
4. `ViewpointRecord` 只有 focus 中心，无 viewport width/height（`world-store.ts:84-96`）；本文不猜 rect，需另开 viewpoint schema 才能升级。
5. 当前无 AIRP auth（`index.ts:49-54`）；local fallback 不 mint owner，auth 部署需 current-principal/capture credential 方案。
6. `ActionErrorCode` 无 conflict；本篇 HTTP/details 先冻结独立 conflict，若扩 enum 必须集合双向同步。
7. 06 §4.2 functional Actor/Scope 是 B 的受控权限边界，C 只读不选择 engine；截图 route 不等于 functional write authorization。
8. 06 §4.3/4.4/最新 §4.1 明确截图是视觉流程证据、写入由服务端碰撞求解/全层 AABB；禁止把 `geometryEvidence:'read'` 映射为 landed/completed，禁止把 conflict 压成 failed/cancelled。

### 11.2 未知待拍板

1. Playwright 依赖放 apps/server 还是外部 service；Chromium 固定版本、sandbox、healthcheck。
2. `AIRP_WEB_ORIGIN` 正式命名与 hosted proxy 信任规则；不信任任意 Host。
3. auth principal 如何安全传到 BrowserContext；禁止 owner-id 临时 mint。
4. model image capability 的真实读取 API；当前 ExtensionContext 未提供字段。
5. PNG base64 上限、缓存与 browser idle TTL；本文默认不落盘/不缓存。
6. ready dataset 的正式名称；前端/server/E 必须逐字一致。
7. DOM geometry 容差与视频/字体 decode gate；networkidle 不能单独代替。
8. full-layer framing 是否沿用 Canvas effect；region 只做 camera crop，不重造 camera/flow。
9. source digest 成本；若不 hash Markdown，必须降级并明说只证明 canvas.db。
10. 若采用 staging，只能是不可持久化 DOM/React 草稿，不进 snapshot/DB/AABB，本文不冻结 staging 字段。

## 12. 交付边界

本文交付结构化读口、身份/版本、真实 Playwright 读取、ready/gate/auth/origin/资源/错误/清理、独立 conflict 语义与非空验收；不创建坐标写入 API，不实现整理动作，不 spawn Agent，不扩 Activity phase，不增加第二 WS。截图是视觉 evidence；服务端以最新结构化 rows 的全层 AABB 断言整理完成，截图不自授完成。
