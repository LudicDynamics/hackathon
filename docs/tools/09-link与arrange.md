# doc-tools/09 `link` 与 `arrange`：画布状态工具

> 状态：**设计稿（2026-09-12）**，待评审。属 B1「工具面」文档批次（见 `local://b1-context.md` 与 `docs/tools/00-共同上下文.md`）。
> 一切共享接口、路径、命名、事件口径以 `docs/tools/00-共同上下文.md`（冻结契约）为准；本文只定 `link` / `arrange` 的语义、`canvas.db` 的 `links`/`cards` 表操作与前端补帧。
> 本文**不写代码**（B1 只产出设计文档）。§8 的"代码落点"是下一阶段的施工单，不是本轮改动。
> 权威层级（00 §0）：00 契约 > doc-21/doc-22 > doc-20（工具语义） > doc-10（组件与演出型） > doc-19（玩法强度） > 本文。
>
> 关联：
> - `docs/doc-10-组件协议与官方组件清单.md` **E13「线条统一管理」**（`doc-10:155`）——本文落实它：线条是 **canvas.db 画布状态、不从 md 派生**，作家用专用 `link` 工具管理；并落实"**画布布局工具**"（`arrange`）。
> - `docs/doc-10` §E0 名词表（`doc-10:138`）——"线条 roads/link ≠ 演出型"、"bg/compass 不在组件体系里"。
> - `docs/doc-05-AIRP产品构想.md` §3.2 物件表（`doc-05:126`：关系线 = canvas.db 画布状态，样式多样）与 §9.1 工具面（`doc-05:684`：地点道路 / 人物关系 / 物品来龙去脉 = 世界拓扑）。
> - `docs/doc-04-视觉设计风格.md` §4（`doc-04:99`）——材质轴（墨线/手绘/丝线）+ 确定性伪随机抖动（以线 id 为种子）。
> - `docs/doc-06-演出与交互设计.md` §2.5「空位排座」（`doc-06:94`）与 §5.1 双向拖拽（`doc-06:256`）。
> - `docs/doc-21-事件表协议.md` §1「准入三问」/§1.1「四类像事件但不是的东西」/§4 十五个 type/§8「不把状态塞进事件」。
> - `docs/doc-22-Hook注入协议.md` §1.1 表、§6「状态存哪」（`doc-22:147`：**当前层、卡片坐标、关系线**都进 canvas.db）。
> - `docs/tools/01-动作内核与事件落账.md` §2.2 `types.ts`、§2.4 `errors.ts`、§3.1 五步骨架、§4.1「不属于 A/B/C 名单的动作」、§5 方法清单（第 12/13 行）、§3.9 `resolveLayer`。
> - `docs/后端实现计划.md` §4 工具表（`plan:270` `link` / `plan:271` `arrange`）与 T0.2 事件桥（`plan:213`：`canvas_patched`，**只刷线/位，不整层重取**）。
> - `AGENTS.md` §7.5（画布卡片的尺寸与旋转契约）。
> - 源码：`packages/shared/src/db/schema.ts:8-26`、`store/local-store.ts:276-470`、`store/layers.ts:126-135`、`routes/world.ts:184-217/311-341`、`apps/web/src/components/canvas/LinkLayer.tsx`、`apps/web/src/state/useWorld.ts:34-36/190-207`、`apps/server/src/engine/event-bridge.ts:87-89`。

---

## 1. 一句话与定位

**`link` 画线，`arrange` 摆位；两者都只动 `canvas.db`，不动 md、不落事件、只推一帧。**

三条定位：

1. **它们是"画布状态工具"，不是组件、不是演出。** doc-10 E13 推翻了"md link 自动派生连线"的旧假说（doc-05 §3.2 旧表述）：线条**没有文件本体**，只活在画布状态层；`link` 管线条、`arrange` 管摆位，两者合称"画布状态工具"（`doc-10:170`）。组件注册表（doc-10 / `10-*`）里**没有**它们的位置——它们是工具，不是 kind。
2. **写入的是 `canvas.db`，因此"文件即真相"的纪律在这个域上不成立。** doc-05 §3.2（`doc-05:126`）与 doc-22 §6（`doc-22:147`）都明写：关系线、卡片坐标、角色 presence 属于**当前值**，存 `canvas.db`；只有 `layer_entered` 这类有叙事意义的视点变化才落事件。
3. **它们回答"世界现在什么样"，不回答"世界怎么变成这样的"。** 因此准入第 1 问过（画布关系确实变了），第 2、3 问都不过（`canvas.db` 自己就是当前值；没有任何消费者需要在事后被告知）——**不落事件**（§5 逐问走完）。

**调用者**（doc-20 §1.1，`doc-20:34`）：作家与角色**都可调用** `link` / `arrange`，能力不按身份裁（`doc-20:39`：角色没有"只能写自己目录"的权限门禁，00 §8 同样明禁）。玩家 UI 不直接调它们——**玩家拖卡片**走 `POST /api/card/position`（`routes/world.ts:311`），落到同一个动作函数（§8.3）；玩家不画线，线是叙事层的手笔。

**一句话边界**：`look_at` / `view_canvas` 是**读**画布（归 03），`link` / `arrange` 是**写画布状态**，`write` / `chalk` 是**写世界文件**。三条路，不混。

---

## 2. 签名与参数

### 2.1 `link`

```ts
link({
  /** 操作。create = 建线（同规格幂等），update = 改线，delete = 删线。 */
  op: 'create' | 'update' | 'delete';

  /** 端点 A / 端点 B —— 都是**卡片 id，即世界根相对路径**（§2.3）。create 必填。 */
  from?: string;
  to?: string;

  /**
   * 线 id（= `lnk-<8hex>`，§3.1）。update / delete 定位一条具体线时用；
   * create 时可由调用者指定（撞已有 id 即覆盖），省略则按规格确定性生成。
   */
  id?: string;

  /** 笔触样式。闭合枚举，取 doc-10 E13 的原词（§2.2）。默认 'solid'。 */
  style?: LinkStyle;

  /** 覆盖样式自带的描边色。省略 = 用 style 的默认色。 */
  color?: LinkColor;

  /** 有向：箭头画在 `to` 端。省略 = 用 style 的默认（只有 'arrow' 预设为 true）。 */
  directed?: boolean;

  /** 线上一行的短标签（≤ 40 字）。省略 = 无标签。 */
  label?: string;
}): ToolResult
```

**参数纪律**（`00 §6.3`：工具名与 doc-20 §1 一致，不造同义词）：

| op | 必填 | 可给 | 漏了会怎样 |
|---|---|---|---|
| `create` | `from` `to` | `style` `color` `directed` `label` `id` | 无法定位端点 → `invalid_argument` |
| `update` | `id` **或** `from`+`to` | `from` `to` `style` `color` `directed` `label` | 只有 `from`+`to` 而该对之间有多条 → `invalid_argument`（§3.1 第 2c 步） |
| `delete` | `id` **或** `from`+`to` | — | 同上；`from`+`to` 命中多条 → `invalid_argument`（要求传 `id`，§3.1 第 2c 步） |

- **`op` 是闭合枚举而不是从参数猜**：`create` 与 `update` 的差别不是"行在不在"（create 也是 upsert），而是"要不要新造一条线"。隐式推断（有 id 就 update）会让 `link({op:'create', id})` 语义悬空。
- **`id` 是本文对冻结形状的增补**（00 §4.1 的 `upsertLink` 签名与 plan 的工具签名都没它）。理由：一对卡片之间**允许多条线并存**（§2.4），`update`/`delete` 必须有办法点名一条。01 §5 明许"02–11 若需要额外参数，**加可选字段**"——`id` 是可选字段，不改 `from`/`to`/`style`/`label` 任何一条（与 `b1-design-01` 的约定一致）。
- **`link` 不接受 `layer`**：层由端点路径推导（§2.5），调用者给一个可能与端点不符的 layer 只会造出"查不到的行"。01 §5 原写 `linkCards({ layer, from, to, … })`，**REVIEW 已裁决以本文为准，01 §5 第 12 行已回写为不含 `layer`**（见 §11 冲突 3）。

### 2.2 `style` / `color` 枚举

`style` 是**语义预设**，一位一位对得上 doc-10 E13 的原文（`doc-10:157`：实线 / 虚线 / 箭头 / 特粗线 / 红线 / 手绘线 / 丝线），加上原型里已在用的 `road`：

```ts
export type LinkStyle =
  | 'solid'   // 实线：墨线，1.6px 直线（默认）
  | 'dashed'  // 虚线：点状钢笔，`stroke-dasharray: 2 9`（原型 = "接着做/批注"的语义线）
  | 'arrow'   // 箭头：实线 + `to` 端箭头标记（有向的简写）
  | 'bold'    // 特粗：3.2px，大地图道路的重量感
  | 'red'     // 红线：`--rust` 强调色（doc-19 §4.1「数十条红色丝线」的对应物）
  | 'hand'    // 手绘线：贝塞尔法线抖动，种子 = 线 id（doc-04 §4）
  | 'thread'  // 丝线：图钉 + 重力下垂（doc-04 §4 的"侦探板推理味"）
  | 'road';   // 道路：特粗 + 更强的抖动，大地图上的层与层之间

export type LinkColor = 'ink' | 'rust' | 'blue' | 'sage';
```

**为什么是"预设"而不是"轴"**：`style` 一个字段要同时表达材质（墨线/手绘/丝线，doc-04 §4 的材质轴）、权重（特粗）、色彩（红线）、方向（箭头）、纹样（虚线）——五个正交轴。把一个 5 维空间塞进一个字符串有两条路：

- **A（本文采用）**：`style` = **闭合预设表**，每个 token 对应一份**单一定义**的视觉规格（表在共享代码里，前端与任何将来导出渲染共用）；要"红线 + 丝线"这种组合，就用 `color: 'rust'` + `style: 'thread'` 覆盖。
- **B（不采用）**：`style` 变逗号分隔的轴串（`"thread,red,arrow"`）。否决理由：模型写串容易、校验难，且字符串的每个子集都要有定义，等于把枚举摊成笛卡尔积。

**A 的代价**：`style` 与 `color`/`directed` 有重叠（`style:'arrow'` ≡ `style:'solid', directed: true`）。这是**刻意的简写**：常用形态一个词写完，罕用组合用轴拼。归一化规则见 §3.1 第 3 步与 §2.4 的表——**存储层只存归一化后的三元组 `(style_base, color, directed)`，不存简写**。

> **`dash` 不作为独立参数暴露**：虚线在 AIRP 里是**语义**（"接着做/批注"，原型 `refreshLinkArchives` 让最新虚线高亮、旧虚线淡出，`LinkLayer.tsx:162-172`），不是随手可调的装饰旋钮。它是 `style:'dashed'` 预设的一部分，因此**没有 `dash?: string` 这样的参数**（给 `dasharray` 数值等于把样式表挪进模型的手里，前端再无法统一保证视觉）。落库时它是 `style` 的六个基元之一（§2.4）。

