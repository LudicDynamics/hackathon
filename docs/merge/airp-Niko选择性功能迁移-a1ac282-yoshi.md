# Niko 选择性功能迁移批次登记

> 提交 `a1ac282` · 父提交 `21fea59` · 作者 yoshi · 2026-09-14
> 性质：双语世界、演出、Provider/TTS 与声明行动的选择性迁移登记（非机械合并）
> 来源分支：`origin/niko`；本批把 Niko 侧新增能力按当前 main 的 P0、WS、动作和资源契约重新落地。
> 登记原因：本批已进入 main，但此前没有对应的 `docs/merge/` 记录，现按合并纪律补登记。

## 1. 本批落地内容

### 用户与世界内容

- 双语 Wuwu、Whitechapel、Divergence、First Snow、Magic Academy、Moonlit Contract 等模板；
- 世界、角色、Nook、场景与骰子相关内容卡；
- `pre-bilingual-2026-09-14` 归档模板、source/archive manifest 与资源索引；
- 角色、场景、motion、decoration 素材及其 provenance；
- 世界版本检查、模板本地化和版本覆盖工具。

### 前端与演出

- D10 / D6 / percentile 的 renderer-only 演出接线；
- 声音 channel API、decoration surface 与场景外壳素材；
- 声明行动弹窗、材料审核和当前 `ActionFeedback` / `runAction` 接缝；
- 前端 Provider / TTS 设置接线。

### 后端与 Agent

- Provider config、DeepSeek 配置示例与 TTS route/config；
- 声明行动 server engine、revision/slot 校验和材料审核 response；
- launch / preset 的显式配置接线；
- 对应 web/server/tools 测试、素材门禁和世界版本门禁。

## 2. 选择性迁移裁决

本批没有 cherry-pick 或 merge `origin/niko` 的完整提交链。优先级为：

1. 当前 main 的冻结契约；
2. 已落地的 P0 接缝（`ed71622`）；
3. Niko 的可玩内容与演出增量；
4. 对远端新增实现进行当前 API、事件和资源边界适配。

保留并核验：

- `DiceCeremonyInput` 与 `ingestPlayerRoll` 作为骰子事实入口；
- `/api/choice`、`chooseOption` 与材料审核的当前 response shape；
- AppearanceResolution、Chalk lock、Agent activity store/queue；
- `useWorld` 单一 WS 入口；
- 文件世界内容与 `.airpworld` SQLite 状态分离。

## 3. 明确没有接受的远端变化

远端分支中会删除或弱化当前 P0 的内容没有随本批迁移，包括：

- ActionFeedback、AppearanceResolution、flow-columns、phantom registry；
- Agent activity store、Character frame queue；
- 当前声明行动的安全检查与材料审核语义；
- 当前角色音色、TTS 文本清洗和初始化边界；
- 当前 UX contract checker 与相关文档门禁。

同时没有把 `tools/experiences/*.mjs` 后续新增内容编译模块作为本批功能迁移；它们与发布模板内容属于另一条 source/compiler parity 工作线。

## 4. 风险与补救

- D10 使用独立 `@airp/shared/dice` browser-safe subpath，避免把 `node:crypto` 带入 Vite 浏览器构建。
- 声音与 TTS 保持 fail-soft；未配置时不发起合成，不把媒体文件存在当作世界事实。
- 声明行动的 Prepare 与 Send 分离，Prepare 不启动 Writer、不移动或消耗物品。
- 世界内容归档和发布模板分开，避免 workshop 产物成为发布真相。

## 5. 验证

提交后记录：

```text
pnpm build          PASS
pnpm test           816/816 PASS
pnpm check:ux       PASS
pnpm check:ws       PASS
pnpm check:bodies   PASS
pnpm check:docs     PASS
pnpm check:i18n     PASS（仅已有未使用 literal key 警告）
pnpm check:voices   PASS
pnpm check:skills   PASS
```

## 6. 后续独立登记

本批之后的六项用户功能——物品行动草稿、Continue/下一步提示、音频独立音量 UI、世界变化 Toast、完整 Agent 执行日志、可配置 Writer 工具调用上限——不并入本登记。它们有独立的共享契约和设计文档：

```text
docs/ux/08-niko功能迁移契约.md
docs/ux/09-物品行动草稿设计.md
docs/ux/10-Continue下一步提示设计.md
docs/ux/11-音频独立音量设置设计.md
docs/ux/12-世界变化Toast设计.md
docs/ux/13-完整Agent执行日志设计.md
docs/ux/14-Writer工具调用守卫设计.md
```

待该批功能形成独立提交后，再以实际提交短哈希建立新的 merge 登记，避免把未提交工作区伪装成已完成合并。
