// MINED — Student live game screen. Renders the game-mode experience on top
// of the shared question flow. All scoring comes from the Cloud Function.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Panel, ProgressBar, Spinner } from '../../components/ui';
import { Logo } from '../../components/Logo';
import { useAuth } from '../../auth/AuthContext';
import { subscribeSession, subscribePlayers, subscribeMyPlayer, getSessionQuestions, submitAnswer, leaveSession } from '../../lib/gameService';
import { APP_ASSETS } from '../../assets/textures';
import { avatarUrl } from '../../assets/avatars';
import { GAME_MODES, TEAM_COLORS, TREASURE_LOCATIONS } from '../../lib/gameModes';
import type { GameSession, PlayerState, Question } from '../../lib/types';
import { formatNumber } from '../../lib/format';
import { GameResultsStudent } from './GameResultsStudent';

const KEYS = ['A', 'B', 'C', 'D'];
const KEY_COLORS = ['#e17055', '#0984e3', '#00b894', '#fdcb6e'];

export function StudentGame() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, profile } = useAuth();
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [me, setMe] = useState<PlayerState | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [missing, setMissing] = useState(false);
  const [kicked, setKicked] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    const un1 = subscribeSession(sessionId, (s) => { if (!s) setMissing(true); else setSession(s); });
    const un2 = subscribePlayers(sessionId, setPlayers);
    return () => { un1(); un2(); };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !user) return;
    return subscribeMyPlayer(sessionId, user.uid, (p) => {
      if (!p) {
        // Only treat as kicked once we had a player doc and session is live/waiting.
        setMe(null);
      } else {
        setMe(p);
        setKicked(false);
      }
    });
  }, [sessionId, user]);

  useEffect(() => {
    if (!session) return;
    getSessionQuestions(session.quizId).then(setQuestions).catch(() => setQuestions([]));
  }, [session?.quizId]);

  useEffect(() => {
    if (me === null && session) {
      const t = setTimeout(() => { if (!me) setKicked(true); }, 4000);
      return () => clearTimeout(t);
    }
  }, [me, session]);

  if (missing) {
    return <GameMessage icon="🕳️" text="Game not found." sub="Check the code with your teacher." />;
  }
  if (kicked) {
    return <GameMessage icon="🚪" text="You were removed from the game." sub="Ask your teacher to re-add you." />;
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

  const mode = GAME_MODES[session.gameMode];

  if (session.status === 'finished') {
    return <GameResultsStudent session={session} players={players} questions={questions} />;
  }

  if (session.status === 'waiting') {
    return <WaitingRoom session={session} me={me} />;
  }

  if (session.status === 'countdown') {
    return <Countdown session={session} />;
  }

  // question_active | question_results
  const q = questions[session.currentQuestionIndex];
  if (!q) return <div className="page-center"><Spinner /></div>;

  return (
    <div
      className="game-bg"
      style={{
        backgroundImage:
          session.gameMode === 'boss' || session.gameMode === 'battle'
            ? APP_ASSETS.texture_boss_arena.value
            : session.gameMode === 'treasure'
            ? APP_ASSETS.texture_treasure_map.value
            : APP_ASSETS.texture_game_background.value,
      }}
    >
      <div className="game-topbar">
        <Logo size="sm" />
        <span className="muted" style={{ fontWeight: 700 }}>{mode.icon} {mode.name}</span>
        <span className="timer-pill">{q && session.status === 'question_active' ? <TimerInline endsAt={session.questionEndsAt} /> : '—'}</span>
      </div>

      {me && <ModeHud session={session} me={me} players={players} />}

      {session.status === 'question_active' && (
        <QuestionView
          key={session.currentQuestionIndex}
          session={session}
          question={q}
          questionIndex={session.currentQuestionIndex}
          questionCount={session.questionCount}
          uid={user.uid}
        />
      )}

      {session.status === 'question_results' && (
        <Panel className="question-panel">
          <h2>Question {session.currentQuestionIndex + 1} results</h2>
          <p className="muted">Get ready for the next one…</p>
          {q.explanation && <p>💡 {q.explanation}</p>}
        </Panel>
      )}

      <div className="mt-3" style={{ textAlign: 'center' }}>
        <Button variant="ghost" size="sm" onClick={() => leaveSession(session.id)}>Leave game</Button>
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
      <Link to="/join"><Button className="mt-2">Back to Join Game</Button></Link>
    </div>
  );
}

