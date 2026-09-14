import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('canvas sound mappings exist and suppress overlapping and late playback', async () => {
  const source = await fs.readFile('apps/web/src/lib/audio.ts', 'utf8');
  for (const name of ['card', 'get', 'dice', 'success', 'write', 'door', 'paper', 'bell']) {
    assert.ok((await fs.stat(`assets/audio/foley/canvas/se-${name}.mp3`)).size > 0);
  }
  assert.match(source, /foleyBusyUntil\.set\(name, performance\.now\(\) \+ Math\.max\(500, buf\.duration \* 1000\)\)/);
  assert.match(source, /performance\.now\(\) - now > 500/);
});
test('reader supports keyboard and ignores drag; save picker closes before loading', async () => {
  const object = await fs.readFile('apps/web/src/components/canvas/CanvasObject.tsx', 'utf8');
  assert.match(object, /event\.key === 'Enter'/);

  const helper = await fs.readFile('apps/web/src/lib/card-interaction.ts', 'utf8');
  const canvas = await fs.readFile('apps/web/src/components/canvas/Canvas.tsx', 'utf8');
  // Keep the movement gate authoritative in one helper: the exact 5px
  // threshold and Euclidean comparison prevent click jitter from becoming a
  // drag in either the viewport dispatcher or the card read seam.
  assert.match(helper, /export const CARD_POINTER_THRESHOLD = 5;/);
  assert.match(helper, /Math\.hypot\(endX - startX, endY - startY\) > CARD_POINTER_THRESHOLD/);
  assert.match(canvas, /import \{ movedBeyondCardThreshold \} from '\.\.\/\.\.\/lib\/card-interaction\.js';/);
  assert.match(object, /import \{ movedBeyondCardThreshold \} from '\.\.\/\.\.\/lib\/card-interaction\.js';/);
  assert.equal((canvas.match(/movedBeyondCardThreshold\(/g) ?? []).length, 2);
  assert.equal((object.match(/movedBeyondCardThreshold\(/g) ?? []).length, 1);
  assert.match(canvas, /if \(!movedBeyondCardThreshold\(s\.sx, s\.sy, e\.clientX, e\.clientY\)\) return;/);
  assert.match(canvas, /if \(movedBeyondCardThreshold\(d\.sx, d\.sy, e\.clientX, e\.clientY\)\)/);
  assert.match(object, /if \(movedBeyondCardThreshold\(pointerStart\.current\.x, pointerStart\.current\.y, event\.clientX, event\.clientY\)\) return;/);
  assert.doesNotMatch(object, /Math\.hypot/);

  // The reader contract is "BagItemDialog renders inline"; assert it on the
  // element body so a multi-line JSX opening tag or attribute reorder cannot
  // masquerade as a contract break.
  const bagDialog = object.match(/<BagItemDialog\b[\s\S]*?\/>/);
  assert.ok(bagDialog, 'reader must render a BagItemDialog');
  assert.match(bagDialog[0], /\binline\b/);
  assert.doesNotMatch(object, /createPortal/);
  const reader = await fs.readFile('apps/web/src/components/BagItemDialog.tsx', 'utf8');
  assert.doesNotMatch(reader, /aria-modal="true"|cabin-reading/);
  const shelf = await fs.readFile('apps/web/src/components/WorldShelf.tsx', 'utf8');
  assert.doesNotMatch(shelf, /prototype-dialog-backdrop|aria-modal="true"/);
  const app = await fs.readFile('apps/web/src/App.tsx', 'utf8');
  const load = app.slice(app.indexOf('const loadWorld ='), app.indexOf('const submitWriter ='));
  assert.ok(load.indexOf('setWorldPickerOpen(false)') < load.indexOf('await airpGateway.loadWorld'));
});
