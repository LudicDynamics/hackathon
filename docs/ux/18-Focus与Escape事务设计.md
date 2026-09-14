# UX18 Focus 与 Escape 事务设计

> 状态：设计稿，待 UX 下一批评审；本文件只负责 Escape、`FocusCoordinator`、`OverlayAdmission` 与 focus return，不实现代码。
>
> 本文必须与 `docs/ux/15-下一批共同上下文.md`、`docs/ux/00-共同上下文.md` 及 UX01–07 一起阅读。本文不改变世界事实、动作结果、WS 帧、相机或演出时序。

## 1. 一句话定位

把所有可关闭的舞台表面收敛为一个由 `FocusCoordinator` 驱动的 topmost close transaction：一次 Escape 只消费一个 owner/overlay，关闭与卸载各自幂等，焦点只回到仍然存在且可达的开启来源。

## 2. 用户预期

1. 用户打开角色对话、Nook、背包、照片、声明动作、世界选择、活动详情或动作菜单后，按一次 Escape 只关闭当前最上层表面，不会同时关闭父层，也不会从 Nook 错退到 layer。
2. 用户在输入框、`textarea`、`select`、`button`、链接或 `contenteditable` 中编辑时，Enter、Tab 和普通按键仍归输入控件；IME 组合未完成时 Escape 不会截断组合或关闭表面。
3. 非组合态按 Escape 会关闭当前确实拥有焦点事务的表面；writer 输入中的 Escape 只收起 authoring/清除输入焦点，不触发 `writer_abort`，也不导航离开当前 layer。
4. 关闭后焦点回到打开它的按钮或实体；若来源已卸载、`hidden`、`inert`、不可见或已属于旧世界，则回到当前 active projection 的明确 fallback，而不是回到旧 DOM。
5. 返回按钮、纸外点击、右上角 Close、Nook Back 和 Escape 使用同一个 close transaction；动画期间重复按键不会再次恢复相机、刷新 layer 或退父层。

## 3. 现状证据（代码事实）

| 范围 | 当前事实与证据 | 直接风险 |
|---|---|---|
| Owner 集合 | `apps/web/src/lib/focus-coordinator.ts:1-9` 的 `FocusOwner` 只有 `workspace | writer | journal | world-shelf | belongings | profile | character-dialogue | nook`。`createFocusCoordinator` 在 `:37-90` 维护 stack；同一 owner 重获返回原 token（`:47-50`），`handleEscape` 释放最后一项（`:76-81`）。 | 不能增加同义 owner；多个同属 `workspace` 的表面不能靠再造 owner 表达。 |
| App 当前 focus 接线 | `apps/web/src/App.tsx:170-183` 创建单一 coordinator、`focusTokensRef` 和 `syncFocus`；`:340-348` 依据 state 同步 `world-shelf/nook/character-dialogue/belongings/profile/writer/journal`。 | 状态 effect 的先后不是可见层级契约；同 owner 的局部表面需要 coordinator 内部 surface registration。 |
| App Escape | `apps/web/src/App.tsx:566-635` 在 `window` 安装一个 bubble Escape listener，但先处理 `closeWorkspaceDisclosure`（`:571-575`）、radial（`:578-584`）、dice ceremony（`:585-588`），再 `focusCoordinator.peek/handleEscape`（`:589-610`），最后可能 reset shell 或调用 `enterLayer`（`:612-619`）；另有非 Escape 的 `alt+ArrowLeft` listener（`:689-698`）。 | 当前 Escape 优先级分散在状态、DOM 和 owner 三处；局部 listener 仍可能在同一按键中关闭第二层。 |
| Workspace disclosure | `closeWorkspaceDisclosure` 位于 `App.tsx:327-339`，通过 `document.activeElement.closest('.agent-settings, .agent-activity-log')` 找到展开按钮并调用 `trigger.click()`，下一帧 focus trigger。 | 用 DOM 推断 surface，且与 coordinator stack 没有原子事务。 |
| OverlayAdmission | `apps/web/src/lib/overlay-admission.ts:3-19` 只声明 `OverlayKind = 'dice' | 'radial' | 'dialogue'`；`:26-75` 检查 world availability、dialogue 与 Nook 冲突，token release 用 `Set.delete` 幂等（`:62-70`）。 | admission token 不是 focus token；当前没有统一 close callback 或 topmost 记录。 |
| Dice/radial 接线 | `App.tsx:505-515` 对 `dice` 请求 admission、保存 `diceAdmissionRef` 并播放 ceremony；`:876-881` 的 `closeRadial` 释放 radial token；`App.tsx:1006-1015` 只负责 radial admission，`RadialMenu` 实际挂载在 `App.tsx:1235` 附近。 | App Escape 依赖 `ceremony`/`radialState` 的先后判断，而非一个事务。 |
| DeclaredActionDialog | `DeclaredActionDialog.tsx:96-100` mount 时 focus 第一个 button、unmount focus `previous`；`:144-169` 是 `createPortal` 到 `document.body` 的 backdrop，`:154-157` 在 bubble `onKeyDown` 中自行 `onClose` + `stopPropagation`，并在同一 handler 做 Tab trap。 | Portal 的 React 事件路径与 document/window native listener 叠加；一次 Escape 可能先被局部关闭再被 App 处理。 |
| PhotoDetailDialog | `PhotoDetailDialog.tsx:47-89` 通过 `document.addEventListener('keydown', onKeyDown, true)` capture 监听 Escape/Tab；Escape `preventDefault/stopPropagation` 后调用 `closeHandler.current()`（`:53-58`），卸载按 `returnFocusRef` 或 previous（`:81-88`）；`:93-133` portal 到 `document.body`。 | 它拥有第二个 document-level Escape 真相；卸载焦点与 App transaction 没有共同的关闭 epoch。 |
| GateThreshold | `GateThreshold.tsx:10-20` 订阅 `airp:gate-feedback`，另装 window bubble Escape listener（`:13-18`）清除 beat；`main.tsx:6,20` 将 `<GateThreshold />` 作为 `App` 的 sibling 挂载。 | 它拿不到 App 的 coordinator；一次 Escape 先清 gate beat，随后可能退 layer。 |
| CharacterModal | `CharacterModal.tsx:135-141` mount focus `modalRef`；`:489-494` 通过 220ms timer 延迟 `onClose`，重复调用被 `closeTimer` 抑制（`:491`）；`:720-732` 清理语音/timer，但 `streamTurn`（`:474-481`）没有清理 close timer；`:780-792` 是 `role=dialog`、`aria-modal=true`，但无 Escape listener 和统一 return-focus。按 15 §10 裁决，CharacterModal 是 overlay-only，不新增 projection marker。 | close 动画期间 owner 若先注销，下一次 Escape 会穿透；modal 自己无统一 return-focus，迟到 close timer 还可能触发卸载后的 callback。 |
| Nook | `NookView.tsx:42-70` 的 `onClose` 明确由 App 拥有；`:439-447` root 有 `data-airp-projection`、active marker、`aria-hidden/inert`，`:482-490` Back 按钮直接 `onClose`；Nook 不安装 keydown listener。 | Back 与 Escape 可能走两个时序；必须保持 Nook 只拥有当前 projection，不自建 focus 真相。 |
| Agent activity | `AgentActivityLog.tsx:42-50` 展开时 `focus.acquire('workspace')`，`:51-69` mount focus panel、关闭回 toggle 并 cleanup token；`:104-110` 和 `:124-130` 各自处理 Escape。`ActivityRail.tsx:2-10,25-53` 是 `role=status`、`pointer-events:none` 的状态 rail，不是 focus surface。 | ActivityLog 的两个局部 Escape handler 与 App listener 可重复关闭；`ActivityRail` 不应被误登记为 owner。 |
| 其他已有局部 Escape | `AgentSettings.tsx:74-99` 在 panel `onKeyDown` 关闭并 acquire `workspace`（`:16-28`）；`TtsSettings.tsx:39-52,79-103` 同样 acquire `workspace` 并在 portal panel 的 `onKeyDown` 关闭；`WorldLauncher.tsx:256-274` 以 window capture 处理 opened/onClose。 | 同一 owner 被多个局部实现消费；WorldLauncher 的 capture 会抢在 App 之前。 |
| 当前嵌套 projection | `App.tsx:852-875` 的 `openCharacter` 从 layer/Nook push dialogue；`:894-910` 的 `closeCharacter` 发 `character_stop`、release admission、清 frame 并 pop camera；`App.tsx:941-976` 在 Nook/character active 时把底层 projection `inert`。 | close 回调若不先进入事务，可能同时清 dialogue、Nook 或 parent layer。 |

