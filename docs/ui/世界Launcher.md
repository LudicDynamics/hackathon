# 世界 Launcher

> 2026-09-14 · niko 需求：每个世界并排成一个可展示的 gallery，世界之间用玻璃质感包裹、虚化无缝拼接；每个世界都能退回 Launcher。第二版：砌砖、无限循环、任意方向滚动，滚到尽头平铺重复；日文、中文、英文同步。

## 行为

- 每次打开页面先显示 Launcher（全屏）。世界里顶栏的「世界大厅 / ワールド一覧」随时回到这里；已打开世界时，Esc 或「Continue this story」回到原来的世界。「Saved games」打开原来的存档管理。
- **无限砖墙：** 一个世界一块砖，奇数行错开半块。墙向四个方向无限平铺重复；排列规则保证相邻的砖（同一行左右、上下两行斜对）不会是同一个世界（世界数 ≥ 5 时）。
- **浏览：** 滚轮与触控板两个方向同时生效（任意方向滚动），拖动墙面带惯性，方向键每次移动半块。拖动超过 6px 才算拖，不会误点开砖。只渲染视野内和四周一圈的砖，平移时只改一层的位移，跨过砖的边界才重新渲染。
- **质感**（参照 niko 给的「厚玻璃砖」参考图）：中间是清晰封面；边缘一圈是同一张图放大、提饱和（像被玻璃折射），最外沿一道彩色色散；内侧有斜面高光和两道反光。左上是编号与版本（`01 日本語`），右上是存档数或「当前游戏」，下方细线、大标题与两行简介。字号随砖的大小（容器查询）变化。
- **倾斜：** 鼠标移动时整面墙随之倾斜（rotateY ±6°、rotateX ±4°），反光跟着移动；悬停的砖向前浮起。背景是压暗的全部封面高斯模糊层。触屏与 `prefers-reduced-motion` 时不倾斜，后者也没有惯性。
- **语言：** 顶部「日本語 / 中文 / English」切换就是整个应用的语言设置，与世界顶栏的选择同步。砖上的版本随之切换：日语显示 `<id>-jp`，中文显示 `<id>-zh`（`tools/localize-zh-edition.mjs` 生成，locale `zh-CN`），英语显示 `<id>`；某个语言还没有版本时退回英文版。
- 点一块砖展开操作：「続きから遊ぶ / 继续最近的存档」（有存档时，打开最近更新的一个）与「＋ Start a new game」（从模板新开）。

## 接口

| 路由 | 说明 |
|---|---|
| `GET /api/worlds` | 每个 group 带 `cover`（`/api/worlds/cover?id=<模板>`，仅模板）、`locale`、`description` |
| `GET /api/worlds/cover?id=<模板 id>` | 只读返回模板封面；与当前世界无关。封面取 `world.json` 的 `cover`，没有则取 `assets/scenes` 或 `assets/backgrounds` 里的 `intro.*`（否则第一张）。id 只允许字母数字、`-`、`_`，解析后的文件必须仍在 `templates/` 内 |

## 代码

- `apps/server/src/world-shelf.ts`（`coverOf`、`templateCover`）、`apps/server/src/routes/world.ts`（`/worlds/cover`）
- `apps/web/src/components/WorldLauncher.tsx`、`world-launcher.css`
- `apps/web/src/lib/world-launcher.ts`：版本选择、标题、`brickWorld`（砖位 → 世界）、`brickGeometry`（砖尺寸 280–520px）、`visibleBricks`（视野内的砖）
- 测试：`apps/web/test/world-launcher.test.mjs`（相邻不重复、负坐标也循环、视野无空洞）
