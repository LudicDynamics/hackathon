# Quiet Canvas｜极简静默画布

## 命题

**让世界先呼吸，家具只在需要时出现。**

`Quiet Canvas` 把游玩页当作一张连续的暖灰纸，而不是一组面板。大标题、少量实体标记和一条事实回执构成默认舞台；工具被压到细线、编号和边缘触点里。记忆点是“安静的地图”：所有线条都像纸上留下的定位痕迹，唯一饱和色是 rust，用来指向可行动的下一步或区分状态。

这不是把控件透明化。默认态只留下玩家回答三件事所需的内容：

1. **在哪里**：`Salt Garden / low tide / Room 02` 位于顶栏和舞台标题。
2. **看什么**：`tide door`、`Mara`、`brass key` 以空间内标记存在。
3. **做什么**：底部唯一主入口 `What do you do?`，可点击、触屏点击，或用 `/` 快捷键聚焦。

## 页面构图

- **连续舞台（全屏）**：暖灰纸、低对比噪点和几条极淡的等高线；不放卡片网格，不用背景图片，图片失败不会损失信息。
- **顶部定位线**：左侧 `← Worlds` 负责返回世界目录；右侧只显示当前位置与 `Wake the margins`。品牌压到中间的微小署名。
- **舞台标题**：标题位于左上偏中，拥有最多留白。坐标与时间在右上形成不对称的平衡。
- **实体**：门、角色、钥匙散落在不同坐标。角色是圆形 presence marker，但没有空洞的肖像 slot；文本和状态始终紧跟标记。
- **事实回执**：左下细线上的 `World fact · landed` 常驻但弱化，显示最近一条可回访事实，并链接到只读 Activity。
- **行动线**：底部只有一条 hairline。默认显示 Writer channel 的 ready 状态和 `What do you do?`；展开后成为 Writer Channel 行动台，不再是普通聊天框。
- **手机构图**：390px 时标题转为更高的纵向留白，门→Mara→钥匙形成一条阅读路径；右侧圆形快捷 rail 保证 `Act / Mara / Bag` 可达，底部行动线继续可见。Worlds、位置和关闭入口仍在顶部安全区内。

## 渐进披露路径

- **边缘工具**：点击 `Wake the margins`、`focus to reveal`、或按 `?`，打开 Margin Tools。它收纳 Writer、Activity、Belongings，避免默认态被管理工具切碎。它不是 hover-only；按钮可被键盘和触屏使用。
- **Writer**：点击 `What do you do?`、Margin Tools 的第一项、手机 `Act`，或按 `/`。输入框自动获得焦点；Enter 与 `Send action` 是等价主路径。
- **角色**：点击或聚焦后按 Enter（原生 button），打开完整对话 sheet。台词区明确标为角色内容，`dialogue-note` 明确“不是 writer result”。可继续进入 Mara 的 nook，再通过 `Return to canvas` 退出。
- **物品**：舞台上的 `brass key` 是原生 `details/summary`，键盘可展开；Margin Tools 的 Belongings 也进入同一物品详情。`Use key on tide door` 是详情内唯一 action。
- **活动**：事实回执的 `Review activity` 或 Margin Tools 的 Activity 打开只读 trace；它放在独立 sheet，不与实时 Writer 状态竞争。

## Writer 状态与事实诚实度

这是静态 fixture，不连接真实后台，也不写入世界。页面用可观察的前端演示真实产品应保留的阶段边界：

| 阶段 | 页面表达 | 下一步/恢复 |
| --- | --- | --- |
| `ready` | Writer channel · ready for a small action | 打开行动台，描述一个动作 |
| `accepted` | 意图暂存，正在检查房间 | 可等待或点 Stop；尚无事实改变 |
| `processing` | writer 正在考虑门、钥匙和 Mara | Stop 仍可用；动效不是结果 |
| `landed` | `Fixture fact landed`，回执更新为可回访文字 | 去门边重读，或问 Mara 下一步 |
| `failed` | `No fact landed`，说明动作没有改变房间 | 用更小的动作重试，或回到画布 |
| `cancelled` | 在事实落地前停止 | 草稿仍在输入框，重新发送即可 |

输入含 `fail`、`forget` 或 `nothing` 的 fixture action 会走 `failed` 分支，其他非空动作走 `landed` 分支，便于验收两种路径。所有结果都带 `Fixture` 标识；不会伪装成真实世界已经发生。已落地（fixture）的回执可经 Activity 回访，失败/取消明确说明房间未改变。

## 动效与降级

- 只有 sheet / action panel 的进入使用短暂 `settle-in`；processing 只用文字和 rust 状态，不以旋转动画假装完成。
- `prefers-reduced-motion: reduce` 将所有过渡/动画压到近乎零；焦点轮廓、文本状态、关闭和表单仍完整。
- 双击空白舞台可切换 `Atmosphere on/off`，用于演示 Effects off。关闭后噪点、等高线和动画消失，颜色、文字、状态、焦点和操作路径不变。
- 无图片依赖；Mara 用字母标记，门和钥匙用文字/符号表达。任何媒体失败都不会阻断行动。
- 所有触点至少约 44px，原生 `dialog` 负责 Escape 关闭与模态焦点，表单、按钮、`details` 提供键盘等价路径。

## 评审入口

1. 直接打开 `index.html`。
2. 首屏查看位置、舞台标题、实体和底部主行动。
3. 点击 `What do you do?`，输入 `I tell Mara why I need the door`，观察 `accepted → processing → landed`。
4. 重新打开 Writer，输入 `fail`，观察失败状态与恢复提示；或在处理中点击 `Stop this attempt` 观察取消。
5. 点击 Mara 看对话，再进入 `Visit Mara’s nook`；点 Worlds、Bag、Activity 检查渐进披露。
6. 使用 Tab / Shift+Tab、Enter、Escape 与 `/`、`?`；调整到 390px 查看手机构图。

## 世界窗口与相机

静默不等于空白：舞台现在是一个没有可见边框的扩大 world plane。首屏看到 `Salt Garden / Room 02`，它只是当前视窗，不是世界边界。向右拖动画布可把视野带到同一平面更远处的第二空间 `The windbreak`，其中有一个可 inspect 的 `windbreak ledger`；桌面鼠标、触控指针和键盘均有路径。

- **指针 / 触屏**：在空白世界上按住并拖动平移；拖动开始后变为 grabbing。滚轮缩放；拖拽不会改写实体事实。
- **键盘**：先聚焦有可访问名称的 `World canvas`，方向键每次平移一个可读步长，`+` / `-` 缩放；底部 `Reset view` 恢复初始窗口。镜头控制不依赖 hover。
- **窗口标记**：固定在舞台边缘的 `WINDOW 01 · center` 会在向右移动后显示 `WINDOW 02 · windbreak`，并报告缩放百分比。它是相机回执，不是新的世界真相。
- **固定层**：顶部 Worlds/location、Wake margins、事实回执、Writer dock、手机 quick rail、dialogue 与抽屉都在 world viewport 之外。它们不随 plane 移动、不定义 plane 的边界；打开或关闭 Dialogue、Nook、Worlds、Bag、Activity 不会 reset camera。
- **事实边界**：第二空间是静态 fixture，用于演示可探索的窗口，不代表后台已生成新地点。门、钥匙、Mara 的事实仍以文字回执和只读 Activity 为准；镜头位移和缩放不能代替 landed。

评审时可先拖动画布找到 `The windbreak`，再打开 Mara 对话或 Activity，关闭后确认仍停留在同一相机位置，最后点击 `Reset view` 回到 Salt Garden。