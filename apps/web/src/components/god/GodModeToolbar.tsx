import React, { useState } from 'react';
import { Eye, EyeOff, Plus, FileText, Sparkles, X } from 'lucide-react';

interface GodModeToolbarProps {
  frozen: boolean;
  onToggleFreeze: () => void;
  onCreateEntity: (type: 'note' | 'chalk', title: string, content: string) => void;
}

export const GodModeToolbar: React.FC<GodModeToolbarProps> = ({
  frozen,
  onToggleFreeze,
  onCreateEntity,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [entityType, setEntityType] = useState<'note' | 'chalk'>('note');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleCreate = () => {
    if (!title.trim()) return;
    onCreateEntity(entityType, title.trim(), content.trim());
    setTitle('');
    setContent('');
    setModalOpen(false);
  };

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-paper-card border border-ink/10 shadow-soft">
        <button
          onClick={onToggleFreeze}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide transition-all ${
            frozen
              ? 'bg-rust text-white shadow-sm animate-pulse'
              : 'bg-paper-wall text-ink/70 hover:text-ink'
          }`}
        >
          {frozen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{frozen ? '世界已冻结' : '上帝之手'}</span>
        </button>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1 px-3 py-1 rounded-full bg-paper-wall hover:bg-ink hover:text-white text-xs font-semibold text-ink/80 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>造物</span>
        </button>
      </div>

      {/* Create Entity Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#FFFEF6] text-ink shadow-deep border border-ink/10 relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 rounded-full bg-paper-wall hover:bg-ink hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="font-serif text-xl font-bold text-ink mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-rust" />
              <span>造化万物（新建物件）</span>
            </h3>

            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setEntityType('note')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  entityType === 'note'
                    ? 'bg-ink text-white border-ink'
                    : 'bg-paper-wall text-ink/70 border-ink/10'
                }`}
              >
                道具/便签 (Note)
              </button>
              <button
                type="button"
                onClick={() => setEntityType('chalk')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  entityType === 'chalk'
                    ? 'bg-ink text-white border-ink'
                    : 'bg-paper-wall text-ink/70 border-ink/10'
                }`}
              >
                叙事板书 (Chalk)
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono text-ink/50 mb-1">
                  物件名称
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：遗落的羊皮纸卷"
                  className="w-full px-3.5 py-2 rounded-xl bg-paper-wall border border-ink/15 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-rust/30"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-ink/50 mb-1">
                  内容描写 (Markdown)
                </label>
                <textarea
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="描述其外观、触感或上面的铭文..."
                  className="w-full px-3.5 py-2 rounded-xl bg-paper-wall border border-ink/15 text-sm text-ink font-serif focus:outline-none focus:ring-2 focus:ring-rust/30"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-1.5 rounded-full bg-paper-wall text-xs font-mono text-ink/70 hover:text-ink"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                className="px-5 py-1.5 rounded-full bg-rust hover:bg-rust-light text-white text-xs font-semibold shadow-sm"
              >
                落定成真
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
