# Photo 前端详细设计

## 一句话定位

Photo 是一张可聚焦的“照片纸片”：卡面只画一张尽可能大的图片并在下方显示作者写入的 `preview`，点击或按 Enter 打开二层对话框；对话框显示同一张大图、`caption` 与独立 Markdown `body`，不改变既有 kind、外观、座位、互动、搬运或 WS 契约。

本设计只覆盖前端呈现闭环。路径身份、`component: photo` 输入、`body` 的独立语义、唯一 WS、`assetUrl`、layer/nook/backpack 范围均引用 `00-共同上下文.md`，不在本文件另立一套协议。

## 输入、输出与显示结构

### 输入

每个入口都消费当前已有的 item 形状，不另取 photo 数据：

```ts
interface PhotoItem {
  path: string;
  filename: string;
  frontmatter: Record<string, any> | null;
  body: string;
  kind?: string;
  appearance?: AppearanceResolution;
}
```

现状中 `/api/layer` 读取 Markdown 后把 `{ path, filename, frontmatter, body }` 组装为 item（`apps/server/src/routes/world.ts:699-713`）；`/api/nook` 通过共享的 `readLayerItems` 做同样的组装（`apps/server/src/routes/world.ts:351-363,587-590`），但按共同契约 public nook projection MUST 在进入 `readLayerItems` 前过滤 `README.md`、`identity.md`、`personality.md`、`memory.md`；`/api/backpack` 的共享 `BagItem` 也明确包含这四个字段（`packages/shared/src/actions/backpack.ts:18-25,32-45`）。前端 `LayerItem` 另外接收服务器给出的 `kind`、座位字段和可选 `appearance`（`apps/web/src/state/useWorld.ts:27-43`）。

photo 的字段来源固定如下：

| 字段 | 来源与用途 | 禁止做法 |
|---|---|---|
| `frontmatter.component === 'photo'` | photo 分支判定；共享 schema 要求 `type: component` 且允许 `image`/`caption`（`packages/shared/src/schemas/components.ts:153-157`） | 不以文件名猜 photo，不新增 `kind` |
| `frontmatter.image?` | Optional world-root-relative asset path. The only accepted shapes are `assets/**` and `.airpworld/assets/**`; the browser passes it to `airpGateway.assetUrl` after the same lexical allowlist check | No absolute path, `..`, hidden segment other than the literal `.airpworld`, `data:`/`blob:`/external URL, or a new path namespace |
| `frontmatter.caption?` | 二层图片下方的独立说明；纯文本 | 不把 caption 当 Markdown/HTML |
| `frontmatter.preview?` | 卡面图片下方的一行或多行摘要；纯文本，缺失时不把 `body` 原文泄漏到卡面 | 不用 `frontmatter.body` 代替独立正文 |
| `body` | 二层 `<article>` 中唯一的 Markdown 正文，来自 parser 分隔线后的 `item.body`，交给既有 `MarkdownText` | MUST 忽略/拒绝 frontmatter 中名为 `body` 的值；它不得显示、合并或作为 parsed body 的 fallback |
| `item.appearance?` | 沿用服务器已验证的 `AppearanceResolution`，卡面和二层显式消费同一份 | 不在前端重新解析 appearance，不写第二套 token |

photo registry 的公开示例已经表达了这个形状（`packages/shared/src/components/packs/mystery.ts:63-85`），且 schema 将 `body` 保留在共享 component core、把 `image`/`caption` 作为 photo 字段（`packages/shared/src/schemas/components.ts:65-75,153-157`）。

### 输出结构

1. **卡面（Canvas）**
   - 一个 `figure.photo-card`，图片区域占据 photo 卡面的主要高度。
   - 图片下方是 `preview`；有标题时可在 preview 上方显示 `frontmatter.title`，但不重复正文。
   - 有 `image` 时，图片用 `airpGateway.assetUrl(image, session, 'image')`；没有 `image` 或加载失败时，保留卡面尺寸并显示可读的缺图状态、标题/说明和“重试”操作，不显示语义图标冒充照片。
   - 卡面不显示 `caption` 或 Markdown `body`，避免把二层内容提前泄漏。

2. **二层（Canvas photo detail）**
   - `role="dialog"`、`aria-modal="true"` 的固定遮罩；对话框内容位于 portal 或等价的 viewport chrome 层，不能被 canvas transform、座位碰撞或卡面旋转裁剪。
   - 内容顺序：关闭按钮 → 标题 → 大图 → `caption`（存在时）→ `MarkdownText(item.body)`（非空时）→ 空正文的显式状态（为空时）。
   - 对话框只负责 photo 的阅读呈现；choice/status/dice/`use_item_on` 仍由既有 `EntityInteractions` 和既有拖放回调所有。不要在 photo 组件里复制动作按钮或发第二种 payload。

3. **背包（carried）**
   - 背包按钮、路径、移动和数量仍由 `App` 与既有 `BagItemDialog` 所有（`apps/web/src/App.tsx:117-127,745-762,838`）。
   - 选中的 photo 在 `BagItemDialog` 的 carried 阅读层中使用同一 `PhotoMedia` 图片/缺图状态，并显示 caption 与 `body`；保留既有 Place、frontmatter widget、忙/错误反馈。背包中的 photo 不显示 Take（已在 `player/`），Place 仍按现有 `onPlace` 移回当前 layer。
   - layer 与 nook 的 photo 卡面只有在 `portable === true` 且收到 `onTakeItem` 时显示 Take；layer 的回调由 App 的 `handleTakeItem` 接通，nook 由 `NookView` 原样转交同一回调（`apps/web/src/components/nook/NookView.tsx:131-145,499-518`）。public nook 只呈现通过四文件过滤后的生活内容；`player/` 只作为 backpack，不存在 player stronghold/nook projection 或 photo 初始化入口。这样三种 scope 都有明确的“可移动/不可移动”结果，不伪造背包 Take。

