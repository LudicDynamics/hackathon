# Writer 专用 `create_char` 设计

## 1. 一句话定位

`create_char` 是 **Writer 专用** 的角色装配动作：它接收一个已经准备好的头像路径和角色资料，一次性创建 `characters/{id}/` 的配置文件、角色 preset 与 `world.json` manifest 登记，并以现有 `entity_created` 世界事件让角色立即可发现、随后按需启动；它不是 Skill，也不是通用 `createEntity` 的别名。

本设计只规定 Writer 侧创建链路，不新增角色对话流程、角色小天地内容管理规则或图片呈现组件；后两者分别引用共同契约与对应领域设计。

## 2. 输入、输出与 Writer 指示

### 2.1 工具输入

对模型暴露的 JSON 只有以下字段，`additionalProperties: false`：

```ts
{
  id: string;          // 必填：稳定 ASCII 小写 kebab-case id
  name: string;        // 必填：自由散文显示名/称呼，不用于路径
  desc: string;        // 必填：README.md 的完整正文
  avatar: string;      // 必填：世界根相对、已存在的图片文件路径
  identity?: string;   // 存在时写 identity.md
  personality?: string;// 存在时写 personality.md
  memory?: string;     // 存在时写 memory.md
  voice?: string;      // voice-casting alias 或 palette raw id
}
```

输入约束：

- `id` 先 `trim`，再用共同规则 `isValidCharacterId(id)` 校验。该规则的正则是 `/^[a-z0-9][a-z0-9-]*$/`（`packages/shared/src/rules/characters.ts:20-26`）；输入不能携带 `characters/` 前缀、斜杠或显示名。目录名就是 id（共同契约 §2）。
- `name` 必须是非空自由文本，保留原文作为 README frontmatter 的显示名；`desc` 必须是非空字符串，写入 `characters/{id}/README.md` 正文时不改写其 Markdown，不把它放进 frontmatter。
- `avatar` 必须是非空世界根相对 POSIX 媒体路径，且只能位于 `assets/**` 或引擎生成的 `.airpworld/assets/**`；拒绝其它根、绝对路径、URL、反斜杠和 `..`。在任何角色文件写入前，服务端 gate 必须完成 realpath/symlink 复核（解析后仍位于允许根）、常规文件检查与图片 MIME/扩展名 allowlist 检查。工具不上传、生成、复制或下载头像；头像准备由先前的 `generate_image`（或其它已完成的素材准备流程）负责。现有 `generate_image` 的结果只承诺返回 `.airpworld/assets/gen/` 下的 asset 路径（`packages/shared/src/actions/generate-image.ts:1-6,19-23,50-67`）。

- `identity`、`personality`、`memory` 如果存在必须是字符串，原样作为对应 Markdown 文件正文；未提供就不创建该文件，供 preset 的 `onMissing: "skip"` 正常工作。角色基础配置文件不可移走或删除的规则见共同契约 §5.3；创建动作不把生活物品写入这些文件。
- `voice` 若存在，先 trim 外层空白，再保留规范化后的 alias 或 palette raw id；写入前必须经 `voiceEntry`/`resolveVoice` 校验，未知值不能被当作默认音色静默接受。`voice-casting` 的 alias/raw 双词汇解析是 `packages/shared/src/rules/voices.ts:94-115`，其事实规则与同世界不重复规则见 `skills/voice-casting/SKILL.md:8-18,49-55`。省略 `voice` 不是“无音色”，而是服务器默认音色；因此也要检查同世界默认音色冲突。验收必须覆盖前后空白输入。

`avatar` 的值**不是**浏览器 URL。前端的 `assetUrl` 会把相对路径转成 `/api/asset`，并原样放行 `https:`、`data:`、`blob:`、`/` 等绝对值（`apps/web/src/App.tsx:101-105`），但 create_char 的输入契约更窄：只接受 `assets/**` 或 `.airpworld/assets/**` 下的世界根相对媒体路径。create_char 只调用 image-specific gate；`/api/asset` 仍是通用媒体入口，必须按调用者/媒体类型分流 image、video 与 audio，不能为了头像验证把 bg、bgVideo、portrait video 或 audio 收窄为 image-only。现有 `/api/asset` 仍只做世界根越界检查（`apps/server/src/routes/world.ts:1311-1332`），这是必须补齐的分流与门禁，不是可以沿用的安全结论。

### 2.2 输出

成功返回现有 A 入口统一形状 `{ content: [{ type: 'text', text }], details }`（`extensions/toolkit/result.ts:12-22`）。[推断]建议 `CreateCharDetails` 为：


```ts
interface CreateCharDetails {
  id: string;
  nook: string;                 // characters/{id}
  readme: string;               // characters/{id}/README.md
  files: string[];              // 实际写入的角色文件和 preset
  avatar: string;
  voice?: string;
  manifestCharacter: CharacterConfig;
  event: WorldEvent;
}
```

`text` 应明确返回角色 id、自由散文显示名、头像路径与“已注册、尚未启动”，例如：`writer created character "那个在暴雨里捡到戒指的女孩" (rain-girl); avatar ...; registered and ready for on-demand start.` 显示名不参与路径或稳定身份。

### 2.3 Writer instruction 落点

在 `extensions/instructions.ts` 新增 `CREATE_CHAR_GUIDANCE`，并由 `WRITER_INSTRUCTION` 插入一次。说明必须包含：

1. 先用 `generate_image` 或现有素材准备动作取得 asset 路径；拿到返回的相对路径后才调用 `create_char`。
2. 不把图片 URL、显示标题或 `characters/...` 路径当 `id`；不手写角色目录、manifest、preset。
3. `name` 是自由散文显示名，`desc` 是 README 正文；可选三份资料是角色自己的文件；`voice` 先阅读 `voice-casting` palette 并避开同世界冲突。
4. 成功后不要假定角色已经在运行；打开角色对话由客户端的 `character_start` 按需触发。

现有 Writer 指示要求所有玩家可见内容通过动作写入而不是 bash/raw writes（`extensions/instructions.ts:155-162`）；新段落应把同一纪律具体化为“角色创建必须用 `create_char`，不能用 `createEntity` 或手写 `world.json`”。

## 3. 逐步行为（每一步都说明遗漏后果）

动作实现必须保持“先验证、后写文件、再登记、最后事件”的顺序。任何失败都通过 `ActionError` 抛出，不把失败包装成成功。

### 步骤 0：权限与参数形状

- 工具 shell 先确认原始 `AIRP_AGENT_ROLE === 'writer'`、不可由模型设置的 `AIRP_AGENT_SCOPE === 'writer-top-level'` 且 `agentActor().type === 'writer'`；shared action 通过由服务端启动上下文注入且模型不可修改的 `ctx.agentScope === 'writer-top-level'` 再次守卫，并检查 `ctx.actor.type === 'writer'`。`scene-init`/`nook-init` 的 customTools 列表不得包含此工具。角色 Agent、god、player、unset 或未知 role fallback 不能借用此动作。
- 用 `CreateCharInputSchema.safeParse` 检查必填字段、额外字段、字符串类型和 id 形状；再做动作层需要 I/O 的路径检查。

