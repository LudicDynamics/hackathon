# 角色定位与 Nook 评审结论

**评审日期：** 2026-09-14
**范围：** 角色初始 presence、角色卡迁移、Nook 角色自身媒体投影。

## 结论

**PASS。** 评审初稿发现的三项 P1 已在实现前后闭环：

1. `moveCharacter` 的 canvas → history 跨库失败窗口由
   `initializeMissingCharacterPresence` 捕获，并通过 `deletePresence` 删除本批新行；下次加载可重试。
2. `/api/characters` 不再发出不存在的 `fella_1.png` 通用头像；无媒体时由 `CharacterMedia` 显示角色名/首字母。
3. Holmes fresh install 测试不再读取角色 world 卡，改测角色 README、初始化后的 presence 与 layer 无角色 sprite。

## 冻结裁决

- `world.json.characters[].home` 是首次加载位置来源；已有 presence 行不覆盖。
- 默认启动与 `POST /api/worlds/load` 都在 event tail 前调用
  `initializeMissingCharacterPresence`，动作身份固定为 `engine`，排座只由 `moveCharacter` 内部完成。
- 角色自身媒体是 `/api/characters` merged metadata 的 Nook sibling DOM，不是 `LayerItem`、`portrait.md`、`spirit.md` 或 cards 行。
- manifest 媒体先作为基础，角色 README 的明确 `avatar/avatarVideo` 覆盖它；两者都缺失时不伪造资源路径。
- `portrait` kind 保留为普通画像/陈设；Nook 复用 Canvas 时强制 `stillPortraits`，direct character media 是唯一动态角色媒体。
- 旧存档中的角色卡文件与 cards 行不删除，但 `/api/layer` 不渲染 legacy character/spirit card，`seatPresence` 不把对应角色卡计入新角色排座，避免双身份。

## 验收证据

- `pnpm build`：通过。
- 定向测试：`presence-initialization`、shared presence、server character API、Nook contract 共 23 项通过。
- `pnpm test`：1069 项中 1058 通过、11 项既有环境跳过、0 失败。
- `pnpm check:ws`、`check:bodies`、`check:docs`、`check:merge`：通过。
- `pnpm check:i18n`：键完整性通过；输出保留仓库既有未使用键 warning。
- 浏览器冒烟：实际模板 Nook 渲染了 `data-nook-zone="character-media"`，截图显示角色媒体与
  正文陈设同屏；切换 reduced-motion 后槽位不挂 video 而保留静态角色媒体。视频优先路径由
  `CharacterMedia` 定向测试与构建覆盖。