## 组件边界与精确代码落点

### 新组件

[推断] 以下组件拆分把“视觉卡面”“图片状态”“二层阅读”分开，同时保留 CanvasObject、BagItemDialog 与 EntityInteractions 的现有所有权；实现阶段若合并文件，仍须保留相同边界。

[推断] 建议新增 `apps/web/src/components/canvas/PhotoCard.tsx`：

```ts
export interface PhotoCardProps {
  item: PhotoItem;
  appearance?: AppearanceView | null;
  puzzleClasses?: string;
  onDragOver?: React.DragEventHandler<HTMLElement>;
  onDragLeave?: React.DragEventHandler<HTMLElement>;
  onDrop?: React.DragEventHandler<HTMLElement>;
  onTakeItem?: (path: string) => void;
}
export function PhotoCard(props: PhotoCardProps): React.ReactElement;
```

职责只有卡面 DOM、preview 文本、图片状态和 portable photo 的 Take 入口；不持有“是否打开详情”的状态，不调用 gateway action，不决定座位/尺寸/旋转。`onTakeItem` 只复用既有移动回调：当 `frontmatter.portable === true` 且 callback 存在时显示 Take，否则不伪造按钮。拖放参数仅复用 `CardRenderer` 已有的目标提示闭环，让 photo 继续成为 `use_item_on` 的可用目标；它们不改变 `onItemDropOnTarget(itemPath, targetPath)` 签名。

[推断] 建议新增 `apps/web/src/components/photo/PhotoMedia.tsx`（若实现阶段认为 `PhotoCard` 与二层可共享同一文件，也必须保持下列职责与接口）：

```ts
export type PhotoImageState = 'missing' | 'loading' | 'loaded' | 'error';
export interface PhotoMediaProps {
  image?: string;
  alt: string;
  variant: 'card' | 'detail' | 'carried';
  session?: string;
  onStateChange?: (state: PhotoImageState) => void;
}
export function PhotoMedia(props: PhotoMediaProps): React.ReactElement;
```

`PhotoMedia` 是唯一的 photo 图片 URL/解码状态与可见错误样式入口：只接受 `assets/**` 或 `.airpworld/assets/**` 的世界根相对 `image`，统一调用 `airpGateway.assetUrl(image, session, 'image')`；不使用 `ItemArtwork` 的通用 icon fallback。用户 retry 重新请求同一 image asset，但不重取 Markdown item。

[推断] 建议新增 `apps/web/src/components/photo/PhotoDetailDialog.tsx`：

```ts
export interface PhotoDetailDialogProps {
  item: PhotoItem;
  appearance?: AppearanceView | null;
  onClose: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}
export function PhotoDetailDialog(props: PhotoDetailDialogProps): React.ReactElement;
```

职责是二层遮罩、焦点生命周期、`PhotoMedia variant="detail"`、caption 和 `MarkdownText`。它不解析 frontmatter、不产生 action、不调用 `/api/layer`、`/api/nook` 或 `/api/backpack`，也不渲染 HTML/iframe。对话框通过 `appearance?.attrs`/`appearance?.style` 接收同一已验证 resolution；portal 后不会依赖 `.object` 的继承链，因此不能再次调用 `appearanceViewOf`。

### 现有组件改造边界

1. `apps/web/src/components/canvas/CardRenderer.tsx:66-76,113-125,189-263,265-294`
   - 在 `component: photo` 分支加入 `PhotoCard`，分支顺序保持 visual → chalk → gate → letter → photo → 其他 registry/default；photo 不得落入最后的 note fallback。
   - 复用该文件现有 `isDragOver`、`isItemDragging`、`isUnlockedEffect` 和 `handleTargetDrop`（`CardRenderer.tsx:80-109`），将 `puzzleClasses`、现有拖放 handler 与 `onTakeItem(path)` 传给 `PhotoCard`。
   - `CardRenderer` 不新增 open state；点击/Enter 仍由 `CanvasObject` 统一处理。它只将 `appearance` 传给卡面。

2. `apps/web/src/components/canvas/CanvasObject.tsx:138-171,173-255,257-298`
   - 保留 `.object` 的位置、宽度、z-index、旋转和 `item.appearance` 注入；这些职责当前由 `shellStyle` 与 `appearanceViewOf` 共同承担（`CanvasObject.tsx:161-171,188-190,252-255`）。
   - [推断] 在现有 `reading` 分支将 `kind === 'photo'` 路由到 `PhotoDetailDialog`，其他 kind 继续使用 `BagItemDialog inline`。推荐形式：
     ```tsx
     reading && kind === 'photo'
       ? <PhotoDetailDialog item={item} appearance={appearance} onClose={() => setReading(false)} returnFocusRef={objectRef} />
       : reading
         ? <BagItemDialog inline item={item} appearance={appearance} onClose={() => setReading(false)} />
         : ...
     ```
     `objectRef` 为本次改造在根 `.object` 上增加的 `useRef`，不是新的全局状态。
   - 根节点的既有 pointer threshold、`tabIndex=0`、Enter 和 interactive-child 排除必须保留（`CanvasObject.tsx:235-245`）。photo 应额外提供可读的 `aria-label`、`aria-expanded` 与打开时的 `aria-controls`；详情关闭后把焦点还给该根节点。用户要求的是 click/Enter，不用 Space 偷改交互契约。
   - 二层打开时，不能把照片的 action 复制到 `PhotoDetailDialog`。`EntityInteractions` 仍按现有位置和所有权工作（`CanvasObject.tsx:297-298`、`apps/web/src/components/narrative/EntityInteractions.tsx:25-35,124-186`）；关闭二层后即可继续操作。Photo 卡面 drop 仍用 `onItemDropOnTarget`，动作实际由 App 的 `handleItemDrop` 调用唯一 `airpGateway.useItem` 后 `refresh`（`apps/web/src/App.tsx:502-510`）。

