/**
 * The app's 3D dice ceremony, re-staged for Remotion.
 *
 * Ported from apps/web/src/components/performance/D10Stage.tsx and apps/web/src/lib/d10-{pose,physics,display}.ts:
 * same NOCTILUCA D10 model (assets/models/arcane-d10/noctiluca-d10.glb → public/models/), same paper-faced D6,
 * same brown felt tray, camera (fov 38 at 0,-1.2,15), lights and ACES exposure 1.65, and the same cannon-es throw.
 * Everything is deterministic: the throw is simulated once from a fixed seed and replayed by frame.
 *
 * Needs a WebGL-capable render: `--gl=angle` (see README).
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Body, Box, ConvexPolyhedron, Plane, Vec3, World } from "cannon-es";
import { loadFont } from "@remotion/google-fonts/DMMono";

const MONO = loadFont("normal", { weights: ["500"], subsets: ["latin"] }).fontFamily;
const INK = "#292820";
const MUTED = "#777468";
const CREAM = "#fbf8f1";

// ───────────────────────── pose (lib/d10-pose.ts) ─────────────────────────

/** Face bases match the numbered faces in noctiluca-d10.glb. */
function d10FaceBasis(digit: number): { normal: T.Vector3; up: T.Vector3 } {
  const numbers = [0, 7, 4, 1, 6, 8, 3, 9, 2, 5];
  const index = numbers.indexOf(digit);
  if (index < 0) throw new Error("D10 digit must be 0–9");
  const h = (1.35 * (1 - Math.cos(Math.PI / 5))) / (1 + Math.cos(Math.PI / 5));
  const pole = new T.Vector3(0, 0, index < 5 ? 1.35 : -1.35);
  const ring = (i: number) => new T.Vector3(1.1 * Math.cos((i * Math.PI) / 5), 1.1 * Math.sin((i * Math.PI) / 5), i % 2 === 0 ? h : -h);
  const ringIndex = index < 5 ? index * 2 : (index - 5) * 2 + 1;
  const points = [pole, ring(ringIndex), ring((ringIndex + 1) % 10), ring((ringIndex + 2) % 10)];
  const center = points.reduce((sum, p) => sum.add(p), new T.Vector3()).multiplyScalar(0.25);
  const normal = points[1].clone().sub(pole).cross(points[2].clone().sub(pole)).normalize();
  if (normal.dot(center) < 0) normal.negate();
  const up = pole.clone().sub(center).normalize();
  const convert = (v: T.Vector3) => new T.Vector3(v.x, v.z, -v.y);
  return { normal: convert(normal), up: convert(up) };
}

function d10Landing(digit: number): T.Quaternion {
  const { normal, up } = d10FaceBasis(digit);
  const right = up.clone().cross(normal).normalize();
  return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(right, up, normal)).invert();
}

// ───────────────────────── physics (lib/d10-physics.ts) ─────────────────────────

function d10Hull(): ConvexPolyhedron {
  const h = (1.35 * (1 - Math.cos(Math.PI / 5))) / (1 + Math.cos(Math.PI / 5));
  const vertices = [new Vec3(0, 1.35, 0), new Vec3(0, -1.35, 0)];
  for (let i = 0; i < 10; i += 1) vertices.push(new Vec3(1.1 * Math.cos((i * Math.PI) / 5), i % 2 === 0 ? h : -h, -1.1 * Math.sin((i * Math.PI) / 5)));
  const faces: number[][] = [];
  for (let i = 0; i < 10; i += 1) {
    const ringIndex = i < 5 ? i * 2 : (i - 5) * 2 + 1;
    const face = [i < 5 ? 0 : 1, 2 + ringIndex, 2 + ((ringIndex + 1) % 10), 2 + ((ringIndex + 2) % 10)];
    const [a, b, c] = [vertices[face[0]], vertices[face[1]], vertices[face[2]]];
    if (b.vsub(a).cross(c.vsub(a)).dot(a) < 0) face.reverse();
    faces.push(face);
  }
  return new ConvexPolyhedron({ vertices, faces });
}

function readD10Top(q: T.Quaternion): number | null {
  const ranked = Array.from({ length: 10 }, (_, digit) => ({ digit, dot: d10FaceBasis(digit).normal.applyQuaternion(q).z })).sort((a, b) => b.dot - a.dot);
  return ranked[0].dot > 0.98 && ranked[0].dot - ranked[1].dot > 0.05 ? ranked[0].digit : null;
}

