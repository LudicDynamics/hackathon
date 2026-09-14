# UX 下一批设计评审

> 评审范围：`docs/ux/15-下一批共同上下文.md`、`docs/ux/16-动作反馈与权威结果设计.md`、`docs/ux/17-Nook演出与投影生命周期设计.md`、`docs/ux/18-Focus与Escape事务设计.md`、`docs/ux/19-声画门禁与静态检查设计.md`
>
> 评审日期：2026-09-15
>
> 结论：**有条件通过，暂不能进入实现。** 四份模块设计的现状证据总体可靠，且已经暴露了实现前必须裁决的上位契约冲突；但 choice 语义、CharacterModal projection、Focus 优先级、主轨 hidden、readiness API、visual checker schema 和 targetless show 归属仍未冻结。实现代理不得自行选择这些方案。

## 1. 评审方法与总体结论

本评审按当前工作树逐项复核设计文档中的 file:line、真实符号、既有 UX/audio/protocol 契约和测试边界。复核结果：

- UX16 的动作入口、`actionKey` 递增后缀、`ActionFeedback` 尚无 stage/reconcile、`enterLayer` 将同层读取和失败折叠为 `null`、App/Nook/局部组件存在多套 adapter 等 load-bearing 事实均成立。真实路径是 `apps/web/src/components/narrative/EntityInteractions.tsx` 和 `apps/web/src/components/BagItemDialog.tsx`，不是 UX16 文档中写的 `components/entity/`、`components/bag/`。
- UX17 的 stable `PerformanceLayer`、唯一 `airp:show-frame`、Nook Canvas 与 layer Canvas 互斥、CharacterModal 当前是 dialog 且无 projection marker 等事实成立。其“同 resource 先 cleanup 再激活”的现状描述与实现相反：`PerformanceLayer.tsx:451` 先渲染新 show，`:453-456` 才清理旧同 key show。
- UX18 的八个 FocusOwner、App window/bubble Escape 路径和多个局部监听事实成立；但它关于 `NookNoteComposer` 已有输入 Escape 保护的描述不成立，组件目前依赖原生 form 行为；CharacterModal 的 `closeTimer` 也没有被 `streamTurn` 清理。
- UX19 的七个 renderer 门禁不对称、主轨没有 hidden pause/resume、checker 没有 `visual-literal` 和例外 schema 等事实成立。

因此本批不是“设计文档不足”，而是**设计文档已经足够暴露上位契约冲突，但还没有完成裁决**。

## 2. 阻塞项（实现前必须冻结）

### B1：choice 是直接执行还是先填 writer

- `docs/ux/04-动作语义与事实反馈.md:125-166,286-292` 和 UX16 按当前 App `/api/choice` 直连设计动作反馈；
- `docs/protocols/doc-20-工具与互动字段协议.md:262,277` 仍冻结沉浸式 UI 为“点击填入 writer，发送才 choose”，并要求 UI/Agent 共用动作函数；
- 当前实际 App 直连证据：`apps/web/src/App.tsx:957,995`，服务端玩家路由：`apps/server/src/routes/world.ts:1284-1308`。

必须裁决一种语义，并同批回写 UX04、UX16、doc-20、相关测试。不能让 coordinator 同时兼容两个含义。

### B2：CharacterModal 是 overlay-only 还是 active projection

- UX17 §3.2 选择 overlay-only，保留 layer/Nook marker，依据 `CharacterModal.tsx:780-790` 和 App 底层 `aria-hidden/inert`；
- `docs/ux/05-Nook投影与相机连续性.md:83-103` 仍将 `dialogue:<characterId>`列为逻辑 projection，并把 marker 唯一性写成三类 projection；
- `docs/ux/06-Agent演出状态与角色剧场.md:163-170,235-238` 仍需同步 dialogue overlay 与底层 stage 关系。

必须冻结 marker 表示的是 stage 还是 focus。推荐采纳 UX17 的 overlay-only，但在回写前不得实现 active marker、inert 和浏览器断言。

### B3：Focus surface priority 与既有 Chrome 顺序冲突

UX18 将局部 workspace surfaces 纳入同一 coordinator surface registry，但 `docs/ux/03-Chrome与公开状态.md:176-185`、`docs/ux/02-舞台Depth与演出归属.md:282-298` 对 Nook、dialogue、workspace blocking surface 的优先级仍不是同一张表。若 priority 数值和语义顺序不先统一，Escape 可能合法地关闭错误层。

必须冻结：surface priority、owner fallback、Nook→Character→Escape 的预期结果，以及 admission token 与 focus lease 的提交/释放顺序。

### B4：ActionFeedback stage/reconcile 与 UX04 旧 shape

- UX16 提出 `stage`、`reconcile`、`presentation` 三层；
- `docs/ux/04-动作语义与事实反馈.md:119-166` 仍以 `phase`/`outcome`/`status` 为公开解释，并将 accepted 映射到 succeeded；
- `docs/ux/15:51-67` 明确 accepted 不能等同于 reconciled。

必须冻结一个唯一玩家可见解释。推荐保留现有兼容字段但把 `reconcile` 作为成功演出的硬门禁，同时回写旧文档；不允许 App、Nook、演出层各自读取不同字段。

### B5：主轨 hidden 策略与 readiness API

