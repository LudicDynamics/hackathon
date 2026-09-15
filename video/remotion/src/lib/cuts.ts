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
export type Candidate = { match: string | string[]; from?: number; rate?: number; muted?: boolean };
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
  // The user's 44-minute Fogwharf run (video/footage/fogwharf-run-raw.mp4, Japanese edition), then Claude's
  // earlier captures as fallbacks.
  // Office intro, commission. Only 0:10–0:13.5 is clean: the run opens on the launcher, and from 0:14 a settings
  // panel and the model dropdown are open — never show those.
  "r1-b": [{ match: "footage/fogwharf-run-raw", from: 10, rate: 1.4 }, { match: "footage/fogwharf-entry", from: 4, rate: 4 }],
  "r1-c": [{ match: "footage/fogwharf-run-raw", from: 138, rate: 4 }, { match: "footage/c5-canvas-pan", from: 11, rate: 3.5 }], // harbour map at night
  "r1-d": [{ match: "footage/fogwharf-run-raw", from: 172, rate: 3.5 }], // lighthouse → 3D dice tray (2:58) → result (3:02)
  "r1-e": [{ match: "footage/fogwharf-run-raw", from: 2644, rate: 1 }], // 44:04 — Vera's reply is "You have no credits remaining."
  // The user's Divergence run (video/footage/divergence-run-raw.mp4, 11 min, Japanese edition). Their picks:
  // entering 2024 before and after, typing the line that changes the world, and the moment talking to the girl
  // changes the timeline. (Raw files must NOT start with a slot prefix like `r4-d`, or the slot's
  // user-recording match swallows them from 0:00.)
  "r4-b": [{ match: "footage/divergence-run-raw", from: 90, rate: 1.5 }], // sunlit 1994 shop → first night in 2024
  "r4-c": [{ match: "footage/divergence-run-raw", from: 274, rate: 6 }], // typing and sending the world-changing line
  // Ryo: 「鮭が跳ねるところ、また見たいな」. Picture only — her voice plays as voice/ryo-1.wav (levelled to the cast).
  "r4-d": [{ match: "footage/divergence-run-raw", from: 501.3, rate: 1 }],
  "r4-e": [{ match: "footage/divergence-run-raw", from: 506, rate: 3.4 }], // the timeline shifts → 2024 again, changed
  // First Snow, from the user's two routes (video/footage/route-b-run-raw.mp4 = Recording 16.07.16, 17 min;
  // route-a-run-raw.mp4 = 16.24.30, 5 min). The block's payoff shows both endings (slots r3-end1 / r3-end2).
  "r3-b": [{ match: "footage/route-b-run-raw", from: 10, rate: 1.2 }], // the radio studio, Nanami with the request card
  "r3-c": [{ match: "footage/route-b-run-raw", from: 18, rate: 2 }], // the snowy street, place cards laid out
  "r3-d": [{ match: "footage/route-b-run-raw", from: 465, rate: 1 }], // 7:45 on the phone with Nanami
  "r3-e": [{ match: "footage/route-b-run-raw", from: 852.1, rate: 1 }],
};

const worldSlots = (): Record<string, Slot> => {
  const out: Record<string, Slot> = {};
  for (const w of WORLDS) {
    const k = `r${w.n}`;
    const stills = (kind: string) => w.aliases.map((a) => ({ match: ["stills", a, kind] }));
    const got = (s: string) => CAPTURED[`${k}-${s}`] ?? [];
    out[`${k}-b`] = { note: `${k.toUpperCase()}-b · ${beats[w.n].b}`, candidates: [{ match: `footage/${k}-b` }, ...got("b"), ...stills("intro")] };
    out[`${k}-c`] = { note: `${k.toUpperCase()}-c · ${beats[w.n].c}`, candidates: [{ match: `footage/${k}-c` }, ...got("c"), ...stills("main")] };
    out[`${k}-d`] = { note: `${k.toUpperCase()}-d · ${beats[w.n].d}`, candidates: [{ match: `footage/${k}-d` }, ...got("d")] };
    out[`${k}-e`] = { note: `${k.toUpperCase()}-e · ${beats[w.n].e}`, candidates: [{ match: `footage/${k}-e` }, ...got("e")] };
  }
  return out;
};

/**
 * The follow montage (A5), from the user's Fogwharf run. Before 14:02 Vera kept getting left behind; the user asks
 * 「一緒に回らない？」, Vera's agent moves herself (activity popover), and from then on her avatar is beside them in
 * every place — including three the writer invented live. `len` is frames in the film.
 */