**漏掉会怎样：** 仅在 shell 检查会让其它入口绕过 Writer-only 约束；仅检查 `agentActor()` 会把 `resolveAgentActor` 的 unset/unknown→writer fallback 错当权限；不检查 scope 或把 `AIRP_TOOLS` 原样塞进 initializer `customTools` 会让继承 Writer 环境的子代理取得 create_char；仅在 schema 检查会把 schema 当作文件存在性检查，导致半成品写入。


### 步骤 1：头像先验

- 调用共享 `assertImageAsset(ctx.store.worldRoot, avatar)`，其允许根固定为 `assets/**` 与 `.airpworld/assets/**`，并完成 realpath/symlink、常规文件与 MIME/扩展名 allowlist 检查。
- 该步骤不得创建角色目录、写 README、写 manifest 或写 preset；头像缺失、非法根、逃逸、类型不符或 MIME/扩展名不一致均统一返回 `ActionError` code `invalid_asset_ref`。

**漏掉会怎样：** 角色会进入 manifest，但 `/api/characters` 返回缺图或不安全媒体，前端再降级到默认肖像，模型误以为“头像已经准备好”；只用 `statKind` 会放过 symlink 逃逸和非图片文件，违反“avatar 先准备再调用”与媒体门禁契约。

### 步骤 2：读取 manifest、建立目标与冲突快照

- 读取 `ctx.store.getManifest()`，确认 `manifest.characters` 没有相同 id。`getManifest` 从 `world.json` 读取并重新扫描层（`packages/shared/src/store/local-store.ts:330-340`），不能把 `layers` 写成第二份持久真相。
- 确认 `characters/{id}` 为 `missing`；若目录、README、任一可选文件或 preset 已经存在，统一返回 `already_exists`，不覆盖已有角色。
- 读取/检查所有同世界角色的 README `voice`：已知 alias/raw 用 `resolveVoice` 得到 canonical wire id；缺失或未知声明按服务器默认音色处理。新角色若省略 `voice`，不能与任何默认音色角色并存；若提供 voice，不能与任何同 canonical id 的已知声明并存。创建动作不替旧角色修音色，已有坏值应作为 `invalid_field_value` 阻断并指出冲突文件。[推断]
- 计算显示名与默认归属：`home` 使用 `manifest.entry`（仅当该 id 存在于已派生 `manifest.layers`，否则使用稳定的 `map`），`role` 默认 `npc`。输入没有 home/role，不能偷偷依赖 Agent 当前层；`ActionContext` 只有 store、actor、turn、now、rng（`packages/shared/src/actions/types.ts:5-23`）。

**漏掉会怎样：** 只检查 README 会留下旧 preset 或半个目录；不检查 manifest 会造成目录存在但 sidebar 不可发现；不做全世界 voice 扫描会把默认音色碰撞留到 TTS 才静默发生；将当前层当 home 会把没有对应输入字段的上下文依赖写入持久数据。

### 步骤 3：组装 README 与角色文件内容（内存中）

README 使用统一 serializer，不手拼 YAML fence：

```ts
stringifyFrontmatter(
  {
    type: 'readme',
    name: displayName,
    avatar,
    ...(voice === undefined ? {} : { voice }),
  },
  desc,
)
```

`stringifyFrontmatter` 的行为是用 YAML 输出 frontmatter，并把 body 紧跟在结束 fence 后（`packages/shared/src/schemas/frontmatter.ts:241-255`）。README 的 `name` 是显示名，目录和 manifest 的 `id` 仍是稳定 id；`avatar` 在 README 与 manifest 中写同一相对路径，令 `/api/characters` 的 README 覆盖逻辑得到一致值（`apps/server/src/routes/world.ts:910-956`）。

可选文件分别使用输入正文，不补 frontmatter：

- `characters/{id}/identity.md`
- `characters/{id}/personality.md`
- `characters/{id}/memory.md`

**漏掉会怎样：** 把 `desc` 放 frontmatter 会使 profile/前端 bio 与正文分离；手写 YAML 会重现 serializer 已修复的转义问题；把显示名当目录名会破坏稳定 id 与角色启动路由；把可选资料合并进 README 会让角色 preset 无法按文件粒度读取。

### 步骤 4：从平台 `presets/character.json` 派生世界侧 preset

扩展层通过平台文件提供模板，动作层不硬编码第二份提示词。平台文件当前是 `id: "character"`、`name: "Character"`，有 `character-instruction`、`tools`、`tool-guidelines`、`skills`、`chat-history` 五个 items（`presets/character.json:1-5,15-44`），并有 compaction overrides 与 character Agent 的工具 deny 列表（`presets/character.json:6-31`）。

创建时深拷贝模板并只做以下变换：

1. `id` 改为新角色 id，`name` 改为 displayName，`description` 改为 desc 或其短摘要；保留 `schemaVersion`、`hiddenOverrides`、`tools` 等平台骨架。
2. 在**倒数第二个 items 位置**插入共同契约中的 `profile` slot；对于当前五项模板，就是插在 `skills` 后、`chat-history` 前：

   ```json
   {
     "kind": "slot",
     "id": "profile",
     "slot": "file",
     "options": {
       "path": ["README.md", "identity.md", "personality.md", "memory.md"],
       "baseDir": "characters/{id}",
       "stripFrontmatter": true,
       "onMissing": "skip"
     }
   }
   ```

   写出时 `{id}` 必须替换为已通过 `isValidCharacterId` 的 id，例如 `characters/ada-lovelace`；模板中不得留下可由 Agent 控制的任意路径。
3. 原模板若没有至少一个尾部 item，视为 `malformed_entity`，不能猜测 profile 应插在哪里；当前平台模板尾部是 `chat-history`（`presets/character.json:42-44`）。
4. 写为 `characters/{id}/preset.json`。世界现有角色的 preset 已证明同一结构（`templates/whitechapel/characters/blackburn/preset.json:1-55`），但这是结果示例，不是新的模板来源。

**漏掉会怎样：** 直接复制会得到 id 为 `character`、且没有 profile 的角色；把 profile 追加到末尾会让它位于 chat history 后，违反共同契约；复制时深改原对象会污染同一 Agent 进程下的后续创建；让 `{name}` 来自用户路径会再次打开任意路径写入。

### 步骤 5：写角色目录文件
文件、manifest、preset、事件由**单一 `create_char` ActionService 写事务编排**，但不能声称 SQLite event 与 filesystem 跨介质真正原子。唯一的 owner 是 `WorldStore.withCharacterCreationWriteLock(characterId, work)`；它使用共享 history SQLite 的 `BEGIN IMMEDIATE` 作为跨进程单写锁（不是进程内 `Map`），并把角色 id 写进 journal：

```ts
export interface CharacterCreationTransaction {
  stageBundle(files: ReadonlyMap<string, string>): Promise<void>;
  commitBundleAndManifest(updates: Partial<WorldManifest>): Promise<void>;
  appendSuccessEventOnce(args: AppendEventArgs, key: string): Promise<WorldEvent>;
}

// NEW member of the existing WorldStore interface.
withCharacterCreationWriteLock<T>(
  characterId: string,
  work: (tx: CharacterCreationTransaction) => Promise<T>,
): Promise<T>;
```

