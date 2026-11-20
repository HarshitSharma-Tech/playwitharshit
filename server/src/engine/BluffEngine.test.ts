import test from 'node:test';
import assert from 'node:assert/strict';
import { BluffEngine } from './BluffEngine.js';

function createTestEngine(
  cardsPerPlayer = 5,
  opts: {
    deckCount?: 1 | 2;
    distributionMode?: 'automatic' | 'manual';
    instantDeal?: boolean;
    firstPlayerMode?: 'random' | 'host_selected';
    firstPlayerId?: string | null;
  } = {}
) {
  let matchFinishedWinner: string | null = null;
  const engine = new BluffEngine({
    roomCode: 'TEST01',
    players: [
      { id: 'p1', username: 'Alice', avatar: 'ace', isBot: false, connected: true },
      { id: 'p2', username: 'Bob', avatar: 'crown', isBot: false, connected: true },
      { id: 'p3', username: 'Cara', avatar: 'viper', isBot: false, connected: true },
    ],
    spectators: [{ id: 'spec1', username: 'Watcher', avatar: 'cyber', connected: true }],
    cardsPerPlayer,
    deckCount: opts.deckCount ?? 1,
    distributionMode: opts.distributionMode ?? 'automatic',
    firstPlayerMode: opts.firstPlayerMode ?? 'random',
    firstPlayerId: opts.firstPlayerId ?? null,
    turnDurationSec: 30,
    enableTimers: false,
    instantDeal: opts.instantDeal ?? true,
    callbacks: {
      onStateChanged: () => {},
      onChallengeRevealComplete: () => {},
      onMatchFinished: (winner) => {
        matchFinishedWinner = winner.winnerId;
      },
    },
  });
  return { engine, getWinner: () => matchFinishedWinner };
}

test('Strictly hides opponent hands and spectator hands', () => {
  const { engine } = createTestEngine(5);
  const p1State = engine.getSanitizedStateForRecipient('p1');
  const p2State = engine.getSanitizedStateForRecipient('p2');
  const specState = engine.getSanitizedStateForRecipient('spec1');

  assert.equal(p1State.myHand.length, 5);
  assert.equal(p2State.myHand.length, 5);
  assert.equal(specState.myHand.length, 0);
  assert.equal(specState.isSpectator, true);
  assert.equal(p1State.remainingDeckCount, 52 - 15);

  const p1Ids = new Set(p1State.myHand.map((c) => c.id));
  for (const c of p2State.myHand) {
    assert.equal(p1Ids.has(c.id), false);
  }

  for (const pl of p1State.players) {
    assert.equal('hand' in pl, false);
    assert.equal(pl.cardCount, 5);
  }
});

test('Two-deck mode builds 104 unique physical cards and rejects overflow distribution', () => {
  const { engine } = createTestEngine(20, { deckCount: 2 });
  const s1 = engine.getSanitizedStateForRecipient('p1');
  const s2 = engine.getSanitizedStateForRecipient('p2');
  const s3 = engine.getSanitizedStateForRecipient('p3');

  assert.equal(s1.totalDeckCards, 104);
  assert.equal(s1.myHand.length, 20);
  assert.equal(s2.myHand.length, 20);
  assert.equal(s3.myHand.length, 20);
  assert.equal(s1.remainingDeckCount, 104 - 60);

  // Every single dealt card across all 3 players must have a unique physical ID
  const allIds = new Set([...s1.myHand, ...s2.myHand, ...s3.myHand].map((c) => c.id));
  assert.equal(allIds.size, 60);

  // Requesting more cards than available must throw
  assert.throws(() => createTestEngine(40, { deckCount: 2 }));
});

test('Manual distribution lifecycle: shuffling -> ready_to_deal -> clockwise one-by-one -> playing', () => {
  const { engine } = createTestEngine(3, {
    distributionMode: 'manual',
    instantDeal: false,
    firstPlayerMode: 'host_selected',
    firstPlayerId: 'p2',
  });

  assert.equal(engine.getPhase(), 'shuffling');
  assert.equal(engine.getRemainingDeckCount(), 52);

  engine.onShuffleComplete();
  assert.equal(engine.getPhase(), 'ready_to_deal');

  assert.equal(engine.beginDealing().ok, true);
  // Guard against duplicate start while dealing
  assert.equal(engine.beginDealing().ok, false);
  assert.equal(engine.getPhase(), 'dealing');

  // First card goes clockwise starting at host-selected p2
  engine.dealOneCardStep();
  assert.equal(engine.getSanitizedStateForRecipient('p2').myHand.length, 1);
  assert.equal(engine.getSanitizedStateForRecipient('p3').myHand.length, 0);
  assert.equal(engine.getRemainingDeckCount(), 51);

  // Deal remaining 8 cards (total 9 for 3 players x 3 cards)
  for (let i = 0; i < 8; i++) {
    engine.dealOneCardStep();
  }

  assert.equal(engine.getPhase(), 'playing');
  assert.equal(engine.getCurrentTurnPlayer().id, 'p2');
  assert.equal(engine.getRemainingDeckCount(), 43);
});

