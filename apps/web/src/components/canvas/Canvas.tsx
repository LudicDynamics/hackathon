import React, { useState, useRef, useEffect } from 'react';
import { CardRenderer } from './CardRenderer.js';

interface CanvasProps {
  currentLayer: string;
  items: Array<{
    path: string;
    filename: string;
    frontmatter: Record<string, any> | null;
    body: string;
  }>;
  characters: Array<{
    id: string;
    avatar?: string;
    bio?: string;
  }>;
  onSelectChoice?: (choice: string) => void;
  onDiceRolled?: (result: number, passed: boolean) => void;
  onEnterGate?: (targetLayer: string) => void;
  onOpenCharacterModal?: (charId: string) => void;
  onItemDropOnTarget?: (itemPath: string, targetPath: string) => void;
  onDropItemToScene?: (itemPath: string) => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  currentLayer,
  items,
  characters,
  onSelectChoice,
  onDiceRolled,
  onEnterGate,
  onOpenCharacterModal,
  onItemDropOnTarget,
  onDropItemToScene,
}) => {
  const [camera, setCamera] = useState({ x: 100, y: 100, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Mouse parallax
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setCamera((prev) => ({
        ...prev,
        x: prev.x + (e.clientX - startPan.x),
        y: prev.y + (e.clientY - startPan.y),
      }));
      setStartPan({ x: e.clientX, y: e.clientY });
    }

    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      setMousePos({ x: nx, y: ny });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only pan if clicking on canvas background directly
    if ((e.target as HTMLElement).closest('.card-container') === null) {
      setIsPanning(true);
      setStartPan({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomSteps = [0.5, 0.75, 1, 1.25, 1.5];
    const delta = e.deltaY < 0 ? 1 : -1;
    setCamera((prev) => {
      let idx = zoomSteps.indexOf(prev.zoom);
      if (idx === -1) idx = 2;
      const nextIdx = Math.max(0, Math.min(zoomSteps.length - 1, idx + delta));
      return { ...prev, zoom: zoomSteps[nextIdx] };
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const itemPath = e.dataTransfer.getData('text/plain');
    if (itemPath && onDropItemToScene) {
      onDropItemToScene(itemPath);
    }
  };

  return (
    <div
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="relative w-full h-full overflow-hidden canvas-grid cursor-grab active:cursor-grabbing select-none"
      style={{ perspective: '1200px' }}
    >
      {/* Parallax Floating Dust Particles Overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          transform: `translate3d(${mousePos.x * -30}px, ${mousePos.y * -30}px, 60px)`,
          transition: 'transform 0.2s ease-out',
        }}
      >
        <div className="dust-particle w-3 h-3 top-1/4 left-1/5" />
        <div className="dust-particle w-2 h-2 top-1/2 left-3/4" />
        <div className="dust-particle w-4 h-4 top-3/4 left-1/3" />
        <div className="dust-particle w-2 h-2 top-1/6 left-2/3" />
      </div>

      {/* World Transform Layer */}
      <div
        className="absolute transition-transform duration-100 ease-out origin-top-left"
        style={{
          transform: `translate3d(${camera.x}px, ${camera.y}px, 0px) scale(${camera.zoom}) rotateX(${mousePos.y * 3}deg) rotateY(${mousePos.x * -3}deg)`,
        }}
      >
        {/* Layer Header Tag */}
        <div className="mb-8 inline-block px-4 py-1.5 rounded-full bg-paper-card/80 border border-ink/10 shadow-soft backdrop-blur-md">
          <span className="font-mono text-xs text-ink/50 uppercase tracking-widest">
            ACTIVE LAYER:
          </span>{' '}
          <span className="font-sans font-bold text-ink text-xs">{currentLayer}</span>
        </div>

        {/* Character Halo Avatars on Canvas */}
        {characters && characters.length > 0 && (
          <div className="mb-6 flex gap-4">
            {characters.map((char) => (
              <div
                key={char.id}
                onClick={() => onOpenCharacterModal?.(char.id)}
                className="group card-container cursor-pointer flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-paper-card border border-ink/10 shadow-halo hover:scale-105 transition-all"
              >
                <img
                  src={char.avatar || '/assets/characters/portraits/lady_1.png'}
                  alt={char.id}
                  className="w-8 h-8 rounded-full object-cover border border-rust/20"
                />
                <span className="text-xs font-bold text-ink group-hover:text-rust transition-colors">
                  {char.id}
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* Cards Grid / Arrangement */}
        <div className="flex flex-wrap gap-8 items-start max-w-[1400px]">
          {items.map((item, idx) => (
            <div key={item.path || idx} className="card-container">
              <CardRenderer
                item={item}
                onSelectChoice={onSelectChoice}
                onDiceRolled={onDiceRolled}
                onEnterGate={onEnterGate}
                onOpenCharacterModal={onOpenCharacterModal}
                onItemDropOnTarget={onItemDropOnTarget}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
