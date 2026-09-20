// Mined — Student home (accuracy stats + JOIN + recent quizzes).
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Button, Card, Panel, Stat, EmptyState } from '../../components/ui';
import { ErrorBanner, describeError } from '../../components/ErrorBanner';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { GameResultDoc } from '../../lib/types';
import { formatNumber, timeAgo } from '../../lib/format';
import { AVATARS } from '../../assets/avatars';

export function StudentHome() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [recent, setRecent] = useState<GameResultDoc[]>([]);
  const [recentError, setRecentError] = useState<{ technical: string; hint: string } | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!profile) return;
    setRecentError(null);
    (async () => {
      try {
        const q = query(
          collection(db, 'gameResults'),
          where('uid', '==', profile.uid),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        const snap = await getDocs(q);
        setRecent(snap.docs.map((d) => d.data() as GameResultDoc));
      } catch (e) {
        // Was silent — the "Recent quizzes" panel just looked empty.
        setRecentError(describeError(e, 'recent gameResults query'));
      }
    })();
  }, [profile, reloadTick]);

  if (!profile) return null;
  const accuracy = profile.totalQuestions > 0 ? Math.round((profile.totalCorrect / profile.totalQuestions) * 100) : 0;
  const avatar = AVATARS.find((a) => a.id === profile.avatarId) ?? AVATARS[0];

  return (
    <div>
      <div className="row-between mb-2">
        <div className="row">
          <img
            src={profile.photoURL ?? avatarUrlOf(profile.avatarId)}
            alt=""
            style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }}
          />
          <div>
            <div style={{ fontWeight: 900, fontSize: '1.3rem' }}>{profile.displayName}</div>
            <div className="muted">{profile.role === 'teacher' ? 'Teacher account' : 'Student'}</div>
          </div>
        </div>
        <Button size="lg" onClick={() => nav('/join')}>Join a quiz</Button>
      </div>

      <Panel className="xp-hero">
        <div className="xp-level" style={{ fontSize: '1.8rem' }}>{avatar.emoji} Ready when you are</div>
        <p className="muted" style={{ margin: '6px 0 0' }}>Enter the PIN your teacher shows to jump into a live quiz.</p>
      </Panel>

      <div className="grid grid-3 mt-2">
        <Stat label="Quizzes played" value={formatNumber(recent.length > 0 ? recent.length : 0)} icon="📺" />
        <Stat label="Accuracy" value={`${accuracy}%`} icon="🎯" />
        <Stat label="Questions answered" value={formatNumber(profile.totalQuestions)} icon="❓" />
      </div>

      <div className="grid grid-2 mt-2">
        <Panel>
          <div className="row-between mb-1">
            <h3>Recent quizzes</h3>
            <Link to="/student/progress" className="muted" style={{ fontSize: '0.85rem' }}>See all →</Link>
          </div>
          {recentError && (
            <ErrorBanner
              title="Couldn't load recent quizzes"
              message="Your quiz history didn't load. Try again."
              technical={recentError.technical}
              hint={recentError.hint}
              onRetry={() => setReloadTick((t) => t + 1)}
            />
          )}
          {recent.length === 0 ? (
            <EmptyState icon="📺" title="No quizzes yet" hint="Join your first live quiz with a PIN." />
          ) : (
            <div className="stack">
              {recent.map((r, i) => (
                <Card key={i} className="rank-row">
                  <span className="rank-name">{r.quizTitle || 'Quiz'} · {r.score} pts</span>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>{timeAgo(r.createdAt)}</span>
                  <span className="rank-score">{r.correctAnswers}/{r.questionsAnswered} correct</span>
                </Card>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <h3>How it works</h3>
          <div className="stack mt-1">
            <div className="row"><span style={{ fontSize: '1.3rem' }} aria-hidden="true">1️⃣</span><span>Your teacher starts a live quiz and shows a PIN.</span></div>
            <div className="row"><span style={{ fontSize: '1.3rem' }} aria-hidden="true">2️⃣</span><span>You enter the PIN on the Join page.</span></div>
            <div className="row"><span style={{ fontSize: '1.3rem' }} aria-hidden="true">3️⃣</span><span>Answer fast — quicker answers earn more points.</span></div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function avatarUrlOf(avatarId?: string): string {
  const a = AVATARS.find((x) => x.id === avatarId) ?? AVATARS[0];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="${a.color}"/><text x="32" y="42" font-size="28" text-anchor="middle" fill="#fff" font-family="sans-serif">${a.emoji}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
