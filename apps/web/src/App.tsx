import React, { useState, useEffect } from 'react';
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
import { useAudio } from './state/useAudio.js';
import { useCamera } from './state/useCamera.js';
import { useWorld } from './state/useWorld.js';

interface WorldManifest {
  id: string;
  name: string;
  genre: string;
  material: string;
  layers: Record<string, any>;
  characters: any[];
}

export function App() {
  const [manifest, setManifest] = useState<WorldManifest | null>(null);
  const [backpackItems, setBackpackItems] = useState<any[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [followingCharacters, setFollowingCharacters] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active Character Modal (Galgame Overlay)
  const [activeModalCharId, setActiveModalCharId] = useState<string | null>(null);
  const camera = useCamera();
  const { setAmbient } = useAudio();

  // Canvas world state (layer payload, WS events, card persistence).
  const world = useWorld();
  const { state: worldState, layer: currentLayer, enterLayer, refresh, moveCard, sendToWriter, sendMessage } = world;
  const worldFrozen = worldState?.worldFrozen === true;

  // Ambient bed follows the layer's material tone (T2.1): warm → fireplace, else rain.
  useEffect(() => {
    setAmbient(worldState?.bg?.tone || 'rain');
  }, [currentLayer]);

  // Camera memory around the modal mask (P0: save before opening, restore after).
  const openCharacterModal = (charId: string) => {
    camera.save('modal');
    setActiveModalCharId(charId);
  };
  const closeCharacterModal = () => {
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
      }
    } catch (err) {
      console.warn('Could not fetch manifest:', err);
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
  const handleEnterGate = (target: string) => {
    enterLayer(target);
  };

  const handleReturnToParent = () => {
    if (currentLayer === 'map') return;
    const parts = currentLayer.split('/');
    if (parts.length <= 1) {
      enterLayer('map');
    } else {
      parts.pop();
      enterLayer(parts.join('/'));
    }
  };

  // Choice Selection
  const handleSelectChoice = async (choice: string) => {
    showToast(`You chose: "${choice}"`);
    sendToWriter(
      `The player, in scene "${currentLayer}", chose the advancing option: "${choice}".`
    );
  };

  // Point-and-Click item drop puzzle: use_item_on
  const handleItemDropOnTarget = async (draggedItemPath: string, targetPath: string) => {
    try {
      const res = await fetch('/api/use-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemPath: draggedItemPath,
          targetPath,
          targetType: 'card',
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`You present "${draggedItemPath.split('/').pop()}" to the target!`);
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

  // God Mode Create Entity
  const handleCreateEntity = async (type: 'note' | 'chalk', title: string, content: string) => {
    const filename = `${title}.md`;
    const filePath = currentLayer === 'map' ? `world/${filename}` : `${currentLayer}/${filename}`;
    const fileContent =
      type === 'chalk'
        ? `---\ntype: chalk\n---\n${content}`
        : `<b>${title}</b>\n${content}`;

    try {
      await fetch('/api/god-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          filePath,
          content: fileContent,
        }),
      });
      showToast(`The God Hand has created "${title}"`);
      refresh();
    } catch (err) {
      console.error('God action create failed:', err);
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
            <Compass className="w-5 h-5 text-rust" />
            <h1 className="font-serif text-lg font-bold tracking-wide text-ink">
              {manifest?.name || 'AIRP · Infinite Canvas World'}
            </h1>
          </div>

          <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-paper-wall text-ink/70">
            {manifest?.genre || 'narrative'}
          </span>

          {/* Layer Breadcrumb Navigation */}
          <div className="flex items-center gap-2 pl-4 border-l border-ink/10">
            {currentLayer !== 'map' && (
              <button
                onClick={handleReturnToParent}
                className="p-1 rounded-lg bg-paper-wall hover:bg-ink hover:text-white transition-all text-xs"
                title="Back one layer"
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
          <span>Day 1 · Rain Subsides 17:40</span>
        </div>

        {/* Right God Mode + Mute */}
        <div className="flex items-center gap-3">
          <MuteButton />
          <GodModeToolbar
            frozen={worldFrozen}
            onToggleFreeze={handleToggleFreeze}
            onCreateEntity={handleCreateEntity}
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
            characters={characters}
            onMoveCard={moveCard}
            onSelectChoice={handleSelectChoice}
            onDiceRolled={(res, pass) => showToast(`Dice: ${res} (${pass ? 'Pass' : 'Fail'})`)}
            onEnterGate={handleEnterGate}
            onOpenCharacterModal={openCharacterModal}
            onItemDropOnTarget={handleItemDropOnTarget}
            onDropItemToScene={handleDropItemToScene}
          />

          {/* Canvas chrome — the prototype's navigation + writing affordances */}
          <LayerBadge
            name={manifest?.layers?.[currentLayer]?.name || currentLayer}
            material={worldState?.bg?.grain ?? 'parchment'}
          />
          <HintBar />
          <WriterBar
            disabled={worldFrozen}
            onSend={(text) => {
              sendToWriter(text);
              showToast('Sent to the writer');
            }}
          />
          <Minimap
            items={worldState?.items ?? []}
            cam={camera.cam}
            viewport={camera.getViewport()}
            onJump={(x, y) => camera.flyTo(x, y)}
          />
        </div>

        {/* Right Sidebar (Backpack & Characters) */}
        <RightSidebar
          backpackItems={backpackItems}
          characters={characters}
          followingCharacters={followingCharacters}
          onNavigateToCharacter={(home) => enterLayer(home)}
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
    </div>
  );
}