3. `apps/web/src/components/BagItemDialog.tsx:17-79`
   - 不把 `BagItemDialog` 改成 photo 卡面，也不让它拥有 Canvas photo 的 open state。
   - carried 分支识别 `item.frontmatter?.component === 'photo'` 后，在现有 `paper-reading__content` 中插入 `PhotoMedia variant="carried"` 与 caption；正文仍是同一 `MarkdownText(item.body)`（当前正文落点为 `BagItemDialog.tsx:66-72`）。普通物件继续用 `ItemArtwork`（`BagItemDialog.tsx:67`）。
   - Escape、外点击、关闭、Place、`renderFrontmatterWidgets`、忙与错误状态沿用当前 `BagItemDialog` 行为（`BagItemDialog.tsx:33-56,61-79`）。不在这里再打开 `PhotoDetailDialog`，避免嵌套模态和两个关闭/焦点所有者。

4. `apps/web/src/components/ItemArtwork.tsx:5-27`
   - 不改变通用背包缩略图逻辑；它仍可作为非 photo 的 carried 图像/语义 icon。
   - photo 的可见主图不能依赖其 `fm.image || fm.cover` 和 icon fallback（`ItemArtwork.tsx:8-26`），因为“找不到真实照片”必须显式可观察。PhotoMedia 是 photo 专用分支，而不是改变 `ItemArtwork` 的全局语义。

5. `apps/web/src/App.tsx:223-238,323-331,502-529,745-762,838`
   - `handleItemDrop`、`handleReturnItem`、`handleTakeItem` 保持原始 gateway、refresh 与错误通知（`App.tsx:502-529`）。photo 卡面增加视觉不会丢失可移动性或 `use_item_on`。
   - 若 `PhotoDetailDialog` 使用 portal，portal 不应挂到 App 的另一个 WS/状态树；它只接收当前 item snapshot 和 appearance。

跨端前置（不由 photo UI 自行实现）：`packages/shared/src/rules/characters.ts:65-68` 的既有 `nookCardPaths(allFiles: readonly string[], nookId: string): string[]` 直接迁移为排除 `README.md`、`identity.md`、`personality.md`、`memory.md`，并让其所有 callers（包括 `apps/server/src/routes/world.ts:587-590` 与 `packages/shared/src/actions/canvas.ts:519-524`）统一使用过滤结果；不新增 `publicNookCardPaths`。photo 卡面只消费过滤后的 public nook items，不显示四个根配置。四个配置可编辑但不可被 `write`/`edit`/`move`/`delete` 移删；四个入口的统一动作层门禁 MUST 在 Character Skill 装载前落地，不在本 photo 组件中复制。layer payload 的 `world/README.md` 统一是 `type: readme`；只有独立 child door 才是 `type: gate`，`stub: true` 仅表达标记，photo 分支不得改变这些 gate 语义。`player/` 只作为 backpack，不存在 player stronghold/nook projection 或 photo 初始化入口。
6. `apps/web/src/state/useWorld.ts:170-200,410-449`
   - layer 重取继续走 `fetchLayer`/`refresh`，保留 request sequence 的 last-response-wins（`useWorld.ts:170-200`）。photo 详情不因打开而发请求；`file_changed`/`world_event` 仍触发同一层重取（`useWorld.ts:419-449`）。
   - `image_landed` 本期明确不消费、不转发、不触发 retry；它当前在 switch 的 default 被忽略（`useWorld.ts:650-657`）。只有生成动作后实际写入 photo Markdown 所产生的既有 `file_changed`/`world_event`，或用户显式 retry，才会重新尝试图片。不得创建新的浏览器事件、第二 WebSocket 或新的 LayerState 字段。


7. `apps/web/src/index.css` 或新增 `apps/web/src/components/photo/photo.css`
   - 以现有 `CARD_FORMS.photo` 的 224×240 作为座位声明（`packages/shared/src/schemas/forms.ts:64-85`），CSS 只使用 `width: 100%` 和内容高度，不覆盖 shell 的 `item.w`、left/top、rotation。
   - photo 样式使用已有 `--appearance-*` 与 `--paper`/`--ink` 等 token；缺图状态、focus ring、错误文字和 retry button 需要颜色之外的文字/边框/图标组合，不能只靠色彩。appearance adapter 的安全变量与旧默认位于 `apps/web/src/lib/appearance-view.ts:21-66,138-172`。
   - 二层遮罩使用既有 depth token（如 carried reader 的 depth 约定），禁止新写任意 z-index、硬编码纯黑/纯白或运行时 `<style>`。`prefers-reduced-motion`/`motion: still` 下移除图片成形动画，只保留静态 focus、错误与状态文字；既有 appearance motion 优先级由 `appearance-view.ts:71-78,149-151` 管理。

## 逐步行为（每步的漏项后果）

