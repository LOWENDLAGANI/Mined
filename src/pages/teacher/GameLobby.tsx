// Mined — Teacher game lobby + live game control (host screen).
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Button, Card, Panel, Spinner } from '../../components/ui';
import { subscribeSession, subscribePlayers, startGame, advanceQuestion, endGame, removePlayer, lockJoining, getSessionQuestions } from '../../lib/gameService';
import { subscribeQuestions } from '../../lib/firestore';
import { GAME_MODES } from '../../lib/gameModes';
import type { GameSession, PlayerState, Question } from '../../lib/types';
import { formatNumber, modeLabel } from '../../lib/format';
import { avatarUrl } from '../../assets/avatars';

export function GameLobby() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const nav = useNavigate();
  const { profile } = useAuth();
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!sessionId || !profile) return;
    const un1 = subscribeSession(sessionId, (s) => {
      if (!s) { setNotFound(true); return; }
      setSession(s);
    });
    const un2 = subscribePlayers(sessionId, setPlayers);
    return () => { un1(); un2(); };
  }, [sessionId, profile]);

  useEffect(() => {
    if (!session) return;
    return subscribeQuestions(session.quizId, setQuestions);
  }, [session?.quizId]);

  if (notFound) {
    return (
      <div className="page-center">
        <p className="error-text">Game not found or you don’t have access.</p>
        <Link to="/teacher/games"><Button variant="secondary">Back to Games</Button></Link>
      </div>
    );
  }
  if (!session) return <Spinner />;

  const mode = GAME_MODES[session.gameMode];
  const isWaiting = session.status === 'waiting';
  const isFinished = session.status === 'finished';
  const currentQ = questions[session.currentQuestionIndex];

  async function onStart() { setBusy(true); try { await startGame(session!.id); } finally { setBusy(false); } }
  async function onNext() { setBusy(true); try { await advanceQuestion(session!.id); } finally { setBusy(false); } }
  async function onEnd() { setBusy(true); try { await endGame(session!.id); } finally { setBusy(false); } }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div className="row-between mb-2">
        <div>
          <Link to="/teacher/games" className="muted" style={{ fontSize: '0.85rem' }}>← Games</Link>
          <h1 style={{ margin: '6px 0 0' }}>{session.quizTitle}</h1>
          <p className="muted" style={{ margin: 0 }}>{mode.icon} {modeLabel(session.gameMode)} · <strong>{session.status.replace('_', ' ').toUpperCase()}</strong></p>
        </div>
        {!isWaiting && !isFinished && <Button variant="danger" onClick={onEnd} disabled={busy}>End game</Button>}
        {isFinished && <Link to={`/teacher/results/${session.id}`}><Button variant="success">View results →</Button></Link>}
      </div>

      {isWaiting ? (
        <>
          <Panel className="xp-hero">
            <h2 style={{ letterSpacing: '0.2em' }}>GAME CODE</h2>
            <div className="game-code-display" aria-label={`Game code ${session.gameCode.split('').join(' ')}`}>{session.gameCode}</div>
            <p className="muted mt-2">Students join at <strong>/join</strong> with this code. Waiting for players…</p>
            <div style={{ fontSize: '2rem', fontWeight: 900 }}>{players.length} joined</div>
          </Panel>

          <div className="row-between mt-2 mb-1">
            <h3 style={{ margin: 0 }}>Players</h3>
            <div className="row">
              <Button size="sm" variant="secondary" onClick={() => lockJoining(session.id, !session.settings.joinLocked)}>
                {session.settings.joinLocked ? 'Joining locked' : 'Lock joining'}
              </Button>
              <Button size="lg" variant="success" onClick={onStart} disabled={busy || players.length === 0}>
                Start game{players.length === 0 ? ' — need players' : ''}
              </Button>
            </div>
          </div>

          {players.length === 0 ? (
            <p className="muted">No players yet — share the code!</p>
          ) : (
            <div className="grid grid-auto">
              {players.map((p) => (
                <Card key={p.uid}>
                  <div className="row-between">
                    <div className="row">
                      <img src={p.photoURL ?? avatarUrl(p.avatarId)} alt="" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                      <strong>{p.displayName}</strong>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removePlayer(session.id, p.uid)} aria-label={`Remove ${p.displayName}`}>Remove ✕</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : isFinished ? (
        <Panel className="xp-hero">
          <h2>Game finished</h2>
          <p className="muted">Results and class analytics are ready.</p>
          <Link to={`/teacher/results/${session.id}`}><Button size="lg" variant="success">Open class results</Button></Link>
        </Panel>
      ) : (
        <>
          <Panel className="mt-2" style={{ textAlign: 'center' }}>
            <div className="muted">Question {Math.min(session.currentQuestionIndex + 1, session.questionCount)} of {session.questionCount}</div>
            <h2 style={{ margin: '10px 0' }}>{currentQ?.question ?? 'Loading question…'}</h2>
            <p className="muted" style={{ fontSize: '0.9rem' }}>
              {players.filter((p) => (p.currentGameState === 'answered')).length} / {players.length} answered
            </p>
            <Button size="lg" variant="success" onClick={onNext} disabled={busy}>
              {session.currentQuestionIndex + 1 >= session.questionCount ? 'Finish game' : 'Next question'}
            </Button>
          </Panel>

          <h3 className="mt-3">Live standings</h3>
          <div className="mt-1">
            {players.slice(0, 12).map((p, i) => (
              <div key={p.uid} className="rank-row">
                <span className="rank-num">#{i + 1}</span>
                <img src={p.photoURL ?? avatarUrl(p.avatarId)} alt="" style={{ width: 30, height: 30, borderRadius: '50%' }} />
                <span className="rank-name">{p.displayName}</span>
                <span className="muted" style={{ fontSize: '0.85rem' }}>{p.correctAnswers}/{p.questionsAnswered} correct</span>
                <span className="rank-score">{formatNumber(p.score)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
