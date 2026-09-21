// Mined — Student live quiz screen. Renders classic (teacher-paced) or
// self-paced play on top of the shared question flow. All scoring comes from
// the Cloud Function.
// ANTI-CHEAT: this screen uses sanitized question data (no answer keys) —
// correctness arrives only via the submitAnswer result or the server-published
// session.lastReveal after the question window closes.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Panel, ProgressBar, Spinner } from '../../components/ui';
import { ErrorBanner, describeError } from '../../components/ErrorBanner';
import { Logo } from '../../components/Logo';
import { Mascot } from '../../components/Mascot';
import { useAuth } from '../../auth/AuthContext';
import { subscribeSession, subscribePlayers, subscribeMyPlayer, getPlayQuestions, submitAnswer, advanceSelfPaced, leaveSession } from '../../lib/gameService';
import type { PlayQuestion } from '../../lib/gameService';
import { APP_ASSETS } from '../../assets/textures';
import { PLAY_BACKGROUND_SOURCES } from '../../assets/brand';
import { soundPlayer } from '../../assets/brand';
import type { GameSession, PlayerState } from '../../lib/types';
import { formatNumber } from '../../lib/format';
import { GameResultsStudent } from './GameResultsStudent';
import { saveActiveSession, clearActiveSession } from '../../lib/sessionTracker';

// Kahoot-style answer buttons: shape + color per slot.
const KEYS = ['▲', '◆', '●', '■'];
const KEY_COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c'];

