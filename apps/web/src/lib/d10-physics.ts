import { Body, Box, ConvexPolyhedron, Plane, Vec3, World } from 'cannon-es';
import { Quaternion, Vector3 } from 'three';
import { d10FaceBasis, d10Landing } from './d10-pose.js';

export function d10Hull() {
  const h = 1.35 * (1 - Math.cos(Math.PI / 5)) / (1 + Math.cos(Math.PI / 5));
  const vertices = [new Vec3(0, 1.35, 0), new Vec3(0, -1.35, 0)];
  for (let i = 0; i < 10; i++) vertices.push(new Vec3(1.1 * Math.cos(i * Math.PI / 5), i % 2 === 0 ? h : -h, -1.1 * Math.sin(i * Math.PI / 5)));
  const faces: number[][] = [];
  for (let i = 0; i < 10; i++) {
    const k = i < 5 ? i * 2 : (i - 5) * 2 + 1;
    const face = [i < 5 ? 0 : 1, 2 + k, 2 + (k + 1) % 10, 2 + (k + 2) % 10];
    const a = vertices[face[0]], b = vertices[face[1]], c = vertices[face[2]];
    if (b.vsub(a).cross(c.vsub(a)).dot(a) < 0) face.reverse();
    faces.push(face);
  }
  return new ConvexPolyhedron({ vertices, faces });
}

/** Read the upward face only after the rigid body has settled. Z is world up. */
export function readTopFace(q: Quaternion) {
  const ranked = Array.from({ length: 10 }, (_, digit) => ({ digit, dot: d10FaceBasis(digit).normal.applyQuaternion(q).z })).sort((a, b) => b.dot - a.dot);
  return ranked[0].dot > .98 && ranked[0].dot - ranked[1].dot > .05 ? ranked[0].digit : null;
}
export interface ThrowPose { position: [number, number, number]; rotation: [number, number, number, number] }

/** Simulate once, read the landing, then use the hull's rotational symmetry to
 * assign the authoritative face at the START of the recorded physical throw.
 * There is no terminal snap, no relabeling and no second random score. */
export async function simulateD10Throw(digits: number[], seed = Math.floor(Math.random() * 0xffffffff), cancelled = () => false) {
  let state = seed >>> 0;
  const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  const world = new World({ gravity: new Vec3(0, 0, -24), allowSleep: true });
  world.defaultContactMaterial.friction = .5;
  world.defaultContactMaterial.restitution = .25;
  const wall = (position: Vec3, axis?: Vec3, angle = 0) => {
    const body = new Body({ mass: 0, shape: new Plane(), position });
    if (axis) body.quaternion.setFromAxisAngle(axis, angle);
    world.addBody(body);
  };
  wall(new Vec3(0, 0, 0));
  // Low padded rails allow airborne dice to enter from outside the tray.
  for (const [x, y, hx, hy] of [[-4.65, 0, .15, 2.5], [4.65, 0, .15, 2.5], [0, -2.35, 4.8, .15], [0, 2.35, 4.8, .15]]) {
    world.addBody(new Body({ mass: 0, shape: new Box(new Vec3(hx, hy, .65)), position: new Vec3(x, y, .65) }));
  }
  const bodies = digits.map((_, i) => {
    const direction = i === 0 ? 1 : -1;
    const body = new Body({ mass: 1, shape: d10Hull(), position: new Vec3(direction * -6.2, i === 0 ? -.65 : .65, 3.5 + i * .2), linearDamping: .08, angularDamping: .1, allowSleep: true, sleepSpeedLimit: .18, sleepTimeLimit: .35 });
    body.quaternion.setFromEuler(random() * 6, random() * 6, random() * 6);
    // A hand throw carries momentum across the tray, with guaranteed tumble
    // around a horizontal axis; random near-zero spin looks like a dropped prop.
    body.velocity.set(direction * (9 + random() * 2), direction * (.3 + random() * .5), 1.5);
    body.angularVelocity.set(8 + random() * 8, direction * (14 + random() * 8), random() * 16 - 8);
    world.addBody(body); return body;
  });
  const frames: ThrowPose[][] = [];
  for (let step = 0; step < 1200; step++) {
    if (cancelled()) throw new Error('Throw cancelled');
    world.step(1 / 120);
    if (step % 2 === 0) frames.push(bodies.map(b => ({ position: [b.position.x, b.position.y, b.position.z], rotation: [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w] })));
    if (step > 60 && bodies.every(b => b.sleepState === Body.SLEEPING)) break;
    if (step % 120 === 119) await new Promise(resolve => setTimeout(resolve, 0));
  }
  if (!bodies.every(b => b.sleepState === Body.SLEEPING)) throw new Error('Dice did not settle on the tray');
  if (bodies.some(b => Math.abs(b.position.x) > 4.5 || Math.abs(b.position.y) > 2.2)) throw new Error('Dice did not land inside the tray');
  const corrections = bodies.map((body, i) => {
    const q = new Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
    const actual = readTopFace(q);
    if (actual === null) throw new Error('Dice landed on an edge');
    return d10Landing(actual).invert().multiply(d10Landing(digits[i]));
  });
  for (const frame of frames) frame.forEach((pose, i) => {
    pose.rotation = new Quaternion(...pose.rotation).multiply(corrections[i]).toArray() as ThrowPose['rotation'];
  });
  // Preserve left tens / right units even if the bodies crossed during impact.
  if (digits.length === 2 && frames.at(-1)![0].position[0] > frames.at(-1)![1].position[0]) {
    const halfTurn = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI);
    for (const frame of frames) for (const pose of frame) {
      pose.position[0] *= -1; pose.position[1] *= -1;
      pose.rotation = halfTurn.clone().multiply(new Quaternion(...pose.rotation)).toArray() as ThrowPose['rotation'];
    }
  }
  const final = frames.at(-1)!;
  if (!final.every((p, i) => readTopFace(new Quaternion(...p.rotation)) === digits[i])) throw new Error('Physical landing does not match the verdict');
  return frames;
}
