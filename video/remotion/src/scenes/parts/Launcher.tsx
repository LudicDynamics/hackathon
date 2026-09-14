import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Media } from "../../components/Media";
import { PlayerCursor } from "../../components/Kit";
import { ORANGE } from "../../lib/theme";
import "./world-launcher.css";

/**
 * The app's World Launcher (apps/web/src/components/WorldLauncher.tsx, commit bb00fd8) as a
 * frame-driven shot: same markup, classNames and CSS; pan, tilt, hover and the handoff zoom are
 * computed from the frame instead of pointer events and CSS transitions.
 */

// ── Pure helpers ported from apps/web/src/lib/world-launcher.ts ─────────────────────────────

/** Odd rows are shifted half a brick; with ≥5 worlds no two touching bricks repeat. */
function brickWorld(col: number, row: number, count: number): number {
  if (count <= 0) return 0;
  return (((col + 3 * row) % count) + count) % count;
}
type BrickGeometry = { w: number; h: number; gap: number };
function brickGeometry(viewportWidth: number): BrickGeometry {
  const w = Math.round(Math.min(520, Math.max(280, viewportWidth * 0.3)));
  return { w, h: Math.round(w * 0.6), gap: Math.round(w * 0.05) };
}
type Brick = { col: number; row: number; left: number; top: number };
function visibleBricks(x: number, y: number, width: number, height: number, g: BrickGeometry, margin = 1): Brick[] {
  const cellW = g.w + g.gap;
  const cellH = g.h + g.gap;
  const bricks: Brick[] = [];
  for (let row = Math.floor(y / cellH) - margin; row <= Math.floor((y + height) / cellH) + margin; row++) {
    const shift = row & 1 ? cellW / 2 : 0;
    for (let col = Math.floor((x - shift) / cellW) - margin; col <= Math.floor((x + width - shift) / cellW) + margin; col++) {
      bricks.push({ col, row, left: col * cellW + shift, top: row * cellH });
    }
  }
  return bricks;
}

// ── The shelf, as the live /api/worlds returned it (English editions, shelf order) ──────────

type LauncherWorld = { id: string; title: string; description: string; cover: string; video?: string; saves: number; current?: boolean };
const WORLDS: LauncherWorld[] = [
  { id: "divergence", title: "Divergence", description: "A fixed frog and a girl who never returned. Walk through three times at the same shop and change the morning she was supposed to come.", cover: "covers/divergence.webp", video: "bg/divergence/intro.webm", saves: 11 },
  { id: "first-snow", title: "First Snow Radio", description: "What will you say tonight? Your destination, promises, and replies. Your words shape this night’s ending.", cover: "covers/first-snow.webp", video: "bg/first-snow/intro.webm", saves: 1, current: true },
  { id: "magic-academy", title: "Magic Academy", description: "Combine words, things, and costs. Your named small magic will change closed spaces.", cover: "covers/magic-academy.webp", saves: 6 },
  { id: "moonlit-contract", title: "The Moonlit Pact", description: "Moonlit Summoning. How will you respond to the offered hand? From a single promise, to uncharted nights still to be told.", cover: "covers/moonlit-contract.png", saves: 2 },
  { id: "unwritten-door", title: "The Unwritten Door", description: "An unopened letter and a phone shape the place that waits outside. One door, one living new scene.", cover: "covers/unwritten-door.png", saves: 1 },
  { id: "whitechapel", title: "Holmes: The Fourth Case", description: "You are Holmes. Investigate who’s turning the novel-like incidents into real crimes and stop the fourth incident today.", cover: "covers/whitechapel.webp", video: "bg/whitechapel/intro.webm", saves: 2 },
  { id: "wuwu", title: "Fogwharf", description: "Find the second ship. As the fog clears, a path to the still unnamed town appears.", cover: "covers/wuwu.webp", video: "bg/wuwu/intro.webm", saves: 9 },
];
const LANGUAGES = ["日本語", "中文", "English"];

