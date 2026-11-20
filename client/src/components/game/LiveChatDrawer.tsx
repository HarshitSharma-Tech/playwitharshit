import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flame, MessageCircle, Reply, Send, Sparkles, X } from 'lucide-react';
import type { ChatMessage } from '@shared/types';
import { FAMOUS_CHAT_MEMES, type FamousMemeSticker } from '../../lib/hindiMemes';
import { useGameStore } from '../../store/useGameStore';
import { AvatarBadge } from '../AvatarBadge';

export const LiveChatDrawer: React.FC = () => {
  const { user, chatMessages, sendChatMessage } = useGameStore();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'chat' | 'memes'>('chat');
  const [text, setText] = useState('');
  const [unread, setUnread] = useState(0);
  const [floatingPreview, setFloatingPreview] = useState<ChatMessage | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const prevCountRef = useRef(chatMessages.length);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (chatMessages.length > prevCountRef.current) {
      const latest = chatMessages[chatMessages.length - 1];
      if (!open && latest) {
        setUnread((u) => u + (chatMessages.length - prevCountRef.current));
        // Pop up live preview OUTSIDE the chat drawer showing it came from Live Chat!
        setFloatingPreview(latest);
        if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
        previewTimerRef.current = setTimeout(() => {
          setFloatingPreview(null);
        }, 5200);
      }
      setTimeout(() => {
        listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 40);
    }
    prevCountRef.current = chatMessages.length;
  }, [chatMessages, open]);

  useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, []);

  const handleToggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next) {
        setUnread(0);
        setFloatingPreview(null);
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
    // Close drawer automatically on mobile so the player immediately sees the table & live popup!
    setOpen(false);
    setFloatingPreview({
      id: `local_${Date.now()}`,
      roomCode: '',
      senderId: user?.id ?? '',
      senderName: user?.username ?? 'You',
      senderAvatar: user?.avatar ?? 'ace',
      text: meme.dialogue,
      memeId: meme.id,
      memeTitle: meme.title,
      memeImage: meme.image,
      memeTag: meme.tag,
      timestamp: Date.now(),
    });
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => setFloatingPreview(null), 4200);
  };

  if (!user) return null;

  return (
    <div className="fixed bottom-3 left-3 z-30 flex flex-col items-start gap-2">
      {/* LIVE FLOATING CHAT POPOUT (Displayed OUTSIDE chat drawer so everyone sees who sent it!) */}
      <AnimatePresence>
        {!open && floatingPreview && (
          <motion.div
            key={floatingPreview.id}
            initial={{ opacity: 0, y: 14, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.94 }}
            className="glass-panel w-[calc(100vw-24px)] max-w-[310px] overflow-hidden rounded-2xl border border-[#E6B84C]/55 p-3 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#E6B84C]/18 pb-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <MessageCircle className="h-3.5 w-3.5 shrink-0 text-[#1CD696]" />
                <span className="truncate font-[var(--font-mono)] text-[9px] font-bold uppercase tracking-wider text-[#F6D889]">
                  SENT FROM CHAT · {floatingPreview.senderName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFloatingPreview(null)}
                className="text-[#B9A992] hover:text-white cursor-pointer"
                aria-label="Dismiss chat popup"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-2 flex items-start gap-2.5">
              <AvatarBadge avatar={floatingPreview.senderAvatar} size="xs" />
              <div className="min-w-0 flex-1">
                {floatingPreview.memeImage && (
                  <img
                    src={floatingPreview.memeImage}
                    alt={floatingPreview.memeTitle ?? 'Meme'}
                    className="mb-1.5 h-24 w-full rounded-xl object-cover border border-white/15"
                  />
                )}
                {floatingPreview.memeTitle && (
                  <p className="text-xs font-extrabold text-[#F6D889]">
                    {floatingPreview.memeTitle}
                  </p>
                )}
                <p className="text-xs leading-snug text-[#FAF3E3] break-words">
                  {floatingPreview.text}
                </p>
                <button
                  type="button"
                  onClick={handleToggle}
                  className="mt-1.5 inline-flex items-center gap-1 font-[var(--font-mono)] text-[9px] font-bold uppercase tracking-wider text-[#1CD696] hover:underline cursor-pointer"
                >
                  <Reply className="h-3 w-3" />
                  Open Chat & Reply
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EXPANDABLE MOBILE-FRIENDLY CHAT & REAL MEMES DRAWER */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            className="glass-panel flex h-[62dvh] max-h-[450px] w-[calc(100vw-24px)] max-w-[360px] flex-col overflow-hidden rounded-2xl border border-[#E6B84C]/45 shadow-2xl"
          >
            {/* Header + Tabs */}
            <div className="flex items-center justify-between border-b border-[#E6B84C]/18 bg-[#15100C]/95 px-3.5 py-2.5">
              <div className="flex items-center gap-1 rounded-xl bg-[#0B0907] p-0.5 border border-white/[0.07]">
                <button
                  type="button"
                  onClick={() => setTab('chat')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition cursor-pointer ${
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
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition cursor-pointer ${
                    tab === 'memes'
                      ? 'bg-[#E1384B] text-white'
                      : 'text-[#B9A992] hover:text-white'
                  }`}
                >
                  <Flame className="h-3.5 w-3.5" />
                  Real Memes
                </button>
              </div>

              <button
                type="button"
                onClick={handleToggle}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#B9A992] hover:bg-white/10 hover:text-white cursor-pointer"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {tab === 'chat' ? (
              <>
                <div className="flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3">
                  {chatMessages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center px-4">
                      <Sparkles className="h-7 w-7 text-[#E6B84C]/65" />
                      <p className="mt-2 text-xs font-bold text-[#FAF3E3]">
                        Room Chat is Live!
                      </p>
                      <p className="mt-1 text-[11px] text-[#B9A992]">
                        Messages pop up live on everyone&apos;s table — or tap{' '}
                        <strong>Real Memes</strong> to drop UNO Draw 25, Leo Cheers, Binod & more!
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
                                <span className="rounded bg-[#E1384B]/22 px-1.5 py-0.5 font-[var(--font-mono)] text-[8px] font-bold text-[#FFC4CB]">
                                  {msg.memeTag}
                                </span>
                              )}
                            </div>

                            {msg.memeImage && (
                              <div className="mt-1.5 overflow-hidden rounded-xl border border-white/15 bg-[#0B0907]">
                                <img
                                  src={msg.memeImage}
                                  alt={msg.memeTitle ?? 'Meme'}
                                  className="h-28 w-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                            )}

                            {msg.memeTitle && (
                              <p className="mt-1.5 text-xs font-extrabold text-[#F6D889]">
                                {msg.memeTitle}
                              </p>
                            )}

                            <p className="mt-0.5 text-xs leading-relaxed text-[#FAF3E3] break-words">
                              {msg.text}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={listEndRef} />
                </div>

                {/* Quick 1-Tap Real Meme Strip */}
                <div className="flex items-center gap-1.5 overflow-x-auto border-t border-white/[0.06] bg-[#0B0907] px-2.5 py-1.5">
                  {FAMOUS_CHAT_MEMES.slice(0, 5).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSendMeme(m)}
                      className="shrink-0 rounded-lg bg-[#18130F] border border-[#E6B84C]/25 px-2.5 py-1 text-[10px] font-semibold text-[#FAF3E3] hover:border-[#E1384B] cursor-pointer"
                    >
                      {m.title}
                    </button>
                  ))}
                </div>

                {/* Composer */}
                <form
                  onSubmit={handleSendText}
                  className="flex items-center gap-2 border-t border-[#E6B84C]/18 bg-[#15100C] p-2.5"
                >
                  <input
                    type="text"
                    maxLength={220}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Message room (pops up live)..."
                    className="flex-1 rounded-xl bg-[#0B0907] border border-white/15 px-3 py-2 text-xs text-[#FAF3E3] placeholder-[#7D6E5B] focus:border-[#E6B84C] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!text.trim()}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E6B84C] text-[#0B0907] transition hover:bg-[#F3CF7A] disabled:opacity-40 cursor-pointer"
                    aria-label="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </>
            ) : (
              /* Real Iconic Memes Grid Picker */
              <div className="flex-1 overflow-y-auto p-3">
                <p className="mb-2.5 font-[var(--font-mono)] text-[10px] font-bold uppercase tracking-widest text-[#1CD696]">
                  TAP ANY REAL MEME TO POP UP ON TABLE 🔥
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {FAMOUS_CHAT_MEMES.map((meme) => (
                    <button
                      key={meme.id}
                      type="button"
                      onClick={() => handleSendMeme(meme)}
                      className="group overflow-hidden rounded-xl bg-[#120E0B] border border-[#E6B84C]/20 text-left transition hover:border-[#E6B84C] cursor-pointer"
                    >
                      <div className="relative h-24 w-full overflow-hidden bg-[#0B0907]">
                        <img
                          src={meme.image}
                          alt={meme.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                        <span className="absolute top-1.5 left-1.5 rounded bg-[#0B0907]/85 px-1.5 py-0.5 font-[var(--font-mono)] text-[8px] font-bold text-[#F6D889]">
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
            ? 'border-[#E6B84C] bg-[#241B13] text-[#F6D889]'
            : 'border-[#E6B84C]/30 text-[#FAF3E3] hover:border-[#E6B84C]'
        }`}
      >
        <MessageCircle className="h-4 w-4 text-[#1CD696]" />
        <span className="hidden xs:inline sm:inline">Chat & Memes</span>
        <span className="inline sm:hidden">Chat</span>
        {unread > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E1384B] px-1.5 font-[var(--font-mono)] text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  );
};
