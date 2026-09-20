// Mined — Login.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button, Input } from '../components/ui';
import { ErrorBanner, describeError } from '../components/ErrorBanner';
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
  const [errorDetails, setErrorDetails] = useState<{ technical: string; hint: string } | null>(null);
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

  function authError(err: unknown) {
    const e = err as { code?: string; message?: string };
    setError(friendlyAuthError(e.code ?? '', e.message));
    setErrorDetails(describeError(err, 'auth'));
    setBusy(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setErrorDetails(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      if (nextParam) nav(nextParam === '/join' ? joinDestination() : nextParam, { replace: true });
    } catch (err) {
      authError(err);
    }
  }

  async function onGoogle() {
    setError('');
    setErrorDetails(null);
    setBusy(true);
    try {
      await loginGoogle();
      if (nextParam) nav(nextParam === '/join' ? joinDestination() : nextParam, { replace: true });
    } catch (err) {
      authError(err);
    }
  }

  return (
    <div className="page-center">
      <div className="glass-card">
        <h1>Log in</h1>
        {!firebaseConfigured && (
          <div style={{ marginBottom: 12, textAlign: 'left' }}>
            <ErrorBanner
              title="Sign-in is disabled"
              message="Server connection isn’t configured on this deployment. The site owner needs to add the Firebase environment variables and redeploy."
              technical="firebaseConfigured === false (missing VITE_FIREBASE_* / FIREBASE_* env vars at build time)"
              hint="Add the Firebase web config to .env (or .env.local), then rebuild: npm run build. Keys come from Firebase Console → Project settings → Your apps → SDK setup."
            />
          </div>
        )}
        <form onSubmit={onSubmit} style={{ width: '100%', textAlign: 'left' }}>
          <Input label="Email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <Input label="Password" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          {error && (
            <div style={{ marginTop: 12 }}>
              <ErrorBanner
                title="Couldn't log in"
                message={error}
                technical={errorDetails?.technical}
                hint={errorDetails?.hint}
                onDismiss={() => setError('')}
              />
            </div>
          )}
          <Button type="submit" size="lg" full disabled={busy} style={{ marginTop: error ? 12 : undefined }}>{busy ? 'Logging in…' : 'Log in'}</Button>
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
