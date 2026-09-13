// MINED — Teacher dashboard.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Button, Card, EmptyState, Panel, Stat } from '../../components/ui';
import { subscribeTeacherQuizzes } from '../../lib/firestore';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { GameResultDoc, Quiz } from '../../lib/types';
import { formatNumber, modeIcon, modeLabel, timeAgo } from '../../lib/format';

export function TeacherDashboard() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [recent, setRecent] = useState<GameResultDoc[]>([]);
  const [hosted, setHosted] = useState(0);

  useEffect(() => {
    if (!profile) return;
    const unsub = subscribeTeacherQuizzes(profile.uid, setQuizzes);
    (async () => {
      try {
        const rs = await getDocs(query(collection(db, 'gameResults'), where('teacherId', '==', profile.uid), orderBy('createdAt', 'desc'), limit(200)));
        const list = rs.docs.map((d) => d.data() as GameResultDoc);
        setRecent(list.slice(0, 6));
        const sessionIds = new Set(list.map((r) => r.sessionId));
        setHosted(sessionIds.size);
      } catch { /* ignore */ }
    })();
    return unsub;
  }, [profile]);

  if (!profile) return null;
  const avgScore = recent.length > 0 ? Math.round(recent.reduce((a, r) => a + (r.accuracy ?? 0), 0) / recent.length) : 0;
  const students = new Set(recent.map((r) => r.uid)).size;

  return (
    <div>
      <div className="row-between mb-2">
        <div>
          <h1>Welcome, {profile.displayName} 👋</h1>
          <p className="muted" style={{ margin: 0 }}>Turn learning into a game.</p>
        </div>
        <div className="row">
          <Link to="/teacher/quizzes/new"><Button size="lg">✨ Create Quiz</Button></Link>
          <Link to="/teacher/quizzes"><Button size="lg" variant="success">▶ Start Game</Button></Link>
        </div>
      </div>

      <div className="grid grid-4 mt-2">
        <Stat label="Total quizzes" value={formatNumber(quizzes.length)} icon="📚" />
        <Stat label="Games hosted" value={formatNumber(hosted)} icon="🎮" />
        <Stat label="Students played" value={formatNumber(students)} icon="🧑‍🎓" />
        <Stat label="Avg. accuracy" value={`${avgScore}%`} icon="🎯" />
      </div>

      <div className="grid grid-2 mt-2">
        <Panel>
          <h3>Start a game in seconds</h3>
          <p className="muted">Pick a quiz, choose one of 7 game modes, and share the 5-character game code with your class.</p>
          <div className="row mt-1">
            <Link to="/teacher/quizzes"><Button>My Quizzes</Button></Link>
            <Link to="/teacher/games"><Button variant="secondary">Games</Button></Link>
          </div>
        </Panel>
        <Panel>
          <h3>Recent activity</h3>
          {recent.length === 0 ? (
            <EmptyState icon="📭" title="No games yet" hint="Host your first game to see activity here." />
          ) : (
            <div className="stack">
              {recent.map((r, i) => (
                <Card key={i} className="rank-row" texture={false}>
                  <span aria-hidden="true">{modeIcon(r.gameMode)}</span>
                  <span className="rank-name">{r.displayName} · {modeLabel(r.gameMode)}</span>
                  <span className="muted">{timeAgo(r.createdAt)}</span>
                  <span className="rank-score">+{r.xpEarned} XP</span>
                </Card>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
