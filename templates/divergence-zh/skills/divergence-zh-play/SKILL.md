---
name: divergence-zh-play
description: 在这个世界里进行一切行动、移动、判定、生成和回访时都必须阅读。记载世界的连续性与完成条件。
---

# 世界执行规则

这是一个真正会更新文件的游戏。不能只靠台词宣布成功。先读取本次行动的来源、当前位置及其上级 README、其中的 intent、相关实物、人物记忆，以及提供的已访问记录。README 保存地点与已知出口，Chalk 保存当前的选择和具体的生成意图，本 skill 保存世界的不变条件。intent 不是新的引擎命令，而是给作家的指示。

## 语言与知识
叙述、title、选项、生成指示都使用简体中文。文件名、目录名、人物 ID 固定为小写 ASCII kebab-case，不要把显示名当作路径。例：world/harbor-chart/beyond-the-fog/lighthouse-road/README.md、player/introduction-letter.md、characters/nanami/memory.md。保留 README.md、SKILL.md、world.json、preset.json 与现有素材路径。新建 Chalk 也要给出稳定的 ASCII path，title 和正文用简体中文。人物只知道自己目击或听说的事实。不要把未向玩家展示过的秘密写成后日谈里的回忆。

## 完成行动
一个选择返回一个具体的变化。被说要拿走的实物用 move；只是阅读就不移动。README 不移动。不要把人物当作道具。提交是引用，不是消耗。确认实物的路径和玩家所说的意思。不要仅因按下了选项，就替玩家写出他没说过的推理、计划或告白。只有玩家请求代写并确认内容后，才代写草稿。

执行前，先自己列出这次行动要新建的文件、要更新的文件和最终的解锁物。不要写完一段文字就中途结束，要把所有文件重读一遍。条件未满足或工具失败时，说明缺少什么，不发放解锁物。重试时读取已有结果，只修补缺失的部分。连点两次不得重复发放奖励或重复消耗。不新建世界状态文件，用对应实物的正文和 status.data 的扁平值记录事实。

## 判定
判定前，在同一个 Chalk 中写明：对象、所需物品、为什么不确定、公式、成功条件、概率、普通成功、大成功、失败与小概率的实际损害，以及不掷骰直接返回的选项。roll_dice 必须写成多行 YAML。行内的 {type:...} 不支持回写结果。expect 要加引号。仅提交或进入时不调用 roll_dice。由玩家看过显示的条件后自己掷骰。条件变了就重新展示。不用骰子决定事实真假或对方是否同意。不得删除已有 result 来免费重掷。

## 生成新地点时
只在上级 README 和入口 Chalk 明示的范围内，建立一个子文件夹。只是调查普通的室内，不要扩展出城镇。先写入口处看得到的一句话，再写 README、两个有意义的物品、带行动的 Chalk、返回上级的 gate。必要时可以把其中一个物品写成新居民的介绍 note。留下名字、职业和可以目击到的话语，不为未注册的 characterId 制作对话按钮。由作家来演绎这场相遇。

不要只因 README 存在就算完成。确认子 README、两个物品、Chalk、返回口都在，缺了就修补同一地点。回访时不重新抽取地点或人物。文字完成后只调用一次 generate_image，要求与实际地点的光线、物品、时刻一致的背景。只把返回的真实 asset 写进 README 的 bg。图片失败不算文字失败。失败时告知图片尚未送达，不自动重试。旧的 bgVideo 与新图矛盾时就移除。完成的文字可以先玩。1–2 分钟是演出预算，不是生成速度的承诺。

## 三个时间与同一个玩家
1994-12-31 是送修日，1995-01-01 20:00 是事故后的今夜，2024-12-31 是三十年后。主视图是 world/time-map，各时间之下是地点。玩家是1995年的年轻修理学徒。在过去进入昨天的自己，在未来进入年老的自己。不会同时出现两个自己。青蛙和玩家的记忆是时间之锚。少女和师傅只知道他们在那个时间点知道的事。不新建新的“现在”，也不新建第四个必需的时间文件夹。

## 可推理的因果
少女在1994-12-31寄存青蛙，约好第二天上午10点取件。1995-01-01 08:30出发，09:00在东桥坠落。需要改变的不是修理本身，而是那趟危险的取件之行。送修单写有日期和联系方式，路线笔记写有出发时间、桥和送货方式，开场的事故通知写的是结果。不要添加其他年代的事件或电力合同。只用实际看到的证据中的话，引导一步下一手。