1. **辨认 photo。** `CanvasObject` 已从服务器拿到 `item.kind === 'photo'`；`CardRenderer` 再确认 `frontmatter.component === 'photo'`，仅此分支使用 `PhotoCard`。**漏了会怎样：** photo 会走普通 note/default，只有正文，没有照片卡面；或者错误 frontmatter 被误认成 photo。
2. **建立稳定图片引用。** `PhotoMedia` 只接受非空且匹配 `assets/**` 或 `.airpworld/assets/**` 的字符串 `frontmatter.image`，通过 `airpGateway.assetUrl(image, session, 'image')` 生成 `/api/asset?path=...&kind=image&session=...`；不直接把 frontmatter 值放进 `src`。**漏了会怎样：**外链/协议注入、越权路径或同一世界切换后的旧素材缓存都可能被误处理。
3. **先画大图，再画 preview。** `PhotoCard` 将 `PhotoMedia variant="card"` 放在 preview 之前，并将 preview 当纯文本显示；body 不进入卡面。**漏了会怎样：**卡面失去 photo 视觉重点，或把长 Markdown、标题标记和内部正文泄漏给玩家。
4. **显式处理图片状态。** `missing`（没有 image）、`loading`、`loaded`、`error` 都有 DOM `data-photo-state` 和可读状态；`error` 有明确“图片无法载入”文字及重试按钮。**漏了会怎样：**缺图被静默画成 icon/空白，玩家无法知道是内容缺失还是网络失败。
5. **保持卡面可激活。** 根 `.object` 继续由 `CanvasObject` 响应点击和 Enter；PhotoCard 内的 retry button 标记 `data-no-drag`，不会触发打开/拖动。**漏了会怎样：**图片点击不能阅读，或重试按钮冒泡成关闭/打开/拖拽，键盘使用者失去入口。
6. **开启二层。** `CanvasObject` 将 photo 的 `reading` 分支渲染 `PhotoDetailDialog`，portal/固定层不参与 canvas 座位测量。**漏了会怎样：**详情被 `.object` transform 裁剪或计入 footprint，出现碰撞、卡片跳动和 z-index 错乱。
7. **填写二层语义。** 标题、同一张图片、caption、`MarkdownText(item.body)` 按固定顺序渲染；frontmatter 中即使存在 `body` 也 MUST 忽略或在输入校验时拒绝，绝不作为 fallback；parsed `item.body` 为空时显示明确“没有文字说明”的空状态。**漏了会怎样：**caption/body 丢失，或把错误的 frontmatter body 当正文；空内容会变成静默无反馈。
8. **完成焦点闭环。** 打开时焦点进入关闭按钮；Tab 不离开 dialog，Escape、遮罩点击和关闭按钮关闭；关闭后焦点回到原 photo `.object`。**漏了会怎样：**键盘焦点落到画布背后、Escape 关闭错误层或关闭后焦点丢失。
9. **不复制互动。** `PhotoDetailDialog` 不调用 gateway、不渲染 widget；关闭后 `EntityInteractions` 仍按既有 owner 显示 choice/status/dice/`Look closer`，photo drop 仍调用 `onItemDropOnTarget`。**漏了会怎样：**同一 action 出现两套按钮/两次请求，或者 photo 失去 `use_item_on` 和可移动语义。
10. **按既有状态重取。** `file_changed`/`world_event` 继续走 `fetchLayer`/现有 nook load；`image_landed` 本期不消费、不转发、不触发 retry。只有生成动作后实际写入 photo Markdown 所产生的既有事件，或用户显式 retry，才会重新尝试图片。**漏了会怎样：**详情显示过期 caption/body，或把“素材已落盘”错误当成世界 item 已更新。
11. **响应 Markdown 变更。** 打开的 dialog 消费新的 item props，删除后随卡面卸载；不为 photo 加独立重取。**漏了会怎样：**layer、nook 出现两份互相竞争的状态。
12. **隔离图片错误。** `/api/asset` 404/403 只影响 PhotoMedia；正文、caption、关闭、互动、搬运仍可用。**漏了会怎样：**素材坏了整张 card/scene 白屏，且玩家无法读取仍在的文字线索。
13. **覆盖三个 scope。** layer 与 nook 共享 `Canvas`/`CanvasObject` 分支；backpack 共享 `BagItemDialog` 的 carried content；所有入口都以 item.path 为 identity。**漏了会怎样：**照片只在世界画布好看，进角色小天地或背包后变成错误的普通文件。
14. **尊重 reduced motion 与 footprint。** 新图像过渡、遮罩过渡在 reduce/still 时为静态；`CARD_FORMS.photo`、item.w/h、座位与 shell transform 不改。**漏了会怎样：**用户被不必要的动画影响，或照片内容高度改变服务器排座/首次测量。
## 状态、事件与 WS

### PhotoMedia 状态机

```text
无 image ───────────────► missing
有 image ─► loading ─► loaded
                └─────► error ── retry ─► loading
                           ▲
                           └─ 用户 retry ─► loading
```

- `missing` 是输入状态，不是网络错误；显示“此照片没有图片素材”。
- `loading` 可显示不阻塞正文的轻量状态；不得用无语义 spinner 取代 alt/标题。
- `loaded` 显示 `<img>`，卡面和二层各自拥有自己的解码状态。
- `error` 显示可见错误、重试按钮和原有标题/preview/body；不切换到 `ItemArtwork` icon。
- retry 只重新请求图片，最多由组件自身防止重复点击；不调用 layer/nook/backpack API。

### 模态状态

`CanvasObject` 的现有 `reading: boolean` 是唯一画布打开状态；photo 不在 `PhotoCard` 再建 `open`。`PhotoDetailDialog` 只接收 `onClose`，内部最多维护焦点节点和 dialog 内 image retry epoch。`BagItemDialog` 的 `busy/error/actionFeedback` 仍只属于携带物件动作（`BagItemDialog.tsx:28-56`）。

### 事件表

