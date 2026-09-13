// MINED — Join Game: student enters a game code and is placed into the session.
import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button, Input } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { joinGameByCode } from '../lib/gameService';

export function Join() {
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onContinue(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (code.trim().length !== 5) {
      setError('Game codes are 5 characters.');
      return;
    }
    setBusy(true);
    try {
      const res = await joinGameByCode(code, profile ? { uid: profile.uid, displayName: profile.displayName, photoURL: profile.photoURL, avatarId: profile.avatarId } : null);
      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        return;
      }
      nav(`/game/${res.sessionId}`);
    } catch {
      setError('Could not join the game. Try again.');
      setBusy(false);
    }
  }

  return (
    <div className="page-center">
      <div className="glass-card">
        <h1>Join Game</h1>
        <p className="muted" style={{ margin: '0 auto 18px', maxWidth: 340 }}>
          {user
            ? 'Enter the code your teacher is showing.'
            : 'Enter the game code — you can sign in after to keep your XP.'}
        </p>

        <form onSubmit={onContinue} style={{ width: '100%' }}>
          <Input
            label="Game code"
            name="gameCode"
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
            placeholder="7K4P2"
            inputMode="text"
            autoComplete="off"
            maxLength={5}
            aria-describedby="code-hint"
          />
          <span id="code-hint" className="muted" style={{ fontSize: '0.85rem', display: 'block', textAlign: 'center', marginTop: -6, marginBottom: 16 }}>
            5 characters — ask your teacher.
          </span>
          <Button type="submit" size="xl" full disabled={busy || code.length !== 5}>
            {busy ? 'Joining…' : 'Continue'}
          </Button>
          {error && <p className="error-text" role="alert" style={{ textAlign: 'center', marginTop: 12 }}>{error}</p>}
        </form>

        <p className="muted" style={{ marginTop: 16, marginBottom: 0 }}>
          {user ? <Link to="/student">Back to Home</Link> : <Link to="/login">Sign in</Link>}
        </p>
      </div>
    </div>
  );
}
