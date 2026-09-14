# 02 洞 2 — 原生 `edit` 可以改写已结算事实与幂等回执

> 状态：**设计（待评审门）**。本文件按 12 节结构给出「定位 / 威胁模型 / 签名与参数 / 行为契约逐步 / 文件与副作用 / 落账 / WS 前端 / 错误边界 / 代码落点 / 与现状差异 / 验收测试 / 冲突与待拍板」。
> 共享地基：`docs/security/00-共同上下文.md`（下称 **`00`**）。**本文件不重复该文的威胁模型与术语，只引用其编号。**
> 登记处：`docs/现有安全待办台账.md:68-117`（**只读**）。C1 冻结出处：`docs/command/00-共同上下文.md §R.2`（`:803-823`）、`§R.12`（`:942-951`）、`docs/command/04-效果原语集.md:702`。

**本文件写的是设计，不是已实现代码。** 事实带 `file:line`；设计意图标「方案」；推断标 `[推断]`；未决标 **待拍板**。

---

## 1. 定位

### 1.1 一句话

**已经落账的事实（骰子结果、幂等回执），今天可以被后续一次普通的文件改写悄悄换掉，而且没有任何一层会拒绝。**

### 1.2 两条通路（逐环，全部实测）

**通路 A — 动作层共享入口 `editEntity`：**

```
任何调用者
  ├─ POST /api/god-action (action: 'update')   apps/server/src/routes/world.ts:1459-1466
  ├─ apps/server/src/engine/declared-actions.ts:447    （写 dice_receipt）
  ├─ apps/server/src/engine/declared-actions.ts:470-478（写 choice/choice_actions/dice_grade）
  └─ C1 落地后：命令的 edit / set_status / consume 效果（docs/command/04-效果原语集.md:104-141）
        ▼
packages/shared/src/actions/delete.ts:166-246   editEntity
        ▼
:195-201   let merged = { ...parsed.frontmatter };
           for (const [key, value] of Object.entries(input.frontmatter)) {
             if (value === null) delete merged[key];
             else merged[key] = value;              ← ★ 整键替换，无任何保留键防护
           }
        ▼
:221   await store.writeFileAtomic(path, next)      → 文件被改写
```

**通路 B — 原生工具（绕过整个动作层）：**

```
作家 / 角色 agent
  ├─ tool: edit   vendor/pi-rp/packages/coding-agent/src/core/tools/edit.ts:298-368
  └─ tool: write  vendor/pi-rp/packages/coding-agent/src/core/tools/write.ts:187-208
        ▼  cwd = worldRoot（apps/server/src/engine/launch.ts:157/:193）
        ▼
extensions/world-context.ts:50-79   ← 全仓唯一的门禁
        :51  只认 'write' / 'edit'
        :54 只检查「路径前缀 ∈ {world/,player/,characters/} 且 .md」
        :62 nook 权限门
        :72 photo 门
        ← ★ 完全没有 frontmatter 键检查
        ▼
vendor/.../edit.ts:353  ops.writeFile(absolutePath, finalContent)   → 文件被改写
```

### 1.3 为什么"能改 `result`"比听起来更严重

C1 的幂等机制（`docs/command/05-幂等与复访.md:93-122`）把一次运行的尝试身份定义为

```
commandKey = sha256(source, hook, command, fact)
```

其中 `fact` 对骰子触发点取 `r:${result}`（`docs/command/05-幂等与复访.md:140-144`），**而这条论证的全部前提是「同一张卡的 `result` 一生只有一个值」**——该句逐字在 `docs/command/05-幂等与复访.md:142`，其成立理由是重掷门禁（`packages/shared/src/actions/roll-dice.ts:149-155`）。

于是：

```
改写 roll_dice.result
  → 同 (source, hook, command) 算出不同 fact
  → 不同 commandKey
  → 幂等查询未命中
  → 重复结算（重复发奖 / 重复扣物）
```

**即 C1 花整节（`docs/command/05-幂等与复访.md §3.5`）堵住的"重复结算"通道，从背后被打开。**

**必须同时说清的边界**（`docs/command/05-幂等与复访.md:996` 自己已登记，本文照抄口径）：**幂等机制守的是"同一事实不重复结算"，不是"防止有人伪造事实"。** 因此本洞的修复**不是给幂等打补丁**，而是把"伪造事实"这条入口关掉。

### 1.4 为什么 C1 落地不会关闭它

C1 的保留键拒绝列**只在效果层强制**（`docs/command/00-共同上下文.md:814` 逐字：`必须在效果层（引擎）强制，不是提示词级`）。`docs/command/00-共同上下文.md:819` 把限定写死：

> 拒绝列只保护"**命令通过效果层发起的 `edit`**"。Agent 用**原生 `edit` 工具**（`vendor/pi-rp/packages/coding-agent/src/core/tools/edit.ts:314-350`，无键检查）**绕过整个动作层**。

**任何"C1 保护了已结算事实"的说法 MUST 限定为"C1 的命令效果"。**

---

## 2. 威胁模型

**一律引用 `00 §2`。** 本洞特有部分：

### 2.1 三种主体与各自的前置

| 主体 | 前置 | 手段 | 结果 |
|---|---|---|---|
| **a. 世界包作者（数据侧）** | 玩家掷过骰 | 内容文件里预置 `roll_dice.result`——**但这是"声明开局状态"，不是"改写"**（`00 §5.2` 第 3 条），**不是本洞** | — |
| **b. 越狱 / 被注入的 agent** | 它读到的世界内容里有一段指令，或模型自己判断"重掷更合适" | 原生 `edit` / `write` 改 `world/**/*.md` 的 `roll_dice.result`；或写 `command_log` 伪造回执 | 文件事实被改；C1 落地后 → 重复结算 |
| **c. 玩家（受信）** | 上帝模式 UI | `/api/god-action` update → `editEntity` | **待拍板 U-2-2**：是否允许 |

**本洞的严重等级按 (b) 定。** 它的触发条件比洞 1 苛刻（要先让 agent 决定改结果），但**一旦发生，损坏的是"文件即真相"这条地基**（`docs/command/00-共同上下文.md:319` 硬门 1）。

### 2.2 一条**已经存在**的诱导（列为事实，因为它降低了 (b) 的门槛）

`extensions/toolkit/roll-dice.ts:45` 的 `promptGuidelines` 逐字：

```
If an entity already has a result, roll_dice refuses; to re-open the check, edit the old result out of the file first.
```

**工具描述是直接进模型上下文的强指令，而它教的正是硬门 3 禁止的操作**（`docs/command/00-共同上下文.md:321` 逐字「MUST NOT 删除 `result` 制造免费重掷」）。`docs/command/05-幂等与复访.md:1050-1056`（§11.3）已把这条登记为冲突并给出改法。

`[推断]` 这条不是洞 2 的**机制**原因（机制是"没有守卫"），但它是让 agent **真的去改**的现实原因之一。**本方案把它列为配套改动**（§9 的 R7，**待拍板 U-2-7**），因为守卫与提示词是同一件事的两面：**守卫拒了、提示词还在教它撞**，会让作家浪费工具调用预算（`extensions/toolkit/writer-beat-guard.ts:11` 默认 24 次）并收到一堆拒绝。