// BoxGeometry material order: +X, -X, +Y, -Y, +Z, -Z.
const D6_VALUES = [1, 6, 2, 5, 3, 4] as const;
const D6_NORMALS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const;
const d6Normal = (v: number) => new T.Vector3(...D6_NORMALS[D6_VALUES.indexOf(v as (typeof D6_VALUES)[number])]);
const d6Landing = (v: number) => new T.Quaternion().setFromUnitVectors(d6Normal(v), new T.Vector3(0, 0, 1));
const readD6Top = (q: T.Quaternion) => D6_VALUES.find((v) => d6Normal(v).applyQuaternion(q).z > 0.98) ?? null;

type Pose = { position: [number, number, number]; rotation: [number, number, number, number] };
type Trajectory = Pose[][];

/** Synchronous copy of simulateD10Throw: one seeded cannon-es throw, 60 samples per second. */
function simulateThrow(digits: number[], seed: number, faces: 6 | 10): Trajectory {
  const readTop = faces === 6 ? readD6Top : readD10Top;
  const landing = faces === 6 ? d6Landing : d10Landing;
  let state = seed >>> 0;
  const rnd = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
  const world = new World({ gravity: new Vec3(0, 0, -24), allowSleep: true });
  world.defaultContactMaterial.friction = 0.5;
  world.defaultContactMaterial.restitution = 0.25;
  world.addBody(new Body({ mass: 0, shape: new Plane(), position: new Vec3(0, 0, 0) }));
  for (const [x, y, hx, hy] of [[-4.65, 0, 0.15, 2.5], [4.65, 0, 0.15, 2.5], [0, -2.35, 4.8, 0.15], [0, 2.35, 4.8, 0.15]]) {
    world.addBody(new Body({ mass: 0, shape: new Box(new Vec3(hx, hy, 0.65)), position: new Vec3(x, y, 0.65) }));
  }
  const bodies = digits.map((_, i) => {
    const dir = i === 0 ? 1 : -1;
    const body = new Body({
      mass: 1,
      shape: faces === 6 ? new Box(new Vec3(0.8, 0.8, 0.8)) : d10Hull(),
      position: new Vec3(dir * -6.2, i === 0 ? -0.65 : 0.65, 3.5 + i * 0.2),
      linearDamping: 0.08,
      angularDamping: 0.1,
      allowSleep: true,
      sleepSpeedLimit: 0.18,
      sleepTimeLimit: 0.35,
    });
    body.quaternion.setFromEuler(rnd() * 6, rnd() * 6, rnd() * 6);
    body.velocity.set(dir * (9 + rnd() * 2), dir * (0.3 + rnd() * 0.5), 1.5);
    body.angularVelocity.set(8 + rnd() * 8, dir * (14 + rnd() * 8), rnd() * 16 - 8);
    world.addBody(body);
    return body;
  });
  const frames: Trajectory = [];
  for (let step = 0; step < 1200; step += 1) {
    world.step(1 / 120);
    if (step % 2 === 0) frames.push(bodies.map((b) => ({ position: [b.position.x, b.position.y, b.position.z], rotation: [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w] })));
    if (step > 60 && bodies.every((b) => b.sleepState === Body.SLEEPING)) break;
  }
  if (!bodies.every((b) => b.sleepState === Body.SLEEPING)) throw new Error("did not settle");
  if (bodies.some((b) => Math.abs(b.position.x) > 4.5 || Math.abs(b.position.y) > 2.2)) throw new Error("left the tray");
  // Re-orient the whole throw so the settled face is the authoritative one (same trick as the app).
  const corrections = bodies.map((b, i) => {
    const actual = readTop(new T.Quaternion(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w));
    if (actual === null) throw new Error("landed on an edge");
    return landing(actual).invert().multiply(landing(digits[i]));
  });
  for (const frame of frames) frame.forEach((pose, i) => (pose.rotation = new T.Quaternion(...pose.rotation).multiply(corrections[i]).toArray() as Pose["rotation"]));
  if (digits.length === 2 && frames.at(-1)![0].position[0] > frames.at(-1)![1].position[0]) {
    const half = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), Math.PI);
    for (const frame of frames)
      for (const pose of frame) {
        pose.position[0] *= -1;
        pose.position[1] *= -1;
        pose.rotation = half.clone().multiply(new T.Quaternion(...pose.rotation)).toArray() as Pose["rotation"];
      }
  }
  return frames;
}

/** The app's default seed first, then neighbours until a clean landing (never changes the result). */
function findThrow(digits: number[], faces: 6 | 10): Trajectory {
  const base = faces === 10 && digits.length === 1 ? 4 : 1;
  for (let k = 0; k < 60; k += 1) {
    try {
      return simulateThrow(digits, base + k, faces);
    } catch {
      /* try the next seed */
    }
  }
  throw new Error(`No clean ${digits.length}d${faces} throw for ${digits.join(",")}`);
}

