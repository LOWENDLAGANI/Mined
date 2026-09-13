// MINED — App shell / navigation.
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Logo } from './Logo';
import { Button } from './ui';

const TEACHER_NAV = [
  { to: '/teacher/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/teacher/quizzes', label: 'My Quizzes', icon: '📚' },
  { to: '/teacher/quizzes/new', label: 'Create Quiz', icon: '✨' },
  { to: '/teacher/games', label: 'Games', icon: '🎮' },
  { to: '/teacher/results', label: 'Results', icon: '🏆' },
  { to: `/${'teacher'}/profile`, label: 'Profile', icon: '👤' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

const STUDENT_NAV = [
  { to: '/student', label: 'Home', icon: '🏠' },
  { to: '/student/progress', label: 'My Progress', icon: '📈' },
  { to: '/student/achievements', label: 'Achievements', icon: '🏅' },
  { to: '/student/leaderboard', label: 'Leaderboard', icon: '🏆' },
  { to: '/student/profile', label: 'Profile', icon: '👤' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export function Layout() {
  const { profile, logout } = useAuth();
  const nav = useNavigate();
  if (!profile) return null;
  const links = profile.role === 'teacher' ? TEACHER_NAV : STUDENT_NAV;

  return (
    <div className="app-shell">
      <header className="topbar" style={{ backgroundImage: 'var(--tex-header)' }}>
        <NavLink to={profile.role === 'teacher' ? '/teacher/dashboard' : '/student'} className="topbar-brand" aria-label="MINED home">
          <Logo size="sm" />
        </NavLink>
        <nav className="topbar-nav" aria-label="Main navigation">
          {links.map((l) => (
            <NavLink key={l.label} to={l.to} className={({ isActive }) => `topbar-link ${isActive ? 'active' : ''}`}>
              <span aria-hidden="true">{l.icon}</span> {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-right">
          <span className="topbar-user" title={profile.email}>
            {profile.photoURL ? (
              <img src={profile.photoURL} alt="" className="topbar-avatar" />
            ) : (
              <span className="topbar-avatar topbar-avatar-fallback">{profile.displayName.charAt(0).toUpperCase()}</span>
            )}
            <span className="topbar-name">{profile.displayName}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={() => { logout(); nav('/login'); }}>Log out</Button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">MINED — Learn. Play. Level Up.</footer>
    </div>
  );
}
