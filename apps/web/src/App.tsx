import { useLocale } from './lib/i18n.js';
import { AgentSettings } from './components/AgentSettings.js';
import { TtsSettings } from './components/TtsSettings.js';
import { WriterBar } from './components/chrome/WriterBar.js';
import { WriterResult } from './components/WriterResult.js';
import { ActivityRail } from './components/chrome/ActivityRail.js';
import { AgentActivityLog } from './components/chrome/AgentActivityLog.js';
import { ConnectedWorldToastRegion } from './components/chrome/WorldToast.js';
import { ItemArtwork } from './components/ItemArtwork.js';
import { NookView } from './components/nook/NookView.js';
import { ghostItemFor } from './lib/init-ghost.js';
import { useViewpointReport } from './hooks/useViewpointReport.js';
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Canvas } from './components/canvas/Canvas.js';
import { CharacterModal } from './components/overlay/CharacterModal.js';
import { DiceCeremony } from './components/performance/DiceCeremony.js';
import { PerformanceLayer } from './components/performance/PerformanceLayer.js';
import {
  parseDiceFrame,
  parseDiceFrameResult,
  shouldPlayFrame,
  markPlayed,
  playCeremony,
  clearCeremony,
  subscribeCeremony,
  getCeremonySnapshot,
} from './lib/dice-ceremony.js';
import { getCharacterFrameQueue, isCharacterFrame } from './lib/character-frame-queue.js';
import {
  createCameraMemoryStack,
  projectionTarget,
  type CameraMemoryStack,
  type ProjectionTarget,
} from './lib/camera.js';
import { useWriterState, requestWriterStop, resetForReconnect, retryWriterPrompt } from './lib/writer-state.js';
import { buildItemActionPrompt, appendItemAction } from './lib/item-action-draft.js';
import { PLAY_HINT_REQUEST } from './lib/play-hints.js';
import { agentActivityStore } from './lib/agent-activity-store.js';
import { agentCursorStore } from './lib/agent-cursor.js';
import { worldEventToastStore } from './lib/world-event-toast.js';
import { GodModeToolbar } from './components/god/GodModeToolbar.js';
import { RadialMenu, type RadialItemType } from './components/god/RadialMenu.js';
import { MuteButton } from './components/chrome/MuteButton.js';
import { useAudio } from './state/useAudio.js';
import { useCamera } from './state/useCamera.js';
import { useWorld } from './state/useWorld.js';
import type { EnterLayerResult } from './state/useWorld.js';
import { CharacterRail } from './components/sidebar/CharacterRail.js';
import { usePresence } from './state/usePresence.js';
import { airpGateway, onWorldUnavailable, AirpRequestError, type AssetMediaKind, type WorldShelf } from './lib/airp-gateway.js';
import { WorldShelf as WorldShelfDialog } from './components/WorldShelf.js';
import { WorldLauncher } from './components/WorldLauncher.js';
import { BagItemDialog } from './components/BagItemDialog.js';
import { guardImeKey } from './lib/ime.js';
import { initialShell, transitionShell } from './lib/ui-shell.mjs';
import { MarkdownText } from './lib/md.js';
import { BookOpen, ChevronDown, ChevronUp, Maximize, Minimize, UserRound, Backpack, Sparkles } from 'lucide-react';
import { preloadAudio } from './lib/audio.js';
import { useStill } from './lib/motion.js';
import { createFocusCoordinator, type FocusOwner } from './lib/focus-coordinator.js';
import { createOverlayAdmission } from './lib/overlay-admission.js';

interface WorldManifest {
  id: string;
  locale?: 'en' | 'ja' | 'zh-CN';
  name: string;
  description: string;
  genre: string;
  material: string;
  audio?: { theme: string | null };
  cover?: string;
  player?: { id: string; name: string; avatar?: string };
  layers: Record<string, { name?: string; parent?: string | null; material?: string }>;
  characters: CharacterView[];
}

interface BackpackItem {
  path: string;
  filename: string;
  frontmatter: Record<string, any> | null;
  body: string;
}

interface CharacterView {
  avatarVideo?: string;
  id: string;
  name?: string;
  home?: string;
  role?: string;
  avatar?: string;
  bio?: string;
  description?: string;
  /** README frontmatter `voice` alias, via /api/characters. undefined → server default. */
  voice?: string;
  /**
   * Per-emotion portrait paths (docs/assets/00 §5.2), via /api/characters.
   * Present only when all six exist; undefined → the modal keeps the single
   * MotionPortrait fallback.
   */
  emotions?: Record<string, string>;
  /**
   * Where this character actually IS (docs/presence/00 §3.2) — the ONE
   * cross-layer fact. The key is ALWAYS present; `null` = not in the world.
   * NEVER `home`: that is only the initial layer baked into world.json.
   */
  presence: { layer: string; following: boolean } | null;
}

type Attention = 'ambient' | 'writer' | 'authoring';

function labelOf(value: string): string {
  if (value === 'first-snow-jp') return '初雪ラジオ · 日本語';
  if (value.startsWith('first-snow-jp-')) return `初雪ラジオ · ${value.slice('first-snow-jp-'.length)}`;
  const tail = value.split('/').filter(Boolean).at(-1) || value;
  return tail
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function assetUrl(path?: string, mediaKind: AssetMediaKind = 'image'): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('/api/asset')) {
    const url = new URL(path, window.location.origin);
    const assetPath = url.searchParams.get('path');
    return assetPath ? airpGateway.assetUrl(assetPath, undefined, mediaKind) : undefined;
  }
  if (/^(?:https?:|data:|blob:)/.test(path)) return path;
  return airpGateway.assetUrl(path.replace(/^\/+/, ''), undefined, mediaKind);
}

function sceneName(manifest: WorldManifest | null, layer: string): string {
  return manifest?.layers?.[layer]?.name || labelOf(layer === 'map' ? manifest?.name || 'World Map' : layer);
}

