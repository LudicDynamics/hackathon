// Call-ownership singleton assertions (docs/live-voice/11 §11, contract 10 §9).
// The store has no React and no DOM, so jiti imports the TS source directly —
// same bootstrap as agent-activity.test.mjs. `live-call.ts` (the React binding)
// is imported for A21–A23, where `renderToStaticMarkup` is the only renderer
// this repo has. NO case is allowed to `skip`: a bootstrap failure is a failure
// (contract 10 §9.2 F3 — a skipped render assertion is no assertion at all).
// Run: node --test apps/web/test/live-call-store.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let store = null;
let binding = null;
let React = null;
let renderToStaticMarkup = null;

try {
  const { createJiti } = await import('../../../vendor/pi-rp/node_modules/jiti/lib/jiti.mjs');
  // A shared module cache: `live-call.ts` imports `live-call-store.ts`, and the
  // binding must close over the SAME singleton this test drives.
  const jiti = createJiti(import.meta.url, { moduleCache: true, tryNative: true });
  store = await jiti.import('../src/lib/live-call-store.ts');
  binding = await jiti.import('../src/lib/live-call.ts');
  React = await import('react');
  ({ renderToStaticMarkup } = await import('react-dom/server'));
} catch (err) {
  console.error('jiti/bootstrap unavailable:', err?.message ?? err);
}

test('bootstrap: store, binding and the server renderer all loaded', () => {
  assert.ok(store, 'live-call-store.ts failed to import');
  assert.ok(binding, 'live-call.ts failed to import');
  assert.ok(React && renderToStaticMarkup, 'react / react-dom/server unavailable');
});

// ── fakes ────────────────────────────────────────────────────────────────────

/** An in-memory event bus with the two methods the store uses. */
function makeEvents() {
  const handlers = new Map();
  return {
    addEventListener(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      handlers.get(type)?.delete(fn);
    },
    dispatch(type, detail) {
      for (const fn of handlers.get(type) ?? []) fn({ type, detail });
    },
  };
}

/** A peer connection that is "gathered" at once and never fails on its own. */
function makePeer(state) {
  const listeners = new Map();
  const peer = {
    iceGatheringState: 'complete',
    connectionState: 'new',
    localDescription: null,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    async createOffer() {
      return { type: 'offer', sdp: 'local-offer-sdp' };
    },
    async setLocalDescription(offer) {
      peer.localDescription = { type: 'offer', sdp: offer.sdp };
    },
    async setRemoteDescription(desc) {
      state.remoteSdp = desc.sdp;
    },
    createDataChannel() {
      const dc = makeDataChannel(state);
      state.latestChannel = dc;
      return dc;
    },
    addTrack(track) {
      state.addedTracks.push(track);
    },
    close() {
      state.closedPeers += 1;
    },
  };
  return peer;
}

/** The one channel each fake peer hands out; the test drives it by hand.
 * `readyState` stays `connecting` by default so `stop()` does not sit out its
 * frozen 15s `session.closed` wait; the open-channel case arms it explicitly. */
function makeDataChannel(state) {
  const listeners = new Map();
  return {
    readyState: state.channelOpen ? 'open' : 'connecting',
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    send(payload) {
      state.sent.push(JSON.parse(payload));
    },
    emit(message) {
      for (const fn of listeners.get('message') ?? []) fn({ data: JSON.stringify(message) });
    },
    close() {},
  };
}

/** A fetch double: routes are pinned, and `/api/live/session` can be held open
 * so the world-vanished race (A11) can be driven deterministically. */
function makeFetch(state) {
  const respond = (body, status = 200) => ({
    ok: status < 400,
    status,
    async text() {
      return body === null ? '' : JSON.stringify(body);
    },
  });
  return async (url) => {
    const route = String(url);
    state.calls.push(route);
    if (route === '/api/live/config') {
      return respond({ ok: true, available: state.available, model: 'm', voices: [] });
    }
    if (route === '/api/live/session') {
      state.sessionPosts += 1;
      if (state.holdSession) {
        return new Promise((resolve, reject) => {
          state.releaseSession = () =>
            state.holdSession === 'reject'
              ? reject(new Error('network down'))
              : resolve(
                respond({ ok: true, sessionId: 's1', sdp: 'remote-answer-sdp', character: 'x', voice: 'v' }),
              );
        });
      }
      return respond({ ok: true, sessionId: 's1', sdp: 'remote-answer-sdp', character: 'x', voice: 'v' });
    }
    if (route === '/api/live/close') {
      state.closePosts += 1;
      return respond({ ok: true });
    }
    throw new Error(`unexpected route ${route}`);
  };
}

