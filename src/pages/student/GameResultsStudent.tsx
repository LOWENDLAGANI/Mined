// Mined — Student quiz results screen: podium + personal stats.
import { Link } from 'react-router-dom';
import { Button, Panel } from '../../components/ui';
import { Logo } from '../../components/Logo';
import { Mascot } from '../../components/Mascot';
import type { GameSession, PlayerState } from '../../lib/types';
import type { PlayQuestion } from '../../lib/gameService';
import { formatNumber } from '../../lib/format';
import { useAuth } from '../../auth/AuthContext';
import { soundPlayer } from '../../assets/brand';
import { useEffect, useRef } from 'react';

export function GameResultsStudent({ session, players, questions }: {
  session: GameSession;
  players: PlayerState[];
  questions: PlayQuestion[];
}) {
  const { user } = useAuth();
  const me = players.find((p) => p.uid === user?.uid);
  const podiumPlayed = useRef(false);

  useEffect(() => {
    if (!podiumPlayed.current) {
      podiumPlayed.current = true;
      soundPlayer.playEffect('podium');
    }
  }, []);

  if (!me) {
    return (
      <div className="page-center">
        <Logo size="md" />
        <h1 className="mt-2">Quiz complete</h1>
        <p className="muted">Calculating your results…</p>
        <Link to="/student"><Button className="mt-2">Back to Home</Button></Link>
      </div>
    );
  }

  const rank = players.findIndex((p) => p.uid === me.uid) + 1;
  const accuracy = me.questionsAnswered > 0 ? Math.round((me.correctAnswers / me.questionsAnswered) * 100) : 0;
  const podium = [players[1], players[0], players[2]]; // 2nd, 1st, 3rd
  const heights = [72, 100, 52];
  const medals = ['🥈', '🥇', '🥉'];

  return (
    <div className="page-center" style={{ minHeight: '90vh' }}>
      <div className="result-hero" style={{ width: '100%', maxWidth: 560 }}>
        <Logo size="md" />
        <h1 className="mt-2">QUIZ COMPLETE</h1>
        <div className="result-rank" aria-live="polite">
          {rank <= 3 ? ['🥈 2nd PLACE', '🥇 1st PLACE', '🥉 3rd PLACE'][rank - 1] : `#${rank} PLACE`}
        </div>
        <div className="result-score">{formatNumber(me.score)} POINTS</div>

        <div className="result-stats">
          <Panel style={{ padding: 14 }}>
            <div style={{ fontWeight: 900, fontSize: '1.3rem' }}>{me.correctAnswers} / {me.questionsAnswered}</div>
            <div className="muted" style={{ fontSize: '0.85rem' }}>CORRECT</div>
          </Panel>
          <Panel style={{ padding: 14 }}>
            <div style={{ fontWeight: 900, fontSize: '1.3rem' }}>{accuracy}%</div>
            <div className="muted" style={{ fontSize: '0.85rem' }}>ACCURACY</div>
          </Panel>
          <Panel style={{ padding: 14 }}>
            <div style={{ fontWeight: 900, fontSize: '1.3rem' }}>🔥 {me.streak}</div>
            <div className="muted" style={{ fontSize: '0.85rem' }}>BEST STREAK</div>
          </Panel>
        </div>

        {players.length >= 1 && (
          <Panel className="mt-2" style={{ padding: 18 }}>
            <h3 style={{ margin: 0, textAlign: 'center' }}>Podium</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, marginTop: 12 }}>
              {podium.map((p, i) =>
                p ? (
                  <div key={p.uid} style={{ textAlign: 'center', minWidth: 88 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.displayName}
                    </div>
                    <div className="muted" style={{ fontSize: '0.78rem' }}>{formatNumber(p.score)}</div>
                    <div
                      style={{
                        height: heights[i],
                        background: i === 1 ? 'linear-gradient(180deg,#f2d38c,#d4a94e)' : 'linear-gradient(180deg,#d8d4c8,#b8b4a8)',
                        borderRadius: '8px 8px 0 0',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        paddingTop: 6,
                        fontSize: '1.2rem',
                      }}
                      aria-hidden="true"
                    >
                      {medals[i]}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          </Panel>
        )}

        <div className="row mt-3" style={{ justifyContent: 'center' }}>
          <Link to="/student"><Button size="lg">Back to Home</Button></Link>
          <Link to="/join"><Button size="lg" variant="success">Join another quiz</Button></Link>
        </div>
        <p className="muted mt-2" style={{ fontSize: '0.8rem' }}>{questions.length} questions · {session.quizTitle}</p>
      </div>
      <Mascot size={90} />
    </div>
  );
}
