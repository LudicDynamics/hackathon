# 合并 main：保留体验功能与初始化演出

> 合并 `e6154ae` · 父提交 `8ef60b8`（本地）与 `5e692ec`（远端 main）· 作者 niko · 2026-09-13
> 来源：通过同一 GitHub 仓库 HTTPS fetch 获取 main；SSH 公钥认证失败。未 push。

## 1. 这次合了什么

- 远端：Chalk 湿墨恢复、场景初始化占位及失败反馈、场景/小天地初始化提示词、夜辉 D10 素材、合并登记门禁。
- 本地：DeepSeek 配置、行动草稿与单轮约束、右上角 Agent 执行记录、提示请求、装饰纹理、TTS 世界语言与自然语气、独立语音/音乐音量、本机监听选项。
- 已知 niko 分支提交已被当前历史包含，不重复合并。

## 2. 冲突处理

先在 `/private/tmp/airp-merge-probe-8ef60b8` 独立 worktree 试合并，唯一文本冲突为 `useWorld.ts` 的初始化条件。

- 保留本地 `options?.initialize !== false` 判断与 boolean 返回值：准备选项时可以进入场景而不抢先触发初始化。
- 在上述条件内部保留远端 `setInitializingLayer(next)`，然后发送 `airp_init`：只有真正启动初始化才出现占位。
- App、Canvas、messages、instructions 自动合并后复核：保留两边新增入口、翻译及不同角色的提示词增量。作家最终回执仍在右上角；Chalk 正文的湿墨使用独立演出通道，不将聊天或思考投射到画布。
- 两个父提交到合并结果均无文件删除；未修改 pi-rp、密钥和玩家存档。角色 WebM 播放问题未在此次修复。

## 3. 验证

- `pnpm build`：通过（仍有大 chunk 警告）。
- `pnpm check:ws`、`pnpm check:bodies`、`pnpm check:voices`：通过。
- 浏览器冒烟：5173 分歧点页面正常显示背景、透明 Chalk、物品、角色入口和 Continue 提示入口，截图 `/tmp/airp-merge-smoke.png`；未发送付费 Agent 请求或初始化新场景。
- `pnpm test`：132 通过、6 失败。其中 3 个为当前 Node 对目录测试参数的兼容问题；另 3 个为 hover/presence 源码断言失败。
- 按文件重跑三套测试：`node --test apps/server/test/*.test.mjs apps/web/test/*.test.mjs packages/shared/test/*.test.mjs`：546 通过、1 失败。失败为 `unwritten-door.test.mjs` 仍期待并发作家请求排队，而现有实现拒绝忙时重复提交。此测试及生命周期代码均非本次远端合并改动，不借合并恢复无界排队。
- `pnpm check:i18n`：失败，扫描器把 `text.split('\n')` 中尾部 `t(` 当成翻译调用，报缺少换行翻译；不是双方翻译键被覆盖。登记而不扩大本次范围。
- 未跑全部探针；不宣称全绿。后续应独立修复陈旧断言与门禁误报，再做 Agent 动态验收。
