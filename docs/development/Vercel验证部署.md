# Vercel 验证部署

这是验证部署入口，**容器部署成功，但未通过可玩性验收**。使用 Vercel Container Images（Beta），保留现有 Express、WebSocket、pi-rp 子进程和 SQLite，不拆业务路由。

## 2026-09-14 实测

测试项目：`nikolosides-projects/airp-vercel-check`。部署记录：[首个验证部署](https://vercel.com/nikolosides-projects/airp-vercel-check/9o7RMiaQfYwDQEdfuJ9fkujbCEua)。站点保留 Vercel 登录保护，未上传模型密钥。

| 项目 | 结果 |
|---|---|
| 本机生产构建、Linux 容器构建 | 通过 |
| 云端容器构建与启动 | 通过，前后端和 pi-rp 均完成构建 |
| `/api/worlds` | 返回全部 14 个双语模板 |
| 线上 `/ws` | 成功连接 |
| 选择 `templates/wuwu-jp` | HTTP 200，临时存档创建成功 |
| 随后顺序读取 manifest 3 次 | 3 次均为 200 |
| 随后并发读取 manifest 8 次 | 4 次为 200；4 次为 `409 no_active_world` |
| 拿取选项 | HTTP 200；观察 1.5 秒，原 WS 未收到 `world_event` |
| 真实作家生成 | 未验收，验证项目未配置模型密钥 |

复测客户端保留响应 cookie，排除了漏带 cookie 的因素。结果说明当前实例内存和本地存档未在 HTTP 与 WS 间保持一致；问题发生在正常请求阶段，不能由断线重连独自修复。不要把此 URL 当成已跑通的可玩版本。

本次相关门禁 `check:ws`、`check:bodies`、`check:docs`、`check:i18n` 通过。全量门禁未全绿：本机 Node 26 的目录测试入口报错、测试 provider/Agent 探针失败、旧存档 skill 重名、模板音色/素材不一致，以及既有合并 `aad5bf3` 缺登记，均未在本次部署改动中修正。

## 运行边界

- `Dockerfile.vercel` 构建引擎、共享包、服务端和前端；整个应用通过同一个容器入口提供服务。
- `tools/start-vercel.mjs` 在临时目录准备可写的 `worlds/`、`.pi/agent/`，通过 `AIRP_REPO_ROOT` 交给服务端；模板和代码只链接到构建产物。
- 冷启动没有活跃世界，复用现有 `409 no_active_world` 和世界选择流程。玩家选择模板后复制到临时存档，不修改打包模板。
- 容器本地存档不是持久存储。新实例不能恢复旧实例的进度，也不自动重新创建已丢失存档。
- 前端已有 `useWorld` 重连：断开后每 1.2 秒重试；连接打开后清除作家忙态并重新读取当前层。不重放玩家请求，以免重复执行。
- 同一条 WebSocket 的消息绑定同一实例，但独立 HTTP 请求和重连不保证进入该实例。现有全局活跃世界与广播仍是单实例设计。**必须实测 HTTP/WS 一致性；仅能打开页面或重连成功不算跑通。**

## 本机 TTS（Tailscale Funnel）

七海等角色的本机音色服务（setsuna）目前只在 Tailscale 内网可达（`100.x` 地址），Vercel 容器不在 tailnet 里，无法直接访问。2026-09-14 定案：用 **Tailscale Funnel** 把 TTS 机器发布为公网 HTTPS 地址，代码不改。

1. 在运行本机 TTS 的机器上开启 Funnel，把 TTS 端口（如 `8090`）发布出去，得到 `https://<机器名>.<tailnet>.ts.net` 这样的地址。
2. 部署环境变量：`AIRP_TTS_LOCAL_BASE_URL` 设为该 HTTPS 地址（不带 `/v1/tts`），`AIRP_TTS_LOCAL_API_KEY` 设为 TTS 服务要求的密钥。地址公开之后，**必须**靠密钥挡住外部调用。
3. 其余本机音色设置（`AIRP_TTS_LOCAL_VOICE`、`AIRP_TTS_CHARACTER_VOICES`、`AIRP_TTS_LOCAL_TIMEOUT_MS`）照旧。

Funnel 不可达或超时时，`/api/tts` 仍按现有逻辑回落线上千问，并带 `X-AIRP-TTS-Fallback: local-to-online` 响应头，玩家不会没有声音。验收时确认：部署实例能用本机音色合成一页台词；关掉 Funnel 后同一页回落线上。

## 构建与验证

在包含完整 `vendor/pi-rp` 子模块的仓库根目录执行：

```sh
docker build -f Dockerfile.vercel -t airp-vercel-check .
docker run --rm -p 3080:80 airp-vercel-check
```

Docker 专用忽略文件排除本地环境变量、密钥配置、会话、存档和构建缓存。实际模型密钥通过部署环境变量注入，不复制本机 `.env.local` 或 `.pi/agent/`。沿用 `AIRP_WRITER_MODEL` 等现有设置；不配置密钥只能验收页面和无需模型的动作。

Vercel 项目根目录设为仓库根目录，Framework Preset 设为 `Container`，入口为 `Dockerfile.vercel`。端口使用 `80`。在独立测试项目验收后再作为可玩入口；Vercel 会把新项目的首次部署自动归为 Production，即使没有传 `--prod`。

```sh
vercel project update airp-vercel-check --framework container --yes
vercel deploy --dry --project airp-vercel-check --json
vercel deploy --project airp-vercel-check --yes --archive=tgz --no-wait
```

上传前检查 dry-run 清单：必须包含服务端、引擎、模板和启动脚本，不能包含 `.pi/`、`.airpworld/`、本地环境变量或 `worlds/`。`.vercelignore` 与 `.dockerignore` 分别控制上传与镜像上下文，目录例外语法不同，不直接互换。

验收项目：

1. 冷启动打开世界选择；选择模板后 `/api/manifest` 与 `/api/layer` 属于该存档。
2. 执行一个选项，HTTP 成功且同一浏览器收到相应 `world_event`。
3. Send 触发真实作家，收到进度、Chalk 落盘并可重新读取。
4. 短暂断网再恢复，重连后读取已有场景，不重复发送原请求。
5. 实例回收后回到世界选择，不把旧画布当成已恢复存档。
6. 第二个浏览器及并发 HTTP 请求验证实例分流；若发生世界不一致，该版本不能作为多人入口。

## 平台依据

- [Container Images](https://vercel.com/docs/functions/container-images)：容器部署及自动缩容。
- [WebSockets](https://vercel.com/docs/functions/websockets)：连接时限、重连和跨实例状态要求。
- [Functions Limits](https://vercel.com/docs/functions/limitations)：执行时间等套餐限制。

此部署入口不改变本地 `pnpm dev` / `pnpm build` 的默认运行方式。