### 2.3 攻击者**不能**做什么（把边界写清，避免夸大）

- 不能改**别的世界**：`WorldStore.resolvePath` 拒绝绝对路径与 `..`，并在 join 后做 belt 检查（`packages/shared/src/store/local-store.ts:128-175`）；agent 的 `cwd` = worldRoot（`apps/server/src/engine/launch.ts:157/:193`）。
- 不能绕开 `photo` 门与 nook 门（`extensions/world-context.ts:62,72-77`）。
- 不能把事件表改掉：`editEntity`/原生写会各落一条 `entity_edited`（`packages/shared/src/actions/delete.ts:227-234`、`extensions/world-context.ts:103-104`）——**但事件里不含正文**（`docs/command/04-效果原语集.md:409` 逐字：`entity_edited` 的详情不存正文），所以**审计能看到"被改过"，看不到"改成什么"**。这是本洞可检测性的上限。

### 2.4 本洞**不**覆盖的面（重述 `00 §5.2` 要点）

1. **`bash`**：`extensions/world-context.ts:51` 只认 `write`/`edit`；`vendor/pi-rp/packages/coding-agent/src/core/tools/bash.ts:90-107` 无白名单。**本方案不覆盖 `bash`**（登记为既有更大缺口，`docs/command/09-安全与边界.md:494` 第 13 条）。
2. **手改文件 / 另一个进程写**：工具层门禁只在 agent 进程的工具调用路径上。
3. **`createEntity` 声明开局事实**：`00 §5.2` 第 3 条。**注意**：本方案对 `command_log` / `command_error` **在创建时也拒绝**（它们是引擎专属键，内容文件不该声明）——见 §3.3 与 §12 U-2-4。
4. **世界包 `extensions/` 全权限代码执行**（`00 §1.3`）——它能直接改文件，本方案拦不到。

---

## 3. 签名与参数

### 3.1 现状签名（**方案不改**）

```ts
// packages/shared/src/actions/delete.ts:36-42
export interface EditEntityInput {
  path: string;
  frontmatter?: Record<string, unknown>;   // 浅合并；null = 删键
  body?: string;                            // 整体替换
}
```

### 3.2 新增的共享符号（**唯一**新增）

```ts
// 方案：packages/shared/src/actions/reserved-keys.ts（新建）

/** 引擎专属键：内容文件 MUST NOT 声明、任何调用者 MUST NOT 写入。 */
export const ENGINE_ONLY_KEYS: readonly string[] = ['command_log', 'command_error'];

/** 已结算事实的子键路径（`<key>.<sub>`）。 */
export const SETTLED_FACT_KEYS: readonly string[] = ['roll_dice.result', 'roll_dice.passed'];

/**
 * 纯函数：这次 `editEntity` 写入是否命中保留键。
 * 命中 → 返回拒绝原因（给人看的一句话）；未命中 → null。
 * 无 I/O、无副作用。
 */
export function reservedKeyViolation(
  before: Record<string, unknown> | null,
  patch: Record<string, unknown>,
): { key: string; reason: string } | null;

/** 同一判据的「文件级」版本，供原生工具门禁使用（比较两份完整文本）。 */
export function reservedKeyViolationInText(
  beforeRaw: string,
  afterRaw: string,
): { key: string; reason: string } | null;
```

**为什么需要两个入口**：动作层拿到的是**结构化 patch**（`input.frontmatter`），原生工具拿到的是**整份文件文本**（`extensions/world-context.ts:68-71` 的 `previous` 与 `proposed`）。两者**共用同一个判据实现**（`reservedKeyViolation` 是核心，`reservedKeyViolationInText` 只是把文本 parse 成 frontmatter 后调用它）。**这是本仓 §10.8 同构纪律的复用**（`docs/command/00-共同上下文.md:814` 逐字：`解析时校验 + 效果执行前运行时校验两处（与 §10.8 同构）`）。

### 3.3 判据（冻结，逐条写清）

**Class A — `ENGINE_ONLY_KEYS`（`command_log` / `command_error`）**：

> **在 proposed 文件里出现的任何非空值 → 拒绝。** 不看 before（它们永远不该出现在内容文件里）。

理由：这两个 key 的语义是「引擎对一次运行的幂等回执」（`docs/command/00-共同上下文.md:208-209`）。内容文件声明它们只有一种用途——**伪造回执**。允许"原样重述"会给出一个无用的例外（重述一份伪造的回执仍是伪造）。

**Class B — `SETTLED_FACT_KEYS`（`roll_dice.result` / `roll_dice.passed`）**：

> **当且仅当 before 里该子键有值、且 proposed 里的值与之不同（含"被删除"）→ 拒绝。**
> before 无值（新声明 / 新文件）→ **允许**。

理由：`00 §5.2` 第 3 条——向新文件声明 `roll_dice: {…, result: 5}` 是**合法的开局状态**（`RollDiceSchema` 的 `result`/`passed` 可选，`packages/shared/src/schemas/frontmatter.ts:76-90`；`createEntity` 不拦，`packages/shared/src/actions/create.ts:108-129`），它不是"改写已发生的事实"。

> **实测注记（2026-09-14）**：shipped 内容**今天不带**预置 `result`（`00 §4.2` 事实 2-17）⇒ T-4 的夹具 MUST **自建**，不能拿模板当例证。

**Class C — `on`（**刻意不在本方案的拒绝列**）**：

`docs/command/00-共同上下文.md:813` 把 `on` 列在 C1 的保留键里，但那条拒绝列的**适用面是效果层**。原因见 `docs/command/07-Agent创作接口.md:288-340`：**作家用原生 `edit` 给实体写 `on` 绑定是 C1 明确要支持的能力**（该文设计的写入门禁还专门为 `on.run` 加了写入期校验）。**因此工具层不能拒 `on`**，否则会打断 C1 的作者面。

⇒ **本方案的拒绝列 = `command_log` + `command_error` + `roll_dice.result` + `roll_dice.passed`，不含 `on`。** 这是对 `docs/command/04-效果原语集.md:702` 那份列表的**有理由收窄**，MUST 在 `docs/command/04` 的对应行加一句脚注（**待拍板 U-2-5**）。

### 3.4 明确**不**新增的参数

- **不加** `allowReserved: true` 之类的逃逸阀：那会把"机制级防线"降级为"调用者自觉"，与 `docs/command/00-共同上下文.md:814` 逐字要求（`MUST NOT 只做提示词级约束`）冲突。
- **不加** `actor` 参数：actor 已在 `ActionContext` 里（`packages/shared/src/actions/service.ts:140-151`）。
- **不加**状态命名空间（`00 §5.3`）。

---

## 4. 行为契约逐步（每步写「漏了会怎样」）

### 步骤 1 — 建立保留键常量与判据（`packages/shared`）

**做什么**：新建 `packages/shared/src/actions/reserved-keys.ts`（签名见 §3.2），在 `packages/shared/src/index.ts` 按 `<actions/*>` 段导出。

