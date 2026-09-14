# 画布整理跨篇契约评审

> 评审范围：06–12 设计稿。评审代理：ContractConsistencyReview（只读）；本报告由主代理依据其完整 findings 落盘。日期：2026-09-14。

## 结论

**不通过实现评审门。** 当前设计稿已经覆盖主要模块，但跨篇存在会让实现无法闭环的 blocker；在唯一字段、工具名、身份、版本和视觉失败语义冻结前，不得写代码。

## Blocker

1. **HTTP 请求/ack/cancel 不一致**：B `08:104-130` 要求 `mode`、必填 `expectedRevision`、`expectedCanvasVersion`、`snapshotId`，ack 使用 `ok:true`、`requestId`、`world`、HTTP 202；D `10:112-172` 的请求缺少这些字段，ack 使用 `accepted:true`，取消响应另有 `stage` 枚举。必须由 B/D/E 同批冻结一个 schema，删除别名。
2. **工具名与输入不一致**：B `08:226-306`/preset 允许 `view_canvas, arrange_canvas`，并仍写 `view_canvas mode:image`；F `12:219-305` 规定 `screenshot_canvas, arrange_layer` 且禁止 mode=image。按任一侧实现，另侧都会遇到未注册或 unsupported。
3. **安全整理 Action 形状分叉**：A `07:184-205` 与 B `08:134-213` 分别定义 `arrangeCanvasLayer`、`arrangeCanvas`、`arrangeLayerSafely` 三套输入/输出，snapshot/version/operation 字段不一致；必须选定一层 public Action + 一层 store primitive 的唯一分层签名。
4. **Actor/Scope 尚未落实到代码**：06 已冻结受控 functional，但当前 ActorType/Scope 和 unknown fallback 仍不成立（`packages/shared/src/actions/actor.ts:9-49,73-83`）。实现必须同步 actor、reader、权限、schema、事件审计并 fail-closed。

## High

- C `09:78-92` 的 `canvasRevision` 是 SHA-256 string；D `10:310-319` 曾写 number，必须区分数值 `canvasVersion` 与内容 digest `canvasRevision`。
- B 使用 active `store.worldRoot`，C 使用 opaque manifest `worldId`，D 写 `world id or root`；外部请求统一只收 opaque `worldId`，server 内部转换 root。
- D 缺少 operation status 查询；断线/刷新后不能只靠 activity 猜总体阶段。
- `canvas_conflict` 与 D 的 `revision_conflict` 错误名不一致；必须统一一枚 error/outcome，并保留独立本地 `conflict`。
- 07/11 的 phantom 测试文件名、drag batch 测试路径、preset parity 文件名不一致；测试集合必须指向同一真实文件。
- 06 §3 新增的 Writer 同 run 自激生成风险，07 必须含 E-GEN-01 源头护栏与非空回归；仅 11 的笼统并发表不够。
- 06 §3 幻影硬要求与 07 原稿“允许临时 DOM overlap/禁止 overflow:hidden”冲突；07 必须选动态占位、安全裁切或延迟可读并补真实 DOM red→green。

## 建议唯一收敛顺序

1. 先由 B/C/D/F/E 冻结 worldId、工具名、HTTP、error/outcome、snapshot/version 集合。
2. 再由 A/B 冻结唯一安全 Action 分层签名和旧写入口迁移表。
3. 由 07 选择生成中 Chalk 的非覆盖策略，11 统一非空测试路径。
4. 最后实现并运行机械双向集合检查；不使用并集或宽松 includes。
