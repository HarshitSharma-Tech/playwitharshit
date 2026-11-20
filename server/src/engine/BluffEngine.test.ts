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
    firstPlayerMode: opts.firstPlayerMode ?? 'host_selected',
    firstPlayerId: opts.firstPlayerId ?? 'p1',
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
  assert.equal(p1State.isFreshRound, true);
  assert.equal(p1State.requiredRank, null);
  assert.equal(p1State.remainingDeckCount, 52 - 15);

  const p1Ids = new Set(p1State.myHand.map((c) => c.id));
  for (const c of p2State.myHand) {
    assert.equal(p1Ids.has(c.id), false);
  }
  for (const pl of p1State.players) {
    assert.equal('hand' in pl, false);
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

  const allIds = new Set([...s1.myHand, ...s2.myHand, ...s3.myHand].map((c) => c.id));
  assert.equal(allIds.size, 60);

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
  engine.onShuffleComplete();
  assert.equal(engine.getPhase(), 'ready_to_deal');
  assert.equal(engine.beginDealing().ok, true);
  assert.equal(engine.beginDealing().ok, false);
  assert.equal(engine.getPhase(), 'dealing');

  engine.dealOneCardStep();
  assert.equal(engine.getSanitizedStateForRecipient('p2').myHand.length, 1);
  assert.equal(engine.getSanitizedStateForRecipient('p3').myHand.length, 0);

  for (let i = 0; i < 8; i++) engine.dealOneCardStep();

  assert.equal(engine.getPhase(), 'playing');
  assert.equal(engine.getCurrentTurnPlayer().id, 'p2');
  assert.equal(engine.isFreshRound(), true);
});

test('Fresh round allows choosing ANY rank and turns proceed strictly line-by-line (no interrupting!)', () => {
  const { engine } = createTestEngine(5, { firstPlayerId: 'p1' });
  const p1Hand = engine.getPlayerHandInternal('p1');
  const p2Hand = engine.getPlayerHandInternal('p2');

  // Out-of-turn play is blocked
  assert.equal(engine.playCards('p2', [p2Hand[0].id], 'K').ok, false);

  // p1 starts fresh round choosing ANY rank (e.g. '7')
  assert.equal(engine.playCards('p1', [p1Hand[0].id], '7').ok, true);
  assert.equal(engine.getRequiredRank(), '7');
  assert.equal(engine.getCurrentTurnPlayer().id, 'p2');

  // p3 CANNOT interrupt p2's turn to call bluff or pass!
  assert.equal(engine.challengePlay('p3').ok, false);
  assert.equal(engine.passTurn('p3').ok, false);
});

test('Truthful vs bluff challenge strictly on next player turn transfers pile & starts fresh round', () => {
  const { engine } = createTestEngine(5, { firstPlayerId: 'p1' });
  const p1Hand = engine.getPlayerHandInternal('p1');
  const card = p1Hand[0];

  // p1 plays truthfully by declaring card's exact rank
  assert.equal(engine.playCards('p1', [card.id], card.rank).ok, true);
  assert.equal(engine.getCurrentTurnPlayer().id, 'p2');

  // p2 challenges on their turn -> claim was TRUE -> p2 takes pile
  assert.equal(engine.challengePlay('p2').ok, true);
  assert.equal(engine.getPhase(), 'challenge_reveal');
  const view2 = engine.getSanitizedStateForRecipient('p2');
  assert.equal(view2.challengeResult?.wasBluff, false);
  assert.equal(view2.challengeResult?.loserId, 'p2');
  assert.equal(view2.myHand.length, 6);

  // After reveal completes, p1 (winner of challenge) starts a FRESH round with ANY rank!
  engine.resolveAfterChallengeReveal('p1');
  assert.equal(engine.getPhase(), 'playing');
  assert.equal(engine.getCurrentTurnPlayer().id, 'p1');
  assert.equal(engine.isFreshRound(), true);
  assert.equal(engine.getRequiredRank(), null);
});

test('Everyone passing line-by-line burns the pile and lets last actor start fresh round with ANY rank', () => {
  const { engine } = createTestEngine(5, { firstPlayerId: 'p1' });
  const p1Hand = engine.getPlayerHandInternal('p1');

  assert.equal(engine.playCards('p1', [p1Hand[0].id], 'K').ok, true);
  assert.equal(engine.getCurrentTurnPlayer().id, 'p2');
  assert.equal(engine.passTurn('p2').ok, true);
  assert.equal(engine.getCurrentTurnPlayer().id, 'p3');
  assert.equal(engine.passTurn('p3').ok, true);

  // Pile cleared, fresh round starts for p1!
  assert.equal(engine.getPileCount(), 0);
  assert.equal(engine.isFreshRound(), true);
  assert.equal(engine.getCurrentTurnPlayer().id, 'p1');
});

test('Final play must survive clockwise passes before player wins', () => {
  const { engine, getWinner } = createTestEngine(4, { firstPlayerId: 'p1' });
  const p1Hand = engine.getPlayerHandInternal('p1');

  // p1 empties entire 4-card hand on fresh round
  assert.equal(engine.playCards('p1', p1Hand.map((c) => c.id), 'A').ok, true);
  assert.equal(getWinner(), null); // Must survive p2 and p3's turns!
  assert.equal(engine.getCurrentTurnPlayer().id, 'p2');

  // p2 passes, p3 passes -> p1 wins!
  assert.equal(engine.passTurn('p2').ok, true);
  assert.equal(getWinner(), null);
  assert.equal(engine.getCurrentTurnPlayer().id, 'p3');
  assert.equal(engine.passTurn('p3').ok, true);
  assert.equal(engine.getPhase(), 'finished');
  assert.equal(getWinner(), 'p1');
});
