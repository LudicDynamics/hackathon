# AIRP 文档入口

按问题进入主题文件夹；原 `doc-NN` 编号保留，编号不再决定文档放在哪里。完整说明和历史沿革见 [文档骨架](00-文档骨架.md)。

| 想了解什么 | 入口 |
|---|---|
| 产品是什么、为什么这么设计 | [产品设计](product/README.md) |
| 怎么玩、Chalk / 道具 / 判定 / 结局怎么设计 | [玩法](gameplay/README.md) |
| 六个体验世界分别怎么玩、验收到哪里 | [逐世界玩法与验收](gameplay/worlds/README.md) |
| 模板、存档、稳定路径、素材分发 | [世界与存档](worlds/README.md) |
| 画布、阅读、布局、多语言 | [界面与交互](ui/README.md) |
| 作家、角色、上下文、模型连接 | [Agent](agents/README.md) |
| frontmatter、组件、工具和事件的数据契约 | [协议](protocols/README.md) |
| 开发计划和协作 | [开发](development/README.md)、[合并纪律](merge/00-合并纪律.md) |

## 实现专题

这些目录保留原位置。修改对应实现前，先读各自的冻结契约，不以玩法构想代替实现协议。

| 主题 | 冻结契约 |
|---|---|
| 工具与动作 | [tools](tools/00-共同上下文.md) |
| 每轮上下文注入 | [hooks](hooks/00-共同上下文.md) |
| 提示词与技能 | [prompts](prompts/00-共同上下文.md) |
| 场景初始化 / 角色小天地 | [init](init/00-共同上下文.md) / [nook](nook/00-共同上下文.md) |
| 前后端接线 / 卡片占位 | [wiring](wiring/00-共同上下文.md) / [footprint](footprint/00-共同上下文.md) |
| 演出 / 素材 | [perform](perform/00-共同上下文.md) / [assets](assets/00-共同上下文.md) |
| 音效与 BGM / TTS | [audio](audio/00-共同上下文.md) / [tts](tts/00-共同上下文.md) |
| 每世界玩法设置 | [settings](settings/00-共同上下文.md) |

## 维护规则

- 新文档放到对应主题；玩法机制放 `gameplay/`，具体世界的节拍、结局与验收放 `gameplay/worlds/`。
- 一份正文只放一个位置，跨主题用链接。世界包的目录与存档规范属于 `worlds/`，不是逐世界剧本。
- 设计提案、已确认规则、离线测试、真实模型验收、浏览器实玩分别标记；移动文档不代表更新完成度。
- 历史与废案在 `archive/`，合并记录在 `merge/`；保留原记录，不当作当前实现契约。
- 移动后同步相对链接、仓库路径和脚本引用，运行 `pnpm check:docs`。
