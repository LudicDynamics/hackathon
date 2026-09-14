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

/** Absolute path of a template's cover, or null. Read-only; never leaves `templates/<id>/`. */
export async function templateCover(repoRoot: string, id: unknown): Promise<string | null> {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id)) return null;
  const root = await fs.realpath(path.join(repoRoot, 'templates')).catch(() => null);
  if (!root) return null;
  const dir = path.join(root, id);
  const manifest = await fs.readFile(path.join(dir, 'world.json'), 'utf8').then(JSON.parse, () => null);
  if (!manifest || typeof manifest !== 'object') return null;
  const rel = await coverOf(dir, manifest);
  if (!rel) return null;
  const file = await fs.realpath(path.join(dir, rel)).catch(() => null);
  return file && file.startsWith(root + path.sep) && IMAGE_FILE.test(file) ? file : null;
}

type ShelfGroup = {
  id: string;
  name: string;
  templatePath: string | null;
  /** Launcher cover URL (`/api/worlds/cover`), templates only. */
  cover: string | null;
  locale: string | null;
  description: string;
  saves: { id: string; path: string; updatedAt: string; active: boolean }[];
};

const text = (value: unknown) => (typeof value === 'string' ? value : '');

export async function readWorldShelf(repoRoot: string, activeRoot?: string) {
  const [templates, worlds] = await Promise.all([entries(path.join(repoRoot, 'templates')), entries(path.join(repoRoot, 'worlds'))]);
  const covers = new Map(await Promise.all(templates.map(async t => [t.id, await coverOf(path.join(repoRoot, 'templates', t.id), t.manifest)] as const)));
  const groups = new Map<string, ShelfGroup>(templates.map(t => [t.id, {
    id: t.id,
    name: String(t.manifest.name || t.id),
    templatePath: `templates/${t.id}`,
    cover: covers.get(t.id) ? `/api/worlds/cover?id=${encodeURIComponent(t.id)}` : null,
    locale: text(t.manifest.locale) || null,
    description: text(t.manifest.description),
    saves: [],
  }]));
  for (const save of worlds) {
    // Older scaffolded copies changed manifest.id; match the longest known
    // template prefix only as a fallback. Never group by translated display name.
    const template = templates.find(t => t.manifest.id === save.manifest.id)
      ?? [...templates].sort((a, b) => b.id.length - a.id.length).find(t => save.id.startsWith(`${t.id}-`));
    const groupId = template?.id ?? save.manifest.id;
    if (!groups.has(groupId)) groups.set(groupId, { id: groupId, name: String(save.manifest.name || groupId), templatePath: null, cover: null, locale: text(save.manifest.locale) || null, description: text(save.manifest.description), saves: [] });
    groups.get(groupId)!.saves.push({ id: save.id, path: `worlds/${save.id}`, updatedAt: save.updatedAt, active: activeRoot ? path.resolve(activeRoot) === path.join(repoRoot, 'worlds', save.id) : false });
  }
  for (const group of groups.values()) group.saves.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { templates: templates.map(t => t.id), worlds: worlds.map(w => w.id), groups: [...groups.values()] };
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
