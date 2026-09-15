# docs/command 设计文档 · 行号漂移清单（基线 9af9c9b → HEAD 50dd228）

> 由主 agent 机械生成：把每处 `file:line` 引用的**基线行段内容**与 **HEAD 行段内容**对比，
> 用 difflib equal-block 建立行号映射。`→ 行已删除` 表示该行段在 HEAD 里已无对应 equal-block（可能搬家/重构/删除）。

共 **47** 处内容漂移。


## A. 有确定新行号（36 处）——机械回写

| # | 文档:行 | 引用路径 | 旧行 | 新行 |
|---|---|---|---|---|
| 1 | `00-共同上下文.md:106` | `extensions/context.ts` | `128-164` | `153-190` |
| 2 | `00-共同上下文.md:233` | `packages/shared/src/actions/service.ts` | `80-107` | `81-109` |
| 3 | `00-共同上下文.md:763` | `packages/shared/src/actions/errors.ts` | `3-21` | `3-22` |
| 4 | `01-命令文件与schema.md:595` | `packages/shared/src/actions/errors.ts` | `3-21` | `3-22` |
| 5 | `01-命令文件与schema.md:915` | `packages/shared/src/actions/service.ts` | `80-107` | `81-109` |
| 6 | `02-触发与绑定.md:587` | `apps/web/src/components/narrative/DiceRoller.tsx` | `58-68` | `66-78` |
| 7 | `02-触发与绑定.md:759` | `packages/shared/src/actions/service.ts` | `80-107` | `81-109` |
| 8 | `02-触发与绑定.md:801` | `packages/shared/src/actions/errors.ts` | `3-25` | `3-26` |
| 9 | `02-触发与绑定.md:1543` | `apps/server/src/routes/world.ts` | `1199-1218` | `1286-1305` |
| 10 | `04-效果原语集.md:16` | `packages/shared/src/actions/service.ts` | `80-107` | `81-109` |
| 11 | `04-效果原语集.md:157` | `apps/server/src/routes/world.ts` | `1196-1234` | `1283-1321` |
| 12 | `04-效果原语集.md:583` | `packages/shared/src/actions/service.ts` | `32-77` | `32-78` |
| 13 | `04-效果原语集.md:593` | `extensions/tools.ts` | `16-38` | `16-39` |
| 14 | `04-效果原语集.md:739` | `apps/server/src/routes/world.ts` | `1196-1234` | `1283-1321` |
| 15 | `04-效果原语集.md:901` | `packages/shared/src/actions/errors.ts` | `3-21` | `3-22` |
| 16 | `04-效果原语集.md:1181` | `packages/shared/src/index.ts` | `32-62` | `32-63` |
| 17 | `04-效果原语集.md:1627` | `packages/shared/src/actions/service.ts` | `80-107` | `81-109` |
| 18 | `06-前端与演出.md:178` | `apps/web/src/App.tsx` | `274-281` | `391-398` |
| 19 | `06-前端与演出.md:345` | `apps/server/src/routes/world.ts` | `723-918` | `812-1011` |
| 20 | `06-前端与演出.md:589` | `apps/web/src/lib/fm.tsx` | `26-174` | `26-174` |
| 21 | `06-前端与演出.md:717` | `apps/web/src/lib/dice-ceremony.ts` | `281-300` | `322-350` |
| 22 | `06-前端与演出.md:721` | `apps/web/src/components/performance/DiceCeremony.tsx` | `71-87` | `79-None` |
| 23 | `06-前端与演出.md:723` | `apps/web/src/lib/fm.tsx` | `26-174` | `26-174` |
| 24 | `06-前端与演出.md:779` | `apps/web/src/components/performance/DiceCeremony.tsx` | `71-87` | `79-None` |
| 25 | `06-前端与演出.md:987` | `apps/server/src/routes/world.ts` | `723-918` | `812-1011` |
| 26 | `06-前端与演出.md:1099` | `apps/web/src/components/narrative/DiceRoller.tsx` | `44-80` | `52-92` |
| 27 | `06-前端与演出.md:1101` | `apps/web/src/components/performance/DiceCeremony.tsx` | `56-87` | `63-None` |
| 28 | `06-前端与演出.md:1105` | `apps/web/src/lib/dice-ceremony.ts` | `281-300` | `322-350` |
| 29 | `06-前端与演出.md:1111` | `apps/web/src/App.tsx` | `274-281` | `391-398` |
| 30 | `06-前端与演出.md:1115` | `apps/web/src/lib/fm.tsx` | `26-174` | `26-174` |
| 31 | `06-前端与演出.md:1119` | `apps/server/src/routes/world.ts` | `723-918` | `812-1011` |
| 32 | `07-Agent创作接口.md:473` | `apps/web/src/components/nook/NookView.tsx` | `269-291` | `301-357` |
| 33 | `07-Agent创作接口.md:697` | `extensions/tools.ts` | `51-69` | `52-71` |
| 34 | `07-Agent创作接口.md:952` | `extensions/tools.ts` | `51-69` | `52-71` |
| 35 | `09-安全与边界.md:810` | `apps/server/src/engine/presets.ts` | `129-149` | `142-165` |
| 36 | `10-事件与作家上下文.md:689` | `extensions/instructions.ts` | `349-356` | `349-483` |

