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
