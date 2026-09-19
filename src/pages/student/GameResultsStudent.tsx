// Mined — Student game results screen.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Panel, ProgressBar } from '../../components/ui';
import { Logo } from '../../components/Logo';
import type { GameSession, PlayerState } from '../../lib/types';
import type { PlayQuestion } from '../../lib/gameService';
import { levelProgress } from '../../lib/scoring';
import { formatNumber } from '../../lib/format';
import { useAuth } from '../../auth/AuthContext';
import { ACHIEVEMENTS } from '../../lib/types';
import { doc, onSnapshot, getFirestore } from 'firebase/firestore';

export function GameResultsStudent({ session, players, questions }: {
  session: GameSession;
  players: PlayerState[];
  questions: PlayQuestion[];
}) {
  const { user, profile } = useAuth();
  const me = players.find((p) => p.uid === user?.uid);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  // Track the XP the profile had when results first rendered, so the
  // "LEVEL UP" banner only shows when this game actually raised the level.
  const xpAtRender = useRef<number | null>(null);
  if (profile && xpAtRender.current === null) xpAtRender.current = profile.xp;

  useEffect(() => {
    if (!user) return;
    const un = onSnapshot(doc(getFirestore(), 'gameResults', `${session.id}_${user.uid}`), (snap) => {
      const data = snap.data() as { achievementsUnlocked?: string[] } | undefined;
      if (data?.achievementsUnlocked) setUnlocked(data.achievementsUnlocked);
    });
    return un;
  }, [user, session.id]);

  if (!me) {
    return (
      <div className="page-center">
        <Logo size="md" />
        <h1 className="mt-2">Game complete</h1>
        <p className="muted">Calculating your results…</p>
        <Link to="/student"><Button className="mt-2">Back to Home</Button></Link>
      </div>
    );
  }

  const rank = players.findIndex((p) => p.uid === me.uid) + 1;
  const accuracy = me.questionsAnswered > 0 ? Math.round((me.correctAnswers / me.questionsAnswered) * 100) : 0;
  const lp = levelProgress(profile?.xp ?? me.xpEarned);
  // Compare against the level the player had when this screen first rendered.
  // (The Cloud Function already added this game's XP by the time we got here,
  // so a genuine level-up is "level now > level at first render".)
  const baseline = xpAtRender.current ?? profile?.xp ?? me.xpEarned;
  const leveledUp = baseline > 0 && lp.level > levelProgress(baseline - me.xpEarned > 0 ? baseline - me.xpEarned : 0).level;
  const prevLevel = Math.max(1, lp.level - 1);

  return (
    <div className="game-bg" style={{ backgroundImage: 'linear-gradient(160deg,#0b0f1e,#131a38)' }}>
      <div className="page-center" style={{ minHeight: '90vh' }}>
        <div className="result-hero" style={{ width: '100%', maxWidth: 560 }}>
          <Logo size="md" />
          <h1 className="mt-2">GAME COMPLETE</h1>
          <div className="result-rank" aria-live="polite">
            {rank <= 3 ? ['🥇 1st PLACE', '🥈 2nd PLACE', '🥉 3rd PLACE'][rank - 1] : `#${rank} PLACE`}
          </div>
          <div className="result-score">{formatNumber(me.score)} POINTS</div>

          <div className="result-stats">
            <Panel style={{ padding: 14 }}>
              <div style={{ fontWeight: 900, fontSize: '1.3rem' }}>{me.correctAnswers} / {me.questionsAnswered}</div>
              <div className="muted" style={{ fontSize: '0.85rem' }}>CORRECT</div>
            </Panel>
            <Panel style={{ padding: 14 }}>
              <div style={{ fontWeight: 900, fontSize: '1.3rem' }}>{accuracy}%</div>
              <div className="muted" style={{ fontSize: '0.85rem' }}>ACCURACY</div>
            </Panel>
            <Panel style={{ padding: 14 }}>
              <div style={{ fontWeight: 900, fontSize: '1.3rem' }}>+{formatNumber(me.xpEarned)}</div>
              <div className="muted" style={{ fontSize: '0.85rem' }}>XP EARNED</div>
            </Panel>
          </div>

          <Panel className="mt-2">
            <div style={{ fontWeight: 800 }}>LEVEL {lp.level}</div>
            <ProgressBar value={lp.progress} label="Level progress" />
            <div className="muted mt-1" style={{ fontSize: '0.85rem' }}>
              {formatNumber(lp.intoLevel)} / {formatNumber(lp.needed)} XP — {formatNumber(lp.needed - lp.intoLevel)} to Level {lp.level + 1}
            </div>
            {leveledUp && <div className="level-up-banner mt-1">LEVEL UP! LEVEL {prevLevel} → LEVEL {lp.level}</div>}
          </Panel>

          {unlocked.length > 0 && (
            <Panel className="mt-2">
              <h3 style={{ margin: 0 }}>🏅 Achievements unlocked</h3>
              {unlocked.map((id) => {
                const a = ACHIEVEMENTS.find((x) => x.id === id);
                return a ? <div key={id} className="row mt-1"><span className="ach-icon">{a.icon}</span><span className="ach-name">{a.name}</span></div> : null;
              })}
            </Panel>
          )}

          <div className="row mt-3" style={{ justifyContent: 'center' }}>
            <Link to="/student"><Button size="lg">Back to Home</Button></Link>
            <Link to="/join"><Button size="lg" variant="success">Play another</Button></Link>
          </div>
          <p className="muted mt-2" style={{ fontSize: '0.8rem' }}>{questions.length} questions · {session.quizTitle}</p>
        </div>
      </div>
    </div>
  );
}

