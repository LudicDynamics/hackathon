/**
 * tools/check-merge-log.test.mjs — behaviour proof for the merge-log gate.
 *
 * A gate that only ever passes is coverage theatre. The two failure modes worth
 * pinning are opposite: an UNREGISTERED merge must go red (the norm has teeth),
 * and a grandfathered one must stay green (the baseline is not decoration).
 * Between them sit the structural checks — sections present, self-locating
 * (merge SHA + both parents), and a non-empty §2 — because those are what make
 * an entry readable six months on.
 *
 * Run:  node --test tools/check-merge-log.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ENTRY_RE, REQUIRED_SECTIONS, evaluate, parseBaseline, parseMergeLog } from './check-merge-log.mjs';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const SHA_C = 'c'.repeat(40);
const SHA_X = 'd'.repeat(40);

/** A merge record the way `gitLogFirstParentMerges` builds it. */
const merge = (sha, short, subject = 'Merge x', parents = [SHA_A.slice(0, 7), SHA_B.slice(0, 7)]) => ({
  sha,
  short,
  subject,
  parents,
});

/** A minimal VALID entry body citing `short` and both parents. */
const validEntry = (short, parents = [SHA_A.slice(0, 7), SHA_B.slice(0, 7)], over = {}) => ({
  file: `docs/merge/x-${short}-yoshi.md`,
  sha7: short,
  author: 'yoshi',
  text: [
    `> 合并 \`${short}\` · 父提交 \`${parents[0]}\` 与 \`${parents[1]}\``,
    '',
    REQUIRED_SECTIONS[0],
    '',
    '- both sides did things',
    '',
    REQUIRED_SECTIONS[1],
    '',
    '| file | ours | theirs | verdict |',
    '|---|---|---|---|',
    '| `a.ts` | A | B | took B because reasons |',
    '',
    REQUIRED_SECTIONS[2],
    '',
    '```',
    'pnpm build  # PASS',
    '```',
    ...(over.text ?? []),
  ].join('\n'),
  ...over,
});

const hard = (findings) => findings.filter((f) => !f.startsWith('note:'));

// ── the gate can go red ─────────────────────────────────────────────────────

test('an unregistered merge is a finding (the norm has teeth)', () => {
  const findings = hard(evaluate({ merges: [merge(SHA_C, 'abc1234')], entries: [], baseline: new Set([SHA_A]) }));
  assert.equal(findings.length, 1);
  assert.match(findings[0], /unregistered merge abc1234/);
});

