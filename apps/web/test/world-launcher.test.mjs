// World launcher helpers (docs/ui/世界Launcher.md).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createJiti } from '../../../vendor/pi-rp/node_modules/jiti/lib/jiti.mjs';

const launcher = await createJiti(import.meta.url, { moduleCache: false }).import('../src/lib/world-launcher.ts');

const group = (id, locale, extra = {}) => ({
  id, name: `${id} · edition`, templatePath: `templates/${id}`, cover: `/api/worlds/cover?id=${id}`,
  locale, description: '', saves: [], ...extra,
});

test('bilingual editions share one panel and follow the interface language', () => {
  const groups = [group('wuwu', 'en'), group('wuwu-jp', 'ja'), group('first-snow', 'en'), group('first-snow-jp', 'ja')];
  assert.deepEqual(launcher.launcherWorlds(groups, 'ja').map(g => g.id), ['wuwu-jp', 'first-snow-jp']);
  assert.deepEqual(launcher.launcherWorlds(groups, 'en').map(g => g.id), ['wuwu', 'first-snow']);
  assert.deepEqual(launcher.launcherWorlds(groups, 'zh-CN').map(g => g.id), ['wuwu', 'first-snow']);
});

test('a world with a single edition still shows; save-only groups do not', () => {
  const groups = [group('solo-jp', 'ja'), group('orphan', null, { templatePath: null, cover: null })];
  assert.deepEqual(launcher.launcherWorlds(groups, 'en').map(g => g.id), ['solo-jp']);
});

test('the edition suffix is dropped from the title', () => {
  assert.equal(launcher.worldTitle('霧埠の町 · 日本語'), '霧埠の町');
  assert.equal(launcher.worldTitle('Fogwharf'), 'Fogwharf');
});
