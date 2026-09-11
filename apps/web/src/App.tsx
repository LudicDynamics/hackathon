import React, { useState, useEffect, useRef } from 'react';
import { Compass, Sparkles, Clock, Layers, ArrowLeft } from 'lucide-react';
import { Canvas } from './components/canvas/Canvas.js';
import { RightSidebar } from './components/sidebar/RightSidebar.js';
import { CharacterModal } from './components/overlay/CharacterModal.js';
import { GodModeToolbar } from './components/god/GodModeToolbar.js';

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
  const [currentLayer, setCurrentLayer] = useState<string>('map');
  const [items, setItems] = useState<any[]>([]);
  const [backpackItems, setBackpackItems] = useState<any[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [followingCharacters, setFollowingCharacters] = useState<Record<string, boolean>>({});
  const [worldFrozen, setWorldFrozen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active Character Modal (Galgame Overlay)
  const [activeModalCharId, setActiveModalCharId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  // Toast helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Connect WebSocket
  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'file_changed' || msg.type === 'item_moved' || msg.type === 'god_action') {
          fetchLayer(currentLayer);
          fetchBackpack();
        } else if (msg.type === 'world_frozen') {
          setWorldFrozen(true);
          showToast('世界已冻结 —— 你改动的一切不会惊动任何人');
        } else if (msg.type === 'world_thawed') {
          setWorldFrozen(false);
          showToast('世界已解冻 —— 时间继续流淌');
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    return () => ws.close();
  }, [currentLayer]);

  // Initial Data Fetch
  useEffect(() => {
    fetchManifest();
    fetchBackpack();
    fetchCharacters();
  }, []);

  useEffect(() => {
    fetchLayer(currentLayer);
  }, [currentLayer]);

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

  const fetchLayer = async (layer: string) => {
    try {
      const res = await fetch(`/api/layer?layer=${encodeURIComponent(layer)}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        if (data.worldFrozen !== undefined) setWorldFrozen(data.worldFrozen);
      }
    } catch (err) {
      console.warn('Could not fetch layer:', err);
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
    setCurrentLayer(target);
  };

  const handleReturnToParent = () => {
    if (currentLayer === 'map') return;
    const parts = currentLayer.split('/');
    if (parts.length <= 1) {
      setCurrentLayer('map');
    } else {
      parts.pop();
      setCurrentLayer(parts.join('/'));
    }
  };

  // Choice Selection
  const handleSelectChoice = async (choice: string) => {
    showToast(`你选择了：「${choice}」`);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'writer_prompt',
          message: `玩家在场景「${currentLayer}」中选择了推进选项：「${choice}」。`,
        })
      );
    }
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
        showToast(`你对目标出示/使用了「${draggedItemPath.split('/').pop()}」！`);
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
      showToast(`已将「${filename}」放回场景`);
      fetchLayer(currentLayer);
      fetchBackpack();
    } catch (err) {
      console.error('Move item failed:', err);
    }
  };

  // God Mode Toggle Freeze
  const handleToggleFreeze = async () => {
    try {
      const res = await fetch('/api/freeze', { method: 'POST' });
      const data = await res.json();
      setWorldFrozen(data.worldFrozen);
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
      showToast(`上帝之手已创造：「${title}」`);
      fetchLayer(currentLayer);
    } catch (err) {
      console.error('God action create failed:', err);
    }
  };

  const activeChar = characters.find((c) => c.id === activeModalCharId);

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-paper-bg text-ink">
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-2.5 rounded-full bg-ink text-white font-sans text-xs font-semibold shadow-deep border border-white/20 animate-in slide-in-from-top-4 duration-300">
          {toastMessage}
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="h-16 px-6 bg-paper-card/90 border-b border-ink/10 shadow-sm backdrop-blur-md flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-rust" />
            <h1 className="font-serif text-lg font-bold tracking-wide text-ink">
              {manifest?.name || 'AIRP · 无限画布世界'}
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
                title="返回上一层"
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
          <span>第 1 天 · 暴雨初歇 17:40</span>
        </div>

        {/* Right God Mode Controls */}
        <div className="flex items-center gap-3">
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
            items={items}
            characters={characters}
            onSelectChoice={handleSelectChoice}
            onDiceRolled={(res, pass) => showToast(`掷骰结果：${res}（${pass ? '通过' : '未通过'}）`)}
            onEnterGate={handleEnterGate}
            onOpenCharacterModal={(charId) => setActiveModalCharId(charId)}
            onItemDropOnTarget={handleItemDropOnTarget}
            onDropItemToScene={handleDropItemToScene}
          />
        </div>

        {/* Right Sidebar (Backpack & Characters) */}
        <RightSidebar
          backpackItems={backpackItems}
          characters={characters}
          followingCharacters={followingCharacters}
          onNavigateToCharacter={(home) => setCurrentLayer(home)}
          onChatWithCharacter={(charId) => setActiveModalCharId(charId)}
          onToggleFollow={(charId) => {
            setFollowingCharacters((prev) => ({
              ...prev,
              [charId]: !prev[charId],
            }));
            showToast(`${charId} 随行状态已切换`);
          }}
        />
      </div>

      {/* Galgame Split-Screen Character Dialogue Overlay Modal */}
      {activeModalCharId && activeChar && (
        <CharacterModal
          characterId={activeChar.id}
          avatar={activeChar.avatar}
          bio={activeChar.bio}
          onClose={() => setActiveModalCharId(null)}
          onSendMessage={(msg) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({
                  type: 'character_prompt',
                  characterId: activeChar.id,
                  message: msg,
                })
              );
            }
          }}
        />
      )}
    </div>
  );
}
