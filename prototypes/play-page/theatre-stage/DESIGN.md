# Theatre Stage

## 命题

**低照度剧场 / 舞台导演台**：世界是主景，玩家是导演。界面家具不围住画布，而像舞台侧幕、灯箱和 cue sheet，在需要时递出方向。记忆点是铜锈色的舞台边框与一束冷蓝的侧光；它们让“值得注意的对象”和“已经落地的事实”有同一套剧场语法，却不把动效当成结果。

## 页面构图

### 桌面

- 顶部 `top-lane` 是世界身份与低频控制：Worldlines、World / Act、当前世界、Journal、Effects、Immersive、关闭。
- 中央 `world-window` 是 viewport 相机，不是世界边界。它只截取连续的 `world-plane`；舞台边界退化为视野遮罩，玻璃拱、斜射灯和地面阴影仍用 CSS 画出暮色温室。
- 左侧 `left-wing` 是空间导航（Explore / Return）和场景索引；它不抢主舞台的纵向空间。
- 右侧 `right-wing` 是侧幕：在场角色、异地角色、活动 cue、Belongings。角色关系是可读的演出提示，不是第二个世界画布。
- 底部 `writer-booth` 是固定行动台。它把“Speak into the scene”和 `What do you do?` 放在同一行动区，输入、Send cue、状态链保持连续。
- `fact-receipt` 是一张独立的冷蓝侧幕回执，落在行动台上方；它不会冒充角色台词，且提供可执行的下一 cue。
- `reading-focus` 是点击场景实体后打开的聚焦阅读台：背景被压暗，信件内容、阅读备注和唯一后续动作集中在一张舞台纸页中。

### 390 × 844

手机不是桌面的缩小版：顺序改成“短顶栏 → 导航横带 → 主舞台 → 角色 / 活动侧幕 → 固定行动台”。右侧 rail 变成上下分幕的可滚动内容，Writer booth 变成底部单手可操作的两行行动台。聚焦阅读变成贴底 sheet，方便拇指回到 Close 或主要动作。

## 内容优先级

1. 我在哪里：`The Glass Orchard`、`South Conservatory`、dusk 状态。
2. 这里有什么：折叠信件（第一焦点对象）、service door、chalk trace、玩家当前位置。
3. 我能做什么：点击信件阅读，或在 Writer booth 发送一个明确意图。
4. 发生了什么：Writer cue 的 stage 链、侧幕活动、冷蓝世界回执。
5. 低频管理：Journal、Effects、Immersive、Belongings、activity log。

## 交互路径与真实状态

- 点击 `The folded letter` 进入 `FOCUS / READING`，这是一次明确的“聚焦 / 阅读”状态。面板中的文字是静态 fixture；它明确说明 service door 还没有打开。
- 点击 `Ask Mira...` 会关闭阅读台，把同一句意图放入 Writer 输入框；玩家仍需按 `Send cue`，没有重复的隐藏动作。
- 提交 Writer cue 会按可观察顺序演示：
  - `accepted`：意图已排队；没有世界事实变化。
  - `processing`：Writer 正在检查场景；明确写出“还没有落地事实”。
  - `landed`：世界回执出现，折叠信件获得冷蓝边界，回执写明一条可回访的新事实和下一步。
- `Show failure path` 会中断 fixture 处理并展示 `failed`：世界没有改变，可以修改意图后再次发送。它不把失败伪装成一段演出。
- 点击 Mira 会将输入聚焦并预填“ask Mira about the service door”；点击 Jonah 只显示“elsewhere”提示，不错误地启动对话。
- `Immersive` 隐去顶栏、左右侧幕，但不隐去 Writer 行动台；右上角 `Show stage controls` 与 Escape 恢复 chrome。这样沉浸模式仍有可发现的退出路径。
- `Effects` 关闭灯束与噪点，不移除场景、文字、焦点、状态或行动。`prefers-reduced-motion: reduce` 将所有过渡降至近乎即时。

## 状态与取舍

状态文字总是先给出当前 stage，再给原因和下一步；颜色只是辅助：暖铜代表 accepted / cue，冷蓝代表 landed / world receipt，烟灰代表未激活。活动流（CUES / LIVE）和世界回执（SIDE CURTAIN / WORLD RECEIPT）分开，避免实时活动与事实落盘混成一个“成功”灯号。

舞台使用固定几何、遮罩和细颗粒制造低照度质感；几何属于连续 world-plane，不是 viewport 的终点。不使用持续动画、图片请求或音效。灯束是氛围，不是因果；关闭效果后仍可读。只有聚焦层和回执占据前景，管理能力留在侧幕，避免黑色 dashboard 的多块卡片竞争。

原型使用静态 fixture，不向后台发请求、不写入真实世界；`landed` 只说明本原型演示到世界回执这一步，并在回执中给出可回访的文本证据。

## 连续世界窗口与相机操作

中央不是一张有尽头的舞台卡，而是一个 `world-viewport`：它只代表当前视野。`world-plane` 是更大的连续世界（1400 × 760 fixture），右侧藏着 `ACT III · BEYOND THE WINGS` 的 ferry landing 与 Ferry ledger / Bell rope 实体集群。默认相机只看南温室；第二幕不在首屏抢焦点，但一定存在于可探索的同一世界。

- 直接在世界空白处拖拽（触屏同样是按住移动）平移相机；聚焦实体仍由点击 / 键盘 Enter 完成，不让拖拽替代实体动作。
- 右上角灯箱提供 Zoom − / +、当前倍率与 `Recenter`；鼠标滚轮可缩放。聚焦 `world-viewport` 后也可用方向键平移，Shift 加大步长。
- `window 01 / 03` 与 `window 02 / 03` 是相机读数，不是新的世界状态；它只帮助玩家知道自己是否已离开南温室。`camera held` 表明关闭覆盖层后相机仍保留。
- `reading-focus`、世界回执与 Writer booth 都是 viewport 覆盖层。关闭阅读聚焦只恢复原触发实体焦点，绝不调用 `resetCamera`；沉浸模式只收起 chrome，也不重置相机。
- Effects off、reduced motion 或无媒体时，拖拽、按钮缩放、方向键和实体文本仍有效；相机移动不承担事实落地的证明。