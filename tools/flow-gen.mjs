#!/usr/bin/env node
/**
 * flow-gen.mjs — generate images and videos through the local Flow Proxy API.
 *
 * The proxy (../flow-proxy-api, default :8317) wraps Google Flow's
 * `aisandbox-pa.googleapis.com` endpoints and hides the messy parts: SAPISIDHASH
 * auth, project bootstrap, access-token refresh, model-key fallback, and the
 * signed-CDN URL round trip. This tool is the thin client on top of it — one
 * command per job, files on disk.
 *
 * WHY A TOOL AND NOT raw curl:
 *   - video is asynchronous: submit -> poll -> download. Three calls, and the
 *     download URL must be re-fetched per request because the CDN signature
 *     expires. Doing that by hand invites "why is my link 403".
 *   - image responses can be a URL, a base64 blob, or a bare media id. This tool
 *     normalises all three to "a file on disk".
 *   - the proxy's API key is a shared local secret; nobody should be pasting it
 *     into a shell history full of curl invocations.
 *
 * Usage:
 *   node tools/flow-gen.mjs image --prompt "..." [options]
 *   node tools/flow-gen.mjs video --prompt "..." [options]
 *   node tools/flow-gen.mjs credits
 *   node tools/flow-gen.mjs models
 *
 * Run `node tools/flow-gen.mjs --help` for the full option list.
 *
 * Producer runbook + the upstream traps behind these flags:
 *   assets/skills/flow-media/SKILL.md
 */

import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------

const BASE = (process.env.FLOW_API_BASE || 'http://127.0.0.1:8317').replace(/\/+$/, '');
const KEY = process.env.FLOW_API_KEY || '';

/**
 * Poll ceiling for a video job. Veo 3.1 fast/lite finish in ~20s in practice;
 * 15 min is generous headroom for a queue stall, and it is a *client-side*
 * ceiling only — the proxy keeps polling server-side either way.
 */
const VIDEO_TIMEOUT_MS = Number(process.env.FLOW_VIDEO_TIMEOUT_MS || 15 * 60 * 1000);

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function die(msg, code = 1) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(code);
}

function human(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** `--flag value`, `--flag=value`, bare `--flag`, and `-o`. */
function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '-o') opts.out = argv[++i];
    else if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) opts[a.slice(2, eq)] = a.slice(eq + 1);
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('-')) opts[a.slice(2)] = argv[++i];
      else opts[a.slice(2)] = true;
    } else opts._.push(a);
  }
  return opts;
}

/** Filename-safe slug for the default output name. */
function slugify(text, max = 40) {
  const s = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s.slice(0, max).replace(/-+$/, '') || 'untitled';
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Decide the destination path.
 *   - `--out` names a directory (existing dir, or trailing slash)  -> auto-name inside it
 *   - `--out` names a file                                         -> use it verbatim
 *   - no `--out`                                                   -> auto-name in cwd
 * The extension is finalised later from the response content-type.
 */
function resolveOut(opts, kind, prompt) {
  const auto = (ext) => `flow-${kind}-${slugify(prompt)}-${stamp()}${ext}`;
  const out = opts.out;
  if (!out) return { dir: process.cwd(), name: auto, pinned: false };
  if (out.endsWith(path.sep) || out.endsWith('/')) return { dir: path.resolve(out), name: auto, pinned: false };
  const abs = path.resolve(out);
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) return { dir: abs, name: auto, pinned: false };
  return { dir: path.dirname(abs), name: () => path.basename(abs), pinned: true };
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function api(endpoint, { method = 'GET', body, timeoutMs = 60_000 } = {}) {
  const headers = {};
  if (KEY) headers.authorization = `Bearer ${KEY}`;
  if (body !== undefined) headers['content-type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${BASE}${endpoint}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e.name === 'TimeoutError') throw new Error(`请求超时（${timeoutMs / 1000}s）: ${endpoint}`);
    throw new Error(
      `连不上代理服务 ${BASE}（${e.message}）。\n` +
        `  启动：cd ../flow-proxy-api && node server.js\n` +
        `  换地址：FLOW_API_BASE=http://127.0.0.1:<port>`
    );
  }

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* upstream error pages are occasionally not JSON */
  }

  if (!res.ok) {
    const detail = json?.error?.message || json?.error || text.slice(0, 300);
    if (res.status === 401) {
      throw new Error(
        `代理拒绝鉴权（HTTP 401）：${detail}\n` +
          `  设置正确的密钥：FLOW_API_KEY=<config.yaml 里 api-keys 的那一串>`
      );
    }
    throw new Error(`${endpoint} → HTTP ${res.status}: ${detail}`);
  }
  return json ?? text;
}

