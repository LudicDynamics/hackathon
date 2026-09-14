# Nook 立绘拖拽设计

> 状态：**已实现**（2026-09-15）。几何与持久化落在 `apps/web/src/lib/nook-portrait.ts`，状态提取在 `apps/web/src/lib/nook-status.ts`，组件落在 `apps/web/src/components/nook/NookPortrait.tsx`；行为测试 `apps/web/test/nook-portrait.test.mjs`、`apps/web/test/nook-status.test.mjs`。
>
> 本文服从 `docs/ux/15-下一批共同上下文.md`、`docs/ux/17-Nook演出与投影生命周期设计.md` 和 `skill://airp-natural-flow-direct-manipulation`。立绘是 Nook 中的高级头像与可移动表现层，不是世界事实，不进入动作层、事件账或 WS。

## 1. 玩家意图与主路径

玩家想把 Nook 右侧立绘移动到不遮挡卡片、note 或通话面板的位置。

- 主操作：按住立绘可见区域拖动，释放即提交本地布局位置。
- 触摸：使用同一 pointer path 和 pointer capture，不额外发明 touch listener。
- 键盘等价路径：聚焦立绘后，Arrow 键按 8 CSS px 微调，Shift+Arrow 按 32 CSS px 微调；`Home` 恢复默认位置；该路径与拖动共享同一 clamp、持久化和取消语义。
- 辅助技术：立绘容器必须是可聚焦、带角色名和当前位置提示的普通 group；拖动不应依赖动画、音频或颜色才能理解。
- 不允许 click 同时触发打开角色、移动和动作；点击但未发生位移不得执行世界动作。

当前实现事实（2026-09-15 落地后）：`NookView.tsx` 只在 `[data-nook-zone="character-media"]` 内渲染 `<NookPortrait>`；拖拽锚点、footprint clamp、keyboard 微调与 storage 隔离在 `lib/nook-portrait.ts`（纯函数）+ `NookPortrait.tsx`（pointer/rAF/事件）。`nook-character-media.css` 已从固定 `right/bottom` 改为 `--nook-portrait-x/y` 驱动的居中浮层。

## 2. 位置坐标与持久化

新增 `NookPortrait` 组件（NEW），由 NookView 传入：

```ts
interface NookPortraitProps {
  worldId: string;
  characterId: string;
  displayName: string;
  /** Real status only; the nameplate never falls back to the README title. */
  statusLine?: string | null;
  video?: string;
  poster?: string;
  enabled: boolean;
  hidden?: boolean;
  fallback: React.ReactNode;
}
```

### 2.1 名牌（2026-09-15 追加）

立绘结构为「媒体舞台 + 名牌」两段：`.nook-character-media` 纵向排列 `.nook-character-media__stage`（媒体，尺寸由 `--nook-portrait-w/h` 控制）与 `.nook-character-media__nameplate`（单行纸片）。名牌文案 = `displayName`，有真状态时追加 `, <status>`，形如 `Nanami, mid-thought.`；无状态时只显示名字。

状态只取角色的**真实** `status.data`（`lib/nook-status.ts: portraitStatusOf`），**不**回退到 README title——名牌已打印显示名，再回显 title 等于把同一身份写两遍。顶部存在核心条仍用 `statusLineOf`（真状态 → title → 省略）保持原契约。

> 落地差异（2026-09-15）：`reducedMotion` 与 `resolveAssetUrl` 未采纳。媒体 readiness 与 reduced-motion 由 `CharacterMedia`（`useStill`）与 CSS media query 承担，组件本身不再持有该 seam；按 §3「reduced/Effects off 不得禁用拖拽」，保留一个只读 prop 反而会诱导误用。

- 存储 key：`airp:nook-portrait:v1:${worldId}:${characterId}`；禁止只用 characterId，避免不同世界同名角色串位。
- 保存归一化 anchor `{ x: number; y: number }`，以 Nook stage viewport 为坐标系，范围 `[0,1]`；不保存每个 pointermove 的像素值。
- mount 时从 localStorage 读取并校验有限数值；非法、过期或跨版本值回到默认 anchor。
- 默认 anchor 保持当前视觉位置（desktop 右侧、窄屏底部居中），由 CSS/viewport measurement 计算，不写回卡片或相机坐标。
- 每次 viewport resize 重新 clamp；响应式布局不能把用户已提交的位置重置成默认。
- pointermove 只写 ref，并用 `requestAnimationFrame` 更新 DOM transform；React state 只在 pointerup 提交一次，避免高频 pointermove 进入 React state。

## 3. 交互阶段

```text
idle
→ dragging（pointer capture，位置只在内存）
→ committed（pointerup 后 clamp + localStorage）
→ idle
```

分支：

- pointercancel、Escape、失去 active stage、Nook 关闭或 unmount：丢弃本次未提交位置，恢复上一次 committed anchor；不得写 localStorage。
- pointerup 在 stage 外：仍以最后一个合法 captured 坐标 clamp 后提交，不依赖 release target。
- 同一 pointer 的重复 pointerup、lostpointercapture 和 unmount cleanup 必须幂等。
- worldId、characterId 或 active projection 改变时，先取消旧 drag，再读取新 key；旧 RAF/事件不得写新角色位置。
- Effects off、reduced motion、hidden 不得禁用拖拽；只影响媒体演出和过渡。媒体失败时仍保留可拖的 fallback。

