import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('turn receipt appears only in the scene status area and clamps to three lines', () => {
  const app = fs.readFileSync(new URL('../apps/web/src/App.tsx', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../apps/web/src/scene-shell.css', import.meta.url), 'utf8');
  const component = fs.readFileSync(new URL('../apps/web/src/components/WriterResult.tsx', import.meta.url), 'utf8');
  assert.equal((app.match(/<WriterResult\b/g) ?? []).length, 1);
  assert.match(app, /className="prototype-world-meta prototype-chrome">[\s\S]*?<WriterResult[^>]*\/>\s*<\/div>/);
  const rule = css.match(/\.prototype-world-meta \.writer-result\s*\{([^}]+)\}/)?.[1];
  assert.ok(rule);
  assert.match(rule, /position:static/);
  assert.match(rule, /-webkit-line-clamp:3/);
  assert.match(rule, /overflow:hidden/);
  assert.doesNotMatch(rule, /bottom:|left:50%|translateX/);
  assert.doesNotMatch(component, /text\.slice\(0, 240\)/);
});