export function App() {
  const { locale, setLocale, t } = useLocale();
  const [manifest, setManifest] = useState<WorldManifest | null>(null);
  useEffect(() => {
    if (manifest?.locale === 'ja') setLocale('ja');
  }, [manifest?.id, manifest?.locale, setLocale]);
  const [backpack, setBackpack] = useState<BackpackItem[]>([]);
  const [characters, setCharacters] = useState<CharacterView[]>([]);
  const [shelf, setShelf] = useState<WorldShelf>({ templates: [], worlds: [] });
  const [attention, setAttention] = useState<Attention>('ambient');
  const [isGodHandOpen, setIsGodHandOpen] = useState(false);
  const allowChalkDrag = isGodHandOpen;
  const [shell, setShell] = useState(initialShell);
  const [bagOpen, setBagOpen] = useState(false);
  const [selectedBagPath, setSelectedBagPath] = useState<string | null>(null);
  const selectedBagItem = backpack.find(item => item.path === selectedBagPath);
  const [effectsEnabled, setEffectsEnabled] = useState(() => {
    try { return localStorage.getItem('airp:effects') === 'on'; } catch { return false; }
  });
  const reducedMotion = useStill();
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  useEffect(() => {
    const onVisibilityChange = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);
  const focusCoordinator = useMemo(() => createFocusCoordinator(), []);
  const overlayAdmission = useMemo(() => createOverlayAdmission(focusCoordinator), [focusCoordinator]);
  const [, setFocusRevision] = useState(0);
  useEffect(() => focusCoordinator.subscribe(() => setFocusRevision(value => value + 1)), [focusCoordinator]);
  const focusTokensRef = useRef(new Map<FocusOwner, string>());
  const syncFocus = useCallback((owner: FocusOwner, active: boolean) => {
    const token = focusTokensRef.current.get(owner);
    if (active && !token) {
      focusTokensRef.current.set(owner, focusCoordinator.acquire(owner));
    } else if (!active && token) {
      focusCoordinator.release(token);
      focusTokensRef.current.delete(owner);
    }
  }, [focusCoordinator]);
  const characterAdmissionRef = useRef<string | null>(null);
  const radialAdmissionRef = useRef<string | null>(null);
  const diceAdmissionRef = useRef<string | null>(null);
  const closeCharacterRef = useRef<() => void>(() => {});
  useEffect(() => {
    try { localStorage.setItem('airp:effects', effectsEnabled ? 'on' : 'off'); } catch { /* Storage is optional. */ }
  }, [effectsEnabled]);
  const [radialState, setRadialState] = useState<{ x: number; y: number; worldX: number; worldY: number } | null>(null);
  const toggleShell = (action: 'header' | 'journal' | 'immersion') => setShell(current => transitionShell(current, action));
  const [worldPickerOpen, setWorldPickerOpen] = useState(false);
  // Every session opens on the launcher, and every world returns to it.
  const [launcherOpen, setLauncherOpen] = useState(true);
  useEffect(() => {
    if (launcherOpen) void airpGateway.worlds().then(setShelf).catch(() => {});
  }, [launcherOpen]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeCharacter, setActiveCharacter] = useState<CharacterView | null>(null);
  const [nookChar, setNookChar] = useState<string | null>(null);
  const [preparedAction, setPreparedAction] = useState('');
  const preparedSource = useRef<string | null>(null);
  const worldLoadGeneration = useRef(0);
  const [toast, setToast] = useState<string | null>(null);
  const [loadingWorld, setLoadingWorld] = useState<string | null>(null);
  const [backdropReady, setBackdropReady] = useState(false);
  const writerState = useWriterState();
  const writerWorking = writerState.phase === 'writing';
  const [writerSubmitPending, setWriterSubmitPending] = useState(false);
  const writerRef = useRef<HTMLInputElement>(null);
  const activeSavePath = shelf.groups?.flatMap(group => group.saves).find(save => save.active)?.path;
  useEffect(() => {
    if (writerRef.current) writerRef.current.value = '';
    preparedSource.current = null;
    setPreparedAction('');
    setSelectedBagPath(null);
  }, [manifest?.id, activeSavePath]);
  const writerHistory = useRef<string[]>([]);
  const writerHistoryCursor = useRef(0);
  const [writerDraft, setWriterDraft] = useState('');
  const historyDraft = useRef('');
  const toastTimer = useRef<number | null>(null);
  const clearAdmittedCeremony = useCallback(() => {
    clearCeremony();
    const token = diceAdmissionRef.current;
    if (token) {
      overlayAdmission.release(token);
      diceAdmissionRef.current = null;
    }
  }, [overlayAdmission]);
  const writerPendingRef = useRef(false);

  // Character frames cross the one App-owned identity router into the queue.
  const frameQueue = useMemo(() => getCharacterFrameQueue(), []);

  // Dice ceremony (presentation channel, docs/perform/02): the fullscreen roll
  // driven by the `dice_result` frame. Module store (lib/dice-ceremony.ts) so
  // the WS listener need not thread the verdict through React state; App is
  // only the mount point.
  const ceremony = useSyncExternalStore(subscribeCeremony, getCeremonySnapshot);

  const camera = useCamera();
  const { setAmbient, setBGM, setTheme } = useAudio();

  // Canvas world state (layer payload, WS events, card persistence).
  const world = useWorld();
  const { state, layer, enterLayer, refresh, moveCard, sendToWriter, sendMessage } = world;
  useEffect(() => {
    worldEventToastStore.setProjectId(manifest?.id ?? null);
  }, [manifest?.id]);
  const cameraStackRef = useRef<CameraMemoryStack | null>(null);
  if (cameraStackRef.current === null) {
    cameraStackRef.current = createCameraMemoryStack(camera, projectionTarget('layer', layer));
  }
  const cameraStack = cameraStackRef.current!;
  useEffect(() => {
    if (nookChar === null && !activeCharacter) {
      cameraStack.setCurrent(projectionTarget('layer', layer));
    }
  }, [activeCharacter, cameraStack, layer, nookChar]);
  const callerProjectionRef = useRef<ProjectionTarget | null>(null);
  const chromeVisible = !shell.immersive;
  const isDusk = backdropReady;

  // The canonical writer-state projection owns busy phase; App only derives
  // the input lock and never mirrors progress frames into local state.
  const writerLocked = writerWorking || writerSubmitPending || state?.worldFrozen === true;
  useEffect(() => {
    if (writerWorking && writerPendingRef.current) {
      writerPendingRef.current = false;
      setWriterSubmitPending(false);
    }
  }, [writerWorking]);
  const openNook = useCallback((characterId: string) => {
    const caller: ProjectionTarget = nookChar
      ? projectionTarget('nook', nookChar)
      : projectionTarget('layer', layer);
    const target = projectionTarget('nook', characterId);
    cameraStack.pushTransition(target);
    cameraStack.restoreTarget(target);
    callerProjectionRef.current = caller;
    frameQueue.clear('switch');
    setNookChar(characterId);
  }, [cameraStack, callerProjectionRef, frameQueue, layer, nookChar]);

  const closeNook = useCallback(() => {
    const caller = callerProjectionRef.current;
    if (caller) {
      const frame = cameraStack.popTransition(caller);
      if (frame) cameraStack.restoreProjection(frame);
    }
    callerProjectionRef.current = null;
    frameQueue.clear('close');
    setNookChar(null);
    void refresh();
  }, [cameraStack, callerProjectionRef, frameQueue, refresh]);
  const notify = useCallback((message: string) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => {
      toastTimer.current = null;
      setToast(null);
    }, 3000);
  }, []);
  useEffect(() => { syncFocus('world-shelf', worldPickerOpen); }, [syncFocus, worldPickerOpen]);
  useEffect(() => { syncFocus('nook', nookChar !== null); }, [nookChar, syncFocus]);
  useEffect(() => { syncFocus('character-dialogue', activeCharacter !== null); }, [activeCharacter, syncFocus]);
  // The dialogue dims the canvas: the character's pointer records, then replays on close.
  useEffect(() => { agentCursorStore.setDialogue(activeCharacter?.id ?? null); }, [activeCharacter?.id]);
  useEffect(() => { syncFocus('belongings', bagOpen || selectedBagItem !== undefined); }, [bagOpen, selectedBagItem, syncFocus]);
  useEffect(() => { syncFocus('profile', profileOpen); }, [profileOpen, syncFocus]);
  useEffect(() => { syncFocus('writer', attention === 'authoring' && !shell.immersive); }, [attention, shell.immersive, syncFocus]);
  useEffect(() => { syncFocus('journal', shell.journal); }, [shell.journal, syncFocus]);

  // The single presence projection (§4.1): both the canvas avatars and the
  // character rail consume THESE views, never a re-derivation of their own.
  const { views: presenceViews, navigateTo: navigateToCharacter } = usePresence({
    characters,
    layer,
    presence: state?.presence ?? [],
    readLayerState: world.readLayerState,
    enterLayer: world.enterLayer,
    camera,
    // `lib/presence.ts` stays pure and emits English KEY strings for its
    // notices (docs/presence/04 §7); translate them at the boundary, like the
    // rail does. Passing `notify` straight through leaked English into a
    // Japanese session.
    notify: (key: string) => notify(t(key)),
  });
  // Ids whose follow request is in flight. UI only — NOT the follow truth:
  // nothing reads it as `following` (docs/presence/00 §2.4).
  const [pendingFollowing, setPendingFollowing] = useState<ReadonlySet<string>>(new Set());

  const toggleFollowing = useCallback(async (id: string, next: boolean) => {
    setPendingFollowing(current => new Set(current).add(id));
    try {
      await airpGateway.setFollowing(id, next);
      // No optimistic write: `presence.following` is the only truth (§2.4), and
      // the writer may have flipped it in the meantime. The world event brings
      // the new projection.
    } catch {
      notify(t('Could not change whether {name} follows you.', { name: labelOf(id) }));
    } finally {
      setPendingFollowing(current => {
        const nextPending = new Set(current);
        nextPending.delete(id);
        return nextPending;
      });
    }
  }, [notify, t]);

  /**
   * Surface the characters that could NOT follow into the new layer
   * (docs/presence/00 §2.3 / P-9). The server reports them in the
   * `enter-layer` reply; a left-behind character must never be silent.
   * A `null` result means "same layer or the request failed" — that path is
   * already surfaced by `airp:gate-feedback` / `airp:notice` in `useWorld`.
   */
  const applyFollowFailures = useCallback(
    (result: EnterLayerResult | null) => {
      if (!result?.followers?.failures?.length) return;
      notify(t('Some of the party could not follow you.'));
    },
    [notify, t]
  );

  const loadChromeData = async () => {
    const generation = worldLoadGeneration.current;
    try {
      const [nextManifest, nextBackpack, nextCharacters, nextShelf] = await Promise.all([
        airpGateway.manifest<WorldManifest>(),
        airpGateway.backpack<BackpackItem[]>(),
        airpGateway.characters<CharacterView[]>(),
        airpGateway.worlds(),
      ]);
      if (generation !== worldLoadGeneration.current) return;
      setManifest(nextManifest);
      setBackpack(nextBackpack.items);
      setCharacters(nextCharacters.characters);
      setShelf(nextShelf);
    } catch (error) {
      // `no_active_world` is not a data failure: the world shelf is already
      // opening (see the `onWorldUnavailable` effect) and telling the player to
      // "retry" would be false. Only genuine load errors get the toast.
      const unavailable = error instanceof AirpRequestError && error.payload?.code === 'no_active_world';
      if (!unavailable) {
        // The character rail's ONLY data source: a silent empty rail would read
        // as "nobody is here" (docs/presence/00 §6, global MUST NOT 6).
        notify(t('Could not load the world data. Please retry.'));
        console.warn('Could not load AIRP chrome data:', error);
      }
    }
  };
  useEffect(() => {
    const unavailable = () => {
      writerPendingRef.current = false;
      setWriterSubmitPending(false);
      setManifest(null);
      setBackpack([]);
      setCharacters([]);
      setNookChar(null);
      setActiveCharacter(null);
      callerProjectionRef.current = null;
      cameraStack.clear();
      setWorldPickerOpen(true);
      frameQueue.clear('disconnect');
      void airpGateway.worlds().then(setShelf).catch(() => notify('Could not load the world shelf. Please retry.'));
    };
    // Replayed subscription, not a one-shot `airp:world-unavailable` listener:
    // the first `no_active_world` can land before this effect registers, and a
    // missed signal would leave the player on a blank canvas with no way to pick
    // a world (docs/ux/03 §6).
    return onWorldUnavailable(unavailable);
  }, []);

  useEffect(() => {
    const onNotice = (event: Event) => notify(String((event as CustomEvent).detail));
    window.addEventListener('airp:notice', onNotice);
    return () => window.removeEventListener('airp:notice', onNotice);
  }, []);

  // I1 initialiser outcome (docs/init/03 §3.6): a failed materialisation must be
  // visible — never a silent canvas (contract §8 anti-pattern 8). The success
  // path needs no UI here; the ghost clears and the refetched layer replaces it.
  // The App is the sole identity boundary: only an active, valid character
  // frame reaches the shared FIFO. Missing ids never inherit modal context.
  useEffect(() => {
    const onCharacterFrame = (event: Event) => {
      const msg = (event as CustomEvent).detail as unknown;
      const activeId = activeCharacter?.id;
      if (!activeId) return;
      if (!isCharacterFrame(msg)) {
        const candidate =
          msg && typeof msg === 'object' && 'characterId' in msg ? msg.characterId : undefined;
        if (candidate === undefined) notify('This character reply could not be assigned. Reopen the dialogue.');
        return;
      }
      if (msg.characterId !== activeId) {
        notify(`Character reply for ${msg.characterId} could not be assigned to ${activeId}.`);
        return;
      }
      frameQueue.enqueue(msg, frameQueue.nextDeliverySeq());
    };
    window.addEventListener('airp:character-frame', onCharacterFrame);
    return () => window.removeEventListener('airp:character-frame', onCharacterFrame);
  }, [activeCharacter?.id, frameQueue, notify]);

  // Dice ceremony: forwarded raw frame → boundary guard → layer filter / dedup
  // → ceremony layer. Rebinds on the current layer so the filter reads the live
  // value; the cleanup ends an in-flight ceremony when the player switches
  // layers (docs/perform/02 §7.2).
  useEffect(() => {
    const onDiceFrame = (event: Event) => {
      const raw = (event as CustomEvent).detail as unknown;
      const parsed = parseDiceFrameResult(raw);
      if (!parsed.ok) {
        if (raw && typeof raw === 'object' && (raw as { type?: unknown }).type === 'dice_result') {
          notify('The dice result could not be understood.');
        }
        return;
      }
      const v = parsed.value;
      if (!shouldPlayFrame(v, layer)) return;
      const record = raw && typeof raw === 'object' ? raw : null;
      const rawSource = record && 'source' in record ? record.source : undefined;
      const rawCharacterId = record && 'characterId' in record ? record.characterId : undefined;
      if (rawSource === 'character' || rawCharacterId !== undefined) {
        if (rawSource !== 'character' || !activeCharacter || v.characterId !== activeCharacter.id) return;
      }
      if (diceAdmissionRef.current) clearAdmittedCeremony();
      const caller: FocusOwner = activeCharacter ? 'character-dialogue' : nookChar ? 'nook' : 'workspace';
      const admission = overlayAdmission.request('dice', caller);
      if (!admission.accepted) {
        notify(admission.message);
        return;
      }
      markPlayed(v.path);
      diceAdmissionRef.current = admission.token;
      playCeremony(v);
    };
    window.addEventListener('airp:dice-frame', onDiceFrame);
    return () => {
      window.removeEventListener('airp:dice-frame', onDiceFrame);
      clearAdmittedCeremony();
    };
  }, [activeCharacter?.id, clearAdmittedCeremony, layer, nookChar, notify, overlayAdmission]);

  useEffect(() => {
    void loadChromeData();
    const onWorldEvent = () => void loadChromeData();
    window.addEventListener('airp:world-event', onWorldEvent);
    return () => {
      window.removeEventListener('airp:world-event', onWorldEvent);
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const themeUrl = manifest?.audio?.theme ?? null;
  useEffect(() => {
    if (!state) return;
    setAmbient(state.audio.ambient ?? null);
    setBGM(state.audio.bgm ?? null);
    const urls = [state.audio.ambient, state.audio.bgm, themeUrl].filter(
      (url): url is string => typeof url === 'string' && url.length > 0
    );
    if (urls.length) void preloadAudio(urls);
  }, [state?.audio?.ambient, state?.audio?.bgm, themeUrl, setAmbient, setBGM]);
  useEffect(() => { setTheme(themeUrl); }, [themeUrl, setTheme]);

  useEffect(() => {
    const src = state?.bg?.src;
    if (!src || loadingWorld) return;
    const probe = new Image();
    probe.onload = () => setBackdropReady(true);
    probe.onerror = () => setBackdropReady(false);
    probe.src = airpGateway.assetUrl(src, undefined, 'image');
    return () => {
      probe.onload = null;
      probe.onerror = null;
    };
  }, [state?.bg?.src, manifest?.id, loadingWorld]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest('input, textarea, select, button, a, [role="switch"], [contenteditable="true"]');
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (radialState || radialAdmissionRef.current) {
          setRadialState(null);
          const token = radialAdmissionRef.current;
          if (token) overlayAdmission.release(token);
          radialAdmissionRef.current = null;
          return;
        }
        if (ceremony) {
          clearAdmittedCeremony();
          return;
        }
        const topmost = focusCoordinator.peek();
        if (topmost) {
          focusCoordinator.handleEscape();
          if (topmost === 'character-dialogue') {
            closeCharacterRef.current();
          } else if (topmost === 'nook') {
            closeNook();
          } else if (topmost === 'world-shelf') {
            setWorldPickerOpen(false);
          } else if (topmost === 'belongings') {
            if (selectedBagPath !== null) setSelectedBagPath(null);
            else setBagOpen(false);
          } else if (topmost === 'profile') {
            setProfileOpen(false);
          } else if (topmost === 'writer') {
            writerRef.current?.blur();
            setAttention('ambient');
            setIsGodHandOpen(false);
          } else if (topmost === 'journal') {
            setShell(current => ({ ...current, journal: false }));
          }
          return;
        }
        if (shell.header || shell.journal || shell.immersive) {
          setShell(initialShell);
          return;
        }
        if (layer !== 'map') {
          void enterLayer(manifest?.layers?.[layer]?.parent || 'map').then(applyFollowFailures);
        }
        return;
      }
      if (typing || activeCharacter) return;
      if (event.key === 'Tab') {
        event.preventDefault();
        toggleShell('immersion');
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        setAttention('authoring');
        setShell(current => ({ ...current, immersive: false }));
        window.setTimeout(() => writerRef.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeCharacter, ceremony, clearAdmittedCeremony, closeNook, enterLayer, focusCoordinator, layer, manifest, overlayAdmission, radialState, selectedBagPath, shell]);

  const chalks = useMemo(
    () => (state?.items || []).filter((item) => item.frontmatter?.type === 'chalk'),
    [state?.items],
  );
  const readme = useMemo(() => {
    const expected = layer === 'map' ? 'world/README.md' : `${layer}/README.md`;
    // `/api/layer` returns the layer's own README as `scene`, not among `items`;
    // reading only `items` left every sub-layer "not ready", so the overlay gate
    // refused dialogue and dice there ("The world is unavailable").
    if (state?.scene?.path === expected) return state.scene;
    return state?.items.find((item) => item.path === expected);
  }, [layer, state?.items, state?.scene]);
  const worldReady = Boolean(manifest && state && readme);
  useEffect(() => {
    overlayAdmission.setWorldAvailable(worldReady);
    if (!worldReady) {
      clearAdmittedCeremony();
      const dialogueToken = characterAdmissionRef.current;
      if (dialogueToken) {
        overlayAdmission.release(dialogueToken);
        characterAdmissionRef.current = null;
      }
      const radialToken = radialAdmissionRef.current;
      if (radialToken) {
        overlayAdmission.release(radialToken);
        radialAdmissionRef.current = null;
      }
      setRadialState(null);
    }
  }, [clearAdmittedCeremony, overlayAdmission, worldReady]);
  const handItems = backpack.filter((item) => item.filename.toLowerCase() !== 'readme.md');
  useViewpointReport({ camera, layer, bagCount: handItems.length, enabled: nookChar === null });
  const canvasItems = (state?.items || []).filter((item) => item.path !== readme?.path);
  // The provisional "taking shape" card while this layer's I1 init runs
  // (docs/init/03 §3.5). Client-only; deliberately NOT part of `canvasItems`.
  // Memoised: the seat reads module-level seat state, so recomputing per render
  // would let the card drift between frames.
  const ghostLabel = t('Taking shape…');
  const ghostItem = useMemo(
    () => (world.initializingLayer === layer ? ghostItemFor(layer, ghostLabel) : null),
    [world.initializingLayer, layer, ghostLabel]
  );
  const currentName = readme?.frontmatter?.title || sceneName(manifest, layer);
  const playerRole = manifest?.player?.name || (manifest?.id === 'wuwu' ? 'Harbor Investigator' : 'Traveler');
  const playerAvatar = assetUrl(manifest?.player?.avatar, 'image');
  const sceneStatus = chalks.flatMap(chalk => Object.entries(chalk.frontmatter?.status?.data || {})).slice(0, 3);
  const breadcrumbs: string[] = [];
  let crumb: string | null = layer;
  while (crumb && !breadcrumbs.includes(crumb)) {
    breadcrumbs.unshift(crumb);
    crumb = manifest?.layers?.[crumb]?.parent || (crumb === 'map' ? null : 'map');
  }

  useEffect(() => {
    const onBack = (event: KeyboardEvent) => {
      if (event.altKey && event.key === 'ArrowLeft' && !activeCharacter) {
        event.preventDefault();
        void enterLayer(manifest?.layers?.[layer]?.parent || 'map').then(applyFollowFailures);
      }
    };
    window.addEventListener('keydown', onBack);
    return () => window.removeEventListener('keydown', onBack);
  }, [layer, manifest, activeCharacter, enterLayer]);

  const loadWorld = async (worldPath: string) => {
    preparedSource.current = null;
    if (writerRef.current) writerRef.current.value = '';
    worldLoadGeneration.current++;
    setCharacters([]); setBackpack([]); setPreparedAction('');
    setLoadingWorld(worldPath);
    setWorldPickerOpen(false);
    setSelectedBagPath(null);
    setWriterDraft('');
    resetForReconnect('world_change');
    writerPendingRef.current = false;
    setWriterSubmitPending(false);
    frameQueue.clear('world-change');
    cameraStack.clear();
    callerProjectionRef.current = null;
    try {
      const result = await airpGateway.loadWorld<WorldManifest>(worldPath);
      setManifest(result.manifest);
      // Settings are per-world and live under the (now-active) save's
      // `.airpworld/`, so re-read them before entering the world's first layer
      // — `enterLayer` gates the I1 initialiser on `autoWrite`.
      await world.reloadSettings();
      await enterLayer('map').then(applyFollowFailures);
      await loadChromeData();
      setWorldPickerOpen(false);
      setLauncherOpen(false);
      setAttention('ambient');
      setIsGodHandOpen(false);
      setShell(initialShell);
      setProfileOpen(false);
      setBagOpen(false);
      notify(`Entered ${result.manifest.name}`);
    } catch (error) {
      setWorldPickerOpen(true);
      notify(error instanceof Error ? error.message : 'Could not load that world');
    } finally {
      setLoadingWorld(null);
    }
  };
  const submitWriterText = useCallback((rawText: string, layerOverride?: string, prepared = false): boolean => {
    if (writerLocked || writerPendingRef.current) return false;
    const text = rawText.trim();
    if (!text) {
      notify(t('Please enter an action before sending.'));
      return false;
    }
    const prompt = prepared ? text : buildItemActionPrompt(text, backpack);

    writerPendingRef.current = true;
    setWriterSubmitPending(true);
    const result = sendToWriter(prompt, layerOverride);
    if (!result.accepted) {
      writerPendingRef.current = false;
      setWriterSubmitPending(false);
      notify(result.message);
      return false;
    }
    if (writerHistory.current.at(-1) !== text) writerHistory.current.push(text);
    if (writerHistory.current.length > 50) writerHistory.current.shift();
    writerHistoryCursor.current = writerHistory.current.length;
    setWriterDraft('');
    notify(t('The writer is listening…'));
    return true;
  }, [backpack, notify, sendToWriter, t, writerLocked]);

  const prepareWriterHint = useCallback((): boolean => {
    if (writerLocked || !worldReady) {
      notify(!worldReady ? t('Load a world and wait for the scene to appear before asking for a hint.') : t('The writer is already working.'));
      return false;
    }
    setAttention('authoring');
    setWriterDraft(t(PLAY_HINT_REQUEST));
    writerHistoryCursor.current = writerHistory.current.length;
    notify(t('Next-step hint draft ready. Review it, then press Send.'));
    window.requestAnimationFrame(() => writerRef.current?.focus());
    return true;
  }, [notify, t, worldReady, writerLocked]);
  const prepareItemUse = useCallback((itemPath: string): void => {
    if (writerLocked) {
      notify(t('The writer is already working.'));
      return;
    }
    const item = backpack.find((candidate) => candidate.path === itemPath);
    if (!item) {
      notify(t('This item is no longer available. Please refresh.'));
      return;
    }
    setWriterDraft((current) => appendItemAction(current, item, t));
    setSelectedBagPath(null);
    setAttention('authoring');
    notify(t('Item selected. Review it, then press Send.'));
    window.requestAnimationFrame(() => writerRef.current?.focus());
  }, [backpack, notify, t, writerLocked]);

  const handleItemDrop = async (itemPath: string, targetPath: string) => {
    try {
      await airpGateway.useItem(itemPath, targetPath);
      await refresh();
      notify('The world noticed what you used.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The item could not be used');
    }
  };

  const handleReturnItem = async (itemPath: string, targetLayer = layer) => {
    const filename = itemPath.split('/').pop() || 'item.md';
    const destination = targetLayer === 'map' ? `world/${filename}` : `${targetLayer}/${filename}`;
    try {
      await airpGateway.move(itemPath, destination);
      await refresh();
      await loadChromeData();
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The item could not be placed');
      return false;
    }
  };

  // One move per item at a time: a double-click sent two moves, the second
  // failing with "destination already exists" while the card still showed.
  const takingRef = useRef(new Set<string>());
  const handleTakeItem = async (itemPath: string) => {
    if (takingRef.current.has(itemPath)) return;
    takingRef.current.add(itemPath);
    try {
      await airpGateway.move(itemPath, `player/${itemPath.split('/').pop()}`);
      await refresh();
      await loadChromeData();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The item could not be taken');
    } finally {
      takingRef.current.delete(itemPath);
    }
  };

  const handleToggleFreeze = async () => {
    try {
      await airpGateway.toggleFreeze();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not change world time');
    }
  };
  const handleToggleGodHand = () => {
    setIsGodHandOpen(open => !open);
  };

  const openCharacter = (character: CharacterView) => {
    if (activeCharacter) return;
    const admission = overlayAdmission.request('dialogue', nookChar ? 'nook' : 'workspace');
    if (!admission.accepted) {
      notify(admission.message);
      return;
    }
    characterAdmissionRef.current = admission.token;
    const worldId = manifest?.id || '';
    const caller: ProjectionTarget = nookChar
      ? projectionTarget('nook', nookChar)
      : projectionTarget('layer', layer);
    const target = projectionTarget('dialogue', character.id, caller.slot);
    cameraStack.pushTransition(target);
    cameraStack.restoreTarget(target);
    callerProjectionRef.current = caller;
    frameQueue.clear('switch');
    setActiveCharacter(character);
    sendMessage({
      type: 'character_start',
      characterId: character.id,
      recentContext: chalks.slice(-3).map((chalk) => chalk.body).join('\n\n'),
    });
  };
  const closeRadial = useCallback(() => {
    setRadialState(null);
    const token = radialAdmissionRef.current;
    if (token) overlayAdmission.release(token);
    radialAdmissionRef.current = null;
  }, [overlayAdmission]);

  const createAt = async (type: RadialItemType, title: string, content: string, x: number, y: number) => {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `creation-${Date.now()}`;
    const base = layer === 'map' ? 'world' : layer;
    const filePath = type === 'gate' ? `${base}/${slug}/README.md` : `${base}/${slug}.md`;
    const form = type === 'character' ? 'sprite' : type;
    try {
      await airpGateway.godAction('create', filePath, `---\ntype: ${form}\ntitle: ${JSON.stringify(title)}\n---\n${content}`);
      await refresh();
      closeRadial();
      notify(`Created “${title}”`);
    } catch (error) { notify(error instanceof Error ? error.message : 'Could not create the object'); }
  };
  const closeCharacter = () => {
    if (activeCharacter) sendMessage({ type: 'character_stop', characterId: activeCharacter.id });
    const token = characterAdmissionRef.current;
    if (token) {
      overlayAdmission.release(token);
      characterAdmissionRef.current = null;
    }
    agentActivityStore.clearSurface('character-modal');
    frameQueue.clear('close');
    const caller = callerProjectionRef.current;
    if (caller) {
      const frame = cameraStack.popTransition(caller);
      if (frame) cameraStack.restoreProjection(frame);
    }
    callerProjectionRef.current = null;
    setActiveCharacter(null);
  };
  closeCharacterRef.current = closeCharacter;

  return (
    <div data-depth-surface="ui" className={`airp-prototype${isDusk ? ' is-dusk' : ''}${shell.immersive ? ' is-immersive' : ''}${shell.journal ? ' is-reading' : ''}${shell.header ? ' has-header' : ''}${attention === 'authoring' ? ' is-authoring' : ''}`}>
      <main className="prototype-workspace">
        <aside className={`prototype-narrative${shell.journal ? ' is-open' : ''}`} aria-label={t("Story journal")} aria-hidden={!shell.journal} inert={!shell.journal}>
          <div className="prototype-narrhead">
            <span className="prototype-eyebrow">{t("THE STORY SO FAR")}</span>
            <button className="prototype-quiet" onClick={() => toggleShell('journal')} aria-label={t("Close story page")}>‹</button>
          </div>
          <div className="prototype-journal">
            <div className="prototype-small">{t('OPENING')} / {manifest?.genre || t('A LIVING WORLD')}</div>
            <h2 className="prototype-chapter">{manifest?.name || t('A world is waiting.')}</h2>
            <div className="prototype-time-label">{layer === 'map' ? t('THE FIRST MOMENT') : t('THE STORY CONTINUES')}</div>
            <p className="prototype-narrline">{manifest?.description || t('Choose a world to begin.')}</p>
            {readme?.body && <div className="prototype-narrline"><MarkdownText text={readme.body} /></div>}
            {chalks.slice(-4).map((chalk) => (
              <blockquote key={chalk.path} className="prototype-quote">{chalk.body}</blockquote>
            ))}
            {chalks.length === 0 && (
              <p className="prototype-small">{t("The writer has not left a mark in this scene yet.")}</p>
            )}
          </div>
          <div className="prototype-narrfoot">
            {t('You are the player inside {world}', { world: manifest?.name || t('this world') })}
            <span>{t('Current place: {place}', { place: currentName })}</span>
          </div>
        </aside>

        <section className="prototype-world" aria-label={t("Spatial story canvas")}>
          {nookChar && (
            <div
              className="prototype-nook"
              data-airp-projection={`nook:${nookChar}`}
              aria-hidden={activeCharacter !== null || worldPickerOpen}
              inert={activeCharacter !== null || worldPickerOpen}
            >
              <NookView
                characterId={nookChar!}
                locale={locale === 'ja' ? 'ja' : 'en'}
                onClose={closeNook}
                inactive={activeCharacter !== null}
                onMoveCard={moveCard}
                writerLocked={writerLocked}
                onSelectChoice={(path, choice) => { void airpGateway.choose(path, choice).catch(error => notify(String(error))); }}
                onOpenCharacterModal={(id) => {
                  const character = characters.find((item) => item.id === id);
                  if (character) openCharacter(character);
                }}
                onItemDropOnTarget={handleItemDrop}
                onDropItemToScene={handleReturnItem}
                onTakeItem={handleTakeItem}
                onRequestInit={(kind, target, request) => sendMessage({ type: 'airp_init', kind, target, ...(request ? { request } : {}), by: 'player' })}
              />
            </div>
          )}
          {!nookChar && (
            <div
              data-airp-projection={`layer:${layer}`}
              data-airp-projection-active="true"
              aria-hidden={activeCharacter !== null || worldPickerOpen}
              inert={activeCharacter !== null || worldPickerOpen}
            >
              <Canvas
                key={manifest?.id || 'opening'}
                effectsEnabled={effectsEnabled}
                currentLayer={layer}
                hidden={!pageVisible}
                reducedMotion={reducedMotion}
                allowChalkDrag={allowChalkDrag}
                stillPortraits={reducedMotion}
                ghost={ghostItem}
                ghostLabel={ghostLabel}
                ghostCopy={{
                  reused: t('Already had this image'),
                  failed: t('The picture could not be drawn.'),
                  unreachable: t('The picture could not be shown.'),
                }}
                items={canvasItems}
                links={state?.links || []}
                bg={(!loadingWorld && state?.bg) || { src: null, tone: 'warm', grain: 'parchment' }}
                onMoveCard={moveCard}
                onSelectChoice={(path, choice) => { void airpGateway.choose(path, choice).catch(error => notify(String(error))); }}
                onEntityAction={(choice) => { void submitWriterText(choice); }}
                onOpenCharacterModal={(id) => {
                  const character = characters.find((item) => item.id === id);
                  if (character) openCharacter(character);
                }}
                presence={presenceViews}
                assetUrl={assetUrl}
                onEnterGate={(target) => void enterLayer(target).then(applyFollowFailures)}
                onDropItemToScene={handleReturnItem}
                onTakeItem={handleTakeItem}
                onOpenRadialMenu={(x, y, worldX, worldY) => {
                  if (attention !== 'authoring') return;
                  const admission = overlayAdmission.request('radial', 'workspace');
                  if (!admission.accepted) {
                    notify(admission.message);
                    return;
                  }
                  radialAdmissionRef.current = admission.token;
                  setRadialState({ x, y, worldX, worldY });
                }}
              />

              {/* Performance shows (docs/perform/05) — z-20, below the dice ceremony
                  (z-50). Cancels its own shows on layer change / freeze. */}
              <PerformanceLayer
                layer={layer}
                frozen={state?.worldFrozen === true}
                hidden={!pageVisible}
                effectsEnabled={effectsEnabled}
                reducedMotion={reducedMotion}
                admission={overlayAdmission}
              />
            </div>
          )}

          <div className="prototype-vignette" aria-hidden="true" />

          <header className="prototype-worldtop prototype-chrome" aria-label={t("World header")} inert={!shell.header || shell.immersive}>
            <span className="prototype-brand">World<span>lines</span></span>
            <nav className="prototype-crumbs" aria-label={t("Scene path")}>
              {breadcrumbs.map((part) => {
                const label = part === 'map' ? t('Map') : sceneName(manifest, part);
                // One line, ellipsised: a wrapped crumb breaks the fixed-height header.
                return <button key={part} title={label} onClick={() => void enterLayer(part).then(applyFollowFailures)}><span className="prototype-crumb-label">{label}</span></button>;
              })}
            </nav>
            <div className="prototype-spacer" />
            <span className="prototype-freeze">{state?.worldFrozen ? t('WORLD PAUSED') : t('WORLD AWAKE')}</span>
            <span className="prototype-status">{t('{items} ITEMS · {people} PEOPLE', { items: handItems.length, people: characters.length })}</span>
            <button className="prototype-pill" onClick={() => setLauncherOpen(true)}>{t('World launcher')}</button>
            <button className="prototype-pill" onClick={() => setWorldPickerOpen(true)}>{t("Worlds")}</button>
            <label className="prototype-language"><span className="sr-only">{t('Language')}</span><select aria-label={t('Language')} value={locale} onChange={event => setLocale(event.target.value as 'en' | 'zh-CN' | 'ja')}><option value="en">English</option><option value="zh-CN">简体中文</option><option value="ja">日本語</option></select></label>
            <AgentSettings settings={world.settings} onSaveSettings={world.saveSettings} focus={focusCoordinator} />
            <TtsSettings focus={focusCoordinator} />
            <MuteButton />
            <button className="prototype-effects-toggle" role="switch" aria-label={t("Visual effects")} aria-checked={effectsEnabled} onClick={() => setEffectsEnabled(value => !value)} title={t("Particles, parallax and animated backgrounds")}><span aria-hidden="true" />{t(effectsEnabled ? 'Effects on' : 'Effects off')}</button>
            <button className="prototype-quiet" onClick={() => toggleShell('header')} aria-label={t("Close header")}><ChevronUp size={16} /></button>
          </header>

          <div className="prototype-edge-controls prototype-chrome">
            <button onClick={() => toggleShell('journal')} aria-label={t("Toggle story journal")} aria-expanded={shell.journal}><BookOpen size={17} /></button>
            <button onClick={() => toggleShell('header')} aria-label={t("Toggle header")} aria-expanded={shell.header}><ChevronDown size={17} /></button>
          </div>

          <button className="prototype-immersion-toggle" onClick={() => toggleShell('immersion')} aria-label={shell.immersive ? t('Show interface') : t('Hide interface')} title={t("Toggle immersion · Tab")}>{shell.immersive ? <Minimize size={17} /> : <Maximize size={17} />}</button>

          <div className="prototype-world-meta prototype-chrome">
            <div className="prototype-eyebrow">{manifest?.name}</div>
            <h1>{currentName}</h1>
            <p>{layer === 'map' ? t('The first moment') : t('The story continues')} · {state?.worldFrozen ? t('Time stands still') : t('Time flows')}</p>
            {sceneStatus.map(([key, value]) => <span className="prototype-stat" key={key}>{labelOf(key)} · {String(value)}</span>)}
            <WriterResult
              worldKey={`${manifest?.id}:${layer}`}
              worldReady={worldReady}
              worldFrozen={state?.worldFrozen === true}
              submitPending={writerSubmitPending}
              onContinue={prepareWriterHint}
            />
          </div>

          {/* 全局 activity rail（契约 §7.1）：writer/functional 在角色或小天地
              打开时也必须可见；character 只进入 CharacterModal 自己的 surface，
              避免串台。始终挂在这里，不作为 modal 的后代。 */}
          <ActivityRail surface="rail" className="prototype-chrome" />
          <ConnectedWorldToastRegion className="prototype-chrome" />
          <AgentActivityLog query={{ surface: 'rail' }} className="prototype-chrome" focus={focusCoordinator} />

          <div className="prototype-tools prototype-chrome" aria-label={t("Canvas tools")}>
            <button className="active" title={t("Explore")}>↖</button>
            <button onClick={() => setAttention('authoring')} title={t("God Hand")}>◯</button>
            <button onClick={() => cameraStack.restoreTarget(projectionTarget('layer', layer))} title={t("Return to scene")}>⌖</button>
          </div>

          <div className="prototype-belongings prototype-chrome" aria-label={t("Belongings")}>
            <button className="prototype-bag-toggle" onClick={() => setBagOpen(open => !open)} aria-label={t("Open belongings")} aria-expanded={bagOpen}><Backpack size={19} /><span>{handItems.length}</span></button>
            {bagOpen && <div className="prototype-bag-content"><div className="inventory-heading"><span>{t("BELONGINGS")}</span><button type="button" onClick={() => setBagOpen(false)} aria-label={t('Close')}>×</button></div>{handItems.length === 0 && <p>{t("Nothing carried yet.")}</p>}{handItems.map((item) => {
              return (
                <button
                  key={item.path}
                  className="inventory-item"
                  draggable
                  onClick={() => setSelectedBagPath(item.path)}
                  onDragStart={(event) => event.dataTransfer.setData('text/plain', item.path)}
                  aria-label={String(item.frontmatter?.title || labelOf(item.filename.replace(/\.md$/, '')))}
                >
                  <ItemArtwork item={item} />
                  <span className="inventory-item__name">{item.frontmatter?.title || labelOf(item.filename.replace(/\.md$/, ''))}</span>
                  <span className="inventory-item__open" aria-hidden="true">↗</span>
                  </button>
              );
            })}</div>}
          </div>

          <button className="prototype-player-orb prototype-chrome" style={playerAvatar ? { backgroundImage: `url("${playerAvatar}")`, backgroundSize: 'cover', backgroundPosition: 'center 25%' } : undefined} onClick={() => setProfileOpen((open) => !open)} aria-label={t("Open player profile")} aria-expanded={profileOpen}>{!playerAvatar && <UserRound size={25} />}<span className="prototype-player-label"><small>{t("YOU")}</small>{playerRole}</span></button>
          {profileOpen && chromeVisible && (
            <div className="prototype-profile">
              <b>{playerRole}</b>
              <div className="prototype-small">{t("PLAYER CHARACTER")}</div>
              <p>{manifest?.id === 'wuwu' ? 'Newly posted to Fogwharf. Three commissions, one unfinished case. Your story begins here.' : `Your story unfolds in ${manifest?.name || 'this world'}.`}</p>
            </div>
          )}

          {/* The character rail (docs/presence/00 §4.2.1): RIGHT column, stacked
              above the belongings, no tabs. It replaced the companion-only
              `.prototype-residents` row, which could not express "elsewhere"
              or "absent" and never showed who was following. */}
          <CharacterRail
            views={presenceViews}
            pendingFollowing={pendingFollowing}
            nookOpen={nookChar !== null}
            onOpenCharacter={(id) => {
              const character = characters.find((item) => item.id === id);
              if (character) openCharacter(character);
            }}
            onTravelTo={(id) => void navigateToCharacter(id)}
            onToggleFollowing={(id, next) => void toggleFollowing(id, next)}
            onOpenNook={openNook}
            notify={notify}
            assetUrl={assetUrl}
          />
          <button className="prototype-action-toggle prototype-chrome" onClick={() => {
            if (attention === 'authoring') {
              closeRadial();
              setAttention('ambient');
              setIsGodHandOpen(false);
              return;
            }
            setAttention('authoring');
            setShell(current => ({ ...current, immersive: false }));
            window.setTimeout(() => writerRef.current?.focus(), 0);
          }} aria-label={t("Write an action")}><Sparkles size={17} /><span aria-live="polite">{writerWorking ? t('The writer is working…') : t('What do you do?')}</span></button>
          {writerWorking && <button type="button" className="writer-stop-control" data-writer-stop disabled={writerState.stopRequested} onClick={() => {
            if (requestWriterStop()) sendMessage({ type: 'writer_abort' });
          }} aria-label={t(writerState.stopRequested ? 'Stop requested' : 'Stop writing')}>
            ■ {writerState.stopRequested ? t('Stop requested') : t('Stop writing')}
          </button>}
          {writerState.error?.retryable && retryWriterPrompt() && (
            <button type="button" className="writer-retry-control" data-writer-retry onClick={() => {
              const prompt = retryWriterPrompt();
              if (prompt) void submitWriterText(prompt, undefined, true);
            }}>
              Retry writing
            </button>
          )}
          <div className="prototype-dock prototype-chrome">
            <div className="prototype-docktop">
              <b>{t("✧ SPEAK TO THE WRITER")}</b>
              <span>{state?.worldFrozen ? t('The world is paused') : t('Your action moves the world forward')}</span>
              <div className="prototype-spacer" />
              <span>↵</span>
            </div>
            <div className="prototype-dockrow">
              <WriterBar
                embedded
                inputRef={writerRef}
                inputAriaLabel={t('Action')}
                value={writerDraft}
                onChange={setWriterDraft}
                onSend={text => submitWriterText(text)}
                disabled={writerLocked}
                placeholder={t("What do you do? You can also address someone by name…")}
                writingPlaceholder={t('The writer is writing…')}
                sendLabel="↑"
                onKeyDown={event => {
                  if (!['ArrowUp', 'ArrowDown'].includes(event.key) || !writerHistory.current.length) return;
                  event.preventDefault();
                  event.stopPropagation();
                  const history = writerHistory.current;
                  if (writerHistoryCursor.current === history.length) historyDraft.current = writerDraft;
                  writerHistoryCursor.current = Math.max(0, Math.min(history.length, writerHistoryCursor.current + (event.key === 'ArrowUp' ? -1 : 1)));
                  const next = writerHistoryCursor.current === history.length ? historyDraft.current : history[writerHistoryCursor.current];
                  setWriterDraft(next);
                  window.requestAnimationFrame(() => {
                    const input = writerRef.current;
                    if (input) input.setSelectionRange(input.value.length, input.value.length);
                  });
                }}
              />
            </div>
          </div>

          {attention === 'authoring' && (
            <div className="prototype-authoring">
              <GodModeToolbar frozen={state?.worldFrozen === true} onToggleFreeze={handleToggleFreeze} allowChalkDrag={allowChalkDrag} onToggleChalkDrag={handleToggleGodHand} />
              <button className="prototype-quiet" onClick={() => { closeRadial(); setAttention('ambient'); setIsGodHandOpen(false); }}>{t("Close")}</button>
            </div>
          )}

        </section>
      </main>

      {loadingWorld && <div role="status" className="prototype-world-loading">{t(' · opening…')}</div>}
      {launcherOpen && (
        <WorldLauncher
          shelf={shelf}
          loading={loadingWorld}
          onLoad={path => void loadWorld(path)}
          onClose={manifest ? () => setLauncherOpen(false) : undefined}
          onManageSaves={() => setWorldPickerOpen(true)}
        />
      )}
      {worldPickerOpen && (
        <WorldShelfDialog shelf={shelf} loading={loadingWorld} onLoad={path => void loadWorld(path)} onClose={() => setWorldPickerOpen(false)} onRefresh={async () => { setShelf(await airpGateway.worlds()); }} />
      )}

      {selectedBagItem && (
        <BagItemDialog
          item={selectedBagItem}
          onClose={() => setSelectedBagPath(null)}
          onPlace={handleReturnItem}
          onUse={prepareItemUse}
          useDisabled={writerLocked}
        />
      )}

      {radialState && <RadialMenu {...radialState} onClose={closeRadial} onCreate={createAt} />}

      {activeCharacter && (
        <CharacterModal
          key={activeCharacter.id}
          characterId={activeCharacter.id}
          displayName={activeCharacter.name}
          avatar={assetUrl(activeCharacter.avatar, 'image')}
          avatarVideo={assetUrl(activeCharacter.avatarVideo, 'video')}
          emotions={
            activeCharacter.emotions
              ? Object.fromEntries(
                Object.entries(activeCharacter.emotions).map(([emo, path]) => [emo, assetUrl(path, 'image') ?? ''])
                )
              : undefined
          }
          effectsEnabled={effectsEnabled}
          bio={activeCharacter.bio || activeCharacter.description}
          frameQueue={frameQueue}
          worldId={manifest?.id}
          voice={activeCharacter.voice}
          onClose={closeCharacter}
          language={manifest?.locale === 'ja' || manifest?.locale === 'en' ? manifest.locale : 'en'}
          onOpenNook={() => { const id = activeCharacter.id; closeCharacter(); openNook(id); }}
          onSendMessage={(message) => sendMessage({ type: 'character_prompt', characterId: activeCharacter.id, message })}
        />
      )}

      {/* Dice ceremony overlay (screen-fixed layer, same visual language as the player path) */}
      {ceremony && (
        <DiceCeremony key={ceremony.key} verdict={ceremony.verdict} onDone={clearAdmittedCeremony} />
      )}

      {toast && <div className="prototype-toast" role="status">{toast}</div>}
    </div>
  );
}