以上“现状”均为当前源码证据；目标行为不是现状的暗示。

## 4. 权威层级与边界

1. 首先服从 `docs/ux/15-下一批共同上下文.md:33-43` 的权威层级：世界/动作结果 > 共享协议与冻结契约 > HTTP/WS > 前端 store/reconcile > 演出。
2. 然后服从 `docs/ux/15-下一批共同上下文.md:77-82`：Escape 只关闭当前 topmost 可关闭 owner，一次最多一次关闭；局部组件不得绕过 coordinator；不扩张 `FocusOwner` 集合；capture/bubble、portal、stopPropagation、注销和 return-focus 必须可测。
3. `docs/ux/00-共同上下文.md:18-29,73-84,95-119,121-126` 冻结一个 active projection、Depth 和事实先于演出；Focus/Escape 不得改变世界事实、相机事实或动作结果。
4. `docs/ux/03-Chrome与公开状态.md:119-136,156-181` 是当前 owner 表、modal/inert 和既有 Escape 顺序的上位 UX 约定；本文件细化其事务，不另造 `WriterState` 或第二 modal stack。
5. `docs/ux/15-下一批共同上下文.md:116-125` 已冻结本批评审裁决：保持八个 owner、同一 coordinator 的 surface lease、CharacterModal overlay-only，以及 `dialogue → workspace surface（含 belongings 内容）→ Nook → shell → parent` 顺序；本文按此裁决细化事件事务。`docs/ux/02-舞台Depth与演出归属.md:274-300` 与 `docs/ux/05-Nook投影与相机连续性.md:124-144` 提供其余 Depth/Nook close 边界。
6. `docs/ux/01-全局视觉语法.md:213-245` 要求 reading/dialogue 关闭后回连续舞台，`docs/ux/04-动作语义与事实反馈.md:301-334,359-371` 要求 Escape 不改变动作结果、失败可恢复；`docs/ux/06-Agent演出状态与角色剧场.md:210-218,220-238` 冻结 CharacterModal 的 stop/退场边界；`docs/ux/07-声画偏好与性能接缝.md:208-219,267-276` 要求取消/隐藏保留事实并不补播装饰。
7. `docs/doc-06-演出与交互设计.md:207-221,244-250,383-386,411-415` 提供用户语义：角色单击进对话、门双击进场景、Escape 对称退回；关闭对话后才能揭示世界后果。

**本文负责：**统一 surface registration、Escape 一次性事务、事件阶段、DOM/portal 边界、焦点捕获/恢复、注销竞态。

**本文不负责：**动作成功/失败、`character_stop` 是否真正完成、`world_event`、CameraMemoryStack 的数据、演出成功音、Nook API、WS payload、Depth 数字、TTS 或音频策略。

## 5. 保持既有 FocusOwner 集合与唯一接线

### 5.1 集合结论

**保持现有八个 `FocusOwner`，不新增 `dialogue`、`photo`、`gate`、`activity`、`launcher` 等 owner。** 多个局部表面属于同一 `workspace` owner 时，使用 coordinator 内部的 surface registration（同一 coordinator 内的局部栈），而不是另建 document-level stack。`FocusEntry` 的 owner/token 语义保持，现有 `handleEscape()` 的 owner-only 行为保持，已有测试仍应通过。

### 5.2 每个组件唯一接线

| 表面/组件 | 唯一 owner | 唯一登记/关闭路径 | 不允许 |
|---|---|---|---|
| Layer 普通工作区与无表面的 shell | `workspace` | App 统一注册 `workspace` fallback；没有 surface 时才让 coordinator owner fallback 关闭 shell/parent layer | 子组件 document/window Escape |
| `WorldLauncher` | `workspace`，优先级最高的 workspace surface | App 在挂载 `WorldLauncher` 时登记；Escape 由 App close `opened` 或 `onClose`；移除 `WorldLauncher.tsx:256-274` window capture | Launcher 自己 close parent 与 world 一起退 |
| `WorldShelfDialog` | `world-shelf` | App 的 `worldPickerOpen` 变更登记/注销；关闭只 `setWorldPickerOpen(false)`；触发按钮由 App 保存 | 将 shelf 作为 workspace 或局部 listener |
| `BagItemDialog`（carried/inline） | `belongings` | App/`CanvasObject` 通过已有 `onClose` 接入 coordinator surface；`selectedBagPath` 或 `reading` 是唯一关闭 state；保留纸外 pointer close | 在 `BagItemDialog` 新增 Escape listener |
| `PhotoDetailDialog` | `workspace`（其实体阅读仍受 belongings/Canvas owner 约束） | `CanvasObject` 已有 `returnFocusRef={objectRef}`（`:315-322`）；新增 `focus`/registration prop（NEW）由 App→Canvas→CanvasObject 唯一路径传入；`onClose` 只走 transaction | 继续 document capture Escape |
| `DeclaredActionDialog` | `workspace` | `EntityInteractions` 的 `direct` state 是唯一实例；App→Canvas→CanvasObject→EntityInteractions 传 NEW registration adapter；portal 只呈现，不拥有全局 Escape | portal backdrop 自己 `onClose` 后再让 App close |
| `GateThreshold` | `workspace` 的非模态 dismissible surface | 从 `main.tsx` sibling 移到 `App` JSX，传 App 的 coordinator/registration（NEW）；`airp:gate-feedback` 仍是唯一 beat 输入；Close/Escape 都调用同一 dismiss transaction | 保留 `main.tsx` 第二装配点或 window Escape |
| `CharacterModal` | `character-dialogue` | `App.openCharacter` 登记；`handleClose` 进入 closing，220ms 后只由 App `closeCharacter` commit；Modal 接收 NEW `focusRegistration`/`returnFocus`，不监听 Escape | Modal 自己发 `character_stop` 之外的 parent close；卸载立即恢复旧焦点 |
| Nook root/Back | `nook` | App `openPrivateSpace/closeNook` 登记；Nook Back 仅调用传入 `onClose` transaction；Nook 保留 `inactive`/`inert` | NookView 自建 coordinator、camera 或 Escape listener |
| `RadialMenu` | `workspace` surface + 既有 radial admission token | App admission 成功后登记 `radial:<token>`；`closeRadial` 是唯一 release/close；菜单保持 pointer/mouse propagation 保护 | `RadialMenu` 自己监听 Escape或释放 token |
| Dice ceremony | 调用者 owner（通常 `workspace`；角色来源需按冲突项拍板）+ 既有 dice admission | `App` 在 admission 成功后登记 `dice:<token>`；`clearAdmittedCeremony` 是唯一 done/close/release；`DiceCeremony` 仍只呈现 | DiceCeremony 自己拥有 document Escape |
| `AgentActivityLog` | `workspace` | `focus` prop 继续来自 App；删除两个局部 Escape handler，展开/关闭只调用 coordinator registration；保留 panel→toggle return | `ActivityRail` acquire owner；把 `role=status` 当 dialog |
| `AgentSettings` / `TtsSettings` | `workspace` | 保留现有 `focus` prop；将 `setOpenState` 绑定 registration；TTS portal 由 App coordinator 统一处理；焦点回各自 trigger | 各自维护 token + Escape |
| profile popover | `profile` | App 的 `profileOpen` registration；关闭只 set false；保留 profile trigger | 以 DOM 后序猜 profile topmost |
| writer input/authoring | `writer` | App `syncFocus`/registration；Escape 仅 blur + `attention='ambient'` + 关闭 God Hand | 将 Escape 当 `writer_abort` 或 layer 返回 |
| journal/shell | `journal` 或 `workspace` fallback | App `toggleShell`/统一 router；Escape 清 journal/header/immersive，再下一次才 parent layer | 一次 Escape 同时 reset 全部 shell 并 enter parent |

