---
name: flow-media
description: Use when generating images or videos for an asset — cover art, character base portraits, scene stills, backdrop plates, or short motion clips — through the local Flow proxy. Covers starting the proxy, the agent-cookie auth chain, the async video poll/download dance, and the two upstream key naming systems (abra vs veo) whose mix-up silently downgrades every veo request to a 360p omni clip.
---

# Flow 生图 / 生视频

工具：`tools/flow-gen.mjs`（`pnpm gen`）。它调本机反代 `../flow-proxy-api`，后者包着 Google Flow
的上游接口（`aisandbox-pa.googleapis.com`），替我们处理 SAPISIDHASH 签名、项目引导、
AT 刷新、模型 key 回退和签名 CDN 地址。

## 一句话结论

**认证靠"服务端持有浏览器 Cookie"，不靠 API Key 单打独斗。**
所以链路是：**代理服务在跑 → 它手里有账号 Cookie → 工具带 `FLOW_API_KEY` 调它**。
三样缺一，工具都会明确告诉你缺哪样，不会静默失败。

```bash
# 起代理（另一终端；或交给常驻进程）
cd ../flow-proxy-api && node server.js          # 默认 :8317

# 生图
pnpm gen image --prompt "黄昏的海边灯塔，赛璐璐动画风" -o assets/_inbox/

# 生视频（异步，工具会自动轮询 + 下载）
pnpm gen video --prompt "海浪拍打礁石" --seconds 6 -o out.mp4
```

---

## 一、认证：这层最容易卡住

### 1.1 代理自身的 API Key（`FLOW_API_KEY`）

代理在 `config.yaml` 的 `api-keys:` 列里放 Bearer 密钥；工具从环境变量读同名值。
没设就调，会直接 401，并提示你去哪儿拿：

```
✗ 代理拒绝鉴权（HTTP 401）：API Key 无效。…
  设置正确的密钥：FLOW_API_KEY=<config.yaml 里 api-keys 的那一串>
```

本地自用可以写进 `.env`（`.env` 已被 gitignore，**绝不入库**）。
`config.yaml` 与 `state.json` 也都不进 git——它们含 Cookie 与令牌。

### 1.2 真正的门槛：代理拿不到有效 Cookie

代理要拿 Cookie 才能换到 Google 的 access token。**Cookie 来自浏览器，且必须由扩展推送**：

1. Chrome 装上 `flow-proxy-api/extension/`（开发者模式加载）。
2. 登录 `flow.google.com`。
3. 点扩展图标 → **① 授权 Flow** → 再把 Cookie 推给反代。

**为什么要"授权"这一步**（2026-09 实测，不是理论）：新版 Flow 前端是 Angular 应用，
认证走 **SAPISIDHASH**，浏览器里**根本没有 `__Secure-next-auth.session-token`**；
而反代后端走的是老 next-auth 通道，**只认那个 token**。所以必须借
`labs.google` 的 next-auth OAuth 流程现补一个。

诊断顺序（按报错对号入座）：

| 症状 | 原因 | 处理 |
|---|---|---|
| `尚未配置账号` / 503 | 代理手里没账号 | 重推 Cookie；或 `config.yaml` 的 `flow.accounts` 手填 |
| `获取 reCAPTCHA token 超时` | 打码桥断了 | 确认扩展已加载 + 有开着的 `labs.google` 页 |
| 401 `invalid authentication credentials` | AT 过期且刷新失败 | 看下节"Cookie 体积" |
| `400 Request Header Or Cookie Too Large` | **Cookie 串太大** | 见下 |

**Cookie 体积是真实红线**：浏览器会推几十条 Cookie（实测 36 条 / 6.6KB），
而 `labs.google` 对请求头有限制，超了直接 **400**。
代理里 `trimCookie()` 已经把请求裁剪到认证必需字段（实测降到 3.3KB）——
**如果你在改代理、或手动拼 Cookie，别把整串原样塞进去。**

### 1.3 额度

