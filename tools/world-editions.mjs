// Edition IDs are packaging only; scene, item and character paths never change.
export const editionFamilies = [
  { base: 'wuwu', source: 'wuwu-playtest', en: 'Fogwharf', ja: '霧埠の町' },
  { base: 'whitechapel', source: 'whitechapel-playtest', en: 'Holmes: The Fourth Case', ja: 'ホームズ：四つ目の事件' },
  { base: 'divergence', source: 'divergence-playtest', en: 'Divergence', ja: '分岐線' },
  { base: 'first-snow', source: 'first-snow-jp-playtest', en: 'First Snow Radio', ja: '初雪ラジオ' },
  { base: 'magic-academy', source: 'magic-academy-playtest', en: 'Magic Academy', ja: '魔法学院' },
  { base: 'unwritten-door', source: 'unwritten-door-playtest', en: 'The Unwritten Door', ja: '未書の扉' },
  { base: 'moonlit-contract', source: 'moonlit-contract', en: 'The Moonlit Pact', ja: '月下の誓い' },
];
export const editionId = (family, locale) => family.base + (locale === 'ja' ? '-jp' : '');
export const templateArchive = 'archive/templates/pre-bilingual-2026-09-14';