function makeMedia(state) {
  const track = { stop: () => { state.tracksStopped += 1; } };
  return { getTracks: () => [track] };
}

/** Flush microtasks so a suspended `start()` reaches its next await. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

/** A fresh isolated store plus the ledger its fakes write to. The readiness
 * probe is a real `fetch`, so the helper waits for its answer: a call can only
 * start on a configured server (§3.2-2). */
async function harness(over = {}) {
  const state = {
    available: true,
    channelOpen: false,
    calls: [],
    sessionPosts: 0,
    closePosts: 0,
    closedPeers: 0,
    tracksStopped: 0,
    addedTracks: [],
    sent: [],
    remoteSdp: null,
    latestChannel: null,
    holdSession: false,
    releaseSession: null,
    micError: null,
    ...over,
  };
  const events = makeEvents();
  const created = store.createLiveCallStore({
    events,
    fetch: makeFetch(state),
    createPeerConnection: () => makePeer(state),
    getUserMedia: async () => {
      if (state.micError) throw state.micError;
      return makeMedia(state);
    },
    createAudio: () => ({ autoplay: false, srcObject: null, play: async () => {} }),
  });
  created.ensureConfig();
  await settle();
  return { store: created, state, events };
}

/** Drive a call up to `live`: start, then answer `session.started`. */
async function liveCall(h, opts = { characterId: 'nanami', owner: 'nook:nanami' }) {
  const started = h.store.start({ locale: 'en', ...opts });
  await settle();
  h.state.latestChannel.emit({ type: 'session.started' });
  await started;
}

const frame = (type, over = {}) => ({ type, characterId: 'nanami', ...over });

// ── A1: singleton and reference stability ────────────────────────────────────

test('A1 the singleton is one instance and its snapshot reference is stable', () => {
  assert.equal(store.liveCallStore, store.liveCallStore);
  const snap = store.liveCallStore.getSnapshot();
  assert.equal(store.liveCallStore.getSnapshot(), snap, 'getSnapshot must not allocate');
  assert.equal(store.liveCallStore.getLines(), store.liveCallStore.getLines());

  // Two factories hold independent state; while nothing is up they share the
  // one `IDLE` constant, which is exactly the point (no per-read allocation).
  const a = store.createLiveCallStore();
  const b = store.createLiveCallStore();
  assert.notEqual(a, b);
  assert.equal(a.getSnapshot(), b.getSnapshot());
  assert.equal(a.getSnapshot(), store.liveCallStore.getSnapshot());
});

// ── A2 / A3: one call, shared by both entries ────────────────────────────────

test('A2 a second character closes the first: one call, never two', async () => {
  const h = await harness();
  await liveCall(h, { characterId: 'nanami', owner: 'nook:nanami' });
  await liveCall(h, { characterId: 'watson', owner: 'dialogue:watson' });

  assert.equal(h.state.sessionPosts, 2);
  assert.equal(h.state.closePosts, 1, 'the first call MUST be closed, not stacked');
  assert.equal(h.store.getSnapshot().characterId, 'watson');
  assert.equal(h.store.getSnapshot().phase, 'live');
});

test('A3 two entries share one call: adopt, do not renegotiate', async () => {
  const h = await harness();
  await liveCall(h, { characterId: 'nanami', owner: 'nook:nanami' });
  const before = h.store.getSnapshot();

  await h.store.start({ characterId: 'nanami', locale: 'en', owner: 'dialogue:nanami' });

  assert.equal(h.state.sessionPosts, 1, 'no second /api/live/session POST');
  assert.equal(h.state.closedPeers, 0, 'no peer was rebuilt');
  const after = h.store.getSnapshot();
  assert.equal(after.owner, 'dialogue:nanami', 'the owner moves to the new entry');
  assert.equal(after.characterId, before.characterId);
  assert.equal(after.phase, before.phase);
  assert.notEqual(after, before, 'the changed owner must be a new reference');
});

// ── A4 / A5 / A6 / A17: the owner guard ──────────────────────────────────────

test('A4 a non-matching owner hangs up nothing', async () => {
  const h = await harness();
  await liveCall(h, { characterId: 'nanami', owner: 'nook:nanami' });

  await h.store.stop('dialogue:nanami');

  assert.equal(h.store.getSnapshot().phase, 'live');
  assert.equal(h.state.closePosts, 0, 'no close request for a foreign owner');
});