| 来源 | 当前处理 | Photo 设计处理 | 不产生 |
|---|---|---|---|
| 点击 photo / Enter | `CanvasObject` 切换 `reading`（`CanvasObject.tsx:240-245`） | 打开/关闭 `PhotoDetailDialog`；恢复焦点 | 不发 WS/domain event |
| retry button | 当前没有 photo 专用状态 | `PhotoMedia` 重新请求同一 `assetUrl` | 不改 Markdown/item |
| `file_changed` | `useWorld` 重取 layer（`useWorld.ts:419-426`） | 新 body/caption/image 通过同一 item 替换 | 不新增 photo fetch |
| `world_event` | 去重、转发并重取（`useWorld.ts:427-449`） | 保持现状；App 继续重取 backpack chrome | 不新增 event type |
| `image_landed` | 当前被 default 忽略（`useWorld.ts:650-657`） | 本期明确不消费、不转发；等待既有 Markdown/file/world event 或用户显式 retry | 不创建新的浏览器事件、第二 WS 或 LayerState 字段 |
| photo drop | CardRenderer 的既有 target drop helper（`CardRenderer.tsx:99-109`） | 调用现有 `onItemDropOnTarget`; App `useItem` 后 refresh/notice | 不新增 use-item payload |
| Escape / backdrop / close | `BagItemDialog` 已有 Escape/outside close（`BagItemDialog.tsx:33-40`） | Photo dialog 自有同等关闭与 focus restore | 不关闭背包/场景/nook 上层 |

`generate_image` 成功时 EventBridge 发出的 `image_landed` 只带 asset、mimeType、尺寸和 reused 等结果（`apps/server/src/engine/event-bridge.ts:309-319`）；生成动作本身也明确“世界在调用方写入 Markdown 前不变”（`packages/shared/src/actions/generate-image.ts:348-389`）。本期不消费该帧；素材落地只有在 Markdown 写入并经既有 `file_changed`/`world_event` 重取后才进入 item。用户可显式 retry 已存在但此前缺图的引用。

## 资产路径、安全与缺图边界

- `packages/shared/src/rules/media.ts`（NEW）提供唯一 canonical image validator：
  ```ts
  export function assertImageAsset(worldRoot: string, relativePath: string): Promise<void>;
  ```
  它只在 `photo.image` 与 `create_char.avatar` 写入边界调用，接受且仅接受 world-root-relative 的 `assets/**` 或 `.airpworld/assets/**`，并要求 PNG/JPEG/WebP 的扩展名与实际 MIME 一致；拒绝绝对路径、`..`、其他隐藏段、外链和其他媒体类型。验证失败统一抛 `ActionError` code `invalid_asset_ref`。
- 写入边界必须共享同一个 validator，而不是只在 React 中检查：

| 入口 | 精确落点与调用顺序 | 失败保证 |
|---|---|---|
| `createEntity` | `packages/shared/src/actions/create.ts:86-126`；解析 supplied content/frontmatter、确认 `component === 'photo'` 且 image 存在后，先调用 `assertImageAsset(ctx.store.worldRoot, frontmatter.image)`，再 write/event | `invalid_asset_ref`；不写文件、不 append event |
| `writeChalk` | 当前 `packages/shared/src/actions/chalk.ts:389-452` 强制产出 `type: chalk`，不能产生 `component: photo`；本轮在其输入解析处显式拒绝试图伪造 photo 的字段并保证不写盘。若未来允许该入口产出 photo，必须在 serializer/write 前调用同一 `assertImageAsset` | 当前 photo 入口负例统一 `invalid_argument`；未来 generic photo 分支必须是 `invalid_asset_ref`，不能让未经校验的 photo 落盘 |
| `editEntity` | `packages/shared/src/actions/delete.ts:152-232`；合并旧 frontmatter 与 edit 输入后、先判断最终 `type: component` 且 `component: photo`，再在 write/event 前调用 canonical validator；若合并结果仍是 photo 且含 `image`，必须验证该 image | 非法 photo image 统一抛 `invalid_asset_ref`，不落盘、不发 `entity_edited`；非 photo 的 `frontmatter.image` 不触发此规则；已有坏图的 body/caption 修复必须在同一 edit 中清除 image 或替换为合法 image，不能以只改文字绕过校验 |
| `create_char` | `packages/shared/src/actions/create-char.ts`（NEW）；头像/角色 bundle 写入前调用同一 validator | 非法 avatar/photo image 抛 `invalid_asset_ref`；角色 bundle 与事件均不提交 |

调用顺序固定为“parse/merge → resolve component → `assertImageAsset` → write → event”。三个受支持 photo 写入入口 `createEntity`、`editEntity`、`create_char` 必须对合法/非法路径、越界 symlink、错误 MIME 做正负验收；`writeChalk` 与 native `write/edit` 对试图产出 `component: photo` 的输入必须在写盘前拒绝。不得在 `PhotoMedia`、单个 action 或 `create_char` 中复制正则或另造 validator。
- 前端统一使用 `airpGateway.assetUrl`（`apps/web/src/lib/airp-gateway.ts:44-46,94-95`），不复制 canonical validator，不拼接用户输入到 CSS 或 raw HTML。前端可做无 I/O 的即时预检，但安全闭环必须依赖服务端 canonical validator。
- 服务端 `/api/asset` 当前只做 world-root resolve、前缀越界检查和 `sendFile`（`apps/server/src/routes/world.ts:1318-1328`）。它是通用媒体端点，必须继续服务 `bg`、`bgVideo`、portrait video 与 audio；所有媒体请求共用 realpath/symlink 与常规文件检查，再按 image/video/audio 类型执行对应 allowlist。不得把通用端点收窄为 image-only。
- 不能采用“image 失败 → ItemArtwork icon → 仍当作 photo 成功”的静默 fallback。无 `image`/非法路径是 `missing`，有合法 image 但加载失败是 `error`；两者均必须在可见 DOM、屏幕阅读器文本和测试断言中可区分。
- 不支持 HTML/iframe/嵌入页面；Markdown 仍走既有 `MarkdownText` 安全渲染入口（`apps/web/src/lib/md.ts:1-134`）。

## 错误边界与恢复