`LocalWorldStore` 是该 API 的唯一实现 owner：锁内写 `.airpworld` staging/journal（目标清单、manifest 快照、event key），先完成角色 bundle 与 manifest 的原子 rename，再尝试 `appendSuccessEventOnce`，最后写 committed marker 并清理 journal。`createChar` 必须在这一个 callback 内完成步骤 2 的同 id preflight、profile/preset 组装、全部文件写入、manifest 校验和事件请求；不能在锁外 preflight 后才进入锁，也不能绕过 tx 直接调用 `updateManifest`/`appendEvent`。

跨进程并发语义：所有进程对同一 worldRoot 共享 SQLite 锁；同 id 请求串行并由锁内重读 manifest/目标目录后，后者得到 `already_exists`；不同 id 也按 history DB 的写锁串行，避免两个 manifest rename 互相覆盖。锁释放由 SQLite rollback/commit 保证，进程崩溃不会留下持有的 SQLite 锁；journal 仍由 reconciliation 处理。

SQLite 与 filesystem 无法跨介质同一 commit，必须明确 crash window：① staging/manifest commit 前崩溃→下次清理 staging，无 event；②角色目录已 rename、manifest 未 rename→按 journal 回滚目录；③ manifest 已提交、event 尚未提交→保留已提交 manifest，保留 pending journal，当前 action/UI 不发成功通知，恢复流程按 event key 补写一条；④ event 已提交、marker 未写→恢复按 `(type, subject, turn, detail)` 检查，避免重复 event 后补 marker；⑤ marker 已写→清理 journal。恢复失败保留 journal，并让 reconcile 返回可观测 `event_failed`/`write_failed`，绝不静默丢失。

`reconcileCharacterCreationJournals(): Promise<void>`（NEW，owner `LocalWorldStore`；在 server world activation 与 agent `worldStore` 首次可用前调用）先处理这些窗口，再允许把角色列表当作完成事实。`GET /api/characters` 可能在窗口③看到 manifest，但 App 只能在已提交 `entity_created` 的唯一 WS tail 后刷新；没有 success event 的状态不得被 chrome 乐观呈现。

**漏掉会怎样：** 仅单文件 atomic 或进程内 `Map` 仍会产生跨进程竞态；不在锁内重读会让两个同 id 调用都通过 preflight；没有 journal/reconciliation 会让 crash 后角色永远“文件有、事件无”；把跨介质流程称作真正 atomic 会让恢复与验收假绿。


### 步骤 6：登记 world manifest

构造：

```ts
{
  id,
  name,
  home: chosenHome,
  role: 'npc',
  avatar,
  description: desc,
}
```

将它 append 到既有 `manifest.characters`，在步骤 5 的 transaction 中交给 `tx.commitBundleAndManifest({ characters: nextCharacters })`；该提交仍必须沿用 `WorldManifestSchema` 校验、更新时间戳和排除派生 `layers` 的规则（现有 `updateManifest` 的事实为 `packages/shared/src/store/local-store.ts:357-370`），但不能在 tx 外独立写 `world.json`。不要把角色目录塞进 `layers`；`characters/**` 不是层（`packages/shared/src/store/local-store.ts:588-598`）。

**漏掉会怎样：** 只有目录没有 manifest 时，`GET /api/characters` 只迭代 manifest 数组（`apps/server/src/routes/world.ts:915-956`），角色不会出现在侧栏；把角色当层会让 `/api/layer`、层扫描和 nook 语义相互污染；绕过 tx 直接写 manifest 会绕过 Zod 校验、`updatedAt` 和回滚日志。


### 步骤 7：追加一个已有类型的世界事件

在同一个 transaction 的最后阶段 append **恰好一个** `entity_created`：

```ts
tx.appendSuccessEventOnce({
  type: 'entity_created',
  actor: ctx.actor,                 // 必须是 { type: 'writer' }
  detail: {
    path: `characters/${id}/README.md`,
    name,
    kind: 'other',                  // 角色 bundle 不是普通 canvas component
    summary: `character ${id} registered`,
  },
  subject: `characters/${id}/README.md`,
  layer: undefined,                 // resolveLayer 对 characters/** 返回 null
  turn: ctx.turn,
}, `create-char:${id}:${ctx.turn}`)
```

这是对“无 `character_created` 事件”的诚实处理：`WORLD_EVENT_TYPES` 是封闭列表，目前只有 `entity_created` 等 15 种类型（`packages/shared/src/schemas/events.ts:3-28`），detail 的 `kind` 也只允许 `chalk|component|note|letter|other`（`packages/shared/src/schemas/events.ts:42-48`）。不新增伪造的 `character_created`，也不把 manifest 写入冒充事件。`entity_created` 的 `layer` 为 null 是正确的，因为角色小天地不属于层树（`packages/shared/src/store/local-store.ts:588-598`）。

正常路径只有 filesystem bundle 与 manifest rename 完成、success event append 返回已提交后才返回 `details.event`；SQLite/filesystem 不跨介质原子，崩溃可能暂时留下“manifest 已提交、event pending”，此时只由 journal reconciliation 补写，action/UI 不把它当成功。若 append、manifest 或文件任一步在正常调用中失败，按 transaction recovery 后抛 `event_failed`/`write_failed`，details 只报告可验证的恢复结果，不返回成功或重复重试。

**漏掉会怎样：** 不落事件会让现有唯一 WS/历史 tail 不知道角色出现，前端不会按现有事件链重取 sidebar；自造 `character_created` 会被严格 schema 拒绝，或让没有 renderer 的事件静默丢失；事件先于文件提交会让消费者看到一个尚不存在的角色；没有 journal 时的 manifest/event crash window 会变成无记录半成功。


## 4. 文件与副作用清单

### 必写文件

- `characters/{id}/README.md`：frontmatter 含 `type: readme`、显示 `name`、`avatar`、可选 `voice`；正文就是 `desc`。
- `characters/{id}/preset.json`：平台 `presets/character.json` 的深拷贝/变体，id 与 profile `baseDir` 已绑定新 id。
- `world.json`：在既有 `characters[]` 末尾登记一项；`layers` 不持久化。

### 条件写入

- `characters/{id}/identity.md`
- `characters/{id}/personality.md`
- `characters/{id}/memory.md`

### 明确不做

- 不复制头像到角色目录；manifest/README 引用调用者提供的路径。
- 不写 `.airpworld/assets`，不触发图像模型，不上传 URL。
- 不创建 canvas card、footprint、presence 或 nook 生活物品。
- 不创建 character session，不启动 character Agent，不改变 Writer 现有 session。
- 不调用通用 `createEntity`；该动作的目标路径若为 README 会被它拒绝（`packages/shared/src/actions/create.ts:54-83`），且它只接受一个 Markdown 文件并只登记普通 `entity_created`（`packages/shared/src/actions/create.ts:86-147`）。

## 5. 状态、事件与 WS 闭环

### 创建时状态真相

- 文件是角色资料真相；`world.json.characters[]` 是发现/展示与 home/role 的 manifest；`.airpworld/` 只保存 preset 安装副本、canvas/history/session 等系统状态。
- `CharacterConfigSchema` 当前要求 `id`、`home`，但 `avatar`、`name`、`role`、`description` 都可选，且完全没有 `voice`（`packages/shared/src/schemas/world.ts:17-25`）。因此 create_char 必须在专用 schema/action 中把 avatar 提升为必填，并把 voice 保存在 README frontmatter，而不是擅自改写通用 CharacterConfigSchema。
- `world.json` 更新不是角色事件；唯一事件是上述 generic `entity_created`。动作返回的 `details.event` 是该已提交事件。