### 2.3 端点语义：**路径即 id**

- `from` / `to` 是**卡片 id**，而 `cards.id` 就是**卡片文件的世界根相对路径**（`world-store.ts:5` 注释逐字如此；`routes/world.ts:130` 用 `it.path` 查 `getLayerCards`）。
- 合法值域 = **能出现在某一层层页上的卡片路径**：`world/**/*.md` 下、且 `cardsOfLayer` 会收进来的那种（`layers.ts:102`）。**包括 `world/<layer>/README.md`**——门牌是合法的卡片，而且是最主要的端点：doc-05 §3.2 / §9.1 的"大地图上 = 道路"说的正是 map 层上两张门牌之间的线（门牌的 `path` 由 `routes/world.ts:141` 给出，就是 `<layer>/README.md`）。
- **端点必须存在**（`readFile` 成功）→ 否则 `not_found`。
- **必须两端同层**（§2.5）→ 否则 `invalid_argument`。理由：`/api/layer` 的线查询是 `WHERE layer = ?`（`routes/world.ts:210`），跨层的线永远不会被渲染——存下来就是一行谁也看不见的数据。
- **`from`/`to` 不接受 `player/**` 或 `characters/**`**：它们不在任何层的页上（`resolveLayer` 对它们返回 `null`，01 §3.9）。→ `invalid_argument`。
- **presence 不是端点**：doc-06 §219 的"思绪连线"（角色存在核心 ↔ 各物件）需要连到**角色**，而 presence 行没有路径、不是卡片。**B1 不做**，登记为留白（§12 第 3 条），不要在 `links` 里塞 `presence:<id>` 这种伪路径。

### 2.4 表格设计：现状够不够？

现状（`db/schema.ts:19-26`）：

```sql
CREATE TABLE links (
  id TEXT PRIMARY KEY,
  layer TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  style TEXT DEFAULT 'solid',
  label TEXT
);
```

| 需求（doc-10 E13 / doc-04 §4 / doc-19 §4.1） | 现状 | 判定 |
|---|---|---|
| **多线并存**（两卡之间既"改自"又"接着做"） | `id` 是 PK、不是 `(from_id,to_id)` 唯一约束 | ✅ 够。但 **`create` 会退化成"每次调用新增一列"**，同一规格重复调用长出重复线——需要确定性 id 做 upsert（§3.1） |
| **有向（箭头）** | 无此字段。若让 `style` 兼任方向（`style='arrow'`），它就与材质/颜色互斥 | ❌ 不够。方向是**几何**（要在 `to` 端加箭头标记），与"画什么颜色、什么笔触"正交；`style` 一个字段表达不了"红色箭头"。**加 `directed INTEGER NOT NULL DEFAULT 0`** |
| **颜色（红线）** | 混在 `style` 里 | ❌ 不够。同上，`style='red'` 与 `style='thread'` 互斥，doc-19 §4.1 要的"红色丝线"表达不了。**加 `color TEXT`**（NULL = 用 style 的默认色） |
| **z 序（线的叠放）** | 无。渲染顺序 = 数组顺序 = `SELECT` 的自然序，`buildPaths` 按 `links` 数组顺序 append（`LinkLayer.tsx:182`） | ❌ 不够。SQLite 无 `ORDER BY` 的行序不保证稳定，同一份数据两次查询可能画出两种叠法。**加 `z_index INTEGER NOT NULL DEFAULT 0`**，查询改 `ORDER BY z_index, id` |
| **创建时间** | 无 | ⚠️ 加 `created_at TEXT NOT NULL`（只在调试时看；不参与排序——排序一律靠 `z_index, id`） |

**改后的形状**（`00 §5.1` 同款"直接改 `CREATE TABLE`、不写迁移脚本"的处理，理由相同：世界目录还没有真实存档）：

```sql
DROP TABLE IF EXISTS links;
CREATE TABLE links (
  id         TEXT PRIMARY KEY,              -- lnk-<8hex>
  layer      TEXT NOT NULL,                 -- 派生，见 §2.5
  from_id    TEXT NOT NULL,                 -- 卡片路径
  to_id      TEXT NOT NULL,                 -- 卡片路径
  style      TEXT NOT NULL DEFAULT 'ink',   -- 归一化后的笔触基元（见下）
  color      TEXT,                          -- NULL = 用 style 默认色；ink|rust|blue|sage
  directed   INTEGER NOT NULL DEFAULT 0,    -- 1 = 在 to 端画箭头
  z_index    INTEGER NOT NULL DEFAULT 0,    -- 越大越靠上；ORDER BY z_index, id
  label      TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_links_layer ON links(layer, z_index, id);
```

**归一化在写入前完成，落库的是基元**（§3.1 第 3 步）：

| 工具面 token | 落库 `style` | 落库 `color` | 落库 `directed` |
|---|---|---|---|
| `solid` | `ink` | NULL | 0 |
| `dashed` | `dashed` | NULL | 0 |
| `arrow` | `ink` | NULL | 1 |
| `bold` | `bold` | NULL | 0 |
| `red` | `ink` | `rust` | 0 |
| `hand` | `hand` | NULL | 0 |
| `thread` | `thread` | NULL | 0 |
| `road` | `road` | NULL | 0 |

落库的 `style` 因此是一个**更小的基元枚举**（`ink|dashed|bold|hand|thread|road`，6 个），渲染只认这 6 个。`arrow`/`red` 是**工具面的语法糖**，不进 DB——这样"DB 里存的是画法，工具面给人话"两层分开，将来加新简写不动表。

**`cards` 表结构不动**：`width/height` 保留（它们只服务排座碰撞，`local-store.ts:346`/`407`），**`arrange` 不写它们**（§2.6 + §11 冲突 1）。`z_index` 保留（`seatUnplaced` 已按层维护 max+1，`local-store.ts:302-307`），`arrange` 可写。

### 2.5 `layer` 归属：写入时怎么推导

links 与 cards 都有 `layer` 列。规则（复用 01 §3.9 的 `resolveLayer`，不另写一套）：

| 表 | 推导方式 | 落在 `player/**` / `characters/**` 时 |
|---|---|---|
| `links` | `layer = resolveLayer(from)`；**MUST 等于** `resolveLayer(to)` | 两端任一为 `null` → 拒绝（`invalid_argument`，§2.3） |
| `cards`（`arrange` 的 place 形态） | `layer = resolveLayer(path)` | `null` → 拒绝（`not_found`，文案："…is not on a canvas layer"） |

- `resolveLayer` 内部就是 `layerOfPath(path, await scanLayers())`（`layers.ts:126-135`：取**最长**匹配的层 id，无匹配回 `map`），但它对 `player/**` 与 `characters/**` 返回 `null`（01 §3.9 定案）。
- **这是一处对现状的收紧**：`saveCardPosition` 现在走私有 `deriveLayer`（`local-store.ts:417-418/455-458`），它**把 `player/copper-key.md` 静默派成 `'map'`**（`layerOfPath` 的 fallback）。`arrange` 不继承这个行为——背包里的东西不在任何层的页上，给它一行 `layer='map'` 的 cards 记录只会在 map 层凭空长出一张查不到文件的卡。落地方式：`resolveLayer` 返回 null 时拒绝写（§8.2）；`saveCardPosition` 保持现状不动（它的调用者是拖拽路由，只传层页上的卡片）。
- **`links` 的 `layer` 必须两端一致**，因为 `/api/layer` 的线查询按 `layer` 过滤（`routes/world.ts:210`）。两端不一致 = 永远渲染不出来的行 → 拒绝而不是静默存。
- **`renameCardPosition` 要同步迁移 `links.layer`**：现在它只迁移 `from_id`/`to_id`（`local-store.ts:436-437`），且失败只 `console.warn`（`local-store.ts:439`）。跨层改名后（`world/a/x.md` → `world/b/x.md`）端点对了但 `layer` 还停在旧层，线就消失了。规则：`UPDATE links SET layer = <新层> WHERE from_id = ? OR to_id = ?`，与端点迁移同一次事务；迁移失败**抛 `ActionError('internal')`**（与 01 §10.2 对 `moveEntity` 第 5 步的要求一致，静默 warn 会让线悄悄消失）。跨层的改名要把整条线一起搬层；若一端留在旧层，这条线变成悬空线——保留行、不渲染（与 `LinkLayer.tsx:185` 的现有语义一致）。

### 2.6 `arrange`

```ts
arrange({
  /** place 形态：一张卡。 */
  path?: string;
  x?: number;
  y?: number;
  z?: number;

  /** 声明在签名里以兼容 plan §4 / doc-10 E13 的 "xy/wh"，B1 一律拒绝（§11 冲突 1）。 */
  w?: number;
  h?: number;

  /** layout 形态：一批卡。 */
  layer?: string;
  layout?: 'grid' | 'circle' | 'row';
  paths?: string[];
}): ToolResult
```

**两形态，互斥**：

- **`place`（给 `path`）**：绝对坐标写入。至少给 `x` / `y` / `z` 之一；`x`/`y` 必须 `Number.isFinite`，clamp 到 `[-4000, 4000]`（**clamp 不抛错**：任何卡都落在一个真实坐标上，绝不让 `NaN` 进 `cards.x`——`NaN` 会被 SQLite 存成 NULL，卡片随后从画面上消失）。
- **`layout`（给 `layout`）**：相对重排。`path` 必须缺席。`paths` 省略 = 该层**全部**卡片。重排是**从零赋坐标**（不读旧坐标），顺序 = `paths` 按字典序排（确定性）。三种形态：`grid`（√n 列的方阵）、`circle`（等角分布在以 `SEAT_ANCHOR` 为心的圆上）、`row`（单行）；步距沿用 `SEAT_STEP` 与 `spiralCells` 的参数（`local-store.ts` 现有常量），**不新造一套间距**。
- **两形态都给 / 都不给** → `invalid_argument`。
- **`w` / `h` 给了** → `unsupported`，文案说清"card size is derived from `CARD_FORMS`; use the component registry"。**不静默忽略**（00 §6.2：不许静默降级）。理由见 §11 冲突 1——不是"没做"，是**做了也会被下一帧撤销**：`/api/layer` 每次都会 `reseatLayer` 把 `w/h` 与 form 表不一致的卡重新排座并回写 `w/h`（`local-store.ts:367-415`），并且返回给前端的 `w/h` 从来不读行（`routes/world.ts:184-190` 注释逐字写明）。
- **`z` 可写**：AGENTS §7.5 第 6 条说 `.object` 的 `z-index` 是内联写的（服务端行序），所以"提到最前"是有意义且会被渲染尊重的操作。
- **`rot` 不在签名里**：旋转是 `rotOf(path)` 派生的 hash 值、**从不持久化**（`routes/world.ts:196` 注释、AGENTS §7.5 第 3 条）。给 `arrange` 一个 `rot` 参数只能造出一个被下一次渲染忽略的字段，所以**连参数都不加**（与 `w/h` 不同：`w/h` 是 plan 已冻结在签名里的，必须"接收并明确拒绝"而不是"假装没这个参数"）。
- **`layout` 不检查与未参与重排的卡的重叠**（`paths` 是子集时可能与既有卡重叠）：全量重排是正规用法，子集重排的落点由调用者负责。登记为已知边界（§7），不做软碰撞（软碰撞是前端拖拽的手感，`lib/collide.ts`，不属于引擎）。