## B. 需语义判断（11 处）——行段已无对应


### B.1 `00-共同上下文.md:68` → `apps/web/src/components/canvas/CardRenderer.tsx:116-116`

文档原文语境：
```
67: 
    68: 而 `main` 的引擎侧对 `dice_outcomes` **零命中**（`grep dice_outcomes` 于 `packages/shared/src`、`apps/server/src`、`apps/web/src`、`extensions` 全部无结果；唯一相关命中是 `apps/web/src/components/canvas/CardRenderer.tsx:116` 读的是**另一个**字段 `dice_reward`）。
    69:
```

### B.2 `00-共同上下文.md:261` → `packages/shared/src/actions/actor.ts:9-9`

文档原文语境：
```
260: 
    261: **不使用 `engine`**，尽管它存在且注释写着"reserved for trusted internal callers"（`packages/shared/src/actions/actor.ts:9,80-83`）。理由：从世界的角度，是**玩家的行动**导致灯油减少，不是"引擎自己拿走了"。历史面板与作家注入都应把因果归给玩家。`doc-21 §3.2` 之所以把 `god` 从 `player` 里单列，正是因为"世界自己变了"与"你让它变了"在叙事上是两件事。
    262:
```

### B.3 `02-触发与绑定.md:215` → `packages/shared/src/actions/actor.ts:9-14`

文档原文语境：
```
214: | `trigger.entry.<path>` | 任意 | **`NEW`（裁定 A）**：本条绑定 `from` 命中的**那一个条目**。路径段 MUST 是静态字面量（`rewards[0].path`），`[0]` 里的整数是语法的一部分，**不是** `{{ }}` 插值 |
    215: | `actor` | `'player'\|'god'\|'writer'\|'character'\|'engine'` | `ctx.actor.type`（`packages/shared/src/actions/actor.ts:9-14`） |
    216: | `actor_id` | string \| null | `ctx.actor.id`，仅 character 有（`actor.ts:10-14` 注释） |
```

### B.4 `02-触发与绑定.md:750` → `apps/web/src/components/narrative/EntityInteractions.tsx:157-163`

文档原文语境：
```
749: 
    750: **实测事实**（`CmdEffects` 核实，我复核过源码）：`runDeclaredChoice` 只对 `kind: 'take'` 真正调 `svc.moveEntity`（`declared-actions.ts:275-283`）；`enter` / `character` / `writer` / `reply` 只是被塞进 `details.action` 原样返回（`:295-302`），由**前端** `apps/web/src/components/narrative/EntityInteractions.tsx:157-163` 解释成「切层 / 开角色遮罩 / 把 prompt 发回 `/api/choice`」。真正的「起作家轮」发生在 `apps/server/src/routes/world.ts:1178` 的 `dispatch(store, ...)`——那是 server engine，**不在 `ACTION_METHODS` 里**。
    751:
```

### B.5 `04-效果原语集.md:588` → `packages/shared/test/wiring.test.mjs:48-48`

文档原文语境：
```
587: | 5 | **barrel 导出** | `packages/shared/src/index.ts` **手工**加一行。该文件 `:64-65` 注释逐字：**「a missing line is a SILENT unreachable module」** | `index.ts:32-62` |
    588: | 6 | **测试常量** | `packages/shared/test/wiring.test.mjs:48` 断言 `ACTION_METHODS.length === 26` → 改 27 | `wiring.test.mjs:48` |
    589: | 7 | **文档表 A** | `docs/tools/01-动作内核与事件落账.md §5`（`:656-687`）加一行。**该表今天只有 24 行**（缺 `editCharacterConfig`、`createChar`）→ **先修表再加行** | `docs/tools/01:656-687` |
```