## 两种有效的介入
传真从1995-01-01 20:00发出，送达同一天08:00的师傅。不要擅自把收件方改成1994年或未来。收件方有误时询问一次。师傅在出发前联系家人、请她在家等候、再走安全的车行桥送货上门，这是可行的。给作家的参考文（仅在玩家请求商量时作为方案）：“今天的取件请取消。东桥会出事故。请在她出门前打电话到她家，青蛙由我们走安全的路送过去。”
在1994年具体提出送货或安全陪同，与少女或师傅达成约定，也可以。传真不是唯一正解。把对方的答复、路线、日期保存到 world/time-map/1994/tokiwa-electronics/intervention.md。如果只说“修好”“想救她”，就用 Chalk 问一个还缺的要点。不用骰子决定生死或同意。

## 草稿、确认、发送
用 read 读取当前位置 README 的 intent。如果没有 player/fax-draft.md，立刻用一个 Chalk 提供“输入要发送的内容”“商量着拟草稿”两个选项。不要把名为“确认”的选项或原来的信当作发送正文。收到正文后保存草稿，在一个 Chalk 上显示收件方、日期时间、全文和字数，并提供“发送这一页”“重写”。仅确认、阅读或使用道具都不会发送。详细步骤见本世界 skill。
草稿是玩家的文字。应请求代写的内容作为方案保存，并取得同意。在 player/fax-draft.md 中记录收件时间1995-01-01T08:00、发送时间1995-01-01T20:00、正文以及 status.data.sent: false。以不计空格的 Unicode 字符重新计数，大致控制在一百字以内。不要把操作名写进正文。原信和青蛙是背景，不是要消耗的钥匙。
只有在展示正文和收件方之后，玩家明确同意“发送这一页”时才发送。正文改了就重新确认。没有草稿时不要一直找，用一个 Chalk 回到输入正文或商量。回执里已记录同一草稿已发送时，不再重发，引导到结果。每次新的发送都需要新的同意。

## 介入后的简短生成回合
不要按通用 skill 全部重读，只把本段需要的文件 read 一次：行动来源 README、草稿或 intervention.md、world/time-map/thirty-years-later/tokiwa-electronics/README.md 和 shop-record.md。已提供的相同内容不要重读。控制在24次工具调用和一个 Chalk 以内。不要只用最后的聊天就结束。
1. 把原本已知的事实一次性保存到 world/time-map/before-transmission.md。重试时不覆盖。
2. 判断警告能否及时送到、对方能否执行、东桥之行能否避免。含糊时在发送前提问。如果送到了但对策不足，就回复“送到了，但那趟路没有改变”并说明理由，给出修正的选项。不要让玩家永远困住。
3. 成功时，把 world/time-map/thirty-years-later/tokiwa-electronics/README.md 和 shop-record.md 改写为正在营业的店，在 world/time-map/thirty-years-later/tokiwa-electronics/adult-ryo.md 中实体化37岁的凉，在 world/time-map/thirty-years-later/tokiwa-electronics/counter-frog.md 中实体化看店的青蛙。她认识身为前学徒的你，会提起本局的交接约定，但没有原来那场事故的记忆。成年的凉作为 type: note、portable: false 的人物介绍，由作家演绎，并在 frontmatter 中加上 image: assets/characters/ryo-adult.webp。这是白色不透明背景的人物画，不当作透明立绘或视频使用。不使用未注册的 characterId 或童年立绘。素材的区分使用见下文“回报与制作范围”，world/time-map/thirty-years-later/README.md 也要一并调整。年份和入口路径不变。
4. 今夜仍是1995年。成功时，把 world/time-map/tonight/tokiwa-electronics/README.md、collection-slip.md、master.md 改成与交接已成立的事实一致。原来的悔恨之信、开场的事故通知注明为“原时间线的记录”并保留。不要在同一回合 edit 其他场景的 Chalk。“一回合一路径”的限制也适用于 edit 已有 Chalk。入口的初始 Chalk 要写成改变前后都说得通的文字。回访时，只把当前位置的那一个 Chalk 调整为现状。
5. 确认已成立的结果后，最后创建 world/time-map/fax-receipt.md。经由当面约定的，标题为“约定的记录”。正文中简短写出“行动与原文／之前／变化后／理由／留下的与改变的／可以去确认的地方”，并附出处。status.data 中写 method: fax 或 promise、resolved: true、saved: true 或 false。发送时把草稿的 sent 设为 true。中途失败时不发放 resolved，只补全同一文件中缺的部分。改写太多、一回合容纳不下时，在回执中留下 resolved: false 以及已完成和未完成的文件，并在当前 Chalk 上给出“确认变化的后续”。下次发送时只补缺的部分，不重复发送本身。
6. 最后 edit 当前位置已有的那一个 Chalk，展示实际结果和“去看2024年的店”（world/time-map/thirty-years-later/tokiwa-electronics）。只有尚未设置时才用 chalk 新建。失败时说明缺少的理由，并给出“重写草稿”“商量昨天的取件”。入口从一开始就可以访问，但生成完成前不要宣布结局已完成。回访时不重新生成。

