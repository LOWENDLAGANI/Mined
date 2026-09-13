// Mined — Student leaderboards (global + weekly).
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Panel } from '../../components/ui';
import { levelForXP } from '../../lib/scoring';
import { formatNumber } from '../../lib/format';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { avatarUrl } from '../../assets/avatars';
import type { UserProfile } from '../../lib/types';

type Tab = 'global' | 'weekly';

export function StudentLeaderboard() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('global');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [results, setResults] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'users'), orderBy('xp', 'desc'), limit(50)));
        setUsers(snap.docs.map((d) => d.data() as UserProfile));
        if (tab === 'weekly') {
          const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
          const rs = await getDocs(collection(db, 'gameResults'));
          const sums: Record<string, number> = {};
          rs.forEach((d) => {
            const r = d.data() as { uid: string; xpEarned: number; createdAt: string };
            if (r.createdAt >= weekAgo) sums[r.uid] = (sums[r.uid] ?? 0) + (r.xpEarned ?? 0);
          });
          setResults(sums);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [tab]);

  const ranked = useMemo(() => {
    if (tab === 'global') {
      return users.map((u, i) => ({ uid: u.uid, name: u.displayName, avatarId: u.avatarId, photoURL: u.photoURL, value: u.xp, sub: `Level ${levelForXP(u.xp)}` , rank: i + 1 }));
    }
    return Object.entries(results)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([uid, xp], i) => {
        const u = users.find((x) => x.uid === uid);
        return { uid, name: u?.displayName ?? 'Student', avatarId: u?.avatarId, photoURL: u?.photoURL, value: xp, sub: `${formatNumber(xp)} XP this week`, rank: i + 1 };
      });
  }, [tab, users, results]);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1>Leaderboard</h1>
      <div className="lb-tabs" role="tablist" aria-label="Leaderboard scope">
        <button className={`lb-tab ${tab === 'global' ? 'active' : ''}`} role="tab" aria-selected={tab === 'global'} onClick={() => setTab('global')}>Global</button>
        <button className={`lb-tab ${tab === 'weekly' ? 'active' : ''}`} role="tab" aria-selected={tab === 'weekly'} onClick={() => setTab('weekly')}>This week</button>
      </div>

      <Panel>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : ranked.length === 0 ? (
          <p className="muted">No players on the board yet.</p>
        ) : (
          ranked.map((p) => (
            <div key={p.uid} className={`rank-row ${profile?.uid === p.uid ? 'me' : ''}`}>
              <span className="rank-num">{p.rank <= 3 ? <span className="medal" aria-label={`Rank ${p.rank}`}>{medals[p.rank - 1]}</span> : `#${p.rank}`}</span>
              <img src={p.photoURL ?? avatarUrl(p.avatarId)} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
              <span className="rank-name">{p.name}</span>
              <span className="muted" style={{ fontSize: '0.85rem' }}>{p.sub}</span>
              <span className="rank-score">{formatNumber(p.value)}{tab === 'global' ? ' XP' : ''}</span>
            </div>
          ))
        )}
      </Panel>
    </div>
  );
}