`ActivityRail` 的唯一身份是状态投影（`ActivityRail.tsx:25-53`），不登记；`NookNoteComposer.tsx:83-95` 当前只有原生 input/textarea/form 接线，未实现独立的 Escape/IME handler，统一 router 必须补齐 input/composition 保护而不新增 owner。

## 6. 状态与接口契约

### 6.1 FocusCoordinator 保持的既有契约

以下真实接口继续存在且语义不改：`FocusOwner`、`FocusToken`、`FocusEntry`、`FocusCoordinator.acquire`、`release`、`peek`、`snapshot`、`handleEscape`、`subscribe`（`focus-coordinator.ts:1-30`）。`handleEscape()` 仍只释放 topmost owner，用于没有局部 surface registration 的兼容 fallback；App 的新统一入口不得先调用它再调用 surface close。

### 6.2 新增 surface registration（NEW，仍属于同一个 coordinator）

实现建议在 `apps/web/src/lib/focus-coordinator.ts` 扩展以下内部契约；名称和字段须经评审冻结：

```ts
export type FocusSurfacePhase = 'open' | 'closing'; // NEW

export interface FocusReturnHandle { // NEW
  capture(): void;
  restore(): boolean;
}

export interface FocusSurfaceRegistration { // NEW
  key: string;
  owner: FocusOwner;
  priority: number;
  root: HTMLElement | null;
  close: () => void;
  returnFocus?: FocusReturnHandle;
}

export interface FocusSurfaceLease { // NEW
  readonly key: string;
  readonly token: FocusToken;
  unregister(): boolean;
  markClosing(): boolean;
}
```

同一 `FocusCoordinator` 增加下列方法（NEW）：

```ts
registerSurface(surface: FocusSurfaceRegistration): FocusSurfaceLease;
peekSurface(): FocusSurfaceRegistration | null;
closeTopmostSurface(): FocusSurfaceRegistration | null;
```

契约：

- `registerSurface` 先调用既有 `acquire(surface.owner)`；相同 owner 仍只保留一个 `FocusEntry`，surface lease 可有多个但必须由各自 `key` 唯一标识。
- `peekSurface` 按语义 `priority`，同 priority 按 registration sequence 取最后者；不得读取 DOM z-index 或 React render 顺序推断 topmost。
- `closeTopmostSurface` 在 coordinator 内原子标记 surface 为 `closing`，最多调用一次 `close`，并返回 registration；它不自动调用 `handleEscape`，避免一次按键双重 release。
- `unregister` 可重复调用；最后一个该 owner 的 lease 注销后才 `release` 该 owner token。组件卸载、切世界、StrictMode cleanup 和 close timer 都必须走这个幂等路径。
- `root` 只用于 containment、focus trap 和 aria/inert 验证，不用于创建第二个 focus stack；portal root 是真实 panel，不是 React parent。
- `markClosing` 已为 closing 或已注销时返回 `false`，不再调用 callback。

### 6.3 App 统一 Escape router（NEW）

在 `apps/web/src/App.tsx` 内保留唯一 native keydown 装配点，并抽成 App-local 函数（或同等唯一 adapter）：

```ts
function dispatchEscape(event: KeyboardEvent): boolean; // NEW, App-local
```

`dispatchEscape` 必须是唯一会调用 `preventDefault()`、`stopPropagation()`、`closeTopmostSurface()`、`handleEscape()`、`closeNook`、`closeCharacter`、`enterLayer(parent)` 的 Escape 入口。它不发 HTTP、WS，不修改世界事实。

### 6.4 OverlayAdmission 的不变式

`OverlayAdmission.request/release/isActive/setWorldAvailable` 和 `OverlayKind` 保持（`overlay-admission.ts:3-19`）。它仍是 dice/radial/dialogue 的冲突门，不变成第二个焦点栈：

- admission token 只证明“该临时 overlay 可以存在”；FocusSurface lease 才证明“该表面可被 Escape 关闭”。两者由 App 在同一事务中创建/释放。
- `release` 继续幂等，迟到 cleanup 不能撤销新 token（现状注释与实现：`overlay-admission.ts:62-70`）。
- `closeTopmostSurface` 的 close callback 必须先确保对应 admission token 只释放一次；`clearAdmittedCeremony`、`closeRadial`、`closeCharacter` 是现有 release 入口，不能出现第二个释放入口。
- 新增 `OverlayKind` 或新 admission code 必须另行评审；普通 photo/declared/gate/activity 不伪装成 dice/radial/dialogue。

## 7. Topmost、优先级与关闭状态时序

### 7.1 语义优先级表

优先级首先按 15 §10 的冻结大类：`dialogue → workspace surface（含 belongings 内容）→ Nook → shell → parent`。下表的数值只实现大类内排序，不是 CSS `z-index`，不得把 workspace 的局部次序解释为新的 owner。