// ── Fixed geometry (the header has a fixed height in the copied CSS) ────────────────────────

const VW = 1920;
const VH = 1080;
const STAGE_TOP = 78; // padding 18 + header 48 + margin 12
const STAGE = { w: VW, h: VH - STAGE_TOP };
const GEO = brickGeometry(STAGE.w);
const CELL_W = GEO.w + GEO.gap;
const CELL_H = GEO.h + GEO.gap;
const TILT_SCALE = 1.04; // .world-launcher__tilt scale
const HOVER_LIFT = 0.035; // .is-active scale
const PLAYING_BRICKS = 5;
/** Where the chosen brick comes to rest on screen (slightly left of centre, like a natural stop). */
const REST = { x: 900, y: 590 };

type Pt = { x: number; y: number };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Wall point (layer coordinates) → screen, ignoring the few degrees of tilt. */
const wallToScreen = (pan: Pt, wx: number, wy: number): Pt => ({
  x: STAGE.w / 2 + (wx - pan.x - STAGE.w / 2) * TILT_SCALE,
  y: STAGE_TOP + STAGE.h / 2 + (wy - pan.y - STAGE.h / 2) * TILT_SCALE,
});
const screenToWall = (pan: Pt, sx: number, sy: number): Pt => ({
  x: pan.x + STAGE.w / 2 + (sx - STAGE.w / 2) / TILT_SCALE,
  y: pan.y + STAGE.h / 2 + (sy - STAGE_TOP - STAGE.h / 2) / TILT_SCALE,
});
/** The pan that puts wall point (wx, wy) at screen point s. */
const panFor = (wx: number, wy: number, s: Pt): Pt => ({
  x: wx - STAGE.w / 2 - (s.x - STAGE.w / 2) / TILT_SCALE,
  y: wy - STAGE.h / 2 - (s.y - STAGE_TOP - STAGE.h / 2) / TILT_SCALE,
});
const brickAt = (w: Pt): Brick | null => {
  const row = Math.floor(w.y / CELL_H);
  const shift = row & 1 ? CELL_W / 2 : 0;
  const col = Math.floor((w.x - shift) / CELL_W);
  const left = col * CELL_W + shift;
  const top = row * CELL_H;
  return w.x - left <= GEO.w && w.y - top <= GEO.h ? { col, row, left, top } : null;
};
const keyOf = (b: Brick) => `${b.col}:${b.row}`;