test('A5 a matching owner hangs up and releases every local resource', async () => {
  const h = await harness();
  await liveCall(h, { characterId: 'nanami', owner: 'nook:nanami' });

  await h.store.stop('nook:nanami');

  const snap = h.store.getSnapshot();
  assert.equal(snap.phase, 'idle');
  assert.equal(snap.characterId, null);
  assert.equal(snap.owner, null);
  assert.equal(h.state.closePosts, 1);
  assert.equal(h.state.tracksStopped, 1, 'the microphone track MUST be stopped');
  assert.equal(h.state.closedPeers, 1);
});

test('A6 stop() with no owner hangs up whoever opened the call', async () => {
  const h = await harness();
  await liveCall(h, { characterId: 'nanami', owner: 'dialogue:nanami' });

  await h.store.stop();

  assert.equal(h.store.getSnapshot().phase, 'idle');
  assert.equal(h.state.closePosts, 1);
});

test('A17 stop() is idempotent while idle', async () => {
  const h = await harness();
  await h.store.stop('nook:nanami');
  await h.store.stop();
  assert.equal(h.state.closePosts, 0);
  assert.equal(h.store.getSnapshot().phase, 'idle');
});

// ── A7 / A8 / A9: throttled subtitles ────────────────────────────────────────

test('A7 deltas do not move the line snapshot until a tick', async () => {
  const h = await harness();
  await liveCall(h);
  const before = h.store.getLines();

  for (const delta of ['a', 'b', 'c']) {
    h.events.dispatch('airp:character-frame', frame('character_delta', { delta }));
  }

  assert.equal(h.store.getLines(), before, 'three frames MUST NOT swap the reference');
  h.store.tick(1000);
  assert.notEqual(h.store.getLines(), before);
  assert.equal(h.store.getLines().streaming, 'abc', 'the deltas concatenate exactly');
});

test('A8 a tick with nothing to commit neither notifies nor reallocates', async () => {
  const h = await harness();
  let notified = 0;
  h.store.subscribe(() => { notified += 1; });
  const lines = h.store.getLines();
  const snap = h.store.getSnapshot();

  h.store.tick(1000);
  const afterFirst = notified;
  h.store.tick(1250);

  assert.equal(afterFirst, 0, 'nothing was pending, so the first tick is silent too');
  assert.equal(notified, 0, 'the second tick MUST NOT notify');
  assert.equal(h.store.getLines(), lines);
  assert.equal(h.store.getSnapshot(), snap);
});

test('A9 a committed message survives a second tick on the same reference', async () => {
  const h = await harness();
  await liveCall(h);

  h.events.dispatch('airp:character-frame', frame('character_message', { text: 'hello' }));
  h.store.tick(1000);
  const lines = h.store.getLines();
  assert.equal(lines.lines.length, 1);
  assert.equal(lines.streaming, '');

  h.store.tick(2000);
  assert.equal(h.store.getLines(), lines, 'no change, no new array');
});

// ── A10 / A11: the world vanishing ───────────────────────────────────────────

test('A10 world-unavailable clears locally and sends nothing', async () => {
  const h = await harness();
  await liveCall(h);

  h.events.dispatch('airp:world-unavailable');

  const snap = h.store.getSnapshot();
  assert.equal(snap.phase, 'idle');
  assert.equal(snap.characterId, null);
  assert.equal(h.state.closePosts, 0, 'the backend already closed; a POST would 409');
  assert.equal(h.state.tracksStopped, 1);
});

test('A11 a failure that lands after the world vanished is swallowed', async () => {
  const h = await harness({ holdSession: 'reject' });
  const started = h.store.start({ characterId: 'nanami', locale: 'en', owner: 'nook:nanami' });
  await settle();
  assert.equal(typeof h.state.releaseSession, 'function', 'the session POST is still in flight');

  h.events.dispatch('airp:world-unavailable');
  h.state.releaseSession();
  await started;

  const snap = h.store.getSnapshot();
  assert.equal(snap.phase, 'idle', 'a stale failure MUST NOT repaint the cleared snapshot');
  assert.equal(snap.error, undefined);
});

// ── A12 / A13: the readiness and microphone gates ────────────────────────────