| 大类/次序 | surface/owner | Escape 行为 | 关闭 commit |
|---|---|---|---|
| dialogue（1） | `character-dialogue` / `CharacterModal` | 进入 closing；不关闭 Nook/layer，不再次发送 stop | 220ms timer 到期才 `closeCharacter`，或卸载 cleanup 取消 timer |
| workspace（2a） | `WorldLauncher`（`workspace`） | 先收起已打开 world brick；无 brick 时关闭 launcher（若无 `onClose` 则消费按键，不离开空 world） | `opened=null` 或 `onClose`，一次 |
| workspace（2b） | `world-shelf` | 关闭 shelf；不关闭 launcher、layer 或 world | `setWorldPickerOpen(false)` |
| workspace（2c） | blocking dialog：Photo、Declared、Bag、TTS/Agent settings | 只关闭该 surface；不调用 parent navigation | 对应 local state false/null |
| workspace（2d） | `dice` admission surface、Radial、Profile、Activity details、GateThreshold | 只清当前 ceremony/menu/popover/beat；不退 owner/layer | clear local projection，再按 token 释放一次 |
| Nook（3） | `nook` | `closeNook`；先保存 Nook target，再恢复 caller，再卸载 Nook，最后 refresh | App camera/projection transaction 完成 |
| shell（4） | `writer` / `journal` / header / immersive | writer：blur、ambient、关闭 God Hand；其他 shell surface 一次只收一项 | App state commit |
| parent（5） | parent `layer` navigation fallback（无 surface、非 map） | 只有没有可关闭 surface/owner 时才按既有 parent path 调 `enterLayer` | 等既有权威 enter outcome；不把 Escape 当成功 |

同一大类内按 `priority`，再按 registration sequence 取最新者；priority 只能表达该大类内的已冻结局部顺序。`dialogue` 永远先于任何 workspace surface；所有 workspace surface（包括 `belongings` 内容、dice/radial）永远先于 Nook。

规则：

- 对话 active 时新的 dice/radial 由 admission 拒绝，见冲突章节；这不是用 focus priority 越过 admission。
- `GateThreshold` 是可关闭 status popover，不是事实世界状态；清除它不得修改 gate 或 layer。
- portal 的 DOM 后序、CSS z-index、React effect 顺序都不能改变大类或同类 registration 顺序。

### 7.2 一次 Escape 的固定时序

1. **Capture ingress：**唯一 `document.addEventListener('keydown', listener, true)` 收到事件；若 `event.key !== 'Escape'`，不处理并让既有 Enter/Tab 逻辑按各自契约继续。
2. **组合态保护：**若 `event.isComposing === true` 或 `event.keyCode === 229`，立即返回 `false`；不 prevent、不 stop、不关闭、不 blur。
3. **重复/外部已处理：**若已进入本 dispatch 的 closing guard，或事件已经由宿主标记 `defaultPrevented`，不重复消费。实现必须用一次 event 的 guard，而不是跨事件永久吞键。
4. **选择 topmost：**调用同一 coordinator 的 `peekSurface/closeTopmostSurface`；surface 存在时原子标记 closing 并只调用一次 close callback。
5. **消费事件：**只有第 4 步真正返回 surface，才 `preventDefault()` + `stopPropagation()`；capture 阶段阻止 portal backdrop、组件 bubble handler 和 App 旧 fallback 再收到同一事件。
6. **owner fallback：**没有 surface 时才取 `focusCoordinator.peek()`；调用一次 `handleEscape()` 并按 owner 做一次 state close。没有 owner 时才清一项 shell；shell 也空且非 map 时才发起 parent navigation。
7. **return-focus：**关闭 callback 先标记 transaction；真正卸载后由 `FocusReturnHandle.restore()` 恢复一次。`CharacterModal` 的 220ms closing 期间仍保持 registration，下一次 Escape 被消费但不再次回调。
8. **异步结果边界：**Escape 不等待 HTTP/WS。Nook 的 camera/refresh 和 parent enter 继续由各自 adapter；失败只显示既有可见错误，不将关闭当动作成功。

## 8. 事件阶段、portal 与 stopPropagation

### 8.1 唯一 Escape listener

- 保留 App 的单一全局意图，但从 `window` bubble 改为 `document` capture；具体 listener 仍只在 App mount 一次，cleanup 对应一次。
- 删除/迁移以下 Escape listener：`PhotoDetailDialog.tsx:50-81` 的 document capture、`GateThreshold.tsx:13-18` 的 window bubble、`WorldLauncher.tsx:256-274` 的 window capture、`DeclaredActionDialog.tsx:154-157`、`AgentActivityLog.tsx:104-110,124-130`、`AgentSettings.tsx:76-82`、`TtsSettings.tsx:79-81` 的局部 Escape 分支。
- 局部 `onKeyDown` 可继续处理 Tab trap、Enter 提交和箭头历史，但不得处理 Escape；局部处理非 Escape 时是否 stopPropagation 只影响其原语，不影响全局 Escape transaction。

### 8.2 Portal 规则

`DeclaredActionDialog` 和 `PhotoDetailDialog` 的 portal 到 `document.body` 必须保留，因为它们需要脱离 Canvas stacking；portal 不等于新 focus owner。document capture 能收到 portal 内 native keydown，React synthetic bubble 也会沿 React tree 回传，因此：

1. Capture router 先消费 Escape；portal panel 的 bubble 不再调用 close。
2. panel/backdrop 的 pointer 语义保留：点击 backdrop 可发起同一 close transaction，panel `stopPropagation` 保留以免纸内操作触发纸外关闭。`DeclaredActionDialog.tsx:148-153`、`PhotoDetailDialog.tsx:97-112` 的 pointer/mouse 保护不可删除而误伤 Canvas drag。
3. `role=dialog`、`aria-modal=true`、panel `tabIndex` 和 focus trap 保留；`GateThreshold` 仍为 status surface，不伪装 modal。
4. portal 卸载前不能立即恢复 opener；由 lease cleanup 统一做 return-focus，防止局部 effect 与 App 重复 focus。

### 8.3 Nook/CharacterModal propagation

Nook root 保留 `aria-hidden/inert`（`NookView.tsx:439-447`），CharacterModal active 时底层 layer/Nook 继续由 App 标记 inert（`App.tsx:941-976`）。CharacterModal 内 pointer/line-stage 事件不能传播到 Canvas；Escape 由 capture router 消费，不需要 `CharacterModal` 自建 listener。Nook Back 的 click 只调用传入 `onClose`，该 callback 必须是 App transaction，而不是直接 set state。

## 9. input、composition 与 contenteditable 保护

定义 App-local 判断函数（NEW，签名须冻结）：

```ts
function isTextEditingTarget(target: EventTarget | null): boolean; // NEW
function isComposingEscape(event: KeyboardEvent): boolean; // NEW
```

行为：

- `isComposingEscape` 对 `event.isComposing` 或 `event.keyCode === 229` 返回 true；组合期间 Escape 不 close、不 blur、不触发 `trigger.click()`。
- `isTextEditingTarget` 识别 `HTMLInputElement`、`HTMLTextAreaElement`、`HTMLSelectElement`、`[contenteditable]:not([contenteditable="false"])`，以及必要时 `button/a/[role="switch"]` 的操作控件。contenteditable 不能只检测 `[contenteditable="true"]`，因为空值也表示可编辑。
- 对非 Escape 的 Enter/Tab，保留 App 当前 `target?.closest('input, textarea, select, button, a, [role="switch"], [contenteditable="true"]')` 保护（`App.tsx:568-569,621-631`），但实现应扩展为上述完整 contenteditable 判定并以 `guardImeKey` 语义为准。
- 对非组合态 Escape：如果有 topmost surface，照常关闭该 surface；输入控件不是“永远禁止 Escape”的例外，否则 Photo/Declared/NookNote 无法退出。若没有 surface 且 owner 为 `writer`，只执行 blur/authoring close；不得 parent navigation。
- `NookNoteComposer` 的 title/body 编辑和 `CharacterModal` speech input 必须在 composition 中不发送；CharacterModal 已在 `:884-887` 使用 `guardImeKey`，该保护不能被集中 listener 改写。
- `event.target` 可能是 shadow/portal 内节点；取最近可识别 HTMLElement 仅用于输入保护，不可用它推断 topmost。