/** Deterministic timeline for one shot length: pan, cursor, tilt and hover for every frame. */
function script(D: number, target: string) {
  const DRIFT = Math.round(D * 0.2);
  const RELEASE = Math.round(D * 0.45);
  const GLIDE_END = Math.round(D * 0.6);
  const ARRIVE = Math.round(D * 0.72);
  const CLICK = Math.round(D * 0.8);
  const ZOOM = Math.round(D * 0.87);

  const P0 = { x: 1500, y: 960 };
  const A = { x: 1210, y: 720 };
  const B = { x: 620, y: 400 };
  const early = (f: number): Pt =>
    f <= DRIFT
      ? lerpPt(P0, A, Easing.out(Easing.cubic)(clamp01(f / DRIFT)))
      : f <= RELEASE
        ? lerpPt(A, B, Easing.in(Easing.cubic)(clamp01((f - DRIFT) / (RELEASE - DRIFT)))) // speeds up into the fling
        : B;

  // Pan: open centred on the first world, drift, follow the drag, then glide out with the app's decay.
  const pans: Pt[] = [];
  let x = GEO.w / 2 - STAGE.w / 2;
  let y = GEO.h / 2 - STAGE.h / 2;
  let vx = 0;
  let vy = 0;
  for (let f = 0; f < D; f++) {
    if (f > 0 && f <= DRIFT) {
      x += 0.9;
      y += 0.3;
    } else if (f > DRIFT && f <= RELEASE) {
      const a = early(f - 1);
      const b = early(f);
      vx = -(b.x - a.x);
      vy = -(b.y - a.y);
      x += vx;
      y += vy;
    } else if (f > RELEASE && f <= GLIDE_END) {
      x += vx;
      y += vy;
      const decay = Math.pow(0.94, 33.3 / 16); // 0.94 per 16ms, as WorldLauncher's glide
      vx *= decay;
      vy *= decay;
    }
    pans.push({ x, y });
  }

  // The glide comes to rest with a `target` brick at REST: pick the one needing the least correction
  // and fold that correction into the glide, so the stop reads as natural.
  const natural = pans[GLIDE_END];
  const idx = Math.max(0, WORLDS.findIndex((w) => w.id === target));
  const goal = visibleBricks(natural.x, natural.y, STAGE.w, STAGE.h, GEO, 1)
    .filter((b) => brickWorld(b.col, b.row, WORLDS.length) === idx)
    .map((b) => {
      const p = panFor(b.left + GEO.w / 2, b.top + GEO.h / 2, REST);
      return { b, c: { x: p.x - natural.x, y: p.y - natural.y } };
    })
    .sort((a, b) => Math.hypot(a.c.x, a.c.y) - Math.hypot(b.c.x, b.c.y))[0];
  for (let f = RELEASE + 1; f < D; f++) {
    const k = f >= GLIDE_END ? 1 : Easing.out(Easing.quad)((f - RELEASE) / (GLIDE_END - RELEASE));
    const base = f >= GLIDE_END ? natural : pans[f];
    pans[f] = { x: base.x + goal.c.x * k, y: base.y + goal.c.y * k };
  }
  const T = { x: REST.x - 30, y: REST.y + 20 };

  const cursors: Pt[] = [];
  for (let f = 0; f < D; f++) {
    cursors.push(f <= GLIDE_END ? early(f) : lerpPt(B, T, Easing.inOut(Easing.cubic)(clamp01((f - GLIDE_END) / (ARRIVE - GLIDE_END)))));
  }

  // Lean follows the pointer with the CSS's .6s ease — a per-frame exponential chase.
  const tilts: Pt[] = [];
  let tx = 0;
  let ty = 0;
  for (let f = 0; f < D; f++) {
    const c = cursors[f];
    tx += ((c.x / VW - 0.5) * 2 - tx) * 0.12;
    ty += ((c.y / VH - 0.5) * 2 - ty) * 0.12;
    tilts.push({ x: tx, y: ty });
  }

  // Hover: whatever brick is under the pointer, except while dragging or gliding (no pointerenter fires).
  const hovered: (string | null)[] = [];
  for (let f = 0; f < D; f++) {
    if (f > DRIFT && f <= GLIDE_END) {
      hovered.push(null);
      continue;
    }
    const b = f >= ARRIVE ? goal.b : brickAt(screenToWall(pans[f], cursors[f].x, cursors[f].y));
    hovered.push(b ? keyOf(b) : null);
  }

  return { DRIFT, RELEASE, GLIDE_END, ARRIVE, CLICK, ZOOM, pans, cursors, tilts, hovered, goal: goal.b, goalKey: keyOf(goal.b) };
}

/** Spring in when a brick becomes hovered, spring out when it stops (the CSS's .45s transform). */
function liftOf(hovered: (string | null)[], key: string, f: number, fps: number): number {
  const cfg = { damping: 18, stiffness: 170 };
  if (hovered[f] === key) {
    let s = f;
    while (s > 0 && hovered[s - 1] === key) s--;
    return spring({ frame: f - s, fps, config: cfg });
  }
  let e = f;
  while (e > 0 && hovered[e] !== key && f - e < 24) e--;
  if (hovered[e] !== key) return 0;
  let s = e;
  while (s > 0 && hovered[s - 1] === key) s--;
  const peak = spring({ frame: e - s, fps, config: cfg });
  return peak * (1 - spring({ frame: f - e, fps, config: cfg }));
}