export function Play() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [me, setMe] = useState<PlayerState | null>(null);
  const [questions, setQuestions] = useState<PlayQuestion[]>([]);
  const [missing, setMissing] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [bgFailed, setBgFailed] = useState(false);
  const [bgSrc, setBgSrc] = useState(PLAY_BACKGROUND_SOURCES[0]);
  const [loadError, setLoadError] = useState<{ technical: string; hint: string } | null>(null);
  const [questionsTick, setQuestionsTick] = useState(0); // bump to retry question load
  const hadMe = useRef(false);
  const questionMusicOn = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    const un1 = subscribeSession(sessionId, (s) => { if (!s) setMissing(true); else setSession(s); });
    const un2 = subscribePlayers(sessionId, setPlayers);
    return () => { un1(); un2(); };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !user) return;
    return subscribeMyPlayer(sessionId, user.uid, (p) => {
      if (p) {
        hadMe.current = true;
        setMe(p);
      } else {
        setMe(null);
        // A missing player doc only means "kicked" if we actually had a doc
        // before — otherwise it's just the initial snapshot racing the join.
        if (hadMe.current) { setKicked(true); clearActiveSession(); }
      }
    });
  }, [sessionId, user]);

  // Remember this session so a refresh / app quit can resume via the
  // dashboard's "Continue where you left off" card. Cleared on finish, kick,
  // or explicit leave below.
  useEffect(() => {
    if (!session || !user) return;
    saveActiveSession({ sessionId: session.id, quizTitle: session.quizTitle, pin: session.pin });
  }, [session?.id, user?.uid]);

  useEffect(() => {
    if (session?.status === 'finished') clearActiveSession();
  }, [session?.status]);

  useEffect(() => {
    if (!session) return;
    setLoadError(null);
    getPlayQuestions(session.id)
      .then(setQuestions)
      .catch((e) => {
        // Was silent (empty questions) — now a loud, expandable banner.
        setLoadError(describeError(e, 'getPlayQuestions'));
      });
  }, [session?.id, questionsTick]);

  // Loop the question track while a question is open (both pacings).
  useEffect(() => {
    const playing = session?.status === 'question_active' || (session?.pacing === 'self_paced' && me?.playerStatus === 'playing' && session?.status !== 'finished' && session?.status !== 'waiting');
    if (playing && !questionMusicOn.current) {
      questionMusicOn.current = true;
      soundPlayer.startLoop('question');
    } else if (!playing && questionMusicOn.current) {
      questionMusicOn.current = false;
      soundPlayer.stop();
    }
  }, [session?.status, session?.pacing, me?.playerStatus]);

  useEffect(() => () => soundPlayer.stop(), []);

  // Try the next background candidate if the first fails to load.
  useEffect(() => {
    if (!bgFailed) return;
    const idx = PLAY_BACKGROUND_SOURCES.indexOf(bgSrc);
    const next = PLAY_BACKGROUND_SOURCES[idx + 1];
    if (next) { setBgSrc(next); setBgFailed(false); }
  }, [bgFailed, bgSrc]);

  if (loadError) {
    return (
      <div className="page-center" style={{ alignItems: 'stretch' }}>
        <div style={{ width: '100%', maxWidth: 640 }}>
          <ErrorBanner
            title="Couldn't load the questions"
            message="The quiz can't start without its questions. Check your connection, then try again."
            technical={loadError.technical}
            hint={loadError.hint}
            onRetry={() => setQuestionsTick((t) => t + 1)}
          />
        </div>
      </div>
    );
  }
  if (missing) {
    return <GameMessage icon="🔍" text="Quiz not found." sub="Check the PIN with your teacher." />;
  }
  if (kicked) {
    return <GameMessage icon="🚪" text="You were removed from the quiz." sub="Ask your teacher to re-add you." />;
  }
  if (!session || !user) {
    return (
      <div className="page-center">
        <Logo size="md" />
        <Spinner />
        {!user && <p className="muted mt-2">Loading… <Link to="/login">Sign in</Link></p>}
      </div>
    );
  }

  if (session.status === 'finished') {
    return <GameResultsStudent session={session} players={players} questions={questions} />;
  }

  if (session.status === 'waiting') {
    return <WaitingRoom session={session} me={me} />;
  }

  if (session.status === 'countdown') {
    return <Countdown session={session} />;
  }

  const isSelfPaced = session.pacing === 'self_paced';

  // Self-paced: the player's own question index drives the view.
  const questionIndex = isSelfPaced ? (me?.playerQuestionIndex ?? 0) : session.currentQuestionIndex;
  const q = questions[questionIndex];
  if (!q) {
    return (
      <div className="page-center" style={{ alignItems: 'stretch' }}>
        <div style={{ width: '100%', maxWidth: 640 }}>
          <ErrorBanner
            title="Question not available"
            message={
              questions.length === 0
                ? 'No questions were returned for this quiz. The quiz may be misconfigured.'
                : `Question ${questionIndex + 1} is missing from the loaded set (loaded ${questions.length}).`
            }
            technical={`questionIndex=${questionIndex}, questionsLoaded=${questions.length}, sessionId=${session.id}`}
            hint={
              questions.length === 0
                ? 'Open the quiz in the editor and confirm it still has questions. Also check the getPlayQuestions Cloud Function logs: npx firebase-tools functions:log'
                : 'The session\'s currentQuestionIndex / playerQuestionIndex points past the question list. Check which questions getPlayQuestions returns for this session.'
            }
            onRetry={() => setQuestionsTick((t) => t + 1)}
            retryLabel="Reload questions"
          />
        </div>
      </div>
    );
  }

  const showReveal = !isSelfPaced && session.status === 'question_results';
  const reveal = showReveal ? session.lastReveal ?? null : null;

  const bgStyle = APP_ASSETS.texture_play_background.kind === 'css'
    ? { backgroundImage: APP_ASSETS.texture_play_background.value }
    : undefined;

  return (
    <div className="play-bg" style={bgStyle}>
      {!bgStyle && (
        <img
          src={bgSrc}
          alt=""
          className="play-bg-img"
          onError={() => setBgFailed(true)}
          style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: -1 }}
        />
      )}
      <div className="play-topbar">
        <span className="play-topbar-brand"><Logo size="sm" /></span>
        <span className="muted" style={{ fontWeight: 700 }}>
          {isSelfPaced ? '🚶 Self-paced' : '📺 Classic'} · {questionIndex + 1}/{session.questionCount}
        </span>
        <span className="timer-pill">
          {isSelfPaced
            ? me?.playerQuestionEndsAt && me.currentGameState === 'question' ? <TimerInline endsAt={me.playerQuestionEndsAt} /> : '—'
            : session.status === 'question_active' ? <TimerInline endsAt={session.questionEndsAt} /> : '—'}
        </span>
      </div>

      {me && !isSelfPaced && <ClassicHud me={me} players={players} />}
      {me && isSelfPaced && <SelfPacedHud me={me} total={session.questionCount} />}

      {me?.currentGameState === 'question' || (!isSelfPaced && session.status === 'question_active') ? (
        <QuestionView
          key={`${questionIndex}-${me?.playerQuestionIndex ?? 'shared'}`}
          session={session}
          question={q}
          questionIndex={questionIndex}
          questionCount={session.questionCount}
          me={me}
          dismissable={isSelfPaced}
        />
      ) : null}

      {showReveal && (
        <Panel className="question-panel">
          <h2>Question {session.currentQuestionIndex + 1} results</h2>
          {reveal ? (
            <>
              <p style={{ fontWeight: 800 }}>✓ Correct answer: {q.options[reveal.correctOption] ?? '—'}</p>
              {reveal.explanation && <p className="muted">{reveal.explanation}</p>}
            </>
          ) : (
            <p className="muted">Get ready for the next one…</p>
          )}
          {session.settings.showLeaderboard !== false && <LeaderboardStrip players={players} meUid={user.uid} />}
        </Panel>
      )}

      {isSelfPaced && me?.currentGameState === 'answered' && (
        <SelfPacedNext sessionId={session.id} />
      )}

      <div className="mt-3" style={{ textAlign: 'center' }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            soundPlayer.stop();
            clearActiveSession();
            await leaveSession(session.id);
            nav('/join');
          }}
        >
          Leave quiz
        </Button>
      </div>
    </div>
  );
}

