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

## 5. v2 实现状态（2026-09-14）

已拍板：主线通过；**全程英文字幕、先不配旁白**（你之后想念再补）；公式改为 **SANDBOX + AGENTS + AI ROLEPLAY = WORLDLINES · INFINITE CANVAS**；角色展示不用透明抠像。

| 段 | 现在是什么 | 等你的录屏替换 |
|---|---|---|
| ACT 1 读 / 玩 / 聊天框 / live. | 自有素材风格化：羊皮纸墨字、翻页书（世界图做书页）、**App 真实 3D 骰子**、通用聊天框、白底大字 | — |
| ACT 2 按键 + 画布 | 画布上**小作家光标**按 AgentCursorLayer 的样子读卡、写卡、挪角色；角色展示改为全身插画卡（Seraphina 换成 Lyra） | R6（可选） |
| ACT 3 语音 | mock，但声音是真的：玩家句用 macOS Samantha 占位，**Vera / Nanami 回话是 setsuna 生成**，字随语音逐字出现 | R0（你的真实 STT → TTS） |
| ACT 4 Launcher | **在 Remotion 里复刻了真实玻璃砖 Launcher**（同一套 CSS），拖动 → 甩出 → 悬停 Fogwharf → 点开 → 放大进世界 | 不需要录 |
| ACT 4 四世界 | Fogwharf 用了真实录屏，其余是占位框 | R1–R4 |
| ACT 5 月下之誓 | 开场图 + Lyra 两句 setsuna 台词；契约卡是模板里的真实选项；选"Make a contract"后小作家写出 README / opening / item / 背景图 / 新门 | R5a |
| ACT 5 小天地 | mock + Vera 的 setsuna 台词 | R5b |
| ACT 6 | 多人 mock（角落 `next`）；作家敲真实 frontmatter → 3D 骰子 / 雪 / 灯塔 / 门 | — |
| ACT 7 | 新公式 + logo + 结尾字幕 "Worldlines lets you live in one." | — |

声音文件：`remotion/public/voice/`（`node video/music/make-voices.mjs` 重新生成）；音乐按 v2 时间轴重排（0:18 第一个 drop，2:16 静音一拍，2:24 最后一击）。

### v4–v5 拍板（2026-09-14）

- **配乐选 A**（`placeholder-120.wav`，D 为备选）。候选 B/C/D 在 `public/music/candidate-*.wav`，同一套时间轴，换曲只需重渲音轨：`MUSIC=music/candidate-d.wav sh scripts/render-chunks.sh`。
- 《Sunshine》只做私下试听版（`scripts/try-song.sh`，节拍进入点 0:14 对齐画布炸开 0:18），**不进成片、不外发**。
- 语音：Vera / Nanami 第一轮英文；之后的 Lyra 两句与 Vera 小天地一句为**日文**（setsuna），画面与字幕全英文。
- 2:15 的门：「未写之门」真实木门沿合页打开，门后是 **Beyond the Fog**（雾港新路），冷白色柔光。
- AI ROLEPLAY 图标：Nanami 立绘做的黑白漫画风圆形头像。Logo：WORLD 白 / LINES 橙。

### v6 拍板（2026-09-15）

- 配乐确定 **A**。全片 **2:36**：语音对话段 0:33–0:53（加长 6 秒），之后各段整体 +6 秒；音乐 A 在安静段按小节拼入 3 小节（`video/music/make-track-a-156.sh`），所有 drop 仍卡在剪辑点上。
- 语音对话加第三位：**Wataru**（女性向男主，素材 `video/assets/wataru-loop.scene.mp4`）。本机 TTS 只有 setsuna（女声），所以他走 App 的线上音色 **Ethan**（备选 Kai）。
- 结尾 logo 下加署名：**BUILT BY LUDICDYNAMICS / From Tokyo, to the world.**（比产品名小一级、偏灰）。

### v7 拍板（2026-09-15）

- 全片 **2:46**：语音对话段 0:33–1:03（30 秒），四段对话 **Vera → Nanami → Wataru → Ei**。音乐 A 在安静段按小节拼入 8 小节（`video/music/make-track-a-156.sh`）。
- **Ei**：AI 研究员，素材用办公室白板版 `video/assets/ei-office-loop.raw.mp4`（绿幕版留作抠像备选）。
- 声音：男声全部用 **OpenAI `echo`**（用户选的冷静动漫风），按人设给不同演绎指令——玩家对 Vera/Nanami 是冷静男声；Wataru（高中社团同学，闷骚内敛）、Ei（最有磁性、成熟）；对他们说话时玩家是两个冷静女声（`sage`、`shimmer`）。**整个语音对话段全英文**（日文只留给 Lyra 和 Vera 小天地那句）。线上音色表里的 Lenn / Emilien / Alek 会**静默回退成女声 Cherry**，不要用。
- 气泡与字幕永远是英文（`subtitle` 字段）。

### v8 拍板（2026-09-15）

- 署名确认：**BUILT BY LUDICDYNAMICS**（连写）。
- **Divergence 用上用户实录**（`video/footage/divergence-run-raw.mp4`，日文版 11 分钟），块长 8 → **12 秒**，全片 **2:50**。用户指定的四个瞬间：
  1. 一前一后进入 2024 —— 先进（原片 1:30，1994 午后店 → 2024 雨夜）；
  2. 输入改变世界的那句话（4:34 起，6× 速）；
  3. 和小女孩（幼いリョウ）聊天改变时空的瞬间 —— 原速、保留她本人的声音：「鮭が跳ねるところ、また見たいな。」，字幕 *I want to see the salmon leap again.*（Whisper 听成了「カエル」，以画面文字为准）；
  4. 时空变化后再进 2024（8:26 起，3.4× 速，满墙新便签）。
