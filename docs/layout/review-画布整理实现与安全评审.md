# 画布整理实现与安全评审

> 评审范围：06–12 设计稿及对应实现。评审代理：ImplementationSecurityReview（只读）；本报告由主代理依据其最终 coverage summary 落盘。日期：2026-09-14。

## 结论

**不通过实现评审门。** 主要问题不是 UI 细节，而是权限 fail-open、跨端协议未收敛、截图 transport 尚不可安全落地，以及旧写入口绕过版本/碰撞安全。

## Critical / Blocker

- **LAYOUT-SEC-001：functional 身份 fail-open。** 当前 `resolveAgentActor` 对未知角色回退 writer（`packages/shared/src/actions/actor.ts:21-49`），而 `engine` 还拥有 trusted/nook 权限（`:78-105`）。必须完成受控 functional Actor/Scope、精确 role/scope 与 unknown fail-closed。
- **LAYOUT-SEC-002：08/09/10/12 工具与 HTTP 契约冲突。** `arrange_canvas/view_canvas mode:image` 与 `screenshot_canvas/arrange_layer` 两组命名并存；B/D request、ack、cancel 字段也不一致。
- **LAYOUT-SEC-003：截图 HTTP 缺可落地 auth/origin/child transport。** 当前 server 使用宽松 CORS 并监听 `0.0.0.0`（`apps/server/src/index.ts:49-54,339-343`）；设计只写原则，未定义 child 如何取得不可伪造的短时 capability，不能让 Agent 任意请求 active world。
- **LAYOUT-SEC-004：CanvasSnapshot “同一读边界”无法由现有存储直接实现。** 09 同时 hash SQLite rows 与异步 Markdown 文件；没有跨源事务/锁，可能得到 torn snapshot。必须改成 DB 版本 fencing + content digest 前后检查，或只声明 DB 证据并在不一致时 conflict。

## High

- canvasVersion 与 footprint 版本语义冲突；现有 `/card/footprint` 与 `writeFootprints` 无版本守卫（`world.ts:1135-1208`、`local-store.ts:1144-1215`）。
- 旧 `arrangeCards`/逐卡 `/card/position` 仍能绕过统一 AABB/version（`canvas.ts:423-597`、`world.ts:1115-1132`）；不能以“新 Agent 安全”掩盖其他入口继续制造重叠。
- `seatNear` 读算写无锁，且 `move.ts:190-233` 可能先移动文件再发现无座位，需在设计中决定 transaction/补偿语义。
- footprint 可按任意 id 改另一层 row；必须检查 page membership 与受控身份。
- world switch 当前只停 writer/character（`world.ts:577-607`），需要 functional runtime stop + commit-time active-world generation fence。
- 07 原稿中的 Chalk phantom 仍允许完整正文越过 provisional seat；必须落实 06#4C82 的 delayed readable/dynamic placeholder/safe clipping，并做真实 DOM 非空测试。
- `context.ts:165-194` 同一 run 重复追加 `llmRole:'user'` 状态块，可能自激重复 Chalk；beat guard 只能限流，不能作为根因修复。
- 09 的 clean cutover 还未落实 shared barrel/dist：扩展从 `packages/shared/dist` 导入，新 snapshot 模块必须同步导出和构建。
- 独立 vision-checker 目前没有 owner、transport、预算和 runtime signal 字段；相对本批的确定性 DOM geometry + 最新 rows AABB，它是未定义且可能过度复杂的第二模型链路。

## 最小实施顺序

1. 冻结 canonical worldId、工具名、HTTP/error、Actor/capability 与 snapshot/version。
2. 建立跨源 snapshot/version fencing 和唯一 atomic canvas writer，迁移 near、drag、footprint、旧 arrange/position 的写入口。
3. 实现 read-only screenshot page/gate；若保留第二视觉 Agent，先另立完整 trust contract，否则用确定性 DOM geometry + rows 验证，截图只作视觉证据。
4. 再实现独立 runtime、按钮和 i18n；每一步以非空 before/after fixture 证明。
