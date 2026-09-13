# Chalk 执行验收

## 本轮落实

- [x] 透明互动容器；按钮跟随明暗场景，不再出现浅色实底表单。
- [x] 整块实体 hover / 键盘聚焦显露互动，侧栏点击可钉住。
- [x] 行动区绝对定位，不改变正文高度；右/左/下三候选按视口与实体碰撞比较。
- [x] 普通 Markdown 默认查看/收取；角色交谈、门进入仍分别路由，不用同一段 Prompt 伪装所有动作。
- [x] 收取调用 store.move，目标同名则保留双方文件并报错。
- [x] 玩家 choice 服务端重读源文件、验证选项、写 choice_selected 事件；失败不记事件，不假造后果。
- [x] Chalk 数字 size 与轻微旋转不再被全局样式覆盖。

## 未完成

- [x] Agent choose 工具与玩家 `/api/choice` 共用 main 的动作服务；前端按共享规则显示条件选项与提示。
- [ ] choice 自由输入入口与 multi 模式的完整前端呈现。
- [ ] 带 Prompt 技能/RP 的结构化参数、确认与权限协议。
- [ ] action 完成后的即时叙事节奏（当前遵循事件下一轮注入，路由不偷偷启动 Writer）。
- [ ] 所有场景、移动端、缩放边界与多个 pinned 面板同时开启的视觉验收。
- [ ] Anchor 初次排座、拖后跟随策略与完整落笔/湿墨/落定演出。

运行：`pnpm build && pnpm probe`；回归：`node --test tools/choose.test.mjs tools/hover-actions.test.mjs tools/entity-interactions.test.mjs tools/markdown-presence.test.mjs`。浏览器只检验 hover 与排布，不对正式模板做测试收取或剧情推进。
