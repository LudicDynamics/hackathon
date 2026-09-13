import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrameLoop, createFrameTask } from '../apps/web/src/lib/effects-clock.mjs';

function scheduler() {
  let id = 0;
  const pending = new Map();
  return {
    request: fn => { pending.set(++id, fn); return id; },
    cancel: key => pending.delete(key),
    tick: time => { const jobs = [...pending.values()]; pending.clear(); jobs.forEach(fn => fn(time)); },
    count: () => pending.size,
  };
}
test('pointer bursts schedule one frame and cancellation removes pending work', () => {
  const clock = scheduler(); let draws = 0;
  const task = createFrameTask(() => draws++, clock);
  for (let i = 0; i < 100; i++) task.schedule();
  assert.equal(clock.count(), 1);
  clock.tick(0); assert.equal(draws, 1);
  task.schedule(); task.cancel(); clock.tick(16);
  assert.equal(draws, 1);
});
test('particles draw at 30 fps even on a 120 Hz display', () => {
  const clock = scheduler(); let draws = 0;
  const loop = createFrameLoop(() => draws++, clock);
  loop.start(); loop.start();
  for (let time = 0; time < 1000; time += 1000 / 120) clock.tick(time);
  assert.ok(draws >= 29 && draws <= 31, `Unexpected frame count: ${draws}`);
  loop.stop(); assert.equal(clock.count(), 0);
});
test('hidden or disabled animation stops; resuming never advances by the hidden duration', () => {
  const clock = scheduler(); const steps = [];
  const loop = createFrameLoop(delta => steps.push(delta), clock);
  loop.start(); clock.tick(0); loop.stop(); clock.tick(50000);
  assert.equal(steps.length, 1);
  loop.start(); clock.tick(60000);
  assert.ok(steps[1] <= 50);
  loop.stop(); assert.equal(clock.count(), 0);
});

test('frame limiting preserves elapsed animation time at uneven display intervals', () => {
  const clock = scheduler(); let elapsed = 0;
  const loop = createFrameLoop(delta => { elapsed += delta; }, clock);
  loop.start();
  for (let time = 0; time <= 1000; time += 10) clock.tick(time);
  assert.ok(Math.abs(elapsed - (1000 + 1000 / 30)) < 1);
  loop.stop();
});