- UX19 推荐 ambient/BGM/theme 保留 ref、hidden 时暂停、visible 后恢复当前 ref；
- `docs/ux/07-声画偏好与性能接缝.md:292-300` 和 `docs/audio/00-共同上下文.md:274-295,322-330` 尚未冻结该策略或 readiness snapshot API。

必须先由 audio owner 冻结：暂停/降音量/继续、`null`/failed/loading 三态、是否新增 public API。实现不能用 `audioDebugState.loaded` 猜 loading，也不能在 UX19 内静默新增 audio public surface。

### B6：visual checker schema 与 canonical token source

- UX19 提议在既有 `tools/check-ux-contract.mjs` / `tools/ux-contract.json` 中新增 `visual-literal` 和 `visualExceptions`；
- 当前 checker `tools/check-ux-contract.mjs:16,204-231` 无该 kind，contract 也没有 exception registry；
- `docs/ux/01-全局视觉语法.md:84-104,354-360,389-395` 尚留 canonical token 文件和例外 owner 为开放问题。

必须冻结 canonical source、literal 扫描范围、合法材质/插画例外 owner、过期策略和 failure fixture，再改 checker。禁止通过临时 allowlist 让当前代码假绿。

### B7：targetless `ShowFrame` 在 Nook 中的归属

`packages/shared/src/actions/show.ts:21-33` 的 `ShowFrame` 无 layer 字段，`apps/web/src/state/useWorld.ts:772-775` 只派发 frame。target show 可由当前 Canvas target 过滤，但 `lights_out` 等 targetless frame 在 Nook active 时没有来源字段。

必须由 perform/Nook owner 冻结“当前 active UI projection 即 targetless show 目的地”或进行正式协议变更。不得在前端私自增加 `layer` 字段。

## 3. 必须修订的设计文档事实

在实现开始前必须修订以下低风险但会误导落地的内容：

1. UX16 将 `EntityInteractions` 和 `BagItemDialog` 路径改为 `components/narrative/EntityInteractions.tsx`、`components/BagItemDialog.tsx`。
2. UX16 修正 `useWorld` 的 WS handler 范围和 `forwardWorldEvent` 行号；当前 handler 约从 `useWorld.ts:505` 延伸到 `:780`，forward helper 在 `:409-423`。
3. UX17 修正同 resource replacement 的现状顺序：当前是新 show render 在先、旧 show cleanup 在后；目标行为是否反转应标为实现差异，不写成现状。
4. UX18 删除或改写“`NookNoteComposer` 已有 Escape/IME protection”的断言；补充 `CharacterModal.closeTimer` 缺少 cleanup 的现状。
5. UX18 将 `RadialMenu` 挂载证据改为 `App.tsx:1235` 附近，而不是 admission handler `:1006-1015`；将 App 的 `alt+ArrowLeft` listener 纳入 listener 盘点。
6. 全部文档将用户目标路径 `apps/web/src/hooks/use-camera.ts` 改为真实的 `apps/web/src/state/useCamera.ts`，不能创建兼容别名。
7. 重新核对 UX02/03/05/06 的旧行号和 dialogue marker 表述。`check:docs` 能通过路径检查，但不验证行号和语义是否仍准确。

## 4. 可在裁决后并行实现的模块

以下边界清晰，可以在上面 B1-B7 冻结后并行派实现代理：

| 模块 | 实现边界 | 前置裁决 |
|---|---|---|
| ActionFeedback | canonical key、per-world coordinator、authority/reconcile、App/Nook adapter、enter outcome | B1、B4，另确认 doc-20/doc-21 事件证据 |
| Nook/Performance | stable App sibling PerformanceLayer、gate-change cleanup、Nook props、show/camera lifecycle、projection marker | B2、B7，以及 B5 的视觉 gate |
| Focus/Escape | surface lease、唯一 App capture router、组件接线、return-focus、卸载幂等 | B2、B3 |
| Media/Checker | renderer gate、audio epoch/readiness、literal schema、合法例外 registry | B5、B6 |
| 验收 | action parity、Nook/layer/dialogue browser replay、Escape/input、media matrix、checker failure fixtures | 所有前置裁决 |

## 5. 验收门

实现阶段必须至少满足：

1. App/Nook 同动作同 request body、outcome、reconcile 和 presentation gate；
2. accepted 在 reconcile 前不触发成功专属演出；rejected/conflict/failed 不产生成功 show/audio/unlock；
3. layer/Nook/dialogue 切换期间一个 active stage、一个 Canvas、一个 show listener，旧 response/show/camera 不落地；
4. 一次 Escape 只关闭一个 topmost surface，局部 listener 数量、portal、IME、contenteditable 和 return-focus 均有真实行为断言；
5. 每个 renderer 和每类 audio owner 都有 hidden/effects/reduced/stale/replace/cancel 证据；
6. checker 的 clean、failure、例外和过期 fixture 都能区分修复前后；
7. 新测试必须包含修复前会失败的非空断言，不得永久 skip 或接受未实现状态。

## 6. 评审结论

**有条件通过，不进入实现。**

设计文档可以保留为实现输入，但主代理必须先对 B1-B7 做裁决并回写 `docs/ux/15`、对应 UX 文档、`docs/protocols/doc-20/doc-21`、`docs/audio/00`、`docs/perform/05` 和 `tools/ux-contract.json` 的受影响部分。完成回写后再做一次短评审；短评审只需检查共享字段、事件、owner、marker、gate 和测试名的双向一致，不再重新扫描全仓。