**必守的实现约束**（照抄 `packages/shared/src/actions/refs.ts:163-171` 的既有风格）：

- **纯函数、无 I/O**。`reservedKeyViolation` 只吃两个对象；`reservedKeyViolationInText` 只吃两份字符串，内部调既有 `parseFrontmatter`（`packages/shared/src/schemas/frontmatter.ts:180-236`）。
- **判据的单一来源**：两个入口 MUST 调同一个内部实现。**不许**在扩展里再写一遍键名列表。

**漏了会怎样**：键名列表写第二遍 = 第二真相源。**具体后果**：动作层拒了 `command_error`、工具层没拒，于是 agent 只要用原生 `edit` 就能绕过——而这正是本洞的形状。本仓已有先例：`docs/command/09-安全与边界.md:489` 记的翻译通路口径与 `prepareMaterialReview` 的口径就是两句各自演化的话。

---

### 步骤 2 — 动作层强制（`editEntity`）

**做什么**：改 `packages/shared/src/actions/delete.ts` 的 `editEntity`，在 `:201`（浅合并循环结束）之后、`:221`（`writeFileAtomic`）之前插入：

```diff
     let merged = parsed.frontmatter ? { ...parsed.frontmatter } : {};
     if (input.frontmatter) {
       for (const [key, value] of Object.entries(input.frontmatter)) {
         if (value === null) delete merged[key];
         else merged[key] = value;
       }
     }
+    // 洞 2（docs/security/02 §3.3）：保留键拒绝列。放在合并之后（需要 before）
+    // 与写盘之前（拒绝时文件零改动）。
+    const violation = input.frontmatter
+      ? reservedKeyViolation(parsed.frontmatter, input.frontmatter)
+      : null;
+    if (violation) {
+      throw new ActionError({
+        code: 'invalid_argument',
+        message: `edit: "${violation.key}" is a reserved key — ${violation.reason}`,
+      });
+    }
```

**位置的三条理由（都要写进代码注释）**：

1. **必须在 `:193` 的 `eventKindOf` 之后**：那条注释（`delete.ts:191-192`）逐字要求 `kind` 在合并前算。本检查不依赖 `kind`，但**插在它之前会打乱那段注释的上下文**。
2. **必须在写盘之前**：命中即抛 → 文件零改动。这与 `docs/command/07-Agent创作接口.md:438-441` 逐字给出的性质同形（`"拒绝一次写入 = 世界零改动"`）。
3. **必须在 `merged` 算完之后**（而不是直接看 `input.frontmatter`）：因为"值是否**变化**"这个判断需要 before（Class B 的判据）。

**排除了什么（机制描述）**：排除了「**经 `editEntity` 这一条函数**改写 `command_log` / `command_error` / 已结算的 `roll_dice.result` / `passed` 的所有调用者」——具体是 `/api/god-action` update（`apps/server/src/routes/world.ts:1459-1466`）、`apps/server/src/engine/declared-actions.ts:447` 与 `:470-478`、以及 C1 落地后命令的 `edit`/`set_status`/`consume` 效果（`docs/command/04-效果原语集.md:104-141`）。

**没排除什么（机制描述）**：

- **没有排除** `writeChalk`（`packages/shared/src/actions/chalk.ts:394-612`）。它的 `frontmatter` 入参是 `ChalkFrontmatterInput`（`:51-60`），**类型上只能带 `status`/`choice`/`roll_dice`/`extra`**——`roll_dice` 是 `RollDice`（含 `result`/`passed`）。`[推断]` 它的 `buildFrontmatter`（`:256-305`）会把给定的 `roll_dice` 原样写进文件，**因此 `writeChalk` 理论上也能写入 `roll_dice.result`**。今天无调用点传它（`extensions/toolkit/chalk.ts:72-80` 的调用体，逐字注释在 `:79`：`` No `frontmatter`: interactive fields arrive in Phase ② via `edit` ``；`packages/shared/src/actions/nook-note.ts:104-111` 也不传）。**待拍板 U-2-3**。
- **没有排除** `createEntity`（`packages/shared/src/actions/create.ts:126-130` 的 `store.writeFile`）。它是"声明"，但**能创建一份带 `command_log` 的新文件**。§3.3 的 Class A 判据**在创建时也应生效** → **待拍板 U-2-4**。
- **没有排除** `editCharacterConfig`（`packages/shared/src/actions/edit-character-config.ts:79-88` 的 `writeFileAtomic`）：它只写 `characters/<id>/{README,identity,personality,memory}.md`，`[推断]` 那些文件不会带 `roll_dice`，但它**同样是绕过 `editEntity` 的写盘点**。
- **没有排除** `packages/shared/src/components/core.ts:32-50` 的 `rewriteTarget`（组件 handler 的写盘）、`packages/shared/src/actions/refs.ts:410,461`（引用重写）。
- **没有排除** 原生 `edit`/`write`（那正是步骤 3）。

**上面五条"没排除"的合取，就是本洞的真实剩余面。** 本方案的取舍是：**只关两条主要入口（`editEntity` + 原生 `write`/`edit`），其余登记为待拍板**——因为那五条今天都**没有**把保留键写进去的调用点，而在没有调用点的地方加守卫是"为假设的漏洞写代码"。**它们的共同点是「经由动作层」**：若按 `docs/command/00 §4.1` 的架构（一切写入经动作层），在这五处之上还应有**一层**统一守卫——**待拍板 U-2-6**。

**漏了会怎样**：漏了这一步，`/api/god-action` 与 C1 的效果层（后者是 C1 §R.2 点名的落点）都没有防线——**C1 的冻结契约直接落空**。

---

### 步骤 3 — 工具层强制（`extensions/world-context.ts`）

**做什么**：在既有 `tool_call` handler 里，紧跟 photo 门（`:72-77`）之后、`writes.set(...)`（`:78`）之前插入：

```diff
     if (
       (proposed !== undefined && isPhotoContent(proposed)) ||
       (event.toolName === 'edit' && proposed === undefined && isPhotoContent(previous))
     ) {
       return { block: true, reason: '…photo…' };
     }
+    // 洞 2（docs/security/02 §3.3）：保留键。`proposed === undefined` = 无法
+    // 预测落盘内容（edit 的匹配可能模糊，见 vendor/.../edit-diff.ts:27-45）
+    // → 不可预测就不可放行（硬门 4 的"不静默失败"）。
+    if (proposed === undefined) {
+      return { block: true, reason: 'Cannot verify the resulting frontmatter for this edit; restate it as one edit whose oldText is unique, or use `write`.' };
+    }
+    const violation = reservedKeyViolationInText(previous, proposed);
+    if (violation) {
+      return { block: true, reason: `invalid_argument: "${violation.key}" is a reserved key — ${violation.reason}` };
+    }
     writes.set(event.toolCallId, { file, existed });
```