### 2.7 工具参数 → 动作层输入（两层形状不同，别混）

`00 §6.1` 分了两层：`extensions/toolkit/link.ts` 的 **typebox 参数**（给模型看的，上面 §2.1/§2.6 那种扁平的形状）与 `packages/shared/src/actions/canvas.ts` 的 **action 输入**（给代码用的，01 §5 冻结的名字）。两者**逐字段对齐**，但 `arrange` 多一层折叠：

```ts
// packages/shared/src/actions/canvas.ts
export interface LinkInput {
  op: 'create' | 'update' | 'delete';
  from?: string;
  to?: string;
  id?: string;
  style?: LinkStyle;
  color?: LinkColor;
  directed?: boolean;
  label?: string;
}
export async function linkCards(ctx: ActionContext, input: LinkInput): Promise<ActionResult<LinkDetails>>;

export interface ArrangeInput {
  /** 绝对坐标写入（玩家拖拽路由与 `arrange({path,x,y})` 共用）。 */
  place?: { path: string; x?: number; y?: number; z?: number };
  /** 相对重排。与 `place` 互斥。 */
  layout?: { mode: 'grid' | 'circle' | 'row'; layer?: string; paths?: string[] };
  /** plan §4 冻结在签名里、B1 拒绝的两个字段（§11 冲突 1）。 */
  w?: number;
  h?: number;
}
export async function arrangeCards(ctx: ActionContext, input: ArrangeInput): Promise<ActionResult<ArrangeDetails>>;
```

- **工具壳（`extensions/toolkit/arrange.ts`）负责把扁平参数折成 `ArrangeInput`**：`arrange({path, x, y})` → `{ place: { path, x, y } }`；`arrange({layout, layer, paths})` → `{ layout: { mode, layer, paths } }`；`arrange({path, w})` → `{ place: {...}, w }`（**转交而不是在壳里拒绝**——拒绝逻辑住在动作层，两个入口才共享同一份规则，00 §8）。
- **`place` / `layout` 互斥由动作层判**（§2.6），不是由 typebox 的 schema 判：`POST /api/card/position` 是 C 入口、绕开 typebox，规则必须在动作函数里也有一次。
- **`layout` 用对象而不是裸字符串**（01 §5 第 13 行原给 12 的 `layout: 'grid' | 'circle' | 'row'` 是裸字符串）：裸字符串放不下 `paths`/`layer` 这两个同属 layout 形态的参数，会让 `arrangeCards({ layout: 'grid', paths, layer })` 的归属含糊（它们到底属于哪个形态？）。已与 `b1-design-12` 对齐用对象形态；**01 §5 第 13 行已按 REVIEW 回写为对象形态**。若 01 坚持裸字符串，退路是 `layout: 'grid'` + 顶层 `paths`/`layer`（工具壳仍能把两种形状折成同一个 `ArrangeInput`），**不阻塞**。
- **`arrangeCards` 的输入里没有 `op`**：与 `link` 不同，摆位没有"删"这个操作（删卡片是 `removeEntity`，归 04）。

---

## 3. 行为契约（逐步）

两条都遵守 01 §3.1 的五步骨架（解析输入 → 读取现状并校验 → 落盘 → 落账 → 返回）。**第 4 步在本层是空操作**（不落事件，§5）；骨架的其余四步一步不少。

### 3.1 `link` 逐步

1. **解析与形状校验**：`op` 必须在枚举内；`from`/`to`/`id` 至少满足 §2.1 表里各自 op 的要求。`from`/`to` 过 `00 §2.1` 路径纪律，非法 → `invalid_path`。
   *漏了会怎样*：`path.join(worldRoot, '/etc/passwd')` 能被当成端点存进表，画布变成越权探测通道。
2. **读现状**（读之前把要知道的一次读完）：
   a. `readFile(from)` / `readFile(to)` 各一次 → 失败即 `not_found`（**先校验端点存在，再谈落盘**：先写后校验会出现"线已建、端点不存在"的黑洞，正是 01 §3.1 第 2 步在防的）。
   b. `resolveLayer(from)` / `resolveLayer(to)` → 任一为 `null` 或两者不等 → `invalid_argument`（§2.5）。
   c. `update` / `delete` 用 `id` **或** `(from,to)` 查现有行：
      - 带 `id`：`SELECT … WHERE id = ?` → 空 → `not_found`。
      - 只带 `(from,to)`：`SELECT … WHERE from_id=? AND to_id=?` → **0 行 → `not_found`；>1 行 → `invalid_argument`**（文案给出现有 `id` 列表，让模型自己挑一条，不替它猜）。`delete` 与 `update` 同规：命中多条即拒绝，要求传 `id`（m-10）。
      - 端点的存在性校验对 `update`/`delete` 同样执行（端点文件可能已被 `delete` 拆掉，而线是悬空的）。
3. **归一化 + 落盘**（`upsertLink` / `deleteLink`，§4.2）：
   - 归一化：`style`/`color`/`directed` 过 §2.4 的表 → 落库基元；`label` 超 40 字 → `invalid_argument`（**不静默截断**：截断后的标签会永远少一截，调用者却以为写进去了）。
   - `create` 的 id 生成：`id` 给了就用它（撞已有行 = `ON CONFLICT(id) DO UPDATE`，但**若已有行的 `(from,to)` 不同则拒绝** `already_exists`——防止用错 id 覆盖掉一条不相干的线）；没给则 **`lnk-` + `sha1(layer|from|to)[0:8]`**，即"同一对端点 + 同一层 → 同一 id"。
     *这条确定性 id 就是"create 幂等"的实现*：作家重连一条已经存在的线，不会长出第二条一模一样的线（doc-10 E13 说作家"建线/改线/删线"，没有"堆线"）。**要刻意并存两条线，唯一的方式是显式给不同的 `id`**——不给 id 时 id 由端点决定，样式变了也还是同一行（改样式 = `update`，不是新建）。这一条与 §10.2 的三条 store 单测逐字对应。
     > **id 用 `sha1(layer|from|to)` 而不是自增/随机**：① 前端 `LinkLayer` 用 `hash(link.id)` 做手绘抖动的种子（`LinkLayer.tsx:211`）——同一个 id 的同一条线抖动位置永远一致，是 doc-04 §4 点名的"抖动是笔迹不是噪声"；② 两个 agent 进程同时 `create` 同一对端点，算出的 id 相同，SQLite 的 `PRIMARY KEY` 自然去重（WAL 下两侧各开连接，没有共享内存可用）。**`style` 不进 id**：改样式不该换一条线的身份（否则 `update` 就永远做不到，因为 id 变了）。
   - `update`：只改给了的字段（`style`/`color`/`directed`/`label`），`from`/`to` 给了就一起校验并改（改端点 = 重新过 2a/2b；这会让 `id` 与其端点不再对应，但 id 是**身份**不是**规格**，这是想要的——"这条线从 A 改指到 C"）。
   - `delete`：`DELETE FROM links WHERE id = ?`（或 `(from_id,to_id)`）。
   *漏了会怎样*：不做 id 确定性 → 重复建线；不做端点校验 → 悬空行；不做同层校验 → 永不渲染的行。
4. **落账：无。** §5 逐问走完准入三问，判定不落。
5. **返回**：`text` 英文、说清"哪两张卡之间、什么样式、是建还是改还是删"；`details` 见 §6.1。

### 3.2 `arrange` 逐步

1. **解析与形状校验**：两形态互斥（§2.6）。`place` 需要 `path` + 至少一个坐标；`layout` 需要 `layout` 枚举值。
2. **读现状**：
   a. `place`：`readFile(path)` → 失败 `not_found`；`resolveLayer(path)` → `null` → `not_found`（文案："…is not on a canvas layer"）；`w`/`h` 任一出现 → `unsupported`（**在落盘前拒绝**，不能"先写 x/y 再报 w/h 不支持"）。
   b. `layout`：`layer` 省略时用 `resolveLayer(paths[0])`；`paths` 省略时列该层页上的全部卡片（**复用 `pageOfLayer`**，`local-store.ts:447`——只有它知道"这一页上有什么"）。`paths` 里每一项都要能过 2a 的存在性与同层校验（任一不过 → 整批不做，`not_found`，而不是"部分成功"：一次 `layout` 要么整层排好，要么什么都没变，半排的版面比不排更糟）。
3. **落盘**（`placeCard` / `placeCards`，§4.2）：
   - `place`：`INSERT INTO cards (id, layer, x, y, z_index) VALUES (…) ON CONFLICT(id) DO UPDATE SET x=…, y=…, z_index=…, layer=excluded.layer`。**只写这三列**——不写 `width`/`height`（§11 冲突 1）。
   - `layout`：算出每张卡的新 `(x,y)` 后，**单事务批量 UPDATE**（`BEGIN IMMEDIATE` … `COMMIT`），避免前端在中间态拉到"一半新一半旧"的版面。
   *漏了会怎样*：不加事务 → 前端可能渲染出撕裂版面；写 `w/h` → 下一帧 `reseatLayer` 撤销并触发一次全层重排（表现为"卡片莫名跳走"）。
4. **落账：无。** 同 §3.1 第 4 步。
5. **返回**：`text` 说清改了哪几张卡 / 排了什么形；`details` 见 §6.1。

### 3.3 一等公民：**幂等与并发**

- **幂等**：`create` 同规格重复调用 → 同一 id → 同一行（`ON CONFLICT DO UPDATE` 且字段值相同 → 无实质变化）。`place` 同坐标重复调用 → 同样结果。**幂等是刻意的**：作家重试、模型重复调用同一工具，都不该在世界里留下第二份痕迹（doc-21 §1 的精神：只记真实变化；这里连变化都没有）。
- **并发**：两个进程（server 与 agent）各开一条 WAL 连接（`db/schema.ts:4-5`）。同一个 id 的 upsert 由 SQLite 的 PK 保证只有一行；`busy_timeout=5000` 保证锁等待不会立刻失败。`layout` 的批量事务用 `BEGIN IMMEDIATE` 抢写锁（与 01 §3.2 `appendEvent` 同款理由）。
- **无副作用顺序问题**：与本层不同，`link`/`arrange` **不碰文件**，因此没有 `moveEntity` 那种"文件已动、账没落"的中间态（01 §10.2）。唯一的多语句操作是 `layout` 的批量事务，已包在一起。

