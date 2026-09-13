// Mined — Student achievements gallery.
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Card, EmptyState } from '../../components/ui';
import { ACHIEVEMENTS } from '../../lib/types';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { timeAgo } from '../../lib/format';

export function StudentAchievements() {
  const { profile } = useAuth();
  const [unlockedMap, setUnlockedMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!profile) return;
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'userAchievements', profile.uid, 'items'));
        const map: Record<string, string> = {};
        snap.forEach((d) => { map[d.id] = (d.data() as { unlockedAt?: string }).unlockedAt ?? ''; });
        setUnlockedMap(map);
      } catch { /* stay locked */ }
    })();
  }, [profile]);

  if (!profile) return null;
  const unlockedCount = Object.keys(unlockedMap).length;

  return (
    <div>
      <h1>Achievements</h1>
      <p className="muted">{unlockedCount} of {ACHIEVEMENTS.length} unlocked</p>

      {unlockedCount === 0 ? (
        <EmptyState icon="🏅" title="No achievements yet" hint="Play your first game to start collecting." />
      ) : null}

      <div className="grid grid-auto mt-2">
        {ACHIEVEMENTS.map((a) => {
          const when = unlockedMap[a.id];
          const unlocked = Boolean(when);
          return (
            <Card key={a.id} className={`ach-card ${unlocked ? '' : 'locked'}`}>
              <span className="ach-icon" aria-hidden="true">{unlocked ? a.icon : '🔒'}</span>
              <div>
                <div className="ach-name">{a.name}</div>
                <div className="ach-desc">{a.description}</div>
                {unlocked && <div className="ok-text mt-1" style={{ fontSize: '0.8rem' }}>Unlocked {timeAgo(when)}</div>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
