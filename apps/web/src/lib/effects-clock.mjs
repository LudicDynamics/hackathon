const browserClock = { request: callback => requestAnimationFrame(callback), cancel: id => cancelAnimationFrame(id) };

export function createFrameTask(draw, clock = browserClock) {
  let frame = null;
  return {
    schedule() {
      if (frame !== null) return;
      frame = clock.request(() => { frame = null; draw(); });
    },
    cancel() { if (frame !== null) clock.cancel(frame); frame = null; },
  };
}

export function createFrameLoop(draw, clock = browserClock, interval = 1000 / 30) {
  let frame = null;
  let last = null;
  let lastDraw = null;
  let active = false;
  const tick = now => {
    frame = null;
    if (!active) return;
    const elapsed = last === null ? interval : now - last;
    if (elapsed + .01 >= interval) {
      last = last === null ? now : last + Math.floor((elapsed + .01) / interval) * interval;
      draw(Math.min(50, lastDraw === null ? interval : now - lastDraw));
      lastDraw = now;
    }
    if (active) frame = clock.request(tick);
  };
  return {
    start() { if (active) return; active = true; last = null; frame = clock.request(tick); },
    stop() { active = false; if (frame !== null) clock.cancel(frame); frame = null; last = null; lastDraw = null; },
  };
}