---

## 4. 文件与副作用

### 4.1 白名单：本层只允许碰一张表

| 目标 | 谁写 | 原子性 |
|---|---|---|
| `.airpworld/canvas.db` 的 `links` 表 | `linkCards` | 单语句 UPSERT / DELETE |
| `.airpworld/canvas.db` 的 `cards` 表（仅 `x` / `y` / `z_index` / `layer`） | `arrangeCards` | 单语句 UPSERT；`layout` 用事务包批量 |

**MUST NOT**：任何 `*.md`（线条与摆位没有文件本体，doc-10 E13）；`cards.width` / `cards.height`（§11 冲突 1）；`history.db`（不落事件，§5）；`.airpworld/state*`（00 §8 / doc-20 §2.3）；`world.json`（00 §2.2）。

### 4.2 `WorldStore` 新增方法（本层的存储接口）

00 §4.1 冻结了三个方法名，但没有字段形状；01 §2.7 把事件层补全了，**画布状态层归本文**（05 与 12 都依赖它）。冻结形状：

```ts
// packages/shared/src/store/world-store.ts
export interface LinkRecord {
  id: string;
  layer: string;
  from: string;
  to: string;
  /** 归一化后的笔触基元（§2.4 的表），不是工具面的 token。 */
  style: 'ink' | 'dashed' | 'bold' | 'hand' | 'thread' | 'road';
  color: 'ink' | 'rust' | 'blue' | 'sage' | null;
  directed: boolean;
  z: number;
  label: string | null;
}

/** create/share 语义：同 id 覆盖；`from`/`to`/`layer` 必填，其余可选。 */
upsertLink(link: {
  id?: string;                 // 省略 → `lnk-` + sha1(layer|from|to)[0:8]（§3.1 第 3 步）
  layer: string;
  from: string;
  to: string;
  style?: LinkRecord['style'];
  color?: LinkRecord['color'];
  directed?: boolean;
  z?: number;
  label?: string | null;
}): Promise<LinkRecord>;      // 返回写入后的完整行

/** 删一条线；返回是否真的删到了（false = 本来就没有，调用方决定这是不是错）。 */
deleteLink(id: string): Promise<boolean>;

/** 同 id 覆盖 x / y / z；`layer` 由调用方经 resolveLayer 算好传入（`cards.layer NOT NULL`）。不动 w/h。 */
placeCard(layer: string, path: string, box: {
  x?: number; y?: number; z?: number;
}): Promise<CardRecord>;

/** 批量落位（layout 用）。一条事务；返回写入后的行。 */
placeCards(rows: Array<{ layer: string; path: string; x: number; y: number; z?: number }>): Promise<CardRecord[]>;

/** 删卡片行 + 级联删掉所有碰它的线（§4.4）。**同步**（一条 `BEGIN IMMEDIATE` 事务，无 await）；返回各自影响了多少行，供调用方报告。 */
dropCard(path: string): { cards: number; links: number };

/** 一行线（前端 `/api/layer` 与 `look_at` 的画布摘要共用；`layer` 可省略 = 全层）。 */
getLayerLinks(layer?: string): Promise<LinkRecord[]>;
```

**相对 00 §4.1 的字段增补**（`id?` / `z?` / `color?` / `directed?`，以及 `placeCard`/`placeCards` 补 `layer` 参数——`b1-design-01` 已确认"01 不把画布状态方法纳入它的冻结，字段细化归 09"）：

- `id?`（§2.1 已述）：多线并存下 `update`/`delete` 的唯一定位手段。
- `z?` / `color?` / `directed?`：`links` 表的三列新字段（§2.4）。
- **`placeCard` 的 `box` 里没有 `w`/`h`**（00 §4.1 冻结的签名里有 `w?`/`h?`）：这是刻意的收窄，见 §11 冲突 1。**签名另补 `layer`（m-11，与 04 的裁决一致）**：`cards.layer` 是 `NOT NULL`，由调用方经 `resolveLayer(path)` 算好传入（§2.5）。若评审裁定"arrange 可以改 w/h"，本方法的签名与 §2.6 的拒绝逻辑一起改这一个地方。
- **`upsertLink` 的 `from`/`to`/`style`/`label` 名字一个没改**（00 §4.1 冻结；`b1-design-01` 的约定）。

**不动 12 依赖的既有方法**（`b1-design-01` 转述的约束，逐条遵守）：`getLayerCards` / `pageOfLayer` / `seatUnplaced` / `reseatLayer` / `saveCardPosition` / `renameCardPosition` 全部保留，**本层只做加法**。

### 4.3 写盘原子性：SQLite 事务，不是 `writeFileAtomic`

01 §10.3 的 `writeFileAtomic` 服务的是 markdown。本层没有任何文件写入，原子性由 SQLite 提供：单语句天然原子；`layout` 的批量 UPDATE 包 `BEGIN IMMEDIATE`/`COMMIT`。**不要为了"和 01 一致"给这里套一个 file 临时名方案**——那是解法错配。

### 4.4 生命周期耦合：谁在什么时候删行

`canvas.db` 的行必须跟着卡片的生死走，否则长出一堆悬空状态。三处规则（与 `b1-design-04` 已对齐）：

| 事件 | 谁做 | 做什么 |
|---|---|---|
| 卡片文件改名 / 移动（同层） | `renameCardPosition`（04 的 `moveEntity` 第 5 步） | `UPDATE cards SET id=?, layer=?` + `UPDATE links SET from_id/to_id=?` + `UPDATE links SET layer=?`（§2.5） |
| 卡片移动**跨出画布层**（→ `player/**` / `characters/**`） | `moveEntity` | **删 `cards` 行**（`dropCard`），不把 `layer` 改成派生值——`resolveLayer` 对 `player/**` 返回 `null`，静默塞 `'map'` 会让背包物件在 map 层凭空占座。回到画布层时由 `/api/layer` 的 `seatUnplaced` 重新排座（`routes/world.ts:167`：无行是触发条件，所以旧坐标不会复活）。**`links` 行保留**（见下） |
| 卡片文件删除 | `removeEntity`（04） | `dropCard(path)`：删 `cards` 行 + 级联 `DELETE FROM links WHERE from_id=? OR to_id=?` |

**线为什么在卡片"暂时离开画布"时不删**：`LinkLayer.tsx:183-185` 的现有语义逐字是——`if (!a || !b) continue; // dangling link: DB row kept, nothing rendered`。**悬空线是设计好的状态**：物件被玩家收进背包、线不画，物件回到场景、线自动复现。这与 00 §8「不静默降级」不冲突——它是"数据保留、渲染跳过"，且前端已有注释与行为。

> **删除是另一回事**：卡片文件真被删掉，线永远不可能复现，所以 `dropCard` 级联删线（否则 `canvas.db` 单调增长一堆谁也画不出的行）。

---

## 5. 落账：画布状态落不落事件？

### 5.1 准入三问逐问走（`doc-21 §1`）

| # | 问题 | `link` / `arrange` 的答案 |
|---|---|---|
| 1 | **它改变了世界吗？**（`doc-21:22` 括号里明列"**画布关系**"） | **过**。画线确实改变了画布关系；摆位改变了画布布局。这一问是**支持落事件**的。 |
| 2 | **它是不可推导的吗？**——光看世界目录的当前状态推不出来 | **不过**。`canvas.db` 本身就是当前值（`doc-22 §6`：当前层、卡片坐标、**关系线**都进 canvas.db）。"A 和 B 之间有一条红线"不需要事件表，读表就有。 |
| 3 | **有人会需要在事后被告知吗？** | **不过**。渲染人话需要的是"世界现在什么样"，`canvas.db` 直接给；作家下一轮想看线，工具/注入去读表（doc-22 §7：注入摘要、细节走工具）。**没有任何消费者等一条"线被画了"的历史条目。** |

**三问是"与"，不是"或"**：`doc-21 §1` 开头逐字写"三问**全过**才落库。任何一条不过，都不落"。第 1 问过、第 2/3 问不过 → **不落**。

### 5.2 与 doc-21 §1.1 / §8 的对照

- `doc-21 §1.1` 的表把"当前层 / 相机中心 / 选中项 / 背包清单"归为**视点当前值**（存 `canvas.db`）。§1.1 的判据句是"**如果它回答的是「世界现在什么样」，它不是事件**"——`links` / `cards` 正是"现在什么样"。
- `doc-21 §8` 逐字："**不把状态塞进事件**：没有 `state_changed` 这种事件"。给 `link`/`arrange` 造一个 `canvas_changed` 就是把 `state_changed` 换了个名字塞回来。
- `doc-22 §6` 的表逐字把"**卡片坐标、关系线**"列进 `canvas.db` 那一行，理由栏写"属于世界：进存档、跟着快照回滚"——这一栏同时回答了本层的两个问题：**存 canvas.db（不是事件表）**，且**进快照**（doc-16 的快照打包 `canvas.db`，所以线/位跟着回滚，不需要靠事件 replay）。

### 5.3 结论与理由（一句话）

> **`link` 与 `arrange` 不落事件**；它们唯一的外向信号是 `details`（§6.1）→ `canvas_patched` 演出帧（`event-bridge.ts:88` 已映射）。
>
> 理由：准入第 2、3 问都不过——`canvas.db` 就是当前值的唯一真相源，事件表存在的意义是补"文件自己看不出来的那部分"（`doc-21 §0`），而画布状态**恰恰是看得出来的那部分**。给它们落事件还会制造一个只有它自己消费的日志（第 3 问的字面违反）。

**这不等于"画布上的重要变化不告诉作家"**：三条替代通道各有归宿——① 作家要看线/位，`look_at`（03）与 doc-22 的注入节从 `canvas.db` 读当前值；② 物件在画布上的**实质变化**（文件被移动/删除）走 `entity_moved` / `entity_deleted`（04），那才是事件；③ doc-19 §4.1 的"线索风暴"是**演出**（`show` 通道），不是历史。

### 5.4 若评审坚持要落（替代方案，登记不采用）

若裁定"画布拓扑变化必须进历史面板"，最小改动是：**不新增 type**，把 `link` 折进已有的 `entity_edited`（`detail: { path: from, name, kind: 'other', target: to }`）——因为 doc-21 §4 的十五个类型是**封闭枚举**（`doc-21:80` "type 封闭枚举，见 §4"），加第十六个 type 要动 doc-21 与 00 §5.2 两张冻结表。**本文不采用**，因为它会让"作家画一条线"在注入里渲染成"某物件被编辑了"，语义反而更糟。

