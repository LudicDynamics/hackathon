# Canvas 主题曲迁移

以 `worldlines-canvas/app/src/app.js` 的 `BGM_TRACKS` 与 `app/media/CREDITS.md` 为映射及署名来源。五首原曲逐字节迁入 `assets/audio/themes/canvas-<world>.mp3`，不裁切、不转码，不覆盖 main 原有 Freesound 素材。

四个已迁移世界 wuwu / whitechapel / divergence / firstsnow 的 `world.json` 声明 `audio.theme: canvas-<world>`，复用既有 `/api/manifest → useAudio.setTheme` 通道。各层未声明 BGM 时保留主题曲，不以材质 tone 推断音乐。

mistport 的 Piano 36 已入库，但该世界模板尚未迁入，不伪造一个空世界。原有 holmes-world / magic-academy 配曲不变。

署名见 `assets/audio/CREDITS.md`。测试 `node --test tools/canvas-themes.test.mjs` 校验原曲哈希、世界映射与未裁切文件；浏览器验证 manifest URL、解码和播放信号。用户已有的世界存档不批量覆写，本次只更新模板。
