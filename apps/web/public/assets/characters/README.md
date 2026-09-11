# 角色图片素材说明

> 搜集日期：2026-09-10
> 用途：AIRP 产品「大头像」（右侧边栏角色 tab）和「大半身立绘」（对话遮罩内左右分屏）
> 参考原型：`画布世界v1-yoshi.html` 中的 `DLG_ASSETS` 配置结构

## 下载结果

已成功下载 **35 张 PNG 立绘图片** (portraits/ 下 27 张 + maid/ 下 8 张) + **3 个原始压缩包**，总计约 40MB。

## 目录结构

```
assets/characters/
├── portraits/                  # 大半身立绘（对话遮罩用）
│   ├── portrait25_puck.png     # 老周（旅店老板）- 已在原型中使用
│   ├── portrait21_sara.png     # 常客 - 已在原型中使用
│   ├── portrait24.png          # LPC 动漫肖像
│   ├── portrait26.png          # LPC 动漫肖像
│   ├── LPCportrait1~11.png     # LPC 通用动漫肖像系列（11张）
│   ├── Innkeeper_01~08.png     # 旅店老板角色（8表情独立图）
│   ├── fella_1.png / fella_2.png   # 男性角色肖像（Portrait Pack）
│   ├── lady_1.png / lady_2.png     # 女性角色肖像（Portrait Pack）
│   ├── maid/                   # 女仆角色（8表情分拆PNG）
│   ├── portraits_pack.zip      # Portrait Pack 原始压缩包（4角色）
│   ├── Innkeeper.zip           # JS Actor Innkeeper 原始包（含 PSD/Faceset/多尺寸）
│   ├── maid_portrait.zip       # Cute Maid Portrait 原始包
│   └── avatars/                # 预留：大头像（圆形裁剪用，尚未填充）
└── README.md                   # 本文件
```

## 许可汇总

所有素材均来自 **OpenGameArt.org**，许可协议为 **CC-BY 3.0** 或兼容协议，可免费商用（需署名）。

| 素材 | 作者/来源 | 许可 | 用途 |
|------|-----------|------|------|
| Sara / Trevor / Puck 动漫肖像 | RPG Action / ZeNeRIA29 | CC-BY 3.0 | 对话遮罩立绘（原型已在用） |
| Anime Portrait for LPC characters | William.Thompsonj / ZeNeRIA29 | CC-BY-SA 3.0 | 通用 NPC 立绘 |
| JS Actor - Innkeeper | JosephSeraph | CC-BY 3.0 | 老周（旅店老板）角色立绘 |
| Portrait Pack (4角色) | Calciumtrice | CC-BY 3.0 | 通用男女角色肖像 |
| Character Portrait ~ Maid | 匿名作者 | CC-BY 3.0 | 女仆风格角色 |
| Character Portrait ~ Bandit | 匿名作者 | CC-BY 3.0 | 男土匪角色 |

**署名要求**：使用时注明 "Portrait graphics created by [作者名]" 即可（链接可选）。

## 素材对照表（建议角色映射）

基于 `DLG_ASSETS` 的配置格式，以下是已下载素材的建议用途：

| 角色名 | 素材文件 | 描述 | 尺寸 |
|--------|----------|------|------|
| **老周** | `portrait25_puck.png` 或 `Innkeeper_*.png` | 旅店老板/中年男性 | 900x760 |
| **常客** | `portrait21_sara.png` | 女性年轻角色 | 900x760 |
| **角色A** | `LPCportrait1.png` ~ `LPCportrait11.png` | 11张通用 LPC 动漫肖像 | 900x760 |
| **旅店老板(精细)** | `Innkeeper_01~08.png` | 8表情旅店老板（PSD分层） | ~700x700 |
| **女仆** | `maid/` 目录 | 8表情女仆（Neutral/Happy/Sad/Angry/Blush/Confused/Cover） | 独立PNG |
| **男性角色** | `fella_1.png`, `fella_2.png` | Portrait Pack 男性 | 1200x1200 |
| **女性角色** | `lady_1.png`, `lady_2.png` | Portrait Pack 女性 | 1200x1200 |

## 集成到原型代码

参考 `画布世界v1-yoshi.html` 的 `DLG_ASSETS` 结构：

```js
const DLG_ASSETS = {
  '老周': { sheet: 'assets/characters/portraits/portrait25_puck.png',
           faces: { normal: [0,0], smile: [50,100], angry: [100,100] } },
  '常客': { sheet: 'assets/characters/portraits/portrait21_sara.png',
           faces: { normal: [0,0], smile: [0,100], laugh: [50,100], pout: [100,100] } },
  // 更多角色按此格式添加...
};
```

大头像（`avatars/`）用于右侧边栏角色 tab 的圆形头像展示，建议从上述立绘中裁切或缩放为 64x64 圆形。

## 未下载的素材

以下资源在搜索时发现但因链接失效或需付费未下载：
- `Character Portrait ~ Bandit`（OGA 404，需确认新链接）
- `portrait28.png`, `portrait29.png`（OGA 404）
- itch.io 上的 Miki/Kana/Kousei/Aiko/Hoshiko 等角色 sprite（免费但需从 itch.io 手动下载）
- `Mysterious Man`、`Priest portrait`（OGA 链接变更）

这些可在项目后期按需手动下载补充。

## 文件清单

```
portraits/ 目录 (35 张 PNG + 3 ZIP + maid 子目录):
  Innkeeper_01.png  ~ Innkeeper_08.png   (各 ~480KB, 独立表情)
  LPCportrait1.png  ~ LPCportrait11.png   (各 ~250-350KB)
  portrait21_sara.png  (404KB)
  portrait24.png       (304KB)
  portrait25_puck.png  (296KB)
  portrait26.png       (260KB)
  fella_1.png         (1.8MB)
  fella_2.png         (2.0MB)
  lady_1.png          (2.4MB)
  lady_2.png          (2.1MB)
  maid/ (8张表情图, 各 ~172KB)
  portraits_pack.zip  (8.4MB)
  Innkeeper.zip       (13.2MB)
  maid_portrait.zip   (1.2MB)

avatars/ 目录: 空，待填充大头像（从 portraits 裁切）
```
