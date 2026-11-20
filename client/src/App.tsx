import React, { useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import { useGameStore } from './store/useGameStore';
import { useSettingsStore } from './store/useSettingsStore';
import { Header } from './components/Header';
import { ToastContainer } from './components/ToastContainer';
import { HomePage } from './pages/HomePage';
import { HowToPlayPage } from './pages/HowToPlayPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { LobbyPage } from './pages/LobbyPage';
import { GameTablePage } from './pages/GameTablePage';
import { CreateRoomModal } from './components/modals/CreateRoomModal';
import { JoinRoomModal } from './components/modals/JoinRoomModal';
import { PlayWithBotsModal } from './components/modals/PlayWithBotsModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { AuthModal } from './components/modals/AuthModal';
import { QuickPlayOverlay } from './components/modals/QuickPlayOverlay';

export const App: React.FC = () => {
  const {
    initialized,
    activeView,
    initSession,
    showCreateRoomModal,
    showJoinRoomModal,
    joinModalPrefillCode,
    showBotsModal,
    showSettingsModal,
    showAuthModal,
    setModal,
  } = useGameStore();

  const { reducedMotion } = useSettingsStore();

  useEffect(() => {
    initSession();
  }, [initSession]);

  if (!initialized) {
    return (
      <div className="bluffed-bg flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <div className="h-14 w-14 animate-pulse rounded-2xl bg-[#18130F] border border-[#E6B84C]/40 flex items-center justify-center">
          <div className="h-5 w-5 rotate-45 bg-[#E6B84C]" />
        </div>
        <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.26em] text-[#B9A992]">
          CONNECTING TO BLUFFED ARENA...
        </p>
      </div>
    );
  }

  const isGameTable = activeView === 'game';

  return (
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'}>
      <div className={`bluffed-bg min-h-screen ${reducedMotion ? 'reduce-motion' : ''}`}>
        {!isGameTable && <Header />}

        {activeView === 'home' && <HomePage />}
        {activeView === 'how-to-play' && <HowToPlayPage />}
        {activeView === 'leaderboard' && <LeaderboardPage />}
        {activeView === 'profile' && <ProfilePage />}
        {activeView === 'lobby' && <LobbyPage />}
        {activeView === 'game' && <GameTablePage />}

        {/* Modals & Overlays */}
        <CreateRoomModal
          open={showCreateRoomModal}
          onClose={() => setModal('createRoom', false)}
        />
        <JoinRoomModal
          open={showJoinRoomModal}
          prefillCode={joinModalPrefillCode}
          onClose={() => setModal('joinRoom', false)}
        />
        <PlayWithBotsModal
          open={showBotsModal}
          onClose={() => setModal('bots', false)}
        />
        <SettingsModal
          open={showSettingsModal}
          onClose={() => setModal('settings', false)}
        />
        <AuthModal
          open={showAuthModal}
          onClose={() => setModal('auth', false)}
        />
        <QuickPlayOverlay />
        <ToastContainer />
      </div>
    </MotionConfig>
  );
};

export default App;