const url = (p: string) => ({ backgroundImage: `url("${staticFile(p)}")` });

const BrickView: React.FC<{
  world: LauncherWorld;
  index: number;
  left: number;
  top: number;
  lift: number;
  open: number;
  playing: boolean;
  glint?: Pt;
  textFade: number;
}> = ({ world, index, left, top, lift, open, playing, glint, textFade }) => {
  const cover = url(world.cover);
  return (
    <article
      className={`world-launcher__tile${lift > 0.5 ? " is-active" : ""}`}
      style={{ left, top, width: GEO.w, height: GEO.h, transform: `scale(${1 + HOVER_LIFT * lift})` }}
    >
      <span className="world-launcher__image" style={cover} />
      {playing && world.video && (
        <div className="world-launcher__video">
          <Media src={world.video} />
        </div>
      )}
      <span className="world-launcher__rim">
        <span style={cover} />
      </span>
      <span className="world-launcher__fringe" />
      <span
        className="world-launcher__sheen"
        style={glint ? { background: `radial-gradient(55% 38% at ${28 + glint.x * 44}% ${8 + glint.y * 30}%, rgba(255, 255, 255, .24), transparent 70%)` } : undefined}
      />
      <span className="world-launcher__hit" />
      <span className="world-launcher__meta" style={{ opacity: 0.82 * textFade }}>
        <span>
          <i>{String(index + 1).padStart(2, "0")}</i>English
        </span>
        <span>{world.current ? "Current game" : `${world.saves} saves`}</span>
      </span>
      <div className="world-launcher__caption" style={{ opacity: textFade }}>
        <b>{world.title}</b>
        <small>{world.description}</small>
        {open > 0 && (
          <div className="world-launcher__actions" style={{ opacity: open, transform: `translateY(${(1 - open) * 10}px)` }}>
            <button type="button">Continue latest save</button>
            <button type="button">＋ Start a new game</button>
          </div>
        )}
      </div>
    </article>
  );
};

/**
 * ~5s of the launcher: drift with the wall leaning after the cursor → drag and fling →
 * settle on the `target` world's brick (hover lift, glint follows the cursor) → click opens its
 * actions → the brick grows toward the camera until it fills the frame.
 */
