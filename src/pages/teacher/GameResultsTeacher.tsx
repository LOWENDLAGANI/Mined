// MINED — Teacher class results & analytics for one finished session.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, EmptyState, Panel, Stat } from '../../components/ui';
import { subscribeSession, subscribeSessionLeaderboard, getSessionAnswers } from '../../lib/gameService';
import type { AnswerDoc, GameSession, PlayerState, Question } from '../../lib/types';
import { subscribeQuestions } from '../../lib/firestore';
import { formatNumber, modeIcon, modeLabel } from '../../lib/format';
import { avatarUrl } from '../../assets/avatars';

export function GameResultsTeacher() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<AnswerDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    const un1 = subscribeSession(sessionId, setSession);
    const un2 = subscribeSessionLeaderboard(sessionId, setPlayers);
    return () => { un1(); un2(); };
  }, [sessionId]);

  useEffect(() => {
    if (!session) return;
    const un = subscribeQuestions(session.quizId, (qs) => {
      setQuestions(qs);
      setLoading(false);
    });
    getSessionAnswers(session.id).then(setAnswers).catch(() => {});
    return un;
  }, [session]);

  const stats = useMemo(() => {
    if (questions.length === 0) return null;
    const perQ = questions.map((q, qi) => {
      const qAnswers = answers.filter((a) => a.questionIndex === qi);
      const correct = qAnswers.filter((a) => a.isCorrect).length;
      const avgTime = qAnswers.length > 0 ? qAnswers.reduce((s, a) => s + a.responseTime, 0) / qAnswers.length : 0;
      return {
        q,
        index: qi,
        attempted: qAnswers.length,
        correct,
        correctPct: qAnswers.length > 0 ? correct / qAnswers.length : 0,
        avgTime,
      };
    });
    const totalAnswered = answers.length;
    const totalCorrect = answers.filter((a) => a.isCorrect).length;
    return {
      perQ,
      avgScore: players.length > 0 ? Math.round(players.reduce((s, p) => s + p.score, 0) / players.length) : 0,
      avgAccuracy: totalAnswered > 0 ? totalCorrect / totalAnswered : 0,
      hardest: [...perQ].filter((p) => p.attempted > 0).sort((a, b) => a.correctPct - b.correctPct)[0],
      easiest: [...perQ].filter((p) => p.attempted > 0).sort((a, b) => b.correctPct - a.correctPct)[0],
    };
  }, [questions, answers, players]);

  if (!session) return <p className="muted">Loading…</p>;
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Link to="/teacher/results" className="muted" style={{ fontSize: '0.85rem' }}>← Results</Link>
      <h1 className="mt-1">{session.quizTitle}</h1>
      <p className="muted">{modeIcon(session.gameMode)} {modeLabel(session.gameMode)} · code {session.gameCode} · {players.length} players</p>

      {players.length === 0 ? (
        <EmptyState icon="📭" title="No player data" />
      ) : (
        <>
          <div className="grid grid-3 mt-2">
            <Stat label="Average score" value={formatNumber(stats?.avgScore ?? 0)} icon="📊" />
            <Stat label="Average accuracy" value={`${Math.round((stats?.avgAccuracy ?? 0) * 100)}%`} icon="🎯" />
            <Stat label="Students" value={players.length} icon="🧑‍🎓" />
          </div>

          <Panel className="mt-2">
            <h3>Student rankings</h3>
            {players.map((p, i) => (
              <div key={p.uid} className="rank-row">
                <span className="rank-num">{i < 3 ? <span className="medal">{medals[i]}</span> : `#${i + 1}`}</span>
                <img src={p.photoURL ?? avatarUrl(p.avatarId)} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                <span className="rank-name">{p.displayName}</span>
                <span className="muted" style={{ fontSize: '0.85rem' }}>{p.correctAnswers}/{p.questionsAnswered} correct</span>
                <span className="rank-score">{formatNumber(p.score)} pts · +{p.xpEarned} XP</span>
              </div>
            ))}
          </Panel>

          {stats && (
            <>
              {stats.hardest && (
                <Card className="mt-2">
                  <h3>🧩 Most difficult question</h3>
                  <p style={{ margin: 0 }}>Q{stats.hardest.index + 1}: {stats.hardest.q.question}</p>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {Math.round(stats.hardest.correctPct * 100)}% correct · avg response {stats.hardest.avgTime.toFixed(1)}s
                  </p>
                </Card>
              )}
              {stats.easiest && (
                <Card className="mt-2">
                  <h3>🌟 Most successful question</h3>
                  <p style={{ margin: 0 }}>Q{stats.easiest.index + 1}: {stats.easiest.q.question}</p>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {Math.round(stats.easiest.correctPct * 100)}% correct · avg response {stats.easiest.avgTime.toFixed(1)}s
                  </p>
                </Card>
              )}

              <h2 className="mt-3">Question performance</h2>
              <div className="mt-1">
                {stats.perQ.map((pq) => (
                  <Card key={pq.q.id} className="rank-row" texture={false}>
                    <span className="rank-num">Q{pq.index + 1}</span>
                    <span className="rank-name" style={{ fontSize: '0.92rem' }}>{pq.q.question}</span>
                    <span className="muted" style={{ fontSize: '0.85rem' }}>
                      {pq.correct}/{pq.attempted} correct ({Math.round(pq.correctPct * 100)}%) · {pq.avgTime.toFixed(1)}s avg
                    </span>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
