# BASELINE — 立法前的合并（豁免名单）

> **本文只做一件事**：逐个列出「`docs/merge/00-合并纪律.md` 生效之前」的 first-parent merge SHA。
> 门禁 `tools/check-merge-log.mjs` 跳过名单里的 SHA；**名单外的每一个 merge 都必须有登记**。
>
> **为什么是 SHA 白名单，不是日期**：日期是门禁信不过的时钟（时区、amend、rebase 都会失真），SHA 是内容派生的、可逐行 `git show` 复核的。**这份文件本身可被审计——这就是它存在的意义。**
>
> **立法日：2026-09-13。** 此后新增的 merge **一律不许**往这里加——补登记才是正确做法（`00-合并纪律.md §2`）。
> **本文件只在首次立法时写过一次。**

---

## 1. 豁免名单（7 条）

都是一次性的「同步远端 main」小合并，落在纪律确立前；**没有一条引发过静默丢失**。

- caf1af07e8a670be294483ba3288696998f8c0ca  # 2026-09-13 Merge remote-tracking branch 'origin/main'
- a7335df4d7902e5acbb64484eab899d2f1cc8675  # 2026-09-12 merge: 同步远端 main
- d50c090e620a5787ff30bffd9ea106b87c017c15  # 2026-09-12 Merge remote-tracking branch 'origin/main'
- cb66705ea04bf6f1e2452e9d0f18f4e007f4a7ea  # 2026-09-12 merge: 同步远端 main
- fca2b658a95d0bb1e90065228ddbe2e00657681b  # 2026-09-12 merge: 同步远端 main 后推送 B1 工具面落地
- 7cae763fe69eb78f46f3208af7f4be34628fbbc0  # 2026-09-12 merge: 同步远端 Windows 路径修复提交
- 1d99e07ed91ce9c7577d8507eb626324770ead59  # 2026-09-12 merge: origin/main into main (整合远端 3 个提交)

---

## 2. 已登记的三次（**不在豁免名单**，列此仅供对照）

立法当天补登记的三次合并（`docs/merge/*.md`），**故意不写进 §1**——它们是纪律的**首批正面样本**，门禁必须真去核它们的登记文件：

| merge | 登记 |
|---|---|
| `813c0f3` | `docs/merge/niko-沉浸式界面-813c0f3-yoshi.md` |
| `389749c` | `docs/merge/windows-启动入口-389749c-yoshi.md` |
| `60be734` | `docs/merge/niko-模板分发-60be734-yoshi.md` |

### 维护纪律

- 只有**首次立法**可以把 SHA 写进 §1。此后一律补登记。
- 若某次合并确实不需要登记（例如空合并 merge-base 无变化），**先问为什么会出现一个空合并**，再决定——不要用它开豁免的先例。
