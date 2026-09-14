# 合并七海本机 TTS 与前端语音设置到 niko

> 合并 `aad5bf3` · 父提交 `bb4511f`（ours，niko）与 `061786a`（theirs，`origin/feat/nanami-local-tts`）· 作者 niko · 2026-09-14
> 来源分支：`origin/feat/nanami-local-tts`（七海本机 TTS、线上兜底与设置面板）。
> 本登记为补写：合并当时只留了不合规命名的 `niko-nanami-local-tts-2026-09-14.md`，其内容已并入本文件。

## 1. 这次合了什么

- **对方带来的**：`apps/server/src/routes/local-tts.ts`（角色本机音色优先、失败回落线上，回落时带 `X-AIRP-TTS-Fallback: local-to-online` 头）；`NanamiTtsSettings` 面板与 `nanami-tts-settings` 输入校验；`ConnectionSettings` 的本机字段；英中日文案；独立音量控制测试；`docs/tts/10`。
- **我方带来的**：`bb4511f` 同槽多份材料（`maxItems`）与生图失败诊断修正。
- **两侧同时改的**：无文本冲突。

## 2. 冲突处理

在临时 worktree 以 `bb4511f` 重放 `git merge --no-commit --no-ff 061786a`：**0 个冲突文件**。与 `aad5bf3` 逐文件对比，唯一差异是合并提交里新增的说明文件（即上面提到的旧说明），没有手工改动任何代码。

**静默丢失自查**：两个父提交到合并结果均无删除文件（`git diff --diff-filter=D` 为空）；`bb4511f` 的 `maxItems` 与生图修正都在合并结果里。

**后续事故（登记在此以便追溯）**：这次带进来的七海本机能力，在下一次合并 `271cb3c`（main → niko）里被部分吃掉——服务端本机路由、面板挂载点、`/api/tts` 请求体里的 `characterId`/`emotion`、一批翻译键；同时 `bb4511f` 的同槽多份材料也被整体覆盖。处置见 `docs/merge/niko-骰子奖励与双语模板-271cb3c-niko.md`。

## 3. 验证

- **合并当时**（引自原说明，本次未重跑）：全仓构建通过；TTS 路由/设置/音量、材料多选与图片适配器共 51 项定向测试通过；没有发起线上收费合成。真实本机健康检查返回 ready / setsuna，没有据此声称 Vera 的独立音色可用。
- **补登记时**（2026-09-14）：重放确认无冲突。在临时 worktree 对 `aad5bf3` 全量跑测，740 项中 618 通过、39 失败；但该 worktree 缺 `vendor/pi-rp` 构建产物、server 构建失败，这个数字不代表 `aad5bf3` 本身的质量，只作为 `271cb3c` 回归比对的参照。
- **未决/遗留**：Vera 本机声音的选择另行确认。当时 `origin/main@65fa09d` 的完整合并被撤回、等待取舍，之后已在 `271cb3c` 完成。
