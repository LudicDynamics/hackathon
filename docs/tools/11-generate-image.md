# doc-tools/11 generate_image

当前接线：OpenAI-compatible 图片请求由项目内 `extensions/toolkit/image-openai-provider.ts` 实现 `ImageProvider`，不依赖 pi-rp 的图片注册表补丁。`AIRP_IMAGE_MODEL=openai/<model>` 选用此路径，`AIRP_IMAGE_BASE_URL`（回退 `OPENAI_BASE_URL`）、`OPENAI_API_KEY`、`AIRP_IMAGE_QUALITY` 保持兼容。单张 PNG Base64 输出；参考图走 multipart edits；不自动重试、不跟随重定向。适配器支持取消、超时（默认 120 秒），但工具到 action 的取消信号仍未贯通，不能宣称整轮已支持中断。OpenRouter 路径不变。协议依据：[官方 Images 文档](https://developers.openai.com/api/docs/guides/image-generation)。模拟测试：`node --test tools/image-openai-provider.test.mjs`。

> 状态：**设计（2026-09-12）**，待评审。本文只写设计，不改任何代码、不改现有文档。
> 权威层级：`00-共同上下文.md`（冻结契约）> `doc-21` > `doc-20` > `doc-10` > `doc-19` > 本文。
> 关联：`00 §2.2/§2.5/§4.2/§5.2/§6.2`；`doc-20 §1/§10/§12`；`doc-21 §1（准入三问）/§3.6（失败不落）/§4.1`；`doc-05 §7.4（渲染路由）/§8（目录结构）`；`doc-10 E0（bg 不是 asset）/E1（bg 是 README 字段）`；`doc-02 §4.2（幻影物件：座位过户）`；`doc-19 §5（AI 游戏工坊）`；`后端实现计划 §4（B1 工具面）/§12（降级预案）`；`前端改造计划 T3.8/§12`。
> **本文的输入形状服从 `01 §5` 第 16 行（已与 01 对齐）**：`{ prompt, style?, width?, height?, path?, reference? }`，无 `size`，且**不落事件**。

---

## 1. 一句话与定位

**`generate_image` 把一句描述变成一张落盘到 `.airpworld/assets/gen/` 的图片文件，并把"这张图现在在哪"作为稳定路径交回给调用者——它自己不是一条世界事件；让世界发生变化的永远是紧接着写那个 `bg:` 的 `editEntity`。**

它在 `doc-20` 里的位置：`doc-20 §1.1` 能力表最后一行——`get_component / show / generate_image` 对作家与角色**都不裁**，归"组件创作、一次性演出和生图"。`doc-05 §3.2` 把它归为"叙事辅助"三件套之一；`doc-18 §2.1` 把它的返回归为 **L5「叙事辅助返回」**（`doc-05 §9.1`）。

三个调用者，与全部 AIRP 工具同构（`01 §1`）：

| 入口 | 调用者 | 进程 | 什么时候用 |
|---|---|---|---|
| A 动作层工具 | 作家 agent / 角色 agent（`extensions/toolkit/generate-image.ts` 薄壳） | agent 进程 | 场景需要一张还没有的图：立绘、手绘线索、场景底图、通缉令素描 |
| C 玩家 UI 路由 | `apps/server/src/routes/world.ts` | server 进程 | **本阶段不接线**（§8）；AI 游戏工坊（`doc-19 §5`）将来走这里 |
| E 引擎 | 无 | — | — |

**它不是 `chalk`**：`chalk` 写的是世界里的一段叙事（`entity_created` + `kind:'chalk'`），`generate_image` 产出的是一份**二进制资源**，位于 `00 §2.2` 定义的系统目录 `.airpworld/` 之下——**系统目录不是世界内容**。这条区别决定了本文后面几乎所有的取舍（§5 不落账、§7 的失败文案、§11 的冲突登记）。

---

## 2. 签名与参数

### 2.1 动作层（`packages/shared/src/actions/generate-image.ts`）

```ts
export interface GenerateImageInput {
  /** What to depict. Natural language, any script (Chinese is expected and fine). */
  prompt: string;
  /** Style suffix appended to the prompt (e.g. 'pencil sketch', 'sepia watercolor'). */
  style?: string;
  /** Requested pixel width. Provider may snap to its own aspect buckets. */
  width?: number;
  /** Requested pixel height. */
  height?: number;
  /** World-relative path of an existing asset to use as a source image (img2img / edit). */
  reference?: string;
  /** Optional: the world path this image is intended to be attached to. NOT written by this action. */
  path?: string;
}

export interface GenerateImageDetails {
  /** Stable path for the next action. ALWAYS under `.airpworld/assets/gen/`. */
  asset: string;
  /** The prompt actually sent, after `style` was appended. Self-sufficient for the model. */
  caption: string;
  provider: string;      // e.g. 'openrouter'
  model: string;         // e.g. 'google/gemini-2.5-flash-image'
  mimeType: string;
  bytes: number;
  width: number;         // requested size, post-defaults
  height: number;
  reused: boolean;       // true when this exact request had already produced this file
  elapsedMs: number;
  attachTo?: string;     // echo of input.path
}

// 01 §5 row 16 — input field names frozen by 01:
export function generateImage(
  ctx: ActionContext,
  input: GenerateImageInput
): Promise<ActionResult<GenerateImageDetails>>;
```

**字段语义与默认值**

| 字段 | 必需 | 类型 | 默认 | 语义 / 边界 |
|---|---|---|---|---|
| `prompt` | ✅ | `string` | — | 1–2000 字符（`trim` 后）。空串或全空白 → `invalid_argument`。**不做语言检测**：中文提示词是预期输入 |
| `style` | — | `string` | 无 | 以 `', '` 拼到 `prompt` 尾部得到 `caption`。**只拼一次**，不套模板、不加前后缀——"style" 是提示词措辞，不是引擎的滤镜名（引擎不认识任何风格枚举，§11 冲突 6） |
| `width`/`height` | — | `number` | 各 `1024` | 整数，`256 ≤ v ≤ 4096`。**只传一个时另一个保持默认**（不强制等比）。`0`/负数/浮点 → `invalid_argument`。**两个值都进 hash**（§4.2），所以"同 prompt 不同尺寸"是两张图 |
| `reference` | — | `string` | 无 | 世界根相对路径，MUST 落在 `.airpworld/assets/` 下、MUST 存在、且当前模型 `input` 能力含 `image`。不存在 → `not_found`；在 `world/`/`player/` 下 → `invalid_path`（那是世界内容，不是资源）；模型不支持图输入 → `unsupported` |
| `path` | — | `string` | 无 | 见 §2.2。**本动作只校验、不写** |

### 2.2 `path` 参数：保留它，但它不是"输出路径"

`01 §5` 冻结了这个字段，它是**给调用者的一个便利断言**，不是输出覆盖。三种情形：

| `path` 的值 | 动作做什么 |
|---|---|
| 省略 | 纯生成。返回 `details.asset`，调用者自己决定怎么用 |
| 指向 `*.md`（如 `world/baker-street/README.md`） | **只校验**：必须存在、必须是 `00 §2.4` 允许的实体（不是目录、不在 `.airpworld/` 下）。返回时 `details.attachTo = path`。**不写那个文件** |
| 其它（不以 `.md` 结尾） | `invalid_argument`——`path` 只表达"这张图打算挂到哪个实体上"，不表达"把图存到哪" |

**为什么不接受输出路径覆盖**：`00 §2.2/§2.5` 把 `.airpworld/` 划成系统目录、"任何工具都不遍历它"。若允许 writer 自选文件名，`bash` 就能与它抢同一个绝对路径，而 `04-*` 的 `move`/`delete` 完全看不见这些文件。**输出路径由引擎决定、内容由 hash 决定**，是让这堆文件保持可推导的唯一办法。

**为什么返回 `attachTo` 而不是直接改 `bg:`**：直接改 README 会让 `generate_image` 在"不落事件"的前提下悄悄改了世界内容（§5）——那正好违反 `doc-21 §1` 的准入第 2 问的边界。挂图是一步独立的、会落账的动作，必须由 `editEntity` 执行。

### 2.3 工具层（`extensions/toolkit/generate-image.ts`）

```ts
pi.registerTool({
  name: 'generate_image',
  label: 'Generate Image',
  description:
    'Generate an image from a text prompt and save it into this world\'s asset directory. ' +
    'Use it for art the world does not have yet: a scene backdrop, a portrait, a hand-drawn clue, ' +
    'a wanted poster. It returns the asset path — point a layer README\'s `bg:` field at that path ' +
    '(with edit) so the scene shows it. ' +
    'Do NOT use it for text content (use chalk) or to restyle something that already exists. ' +
    'If no image model is configured this tool fails loudly and tells you so; do not retry.',
  promptSnippet: 'Generate an image asset for the world from a text prompt',
  promptGuidelines: [
    'Use generate_image when a scene needs a picture that does not exist yet; then edit the layer README `bg:` field to point at the returned asset path.',
    'Do not repeat the same prompt, style and size — the second call reuses the first file and still costs a turn.',
  ],
  parameters: Type.Object({
    prompt: Type.String({ description: 'What the image should depict.' }),
    style: Type.Optional(Type.String({ description: 'Style words appended to the prompt, e.g. "sepia ink sketch".' })),
    width: Type.Optional(Type.Integer({ minimum: 256, maximum: 4096, description: 'Width in pixels. Default 1024.' })),
    height: Type.Optional(Type.Integer({ minimum: 256, maximum: 4096, description: 'Height in pixels. Default 1024.' })),
    reference: Type.Optional(Type.String({ description: 'World-relative path of an existing asset to use as a source image.' })),
    path: Type.Optional(Type.String({ description: 'Optional world-relative .md path this image is meant to be attached to.' })),
  }),
  async execute(toolCallId, params, signal, onUpdate, ctx) { /* §6.2 */ },
});
```

**文本一律英文**（`00 §6.2` / `AGENTS.md §1.1`）。description 写"做什么、何时用、何时别用"（`doc-23`），并显式写 no-model 时不要重试——`doc-03 §3.4`「拒绝话术 = 转告 + 不重试」在工具面的落地。

**`width`/`height` 用 `Type.Integer`**：像素是整数，schema 层先挡浮点，省一次 `invalid_argument` 往返。

---

## 3. 行为契约（逐步）

### 3.1 与 `01 §3.1` 五步骨架的四处差异

1. **第 3 步之外多一个外部副作用**：provider 调用不可回滚，排在"校验之后、落盘之前"。
2. **没有第 4 步（落账）**。见 §5。
3. **落盘用二进制变体**：`01 §2.7` 已把 `writeFileAtomic` 放宽到 `string | Buffer`。
4. **第 5 步的 `details` 不含 `event`**（`01 §2.2` 为无事件动作保留的可选字段）。

### 3.2 编号步骤（每步写"漏了会怎样"）

1. **解析输入。** `prompt` trim 后非空且 ≤2000；`width`/`height` 补默认、范围与整数校验；`style` trim（空串按未传）；`path`/`reference` 过 `00 §2.1` 路径纪律。
   *漏了会怎样*：`prompt:""` 会拿回一张随机图再落盘——花了钱、落了文件、还说不清是什么；`width:99999` 会在 provider 侧返 400，报错文本与"参数非法"混在一起分不清是谁的错。

2. **校验 `reference`（若传）。** 必须落在 `.airpworld/assets/` 下、必须存在、必须在当前模型 `input` 能力内。读取用 `store.readFileBase64`（`01 §2.7` 新增；`readFile` 是 utf-8 only，见 `local-store.ts:70-72`）。
   *漏了会怎样*：`reference: world/baker-street/evening.md` 会把一篇叙事当图片喂给 provider；不校验就发现不了"我引用的是世界内容"这个语义错误。

3. **解析 provider（§4.3）。** `resolveImageProvider()` 返回 `null` → **立即** `fail('unsupported', <§7 文案>)`，**在花任何钱之前**。
   *漏了会怎样*：先拼参数、先读 reference，最后才发现没配模型——reference 的读失败会冒充"模型不可用"，两种完全不同的补救动作被合成一句话。

4. **生成主体，带超时与取消。** 调 `provider.generate(req, { signal, timeoutMs })`。有 `onUpdate` 时按 §6.2 分档推流。`signal.aborted` 在开始前与返回后各查一次。
   *漏了会怎样*：图像模型动辄 5–30s，没有取消通道时玩家按 Esc 也停不下来，那一轮会一路跑到 `lifecycle.ts:28` 的 `DEFAULT_TURN_TIMEOUT_MS = 90000` 兜底被杀——白等一分半，而且报的是 "runaway turn"，与"生图慢"无关。

5. **收结果、归一化。** `AssistantImages.stopReason`（`ai/src/types.ts:470`）三态分派：`'stop'` → 取 `output` 中第一个 `type:'image'` 块（`ImageContent`，`types.ts:354`）；`'aborted'` → `internal`；`'error'` → `internal`。`output` 里**没有 image 块**（模型只回了文字）→ 也 `internal`，但文案与网络失败不同（§7）。
   *漏了会怎样*：`stopReason:'error'` 被当成成功、`data` 为 `undefined`，落盘写出 0 字节文件，前端 `<img>` 静默失败——`doc-03 §3.3` 说的"假装成功"最贵的那种。

6. **落盘：二进制原子写。** `outputPathFor(...)` 得到路径；文件**已存在** → 不重写、`reused=true`（§3.3）；否则 `store.writeFileAtomic(asset, Buffer.from(b64,'base64'))`。
   *漏了会怎样*：非原子写时 agent 被 kill 会留下半张 PNG；`<img>` 能解码一部分——前端不报错，只是"画错了一半"。最隐蔽的一类脏数据。

7. **返回（不落账）。** `text` 是英文人话，**必须带完整 asset 路径**（`00 §6.2`）；`details` 见 §2.1。
   *漏了会怎样*：模型只看到 "Image generated."，下一步 `edit` README 的 `bg:` 时就会瞎写路径，或者重写一遍同一个请求的图。

### 3.3 幂等与重复调用

同一 `caption + model + width + height + reference` 第二次调用**不重复生成**：`outputPathFor()` 是纯函数，第二次得到同一路径，文件已存在 → `reused: true` 直接返回。

- **不是静默降级**：`text` 明说 `Reused the existing asset …`（§7.4），`details.reused = true`。
- **不是缓存层**：没有缓存表、没有缓存目录、没有 TTL。判据只有"这个名字的文件在不在"，而名字是请求内容的 hash——文件即真相。
- **模型不确定性不破坏正确性**：文件名只承诺"这是对这句提示词的产物"，不承诺唯一产物。要换结果就得改提示词或尺寸——**"再抽一次"没有语义**，`doc-20` 全套工具无此先例。
- **`reference` 进 hash**：同提示词 + 不同参考图 = 不同请求 = 不同文件。

---

## 4. 文件与副作用

### 4.1 落盘位置

```text
<worldRoot>/
└── .airpworld/                        # 00 §2.2 系统目录
    └── assets/
        └── gen/                       # 本工具的唯一输出目录，扁平、不分子目录
            ├── fog-over-baker-street-sepia-ink-sketch-3f9a2c1d84b7e506.png
            └── lady-adler-portrait-ink-88b0d1e7f3a24c59.png
```

- **不按层分目录**：图片一旦生成就与"哪一层"无关了（同一张通缉令可被两层引用、可被 `move` 搬走、可被回滚换掉）。按层分目录会让"引用到别层"变成一次文件搬移，凭空造出 `move` 的第二语义。
- **不建索引文件**：没有 `manifest.json`、没有 `index.md`、没有 sidecar `*.meta`。任何记录"这张图是什么"的旁路文件都是第二个真相源（`doc-20 §2.3` 绝对禁区）。
- **`.gitignore` 不用改**：`.gitignore` 只忽略 `.airpworld/*.db*` 与 `.airpworld/prompt-presets/`，`assets/` 不在内。世界打包（`doc-15:35` 的 `.airpworld.zip`）会带上生成的图——**符合预期**，`doc-05 §8.1` 把图片归"内容层（真相）"。

### 4.2 命名约定（冻结）

```ts
// packages/shared/src/actions/generate-image.ts
export const GENERATED_ASSET_DIR = '.airpworld/assets/gen';

/** Deterministic, ASCII-only, kebab-case slug from an arbitrary-script prompt. */
export function assetSlug(prompt: string): string;   // 1..32 chars; literal 'image' when no ASCII alnum survives

/** SHA-256 over the request descriptor, truncated to 16 hex chars (64 bits). */
function requestKey(r: { caption: string; model: string; width: number; height: number; reference?: string }): string;

/** The ONE place an output path is decided. Pure. */
export function outputPathFor(r: {...}): { asset: string; ext: string };
```

- **文件名** = `<slug>-<requestKey>.<ext>`；`ext` 由 provider 返回的 `mimeType` 决定（`image/png`→`png`、`image/jpeg`→`jpg`、`image/webp`→`webp`；未知 mime → `png` 并 warn 一行）。
- **`slug` 的来源与退化**：取 `prompt` 里的 `[A-Za-z0-9]` 连续段、kebab 连接、截 32 字符。**中文提示词会得到空 slug** → 落到字面量 `image`。**这是刻意的**：`AGENTS.md` 要求产物命名一律 ASCII kebab-case，逐字音译中文需要维护一张表（成本 > 收益），而 `requestKey` 已保证唯一性——slug 是给人看的，不是给机器用的。
- **16 hex（64 bit）的理由**：8 hex（32 bit）在几百张图的世界里碰撞已不可忽略（生日界 ~2^16 次请求），而碰撞的后果不是报错、是**把 B 图当成 A 图复用**——静默串味，最难查的一类 bug。64 bit 把概率压到可忽略（~2^32 次请求），文件名仍可读。不做全 64 位 hash：没有好处，只有丑。

### 4.3 provider 抽象（**可实施方案**——本节是本文的核心交付之一）

#### 4.3.1 事实基线：pi-rp **有**图模型，AIRP **没接**

| 事实 | 证据 |
|---|---|
| pi-ai 有完整图像生成面 | `vendor/pi-rp/packages/ai/src/images.ts:14` `generateImages()`；`images-models.ts:227` `createImagesModels()`；`images-api-registry.ts` 注册表 |
| 内建图像 provider 只有一个：**OpenRouter** | `providers/images/register-builtins.ts` 只注册 `"openrouter-images"`；`providers/all.ts:144` `builtinImagesProviders()` = `[openrouterImagesProvider()]` |
| 图像模型目录有 **45 个** | `image-models.generated.ts`（`grep -c 'id:'` = 45）：`black-forest-labs/flux.2-*`、`google/gemini-2.5-flash-image`、`google/gemini-3-pro-image`、`openai/gpt-image-1`、`qwen/qwen-image-3`、`recraft/recraft-v4*`、`bytedance-seed/seedream-*` 等 |
| 认证走 `OPENROUTER_API_KEY` | `providers/openrouter-images.ts`（`envApiKeyAuth(…, ["OPENROUTER_API_KEY"])`）；`env-api-keys.ts:94` |
| **扩展能 import 到它** | loader 的 jiti alias 把 `@earendil-works/pi-ai` 指到 `ai/dist/compat.js`（`extensions/loader.ts:119-133`），compat 逐字导出图像面（`ai/src/compat.ts:24-29`）；alias 也含 `@earendil-works/pi-ai/providers/all`（`loader.ts:123` → `ai/dist/providers/all.js`），它导出 `builtinImagesModels()`（`providers/all.d.ts:25-27`） |
| AIRP 侧**零接线** | 全仓 `generate_image` 命中只有文档；`extensions/` 只有一个 `instructions.ts`、**没有任何 `registerTool`**（`00 §9`）；`.pi/agent/models.json` 里**没有** openrouter provider、没有 `OPENROUTER_API_KEY` |

**结论：现状是"引擎有能力、项目没配置"。** 所以本工具的设计不是"等模型接进来"，而是**把 provider 当成一个可注入的端口，引擎侧的实现今天就能写**。

#### 4.3.2 端口定义（`packages/shared/src/actions/image-provider.ts`，新增）

```ts
/** A resolved image-generation port. The action layer knows nothing about pi-rp. */
export interface ImageProvider {
  readonly id: string;                   // for details.provider, e.g. 'openrouter'
  readonly model: string;                // the model id actually used
  readonly supportsReference: boolean;
  generate(
    req: { prompt: string; width: number; height: number; reference?: { dataB64: string; mimeType: string } },
    opts: { signal?: AbortSignal; timeoutMs?: number }
  ): Promise<
    | { ok: true; mimeType: string; dataB64: string }
    | { ok: false; reason: ImageFailureReason; message: string }
  >;
}

export type ImageFailureReason =
  | 'no_provider' | 'no_credentials' | 'provider_error' | 'timeout' | 'aborted' | 'policy' | 'no_image';

/** Process-level service locator. See §11 conflict 7 for why this is NOT an ActionContext field. */
export function registerImageProviderFactory(factory: () => ImageProvider | null): void;
export function resolveImageProvider(): { provider: ImageProvider | null; reason: ImageFailureReason | null };
export function resetImageProviderForTests(): void;
```

**为什么端口在 `packages/shared`、实现在 `extensions/`**：`packages/shared` 的依赖只有 `zod`（`packages/shared/package.json`），`tsc -b` 构建，**不能** import pi-rp（会把 vendored 大树拖进 server/web 的构建图，且 web 是 vite 打包）。`extensions/` 是 jiti 直跑 TS，天然能 import pi-rp。所以：**动作层只认接口，实现由工具壳在加载时注册**。这条缝同时满足"两侧同源"：server 侧将来要在 AI 游戏工坊里用（`doc-19 §5`），自己注册工厂即可；不注册就拿 `unsupported`，**不会假装成功**。

#### 4.3.3 配置面（冻结：三个环境变量）

| env | 必需 | 默认 | 语义 |
|---|---|---|---|
| `OPENROUTER_API_KEY` | 有模型时必需 | 无 | 由 pi-rp 的 auth 解析读走（`env-api-keys.ts:94`）。**AIRP 不自己读它**，只读下面的开关 |
| `AIRP_IMAGE_MODEL` | — | `openrouter/google/gemini-2.5-flash-image` | `<provider>/<modelId>`。provider 段今天只可能是 `openrouter`；modelId 必须在 `IMAGE_MODELS.openrouter`（45 个之一），否则 `unsupported` + 附可用 id 列表（§7） |
| `AIRP_IMAGE_TIMEOUT_MS` | — | `60000` | 单次 provider 调用的硬超时。**必须 < `lifecycle.ts:28` 的 `DEFAULT_TURN_TIMEOUT_MS = 90000`**，留 30s 给落盘与写作收尾 |

**默认模型的理由**：`google/gemini-2.5-flash-image` 是目录里明确的"flash/便宜/快"档图像模型，且 `input: ["text","image"]`（支持 `reference`）。**这是可实施的选择，不是拍脑袋**：换 `flux.2-max` 只改一个 env。`[推断]` 具体延迟与单价需赛时用真实 key 实测（§12）。

**`OPENROUTER_API_KEY` 从哪来**：`.pi/agent/models.json` 现有三个自定义 provider（`GG` / `tokenrhythm` / `generalcompute`），**没有** openrouter。所以要么赛前在 `models.json` 加一个 openrouter 条目，要么走 `launch.ts` 的 `airpEnv()`（`presets.ts:54`）透传进 agent 进程 env。**推荐后者**（§11 冲突 8）：`airpEnv()` 是 `00 §3` 明写的"唯一注入点"，且不必把 key 落进仓库内文件。

#### 4.3.4 引擎侧实现（`extensions/toolkit/image-pi-provider.ts`，新增）

```ts
import { builtinImagesModels, getImageModel } from '@earendil-works/pi-ai/providers/all';
import type { ImageProvider } from '../../packages/shared/dist/index.js';

/** Build the pi-rp-backed port. Returns null (not throws) when unconfigured —
 *  "no model" is a normal state of this repo, not an exception. */
export function createPiImageProvider(env: NodeJS.ProcessEnv = process.env): ImageProvider | null {
  const raw = env.AIRP_IMAGE_MODEL ?? 'openrouter/google/gemini-2.5-flash-image';
  const [providerId, ...rest] = raw.split('/');
  const modelId = rest.join('/');
  if (providerId !== 'openrouter') return null;                // today's only built-in image provider
  const model = getImageModel('openrouter', modelId);          // ai/src/image-models.ts
  if (!model) return null;
  return {
    id: 'openrouter',
    model: modelId,
    supportsReference: model.input.includes('image'),
    async generate(req, opts) {
      if (!env.OPENROUTER_API_KEY) return { ok: false, reason: 'no_credentials', message: '…' };
      const models = builtinImagesModels();                    // providers/all.ts:149
      const res = await models.generateImages(
        model,
        { input: [{ type: 'text', text: req.prompt }, ...(req.reference ? [imgBlock(req.reference)] : [])] },
        { signal: opts.signal, timeoutMs: opts.timeoutMs }
      );
      // stopReason is the ONLY truth channel — generateImages never rejects.
      ...
    },
  };
}
```

实现要点（全部有源码依据）：

- **调用形状**：`ImagesContext.input` 是 `(TextContent | ImageContent)[]`（`ai/src/types.ts:463-468`）；OpenRouter 实现把它映射成 OpenAI `content` 数组 + `modalities:['image','text']`（`api/openrouter-images.ts::buildParams`）。
- **`generateImages` 从不 reject**（`images-models.ts` 的契约注释与实现：任何异常都变成 `{stopReason:'error', errorMessage}`）。所以 `generate()` **必须**显式检查 `stopReason`，不能靠 try/catch。
- **取图**：`AssistantImages.output` 里 `type:'image'` 的块 `{ data: base64, mimeType }`（`api/openrouter-images.ts` 从 `data:` URL 拆出）。**只认 `data:` URL**——若 provider 哪天返回 http URL，这里会拿到空 output → `no_image`（§7），**不会静默落一个坏文件**。
- **`aborted`**：`options.signal.aborted` 时 `stopReason='aborted'`。`signal` 从工具壳透传（`ToolDefinition.execute` 第 3 参），**不进动作层**（`01` 拒绝给 `ActionContext` 加字段）。
- **内容审核**：OpenRouter 侧表现为 HTTP 4xx/403 且 `errorMessage` 非空，或（某些模型）`stopReason:'stop'` 但 output 无图。映射到 `policy` 还是 `provider_error`，由 `message` 是否命中 `/content[\s_-]?policy|safety|moderation|flagged/i` 决定——**这是启发式，登记在 §12**。

#### 4.3.5 赛时用什么：**评估与推荐**

| 方案 | 可实施性 | 延迟 | 风险 | 结论 |
|---|---|---|---|---|
| **A. OpenRouter 图像 API（走 pi-rp 内建）** | ⭐⭐⭐⭐⭐ 引擎已实现，只差一个 key | 3–15s `[推断]` | 网络；审核；额度 | **推荐：主路径** |
| B. 本地模型（ComfyUI / SD.cpp） | ⭐⭐ 要写新 `ImageProvider` + 起本地服务 + GPU（本机 `i7-7700HQ` **无独显** → CPU 生图几十秒到几分钟） | 30s–min | 演示不可接受 | **不推荐** |
| C. 预置图库（`templates/*/.airpworld/assets/` 预放图，工具挑选返回） | ⭐⭐⭐⭐ 零依赖、零延迟 | 0 | 不是实时生图，`doc-19 §5` 的"3 秒落地"卖点丢一半 | **降级路径**（`后端实现计划 §12` 明写 `generate_image` 可降级为预置图库） |

**推荐：A 为主 + C 为降级，且降级必须由配置显式开启、不许自动发生。**

- 主路径：赛前配 `OPENROUTER_API_KEY` + `AIRP_IMAGE_MODEL`。
- 降级路径：新增 `AIRP_IMAGE_LIBRARY_DIR`（默认 `<worldRoot>/.airpworld/assets/library`）。**只在该 env 被显式设置时才生效**，且注册的是一个**不同的 provider**（`id:'library'`）——`details.provider='library'`、`text` 明说 `Served from the preset library; no model was called.`。**绝不把"没模型"自动变成"给张库存图"**，那正是 `doc-03 §3.3` 说的假装成功。
- **现在要不要做库 provider？** 不做。它是 20 行代码，但要先有内容（`前端改造计划 §12` 的资产清单里那些文件**目前不存在**，§11 冲突 2）。本文给接口与开关，实现在 `后端实现计划 §12` 的降级触发时才落地。

### 4.4 与世界的引用关系（`type: asset` / README `bg` / 正文图片）

**这张图怎么变成玩家看得见的东西**——三条路，推荐度递减：

| 路 | 怎么写 | 前端怎么读 | 推荐 |
|---|---|---|---|
| **① 场景底图（首选）** | `editEntity('world/<layer>/README.md', { frontmatter: { bg: '.airpworld/assets/gen/xxx.png' } })` | `routes/world.ts:40 readLayerBg()` 从 README frontmatter 取 `bg`（`:205`）→ `GET /api/layer` 的 `bg.src` → `SceneBackdrop.tsx:63` `<img src="/api/asset?path=…">` | ✅ **唯一今天就能跑通的路**：链路两侧都已存在 |
| ② 正文内嵌 | chalk/note 正文写 `![caption](.airpworld/assets/gen/xxx.png)` | **需要 md 图片渲染器把相对路径改写成 `/api/asset?path=`**——`apps/web/src/lib/` 今天**没有** `md.tsx`（只有 `audio/camera/collide/fm/seat`），也没有任何 `<img>` 处理正文图片 | ⚠️ 需前端补一个小渲染器（~15 行）；不补则是一条"看不见的引用" |
| ③ `type: asset` md + `ref:` | 写 `background.md`：`type: asset` + `ref: .airpworld/assets/gen/xxx.png` | **没有渲染器**：`forms.ts:36 cardKindOf()` 不认 `type:'asset'`（落到 `note`），`CARD_FORMS`（`forms.ts:26`）没有 `asset` 条目 | ❌ **不要用**。`doc-05 §7.4` 的这行与 `doc-10 E0`（"bg 不是 `type: asset`，是 README 的 frontmatter 字段"）直接冲突且前端从未实现——§11 冲突 3 |

**推荐链路（同时写进工具的 `text` 与 promptGuidelines）**：

```text
generate_image({ prompt: 'Baker Street at dusk, fog, gas lamp', style: 'sepia ink sketch', width: 1536, height: 1024 })
  → details.asset = '.airpworld/assets/gen/baker-street-at-dusk-fog-gas-lamp-sepia-ink-sketch-3f9a2c1d84b7e506.png'
  → editEntity({ path: 'world/baker-street/README.md', frontmatter: { bg: '<that path>' } })
  → entity_edited 落账（README → kind:'gate'），前端重取 /api/layer，底图换掉
```

**于是落账发生在第二步、不在第一步**——第二步是 `editEntity` 的职责（`04-*` 已拥有 `entity_edited` 的 `kind` 派生与引用重写），`generate_image` 不重复它。

### 4.5 写盘原子性

- 一律 `store.writeFileAtomic(relPath, Buffer)`（`01 §2.7`：同目录 tmp + `rename`，失败时原文件不动、失败抛错）。
- **新文件也走原子写**：`01 §3.1` 说"新建文件可直接 `writeFile`"，这里刻意统一——**同一路径可能已存在**（§3.3 的幂等复用里"存在"是常态而非例外），代码只有一条分支，不会出现"第二次生成走了另一条写路径"的分裂。
- **不写 `gen/` 之外的任何文件**：不碰 `world.json`、不碰 README。

---

## 5. 落账

### 5.1 定案：**`generate_image` 不落任何事件**

| 字段 | 值 |
|---|---|
| `type` / `actor` / `subject` / `layer` / `turn` / `detail` | — |
| 失败时是否落 | **否**（`doc-21 §3.6`；不适用 `layer_init_failed` 例外） |

**依据链**（三层，任一层都足够）：

1. **准入第 1 问（`doc-21 §1`）**：它改变的是 `.airpworld/assets/` 下的一个二进制文件，而 `.airpworld/` 是 `00 §2.2/§2.5` 定义的系统保留目录——**"任何工具都不遍历它"**、`look_at` 也过滤它。系统目录里的文件不是世界内容，不是"世界变了"。
2. **准入第 2 问（`doc-21 §1`）**：光看世界目录**推得出来**。`look_at` 一个层只会看到 README 的 `bg:` 值——那个值指向哪个文件，一眼可见；图片本身不需要事件解释。
3. **`detail` 自足性（`doc-21 §3.3`）**：`entity_created.detail` MUST 带 `path` + **当时的 `name`**。一个 `.airpworld/assets/gen/*.png` 没有可渲染的 `name`（它的"名字"是提示词，不是实体标题），硬造一个就是在污染事件口径。

**世界可见的变化由调用者落账**：真正让画布变样的是紧随其后的 `editEntity(README, {bg})` → `entity_edited`（`kind` 由 `04-*` 的派生规则给出，README → `gate`）。`04-*` 已覆盖"文件被改过"这件事，**不需要为同一件事再造一个 `asset_created`**（`doc-21 §4` 是封闭枚举；`doc-21 §0` 定案 3 明确反对"身份×动作"的叉乘类型）。

> **与 `01` 的裁决一致**（`01 §5` 第 16 行、以及 01 的评审回合）：`generate_image` 不落事件。

### 5.2 `kind` 枚举没有 `asset`：**按设计解决，不是冲突**

`00 §5.2` / `doc-21 §4.1` 的 `entity_created.kind` 是 `"chalk" | "component" | "note" | "letter" | "other"`，**没有 `asset`**。初看像冲突，**实际不是**：

- 那个枚举是**实体分类**，而按 §5.1 生成物根本不是实体。
- 若某天真要落一条"某实体挂了一张图"的事件，那条事件的 `kind` 是**被挂的那个实体的 kind**（README → `gate`，note → `note`）。`other` 是给"注册表认不出的真实实体文件"用的兜底——**不为资源文件拓宽它**，也不建议改枚举（与 `01` 一致：`kind:'other'` 只为真实实体文件存在，资源按构造就在实体分类法之外）。

### 5.3 但——**"系统目录里的文件"仍需被前端感知**

这是"不落账"的直接后果，必须显式处理：`00 §5.3` 要求 server 的 watcher **继续过滤 `.airpworld/assets/`**，所以**资源写盘不产生 `file_changed`**。于是"图刚生成好、底图要换"这件事的唯一通道是**工具返回值 `details` → pi-rp `tool_execution_end` → server `onEvent` → `mapEngineEvent` 的演出帧**（§6.3）。这正是 `00 §1` 那条硬约束的用法："扩展不能直连 WS，只能靠返回值 `details` 或落事件。"

---

## 6. WS 与前端

### 6.1 `details` 里带什么（稳定字段，`00 §6.2`）

```jsonc
{
  "asset": ".airpworld/assets/gen/baker-street-at-dusk-…-3f9a2c1d84b7e506.png",
  "caption": "Baker Street at dusk, fog, gas lamp, sepia ink sketch",
  "provider": "openrouter",
  "model": "google/gemini-2.5-flash-image",
  "mimeType": "image/png",
  "bytes": 812344,
  "width": 1536,
  "height": 1024,
  "reused": false,
  "elapsedMs": 6120,
  "attachTo": "world/baker-street/README.md"   // only when the caller passed `path`
}
```

`details` **不含 `event`**（无事件），也**不含图片 base64**（§6.4）。

### 6.2 `onUpdate` 流式进度（长任务）

`ToolDefinition.execute(toolCallId, params, signal, onUpdate, ctx)` 的第 4 参（`types.ts:542`）就是进度通道；`onUpdate` 收 `AgentToolResult`（`agent/src/types.ts:361`）——**同一形状，只是部分结果**。

**分档推送（工具壳里做，不牵扯动作层）**：

| 时刻 | `content[0].text` | `details.stage` |
|---|---|---|
| 进入 execute、provider 已解析 | `Generating image (openrouter/google/gemini-2.5-flash-image)…` | `'resolving'` |
| provider 调用发出后 | `Image model is drawing… 1536×1024` | `'generating'` |
| 每 10s 心跳（`setInterval`，`unref()`） | `Still drawing… 20s elapsed.` | `'generating'` + `elapsedMs` |
| 收图、写盘前 | `Saving asset…` | `'saving'` |
| 终值（不是 `onUpdate`） | §3.2 第 7 步的 `text` | — |

**心跳必须存在**：`doc-03 §6` 可借鉴清单第 2 条「预判焦虑并解答」——"画面不动是正常的，不是卡住了"（适用场景明写"异步、慢、静默的操作"）。没有心跳时，一张 20s 的图在 TUI 与前端上都表现为"卡死"。

**约束**：`onUpdate` 在 promise settle 之后被忽略（`agent/src/types.ts:377-383` 注释），所以**所有 `onUpdate` 调用必须在 `await generate()` 期间发出**；`setInterval` 在 `finally` 里 `clearInterval` + `unref()`，否则进程退不出去。

### 6.3 server 侧映射（归 `12-*` 落地，本文定形状）

`mapEngineEvent()`（`apps/server/src/engine/event-bridge.ts:34-100`）今天**没有 `tool_execution_update` 分支**（`switch` 只有 `message_update` / `message_end` / `tool_execution_start` / `tool_execution_end` / `agent_settled`），所以进度帧会被丢掉。需要 12 加两处：

```ts
// event-bridge.ts::mapEngineEvent — 演出帧与事件 type 不共用命名空间（00 §5.3）
case 'tool_execution_update': {
  if (event.toolName === 'generate_image') {
    const d = (event.partialResult as any)?.details ?? {};
    push({ type: 'image_generation_progress', source, toolCallId: event.toolCallId,
           stage: d.stage, elapsedMs: d.elapsedMs, width: d.width, height: d.height });
  }
  break;
}
// tool_execution_end 分支内追加（紧跟现有 chalk/write、link/arrange 两段）
if (event.toolName === 'generate_image') {
  const d = (event.result as any)?.details ?? {};
  push({ type: 'image_landed', source, toolCallId: event.toolCallId,
         asset: d.asset, mimeType: d.mimeType, width: d.width, height: d.height, reused: !!d.reused });
}
```

**两条帧**：

| 帧名 | 何时 | 前端演什么 |
|---|---|---|
| `image_generation_progress` | `tool_execution_update` | **幻影物件**（`doc-02 §4.2` 的原文，及 §7.1 可借鉴清单第 10 条）：占位卡按正常入座算法排座、渲染在纸面层、shimmer 骨架 + `stage` 文案；用户可直接拖幻影=指定这张图落哪 |
| `image_landed` | `tool_execution_end` 且 `!isError` | **座位过户**：幻影卡换壳（真图 `/api/asset?path=<asset>`）、影深变化、**座位不变**（`doc-10 E3` 的"幻影座位=成品座位"） |

**失败时**（`isError:true`）：不推 `image_landed`；幻影卡由前端在 `tool_end` 帧上淡出（`event-bridge.ts:74` 已有 `tool_end` + `isError`）。**失败不留半成品**（`doc-10 E3` 的 `cancelPerformance` 纪律）。

**为什么用 `tool_execution_update` 而不是事件**：进度是**传输帧**——`doc-21 §1.1` 第一行"world_delta / tool_start / chalk_writing / writer_idle = 传输帧（演出用，瞬时），只走 WS，不落库"。生图进度属于同一类。

**关于 `image_landed` vs `chalk_landed`**：`event-bridge.ts:81-87` 现在对 `chalk`/`write` 推 `chalk_landed`。生图**不改 md**，`chalk_landed` 的语义（"一段文字上墙了"）不适用；单列一个帧名，让前端能区分"上墙的是字"与"上墙的是图"。

### 6.4 为什么 **不** 把图片本身塞进 `details` / tool result

pi-rp 支持工具结果带 `ImageContent`（`normalizeToolResultImages`，`utils/tool-result-images.ts:22`；`ToolResultMessage.content` 是 `(TextContent|ImageContent)[]`，`ai/src/types.ts:447`），所以**技术上**可以把 base64 图直接回给模型"看一眼"。

**不做**，三个理由：

1. **它会把图灌进会话历史与之后每一次 provider 请求**（`tool-result-images.ts` 的注释原话："go straight into session history and every subsequent provider request"）。生成图通常在 1–3 MB，一张就能把作家上下文顶爆，而且**永远删不掉**（历史不可变）。
2. **模型不需要看它**：`generate_image` 的产物要被**玩家**看到，不是被作家点评。作家需要的是路径（用来写 `bg:`）。`doc-05 §0` 的"叙事文本是唯一主角，其余全是修饰和呈现辅助"（`:12`）在这里同样成立。
3. **想看图走 `view_canvas`**：那是专门的视觉回路（`03-*`），有它自己的截断与降采样策略。一条通道只干一件事。

**因此**：`details.asset` 是文字路径，前端用 `/api/asset?path=` 取图（`routes/world.ts:459` 的 `GET /api/asset`，`SceneBackdrop.tsx:57/63` 已在用）。

---

## 7. 错误与边界

### 7.1 失败模式总表（`isError:true` + 可读英文原因，绝不静默降级）

| 触发 | `ActionError.code` | HTTP | 精确英文文案（`text` / `error`） | 落事件 | 可重试 |
|---|---|---|---|---|---|
| `prompt` 空/超长 | `invalid_argument` | 400 | `generate_image needs a non-empty prompt (max 2000 characters).` | 否 | 改参数 |
| `width`/`height` 非法 | `invalid_argument` | 400 | `width must be an integer between 256 and 4096.` | 否 | 改参数 |
| `path` 不以 `.md` 结尾 | `invalid_argument` | 400 | `path must be a world .md file the image is attached to, or omitted; the asset path is chosen by the engine.` | 否 | 改参数 |
| `reference` 在世界内容区 | `invalid_path` | 400 | `reference must point into .airpworld/assets/; '{p}' is world content, not an asset.` | 否 | 改参数 |
| `path` 指向的实体不存在 | `not_found` | 404 | `attach target '{p}' does not exist; generate the image first, then write the entity.` | 否 | 先建实体 |
| `reference` 不存在 | `not_found` | 404 | `reference asset '{p}' does not exist.` | 否 | 改参数 |
| **没有图像模型** | `unsupported` | 501 | `No image model is configured for this world, so generate_image cannot run. Tell the player this in their language — the scene must be described in text or drawn as chalk instead. Do not retry this tool.` | 否 | **不要重试** |
| 配了 model id 但不在目录里 | `unsupported` | 501 | `AIRP_IMAGE_MODEL='{raw}' is not a known image model. Available: {first 8 ids}, …; set AIRP_IMAGE_MODEL or leave it unset. Do not retry.` | 否 | 改配置 |
| 有模型但缺 key | `unsupported` | 501 | `Image model '{model}' is configured but has no API key. Set OPENROUTER_API_KEY and restart, then try again. Do not retry in this turn.` | 否 | 配好后重试 |
| 模型不支持 `reference` | `unsupported` | 501 | `Model '{model}' cannot take a source image; call generate_image without `reference`. Do not retry with the same reference.` | 否 | 去掉参数 |
| provider 超时 | `internal` | 504 | `The image model did not answer within {n}s. The world is unchanged; you may describe the picture in prose instead. Do not retry immediately.` | 否 | 谨慎 |
| 玩家/引擎取消 | `internal` | 499 | `Image generation was cancelled; nothing was written.` | 否 | — |
| provider 报错 | `internal` | 502 | `The image model failed: {provider message}. The world is unchanged. Do not retry more than once.` | 否 | 一次 |
| 内容审核拦截 | `internal` | 400 | `The image model refused this prompt ({reason}). Rewrite the prompt to describe the scene without the refused content; do not resend the same prompt.` | 否 | **改提示词** |
| 模型只回文字没回图 | `internal` | 502 | `The image model returned no image for this prompt. The world is unchanged; try a different, more concrete prompt.` | 否 | 改提示词 |
| 写盘失败 | `write_failed` | 500 | `Could not write the generated asset: {reason}. The world is unchanged.` | 否 | 看磁盘 |

**"没有图像模型"的确切行为（本档最重要的一行）**：`unsupported` + 上面那句 + **`details` 里带 `{ reason: 'no_provider', configHint: 'Set AIRP_IMAGE_MODEL and OPENROUTER_API_KEY' }`**。工具**不**返回占位图、**不**返回一个凭空编造的路径、**不**退回预置图库（除非 `AIRP_IMAGE_LIBRARY_DIR` 显式设置，§4.3.5）。

**为什么文案里要写"Tell the player … / Do not retry"**：`doc-03 §3.4` 的定案——拒绝话术是**给用户的转告 + 不重试指令**，不是技术错误。让模型原话转告，玩家才知道"这个世界现在画不了图"，而不是看到一个工具名。

**为什么用 `unsupported` 而不是新枚举值**：`01 §2.4` 冻结的 `ActionErrorCode` 里 `unsupported` 的定义正是"legal but not built in B1"，"没有配置图像模型"完全落在这个定义里。不新增枚举值 = 不改冻结契约（见 §11 冲突 5 与 §12 待评审第 3 条）。

### 7.2 超时与取消的分工

| 层 | 机制 | 值 |
|---|---|---|
| 动作层 `provider.generate` | `AIRP_IMAGE_TIMEOUT_MS` → `ImagesOptions.timeoutMs`（`ai/src/types.ts:159`，OpenRouter 实现透传给 OpenAI SDK） | 默认 60000ms |
| 工具壳 | 透传 `execute` 的 `signal` | 玩家 Esc / 引擎 abort |
| 引擎兜底 | `lifecycle.ts:28` `DEFAULT_TURN_TIMEOUT_MS = 90000`，`agent_start` 起算（`lifecycle.ts:153-154`） | 90000ms |

**三层的关系**：60s < 90s，所以正常路径上 provider 一定先超时并给出"模型没答"的准确文案，而不是被引擎当成"runaway turn"糊掉（`lifecycle.ts:165` 的 warn 文案与"生图超时"是两回事）。**这是刻意的排序，不是巧合**——它写进 `AIRP_IMAGE_TIMEOUT_MS` 的注释里。

### 7.3 边界（不做）

- **不写 README / 不改任何实体**：挂图是调用者的一步（§5.1）。
- **不落事件**：§5.1。
- **不做图生文字 / 不做视觉理解**：那是 `view_canvas`（`03-*`）的领域，本工具只出图。
- **不做多图批次**：一次一张。批量是调用者循环，工具面保持单次一致（`doc-20` 全套工具没有批量参数）。
- **不改尺寸二次裁剪**：provider 返回什么尺寸就是什么尺寸；`details.width/height` 是**请求值**，标注为"requested"。`[推断]` 是否要读回真实像素尺寸取决于是否引入 `image-size` 依赖，见 §12。

### 7.4 成功文案（也定死，避免各写一套）

```text
// 新生成
Generated '.airpworld/assets/gen/baker-street-at-dusk-…-3f9a2c1d84b7e506.png' (1536×1024, 812 KB).
Point a layer README's `bg:` field at this path to put it on the canvas.

// 幂等复用
Reused the existing asset '.airpworld/assets/gen/…-3f9a2c1d84b7e506.png' (same prompt, style and size).
```

两句都**带完整路径**（`00 §6.2`："返回后续动作需要的稳定路径"），第二句明说"复用"，不给模型"再试一次"的理由。


---

## 8. 要实现/修改的代码落点（精确到文件与函数）

### 8.1 新增

| 文件 | 导出 | 职责 |
|---|---|---|
| `packages/shared/src/actions/generate-image.ts` | `generateImage(ctx, input)`、`GenerateImageInput`、`GenerateImageDetails`、`GENERATED_ASSET_DIR`、`assetSlug`、`outputPathFor`、`requestKey` | 动作主体：校验 → 解析 provider → 生成 → 原子落盘 → 返回。五步骨架的 1/2/4/5/6 步（第 3 步是 §4.3 的 provider 调用） |
| `packages/shared/src/actions/image-provider.ts` | `ImageProvider`、`ImageFailureReason`、`registerImageProviderFactory`、`resolveImageProvider`、`resetImageProviderForTests` | 端口 + 进程级注册表。**零依赖**（不 import pi-rp、不 import 任何 store） |
| `extensions/toolkit/generate-image.ts` | 一个 `ToolDefinition` 常量（由 `extensions/tools.ts` 注册） | 工具壳：`resolveAgentActor` / `createActionService` / `onUpdate` 分档 / `ActionError.toToolResult()` |
| `extensions/toolkit/image-pi-provider.ts` | `createPiImageProvider(env?)` | pi-rp 端口实现：`builtinImagesModels()` + `getImageModel()` + `stopReason` 分派 |

### 8.2 修改

| 文件 | 函数/字段 | 改动 |
|---|---|---|
| `packages/shared/src/index.ts` | barrel | 导出 `generate-image.ts` 与 `image-provider.ts` 的公开面（`actions/` 其它模块同理，归 `01`） |
| `packages/shared/src/store/world-store.ts` | `WorldStore` | **不需要**新方法：用 `01 §2.7` 已加的 `writeFileAtomic(relPath, string \| Buffer)`、`readFileBase64`、`resolveLayer`（本次不用 `resolveLayer`——不落事件就不需要 `layer`） |
| `extensions/tools.ts` | — | 注册 `generate_image`（**`12-*` 的文件**，本文只引用；按 `00 §6.1` 布局，`toolkit/` 在子目录所以不会被当扩展加载） |
| `apps/server/src/engine/event-bridge.ts` | `mapEngineEvent` | 加 `tool_execution_update` 分支 + `tool_execution_end` 里 `generate_image` 的分支（§6.3，归 `12-*`） |
| `apps/server/src/engine/presets.ts` | `airpEnv()` | 透传 `AIRP_IMAGE_MODEL` / `AIRP_IMAGE_TIMEOUT_MS` / `AIRP_IMAGE_LIBRARY_DIR` / `OPENROUTER_API_KEY`（归 `12-*`，§11 冲突 8） |

### 8.3 明确**不**改

| 文件 | 为什么不改 |
|---|---|
| `packages/shared/src/schemas/events.ts` | 不落事件 → 不加类型、不改 `EventDetailSchemas` |
| `packages/shared/src/db/schema.ts` | 无新表、无新列 |
| `packages/shared/src/schemas/forms.ts` | 不新增 `CARD_FORMS.asset`——§4.4 路 ③ 被否，资源不进组件体系（`doc-10 E0`） |
| `packages/shared/src/schemas/frontmatter.ts` | `bg` 已由 `routes/world.ts:40 readLayerBg()` 以宽松正则读；**不改 `parseFrontmatter`**（那会动 lib/yaml 的边界，`00 §9` 说 `parseFrontmatter` 是手写 YAML-lite） |
| `apps/server/src/routes/world.ts` | C 入口本阶段不接线（§2.1 表）；加路由是 AI 游戏工坊（`doc-19 §5`）的事 |
| `apps/web/**` | 前端只消费 `image_generation_progress` / `image_landed` 两个新帧（§6.3），归 `12-*` 与前端任务 |

### 8.4 函数边界（谁调谁）

```text
extensions/toolkit/generate-image.ts :: execute
  ├─ resolveAgentActor(process.env.AIRP_AGENT_ROLE)          // 01 §2.3
  ├─ new LocalWorldStore(ctx.cwd)                            // 00 §1（cwd 即世界根）
  ├─ createActionService(store, actor, { turn: currentTurnAnchor(ctx) })   // 01 §2.6 / §3.7
  ├─ registerImageProviderFactory(() => createPiImageProvider())          // 幂等，模块级一次
  ├─ onUpdate?.({ stage:'resolving', … })
  └─ svc.generateImage(input)  ──────────────────► packages/shared/src/actions/generate-image.ts :: generateImage
        ├─ validate(input)                     → fail() on bad shape
        ├─ resolveImageProvider()              → null ⇒ fail('unsupported', §7.1 文案)
        ├─ ctx.store.readFileBase64(ref)       // 仅当 input.reference
        ├─ provider.generate(…)                // 外部副作用；带 signal + timeoutMs
        ├─ outputPathFor(…)                    // 纯函数
        ├─ ctx.store.writeFileAtomic(asset, Buffer)
        └─ return { text, details }
```

**`ActionError` 的捕获点是工具壳的最外层**（`01 §3.6`："只有工具壳与路由在最外层各 catch 一次"）：

```ts
try { return await svc.generateImage(params); }
catch (e) {
  if (e instanceof ActionError) return e.toToolResult();   // { content, isError:true, details }
  throw e;                                                  // 非 ActionError = 真 bug，让它炸
}
```

---

## 9. 与现存实现的差异

| 位置 | 现状（带证据） | 要改成 | 迁移影响 |
|---|---|---|---|
| `extensions/` | 只有 `instructions.ts`，**零 `registerTool`**（`00 §9`） | 新建 `toolkit/generate-image.ts`，由 `extensions/tools.ts` 注册（`12-*`） | 无旧调用点 |
| pi-rp 图像面 | 引擎已有（`ai/src/images.ts:14`、`images-models.ts:227`、`providers/all.ts:144-152`），**AIRP 从未使用** | 经 `image-pi-provider.ts` 接进来 | 无 |
| `.pi/agent/models.json` | 三个自定义 provider（`GG` / `tokenrhythm` / `generalcompute`），**无 openrouter**，无 `OPENROUTER_API_KEY` | 赛前加 openrouter 或用 `airpEnv()` 透传 key（§4.3.3 / §11 冲突 8） | 无代码迁移 |
| `.airpworld/assets/` | `00 §2.2` 已声明、`templates/holmes-world/` 里**这个目录不存在**（`find` 无命中） | 第一次 `generate_image` 时由 `writeFileAtomic` 的 `mkdir` 建出 `gen/` | 无 |
| `GET /api/asset` | 已存在（`routes/world.ts:459`），能服务世界根下任意路径 | 不改。生成的图正好落在它的射程内 | 无 |
| `SceneBackdrop.tsx` | 已读 `bg.src` 并拼 `/api/asset?path=`（`:57/63`） | 不改 | 无 |
| `event-bridge.ts` | `mapEngineEvent` 无 `tool_execution_update` 分支（`:42-97`），生图进度会丢 | 加分支（§6.3） | 纯新增 |
| 模板 README 的 `bg:` | 四个 README 已声明 `bg: assets/scenes/<layer>/<file>.png`，**文件全部不存在**（`前端改造计划 §524`），且**路径少了 `.airpworld/` 前缀** | `readLayerBg()` 原样取字符串 → `/api/asset?path=assets/scenes/…` → `path.resolve(worldRoot, 'assets/…')` → 文件不在 → 404 → `SceneBackdrop` 回退材质底（`:32` `failedSrc`） | **见 §11 冲突 2** |

---

## 10. 验收与测试

### 10.1 纯函数单测（无 I/O，`packages/shared`）

| 测什么 | 断言 |
|---|---|
| `assetSlug('Baker Street at Dusk!')` | `'baker-street-at-dusk'` |
| `assetSlug('雨夜')` | `'image'`（ASCII 退化；**这条必须测**，中文提示词是主用例） |
| `assetSlug(65 字符的 prompt)` | 截到 32 字符、无尾随 `-` |
| `requestKey` 稳定性 | 同 descriptor 两次 → 相同；改 `caption` / `model` / `width` / `height` / `reference` 任一项 → 都不同（**逐字段各一个断言**，防止漏拼某个字段进 hash） |
| `requestKey` 长度 | 16 hex |
| `outputPathFor(...)` | `.airpworld/assets/gen/` 前缀 + `.<ext>` 后缀 + 无 `..` |
| `resolveImageProvider()` 默认态 | `{ provider: null, reason: 'no_provider' }` |
| `generateImage` 参数校验（用 fake provider + fake store） | 空 prompt / 超长 prompt / `width:0` / `width:99999` / 浮点 width / `path:'a.png'` / `reference:'world/x.png'` **各抛对应 `ActionError.code`** |

### 10.2 fake provider 的集成测（`packages/shared`，无网络）

一个 `ImageProvider` 的测试替身 + 一个内存 `WorldStore` stub（`01 §10` 若给共享 fake 就用它，否则本文件自带），断言：

- **成功路径**：写文件（断言字节与 base64 解出来的完全一致）、`details` 全字段、`reused:false`。
- **幂等**：连调两次 → 第二次 `reused:true`、**写盘调用次数为 1**（用 spy 计数，这是幂等的唯一硬证据）。
- **无 provider**：`isError` + `unsupported` + 文案里含 `Do not retry`（`doc-03 §3.4` 的措辞是可断言的契约）。
- **provider 失败各 reason**：`timeout` / `aborted` / `no_image` / `policy` / `provider_error` → 各自 `code` 与文案，**且写盘调用次数为 0**（失败绝不落盘）。
- **aborted 时序**：`generate` 期间 abort → 返回 `aborted`，且**不写文件**。

### 10.3 探针 / 手测（`pnpm probe` 之外）

| # | 场景 | 期望 |
|---|---|---|
| 1 | **无模型**（不设任何 env）调 `generate_image` | 工具返回 `isError:true`；文案含 `No image model is configured`；`details.reason === 'no_provider'`；`.airpworld/assets/gen/` **没有被创建** |
| 2 | 设 `OPENROUTER_API_KEY` + 默认模型，调一次 | ~3–15s 内返回；`.airpworld/assets/gen/*.png` 出现；`file` 命令认它是 PNG；`/api/asset?path=<asset>` 能取到 |
| 3 | **同一参数连调两次** | 第二次几乎瞬回；`reused:true`；目录里**仍只有一个文件** |
| 4 | 生成后 `editEntity` README 的 `bg:` 指向它 | `entity_edited` 落账；刷新前端，底图换成新图（**端到端闭环的验收点**） |
| 5 | 生图期间按 Esc | 更快返回 cancelled 文案；**无残留文件**（或有完整文件、无半张） |
| 6 | 生图期间看 TUI | 每 ≤10s 有一条 "Still drawing…" 心跳，不是死界面 |
| 7 | `AIRP_IMAGE_MODEL='openrouter/nope'` | `unsupported` + 文案列出可用 id |

### 10.4 验收判据（一句话）

**"没有图像模型时，工具用英文说清原因并叫模型不要重试；有模型时，一句提示词变成一张可被 `/api/asset` 取到的 PNG，路径在 `details.asset` 里稳定可引用；同一请求不会生成第二份。"**

---

## 11. 发现的冲突 / 需要修订的上位文档

### 冲突 1（**已解决，登记备查**）：`kind` 枚举没有 `asset`

- 哪两份：`00 §5.2` / `doc-21 §4.1`（`entity_created.kind` 五值）vs 本工具"生成了一个 asset"。
- 为什么不算冲突：见 §5.2。资源按构造不在实体分类法内，`other` 也不该被拓宽。
- 建议：**不改任何文档**。本工具不落事件（§5.1），因此这条从来不会真的被触发。若评审坚持要落一条"图被挂上了"的事件，`kind` 用**被挂实体的 kind**。

### 冲突 2（**真冲突，需要修订**）：`bg:` 的路径基准不一致

- 哪两份：`doc-10 E1`（`bg` 是 README 的 frontmatter 字段）与 `doc-05 §7.4`（`type: asset` 的 `ref` 指向 `.airpworld/assets/`）**共同**产生了"bg 的值该怎么写"的空白；而模板已经用两种写法各写了一遍：
  - `templates/holmes-world/world/baker-street/README.md:5` → `bg: "assets/scenes/baker-street/parchment-warm.png"`（**无 `.airpworld/` 前缀**）
  - `apps/web/src/components/canvas/SceneBackdrop.tsx:6` 的注释 → `assets/scenes/<layer>/<file>.png`（同无前缀）
  - 但 `routes/world.ts:465` 是 `path.resolve(store.worldRoot, rel)` → 实际解析成 `<worldRoot>/assets/scenes/…`，**而 `.gitignore` 之外世界根下并没有 `assets/` 目录**（`find templates -type d -name assets` 无命中）。
- 为什么矛盾：若约定是"世界根相对"（`00 §2.1` 的铁律），则 `assets/…` 指的是**世界根的 `assets/`**，与 `00 §2.2` 的"`assets/` 在 `.airpworld/` 下"直接冲突。今天它不崩，只因为图根本不存在（404 回退材质底，`SceneBackdrop.tsx:32`）——**一旦生图上线，这条会立刻变成"图生成了但底图不换"的演示事故**。
- **建议怎么改**（REVIEW 已采纳第 1 条，定案见下）：
  1. `00 §2.1` 加一句"资源路径同样以世界根为基准，因此一律 `.airpworld/assets/…`"；
  2. 模板四个 README 的 `bg:` 改成 `.airpworld/assets/scenes/<layer>/<file>.png`；
  3. `SceneBackdrop.tsx:6` 的注释同步；
  4. `readLayerBg()`（`routes/world.ts:47`）已能原样取全路径，**零代码改动**。
  另需**修一条 token**：`前端改造计划 §524` 说"holmes README 已声明 `bg: assets/scenes/…`"——同一句里就少了前缀，与本建议冲突，应一并改。
  - **定案（REVIEW M-9，已裁决）**：统一到 `.airpworld/assets/…` 全路径。要一并改的文件：四个模板 README 的 `bg:`、`SceneBackdrop.tsx:6` 的注释、`前端改造计划 §524`。**这是"生图 → 看到图"链路的硬断点，实现期一并改内容。**
  - `[推断]` 另一种可选修法是"保留 `assets/…` 简写，由 `readLayerBg` 补 `.airpworld/` 前缀"。**不推荐**：那会让 `bg` 的值不是合法世界根相对路径，违反 `00 §2.1`，且第二处消费者（未来的正文图片渲染器）必须再写一次同样的补前缀逻辑。

### 冲突 3（**真冲突，需要修订**）：`doc-05 §7.4` 的 `type: asset` 行没有被任何人认领

- 哪两份：`doc-05 §7.4` 表格（`| asset | 加载资源（ref 指向 .airpworld/assets/） | 背景图、角色立绘、音乐 |`，`:445`）与 `doc-10 E0`（`:143` 明文"**bg 不是 `type: asset`，是场景 README 的 frontmatter 字段**…误读成独立 asset 类型（v1 `FILE_HINT`／archive 旧 doc 的 `type: asset` 都是原型取巧+旧文档残留）"）。
- 为什么矛盾：`doc-10 E0` 是 2026-09-11 的**正名修正**且带"唯一口径"字样；`doc-05 §7.4` 的这张表没跟着改，还留着 `background.md` 那行例子（`doc-05 §471`）。`00 §0` 的优先级里 `doc-10` 低于 `doc-05`，**按优先级会选到错的那个**。
- 现有代码已经站在 `doc-10` 一边：`forms.ts:36 cardKindOf()` 不认 `type:'asset'`，`CARD_FORMS` 没有 `asset`，`SceneBackdrop` 只读 README 的 `bg`——**没有任何渲染器消费 `type: asset`**。
- 建议怎么改：改 `doc-05 §7.4`，把 `asset` 行替换为一行注记："资源（图片/音频/视频）通过**消费方的字段**引用：场景底图用 README 的 `bg:`，角色立绘用 `characters[].avatar`，正文插图用 md 图片语法；**不存在 `type: asset` 的实体**（见 doc-10 E0）"；并删掉 `doc-05 §471` 的 `background.md` 例子。

### 冲突 4（**真冲突，需要修订**）：`doc-05 §8.1` 说图片在"内容层"，`00 §2.5` 说 `.airpworld/` 不可见

- 哪两份：`doc-05 §8.1` 表格（`:515`："内容层（真相）…场景目录、角色卡、md 文本、**图片**、小天地内容"）与 `00 §2.5`（"`.airpworld/`（系统）… 对工具只读或不可见"，且 `00 §5.3` 要求 watcher 过滤 `.airpworld/assets/`）。
- 为什么矛盾：图片按 `doc-05 §8.1` 是**内容层（真相）**且随世界打包（`doc-15:35` 也说"assets 相对引用"），但按 `00 §2.5` 它住在系统目录里、`look_at` 看不见、watcher 不报——**"真相"与"不可见"同时成立**。
- **这条其实是可共存的**（本工具的立场）：图片是内容，但它不需要"被发现"——它只被**路径引用**（`bg:` / `/api/asset`），不被遍历。所以两份都不必改，但 `00 §2.2` 的 `.airpworld/assets/` 注释宜补一句"**它是内容，只是不可遍历**"，免得后人按"系统目录 = 非内容"再推一遍（那会推出"图片不该随包走"的错结论）。
- 建议：改 `00 §2.2` 的注释（不冻结项也可加注）、或改 `doc-05 §8.1` 的措辞为"图片（存于 `.airpworld/assets/`，不可遍历）"。

### 冲突 5（**契约缺口，登记待评审**）：`ActionErrorCode` 没有图像类失败码

- 哪两份：`01 §2.4` 的 `ActionErrorCode` 闭集 vs §7.1 的七种 `ImageFailureReason`。
- 本工具的解法：**全部映射到已有码**——`no_provider` / `no_credentials` / 不支持 `reference` / 未知 model id → `unsupported`；`timeout` → `internal`（HTTP 504）；`aborted` → `internal`（499）；`policy` / `no_image` / `provider_error` → `internal`（4xx/502）。区分靠 `details.reason` + 文案 + HTTP 状态。
- 为什么不新增：`unsupported` 在 `01 §2.4` 的定义是"legal but not built in B1"，"没配图像模型"正落此义；新增 `image_unavailable` / `provider_failed` 会改冻结契约、且多出来的码只服务一个工具。
- 建议：**不改 `01`**。若评审偏好更强的可观测性，可在 `ActionError.details.reason` 上做约定（本文已给 `details.reason` 的七值），比加枚举码便宜。

> **依赖（REVIEW B-2 裁决）**：本工具的落盘与读参考图（§3.2 步 2 的 `store.readFileBase64`、步 6 的 `store.writeFileAtomic('.airpworld/assets/gen/…')`）**只有在 store 放行 `.airpworld/` 后才成立**。`01 §7.3` 的 `resolvePath` 按 B-2 改为"拒绝 `..` 段与 `node_modules` 段、放行 `.airpworld/`"，否则这里每条 `.airpworld/…` 路径的第一段以 `.` 开头、会被 `invalid_path` 整条拒掉。**这是 §3.2 与 §4.5 的前置条件，不是本工具能自行绕过的。**

### 冲突 6（**需要澄清**）：`doc-07` 工具参数规格里的 `style` 语义

- 哪两份：archive `doc-07-工具参数规格.md:100`（`style?: string // 风格参考`）与本文 §4.2 的 hash 方案。
- 为什么需要澄清：`style` 只作为**提示词措辞**拼进 `caption` 参与 hash（引擎不认识任何风格枚举）；若某人期望 `style` 是一个会改变 provider 参数的**枚举**（如 `style: 'vivid'`），他会发现它毫无效果。
- 建议：不改文档，但**工具的 `parameters.style.description` 与本文 §2.1 已写明它是"words appended to the prompt"**，这是唯一的权威描述。（`doc-07` 本体在 `docs/archive/`，已不属活跃真相源。）

### 冲突 7（**设计取舍登记**）：为什么 provider 用进程级 service locator 而非 `ActionContext` 字段

- 与 `01` 的裁决对齐：`01` 明确拒绝给 `ActionContext` 加任何字段（"Frozen fields are exactly `{ store, actor, turn, now?, rng? }`… Don't add fields to `ActionContext`"）。
- 因此 provider **不能**走 `ActionContext`。选了最小的替代：`packages/shared` 内一个模块级注册表（`registerImageProviderFactory`），`extensions/toolkit/*` 在加载时注册一次。
- 代价与缓解：① 模块级单例在测试间会串——已提供 `resetImageProviderForTests()`；② `packages/shared` 出现了一个"环境依赖"，但**它只是可选项**：不注册就是 `null`（一条明确的 `unsupported`），不是崩溃，也不是默认值。
- 备选（未采纳）：把 provider 作为 `generateImage` 的**显式参数**。代价是 `ActionService` 的方法签名会与其他 21 个方法不一致（`01 §2.6` 冻结的 clist 形状），破坏"服务方法只收 `XInput`"的统一纪律。

### 冲突 8（**需要一并做的工程改动**）：`airpEnv()` 还没透传图像相关 env

- `apps/server/src/engine/presets.ts:54` 的 `airpEnv()` 今天只返回 `{ PI_PROJECT_CONFIG_DIR: '.airpworld' }`；`00 §3` 说它是"唯一注入点"，`00 §9` 说 `launch.ts:69` 的 `writerLaunch`/`characterLaunch` 都还没设 `AIRP_AGENT_ROLE`。
- 本工具需要的四个 env（`OPENROUTER_API_KEY` / `AIRP_IMAGE_MODEL` / `AIRP_IMAGE_TIMEOUT_MS` / `AIRP_IMAGE_LIBRARY_DIR`）**必须与 `AIRP_AGENT_ROLE` 在同一处落地**，否则 agent 进程里的东西与 server 进程里的东西会看到两套配置。
- 建议：把 `airpEnv()` 扩成"从 `process.env` 白名单透传 + 项目默认值"，名单里同时含 `AIRP_AGENT_ROLE` 与这四个。**归 `12-*`**，本文只登记接口。

---

## 12. 仍然未知 / 留给评审拍板的

1. **默认模型到底选哪个**：本文选 `openrouter/google/gemini-2.5-flash-image`（flash 档、支持 `reference`）。`[推断]` 它的实际延迟/单价/中文提示词质量都**没有实测**——赛前用真 key 跑 §10.3 的 2/3/4 号场景，按结果改默认值。备选：`black-forest-labs/flux.2-flex`。
2. **审核拦截的判定是不是启发式就够**：§4.3.4 用正则猜 `policy`。`[推断]` 若 OpenRouter 把审核错误包装成通用 400，这个正则可能不命中，退化成 `provider_error`（文案不同、可重试性不同）。需要一次真实的拒答样本才能定。
3. **`ActionErrorCode` 要不要加图像码**：见 §11 冲突 5。本文选择零改动映射，评审可推翻。
4. **`details.width/height` 是否该是"真实像素"**：本文是**请求值**。读回真实尺寸需要解码 PNG/JPEG 头（`image-size` 依赖，或手写 30 行的 header 解析）。`[推断]` MVP 不值得，但若前端要做"按真实宽高排座"就有意义。
5. **`AIRP_IMAGE_LIBRARY_DIR` 的库 provider 何时做**：`后端实现计划 §12` 把它列为降级项，但**库里的图今天不存在**（`前端改造计划 §12` 是待办清单）。做库 provider 之前必须先有素材，否则它只是"另一个 fail-loud"。
6. **是否要允许 `generate_image` 直接写 `attachTo`**：本文坚持"不写、由 `editEntity` 写"（§2.2）。理由是事件归口与"一次动作改一处"。若评审认为"生成+挂载"在演示动线里必须一次完成（`doc-19 §5` 的 3 秒工坊），那需要一条**新的组合动作**（而非让本工具越权），本文不设计它。
7. **会不会把作家上下文顶爆**：本文不把图塞进 tool result（§6.4），所以**不会**。但如果将来有人给生图配一个"看一眼再改提示词"的回路（`view_canvas` 式），那条回路需要自己的尺寸上限与降采样——**不在本工具范围**。
8. **`reference`（img2img）在赛时是否真有用**：本文实现了它（`input` 能力已具备），但**没有任何上游玩法用到它**。`[推断]` 若赛时没时间，删掉 `reference` 只影响 §2.1 一行与 schema 一个可选字段——它不阻塞任何东西，但也不该被无测试地留着。
9. **心跳间隔 10s 是否合适**：`doc-03 §6` 清单第 2 条只给了原则（预判焦虑），没给数字。`[推断]` 10s 对 3–15s 的生图可能一次都不触发（图已经回来了），那这条就只在慢路径上有用——仍然值得留，因为慢路径正是玩家以为卡死的路径。
