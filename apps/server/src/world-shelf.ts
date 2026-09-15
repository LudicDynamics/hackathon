import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export class ShelfError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function entries(root: string) {
  const dirs = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  return (await Promise.all(dirs.filter(d => d.isDirectory() && !d.name.startsWith('.')).map(async d => {
    try {
      const dir = path.join(root, d.name);
      const manifest = JSON.parse(await fs.readFile(path.join(dir, 'world.json'), 'utf8'));
      if (typeof manifest.id !== 'string') return null;
      const times = await Promise.all(['world.json', '.airpworld/history.db', '.airpworld/history.db-wal', '.airpworld/canvas.db', '.airpworld/canvas.db-wal'].map(f => fs.stat(path.join(dir, f)).then(s => s.mtimeMs).catch(() => 0)));
      return { id: d.name, manifest, updatedAt: new Date(Math.max(...times)).toISOString() };
    } catch { return null; }
  }))).filter((e): e is NonNullable<typeof e> => e !== null);
}

const IMAGE_FILE = /\.(webp|png|jpe?g|avif)$/i;

/** The launcher cover: `world.json` `cover`, else the intro (or first) scene/background image. */
async function coverOf(dir: string, manifest: Record<string, unknown>): Promise<string | null> {
  const declared = typeof manifest.cover === 'string' ? manifest.cover.replace(/^\/+/, '') : '';
  if (declared && IMAGE_FILE.test(declared) && await fs.access(path.join(dir, declared)).then(() => true, () => false)) return declared;
  for (const folder of ['assets/scenes', 'assets/backgrounds']) {
    const files = (await fs.readdir(path.join(dir, folder)).catch(() => [] as string[])).filter(f => IMAGE_FILE.test(f)).sort();
    const pick = files.find(f => /^intro\./i.test(f)) ?? files[0];
    if (pick) return `${folder}/${pick}`;
  }
  return null;
}

const VIDEO_FILE = /\.(webm|mp4)$/i;

/** The launcher's moving cover: `world.json` `coverVideo`, else the world's intro video. */
async function coverVideoOf(dir: string, manifest: Record<string, unknown>): Promise<string | null> {
  const declared = typeof manifest.coverVideo === 'string' ? manifest.coverVideo.replace(/^\/+/, '') : '';
  if (declared && VIDEO_FILE.test(declared) && await fs.access(path.join(dir, declared)).then(() => true, () => false)) return declared;
  for (const folder of ['assets/motion/seedance/backgrounds', 'assets/scenes']) {
    const files = (await fs.readdir(path.join(dir, folder)).catch(() => [] as string[])).filter(f => VIDEO_FILE.test(f)).sort();
    const pick = files.find(f => /^intro\.webm$/i.test(f)) ?? files.find(f => /^intro[.-]/i.test(f));
    if (pick) return `${folder}/${pick}`;
  }
  return null;
}

/** Absolute path of a template's cover image or video, or null. Read-only; never leaves `templates/<id>/`. */
export async function templateCover(repoRoot: string, id: unknown, kind: 'image' | 'video' = 'image'): Promise<string | null> {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id)) return null;
  const root = await fs.realpath(path.join(repoRoot, 'templates')).catch(() => null);
  if (!root) return null;
  const dir = path.join(root, id);
  const manifest = await fs.readFile(path.join(dir, 'world.json'), 'utf8').then(JSON.parse, () => null);
  if (!manifest || typeof manifest !== 'object') return null;
  const rel = kind === 'video' ? await coverVideoOf(dir, manifest) : await coverOf(dir, manifest);
  if (!rel) return null;
  const file = await fs.realpath(path.join(dir, rel)).catch(() => null);
  return file && file.startsWith(root + path.sep) && (kind === 'video' ? VIDEO_FILE : IMAGE_FILE).test(file) ? file : null;
}

type ShelfGroup = {
  id: string;
  name: string;
  templatePath: string | null;
  /** Launcher cover URL (`/api/worlds/cover`), templates only. */
  cover: string | null;
  /** Launcher video URL (`/api/worlds/cover?kind=video`), templates with an intro video only. */
  coverVideo: string | null;
  locale: string | null;
  description: string;
  /** `world.json` `exp: true` — an experimental sandbox, not a shipped edition. */
  exp: boolean;
  saves: { id: string; path: string; updatedAt: string; active: boolean }[];
};

