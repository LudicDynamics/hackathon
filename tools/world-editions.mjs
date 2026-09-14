import fs from 'node:fs';
import path from 'node:path';

// Edition IDs are packaging only; scene, item and character paths never change.
export const editionFamilies = [
  { base: 'wuwu', source: 'wuwu-playtest', en: 'Fogwharf', ja: '霧埠の町', zh: '雾坞镇' },
  { base: 'whitechapel', source: 'whitechapel-playtest', en: 'Holmes: The Fourth Case', ja: 'ホームズ：四つ目の事件', zh: '福尔摩斯：第四件案子' },
  { base: 'divergence', source: 'divergence-playtest', en: 'Divergence', ja: '分岐線', zh: '分歧线' },
  { base: 'firstsnow', source: 'first-snow-jp-playtest', en: 'First Snow Radio', ja: '初雪ラジオ', zh: '初雪电台' },
  { base: 'magic-academy', source: 'magic-academy-playtest', en: 'Magic Academy', ja: '魔法学院', zh: '魔法学院' },
  { base: 'unwritten-door', source: 'unwritten-door-playtest', en: 'The Unwritten Door', ja: '未書の扉', zh: '未写之门' },
  { base: 'moonlit-contract', source: 'moonlit-contract', en: 'The Moonlit Pact', ja: '月下の誓い', zh: '月下之誓' },
];
/** Published locales. English is the executable contract; the others are localized copies. */
export const editionLocales = ['en', 'ja', 'zh-CN'];
const SUFFIX = { en: '', ja: '-jp', 'zh-CN': '-zh' };
// First Snow ships as `first-snow` (the family key stays `firstsnow`).
export const editionId = (family, locale) => (family.base === 'firstsnow' ? 'first-snow' : family.base) + SUFFIX[locale];
export const templateArchive = 'archive/templates/pre-bilingual-2026-09-14';

/**
 * Experimental sandboxes (`world.json` `exp: true`) are not shipped editions.
 *
 * `templates/exp` is a deliberate, permanent exception: it exists so a
 * character can be carried onto the canvas with their own pi-memory DB, and it
 * is NOT one of the 21 canonical bilingual editions. Every gate that enumerates
 * `templates/*` as "the edition set" must skip it — otherwise the sandbox can
 * only exist by deleting it.
 *
 * This is a DIRECTORY-NAME-INDEPENDENT check on purpose: the marker lives in the
 * manifest, so an experiment never has to be named a special way to be ignored,
 * and `world-editions.mjs` stays the one place that knows the rule.
 *
 * Fail-soft: an unreadable/malformed manifest is NOT experimental (a gate should
 * still see a broken world and complain about it).
 */
export function isExperimentalWorld(tier, world) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(tier, world, 'world.json'), 'utf8'));
    return manifest.exp === true;
  } catch {
    return false;
  }
}