**`proposed` 的来源与可信度（必须写清，这是本步最脆的一点）**：`proposed` 由既有的 `mergedEditText`（`extensions/world-context.ts:23-40`）算：`write` 取 `input.content`（精确，就是落盘内容）；`edit` 走 `Array.isArray(input.edits)` 分支逐条 `String.replace`（**预测**）。**它不是落盘结果**：pi-rp 的真实匹配有 NFKC 归一、`trimEnd`、智能引号、模糊匹配、重复/重叠报错（`vendor/pi-rp/packages/coding-agent/src/core/tools/edit-diff.ts:27-45`）。

因此：

- **`proposed === undefined` 时必须拒绝**（不是放行）。`[推断]` 这会让一种合法情形失败：模型用 legacy 形状 `{path, oldText, newText}` 调 `edit`。**但该形状在 hook 处已不可达**——`vendor/pi-rp/packages/coding-agent/src/core/tools/edit.ts:313` 注册的 `prepareEditArguments`（定义 `:105-129`）在 `beforeToolCall` 之前就把 legacy 归一成 `edits:[…]`（`docs/command/07-Agent创作接口.md:400-410` 已逐字核实，并指出 `inputText` 的 `newText`/`text` 两个分支对 `edit` 不可达）。⇒ **`proposed === undefined` 是"形状不认识"的可靠信号**。
- **预测可能与落盘不同**（模糊匹配会改变替换位置）。方案**接受**这个残余：一个足够刁钻的 `oldText` 可以让预测通过、落盘命中保留键。**这是本步的诚实上限**，MUST 写进 §8 与 §11 的可观测差异描述。

**为什么必须有这一步（而不是只做步骤 2）**：`docs/command/00-共同上下文.md:817` 逐字把这条列为**既有洞立项**，`:819` 逐字说明原生工具**绕过整个动作层**。只做步骤 2 = 洞原样活着。

**排除了什么（机制描述）**：排除了「`edit`/`write` 两个工具、目标路径落在 `world/`|`player/`|`characters/` 下的 `.md`、且其**预测结果**含保留键违规」的调用。命中即 `block`，而 `block` 的语义是**工具一次都不跑**（`vendor/pi-rp/packages/coding-agent/src/core/extensions/runner.ts:1094-1096`；`docs/command/07-Agent创作接口.md:438-441` 已核实该链）。

**没排除什么（机制描述）**：

- **没有排除 `bash`**（`extensions/world-context.ts:51` 不含 `bash`；`vendor/pi-rp/packages/coding-agent/src/core/tools/bash.ts:90-107` 无白名单）。**这是本方案最大的缺口**，登记为 `00 §5.2` 第 1 条。
- **没有排除**"预测与落盘不一致"的模糊匹配残余（见上）。
- **没有排除** `vendor/pi-rp/packages/coding-agent/src/core/tools/path-utils.ts:48-50` 的符号链接：`:54` 的前缀检查是对**相对化后的字符串**做的，不解析 realpath。`[推断]` 一个指向世界外的 symlink 仍会被前缀过滤挡下（字符串不以 `world/` 开头），但一个世界**内部**的 symlink 指向另一个世界文件**通过**前缀检查——**待拍板 U-2-8**。

**漏了会怎样**：漏了这一步，agent 用一次原生 `edit` 就能改掉 `roll_dice.result`（这正是 `docs/现有安全待办台账.md:98` 逐字登记的事实）。

---

### 步骤 4 — 钉住「引擎自己的写不是被拒对象」

**做什么**：**不改** `rollDice` 的写回路径。确认它不走 `editEntity`：

- `packages/shared/src/actions/roll-dice.ts:201-215` 用 `patchRollDiceResult`（`packages/shared/src/rules/dice.ts:281`）+ `store.writeFileAtomic`，**不经 `editEntity`**；
- 因此步骤 2 不会拦引擎的合法写回。

**漏了会怎样**：若有人"顺手"把 `editEntity` 的守卫上提到 `WorldStore.writeFileAtomic`（一个看起来更"全局"的落点），**引擎自己就再也写不了骰子结果**——`rollDice` 会自己拒绝自己。**这就是 `00 §5.4` 禁止范畴词（"模块级"）代替机制描述的原因**："在 store 层防"听起来更严，实际是把引擎与被防对象合并成一个。本方案明确：**守卫挂在"调用者是内容/agent"的那两层（`editEntity` + 原生工具门禁），不挂在 store。**

**没排除什么**：`apps/server/src/engine/declared-actions.ts:447` 与 `:470-478` 用 `editEntity` 写 `dice_receipt` / `choice` / `choice_actions` / `dice_grade`——**这些键都不在拒绝列**（§3.3），所以步骤 2 不影响它们。`[推断]` `dice_receipt` 是 niko 时代的幂等回执，**它的可伪造性与 `command_log` 同级** → **待拍板 U-2-1**。

---

### 步骤 5 — 测试与文档同步

**做什么**：
1. 新测试 `packages/shared/test/reserved-keys.test.mjs`（动作层，§11.2）；
2. 新测试 `tools/native-reserved-keys.test.mjs`（工具层，§11.3；jiti 直跑扩展，照抄 `tools/writer-beat-guard.test.mjs:3-12`）；
3. 台账洞 2 待办项后**追加一行**指向本文件（只加不删）；
4. `docs/command/04-效果原语集.md:702` 加脚注：**执行期的拒绝列比该行的列表窄（不含 `on`）**（**待拍板 U-2-5**）；
5. `extensions/toolkit/roll-dice.ts:45` 的诱导句改掉（**待拍板 U-2-7**）。

**漏了会怎样**：不加测试 → 下一个改 `editEntity` 或 `world-context.ts` 的人可以静默删掉守卫，而 `pnpm test` 全绿（**本仓的既有教训就是这个形状**：`apps/web/test/declared-action-web.test.mjs` 这类守卫正是为防止"实现漂移无人发现"而存在）。不改 `roll-dice.ts:45` → 提示词继续教 agent 去撞守卫。

---

## 5. 文件与副作用

| 动作 | 触碰 | 读/写 | 副作用 |
|---|---|---|---|
| 步骤 1 | `packages/shared/src/actions/reserved-keys.ts`（新建）、`packages/shared/src/index.ts`（加一行导出） | 写 | 需 `pnpm --filter @airp/shared build`（`extensions/toolkit/deps.ts:13-16`） |
| 步骤 2 | `packages/shared/src/actions/delete.ts`（`editEntity`，`:195-221` 之间） | 写 | **拒绝时：零文件改动、零事件、零帧**（抛在 `writeFileAtomic` 之前） |
| 步骤 3 | `extensions/world-context.ts`（`tool_call` handler，`:72` 与 `:78` 之间） | 写 | **拒绝时：工具不执行**（`block` 短路，`runner.ts:1094-1096`）→ 磁盘零改动 |
| 步骤 4 | — | — | — |
| 步骤 5 | `packages/shared/test/reserved-keys.test.mjs`（新建）、`tools/native-reserved-keys.test.mjs`（新建）、`docs/现有安全待办台账.md`（追加一行）、`docs/command/04-效果原语集.md`（脚注，待拍板）、`extensions/toolkit/roll-dice.ts`（待拍板） | 写 | 台账**只加行** |

**性能**：

