# BLUFFED — Premium Real-Time Multiplayer Bluff Card Game

A complete, server-authoritative real-time multiplayer Bluff (Cheat / I Doubt It) card game platform built with **React + TypeScript + Vite + Tailwind CSS + Framer Motion + Zustand** on the frontend and **Node.js + Express + Socket.IO + SQLite (`node:sqlite`)** on the backend.

## Key Features
- **100% Server-Authoritative Engine**: Standard 52-card deck shuffled cryptographically on the server. Hidden cards are strictly isolated per player and never leaked to opponents or spectators.
- **Three Game Modes**:
  - **Quick Play**: Live matchmaking queue (2–6 players) with optional instant AI fill.
  - **Private Room**: Custom room name, 6-character code, shareable `?join=CODE` invite link, optional password, 2–6 players, customizable cards per player, turn timer (15/30/45s), Casual/Competitive difficulty, spectator mode, AI bot seats, kick player, host settings editing, and automatic host migration on disconnect.
  - **Play with Bots**: 4 distinct AI personalities (**Aggressive**, **Strategic**, **Unpredictable**, **Defensive**) that bluff, count cards, challenge mathematically impossible claims, and send table reactions.
- **Cinematic Game Table**: Oval dark casino felt table, curved interactive card fan, dramatic 3D-flip Challenge Reveal overlay, Observed Bluff Meter (strictly based on public table behavior), Player Reputation tracking, Emoji Reactions (`😂 😈 🤔 🔥 👀`), Web Audio synthesized sound effects, and Reduced Motion accessibility support.
- **Accounts, Profiles, Achievements & Leaderboards**: Instant guest play with seamless upgrade to registered accounts, editable username/emblem, 8 unlockable achievements, match history, and 5 leaderboard categories.

## Running Locally

```bash
npm install
npm run dev
```

- Frontend Dev Server: `http://localhost:5173`
- Authoritative Multiplayer Backend: `http://localhost:4000`

## Testing & Production Build

```bash
npm test
npm run build
npm start
```

An optional Supabase PostgreSQL schema with Row Level Security policies is also provided in `supabase/schema.sql`.