const text = (value: unknown) => (typeof value === 'string' ? value : '');

export async function readWorldShelf(repoRoot: string, activeRoot?: string) {
  const [allTemplates, worlds] = await Promise.all([entries(path.join(repoRoot, 'templates')), entries(path.join(repoRoot, 'worlds'))]);
  // `world.json` `exp: true` marks an experimental sandbox (templates/fpal). It
  // is deliberately NOT an edition, so it is kept out of the `templates`
  // edition-id list the edition gates compare against — but it stays in
  // `groups`, because the whole point is that a human can open it from the
  // Launcher. A sandbox only exists if it is visible AND does not redden the
  // edition corpus, so both halves belong here.
  const templates = allTemplates.filter(t => t.manifest.exp !== true);
  const expTemplates = allTemplates.filter(t => t.manifest.exp === true);
  const covers = new Map(await Promise.all(allTemplates.map(async t => [t.id, await coverOf(path.join(repoRoot, 'templates', t.id), t.manifest)] as const)));
  const videos = new Map(await Promise.all(allTemplates.map(async t => [t.id, await coverVideoOf(path.join(repoRoot, 'templates', t.id), t.manifest)] as const)));
  const groups = new Map<string, ShelfGroup>(allTemplates.map(t => [t.id, {
    id: t.id,
    name: String(t.manifest.name || t.id),
    templatePath: `templates/${t.id}`,
    cover: covers.get(t.id) ? `/api/worlds/cover?id=${encodeURIComponent(t.id)}` : null,
    coverVideo: videos.get(t.id) ? `/api/worlds/cover?id=${encodeURIComponent(t.id)}&kind=video` : null,
    locale: text(t.manifest.locale) || null,
    description: text(t.manifest.description),
    exp: t.manifest.exp === true,
    saves: [],
  }]));
  for (const save of worlds) {
    // Older scaffolded copies changed manifest.id; match the longest known
    // template prefix only as a fallback. Never group by translated display name.
    const template = allTemplates.find(t => t.manifest.id === save.manifest.id)
      ?? [...allTemplates].sort((a, b) => b.id.length - a.id.length).find(t => save.id.startsWith(`${t.id}-`));
    const groupId = template?.id ?? save.manifest.id;
    if (!groups.has(groupId)) groups.set(groupId, { id: groupId, name: String(save.manifest.name || groupId), templatePath: null, cover: null, coverVideo: null, locale: text(save.manifest.locale) || null, description: text(save.manifest.description), exp: save.manifest.exp === true, saves: [] });
    groups.get(groupId)!.saves.push({ id: save.id, path: `worlds/${save.id}`, updatedAt: save.updatedAt, active: activeRoot ? path.resolve(activeRoot) === path.join(repoRoot, 'worlds', save.id) : false });
  }
  for (const group of groups.values()) group.saves.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return {
    templates: templates.map(t => t.id),
    expTemplates: expTemplates.map(t => t.id),
    worlds: worlds.map(w => w.id),
    groups: [...groups.values()],
  };
}

/** Delete means recoverable rename, never recursive removal. */
export async function trashWorldSave(repoRoot: string, worldPath: unknown, activeRoot?: string) {
  if (typeof worldPath !== 'string' || !/^worlds\/[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(worldPath)) throw new ShelfError(400, 'Expected a saved world path.');
  const root = await fs.realpath(path.join(repoRoot, 'worlds'));
  const target = path.join(root, worldPath.slice('worlds/'.length));
  const stat = await fs.lstat(target).catch(() => null);
  if (!stat?.isDirectory() || stat.isSymbolicLink() || await fs.realpath(target) !== target) throw new ShelfError(404, 'Save not found.');
  if (activeRoot && await fs.realpath(activeRoot).catch(() => path.resolve(activeRoot)) === target) throw new ShelfError(409, 'Open another save before deleting the current one.');
  await fs.access(path.join(target, 'world.json'));
  const trash = path.join(root, '.trash');
  await fs.mkdir(trash, { recursive: true });
  if (await fs.realpath(trash) !== trash) throw new ShelfError(400, 'Invalid trash directory.');
  const destination = path.join(trash, `${path.basename(target)}-${randomUUID()}`);
  await fs.rename(target, destination);
  return { ok: true, recoveryPath: path.relative(repoRoot, destination) };
}