| 错误 | 用户可见结果 | 恢复动作 | 不应发生 |
|---|---|---|---|
| `image` 缺失 | 卡面/二层显示 `missing` 与标题，正文仍可读 | 作者补 Markdown 后由既有 file/world event 重取；或关闭/重开 | 假装有图、空白无说明 |
| `/api/asset` 404/403 | `error`、可操作 retry、caption/body 保持 | 修复路径/素材后用户显式 retry；Markdown 更新仍走既有事件重取 | 重写路径、尝试外链 |
| decode/network error | 同上；错误文本包含“无法载入”，不泄漏内部绝对路径 | retry | console.warn 后静默继续 |
| layer/nook 重取失败 | 由既有 state/error 机制处理，旧 item 不被 photo 组件覆盖 | 既有 refresh/reconnect | photo 组件自行 fetch 或清空整个世界 |
| backpack 重取失败 | 既有 chrome error/notice；已打开 carried dialog 不因图片失败崩溃 | 既有 loadChromeData | photo 组件伪造 backpack item |
| malformed `image`（非字符串/空白） | `missing`，不调用 raw URL | 作者修正 frontmatter | 把对象/数组强转成 URL |
| appearance 缺失/警告 | 走同 kind 旧默认；photo 内容和交互可用 | 既有 appearance 诊断 | photo 自己解析或阻断阅读 |
| modal mount/unmount 竞态 | 只由当前 `reading`/item identity 决定；旧 retry 不能写到新 item | cleanup listener/timer | 跨 card 泄漏焦点或 error |

## 文件与副作用

| 文件 | 变更 | 运行时副作用 |
|---|---|---|
| `apps/web/src/components/canvas/PhotoCard.tsx` | NEW，卡面大图/preview/drop 接口 | 仅 DOM、图片请求和本地 decode 状态 |
| `apps/web/src/components/photo/PhotoMedia.tsx` | NEW，共享图片状态、安全 URL、显式缺图/错误 UI | 仅图片请求；不写文件、不发 action |
| `apps/web/src/components/photo/PhotoDetailDialog.tsx` | NEW，二层 dialog、Markdown body、caption、焦点 | 仅 portal/焦点/图片请求；不发 WS |
| `apps/web/src/components/canvas/CardRenderer.tsx:66-109,113-125,189-294` | photo 分支和复用 drop helper | 保留现有 callbacks、puzzle cue、appearance |
| `apps/web/src/components/canvas/CanvasObject.tsx:173-298` | photo reading 路由、root ref、aria/focus restore | 保留唯一 reading/座位/EntityInteractions owner |
| `apps/web/src/components/BagItemDialog.tsx:58-73` | carried photo 使用 PhotoMedia/caption | 保留 backpack action 与 place side effect |
| `packages/shared/src/rules/characters.ts:65-68`、`apps/server/src/routes/world.ts:587-590` | public nook projection MUST filter `README.md`/`identity.md`/`personality.md`/`memory.md`; mutation gates for those files remain action-layer/Character Skill prerequisites | Photo UI never displays root config and never offers player stronghold/init |
| `apps/web/src/state/useWorld.ts:415-449,650-657` | 不新增 photo WS 消费；继续使用既有 `file_changed`/`world_event` 重取；`image_landed` 明确留给后续契约 | 不增加 socket/state/domain event |
| `apps/server/src/routes/world.ts:1318-1332`、`packages/shared/src/rules/media.ts`（NEW） | 通用 `/api/asset` MUST 保留 image/video/audio 媒体分流及 bg/bgVideo/portrait video/audio；photo validator MUST 使用唯一 `assertImageAsset(worldRoot, relativePath)`，只约束 `photo.image`（及共同契约的 `create_char.avatar`），并执行双前缀、realpath/symlink、常规文件和 PNG/JPEG/WebP 图片 MIME/扩展名一致性规则 | 不扩大路径权限，不允许 photo image 伪装为视频/音频或非图片，不破坏既有视频/音频 |
| `packages/shared/src/actions/errors.ts:3-43` | 增加 `invalid_asset_ref` 的 ActionErrorCode、HTTP 400 与 public serialization；shared/server 错误测试固定该错误码 | 四入口非法图片失败可被 API/tool 端稳定断言 |
| `apps/web/package.json`、`apps/web/playwright.photo.config.ts`、`apps/web/test/photo-render.spec.ts`（均 NEW/改动） | 冻结 `pnpm --filter @airp/web test:photo` 的 Playwright 临时 server/world harness，覆盖点击、Enter、focus trap、缺图/error 与真实 PNG | 不依赖不存在的现有 web test runner；CI 可机械执行 |
服务端、shared schema、registry、`CARD_FORMS`、`CanvasObject` 的 item 形状和 `EntityInteractions` action 协议不应被本 photo 设计修改。若实现发现服务器需改变素材发布目录或 `image_landed` payload，必须先回写共同契约再编码。

## 与现状差异

| 现状 | 本设计差异 |
|---|---|
| `CardRenderer` 当前只有 visual、chalk、gate、letter、note/default 分支，未单独画 photo（`CardRenderer.tsx:113-130,189-294`） | 增加 `component: photo` → `PhotoCard`，避免 photo 退化成 note；仍保持分支优先级 |
| `CARD_FORMS.photo` 已存在且尺寸为 224×240（`packages/shared/src/schemas/forms.ts:81-85`） | 只消费该 row，不改尺寸表/座位；大图适配现有 shell width |
| `CanvasObject` 所有 readable card 都开 `BagItemDialog inline`（`CanvasObject.tsx:185-192,257-258`） | photo 的 reading 分支改为固定二层 `PhotoDetailDialog`，其他 kind 不变 |
| `BagItemDialog` carried 使用 `ItemArtwork`，inline 时只显示 image（`BagItemDialog.tsx:58-70`） | photo carried 复用 PhotoMedia 并显示 caption；普通物件不变 |
| `ItemArtwork` 图片失败后切换 icon（`ItemArtwork.tsx:8-26`） | photo 不采用该静默 fallback，缺失/失败必须显式可观察 |
| 服务器 `/api/layer`、`/api/nook`、`/api/backpack` 已提供独立 body，暂无 photo 专用数据源（`world.ts:356-363,587-590,900-908`; `backpack.ts:32-45`） | 不加 API；所有 scope 复用现有 item |
| `image_landed` 已由 EventBridge 发出但 `useWorld` default 忽略（`event-bridge.ts:309-320`; `useWorld.ts:650-657`） | 本期明确不消费；只依赖 Markdown 写入后的既有 `file_changed`/`world_event` 重取或用户显式 retry，不创建浏览器事件 |
| 现有 `EntityInteractions` 负责通用字段动作与“Look closer”入口（`EntityInteractions.tsx:124-186`） | photo 卡面/详情不重复动作；drop、choice/status、可移动性仍走已有 owner |
| 当前全仓没有真实 photo world fixture；已有 photo 内容主要是 registry example（`mystery.ts:63-85`），shared test 只会验证 registry 示例/schema（`packages/shared/test/components.test.mjs:35-79`） | 测试必须临时创建真实 PNG + Markdown item 或用测试服务器素材，不能因没有 fixture 而静默跳过图片断言 |