### B.6 `04-效果原语集.md:1636` → `packages/shared/test/wiring.test.mjs:48-48`

文档原文语境：
```
1635: |---|---|
    1636: | **哪两份** | `packages/shared/src/actions/service.ts:14-15`（"frozen twenty-four"）、`:27-30`（"22 tool methods and the 2 extra"）vs `:80-107`（26 项）与 `packages/shared/test/wiring.test.mjs:48`（断言 26） |
    1637: | **为什么矛盾** | 现状已是 26；注释描述的是两个不同历史时点。 |
```

### B.7 `06-前端与演出.md:419` → `packages/shared/src/actions/actor.ts:9-9`

文档原文语境：
```
418: | 事件类型 | **不新增**。命令效果落的是那个动作本来会落的事件 | 契约 §5.2；15 个封闭类型 `packages/shared/src/schemas/events.ts:9-25` |
    419: | actor | = **触发者**（玩家掷骰 → `player`），不是 `engine` | 契约 §5.1；`packages/shared/src/actions/actor.ts:9` |
    420: | turn | = **触发它的那次动作调用**的 turn（命令在该调用内同步跑完，天然共享）。**不是"一个 HTTP 请求一个 turn"**——见下 | 契约 §5.3（已按 §10.7 修订）；`types.ts:18-22` |
```

### B.8 `06-前端与演出.md:1109` → `apps/web/src/state/useWorld.ts:227-227`

文档原文语境：
```
1108: | `world_event` / `file_changed` 的重取 | `apps/web/src/state/useWorld.ts:487-515`（旧标 `:424-425,427-449`，**快照已漂移**） |
    1109: | 幻影排座与过户 | `apps/web/src/state/useWorld.ts:227`（`reconcileLanded`，旧标 `:188-190`）；`apps/web/src/lib/phantom.ts:20-32,208` |
    1110: | 新卡以 path 为 key（稳定挂载） | `apps/web/src/components/canvas/Canvas.tsx:593`（旧标 `:544-547`，**已漂移**） |
```

### B.9 `08-迁移与收敛.md:52` → `apps/server/src/world-shelf.ts:23-23`

文档原文语境：
```
51: 
    52: 新世界的产生路径实测：`apps/server/src/routes/world.ts:496-499` —— `templatesRoot = path.join(repoRoot, 'templates') + path.sep`，命中前缀才 `fs.cp(resolvedPath, playPath, {recursive:true})` 拷到 `worlds/<id>-<uuid8>`；世界货架 `apps/server/src/world-shelf.ts:23` 也只扫 `templates` 与 `worlds` 两个根。**`archive/` 既不在货架上，也不会被拷贝。**
    53:
```

### B.10 `08-迁移与收敛.md:524` → `apps/web/src/components/narrative/EntityInteractions.tsx:157-159`

文档原文语境：
```
523: | `take` | **`svc.moveEntity({from,to})`**（`declared-actions.ts:275-283`，逐字 `:279`） | 落 `setDirect` 展示 | **世界改写** |
    524: | `enter` | 只检查目标层存在（`:264-266`），**不写** | `onEnterGate(action.target)`（`apps/web/src/components/narrative/EntityInteractions.tsx:157-159`） | **UI 意图**（但目标是 `enterLayer`，动作层有它） |
    525: | `read` | **只读**：`materialItems` 读文件算 `revision`（`:184-231`），**不写** | 落 `setDirect` 弹窗展示（`:166`） | **UI 意图** |
```

### B.11 `10-事件与作家上下文.md:588` → `packages/shared/src/actions/actor.ts:9-9`

文档原文语境：
```
587: 
    588: 一个细节：作家没有 `actor_id`（`packages/shared/src/actions/actor.ts:9`：只有 `character` 带 id），所以 `COALESCE(actor_id,'') = ''` 命中。若未来某个 writer 变体带上 id，判据依然成立（`collect.ts:126` 的 JS 分支同样比较 `actor.id ?? ''`）。
    589:
```