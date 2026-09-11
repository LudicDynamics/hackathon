# 贝克街的迷雾 — 完整示例世界

> 产品：AIRP（AI 互动叙事游戏）
> 主题：福尔摩斯 × 艾德勒失踪案
> 类型：开放性推理
> 设计文档来源：doc-05 AIRP产品构想.md §8 世界文件结构

## 世界概览

玩家扮演**福尔摩斯**，在贝克街221B追查**艾德勒女士失踪案**。没有预设凶手——所有真相只靠线索串联。

**华生**是同伴（右侧边栏角色tab可导航/聊天/跟随），**巡警**提供初始线索。

## 层级画布

```
贝克街221B（大地图 · material: parchment）
├── 贝克街（场景层 · material: warm）
│   ├── 犯罪现场（stub层 · 首次进入实例化）
│   └── 废弃果园（stub层 · 首次进入实例化）
└── 公寓（场景层 · material: wood）
```

## 线索串联（叙事脚本关键词触发）

| 关键词 | 触发场景 | 获得线索 |
|--------|----------|----------|
| "看"、"线索"、"观察"、"发现" | 贝克街 | 模糊照片（指向废弃果园） |
| "艾德勒"、"失踪"、"女子" | 贝克街 | 匿名纸条（"她去废弃果园了"） |
| "雾"、"天气"、"晚上"、"夜" | 贝克街 | 华生提醒果园线索 |
| 进入犯罪现场 | 犯罪现场 | 自动出现生锈的钥匙 |
| "果园"、"废弃"、"树木"、"树" | 犯罪现场 | 沾泥的信（署名"A"） |
| "走"、"离开"、"回"、"回去" | 贝克街 | 雾更浓，世界等你下一步 |

## 文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `README.md` | type: readme | 世界介绍 |
| `world.json` | manifest | 世界配置（含层级、角色、谜案） |
| `world/README.md` | type: readme | 大地图描述 |
| `world/贝克街/README.md` | type: readme | 贝克街场景描述 |
| `world/贝克街/傍晚.md` | type: chalk + frontmatter | 照片线索叙事 |
| `world/贝克街/深夜.md` | type: chalk + frontmatter | 雾中提醒叙事 |
| `world/犯罪现场/README.md` | type: readme | 犯罪现场（stub） |
| `world/犯罪现场/傍晚.md` | type: chalk + frontmatter | 钥匙发现叙事 |
| `world/废弃果园/README.md` | type: readme | 废弃果园（stub） |
| `characters/华生/README.md` | type: readme | 华生角色简介 |
| `characters/华生/preset.json` | pi-rp preset | 华生提示词预设 |
| `characters/巡警/README.md` | type: readme | 巡警角色简介 |
| `characters/巡警/preset.json` | pi-rp preset | 巡警提示词预设 |
| `player/README.md` | type: readme | 玩家小天地 |
| `player/旧船票.md` | type: note | 起始物品（背包） |
| `journal/README.md` | type: readme | 日志目录说明 |
| `journal/01-迷雾-第1日-初入贝克街.md` | type: chalk | 案件日志 |
| `.airpworld/openings/holmes.json` | opening播种 | 作家开场白与初始状态 |

## 角色设定

### 华生（玩家同伴）
- 身份：约翰·H·华生医生，福尔摩斯的挚友与传记者
- 作用：对话提示、线索补充、情绪锚点
- 位置：右侧边栏"角色"tab → 导航/聊天/跟随
- 立绘：`assets/characters/portraits/portrait21_sara.png`

### 巡警（NPC）
- 身份：贝克街巡警分局警长
- 作用：提供匿名纸条线索
- 位置：右侧边栏"角色"tab → 导航/聊天
- 立绘：`assets/characters/portraits/LPCportrait5.png`

## 开放性设计原则

1. **没有预设凶手** — 一切真相靠线索串联
2. **开放推理** — 玩家可以自由组合线索得出不同结论
3. **雾是隐喻** — 雾越大，离真相越近，但也越模糊
4. **作家只写环境** — 角色说的话、发现的物品是叙事文本，作家只补充环境氛围
5. **多结局可能** — 线索的解读方式决定故事走向

## 如何使用

### 方式1：直接作为文件世界（推荐）
将整个 `holmes-world/` 目录放入 AIRP 引擎的世界目录，引擎自动扫描 `world.json` 和 `.airpworld/` 配置。

### 方式2：复制到现有项目
```bash
cp -r holmes-world/ <你的世界目录>/
```

### 方式3：打包分享
```bash
cd holmes-world && zip -r holmes-world.airpworld.zip .
```

## 与前端原型的关系

`../画布世界v1-yoshi.html` 是此世界的**前端渲染原型**（纸质感画布、层级穿越、chalk流式书写、角色对话遮罩、背包拖拽）。
- 地图数据、叙事脚本、角色配置已写入此文件目录
- 前端 HTML 中的 LAYERS / WRITER_SCRIPTS / DLG_ASSETS 与此目录一一对应
- 此目录是**真相源**（文件即世界状态），HTML 是**投影**（画布即渲染）
