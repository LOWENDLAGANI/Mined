// Mined — Student profile.
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Panel, Stat } from '../../components/ui';
import { levelProgress } from '../../lib/scoring';
import { formatNumber } from '../../lib/format';
import { ACHIEVEMENTS } from '../../lib/types';
import { avatarUrl } from '../../assets/avatars';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export function StudentProfile() {
  const { profile } = useAuth();
  const [unlocked, setUnlocked] = useState(0);

  useEffect(() => {
    if (!profile) return;
    getDocs(collection(db, 'userAchievements', profile.uid, 'items'))
      .then((s) => setUnlocked(s.size))
      .catch(() => {});
  }, [profile]);

  if (!profile) return null;
  const lp = levelProgress(profile.xp);
  const accuracy = profile.totalQuestions > 0 ? Math.round((profile.totalCorrect / profile.totalQuestions) * 100) : 0;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1>Profile</h1>
      <Panel className="mt-2" >
        <div className="row" style={{ gap: 18 }}>
          <img src={profile.photoURL ?? avatarUrl(profile.avatarId)} alt="" style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover' }} />
          <div>
            <h2 style={{ margin: 0 }}>{profile.displayName}</h2>
            <div className="muted">Level {lp.level} · {formatNumber(profile.xp)} XP</div>
            <div className="muted" style={{ fontSize: '0.9rem' }}>🔥 {profile.currentStreak} current · {profile.longestStreak} longest</div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-3 mt-2">
        <Stat label="Games played" value={formatNumber(profile.gamesPlayed)} icon="🎮" />
        <Stat label="Games won" value={formatNumber(profile.gamesWon)} icon="🏆" />
        <Stat label="Accuracy" value={`${accuracy}%`} icon="🎯" />
      </div>

      <Panel className="mt-2">
        <h3>Achievements</h3>
        <p className="muted">{unlocked} / {ACHIEVEMENTS.length} unlocked</p>
        <div className="row" style={{ fontSize: '1.6rem', gap: 14, flexWrap: 'wrap' }}>
          {ACHIEVEMENTS.map((a) => (
            <span key={a.id} title={`${a.name} — ${a.description}`}>{a.icon}</span>
          ))}
        </div>
      </Panel>
    </div>
  );
}