## 可执行验收测试（不依赖静默 fallback）

以下测试应在实现 photo 组件后用真实浏览器/现有 web 测试 runner 执行；需要素材的 case 在临时 world root 写一个最小可解码 PNG（或测试 server 明确提供的 PNG），测试结束清理临时目录。不能把“没有 fixture”转成 skip；若测试环境没有创建 PNG 的能力，应明确失败并报告前置条件。

7a. **受支持服务端写入口共享 canonical validator（未实现必失败）：** 分别通过 `createEntity`、`editEntity` 和 `create_char` 写入/修改合法 PNG/JPEG/WebP image/avatar，三者均成功并各自保留既有写入/事件闭环；再分别提交越权路径、`.mp4`/`.mp3`/`.svg`、扩展名与实际 MIME 不一致的 photo image（以及非法 avatar），三者均在 `store.writeFile` 前调用同一 `assertImageAsset(worldRoot, relativePath)` 并统一得到 `invalid_asset_ref`。另断言 `writeChalk` 与 native `write/edit` 不能产出 photo，不存在未校验的通用写入旁路。

1. **真实 photo 卡面（非空性，未实现必失败）：** 用 `type: component`、`component: photo`、`title`、`preview`、`image`、`caption` 和非空 Markdown body 写入 `world/photo.md`，通过 `/api/layer` 进入画布；断言 `item.kind === 'photo'`，存在 `.photo-card`、`img`，`data-photo-state="loaded"`，且 `preview` 出现在图片之后。若仍走 note fallback，不会有 `.photo-card`，该断言失败。
2. **点击与 Enter 打开二层（未实现必失败）：** 点击 card 图片后断言 `role="dialog"[aria-modal="true"]`；关闭后聚焦 `.object[data-path="world/photo.md"]`，再对该 object 按 Enter，断言相同 dialog 出现。拖动超过既有 6px threshold 后不应打开阅读层（阈值行为见 `CanvasObject.tsx:239-245`）。
3. **二层内容语义与 body reject（未实现必失败）：** dialog 内断言标题、同一 asset 的大图、caption 和渲染后的 Markdown body 均可见；frontmatter 中故意放入一个不同的 `body` 值，断言该值被忽略/拒绝且不显示，Markdown 分隔线后的 `item.body` 显示。body 为空时断言出现显式空正文状态，不接受空白通过。
4. **键盘与无障碍：** 断言 dialog 有 `aria-labelledby` 指向标题、关闭按钮可聚焦；Tab 不离开 dialog，Escape/遮罩点击/关闭按钮均关闭并恢复 card 焦点；retry button 有可读 label。焦点 ring 和缺图状态不能只靠颜色判断。
5. **缺 image（未实现必失败）：** 删除 frontmatter `image`，进入 layer；断言 card 和 dialog 均有 `data-photo-state="missing"`、可见状态文字和可访问标题；断言没有 `ItemArtwork` icon 被当成成功图片，也没有 `<img src="undefined">`。caption/body 仍可读。
6. **404/decode error 与重试（未实现必失败）：** 将 `image` 指向不存在路径，拦截 `/api/asset` 令其返回 404；断言 `data-photo-state="error"`、错误文字和 retry button 出现；点击 retry 断言请求次数增加且仍为同一 encoded path，不能默默切换 icon 或外链。
7. **素材安全边界与视频/音频回归（未实现必失败）：** 通过 photo validator 分别接受合法 `assets/a.png` 与 `.airpworld/assets/gen/a.webp`，拒绝 `../outside.png`、绝对路径、`assets/../outside.png`、`.airpworld/assets-link/a.png`（逃逸 symlink）、`assets/a.svg` 和 `assets/a.html`；对内容为 HTML 但扩展名为 `.png` 的伪装文件、以及扩展名与实际 MIME 不一致的 JPEG/WebP 伪装文件也拒绝。另用现有 bg/bgVideo/portrait video 形状请求合法视频、用 audio 形状请求合法音频，断言通用 `/api/asset` 分别返回 allowlisted video/audio MIME；断言 photo `image: assets/a.mp4` 与 `image: assets/a.mp3` 不通过 photo validator。不能只靠前端隐藏链接，也不能把通用 `/api/asset` 收窄为 image-only。
8. **layer 与 public nook 对等且不泄露根配置：** 用同一临时 photo 内容分别放入 `world/photo.md` 与 `characters/alice/photo.md`，同时在角色根放入 `README.md`、`identity.md`、`personality.md`、`memory.md`；通过 `/api/layer` 和 `/api/nook?character=alice` 打开，断言两处 photo 均有相同卡面、Enter、dialog、caption/body、缺图状态，并断言 public nook items 不含四个配置文件。不得只测 map 而遗漏 nook 的独立读取；不得把 `player/` 当 nook 或测试 player stronghold/init。
9. **backpack scope：** 将 photo 移到 `player/photo.md`，通过 `/api/backpack` 和现有 belongings UI 打开；断言 `BagItemDialog` 中 image/caption/body 都存在，Place/关闭仍可用；断言不是第二个嵌套 dialog，普通 note 仍用 `ItemArtwork`。
10. **互动、Take 与搬运不回归：** 对 layer 中 `portable: true` photo 点击 Take，断言 `onTakeItem(photoPath)` 只调用一次并最终移动到 `player/<filename>`；在 nook 中同样断言 `NookView → Canvas → PhotoCard` 的 callback 链不丢失。对 backpack photo 断言不显示 Take、Place 仍调用既有 `onPlace` 并回到当前 layer。再对 photo 卡拖入一个临时 backpack item，断言 `onItemDropOnTarget` 只调用一次、`airpGateway.useItem(itemPath, photoPath)` payload 不变、成功后只走既有 `refresh`/notice。详情打开时不应偷偷发 action。
11. **WS/file refresh：** 修改 photo Markdown 的 preview/caption/body 后通过既有 file/world event 触发 refresh；若 dialog 仍挂载，断言新的 item 内容出现，旧正文不残留；删除文件后断言卡和 dialog 都卸载。断言没有 photo 专用 `/api/photo` 请求。
12. **appearance/footprint：** 使用两个合法 appearance resolution，断言卡面和 dialog 的 `data-appearance-*`/关键 `--appearance-*` 来自同一 resolution；appearance 缺失仍可读。等待字体和测量后断言 shell width 为 `item.w`、CARD_FORMS row 未改、left/top/rotation/z 不被 modal 改写。
13. **reduced motion/responsive：** 在 `prefers-reduced-motion: reduce`、`motion: still`、窄视口下分别验证无成形/位移动画，dialog 不出 viewport，正文可滚动，card width 仍由 `item.w`；focus、错误、retry 和 body 仍可用。不得用“动画关闭所以不测内容”。
14. **没有真实 fixture 时的硬失败：** 在 CI 没有临时 PNG 或 `/api/asset` 可读素材时，测试应报“photo fixture prerequisite missing”并失败，不能 skip、接受 `ItemArtwork`、接受 404 作为 loaded 或把空白当通过。此条直接防止当前“只有 registry example、没有真实 photo fixture”的假绿。