## 10. Focus return、focus trap 与卸载竞态

### 10.1 Capture 与 restore

每个登记 surface 在打开 transaction 的第一步捕获 `document.activeElement`，并记录 `FocusReturnHandle`（NEW）：

1. `capture()` 只接受当时属于当前 active projection、不是 `body`/已 inert 的 HTMLElement；Photo 继续优先使用已有 `returnFocusRef={objectRef}`（`CanvasObject.tsx:315-322`）。
2. surface mount 后 focus 首个可用 Close/内容节点：Declared 的首 button（现状 `:96-100`）、Photo 的 close button（`:47-50`）、AgentActivity panel（`:51-60`）可保留其目标；CharacterModal 先 modal root，再在 `inputReady` 时 focus input（`:727-732`）。
3. Tab trap 只限制当前 `root`，焦点不能落到 inert 的 layer/Nook、旧 portal 或 body。Declared/Photo 现有 Tab trap 逻辑保留但删除 Escape 分支；CharacterModal 需要补 root-scoped trap（NEW implementation seam），不能以全局 `querySelectorAll` 扫描其他 surface。
4. close commit 后在 DOM commit 的下一帧调用 `restore()` 一次；优先 opener/ref，条件为 `document.contains(node)`、无 `hidden`、无 inert ancestor、可见 rect 且 `tabIndex`/native control 仍可聚焦。
5. opener 不可用时按 fallback 顺序：当前 active `CharacterModal` close/parent trigger（若尚存）→ 当前 Nook Back（仅 Nook）→ 当前 layer projection root 的明确 `data-focus-fallback`（NEW marker）→ `document.body` 最后兜底。body 兜底只在无可达工作区时使用，不能让焦点悄悄落到旧 layer。

### 10.2 关闭动画与卸载竞态

- `CharacterModal.handleClose` 的 220ms 动画是 open surface 的 `closing` 阶段；registration 直到 `onClose` commit 都保留。close timer cleanup 由 `streamTurn`/lease cleanup 统一取消，不允许 timer 迟到后再调用已卸载的 `closeCharacter`。
- React StrictMode 的 mount/unmount/mount 不能产生两个 owner token、两个 admission token 或两次 return-focus；lease 用 key + disposed guard，cleanup 重复返回 false。
- 切世界时 `loadWorld` 已清理 frame/camera（`App.tsx:710-715`）并重置 modal state（`:731-737`）；设计要求先注销旧 surface、取消旧 return-focus，再挂新 world，禁止把旧 opener 恢复到新 world。
- 快速 A→B Nook/Character：新 transaction 拒绝旧 closing callback；旧 camera/refresh Promise 完成时不能重新注册旧 owner。相机恢复仍遵守 A05，不在此文添加 token。
- `onClose`、纸外 pointer、Close button、Back button 和 Escape 均调用同一 lease close；多入口竞争由 `markClosing()` 抑制第二次 callback。释放 admission 和 owner token 必须在统一 commit/cleanup 中完成。

## 11. 逐步行为与漏接后果

### 11.1 打开普通 portal surface（Photo/Declared）

1. 触发实体保持既有 inspect 语义；App/Canvas adapter 捕获 opener，生成唯一 `key`，向同一 coordinator `registerSurface`。**漏接：**无 opener，关闭后只能猜 DOM；两个实体可能共享错误焦点。
2. panel mount 到 portal root，设置 `role=dialog`、`aria-modal`、root ref、focus trap，并在下一帧 focus close/首控件。**漏接：**读屏和键盘仍可进入底层 Canvas。
3. Escape capture 取得该 surface，标记 closing、阻止后续传播，只调用一次 `onClose`。**漏接：**局部 bubble + App fallback 可能同键关闭两层。
4. local state 卸载后 lease cleanup release owner；下一帧 restore opener/ref。**漏接：**focus effect 与 coordinator 各 restore 一次，焦点跳走或回旧卡。

### 11.2 CharacterModal 在 layer/Nook 上方

1. `openCharacter` 仍按 `App.tsx:852-875` admission/camera/frameQueue 顺序进入；同时登记 `character-dialogue` surface，底层保持一个 Canvas。**漏接：**dialogue 可见但 owner 仍是 Nook，Escape 会先退 Nook。
2. capture Escape 只标记 dialogue closing；不调用 Nook/layer close，不重复发 `character_stop`。**漏接：**一次按键同时清 activeCharacter 与 nookChar，错误恢复 layer。
3. 220ms 后现有 `closeCharacter` 完成 stop/release/frame/camera pop；只在 commit 后注销 lease 和 restore Nook/layer opener。**漏接：**关闭动画中 restore 会看到旧 projection，迟到 timer 会二次 pop。
4. dialogue 关闭后底层仍按 A05 active marker/inert 事务恢复；return-focus 只回原角色实体或 Nook trigger。**漏接：**焦点落在被卸载的 modal 或旧 layer。

### 11.3 Nook Back/Escape

1. Nook root registration 是 `nook` owner，Canvas 是唯一 active projection；Nook Back 传入 App close callback。**漏接：**NookView 直接 set state 会绕过 camera stack。
2. Escape/Back 进入同一 `closeNook` transaction，先标 closing；第二次点击/按键只消费，不再回调。**漏接：**一次返回可能重复 pop/refresh。
3. App 先保存 Nook camera target、恢复 caller slot、卸载 Nook、切 active marker，最后按现有 `refresh`。**漏接：**Nook 卡片与 layer 同时存在，或返回错误 parent。
4. restore focus 至 Nook opener（角色 rail / CharacterModal 的 Visit private space）或当前 layer fallback。**漏接：**关闭后用户失去舞台上下文。

### 11.4 GateThreshold/status 与活动详情

1. `airp:gate-feedback` 仍唯一设置 beat；App 内登记 workspace status surface。**漏接：**GateThreshold sibling 无法参与 topmost。
2. 活动详情打开只登记 workspace，`ActivityRail` 仍 `pointer-events:none`/`role=status`。**漏接：**状态 chip 抢焦点或 Gate status 被误当 dialog。
3. Escape 按 priority 只清活动详情或 Gate beat之一；不调用 gate enter、不改事实。**漏接：**同键清 beat 后又退 parent layer。
4. 关闭后回对应 trigger；若 trigger 已隐藏则回当前 active projection fallback。**漏接：**focus 回不可见 header。

## 12. 文件与副作用边界

