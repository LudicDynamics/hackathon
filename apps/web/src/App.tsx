import React, { useState, useEffect, useCallback } from 'react';
import { Compass, Clock, Layers, ArrowLeft } from 'lucide-react';
import { Canvas } from './components/canvas/Canvas.js';
import { RightSidebar } from './components/sidebar/RightSidebar.js';
import { CharacterModal } from './components/overlay/CharacterModal.js';
import { GodModeToolbar } from './components/god/GodModeToolbar.js';
import { MuteButton } from './components/chrome/MuteButton.js';
import { Minimap } from './components/chrome/Minimap.js';
import { WriterBar } from './components/chrome/WriterBar.js';
import { HintBar } from './components/chrome/HintBar.js';
import { LayerBadge } from './components/chrome/LayerBadge.js';
import { RadialMenu, RadialItemType } from './components/god/RadialMenu.js';
import { useAudio } from './state/useAudio.js';
import { useCamera } from './state/useCamera.js';
import { useWorld } from './state/useWorld.js';
import { preloadAudio } from './lib/audio.js';
import { UI_COPY, type Locale } from './lib/i18n.js';
import { useViewpointReport } from './hooks/useViewpointReport.js';

interface WorldManifest {
  id: string;
  name: string;
  genre: string;
  material: string;
  layers: Record<string, any>;
  characters: any[];
  audio?: { theme: string | null };
  entry: string;
  locale?: Locale;
  player?: { id?: string; name?: string; avatar?: string };
}