test('A12 an unconfigured server never opens the microphone', async () => {
  let micCalls = 0;
  const h = await harness({ available: false });
  const gated = store.createLiveCallStore({
    events: h.events,
    fetch: makeFetch(h.state),
    createPeerConnection: () => makePeer(h.state),
    getUserMedia: async () => { micCalls += 1; return makeMedia(h.state); },
    createAudio: () => ({ autoplay: false, srcObject: null, play: async () => {} }),
  });
  gated.ensureConfig();
  await settle();

  await gated.start({ characterId: 'nanami', locale: 'en', owner: 'nook:nanami' });

  assert.equal(micCalls, 0, 'no permission prompt on a dead server');
  assert.equal(gated.getSnapshot().phase, 'error');
  assert.ok(gated.getSnapshot().error, 'the failure must be visible');
});

test('A13 a refused microphone is told apart from an unsupported one', async () => {
  const denied = await harness({ micError: new DOMException('no', 'NotAllowedError') });
  await denied.store.start({ characterId: 'nanami', locale: 'en', owner: 'nook:nanami' });
  assert.equal(denied.store.getSnapshot().phase, 'error');
  assert.match(denied.store.getSnapshot().error, /refused/i);

  const unsupported = await harness({ micError: new Error('nope') });
  await unsupported.store.start({ characterId: 'nanami', locale: 'en', owner: 'nook:nanami' });
  assert.match(unsupported.store.getSnapshot().error, /cannot capture/i);
});

// ── A14 / A20: only `session.started` goes live, and it does so synchronously ─

test('A14 the HTTP 200 alone does not promote the call to live', async () => {
  const h = await harness();
  const started = h.store.start({ characterId: 'nanami', locale: 'en', owner: 'nook:nanami' });
  await settle();
  // The channel answers with something that is not `session.started`.
  h.state.latestChannel.emit({ type: 'session.closed' });
  await settle();
  assert.equal(h.store.getSnapshot().phase, 'connecting');
  h.state.latestChannel.emit({ type: 'session.started' });
  await started;
  assert.equal(h.store.getSnapshot().phase, 'live');
});

test('A20 a successful start is visible without any tick', async () => {
  const h = await harness();
  const started = h.store.start({ characterId: 'nanami', locale: 'en', owner: 'nook:nanami' });
  await settle();
  // The phase MUST already read `connecting` — the dialogue's TTS gate reads the
  // snapshot in the same event loop (contract 10 §9 补充冻结).
  assert.equal(h.store.getSnapshot().phase, 'connecting');
  h.state.latestChannel.emit({ type: 'session.started' });
  await started;

  // And `live` lands synchronously too: no `tick()` was called anywhere above.
  assert.equal(h.store.getSnapshot().phase, 'live');
});

// ── A19: the `error` frame reaches the snapshot (non-emptiness) ──────────────

test('A19 a character error frame lands synchronously, without a tick', async () => {
  const h = await harness();
  await liveCall(h);

  h.events.dispatch('airp:character-frame', {
    type: 'error', source: 'character', characterId: 'nanami', message: 'sideband lost',
  });

  const snap = h.store.getSnapshot();
  assert.equal(snap.phase, 'error');
  assert.equal(snap.error, 'sideband lost', 'the server sentence is shown verbatim');
  assert.equal(snap.characterId, 'nanami', 'the call is still attributable to its character');
  // Still hangup-able: `stop()` only short-circuits on idle.
  await h.store.stop();
  assert.equal(h.store.getSnapshot().phase, 'idle');
});

test('a frame for another character never leaks into the call', async () => {
  const h = await harness();
  await liveCall(h);
  h.events.dispatch('airp:character-frame', frame('character_delta', { characterId: 'watson', delta: 'x' }));
  h.store.tick(1000);
  assert.equal(h.store.getLines().streaming, '');
});

// ── A15 / A16: the two files' shapes ─────────────────────────────────────────

