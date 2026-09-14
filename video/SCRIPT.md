# Worldlines 发布片 · 脚本大纲 v2（待你评价）

> 参考：Whip 发布片（1:54）。它的骨架是**一条旁白讲一段"媒介史"**：人类一直在创造 → 每一代媒介让创作找到观众 → "Today, it's happening again" → 但现在的新创作是散的 → 所以我们做了 Whip → 功能快剪 → 用开头的类比收尾（"YouTube did that for videos. Whip does the same for interactive"）。
> 画面是**素材蒙太奇 + 旁白小字幕**，只在转折点出现白底大字（"This time"、"Plays,"）。
>
> 我们照这个骨架讲：**书让人读世界，游戏让人玩世界，聊天机器人让人跟一个角色说话——但从来没有人能住进一个世界。** 旁白由你来讲（下面的英文 VO 是草稿，改成你的口吻）；角色台词用 **setsuna TTS** 生成（Vera、Nanami 已映射到 setsuna）。
>
> 长度仍是 2:30、120 BPM；旁白让音乐在人声段自动压低。

---

## 0. 参考片拆解（Whip）

| 时间 | 旁白 | 作用 | 我们的对应 |
|---|---|---|---|
| 0:00–0:23 | Since the beginning, humanity has created things… instruments, photographs, films, games, entire worlds | 媒介史，快速蒙太奇 | **ACT 1**：读世界 → 玩世界 → 跟角色说话 |
| 0:24–0:40 | Then everyone got a camera… YouTube… a culture anyone could join | 上一次范式转移 | "聊天机器人只让你跟一个角色说话" |
| 0:41–0:50 | Today, it's happening again. **This time** is software | 白底大字转折 | **"Until now."** + 一键展开无限画布 |
| 0:54–1:04 | But these creations are scattered… we watch things meant to be played | 痛点 | 角色被关在聊天框里、世界是死的 |
| 1:10–1:33 | So we built Whip… scroll, open, play, discover | 产品是什么 + 功能快剪 | **ACT 2–4**：画布、语音、Launcher、四世界、无限探索 |
| 1:33–1:42 | Every experience gets a page. Plays, likes, comments | 功能收束 | 多人 + 作家写代码 |
| 1:42–1:54 | YouTube did that for videos. Whip is doing the same for interactive | **回扣开头的类比** + logo | "Books let us read worlds… Worldlines lets you live in one." |

---

## 1. 分镜 + 旁白

| # | 时间 | 旁白（你讲，草稿） | 画面 | 来源 |
|---|---|---|---|---|
| **ACT 1 · 世界一直在门外** | | | | |
| 1 | 0:00–0:04 | Stories have always been worlds. | 羊皮纸 / 板书墨字自己写出一行，镜头贴得很近 | Remotion（月下之誓的 opening 文本做素材） |
| 2 | 0:04–0:07 | Books let us read them. | 书页翻动 → 场景卡一张张滑过 | Remotion + 场景图 |
| 3 | 0:07–0:10 | Games let us play them. | 3D 骰子砸下、地图卡飞过 | 骰子录屏 / Remotion |
| 4 | 0:10–0:14 | Chatbots let us talk to one character, alone, in a box. | 一个孤零零的聊天框，角色头像被关在里面，四周全黑 | Remotion |
| 5 | 0:14–0:17 | But no one has ever let you **live** in one. | 白底，一个大字 **live** | Remotion（Whip 的"This time"位置） |
| **ACT 2 · 一键展开** | | | | |
| 6 | 0:17–0:20 | *(无旁白，重拍)* | 作家按下巨大键帽 → 无限画布炸开，激进拉远 | Remotion（v1 的 S0） |
| 7 | 0:20–0:27 | This is Worldlines. One infinite canvas, where you, your characters, and an AI writer share the same world. | 角色头像 + 玩家光标在同一块画布上游走；**小作家的光标跟着它读卡、写卡在屏幕上移动**（真实的 AgentCursorLayer） | **你录 R6 作家光标** + Remotion |
| 8 | 0:27–0:33 | *(重拍点名，无旁白)* | VERA · SUMI · NANAMI · WATSON · SERAPHINA · RYO 快切 | Remotion（v1 的 S1，缩短） |
| **ACT 3 · 他们会回话** | | | | |
| 9 | 0:33–0:36 | And they talk back. | 点开 Vera 特写，按下麦克风 | **你录 R0** |
| 10 | 0:36–0:42 | *(你对 Vera 说一句 → 字边说边出 → Vera 用 setsuna 回话)* | 特写遮罩，实时转写，立绘换表情，角落计时器显示真实延迟 | **你录 R0**（Vera 段） |
| 11 | 0:42–0:47 | *(再对 Nanami 说一句 → 秒回)* | 同上，Nanami | **你录 R0**（Nanami 段） |
| **ACT 4 · 选一个世界** | | | | |
| 12 | 0:47–0:52 | Pick a world. | **世界 Launcher**：厚玻璃砖墙随鼠标倾斜、色散、悬停的砖浮起 → 点开 Fogwharf | **你录 R7 Launcher** |
| 13 | 0:52–1:02 | Investigate a harbour where ships vanish. | Fogwharf：进门 → 地图 → 掷骰 → 迷雾退开 | 你录 R1 |
| 14 | 1:02–1:12 | Be Holmes — and let Watson follow your reasoning. | Holmes：来信 → 证物给 Watson → 他引用你的推理 | 你录 R2 |
| 15 | 1:12–1:22 | Keep a promise on the night of the first snow. | First Snow：Nanami / Sumi 直聊 → 雪景结局 | 你录 R3 |
| 16 | 1:22–1:30 | Change one morning in 1994, and see who's still here tonight. | Divergence：1994 改一件事 → 今晚同地对照 | 你录 R4 |
| **ACT 5 · 没有写完的世界（无限探索）** | | | | |
| 17 | 1:30–1:36 | Or start with nothing but a promise. | **月下之誓**：石拱下的月光，Lyra 伸出手，蓝丝带 | 你录 R5a |
| 18 | 1:36–1:46 | Say yes, and the writer builds the next place as you walk into it. | 选"Make a contract" → **小作家光标在画布上边读边写**：月下庭院的 README、opening、物件、背景图一张张长出来 | 你录 R5a |
| 19 | 1:46–1:54 | Every character has a place of their own, too. | 角色栏「Visit their ikigai」→ 钻进角色的小天地，在她的画布上 RP，物件随对话长出 | 你录 R5b（小天地） |
| 20 | 1:54–1:58 | And it never runs out. | 相机不停拉远，画布四周还在长 | Remotion（v1 的 S5 拉远） |
| **ACT 6 · 接下来** | | | | |
| 21 | 1:58–2:06 | Next: bring your friends into the same story. | 1 → 2 → 4 个浏览器窗口看同一块画布，角落 `next` | Remotion（mock） |
| 22 | 2:06–2:16 | The writer writes the plot, the rules, and the code. Whatever the story needs, it can build. | 左边真实 frontmatter 逐字打出 → 右边立刻出效果：骰子 / 雪 / 灯塔 / 门 | Remotion（v1 的 S6） |
| **ACT 7 · 回扣** | | | | |
| 23 | 2:16–2:24 | Books let us read worlds. Games let us play them. **Worldlines lets you live in one.** | 公式 SANDBOX + AGENTS + CODE = ∞ → 画布再次炸开，所有角色、多个光标同时在动 | Remotion |
| 24 | 2:24–2:30 | *(无旁白)* | WORLDLINES logo + 最后一记重拍 | Remotion |

