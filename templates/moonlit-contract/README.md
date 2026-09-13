# 月下之誓

原创骑士契约开场。世界语言为日语，左侧为黑发男性旅人，右侧为银发女骑士；主角姓名与愿望留给玩家。

- 开场：world/README.md + 唯一 world/opening.md + 唯一物品 world/blue-ribbon.md。
- 一张 CG 同时用于世界封面与开场背景。无独立立绘、NPC 卡、视频或第二段导入。
- BGM：平台主题键 emberglass，Mystical/fantasy loop，nicorico_120，CC0；完整署名见仓库 assets/audio/CREDITS.md。
- 选择契约并出发 → 作家栏确认 Send → Writer 更新契约物品并生成 world/moonlit-courtyard；玩家点击新门进入。
- 每个后续场景只生成自己的 README、一张 opening Chalk、一件物品、一张背景。继续选项给出下一层路径；玩家再明确请求时才继续，不能自动递归生成。
- 返回使用层级导航或向作家栏明确提出返回已知父层。不会删除旧场景。

## 启动与边界

打开 http://localhost:5173/ 的世界列表，选择 **月下の誓い — The Moonlit Pact**，新建存档。开始前在连接设置配置 Writer 与生图供应商。

本模板带 autoWrite=scenes：进入未写场景时允许现有 I1 初始化器执行。普通选项仍通过画布侧栏选择、确认作家输入并 Send。阅读展开页的 choice 行为与侧栏尚未统一，当前推荐从侧栏提交生成意图。

循环生长是世界 skill 和 Chalk intent 对现有 Agent 的执行要求，不是后台任务或无限预生成。画像失败保留已完成文本，提示玩家稍后明确重试。没有声称真实 Agent 已成功生成后续场景；验证记录见 docs/gameplay/月下之誓开场.md。