export const FOLLOW: { slot: string; len: number; from: number; rate: number; note: string }[] = [
  { slot: "follow-1", len: 45, from: 840.5, rate: 1.3, note: "14:00 typing 「一緒に回らない」" },
  { slot: "follow-2", len: 45, from: 859, rate: 2, note: "14:19 Vera's activity: she moves herself" },
  { slot: "follow-3", len: 60, from: 871.5, rate: 1, note: "14:32 Seventh Berth, Vera beside you" },
  { slot: "follow-4", len: 24, from: 955.5, rate: 1.5, note: "15:56 harbour map, Vera tagged, following" },
  { slot: "follow-5", len: 22, from: 1218.5, rate: 1.5, note: "20:19 the new pier" },
  { slot: "follow-6", len: 22, from: 1828.5, rate: 1.5, note: "30:29 the lantern dock" },
  { slot: "follow-7", len: 22, from: 2306.5, rate: 1.5, note: "38:27 the blue-door hall" },
];
function followSlots(): Record<string, Slot> {
  return Object.fromEntries(FOLLOW.map((c) => [c.slot, { note: `Follow · ${c.note}`, candidates: [{ match: "footage/fogwharf-run-raw", from: c.from, rate: c.rate }] }]));
}

export const SLOTS: Record<string, Slot> = {
  c2: { note: "C2 · 点角色头像 → 特写遮罩 → 表情切换", candidates: [{ match: ["c2"] }] },
  r0: { note: "R0 · 按麦克风说一句 → 实时转写 → Nanami 用 TTS 回话（你录）", candidates: [{ match: "footage/r0" }] },
  r5a: { note: "R5a · 月下之誓：接受契约 → 作家光标边读边写，生成月下庭院（你录）", candidates: [{ match: "footage/r5a" }] },
  r5: {
    note: "R5b · 进角色的小天地，在画布上 RP，物件一张张长出来（你录）",
    // Vera's inner landscape (心象風景) in the user's Fogwharf run, 6:48–7:02: her own notes — 今日の日記,
    // まだ言えないこと, 好きなこと・怖いこと, いつか、なりたいもの (the user pointed it out; 16:01 was the wrong canvas).
    candidates: [{ match: "footage/r5b" }, { match: "footage/fogwharf-run-raw", from: 408, rate: 2.2 }, { match: ["c7"] }, { match: ["stills", "nook"] }],
  },
  c6: { note: "C6 · 角色头像在画布上自由走动 / 跟随切场景", candidates: [{ match: "footage/c6-" }, { match: "footage/c6a-workshop-follow", from: 13, rate: 2.2 }] },
  c3: { note: "C3 · 3D 骰子掷出", candidates: [{ match: ["c3"] }] },
  gate: { note: "Gate · 门打开、光涌出来（可用 Seedance 生成，约 2 秒）", candidates: [{ match: "footage/gate" }] },
  // Fogwharf, from the user's 44-minute run, in play order inside the 64s block (A4Worlds FOGWHARF). Every Vera line
  // plays whole, in real time, right after what the user typed; her voice plays as its own levelled clip
  // (make-ryo-line.sh) starting where the picture does.
  // 5:12.5 the user types 「おけー、なんでこんなに助けて…」 (fast); 5:26 Vera: 「あんたを無条件に信用してるわけじゃないよ。
  // ただ、見落とした傷が誰かを傷つけるのは嫌だし、部品の持ち主を決めつける前に確かめたい。」 (to 5:36.8)
  "r1-ttype": { note: "R1 · 你输入「なんでこんなに助けて」", candidates: [{ match: "footage/fogwharf-run-raw", from: 312.5, rate: 4 }] },
  "r1-trust": { note: "R1 · Vera「あんたを無条件に信用してるわけじゃないよ…」", candidates: [{ match: "footage/fogwharf-run-raw", from: 326.0, rate: 1 }] },
  // 19:00 the writer agent's cursor writes the place the user reasoned toward (old-customs-landing); 20:15 they walk onto it.
  "r1-writer": { note: "R1 · 作家生成新地点（19:00）", candidates: [{ match: "footage/fogwharf-run-raw", from: 1140, rate: 3 }] },
  "r1-pier": { note: "R1 · 迷雾散开，新码头出现（20:16）", candidates: [{ match: "footage/fogwharf-run-raw", from: 1215.8, rate: 1.5 }] },
  // 27:35 the user types 「また新しい道がみえた」; 27:49 Vera: 「二隻目だね。まだ船そのものを確認したわけじゃないよ。
  // でも新しい道は本物だね。」 (to 27:55.8)
  "r1-stype": { note: "R1 · 你输入「また新しい道がみえた」", candidates: [{ match: "footage/fogwharf-run-raw", from: 1655, rate: 2 }] },
  "r1-ship": { note: "R1 · Vera「二隻目だね…」（27:49）", candidates: [{ match: "footage/fogwharf-run-raw", from: 1669.0, rate: 1 }] },
  // 32:13 the user types 「ここまで来たけど戻る？」; 32:24 Vera: 「私なら、まだ戻らない。」 and, after a pause (cut),
  // 32:28.4 「木箱の擦れか、泥のない車輪跡——どちらか一つを確かめれば、二隻目の手がかりに近づけそうだよ。」 (to 32:36.2)
  "r1-v1": { note: "R1-v1 · 你输入「ここまで来たけど戻る？」", candidates: [{ match: "footage/fogwharf-run-raw", from: 1933, rate: 2.5 }] },
  "r1-v2": { note: "R1-v2 · Vera「私なら、まだ戻らない。」", candidates: [{ match: "footage/fogwharf-run-raw", from: 1943.8, rate: 1 }] },
  "r1-v2b": { note: "R1-v2b · Vera「木箱の擦れか…」", candidates: [{ match: "footage/fogwharf-run-raw", from: 1948.3, rate: 1 }] },
  ...followSlots(),
  // First Snow's two endings: 16.24 recording 4:42.6 (the long-haired girl and the boy under the snow) and the 16.07
  // recording 14:12.1 (the boy in the coat and the girl in the red scarf).
  "r3-end1": { note: "R3 · 结局 CG 1（16.24 录屏 4:42）", candidates: [{ match: "footage/route-a-run-raw", from: 282.6, rate: 1 }] },
  "r3-end2": { note: "R3 · 结局 CG 2（16.07 录屏 14:12）", candidates: [{ match: "footage/route-b-run-raw", from: 852.1, rate: 1 }] },
  // Divergence, the same street in both timelines (user's run): original world 2:13, restored world 9:06.
  "r4-before": { note: "R4 · 原来的世界（2:13）", candidates: [{ match: "footage/divergence-run-raw", from: 133.2, rate: 0.4 }] },
  // 9:07.00 is the first clean frame of the restored storefront (a note card fades in right after) — hold it.
  "r4-after": { note: "R4 · 复原之后的世界（9:07）", candidates: [{ match: "footage/divergence-run-raw", from: 547.0, rate: 0.15 }] },
  c5: { note: "C5 · 画布拖动 / 缩放 B-roll", candidates: [{ match: ["c5"] }] },
  // Elias ("Ei"), the AI researcher, from the user's two recordings of his world (video/footage/ei-*-raw.mp4), A3's end.
  // Picture only — his voice plays as voice/elias-1.wav and elias-2.wav (levelled to the cast, make-ryo-line.sh).
  // 13.27 run, 0:50.2: his voiced reply "Take your time. But I'm not going back to my office until I hear it."
  "el-text": { note: "Elias · 语音回复（13.27 录屏 0:50）", candidates: [{ match: "footage/ei-run-raw", from: 50.2, rate: 1 }] },
  // 15.59 run (GPT Live): the call connects at 3:14; at 3:40.5 your request for a ticket is on screen and he answers
  // "Okay, let's take it slow and get it right. I'm checking what the ticket should cover."
  "el-live": { note: "Elias · GPT Live 通话（15.59 录屏 3:40）", candidates: [{ match: "footage/ei-live-run-raw", from: 220.5, rate: 1 }] },
  // 5:33.3 back on the canvas: Elias's avatar in the corridor, you click the open-office door; 5:35.5 the office with
  // "Action confirmed and the scene is synchronized." (1.5× ends at 5:36.3, before the Chinese scene toast settles).
  // Then 5:54.3, the ticket he wrote is a card in the open office (the page is Chrome-translated to English there; the
  // popup sits above the crop).
  "el-act": { note: "Elias · 动作确认、场景同步（5:35）", candidates: [{ match: "footage/ei-live-run-raw", from: 333.3, rate: 1.5 }] },
  "el-item": { note: "Elias · 任务单落库（5:54）", candidates: [{ match: "footage/ei-live-run-raw", from: 354.3, rate: 0.5 }] },
  ...worldSlots(),
};
