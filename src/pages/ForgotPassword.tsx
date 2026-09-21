// Mined — Forgot password (sends Firebase reset email).
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input } from '../components/ui';
import { AuthSplit } from '../components/AuthSplit';
import { ErrorBanner, describeError } from '../components/ErrorBanner';
import { useAuth } from '../auth/AuthContext';
import { friendlyAuthError } from '../lib/format';

export function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState<{ technical: string; hint: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      setError(friendlyAuthError(e.code ?? '', e.message));
      setErrorDetails(describeError(err, 'sendPasswordResetEmail'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthSplit>
      <div>
        <h1>Reset your password</h1>
        {sent ? (
          <>
            <p className="ok-text">Check your inbox — we sent a reset link to {email}.</p>
            <Link to="/login"><Button variant="secondary" style={{ marginTop: 8 }}>Back to login</Button></Link>
          </>
        ) : (
          <form onSubmit={onSubmit} style={{ width: '100%', textAlign: 'left' }}>
            <Input label="Email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            <Button type="submit" size="lg" full disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</Button>
            {error && (
              <div style={{ marginTop: 10 }}>
                <ErrorBanner
                  title="Couldn't send the reset email"
                  message={error}
                  technical={errorDetails?.technical}
                  hint={errorDetails?.hint}
                  onDismiss={() => setError('')}
                />
              </div>
            )}
            <p className="muted" style={{ textAlign: 'center', marginTop: 14, marginBottom: 0 }}>
              <Link to="/login">Back to login</Link>
            </p>
          </form>
        )}
      </div>
    </AuthSplit>
  );
}