### 发现与前端重取

`GET /api/characters` 从 manifest 枚举角色，读取角色 README 覆盖 avatar/avatarVideo/bio/voice，并在缺 avatar 时降级默认头像（`apps/server/src/routes/world.ts:910-956`）。因此成功事件经现有 history tail 推成 `world_event` 后：

1. `useWorld` 对 `entity_created` 做去重、转发并重取当前层（`apps/web/src/state/useWorld.ts:410-449`）。
2. App 已监听 `airp:world-event` 并重新加载 manifest/backpack/characters（`apps/web/src/App.tsx:217-233,325-329`）。
3. 新角色进入角色列表，可由现有角色卡打开；本动作不新增 WS frame、不新增第二条 socket、不在前端拼角色状态。

这里依靠 `entity_created` 的既有消费者，不声称前端已经认识 `character_created`。

刷新阻断：前端不能根据 tool result 乐观插入角色；只有 `entity_created` 已提交并经现有唯一 WS tail 推出后，App 才重新请求 `/api/characters`。若 transaction 返回 `event_failed`，不得发出成功事件或合成新角色，避免 UI 先显示一个没有历史落账的角色；下次 chrome/world fetch 仍以 manifest 为准。

### public nook 与角色配置门禁


角色创建写入的 `README.md`、`identity.md`、`personality.md`、`memory.md` 都是 Character profile 配置，不是玩家可见的 nook items；public projection 必须过滤四者。当前 `nookCardPaths` 只过滤 `README.md`（`packages/shared/src/rules/characters.ts:56-69`），因此落地时必须同步扩展该共享过滤器，而不是让 create_char 把配置复制到另一套隐藏数据。

四个根配置可以在真实事实基础上编辑，但不能被 `write`、`edit`、`move`、`delete` 移除或移动；现有 `move.ts`/`delete.ts` 只明确阻止 README（`packages/shared/src/actions/move.ts:90-103`、`packages/shared/src/actions/delete.ts:71-99`），没有覆盖其余三份配置。create_char 自身只新增文件，但动作层统一门禁必须在 Character Skill 装载前落地；否则角色 Agent 能看到“可删配置”的工具提示而实际权限不一致。nook-init 本轮只面向 `characters/{id}`，本设计不引入 `player` stronghold。

### 按需启动与 preset/session 关系

- 角色可发现不等于角色已启动。用户打开角色时，现有 WS `character_start` 触发 `lifecycle.startCharacter`；启动失败沿既有 `{ type: 'error', source: 'character', characterId, message }` 返回（`apps/server/src/index.ts:183-202`）。
- `characterLaunch` 优先读取 `characters/{id}/preset.json`，否则回退 repo 的 `presets/character.json`，然后调用 `installPreset` 把它复制到世界 `.airpworld/prompt-presets/`（`apps/server/src/engine/launch.ts:141-180`）。pi-rp 的 `--preset` 只接受 preset id；仅把世界侧文件留在角色目录不会被发现，必须走安装步骤（`apps/server/src/engine/presets.ts:22-39`）。create_char 写好自己的 preset 后，下一次按需启动自然命中角色专属骨架。
- 旧角色处理必须按现状诚实区分：`characters/{id}/preset.json` 存在时才可能由 profile slot 读取四份根配置；没有 world-side preset 时 `characterLaunch` 回退平台 generic，而 generic `presets/character.json` 没有 profile，故不会加载 identity/personality/memory。已有 preset 但缺 optional 文件时由 profile 的 `onMissing:'skip'` 跳过，不伪造空 memory。README 缺 `voice` 时 `/api/characters` 不返回 voice，TTS 解析层使用 server default；create_char 的同世界 collision 扫描必须把这种缺失（以及当前 TTS 会回 default 的未知值）计入 default，不能宣称“未填写即无音色”。
- 启动使用 `characters/{id}` 的 cwd 语义和 `char-{id}.jsonl` session 路径（`apps/server/src/engine/launch.ts:152-185`）。创建动作不删除、不重命名、不清空既有 session；已有 session 是否继续由现有引擎/session 语义决定。[推断] 如果旧 id 对应的 session 残留，产品必须明确“同 id 重建是否允许复用旧记忆”；本动作当前通过目标目录冲突拒绝常规重建。
- 现有 `startCharacter` 会先停止同 id 的运行实例再启动（`apps/server/src/engine/lifecycle.ts:213-230`）；create_char 不调用它，避免 Writer 创建角色时产生未请求的进程与 WS 活动。
- `character_start` 当前服务端路径没有先调用 `isValidCharacterId`，而 `characterLaunch` 直接拼接 id（`apps/server/src/index.ts:183-201`、`apps/server/src/engine/launch.ts:152-161`）。落地时必须在 `lifecycle.startCharacter` 或 launch 边界补同一 id gate，防止未由 manifest 选出的 WS 输入成为路径入口；该加固不改变 create_char 的输入契约。

## 6. 错误边界与副作用矩阵

| 情况 | 错误码 | 写入结果 | 说明 |
|---|---|---|---|
| actor 不是 writer | `unsupported` | 无 | 角色 Agent 不能调用；shell 与 action 双守卫 |
| 缺 id/name/desc/avatar、类型错误、额外字段 | `invalid_argument` | 无 | schema 在 I/O 前失败；name 是自由文本，id 才做 lower-kebab 校验 |
| id 不是小写 kebab-case | `invalid_argument` | 无 | 使用 `isValidCharacterId`，不做自动 slug |
| avatar 是 URL/绝对路径/不在 `assets/**` 或 `.airpworld/assets/**`/含 `..`/反斜杠 | `invalid_asset_ref` | 无 | 不沿用前端 `assetUrl` 的宽松 URL 分支 |
| avatar realpath/symlink 逃出允许根、不是常规文件、MIME 与扩展名不一致或不在 PNG/JPEG/WebP allowlist | `invalid_asset_ref` | 无 | create_char.avatar 使用 canonical `assertImageAsset`；通用 `/api/asset` 按 image/video/audio 分流 |

| avatar 不存在或是目录 | `invalid_asset_ref` | 无 | 必须先准备头像；canonical `assertImageAsset` 统一处理，不返回另一个路径错误码 |
| 角色目录、README、preset 或目标可选文件已存在 | `already_exists` | 无 | 禁止覆盖、禁止隐式合并 |
| platform preset 缺 id/items/尾部 item | `malformed_entity` | 无 | 不猜模板结构 |
| voice 不在 alias/raw palette | `invalid_field_value` | 无 | 阻止 TTS 静默回默认 |
| voice 与同世界已有 canonical voice 冲突（含默认） | `invalid_field_value` | 无 | details 给出冲突角色 id/README |
| 原子 transaction 锁竞争或 staging/rename 失败 | `write_failed` | 无已提交 bundle | 释放锁并清理 journal；清理失败进入 details |
| manifest schema 校验失败 | `invalid_argument` | 无已提交 bundle | tx rollback，不追加事件 |
| 事件 append/commit 失败 | `event_failed` | 可能已有 bundle/manifest | 事件只在二者提交后尝试；保留 journal，UI 不发成功通知，启动 reconciliation 按 key 补写一次 |
| 未知运行时异常 | 原样抛出 | 取决于异常点 | shell 的 `fail` 只包装 `ActionError`，其它异常继续抛（`extensions/toolkit/result.ts:17-23`） |

