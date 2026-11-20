import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { AVATAR_OPTIONS, AvatarBadge } from '../AvatarBadge';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ open, onClose }) => {
  const { user, login, register } = useGameStore();
  const [tab, setTab] = useState<'register' | 'login'>('register');
  const [username, setUsername] = useState(user?.isGuest ? user.username : '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState(user?.avatar ?? 'ace');
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(identifier, password);
      } else {
        await register({ username, email, password, avatar });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#070504]/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="relative z-10 w-full max-w-md rounded-2xl bg-[#18130F] border border-white/10 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
              <h2 className="font-[var(--font-display)] text-lg font-bold text-[#FAF3E3]">
                {tab === 'register' ? 'Claim Your Identity' : 'Welcome Back'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-[#B9A992] hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-5 grid grid-cols-2 rounded-xl bg-[#120E0B] p-1 border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => {
                    setTab('register');
                    setError(null);
                  }}
                  className={`rounded-lg py-2 text-xs font-semibold transition cursor-pointer ${
                    tab === 'register' ? 'bg-[#E6B84C] text-[#0B0907]' : 'text-[#B9A992]'
                  }`}
                >
                  {user?.isGuest ? 'Upgrade Guest' : 'Create Account'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setError(null);
                  }}
                  className={`rounded-lg py-2 text-xs font-semibold transition cursor-pointer ${
                    tab === 'login' ? 'bg-[#E6B84C] text-[#0B0907]' : 'text-[#B9A992]'
                  }`}
                >
                  Sign In
                </button>
              </div>

              {error && (
                <div className="mb-4 rounded-xl border border-[#E1384B]/40 bg-[#E1384B]/10 px-4 py-2.5 text-xs text-[#FF9BA6]">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {tab === 'register' ? (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#B9A992]">
                        Username
                      </label>
                      <input
                        type="text"
                        required
                        minLength={3}
                        maxLength={20}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="ShadowAce"
                        className="w-full rounded-xl bg-[#120E0B] border border-white/10 px-3.5 py-2.5 text-sm text-[#FAF3E3] focus:border-[#E6B84C] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#B9A992]">
                        Email
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@domain.com"
                        className="w-full rounded-xl bg-[#120E0B] border border-white/10 px-3.5 py-2.5 text-sm text-[#FAF3E3] focus:border-[#E6B84C] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#B9A992]">
                        Password
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full rounded-xl bg-[#120E0B] border border-white/10 px-3.5 py-2.5 text-sm text-[#FAF3E3] focus:border-[#E6B84C] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-[#B9A992]">
                        Choose Emblem
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {AVATAR_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setAvatar(opt.id)}
                            className="cursor-pointer rounded-xl p-0.5 transition hover:scale-105"
                          >
                            <AvatarBadge avatar={opt.id} size="sm" active={avatar === opt.id} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#B9A992]">
                        Email or Username
                      </label>
                      <input
                        type="text"
                        required
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="Enter email or username"
                        className="w-full rounded-xl bg-[#120E0B] border border-white/10 px-3.5 py-2.5 text-sm text-[#FAF3E3] focus:border-[#E6B84C] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#B9A992]">
                        Password
                      </label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-xl bg-[#120E0B] border border-white/10 px-3.5 py-2.5 text-sm text-[#FAF3E3] focus:border-[#E6B84C] focus:outline-none"
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-[#E6B84C] py-3 text-xs font-bold uppercase tracking-wider text-[#0B0907] shadow-lg transition hover:bg-[#F3CF7A] disabled:opacity-50 cursor-pointer"
                >
                  {loading
                    ? 'Please wait...'
                    : tab === 'register'
                      ? 'Save & Continue'
                      : 'Sign In'}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
