import { WORLDS } from "./assets";

/**
 * Footage slots. Each slot lists candidate files in priority order; the first one present in public/ wins,
 * otherwise the scene shows a labelled placeholder (or its own mock).
 *
 * `match`: a string is a path prefix ("footage/r1-fogwharf"); an array means every substring must appear.
 * `from`: seconds into the source file, `rate`: playback speed (speed-ramp waits on the AI).
 *
 * When the user's raw recordings land in public/footage/, add a candidate at the top with `from`/`rate`.
 */
export type Candidate = { match: string | string[]; from?: number; rate?: number };
export type Slot = { note: string; candidates: Candidate[] };

const beats: Record<number, { b: string; c: string; d: string; e: string }> = {
  1: {
    b: "Fogwharf 进门：委托信 + 调查员铜徽进背包 → Gate 打开",
    c: "Fogwharf 港城地图全景：停 3 秒 → 缩放平移 → 点第七泊位",
    d: "证物拖到 Vera / Old Mo 头像对证 → 确认掷骰（3D 骰子）",
    e: "揭示第二艘船 → 迷雾退开，新路 + 新城入口出现",
  },
  2: {
    b: "221B：打开 Watson 来信 → 拿黄铜画筒盖",
    c: "伦敦案件地图全景 → 进第三案现场（Watson 跟随）",
    d: "证物拖给 Watson → 点头像进特写，立绘换表情",
    e: "提交 deduction.md / plan.md → Watson 引用你的推理",
  },
  3: {
    b: "直播最后一分钟：Nanami 叫出你的名字 → 拿请求单",
    c: "两份约定 + 放送室 / 咖啡店同框全景",
    d: "分别与 Nanami、Sumi 直聊（开语音），两次特写",
    e: "收束 → 雪景下现场写出的结局 chalk",
  },
  4: {
    b: "认领未接电话与发条青蛙",
    c: "时间主视图：1994 / 今晚 / 三十年后 / 收敛点横扫",
    d: "进 1994 常盘堂 → 写信 / 改一件事 → Ryo 的反应",
    e: "回到今晚同一地点 → 前后对照",
  },
};

/** Clips Claude captured from the running app (video/footage/claude), used until the user's recordings land. */
const CAPTURED: Record<string, Candidate[]> = {
  "r1-b": [{ match: "footage/fogwharf-entry", from: 4, rate: 4 }],
  "r1-c": [{ match: "footage/c5-canvas-pan", from: 11, rate: 3.5 }],
};

const worldSlots = (): Record<string, Slot> => {
  const out: Record<string, Slot> = {};
  for (const w of WORLDS) {
    const k = `r${w.n}`;
    const stills = (kind: string) => w.aliases.map((a) => ({ match: ["stills", a, kind] }));
    const got = (s: string) => CAPTURED[`${k}-${s}`] ?? [];
    out[`${k}-b`] = { note: `${k.toUpperCase()}-b · ${beats[w.n].b}`, candidates: [{ match: `footage/${k}-b` }, ...got("b"), ...stills("intro")] };
    out[`${k}-c`] = { note: `${k.toUpperCase()}-c · ${beats[w.n].c}`, candidates: [{ match: `footage/${k}-c` }, ...got("c"), ...stills("main")] };
    out[`${k}-d`] = { note: `${k.toUpperCase()}-d · ${beats[w.n].d}`, candidates: [{ match: `footage/${k}-d` }] };
    out[`${k}-e`] = { note: `${k.toUpperCase()}-e · ${beats[w.n].e}`, candidates: [{ match: `footage/${k}-e` }] };
  }
  return out;
};

export const SLOTS: Record<string, Slot> = {
  c2: { note: "C2 · 点角色头像 → 特写遮罩 → 表情切换", candidates: [{ match: ["c2"] }] },
  r0: { note: "R0 · 按麦克风说一句 → 实时转写 → Nanami 用 TTS 回话（你录）", candidates: [{ match: "footage/r0" }] },
  r5: { note: "R5 · 进 Vera 的小天地，在画布上 RP，物件一张张长出来（你录）", candidates: [{ match: "footage/r5" }, { match: ["c7"] }, { match: ["stills", "nook"] }] },
  c6: { note: "C6 · 角色头像在画布上自由走动 / 跟随切场景", candidates: [{ match: "footage/c6-" }, { match: "footage/c6a-workshop-follow", from: 13, rate: 2.2 }] },
  c3: { note: "C3 · 3D 骰子掷出", candidates: [{ match: ["c3"] }] },
  c5: { note: "C5 · 画布拖动 / 缩放 B-roll", candidates: [{ match: ["c5"] }] },
  ...worldSlots(),
};