`ActionError` 的“throw = nothing was appended，不能降级成成功”规则见 `packages/shared/src/actions/errors.ts:43-80`。验证和原子 transaction 失败都不得报告成功；只有 transaction 的 recovery journal 在确认 commit/rollback marker 后，才允许释放锁并返回结果。

## 7. 精确代码落点

以下是实现期的唯一接线表；代码片段中不存在的函数都标为 `NEW`。

### 7.1 Schema（NEW）

**文件：** `packages/shared/src/schemas/create-char.ts`

```ts
export const CreateCharInputSchema: z.ZodType<CreateCharInput> = z.object({
  id: z.string().trim().refine(isValidCharacterId, 'id must be lower-kebab-case'),
  name: z.string().min(1),
  desc: z.string().min(1),
  avatar: z.string().trim().min(1),
  identity: z.string().optional(),
  personality: z.string().optional(),
  memory: z.string().optional(),
  voice: z.string().trim().min(1).optional(),
}).strict();

export type CreateCharInput = z.infer<typeof CreateCharInputSchema>;
```

`avatar` 的世界路径/存在性、同世界 voice collision 不放进 Zod（需要 store 的 action 检查）。若 TypeScript 的 `ZodType` 泛型难以表达 trim 后值，改用普通 `z.object` 导出，不改变运行时契约。


**共享媒体门禁（NEW，不能委托给调用者）：** `packages/shared/src/rules/media.ts` 提供根路径与 realpath/symlink 的共同 gate；`assertImageAsset` 是只针对 `photo.image` 与 `create_char.avatar` 的 image-specific 实现：
```ts
export type AssetMediaKind = 'image' | 'video' | 'audio';
export function isAllowedMediaReference(relPath: string): boolean;
export async function assertImageAsset(
  worldRoot: string,
  relPath: string,
): Promise<void>;
export async function assertAssetReference(
  worldRoot: string,
  relPath: string,
  media: AssetMediaKind,
): Promise<{ absolutePath: string; mimeType: string }>;
```
`createEntity`、`editEntity`、`createChar` 三个受支持入口只要写入或修改 `component: photo` 的 `image`（create_char 对应 `avatar`），都必须调用唯一 canonical `assertImageAsset(worldRoot, relativePath)`；不能只在前端或 `/api/asset` route 检查。`writeChalk` 与模型侧 native `write/edit` 当前不允许产出 photo，必须在写盘前拒绝。非 photo 的 bg、bgVideo、portrait video 与 audio 继续走 `assertAssetReference(..., 'video'|'audio')` 的通用分支。精确现有落点是 `packages/shared/src/actions/create.ts:createEntity`、`packages/shared/src/actions/delete.ts:editEntity`，新落点是 `packages/shared/src/actions/create-char.ts:createChar`。

`/api/asset` 不是 image-only API：它必须保留 bg、bgVideo、portrait video 与 audio 等现有媒体消费者。将 `assetUrl` 扩展为 `assetUrl(path, session, mediaKind)`，所有调用方显式传 `image|video|audio`，服务端 query 必须携带同名 `kind` 并按已知媒体类型分流；各分支共用根路径与 realpath/symlink gate，只有 image 分支执行上述 PNG/JPEG/WebP 检查，video 分支保留现有视频格式门禁，audio 分支保留 `world.ts:274-325` 的世界/平台音频 allowlist 与路径解析。旧调用方必须在同一实现批次迁移，不能以“根据扩展名猜类型”替代调用方声明。

同时在 `packages/shared/src/index.ts` 增加 `export * from './schemas/create-char.js';` 与 `export * from './rules/media.js';`；该 barrel 是 extensions 读取 shared dist 的唯一公开面（`packages/shared/src/index.ts:29-58`）。

### 7.2 Action（NEW）

**文件：** `packages/shared/src/actions/create-char.ts`

```ts
export interface CreateCharDetails {
  id: string;
  nook: string;
  readme: string;
  files: string[];
  avatar: string;
  voice?: string;
  manifestCharacter: CharacterConfig;
  event: WorldEvent;
}

export interface CharacterPresetTemplate {
  schemaVersion?: number;
  id?: string;
  name?: string;
  description?: string;
  items: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface CreateCharInvocation {
  /** Public tool payload; never includes the preset template. */
  input: CreateCharInput;
  /** Explicitly injected by the Writer shell from presets/character.json. */
  platformPreset: CharacterPresetTemplate;
}

/** NEW pure helper: kebab-case id -> display name, without becoming a path id. */
export function characterDisplayNameOf(id: string): string;

/** NEW pure helper: exact profile slot with a tool-safe baseDir. */
export function profileSlotFor(id: string): Record<string, unknown>;

export async function createChar(
  ctx: ActionContext,
  invocation: CreateCharInvocation,
): Promise<ActionResult<CreateCharDetails>>;
```

`CharacterCreationTransaction` 类型和 `withCharacterCreationWriteLock` 成员应落在现有 `packages/shared/src/store/world-store.ts:105-121` 的 `WorldStore` 接口；`packages/shared/src/store/local-store.ts` 实现锁、staging/journal 与 `reconcileCharacterCreationJournals`。action 文件只导入这些 type，并在唯一的 `createActionService.createChar` 调用中使用 `ctx.store.withCharacterCreationWriteLock`；它不能旁路调用现有独立 `updateManifest`/`appendEvent`。


`createChar` 不再使用 process-global preset factory：shell 在本次调用中读取平台 JSON，并通过 `CreateCharInvocation.platformPreset` 显式注入；action 只做纯组装 helper 与世界写入。这样不会给 frozen `ActionContext` 偷加 repoRoot，也不会让一个世界/会话的 preset 污染另一个调用。

导出该 action，并在 `packages/shared/src/index.ts` 增加 `export * from './actions/create-char.js';`。

### 7.3 Action service（现有函数改动）

**文件：** `packages/shared/src/actions/service.ts`

- 在 `ActionService` interface 现有 `createEntity` 行附近（`packages/shared/src/actions/service.ts:68-73`）增加：

  ```ts
  createChar(invocation: CreateCharInvocation): Promise<ActionResult>;
  ```

- 在 `ACTION_METHODS` 中加入字符串 `'createChar'`；注册 handler 时把 `input` 解释为 `CreateCharInvocation`，并调用 `createChar(ctx, invocation)`。`platformPreset` 是 shell 明确放进 invocation 的内部依赖，不是模型可传字段；该 handler 的全部文件/manifest/event 副作用都必须落在 action 的 write-lock/journal 编排内。
- `createActionService` 的绑定循环已遍历 `ACTION_METHODS`（`packages/shared/src/actions/service.ts:121-149`），仍只负责 dispatch；不得在 service 里恢复 process-global preset factory。

这会改变当前冻结方法列表，冲突与回写见 §10；不要在 service 里复制业务逻辑。

### 7.4 Writer tool shell（NEW + 注册）