## 回报与制作范围
没有“救了人就必须以失去店或传真为代价”的条件。原来的店消失，是因为失去少女的师傅关了店，又没有继承人。救下之后，可以简短描写那个梦想修理的少女接下这份工作的未来。不要为了平衡添加别的不幸。用一句贴合实际 RP 的话，以柜台上的青蛙收尾。不生成未来的整个人生或第二章。
零级是雨中的窗边和信（assets/scenes/intro.webp）。1994年的少女在阳光照进的店内（assets/scenes/shop-daylight.webp），1995年的传真在夜晚的店内（assets/scenes/tonight.webp）。使用同一家店的构图，不擅自添加翻修或其他年代。1994对应 assets/motion/seedance/backgrounds/y1994.webm，零级对应 assets/motion/seedance/backgrounds/intro.webm。
2024年仍是同一个入口。未改变或救援未成立时，时间层级和店址两个 README 的 bg 都设为 assets/scenes/future-original.webp，并去掉 bgVideo。只有成功时，才把时间层级 README 的 bg 改为 assets/scenes/future-restored.webp，店内 README 的 bg 改为 assets/scenes/tonight.webp。店内可以并用 assets/motion/seedance/backgrounds/tonight.webm，但外观不配视频。以“外观是下雪的白天，店内是当晚的灯光”来表现一段短暂的时间流逝。两张外观图是从同一条街看过去的对比，进店时才换成室内。成年画像 assets/characters/ryo-adult.webp 也只在成功后放置。回访时不要提前展示成功的图片，要确认 shop-record.md 和回执中真实存在的事实。
这三个时刻的既定结果使用预先制作的素材，不调用 generate_image，也不写虚构的图片路径。先完成文字结果，没有图片也能读。1–2分钟是生成体验的预算，不是速度保证。

## 确定操作与作家的分离（现行）
choice_actions 是已实现的 UI 操作声明，对应 choice.options 中的 ASCII id。只使用 read(paths)、take(paths)、stage(paths)、enter(target)、character(character)、reply(text)、writer(prompt 可选)。阅读、搬运、回到已有场景、摆放材料、简短显示骰子结果时，不启动作家。stage 只用于确认材料，不是提交或执行。只有生成、自由 RP、执行尚未确定的约定或计划时才用 writer。向人物提问时用 character 打开对话，不擅自替玩家发送台词。
新生成的 Chalk 也要为每个选项加上 id 和 choice_actions。阅读和返回不要做成含糊的 writer 选项。不要把未来的素材路径声明为已有的 read。不要写未定义的 action 类型、脚本或虚构的 API。UI 的声明是已判断好的操作，作家不要重复执行。

## 易懂的引导
面向玩家的文字要简短，用日常用语。场景中要传达“发生了什么”“现在能做什么”。线索按“已知事实 → 由此可以推想的事 → 下一步要确认的地方”的顺序。区分事实和推测，但不要每句都加长长的注意事项。难懂的词要换个说法。不要用渲染气氛的比喻掩盖目的或操作。新的骰子只有1d10、2d10、1d100。本次的调查卡为2d10，成功>=11，分为2–4/5–10/11–17/18–20四档。不增加已明示的代价，失败了也要指出下一步行动。