test('A15 the store has no React dependency', () => {
  const source = readFileSync(fileURLToPath(new URL('../src/lib/live-call-store.ts', import.meta.url)), 'utf-8');
  assert.doesNotMatch(source, /from\s+['"]react['"]/);
  assert.doesNotMatch(source, /require\(\s*['"]react['"]\s*\)/);
});

test('A16 the binding is side-effect free', () => {
  const source = readFileSync(fileURLToPath(new URL('../src/lib/live-call.ts', import.meta.url)), 'utf-8');
  assert.doesNotMatch(source, /fetch\(/);
  assert.doesNotMatch(source, /addEventListener/);
  assert.doesNotMatch(source, /setInterval/);
});

// ── A21 / A22 / A23: the React binding ───────────────────────────────────────

test('A21 the three-argument binding renders under renderToStaticMarkup', () => {
  const Probe = () => {
    const state = binding.useLiveCallState();
    const available = binding.useLiveCallAvailable();
    const lines = binding.useLiveCallLines();
    return React.createElement('i', null, `${state.phase}|${lines.lines.length}|${available}`);
  };
  const html = renderToStaticMarkup(React.createElement(Probe));
  assert.match(html, /idle\|0\|/, 'the server sees an idle call, not a thrown error');
});

test('A22 every hook passes a `getServerSnapshot` (non-emptiness of A21)', () => {
  const source = readFileSync(fileURLToPath(new URL('../src/lib/live-call.ts', import.meta.url)), 'utf-8');
  const calls = [...source.matchAll(/useSyncExternalStore\(([\s\S]*?)\)/g)];
  assert.equal(calls.length, 3, 'three subscriptions, one per snapshot');
  for (const [, args] of calls) {
    const topLevel = args.split(/,(?![^()]*\))/).map((part) => part.trim()).filter(Boolean);
    assert.equal(
      topLevel.length,
      3,
      `a two-argument subscription throws Missing getServerSnapshot under renderToStaticMarkup: ${args.trim()}`,
    );
  }
});

test('A23 the actions object keeps one identity across renders', () => {
  const first = binding.useLiveCallActions();
  const second = binding.useLiveCallActions();
  assert.equal(first, second);
  assert.equal(first.start, store.liveCallStore.start);
  assert.equal(first.stop, store.liveCallStore.stop);
});

// ── NookView: the guard is wired AND narrowed (contract 10 §4.3) ─────────────

test('the nook guard is wired to the canvas and narrowed per character', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../src/components/nook/NookView.tsx', import.meta.url)),
    'utf-8',
  );
  // (1) Wiring: the canvas gets the WRAPPED handler, not the raw prop. The raw
  // identifier then survives only where the prop is declared, destructured, and
  // read by the wrapper.
  assert.match(source, /onOpenCharacterModal=\{handleOpenCharacterModal\}/);
  assert.doesNotMatch(source, /onOpenCharacterModal=\{onOpenCharacterModal\}/);
  // Every JSX attribute that mentions the raw prop must be a presence check or
  // the wrapped handler — never a bare pass-through. Expressed structurally: a
  // magic mention-count would break on the next legitimate read (e.g. gating a
  // new entry point on the prop's existence) without catching any regression.
  for (const [, value] of source.matchAll(/\bonOpenCharacterModal=\{([^}]*)\}/g)) {
    assert.doesNotMatch(value, /^\s*onOpenCharacterModal\s*$/, 'the raw prop never reaches a component prop');
  }
  // (2) Narrowing: the guard is per character, not global.
  assert.match(source, /const sameCharacterOnCall = callInProgress && call\.characterId === id;/);
  assert.equal(
    [...source.matchAll(/\bhandleOpenCharacterModal\b/g)].length >= 2,
    true,
    'the handler is defined and handed to the canvas',
  );
});

test('leaving the nook hangs up the call this entry opened (contract 10 §2.2-5)', () => {
  // Closing the nook unmounts NookView, and App.tsx renders the canvas only in
  // the `!nookChar` branch — so after exit there is NO visible call UI or hang-up
  // control anywhere. A surviving call is silent GPT-Live billing (`00` §2.9).
  //
  // This guard exists because the cleanup was once deleted by an unrelated edit
  // and the suite stayed green: the sibling wiring test counted raw-prop
  // mentions, so its failure pointed at that count instead of the lost cleanup.
  // Assert the BEHAVIOUR (a cleanup effect that stops precisely this entry's
  // call), not the presence of a line.
  const source = readFileSync(
    fileURLToPath(new URL('../src/components/nook/NookView.tsx', import.meta.url)),
    'utf-8',
  );
  const cleanups = [...source.matchAll(/useEffect\(\s*\(\)\s*=>\s*\(\)\s*=>\s*([^;]*stopCall[^;]*);/g)];
  assert.equal(cleanups.length, 1, 'exactly one unmount cleanup hangs up the call');
  // Owner-scoped: only the call this entry opened may be stopped (10 §5.1).
  assert.match(cleanups[0][1], /stopCall\(`nook:\$\{characterId\}`\)/, 'the cleanup is owner-scoped to this nook entry');
  // The effect must depend on the owner and the stopper, or a character switch
  // would leave the previous entry's call running.
  assert.match(source, /\[characterId, stopCall\]\);/);
});
