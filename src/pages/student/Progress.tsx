// MINED — Student progress page.
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Card, Panel, ProgressBar, Stat, EmptyState } from '../../components/ui';
import { levelProgress } from '../../lib/scoring';
import { formatNumber, modeIcon, modeLabel, timeAgo } from '../../lib/format';
import type { GameResultDoc } from '../../lib/types';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export function StudentProgress() {
  const { profile } = useAuth();
  const [results, setResults] = useState<GameResultDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      try {
        const q = query(collection(db, 'gameResults'), where('uid', '==', profile.uid), orderBy('createdAt', 'desc'), limit(30));
        const snap = await getDocs(q);
        setResults(snap.docs.map((d) => d.data() as GameResultDoc));
      } finally {
        setLoading(false);
      }
    })();
  }, [profile]);

  if (!profile) return null;
  const lp = levelProgress(profile.xp);
  const accuracy = profile.totalQuestions > 0 ? profile.totalCorrect / profile.totalQuestions : 0;

  const modeStats = results.reduce<Record<string, { played: number; won: number; xp: number }>>((acc, r) => {
    const m = acc[r.gameMode] ?? { played: 0, won: 0, xp: 0 };
    m.played++;
    if (r.won) m.won++;
    m.xp += r.xpEarned;
    acc[r.gameMode] = m;
    return acc;
  }, {});

  return (
    <div>
      <h1>My Progress</h1>

      <Panel className="mt-2">
        <div className="row-between">
          <div>
            <div className="xp-level" style={{ fontSize: '2rem' }}>LEVEL {lp.level}</div>
            <div className="muted">{formatNumber(lp.currentXP)} total XP</div>
          </div>
          <div style={{ flex: 1, maxWidth: 380 }}>
            <ProgressBar value={lp.progress} label="Level progress" />
            <div className="muted mt-1" style={{ fontSize: '0.85rem' }}>
              {formatNumber(lp.needed - lp.intoLevel)} XP until Level {lp.level + 1}
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-4 mt-2">
        <Stat label="Games played" value={formatNumber(profile.gamesPlayed)} icon="🎮" />
        <Stat label="Games won" value={formatNumber(profile.gamesWon)} icon="🏆" />
        <Stat label="Accuracy" value={`${Math.round(accuracy * 100)}%`} icon="🎯" />
        <Stat label="Longest streak" value={`🔥 ${profile.longestStreak}`} icon="📅" />
      </div>

      <h2 className="mt-3">By game mode</h2>
      {Object.keys(modeStats).length === 0 ? (
        <EmptyState icon="📊" title="No games recorded yet" hint="Play a game to build your stats." />
      ) : (
        <div className="grid grid-auto mt-1">
          {Object.entries(modeStats).map(([mode, s]) => (
            <Card key={mode}>
              <div className="row">
                <span style={{ fontSize: '1.6rem' }} aria-hidden="true">{modeIcon(mode)}</span>
                <div>
                  <div className="ach-name">{modeLabel(mode)}</div>
                  <div className="ach-desc">{s.played} games · {s.won} wins · {formatNumber(s.xp)} XP</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mt-3">Game history</h2>
      {loading ? (
        <p className="muted">Loading…</p>
      ) : results.length === 0 ? (
        <EmptyState icon="🗂️" title="No history yet" />
      ) : (
        <div className="mt-1">
          {results.map((r, i) => (
            <Card key={i} className="rank-row" texture={false}>
              <span className="rank-num">#{r.rank}</span>
              <span aria-hidden="true">{modeIcon(r.gameMode)}</span>
              <span className="rank-name">{modeLabel(r.gameMode)} · {r.correctAnswers}/{r.questionsAnswered} correct</span>
              <span className="muted">{timeAgo(r.createdAt)}</span>
              <span className="rank-score">{formatNumber(r.score)} pts · +{r.xpEarned} XP</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
