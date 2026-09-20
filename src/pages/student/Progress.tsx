// Mined — Student progress page.
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Card, Panel, Stat, EmptyState } from '../../components/ui';
import { ErrorBanner, describeError } from '../../components/ErrorBanner';
import { formatNumber, timeAgo } from '../../lib/format';
import type { GameResultDoc } from '../../lib/types';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export function StudentProgress() {
  const { profile } = useAuth();
  const [results, setResults] = useState<GameResultDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ technical: string; hint: string } | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const q = query(collection(db, 'gameResults'), where('uid', '==', profile.uid), orderBy('createdAt', 'desc'), limit(30));
        const snap = await getDocs(q);
        setResults(snap.docs.map((d) => d.data() as GameResultDoc));
      } catch (e) {
        // Was try/finally with no catch — a rejected query crashed the page
        // silently. Now: loud banner with a retry.
        setLoadError(describeError(e, 'gameResults query'));
      } finally {
        setLoading(false);
      }
    })();
  }, [profile, reloadTick]);

  if (!profile) return null;
  const accuracy = profile.totalQuestions > 0 ? Math.round((profile.totalCorrect / profile.totalQuestions) * 100) : 0;
  const bestRank = results.length > 0 ? Math.min(...results.map((r) => r.rank)) : 0;

  return (
    <div>
      <h1>My Progress</h1>

      {loadError && (
        <ErrorBanner
          title="Couldn't load your history"
          message="Your quiz history didn't load. Your scores are safe — try again."
          technical={loadError.technical}
          hint={loadError.hint}
          onRetry={() => setReloadTick((t) => t + 1)}
        />
      )}

      <div className="grid grid-4 mt-2">
        <Stat label="Quizzes played" value={formatNumber(results.length)} icon="📺" />
        <Stat label="Accuracy" value={`${accuracy}%`} icon="🎯" />
        <Stat label="Questions answered" value={formatNumber(profile.totalQuestions)} icon="❓" />
        <Stat label="Best finish" value={bestRank ? `#${bestRank}` : '—'} icon="🏅" />
      </div>

      <h2 className="mt-3">Quiz history</h2>
      {loading ? (
        <p className="muted">Loading…</p>
      ) : results.length === 0 ? (
        <EmptyState icon="🗂️" title="No history yet" hint="Join a live quiz to build your stats." />
      ) : (
        <div className="mt-1">
          {results.map((r, i) => (
            <Card key={i} className="rank-row">
              <span className="rank-num">#{r.rank}</span>
              <span className="rank-name">{r.displayName ?? 'Quiz'} · {r.correctAnswers}/{r.questionsAnswered} correct</span>
              <span className="muted">{timeAgo(r.createdAt)}</span>
              <span className="rank-score">{formatNumber(r.score)} pts</span>
            </Card>
          ))}
        </div>
      )}

      <Panel className="mt-2">
        <h3>Lifetime accuracy</h3>
        <p className="muted" style={{ margin: 0 }}>
          {formatNumber(profile.totalCorrect)} of {formatNumber(profile.totalQuestions)} questions correct across all quizzes.
        </p>
      </Panel>
    </div>
  );
}
