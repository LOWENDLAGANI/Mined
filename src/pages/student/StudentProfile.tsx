// Mined — Student profile.
import { useAuth } from '../../auth/AuthContext';
import { Panel, Stat } from '../../components/ui';
import { formatNumber } from '../../lib/format';
import { avatarUrl } from '../../assets/avatars';

export function StudentProfile() {
  const { profile } = useAuth();
  if (!profile) return null;
  const accuracy = profile.totalQuestions > 0 ? Math.round((profile.totalCorrect / profile.totalQuestions) * 100) : 0;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1>Profile</h1>
      <Panel className="mt-2">
        <div className="row" style={{ gap: 18 }}>
          <img src={profile.photoURL ?? avatarUrl(profile.avatarId)} alt="" style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover' }} />
          <div>
            <h2 style={{ margin: 0 }}>{profile.displayName}</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>{profile.email}</p>
          </div>
        </div>
      </Panel>

      <div className="grid grid-3 mt-2">
        <Stat label="Questions answered" value={formatNumber(profile.totalQuestions)} icon="❓" />
        <Stat label="Correct answers" value={formatNumber(profile.totalCorrect)} icon="✓" />
        <Stat label="Accuracy" value={`${accuracy}%`} icon="🎯" />
      </div>
    </div>
  );
}