> **`link` / `arrange` 的落账结论登记在 §11 冲突 2**（00 §4.2 的 A 名单没写它们属哪类；doc-21 §4 的十五类型里也没有 layout/link 类）。

---

## 6. WS / 前端

### 6.1 `details`：两条通道的原料

01 §11.1 冻结了两条通道，本层**只供原料、不选通道、不发 WS**（00 §1：扩展不假设自己连着 WS）。`details` 形状（对齐 01 §11.2 的"建议含 `{ path?, ... }`"）：

```ts
// link 的 details
{
  kind: 'links',
  action: 'created' | 'updated' | 'deleted',
  layer: string,                  // 端点所在层（渲染定位用）
  links: LinkRecord[],            // 本次触碰的全部行（delete 时为被删的行）
  path?: string,                  // = 第一个端点的路径，喂 01 §11.2 的通用字段
}

// arrange 的 details
{
  kind: 'cards',
  action: 'placed' | 'laid-out',
  layer: string,
  cards: Array<{ path: string; x: number; y: number; z: number }>,  // 本次触碰的卡
  path?: string,                  // place 形态 = path；layout 形态省略
}
```

- **不用 `event` 字段**：`ActionResult.details.event` 是可选字段（01 §2.2），只读动作不带。本层属只读之外、落账之内的一类——**改状态但不产事件**，与 `showComponent`（只演出）同类。前端若按 `event.id` 去重，本层本来就没有 id 可去重。
- **回填 `links` / `cards` 的完整行**（不是只回 id）：前端要拿 `style`/`color`/`directed` 才知道画什么色、什么线型，回 id 会让前端再发一次 HTTP 取行——那正是 T0.2 要消灭的"整层重取"。

### 6.2 server 怎么映射成帧

`event-bridge.ts:87-89` **已经**把 `link`/`arrange` 的 `tool_execution_end` 映射成 `canvas_patched`：

```ts
if (event.toolName === 'link' || event.toolName === 'arrange') {
  push({ type: 'canvas_patched', source });
}
```

**要改的只有一处**：把 `details` 塞进帧，让前端不必整层重取（`plan:213` T0.2 的验收就是这条）：

```ts
// event-bridge.ts 的 tool_execution_end 分支
if (event.toolName === 'link' || event.toolName === 'arrange') {
  const d = (event.result?.details ?? {}) as Record<string, any>;
  push({
    type: 'canvas_patched',
    source,
    layer: typeof d.layer === 'string' ? d.layer : undefined,
    kind: d.kind,          // 'links' | 'cards'
    action: d.action,      // 'created' | 'updated' | 'deleted' | 'placed' | 'laid-out'
    links: Array.isArray(d.links) ? d.links : undefined,
    cards: Array.isArray(d.cards) ? d.cards : undefined,
  });
}
```

> **`details` 在 `event.result.details` 下，不是 `event.result` 本体**。pi-rp 的 `tool_execution_end.result` 是完整的 `AgentToolResult`（`{ content, details, usage?, … }`，`vendor/pi-rp/packages/agent/src/types.ts:361-378`），扩展 `registerTool` 的适配层把 `execute` 的返回值**整体**透传（`agent-session.ts:4235-4245`：`execute: async (…) => (await tool.execute(…)) as AgentToolResult<never>`），随后 `agent-loop.ts:767-775` 原样 `emit({ result: finalized.result })`。所以桥里必须读 `.details`。
>
> **顺带指出现状的一个潜在 bug**：`event-bridge.ts:82` 的 `event.result.path` 读的是 `AgentToolResult.path`（不存在）——目前 `chalk_landed` 的路径**全靠 `args?.path` 兜底**（`:83` 的 `??`），所以没暴露。`chalk` 工具若按 01 §11.2 把 `path` 放进 `details`，这一行应当改读 `event.result?.details?.path`（归 12）。
>
> **不需要给扩展加第三条通道**（00 §1 的硬约束）：`details` 经 pi-rp 的 `tool_execution_end` 流到 server 的 `onEvent`（`lifecycle.ts:77/104`）→ `mapEngineEvent`，这条链已经在用。

### 6.3 前端拿到 `canvas_patched` 后演什么（T0.2：只刷线/位，不整层重取）

现状：`useWorld.ts:178-183` 的 `switch` **没有** `canvas_patched` 分支，落到 `default`（`useWorld.ts:208`）被忽略；`LinkLayer` 的 `links` prop 只在 `fetchLayer` 时变（`Canvas.tsx:121-125` 的注释逐字说"`links` array reference only changes on fetchLayer-driven refreshes"）。**本层的帧因此是新接线**：

| 帧 | 前端动作 | 不做什么 |
|---|---|---|
| `canvas_patched`（`kind: 'links'`） | 按 `layer` 比对：是本层 → 用 `frame.links` **增量合并**进 `worldState.links`（按 `id` upsert / 用 `action: 'deleted'` 删），触发 `LinkLayer` 重算（`useEffect [links]`） | **不** `fetchLayer`——那会重取整页（正文 + 排座 + presence），正是 T0.2 要省的 |
| `canvas_patched`（`kind: 'cards'`） | 按 `path` 合并 `cards` 进 `worldState.items` 的 `x`/`y`/`z`（与 `card_position` 的合流逻辑同一份，`useWorld.ts:196-205`） | 同上；且**不**重新排座（坐标是权威，不是提案） |
| `canvas_patched` 且 `layer !== 当前层` | 忽略（帧带层就是为了这个：作家在别的层摆位不该让当前页抖一下） | — |

**`card_position` 与 `canvas_patched` 的分工**（两者都会在玩家拖卡时到达）：

- 玩家拖卡 → `POST /api/card/position`（`routes/world.ts:311`）→ 路由照旧 `broadcast({type:'card_position', path, x, y})`（`routes/world.ts:328`）。**这条保留**：它是逐卡的、轻量的、前端已有乐观合并（`useWorld.ts:121-145`）。
- agent 调 `arrange` → 只有 `canvas_patched`（没有 `card_position`，因为没经过拖拽路由）。
- **前端按 `(path, x, y)` 幂等合并**：两条帧到同一张卡时结果相同，不需要去重（值相等，setState 出的引用变化用浅比较兜住即可）。若实现时发现重复渲染，用 `x`/`y` 相等的早退守卫，而不是给帧加 id。

### 6.4 别忘了 `airp:world-event` 的自定义事件

`useWorld.ts:170-177` 会把 `file_changed` / `item_moved` / `god_action` 转发成 `window` 上的 `airp:world-event`（背包/角色视图监听它）。**`canvas_patched` 不转发**：画布状态变化不影响背包清单（背包是 `player/` 目录扫描，与 canvas.db 无关），多转发一次只会让背包视图白刷。

---

## 7. 错误与边界

错误码取 01 §2.4 的封闭枚举（**不新增码**）；文案英文、给模型/前端直接看（00 §6.2）。

| 场景 | 码 | 文案（`message`） | 是否 fallback |
|---|---|---|---|
| `op` 不在枚举 / 两形态都给 / 都不给 | `invalid_argument` | `link: op must be one of create, update, delete.` / `arrange: pass either a path (place) or a layout, not both.` | 否 |
| `from`/`to` 为空、绝对路径、含 `../`、保留前缀 | `invalid_path` | `Invalid card path "<x>": paths are world-root relative, POSIX, no leading './'.` | 否 |
| 端点文件不存在 | `not_found` | `Card not found: "<path>". Use look_at / view_canvas to list the current layer's cards.` | 否 |
| 端点不在画布层（`player/**`、`characters/**`） | `invalid_argument` | `"<path>" is not on a canvas layer; lines connect cards shown on a layer page.` | 否 |
| 两端不同层 | `invalid_argument` | `Both endpoints must be in the same layer ("<a>" vs "<b>"); cross-layer lines are never rendered.` | 否 |
| `update`/`delete` 只给 `(from,to)` 且命中多条 | `invalid_argument` | `N lines connect these cards. Pass an "id" to pick one: lnk-xxxx, lnk-yyyy.` | 否 |
| `update`/`delete` 什么都没命中 | `not_found` | `No line between "<from>" and "<to>".` | 否 |
| `create` 给的 `id` 已存在且 `(from,to)` 不同 | `already_exists` | `Line "lnk-xxxx" already connects <a> -> <b>. Pass a different id or omit it.` | 否 |
| `style` / `color` 不在枚举 | `invalid_field_value` | `Unknown style "wavy". Valid: solid, dashed, arrow, bold, red, hand, thread, road.` | 否 |
| `label` > 40 字 | `invalid_argument` | `Line label is 63 chars; keep it under 40.` | 否 |
| `x`/`y` 非有限数 | `invalid_argument` | `x/y must be finite numbers.` | 否（**不 clamp 到 0**：静默改坐标比报错更难查） |
| `x`/`y` 超出 `[-4000, 4000]` | — | **clamp，不报错**（见下） | **是（clamp 是刻意的）** |
| `arrange` 给 `w` / `h` | `unsupported` | `Card size is derived from CARD_FORMS (single source of truth); arrange cannot change w/h. Use the component registry to resize a kind.` | 否 |
| `arrange` 给 `rot` | — | 参数不存在（签名里没有），模型给了会被 pi-rp 的 schema 校验拒掉 | — |
| `layout` 的 `paths` 里有一项不存在 / 不同层 | `not_found` | 整批不做（§3.2 第 2b 步） | 否 |
| `layer` 给的层不存在 | `not_found` | `Unknown layer "<x>".` | 否 |
| 卡片文件存在但没有任何可读 frontmatter | — | 不报错：本层不需要 frontmatter（端点只看存在性与层归属） | — |

**`x/y` 超界的取舍：clamp 而不是报错**。理由：canvas 坐标的性质与路径不同——路径越界是安全问题（能读到世界外），坐标越界只是"摆得远了点"，clamp 到边界得到的是**语义上正确的卡位**（还在画布上、还能拖回来）。而报错会让"把卡片挪到很远的地方"这类无恶意操作直接失败。**但 `NaN`/`Infinity` 必须报错**（它们是数据类型错，clamp 无意义——`Math.min/max` 对 `NaN` 返回 `NaN`）。

**`no_free_seat` 不在本层**：那是 `seatUnplaced`/`reseatLayer` 的螺旋排座失败（`local-store.ts:340-344`），`arrange` 给的是绝对坐标，不参与排座。`layout` 的形态是解析式算出坐标（不查空位），因此也不会撞到它。

**不静默降级的四条具体落地**（00 §8）：

1. `w`/`h` → `unsupported`，不是忽略；
2. 找不到线 → `not_found`，不是"当不存在然后建一条"；
3. `label` 超长 → 报错，不是截断；
4. `layout` 中有一项非法 → 整批失败，不是"部分成功"。