旁白总长约 **75 秒**（Whip 约 100 秒），留足空拍给重拍、角色台词和语音演示。

---

## 2. 声音分层

| 层 | 内容 | 处理 |
|---|---|---|
| 旁白 | 你讲（录音），或先用 setsuna 生成一版临时旁白对节奏 | 人声段音乐自动压低约 10 dB |
| 角色 | Vera / Nanami 的回话：R0 录屏里本来就有 setsuna 的声音；需要补的台词用 setsuna 单独生成 | 句首情绪 `happy` / `neutral` 映射到 setsuna 的 emotion |
| 音乐 | 120 BPM 占位曲，ACT 1 只留低频铺底（像 Whip 的开头），0:17 第一个 drop | 定稿换有授权的纯器乐 |
| 拟音 | 按键、骰子、翻页、开门、写字（仓库已有） | 同 v1 |

## 3. 字幕风格（二选一，请你挑）

- **A · Whip 式**：旁白全程小字幕（画面下方居中，小号细字），转折点才出白底大字。观众静音也能看懂。
- **B · 延续 v1**：几乎无字，只有角色名、世界名、公式。更"YC 重拍"，但静音时看不懂旁白。

## 4. 新增要录的（在 RECORDING.md 基础上）

| # | 内容 | 要点 |
|---|---|---|
| R0 | 语音对话：**Vera 一轮 + Nanami 一轮** | TTS 走 setsuna；原速录，别剪等待 |
| R5a | 月下之誓：接受契约 → 作家生成月下庭院 | 开 autoWrite；**画面里要能看到作家光标在读卡、写卡** |
| R5b | 某角色的小天地（Visit their ikigai）里 RP 3–5 轮 | 物件随对话长出来 |
| R6 | 作家光标特写：随便一个世界，作家处理你的行动时，光标在卡片之间移动 | 相机别动，让光标自己跑 |
| R7 | 世界 Launcher | 慢慢移动鼠标让砖墙倾斜 → 悬停 → 点开一块 |

## 5. 请你评价

1. 这条"读世界 → 玩世界 → 跟一个角色说话 → **住进一个世界**"的主线，能不能代表你想讲的故事？
2. 旁白你亲自讲，还是先用 setsuna 出一版临时旁白来对节奏？
3. 字幕选 A 还是 B？
4. ACT 1 用什么画面讲"书 / 游戏 / 聊天机器人"？我的想法是全用我们自己的素材风格化（羊皮纸、骰子、孤立聊天框），不用外部素材。
5. 四个世界每个 10 秒，一句旁白，够不够？