// ───────────────────────── display (lib/d10-display.ts) ─────────────────────────

type Display = { faces: 6 | 10; digits: number[]; labels: string[]; reading: string; total: number };

function stageDisplay(dice: string, rolls: number[]): Display | null {
  const m = /^(\d*)d(\d+)$/i.exec(dice.trim());
  if (!m) return null;
  const count = m[1] ? Number(m[1]) : 1;
  const faces = Number(m[2]);
  const sum = rolls.reduce((a, b) => a + b, 0);
  if (faces === 10 && count === 2 && rolls.length === 2) return { faces: 10, digits: rolls.map((v) => v % 10), labels: ["D10 · 1", "D10 · 2"], reading: rolls.join(" + "), total: sum };
  if (faces === 6 && count <= 2 && rolls.length === count) return { faces: 6, digits: [...rolls], labels: rolls.map((_, i) => `D6 · ${i + 1}`), reading: rolls.join(" + "), total: sum };
  if (count === 1 && faces === 10 && rolls.length === 1) return { faces: 10, digits: [rolls[0] % 10], labels: ["D10"], reading: `${rolls[0] % 10} → ${rolls[0]}`, total: rolls[0] };
  if (count === 1 && faces === 100 && rolls.length === 1) {
    const v = rolls[0];
    const tens = Math.floor((v % 100) / 10);
    return { faces: 10, digits: [tens, v % 10], labels: ["×10", "×1"], reading: `${String(tens * 10).padStart(2, "0")} + ${v % 10} → ${v}`, total: v };
  }
  return null;
}

/** Engine-style expectation: ">=11", "<20", "=7". */
function passes(expect: string | undefined, total: number): boolean | null {
  const m = expect && /^\s*(>=|<=|>|<|==|=)?\s*(\d+)\s*$/.exec(expect);
  if (!m) return null;
  const n = Number(m[2]);
  switch (m[1] ?? "=") {
    case ">=": return total >= n;
    case "<=": return total <= n;
    case ">": return total > n;
    case "<": return total < n;
    default: return total === n;
  }
}

// ───────────────────────── three.js stage (components/performance/D10Stage.tsx) ─────────────────────────

function buildTray(): T.Group {
  const outline = new T.Shape();
  outline.moveTo(-4.1, -2.2);
  outline.lineTo(4.1, -2.2);
  outline.quadraticCurveTo(4.5, -2.2, 4.5, -1.8);
  outline.lineTo(4.5, 1.8);
  outline.quadraticCurveTo(4.5, 2.2, 4.1, 2.2);
  outline.lineTo(-4.1, 2.2);
  outline.quadraticCurveTo(-4.5, 2.2, -4.5, 1.8);
  outline.lineTo(-4.5, -1.8);
  outline.quadraticCurveTo(-4.5, -2.2, -4.1, -2.2);
  // Brown felt nap, seeded so every frame and every render is identical.
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#6b4a35";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i += 1) {
    const r = (k: string) => random(`felt-${i}-${k}`);
    const angle = r("a") * Math.PI;
    const length = 1 + r("l") * 3;
    ctx.fillStyle = r("c") < 0.5 ? `rgba(214,170,120,${0.05 + r("o") * 0.08})` : `rgba(40,24,14,${0.06 + r("o") * 0.1})`;
    ctx.fillRect(r("x") * 256, r("y") * 256, Math.cos(angle) * length + 1, Math.sin(angle) * length + 1);
  }
  const nap = new T.CanvasTexture(canvas);
  nap.colorSpace = T.SRGBColorSpace;
  nap.wrapS = nap.wrapT = T.RepeatWrapping;
  nap.repeat.set(3, 1.5);
  const velvet = new T.MeshPhysicalMaterial({ color: 0xffffff, map: nap, bumpMap: nap, bumpScale: 0.02, roughness: 1, sheen: 1, sheenColor: new T.Color(0xa0714d), sheenRoughness: 0.85, side: T.DoubleSide });
  const group = new T.Group();
  const floor = new T.Mesh(new T.ShapeGeometry(outline), velvet);
  floor.position.z = -0.025;
  floor.receiveShadow = true;
  group.add(floor);
  const edge = outline.getPoints(12);
  const positions: number[] = [];
  const indices: number[] = [];
  edge.forEach((p) => positions.push(p.x, p.y, 0, p.x * 1.06, p.y * 1.12, 1.3));
  for (let i = 0; i < edge.length - 1; i += 1) {
    const o = i * 2;
    indices.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
  }
  const railGeometry = new T.BufferGeometry();
  railGeometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  railGeometry.setIndex(indices);
  railGeometry.computeVertexNormals();
  group.add(new T.Mesh(railGeometry, velvet.clone()));
  return group;
}

