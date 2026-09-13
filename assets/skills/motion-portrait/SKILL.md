---
name: motion-portrait
description: Use when turning a green-screen or plate video into a canvas asset — keying a portrait into a transparent WebM "living figure", or compressing a scene plate into a small seamless-loop backdrop. Covers the alpha decode trap, key-colour detection, despill, and loop sealing.
---

# 微动立绘 / 背景视频生产

把绿幕视频或成片视频，做成画布能直接用的 webm。工具：`tools/motion-clip.mjs`。

## 一句话结论

透明立绘视频 = **绿幕源 → chromakey 抠像 → despill 去绿边 → VP9 webm（带 alpha）**。
全流程一条命令，剩下的都是"抠像干净不干净"和"循环接不接得上"两件事。

```bash
# 透明微动立绘（从绿幕）
node tools/motion-clip.mjs <绿幕.mp4> -o <out.webm> --scale 360 --preview preview.png

# 背景视频（全屏铺底，不需要 alpha）
node tools/motion-clip.mjs <成片.mp4> -o <out.webm> --mode bg --scale 960
```

无参数时走 `--mode auto`：**探测到绿/蓝幕就抠图，否则当普通背景片压**。

---

## 坑一：alpha 会"看起来在、实际不在"（最重要）

**ffmpeg 内置的 vp9 解码器会静默丢掉 alpha 平面，而不报错。**
`ffprobe` 甚至照样报告 `alpha_mode=1`，但解出来的像素 alpha 全是 255（完全不透明）。

```bash
# ✗ 这样查 alpha 永远查到"全不透明"（用内置解码器）
ffmpeg -i out.webm -frames:v 1 -f rawvideo -pix_fmt rgba -

# ✓ 必须显式指定 libvpx-vp9 解码器
ffmpeg -c:v libvpx-vp9 -i out.webm -frames:v 1 -f rawvideo -pix_fmt rgba -
```

**推论**：任何"这个 webm 到底透不透明"的验收，都必须走 `-c:v libvpx-vp9`。
`tools/motion-clip.mjs` 的 `--verify`（默认开）做的就是这件事，别把它关掉。
踩过的实况：曾据此误判"系统 ffmpeg 编译时没带 alpha 支持"，装了静态版 ffmpeg 才发现
**系统版一直是好的，是测量方法错了**。

编码侧的对应要求（脚本已内置）：

- `-pix_fmt yuva420p`（不是 `yuv420p`）
- `-auto-alt-ref 0`（开了 alt-ref 会丢 alpha）
- 滤镜链末尾 `format=yuva420p`
- 合成预览时**必须** `[1:v]format=yuva420p` 再 overlay，否则 overlay 走 YUV 路径把透明吃掉
  （症状：叠在纸色上变成一坨深蓝底）

## 坑二：片头常有非绿幕黑帧

源视频开头往往有 0.3–0.5 秒黑底（生成模型起手），绿幕是**后来才出现**的。
不裁掉的话，抠像会把这段黑帧也当"背景"处理，或直接黑屏。

脚本自动探测：**从第一帧起找连续 3 帧角点色 = 主背景色**的位置，取它减 2 作为裁点。
也可以手动 `--trim-start <帧号>` 覆盖。踩过的实况：绿幕从第 19–20 帧才开始，而不是想当然的第 12 帧（0.5s）。

## 坑三：循环接缝

源视频首尾帧通常对不上（实测 MSE ≈ 500），直接 `loop` 播会"跳一下"。两种封口方式：

| 方式 | 命令 | 代价 |
|---|---|---|
| 乒乓 | `--pingpong` | 完全无缝，但时长翻倍、动作倒着放（呼吸类看不出） |
| 交叉淡化 | `--loop-fade 0.5` | 时长略减、接缝很轻；动作幅度大时会有拖影 |

两者都不加也行——很多播放场景观众察觉不到。**优先试 `--pingpong`**，它对"微动"最自然。

## 抠像调参

脚本会**自动取末段角点的主色当作 key 色**（绿幕实测落在 `0x21854a` 附近）。

| 症状 | 调什么 |
|---|---|
| 角色头发/高光被抠掉 | `--similarity` 调**小**（0.12 → 0.08） |
| 背景没抠干净、有残留绿 | `--similarity` 调**大**（0.12 → 0.18） |
| 边缘发灰、有绿边 | `--blend` 调大（0.03 → 0.06）给边缘过渡 |
| 毛衣/发梢仍有绿边 | `--despill-mix` 调大（0.6 → 0.8） |

> 注意：`chromakey` 走 YUV 空间。阈值一大，**角色本身的暗部（深蓝毛衣、黑发）也会被一起吃掉**。
> 所以 `similarity` 不是越大越好，要在"背景残留"和"角色破洞"之间找平衡。逐帧抽出来看最稳。

绿铅笔之类的**深绿道具**通常安全——它们明度低，和纯背景绿差得远。

## 素材与发布位置

| 层 | 位置 | 说明 |
|---|---|---|
| 车间（原始产出） | `assets/worlds/<world>/characters/<id>/` | **不进 git**（大二进制） |
| 发布位（随包分发） | `templates/<world>/assets/**` | **进 git**，运行时可读 |

背景视频走层 README 的 `bg:` 字段；前端 `SceneBackdrop` 对 `.mp4/.webm` 自动用
`<video autoplay loop muted playsinline>` 渲染，无需改代码。

**性能红线**（`AGENTS.md` §7.6）：全屏视频是合成负担。限 720p/960w、全屏同一时刻只留一个 video、
`document.hidden` 时暂停，并给 `prefers-reduced-motion` 用户降级为静态图。

## 画布上的用法

- **角色小天地**：微动立绘视频作为一个组件铺在画布上（带 alpha，像贴纸）。
- **直聊遮罩**：**不用视频**——那里要 6 情绪差分快速切换，静态立绘 + CSS 呼吸更合适。
- **fallback**：视频加载失败或 `prefers-reduced-motion` 时，回退到 `base.png` 静态立绘。

> 要**批量**给一个世界补齐 6 情绪差分 + 透明微动立绘（含发布位接线与验收门禁）时，
> 走 `assets/skills/character-asset-batch/SKILL.md`——本文是抠像/循环这一道工序的手艺，
> 那篇是整条角色素材流水线的操作手册。

## 命令速查

```bash
node tools/motion-clip.mjs --help

# 透明立绘，360 宽，乒乓无缝，出预览
node tools/motion-clip.mjs ryo_green.mp4 -o ryo.webm --scale 360 --pingpong --preview p.png

# 不自动探测，手动指定绿幕色
node tools/motion-clip.mjs ryo_green.mp4 -o ryo.webm --key-color 0x1e8549 --trim-start 20

# 背景片
node tools/motion-clip.mjs city.mp4 -o bg.webm --mode bg --scale 960 --loop-fade 0.5

# 环境变量可换 ffmpeg 二进制
FFMPEG=/path/to/ffmpeg node tools/motion-clip.mjs in.mp4 -o out.webm
```
