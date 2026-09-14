# 照片与角色内容批次登记

> 提交 `21fea59` · 父提交 `800318a` · 作者 yoshi · 2026-09-14
> 性质：照片卡、角色创建和 Character / Nook 内容能力登记（非机械合并）
> 关联来源：Niko 侧照片、角色与初始化方向；按当前 main 的动作、媒体和初始化契约重新接线。
> 登记原因：本批已进入 main，但此前没有对应的 `docs/merge/` 记录，现按合并纪律补登记。

## 1. 本批落地内容

- PhotoCard、PhotoMedia 与 PhotoDetailDialog；
- CardRenderer / CanvasObject / SceneBackdrop 对照片实体的渲染接线；
- `media` 规则、媒体 schema 与音频 route 接线；
- 角色创建、角色配置编辑与对应 action/service；
- Character / Nook 的内容字段、preset 和初始化支持；
- `create-char`、`edit-character-config` 等显式 Agent 工具；
- photo、character、nook、scene initialization 相关文档与 skills；
- 对应 server/shared/web 测试和素材门禁更新。

## 2. 裁决原则

本批只迁移功能意图，不接受远端对现有 P0 的删除或弱化：

- 媒体路径继续经过当前 asset 解析与安全边界；
- 角色与 Nook 内容继续以文件为真相；
- CharacterModal 保留当前 TTS、角色 turn 和状态接缝；
- Nook 继续走 `/api/nook`，不进入普通 layer 派生；
- 新 action 经过 action service 并落事件，不能由 UI 直接写世界；
- 新增内容不创建第二份角色或世界状态文件。

## 3. 连接面与风险

- `App.tsx`、`CharacterModal.tsx`、`NookView.tsx`、`world.ts` 和 shared action 文件均按当前契约人工保留两侧能力，不以文件冲突结果作为完整性证明。
- Photo 失败时保留实体文本与可用状态，不把媒体存在误当作叙事事实。
- 角色创建/编辑失败必须返回可见错误，不能静默当作成功。
- 本批不恢复已被当前产品契约明确删除的场景固定入场面板。

## 4. 验证

提交后记录：

```text
pnpm build       PASS
pnpm test        PASS
pnpm check:bodies PASS
pnpm check:docs  PASS
pnpm check:skills PASS
pnpm check:voices PASS
```

## 5. 后续关联

`a1ac282` 在本批基础上继续完成双语模板、Provider/TTS、声明行动、骰子演出和素材迁移；六项用户功能另行登记，不与本批的照片/角色能力混淆。
