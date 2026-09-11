# 项目级 skills（通用教程）

放**跨世界通用的手艺**：怎么生图、怎么用组件叙事、怎么控制揭示节奏、怎么把叙事和玩法（骰子 / 以物解谜 / choice）咬合起来。

与世界级 skills 的分工：

| 层 | 位置 | 放什么 |
|---|---|---|
| 项目级（本目录） | `<repo>/skills/` | 通用教程——所有世界共享的手艺 |
| 世界级 | `<world>/skills/`（与 `world/` 同级） | 这个世界自己的文风、剧情；随世界包分发 |

两层在启动作家进程时一起用 `--skill <dir>` 传入（见 `apps/server/src/engine/presets.ts` 的 `skillArgs`），目录不存在就不传，零成本。

## 写一个 skill

一个 skill = 一个含 `SKILL.md` 的目录，会被递归发现：

```
skills/
  组件叙事/
    SKILL.md            # frontmatter 必须有 name 与 description
    references/         # 按需加载的详细文档
```

`SKILL.md` 的 frontmatter 只有两个必填字段：

```yaml
---
name: component-narration        # 小写字母 / 数字 / 连字符，<=64 字符
description: 什么时候落 note、什么时候落 letter、什么时候只写 chalk。在需要为叙事挑选承载组件时使用。
---
```

**`description` 决定作家什么时候会去读它**，要写得具体——system prompt 里常驻的只有这一行，正文由作家按需 `read`（渐进披露）。完整规范见 `vendor/pi-rp/packages/coding-agent/docs/skills.md`。

## 为什么是 skill 而不是隐藏字段

作家知道而玩家不必关心的东西（剧情、手法、节奏），一律走 skill，不要发明"只注入作家 prompt、玩家看不到"的字段。隐藏字段要求引擎在四个地方同时保持正确（manifest 加字段 / 导出时剥掉 / 前端永不读 / 注入时记得拼），最后会把作家与玩家的关系做成信息攻防；skill 是零引擎改动、可复用、可组合的手艺包。