function WaitingRoom({ session, me }: { session: GameSession; me: PlayerState | null }) {
  return (
    <div className="game-bg" style={{ backgroundImage: APP_ASSETS.texture_game_background.value }}>
      <div className="page-center" style={{ minHeight: '80vh' }}>
        <Logo size="md" tagline />
        <h1 className="mt-2">You’re in! 🎉</h1>
        <p className="muted">Waiting for {me ? 'other players' : 'the teacher to start'}…</p>
        <div className="game-code-display mt-1" style={{ fontSize: '2.2rem' }}>{session.gameCode}</div>
        <p className="muted mt-2">{session.quizTitle}</p>
        <div className="spinner-wrap"><Spinner label="Waiting for the game to start" /></div>
        <p className="muted" style={{ fontSize: '0.85rem' }}>Get your tapping finger ready ⛏️</p>
      </div>
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
    <div className="page-center" style={{ backgroundImage: APP_ASSETS.texture_game_background.value }}>
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
      <ProgressBar value={frac} label="Time remaining" color={frac < 0.25 ? 'linear-gradient(90deg,#e74c5e,#e74c5e)' : 'linear-gradient(90deg,#00b894,#6c5ce7)'} />
    </div>
  );
}

// ---------- Question + answer flow ----------

function QuestionView({ session, question, questionIndex, questionCount, uid }: {
  session: GameSession;
  question: Question;
  questionIndex: number;
  questionCount: number;
  uid: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; points?: number; xp?: number; streak?: number } | null>(null);
  const answeredRef = useRef(false);
  const [deadlinePassed, setDeadlinePassed] = useState(false);

  // Reveal correct answer when the question window closes (question_results state arrives via session status).
  useEffect(() => {
    if (!session.questionEndsAt) return;
    const iv = setInterval(() => {
      if (Date.now() > new Date(session.questionEndsAt!).getTime()) setDeadlinePassed(true);
    }, 500);
    return () => clearInterval(iv);
  }, [session.questionEndsAt]);

  async function choose(idx: number) {
    if (answeredRef.current || submitting) return;
    answeredRef.current = true;
    setSelected(idx);
    setSubmitting(true);
    try {
      const res = await submitAnswer(session.id, question.id, idx);
      setFeedback({ correct: !!res.data?.isCorrect, points: res.data?.pointsEarned, xp: res.data?.xpEarned, streak: res.data?.streak });
    } catch {
      setFeedback({ correct: false });
    } finally {
      setSubmitting(false);
    }
  }

  const reveal = deadlinePassed || session.status !== 'question_active';

  return (
    <>
      <TimerBar endsAt={session.questionEndsAt} totalSeconds={question.timeLimit} />
      <div className="question-panel">
        <div className="muted" style={{ fontWeight: 700 }}>Question {questionIndex + 1} / {questionCount}</div>

        <h2 className="question-text">{question.question}</h2>
      </div>

      <div className="options-grid">
        {question.options.map((opt, i) => {
          const isCorrectOption = i === question.correctOption;
          const cls =
            selected === i && feedback
              ? feedback.correct ? 'option-btn correct' : 'option-btn wrong'
              : reveal && isCorrectOption
              ? 'option-btn correct'
              : selected === i && !feedback
              ? 'option-btn'
              : reveal
              ? 'option-btn dimmed'
              : 'option-btn';
          return (
            <button key={i} className={cls} onClick={() => choose(i)} disabled={selected !== null || submitting || reveal}>
              <span className="option-key" style={{ background: KEY_COLORS[i] }} aria-hidden="true">{KEYS[i]}</span>
              {opt}
            </button>
          );
        })}
      </div>

      {selected !== null && !feedback && (
        <p className="answered-note" aria-live="polite">Answer locked in… ⛏️</p>
      )}

      {feedback && (
        <div className={`feedback-overlay ${feedback.correct ? 'feedback-correct' : 'feedback-wrong'}`} aria-live="assertive">
          <div className="feedback-title">{feedback.correct ? 'CORRECT!' : 'NOT QUITE'}</div>
          {feedback.correct && (
            <>
              <div className="feedback-pts">+{formatNumber(feedback.points ?? 0)}</div>
              <div className="feedback-detail">+{feedback.xp ?? 0} XP {feedback.streak && feedback.streak > 1 ? <span className="streak-flames">🔥 {feedback.streak}</span> : null}</div>
            </>
          )}
          {!feedback.correct && <div className="feedback-detail">The correct answer was: <strong>{question.options[question.correctOption]}</strong></div>}
          {question.explanation && <div className="feedback-detail">💡 {question.explanation}</div>}
        </div>
      )}
    </>
  );
}

