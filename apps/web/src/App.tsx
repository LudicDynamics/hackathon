import { useLocale } from './lib/i18n.js';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from './components/canvas/Canvas.js';
import { CharacterModal } from './components/overlay/CharacterModal.js';
import { GodModeToolbar } from './components/god/GodModeToolbar.js';
import { RadialMenu, type RadialItemType } from './components/god/RadialMenu.js';
import { MuteButton } from './components/chrome/MuteButton.js';
import { useAudio } from './state/useAudio.js';
import { useCamera } from './state/useCamera.js';
import { useWorld } from './state/useWorld.js';
import { airpGateway, type WorldShelf } from './lib/airp-gateway.js';
import { WorldShelf as WorldShelfDialog } from './components/WorldShelf.js';
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
  id: string;
  name?: string;
  home?: string;
  role?: string;
  avatar?: string;
  bio?: string;
  description?: string;
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
  const [shell, setShell] = useState(initialShell);
  const [encounters, setEncounters] = useState<Record<string, string[]>>({});
  const [bagOpen, setBagOpen] = useState(false);
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
  const [toast, setToast] = useState<string | null>(null);
  const [loadingWorld, setLoadingWorld] = useState<string | null>(null);
  const [backdropReady, setBackdropReady] = useState(false);
  const writerRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | null>(null);

  const camera = useCamera();
  const { setAmbient, setBGM, setTheme } = useAudio();

  // Canvas world state (layer payload, WS events, card persistence).
  const world = useWorld();
  const { state, layer, enterLayer, refresh, moveCard, sendToWriter, sendMessage } = world;
  const chromeVisible = !shell.immersive;
  const isDusk = backdropReady;

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
    const onNotice = (event: Event) => notify(String((event as CustomEvent).detail));
    window.addEventListener('airp:notice', onNotice);
    return () => window.removeEventListener('airp:notice', onNotice);
  }, []);

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
        setWorldPickerOpen(false);
        setProfileOpen(false);
        setBagOpen(false);
        setAttention('ambient');
        setShell(initialShell);
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
  }, [activeCharacter]);

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
  const canvasItems = (state?.items || []).filter((item) => item.path !== readme?.path);
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
    try {
      const result = await airpGateway.loadWorld<WorldManifest>(worldPath);
      setManifest(result.manifest);
      await enterLayer('map');
      await loadChromeData();
      setWorldPickerOpen(false);
      setAttention('ambient');
      setShell(initialShell);
      setProfileOpen(false);
      setBagOpen(false);
      notify(`Entered ${result.manifest.name}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not load that world');
    } finally {
      setLoadingWorld(null);
    }
  };

  const submitWriter = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = writerRef.current;
    const text = input?.value.trim() || '';
    if (!text) return;
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
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The item could not be placed');
    }
  };

  const handleToggleFreeze = async () => {
    try {
      await airpGateway.toggleFreeze();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not change world time');
    }
  };

  const openCharacter = (character: CharacterView) => {
    const worldId = manifest?.id || '';
    setEncounters(current => ({ ...current, [worldId]: [...new Set([...(current[worldId] || []), character.id])] }));
    camera.save('dialogue');
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
            openingComposition={manifest?.locale === 'ja' || ['wuwu', 'whitechapel', 'divergence', 'firstsnow', 'unwritten-door'].some(id => manifest?.id === id || manifest?.id?.startsWith(`${id}-`))}
            effectsEnabled={effectsEnabled}
            currentLayer={layer}
            items={canvasItems}
            links={state?.links || []}
            bg={(!loadingWorld && state?.bg) || { src: null, tone: 'warm', grain: 'parchment' }}
            onMoveCard={moveCard}
            onSelectChoice={(choice) => {
              sendToWriter(`The player chose: "${choice}"`);
              notify(`Choice sent: ${choice}`);
            }}
            onDiceRolled={(result, passed) => notify(`Roll ${result} · ${passed ? 'passed' : 'failed'}`)}
            onEnterGate={enterLayer}
            onOpenCharacterModal={(id) => {
              const character = characters.find((item) => item.id === id);
              if (character) openCharacter(character);
            }}
            onItemDropOnTarget={handleItemDrop}
            onDropItemToScene={handleReturnItem}
            onOpenRadialMenu={(x, y, worldX, worldY) => { if (attention === 'authoring') setRadialState({ x, y, worldX, worldY }); }}
          />

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
            {bagOpen && <div className="prototype-bag-content"><span className="prototype-eyebrow">{t("BELONGINGS")}</span>{handItems.length === 0 && <p>{t("Nothing carried yet.")}</p>}{handItems.map((item) => {
              const image = assetUrl(item.frontmatter?.image || item.frontmatter?.cover);
              return (
                <button
                  key={item.path}
                  className="prototype-hand-chip"
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData('text/plain', item.path)}
                  title={item.body}
                  style={image ? { backgroundImage: `url("${image}")` } : undefined}
                >
                  <span>{item.frontmatter?.icon || '◇'}</span>
                  <small>{item.frontmatter?.title || labelOf(item.filename.replace(/\.md$/, ''))}</small>
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
          <button className="prototype-action-toggle prototype-chrome" onClick={() => { setAttention(current => current === 'authoring' ? 'ambient' : 'authoring'); window.setTimeout(() => writerRef.current?.focus(), 0); }} aria-label={t("Write an action")}><Sparkles size={17} /><span>{t("What do you do?")}</span></button>

          <form className="prototype-dock prototype-chrome" onSubmit={submitWriter}>
            <div className="prototype-docktop">
              <b>{t("✧ SPEAK TO THE WRITER")}</b>
              <span>{state?.worldFrozen ? t('The world is paused') : t('Your action moves the world forward')}</span>
              <div className="prototype-spacer" />
              <span>↵</span>
            </div>
            <div className="prototype-dockrow">
              <input ref={writerRef} aria-label={t("Action")} placeholder={t("What do you do? You can also address someone by name…")} autoComplete="off" />
              <button className="prototype-primary" aria-label={t("Send action")}>↑</button>
            </div>
          </form>

          {attention === 'authoring' && (
            <div className="prototype-authoring">
              <GodModeToolbar frozen={state?.worldFrozen === true} onToggleFreeze={handleToggleFreeze} />
              <button className="prototype-quiet" onClick={() => setAttention('ambient')}>{t("Close")}</button>
            </div>
          )}

        </section>
      </main>

      {worldPickerOpen && (
        <WorldShelfDialog shelf={shelf} loading={loadingWorld} onLoad={path => void loadWorld(path)} onClose={() => setWorldPickerOpen(false)} onRefresh={async () => { setShelf(await airpGateway.worlds()); }} />
      )}

      {radialState && <RadialMenu {...radialState} onClose={() => setRadialState(null)} onCreate={createAt} />}

      {activeCharacter && (
        <CharacterModal
          characterId={activeCharacter.id}
          displayName={activeCharacter.name}
          avatar={assetUrl(activeCharacter.avatar)}
          bio={activeCharacter.bio || activeCharacter.description}
          onClose={closeCharacter}
          onSendMessage={(message) => sendMessage({ type: 'character_prompt', characterId: activeCharacter.id, message })}
        />
      )}

      {toast && <div className="prototype-toast" role="status">{toast}</div>}
    </div>
  );
}