---

## 8. 要实现/修改的代码落点

### 8.1 新增文件

| 文件 | 内容 |
|---|---|
| `packages/shared/src/actions/canvas.ts` | `linkCards(ctx, input)` / `arrangeCards(ctx, input)`（01 §2.1 已冻结该文件与两个函数名）+ 三个纯函数：`normalizeLinkStyle(style, color, directed)` / `linkIdOf(layer, from, to)` / 三种 `layout` 形态的坐标计算器（`computeGrid` / `computeCircle` / `computeRow`）。**纯函数无 I/O，可单测** |
| `packages/shared/src/schemas/canvas.ts` | `LinkStyle` / `LinkColor` / `LinkRecord` / `LinkInput` / `ArrangeInput` 的 zod schema（与 `packages/shared/src/schemas/events.ts` 平级）。**塞进 `schemas/` 而不是 `actions/`**：`WorldStore`（`store/`）要 import `LinkRecord`，而 `store/` 不许 import `actions/`（01 §6.2 对 `DanglingRef` 的同一条纪律） |
| `extensions/toolkit/link.ts` | `pi.registerTool({ name: 'link', … })`：typebox 参数 → `createActionService(store, actor).linkCards(...)` → `details` 透传 |
| `extensions/toolkit/arrange.ts` | 同上，`name: 'arrange'` |

### 8.2 修改文件（精确到函数 / 行）

| 位置 | 函数 | 改动 |
|---|---|---|
| `packages/shared/src/db/schema.ts:19-26` | `initCanvasDatabase` | `links` 表整体替换（§2.4），加 `idx_links_layer`。同 `01 §8.1` 对 `events` 的处理：`DROP TABLE IF EXISTS links` + 重建，**不写迁移脚本**（理由相同：世界目录还没有真实存档） |
| `packages/shared/src/store/world-store.ts:5-38` | `CardRecord` / `WorldStore` | 加 `LinkRecord`（从 `schemas/canvas.js` re-export）；接口加 §4.2 的六个方法。**`placeCard` 的 `box` 不含 `w`/`h`**（00 §4.1 的冻结签名在此收窄，见 §11 冲突 1）；签名补 `layer`（m-11） |
| `packages/shared/src/store/local-store.ts:276-470` | 新增 | 实现 `upsertLink` / `deleteLink` / `placeCard` / `placeCards` / `dropCard` / `getLayerLinks`；私有 `rowToLink(row)`；`getLayerLinks` 用 `ORDER BY z_index, id` |
| `packages/shared/src/store/local-store.ts:417-430` | `saveCardPosition` | **保持行为**，但内部改调 `placeCard`（去掉重复的 SQL 与 `deriveLayer`）。**不改它的 `deriveLayer` fallback**——它的调用者是拖拽路由，只传层页上的卡（§2.5） |
| `packages/shared/src/store/local-store.ts:432-441` | `renameCardPosition` | 端点迁移 + **`links.layer` 迁移**放进同一事务；失败**抛 `ActionError('internal')`** 而不是 `console.warn`（§2.5） |
| `packages/shared/src/actions/service.ts` | `createActionService` | 绑定 `linkCards` / `arrangeCards`（01 §2.6 的绑定表里已有这两个名字） |
| `extensions/tools.ts` | default export | 两个 `registerTool` import |
| `apps/server/src/routes/world.ts:184-217` | `GET /api/layer` | 线的查询改 `SELECT id, from_id, to_id, style, color, directed, z_index, label FROM links WHERE layer = ? ORDER BY z_index, id`；返回体加 `color` / `directed` / `z`（前端要画） |
| `apps/server/src/routes/world.ts:311-341` | `POST /api/card/position` | 改调 `createActionService(...).arrangeCards({ place: { path, x, y } })` + `ActionError.toHttp()`（归 12，见与 `b1-design-12` 的约定）；广播 `card_position` 保留 |
| `apps/server/src/engine/event-bridge.ts:87-89` | `mapEngineEvent` 的 `tool_execution_end` 分支 | 把 `event.result.details` 的 `kind`/`action`/`layer`/`links`/`cards` 塞进 `canvas_patched` 帧（归 12，§6.2） |
| `apps/web/src/state/useWorld.ts:178-210` | WS `switch` | 加 `case 'canvas_patched'`：按 §6.3 增量合并 `links` / `items` |
| `apps/web/src/state/useWorld.ts:17-23` | `LayerLink` | 加 `color: string \| null` / `directed: boolean` / `z: number` |
| `apps/web/src/components/canvas/LinkLayer.tsx:37-41` | `LINK_STROKES` | 从"样式 → CSS 变量"的 3 项表扩成 6 个基元 + `color` 覆盖；`stroke-width` 按 `style`（`bold`/`road` = 3.2）；`directed` 加 `marker-end`。**`hash(link.id)` 的种子逻辑不动**（§3.1 第 3 步的 id 设计就是为它） |
| `apps/web/src/components/canvas/LinkLayer.tsx:197` | `buildPaths` | `if (link.style === 'dashed')` 保留；`hand`/`thread`/`road` 的路径生成分支加在 `roadPath` 旁（`thread` 走"图钉 + 重力下垂"，doc-04 §4） |

**`directed` 的渲染**：用 SVG `<marker>`（`marker-end`），在 `<defs>` 里定义一次箭头，颜色用 `currentColor` 或按 `color` 变量取——**不要为每条有向线各建一个 `<marker>`**（N 条线 = N 个 defs，缩放时 DOM 膨胀）。

### 8.3 两条入口共用同一动作函数（00 §8：路由里不另写一套规则）

```
agent 进程：  pi tool `link`      ┐
              pi tool `arrange`   ├→ createActionService(store, actor) → actions/canvas.ts → store.upsertLink/placeCard
玩家 UI：     POST /api/card/position ┘        （C 入口，actor = player）
```

`link` 没有玩家 UI 入口（玩家不画线），但**动作函数仍然只写一份**——将来上帝模式加"画线"手势时直接复用。

### 8.4 `look_at` / 注入对画布状态的读法（不在本文实现，但本层要供得上）

- `03-look-at` 若要报"这里有 N 条线"：用 `getLayerLinks(layer)`，**不要**自己写 SQL（00 §8 反模式：同一份读逻辑两处）。
- `doc-22` 的 `layer_files` 节**暂不注入线**：线条是"当前值"，而 doc-22 §7 的原则是"注入摘要、细节走工具"；线在画布上是**看得见的**（玩家看得见就够，作家要细节自己调 `view_canvas` / `look_at`）。**登记为留白**（§12 第 2 条）。

---

## 9. 与现存实现的差异

| 位置 | 现状 | 要改成 | 旧调用点怎么办 |
|---|---|---|---|
| `db/schema.ts:19-26` | `links` 六列（`id/layer/from_id/to_id/style/label`） | 十列（加 `color/directed/z_index/created_at`；`style` 收窄为 6 个基元） | 无真实数据（模板 `templates/holmes-world/.airpworld/canvas.db` 的 `links` 实测 0 行），`DROP` 重建 |
| `store/world-store.ts` | 无任何 link 方法；`placeCard` 冻结签名带 `w?`/`h?` | 加 §4.2 的六个方法；`placeCard` 的 box 收窄为 `x/y/z` | 无调用点（方法不存在） |
| `routes/world.ts:210-217` | 线的查询只读 `id/from_id/to_id/style/label`，无 `ORDER BY` | 加 `color/directed/z_index` + `ORDER BY z_index, id` | 前端 `LayerLink`（`useWorld.ts:17`）与 `LinkLayer.LINK_STROKES`（`LinkLayer.tsx:37`）跟着扩 |
| `routes/world.ts:328` | `card_position` 帧（逐卡） | **保留**；`arrange` 另走 `canvas_patched` | 前端已有 `case 'card_position'`（`useWorld.ts:190`）不动 |
| `event-bridge.ts:87-89` | `link`/`arrange` → `canvas_patched`（**只带 `source`，工具还不存在**） | 帧加 `layer/kind/links/cards`（§6.2） | 无（工具此前不存在，帧没人消费） |
| `useWorld.ts:178-210` | 无 `canvas_patched` 分支，落到 `default` 忽略 | 加增量合并分支（§6.3） | — |
| `local-store.ts:417-430` | `saveCardPosition` 自己写 SQL + 用 `deriveLayer`（把 `player/**` 静默派 `'map'`） | 内部改调 `placeCard`（保持对外行为） | 拖拽路由 `routes/world.ts:326` |
| `local-store.ts:432-441` | `renameCardPosition` 迁移端点，**不迁 `links.layer`**；失败只 `console.warn` | 迁 `links.layer`，同一事务；失败抛错 | `routes/world.ts:298`（04 的 `moveEntity` 第 5 步） |
| `Canvas.tsx:121-125` | 注释明写 "`links` reference only changes on fetchLayer-driven refreshes" | 该注释在 §6.3 落地后**过时**，要改（帧可直接改 `links`） | — |
| `EXTENSIONS` | `extensions/toolkit/link.ts` / `arrange.ts` 不存在 | 新建（§8.1） | — |

**没有历史数据要迁**：`templates/holmes-world/.airpworld/canvas.db` 实测 `links` 0 行、`cards` 8 行（`cards` 表结构不动，无需重建）。`DROP TABLE IF EXISTS links` 因此是零成本的——与 `01 §8.1` 对 `events` 的判断同款。

---

## 10. 验收与测试

### 10.1 纯函数单测（无 I/O，MUST 写）

| 函数 | 判据 |
|---|---|
| `normalizeLinkStyle('arrow')` | → `{ style: 'ink', color: null, directed: true }`；`('thread')` → `{ style: 'thread', color: null, directed: false }`；`('solid', 'rust')` → `{ style: 'ink', color: 'rust', directed: false }`（8 个 token 逐项断言） |
| `linkIdOf('map', 'world/a.md', 'world/b.md')` | 同参数两次调用**必须同值**且匹配 `/^lnk-[0-9a-f]{8}$/`；参数顺序交换（`from`/`to` 互换）**改变 id**（有向线的身份含方向） |
| `computeGrid/computeCircle/computeRow(n, boxes)` | 输出数量 = n、坐标两两不重叠、结果**不依赖输入顺序**（同一批 `paths` 乱序 → 同一结果） |
| `computeX` 边界 | `x = NaN` → 抛；`x = 1e9` → clamp 到 4000 |

### 10.2 store 单测（临时目录 + 真 SQLite）

