# Agent 模型选择与执行进度

同步 main 时保留 niko 的画布和阅读布局，接入角色流式缓冲与私有小天地入口；角色公开帧经既有 `airp:agent-frame` 归属过滤，透明立绘与显示名保留。13 份新增模板角色 preset 补齐主线的 tools/tool-guidelines/skills、工具禁用表和 compaction 原文，不更改角色画像。常规 preset 门禁只检查版本化模板，`AIRP_CHECK_SAVES=1` 可额外审计本地旧存档及生成的 playtest，避免把开发者私有文件当 CI 前提。

顶部 Agents 面板按当前世界存档分别选择作家与角色模型、思考强度。模型列表读取 pi-rp `getAvailableModels`，不在前端硬编码；该列表表示引擎可解析，不保证供应商账户有访问权限或实时可用额度。默认保持既有模型，不自动降级。`off` 是 pi-rp 的关闭思考选项，由供应商适配器转换；前端同时显示实际运行模型和思考强度，不能把所选值冒充实际值。

`GET /api/agent-settings` 返回 world、preferences、writer、characters、models、busy、active、progress、queued；`?brief=true` 不重新枚举模型，用于收起面板时的低频状态同步。`POST /api/agent-settings` 接受 shared 的 `AgentModelSelectionSchema`：world、role（writer/character）、provider、model、thinking（off/low/medium/high）。world 必须与当前存档完全匹配，防止切换世界后的过期表单改错存档。运行或排队时返回 409，不中断当前回合。

设置原子写入 `<worldRoot>/.airpworld/model-preferences.json`，仅属引擎运行配置，不是叙事状态。启动参数覆盖环境默认值，不修改共享 `.pi/agent/settings.json`。作家重启复用原会话；已打开角色重启复用各自会话，未打开角色下次启动生效。实际模型不匹配时回滚配置并停止错误进程。密钥与供应商地址不发送浏览器。

生命周期向 WebSocket 发 `agent_progress`：source、可选 characterId、stage、startedAt、updatedAt、busy。只传可公开的工作阶段，不传思考内容。读取场景、书写、更新世界、Chalk 已落板但仍收尾、完成分开显示。前端底部行动入口显示阶段及秒数，顶部面板可查模型。最终以 agent_settled 为完成；停止按钮等待真实结束事件，不立即伪装完成。轮询恢复重连后的状态；不显示猜测的百分比。

测试 `apps/server/test/model-settings.test.mjs` 覆盖按世界隔离、角色分离、忙碌拒绝、落板/结束差别；构建与门禁探针另行运行。真实模型调用延迟需单独 A/B 实测，模型切换成功不代表叙事性能验收通过。