- 步骤 2：新增一次 `Object.entries(patch)` 遍历（patch 是调用者给的小对象）+ 对 Class B 键做 `hasOwnProperty` 与值比较——**O(patch 键数)**，无 I/O。
- 步骤 3：新增一次 `parseFrontmatter(proposed)`。**这是本方案唯一的可观成本**：`edit` 的 `proposed` 已是完整文件文本，parse 是线性的。**注意既有代码已经 parse 过一次**（`:72-77` 的 `isPhotoContent(proposed)` 内部调 `parseFrontmatter`）——**方案 SHOULD 把两次 parse 合并成一次**（把 `isPhotoContent` 改成吃已 parse 的结果），否则每次原生 `edit`/`write` 会多一次 YAML parse。**待拍板 U-2-9**：是否顺手合并（它属于"改既有 helper 的签名"，但收益是消除同一份数据的第二次解析；`[推断]` 这是真该做的）。
- 步骤 3 的拒绝路径发生在**工具执行前**，不产生额外 I/O（`store.readFile(previous)` 是既有调用，`:68`）。

**明确没有副作用的**：不写任何事件、不发任何 WS 帧、不动 `canvas.db`、不新增文件类型、不新增状态。

---

## 6. 落账（事件类型、detail、actor、turn）

### 6.1 本方案**不落任何新事件**

- **拒绝路径**：命中保留键 → 抛 `ActionError`（动作层）/ `block`（工具层）。`ActionError` 的约定逐字是「throwing means nothing was appended」（`packages/shared/src/actions/errors.ts:46-48`），所以**动作层拒绝 = 零事件**；工具层 `block` 同理（工具没跑，`extensions/world-context.ts:80-105` 的落账逻辑只处理 `writes` map 里的条目，而拒绝发生在 `writes.set` 之前）。

### 6.2 允许路径的事件（不变）

- 动作层：`entity_edited`，`detail = { path, name, kind }`，`kind` 在合并前算（`packages/shared/src/actions/delete.ts:227-234`）。
- 工具层：`entity_edited` / `entity_created`（`extensions/world-context.ts:103-104`），actor 来自 `agentActor()`，turn 来自 `currentTurnAnchor(ctx)`（`extensions/toolkit/turn.ts:30-35`）。
- **两条事件都不含被改后的正文**（`docs/command/04-效果原语集.md:409`）⇒ **不能靠事件表回滚/还原**。这是本洞可恢复性的上限，**MUST 在文档里写清**（否则读者会以为"事件表能查出来改成什么"）。

### 6.3 「要不要给拒绝落一条审计事件」——**待拍板 U-2-10**

台账 `docs/现有安全待办台账.md:115` 逐字列了这个选择：**「决定原生 `edit` 工具的语义：拒绝、还是允许但落一条审计事件（后者的代价是"世界史多了噪声"）」**。

本文的立场（**建议，非结论**）：

- **主体选"拒绝"**：允许 + 审计 = 事实已经被改，审计只能事后告知；而 C1 的幂等论证依赖"`result` 一生只有一个值"（§1.3），**事后审计救不了已经被算错过的 `commandKey`**。
- **在拒绝之外补一条 `console.warn`**（agent 侧 stderr）**不是"事件"**，符合硬门 4 的"不静默"（`docs/command/00-共同上下文.md:322`）且不污染世界史。`[推断]` 更合适的落点是 `extensions/world-context.ts` 里 `stderr` warn 一次——`docs/command/07-Agent创作接口.md:849` 对校验器抛错给了同形纪律（warn 一次、放行写入），但**本方案对它处理的是"校验器自身 bug"，与"命中保留键"是两件事**，后者 MUST 拒绝而非放行。
- **拒绝原因 MUST 回到模型可见的输出**：动作层经 `ActionError.toToolResult()`（`packages/shared/src/actions/errors.ts:64-74`），工具层经 `block.reason`（`vendor/pi-rp/packages/coding-agent/src/core/extensions/types.ts:1172-1181`）。**这是硬门 4 的机制落点**，不是可选项。

---

## 7. WS 前端（帧、消费面、与冻结帧表的关系）

### 7.1 本方案**不新增/不修改任何 WS 帧**

冻结帧表在 `docs/tools/12-工具注册与路由统一.md` §6.2（`tools/check-ws-contract.mjs:36` 的 `CONTRACT_DOC`）。

### 7.2 前端能观测到的差异（**只有一条**）

`/api/god-action` update 命中保留键时，今天的响应是 `{ ok:true, … }`；修复后是 `{ ok:false, code:'invalid_argument', error:… }`（`apps/server/src/routes/world.ts:75-93` 的 `reply` 把 `ActionError.toHttp()` 原样回）。

前端消费面：`apps/web/src/lib/airp-gateway.ts:129-130` 的 `godAction`。`[推断]` 命中该错误的唯一路径是玩家在上帝模式里**手敲**含保留键的 frontmatter / 整份 `content`（`apps/web/src/App.tsx:833` 的既有调用只送 `create` 形态），所以正常使用看不到这个新错误。**待拍板 U-2-11**：上帝模式 UI 是否需要专属文案（今天 `god-action` 的错误直接冒泡为 `notify(String(error))`）。

### 7.3 原生工具路径**完全不经 WS**

`block` 的结果是**返回给 agent 的一条 tool result**（`vendor/pi-rp/packages/agent/src/agent-loop.ts` 的 `kind:"immediate"` 分支；`docs/command/07-Agent创作接口.md:438-441` 已核）。玩家**看不到**它——玩家看到的是作家下一轮没做那件事。**这是本洞可见性的固有上限**，`[推断]` 也是为什么台账要求把拒绝原因做到"模型可见"而不是"玩家可见"（`docs/现有安全待办台账.md:114-116`）。

---

## 8. 错误边界

| 情形 | 行为 | 依据 |
|---|---|---|
| 动作层：`input.frontmatter` 命中 Class A | 抛 `ActionError('invalid_argument')` / 400，文件零改动 | `packages/shared/src/actions/errors.ts:24-43,86-88` |
| 动作层：Class B 值未变（原样重述同一个 `result`） | **放行**（幂等 no-op） | §3.3 Class B 判据 |
| 动作层：`input.frontmatter` 为 `undefined`（只改 body） | 不检查（无键可改） | 步骤 2 的 `input.frontmatter ? … : null` |
| 动作层：`body` 里含 `<!-- resolved-dice:62 -->` | **本方案不拦**——见下 | **待拍板 U-2-12** |
| 工具层：`proposed === undefined`（形状不认识） | **拒绝**（无法预测 → 不放行） | 步骤 3 |
| 工具层：`edit` 的预测与落盘不一致（模糊匹配） | **本方案接受为残余**；MUST 在文档与测试里写明是已知上界 | §4 步骤 3 |
| 工具层：目标不在 `world/`\|`player/`\|`characters/` 或非 `.md` | 既有前缀门先拒绝（`:54-56`），本检查不参与 | — |
| 工具层：`bash` | **完全不在门禁内** | `00 §5.2` 第 1 条 |
| 校验函数自身抛错 | **MUST NOT 让整个写入路径死掉**：照 `docs/command/07-Agent创作接口.md:849` 的纪律——`tool_call` 的校验体被 `try/catch` 包住，catch 到非 `ActionError` 时放行写入并 stderr warn 一次 | `docs/command/07` 该行 |
| 玩家/上帝模式命中 | 400 + 人话错误 | §7.2 |

