# 世界 Launcher

> 2026-09-14 · niko 需求：每个世界并排成一个可展示的 gallery，世界之间用玻璃质感包裹、虚化无缝拼接；每个世界都能退回 Launcher。当前是「先给感觉」的第一版。

## 行为

- 每次打开页面先显示 Launcher（全屏）。世界里顶栏的「世界大厅 / ワールド一覧」随时回到这里；已打开世界时，Esc 或「Continue this story」回到原来的世界。
- 一个世界一格，按 shelf 顺序并排。双语版本（`<id>` / `<id>-jp`）共用一格，版本跟随界面语言（`ja` → `-jp`，其他 → 英文版）。没有模板的旧存档组不进 Launcher，仍在「Saved games」存档管理里。
- 质感参照 niko 给的「厚玻璃砖」参考图：每个世界是一块圆角玻璃砖——中间是清晰封面；边缘一圈是同一张图放大、提饱和（像被玻璃折射），最外沿一道彩色色散；内侧有斜面高光和两道反光。左上是编号与版本（`01 日本語`），右上是存档数或「当前游戏」，下方细线、大标题与两行简介。
- 砖墙两排错位（第二排缩进半块），比屏幕宽，两端的砖被裁掉一部分。鼠标移动时整面墙随之倾斜（rotateY ±7°、rotateX ±5°）并向鼠标方向平移，被裁的砖可以露出来；反光也跟着倾斜移动。悬停的砖向前浮起。背景是压暗的全部封面高斯模糊层，缝隙里透出相邻世界的颜色。
- 触屏、窄屏与 `prefers-reduced-motion` 时不倾斜。
- 点一格展开操作：「続きから遊ぶ / 继续最近的存档」（有存档时，打开最近更新的一个）与「＋ Start a new game」（从模板新开）。
- 窄屏（≤760px）改为单列纵向滚动；`prefers-reduced-motion` 时去掉过渡。

## 接口

| 路由 | 说明 |
|---|---|
| `GET /api/worlds` | 每个 group 新增 `cover`（`/api/worlds/cover?id=<模板>`，仅模板）、`locale`、`description` |
| `GET /api/worlds/cover?id=<模板 id>` | 只读返回模板封面；与当前世界无关。封面取 `world.json` 的 `cover`，没有则取 `assets/scenes` 或 `assets/backgrounds` 里的 `intro.*`（否则第一张）。id 只允许字母数字、`-`、`_`，解析后的文件必须仍在 `templates/` 内 |

## 代码

- `apps/server/src/world-shelf.ts`（`coverOf`、`templateCover`）、`apps/server/src/routes/world.ts`（`/worlds/cover`）
- `apps/web/src/components/WorldLauncher.tsx`、`world-launcher.css`、`apps/web/src/lib/world-launcher.ts`（版本选择、标题）
- 测试：`apps/web/test/world-launcher.test.mjs`
