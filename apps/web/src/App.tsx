import { useLocale } from './lib/i18n.js';
import { AgentSettings } from './components/AgentSettings.js';
import { TtsSettings } from './components/TtsSettings.js';
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
import { worldEventToastStore } from './lib/world-event-toast.js';
import { GodModeToolbar } from './components/god/GodModeToolbar.js';
import { RadialMenu, type RadialItemType } from './components/god/RadialMenu.js';
import { MuteButton } from './components/chrome/MuteButton.js';
import { useAudio } from './state/useAudio.js';
import { useCamera } from './state/useCamera.js';
import { useWorld } from './state/useWorld.js';
import { airpGateway, type AssetMediaKind, type WorldShelf } from './lib/airp-gateway.js';
import { WorldShelf as WorldShelfDialog } from './components/WorldShelf.js';
import { BagItemDialog } from './components/BagItemDialog.js';
import { initialShell, transitionShell, splitCharacters } from './lib/ui-shell.mjs';
import { MarkdownText } from './lib/md.js';
import { BookOpen, ChevronDown, ChevronUp, Maximize, Minimize, UserRound, Backpack, Sparkles } from 'lucide-react';
import { preloadAudio } from './lib/audio.js';

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
}

type Attention = 'ambient' | 'authoring';

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
  const [encounters, setEncounters] = useState<Record<string, string[]>>({});
  const [bagOpen, setBagOpen] = useState(false);
  const [selectedBagPath, setSelectedBagPath] = useState<string | null>(null);
  const selectedBagItem = backpack.find(item => item.path === selectedBagPath);
  const [effectsEnabled, setEffectsEnabled] = useState(() => {
    try { return localStorage.getItem('airp:effects') === 'on'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('airp:effects', effectsEnabled ? 'on' : 'off'); } catch { /* Storage is optional. */ }
  }, [effectsEnabled]);
  const [radialState, setRadialState] = useState<{ x: number; y: number; worldX: number; worldY: number } | null>(null);
  const toggleShell = (action: 'header' | 'journal' | 'immersion') => setShell(current => transitionShell(current, action));
  const [worldPickerOpen, setWorldPickerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeCharacter, setActiveCharacter] = useState<CharacterView | null>(null);
  const [nookChar, setNookChar] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loadingWorld, setLoadingWorld] = useState<string | null>(null);
  const [backdropReady, setBackdropReady] = useState(false);
  const writerState = useWriterState();
  const writerWorking = writerState.phase === 'writing';
  const [writerSubmitPending, setWriterSubmitPending] = useState(false);
  const writerRef = useRef<HTMLInputElement>(null);
  const writerHistory = useRef<string[]>([]);
  const writerHistoryCursor = useRef(0);
  const [writerDraft, setWriterDraft] = useState('');
  const historyDraft = useRef('');
  const toastTimer = useRef<number | null>(null);
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

  const loadChromeData = async () => {
    try {
      const [nextManifest, nextBackpack, nextCharacters, nextShelf] = await Promise.all([
        airpGateway.manifest<WorldManifest>(),
        airpGateway.backpack<BackpackItem[]>(),
        airpGateway.characters<CharacterView[]>(),
        airpGateway.worlds(),
      ]);
      setManifest(nextManifest);
      setBackpack(nextBackpack.items);
      setCharacters(nextCharacters.characters);
      setShelf(nextShelf);
    } catch (error) {
      console.warn('Could not load AIRP chrome data:', error);
    }
  };
  useEffect(() => {
    const unavailable = () => {
      writerPendingRef.current = false;
      setWriterSubmitPending(false);
      setManifest(null);
      setBackpack([]);
      setCharacters([]);
      setEncounters({});
      setNookChar(null);
      setActiveCharacter(null);
      callerProjectionRef.current = null;
      cameraStack.clear();
      setWorldPickerOpen(true);
      frameQueue.clear('disconnect');
      void airpGateway.worlds().then(setShelf).catch(() => notify('Could not load the world shelf. Please retry.'));
    };
    window.addEventListener('airp:world-unavailable', unavailable);
    return () => window.removeEventListener('airp:world-unavailable', unavailable);
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
      markPlayed(v.path);
      playCeremony(v);
    };
    window.addEventListener('airp:dice-frame', onDiceFrame);
    return () => {
      window.removeEventListener('airp:dice-frame', onDiceFrame);
      clearCeremony();
    };
  }, [activeCharacter?.id, layer]);

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
        // Dismiss transient chrome first; if nothing was open, Esc is the
        // documented "go back" key (HintBar: "Alt+← / Esc to return"). Inside a
        // nook it closes the nook and MUST NOT also walk the layer tree.
        if (activeCharacter || bagOpen || profileOpen || worldPickerOpen) {
          setWorldPickerOpen(false);
          setProfileOpen(false);
          setBagOpen(false);
          return;
        }
        if (nookChar !== null) { closeNook(); return; }
        if (shell.header || shell.journal || shell.immersive) { setShell(initialShell); return; }
        if (layer !== 'map') {
          enterLayer(manifest?.layers?.[layer]?.parent || 'map');
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
  }, [activeCharacter, bagOpen, profileOpen, worldPickerOpen, nookChar, shell, layer, manifest, enterLayer, closeNook]);

  const chalks = useMemo(
    () => (state?.items || []).filter((item) => item.frontmatter?.type === 'chalk'),
    [state?.items],
  );
  const readme = useMemo(() => {
    const expected = layer === 'map' ? 'world/README.md' : `${layer}/README.md`;
    return state?.items.find((item) => item.path === expected);
  }, [layer, state?.items]);
  const worldReady = Boolean(manifest && state && readme);
  const encounteredIds = [...(encounters[manifest?.id || ''] || []), ...(state?.presence || []).map(person => person.characterId)];
  const { resident, encountered } = splitCharacters(characters, encounteredIds);
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
        enterLayer(manifest?.layers?.[layer]?.parent || 'map');
      }
    };
    window.addEventListener('keydown', onBack);
    return () => window.removeEventListener('keydown', onBack);
  }, [layer, manifest, activeCharacter, enterLayer]);

  const loadWorld = async (worldPath: string) => {
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
    setNookChar(null);
    try {
      const result = await airpGateway.loadWorld<WorldManifest>(worldPath);
      setManifest(result.manifest);
      // Settings are per-world and live under the (now-active) save's
      // `.airpworld/`, so re-read them before entering the world's first layer
      // — `enterLayer` gates the I1 initialiser on `autoWrite`.
      await world.reloadSettings();
      await enterLayer('map');
      await loadChromeData();
      setWorldPickerOpen(false);
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

  const submitWriter = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitWriterText(writerDraft);
  };
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

  const handleTakeItem = async (itemPath: string) => {
    try { await airpGateway.move(itemPath, `player/${itemPath.split('/').pop()}`); await loadChromeData(); }
    catch (error) { notify(String(error)); }
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
    const worldId = manifest?.id || '';
    const caller: ProjectionTarget = nookChar
      ? projectionTarget('nook', nookChar)
      : projectionTarget('layer', layer);
    const target = projectionTarget('dialogue', character.id, caller.slot);
    setEncounters(current => ({ ...current, [worldId]: [...new Set([...(current[worldId] || []), character.id])] }));
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

  const createAt = async (type: RadialItemType, title: string, content: string, x: number, y: number) => {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `creation-${Date.now()}`;
    const base = layer === 'map' ? 'world' : layer;
    const filePath = type === 'gate' ? `${base}/${slug}/README.md` : `${base}/${slug}.md`;
    const form = type === 'character' ? 'sprite' : type;
    try {
      await airpGateway.godAction('create', filePath, `---\ntype: ${form}\ntitle: ${JSON.stringify(title)}\n---\n${content}`);
      await moveCard(filePath, x, y);
      await refresh();
      setRadialState(null);
      notify(`Created “${title}”`);
    } catch (error) { notify(error instanceof Error ? error.message : 'Could not create the object'); }
  };
  const closeCharacter = () => {
    if (activeCharacter) sendMessage({ type: 'character_stop', characterId: activeCharacter.id });
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

  return (
    <div className={`airp-prototype${isDusk ? ' is-dusk' : ''}${shell.immersive ? ' is-immersive' : ''}${shell.journal ? ' is-reading' : ''}${shell.header ? ' has-header' : ''}${attention === 'authoring' ? ' is-authoring' : ''}`}>
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
            >
              <NookView
                characterId={nookChar!}
                locale={locale === 'ja' ? 'ja' : 'en'}
                onClose={closeNook}
                inactive={activeCharacter !== null}
                onMoveCard={moveCard}
                writerLocked={writerLocked}
                onSelectChoice={(path, choice) => { void airpGateway.choose(path, choice).catch(error => notify(String(error))); }}
                onEntityAction={(choice, targetLayer) => { void submitWriterText(choice, targetLayer); }}
                onDiceRolled={(result, passed) => notify(`Roll ${result} · ${passed ? 'passed' : 'failed'}`)}
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
              aria-hidden={activeCharacter !== null}
              inert={activeCharacter !== null}
            >
              <Canvas
                key={manifest?.id || 'opening'}
                effectsEnabled={effectsEnabled}
                allowChalkDrag={allowChalkDrag}
                currentLayer={layer}
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
                onItemDropOnTarget={handleItemDrop}
                onDropItemToScene={handleReturnItem}
                onTakeItem={handleTakeItem}
                onOpenRadialMenu={(x, y, worldX, worldY) => { if (attention === 'authoring') setRadialState({ x, y, worldX, worldY }); }}
              />

              {/* Performance shows (docs/perform/05) — z-20, below the dice ceremony
                  (z-50). Cancels its own shows on layer change / freeze. */}
              <PerformanceLayer layer={layer} frozen={state?.worldFrozen === true} />
            </div>
          )}

          <div className="prototype-vignette" aria-hidden="true" />

          <header className="prototype-worldtop prototype-chrome" aria-label={t("World header")} inert={!shell.header || shell.immersive}>
            <span className="prototype-brand">World<span>lines</span></span>
            <nav className="prototype-crumbs" aria-label={t("Scene path")}>
              {breadcrumbs.map((part) => {
                return <button key={part} onClick={() => enterLayer(part)}>{part === 'map' ? t('Map') : sceneName(manifest, part)}</button>;
              })}
            </nav>
            <div className="prototype-spacer" />
            <span className="prototype-freeze">{state?.worldFrozen ? t('WORLD PAUSED') : t('WORLD AWAKE')}</span>
            <span className="prototype-status">{t('{items} ITEMS · {people} PEOPLE', { items: handItems.length, people: characters.length })}</span>
            <button className="prototype-pill" onClick={() => setWorldPickerOpen(true)}>{t("Worlds")}</button>
            <label className="prototype-language"><span className="sr-only">{t('Language')}</span><select aria-label={t('Language')} value={locale} onChange={event => setLocale(event.target.value as 'en' | 'zh-CN' | 'ja')}><option value="en">English</option><option value="zh-CN">简体中文</option><option value="ja">日本語</option></select></label>
            <AgentSettings settings={world.settings} onSaveSettings={world.saveSettings} />
            <TtsSettings />
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
          <AgentActivityLog query={{ surface: 'rail' }} className="prototype-chrome" />

          <div className="prototype-tools prototype-chrome" aria-label={t("Canvas tools")}>
            <button className="active" title={t("Explore")}>↖</button>
            <button onClick={() => setAttention('authoring')} title={t("God Hand")}>◯</button>
            <button onClick={() => cameraStack.restoreTarget(projectionTarget('layer', layer))} title={t("Return to scene")}>⌖</button>
          </div>

          <div className="prototype-hand-tray prototype-chrome" aria-label={t("Encountered characters")}>
            <span className="prototype-tray-label">{t("PEOPLE YOU KNOW")}</span>
            {encountered.length === 0 && <span className="prototype-tray-empty">{t("Every stranger has a story.")}</span>}
            {encountered.map((character) => (
              <button
                key={character.id}
                className="prototype-hand-orb"
                onClick={() => openCharacter(character)}
                title={t('Talk to {name}', { name: character.name || character.id })}
                style={assetUrl(character.avatar, 'image') ? { backgroundImage: `url("${assetUrl(character.avatar, 'image')}")` } : undefined}
              >
                {!assetUrl(character.avatar, 'image') && <span>{character.id.charAt(0).toUpperCase()}</span>}
                <small>{character.name || labelOf(character.id)}</small>
              </button>
            ))}
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

          <div className="prototype-residents prototype-chrome" aria-label={t("Resident companions")}>
          {resident.map(companion => (
            <button
              key={companion.id}
              className="prototype-companion-orb"
              onClick={() => openCharacter(companion)}
              aria-label={t('Talk to {name}', { name: companion.name || companion.id })}
              style={assetUrl(companion.avatar, 'image') ? { backgroundImage: `url("${assetUrl(companion.avatar, 'image')}")` } : undefined}
            >
              {!assetUrl(companion.avatar, 'image') && companion.id.charAt(0).toUpperCase()}<i /><small>{companion.name || labelOf(companion.id)}</small>
            </button>
          ))}
          </div>
          <button className="prototype-action-toggle prototype-chrome" onClick={() => { if (attention === 'authoring') { setAttention('ambient'); setIsGodHandOpen(false); } else setAttention('authoring'); window.setTimeout(() => writerRef.current?.focus(), 0); }} aria-label={t("Write an action")}><Sparkles size={17} /><span aria-live="polite">{writerWorking ? t('The writer is working…') : t('What do you do?')}</span></button>
          {writerWorking && <button type="button" className="writer-stop-control" disabled={writerState.stopRequested} onClick={() => {
            if (requestWriterStop()) sendMessage({ type: 'writer_abort' });
          }} aria-label="Stop writing">
            ■ {writerState.stopRequested ? 'Stop requested' : 'Stop writing'}
          </button>}
          {writerState.error?.retryable && retryWriterPrompt() && (
            <button type="button" className="writer-retry-control" data-writer-retry onClick={() => {
              const prompt = retryWriterPrompt();
              if (prompt) void submitWriterText(prompt, undefined, true);
            }}>
              Retry writing
            </button>
          )}
          <form className="prototype-dock prototype-chrome" onSubmit={submitWriter}>
            <div className="prototype-docktop">
              <b>{t("✧ SPEAK TO THE WRITER")}</b>
              <span>{state?.worldFrozen ? t('The world is paused') : t('Your action moves the world forward')}</span>
              <div className="prototype-spacer" />
              <span>↵</span>
            </div>
            <div className="prototype-dockrow">
              {writerWorking && <span role="status">{t(writerState.stopRequested ? 'Stop requested' : 'The writer is working…')}</span>}
              <input
                ref={writerRef}
                value={writerDraft}
                aria-label={t("Action")}
                placeholder={writerLocked ? t('The writer is writing…') : t("What do you do? You can also address someone by name…")}
                disabled={writerLocked}
                autoComplete="off"
                onChange={event => setWriterDraft(event.currentTarget.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && event.nativeEvent.isComposing) {
                    event.preventDefault();
                    return;
                  }
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
              <button type="submit" className="prototype-primary" aria-label={t("Send action")}>↑</button>
            </div>
          </form>

          {attention === 'authoring' && (
            <div className="prototype-authoring">
              <GodModeToolbar frozen={state?.worldFrozen === true} onToggleFreeze={handleToggleFreeze} allowChalkDrag={allowChalkDrag} onToggleChalkDrag={handleToggleGodHand} />
              <button className="prototype-quiet" onClick={() => { setAttention('ambient'); setIsGodHandOpen(false); }}>{t("Close")}</button>
            </div>
          )}

        </section>
      </main>

      {loadingWorld && <div role="status" className="prototype-world-loading">{t(' · opening…')}</div>}
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

      {radialState && <RadialMenu {...radialState} onClose={() => setRadialState(null)} onCreate={createAt} />}

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
        <DiceCeremony key={ceremony.key} verdict={ceremony.verdict} onDone={clearCeremony} />
      )}

      {toast && <div className="prototype-toast" role="status">{toast}</div>}
    </div>
  );
}