**`body` 里的 `<!-- resolved-dice:${score} -->`（重要缺口，必须写清）**：`apps/server/src/engine/declared-actions.ts:468-469` 用**正文字符串**做骰子幂等标记，而**动作层与工具层都只检查 frontmatter 键**——一次 `editEntity({path, body: '…'})` 或原生 `edit` 改掉正文即可删掉该标记。`docs/command/00-共同上下文.md:332` 已把"把幂等标记藏进正文"列为反模式第 1 条，C1 用 `command_log` 取代它。**因此本方案刻意不拦正文标记**（拦它 = 给一个正在被淘汰的机制加固）。**待拍板 U-2-12**：在 `command_log` 落地前，是否需要一个过渡守卫。

---

## 9. 代码落点（精确到文件与函数）

| # | 文件 | 符号 | 改动 |
|---|---|---|---|
| R1 | `packages/shared/src/actions/reserved-keys.ts`（新建） | `ENGINE_ONLY_KEYS`、`SETTLED_FACT_KEYS`、`reservedKeyViolation(before, patch)`、`reservedKeyViolationInText(beforeRaw, afterRaw)` | 新增；**纯函数、无 I/O、无状态** |
| R2 | `packages/shared/src/index.ts` | barrel（`<actions/*>` 段，`:34-46`） | 加 `export * from './actions/reserved-keys.js';` |
| R3 | `packages/shared/src/actions/delete.ts` | `editEntity`（`:166-246`），插入点在 `:201` 与 `:221` 之间 | 命中 → `throw new ActionError({code:'invalid_argument', …})` |
| R4 | `extensions/world-context.ts` | `registerWorldContext` 的 `tool_call` handler（`:50-79`），插入点在 `:77` 与 `:78` 之间 | `proposed === undefined` → block；`reservedKeyViolationInText(previous, proposed)` 命中 → block；**并合并 `isPhotoContent` 的重复 parse**（待拍板 U-2-9） |
| R5 | `packages/shared/test/reserved-keys.test.mjs`（新建） | — | §11.2 |
| R6 | `tools/native-reserved-keys.test.mjs`（新建） | — | §11.3（jiti 直跑扩展） |
| R7 | `extensions/toolkit/roll-dice.ts:45` | `promptGuidelines[2]` | **待拍板 U-2-7**：删掉"edit the old result out of the file first"，改为"create a **new** entity with its own `roll_dice`" |
| R8 | `docs/command/04-效果原语集.md:702` | 保留键行 | **待拍板 U-2-5**：加脚注说明执行期拒绝列比该行窄（不含 `on`） |
| R9 | `docs/现有安全待办台账.md` | 洞 2 待办段 | **追加一行**指向本文件（只加不删） |
| R10 | **（待拍板 U-2-6）** `packages/shared/src/actions/create.ts:126-130`、`chalk.ts:514-518`（写入；`buildFrontmatter` 调用在 `:501`）、`edit-character-config.ts:88`、`packages/shared/src/components/core.ts:50`、`refs.ts:410,461` | — | 其余写盘点的统一守卫 |

**明确不碰**：

- `packages/shared/src/store/local-store.ts` 的 `writeFileAtomic`（步骤 4 给了理由：引擎自己也走它）；
- `packages/shared/src/actions/roll-dice.ts`（引擎的合法写回）；
- `packages/shared/src/schemas/frontmatter.ts`（不改 schema——实体侧 strict 过滤是 §10.8 的独立议题，`docs/command/00-共同上下文.md:481-499`）；
- `presets/*.json`（不 deny `edit`/`write`——那会把"改写事实"换成"作家不能写世界"，是**另一个洞**，见 §12.3）。

---

## 10. 与现状差异

| # | 项 | 现状 | 方案 | 可区分修复前后的观测点 |
|---|---|---|---|---|
| D-1 | `editEntity({frontmatter:{roll_dice:{result:99}}})` 于一张已结算的卡 | **成功**，文件被改，落 `entity_edited` | 抛 `invalid_argument` / 400，文件零改动，零事件 | 同一调用：返回 vs 抛错；读回文件的 `result` |
| D-2 | `editEntity({frontmatter:{command_log:[…]}})` | **成功**（今天该键不存在，但机制在；`docs/现有安全待办台账.md:89` 逐字） | 拒绝 | 同上 |
| D-3 | 原生 `edit` 把 `result: 5` 改成 `result: 20` | **成功**（`extensions/world-context.ts` 无键检查） | `block: true`，工具不跑 | 工具返回 `isError` + reason；文件 `result` 不变 |
| D-4 | 引擎 `rollDice` 首次写回 `result` | 成功 | **不变** | 掷骰仍能落结果 |
| D-5 | 向**新**文件声明 `roll_dice.result` | 成功 | **不变** | 自建夹具：带 `result` 的新文件仍能被 `createEntity` 写入 |
| D-6 | 作家用原生 `edit` 写 `on` 绑定（C1 作者面） | 成功 | **不变**（`on` 不在拒绝列） | C1 的写入期校验仍能跑 |
| D-7 | `/api/god-action` update 命中保留键 | `{ok:true}` | `{ok:false, code:'invalid_argument'}` | **待拍板 U-2-2** |
| D-8 | 帧 / 事件类型 / 动作方法表 | — | **均不变** | `pnpm check:ws`、`ACTION_METHODS`（`packages/shared/src/actions/service.ts:80-107`）前后一致 |

**净差异 = 2 处守卫（R3/R4）+ 1 个常量模块（R1/R2）**。

---

## 11. 验收测试

### 11.1 断言总表

| # | 断言 | 层 | 文件 |
|---|---|---|---|
| T-1 | 动作层：改已结算的 `roll_dice.result` → 抛 `invalid_argument`，且**文件字节不变** | 动作层 | `packages/shared/test/reserved-keys.test.mjs` |
| T-2 | 动作层：写 `command_log` / `command_error`（任何值）→ 拒绝 | 动作层 | 同上 |
| T-3 | 动作层：**原样重述**同一个 `result` → 放行；**删除** `result` → 拒绝 | 动作层 | 同上 |
| T-4 | 动作层：向**新**文件（before 无 `roll_dice`）声明 `result` → 放行 | 动作层 | 同上 |
| T-5 | 动作层：`on` 可写（C1 作者面不被误伤） | 动作层 | 同上 |
| T-6 | 工具层：原生 `edit` 改 `result` → `block`，reason 含键名；**且一个 `writes` 条目都没建**（验证工具未跑） | 工具层 | `tools/native-reserved-keys.test.mjs` |
| T-7 | 工具层：原生 `write` 写含 `command_log` 的完整文件 → `block` | 工具层 | 同上 |
| T-8 | 工具层：`proposed === undefined`（形状不认识）→ `block` | 工具层 | 同上 |
| T-9 | 工具层：合法的普通编辑（无保留键）→ **不 block**，且 `writes` 有条目 | 工具层 | 同上 |
| T-10 | 工具层：非 `.md` / 前缀外路径仍走既有拒绝（回归） | 工具层 | 同上 |

