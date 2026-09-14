// World launcher helpers (docs/ui/世界Launcher.md).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createJiti } from '../../../vendor/pi-rp/node_modules/jiti/lib/jiti.mjs';

const launcher = await createJiti(import.meta.url, { moduleCache: false }).import('../src/lib/world-launcher.ts');

const group = (id, locale, extra = {}) => ({
  id, name: `${id} · edition`, templatePath: `templates/${id}`, cover: `/api/worlds/cover?id=${id}`,
  locale, description: '', saves: [], ...extra,
});

test('editions share one entry and follow the interface language, falling back to English', () => {
  const groups = [group('wuwu', 'en'), group('wuwu-jp', 'ja'), group('wuwu-zh', 'zh-CN'), group('first-snow', 'en'), group('first-snow-jp', 'ja')];
  assert.deepEqual(launcher.launcherWorlds(groups, 'ja').map(g => g.id), ['wuwu-jp', 'first-snow-jp']);
  assert.deepEqual(launcher.launcherWorlds(groups, 'en').map(g => g.id), ['wuwu', 'first-snow']);
  // First Snow has no Chinese edition yet: English stands in.
  assert.deepEqual(launcher.launcherWorlds(groups, 'zh-CN').map(g => g.id), ['wuwu-zh', 'first-snow']);
  assert.equal(launcher.editionLabel('zh-CN'), '中文');
  assert.equal(launcher.editionLabel(null), 'English');
});

test('a world with a single edition still shows; save-only groups do not', () => {
  const groups = [group('solo-jp', 'ja'), group('orphan', null, { templatePath: null, cover: null })];
  assert.deepEqual(launcher.launcherWorlds(groups, 'en').map(g => g.id), ['solo-jp']);
});

test('the edition suffix is dropped from the title', () => {
  assert.equal(launcher.worldTitle('霧埠の町 · 日本語'), '霧埠の町');
  assert.equal(launcher.worldTitle('Fogwharf'), 'Fogwharf');
});

test('touching bricks never show the same world, in any direction, far from the origin', () => {
  const geometry = launcher.brickGeometry(1500);
  for (const count of [5, 7, 9]) {
    const bricks = launcher.visibleBricks(-7300, 4100, 3000, 2000, geometry, 0);
    const at = new Map(bricks.map(b => [`${b.col}:${b.row}`, b]));
    for (const b of bricks) {
      const world = launcher.brickWorld(b.col, b.row, count);
      // Row neighbours, and the two bricks above/below (odd rows are shifted right).
      const shift = (b.row & 1) ? 0 : -1;
      for (const [c, r] of [[b.col + 1, b.row], [b.col + shift, b.row + 1], [b.col + shift + 1, b.row + 1]]) {
        if (!at.has(`${c}:${r}`)) continue;
        assert.notEqual(launcher.brickWorld(c, r, count), world, `count ${count}: ${b.col}:${b.row} vs ${c}:${r}`);
      }
    }
  }
});

test('the wall repeats: every world appears, including at negative coordinates', () => {
  const seen = new Set(launcher.visibleBricks(-5000, -5000, 2000, 1200, launcher.brickGeometry(1500), 0).map(b => launcher.brickWorld(b.col, b.row, 7)));
  assert.equal(seen.size, 7);
});

test('visible bricks cover the whole viewport with no holes', () => {
  const geometry = launcher.brickGeometry(1400);
  const [x, y, width, height] = [-333, 777, 1400, 800];
  const bricks = launcher.visibleBricks(x, y, width, height, geometry);
  for (let px = x; px <= x + width; px += 37) {
    for (let py = y; py <= y + height; py += 29) {
      const covered = bricks.some(b => px >= b.left - geometry.gap && px <= b.left + geometry.w + geometry.gap && py >= b.top - geometry.gap && py <= b.top + geometry.h + geometry.gap);
      assert.ok(covered, `hole at ${px},${py}`);
    }
  }
});

test('brick size stays within 280–520px', () => {
  assert.equal(launcher.brickGeometry(400).w, 280);
  assert.equal(launcher.brickGeometry(4000).w, 520);
});