| 文件/符号 | 设计落点 | 允许副作用 | 明确禁止 |
|---|---|---|---|
| `apps/web/src/lib/focus-coordinator.ts` `FocusOwner`/`createFocusCoordinator` | 保留 owner/token API；同一模块新增 surface lease registry（NEW） | 内存 stack、listeners、幂等 lease | DOM 查询、HTTP/WS、camera、world state |
| `apps/web/src/lib/overlay-admission.ts` `createOverlayAdmission` | 保留 admission kinds/token；与 App registration 同事务 | 内存 Set、world availability 冲突返回 | 自己监听 Escape、focus DOM、关闭 React state |
| `apps/web/src/App.tsx` `syncFocus`、`closeCharacter`、`closeNook`、Escape effect | 唯一 `dispatchEscape`、registration/return-focus orchestrator | React state、已有 camera/frame/admission callback | 新 WebSocket、动作结果解释、第二全局 listener |
| `apps/web/src/main.tsx` | 移除 sibling `<GateThreshold />` 装配，改由 App 唯一装配 | React mount | 第二 coordinator 或第二 Gate surface |
| `DeclaredActionDialog.tsx` | 新增 focus registration prop（NEW）；保留 portal、pointer、Tab trap、selection/action state | local selection/error/busy | Escape listener、world write、focus stack |
| `PhotoDetailDialog.tsx` | 新增 focus registration prop（NEW）；保留 `returnFocusRef`、portal、Tab trap | local visual/read state | document capture Escape、重复 restore |
| `GateThreshold.tsx` | 新增 focus/coordinator registration prop（NEW）；gate event listener 保留 | beat state、DOM cue class | window Escape、动作请求 |
| `CharacterModal.tsx` | 新增 registration/return-focus props（NEW）；保留 220ms close、voice/frame cleanup | local dialogue/timer/voice lifecycle | raw WS listener、camera、Escape close |
| `NookView.tsx` | `onClose` 只作 App callback；保留 root `inert`/projection marker | Nook fetch/measurement/Canvas callbacks | keydown listener、coordinator、second WS/camera |
| `AgentActivityLog.tsx` / `AgentSettings.tsx` / `TtsSettings.tsx` | 保留 `focus?: FocusCoordinator`，改用统一 registration；保留 panel focus/trigger return | local panel/config state | local Escape listener、独立 owner token 真相 |
| `WorldLauncher.tsx` / `RadialMenu.tsx` | 删除 Escape listener；pointer/mouse/contextmenu 关闭改调用 App transaction callback | local pan/opened/prompt | parent layer navigation、admission release |

## 13. WS/HTTP/前端接线闭环

### 13.1 前端闭环

`App` 是唯一 coordinator host：创建 `focusCoordinator`（`App.tsx:170-173`），把 registration 传给 `WorldShelfDialog`、`Canvas`/`CanvasObject` 下的 Photo/Declared、`CharacterModal`、Nook、Agent settings/activity、GateThreshold 和 Radial/Dice adapter。组件只报告 mount/open/close，不安装 document/window Escape。

`FocusCoordinator` 只维护内存 focus/surface；`OverlayAdmission` 只决定 dice/radial/dialogue 是否允许存在；两者 token 在 App 事务中配对。`useWorld` 仍是唯一 WS ingress，`CharacterModal` 仍只消费 queue；Escape 不创建或取消 WS/HTTP 请求。

### 13.2 HTTP/相机边界

- Photo/Declared/Gate/Activity/Bag 的关闭不发 HTTP，不把关闭当动作成功；正在进行的 `onSubmit`/choice 继续按动作文档决定取消/失败，surface close 只撤回阅读焦点。
- Nook close 继续调用既有 `cameraStack.popTransition/restoreProjection` 与 `refresh`（`App.tsx:308-318`）；focus transaction 只保证调用一次和 return-focus，不重定义相机顺序。
- Character close 继续既有 `character_stop`（`App.tsx:894-910`）；前端只显示 stop request/关闭状态，不宣称后端已停止。
- admission 拒绝仍由现有 `notify(admission.message)` 可见；不得用 Escape 绕过 dialogue/Nook admission。

## 14. 错误、取消、重试

| 情况 | 设计行为 | 漏接后果 |
|---|---|---|
| Escape 在 IME composition | 不消费事件，保留输入组合 | 文字被截断、浏览器候选框异常 |
| close callback 抛错 | coordinator 仍保持 closing/disposed，报告已有可见错误路径；不自动 retry close | 同一次 Escape 无限重复副作用 |
| admission 被拒绝 | 不登记 surface、不占 owner token；沿现有 message 可见反馈 | 产生不可关闭的 phantom overlay |
| 组件先卸载再 cleanup | lease `unregister` 幂等；若 opener 不在 document，使用当前 projection fallback | focus 回旧 world 或调用已卸载 callback |
| close timer 迟到 | transaction epoch/disposed guard 丢弃迟到 callback | CharacterModal 二次 stop/camera pop |
| rapid open/close/reopen | key/lease 唯一，旧 lease 不得关闭新 key；新 surface 以新 registration sequence 参与 topmost | 旧 close 关闭新面板 |
| world switch/WS reconnect | 先清旧 registration/return-focus，再依既有 state 重挂；不把旧 owner 带入新 world | 新 world 被旧 Escape 或旧角色帧污染 |
| retry | Escape 不触发 retry；错误面板的 Retry 是显式 button，先关闭当前错误表面再提交 retry | 把 Escape 误当动作重试，重复请求 |
| browser Back / OS close | 不伪造为 Escape；由既有 navigation/lifecycle adapter 处理，close cleanup 仍幂等 | 关闭事务与浏览器历史互相退两层 |

## 15. 与现状差异

1. `App.tsx:566-635` 的 `window` listener 改为唯一 `document` capture router；局部 Escape listeners 全部删除或仅保留非 Escape 键处理。
2. `FocusOwner` 八成员和既有 `FocusCoordinator` owner API 不变；新增的是同一 coordinator 内 surface lease registry，不是第二个全局 stack。
3. `OverlayAdmission` 的 dice/radial/dialogue 形状不变；App 将 admission token 与 surface lease 成对管理，close/release 只有一个入口。
4. `GateThreshold` 从 `main.tsx` sibling（`main.tsx:6,20`）迁入 App 唯一装配，才能参与 coordinator；它仍只消费 `airp:gate-feedback`。
5. Photo/Declared/AgentSettings/TTS/WorldLauncher/ActivityLog 不再各自处理 Escape；pointer backdrop、Tab trap、Enter、IME 和 panel focus 仍按各组件语义保留。
6. CharacterModal 的 220ms close 不变，但 owner 在 closing 期间不注销；return-focus 从局部 effect 统一到 transaction commit。
7. Nook 不增加 owner/Canvas/WS；Back 只是 App close transaction 的显式等价路径。

## 16. 验收测试（含修复前必须失败的非空性断言）

### 16.1 单元/集成行为