export function App() {
  const [manifest, setManifest] = useState<WorldManifest | null>(null);
  const [backpackItems, setBackpackItems] = useState<any[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [followingCharacters, setFollowingCharacters] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>(() =>
    navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en'
  );
  const [worldTemplates, setWorldTemplates] = useState<string[]>([]);
  const [activeTemplate, setActiveTemplate] = useState('whitechapel');
  const copy = UI_COPY[locale];

  // Active Character Modal (Galgame Overlay)
  const [activeModalCharId, setActiveModalCharId] = useState<string | null>(null);

  // World Studio Creator Radial Menu
  const [radialState, setRadialState] = useState<{
    x: number;
    y: number;
    worldX: number;
    worldY: number;
  } | null>(null);
  const camera = useCamera();
  const { setAmbient, setBGM, setTheme } = useAudio();

  // Canvas world state (layer payload, WS events, card persistence).
  const world = useWorld();
  const { state: worldState, layer: currentLayer, enterLayer, refresh, moveCard, sendToWriter, sendMessage } = world;
  const worldFrozen = worldState?.worldFrozen === true;

  // Player viewpoint report (05 §5). Mounted ONCE at the top: `useCamera()` is
  // a module-level shared camera, while `layer` / `backpackItems` live here, so
  // Canvas (which owns the viewport div) is the wrong place for this.
  //
  // `?eye=1` is the agent's own view page: reporting from it would overwrite the
  // player's viewpoint with where the AGENT is looking — a symptom far from its
  // cause, hence this comment (05 §5.4). There is no eye-mode consumer yet, so
  // the flag is a frozen contract kept ready for the eye-mode batch.
  // TODO(eye-mode): stamp `data-eye-ready` in this same spot when that batch lands.
  const isEyeMode = new URLSearchParams(location.search).get('eye') === '1';
  useViewpointReport({
    camera,
    layer: currentLayer,
    bagCount: backpackItems.length,
    enabled: !isEyeMode,
  });

  // Audio beds follow server-resolved URLs from /api/layer (00 §4.2). `tone` is a
  // material CSS hook only — it is NOT an audio selector anymore.
  //
  // `worldState.audio` is REQUIRED (00 §5.4): "url" → play, null → declared silence.
  // No fallback default (00 §5.4 #3): silence is a declaration, never replaced.
  const themeUrl = manifest?.audio?.theme ?? null;
  useEffect(() => {
    if (!worldState) return; // first-frame window: leave every main track untouched
    const audio = worldState.audio;
    setAmbient(audio.ambient ?? null);
    setBGM(audio.bgm ?? null);
    const urls = [audio.ambient, audio.bgm, themeUrl].filter(
      (u): u is string => typeof u === 'string' && u.length > 0
    );
    if (urls.length > 0) void preloadAudio(urls);
  }, [worldState?.audio?.ambient, worldState?.audio?.bgm, themeUrl]);

  // World theme: set on world load, persists across layers (00 §5.3).
  useEffect(() => {
    setTheme(themeUrl);
  }, [themeUrl]);

  // Camera memory around the modal mask (P0: save before opening, restore after).
  //
  // The two WS frames below are the B3 front-end senders (docs/hooks/06 §4.5,
  // frame semantics frozen by docs/hooks/03 §4.3). Without them the character
  // cursor never advances and neither the first-open injection nor the cold-start
  // window can run. Server side (owned by the events lane):
  //   - `character_start`: records the open-time high-water `getMaxSeq()` and
  //     spawns the character process. It must NOT advance the cursor — advancing
  //     on open would permanently swallow everything a crash or a misclick skips.
  //     `worldPath` is omitted on purpose: the server falls back to the active
  //     store's root (`apps/server/src/index.ts:121-125`), which is authoritative;
  //     the client only knows the template name, so sending one would risk
  //     pointing the agent at the wrong world.
  //   - `character_stop`: settles the character cursor at the open-time
  //     high-water, then stops the process. `turns` is omitted too — no front-end
  //     counter exists, and the server marks the count as estimated rather than
  //     passing a guess off as measured (M-8).
  const openCharacterModal = (charId: string) => {
    camera.save('modal');
    sendMessage({ type: 'character_start', characterId: charId });
    setActiveModalCharId(charId);
  };
  const closeCharacterModal = () => {
    if (activeModalCharId) {
      sendMessage({ type: 'character_stop', characterId: activeModalCharId });
    }
    setActiveModalCharId(null);
    camera.restore('modal');
  };

  // Toast helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Initial Data Fetch (layer itself is fetched by useWorld)
  useEffect(() => {
    fetchManifest();
    fetchWorlds();
    fetchBackpack();
    fetchCharacters();
  }, []);

  // World events (WS lives in useWorld) can add/move backpack files.
  useEffect(() => {
    const onWorldEvent = () => fetchBackpack();
    window.addEventListener('airp:world-event', onWorldEvent);
    return () => window.removeEventListener('airp:world-event', onWorldEvent);
  }, []);

  const fetchManifest = async () => {
    try {
      const res = await fetch('/api/manifest');
      if (res.ok) {
        const data = await res.json();
        setManifest(data);
        if (data.locale === 'en' || data.locale === 'ja') setLocale(data.locale);
        if (typeof data.entry === 'string' && data.entry !== '') enterLayer(data.entry);
      }
    } catch (err) {
      console.warn('Could not fetch manifest:', err);
    }
  };

  const fetchWorlds = async () => {
    try {
      const res = await fetch('/api/worlds');
      if (!res.ok) return;
      const data = await res.json();
      const playable = new Set(['whitechapel', 'firstsnow']);
      setWorldTemplates(
        Array.isArray(data.templates) ? data.templates.filter((name: string) => playable.has(name)) : []
      );
    } catch (err) {
      console.warn('Could not fetch worlds:', err);
    }
  };

  const handleWorldChange = async (template: string) => {
    try {
      const res = await fetch('/api/worlds/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worldPath: `templates/${template}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load world');
      setActiveTemplate(template);
      if (data.manifest?.locale === 'en' || data.manifest?.locale === 'ja') {
        setLocale(data.manifest.locale);
      }
      enterLayer(data.manifest?.entry || 'map');
      await Promise.all([fetchManifest(), fetchBackpack(), fetchCharacters()]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    }
  };

  const fetchBackpack = async () => {
    try {
      const res = await fetch('/api/backpack');
      if (res.ok) {
        const data = await res.json();
        setBackpackItems(data.items || []);
      }
    } catch (err) {
      console.warn('Could not fetch backpack:', err);
    }
  };

  const fetchCharacters = async () => {
    try {
      const res = await fetch('/api/characters');
      if (res.ok) {
        const data = await res.json();
        setCharacters(data.characters || []);
      }
    } catch (err) {
      console.warn('Could not fetch characters:', err);
    }
  };

  // Switch Layer / Gate
  const handleEnterGate = async (target: string) => {
    try {
      const res = await fetch('/api/enter-layer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layer: target }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'This scene is still locked.');
        return;
      }
      enterLayer(target);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    }
  };

  // Back one level: follow the DERIVED parent (manifest layer graph), never
  // string surgery on the id. Slicing `world/crime-scene` to `world` landed on
  // a non-existent pseudo-layer whose page held no children — the map's doors
  // vanished, leaving only the world README. `map` is the root (parent null).
  const handleReturnToParent = useCallback(() => {
    if (currentLayer === (manifest?.entry || 'map')) return;
    const parent = manifest?.layers?.[currentLayer]?.parent;
    enterLayer(typeof parent === 'string' && parent ? parent : 'map');
  }, [currentLayer, manifest, enterLayer]);

  // Esc / Alt+← return to the parent layer (the hint bar promises both).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (e.altKey && e.key === 'ArrowLeft')) {
        handleReturnToParent();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleReturnToParent]);

  // Choice Selection
  const handleSelectChoice = async (choicePath: string, choice: string) => {
    showToast(`You chose: "${choice}"`);
    const res = await fetch('/api/choice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: choicePath, choice }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || 'The choice could not be recorded.');
      return;
    }
    sendToWriter(
      `The player, in scene "${currentLayer}", chose "${choice}" on ${choicePath}. Continue from that concrete action and materialise any resulting change in the world files.`
    );
  };

  const handleTakeItem = async (itemPath: string) => {
    const filename = itemPath.split('/').pop();
    if (!filename) return;
    try {
      const res = await fetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: itemPath, to: `player/${filename}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not take item');
      showToast(`${copy.taken}: ${filename.replace('.md', '')}`);
      await Promise.all([refresh(), fetchBackpack()]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    }
  };

  // Point-and-Click item drop puzzle: use_item_on
  const handleItemDropOnTarget = async (draggedItemPath: string, targetPath: string) => {
    const itemName = draggedItemPath.split('/').pop()?.replace('.md', '') || 'item';
    const targetName = targetPath.split('/').pop()?.replace('.md', '') || 'target';
    try {
      const res = await fetch('/api/use-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: draggedItemPath,
          target: targetPath,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`✨ Interaction: Used [${itemName}] on [${targetName}]`);
        refresh();
      }
    } catch (err) {
      console.error('Use item failed:', err);
    }
  };

  // Drop item to scene from backpack
  const handleDropItemToScene = async (itemPath: string) => {
    const filename = itemPath.split('/').pop();
    const dest = currentLayer === 'map' ? `world/${filename}` : `${currentLayer}/${filename}`;
    try {
      await fetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: itemPath, to: dest }),
      });
      showToast(`Returned "${filename}" to the scene`);
      refresh();
      fetchBackpack();
    } catch (err) {
      console.error('Move item failed:', err);
    }
  };

  // God Mode Toggle Freeze (flag flips via the world_frozen/thawed broadcast)
  const handleToggleFreeze = async () => {
    try {
      await fetch('/api/freeze', { method: 'POST' });
    } catch (err) {
      console.error('Toggle freeze failed:', err);
    }
  };

  // World Studio Radial Creator — instantiate at exact clicked world coordinate
  const handleCreateEntityAt = async (
    type: RadialItemType,
    title: string,
    content: string,
    wx: number,
    wy: number
  ) => {
    const cleanSlug =
      title
        .toLowerCase()
        .trim()
        .replace(/[\s\t\r\n]+/g, '-')
        .replace(/[/\\?%*:|"<>]/g, '')
        .slice(0, 32) || `creation-${Date.now().toString(36)}`;

    const parentDir = currentLayer === 'map' ? 'world' : currentLayer;
    let filePath = '';
    let fileContent = '';

    if (type === 'gate') {
      filePath = `${parentDir}/${cleanSlug}/README.md`;
      fileContent = `---\ntype: gate\ntitle: "${title}"\n---\n${content}`;
    } else if (type === 'character') {
      filePath = `${parentDir}/${cleanSlug}.md`;
      fileContent = `---\ntype: sprite\ntitle: "${title}"\n---\n${content}`;
    } else if (type === 'chalk') {
      filePath = `${parentDir}/chalk-${cleanSlug}.md`;
      fileContent = `---\ntype: chalk\n---\n${content}`;
    } else {
      filePath = `${parentDir}/${cleanSlug}.md`;
      fileContent = `---\ntitle: "${title}"\n---\n${content}`;
    }

    try {
      const res = await fetch('/api/god-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          path: filePath,
          content: fileContent,
        }),
      });
      if (res.ok) {
        // Persist clicked position immediately so card forms right where right-clicked
        await fetch('/api/card/position', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: filePath,
            x: wx,
            y: wy,
          }),
        });
        showToast(`✨ World Studio: "${title}" formed on canvas!`);
        refresh();
      }
    } catch (err) {
      console.error('World studio creation failed:', err);
    }
  };

  const activeChar = characters.find((c) => c.id === activeModalCharId);

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-paper-bg text-ink">
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-2.5 rounded-full bg-ink text-white font-sans text-xs font-semibold shadow-deep border border-white/20">
          {toastMessage}
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="h-16 px-6 bg-paper-card/90 border-b border-ink/10 shadow-sm backdrop-blur-md flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {manifest?.player?.avatar && (
              <img
                src={manifest.player.avatar}
                alt={manifest.player.name || 'Player'}
                className="w-9 h-9 rounded-full object-cover border border-rust/30 shadow-sm"
              />
            )}
            <Compass className="w-5 h-5 text-rust" />
            <h1 className="font-serif text-lg font-bold tracking-wide text-ink">
              {manifest?.name || 'AIRP · Infinite Canvas World'}
            </h1>
          </div>

          <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-paper-wall text-ink/70">
            {manifest?.genre || 'narrative'}
          </span>

          <label className="flex items-center gap-1.5 font-mono text-[10px] text-ink/50">
            <span>{copy.world}</span>
            <select
              value={activeTemplate}
              onChange={(e) => void handleWorldChange(e.target.value)}
              className="bg-paper-wall border border-ink/10 rounded-lg px-2 py-1 text-ink"
            >
              {worldTemplates.map((template) => (
                <option key={template} value={template}>{template}</option>
              ))}
            </select>
          </label>

          {/* Layer Breadcrumb Navigation */}
          <div className="flex items-center gap-2 pl-4 border-l border-ink/10">
            {currentLayer !== (manifest?.entry || 'map') && (
              <button
                onClick={handleReturnToParent}
                className="p-1 rounded-lg bg-paper-wall hover:bg-ink hover:text-white transition-all text-xs"
                title={copy.back}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="flex items-center gap-1 text-xs font-mono text-ink/60">
              <Layers className="w-3.5 h-3.5 text-sage" />
              <span className="font-semibold text-ink">{currentLayer}</span>
            </div>
          </div>
        </div>

        {/* Center Minimalist World Timestamp Seal */}
        <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-paper-wall/60 border border-ink/5 font-mono text-xs text-ink/70">
          <Clock className="w-3.5 h-3.5 text-rust" />
          <span>{copy.timestamp}</span>
        </div>

        {/* Right God Mode + Mute */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLocale((value) => (value === 'en' ? 'ja' : 'en'))}
            className="px-3 py-1.5 rounded-full bg-paper-wall border border-ink/10 text-xs font-mono hover:bg-ink hover:text-white transition-colors"
          >
            {copy.language}
          </button>
          <MuteButton muteLabel={copy.mute} unmuteLabel={copy.unmute} />
          <GodModeToolbar
            frozen={worldFrozen}
            onToggleFreeze={handleToggleFreeze}
            labels={{
              active: copy.godHand,
              frozen: copy.worldFrozen,
              pauseTitle: copy.pauseWorld,
              thawTitle: copy.thawWorld,
            }}
          />
        </div>
      </header>

      {/* Main Workspace Area: Infinite Canvas + Right Sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 h-full relative">
          <Canvas
            currentLayer={currentLayer}
            items={worldState?.items ?? []}
            links={worldState?.links ?? []}
            bg={worldState?.bg ?? { src: null, tone: 'warm', grain: 'parchment' }}
            scene={worldState?.scene ?? null}
            sceneCopy={{
              label: copy.sceneChalk,
              collapse: copy.collapseScene,
              expand: copy.expandScene,
            }}
            onMoveCard={moveCard}
            onSelectChoice={handleSelectChoice}
            onDiceRolled={(res, pass) => showToast(`Dice: ${res} (${pass ? 'Pass' : 'Fail'})`)}
            onEnterGate={handleEnterGate}
            onOpenCharacterModal={openCharacterModal}
            onItemDropOnTarget={handleItemDropOnTarget}
            onDropItemToScene={handleDropItemToScene}
            onTakeItem={handleTakeItem}
            onOpenRadialMenu={(x, y, wx, wy) => setRadialState({ x, y, worldX: wx, worldY: wy })}
          />

          {/* Canvas chrome — the prototype's navigation + writing affordances */}
          <LayerBadge
            name={manifest?.layers?.[currentLayer]?.name || currentLayer}
            material={worldState?.bg?.grain ?? 'parchment'}
            materialLabel={copy.material}
          />
          <HintBar text={copy.controls} showLabel={copy.showControls} hideLabel={copy.hideControls} />
          <WriterBar
            disabled={worldFrozen}
            placeholder={copy.writerPlaceholder}
            sendLabel={locale === 'ja' ? '送信' : 'Send'}
            onSend={(text) => {
              sendToWriter(text);
              showToast(copy.sentToWriter);
            }}
          />
          <Minimap items={worldState?.items ?? []} camera={camera} label={copy.minimap} />
        </div>


        {/* Right Sidebar (Backpack & Characters) */}
        <RightSidebar
          backpackItems={backpackItems}
          characters={characters}
          followingCharacters={followingCharacters}
          copy={copy}
          onNavigateToCharacter={(home) => void handleEnterGate(home)}
          onChatWithCharacter={openCharacterModal}
          onToggleFollow={(charId) => {
            setFollowingCharacters((prev) => ({
              ...prev,
              [charId]: !prev[charId],
            }));
            showToast(`${charId} follow status toggled`);
          }}
        />
      </div>

      {/* Galgame Split-Screen Character Dialogue Overlay Modal */}
      {activeModalCharId && activeChar && (
        <CharacterModal
          characterId={activeChar.id}
          avatar={activeChar.avatar}
          bio={activeChar.bio}
          locale={locale}
          onClose={closeCharacterModal}
          onSendMessage={(msg) => {
            sendMessage({
              type: 'character_prompt',
              characterId: activeChar.id,
              message: msg,
            });
          }}
        />
      )}

      {/* World Studio Radial Creation Menu */}
      {radialState && (
        <RadialMenu
          x={radialState.x}
          y={radialState.y}
          worldX={radialState.worldX}
          worldY={radialState.worldY}
          onClose={() => setRadialState(null)}
          onCreate={handleCreateEntityAt}
        />
      )}
    </div>
  );
}
