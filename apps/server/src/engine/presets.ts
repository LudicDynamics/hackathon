import fs from 'node:fs';
import path from 'node:path';

/**
 * AIRP 的工程配置目录名（世界内的系统目录，见 doc-05 §7.4）。
 *
 * 它同时是 pi-rp 的 `PI_PROJECT_CONFIG_DIR`：只有设成这个值，
 * pi-rp 才会去 `<worldRoot>/.airpworld/{prompt-presets,openings}/` 找东西。
 */
export const AIRP_CONFIG_DIR = '.airpworld';

/** 判断一个 preset 文件是不是合法的 pi-rp preset（顶层必须有 items）。 */
export function readPresetId(file: string): string | undefined {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as { id?: unknown };
    return typeof parsed?.id === 'string' && parsed.id ? parsed.id : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 把 preset 装进世界的 `<worldRoot>/.airpworld/prompt-presets/`，返回它的 id。
 *
 * 为什么必须"安装"而不是直接把文件路径传给引擎：
 *  - pi-rp 的 `--preset` 只接受 preset 的 **id**，传绝对路径会得到
 *    `Warning: Prompt preset "…" not found` 并静默回退到默认预设；
 *  - preset 发现只扫 `<configDir>/prompt-presets/` 的**顶层** `*.json`，不递归子目录，
 *    所以角色目录里的 `characters/<名>/preset.json` 天生发现不了。
 */
export function installPreset(worldRoot: string, srcFile: string): string {
  const id = readPresetId(srcFile);
  if (!id) throw new Error(`preset "${srcFile}" 不是合法 pi-rp preset（缺少顶层 id）`);
  const dir = path.join(worldRoot, AIRP_CONFIG_DIR, 'prompt-presets');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(srcFile, path.join(dir, `${id}.json`));
  return id;
}

/**
 * 组装 spawn pi-rp 进程需要的环境变量。
 *
 * `PI_PROJECT_CONFIG_DIR` 是总开关：设了它，prompt-presets 与 openings 才会落在
 * 世界的 `.airpworld/` 下。`PI_OPENING` 取 **opening 预设的 id**（不是文件路径），
 * 只有 `<worldRoot>/.airpworld/openings/<id>.json` 真实存在时才设，否则留空让
 * opening 扩展零开销跳过。
 */
export function airpEnv(worldRoot: string, openingId?: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { PI_PROJECT_CONFIG_DIR: AIRP_CONFIG_DIR };
  if (openingId) {
    const openingFile = path.join(worldRoot, AIRP_CONFIG_DIR, 'openings', `${openingId}.json`);
    if (fs.existsSync(openingFile)) env.PI_OPENING = openingId;
  }
  return env;
}
