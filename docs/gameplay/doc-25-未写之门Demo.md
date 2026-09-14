# 第六个 Demo：未写之门

用户已明确授权制作。模板 `templates/unwritten-door`，英文名 The Unwritten Door。第六个是体验方案编号，仓库还保留早期模板，不按现有目录数量重命名。

## 开场与发现

直接在现代小木屋醒来，无角色创建或世界设定表单。根层只有醒来 chalk、信封、手机与门。房间 README 描述眼前环境；头痛与记忆空白是事实，被击晕带来仅是猜测。信封和手机暂不可拾取，避免路径漂移；门不另加钥匙谜题。

`letter.md` 与 `phone.md` 的 Context 是公开的已发现事实，不预藏完整信件或通话。拆信后作家回写信件、Context 与 opened 快照；通话后回写虚构对话、Context 与 contacted 快照。查看外观不自动触发使用。

## 门外与作家

`world/outside/` 用 `.gitkeep` 保留空目录，不放 README。`door.md` 的 target 指向它；显式 gate 替代同目标的自动目录门牌。

前端开门调用 `/api/enter-layer`，动作层落 `layer_entered` 事件。**是否随后生成门外场景由每世界开关 `autoWrite` 决定（默认 `off`，即只落事件、作家在玩家下一轮读到）**；开启时走 I1 初始化器（`airp_init` → scene-init preset），**不是**路由里直接起作家。choice 也先落账；是否起作家一轮同样由 `autoWrite` 决定。`submitWriter` 串行处理道具与开门，避免信封、手机的上下文还未回写就生成门外。返回成功只表示行动已接受，模型错误通过 WS 显示。**总口径见 `../settings/00-共同上下文.md §1bis`**。

当前走作家亲写 W1，**尚未接 scene-init 委托 R1/R2**。作家按世界 skill 读取两份 Context：无发现则自由补完现代场景，有信或通话则承接已揭示事实。目标 README 已存在时不重生成。初次只补 README、两个物件、短 chalk 与回程门。

`context.ts` 统一承担每轮状态与事件注入，复用 main 的临时上下文通道；`world-context.ts` 仅在原生 write/edit 成功后补事件，AIRP 工具不重复落账，不再额外持久注入同一批事件。writer preset 禁用 bash，避免 shell 绕过文件工具 hook。

## 图片与画面

pi-ai 新增 `openai-images`，支持配置 baseUrl 的 `/images/generations` 与参考图 `/images/edits`。AIRP 经原 `generate_image` 动作落盘，再 edit 场景 bg 或道具 image。服务器读取 gitignored 根 `.env.local`，示例 `.env.example`；自有网关须确认图像协议和模型。

本轮保留同步生图工具，可配置生图/作家超时，示例分别为 180/240 秒。文字先显示，查看与拖拽可继续；后续作家任务仍排队。独立图片任务与流式预览未实现。未配置时默认超时仍为 60/90 秒。

`visual: envelope|phone|door` 选择道具形态；有 image 时显示世界图片，无图显示 CSS 道具，不伪称 AI 产物。检查道具用独立阅读对话框，使用仍经共享 choice。

## 运行与验收

`node tools/scaffold.mjs --template unwritten-door --out worlds/unwritten-door-demo` 创建副本，配置 `.env.local` 后运行服务。前端 **5173** 代理到后端 **3001**，不使用临时 checkout 的 3002。菜单可选 Unwritten Door Demo；从模板加载也先复制到 worlds，保护开场原件。

自动测试覆盖四实体、单门、choice 落账和派发、stub 首次进入、已写场景不重生成；图像适配器用假 HTTP 响应验证参数、参考图与错误。真实模型必须另记模型/接口、实图路径和耗时，不把模拟通过算作生图成功。