### 11.2 「没有这个修复就会失败」——动作层（T-1）

**照抄本仓既有的动作层测试脚手架**：`packages/shared/test/move.test.mjs:476-503` 用 `tempStore()` + `service(store)` 真实落盘并读回。T-1 必须**同样真实落盘**（不能只断言函数返回值），因为本方案的一条核心性质是「拒绝 = 文件零改动」。

```js
// packages/shared/test/reserved-keys.test.mjs（节选）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { ActionError } from '../dist/actions/errors.js';

test('T-1: an edit cannot rewrite an already-settled dice result', async () => {
  const { store, root } = await tempStore();
  try {
    await store.writeFile(
      'world/inn/check.md',
      '---\ntype: chalk\ntitle: Check\nroll_dic/mnt/e/n  type: 2d10\n  desc: Pick the lock\n  expect: ">=11"\n  result: 5\n  passed: false\n---\n\nBody.\n'
    );
    const svc = service(store);
    const before = await store.readFile('world/inn/check.md');

    await assert.rejects(
      () => svc.editEntity({ path: 'world/inn/check.md', frontmatter: { roll_dice: { result: 99, passed: true } } }),
      (err) => err instanceof ActionError && err.code === 'invalid_argument' && /reserved key/.test(err.message)
    );

    // 修复前这条会失败（调用成功）；修复后文件必须逐字节不变。
    assert.equal(await store.readFile('world/inn/check.md'), before);
    // 拒绝 = 零事件（errors.ts:46-48 的约定）。
    assert.equal((await store.getEventsSince(0)).filter((e) => e.type === 'entity_edited').length, 0);
  } finally {
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
```

（`tempStore` / `service` 的构造照抄 `packages/shared/test/move.test.mjs` 的既有 helper，不新造。）

**为什么满足"没有修复就失败"**：修复前 `editEntity` 无此检查，`assert.rejects` 会以「Missing expected rejection」失败（**这正是 `docs/现有安全待办台账.md:73-85` 逐字给出的攻击成功路径**）。

### 11.3 「没有这个修复就会失败」——工具层（T-6）

**照抄本仓既有的扩展测试脚手架**：`tools/writer-beat-guard.test.mjs:3-32` 用 `createJiti` 直跑 `extensions/**/*.ts` 并喂一个假 `pi`（`fakePi()` 收集 handlers）。

```js
// tools/native-reserved-keys.test.mjs（节选）
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createJiti } from '../vendor/pi-rp/node_modules/jiti/lib/jiti.mjs';

const jiti = createJiti(import.meta.url, {
  moduleCache: false,
  tryNative: true,
  alias: { '@earendil-works/pi-coding-agent': new URL('../vendor/pi-rp/packages/coding-agent/dist/index.js', import.meta.url).pathname },
});
const worldContext = await jiti.import('../extensions/world-context.ts');

test('T-6: native edit cannot rewrite a settled dice result', async () => {
  const { pi, handlers } = fakePi();         // 形态照抄 tools/writer-beat-guard.test.mjs:14-18
  worldContext.default(pi);
  const toolCall = handlers.get('tool_call');

  const result = await toolCall(
    { type: 'tool_call', toolCallId: 'c1', toolName: 'edit',
      input: { path: 'world/inn/check.md', edits: [{ oldText: 'result: 5', newText: 'result: 99' }] } },
    { cwd: tmpWorld }                         // tmpWorld 见下
  );
  // 修复前：result === undefined（放行）→ 这条断言失败。
  assert.equal(result?.block, true);
  assert.match(result.reason, /reserved key/);
  assert.match(result.reason, /roll_dice\.result/);
  // 工具没跑 ⇒ 文件未被改。
  assert.match(await readFile(`${tmpWorld}/world/inn/check.md`, 'utf8'), /result: 5/);
});
```

**为什么满足"没有修复就失败"**：修复前 handler 在该输入下返回 `undefined`（既有三个门都不命中：路径合法、非 nook、非 photo），`assert.equal(undefined?.block, true)` 失败——**这就是 `docs/现有安全待办台账.md:98` 逐字描述的绕过**。

**`[推断]` 一处实现风险（必须为实现者标出）**：`extensions/world-context.ts:57` 的 `worldStore(ctx)` 需要 `ctx.cwd` 指向**真实世界目录**（`extensions/toolkit/deps.ts:27-40` 逐字 `const root = ctx.cwd` 并 `new LocalWorldStore(root)`），且 `:60-62` 会调 `store.getManifest()`。因此 T-6 **必须**建一个最小临时世界（至少含 `world.json` 与目标文件），否则会先失败在 manifest 读取上。若该脚手架成本过高，**退路**是：

1. 把判据层单独测（`reservedKeyViolationInText(previous, proposed)` 不需要 store，纯函数）；
2. **保留**一条源码级守卫断言 `world-context.ts` 里出现 `reservedKeyViolationInText(`（形态照抄 `apps/web/test/declared-action-web.test.mjs:9-14`）。

**待拍板 U-2-13**：是否接受这条退路（代价 = 少一层"接线真的通"的证据）。

### 11.4 定向运行命令

```bash
pnpm --filter @airp/shared build
node --test packages/shared/test/reserved-keys.test.mjs
node --test tools/native-reserved-keys.test.mjs
```

（**不跑**全量 `pnpm test`：`00 §4.4`。）

---

## 12. 发现的冲突与待拍板

### 12.1 发现的冲突（本批次新登记）

| # | 冲突 | 证据 | 影响 |
|---|---|---|---|
| C-2-1 | **`roll-dice` 工具的提示词在教模型违反硬门 3** | `extensions/toolkit/roll-dice.ts:45` 逐字 `to re-open the check, edit the old result out of the file first` ↔ `docs/command/00-共同上下文.md:321` 逐字 `MUST NOT 删除 result 制造免费重掷` | `docs/command/05-幂等与复访.md:1050-1056`（§11.3）已登记；**本文确认它同时是洞 2 的诱导**（§2.2）。修复后若不改它，agent 会反复撞守卫、浪费工具预算 |
| C-2-2 | **C1 的保留键列（含 `on`）与 C1 的作者面（作家必须能写 `on`）在工具层冲突** | `docs/command/00-共同上下文.md:813`（列 `on`）↔ `docs/command/07-Agent创作接口.md:288-340`（写入门禁要**放行** `on.run` 并**校验**它） | 若照抄 §R.2 的列表到工具层，**C1 的作者面会被自己的防线打断**。本方案因此收窄（§3.3 Class C） |
| C-2-3 | **`dice_receipt` 的可伪造性与 `command_log` 同级，但它不在 C1 的拒绝列** | `apps/server/src/engine/declared-actions.ts:447` 写它；`:440` 用它做一致性检查；`docs/command/08-迁移与收敛.md:99` 把它列为"归 `05` 的 `command_log` 前身" | `apps/server/src/engine/declared-actions.ts:447` 与 `:472` 仍会**新写**它、`:440` 仍会**读它做判定**。**实测注记**：2026-09-14 的 shipped 内容里已无 `dice_receipt`（并发内容会话迁走了预结算写法）⇒ 它今天还**不是**「活的世界实例」，但**读写通路是活的** |
| C-2-4 | **今天活的幂等标记在正文里，不在 frontmatter** | `apps/server/src/engine/declared-actions.ts:468-469` 的 `<!-- resolved-dice:${score} -->` | 本方案（只查 frontmatter 键）**拦不到它**；见 §8 与 U-2-12 |
| C-2-5 | **`docs/command/04-效果原语集.md:702` 的拒绝列（含 `on`）与工具层可实现面不一致** | 同 C-2-2 | 契约与实现必须有一处脚注，否则下一个实现者会照抄错的列表 |

