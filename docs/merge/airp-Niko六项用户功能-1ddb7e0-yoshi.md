# Niko 六项用户功能批次登记

> 提交 `1ddb7e0` · 父提交 `5cc7a83` · 作者 yoshi · 2026-09-14
> 性质：Niko 六项用户与运行时功能的选择性迁移登记（非机械合并）
> 来源分支：`origin/niko@8a2df60` 的对应功能增量；实现严格遵守 `docs/ux/08-niko功能迁移契约.md`。
> 登记原因：本批已进入 main，现按合并纪律补齐独立登记；不把它追记到早期 `a1ac282` 登记中。

## 1. 本批落地功能

### 物品行动草稿

- 背包选择物品只生成本地 Writer 草稿；
- 使用精确物品路径作为引用；
- 重复选择幂等；
- 明确 Send 后才进入 Writer；
- 不自动消费、移动或执行物品。

### Continue / 下一步提示

- 只在 Writer settled/idle 且世界可用时出现；
- 使用当前 Writer prompt 接缝；
- 点击后先写入本地输入草稿，不自动发送；
- 同一 completion 不重复生成；
- 支持关闭提示和失败/冻结/忙碌恢复。

### 音频独立音量设置

- Music 与 Voice 两个独立滑块；
- UI 0–100%，底层继续使用既有 0–1 channel API；
- 不改变 master mute、TTS provider 或服务端合成；
- TTS 未配置或音频不可用时，文字与动作仍可用。

### 世界变化 Toast

- 只消费 `useWorld.ts` 已判重的 `world_event`；
- 支持创建、移动、删除、编辑、选择、掷骰、使用物品和 layer 变化；
- `event.id` 幂等、短窗口合并、world switch 清理；
- 不从 tool_start、fs.watch 或点击推测成功；
- 不把事件落账伪装成谜题解决。

### 完整 Agent 执行活动日志

- 基于现有 `agentActivityStore` 的 selector/projection；
- 全局 Writer/functional Agent 提供完整日志；
- CharacterModal 中接入角色 session 隔离的完整日志；
- 按 turn 分组，支持展开/折叠和运行中/完成/失败/停止状态；
- 不展示原始参数、绝对路径、模型思维或文件正文；
- 不新增第二套 WS 监听或 activity store。

### Writer 单轮工具调用上限

- 默认每个 Writer engine turn 最多 24 次工具调用；
- `AIRP_WRITER_MAX_TOOL_CALLS` 可用正整数覆盖；
- 每次 Writer turn 清零；第 N+1 次调用在执行前阻断；
- 只对顶层 Writer 生效，Character、functional、initializer 不受影响。

## 2. Writer guard 的删减理由

Niko 原版同时限制单轮 Chalk 数量、重复 Chalk，并禁止原生 `write`/`edit`。这些规则本批刻意没有迁移：

> 它们会直接导致作家无法完整初始化一个场景。

场景初始化可能需要连续创建、编辑多个文件，也可能需要原生写入完成结构准备。把这些合法初始化动作误判为普通叙事轮，会在中途截断初始化。因此本批只保留可配置的 Writer 工具调用总量上限作为失控循环保护，其他责任继续由动作层、初始化流程和现有契约承担。

## 3. 共享边界

- 文件与事件仍是世界真相；Toast、activity log、Continue hint 都不是第二套事实状态；
- `useWorld.ts` 仍是唯一 WS 消费入口；
- 世界 Toast 和 Agent 日志通过 store/selector 投影，不增加 raw event listener；
- Writer、Character、initializer 的生命周期和权限边界保持分离；
- i18n、音频降级、键盘操作和窄屏布局与功能同批落地。

## 4. 验证

本批提交前后记录：

```text
六项功能定向测试       57/57 PASS
pnpm build              PASS
pnpm check:ws           PASS
pnpm check:bodies       PASS
pnpm check:ux           PASS
pnpm check:docs         PASS
pnpm check:i18n         PASS
pnpm check:merge        PASS
tools/writer-beat-guard 6/6 PASS
```

全量 `pnpm test` 曾被工作区中未暂存的 `templates/wuwu/.airpworld/openings/wuwu.json` 删除状态影响；该外部删除未被本提交暂存或覆盖。其余本批定向测试、构建与专项门禁均通过。
