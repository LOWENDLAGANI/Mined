// Mined — Registration step 2: create the account.
import { useState, type FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Button, Input } from '../components/ui';
import { ErrorBanner, describeError } from '../components/ErrorBanner';
import { useAuth } from '../auth/AuthContext';
import { AVATARS } from '../assets/avatars';
import { friendlyAuthError } from '../lib/format';
import { firebaseConfigured } from '../lib/firebase';

export function Register() {
  const { role } = useParams<{ role: string }>();
  const nav = useNavigate();
  const { register, loginGoogle } = useAuth();
  const safeRole = role === 'teacher' ? 'teacher' : role === 'student' ? 'student' : null;

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [avatarId, setAvatarId] = useState('a1');
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState<{ technical: string; hint: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!safeRole) {
    return (
      <div className="page-center">
        <div className="glass-card">
          <p className="muted">Unknown account type.</p>
          <Link to="/register">Choose your account type</Link>
        </div>
      </div>
    );
  }

  function authError(err: unknown) {
    const e = err as { code?: string; message?: string };
    setError(friendlyAuthError(e.code ?? '', e.message));
    setErrorDetails(describeError(err, 'auth'));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setErrorDetails(null);
    if (password !== confirm) {
      setError('Passwords don’t match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      await register({ role: safeRole!, displayName: displayName.trim(), email: email.trim(), password, avatarId });
      nav(safeRole === 'teacher' ? '/teacher/dashboard' : '/student');
    } catch (err) {
      authError(err);
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setError('');
    setErrorDetails(null);
    setBusy(true);
    try {
      await loginGoogle();
      nav('/student');
    } catch (err) {
      authError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-center">
      <div className="glass-card" style={{ textAlign: 'left' }}>
        <h1 style={{ textAlign: 'center' }}>
          {safeRole === 'teacher' ? 'Teacher sign-up' : 'Student sign-up'}
        </h1>
        {!firebaseConfigured && (
          <div style={{ marginBottom: 12 }}>
            <ErrorBanner
              title="Sign-up is disabled"
              message="Server connection isn’t configured on this deployment. The site owner needs to add the Firebase environment variables and redeploy."
              technical="firebaseConfigured === false (missing VITE_FIREBASE_* / FIREBASE_* env vars at build time)"
              hint="Add the Firebase web config to .env (or .env.local), then rebuild: npm run build."
            />
          </div>
        )}

        <form onSubmit={onSubmit} style={{ width: '100%' }}>
          <Input label="Display name" name="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={40} placeholder={safeRole === 'teacher' ? 'Mr. Alex' : 'Alex'} />
          <Input label="Email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <Input label="Password" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
          <Input label="Confirm password" name="confirmPassword" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} autoComplete="new-password" />
          {error && (
            <div style={{ marginTop: 4 }}>
              <ErrorBanner
                title={safeRole === 'teacher' ? "Couldn't create the teacher account" : "Couldn't create the account"}
                message={error}
                technical={errorDetails?.technical}
                hint={errorDetails?.hint}
                onDismiss={() => setError('')}
              />
            </div>
          )}

          {safeRole === 'student' && (
            <div className="field">
              <label>Pick an avatar</label>
              <div className="avatar-grid" role="radiogroup" aria-label="Avatar picker">
                {AVATARS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={avatarId === a.id}
                    aria-label={`Avatar ${a.label}`}
                    className={`avatar-option ${avatarId === a.id ? 'selected' : ''}`}
                    style={{ background: a.color }}
                    onClick={() => setAvatarId(a.id)}
                  >
                    {a.emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button type="submit" size="lg" full disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <Button variant="secondary" full onClick={onGoogle} disabled={busy} style={{ marginTop: 12 }}>
          Continue with Google
        </Button>

        <p className="muted" style={{ textAlign: 'center', marginTop: 16, marginBottom: 0 }}>
          Wrong role? <Link to="/register">Switch</Link> · Have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
