// MINED — Protected routes. Verify Firebase auth state AND Firestore role
// before rendering role-specific pages (spec §8).
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Button } from '../components/ui';

function ProfileProblem({ kind }: { kind: 'denied' | 'timeout' | 'error' }) {
  const { logout } = useAuth();
  const messages: Record<typeof kind, { title: string; body: string }> = {
    denied: {
      title: 'Database access blocked',
      body:
        'You’re signed in, but Firestore refused to read your profile. This almost always means the Firestore database hasn’t been created yet, or its security rules deny reads. In the Firebase Console: Build → Firestore Database → Create database (production mode), then deploy the rules from this repo: firebase deploy --only firestore:rules',
    },
    timeout: {
      title: 'Connection timed out',
      body: 'Couldn’t reach the database within 10 seconds. Check your internet connection (and that the Firestore region is reachable), then try again.',
    },
    error: {
      title: 'Something went wrong',
      body: 'Your profile couldn’t be loaded. Check the browser console (F12) for the Firebase error details, then try again.',
    },
  };
  const m = messages[kind];
  return (
    <div className="page-center">
      <div className="glass-card">
        <h1>{m.title}</h1>
        <p className="muted" style={{ maxWidth: 420, margin: '0 auto 16px' }}>{m.body}</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Button onClick={() => window.location.reload()}>Retry</Button>
          <Button variant="ghost" onClick={() => logout()}>Log out</Button>
        </div>
      </div>
    </div>
  );
}

export function RequireAuth() {
  const { user, profile, loading, profileError } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page-center">
        <p className="muted">Loading…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (profileError) return <ProfileProblem kind={profileError} />;
  if (!profile) {
    return (
      <div className="page-center">
        <div className="glass-card">
          <p className="error-text">
            We couldn’t load your profile. If you just registered, try logging out and back in.
          </p>
        </div>
      </div>
    );
  }
  return <Outlet />;
}

export function RequireRole({ role }: { role: 'teacher' | 'student' }) {
  const { profile } = useAuth();
  if (!profile) return null;
  // Role always comes from Firestore, never from client state.
  if (profile.role !== role) {
    return <Navigate to={profile.role === 'teacher' ? '/teacher/dashboard' : '/student'} replace />;
  }
  return <Outlet />;
}
