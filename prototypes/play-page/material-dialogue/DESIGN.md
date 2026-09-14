# Material Dialogue / 材质化角色叙事

## 一句话命题

把游玩页做成一张**潮湿灯下的织物工作台**：深青绿的世界布面是持续存在的空间，纸张、缝线、铅笔痕和湿墨是不同责任层的同一套材质。角色不是聊天列表，而是画布上会牵动关系线的在场物；Writer 也不是聊天框，而是玩家向世界递交的一枚“标记”。

记忆点是角色卡、Chalk 和世界事实之间的细线：线可以提示关系，但只有落地回执才证明世界真的改变。

## 页面构图

- **顶部身份带**：`AIRP / FIELD NOTE 07`、World / Layer breadcrumb、awake 状态、Effects、Journal。它只回答“我在哪个世界”，不承载 Writer 或调试状态。
- **中央世界布面**：留出大块深青绿色空间，网格像织物经纬线。左上是地点标题与 `YOU ARE HERE`；角色、Chalk、物品和异地角色以倾斜纸卡落在空间中，细线把它们编成一张关系图。
- **角色在场**：Iris 位于左中，是可聚焦的主对象；Noor 位于右下，明确标为 `ELSEWHERE / muted`，点击只给提示，不伪造导航或对话。
- **世界内容**：Chalk 是“房间里的句子”，Brass ticket 是携带物品；两张卡都使用纸张边框，但内容层级不同：Chalk 是世界痕迹，ticket 是玩家可持有的对象。
- **活动 slip**：右侧窄纸条是低频的实时 trace，默认只显示 Writer ready 与 Iris presence；`details` 展开原始活动流，另有 fixture route 进入失败态。
- **Writer dock**：底部固定在画布安全区，使用深色织物表面。明确写出 `PLAYER → WRITER` 责任方向和“request, not a world fact yet”，输入是主行动。
- **Journal**：从顶部 Journal 打开左侧纸页，是回看层而不是第二舞台。
- **角色对话**：点击 Iris 进入全屏对话舞台。左侧 identity/status 纸面，右侧深布面承载 Iris 的 speech paper 与玩家输入；对话责任与 Writer 责任视觉分栏。
- **Nook**：从 identity 层的 `Visit Iris's nook` 进入整页角色私域。它不是套在画布上的暗色弹窗：纸面、角色注记和私域卡片接管构图，但保留 `window alcove` 返回路径。

## 内容与责任优先级

1. 我在哪里：World / breadcrumb、Window alcove、`YOU ARE HERE`。
2. 值得看什么：Iris 在场、Chalk 世界标记、Brass ticket、Noor 异地提示。
3. 怎么推进：点击 Iris 进行对话；Writer 输入表达改变世界的行动；物品按钮只表达“拿在手上”。
4. 发生了什么：Writer status 与世界回执分开，`LANDED` 纸条明确“fact stays on canvas”。
5. 低频管理：Journal、activity details、Effects。

页面严格区分三类来源：

- **角色说话**：对话右侧的 `IRIS / SPEAKING` speech paper；不使用 Writer 状态色，也不伪装成世界事实。
- **玩家向作家表达行动**：底部 `PLAYER → WRITER` 输入及 `send mark`；状态从 `accepted` → `processing`，期间文案明确“room has not changed yet”。
- **世界已经改变**：浅纸色 `WORLD / LANDED` receipt + status `landed / revealed / completed`；回执说出具体事实（lantern closer），并说明可回访。

## Fixture 路径

1. **默认态**：页面打开即显示角色在场、世界物件、活动、携带物品与 Writer ready。
2. **角色 identity focus / 对话**：点击或键盘聚焦 Iris 卡 → Enter，打开 dialogue。输入一句话后发送，speech paper 更新为 Iris 的回应；不会改变 Writer 状态。
3. **连续进入 Nook**：在 dialogue 的 identity 层点击 `Visit Iris's nook`，对话关闭、Nook 整页接管；可写一条私域 note。Esc 或 `window alcove` 返回画布。
4. **Writer 行动落地**：在 Writer 输入 `move the lantern closer to Iris`，回车或 `send mark`。先显示 `accepted`，再 `processing`；随后显示 `landed` 的世界回执，短暂进入 `revealed`，最后 `completed`。动效只强化阶段，文案和回执才是事实载体。
5. **取消**：processing 时出现 `stop`，点击后显示 `cancelled`，说明尚未改变世界；可用 `try again` 回到 ready。
6. **失败**：Activity slip 的 `show a failed mark` 触发 accepted → processing → failed。失败文案说明原因与下一步，不出现“成功”动画。
7. **Journal / activity / item / away**：Journal 展示故事回看；details 展开机器活动；ticket 显示“Held. No world change requested.”；Noor 显示异地提示。

## 动效、降级与可访问性

- 默认只使用三种动效：对话/Nook 进入、Writer 处理中呼吸点、事实回执入场。它们不承担任何真假判断。
- `prefers-reduced-motion: reduce` 和 Effects off 都关闭 animation/transition；仍保留可见文本、阶段名、输入、按钮和回执。
- 没有图片也可读：portrait 是 CSS 织纹与缩写字母，不依赖网络媒体。媒体失败时不会移除角色身份或对话操作。
- 每个主意图只有一个主动作：Iris 卡进入对话、对话输入发送、Writer 输入发送、Nook 返回。所有按钮有原生 focus ring，角色卡可键盘触发；触屏不依赖 hover。
- 状态使用 `aria-live`：Writer 状态和世界回执不会只靠颜色表达。Noor 的异地点击、失败、取消均给出下一步。
- 390px 不是桌面缩小版：顶部缩成身份带，世界内容按“地点 → Chalk → ticket → Iris → 活动 → Writer”顺序单列；对话改成 identity 上、speech 下，Nook 改成单列纸张，保证输入和返回不互相遮挡。

## 取舍

保留织物经纬网格、倾斜纸卡和一条关系线，因为它们让“空间 / 关系 / 落地”可被一眼区分。删除了常驻多层侧栏、装饰性头像墙和复杂作者工具：它们会让家具比世界更醒目。活动原始流、Journal 与效果开关都收进明确的低频入口，主舞台始终留给角色与世界回应。

## 世界窗口、操作与连续性

- 画布不是一块有限的海报：`world-window` 是真正裁切世界的视口，`world-space` 承载角色、Chalk、物品、关系线和视野外的第二集群。第二集群（`Train archive` / `NOTE FROM NOOR`）不在初始视野中，但通过窗口右上的 `find next cluster` 明确可发现；它与 Window alcove 共用同一世界布面。
- `find next cluster` 是一次可解释的平移到下一个聚落；`home` 回到 `camera 01 / alcove`；`+ / −` 调整同一 camera 的缩放。也可以在空白布面按住拖动平移，角色卡、纸卡和控制按钮会保留自身点击责任，不会把点击误判成拖动。
- camera 只改变 `world-space` 的 transform，不改变实体坐标，也不移动 Writer dock、活动回执或对话入口。打开/关闭 Journal、Writer 状态、角色对话和 Iris Nook 后，camera 的 x/y/scale 仍由同一 fixture 状态持有；关闭覆盖层回到原来的视野，而不是重新排座。
- 窄屏保留“视口”概念：初始内容按可读顺序单列，窗口控制仍提供 `find next cluster`，第二集群在同一 world-space 的后续路径出现；对话、Writer 与 Nook 继续是覆盖层或整页连续投影，不与世界内容争夺坐标。
