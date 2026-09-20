// Mined — Sessions: list of hosted live quizzes.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Button, Card, EmptyState } from '../../components/ui';
import { ErrorBanner, describeError } from '../../components/ErrorBanner';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { GameSession } from '../../lib/types';
import { formatNumber, pacingIcon, pacingLabel, timeAgo } from '../../lib/format';

export function TeacherSessions() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ technical: string; hint: string } | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const q = query(collection(db, 'gameSessions'), where('teacherId', '==', profile.uid), orderBy('createdAt', 'desc'), limit(30));
        const snap = await getDocs(q);
        setSessions(snap.docs.map((d) => ({ ...(d.data() as unknown as GameSession), id: d.id })));
      } catch (e) {
        // Was try/finally with no catch — failures showed an empty list.
        setLoadError(describeError(e, 'gameSessions query'));
      } finally {
        setLoading(false);
      }
    })();
  }, [profile, reloadTick]);

  const statusBadge = (s: GameSession['status']) =>
    s === 'waiting' ? <Badge color="rgba(253,203,110,0.2)">Waiting</Badge>
    : s === 'finished' ? <Badge>Finished</Badge>
    : <Badge color="rgba(0,184,148,0.2)">Live</Badge>;

  return (
    <div>
      <h1>Sessions</h1>
      <p className="muted">Your hosted live quizzes. Open a live session to manage the lobby, or view finished results.</p>
      {loadError && (
        <ErrorBanner
          title="Couldn't load your sessions"
          message="The session list didn't load. Try again — your hosted quizzes are not lost."
          technical={loadError.technical}
          hint={loadError.hint}
          onRetry={() => setReloadTick((t) => t + 1)}
        />
      )}
      {loading ? (
        <p className="muted mt-2">Loading…</p>
      ) : sessions.length === 0 ? (
        <EmptyState icon="📺" title="No sessions hosted yet" hint="Start a live quiz from any quiz to see it here." />
      ) : (
        <div className="grid grid-auto mt-2">
          {sessions.map((s) => (
            <Card key={s.id}>
              <div className="row-between">
                <h3 style={{ margin: 0 }}>{s.quizTitle}</h3>
                {statusBadge(s.status)}
              </div>
              <div className="row mt-1" style={{ gap: 8 }}>
                <span aria-hidden="true">{pacingIcon(s.pacing)}</span>
                <span className="muted">{pacingLabel(s.pacing)}</span>
                <span className="badge">PIN: <strong>{(s as unknown as { pin?: string }).pin ?? (s as unknown as { gameCode?: string }).gameCode}</strong></span>
              </div>
              <div className="muted mt-1" style={{ fontSize: '0.85rem' }}>
                {s.status === 'finished' ? `Ended ${s.endedAt ? timeAgo(s.endedAt) : ''}` : `Created ${timeAgo(s.createdAt)}`} · {formatNumber(s.questionCount)} questions
              </div>
              <div className="row mt-1">
                <Link to={`/teacher/sessions/${s.id}`}><Button size="sm">{s.status === 'finished' ? 'View lobby' : 'Open'}</Button></Link>
                {s.status === 'finished' && (
                  <Link to={`/teacher/results/${s.id}`}><Button size="sm" variant="secondary">Results</Button></Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