1. **FocusOwner 集合不扩张：**导入 `FocusOwner` 的静态断言集合恰为八项；现有 `overlay-admission.test.mjs:16-36` 仍证明同 owner acquire 幂等、`handleEscape` 一次只移除 topmost。
2. **surface 同 owner 可排序：**注册两个 `workspace` surface（不同 key/priority），`peekSurface` 返回高 priority；同 priority 返回后注册者；注销任一个不释放仍被另一个使用的 workspace token。
3. **一次按键一次关闭（必须非空）：**fixture 打开 `GateThreshold` beat 且当前 `layer !== 'map'`，按一次 Escape；必须只清 beat，`enterLayer` 调用计数为 0。**修复前 `GateThreshold.tsx:13-18` 的 window listener 与 `App.tsx:566-619` 的 App listener 并存：App 先可进入 parent navigation，随后 Gate 才清 beat；因此该断言在修复前必然有“错误层/双关闭”非空反例。**另以 `profile + world-shelf + CharacterModal` 连续三次 Escape 验证每次恰减一层，覆盖 `App.tsx:589-610` 的 owner fallback。
4. **错误层反证（必须非空）：**从 layer 进入 Nook，再打开 CharacterModal；按一次 Escape 后 `activeCharacter` 关闭、`nookChar` 仍存在、camera stack 仍指向 Nook。**修复前将 App listener 与 Nook/Character 局部 close 组合，存在先退 Nook/错误 parent 的失败样本；测试必须先在旧实现失败。**
5. **radial/dice 优先级：**同时保留 radial 与 dice admission，第一次 Escape 只 clear dice，第二次只 close radial；admission token release 各恰一次。
6. **owner 注销：**surface 未显式 close 直接卸载，`snapshot()` 不残留 owner；重复 cleanup 返回 false，不调用 callback、不产生第二次 return-focus。
7. **closing 幂等：**CharacterModal 连按 Escape、点 Close、再点 Back；只发生一个 `closeCharacter` commit、一个 `character_stop`、一次 camera pop、一次 focus restore。
8. **portal propagation：**Photo/Declared portal 内按 Escape，capture router 收到一次；组件 bubble 不再额外 close；点击 panel 内按钮不触发 backdrop close，点击 backdrop 恰一次 close。
9. **Gate sibling 修复：**从 App 渲染 GateThreshold 后，`airp:gate-feedback` 打开 beat；一次 Escape 只清 beat，不触发 `enterLayer`；修复前 sibling listener 会在 App fallback 下产生第二关闭，断言必须能区分。
10. **return-focus：**打开 Photo 回实体 `objectRef`；打开 Activity 回 toggle；打开 Character 回原角色实体/Nook trigger；卸载 opener 后回当前 active projection fallback，不 focus 旧节点。
11. **overlay admission 保持：**沿 `apps/web/test/overlay-admission.test.mjs:38-80` 证明 dialogue/Nook conflict、release 幂等和 world unavailable；新增 focus lease 不能让 admission conflict 失效。

### 16.2 input/composition 边界

1. 在 CharacterModal speech input `compositionstart` 后派发 `keydown Escape`（`isComposing=true` 与 `keyCode=229` 两档），断言输入值、active surface、focus 均不变。
2. 在 NookNoteComposer 的 `textarea` 组合期间按 Enter/Escape，不发送、不关闭；compositionend 后 Enter 仍按该组件 submit 语义，Escape 才按 topmost surface。
3. 在 `[contenteditable]`（无显式 `true` 值）、`input`、`select`、button、link 内按 Enter/Tab，App 不把它当全局 authoring/immersion；普通非组合 Escape 只关闭当前 topmost surface。
4. 在普通 Canvas entity 上按 Enter 仍保留既有 inspect/enter 语义（`CanvasObject.tsx:292-303`）；在 writer input 内 Enter 只提交非空文本，busy 时不触发 Stop。
5. dispatch 同一 KeyboardEvent 不得调用两次 close；`defaultPrevented`/`stopPropagation` 证据必须显示只在真正有 surface 时设置。

### 16.3 Keyboard/browser acceptance

- Chromium 桌面 `1440×960`：Tab 进入 trigger→surface→Close；Escape 每次只退一层；焦点 ring 可见；Photo/Declared portal 不让 Canvas 响应 pointer。
- Chromium 窄屏 `1024×768` 与移动 `390×844`：WorldShelf、Nook Back、CharacterModal Close、Gate status、Activity details 在 safe-area 内可达；关闭后焦点不落到 hidden header 或底层 inert Canvas。
- 真实浏览器回放：`layer → Nook → CharacterModal → Escape` 回 Nook；`layer → Photo → Escape` 回原实体；`launcher → shelf → Escape` 先回 launcher，再下一次关闭 launcher；每步记录 `document.activeElement`, active marker、surface keys、owner snapshot。
- 读屏：`role=dialog` 的 `aria-modal`/label 正确；inert surface 不进入可访问顺序；Gate/Activity 使用 `role=status`/可见文案，不被说成动作成功。
- Browser event matrix：`document` capture、portal bubble、panel `stopPropagation`、backdrop click、window/React synthetic listener 共存时只产生一个 close transaction；移除旧 listener 的源码/运行时计数为 0。
- Firefox 至少跑 Photo/Declared/Nook/CharacterModal 的 Escape、Tab trap、composition、focus return；不得依赖 Chromium 的 portal 或 `inert` 偶然行为。

### 16.4 文档/静态验收

- 静态扫描确认 production 只有一个 Escape `document/window.addEventListener`，且仅在 App；所有局部 Escape 分支被删除或明确非 Escape。
- 扫描 `FocusOwner` 成员与表格双向相等；不得出现 `photo/dialogue/gate/activity/launcher` 作为新 owner。
- 运行时确认 `[data-airp-projection-active="true"]` 恰一个（沿 A05），FocusSurface registration 数量可与 visible dismissible surfaces 对应；`ActivityRail` 不注册。
- Dialogue 回放时 active marker 仍只属于底层 layer/Nook stage；`CharacterModal` 只验 `role=dialog`、`aria-modal`、focus registration 和底层 `inert`，不得出现第三个 `[data-airp-projection-active="true"]`。
- 每条测试必须包含“没有修复会失败”的断言；禁止永久 skip、接受未实现状态或只查源码 marker 伪造通过。

## 17. 发现的冲突 / 需要修订的上位文档

