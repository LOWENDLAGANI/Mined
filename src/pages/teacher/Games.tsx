// Mined — Games: list of hosted sessions.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Button, Card, EmptyState } from '../../components/ui';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { GameSession } from '../../lib/types';
import { formatNumber, modeIcon, modeLabel, timeAgo } from '../../lib/format';

export function TeacherGames() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      try {
        const q = query(collection(db, 'gameSessions'), where('teacherId', '==', profile.uid), orderBy('createdAt', 'desc'), limit(30));
        const snap = await getDocs(q);
        setSessions(snap.docs.map((d) => ({ ...(d.data() as GameSession), id: d.id })));
      } finally {
        setLoading(false);
      }
    })();
  }, [profile]);

  const statusBadge = (s: GameSession['status']) =>
    s === 'waiting' ? <Badge color="rgba(253,203,110,0.2)">Waiting</Badge>
    : s === 'finished' ? <Badge>Finished</Badge>
    : <Badge color="rgba(0,184,148,0.2)">Live</Badge>;

  return (
    <div>
      <h1>Games</h1>
      <p className="muted">Your hosted game sessions. Open a live game to manage the lobby, or view finished results.</p>
      {loading ? (
        <p className="muted mt-2">Loading…</p>
      ) : sessions.length === 0 ? (
        <EmptyState icon="🎮" title="No games hosted yet" hint="Start a game from any quiz to see it here." />
      ) : (
        <div className="grid grid-auto mt-2">
          {sessions.map((s) => (
            <Card key={s.id}>
              <div className="row-between">
                <h3 style={{ margin: 0 }}>{s.quizTitle}</h3>
                {statusBadge(s.status)}
              </div>
              <div className="row mt-1" style={{ gap: 8 }}>
                <span aria-hidden="true">{modeIcon(s.gameMode)}</span>
                <span className="muted">{modeLabel(s.gameMode)}</span>
                <span className="badge">Code: <strong>{s.gameCode}</strong></span>
              </div>
              <div className="muted mt-1" style={{ fontSize: '0.85rem' }}>
                {s.status === 'finished' ? `Ended ${s.endedAt ? timeAgo(s.endedAt) : ''}` : `Created ${timeAgo(s.createdAt)}`} · {formatNumber(s.questionCount)} questions
              </div>
              <div className="row mt-1">
                <Link to={`/teacher/games/${s.id}`}><Button size="sm">{s.status === 'finished' ? 'View lobby' : 'Open'}</Button></Link>
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