```bash
pnpm gen credits     # 剩余额度
```

额度按次扣（实测：视频 4 次共 28，图片每次 4）。**批量生成前先看一眼**，
不然跑到一半没额度，前面的任务白等。

---

## 二、生图

```bash
pnpm gen image --prompt "描述" [--model M] [--aspect R] [-o 路径]
```

| 参数 | 取值 |
|---|---|
| `--model` | `nano-banana-2-lite`（默认）/ `nano-banana-2` / `gemini-3.0-pro-image` |
| `--aspect` | `landscape`（默认）/ `portrait` / `square` / `four-three` / `three-four` |

- 实测耗时 **~19s**，返回**真实的 1024×1024 级 JPEG**（签名 CDN 直链可直接下载）。
- 三个模型实测都可用。**`nano-banana-pro` 与 `imagen-4.0-generate-preview` 已从中游 404**，
  代理已把它们从模型列表移除；别照着旧文档去调。
- `-o` 给目录 → 自动命名（`flow-image-<prompt slug>-<时间戳>.jpg`）；给文件名 → 用它。
- `--json` 追加一份机器可读结果（`files[]` / `elapsed_s`），适合脚本消费。

**竖版封面**（9:16 移动优先）用 `--aspect portrait`。

---

## 三、生视频（异步）

```bash
pnpm gen video --prompt "描述" [--model M] [--seconds 4|6|8] [--image 首帧] [-o 路径]
```

工具封装了三步：**提交 → 轮询 → 下载**。耗时实测 **~25–40s**（lite 8s 档约 40s）。

### 3.1 模型与分辨率

| 预设名 | 上游 key | 原生分辨率 | 实测 |
|---|---|---|---|
| `veo-3.1-lite` | `veo_3_1_t2v_lite` | 720p | ✅ 40s / 1.0MB |
| `veo-3.1-fast` | `veo_3_1_t2v_fast` | 720p | ✅ |
| `veo-3.1-quality` | `veo_3_1_t2v_fast_ultra` | 720p | ✅ |
| `omni-1.1-flash` | `abra_t2v_8s` | **360p / 720p 可选** | ✅ 720p 实测 1280×720 |

`--seconds 4|6|8` 对所有预设有效。`omni-1.1-flash` 是唯一能用 `--resolution` 调分辨率的
（**默认已改 720p**，要小文件才传 `--resolution 360`）。

> **默认用 `veo-3.1-lite`**（工具默认值）。不要用 `--resolution` 对着 veo 系调——
> veo 的分辨率由 key 变体决定，传了也不生效。

### 3.2 上游 key 的两套命名（改代理时必读）

**两族格式不同，且分辨率都不写进 key**：

| 家族 | 格式 | 例 |
|---|---|---|
| abra | `abra_{t2v\|i2v\|r2v}_{秒}s` | `abra_t2v_8s` |
| veo | `veo_3_1_{t2v\|i2v}_{变体}[_{秒}s]` | `veo_3_1_t2v_lite`、`veo_3_1_t2v_fast_8s` |

**实测佐证（免费探针：无效 key 返回 404，有效 key 返回 403 reCAPTCHA，都不扣额度）**：

| key | 结果 |
|---|---|
| `abra_t2v_8s` | ✅ 有效 |
| `abra_t2v_8s_720p` | ❌ **404**（带分辨率后缀的 key 不存在） |
| `abra_t2v_4s_360p` | ✅ 存在，但纯属巧合；换个分辨率就 404 |
| `veo_3_1_t2v_lite` | ✅ 有效 |
| `veo_3_1_lite_t2v_4s_360p` | ❌ 404（词序错） |

三条推论：

1. **abra 的分辨率走请求体 `outputSpec`**，与 key 无关。
2. **veo 不能带 `outputSpec`** —— 规格由变体名决定，多传直接 `400 INVALID_ARGUMENT`。
3. **veo 的 key 无效时应当报 404，不要静默回落**。此前代理拿 abra 模板拼 veo key，
   结果 404 后回落到 omni，**你拿到 360p 片却以为在用 veo**。该 bug 已修（实测 veo-3.1-lite 现在真出 1280×720）。
   工具会打降级告警，别忽略。