## 发现的冲突 / 需要回写的上位文档

1. **资源目录、安全与媒体分流需要上位文档同步。** registry 示例当前使用 `.airpworld/assets/`（`packages/shared/src/components/packs/mystery.ts:69,82`），本设计按共同契约固定允许 `assets/**` 与 `.airpworld/assets/**`；`/api/asset` 当前只做 world-root resolve/sendFile（`apps/server/src/routes/world.ts:1318-1328`），因此上位实现契约 MUST 加入 photo 专用 PNG/JPEG/WebP canonical `assertImageAsset(worldRoot, relativePath)`，同时保留 bg/bgVideo/portrait video/audio 的通用 image/video/audio 媒体分流、realpath/symlink 越界检查和实际 MIME/扩展名一致性。前端不得用第三路径补洞。
2. **`image_landed` 本期明确不消费。** EventBridge 会发该结果帧（`apps/server/src/engine/event-bridge.ts:309-320`），但 `useWorld` 当前 default 忽略（`apps/web/src/state/useWorld.ts:650-657`）；本设计不创建浏览器事件、不触发 retry、不增加 WS 或 LayerState。若后续要消费，必须另行回写共同契约。
3. **通用阅读层交互所有权存在历史重叠。** `EntityInteractions` 负责 Look closer/通用 widgets（`EntityInteractions.tsx:124-186`），而 `BagItemDialog` 也渲染 frontmatter widgets（`BagItemDialog.tsx:70-73`）。本设计选择不在新 photo 组件复制任何 action，但上位文档应拍板“dialog 中 widget 是否仍是历史兼容入口”，以免 photo detail 被要求同时嵌入第二套 controls。
4. **“二层模态”与当前 inline reader 术语不完全一致。** `CanvasObject` 当前把 `BagItemDialog inline` 放回 `.object`（`CanvasObject.tsx:257-258`），而 photo 需要 viewport-level `role=dialog`。上位前端文档应把 photo 的 portal/focus/scroll 约束加入二层矩阵，且明确 portal 不参与 footprint/碰撞测量。
5. **appearance 传递跨 portal 的细节缺口。** appearance adapter 规定由 `.object` 注入受信 attrs/style（`apps/web/src/lib/appearance-view.ts:8-18,153-181`），portal 脱离继承后需显式传同一 view。上位文档应补“portal reading layer 复制已验证 view，不重新解析”的机械核验项。

## 仍未知、待拍板

- 二层 photo 是否必须显示 `EntityInteractions` 的动作按钮，还是按当前 reading 行为在关闭详情后操作？本设计默认后者，以保持互动单一所有者且不把 action 面板塞进纯视觉 dialog。
- photo 卡面是否显示 `title`（[推断] 本设计建议显示，但不是“大图+preview”硬要求），以及 title 缺失时的稳定可读 label？
- 缺图状态文案是否加入 `useLocale` 的中英/日语 keys，还是沿用既有通用网络错误文案？实现不能把语言写死在组件中。
- dialog 是 portal 到 `document.body`，还是现有 chrome root 已提供不受 canvas transform 的挂载点？无论选择哪种，都必须满足 `role=dialog`、focus trap、焦点恢复和不测量 footprint。
- 真实 photo fixture 由 web 测试临时 world 创建，还是仓库新增受控测试 asset？在决定前不得把 fixture 缺失当作测试 skip。
