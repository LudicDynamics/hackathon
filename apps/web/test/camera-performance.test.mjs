import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createJiti } from '../../../vendor/pi-rp/node_modules/jiti/lib/jiti.mjs';

const jiti = createJiti(import.meta.url, { moduleCache: false, tryNative: true });
const camera = await jiti.import('../src/lib/camera.ts');

test('high zoom switches to compact text rendering at the threshold', () => {
  assert.equal(camera.isHighZoom(camera.Z_MAX), true);
  assert.equal(camera.isHighZoom(camera.HIGH_ZOOM_RENDER_THRESHOLD), true);
  assert.equal(camera.isHighZoom(camera.HIGH_ZOOM_RENDER_THRESHOLD - 0.001), false);
});

test('non-finite zoom never enables compact rendering', () => {
  assert.equal(camera.isHighZoom(Number.NaN), false);
  assert.equal(camera.isHighZoom(Number.POSITIVE_INFINITY), false);
});