- 音乐 A 在 Divergence 自己的律动里再拼 2 小节（`make-track-a-156.sh`）。

### v9（2026-09-15）

- **Fogwharf 用上用户 44 分钟实录**（`video/footage/fogwharf-run-raw.mp4`）：事务所开场 → 港城地图 → 灯塔掷骰（3D 骰子与结果）→ 迷雾散开、新码头出现。
- **小天地（R5b）** 换成实录 16:01 Vera 的小天地（纸面画布、她的头像移动、便签长出来）。
- 未用高光清单见 `RECORDING.md`。

### v12（2026-09-15）

- **删掉福尔摩斯**，时间给雾坞镇：雾坞镇 **24 秒**，全部来自用户 44 分钟实录，按游玩顺序——事务所 → 港城地图 → 掷骰 → 「一緒に回らない？」、Vera 自己动身、跟到第七泊位 → 迷雾散开出现新码头 → Vera「2隻目だね」（踩音乐重拍）→ 灯笼夜码头 → 「戻る？」/「私なら、まだ戻らない」→ 蓝光门暗厅（作家光标）→ Vera 的回复框弹出 *You have no credits remaining*，叠数据卡 **44-MIN RUN · 48M+ tokens this week · CREDITS: 0**（用量截图是项目近 7 天，不是这一局）。
- **分歧线**结尾改为同一条街的前后对比：原来的世界 2:13（空地与墙）↔ 复原后 9:07（常盘堂亮灯开门），橙色分界线横扫，BEFORE / AFTER。
- **心像空间**用实录 6:48–7:02：Vera 的便签墙（今日の日記・まだ言えないこと・好きなこと、怖いこと・いつか、なりたいもの）。
- 全片回到 **2:54**。

### v15（2026-09-15）

- **Ei 的假对话换成 Elias 实录**（用户的两段 Ei 世界录屏，`footage/ei-run-raw.mp4` = 13.27、`footage/ei-live-run-raw.mp4` = 15.59）。A3 在 Wataru 之后接三拍：
  1. 语音回复（13.27 录屏 0:50.2，4 秒）：「Take your time. But I'm not going back to my office until I hear it.」
  2. **GPT Live 通话**（15.59 录屏 3:40.5，8 秒）：对话框里是你要工单的原话（英文），他的两句「Okay, let's take it slow and get it right.」「I'm checking what the ticket should cover.」做成气泡；人物卡的中文简介做了模糊。
  3. **落到世界里**（6 秒）：5:33 走廊里点开放办公区 → 5:35「Action confirmed and the scene is synchronized.」→ 5:54 他写的任务单成了办公室里的卡片（Chrome 翻成英文的那一帧，裁掉翻译弹窗），旁白「On a live call, he writes it straight into the world.」
- 录屏里只有 Elias 的声音（你的麦克风没录进去），两句原声抽出来单独放（`voice/elias-1.wav`、`elias-2.wav`，拉到 -16 LUFS）。
- A3 28 → 40 秒，全片 **3:14**（194 秒）；音乐在 A3 的安静段多拼 6 小节，后面所有落点不变。
- 旁白四个版本（Christopher / Andrew / Brian / Ryan）按新时间轴重新生成。

### v16（2026-09-15）

- **雾坞镇讲成一个故事**（34 → 64 秒）：每一段旁白说这一幕在干什么；Vera 的台词整句播完，前面先放你打的那句（字幕标 You）。
  委托 → 找线索 → 掷骰（*When luck matters, the dice decide.*）→ 你问她为什么帮你，她答「我可没无条件信你…」→ 「一緒に回らない？」她自己跟上来 → 你的推理让 writer agent 写出新地点（19:00 光标在写 old-customs-landing）→ 新码头 → 「また新しい道がみえた」/「二隻目だね…」（音乐重拍落在她这句）→ 灯笼码头 → 「ここまで来たけど戻る？」/「私なら、まだ戻らない…先查木箱的擦痕或没沾泥的车辙」→ 额度用光：*We got hooked — one game ran 44 minutes, until our $100 in credits hit zero.*
- **初雪**换成你的两条线路实录：直播间 → 雪夜街道 → 和 Nanami 通话 → **ENDING 1**（16.24 录屏 4:42）/ **ENDING 2**（16.07 录屏 14:12），旁白 *Two routes. Two endings.*
- **writer → writer agent**（旁白和画面上作家光标的标签都改了）：英文里单说 writer 会被当成人。
- 结尾：*Books let us read stories. Games let us play them.* / *Worldlines lets you live in the world, with your character agents.*
- 旁白下音乐只轻压（约 -4 dB，原来约 -8 dB 以上），旋律和重拍要听得见；角色说话时照旧压深。
- 旁白默认 **Andrew**，备选 Christopher。全片 **3:44**。

## 6. 请你评价（v1 大纲时的问题，已答复）

1. 这条"读世界 → 玩世界 → 跟一个角色说话 → **住进一个世界**"的主线，能不能代表你想讲的故事？
2. 旁白你亲自讲，还是先用 setsuna 出一版临时旁白来对节奏？
3. 字幕选 A 还是 B？
4. ACT 1 用什么画面讲"书 / 游戏 / 聊天机器人"？我的想法是全用我们自己的素材风格化（羊皮纸、骰子、孤立聊天框），不用外部素材。
5. 四个世界每个 10 秒，一句旁白，够不够？
