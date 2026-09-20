// Mined — Teacher results: list of finished sessions.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Button, Card, EmptyState } from '../../components/ui';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { timeAgo } from '../../lib/format';

interface SessionSummary {
  id: string;
  quizTitle: string;
  pin?: string;
  gameCode?: string;
  createdAt: string;
  endedAt: string | null;
  status: string;
}

export function TeacherResults() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      try {
        const q = query(collection(db, 'gameSessions'), where('teacherId', '==', profile.uid), where('status', '==', 'finished'), orderBy('createdAt', 'desc'), limit(30));
        const snap = await getDocs(q);
        setSessions(snap.docs.map((d) => ({ ...(d.data() as SessionSummary), id: d.id })));
      } finally {
        setLoading(false);
      }
    })();
  }, [profile]);

  return (
    <div>
      <h1>Results</h1>
      <p className="muted">Finished sessions with class analytics.</p>
      {loading ? <p className="muted mt-2">Loading…</p>
      : sessions.length === 0 ? <EmptyState icon="📊" title="No finished sessions yet" hint="Host and finish a live quiz to see results here." />
      : (
        <div className="grid grid-auto mt-2">
          {sessions.map((s) => (
            <Card key={s.id}>
              <div className="row-between">
                <h3 style={{ margin: 0 }}>{s.quizTitle}</h3>
                <span className="badge">PIN: {s.pin ?? s.gameCode}</span>
              </div>
              <p className="muted mt-1" style={{ margin: '8px 0' }}>Ended {s.endedAt ? timeAgo(s.endedAt) : timeAgo(s.createdAt)}</p>
              <Link to={`/teacher/results/${s.id}`}><Button size="sm">View analytics</Button></Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
