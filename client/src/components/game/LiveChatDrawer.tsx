import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flame, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { FAMOUS_CHAT_MEMES, type FamousMemeSticker } from '../../lib/hindiMemes';
import { useGameStore } from '../../store/useGameStore';
import { AvatarBadge } from '../AvatarBadge';

export const LiveChatDrawer: React.FC = () => {
  const { user, chatMessages, sendChatMessage } = useGameStore();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'chat' | 'memes'>('chat');
  const [text, setText] = useState('');
  const [unread, setUnread] = useState(0);
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const prevCountRef = useRef(chatMessages.length);

  useEffect(() => {
    if (chatMessages.length > prevCountRef.current) {
      if (!open) {
        setUnread((u) => u + (chatMessages.length - prevCountRef.current));
      }
      setTimeout(() => {
        listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 40);
    }
    prevCountRef.current = chatMessages.length;
  }, [chatMessages.length, open]);

  const handleToggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next) {
        setUnread(0);
        setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'auto' }), 60);
      }
      return next;
    });
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = text.trim();
    if (!cleaned) return;
    setText('');
    await sendChatMessage({ text: cleaned });
  };

  const handleSendMeme = async (meme: FamousMemeSticker) => {
    await sendChatMessage({
      text: meme.dialogue,
      memeId: meme.id,
      memeTitle: meme.title,
      memeImage: meme.image,
      memeTag: meme.tag,
    });
    setTab('chat');
  };

  if (!user) return null;

  return (
    <div className="fixed bottom-4 left-4 z-30 flex flex-col items-start gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            className="glass-panel flex h-[430px] w-[325px] sm:w-[360px] flex-col overflow-hidden rounded-2xl border border-[#E6B84C]/40 shadow-2xl"
          >
            {/* Header + Tabs */}
            <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#15100C]/95 px-3.5 py-2.5">
              <div className="flex items-center gap-1 rounded-xl bg-[#0B0907] p-0.5 border border-white/[0.07]">
                <button
                  type="button"
                  onClick={() => setTab('chat')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-[11px] font-bold transition cursor-pointer ${
                    tab === 'chat'
                      ? 'bg-[#E6B84C] text-[#0B0907]'
                      : 'text-[#B9A992] hover:text-white'
                  }`}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Live Chat
                </button>
                <button
                  type="button"
                  onClick={() => setTab('memes')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-[11px] font-bold transition cursor-pointer ${
                    tab === 'memes'
                      ? 'bg-[#E1384B] text-[#0B0907]'
                      : 'text-[#B9A992] hover:text-white'
                  }`}
                >
                  <Flame className="h-3.5 w-3.5" />
                  Famous Memes
                </button>
              </div>

              <button
                type="button"
                onClick={handleToggle}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#B9A992] hover:bg-white/10 hover:text-white cursor-pointer"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {tab === 'chat' ? (
              <>
                {/* Messages Feed */}
                <div className="flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3">
                  {chatMessages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center px-4">
                      <Sparkles className="h-7 w-7 text-[#E6B84C]/60" />
                      <p className="mt-2 text-xs font-semibold text-[#DFD2BE]">
                        Room Chat is Live!
                      </p>
                      <p className="mt-1 text-[11px] text-[#7D859F]">
                        Drop a message or switch to <strong>Famous Memes</strong> to send Hera
                        Pheri, Panchayat & Mirzapur memes!
                      </p>
                    </div>
                  ) : (
                    chatMessages.map((msg) => {
                      const isMe = msg.senderId === user.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex items-start gap-2 ${isMe ? 'flex-row-reverse' : ''}`}
                        >
                          <AvatarBadge avatar={msg.senderAvatar} size="xs" />
                          <div
                            className={`max-w-[82%] rounded-2xl px-3 py-2 ${
                              msg.memeId
                                ? 'bg-[#231A13] border border-[#E6B84C]/45 shadow-lg'
                                : isMe
                                  ? 'bg-[#E6B84C]/22 border border-[#E6B84C]/40'
                                  : 'bg-[#18130F] border border-white/[0.08]'
                            }`}
                          >
                            <div
                              className={`flex items-center gap-2 text-[10px] ${
                                isMe ? 'justify-end' : 'justify-between'
                              }`}
                            >
                              <span className="font-bold text-[#1CD696]">{msg.senderName}</span>
                              {msg.memeTag && (
                                <span className="rounded bg-[#E1384B]/20 px-1.5 py-0.5 font-[var(--font-mono)] text-[8px] font-bold text-[#FFB4BE]">
                                  {msg.memeTag}
                                </span>
                              )}
                            </div>

                            {msg.memeImage && (
                              <div className="mt-1.5 overflow-hidden rounded-xl border border-white/10">
                                <img
                                  src={msg.memeImage}
                                  alt={msg.memeTitle ?? 'Meme'}
                                  className="h-24 w-full object-cover"
                                />
                              </div>
                            )}

                            {msg.memeTitle && (
                              <p className="mt-1.5 font-[var(--font-heading)] text-xs font-extrabold text-amber-300">
                                {msg.memeTitle}
                              </p>
                            )}

                            <p className="mt-0.5 text-xs leading-relaxed text-[#FAF3E3]">
                              {msg.text}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={listEndRef} />
                </div>

                {/* Quick 1-Tap Famous Meme Strip */}
                <div className="flex items-center gap-1.5 overflow-x-auto border-t border-white/[0.06] bg-[#0B0E17] px-2.5 py-1.5">
                  {FAMOUS_CHAT_MEMES.slice(0, 5).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSendMeme(m)}
                      className="shrink-0 rounded-lg bg-[#18130F] border border-white/10 px-2 py-1 text-[10px] font-semibold text-[#FAF3E3] hover:border-[#E1384B] hover:text-white cursor-pointer"
                    >
                      {m.title}
                    </button>
                  ))}
                </div>

                {/* Text Composer */}
                <form
                  onSubmit={handleSendText}
                  className="flex items-center gap-2 border-t border-white/[0.08] bg-[#15100C] p-2.5"
                >
                  <input
                    type="text"
                    maxLength={220}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type message or roast..."
                    className="flex-1 rounded-xl bg-[#0B0907] border border-white/10 px-3 py-2 text-xs text-[#FAF3E3] placeholder-[#606882] focus:border-[#E6B84C] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!text.trim()}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E6B84C] text-[#0B0907] transition hover:bg-[#F3CF7A] disabled:opacity-40 cursor-pointer"
                    aria-label="Send message"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              </>
            ) : (
              /* Famous Memes Grid Picker */
              <div className="flex-1 overflow-y-auto p-3">
                <p className="mb-2.5 font-[var(--font-mono)] text-[10px] font-bold uppercase tracking-widest text-[#1CD696]">
                  TAP ANY FAMOUS MEME TO SEND LIVE 🔥
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {FAMOUS_CHAT_MEMES.map((meme) => (
                    <button
                      key={meme.id}
                      type="button"
                      onClick={() => handleSendMeme(meme)}
                      className="group overflow-hidden rounded-xl bg-[#120E0B] border border-white/[0.08] text-left transition hover:border-[#E6B84C] hover:-translate-y-0.5 cursor-pointer"
                    >
                      <div className="relative h-20 w-full overflow-hidden">
                        <img
                          src={meme.image}
                          alt={meme.title}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                        <span className="absolute top-1.5 left-1.5 rounded bg-[#0B0907]/85 px-1.5 py-0.5 font-[var(--font-mono)] text-[8px] font-bold text-[#1CD696]">
                          {meme.source}
                        </span>
                      </div>
                      <div className="p-2">
                        <p className="truncate text-[11px] font-bold text-[#FAF3E3]">
                          {meme.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-[#B9A992]">
                          {meme.dialogue}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact Floating Toggle Button (Bottom-Left) */}
      <button
        type="button"
        onClick={handleToggle}
        className={`glass-panel relative flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-xs font-bold shadow-2xl transition cursor-pointer ${
          open
            ? 'border-[#E6B84C] bg-[#241B13] text-[#FAF3E3]'
            : 'border-white/15 text-[#FAF3E3] hover:border-[#1CD696]/60'
        }`}
      >
        <MessageCircle className="h-4 w-4 text-[#1CD696]" />
        <span>Chat & Memes</span>
        {unread > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E1384B] px-1.5 font-[var(--font-mono)] text-[10px] font-bold text-[#0B0907]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  );
};