### 12.2 待拍板（**不得当作已定**）

| # | 未决 | 选项与代价 | 倾向 |
|---|---|---|---|
| **U-2-1** | `dice_receipt` 是否进拒绝列 | 进 → 关掉今天活的回执伪造面；代价 = `apps/server/src/engine/declared-actions.ts:447` 自己就写它（必须改成走非 `editEntity` 路径或加内部豁免，扩大改动面）；不进 → 该面留到下批 | **倾向「进，但另开一小题」**：它需要先决定"引擎自己怎么写非保留键"的通用机制（与 U-2-6 同一问题） |
| **U-2-2** | `god` actor 是否豁免 | 豁免 → 保留"上帝模式改一切"（`packages/shared/src/actions/actor.ts:99` 的 `actor.type === 'god' && agentScope !== 'player'` 分支同形）；不豁免 → 上帝模式也改不了已结算事实 | **倾向「豁免 + 前端二次确认」**：`[推断]` 上帝模式的产品语义是"开发者调试"（`docs/gameplay/doc-14-上帝模式设计.md` 是其属主文档）。**但豁免会让 U-2-6 的必要性上升**（原生工具没有 god actor） |
| **U-2-3** | `writeChalk` 是否纳入 | 纳入 → 补齐类型上可达的路径（`ChalkFrontmatterInput.roll_dice`）；代价 = 改 `packages/shared/src/actions/chalk.ts` 的写回逻辑 | **倾向纳入**：它是类型上**确实可达**的路径（§4 步骤 2 的"没排除"第 1 条） |
| **U-2-4** | `createEntity` 是否拦 Class A | 拦 → 阻止"创建一份伪造回执的文件"；代价 = 改 `packages/shared/src/actions/create.ts:126-130` 与工具层 `write` 两个入口 | **倾向拦 Class A、不拦 Class B**（与 §3.3 判据一致） |
| **U-2-5** | `docs/command/04-效果原语集.md:702` 是否加脚注 | 加 → 契约与实现一致；代价 = 改他人收口域（`docs/command/`） | **倾向加，且只加不删** |
| **U-2-6** | 是否在"一个统一写盘点"上再做一层守卫（覆盖 `writeChalk` / `createEntity` / `editCharacterConfig` / `rewriteTarget` / `refs`） | 做 → 一处覆盖全部；代价 = **必须先解决"引擎自己怎么豁免"**（否则 `rollDice` 被自己拒）——**这是本文件唯一一个有架构分量的决定** | **倾向「先不做，登记为下一批」**：今天这五处都没有写入保留键的调用点；而做它的成本（豁免机制）高于收益。但**若 U-2-2 选豁免**，则豁免机制本来就欠着，可一并做 |
| **U-2-7** | `extensions/toolkit/roll-dice.ts:45` 是否本批改 | 改 → 提示词不再教违禁操作；代价 = 三条 `promptGuidelines` 的文案变更（进模型上下文，`presets/writer.json:35` 的 `onlyWithSnippets` 只影响 snippet） | **倾向改**：`docs/command/05-幂等与复访.md:1054-1056` 已给出逐字建议文案，零设计成本 |
| **U-2-8** | 世界内部 symlink 是否加固 | 加固 → 解析 realpath 再判前缀；代价 = 一次 `fs.realpath`（I/O），且既有门禁也没有做 | **倾向不做，登记**：`[推断]` 它需要一个独立设计（realpath 与原子写、跨平台、性能都不同） |
| **U-2-9** | 是否合并 `isPhotoContent` 与保留键检查的两次 `parseFrontmatter` | 合并 → 每次原生 `edit`/`write` 少一次 YAML parse；代价 = 改 `isPhotoContent`（`extensions/world-context.ts:42-45`）的签名 | **倾向合并**：同一份数据的第二次解析是纯浪费 |
| **U-2-10** | 拒绝是否配审计事件 | 见 §6.3 | **倾向「拒绝 + stderr warn，不落世界事件」** |
| **U-2-11** | 上帝模式 UI 是否加专属文案 | 见 §7.2 | **倾向等 U-2-2 定案后再定** |
| **U-2-12** | 正文 `<!-- resolved-dice:${score} -->` 是否加过渡守卫 | 加 → 在 `command_log` 落地前堵住正文标记；代价 = 加固一个正在被淘汰的机制，且"改正文"的合法面极大（作家每天都在改正文） | **倾向不加**：`docs/command/00-共同上下文.md:332` 已判它是反模式；加固它会把合法写作误伤成拒绝 |
| **U-2-13** | 工具层测试是否接受"纯函数测试 + 源码守卫"退路 | 见 §11.3 | **倾向不接受退路**：`docs/tools/00-共同上下文.md:323` 的"探针断言工具面非空"先例说明本仓愿意为"接线真的通"付脚手架成本；但若实现期发现临时世界脚手架 > 半个工时，退路可接受 |

### 12.3 明确**不**解决的（照 `00 §5.2` 重述要点，避免读者误读）

1. **`bash` 写世界文件**（`extensions/world-context.ts:51` 只认 `write`/`edit`）。
2. **世界包 `extensions/`/`skills/` 的全权限执行**（`00 §1.3`）——**这仍是本仓最严重的 UGC 问题**。
3. **手改文件 / 另一个进程写 / 另一个世界**：工具层门禁只在 agent 进程的工具调用路径上。
4. **不 deny 原生 `edit`/`write`**：`[推断]` 一个看起来更彻底的方案是"在 `presets/*.json:15-32` 里 deny `edit`/`write`"。**本方案明确不做**，理由三条：
   - 那会让**作家不能写世界**——`docs/protocols/doc-20-agent工具与互动字段协议.md:23` 逐字给作家与角色都打 `✅`，且 `extensions/toolkit/writer-beat-guard.ts:5-8` 逐字提到"移除 niko 的原生 write/edit 封锁"是被**刻意撤销**的（它会阻止作家完整初始化一个场景）；
   - 它是**权限收缩**，与"拒一个键"是不同性质的动作，需要独立评审；
   - 它**挡不住 `bash`**（所以也不是"彻底"）。
5. **幂等机制本身的补丁**：见 §1.3 末（`docs/command/05-幂等与复访.md:996` 的设计边界）。
