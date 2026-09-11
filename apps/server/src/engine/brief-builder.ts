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
    `[任务] 实例化场景层`,
    `[目标路径] ${ctx.targetPath}`,
    `[世界] ${ctx.manifest.name}（题材：${ctx.manifest.genre}；描述：${ctx.manifest.description}；默认材质：${ctx.manifest.material}）`,
  ];

  if (ctx.parentLayerName) {
    lines.push(`[上级层] ${ctx.parentLayerName}`);
  }

  if (ctx.userPrompt) {
    lines.push(`[玩家诉求] ${ctx.userPrompt}`);
  }

  if (ctx.knownClues && ctx.knownClues.length > 0) {
    lines.push(`[已知线索] ${ctx.knownClues.join(' / ')}`);
  }

  lines.push(
    `[约束]`,
    `- 不预设最终答案，不强加确凿结论`,
    `- 聚焦于场景的氛围、物件陈设与感官细节（视听触嗅）`,
    `- 只给出“第一眼所见”，留下供玩家探索与互动的留白空间`,
    `[产出]`,
    `1. README.md：场景标题、陈设概况与背景材质声明`,
    `2. 2~4 个物件 markdown 文件（可供拾取、调查的道具或信件）`,
    `3. 1 段开场旁白（type: chalk 的 md 文件，<=200 字，含 status/choice/roll_dice）`,
    `[回报]`,
    `三行：路径清单 / 一句话场景摘要 / 一句话“这里最让人在意的细节是什么”`
  );

  return lines.join('\n');
}

export function buildNookInitBrief(characterName: string, roleDesc: string, manifest: WorldManifest): string {
  return [
    `[任务] 实例化角色小天地`,
    `[目标路径] characters/${characterName}`,
    `[角色] ${characterName}（${roleDesc}）`,
    `[世界] ${manifest.name}（题材：${manifest.genre}）`,
    `[诉求] 生成该角色私人领地中的初始陈设，体现其生活痕迹、未寄出的信件或私密纪念物。`,
    `[约束] 真实可信、富有情感分量，不以“样板间”口吻撰写。`,
    `[产出] 2~3 个代表过往故事的 markdown 文件（信件、日记、专属道具）。`,
    `[回报] 三行简述生成的内容。`
  ].join('\n');
}