test('Rejects out-of-turn plays and cards not owned by player', () => {
  const { engine } = createTestEngine(5);
  const currentId = engine.getCurrentTurnPlayer().id;
  const otherId = currentId === 'p1' ? 'p2' : 'p1';

  const wrongTurn = engine.playCards(otherId, [engine.getPlayerHandInternal(otherId)[0].id]);
  assert.equal(wrongTurn.ok, false);

  const stolenCard = engine.playCards(currentId, [engine.getPlayerHandInternal(otherId)[0].id]);
  assert.equal(stolenCard.ok, false);
});

test('Truthful play challenged makes challenger take the pile', () => {
  const { engine } = createTestEngine(5);
  const actor = engine.getCurrentTurnPlayer();
  const hand = engine.getPlayerHandInternal(actor.id);
  const reqRank = engine.getRequiredRank();
  const matching = hand.find((c) => c.rank === reqRank);
  const challengerId = actor.id === 'p1' ? 'p2' : 'p1';

  if (matching) {
    assert.equal(engine.playCards(actor.id, [matching.id]).ok, true);
    assert.equal(engine.challengePlay(challengerId).ok, true);
    const view = engine.getSanitizedStateForRecipient(challengerId);
    assert.equal(view.challengeResult?.wasBluff, false);
    assert.equal(view.challengeResult?.loserId, challengerId);
    assert.equal(view.myHand.length, 6);
  } else {
    assert.equal(engine.playCards(actor.id, [hand[0].id]).ok, true);
    assert.equal(engine.challengePlay(challengerId).ok, true);
    const view = engine.getSanitizedStateForRecipient(actor.id);
    assert.equal(view.challengeResult?.wasBluff, true);
    assert.equal(view.challengeResult?.loserId, actor.id);
    assert.equal(view.myHand.length, 5);
  }
});

test('All players accepting advances turn and required rank', () => {
  const { engine } = createTestEngine(5);
  const actor = engine.getCurrentTurnPlayer();
  const hand = engine.getPlayerHandInternal(actor.id);
  const others = ['p1', 'p2', 'p3'].filter((id) => id !== actor.id);

  assert.equal(engine.getRequiredRank(), 'A');
  assert.equal(engine.playCards(actor.id, [hand[0].id]).ok, true);
  assert.equal(engine.acceptClaim(others[0]).ok, true);
  assert.equal(engine.getPhase(), 'awaiting_response');
  assert.equal(engine.acceptClaim(others[1]).ok, true);

  assert.equal(engine.getPhase(), 'playing');
  assert.equal(engine.getRequiredRank(), '2');
  assert.notEqual(engine.getCurrentTurnPlayer().id, actor.id);
});

test('Final play must survive challenge before player wins', () => {
  const { engine, getWinner } = createTestEngine(5);
  const actor = engine.getCurrentTurnPlayer();
  const hand = engine.getPlayerHandInternal(actor.id);
  const others = ['p1', 'p2', 'p3'].filter((id) => id !== actor.id);

  assert.equal(engine.playCards(actor.id, hand.slice(0, 4).map((c) => c.id)).ok, true);
  engine.finalizeUnchallengedPlay();

  for (let i = 0; i < 2; i++) {
    const curr = engine.getCurrentTurnPlayer();
    const currHand = engine.getPlayerHandInternal(curr.id);
    assert.equal(engine.playCards(curr.id, [currHand[0].id]).ok, true);
    engine.finalizeUnchallengedPlay();
  }

  const lastCard = engine.getPlayerHandInternal(actor.id);
  assert.equal(lastCard.length, 1);

  assert.equal(engine.playCards(actor.id, [lastCard[0].id]).ok, true);
  assert.equal(engine.getPhase(), 'awaiting_response');
  assert.equal(getWinner(), null);

  engine.acceptClaim(others[0]);
  engine.acceptClaim(others[1]);
  assert.equal(engine.getPhase(), 'finished');
  assert.equal(getWinner(), actor.id);
});