// ---------- Sub-views ----------

function GameMessage({ icon, text, sub }: { icon: string; text: string; sub?: string }) {
  return (
    <div className="page-center" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '3.5rem' }} aria-hidden="true">{icon}</div>
      <h1>{text}</h1>
      {sub && <p className="muted">{sub}</p>}
      <Link to="/join"><Button className="mt-2">Back to Join</Button></Link>
    </div>
  );
}

function WaitingRoom({ session, me }: { session: GameSession; me: PlayerState | null }) {
  return (
    <div className="page-center" style={{ minHeight: '80vh' }}>
      <Logo size="md" />
      <h1 className="mt-2">You're in!</h1>
      <p className="muted">Waiting for {me ? 'other players' : 'the teacher to start'}…</p>
      <div className="game-code-display mt-1" style={{ fontSize: '2.2rem' }}>{session.pin}</div>
      <p className="muted mt-2">{session.quizTitle}</p>
      <Mascot size={120} />
      <div className="spinner-wrap"><Spinner label="Waiting for the quiz to start" /></div>
    </div>
  );
}

function Countdown({ session }: { session: GameSession }) {
  const [n, setN] = useState(3);
  useEffect(() => {
    const iv = setInterval(() => setN((v) => Math.max(1, v - 1)), 1000);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="page-center">
      <div className="countdown-num" aria-live="assertive">{n}</div>
      <p className="muted">Get ready…</p>
      <p className="muted" style={{ fontSize: '0.8rem' }}>{session.quizTitle}</p>
    </div>
  );
}

function TimerInline({ endsAt }: { endsAt: string | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);
  if (!endsAt) return <span>⏱ —</span>;
  const msLeft = new Date(endsAt).getTime() - now;
  const secs = Math.max(0, Math.ceil(msLeft / 1000));
  return <span className={secs <= 5 ? 'low' : ''}>⏱ {secs}s</span>;
}

function TimerBar({ endsAt, totalSeconds }: { endsAt: string | null; totalSeconds: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(iv);
  }, []);
  if (!endsAt) return null;
  const msLeft = new Date(endsAt).getTime() - now;
  const frac = Math.max(0, Math.min(1, msLeft / (totalSeconds * 1000)));
  return (
    <div className="timer-bar">
      <ProgressBar value={frac} label="Time remaining" color={frac < 0.25 ? 'linear-gradient(90deg,#e21b3c,#e21b3c)' : 'linear-gradient(90deg,#26890c,#1368ce)'} />
    </div>
  );
}

