import React, { useState } from 'react';
import { Backpack, Users, Navigation, MessageCircle, UserCheck, GripVertical, DoorOpen } from 'lucide-react';
import { MarkdownText } from '../../lib/md.js';
import type { UiCopy } from '../../lib/i18n.js';

interface RightSidebarProps {
  backpackItems: Array<{
    path: string;
    filename: string;
    frontmatter: Record<string, any> | null;
    body: string;
  }>;
  characters: Array<{
    id: string;
    home?: string;
    role?: string;
    avatar?: string;
    bio?: string;
  }>;
  onNavigateToCharacter?: (homeLayer: string) => void;
  onChatWithCharacter?: (charId: string) => void;
  onOpenNook?: (charId: string) => void;
  onToggleFollow?: (charId: string) => void;
  followingCharacters?: Record<string, boolean>;
  copy: UiCopy;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  backpackItems,
  characters,
  onNavigateToCharacter,
  onChatWithCharacter,
  onOpenNook,
  onToggleFollow,
  followingCharacters = {},
  copy,
}) => {
  const [activeTab, setActiveTab] = useState<'backpack' | 'characters'>('backpack');

  return (
    <div className="w-80 h-full bg-paper-card/95 border-l border-ink/10 shadow-soft backdrop-blur-md flex flex-col z-30 select-none">
      {/* Tab Switcher */}
      <div className="flex border-b border-ink/10 p-2 gap-2 bg-paper-wall/40">
        <button
          onClick={() => setActiveTab('backpack')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-semibold tracking-wider transition-all ${
            activeTab === 'backpack'
              ? 'bg-paper-card text-rust shadow-sm border border-ink/5'
              : 'text-ink/60 hover:text-ink'
          }`}
        >
          <Backpack className="w-4 h-4" />
          <span>{copy.backpack} ({backpackItems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('characters')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-semibold tracking-wider transition-all ${
            activeTab === 'characters'
              ? 'bg-paper-card text-rust shadow-sm border border-ink/5'
              : 'text-ink/60 hover:text-ink'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{copy.characters} ({characters.length})</span>
        </button>
      </div>

      {/* Tab 1: Backpack Items */}
      {activeTab === 'backpack' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="text-[11px] font-mono text-ink/40 uppercase tracking-wider mb-2">
            {copy.backpackHint}
          </div>

          {backpackItems.length === 0 ? (
            <div className="text-center py-12 text-ink/40 font-sans text-xs">
              {copy.backpackEmpty}
            </div>
          ) : (
            backpackItems.map((item) => (
              <div
                key={item.path}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', item.path);
                  e.dataTransfer.effectAllowed = 'copyMove';
                  document.body.classList.add('dragging-backpack-item');
                  window.dispatchEvent(new CustomEvent('airp:item-drag-start', { detail: { path: item.path } }));
                }}
                onDragEnd={() => {
                  document.body.classList.remove('dragging-backpack-item');
                  window.dispatchEvent(new CustomEvent('airp:item-drag-end'));
                }}
                className="p-3.5 rounded-2xl bg-paper-wall/70 hover:bg-paper-wall border border-ink/10 shadow-sm cursor-grab active:cursor-grabbing hover:border-rust/40 transition-all flex items-start gap-2.5 group"
              >
                <GripVertical className="w-4 h-4 text-ink/20 group-hover:text-rust transition-colors mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-sans font-bold text-xs text-ink truncate">
                    {item.frontmatter?.title || item.filename.replace('.md', '')}
                  </div>
                  <MarkdownText
                    text={item.body}
                    className="text-[11px] text-ink/60 line-clamp-2 mt-1 font-serif leading-snug"
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: World Characters */}
      {activeTab === 'characters' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {characters.map((char) => {
            const isFollowing = followingCharacters[char.id] || false;
            return (
              <div
                key={char.id}
                className="p-3.5 rounded-2xl bg-paper-wall/60 border border-ink/10 shadow-sm flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={char.avatar || '/assets/characters/portraits/lady_1.png'}
                    alt={char.id}
                    className="w-10 h-10 rounded-full object-cover border border-rust/30 shadow-sm shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-sans font-bold text-xs text-ink truncate">
                      {char.id}
                    </div>
                    <div className="text-[10px] font-mono text-ink/50 truncate">
                      {copy.at}: {char.home || copy.unknown}
                    </div>
                  </div>
                </div>

                {/* Actions: Navigate, Chat, Follow */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-ink/5 text-xs">
                  <button
                    onClick={() => char.home && onNavigateToCharacter?.(char.home)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-paper-card hover:bg-ink hover:text-white transition-all text-ink/70"
                    title="Jump to the character's scene"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>{copy.locate}</span>
                  </button>

                  <button
                    onClick={() => onChatWithCharacter?.(char.id)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-rust text-white hover:bg-rust-light transition-all shadow-sm"
                    title="Enter close-up dialogue"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{copy.talk}</span>
                  </button>

                  <button
                    onClick={() => onToggleFollow?.(char.id)}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl transition-all ${
                      isFollowing
                        ? 'bg-sage text-white font-medium shadow-sm'
                        : 'bg-paper-card text-ink/70 hover:bg-ink hover:text-white'
                    }`}
                    title="Toggle whether this character follows you"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>{isFollowing ? copy.following : copy.follow}</span>
                  </button>

                  {/* Nook — the character's private space (fourth action;
                      mutually exclusive with navigate / talk / follow,
                      doc-06 §5.4). */}
                  <button
                    onClick={() => onOpenNook?.(char.id)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-paper-card text-ink/70 hover:bg-sage hover:text-white transition-all"
                    title="Enter this character's private nook"
                  >
                    <DoorOpen className="w-3.5 h-3.5" />
                    <span>{copy.nook}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
