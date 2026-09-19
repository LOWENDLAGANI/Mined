// Mined — Login.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button, Input } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { friendlyAuthError } from '../lib/format';
import { firebaseConfigured } from '../lib/firebase';

export function Login() {
  const nav = useNavigate();
  const location = useLocation();
  const { login, loginGoogle, user, profile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Honor ?next=/join&code=XXXX (Join flow) or ?next=/join plain.
  const nextParam = new URLSearchParams(location.search).get('next');
  const codeParam = new URLSearchParams(location.search).get('code');

  // Already signed in? Send to the right home (or back to Join).
  useEffect(() => {
    if (user && profile) {
      const dest = nextParam ?? (location.state as { from?: string })?.from ??
        (profile.role === 'teacher' ? '/teacher/dashboard' : '/student');
      nav(dest, { replace: true });
    }
  }, [user, profile, location.state, nav, nextParam]);

  function joinDestination(): string {
    return codeParam ? `/join?code=${codeParam}` : '/join';
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password);
      if (nextParam) nav(nextParam === '/join' ? joinDestination() : nextParam, { replace: true });
    } catch (err) {
      const e = err as { code?: string; message?: string };
      setError(friendlyAuthError(e.code ?? '', e.message));
      setBusy(false);
    }
  }

  async function onGoogle() {
    setError('');
    setBusy(true);
    try {
      await loginGoogle();
      if (nextParam) nav(nextParam === '/join' ? joinDestination() : nextParam, { replace: true });
    } catch (err) {
      const e = err as { code?: string; message?: string };
      setError(friendlyAuthError(e.code ?? '', e.message));
      setBusy(false);
    }
  }

  return (
    <div className="page-center">
      <div className="glass-card">
        <h1>Log in</h1>
        {!firebaseConfigured && (
          <p className="error-text" role="alert" style={{ marginBottom: 12 }}>
            Server connection isn’t configured on this deployment — sign-in is disabled. The site owner needs to add the Firebase environment variables and redeploy.
          </p>
        )}
        <form onSubmit={onSubmit} style={{ width: '100%', textAlign: 'left' }}>
          <Input label="Email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <Input label="Password" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" error={error || undefined} />
          <Button type="submit" size="lg" full disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</Button>
        </form>
        <Button variant="secondary" full onClick={onGoogle} disabled={busy} style={{ marginTop: 12 }}>Continue with Google</Button>
        <p className="muted" style={{ marginTop: 16, marginBottom: 0, fontSize: '0.9rem' }}>
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
        <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
          New to Mined? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