// ---------- Question + answer flow ----------

function QuestionView({ session, question, questionIndex, questionCount, me, dismissable }: {
  session: GameSession;
  question: PlayQuestion;
  questionIndex: number;
  questionCount: number;
  me: PlayerState | null;
  /** Self-paced: let the student dismiss the overlay to reach "Next question". */
  dismissable?: boolean;
}) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; points?: number; streak?: number; correctOption?: number; explanation?: string } | null>(null);
  const [submitError, setSubmitError] = useState<{ technical: string; hint: string } | null>(null);
  const answeredRef = useRef(false);

  async function choose(idx: number) {
    if (answeredRef.current || submitting) return;
    answeredRef.current = true;
    setSelected(idx);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await submitAnswer(session.id, question.id, idx);
      const correct = !!res.data?.isCorrect;
      soundPlayer.playEffect(correct ? 'correct' : 'wrong');
      setFeedback({
        correct,
        points: res.data?.pointsEarned,
        streak: res.data?.streak,
        correctOption: res.data?.reveal?.correctOption,
        explanation: res.data?.reveal?.explanation,
      });
    } catch (e) {
      // Previously this faked a "wrong answer" feedback — the student never
      // knew the server rejected their answer. Now: loud banner + retry.
      soundPlayer.playEffect('wrong');
      answeredRef.current = false; // allow re-answering after retry
      setSelected(null);
      setSubmitError(describeError(e, 'submitAnswer'));
    } finally {
      setSubmitting(false);
    }
  }

  const closed = !session.pacing || (session.pacing === 'classic' && session.status !== 'question_active');
  const timerEndsAt = session.pacing === 'self_paced'
    ? (me?.playerQuestionEndsAt ?? null)
    : session.questionEndsAt;

  return (
    <>
      <TimerBar endsAt={timerEndsAt} totalSeconds={question.timeLimit} />
      <div className="question-panel">
        <div className="muted" style={{ fontWeight: 700 }}>Question {questionIndex + 1} / {questionCount}</div>
        <h2 className="question-text">{question.question}</h2>
      </div>

      <div className="options-grid">
        {question.options.map((opt, i) => {
          const cls =
            selected === i && feedback
              ? feedback.correct ? 'option-btn correct' : 'option-btn wrong'
              : feedback && i === feedback.correctOption
              ? 'option-btn correct'
              : 'option-btn';
          return (
            <button key={i} className={cls} onClick={() => choose(i)} disabled={selected !== null || submitting || closed}>
              <span className="option-key" style={{ background: KEY_COLORS[i] }} aria-hidden="true">{KEYS[i]}</span>
              {opt}
            </button>
          );
        })}
      </div>

      {selected !== null && !feedback && (
        <p className="answered-note" aria-live="polite">Answer locked in…</p>
      )}

      {submitError && (
        <div className="mt-2" style={{ maxWidth: 640, margin: '16px auto 0' }}>
          <ErrorBanner
            title="Your answer didn't reach the server"
            message="Your answer was NOT saved. You can answer again — no points were lost."
            technical={submitError.technical}
            hint={submitError.hint}
            onDismiss={() => setSubmitError(null)}
            retryLabel="OK, retry"
          />
        </div>
      )}

      {feedback && (
        <div className={`feedback-overlay ${feedback.correct ? 'feedback-correct' : 'feedback-wrong'}`} aria-live="assertive">
          <div className="feedback-title">{feedback.correct ? 'CORRECT!' : 'NOT QUITE'}</div>
          {feedback.correct && (
            <div className="feedback-pts">+{formatNumber(feedback.points ?? 0)}</div>
          )}
          {feedback.correct && feedback.streak != null && feedback.streak > 2 && (
            <div className="feedback-detail">🔥 {feedback.streak} in a row</div>
          )}
          {feedback.correctOption != null && (
            <div className="feedback-detail">The correct answer was: <strong>{question.options[feedback.correctOption]}</strong></div>
          )}
          {feedback.explanation && <div className="feedback-detail">{feedback.explanation}</div>}
          {dismissable && (
            <button
              type="button"
              className="feedback-continue"
              onClick={() => setFeedback(null)}
            >
              Continue →
            </button>
          )}
        </div>
      )}
    </>
  );
}

