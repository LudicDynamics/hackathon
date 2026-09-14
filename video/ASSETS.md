# 现成素材（全部来自 `templates/<world>/assets/`，英文模板）

所有 `motion/seedance/characters/*-transparent.webm` 都是 **VP9 带 alpha 的 6 秒循环**（834×1112），Remotion 用 `<OffthreadVideo transparent loop>` 直接叠加。同名 `.webp` 是静帧。

## 角色（S1 点名 / S2 光标头像 / S4 自由行动）

| 名字 | 世界 | 透明动图 | 立绘静帧 |
|---|---|---|---|
| Vera | wuwu（Fogwharf） | `wuwu/assets/motion/seedance/characters/viola-transparent.webm` | `wuwu/assets/characters/vera.webp` |
| Sumi | first-snow | `first-snow/assets/motion/seedance/characters/sumi-transparent.webm` | `first-snow/assets/characters/sumi-yukimura.webp` |
| Nanami | first-snow | `first-snow/assets/motion/seedance/characters/nanami-transparent.webm` | `first-snow/assets/characters/nanami.webp` |
| Watson | whitechapel（Holmes） | `whitechapel/assets/motion/seedance/characters/watson-transparent.webm` | `whitechapel/assets/characters/watson.webp` |
| Seraphina | magic-academy | `magic-academy/assets/motion/seedance/characters/seraphina-transparent.webm` | — |
| Ryo | divergence | `divergence/assets/motion/seedance/characters/ryo-transparent.webm` | `divergence/assets/characters/ryo-child.webp` |
| 备选 | | `wuwu/.../silverkite-transparent.webm`、`magic-academy/.../librarian-transparent.webm` | `whitechapel/assets/characters/{holmes,edith,tom,wayne,blackburn}.webp` |

参考图：`refs/cast.png`（从左到右 Vera · Sumi · Nanami · Watson · Seraphina · Ryo）。

## 世界动态背景（S1 角色衬底 / S3 标题卡 / S0 画布卡片）

| 世界 | 目录 `…/assets/motion/seedance/backgrounds/` |
|---|---|
| Fogwharf | `wuwu`：`map` `intro` `dock` `workshop` `lighthouse` `beyond` |
| Holmes | `whitechapel`：`map` `intro` `press` `morgue` `scene3` `fourth` |
| First Snow | `first-snow`：`map` `intro` `studio` `cafe` `rooftop` `snowfall` |
| Divergence | `divergence`：`map` `intro` `y1994` `tonight` `ruins` `converge` |

参考图：`refs/maps.png`（左上 Fogwharf · 右上 Holmes · 左下 Divergence · 右下 First Snow）。

## 静态场景图（S0 画布炸开的卡片墙）

`templates/{wuwu,whitechapel,first-snow,divergence,magic-academy}/assets/scenes/*`，以及 `templates/whitechapel/assets/backgrounds/*`。
S0 需要大量卡片：约 40 张真实图反复排布即可，远景时看不出重复。

## 进 Remotion 的方式

脚本把上述文件复制到 `video/remotion/public/`（不做软链，避免 Remotion 打包时读不到），路径保持 `<world>/<file>`。