function d6Materials(): T.Material[] {
  return D6_VALUES.map((value) => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f4f0e8";
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "#899b87";
    ctx.lineWidth = 5;
    ctx.strokeRect(10, 10, 236, 236);
    ctx.fillStyle = "#292820";
    ctx.font = "bold 150px Georgia";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(value), 128, 138);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    return new T.MeshStandardMaterial({ map: texture, roughness: 0.65 });
  });
}

type DiePose = { visible: boolean; position: T.Vector3; quaternion: T.Quaternion };

const Stage: React.FC<{ model: T.Object3D | null; display: Display; poses: DiePose[] }> = ({ model, display, poses }) => {
  const { gl, scene, camera } = useThree();
  // Renderer, environment and camera exactly as the app sets them up (created once, during render,
  // so the very first rendered frame already has them).
  useMemo(() => {
    gl.toneMapping = T.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.65;
    gl.shadowMap.enabled = true;
    const pmrem = new T.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room).texture;
    room.dispose();
    pmrem.dispose();
  }, [gl, scene]);
  useMemo(() => {
    camera.position.set(0, -1.2, 15);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);
  const tray = useMemo(buildTray, []);
  const dice = useMemo(() => {
    const scale = model ? 2.7 / Math.max(...new T.Box3().setFromObject(model).getSize(new T.Vector3()).toArray()) : 1;
    const faceMats = display.faces === 6 ? d6Materials() : [];
    return display.digits.map(() => {
      const pivot = new T.Group();
      const mesh = display.faces === 6 ? new T.Mesh(new T.BoxGeometry(1.6, 1.6, 1.6), faceMats) : model!.clone(true);
      if (display.faces === 10) mesh.scale.multiplyScalar(scale);
      mesh.traverse((n) => {
        if ((n as T.Mesh).isMesh) (n as T.Mesh).castShadow = true;
      });
      pivot.add(mesh);
      return pivot;
    });
  }, [model, display]);
  dice.forEach((pivot, i) => {
    pivot.visible = poses[i].visible;
    pivot.position.copy(poses[i].position);
    pivot.quaternion.copy(poses[i].quaternion);
  });
  return (
    <>
      <hemisphereLight args={[0xddd2ff, 0x21102f, 2]} />
      <directionalLight position={[-3, 5, 6]} intensity={4} color={0xffe5b0} castShadow shadow-mapSize={[1024, 1024]} />
      <primitive object={tray} />
      {dice.map((pivot, i) => (
        <primitive key={i} object={pivot} />
      ))}
    </>
  );
};

// ───────────────────────── component ─────────────────────────

/** Longest the tumble may take on screen; longer simulations are played slightly faster. */
const MAX_TUMBLE_S = 1.2;
/** After landing, the dice ease onto their presentation pose (the app snaps). */
const PRESENT_FRAMES = 9;

