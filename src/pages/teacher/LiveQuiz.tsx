// Mined — Teacher live quiz host screen: PIN lobby, question control,
// live standings, self-paced progress grid.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Button, Card, Panel, Spinner } from '../../components/ui';
import { ErrorBanner, describeError } from '../../components/ErrorBanner';
import { subscribeSession, subscribePlayers, startQuiz, advanceQuestion, endQuiz, removePlayer, lockJoining, getSessionQuestions } from '../../lib/gameService';
import { subscribeQuestions } from '../../lib/firestore';
import type { GameSession, PlayerState, Question } from '../../lib/types';
import { formatNumber, pacingIcon, pacingLabel } from '../../lib/format';
import { avatarUrl } from '../../assets/avatars';

export function LiveQuiz() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const nav = useNavigate();
  const { profile } = useAuth();
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [listenError, setListenError] = useState(false);
  const [actionError, setActionError] = useState<{ technical: string; hint: string } | null>(null);

  useEffect(() => {
    if (!sessionId || !profile) return;
    const un1 = subscribeSession(sessionId, (s) => {
      if (!s) { setNotFound(true); return; }
      setSession(s);
    }, () => setListenError(true));
    // onError → explicit banner; a silent failure here looked like "0 players".
    const un2 = subscribePlayers(sessionId, setPlayers, () => setListenError(true));
    return () => { un1(); un2(); };
  }, [sessionId, profile]);

  useEffect(() => {
    if (!session) return;
    return subscribeQuestions(session.quizId, setQuestions);
  }, [session?.quizId]);

  if (notFound) {
    return (
      <div className="page-center" style={{ alignItems: 'stretch' }}>
        <div style={{ width: '100%', maxWidth: 640 }}>
          <ErrorBanner
            title="Session not found"
            message="This live quiz doesn't exist (anymore) or your account doesn't own it."
            technical={`sessionId=${sessionId}, owner=${profile?.uid ?? 'unknown'}`}
            hint="Check the gameSessions collection in the Firestore console — the doc must exist with ownerUid matching the signed-in teacher. If it was deleted, start a new session from the Sessions page."
          >
            <Link to="/teacher/sessions"><Button variant="secondary">Back to Sessions</Button></Link>
          </ErrorBanner>
        </div>
      </div>
    );
  }
  if (listenError) {
    return (
      <div className="page-center" style={{ alignItems: 'stretch' }}>
        <div style={{ width: '100%', maxWidth: 640 }}>
          <ErrorBanner
            title="Lost connection to the quiz"
            message="Live updates stopped. Check your internet, then refresh this page."
            technical={`onSnapshot error on gameSessions/${sessionId} or its players subcollection`}
            hint="This is usually a Firestore rules problem (ownerUid check) or a dropped connection. Test rules in the Firebase console → Firestore → Rules playground, and confirm the teacher is the session's ownerUid."
            onRetry={() => window.location.reload()}
            retryLabel="Refresh page"
          />
        </div>
      </div>
    );
  }
  if (!session) return <Spinner />;

  const isWaiting = session.status === 'waiting';
  const isFinished = session.status === 'finished';
  const currentQ = questions[session.currentQuestionIndex];
  const isSelfPaced = session.pacing === 'self_paced';

  // All host actions now surface failures loudly instead of the button just
  // doing nothing (which looked like a dead app to the teacher).
  async function runAction(fn: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(describeError(e, 'host action'));
    } finally {
      setBusy(false);
    }
  }
  const onStart = () => runAction(() => startQuiz(session!.id));
  const onNext = () => runAction(() => advanceQuestion(session!.id));
  const onEnd = () => runAction(() => endQuiz(session!.id));

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {actionError && (
        <ErrorBanner
          title="The quiz didn't respond"
          message="Your last action (start / next / end) failed. The quiz state hasn't changed — try again."
          technical={actionError.technical}
          hint={actionError.hint}
          onDismiss={() => setActionError(null)}
        />
      )}
      <div className="row-between mb-2">
        <div>
          <Link to="/teacher/sessions" className="muted" style={{ fontSize: '0.85rem' }}>← Sessions</Link>
          <h1 style={{ margin: '6px 0 0' }}>{session.quizTitle}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {pacingIcon(session.pacing)} {pacingLabel(session.pacing)} · <strong>{session.status.replace('_', ' ').toUpperCase()}</strong>
          </p>
        </div>
        {!isWaiting && !isFinished && <Button variant="danger" onClick={onEnd} disabled={busy}>End quiz</Button>}
        {isFinished && <Link to={`/teacher/results/${session.id}`}><Button variant="success">View results →</Button></Link>}
      </div>

      {isWaiting ? (
        <>
          <Panel className="xp-hero">
            <h2 style={{ letterSpacing: '0.2em' }}>QUIZ PIN</h2>
            <div className="game-code-display" aria-label={`PIN ${session.pin.split('').join(' ')}`}>{session.pin}</div>
            <p className="muted mt-2">Students join at <strong>/join</strong> with this PIN. Waiting for players…</p>
            <div style={{ fontSize: '2rem', fontWeight: 900 }}>{players.length} joined</div>
          </Panel>

          <div className="row-between mt-2 mb-1">
            <h3 style={{ margin: 0 }}>Players</h3>
            <div className="row">
              <Button size="sm" variant="secondary" onClick={() => runAction(() => lockJoining(session.id, !session.settings.joinLocked))}>
                {session.settings.joinLocked ? 'Joining locked' : 'Lock joining'}
              </Button>
              <Button size="lg" variant="success" onClick={onStart} disabled={busy || players.length === 0}>
                Start quiz{players.length === 0 ? ' — need players' : ''}
              </Button>
            </div>
          </div>

          {players.length === 0 ? (
            <p className="muted">No players yet — share the PIN!</p>
          ) : (
            <div className="grid grid-auto">
              {players.map((p) => (
                <Card key={p.uid}>
                  <div className="row-between">
                    <div className="row">
                      <img src={p.photoURL ?? avatarUrl(p.avatarId)} alt="" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                      <strong>{p.displayName}</strong>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => runAction(() => removePlayer(session.id, p.uid))} aria-label={`Remove ${p.displayName}`}>Remove ✕</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : isFinished ? (
        <Panel className="xp-hero">
          <h2>Quiz finished</h2>
          <p className="muted">Results and class analytics are ready.</p>
          <Link to={`/teacher/results/${session.id}`}><Button size="lg" variant="success">Open class results</Button></Link>
        </Panel>
      ) : isSelfPaced ? (
        <>
          <Panel className="mt-2">
            <h3 style={{ margin: 0 }}>Live progress</h3>
            <p className="muted" style={{ marginTop: 4 }}>
              Each student moves through the questions at their own pace. {players.filter((p) => p.playerStatus === 'finished').length} finished.
            </p>
          </Panel>
          <h3 className="mt-3">Student progress</h3>
          <div className="mt-1">
            {players.map((p) => {
              const idx = (p.playerQuestionIndex ?? 0) + 1;
              const finished = p.playerStatus === 'finished';
              return (
                <div key={p.uid} className="rank-row">
                  <img src={p.photoURL ?? avatarUrl(p.avatarId)} alt="" style={{ width: 30, height: 30, borderRadius: '50%' }} />
                  <span className="rank-name">{p.displayName}</span>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>
                    {finished ? '✓ Done' : `Question ${Math.min(idx, session.questionCount)} / ${session.questionCount}`}
                  </span>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>{p.correctAnswers}/{p.questionsAnswered} correct</span>
                  <span className="rank-score">{formatNumber(p.score)}</span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <Panel className="mt-2" style={{ textAlign: 'center' }}>
            <div className="muted">Question {Math.min(session.currentQuestionIndex + 1, session.questionCount)} of {session.questionCount}</div>
            <h2 style={{ margin: '10px 0' }}>{currentQ?.question ?? 'Loading question…'}</h2>
            <p className="muted" style={{ fontSize: '0.9rem' }}>
              {players.filter((p) => (p.currentGameState === 'answered')).length} / {players.length} answered
            </p>
            <Button size="lg" variant="success" onClick={onNext} disabled={busy}>
              {session.currentQuestionIndex + 1 >= session.questionCount ? 'Finish quiz' : 'Next question'}
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
