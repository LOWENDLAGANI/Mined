// Mined — Teacher profile.
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Panel, Stat } from '../../components/ui';
import { formatNumber } from '../../lib/format';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export function TeacherProfile() {
  const { profile } = useAuth();
  const [quizCount, setQuizCount] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [studentsReached, setStudentsReached] = useState(0);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      try {
        const qs = await getDocs(query(collection(db, 'quizzes'), where('ownerId', '==', profile.uid)));
        setQuizCount(qs.size);
        const gs = await getDocs(query(collection(db, 'gameSessions'), where('teacherId', '==', profile.uid)));
        setSessionCount(gs.size);
        const rs = await getDocs(query(collection(db, 'gameResults'), where('teacherId', '==', profile.uid)));
        setStudentsReached(new Set(rs.docs.map((d) => (d.data() as { uid: string }).uid)).size);
      } catch { /* ignore */ }
    })();
  }, [profile]);

  if (!profile) return null;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1>Profile</h1>
      <Panel className="mt-2">
        <div className="row" style={{ gap: 18 }}>
          {profile.photoURL ? (
            <img src={profile.photoURL} alt="" style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem', fontWeight: 900 }}>
              {profile.displayName.charAt(0)}
            </div>
          )}
          <div>
            <h2 style={{ margin: 0 }}>{profile.displayName}</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>{profile.email}</p>
            <span className="badge">🎓 Teacher</span>
          </div>
        </div>
      </Panel>
      <div className="grid grid-3 mt-2">
        <Stat label="Quizzes created" value={formatNumber(quizCount)} icon="📚" />
        <Stat label="Sessions hosted" value={formatNumber(sessionCount)} icon="📺" />
        <Stat label="Students reached" value={formatNumber(studentsReached)} icon="🧑‍🎓" />
      </div>
    </div>
  );
}
