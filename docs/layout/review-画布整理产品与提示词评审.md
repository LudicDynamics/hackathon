# 画布整理产品与提示词评审

> 评审范围：长 Chalk 体验、整理入口、12 提示词与 Nodesign 借鉴。评审代理：ProductPromptReview（只读）；本报告由主代理依据其最终 findings 落盘。日期：2026-09-14。

## 结论

**不通过。** 设计方向正确，但当前稿件仍会让玩家看到生成中 Chalk 绘到邻卡，并且提示词与实际工具/状态协议不一致，不能直接实现。

## Blocker / High

1. **生成中 Chalk 仍会覆盖邻卡。** 07 `:318-323` 仍描述固定 provisional seat、完整渲染 `entry.text`、禁止裁切；其 E-PHANTOM 只阻止把临时覆盖当作“正式成功”，没有阻止玩家实际看到字叠字。必须在 07 选定动态占位、安全裁切或延迟可读，且真实 DOM fixture 修复前非零覆盖、修复后零覆盖；不能只降级报告。
2. **截图工具不可调用。** 08 `:273-306` 的 launch/preset/extension 只允许 `view_canvas, arrange_canvas`，还保留 mode=image；12 `:219-305` 则要求 `screenshot_canvas, arrange_layer` 并禁止 mode=image。必须统一名字、schema、allowlist、toolName 与截图错误语义。
3. **整理工具 schema 不一致。** 12 的 `ArrangeLayerInput` 要求 `policy/maxMoves/allowMoveStableCards/preserveLinks`，B 的安全动作输入没有这些字段；`additionalProperties:false` 下会拒绝或静默丢掉结构保留意图。
4. **required visual proof 绕过 no-op。** 12 `:309-345` 的 clean layer 直接进入 `VERIFIED_NOOP`，但 required proof 又要求独立 verdict；必须让 no-op 也经过所需视觉证据，或明确仅 structural-not-proven，不得 completed。
5. **独立 vision-checker 没有可执行接缝。** 12 `:16-18,99-109` 要求独立 verifier，却没有派发输入、超时/取消、固定解析或 runtime→D 传递。建议本批采用确定性 DOM geometry + 最新 rows AABB 作为完成闸，截图作为 Agent 的视觉 evidence；若坚持第二模型，须另立完整 trust contract。
6. **稳定结构保留没有机器判据。** 12 `:264-305` 声称保留阅读顺序、分组和 relative adjacency，但 snapshot/action 没有 baseline 或比较算法。要么把关系快照与比较纳入安全 Action，要么删除超出证据的承诺，并在 receipt 中如实说明。
7. **截图失败前后语义冲突。** 10 与 12 对同一 `screenshot=true` 失败分别给出 “Nothing was changed” 和已提交后的 partial。必须冻结：写入前截图失败 = no write/failed；提交后截图或复核失败 = partial/conflict，保存坐标事实，不能说 Nothing changed。

## Nodesign 借鉴结论

可保留：先读真实状态、相对意图而非模型绝对坐标、同画布真实 Chromium/ready/gate、失败显式、工具回执返回实际 resolution。不可照搬 artifact/tag/lane/staging/HTML deck。Nodesign 的先读与截图是纪律，不是服务端机械证明；AIRP 必须由服务端全层 AABB/版本复读决定完成。
