import { useLocale } from './lib/i18n.js';
import { AgentSettings } from './components/AgentSettings.js';
import { TtsSettings } from './components/TtsSettings.js';
import { WriterResult } from './components/WriterResult.js';
import { ItemArtwork } from './components/ItemArtwork.js';
import { NookView } from './components/nook/NookView.js';
import { ghostItemFor } from './lib/init-ghost.js';
import { useViewpointReport } from './hooks/useViewpointReport.js';
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Canvas } from './components/canvas/Canvas.js';
import { CharacterModal, type CharacterFrame } from './components/overlay/CharacterModal.js';
import { DiceCeremony } from './components/performance/DiceCeremony.js';
import { PerformanceLayer } from './components/performance/PerformanceLayer.js';
import {
  parseDiceFrame,
  shouldPlayFrame,
  markPlayed,
  playCeremony,
  clearCeremony,
  subscribeCeremony,
  getCeremonySnapshot,
} from './lib/dice-ceremony.js';
import { GodModeToolbar } from './components/god/GodModeToolbar.js';
import { RadialMenu, type RadialItemType } from './components/god/RadialMenu.js';
import { MuteButton } from './components/chrome/MuteButton.js';
import { useAudio } from './state/useAudio.js';
import { useCamera } from './state/useCamera.js';
import { useWorld } from './state/useWorld.js';
import { airpGateway, type WorldShelf } from './lib/airp-gateway.js';
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

function assetUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (/^(?:https?:|data:|blob:|\/)/.test(path)) return path;
  return airpGateway.assetUrl(path);
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
  const [writerWorking, setWriterWorking] = useState(false);
  const [writerStopRequested, setWriterStopRequested] = useState(false);
  useEffect(() => { if (!writerWorking) setWriterStopRequested(false); }, [writerWorking]);
  const [writerStage, setWriterStage] = useState('The writer is working…');
  const [writerStarted, setWriterStarted] = useState(0);
  const [writerElapsed, setWriterElapsed] = useState(0);
  useEffect(() => {
    if (!writerWorking || !writerStarted) return;
    const timer = window.setInterval(() => setWriterElapsed(Math.floor((Date.now() - writerStarted) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [writerWorking, writerStarted]);
  useEffect(() => {
    const receive = (event: Event) => {
      const frame = (event as CustomEvent).detail;
      if (frame.source !== 'writer') return;
      if (frame.type === 'agent_progress') {
        setWriterStage(frame.stage);
        setWriterStarted(frame.startedAt);
        setWriterElapsed(Math.floor((Date.now() - frame.startedAt) / 1000));
        setWriterWorking(frame.busy);
      }
      if (['writer_delta', 'tool_start', 'chalk_writing'].includes(frame.type)) setWriterWorking(true);
      if (['writer_idle', 'error', 'turn_aborted'].includes(frame.type)) setWriterWorking(false);
    };
    window.addEventListener('airp:agent-frame', receive);
    return () => window.removeEventListener('airp:agent-frame', receive);
  }, []);
  const writerRef = useRef<HTMLInputElement>(null);
  const writerHistory = useRef<string[]>([]);
  const writerHistoryCursor = useRef(0);
  const writerDraft = useRef('');
  const toastTimer = useRef<number | null>(null);

  // 角色演出帧（A3）：useWorld 转发给遮罩；本组件按 activeCharacter.id 路由后下推。
  const [activeModalFrame, setActiveModalFrame] = useState<CharacterFrame | null>(null);

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
  const chromeVisible = !shell.immersive;
  const isDusk = backdropReady;

  // The free-input channel locks while the writer is mid-turn (docs/perform/01
  // §6.4): a stray Enter must not queue a prompt the writer will never read.
  // `writerWorking` is driven below from the writer frames (tool_start /
  // writer_delta / chalk_writing → busy; writer_idle / error / turn_aborted →
  // idle), so it covers a turn before its first chalk lands.
  const writerLocked = writerWorking || state?.worldFrozen === true;

  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  };

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
      setManifest(null);
      setCharacters([]);
      setBackpack([]);
      setWriterWorking(false);
      setWorldPickerOpen(true);
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
  useEffect(() => {
    const onLayerInit = (event: Event) => {
      const ev = (event as CustomEvent).detail?.event as { type?: string } | undefined;
      if (['layer_init_failed'].includes(ev?.type ?? '')) notify(t('It never quite took shape here.'));
    };
    window.addEventListener('airp:layer-init', onLayerInit);
    return () => window.removeEventListener('airp:layer-init', onLayerInit);
  }, [t]);

  // 角色演出帧（A3）：useWorld 转发的原始帧；按当前打开的角色过滤后下推给遮罩。
  // 归属过滤放在这里而不是 useWorld：遮罩是唯一消费者，且须随开关重绑。
  useEffect(() => {
    const onCharacterFrame = (event: Event) => {
      const msg = (event as CustomEvent).detail as CharacterFrame | undefined;
      if (!msg) return;
      const activeId = activeCharacter?.id;
      if (msg.characterId !== undefined) {
        if (msg.characterId !== activeId) return;
      } else if (activeId === null) {
        return;
      }
      setActiveModalFrame(msg);
    };
    window.addEventListener('airp:character-frame', onCharacterFrame);
    return () => window.removeEventListener('airp:character-frame', onCharacterFrame);
  }, [activeCharacter]);

  // Dice ceremony: forwarded raw frame → boundary guard → layer filter / dedup
  // → ceremony layer. Rebinds on the current layer so the filter reads the live
  // value; the cleanup ends an in-flight ceremony when the player switches
  // layers (docs/perform/02 §7.2).
  useEffect(() => {
    const onDiceFrame = (event: Event) => {
      const v = parseDiceFrame((event as CustomEvent).detail);
      if (!v || !shouldPlayFrame(v, layer)) return;
      markPlayed(v.path);
      playCeremony(v);
    };
    window.addEventListener('airp:dice-frame', onDiceFrame);
    return () => {
      window.removeEventListener('airp:dice-frame', onDiceFrame);
      clearCeremony();
    };
  }, [layer]);

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
    setBackdropReady(false);
    if (!src || loadingWorld) return;
    const probe = new Image();
    probe.onload = () => setBackdropReady(true);
    probe.onerror = () => setBackdropReady(false);
    probe.src = airpGateway.assetUrl(src);
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
        setAttention('ambient');
        setIsGodHandOpen(false);
        if (nookChar !== null) { setNookChar(null); camera.restore(layer); void refresh(); return; }
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
  }, [activeCharacter, bagOpen, profileOpen, worldPickerOpen, nookChar, shell, layer, manifest, enterLayer, refresh, camera]);

  const chalks = useMemo(
    () => (state?.items || []).filter((item) => item.frontmatter?.type === 'chalk'),
    [state?.items],
  );
  const readme = useMemo(() => {
    const expected = layer === 'map' ? 'world/README.md' : `${layer}/README.md`;
    return state?.items.find((item) => item.path === expected);
  }, [layer, state?.items]);
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
  const playerAvatar = assetUrl(manifest?.player?.avatar);
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
    setActiveCharacter(null);
    setNookChar(null);
    setWriterWorking(false);
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

  const submitWriter = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (writerLocked) return; // belt-and-braces: the input is disabled too
    const input = writerRef.current;
    const text = input?.value.trim() || '';
    if (!text) return;
    if (writerHistory.current.at(-1) !== text) writerHistory.current.push(text);
    if (writerHistory.current.length > 50) writerHistory.current.shift();
    writerHistoryCursor.current = writerHistory.current.length;
    writerDraft.current = '';
    setWriterWorking(true);
    sendToWriter(text);
    input!.value = '';
    notify('The writer is listening…');
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

  const handleReturnItem = async (itemPath: string) => {
    const filename = itemPath.split('/').pop() || 'item.md';
    const destination = layer === 'map' ? `world/${filename}` : `${layer}/${filename}`;
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
    setEncounters(current => ({ ...current, [worldId]: [...new Set([...(current[worldId] || []), character.id])] }));
    camera.save('dialogue');
    setActiveModalFrame(null); // 清上一轮残留，避免新遮罩先演旧台词
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
    setActiveCharacter(null);
    camera.restore('dialogue');
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
            onEntityAction={(choice) => {
              setWriterWorking(true);
              sendToWriter(choice);
              notify('The writer is listening…');
            }}
            onDiceRolled={(result, passed) => notify(`Roll ${result} · ${passed ? 'passed' : 'failed'}`)}
            onEnterGate={enterLayer}
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
            <WriterResult worldKey={`${manifest?.id}:${layer}`} />
          </div>

          <div className="prototype-tools prototype-chrome" aria-label={t("Canvas tools")}>
            <button className="active" title={t("Explore")}>↖</button>
            <button onClick={() => setAttention('authoring')} title={t("God Hand")}>◯</button>
            <button onClick={() => camera.restore(layer)} title={t("Return to scene")}>⌖</button>
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
                style={assetUrl(character.avatar) ? { backgroundImage: `url("${assetUrl(character.avatar)}")` } : undefined}
              >
                {!assetUrl(character.avatar) && <span>{character.id.charAt(0).toUpperCase()}</span>}
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
              <div>{currentName} · {t('{count} carried items', { count: handItems.length })}</div>
            </div>
          )}

          <div className="prototype-residents prototype-chrome" aria-label={t("Resident companions")}>
          {resident.map(companion => (
            <button
              key={companion.id}
              className="prototype-companion-orb"
              onClick={() => openCharacter(companion)}
              aria-label={t('Talk to {name}', { name: companion.name || companion.id })}
              style={assetUrl(companion.avatar) ? { backgroundImage: `url("${assetUrl(companion.avatar)}")` } : undefined}
            >
              {!assetUrl(companion.avatar) && companion.id.charAt(0).toUpperCase()}<i /><small>{companion.name || labelOf(companion.id)}</small>
            </button>
          ))}
          </div>
          <button className="prototype-action-toggle prototype-chrome" onClick={() => { if (attention === 'authoring') { setAttention('ambient'); setIsGodHandOpen(false); } else setAttention('authoring'); window.setTimeout(() => writerRef.current?.focus(), 0); }} aria-label={t("Write an action")}><Sparkles size={17} /><span aria-live="polite">{writerWorking ? `${t(writerStage)} · ${writerElapsed}s` : t('What do you do?')}</span></button>

          {writerWorking && <button type="button" className="writer-stop-control" onClick={() => { setWriterStopRequested(true); sendMessage({ type: 'writer_abort' }); }} aria-label="Stop writing">
            ■ {writerStopRequested ? 'Stop requested · retry' : 'Stop writing'} · {writerElapsed}s
          </button>}
          <form className="prototype-dock prototype-chrome" onSubmit={submitWriter}>
            <div className="prototype-docktop">
              <b>{t("✧ SPEAK TO THE WRITER")}</b>
              <span>{state?.worldFrozen ? t('The world is paused') : t('Your action moves the world forward')}</span>
              <div className="prototype-spacer" />
              <span>↵</span>
            </div>
            <div className="prototype-dockrow">
              {writerWorking && <span role="status">{t(writerStage)} · {writerElapsed}s <button type="button" onClick={() => { sendMessage({ type: 'writer_abort' }); }}>{t('Stop writing')}</button></span>}
              <input ref={writerRef} aria-label={t("Action")} placeholder={writerLocked ? t('The writer is writing…') : t("What do you do? You can also address someone by name…")} disabled={writerLocked} autoComplete="off" onKeyDown={event => {
                if (event.nativeEvent.isComposing || !['ArrowUp', 'ArrowDown'].includes(event.key) || !writerHistory.current.length) return;
                event.preventDefault(); event.stopPropagation();
                const history = writerHistory.current;
                if (writerHistoryCursor.current === history.length) writerDraft.current = event.currentTarget.value;
                writerHistoryCursor.current = Math.max(0, Math.min(history.length, writerHistoryCursor.current + (event.key === 'ArrowUp' ? -1 : 1)));
                event.currentTarget.value = writerHistoryCursor.current === history.length ? writerDraft.current : history[writerHistoryCursor.current];
                event.currentTarget.setSelectionRange(event.currentTarget.value.length, event.currentTarget.value.length);
              }} />
              <button className="prototype-primary" aria-label={t("Send action")}>↑</button>
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

      {selectedBagItem && <BagItemDialog item={selectedBagItem} onClose={() => setSelectedBagPath(null)} onPlace={handleReturnItem} />}

      {radialState && <RadialMenu {...radialState} onClose={() => setRadialState(null)} onCreate={createAt} />}

      {activeCharacter && (
        <CharacterModal
          key={activeCharacter.id}
          characterId={activeCharacter.id}
          displayName={activeCharacter.name}
          avatar={assetUrl(activeCharacter.avatar)}
          avatarVideo={assetUrl(activeCharacter.avatarVideo)}
          emotions={
            activeCharacter.emotions
              ? Object.fromEntries(
                  Object.entries(activeCharacter.emotions).map(([emo, path]) => [emo, assetUrl(path) ?? ''])
                )
              : undefined
          }
          effectsEnabled={effectsEnabled}
          bio={activeCharacter.bio || activeCharacter.description}
          incoming={activeModalFrame}
          worldId={manifest?.id}
          voice={activeCharacter.voice}
          language={manifest?.locale === 'ja' || manifest?.locale === 'en' ? manifest.locale : 'en'}
          onClose={closeCharacter}
          onOpenNook={() => { const id = activeCharacter.id; closeCharacter(); camera.save(layer); setNookChar(id); }}
          onSendMessage={(message) => sendMessage({ type: 'character_prompt', characterId: activeCharacter.id, message })}
        />
      )}

      {nookChar && <div className="prototype-nook"><NookView characterId={nookChar} locale={locale === 'ja' ? 'ja' : 'en'} onClose={() => { setNookChar(null); camera.restore(layer); void refresh(); }} onMoveCard={moveCard} onSelectChoice={(path, choice) => { void airpGateway.choose(path, choice).catch(error => notify(String(error))); }} onTakeItem={path => { void handleTakeItem(path); }} onRequestInit={(kind, target, request) => sendMessage({ type: 'airp_init', kind, target, ...(request ? { request } : {}), by: 'player' })} /></div>}

      {/* Dice ceremony overlay (screen-fixed layer, same visual language as the player path) */}
      {ceremony && (
        <DiceCeremony key={ceremony.key} verdict={ceremony.verdict} onDone={clearCeremony} />
      )}

      {toast && <div className="prototype-toast" role="status">{toast}</div>}
    </div>
  );
}
