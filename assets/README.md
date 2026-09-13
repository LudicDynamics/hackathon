# worldlines-assets — 素材生产车间（repo 外置 workspace）

> 定位：**生产车间，不是发布位**。pipeline（AI 生图等）的原始产出、筛选、差分都在这里做；
> 定稿后经平台上传端点落入 IP 包（`.pi/ips/<ip>/assets/`），那才是 runtime 读取的发布位。
> **入库口径（2026-09-13 更正）**：整树 `.gitignore` 排除，**只白名单 `audio/**` 与 `skills/**`**
> ——这两支是我们自己产出、runtime 直接读的资产（见根 `AGENTS.md` §7.8）。
> `worlds/`、`_inbox/` 仍不入库（AI 生图原始产出，约 587MB，仅作生产参考）。

## 结构约定

```
assets/
├─ audio/                       平台级音频池（已入库；AUDIO_ROOT 指向此处，/api/audio 伺服）
│  ├─ bgm/ themes/ ambient/ foley/   三情绪主线 / 逐世界主题曲 / 声场族 / 拟音
│  ├─ PLAN.md                   全量音频需求清单 + 逐条缺口状态
│  └─ CREDITS.md                素材授权信息（增删音频 MUST 同步）
├─ skills/                      素材生产手艺包（纯文本，已入库）
│  ├─ motion-portrait/          绿幕 → 透明 webm / 成片 → 循环 webm（tools/motion-clip.mjs）
│  └─ flow-media/               Flow 生图 / 生视频（tools/flow-gen.mjs，含认证链与降级陷阱）
├─ _inbox/                      pipeline 原始产出（未筛选，随便堆；不入库）
└─ worlds/<ip>/                 与 .pi/ips/<ip> 同名对应（不入库）
   ├─ cover/                    封面候选；定稿命名 cover.png（9:16 移动优先）
   ├─ characters/<charId>/      角色立绘；定稿 base.png
   │  └─ variants/              差分（表情/状态：<name>.png，如 angry.png / wounded.png）
   └─ prompts.md                生成 prompt / 种子 / 模型记录（可复现）
```

## 角色素材批次落点（2026-09-13）

6 情绪差分的车间产出固定在 `<world>-demo/characters/<id>/variants/`：

```
variants/
├─ <emo>-green.jpg     img2img 绿幕源（模型直接产出，未抠像）
├─ <emo>.png           chromakey+despill 后的透明 PNG（发布位 webp 的来源）
└─ <id>-green.mp4      （可选）i2v 绿幕视频源，供 motion-clip 抠成透明 webm
```

`<emo>` ∈ `normal/smile/shock/sad/angry/thinking`。规格、命令与验收见 `docs/assets/00`；
批量工具 `tools/gen-emotions.mjs`（图，免费）/ `tools/gen-motion.mjs`（视频，扣额度）。
发布位写 `templates/<world>/assets/characters/<id>/<emo>.webp`，溯源另记于
`templates/<world>/assets/character-media.json`（不并入 `source-manifest.json`，理由见 `docs/assets/00 §4.4`）。

## 定稿 → 发布（进 IP 包）
平台已有上传端点（base64 JSON，kind 白名单 covers/backgrounds/avatars）：

```bash
node -e '
const fs=require("fs");
const data=fs.readFileSync(process.argv[1]).toString("base64");
fetch("http://127.0.0.1:8830/api/ips/"+process.argv[2]+"/assets/"+process.argv[3],{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({filename:process.argv[4],data})
}).then(r=>r.json()).then(console.log);
' worlds/ashenbay/cover/cover.png ashenbay covers cover.png
```

角色差分（variants）在 IP 包侧的落位待定（预设 image 字段目前单图）——差分体系
成熟后在 `assets/avatars/<charId>/` 下扩展，先在本车间积累。