function ClassicHud({ me, players }: { me: PlayerState; players: PlayerState[] }) {
  const rank = players.findIndex((p) => p.uid === me.uid) + 1;
  return (
    <div className="hud-row">
      <div className="card hud-card"><div style={{ fontWeight: 900, fontSize: '1.5rem' }}>#{rank}</div><div className="muted">Your rank</div></div>
      <div className="card hud-card"><div style={{ fontWeight: 900, fontSize: '1.5rem' }}>{formatNumber(me.score)}</div><div className="muted">Score</div></div>
      <div className="card hud-card"><div style={{ fontWeight: 900, fontSize: '1.5rem' }}>🔥 {me.streak}</div><div className="muted">Streak</div></div>
    </div>
  );
}

function SelfPacedHud({ me, total }: { me: PlayerState; total: number }) {
  const idx = (me.playerQuestionIndex ?? 0) + 1;
  return (
    <div className="hud-row">
      <div className="card hud-card"><div style={{ fontWeight: 900, fontSize: '1.5rem' }}>{Math.min(idx, total)}/{total}</div><div className="muted">Progress</div></div>
      <div className="card hud-card"><div style={{ fontWeight: 900, fontSize: '1.5rem' }}>{formatNumber(me.score)}</div><div className="muted">Score</div></div>
      <div className="card hud-card"><div style={{ fontWeight: 900, fontSize: '1.5rem' }}>🔥 {me.streak}</div><div className="muted">Streak</div></div>
    </div>
  );
}

function LeaderboardStrip({ players, meUid }: { players: PlayerState[]; meUid: string }) {
  const top = players.slice(0, 5);
  const myRank = players.findIndex((p) => p.uid === meUid) + 1;
  return (
    <div className="mt-2">
      <h3 style={{ margin: 0 }}>Leaderboard</h3>
      <div className="mt-1">
        {top.map((p, i) => (
          <div key={p.uid} className={`rank-row ${p.uid === meUid ? 'me' : ''}`}>
            <span className="rank-num">#{i + 1}</span>
            <span className="rank-name">{p.displayName}</span>
            <span className="rank-score">{formatNumber(p.score)}</span>
          </div>
        ))}
        {myRank > 5 && (() => {
          const mine = players[myRank - 1];
          return mine ? (
            <div className="rank-row me">
              <span className="rank-num">#{myRank}</span>
              <span className="rank-name">{mine.displayName}</span>
              <span className="rank-score">{formatNumber(mine.score)}</span>
            </div>
          ) : null;
        })()}
      </div>
    </div>
  );
}

/** Self-paced: after feedback, the student taps to open their next question. */
function SelfPacedNext({ sessionId }: { sessionId: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [nextError, setNextError] = useState<{ technical: string; hint: string } | null>(null);
  if (done) return <p className="muted" style={{ textAlign: 'center' }}>Finishing…</p>;
  return (
    <div style={{ textAlign: 'center' }} className="mt-2">
      {nextError && (
        <div style={{ maxWidth: 640, margin: '0 auto 12px', textAlign: 'left' }}>
          <ErrorBanner
            title="Couldn't open the next question"
            message="The next question didn't load. Your progress is saved — try again."
            technical={nextError.technical}
            hint={nextError.hint}
            onDismiss={() => setNextError(null)}
            onRetry={() => setNextError(null)}
            retryLabel="OK"
          />
        </div>
      )}
      <Button
        size="lg"
        variant="success"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setNextError(null);
          try {
            const res = await advanceSelfPaced(sessionId);
            if (res.data?.finished) setDone(true);
          } catch (e) {
            setNextError(describeError(e, 'advanceSelfPaced'));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Loading…' : 'Next question →'}
      </Button>
    </div>
  );
}
