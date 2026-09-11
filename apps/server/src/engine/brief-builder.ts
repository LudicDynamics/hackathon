import type { WorldManifest } from '@airp/shared';

export interface SceneInitContext {
  targetPath: string;
  manifest: WorldManifest;
  parentLayerName?: string;
  userPrompt?: string;
  knownClues?: string[];
}

export function buildSceneInitBrief(ctx: SceneInitContext): string {
  const lines = [
    `[Task] Instantiate a scene layer`,
    `[Target Path] ${ctx.targetPath}`,
    `[World] ${ctx.manifest.name} (genre: ${ctx.manifest.genre}; description: ${ctx.manifest.description}; default material: ${ctx.manifest.material})`,
  ];

  if (ctx.parentLayerName) {
    lines.push(`[Parent Layer] ${ctx.parentLayerName}`);
  }

  if (ctx.userPrompt) {
    lines.push(`[Player Request] ${ctx.userPrompt}`);
  }

  if (ctx.knownClues && ctx.knownClues.length > 0) {
    lines.push(`[Known Clues] ${ctx.knownClues.join(' / ')}`);
  }

  lines.push(
    `[Constraints]`,
    `- Do not presuppose a final answer or impose a definitive conclusion`,
    `- Focus on the scene's atmosphere, object staging, and sensory detail (sight, sound, touch, smell)`,
    `- Give only the "first sight", leaving blank space for the player to explore and interact with`,
    `[Deliverables]`,
    `1. README.md: scene title, furnishing overview, and background material declaration`,
    `2. 2–4 object markdown files (props or letters the player can pick up or investigate)`,
    `3. 1 opening narration (a md file with type: chalk, <=200 words, including status/choice/roll_dice)`,
    `[Report]`,
    `Three lines: list of paths / one-sentence scene summary / one sentence on "what is the most striking detail here"`
  );

  return lines.join('\n');
}

export function buildNookInitBrief(characterName: string, roleDesc: string, manifest: WorldManifest): string {
  return [
    `[Task] Instantiate a character nook`,
    `[Target Path] characters/${characterName}`,
    `[Character] ${characterName} (${roleDesc})`,
    `[World] ${manifest.name} (genre: ${manifest.genre})`,
    `[Request] Generate the initial furnishings of this character's private domain, bearing traces of their life, unsent letters, or intimate keepsakes.`,
    `[Constraints] Authentic and believable, full of emotional weight; do not write in a "showroom" voice.`,
    `[Deliverables] 2–3 markdown files representing their past story (letters, diaries, signature props).`,
    `[Report] Describe the generated content in three lines.`
  ].join('\n');
}
