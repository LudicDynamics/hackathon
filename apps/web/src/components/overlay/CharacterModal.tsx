import React, { useState, useEffect } from 'react';
import { X, Send, Sparkles } from 'lucide-react';

interface CharacterModalProps {
  characterId: string;
  avatar?: string;
  bio?: string;
  onClose: () => void;
  onSendMessage?: (msg: string) => void;
}

// 6 Emotion tags
type Emotion = 'normal' | 'smile' | 'shock' | 'sad' | 'angry' | 'thinking';

export const CharacterModal: React.FC<CharacterModalProps> = ({
  characterId,
  avatar = '/assets/characters/portraits/lady_1.png',
  bio,
  onClose,
  onSendMessage,
}) => {
  const [currentEmo, setCurrentEmo] = useState<Emotion>('normal');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; emo?: Emotion }>>([
    {
      role: 'assistant',
      text: '(Watching you) Is there something you would like to know?',
      emo: 'normal',
    },
  ]);

  // Handle Esc key to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    const userMsg = inputText.trim();
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setInputText('');
    onSendMessage?.(userMsg);

    // Simulated character response with emotion tags if offline
    setTimeout(() => {
      const sampleReplies: Array<{ text: string; emo: Emotion }> = [
        { text: '[emo: thinking] Let me think... this is more complicated than it looks.', emo: 'thinking' },
        { text: '[emo: smile] I am glad we can speak of this. Please, do be careful.', emo: 'smile' },
        { text: '[emo: shock] What?! Where did you find that thing?!', emo: 'shock' },
      ];
      const reply = sampleReplies[Math.floor(Math.random() * sampleReplies.length)];
      setCurrentEmo(reply.emo);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: reply.text.replace(/\[emo:\s*\w+\]\s*/, ''), emo: reply.emo },
      ]);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-6 animate-in fade-in duration-300">
      <div className="relative w-full max-w-5xl h-[82vh] rounded-3xl bg-paper-card text-ink shadow-deep border border-ink/10 flex overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-20 p-2 rounded-full bg-paper-wall/80 hover:bg-rust hover:text-white transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left Side: Character Half-Bust Portrait with Breathing Animation */}
        <div className="w-1/2 h-full relative bg-gradient-to-b from-paper-wall/40 to-paper-wall/90 flex flex-col items-center justify-end p-8 border-r border-ink/10 overflow-hidden">
          {/* Emotion Badge */}
          <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-paper-card/90 border border-ink/10 text-xs font-mono text-rust shadow-soft">
            <Sparkles className="w-3.5 h-3.5" />
            <span>EMO: {currentEmo.toUpperCase()}</span>
          </div>

          {/* Portrait with subtle breathing scale */}
          <div className="relative w-full h-[85%] flex items-center justify-center">
            <img
              src={avatar}
              alt={characterId}
              className="max-h-full max-w-full object-contain filter drop-shadow-2xl transition-all duration-700 hover:scale-105"
              style={{
                animation: 'portraitBreathe 6s ease-in-out infinite alternate',
              }}
            />
          </div>

          <div className="text-center mt-2 z-10">
            <h2 className="font-serif text-2xl font-bold text-ink">{characterId}</h2>
            <p className="text-xs text-ink/60 font-sans mt-1 max-w-xs line-clamp-2">
              {bio || 'A character in this world'}
            </p>
          </div>
        </div>

        {/* Right Side: Galgame Dialogue Stream & Input */}
        <div className="w-1/2 h-full flex flex-col bg-paper-card p-8 justify-between">
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${
                  m.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <span className="text-[10px] font-mono text-ink/40 mb-1 px-1">
                  {m.role === 'user' ? 'YOU' : characterId}
                </span>
                <div
                  className={`p-4 rounded-2xl max-w-[85%] text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-ink text-white font-sans rounded-tr-none'
                      : 'bg-paper-wall/80 text-ink font-serif text-base border border-ink/5 rounded-tl-none shadow-sm'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {/* Dialogue Input Box */}
          <div className="mt-4 pt-4 border-t border-ink/10 flex items-center gap-3">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={`Say something to ${characterId}... (Enter to send)`}
              className="flex-1 px-4 py-3 rounded-2xl bg-paper-wall/60 border border-ink/15 text-sm text-ink placeholder-ink/40 focus:outline-none focus:ring-2 focus:ring-rust/40 transition-all"
            />
            <button
              onClick={handleSend}
              className="p-3 rounded-2xl bg-rust hover:bg-rust-light text-white transition-all shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