### 3.3 1080p 是后处理，不是生成档位

网页端"导出 1080p"**不是生成参数**，而是对**已生成的视频**再做一次放大。上游是独立工序：

```
POST /v1/video:batchAsyncGenerateVideoUpsampleVideo
  videoInput.mediaId : <已生成视频的 mediaId>      ← 输入是成片，不是 prompt
  videoModelKey      : veo_3_1_upsampler_1080p     ← 独立放大模型
  resolution         : VIDEO_RESOLUTION_1080P
```

**所以生成时的分辨率上限就是 720p**，`--resolution 1080` 会被上游拒为 `400 INVALID_ARGUMENT`。
本代理尚未实现 upsample 这道工序；需要 1080p 得另行处理成片。

### 3.4 降级告警

工具比对 `upstream_key` 与请求参数，不一致就告警（如 abra 的时长档位回退）：

```bash
#  ⚠ 上游拒绝了请求的参数，已静默降级（时长 8s → 4s）。
#    实际使用 key：abra_t2v_4s
```

`--json` 里有 `upstream_key` 字段可断言。**看到告警就当失败处理**——要么换参数，要么接受降级。

### 3.5 签名地址会过期

`/v1/videos/<id>/content` **每次调用都重新签名**，所以工具不缓存地址，下载时现取。
**不要**把 `remote_url` 存下来下次接着用，会 403。

### 3.6 任务超时不用重跑

客户端等超时（默认 15min）**不等于任务丢了**，代理服务端仍在轮询。用 id 回捞：

```bash
pnpm gen fetch --id fp_xxxxxxxxxxxx -o out.mp4
FLOW_VIDEO_TIMEOUT_MS=1800000 pnpm gen video ...   # 或拉长上限
```

### 3.7 图生视频

```bash
pnpm gen video --prompt "让灯塔的光缓缓扫过" --image assets/_inbox/cover.png -o i2v.mp4
```

本地路径会内联成 data URL 交给代理上传（实测可用）。也可直接给 `https://` 或 `data:` URL。
给了首帧就自动走 i2v 工作流——**但别手动传 `abra_i2v_*` 这类 key**，
代理会以"输入类型不符"拒绝（需要图片输入而你没给，或反过来）。

---

## 四、拿到资产之后

生成物默认落在 `assets/_inbox/`（未筛选的原始产出，**不入库**）。
定稿走 `assets/README.md` 的流程：挑图 → 命名（`cover.png` / `base.png` / 差分）→
经平台上传端点落进 IP 包，**那才是 runtime 读的发布位**。

需要**透明立绘或循环背景视频**时，接着走 `assets/skills/motion-portrait/SKILL.md`
的 `pnpm motion`（绿幕抠像 / 循环封口）——那是另一道工序，别混在本工具里做。
veo 系输出 720p，做全屏背景可用；`omni-1.1-flash` 只有 360p，别用它做背景。

---

## 五、命令速查

```bash
pnpm gen --help

pnpm gen models                                   # 列可用模型
pnpm gen credits                                  # 查额度
pnpm gen image  --prompt "..." --aspect portrait -o assets/_inbox/
pnpm gen video  --prompt "..." --seconds 8 -o out.mp4
pnpm gen video  --prompt "..." --image base.png -o i2v.mp4
pnpm gen fetch  --id fp_xxxx -o out.mp4           # 回捞超时任务

# 换代理地址 / 密钥
FLOW_API_BASE=http://127.0.0.1:8317 FLOW_API_KEY=sk-flow-... pnpm gen image --prompt "..."
```

**排查第一步永远是 `pnpm gen credits`**——它能一次性区分
"服务没起 / 密钥不对 / 账号没 Cookie"这三类问题。
