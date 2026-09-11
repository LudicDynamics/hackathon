# AIRP 工具参数规格

> 附属文档：doc-05-AIRP产品构想.md
> 更新日期：2026-08-31
> 说明：本文档详细定义 AIRP 平台所有工具的输入参数和输出行为，供开发实现参考。

## 1. 约定

- 参数名使用 camelCase
- 必填参数不加标记，可选参数末尾加 `?`
- 所有工具返回 `{ content: [{ type: "text", text: string }], isError?: boolean }`
- 角色工具和作家工具的相同同名工具行为一致
- 部分工具会有事件广播

---

## 2. 作家工具

### 2.1 文件操作

#### read/bash/edit/write  // 原生工具不详细介绍

#### delete
```
path: string | string[]          // 文件路径
```
删除文件或空目录。

---

### 2.2 委托

#### subagent / subagent_profiles

---

### 2.3 画布感知

#### read_canvas
```
path?: string | string[]        // 范围：当前场景路径（默认当前所在场景）或者多个文件
```
以渲染视角读画布上的内容：

- md 文件：去掉 frontmatter，只展示正文
- html 文件：只读 `<meta description>` 做摘要
- json/yaml：忽略
- 按目录结构顺序返回，含子目录的 README.md
- 返回合并后的文本，方便 agent 一次性了解场景全貌
- 并且会把方位关系作为格式化的结果

#### view_canvas
```
path?: string         // 路径（默认当前场景），选一个文件作为参照
mode: center | ...  //看的方式
from?: player | character_id  //从谁的视角看
```
返回画布截图（image content block），取代 `look_at_board` + `read_user_view`。

---

### 2.4 板书

#### chalk
```
path?: string          // 落盘路径（默认当前场景目录）
content: string        // 板书正文（markdown 格式）
link_to?: string       // 快速画一条连线，指向另一条板书/组件的路径
append_to?: string     // 接续到某条板书之后（同 tag 的 chain 语义）
```
写一段长在画布上的文字（`type: chalk` 的 md 文件）。

- 自动落盘到当前场景目录
- `append_to` 自动设置 frontmatter 的连接到前一条
- `link_to` 自动设置 frontmatter 的连线

---

### 2.5 通信

#### call_character
```
target: string         // 角色 id 或 "player"
context?: string       // 作家搭线时的上下文说明
```
在玩家与角色之间建立通信通道。作家不是替角色说话，而是搭线——建立连接后作家退到一边。

---

### 2.6 叙事辅助

#### roll_dice
```
expression: string     // 骰子表达式，如 "2d6+3"
```

#### generate_image
```
prompt: string         // 图片描述
style?: string         // 风格参考
width?: number         // 宽度（像素）
height?: number        // 高度（像素）
```
生成图片，落盘到 `assets/`。

---

### 2.7 交互

#### ask_option
```
options: string[]      // 选项列表（1-4 个）
```
向玩家提结构化选择题，返回玩家选择的选项。阻塞等待玩家回答。

---

### 2.8 组件

#### get_component
```
component: string | string[]      // 组件名
```
返回某个组件的具体参数 schema、用法说明和示例。避免把所有组件 schema 塞进上下文撑爆。

#### show
```
component: string      // 组件名
params?: object        // 组件参数
```
使用演出型组件——纯展示特效，不落盘。用于场景过渡动画、天气特效、过场演出等。

---

### 2.9 目录重构

#### restructure_preview
```
scope: string          // 重构范围：场景路径
packs?: {              // 打包操作
  name: string         // 新目录名
  files: string[]      // 要打包的文件列表
}[]
unpacks?: {            // 解包操作
  name: string         // 新目录名
  source: string       // 原文件路径（通常是 README.md）
}[]
```
预演重构后的目录结构，返回：

```
{
  proposed: string        // 重构后的目录树（文本）
  newReadmes: string[]    // 需要新写的 README 路径列表
  moves: number           // 移动文件数
  affectedRefs: number    // 自动更新的引用数
  refsOk: boolean         // 引用关系是否全部可机械更新
}
```

#### confirm_restructure
```
plan: string           // restructure_preview 返回的 plan id
readmes: {             // 需要新写的 README 内容
  [path: string]: string
}
```
确认执行重构。一次性完成：移动文件 + 更新引用 + 写 README。

---

## 3. 角色工具

### 3.1 文件操作

```
read / bash / edit / write
```
与作家同名工具行为一致。角色有完整文件权限，可读写自己的文件、记忆、状态。

---

### 3.2 画布感知

```
read_canvas / view_canvas
```
与作家同名工具行为一致。角色可以查看当前场景的画布内容。

---

### 3.3 表达

#### chalk
与作家 `chalk` 行为一致。角色写板书。

---

### 3.4 通信

#### pass_mic
```
target: string         // "player" 或角色 id
```
递话筒——把自己本轮写的话（chalk 正文）递给目标。

- `target="player"`：玩家下一句输入直达该角色（一次性往返）
- `target="角色id"`：对方回一句后话筒回作家
- 调用后角色回合立即结束（`terminate: true`）
- 先写正文再调 pass_mic，正文自动转发给目标
- 角色侧不需要知道底层路由
