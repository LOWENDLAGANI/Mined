// Mined — Settings (shared by both roles).
import { useState, type FormEvent } from 'react';
import { Button, Input, Panel } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { updateUserProfile } from '../lib/firestore';
import { AVATARS } from '../assets/avatars';
import { friendlyFirestoreError } from '../lib/format';

export function Settings() {
  const { profile, refreshProfile, resetPassword } = useAuth();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [avatarId, setAvatarId] = useState(profile?.avatarId ?? 'a1');
  const [saved, setSaved] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!profile) return null;

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await updateUserProfile(profile!.uid, { displayName: name.trim(), avatarId });
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(friendlyFirestoreError((err as { code?: string })?.code ?? ''));
    } finally {
      setBusy(false);
    }
  }

  async function onResetPassword() {
    setError('');
    try {
      if (profile?.email) {
        await resetPassword(profile.email);
        setSent(true);
        setTimeout(() => setSent(false), 4000);
      }
    } catch (err) {
      setError(friendlyFirestoreError((err as { code?: string })?.code ?? ''));
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h1>Settings</h1>
      <Panel className="mt-2">
        <h3>Profile</h3>
        <form onSubmit={onSave}>
          <Input label="Display name" name="displayName" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} />
          <div className="field">
            <label>Avatar</label>
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
          <div className="row">
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
            {saved && <span className="ok-text">Saved ✓</span>}
            {error && <span className="error-text">{error}</span>}
          </div>
        </form>
      </Panel>

      <Panel className="mt-2">
        <h3>Account</h3>
        <p className="muted" style={{ marginBottom: 10 }}>
          Signed in as <strong>{profile.email}</strong> ({profile.role})
        </p>
        <div className="row">
          <Button variant="secondary" onClick={onResetPassword}>Send password reset email</Button>
          {sent && <span className="ok-text">Reset email sent ✓</span>}
          {error && <span className="error-text">{error}</span>}
        </div>
      </Panel>
    </div>
  );
}
