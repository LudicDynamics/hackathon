import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

const particle = await readFile(new URL('../src/components/canvas/ParticleLayer.tsx', import.meta.url), 'utf8');
const performance = await readFile(new URL('../src/components/performance/PerformanceLayer.tsx', import.meta.url), 'utf8');

test('ParticleLayer exposes distinct ambient and burst surfaces in one module', () => {
  assert.match(particle, /data-particle-surface="ambient"/);
  assert.match(particle, /data-depth="background"/);
  assert.match(particle, /data-particle-surface="burst"/);
  assert.match(particle, /data-depth="performance"/);
  assert.equal((particle.match(/<canvas\b/g) ?? []).length, 1, 'burst must not add a second canvas');
  assert.match(particle, /playBurst\(spec: BurstSpec, host\?: HTMLElement\)/);
  assert.match(particle, /getParallax\(\)/);
  assert.match(particle, /window\.addEventListener\('resize'/);
});

test('ParticleLayer closes its animation loop while hidden or lifecycle-gated', () => {
  assert.match(particle, /document\.hidden \|\| state\.hidden \|\| !state\.effectsEnabled \|\| state\.reducedMotion/);
  assert.match(particle, /if \(!animId && !isPaused\(\) && hasWork\(\)\) animId = requestAnimationFrame\(render\)/);
  assert.match(particle, /if \(isPaused\(\) \|\| !hasWork\(\)\) return;/);
  assert.match(particle, /className="[^"]*pointer-events-none[^"]*"[\s\S]*?data-particle-surface="burst"/);
});

test('PerformanceLayer accepts an injected admission seam and refuses dialogue-conflicting dice ceremony', () => {
  assert.match(performance, /import type \{ OverlayAdmission \} from ['"]\.\.\/\.\.\/lib\/overlay-admission\.js['"]/);
  assert.match(performance, /admission\?: OverlayAdmission/);
  assert.match(performance, /performShowFrame\(\s*frame: unknown,\s*injectedAdmission\?: OverlayAdmission/);
  assert.match(performance, /ctx\.admission\?\.release\(admission\.token\)/);
  assert.match(performance, /dialogue|overlay admission/i);
});

test('show resource takeover remains keyed and cleans the previous renderer before activation', () => {
  assert.match(performance, /for \(const s of active\) \{[\s\S]*?s\.resourceKey === key[\s\S]*?s\.cleanup\(\)/);
  assert.match(performance, /active = active\.filter\(\(s\) => s\.resourceKey !== key\)/);
  assert.match(performance, /const cleanup = SHOW_RENDERERS\[kind\]\(full, ctx\)/);
  assert.match(performance, /cleanup: \(\) => \{[\s\S]*?cleanup\(\)[\s\S]*?captionEl\?\.remove\(\)/);
});