| 判据 |
|---|
| `upsertLink` 同规格两次 → `SELECT COUNT(*)` = 1（幂等） |
| `upsertLink` 同 `(from,to)` 不同 `style`（前端不传 id，靠 `linkIdOf`）→ 1 行（样式被改，不是新增） |
| `upsertLink` 显式不同 `id` 同 `(from,to)` → 2 行（多线并存） |
| `deleteLink(未知 id)` → `false`，不抛 |
| `dropCard(path)` → `cards` 行删除 + **所有碰它的线一起删**（`SELECT COUNT(*) FROM links WHERE from_id=? OR to_id=?` = 0） |
| `renameCardPosition('world/a/x.md','world/b/x.md')` → 端点更新**且** `links.layer = 'world/b'` |
| `placeCard(layer, path, {x,y})` → 行被写入（`cards.layer` = 传入的层）且 `width/height` **与写入前逐字节相同**（这条断言直接守 §11 冲突 1 与 m-11 的 `layer` 参数） |
| `placeCards([...])` 中途一项抛错 → 事务回滚，**一行都没改** |
| `getLayerLinks()` 行序 = `ORDER BY z_index, id`（插两条同 z 的线，断言按 id 排） |

### 10.3 探针 / 手测（端到端）

1. **线真的画出来了**：`templates/holmes-world` 起 server + agent；作家调 `link({op:'create', from:'world/crime-scene/README.md', to:'world/baker-street/README.md', style:'road', label:'步行 10 分钟'})` → **不刷新整页**下 map 层出现一条粗线带标签（验 T0.2 的"只刷线/位"）。
2. **线不在别的层出现**：切到 `world/baker-street` → 那条线消失（`WHERE layer = ?` 生效）。
3. **玩家的手 vs 作家的手**：玩家拖一张卡 → 仍是 `card_position` 逐卡帧（乐观合并先动，`useWorld.ts:121`）；作家 `arrange` 同层另一张卡 → 该卡**独自**跳位，其余不动（验 `canvas_patched` 只合涉及的卡）。
4. **`w/h` 的拒绝可见**：`arrange({path, x, y, w: 500})` → 工具返回 `isError` + `unsupported` 文案，**且 `cards.w` 未变**（对比 §10.2 那条行级断言）。这是 §11 冲突 1 的现场证据。
5. **幂等**：同一 `link` 调两次 → `links` 表 1 行；前端线**不闪**（`LinkLayer` 的 seed 相同）。
6. **悬空线不炸**：把线的 `to` 端点文件 `move` 进玩家背包（跨出画布层）→ 前端线消失、无报错、`links` 行还在；搬回来 → 线自动复现。
7. **落账为空**：上述每一步后查 `history.db` 的 `events` → **无任何 `link`/`arrange` 相关行**（§5 结论的可执行证据；`getMaxSeq()` 前后不变）。

### 10.4 评审可读性判据

- 读者能在 §5 找到"为什么画布关系变化不落事件"的**逐问**答案，而不是一句"因为是状态"；
- 读者能在 §11 找到 `arrange` 改 `w/h` 的完整矛盾链（00 §2 / AGENTS §7.5 / `reseatLayer` / 返回体不读行）与建议；
- §4.2 的方法清单与 00 §4.1 的基线逐条对照得上（改了什么、加了什么、为什么）。

---

## 11. 发现的冲突 / 需要修订的上位文档

> 按 `00 §0`：不在本文私改上位文档，只登记，评审统一裁决。**两个任务点名的矛盾在冲突 1、2**。

### 冲突 1（任务点名）：`arrange` 改不改 `w` / `h`？

**三份文档的原文**：

| 出处 | 原话 |
|---|---|
| `后端实现计划.md:271` | `arrange` \| `{ path, x?, y?, w?, h? }` \| 同上，写 `cards` 表。让作家能主动摆位，而不是全靠引擎排座 |
| `doc-10 E13`（`doc-10:163`） | "**画布布局工具**——组件在画布上的 **xy/wh**（及 rot）状态的读取/移动/整理" |
| `AGENTS.md §7.5` 第 1 条 | "**宽度只有一个真相源**：`packages/shared/src/schemas/forms.ts` 的 `CARD_FORMS`" |
| `AGENTS.md §7.5` 第 2 条 | "**外壳不写死高度**：…form 表的 `h` 只服务座位排布，**不是渲染高度**" |
| `00 §9` / `§10` 第 6 条 | `CARD_FORMS` 只有 6 种 kind——"组件注册表要扩它"；"`CARD_FORMS` 与组件注册表脱节"是 B1 要修的既有问题 |
| `10-*`（组件注册表） | `CARD_FORMS` 与前端渲染器都**从组件注册表派生**（10-* §1 定位 1） |

> 注：任务描述引的是"00 契约 §2"；`00 §2` 实际是路径/目录结构契约，**没有**提尺寸。尺寸契约的真实出处是 `AGENTS §7.5` + `00 §9/§10`。下文的矛盾分析按真实出处走。

**为什么这是真矛盾**：

1. **`w/h` 不是卡片的自由属性，是 kind 的函数。** `cardFormOf(frontmatter, filename)`（`forms.ts:58-63`）从 kind 查表，**没有别的输入**。`arrange` 把一张 chalk 改宽到 600，下一次 `/api/layer` 返回的 `w` 仍是 `460`——而且返回体**逐字注释**说"w/h are a pure function of kind, so they always come from the form table — never from the stored row"（`routes/world.ts:184-186`）。
2. **写了会被下一帧主动撤销，还附带副作用。** `reseatLayer`（`local-store.ts:367-415`）专门检测"存储的 `w/h` 与 form 表不一致"的卡，把它们**重新排座并回写 form 值**。所以 `arrange({w})` 的效果是：**触发一次全层重排，然后尺寸回到原样**——看起来像"卡片自己跳走又复原"。
3. **`h` 连渲染高度都不是。** AGENTS §7.5 第 2 条：外壳只给 `width`，高度由内容撑开；form 表的 `h` 只用于排座碰撞。所以 `arrange({h})` 即使在存储层生效，**画面上也不会变**，只是把排座算法的输入搞错（并且 §7.5 的"已知缺口"说排座已经按 form 的 `h` 算碰撞而实际渲染更高——再让人手改这个值会把缺口撕得更大）。
4. **尺寸的合法改法已经存在，且不在这层**：改 `CARD_FORMS`（或 10-* 的组件注册表），让**所有**该 kind 的卡在下一帧重排——这是"组件的尺寸是类型属性"的语义，与"这一张卡摆在哪"是两件事。

**建议怎么改**（三选一，**本文推荐 A**）：

- **A（本文采用）**：`arrange` / `arrangeCards` 的**签名保留 `w?`/`h?` 以兼容冻结的 plan §4，但给到就抛 `unsupported`**，文案指向 `CARD_FORMS`/组件注册表。`placeCard` 的 `box` 收窄为 `x/y/z`（§4.2）。同时**回写三份文档**：`plan:271` 的签名去掉 `w?/h?`（或加注"B1 拒绝"）、`doc-10 E13` 的 "xy/wh（及 rot）" 改成 "xy 与 z（尺寸归 `CARD_FORMS`，rot 派生自路径）"、**`00 §4.1` 的 `placeCard` 签名去掉 `w?/h?`**。
- B：`arrange` 允许 `w/h`，但**只影响排座碰撞框**（写 DB、渲染忽略）。否决：这等于把"排座 h"与"卡片 w/h"两个语义塞进同两个列，AGENTS §7.5 的"三个尺寸来源互不协商"老坑原地复活。
- C：`arrange` 允许 `w/h` 且**渲染层改成读行**。否决：直接推翻 AGENTS §7.5 第 1/2 条与 10-* 的"注册表是唯一真相源"，且会让"同一 kind 的卡尺寸不一致"成为常态。

**`rot` 同理**（`doc-10:163` 把 rot 列进画布布局状态）：`rotOf(path)` 是路径 hash 的**派生**值、从不持久化（`routes/world.ts:196`）。`arrange` **连参数都不加**；若要"让某张卡不歪"，合法改法是改 `rotOf` 的规则或让 kind 恒 0（`chalk`/`sprite` 已经恒 0，AGENTS §7.5 第 3 条）。

### 冲突 2（任务点名）：画布状态要不要落事件？

**三份文档的原文**：

| 出处 | 原话 |
|---|---|
| `00 §4.2`（A/B/C 三入口表） | A 入口覆盖：`chalk` `move` `move_to` `choose` `roll_dice` `use_item_on` `set_following` `delete`——**没有 `link` / `arrange`**；而 `00 §6.3` 的工具名表里有它们 |
| `doc-21 §4` | 十五个**封闭**类型；**没有**任何 layout / link / canvas 类 |
| `doc-20 §1.1`（`doc-20:34`） | `link / arrange` 在工具表里（作家与角色都可调用） |
| `doc-21 §1` 第 1 问（`doc-21:22`） | "它改变了世界吗？（文件内容 / 文件位置 / **画布关系** / 在场 / 一次随机裁决的结果）"——**画布关系被明列进第 1 问** |
| `doc-21 §1.1` / `§8` | "当前层 / 相机中心 / 选中项"是**视点当前值**（canvas.db）；"**不把状态塞进事件**" |
| `doc-22 §6`（`doc-22:147`） | "当前层、**卡片坐标、关系线**、角色 presence、跟随 → `canvas.db`" |
| `01 §4.1` | 已把 `linkCards` / `arrangeCards` 判为"**不落事件**，只广播 `canvas_patched`"，并登记为 01 的冲突 7 |

**为什么这是真矛盾**：`doc-21 §1` 第 1 问的括号**点名了"画布关系"**，字面上支持落事件；但第 2、3 问与 §1.1 / §8 / doc-22 §6 又说画布状态存 `canvas.db`、不塞事件。三问是"与"（`doc-21:20` "三问全过才落"），所以答案是**不落**——但"第 1 问里为什么会有'画布关系'"这个措辞就没人解释，容易让实施者读成"作者本意要落"。

**另一种可能的读法（值得评审注意）**：第 1 问括号里的"画布关系"，举的可能是**角色的在场关系**（`presence`：谁在这层、谁跟着谁）——那些确实有 `character_moved` / `following_changed` 两个事件类型（`doc-21 §4.2`）。也就是说"画布关系"指的是**这些有事件类型的子集**，而 `links` 恰好在子集之外（没有类型）——**措辞与枚举不闭合**。

**建议怎么改**：

1. **`doc-21 §1` 第 1 问的括号**把"画布关系"限定为"**有事件类型的**画布关系（在场 / 跟随）"，并加一句："线条与卡片坐标是当前值（§1.1 第二行），不在此列"。
2. **`00 §4.2` 的表**加一列或一句：A 名单只覆盖"落账的动作层工具"；`link` / `arrange`（以及 `show`）是**改状态/只演出、不落账**的一类，走 `details` → 演出帧。
3. **`doc-21 §4` 的十五类型保持封闭**：本层**不申请新 type**。若将来评审要求"拓扑变化进历史"，最小代价是折进 `entity_edited`（§5.4），但那要动两张冻结表（`doc-21 §4` + `00 §5.2`），本文不建议。
4. 三份文档一起点名 `canvas_patched` 是**帧不是事件**（`00 §5.3` 已定帧名与事件 type 不共用命名空间），避免实施者去事件表找它。