test('a registered-but-empty §2 is a finding (the record must say HOW)', () => {
  const entry = validEntry('abc1234');
  entry.text = entry.text.replace(/## 2\. 冲突处理[\s\S]*?(?=## 3)/, '## 2. 冲突处理\n\n');
  const findings = hard(evaluate({ merges: [merge(SHA_C, 'abc1234')], entries: [entry], baseline: new Set([SHA_A]) }));
  assert.ok(findings.some((f) => /"## 2\. 冲突处理" is empty/.test(f)), findings.join('\n'));
});

test('a missing required section is a finding', () => {
  const entry = validEntry('abc1234');
  entry.text = entry.text.replace('## 3. 验证', '## 3. 别的东西');
  const findings = hard(evaluate({ merges: [merge(SHA_C, 'abc1234')], entries: [entry], baseline: new Set([SHA_A]) }));
  assert.ok(findings.some((f) => /missing section "## 3\. 验证"/.test(f)), findings.join('\n'));
});

test('an entry that does not cite the merge SHA is a finding', () => {
  const entry = validEntry('abc1234');
  entry.text = entry.text.replace(/`abc1234`/g, '`deadbee`');
  const findings = hard(evaluate({ merges: [merge(SHA_C, 'abc1234')], entries: [entry], baseline: new Set([SHA_A]) }));
  assert.ok(findings.some((f) => /does not cite the merge `abc1234`/.test(f)), findings.join('\n'));
});

test('an entry that cites only one parent is a finding (both are needed to reproduce)', () => {
  const entry = validEntry('abc1234');
  entry.text = entry.text.replace(`\`${SHA_B.slice(0, 7)}\``, '`eeeeeee`');
  const findings = hard(evaluate({ merges: [merge(SHA_C, 'abc1234')], entries: [entry], baseline: new Set([SHA_A]) }));
  assert.ok(findings.some((f) => /does not cite parent `bbbbbbb`/.test(f)), findings.join('\n'));
});

test('two entries for one merge is a finding', () => {
  const findings = hard(
    evaluate({
      merges: [merge(SHA_C, 'abc1234')],
      entries: [validEntry('abc1234'), validEntry('abc1234', undefined, { file: 'docs/merge/y-abc1234-niko.md' })],
      baseline: new Set([SHA_A]),
    })
  );
  assert.ok(findings.some((f) => /has 2 entries/.test(f)), findings.join('\n'));
});

// ── the gate can go green ───────────────────────────────────────────────────

test('a well-formed entry passes', () => {
  const findings = evaluate({ merges: [merge(SHA_C, 'abc1234')], entries: [validEntry('abc1234')], baseline: new Set([SHA_A]) });
  assert.deepEqual(findings, []);
});

test('a grandfathered merge needs no entry (the baseline is not decoration)', () => {
  const findings = evaluate({ merges: [merge(SHA_A, 'aaaaaaa')], entries: [], baseline: new Set([SHA_A]) });
  assert.deepEqual(findings, []);
});

// ── vacuously-passing guards ────────────────────────────────────────────────

test('an empty baseline is a finding (a parse failure must not read as "all exempt")', () => {
  const findings = hard(evaluate({ merges: [merge(SHA_C, 'abc1234')], entries: [validEntry('abc1234')], baseline: new Set() }));
  assert.ok(findings.some((f) => /lists no merge SHAs/.test(f)), findings.join('\n'));
});

test('an empty merge list is a finding (a shallow clone must not read as clean)', () => {
  const findings = hard(evaluate({ merges: [], entries: [], baseline: new Set([SHA_A]) }));
  assert.ok(findings.some((f) => /no merge commits found/.test(f)), findings.join('\n'));
});

// ── not-a-failure, but worth seeing ─────────────────────────────────────────

test('an entry for a non-first-parent merge is a note, not a finding', () => {
  const findings = evaluate({
    merges: [merge(SHA_C, 'abc1234')],
    entries: [validEntry('abc1234'), validEntry('fffffff')],
    baseline: new Set([SHA_A]),
  });
  assert.deepEqual(hard(findings), []);
  assert.ok(findings.some((f) => /note: .*fffffff/.test(f)), findings.join('\n'));
});

// ── the parsers ─────────────────────────────────────────────────────────────

test('parseBaseline reads 40-hex rows and ignores prose', () => {
  const shas = parseBaseline(['# BASELINE', '', 'prose about abc1234', `- ${SHA_A}  # a note`, `- ${SHA_B}`].join('\n'));
  assert.deepEqual([...shas].sort(), [SHA_A, SHA_B].sort());
});

test('parseMergeLog yields the merge SHA, short, subject and BOTH parents', () => {
  const out = `${SHA_C}\tabc1234\tMerge x\t${SHA_A.slice(0, 7)} ${SHA_B.slice(0, 7)}\n`;
  assert.deepEqual(parseMergeLog(out), [merge(SHA_C, 'abc1234')]);
});

test('ENTRY_RE applies the LAST dash pair, so titles may contain dashes', () => {
  const m = 'niko-沉浸式界面-813c0f3-yoshi.md'.match(ENTRY_RE);
  assert.equal(m[1], 'niko-沉浸式界面');
  assert.equal(m[2], '813c0f3');
  assert.equal(m[3], 'yoshi');
});