1. **`docs/ux/15-下一批共同上下文.md:79-82` 与现状多个 Escape listener 冲突。** 15 要求一次只关 topmost、不得绕过 coordinator，且必须可测 capture/bubble/portal；但 `PhotoDetailDialog.tsx:50-81`、`GateThreshold.tsx:13-18`、`WorldLauncher.tsx:256-274`、`DeclaredActionDialog.tsx:154-157`、`AgentActivityLog.tsx:104-130`、`AgentSettings.tsx:76-82`、`TtsSettings.tsx:79-81` 仍各自处理 Escape。本文提出唯一 App document-capture router；评审须确认 15/03 的“唯一 listener”措辞并回写旧文档。
2. **`docs/ux/03-Chrome与公开状态.md:173-181` 的 owner stack 与当前局部 surface 数量冲突。** 03 规定只维护八个 `FocusOwner`、Escape 顺序和 `App.tsx:317-353` 的旧风险；多个 `workspace` surface 无法由现有 `acquire` 表达，因为 `focus-coordinator.ts:47-50` 对同 owner 幂等。本文建议在同一 coordinator 增加 surface lease，而不扩 owner 集合；03 §4.2、§9 需回写“owner category + surface key”的双层模型。
3. **`docs/ux/03-Chrome与公开状态.md:179`、`docs/ux/02-舞台Depth与演出归属.md:294-300` 与 `overlay-admission.ts:41-54` 对 dialogue 内 dice 行为存在冲突。** 文档语义是 `dialogue > blocking dice` 且对话打开时底层 dice/radial 应拒绝；现状 admission 只在 focused 是 `character-dialogue` 且 caller 不同才拒绝（`:41-47`），而 `App.tsx:506` 对角色来源将 caller 设为 `character-dialogue`，因此 character-sourced dice 仍可能 accepted。本文建议默认拒绝 dialogue active 下所有非 dialogue-owned dice/radial；是否允许“角色对话内骰子仪式”必须由 perform/agent owner 明确，不得由实现代理猜。
4. **`docs/ux/15-下一批共同上下文.md:123-124` 已冻结 CharacterModal 为 overlay-only，并明确 active marker 只属于 layer/Nook stage；较早的 `docs/ux/05-Nook投影与相机连续性.md:95-105,124-144` 仍以 `dialogue:*` 作为逻辑 active projection 并在部分验收中要求 dialogue marker。** 当前 `CharacterModal.tsx:780-790` 无 projection marker，Nook/Layer marker 位于 `App.tsx:941-975` 与 `NookView.tsx:439-447`；实现应服从 15，不新增第三 marker，并回写 A05 的旧措辞。 
5. **`docs/ux/00-共同上下文.md:121-126` 与 `docs/ux/03:178-181` 要求一个 active projection、底层 inert；但 `GateThreshold` 在 `main.tsx` sibling，无法直接取得 App coordinator。** 本文建议把 GateThreshold 装配移入 App；这是接线位置修订，不改变事件 `airp:gate-feedback`。需回写 00/03 的“唯一 App 装配”描述。
6. **`docs/doc-06-演出与交互设计.md:209,248` 只说 Escape 对称退回，未规定组合态、一次 keydown、portal 和关闭动画；而 CharacterModal 当前延迟 220ms（`:489-494`）。** 本文将“对称退回”细化为 close transaction，且保留动画/事实时序；doc-06 应补一句“关闭动画期间再次 Escape 不退父层”。
7. **当前 `App.tsx:566-619` 的 radial→dice→owner→shell→parent 顺序与 `docs/ux/02:294-300` 的 dialogue/dice/radial 语义不完全一致；且 15 §10.5 已冻结更高层次的 `dialogue → workspace surface → Nook → shell → parent`。** 本文已改用该冻结大类；A02/A03 仍需回写其局部 admission 与 workspace 内次序，不能再以旧数字顺序实现。

## 18. 仍未知待拍板

1. Surface lease API 是否直接扩展 `FocusCoordinator`，还是在其模块内导出由 App 持有的同栈 adapter；无论选择哪种，都不能形成第二个 document-level stack。
2. `WorldLauncher` 与 `WorldShelf` 同属 workspace surface；两者同时挂载时的局部次序（先收起已打开 brick、再 shelf，还是打开 shelf 即卸载 launcher）及对应 return-focus 仍待 UI 评审，但不得越过 dialogue/Nook 大类顺序。
3. Dialogue active 时 character-sourced dice 是否是 dialogue-owned 合法 ceremony，还是一律 `dialogue_focused` 拒绝；需 perform/agent owner 给出 source 语义和浏览器证据。
4. CharacterModal 是否采用原生 `inert`、focus trap polyfill 或等价阻断；A05 已冻结语义但未冻结实现。
5. `FocusReturnHandle` 的 fallback marker 最终属性名（本文称 `data-focus-fallback`，NEW）与不可见判定是否统一使用 `getClientRects()`；需 accessibility 评审确认。
6. `GateThreshold` 在 workspace 大类内的局部次序（高于或低于其他 status/popover）仍待 UI 评审；无论选择哪一档，清 beat 都不得修改 gate/layer 事实。
7. 关闭动作若发生在正在提交的 Declared action / choice 中，是否允许 surface 立即卸载或必须保留 busy 直到请求终结；动作反馈文档负责，不由 Escape 文档猜。
8. Browser Back、Escape、移动端系统返回是否同一语义；本文只冻结显式 Escape/按钮等价路径，未将历史导航纳入 coordinator。
9. `document.activeElement` 在 portal、shadow root、虚拟键盘开启时的跨浏览器焦点读取差异；需 Chromium/Firefox 实测后冻结 fallback。

## 19. 实施顺序与文档回写清单

### 实施顺序

1. 消费 `docs/ux/15-下一批共同上下文.md:116-125` 已冻结的 owner 集合、surface lease、CharacterModal overlay-only 和 `dialogue → workspace surface → Nook → shell → parent` 大类顺序；评审只需冻结 workspace 内局部次序与 §17 冲突回写，未冻结项不实现。
2. 扩展同一 `focus-coordinator.ts` 的 surface lease（保留既有八 owner/API），补单元测试：同 owner、topmost、注销、closing 幂等。
3. 在 App 建立唯一 `dispatchEscape` 与 `FocusReturnHandle` adapter；把现有 `syncFocus`、radial/dice/character/Nook close 接到 lease transaction；删除 App 旧“状态逐个清理”顺序。
4. 先迁移 portal/局部 dialogs：Photo、Declared、Bag、AgentActivity、AgentSettings、TtsSettings；只删除 Escape 分支，保留 pointer/Tab/IME/动作逻辑。
5. 将 `GateThreshold` 移入 App 唯一装配，迁移其 registration；删除 `main.tsx` sibling 与局部 listener。
6. 迁移 WorldLauncher、Radial、Nook Back、CharacterModal closing/return-focus；保证 Nook/Dialogue camera/projection 时序仍完全由 App/A05 所有。
7. 运行 focus/overlay 单元与浏览器 keyboard matrix；先验证失败 fixture 在修复前确实非空，再验证修复后归零/恰一次。
8. 只在本功能相关的浏览器/契约门禁范围内回放；跳过项目级 build/test/lint/check（本设计阶段不运行）。

### 实现完成后的文档回写

- `docs/ux/15-下一批共同上下文.md:77-82,116-125`：写入已冻结的 surface lease、唯一 App listener、Gate 装配与 dialogue/dice admission 结论。
- `docs/ux/03-Chrome与公开状态.md:119-181,297-320,339-379`：更新 owner 表为“八 owner + surface key”、Escape priority、input/composition、return-focus 和测试名称。
- `docs/ux/02-舞台Depth与演出归属.md:274-300,386-401`：回写 dialogue/dice/radial 关闭/ admission 唯一表及浏览器证据；不把 focus priority 写成 CSS z-index。
- `docs/ux/05-Nook投影与相机连续性.md:95-144,247-296,350-388`：回写 Nook/Dialogue close transaction、卸载竞态、return-focus 与 marker/inert 运行时证据。
- `docs/ux/06-Agent演出状态与角色剧场.md:210-218,220-238,267-275`：回写 CharacterModal close animation、IME/return-focus，不新增帧协议。
- `docs/ux/04-动作语义与事实反馈.md:301-334,359-371`：回写 Escape 只关闭 inspect/feedback projection，不改变动作 outcome、retry 或 authority gating。
- `docs/ux/00-共同上下文.md:121-126,244-254`：回写唯一 focus transaction 与冲突登记；若 marker 属性最终变化，连同 active projection 约束一起同步。
- `docs/ui/doc-06-演出与交互设计.md:207-221,244-250,383-386,411-415`：补一次 Escape 一次退层、composition 不截获、关闭动画不穿透的用户语义。
- 源码测试登记：`apps/web/test/overlay-admission.test.mjs` 增加 surface/lease 与“修复前双重关闭”用例名；浏览器回放记录 viewport、active owner/surface、active projection、focus target、Network/WS 是否无额外请求。