### 冲突 3：`linkCards` 的 `layer` 参数（01 §5/§6 行 12 vs 本文）

| 出处 | 原话 |
|---|---|
| `01 §5` 第 12 行 | `linkCards` \| `canvas.ts` \| `{ layer: string; from: string; to: string; style?: string; label?: string }` |
| `plan:270` | `link` \| `{ op: create\|update\|delete, from, to, style?, label? }`（**无 layer**） |

**矛盾**：01 的输入形状带 `layer`，plan 与本文都不带。本文不带（§2.1）的理由是层由端点推导、调用者给错会造出查不到的行（`WHERE layer = ?`）。但 01 §5 明许"可以加可选字段，不许改名/改必选性"——**把 `layer` 从必选改成"不接受"不算改名，但确实是改语义**。

**已按 REVIEW 裁决**（M-1）：以本文为准，**01 §5 第 12 行已回写为不含 `layer`**（同批回写第 13 行 `arrangeCards` 的对象形态）。`linkCards` 的输入定为 `{ from, to, style?, color?, directed?, label?, id? }`（无 `layer`；它内部经 `resolveLayer(from)` 算，两端不一致即拒）。若评审要保留 `layer` 作为"断言"（调用者传的值必须等于推导值，不等就报错），本文不反对——但**不许拿它当写入源**。

### 冲突 4：`chalk` 的 `link_to` 到底建不建线？（`plan:262` vs `doc-10 E13`）——**已裁决：B 案**

| 出处 | 原话 |
|---|---|
| `plan:262` | `chalk` 工具内部负责"…`link_to` **顺手建线**" |
| `docs/archive/…/doc-07-工具参数规格.md:69/75` | `link_to?: string // 快速画一条连线`；"`link_to` 自动设置 frontmatter 的连线" |
| `frontmatter.ts:21` | `link_to: z.string().optional()` 是 **chalk frontmatter 的一个键** |
| `doc-10 E13`（`doc-10:155-161`） | "线条…**不是从 md 派生的装饰**，而是 canvas.db 里的画布状态数据"、"**不落 md**；文件即真相、画布即投影的纪律在这个域上不成立" |

**矛盾**：如果 `link_to` 是 md 里的一个键、由它派生线，那就是 doc-10 E13 明文推翻的假说；如果 `link_to` 只是"调用 `link` 的糖"，那 chalk 的 frontmatter 里就不该有 `link_to` 这个**持久键**（否则移动文件时 `rewriteRefs` 要把它算作引用，01 §6.2 的 `RefKind` 里也确实有 `'link_to'`）。

**定案（REVIEW 裁决，m-17）：B 案；A 案已否决。两种解读如下**：

- **A**：`link_to` 是 md 键 = 线的**声明**，渲染时与 canvas.db 的显式线合并。**否决**：这正是被推翻的假说，且"两个真相源"会让删线删不干净。
- **B（定案）**：`link_to` 是 **chalk 工具的参数**（不是持久 frontmatter 键）：`chalk({content, link_to})` 在写完文件后**调 `linkCards({op:'create', from:<新 chalk 路径>, to: link_to})`**（同一动作函数，不重复实现）。**md 里不写 `link_to`**；`frontmatter.ts:21` 的 `link_to` 键**降级为只读兼容**（旧的、手写的 `link_to` 不被引擎使用，也不自动建线）。按 m-17，`01 §6.2` 的 `RefKind.'link_to'` / `'append_to'` **同步删除**（与 02/04 对齐）。

**这条跨 02 与本文**：`link` 提供建线能力，`chalk` 只是众多调用者之一。**已定案 B**——`02` 按 B 实现（`link_to` 是工具参数、写完文件后调 `linkCards({op:'create'})`；md 里不写 `link_to`），`04 §3.6.3`/`§3.6.5` 的 `RefKind` 删 `link_to`/`append_to`。无论怎样，`doc-10 E13` 的"不落 md"必须守住。

### 冲突 5：`links.style` 的默认值与会话兜底不一致

| 出处 | 原话 |
|---|---|
| `db/schema.ts:24` | `style TEXT DEFAULT 'solid'` |
| `routes/world.ts:215` | 读出来时 `row.style ? String(row.style) : 'solid'`——**兜底值 'solid'** |
| `LinkLayer.tsx:189` | `LINK_STROKES[link.style] ?? 'var(--ink)'`——**未知/缺失样式静默画成墨线** |

**矛盾**：落地时 `style` 的取值域会从 `'solid'` 扩成 6 个基元（§2.4），而"未知值静默降级成墨线"是**静默降级**（00 §8 明禁）。

**建议**：`links.style` 改 `NOT NULL` + 写入侧保证枚举内；渲染侧遇到未知值**不改行为**（保持画墨线的 fail-soft，因为前端不该因一行坏数据白屏），但**在 server 侧读表时 `console.warn` 一次**（可发现、不炸渲染）。`routes/world.ts:215` 的 `row.style ? … : 'solid'` 改成 `: null` —— 让"缺失"与"未知"分开，前端只对 `null` 用默认。

### 冲突 6：`card_position` 帧与 `canvas_patched` 的重叠

| 出处 | 原话 |
|---|---|
| `plan:213` | `tool_execution_end`（`link`/`arrange`）→ `canvas_patched`："**只刷线/位，不整层重取**" |
| `routes/world.ts:328`（现状） | 玩家拖卡 → `card_position` 帧（逐卡） |
| `01 §11.3` | 帧名表把 `canvas_patched` 与 `card_position` 并列 |

**不是硬矛盾，是**分工没写清：两者都能表达"卡片换位置了"。本文 §6.3 定的分工是"玩家拖拽走 `card_position`（逐卡、乐观合并已有）、agent 摆位走 `canvas_patched`"。但 `POST /api/card/position` 改造后走 `arrangeCards`（归 12），那条路由**要不要同时发两种帧**？本文的建议：**只发 `card_position`**（后端不发 `canvas_patched`；`canvas_patched` 是工具路径专属）。**请 12 确认**，避免同一次拖拽发两帧。

---

## 12. 仍然未知 / 留给评审拍板的

1. **`link` 的 `id` 增补是否被 00 接受**（§2.1）。它是 `update`/`delete` 在多线并存下的唯一定位手段；若 00 不收，替代方案是"用 `(from,to,style)` 三元组定位"——但那要求 `style` 唯一，与"两条不同样式的线并存"直接冲突。**建议接受**。
2. **`doc-22` 是否要注入"本层有几条线"**（§8.4）：本文倾向**不注入**（线看得见、细节走工具）。若作家频繁需要"我知道的两张卡之间该有线"，可在 `layer_files` 节加一行计数——**留白**。
3. **presence 能不能当线条端点**（§2.3）：doc-06 §219 的"思绪连线"需要它，`links` 表当前设计（`from_id`/`to_id` 是路径）表达不了。要支持需给 `links` 加一个 `from_kind`/`to_kind`（`'card' | 'presence'`）或建第二张表——**B1 不做**，登记为 v2。
4. **线条的标签渲染**：`label` 现在只是 DB 字段，前端 `LinkLayer` **完全不画它**（`buildPaths` 只建 `<path>` + 两个圆点，`LinkLayer.tsx:191-209`）。要不要画（SVG `<text>` + `textPath`）**归 06/前端改造计划**；本文只冻结"标签存在且有 40 字上限"。
5. **`layout` 的三种形态够不够**：`grid`/`circle`/`row` 来自 01 §5 行 13 的冻结枚举。doc-06 §2.5 的螺旋排座（`seatUnplaced`）是第四种（"自动零散分布"）——**要不要把它也暴露成 `layout: 'spiral'`**？本文倾向不加（它是"新卡的默认落点"，不是"整层的重排形态"），**留白**。
6. **`link` 的权限**：doc-20 §1.1 说不按身份裁，本文遵守（角色可画线）。但"角色画线"意味着角色能改**别人层**的拓扑——**这在 doc-05 §4.1"不做权限防备"下是刻意的**。若评审要收，需要在 doc-20 加一条角色侧纪律（不是代码门禁）。**留白**。
7. **删除卡片时级联删线是否太狠**：本文选"卡片文件真删 → 线也删"（§4.4）。另一个选择是"保留线、让它永远悬空"（可恢复性更好，但表单调增长）。**建议按本文**，因为 `entity_deleted` 事件已经记下了"它曾被删"，可恢复性由快照回滚承担（doc-16）。
8. **`getLayerLinks()` 无 `layer` 参数时返回全库**：现在没有这个调用者，加它是给将来的"世界拓扑视图"留的。要不要保留这个可选形态（默认 `layer` 必填）？**建议保留可选**，零成本。
9. **`/card/position` 的返回形状（m-12，已裁决）**：`12 §2.4` 原写 `{ canvas:'cards', changed:[…] }`，本文 §6.1 定为 `ArrangeDetails = { kind:'cards', action, layer, cards, path? }`。**以本文 §6.1 为准**，`12` 回写其 §2.4 的返回形状；`12` 的 `mapEngineEvent` 骨架已在读 `details.kind`/`action`，方向一致。

---

## 13. 结构对照（`00 §7` 的 12 节 → 本文）

| `00 §7` 要求 | 本文位置 |
|---|---|
| 1. 一句话与定位 | §1 |
| 2. 签名与参数 | §2（§2.1 `link` / §2.2 枚举 / §2.3 端点语义 / §2.4 `links` 表 / §2.5 layer 归属 / §2.6 `arrange` / §2.7 工具参数→action 输入） |
| 3. 行为契约（逐步） | §3（§3.1 `link` / §3.2 `arrange` / §3.3 幂等与并发） |
| 4. 文件与副作用 | §4（§4.1 白名单 / §4.2 store 接口 / §4.3 原子性 / §4.4 生命周期耦合） |
| 5. 落账 | §5（三问逐问 + §5.3 结论 + §5.4 替代方案） |
| 6. WS / 前端 | §6（§6.1 details / §6.2 帧映射 / §6.3 前端增量合并 / §6.4 不转发 `airp:world-event`） |
| 7. 错误与边界 | §7 |
| 8. 代码落点 | §8（§8.1 新增 / §8.2 修改 / §8.3 两入口共用 / §8.4 读取方） |
| 9. 与现存实现的差异 | §9 |
| 10. 验收与测试 | §10（纯函数 / store / 探针 / 评审判据） |
| 11. 发现的冲突 | §11（6 条，含任务点名的两条） |
| 12. 仍然未知 | §12（9 条） |
