import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from '../../../vendor/pi-rp/node_modules/jiti/lib/jiti.mjs';
const jiti = createJiti(import.meta.url, { moduleCache: false });
const { d10Display } = await jiti.import('../src/lib/d10-display.ts');
const { d10Landing, d10FaceBasis } = await jiti.import('../src/lib/d10-pose.ts');
test('percentile dice reconstruct all 100 authoritative outcomes', () => {
 for(let r=1;r<=100;r++) {
  const d=d10Display('1d100',[r]);
  assert.equal(d.digits[0]*10+d.digits[1] || 100,r);
 }
 assert.deepEqual(d10Display('1d100',[100]).digits,[0,0]);
 assert.deepEqual(d10Display('1d100',[10]).digits,[1,0]);
 assert.deepEqual(d10Display('1d100',[1]).digits,[0,1]);
});
test('D10 uses 0 for ten; modifiers do not alter the physical faces', () => {
 assert.deepEqual(d10Display('1d10',[10]).digits,[0]);
 assert.deepEqual(d10Display('1d100+5',[62]).digits,[6,2]);
 assert.equal(d10Display('2d10',[6,2]),null);
 assert.equal(d10Display('1d100',[0]),null);
 assert.equal(d10Display('1d100',[101]),null);
});
test('every GLB numeral lands facing camera and upright', () => {
 for(let digit=0;digit<10;digit++) {
  const {normal,up}=d10FaceBasis(digit); const q=d10Landing(digit);
  normal.applyQuaternion(q);up.applyQuaternion(q);
  assert.ok(Math.abs(normal.z-1)<1e-10,`${digit}: normal`);
  assert.ok(Math.abs(up.y-1)<1e-10,`${digit}: up`);
 }
});
const { simulateD10Throw, d10Hull, readTopFace } = await jiti.import('../src/lib/d10-physics.ts');
const { Quaternion, Vector3 } = await jiti.import('../node_modules/three/build/three.module.js');
test('orientation correction is a true hull symmetry for all pairs', () => {
 const hull=d10Hull();
 for(let a=0;a<10;a++) for(let b=0;b<10;b++) {
  const q=d10Landing(a).invert().multiply(d10Landing(b));
  for(const v of hull.vertices) {
   const p=new Vector3(v.x,v.y,v.z).applyQuaternion(q);
   assert.ok(hull.vertices.some(w=>p.distanceTo(new Vector3(w.x,w.y,w.z))<1e-8),`${a} → ${b}`);
  }
 }
});
test('rigid-body trajectories stop with authoritative top digits', async () => {
 for(const digits of [[0],[1],[9],[0,0],[6,2]]) {
  const frames=await simulateD10Throw(digits,42);
  assert.ok(frames.length>30);
  frames.at(-1).forEach((pose,i)=>assert.equal(readTopFace(new Quaternion(...pose.rotation)),digits[i]));
 }
});
