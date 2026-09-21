// Mined — "Continue where you left off" card.
//
// Reads the locally tracked session, then LIVE-verifies it against Firestore:
// the card only shows when the session exists, isn't finished, and the player
// doc still exists (i.e. they weren't kicked and haven't explicitly left).
// When the state is stale the card hides itself and clears the tracker, so the
// UI never offers a dead session.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Panel } from './ui';
import { useAuth } from '../auth/AuthContext';
import { subscribeSession, subscribeMyPlayer } from '../lib/gameService';
import { getActiveSession, clearActiveSession, type TrackedSession } from '../lib/sessionTracker';
import type { GameSession, PlayerState } from '../lib/types';

interface LiveState {
  tracked: TrackedSession;
  session: GameSession | null;
  player: PlayerState | null;
  playerLoaded: boolean;
}

export function ResumeSessionCard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [state, setState] = useState<LiveState | null>(null);

  const tracked = getActiveSession();

  useEffect(() => {
    if (!user || !tracked) {
      setState(null);
      return;
    }
    setState({ tracked, session: null, player: null, playerLoaded: false });

    const un1 = subscribeSession(tracked.sessionId, (s) => {
      setState((prev) => (prev && prev.tracked.sessionId === tracked.sessionId ? { ...prev, session: s } : prev));
    });
    const un2 = subscribeMyPlayer(tracked.sessionId, user.uid, (p) => {
      setState((prev) => (prev && prev.tracked.sessionId === tracked.sessionId ? { ...prev, player: p, playerLoaded: true } : prev));
    });
    return () => { un1(); un2(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, tracked?.sessionId]);

  // Hide + self-clean when the tracked session is dead (ended, deleted, or the
  // player doc is gone — kicked or explicitly left).
  useEffect(() => {
    if (!state || !state.playerLoaded) return;
    if (!state.session || state.session.status === 'finished' || !state.player) {
      clearActiveSession();
      setState(null);
    }
  }, [state]);

  if (!user || !state || !state.session || state.session.status === 'finished' || !state.player) return null;

  const { session, player, tracked: t } = state;
  const isWaiting = session.status === 'waiting';
  const isSelfPaced = session.pacing === 'self_paced';
  const questionNum = isSelfPaced
    ? Math.min((player.playerQuestionIndex ?? 0) + 1, session.questionCount)
    : session.currentQuestionIndex + 1;
  const answered = player.playerStatus === 'finished' || (isSelfPaced && player.currentGameState === 'answered');

  const sub = isWaiting
    ? 'The quiz hasn\'t started yet — you\'re in the lobby.'
    : answered
    ? 'You\'re all caught up on this question.'
    : `On question ${questionNum} of ${session.questionCount} · ${player.score} pts`;

  return (
    <Panel className="resume-card">
      <div className="resume-card-body">
        <div className="resume-card-icon" aria-hidden="true">▶️</div>
        <div className="resume-card-text">
          <div className="resume-card-title">
            Continue where you left off
            <span className="resume-card-pill">{isWaiting ? 'In lobby' : 'In progress'}</span>
          </div>
          <div className="muted">{session.quizTitle || t.quizTitle} · {sub}</div>
        </div>
        <Button size="lg" onClick={() => nav(`/play/${session.id}`)}>Continue →</Button>
      </div>
    </Panel>
  );
}