/** Stream a URL to disk. Proxy-relative URLs need the bearer; CDN links must not get it. */
async function download(url, dest) {
  const headers = {};
  if (url.startsWith(BASE) || url.startsWith('/')) {
    if (KEY) headers.authorization = `Bearer ${KEY}`;
  }
  const res = await fetch(url.startsWith('/') ? `${BASE}${url}` : url, {
    headers,
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}: ${url.slice(0, 120)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error(`下载内容为空: ${url.slice(0, 120)}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return { bytes: buf.length, type: (res.headers.get('content-type') || '').split(';')[0] };
}

/** Local file -> data URL, so `--image` accepts a path on disk. */
function fileToDataUrl(p) {
  const abs = path.resolve(p);
  if (!fs.existsSync(abs)) die(`找不到图片文件: ${abs}`);
  const ext = path.extname(abs).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${fs.readFileSync(abs).toString('base64')}`;
}

function save(url, out, kind, prompt) {
  const ext = EXT_BY_MIME[out.type] || (kind === 'video' ? '.mp4' : '.jpg');
  let name = out.name(ext);
  if (out.pinned && !path.extname(name)) name += ext;
  return path.join(out.dir, name);
}

/**
 * The proxy reports the *upstream key it actually submitted* in `model`
 * (`abra_t2v_4s_360p`, `veo_3_1_t2v_lite`, ...). Comparing it against the
 * request is how a silent downgrade becomes visible.
 *
 * Two key dialects exist upstream and they do NOT share a shape:
 *   abra: abra_{t2v|i2v|fl|r2v}_{N}s            <- duration only, NO resolution
 *   veo : veo_3_1_{t2v|i2v}_{variant}[_{N}s]    <- spec in the variant name
 *
 * abra carries its resolution in the request body (outputSpec), not the key —
 * probing proved `abra_t2v_8s_720p` does not exist upstream (404) while
 * `abra_t2v_8s` does. veo is the opposite: resolution is baked into the
 * variant, and sending outputSpec gets rejected as 400 INVALID_ARGUMENT.
 * So only abra's *duration* is checkable from the key; resolution is not.
 */
function parseUpstreamKey(key) {
  const s = String(key || '');
  const abra = s.match(/^abra_(t2v|i2v|fl|r2v)_(\d+)s(?:_(\d{3,4})p)?$/);
  if (abra) return { family: 'abra', kind: abra[1], seconds: Number(abra[2]), res: abra[3] ? Number(abra[3]) : null };
  // veo_3_1_t2v_lite / veo_3_1_t2v_fast_8s / veo_3_1_i2v_s_fast_fl
  const veo = s.match(/^veo_3_1_(t2v|i2v)_(.+)$/);
  if (veo) {
    const t = veo[2].match(/_(\d+)s$/);
    return { family: 'veo', kind: veo[1], seconds: t ? Number(t[1]) : null, res: null };
  }
  return null;
}

/** Warn when the finished clip does not match what was requested. */
function reportDowngrade(task, want) {
  const got = parseUpstreamKey(task.model);
  if (!got) return;
  const diffs = [];
  if (want.seconds && got.seconds && got.seconds !== Number(want.seconds)) {
    diffs.push(`时长 ${want.seconds}s → ${got.seconds}s`);
  }
  // Resolution is only meaningful for abra; veo encodes it in the variant name.
  if (want.res && got.res && got.res !== Number(String(want.res).replace(/p$/i, ''))) {
    diffs.push(`分辨率 ${want.res}p → ${got.res}p`);
  }
  if (diffs.length) {
    console.log(
      `  ⚠ 上游拒绝了请求的参数，已静默降级（${diffs.join('，')}）。\n` +
        `    实际使用 key：${task.model}\n` +
        `    按上游实际支持的组合重来，或接受降级；别把它当成成功。`
    );
  }
}

// ---------------------------------------------------------------------------
// commands
// ---------------------------------------------------------------------------

async function cmdImage(opts) {
  const prompt = opts.prompt || opts._[1];
  if (!prompt) die('缺少 --prompt');

  const body = { model: opts.model || 'nano-banana-2-lite', prompt };
  if (opts.aspect) body.aspect_ratio = opts.aspect;
  // 2K 是生成后的二次放大（4K 需更高订阅档，不支持），返回 base64 而非 URL。
  if (String(opts.resolution || '').toLowerCase() === '2k') body.resolution = '2k';

  const out = resolveOut(opts, 'image', prompt);
  console.log(`生图  model=${body.model} aspect=${body.aspect || '(默认 landscape)'}${body.resolution ? ` resolution=${body.resolution}` : ''}`);

  const t0 = Date.now();
  const json = await api('/v1/images/generations', { method: 'POST', body, timeoutMs: 300_000 });
  const item = (json?.data || [])[0];
  if (!item) die(`上游未返回图片: ${JSON.stringify(json).slice(0, 300)}`);

  const written = [];
  let index = 0;
  for (const it of json.data) {
    let dest;
    if (it.url) {
      const probe = out;
      // first item keeps the auto name; extras get a -2/-3 suffix
      const name = (ext) => {
        const base = probe.name(ext);
        return index === 0 ? base : base.replace(/(\.[a-z0-9]+)$/i, `-${index + 1}$1`);
      };
      const guess = path.join(out.dir, name('.jpg'));
      const got = await download(it.url, guess);
      const ext = EXT_BY_MIME[got.type] || '.jpg';
      dest = ext === '.jpg' ? guess : path.join(out.dir, name(ext));
      if (dest !== guess) fs.renameSync(guess, dest);
      written.push({ dest, bytes: got.bytes, type: got.type, remote: it.url });
    } else if (it.b64_json) {
      const buf = Buffer.from(it.b64_json, 'base64');
      // 上游 2K 放大返回的是 JPEG（实测 2752x1536），别硬编码成 .png——
      // 按魔数判断，避免扩展名与内容不符。
      const mime = buf[0] === 0xff && buf[1] === 0xd8 ? 'image/jpeg'
        : buf[0] === 0x89 && buf[1] === 0x50 ? 'image/png'
        : 'image/jpeg';
      dest = save(it, { ...out, type: mime }, 'image', prompt);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
      written.push({ dest, bytes: buf.length, type: mime });
    } else {
      console.log(`  ⚠ 第 ${index + 1} 张没有可下载内容（只有 media_id=${it.media_id}）`);
    }
    index++;
  }
  if (!written.length) die('没有下载到任何图片');

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  for (const w of written) console.log(`  ✓ ${w.dest}  (${human(w.bytes)}, ${w.type})`);
  console.log(`  用时 ${secs}s${json.credits_remaining != null ? `，剩余额度 ${json.credits_remaining}` : ''}`);
  if (opts.json) console.log('\n' + JSON.stringify({ files: written, elapsed_s: Number(secs) }, null, 2));
}

async function cmdVideo(opts) {
  const prompt = opts.prompt || opts._[1];
  if (!prompt) die('缺少 --prompt');

  const body = { model: opts.model || 'veo-3.1-lite', prompt };
  if (opts.seconds) body.seconds = Number(opts.seconds);
  if (opts.resolution) body.resolution = String(opts.resolution).replace(/p$/i, '');
  if (opts.aspect) body.aspect_ratio = opts.aspect;
  if (opts.image) body.image = /^https?:|^data:/.test(opts.image) ? opts.image : fileToDataUrl(opts.image);

  const out = resolveOut(opts, 'video', prompt);
  console.log(`生视频  model=${body.model}${body.seconds ? ` seconds=${body.seconds}` : ''}${body.resolution ? ` resolution=${body.resolution}p` : ''}`);
  console.log(`        prompt="${String(prompt).slice(0, 70)}${String(prompt).length > 70 ? '…' : ''}"`);
  if (opts.image) console.log(`        首帧图片：${opts.image.startsWith('data:') ? '(本地文件已内联)' : opts.image}`);

  const t0 = Date.now();
  const job = await api('/v1/videos/generations', { method: 'POST', body, timeoutMs: 180_000 });
  const id = job?.id;
  if (!id) die(`提交失败，未拿到任务 id: ${JSON.stringify(job).slice(0, 300)}`);
  console.log(`        任务 ${id}  状态=${job.status}${job.credits_remaining != null ? `  剩余额度 ${job.credits_remaining}` : ''}`);

  // Poll. The proxy refreshes the upstream status on each query, so a plain
  // fixed-ish interval is right; back off a little to be polite on long jobs.
  let delay = 3000;
  let task = job;
  for (;;) {
    if (task.status === 'completed') break;
    if (task.status === 'failed') die(`任务失败: ${task.error || '未知原因'}`);

    const left = VIDEO_TIMEOUT_MS - (Date.now() - t0);
    if (left <= 0) {
      die(
        `等待超时（${VIDEO_TIMEOUT_MS / 1000}s），任务 ${id} 仍在 ${task.status}。\n` +
          `  任务没有丢，可稍后用同一 id 取回：node tools/flow-gen.mjs fetch --id ${id}\n` +
          `  拉长上限：FLOW_VIDEO_TIMEOUT_MS=${VIDEO_TIMEOUT_MS * 2}`
      );
    }
    await sleep(Math.min(delay, left));
    delay = Math.min(delay + 2000, 8000);
    task = await api(`/v1/videos/${id}`, { timeoutMs: 60_000 });
    const pct = task.progress != null ? ` ${task.progress}%` : '';
    const stage = task.upsample === 'submitted' ? '1080p 升采样' : task.upsample === 'pending' ? '生成' : '';
    process.stdout.write(
      `\r        生成中… ${task.status}${pct}${stage ? ` [${stage}]` : ''}  (${((Date.now() - t0) / 1000).toFixed(0)}s)   `
    );
  }
  process.stdout.write('\r' + ' '.repeat(78) + '\r');

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  // `/content` re-signs the CDN URL on every call, so never reuse a stored link.
  const dest = save({ url: '', type: '' }, out, 'video', prompt);
  const got = await download(`/v1/videos/${id}/content`, dest);
  console.log(`  ✓ ${dest}  (${human(got.bytes)}, ${got.type || 'video/mp4'})`);
  reportDowngrade(task, { seconds: body.seconds, res: body.resolution });
  // 1080p 是生成后的二次放大，失败时会**静默回退成 720p**——必须说出来。
  if (task.upsample === 'failed') {
    console.log(`  ⚠ 1080p 升采样失败，已回退为原始 720p：${task.upsample_error || '原因未上报'}`);
  } else if (task.upsample === 'submitted') {
    console.log(`  ✓ 已升采样至 1080p`);
  }
  console.log(`  用时 ${secs}s${task.credits_remaining != null ? `，剩余额度 ${task.credits_remaining}` : ''}`);
  if (opts.json) {
    console.log(
      '\n' +
        JSON.stringify(
          {
            id,
            file: dest,
            bytes: got.bytes,
            type: got.type,
            elapsed_s: Number(secs),
            upstream_key: task.model,
            size: task.size,
            upsample: task.upsample ?? null,
            remote_url: task.video?.remote_url,
          },
          null,
          2
        )
    );
  }
}

/** Re-fetch an already-submitted job (useful after a client timeout). */
async function cmdFetch(opts) {
  const id = opts.id;
  if (!id) die('缺少 --id');
  const prompt = opts.prompt || id;
  const out = resolveOut(opts, 'video', prompt);
  const task = await api(`/v1/videos/${id}`);
  console.log(`任务 ${id}  状态=${task.status}`);
  if (task.status !== 'completed') die(`任务尚未完成（${task.status}）${task.error ? `：${task.error}` : ''}`);
  const dest = save({ url: '', type: '' }, out, 'video', prompt);
  const got = await download(`/v1/videos/${id}/content`, dest);
  console.log(`  ✓ ${dest}  (${human(got.bytes)}, ${got.type})`);
}

async function cmdCredits() {
  const json = await api('/v1/credits');
  console.log(JSON.stringify(json, null, 2));
}

async function cmdModels() {
  const json = await api('/v1/models');
  const rows = (json?.data || []).map((m) => [m.id, m.kind || '-', m.default_key || '']);
  const w = Math.max(...rows.map((r) => r[0].length), 6);
  for (const [id, kind, def] of rows) {
    console.log(`  ${id.padEnd(w)}  ${kind.padEnd(6)}  ${def}`);
  }
  console.log(`\n  ${rows.length} 个模型（${rows.filter((r) => r[1] === 'video').length} 视频 / ${rows.filter((r) => r[1] === 'image').length} 图片）`);
}

// ---------------------------------------------------------------------------
// cli
// ---------------------------------------------------------------------------

const HELP = `
flow-gen — 通过本地 Flow 代理生成图片与视频

用法:
  node tools/flow-gen.mjs image  --prompt "描述" [选项]
  node tools/flow-gen.mjs video  --prompt "描述" [选项]
  node tools/flow-gen.mjs fetch  --id <任务id> [选项]     拉取已提交的任务
  node tools/flow-gen.mjs credits                        查询剩余额度
  node tools/flow-gen.mjs models                         列出可用模型

通用选项:
  -o, --out <路径>     输出文件或目录（默认：当前目录，自动命名）
      --json           额外输出一份机器可读的结果 JSON
  -h, --help           显示本帮助

image 选项:
      --model <名>     默认 nano-banana-2-lite
      --aspect <比例>  landscape | portrait | square | four-three | three-four
      --resolution 2k  走生成后的二次放大（4K 需更高订阅档，不支持）

video 选项:
      --model <名>     默认 veo-3.1-lite（720p）
      --seconds <4|6|8>      时长（默认 4）
      --resolution <360|720|1080>  360/720 为生成档位(仅 omni 可调，默认 720)；1080 走生成后的升采样(4K 需更高订阅档)
      --aspect <比例>  landscape | portrait
      --image <路径|URL>     首帧图片（本地路径会内联为 data URL），走图生视频

环境变量:
  FLOW_API_BASE          代理地址，默认 http://127.0.0.1:8317
  FLOW_API_KEY           代理的 API Key（对应 config.yaml 的 api-keys）
  FLOW_VIDEO_TIMEOUT_MS  视频轮询上限，默认 900000（15 分钟）

示例:
  node tools/flow-gen.mjs image --prompt "黄昏的海边灯塔，赛璐璐动画风" -o assets/_inbox/
  node tools/flow-gen.mjs video --prompt "海浪拍打礁石" --seconds 6 --resolution 720p -o out.mp4
  node tools/flow-gen.mjs video --prompt "烛光摇曳" --resolution 1080p -o out.mp4   # 生成后自动升采样
  node tools/flow-gen.mjs image --prompt "海边灯塔" --resolution 2k -o out.jpg
  node tools/flow-gen.mjs video --prompt "让她微微转头" --image assets/_inbox/base.png -o ./  # 图生视频
`;

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv[0] === '--help' || argv[0] === '-h') {
    console.log(HELP.trim());
    return;
  }
  const cmd = argv[0];
  const opts = parseArgs(argv.slice(1));
  if (opts.help) {
    console.log(HELP.trim());
    return;
  }

  switch (cmd) {
    case 'image':
      return cmdImage(opts);
    case 'video':
      return cmdVideo(opts);
    case 'fetch':
      return cmdFetch(opts);
    case 'credits':
      return cmdCredits();
    case 'models':
      return cmdModels();
    default:
      die(`未知子命令: ${cmd}\n  可用: image | video | fetch | credits | models`);
  }
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}\n`);
  process.exit(1);
});