const useModel = (needed: boolean) => {
  const [model, setModel] = useState<T.Object3D | null>(null);
  const [handle] = useState(() => (needed ? delayRender("Loading NOCTILUCA D10") : null));
  useEffect(() => {
    if (handle === null) return;
    new GLTFLoader()
      .loadAsync(staticFile("models/noctiluca-d10.glb"))
      .then((gltf) => {
        setModel(gltf.scene);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, [handle]);
  return model;
};

export const Dice3D: React.FC<{
  dice: string;
  results: number[];
  /** Frame (relative to this component) the dice leave the hand. */
  throwAt?: number;
  showResult?: boolean;
  /** Pass condition in engine syntax, e.g. ">=11" — drives the Check Passed / Failed badge. */
  expect?: string;
  desc?: string;
}> = ({ dice, results, throwAt = 0, showResult = false, expect, desc }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const display = useMemo(() => stageDisplay(dice, results), [dice, results]);
  const model = useModel(display?.faces === 10);
  const trajectory = useMemo(() => (display ? findThrow(display.digits, display.faces) : null), [display]);

  // Fill the container. Its size can still be 0 on the first layout pass, so wait for a real size
  // (ResizeObserver) before letting the frame be captured; fall back to the composition size.
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [measure] = useState(() => delayRender("Measuring dice stage"));
  useLayoutEffect(() => {
    const el = ref.current!;
    let released = false;
    const release = () => {
      if (!released) continueRender(measure);
      released = true;
    };
    const apply = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
        release();
      }
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    const fallback = window.setTimeout(() => {
      if (released) return;
      setSize({ w: width, h: height });
      release();
    }, 1000);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, [measure, width, height]);

  if (!display || !trajectory) {
    return (
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 64, color: CREAM }}>
        {results.join(" · ")}
      </AbsoluteFill>
    );
  }

  const simSeconds = (trajectory.length - 1) / 60;
  const speed = Math.max(1, simSeconds / MAX_TUMBLE_S);
  const tumbleFrames = Math.round((simSeconds / speed) * fps);
  const t = frame - throwAt;
  const landedAt = throwAt + tumbleFrames;
  const present = interpolate(frame, [landedAt, landedAt + PRESENT_FRAMES], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ease = present * present * (3 - 2 * present);

  const poses: DiePose[] = display.digits.map((digit, i) => {
    const at = Math.min(trajectory.length - 1, Math.max(0, (t / fps) * 60 * speed));
    const lo = Math.floor(at);
    const hi = Math.min(lo + 1, trajectory.length - 1);
    const a = trajectory[lo][i];
    const b = trajectory[hi][i];
    const position = new T.Vector3(...a.position).lerp(new T.Vector3(...b.position), at - lo);
    const quaternion = new T.Quaternion(...a.rotation).slerp(new T.Quaternion(...b.rotation), at - lo);
    // Presentation pose from D10Stage: centred row, numeral facing the camera.
    const restX = display.digits.length === 2 ? (i === 0 ? -1.65 : 1.65) : 0;
    const target = display.faces === 6 ? d6Landing(digit) : d10Landing(digit);
    position.lerp(new T.Vector3(restX, 0, 1), ease);
    quaternion.slerp(target, ease);
    return { visible: t >= 0, position, quaternion };
  });

  const verdict = passes(expect, display.total);
  const reveal = showResult ? spring({ frame: frame - (landedAt + PRESENT_FRAMES), fps, config: { damping: 16, stiffness: 180 } }) : 0;
  const k = size ? size.h / 900 : 1;

  return (
    <div ref={ref} style={{ position: "relative", width: "100%", height: "100%" }}>
      {size && (display.faces === 6 || model) && (
        <ThreeCanvas
          width={size.w}
          height={size.h}
          shadows
          gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
          camera={{ fov: 38, near: 0.1, far: 100, position: [0, -1.2, 15] }}
          // The result card slides in below; lift and shrink the tray so the card never covers the dice.
          style={{ position: "absolute", inset: 0, transform: `translateY(${-reveal * 17}%) scale(${1 - reveal * 0.12})` }}
        >
          <Stage model={model} display={display} poses={poses} />
        </ThreeCanvas>
      )}
      {showResult && reveal > 0.001 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 24 * k,
            transform: `translateX(-50%) translateY(${(1 - reveal) * 40 * k}px) scale(${0.94 + 0.06 * reveal})`,
            opacity: reveal,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14 * k,
            padding: `${22 * k}px ${56 * k}px`,
            borderRadius: 24 * k,
            background: "rgba(251,248,241,0.95)",
            border: "1px solid rgba(41,40,32,0.1)",
            boxShadow: "0 26px 60px rgba(35,28,20,0.35)",
            color: INK,
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ display: "flex", gap: 36 * k, fontFamily: MONO, fontSize: 22 * k, letterSpacing: "0.12em", color: MUTED }}>
            {display.labels.map((label, i) => (
              <span key={i}>
                {label} · {display.digits[i] === 0 && display.faces === 10 && display.labels[0] !== "×10" ? results[i] : display.digits[i]}
              </span>
            ))}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 24 * k, color: INK }}>{display.reading}</div>
          <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 96 * k, lineHeight: 1, color: INK }}>{display.total}</div>
          {verdict !== null && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8 * k,
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 20 * k,
                fontWeight: 600,
                padding: `${6 * k}px ${16 * k}px`,
                borderRadius: 999,
                color: verdict ? "#047857" : "#be123c",
                background: verdict ? "#ecfdf5" : "#fff1f2",
              }}
            >
              <svg width={22 * k} height={22 * k} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                {verdict ? <path d="m8.5 12.5 2.5 2.5 5-5.5" /> : <path d="M12 7.5v5.5M12 16.5h.01" />}
              </svg>
              {verdict ? "Check Passed" : "Check Failed"}
            </span>
          )}
          {(desc || expect) && (
            <div style={{ display: "flex", gap: 14 * k, fontSize: 18 * k, color: MUTED, fontFamily: MONO }}>
              {desc && <span style={{ color: INK, fontFamily: "Inter, system-ui, sans-serif", fontWeight: 600 }}>{desc}</span>}
              {expect && <span>Requires: {expect}</span>}
              <span>{dice}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
