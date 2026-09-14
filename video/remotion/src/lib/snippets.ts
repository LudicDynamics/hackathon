/**
 * What the writer types in S6 — trimmed from real world files in templates/ (the writer's output is
 * Markdown + frontmatter; the engine and canvas turn each field into an effect).
 */
export const SNIPPETS: { file: string; code: string }[] = [
  {
    file: "world/harbor-chart/seventh-berth/04-investigation-dice.md",
    code: `---
type: chalk
title: Deciphering the scrapes
roll_dice:
  type: 2d10
  desc: Deciphering the scrapes
  expect: ">=11"
---`,
  },
  {
    file: "world/tonight-promises/first-snow/README.md",
    code: `---
type: gate
title: First Snow · Final Scene of Tonight
bg: assets/scenes/first-snow.webp
bgVideo: assets/motion/seedance/backgrounds/snowfall.webm
---`,
  },
  {
    file: "world/harbor-chart/old-lighthouse/README.md",
    code: `---
type: gate
title: Old Lighthouse · Light Out
bg: assets/scenes/old-lighthouse.webp
choice:
  options:
    - label: Borrow oil and discuss illumination methods
---`,
  },
  {
    file: "world/harbor-chart/README.md",
    code: `---
type: gate
requires:
  items:
    - player/commission-letter.md
    - player/investigator-badge.md
---`,
  },
];