## 4. 视觉与可访问性

- `.nook-character-media` 变为可交互浮层，立绘资源和 fallback 共用可聚焦拖拽容器；不改变 `CharacterMedia` 的媒体 readiness、voice 或 video owner。
- 当前位置不得遮挡 Nook note、left lane 和主要 Canvas controls；clamp 使用容器 footprint，而不是固定 `280/180` 或读取每帧布局。
- 拖动中显示最小的可选状态提示（如 `aria-live` 不应每帧播报）；释放后提供一次“位置已保存”公开反馈，失败 localStorage 不得伪称已保存。
- `aria-label` 必须包含角色显示名；`role=group`、`tabIndex=0` 和 keyboard nudge 仅表达布局，不把立绘伪装成世界实体按钮。
- 禁止新增 z-index 数字；使用既有 depth token 和 canonical `--ux-*`。

## 5. 与 Nook/演出边界

- `NookPortrait` 只控制自己的 presentation transform；不调用 ActionFeedback、gateway、useWorld、camera stack 或 WS。
- NookView 只传入 active world/character identity 和既有媒体 props；不为拖拽建立第二个 projection marker、Canvas、PerformanceLayer 或 global listener。
- `PerformanceLayer` 的 show、camera focus 和 projection marker 不随立绘拖动改变；拖拽不会回写排版卡片坐标。
- 位置 memory 与世界事实分离；世界切换使用 worldId key 隔离，角色离开 Nook 后旧位置保留，重新进入时恢复。

## 6. 失败、取消和恢复

| 情况 | 结果 | 用户可见反馈 |
|---|---|---|
| pointercancel / Escape | 恢复上次 committed 位置 | 不显示成功保存 |
| localStorage 不可用或写入异常 | 当前会话位置仍可用，刷新后回默认/上次可读值 | 显示“位置未保存”，不冒充成功 |
| 图片/video readiness failed | fallback 仍可拖 | 保留媒体失败状态，不阻塞布局 |
| Nook/world 切换 | 取消旧 drag，切换到新 key | 不把旧角色位置带入新角色 |
| hidden / reduced / Effects off | drag 仍可用，取消装饰性过渡 | 文本和键盘路径完整可用 |

## 7. 验收测试

必须包含修复前会失败的非空性断言：

1. pointerdown + pointermove + pointerup 后，位置变化并按 worldId/characterId 写入指定 key；旧固定 right/bottom 实现无法通过。
2. pointercancel 和 Escape 不写 committed key，且 DOM 恢复到上次提交位置。
3. 相同 characterId 在不同 worldId 下互不读取位置。
4. 键盘 Arrow/Shift+Arrow/Home 与 pointer drag 使用同一 clamp，且可在无 pointer device 时完成相同布局目标。
5. rapid Nook switch / unmount 后，旧 RAF、pointerup 和 storage completion 不修改新角色位置。
6. hidden、Effects off、reduced motion、媒体 failed 下容器仍可聚焦、拖拽和键盘微调。
7. world/layer Canvas、PerformanceLayer、projection marker 数量保持不变；拖拽不发 HTTP/WS/action request。
8. Chromium 在 `390×844`、`1180×960`、`1440×960` 验证不遮挡 note/left lane、无横向溢出，并回放 pointer、Escape、keyboard 三条路径。

## 8. 代码落点与回写

- 新建 `apps/web/src/components/nook/NookPortrait.tsx`；复用 `CharacterMedia`，不得复制媒体 readiness。
- `NookView.tsx:547-563` 仅替换 character-media 内部资源为 `NookPortrait`，同时传入 active `worldId`；props 来源必须由 App 现有 manifest identity 提供。
- 扩展 `nook-character-media.css` 的定位/拖拽状态和窄屏 clamp；不要改 global prototype depth。
- 新增同目录或既有 web test 的纯逻辑测试，并加入浏览器回放；不使用永久 skip。
- 完成后回写 `docs/ux/05-Nook投影与相机连续性.md`、`docs/ux/02-舞台Depth与演出归属.md`、根索引和本文件状态；若存储 key、keyboard mapping 或 fallback 语义改变，先更新本文再改代码。

## 9. 已解决的冲突 / 边界

- `worldId` 由 `App.tsx` 的现有 `manifest?.id` 提供；空值只禁用跨刷新记忆，不从 URL 或显示标题猜 ID。
- Nook 的 `[data-nook-zone="character-media"]` 仅作 `display: contents` 语义包装；实际拖拽宿主是 `[data-nook-zone="canvas"]` 的 `offsetParent`，避免读取 0×0 的包装 rect。
- 立绘位置是 Nook stage viewport anchor，不跟随相机记忆，也不写 `cards.x/y`；若未来要做“随镜头拖拽”，必须另开 camera 设计。