```ts
import { readFileSync } from 'node:fs';
import { Type } from 'typebox';
import { defineTool, type ToolDefinition } from '@earendil-works/pi-coding-agent';
import {
  AGENT_ROLE_ENV,
  ActionError,
  type CharacterPresetTemplate,
} from '../../packages/shared/dist/index.js';
import { agentActor } from './actor.js';
import { getActionService } from './deps.js';
import { fail, ok } from './result.js';

function loadPlatformCharacterPreset(): CharacterPresetTemplate {
  const source = new URL('../../presets/character.json', import.meta.url);
  return structuredClone(JSON.parse(readFileSync(source, 'utf8')) as CharacterPresetTemplate);
}

function isExplicitWriterProcess(): boolean {
  // agentActor() deliberately falls back to writer for an unset/unknown env;
  // this tool must not turn that fallback into Writer authority.
  return process.env[AGENT_ROLE_ENV] === 'writer' &&
    process.env.AIRP_AGENT_SCOPE === 'writer-top-level' &&
    agentActor().type === 'writer';
}

export const createCharTool: ToolDefinition = defineTool({
  name: 'create_char',
  label: 'Create Character',
  description: 'Writer-only: create a character from a prepared avatar and profile files.',
  parameters: Type.Object({
    id: Type.String({ description: 'ASCII lower-kebab-case character id.' }),
    name: Type.String({ description: 'Free-form prose display name.' }),
    desc: Type.String({ description: 'README.md body.' }),
    avatar: Type.String({ description: 'Existing assets/** or .airpworld/assets/** image path.' }),
    identity: Type.Optional(Type.String()),
    personality: Type.Optional(Type.String()),
    memory: Type.Optional(Type.String()),
    voice: Type.Optional(Type.String()),
  }, { additionalProperties: false }),
  promptSnippet: 'create_char({id, name, desc, avatar, identity, personality, memory, voice}) — optional properties may be omitted; prepare avatar first',
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    if (!isExplicitWriterProcess()) {
      return fail(new ActionError({
        code: 'unsupported',
        message: 'create_char requires AIRP_AGENT_ROLE=writer and AIRP_AGENT_SCOPE=writer-top-level.',

      }));
    }
    try {
      return ok(await getActionService(ctx).createChar({
        input: params,
        platformPreset: loadPlatformCharacterPreset(),
      }));
    } catch (err) {
      return fail(err);
    }
  },
});


`params` 由 TypeBox 约束，shared action 仍必须再次用 `CreateCharInputSchema` 校验；shell 只负责读取平台源、显式注入 invocation 与 actor gate。`loadPlatformCharacterPreset` 的 URL 必须相对于 extension 源文件，不能用 Agent 的 `ctx.cwd`（那是 worldRoot）。每次调用读取并深拷贝模板，不使用 process-global factory；读取失败必须在本次调用前明确为 `internal`/`unsupported`，绝不生成替代 preset。

`isExplicitWriterProcess` 同时检查原始 `AIRP_AGENT_ROLE` 与不可由模型设置的 `AIRP_AGENT_SCOPE`。因为 `resolveAgentActor` 对 unset/unknown role 会 fallback 到 writer（`packages/shared/src/actions/actor.ts:18-45`），只检查 `agentActor().type` 会错误授予权限；原始 role 为 `scene-init`/`nook-init` 或 scope 为 `initializer` 时拒绝。initializer 的 `customTools` 还必须在 `init-command.ts:297-310` 过滤 `create_char`，形成 role+scope+depth 三重前门；不能把继承 literal writer 环境的子代理当成顶层 Writer。

- `apps/server/src/engine/launch.ts:106-138` 的 `writerLaunch` 必须在 Writer 顶层进程注入不可由模型修改的 `AIRP_AGENT_SCOPE=writer-top-level`；scene/nook initializer spawn 使用 `AIRP_AGENT_SCOPE=initializer`。`extensions/toolkit/init-command.ts:297-310` 传给 `customTools` 时必须过滤 `create_char`，不能把 `AIRP_TOOLS` 原样映射；这是即使子代理继承 `AIRP_AGENT_ROLE=writer` 也无法取得工具的 depth/front-door gate。

**文件：** `extensions/tools.ts`

- 顶层 import `createCharTool`。
- 在 `AIRP_TOOLS` 中加入 `{ name: 'create_char', tool: createCharTool }`，让现有 `tool.name` 一致性 guard 继续生效（`extensions/tools.ts:49-87`）。
- 不在此写业务逻辑；该文件明确只注册工具（`extensions/tools.ts:1-16`）。

### 7.5 Manifest 与启动边界（现有函数改动）

- **NEW shared guard prerequisite:** `packages/shared/src/rules/characters.ts` 增加 `characterRootConfigOf(path: string): 'README.md' | 'identity.md' | 'personality.md' | 'memory.md' | null`；generic native `write/edit` 对四个根配置一律拒绝，受信 `edit_character_config` 才按 actor 矩阵允许编辑；`move/delete` 永远拒绝。`nookCardPaths` 原地迁移并过滤四项，所有 callers 一致更新。create_char 仅在自己的 bundle 事务内首次写入这些文件。
- `createChar` 只能在 `withCharacterCreationWriteLock` 唯一编排内通过 transaction 的 manifest writer 更新 `world.json`；不得旁路调用独立 `updateManifest`/`appendEvent`，并按步骤 5 的 SQLite lock、staging、journal reconciliation 处理跨介质崩溃窗口。
- `apps/server/src/routes/world.ts` 的 `GET /characters` 保持既有 shape；`/api/asset` 保持 bg/bgVideo/portrait video/audio 等通用消费者，按媒体类型分流，不能调用 image-only validator 处理全部资产。
- **NEW** `assertCharacterLaunchable(worldRoot: string, characterId: string): Promise<void>` 必须在 `character_start`、`startCharacter` 和 `characterLaunch` 三个边界执行；除 id、目录和 preset/profile 外，必须确认 `characterId` 已存在于 `manifest.characters`，且在任何 preset/session 路径拼接与 stop 之前完成校验。
- Character Skill 装载前必须确认四根配置的 public-nook 过滤及 write/edit/move/delete 门禁已经由动作层安装；未安装时拒绝 Character preset/skill 启动，而不是只靠提示词自律。nook-init 只接受 `characters/{id}`，不提供 player stronghold。
- `characterLaunch` 不需另造 preset installer；保留现有“角色 preset 优先、repo generic fallback、`installPreset` 复制到 `.airpworld/prompt-presets/`”路径。

### 7.6 Instructions（现有文件新增导出）

**文件：** `extensions/instructions.ts`

```ts
export const CREATE_CHAR_GUIDANCE = `

[Creating a character]
Use create_char only when the request is to add a new person to this world.
Prepare the avatar first: call generate_image (or use an already existing
asset under assets/** or .airpworld/assets/**), wait for its returned asset
path, then call create_char({
  id: "ada-lovelace",
  name: "那个在暴雨里捡到戒指的女孩",
  desc: "A mathematician who notices patterns in every room.",
  avatar: "assets/characters/ada-lovelace.webp",
  identity: "I am Ada Lovelace.",
  personality: "Curious, exacting, and generous with patient explanations.",
  memory: "I remember the player's promises.",
  voice: "wise-elder"
}). Omit optional object properties when they are not supplied. Do not pass
a browser URL, a display title, or a `characters/` path as `id`. Do not
hand-write `characters/<id>/` files, `world.json`, or `preset.json`.

`id` is the stable lower-kebab-case path/manifest key. `name` is free-form
display prose and is stored as the README frontmatter display name. `desc`
becomes the README.md body. Read the voice-casting palette before choosing
voice; an omitted voice uses the world default and still collides with another
default voice. A successful result says the character is registered but not
started; the client starts it on demand.
`;
```

将 `${CREATE_CHAR_GUIDANCE}` 插入 `WRITER_INSTRUCTION` 的工具行为段，不能在 `presets/writer.json` 再复制一份正文；平台提示词源已规定由 instructions.ts 提供（`extensions/instructions.ts:53-58`，`presets/writer.json:33-43` 仅声明 slot）。


## 8. 与现状的差异（事实带证据）

1. **现状没有 `create_char`。** `extensions/tools.ts:20-35,49-65` 当前仅注册 look_at、view_canvas、chalk、move_to、move、choose、roll_dice、use_item_on、set_following、link、arrange、delete、get_component、show、generate_image；本设计新增 Writer 专用 shell 和 action。
2. **现状只有通用 `createEntity`。** 它的输入是 `{ path, body?, frontmatter?, content? }`，只允许一个 world-root-relative `.md` 且拒绝 README（`packages/shared/src/actions/create.ts:24-37,54-83`），因此不能完成角色 bundle、manifest、preset 三件套。
3. **现状角色 schema 不够严格。** `CharacterConfigSchema.avatar` 可选且没有 voice 字段（`packages/shared/src/schemas/world.ts:17-25`）；本设计只在 create_char 专用输入/action 强制头像，并把 voice 放 README frontmatter，不误称通用 schema 已支持。
4. **现状平台 preset 与世界 preset 有差异。** 平台 generic id/name 是 `character`/`Character`，items 没 profile（`presets/character.json:1-5,33-44`）；已有 world-side preset 已将 profile 放在 skills 与 chat-history 之间，且 baseDir 指向具体角色（`templates/whitechapel/characters/blackburn/preset.json:34-55`）。本设计定义从前者生成后者，而不是把现有模板当新源。
5. **现状没有专用角色创建事件。** `WORLD_EVENT_TYPES` 无 `character_created`（`packages/shared/src/schemas/events.ts:9-25`）；本设计复用 schema 已支持的 `entity_created`，不新增未配 renderer 的类型。
6. **现状启动是按需而非创建即启动。** WS `character_start` 才调用 lifecycle（`apps/server/src/index.ts:183-202`）；`startCharacter` 先 stop 再 start，preset 由 `characterLaunch` 安装（`apps/server/src/engine/lifecycle.ts:213-230`、`apps/server/src/engine/launch.ts:141-180`）。本设计保留这一点。
7. **现状的 avatar URL 访问较宽松且缺媒体门禁。** `assetUrl` 接受 URL/数据/blob/绝对路径并把其它值转 `/api/asset`（`apps/web/src/App.tsx:101-105`），`/api/asset` 当前只做世界根越界检查（`apps/server/src/routes/world.ts:1311-1332`）；本设计固定 create_char 只接受 `assets/**` 与 `.airpworld/assets/**`，avatar 使用 image-specific `assertImageAsset` 的 PNG/JPEG/WebP 严格门禁，而通用 route 必须保留 bg/bgVideo/portrait video/audio 并按媒体类型分流。


8. **现状 action service 方法列表没有 `createChar`。** `ActionService` 与 `ACTION_METHODS` 当前列到 `createEntity`、snapshot、rollback（`packages/shared/src/actions/service.ts:31-103`）；新增方法必须同步 service、注册表、barrel 与文档索引，不能只在 shell 注册。

## 9. 可执行验收测试

[推断]以下测试建议落在 `packages/shared/test/create-char.test.mjs`（action/schema/event）、`apps/server/test/characters-route.test.mjs`（manifest/asset discovery）和 `apps/server/test/character-launch.test.mjs`（preset/session/on-demand WS）；按仓库现有 node:test 入口执行，不把“工具已注册”当作行为验收。

1. **完整创建闭环（非空性）：** 以 `{id:'ada-lovelace', name:'那个在暴雨里捡到戒指的女孩', desc:'A mathematician notices patterns.', avatar:'.airpworld/assets/gen/ada.webp', identity:'I am Ada.', personality:'Curious and exacting.', memory:'I remember promises.', voice:'wise-elder'}` 调 action；断言四个角色文件 + preset + `world.json.characters[]` 新项存在，README frontmatter.name 与 name 字节一致、body 与 desc 字节一致，manifest id/name/avatar/home/role 正确，preset id 为 ada-lovelace 且最终 `items` 中 profile 位于倒数第二、尾 item 仍是 chat-history，profile `baseDir` 为 `characters/ada-lovelace`；history 只有一条 actor writer 的 `entity_created`，layer 为 null、subject 为 README 路径。没有该实现时，这个测试不能仅靠通用 createEntity 通过。
2. **头像先准备与媒体门禁：** avatar 缺失、是目录、绝对路径、URL、位于其它根、含 `..`、反斜杠、realpath/symlink 逃逸、PNG/JPEG/WebP MIME 与扩展名不一致时，断言对应 `ActionError`；断言角色目录、manifest、preset、history 均不存在。另以 bg、bgVideo、portrait video、audio fixture 请求 `/api/asset`，断言视频与音频仍按各自 allowlist/分支可读，不能被 avatar 的 image-only validator 拒绝。该测试防止“先写后验”、任意 world-root 文件暴露及前端 `assetUrl` 宽松分支被工具误用。


3. **id/name 输入边界：** `Ada-Lovelace`、`ada_lovelace`、`characters/ada`、空 id、空 name、空 desc、额外字段分别失败；合法 id 不因自由显示名推导而改变。
4. **可选资料：** 只给必填四项（id/name/desc/avatar）时只生成 README/preset，不生成 identity/personality/memory；给出每项时内容原样写入。preset profile 的 `onMissing:'skip'` 保持可启动。
5. **voice-casting 与默认音色：** alias 存回 README，raw palette id 也可存回；未知 alias 失败且不写任何文件；与同世界既有 alias/raw canonical 相同失败；新角色省略 voice 时与既有默认角色冲突失败；两个合法不同 alias 可成功。用 `resolveVoice` 的 canonical 结果断言，不用字符串相等替代。
6. **manifest/发现：** 调 action 后请求 `GET /api/characters`，断言新增角色返回 `id/name/avatar/bio/voice`；README 的 avatar/voice 覆盖 manifest 同字段时结果符合现有 endpoint 规则。断言新角色不出现在 `manifest.layers`。
7. **事件与 WS：** 断言没有 `character_created` 行；只有一条 `entity_created`，其 detail 满足现有 schema；通过现有 WS tail 驱动后，`useWorld`/App 的 `airp:world-event` 监听触发 chrome reload，而不新增 socket/frame 类型；tool result 不得直接乐观插入角色。
8. **Writer-only：** 用 actor `{type:'character', id:'watson'}`、`{type:'player'}`、unset/unknown `AIRP_AGENT_ROLE`、`AIRP_AGENT_ROLE=writer` 但 `AIRP_AGENT_SCOPE=initializer` 调 shell/action，均断言 `unsupported` 且无 I/O；只有原始 role 为 `writer` 且不可由模型设置的 scope 为 `writer-top-level` 才可继续。
9. **preset 安装/按需启动：** 创建角色后断言 `.airpworld/prompt-presets/ada-lovelace.json` 尚未出现、character client 尚未启动；发送现有 `character_start` 后断言启动参数使用 world-side preset id `ada-lovelace` 和 `char-ada-lovelace.json` session，并完成安装；平台 generic preset 不会覆盖它。对已有 Writer session 文件做前后 checksum，断言创建动作不改它。
10. **启动输入门禁：** 通过 WS 发送非法或不存在的 `character_start`，断言服务端返回 character error 且不把该 id 拼入 preset/session 路径；合法 manifest 角色仍能启动。该测试对应现状 launch 边界缺少 `isValidCharacterId` 的风险。
11. **写事务失败与 crash recovery 可见：** 注入 staging/lock/manifest 提交失败时，断言错误码分别为 `write_failed`/`invalid_argument` 且未产生事件；模拟“manifest 已提交、event 未提交”崩溃后，断言保留 journal、UI 不产生成功刷新，重启 `reconcileCharacterCreationJournals()` 只补写一条匹配 success event；模拟 event 已提交、marker 未写时不重复事件。测试不得宣称 SQLite/filesystem 真正原子，也不接受静默清理或半成功无记录。
12. **旧角色与 nook 前门禁：** 对没有 world-side preset 的旧角色，断言按现有 generic preset 启动时 profile 文件不会被加载；对有 preset 但缺 optional memory 的角色，断言 `onMissing:'skip'` 而非伪造 memory；public nook 不返回四个根配置，且 write/edit/move/delete 对四者执行统一 actor/path 门禁后再允许 Character Skill 装载。
## 10. 发现的冲突 / 需要回写的上位文档

1. **`00-共同上下文.md` vs `packages/shared/src/schemas/world.ts`：** 共同契约要求 create_char 的 avatar 必填并限制两根媒体根，但 `CharacterConfigSchema.avatar` 可选且无 voice（`packages/shared/src/schemas/world.ts:17-25`）。本设计不私改通用 schema；实现必须在专用 input/action 中执行强制校验与媒体 gate。
2. **`docs/tools/01-动作内核与事件落账.md` action method 表 vs 本设计：** 现有 service/index 只列 `createEntity`（`docs/tools/01-动作内核与事件落账.md:39-55,68-73`、`packages/shared/src/actions/service.ts:68-103`）。新增 `createChar`、`CharacterCreationTransaction` 后必须回写动作索引、工具注册 probe 与 WorldStore 接口，不能只改代码。
3. **事件闭合契约 vs 角色创建通知：** `WORLD_EVENT_TYPES` 没有 `character_created`（`packages/shared/src/schemas/events.ts:9-25`），本设计复用 schema 已支持的 `entity_created(kind:'other')`；上位事件文档必须记录此语义和 `layer:null`，否则实现者会新增未配 renderer 的事件。
4. **preset 平台源 vs 世界 preset 示例：** `presets/character.json` 没有 profile，而已有 world-side preset 才有角色 baseDir/profile（`presets/character.json:33-44`、`templates/whitechapel/characters/blackburn/preset.json:34-55`）。[推断]上位 prompt/preset 文档应将“平台源 → id/name 替换 → 倒数第二插入 profile → world-side 文件 → launch install”冻结为唯一链路。
5. **Writer-only 工具与全局注册：** `extensions/tools.ts` 会把工具注册给进程（`extensions/tools.ts:49-87`），现有 `resolveAgentActor` 对 unset/unknown role fallback writer（`packages/shared/src/actions/actor.ts:18-45`）。工具必须同时检查原始 `AIRP_AGENT_ROLE=writer` 与不可伪造的 `AIRP_AGENT_SCOPE=writer-top-level`，action 仍检查 actor；不能只依赖工具呈现或 `agentActor().type`。
6. **媒体现状与新门禁：** `assetUrl` 接受绝对 URL（`apps/web/src/App.tsx:101-105`），`/api/asset` 目前只做世界根越界检查（`apps/server/src/routes/world.ts:1311-1332`）；本设计已固定 avatar 的 `assets/**`/`.airpworld/assets/**`、realpath/symlink、常规文件和 PNG/JPEG/WebP MIME/扩展名 allowlist。shared root gate 与 image-specific gate 必须接入 create_char 及受支持的 `component: photo` createEntity/editEntity；writeChalk 与 native write/edit 对 photo 必须在写盘前拒绝。通用 route 则按 image/video/audio 分流并保留 bg/bgVideo/portrait video/audio 回归。
7. **启动门禁缺口：** 当前 `character_start`→`startCharacter`→`characterLaunch` 未显示调用 `isValidCharacterId`（`apps/server/src/index.ts:183-202`、`apps/server/src/engine/launch.ts:152-161`）。应回写 lifecycle/launch 设计，在停止既有角色或拼接 preset/session 路径前同时检查 id、`manifest.characters` membership、角色目录和 preset/profile。
8. **nook 配置保护缺口：** 共同契约要求 public nook 过滤四个根配置，generic native write/edit 默认拒绝，唯一配置编辑入口是 `edit_character_config({ characterId, file, content, mode })`，Character 仅自身 memory、Writer 可编辑 `manifest.characters` 中任一已登记角色四项，move/delete 永久拒绝；当前实现仍需在 `world-context.ts` native tool_call 与 action 层接入统一门禁。nook-init 只允许 `characters/{id}`，不支持 player stronghold。
9. **现有动作没有跨文件事务：** `writeFileAtomic` 只保证单文件（`packages/shared/src/store/local-store.ts:172-191`），`updateManifest` 与 `appendEvent` 当前分别提交（`local-store.ts:357-370,419-468`）。本设计要求唯一 `withCharacterCreationWriteLock` 的 staging/journal、恢复 marker 和 reconciliation，但明确不宣称跨介质真原子；必须回写动作内核的 WorldStore 接口与测试契约，不能保留无记录半成功。
10. **旧角色的 generic preset/profile 与 memory：** `characterLaunch` 对已有 `characters/{id}/preset.json` 盲选，否则回退没有 profile 的 generic preset（`apps/server/src/engine/launch.ts:141-161`、`presets/character.json:33-44`）。上位 launch/preset 文档必须说明旧角色缺 preset 时不会自动加载 identity/personality/memory；创建的新角色必须携带 world-side profile，不能把 generic fallback 当已修复。
## 11. 仍未知、待拍板

1. **默认 home：** [推断]本设计建议使用 `manifest.entry`（无效则 `map`），因为输入没有 home 且 ActionContext 不带当前层；产品是否要新增可选 `home`/`role` 输入，必须在冻结契约中决定，不能让实现偷偷取当前层。
2. **旧角色坏 voice 的处理：** 新建角色会把缺失或未知 voice 按真实 TTS 默认计入 collision 并保守阻断；是否允许管理员先修旧 README 再创建，或提供单独修复动作，需 voice-casting/治理流程拍板。
3. **事件 detail 的 kind：** 本设计用 schema 允许的 `other` 表示角色 bundle；若历史面板需要角色专属显示，必须另行设计可渲染 detail/事件，不可把枚举私自扩成 `character`。
4. **旧 session 复用：** 同 id 角色目录不能正常重建，但残留 `char-{id}.jsonl` 的清理/迁移策略尚未定义；create_char 不应删除历史，需产品决定保留提示、人工清理或独立 reset。
