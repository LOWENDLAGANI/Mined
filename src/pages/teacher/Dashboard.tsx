// Mined — Teacher dashboard.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Button, Card, EmptyState, Panel, Stat } from '../../components/ui';
import { ErrorBanner, describeError } from '../../components/ErrorBanner';
import { subscribeTeacherQuizzes } from '../../lib/firestore';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { GameResultDoc, Quiz } from '../../lib/types';
import { formatNumber, timeAgo } from '../../lib/format';

export function TeacherDashboard() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [recent, setRecent] = useState<GameResultDoc[]>([]);
  const [hosted, setHosted] = useState(0);
  const [activityError, setActivityError] = useState<{ technical: string; hint: string } | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!profile) return;
    const unsub = subscribeTeacherQuizzes(profile.uid, setQuizzes);
    (async () => {
      setActivityError(null);
      try {
        const rs = await getDocs(query(collection(db, 'gameResults'), where('teacherId', '==', profile.uid), orderBy('createdAt', 'desc'), limit(200)));
        const list = rs.docs.map((d) => d.data() as GameResultDoc);
        setRecent(list.slice(0, 6));
        const sessionIds = new Set(list.map((r) => r.sessionId));
        setHosted(sessionIds.size);
      } catch (e) {
        // Was silent — stats showed 0 and the teacher couldn't tell why.
        setActivityError(describeError(e, 'gameResults (teacher) query'));
      }
    })();
    return unsub;
  }, [profile, reloadTick]);

  if (!profile) return null;
  const avgScore = recent.length > 0 ? Math.round(recent.reduce((a, r) => a + (r.accuracy ?? 0), 0) / recent.length) : 0;
  const students = new Set(recent.map((r) => r.uid)).size;

  return (
    <div>
      <div className="row-between mb-2">
        <div>
          <h1>Welcome, {profile.displayName}</h1>
        </div>
        <div className="row">
          <Link to="/teacher/quizzes/new"><Button size="lg">Create quiz</Button></Link>
          <Link to="/teacher/quizzes"><Button size="lg" variant="success">Start live quiz</Button></Link>
        </div>
      </div>

      {activityError && (
        <ErrorBanner
          title="Couldn't load class activity"
          message="Session stats and recent activity didn't load. Your quizzes are unaffected — try again."
          technical={activityError.technical}
          hint={activityError.hint}
          onRetry={() => setReloadTick((t) => t + 1)}
        />
      )}

      <div className="grid grid-4 mt-2">
        <Stat label="Total quizzes" value={formatNumber(quizzes.length)} icon="📚" />
        <Stat label="Sessions hosted" value={formatNumber(hosted)} icon="📺" />
        <Stat label="Students played" value={formatNumber(students)} icon="🧑‍🎓" />
        <Stat label="Avg. accuracy" value={`${avgScore}%`} icon="🎯" />
      </div>

      <div className="grid grid-2 mt-2">
        <Panel>
          <h3>Run a live quiz</h3>
          <p className="muted">Pick a quiz, choose how it's paced, and share the 5-character PIN with your class.</p>
          <div className="row mt-1">
            <Link to="/teacher/quizzes"><Button>My Quizzes</Button></Link>
            <Link to="/teacher/sessions"><Button variant="secondary">Sessions</Button></Link>
          </div>
        </Panel>
        <Panel>
          <h3>Recent activity</h3>
          {recent.length === 0 ? (
            <EmptyState icon="📭" title="Nothing here yet" hint="Host your first live quiz to see activity." />
          ) : (
            <div className="stack">
              {recent.map((r, i) => (
                <Card key={i} className="rank-row">
                  <span className="rank-name">{r.displayName}</span>
                  <span className="muted">{timeAgo(r.createdAt)}</span>
                  <span className="rank-score">{r.correctAnswers}/{r.questionsAnswered} correct</span>
                </Card>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
