// MINED — Student home (Level / XP / streak / JOIN GAME / recent games).
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Logo } from '../../components/Logo';
import { Button, Card, Panel, ProgressBar, Stat, EmptyState } from '../../components/ui';
import { levelProgress } from '../../lib/scoring';
import { ACHIEVEMENTS } from '../../lib/types';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { GameResultDoc } from '../../lib/types';
import { formatNumber, modeIcon, modeLabel, timeAgo } from '../../lib/format';
import { AVATARS } from '../../assets/avatars';

export function StudentHome() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [recent, setRecent] = useState<GameResultDoc[]>([]);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!profile) return;
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

        const ach = await getDocs(collection(db, 'userAchievements', profile.uid, 'items'));
        setUnlocked(new Set(ach.docs.map((d) => d.id)));
      } catch {
        // ignore — panels just stay empty
      }
    })();
  }, [profile]);

  if (!profile) return null;
  const lp = levelProgress(profile.xp);
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
            <div className="muted">Ready to level up, {profile.displayName.split(' ')[0]}?</div>
          </div>
        </div>
        <Button size="lg" onClick={() => nav('/join')}>🎮 JOIN GAME</Button>
      </div>

      <Panel className="xp-hero">
        <div className="xp-level">LEVEL {lp.level}</div>
        <div className="xp-bar">
          <ProgressBar value={lp.progress} label={`Level progress: ${formatNumber(lp.intoLevel)} of ${formatNumber(lp.needed)} XP`} />
        </div>
        <div className="xp-progress-label" style={{ maxWidth: 420, margin: '8px auto 0' }}>
          <span>{formatNumber(lp.currentXP)} XP</span>
          <span className="muted">{formatNumber(lp.nextLevelXP)} XP to Level {lp.level + 1}</span>
        </div>
        <div className="streak-flame mt-2">🔥 {profile.currentStreak}-day streak{profile.longestStreak > 0 ? ` · best: ${profile.longestStreak}` : ''}</div>
      </Panel>

      <div className="grid grid-4 mt-2">
        <Stat label="Games played" value={formatNumber(profile.gamesPlayed)} icon="🎮" />
        <Stat label="Games won" value={formatNumber(profile.gamesWon)} icon="🏆" />
        <Stat label="Accuracy" value={`${accuracy}%`} icon="🎯" />
        <Stat label="Total XP" value={formatNumber(profile.xp)} icon="⚡" />
      </div>

      <div className="grid grid-2 mt-2">
        <Panel>
          <div className="row-between mb-1">
            <h3>Recent games</h3>
            <Link to="/student/progress" className="muted" style={{ fontSize: '0.85rem' }}>See all →</Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState icon="🎲" title="No games yet" hint="Join your first game to start earning XP!" />
          ) : (
            <div className="stack">
              {recent.map((r, i) => (
                <Card key={i} className="rank-row" texture={false}>
                  <span aria-hidden="true">{modeIcon(r.gameMode)}</span>
                  <span className="rank-name">{modeLabel(r.gameMode)} · {r.score} pts</span>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>{timeAgo(r.createdAt)}</span>
                  <span className="rank-score">+{r.xpEarned} XP</span>
                </Card>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <div className="row-between mb-1">
            <h3>Achievements</h3>
            <Link to="/student/achievements" className="muted" style={{ fontSize: '0.85rem' }}>All achievements →</Link>
          </div>
          <div className="stack">
            {ACHIEVEMENTS.slice(0, 4).map((a) => (
              <div key={a.id} className="row">
                <span className="ach-icon" aria-hidden="true">{unlocked.has(a.id) ? a.icon : '🔒'}</span>
                <div>
                  <div className="ach-name">{a.name}</div>
                  <div className="ach-desc">{a.description}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-3" style={{ textAlign: 'center' }}>
        <Logo size="sm" />
        <span className="muted" style={{ marginLeft: 10, fontSize: '0.85rem' }}>Turn learning into a game.</span>
      </div>
    </div>
  );
}

function avatarUrlOf(avatarId?: string): string {
  const a = AVATARS.find((x) => x.id === avatarId) ?? AVATARS[0];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="${a.color}"/><text x="32" y="42" font-size="28" text-anchor="middle" fill="#fff" font-family="sans-serif">${a.emoji}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
