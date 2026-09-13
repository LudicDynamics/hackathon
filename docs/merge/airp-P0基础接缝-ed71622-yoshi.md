# P0 基础接缝批次登记

> 提交 `ed71622` · 父提交 `003d14d` · 作者 yoshi · 2026-09-14
> 性质：P0 基础能力落地登记（非机械合并）
> 关联来源：此前 main 与 `origin/niko` 的 UI/内容演进分叉；本批只冻结并落地当前主线需要的基础接缝。
> 登记原因：该提交已经进入 main，但此前没有对应的 `docs/merge/` 记录，现按合并纪律补登记。

## 1. 本批落地内容

- 前端 active projection、camera memory stack 与取景接缝；
- Agent frame queue 与 Character turn 相关接缝；
- `ActionFeedback` 反馈投影；
- Writer state、Writer 输入生命周期和 DiceCeremony 输入接缝；
- Nook note action/schema 与 nook route 补全；
- Appearance / layout / phantom 相关 P0 接缝；
- `check-ux-contract.mjs`、`ux-contract.json` 及对应测试；
- App、Canvas、CharacterModal、NookView、DiceRoller 等现有组件的 P0 兼容改写。

## 2. 裁决原则

本批不是从任何远端分支直接取整提交。实现以当前冻结契约为准，保留：

- 文件与事件为真相源；
- `useWorld` 单一 WS 消费入口；
- Writer 游标只在 writer actor 上推进；
- Nook 独立于普通 layer 派生；
- AppearanceResolution、ActionFeedback、character-frame queue 等跨模块接缝。

不以“代码已经存在”替代契约核验；新增检查器用于防止组件、事件和文档再次出现半条链。

## 3. 风险与处置

- `App.tsx`、`useWorld.ts`、`WriterResult.tsx`、`CharacterModal.tsx` 均属于高连接面文件，采取现有行为与新增 P0 接缝并存的人工改写，不按冲突块机械取一侧。
- `check-ux-contract` 把 projection、camera、Agent frame、input 和反馈接缝登记为可核验契约，避免以后只保留 UI 而丢生产/消费端。
- 当前批次不引入第二套叙事状态或新的 `get_state` / `set_state` 命名空间。

## 4. 验证

提交后记录：

```text
pnpm build       PASS
pnpm test        785/785 PASS
pnpm check:ux    PASS
pnpm check:docs  PASS
pnpm check:ws    PASS
pnpm check:bodies PASS
```

## 5. 后续关联

后续 `21fea59` 与 `a1ac282` 在本登记之后继续扩展照片/角色内容和选择性 Niko 功能迁移；它们各自独立登记，不把不同父提交和裁决混写成一次机械 merge。