// ---------- Mode HUDs (race / battle / boss / treasure / survival / team) ----------

function ModeHud({ session, me, players }: { session: GameSession; me: PlayerState; players: PlayerState[] }) {
  const mode = session.gameMode;
  if (mode === 'race') return <RaceHud me={me} players={players} />;
  if (mode === 'battle') return <BattleHud me={me} players={players} />;
  if (mode === 'boss') return <BossHud session={session} me={me} players={players} />;
  if (mode === 'treasure') return <TreasureHud me={me} />;
  if (mode === 'survival') return <SurvivalHud me={me} players={players} />;
  if (mode === 'team') return <TeamHud me={me} players={players} />;
  return <ClassicHud me={me} players={players} />;
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

function RaceHud({ me, players }: { me: PlayerState; players: PlayerState[] }) {
  const sorted = [...players].sort((a, b) => (b.position ?? 0) - (a.position ?? 0)).slice(0, 8);
  return (
    <div className="track-wrap" style={{ backgroundImage: APP_ASSETS.texture_race_track.value }} role="img" aria-label="Race progress">
      {sorted.map((p) => (
        <div key={p.uid} className="track-lane">
          <div className="track-lane-line" />
          <span className="track-runner" style={{ left: `calc(${Math.min(100, (p.position ?? 0) * 100)}% - 20px)` }} title={p.displayName}>
            {p.uid === me.uid ? '🚀' : '🏃'}
          </span>
          <span className="muted" style={{ position: 'absolute', left: 4, top: -14, fontSize: '0.72rem' }}>
            {p.uid === me.uid ? `⭐ ${p.displayName}` : p.displayName}
          </span>
        </div>
      ))}
      <div style={{ textAlign: 'right', position: 'relative' }}><span className="track-finish">🏁</span></div>
    </div>
  );
}

function BattleHud({ me, players }: { me: PlayerState; players: PlayerState[] }) {
  const maxHp = 100;
  const sorted = [...players].slice(0, 6);
  return (
    <div className="hud-row">
      <div className="card hud-card">
        <div className="muted">Your HP</div>
        <ProgressBar value={Math.max(0, (me.lives ?? 0) > 0 ? 1 : 0)} label="HP" color="linear-gradient(90deg,#e17055,#d63031)" />
        <div className="muted mt-1" style={{ fontSize: '0.8rem' }}>⚔️ ATK {Math.round((me.score / 100) || 0)} · ❤️ {me.lives ?? 0}</div>
      </div>
      {sorted.map((p) => (
        <div key={p.uid} className="card hud-card" style={{ minWidth: 140 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.displayName}</div>
          <ProgressBar value={Math.max(0, Math.min(1, (p.lives ?? 0) / 3))} label={`${p.displayName} HP`} color="linear-gradient(90deg,#e17055,#d63031)" />
          <div className="muted mt-1" style={{ fontSize: '0.8rem' }}>{formatNumber(p.score)} pts</div>
        </div>
      ))}
      <span className="visually-hidden">{maxHp}</span>
    </div>
  );
}

function BossHud({ session, me, players }: { session: GameSession; me: PlayerState; players: PlayerState[] }) {
  const maxHp = session.settings.bossHp || 100;
  const damage = useMemo(() => players.reduce((s, p) => s + (p.score / 100) * 25, 0), [players]);
  const hp = Math.max(0, maxHp - damage);
  const defeated = hp <= 0;
  return (
    <div className="boss-wrap">
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <span className="boss-emoji" style={{ filter: defeated ? 'grayscale(1) opacity(0.4)' : undefined }} role="img" aria-label={`Boss ${session.settings.bossName}`}>
          {session.settings.bossEmoji ?? '🐉'}
        </span>
        {defeated && <div className="level-up-banner">BOSS DEFEATED! 🎉</div>}
      </div>
      <div style={{ fontWeight: 900, fontSize: '1.1rem', marginTop: 8 }}>{session.settings.bossName ?? 'The Boss'}</div>
      <ProgressBar className="boss-hp-bar" value={hp / maxHp} label="Boss HP" color="linear-gradient(90deg,#d63031,#e17055)" />
      <div className="muted mt-1">{formatNumber(Math.ceil(hp))} / {formatNumber(maxHp)} HP · your damage: {formatNumber(Math.round((me.score / 100) * 25))}</div>
    </div>
  );
}

function TreasureHud({ me }: { me: PlayerState }) {
  const unlocked = me.locationsUnlocked ?? 0;
  return (
    <div className="map-grid" role="list" aria-label="Treasure map">
      {TREASURE_LOCATIONS.map((loc, i) => (
        <div key={loc.id} role="listitem" className={`map-node ${i < unlocked ? 'unlocked' : ''}`}>
          <div className={`map-node-emoji ${i < unlocked ? '' : 'map-node-locked'}`} aria-hidden="true">{i < unlocked ? loc.emoji : '🔒'}</div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>{loc.name}</div>
        </div>
      ))}
      <div className="map-node unlocked" style={{ gridColumn: '1 / -1' }}>
        💰 <strong>{me.coins ?? 0}</strong> coins collected
      </div>
    </div>
  );
}

function SurvivalHud({ me, players }: { me: PlayerState; players: PlayerState[] }) {
  const alive = players.filter((p) => !p.eliminated).length;
  return (
    <div className="hud-row">
      <div className="card hud-card">
        <div className="muted">Your lives</div>
        <div className="lives-display" aria-label={`${me.lives ?? 0} lives remaining`}>
          {Array.from({ length: Math.max(0, me.lives ?? 0) }).map((_, i) => <span key={i}>❤️</span>)}
          {Array.from({ length: Math.max(0, 3 - (me.lives ?? 0)) }).map((_, i) => <span key={`e${i}`}>🖤</span>)}
        </div>
        {(me.lives ?? 0) <= 0 && <div className="error-text mt-1">You’re eliminated 👻</div>}
      </div>
      <div className="card hud-card"><div style={{ fontWeight: 900, fontSize: '1.5rem' }}>{alive}</div><div className="muted">Players alive</div></div>
    </div>
  );
}

function TeamHud({ me, players }: { me: PlayerState; players: PlayerState[] }) {
  const teams = TEAM_COLORS.slice(0, 3).map((t) => {
    const members = players.filter((p) => p.teamId === t.id);
    const score = members.reduce((s, p) => s + p.score, 0);
    return { ...t, score, members: members.length, mine: me.teamId === t.id };
  }).sort((a, b) => b.score - a.score);
  const max = Math.max(1, ...teams.map((t) => t.score));
  return (
    <div className="team-board">
      {teams.map((t) => (
        <div key={t.id} className="team-row" style={t.mine ? { borderColor: t.color, boxShadow: `0 0 0 2px ${t.color}55` } : undefined}>
          <span aria-hidden="true" style={{ fontSize: '1.3rem' }}>{t.emoji}</span>
          <strong>{t.name}{t.mine ? ' (you)' : ''}</strong>
          <ProgressBar value={t.score / max} label={`${t.name} score`} color={`linear-gradient(90deg, ${t.color}, ${t.color}aa)`} />
          <span style={{ fontWeight: 900 }}>{formatNumber(t.score)}</span>
        </div>
      ))}
    </div>
  );
}