export const LauncherShot: React.FC<{ target?: string }> = ({ target = "wuwu" }) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames: D } = useVideoConfig();
  const s = useMemo(() => script(D, target), [D, target]);
  const i = Math.min(D - 1, Math.max(0, f));
  const pan = s.pans[i];
  const cursor = s.cursors[i];

  // Handoff zoom. The stage's clip box grows up over the header (which fades), and an inner box
  // scales around the target brick; while zooming the lean is flattened to a 2D transform so the
  // bricks re-rasterise sharply instead of stretching a composited 3D layer.
  const z = interpolate(f, [s.ZOOM, D - 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const gx = s.goal.left + GEO.w / 2 - pan.x;
  const gy = s.goal.top + GEO.h / 2 - pan.y;
  const originX = STAGE.w / 2 + (gx - STAGE.w / 2) * TILT_SCALE;
  const originY = STAGE.h / 2 + (gy - STAGE.h / 2) * TILT_SCALE;
  const fill = (VW / (GEO.w * TILT_SCALE * (1 + HOVER_LIFT))) * 1.18;
  const zoomTransform = `translate(${(VW / 2 - originX) * z}px, ${(VH / 2 - STAGE_TOP - originY) * z}px) scale(${1 + (fill - 1) * z})`;

  const bricks = visibleBricks(pan.x, pan.y, STAGE.w, STAGE.h, GEO, 1);
  const hovered = s.hovered[i];
  // Videos play only near the centre of the view, plus the hovered brick (as in the app).
  const cx = pan.x + STAGE.w / 2;
  const cy = pan.y + STAGE.h / 2;
  const nearest = new Set(
    bricks
      .map((b) => ({ k: keyOf(b), d: Math.hypot(b.left + GEO.w / 2 - cx, b.top + GEO.h / 2 - cy) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, PLAYING_BRICKS)
      .map((e) => e.k),
  );
  const open = f >= s.CLICK + 2 ? spring({ frame: f - s.CLICK - 2, fps, config: { damping: 16, stiffness: 220 } }) : 0;
  const pressed = (f >= s.DRIFT && f <= s.RELEASE) || (f >= s.CLICK && f < s.CLICK + 4);
  const chrome = 1 - z;
  const goalScreen = wallToScreen(pan, s.goal.left + GEO.w / 2, s.goal.top + GEO.h / 2);
  const tilt = s.tilts[i];

  return (
    <AbsoluteFill>
      <div className="world-launcher" style={{ "--tilt-x": tilt.x.toFixed(3), "--tilt-y": tilt.y.toFixed(3) } as React.CSSProperties}>
        <div className="world-launcher__ambient" style={{ "--count": WORLDS.length } as React.CSSProperties}>
          {WORLDS.map((w) => (
            <span key={w.id} style={url(w.cover)} />
          ))}
        </div>
        <header className="world-launcher__top" style={{ opacity: chrome }}>
          <span className="world-launcher__brand">
            World<span>lines</span>
          </span>
          <div className="world-launcher__langs">
            {LANGUAGES.map((label) => (
              <button key={label} type="button" aria-pressed={label === "English"}>
                {label}
              </button>
            ))}
          </div>
          <nav>
            <button type="button" className="world-launcher__pill">
              Saved games
            </button>
            <button type="button" className="world-launcher__pill">
              Continue this story
            </button>
          </nav>
        </header>
        <div className="world-launcher__stage" style={{ marginTop: -STAGE_TOP * z }}>
          <div style={{ position: "absolute", inset: 0, transform: `translateY(${STAGE_TOP * z}px)` }}>
            <div style={{ position: "absolute", inset: 0, transformOrigin: `${originX}px ${originY}px`, transform: z > 0 ? zoomTransform : undefined }}>
              <div className="world-launcher__tilt" style={z > 0 ? { transform: `scale(${TILT_SCALE})` } : undefined}>
                <div className="world-launcher__layer" style={{ transform: `translate(${-pan.x}px, ${-pan.y}px)` }}>
                  {bricks.map((b) => {
                    const k = keyOf(b);
                    const index = brickWorld(b.col, b.row, WORLDS.length);
                    const isGoal = k === s.goalKey;
                    const glint =
                      hovered === k
                        ? {
                            x: Math.max(-0.5, Math.min(0.5, (cursor.x - goalScreen.x) / GEO.w)),
                            y: Math.max(-0.5, Math.min(0.5, (cursor.y - goalScreen.y) / GEO.h)),
                          }
                        : undefined;
                    return (
                      <BrickView
                        key={k}
                        world={WORLDS[index]}
                        index={index}
                        left={b.left}
                        top={b.top}
                        lift={liftOf(s.hovered, k, i, fps)}
                        open={isGoal ? open : 0}
                        playing={nearest.has(k) || hovered === k}
                        glint={glint}
                        textFade={isGoal ? 1 - z : 1}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="world-launcher__hint" style={{ opacity: 0.7 * chrome }}>
          Drag or scroll to wander
        </p>
        <p className="world-launcher__credit" style={{ opacity: 0.55 * chrome }}>
          音楽：魔王魂
        </p>
      </div>
      {z < 0.15 && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, opacity: 1 - z / 0.15 }}>
          <PlayerCursor x={cursor.x} y={cursor.y} color={ORANGE} pressed={pressed} size={48} />
        </div>
      )}
    </AbsoluteFill>
  );
};
