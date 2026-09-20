// Mined — App shell: sticky topbar + role-scoped sidebar navigation.
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Logo } from './Logo';
import { Button } from './ui';

// Small stroke icons (24px grid) to match the flat paper-and-ink theme.
const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-5h-4v5H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />,
  quiz: <><rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></>,
  create: <><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></>,
  play: <><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M10 8.5v7l5.5-3.5z" fill="currentColor" /></>,
  results: <><path d="M4 20h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><path d="M7 20v-6M12 20V9M17 20V4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></>,
  progress: <><path d="M4 19 9 13l4 3 7-9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M15 7h5v5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></>,
  achievements: <><circle cx="12" cy="9" r="5" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M9 13.5 8 21l4-2 4 2-1-7.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M8 5H5a3 3 0 0 0 3 4M16 5h3a3 3 0 0 1-3 4M12 13v4M9 20h6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></>,
  user: <><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></>,
  settings: <><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M12 4v2.5M12 17.5V20M4 12h2.5M17.5 12H20M6.3 6.3l1.8 1.8M15.9 15.9l1.8 1.8M17.7 6.3l-1.8 1.8M8.1 15.9l-1.8 1.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></>,
};

interface NavItem {
  to: string;
  label: string;
  icon: keyof typeof ICONS;
}

const TEACHER_NAV: NavItem[] = [
  { to: '/teacher/dashboard', label: 'Dashboard', icon: 'home' },
  { to: '/teacher/quizzes', label: 'My Quizzes', icon: 'quiz' },
  { to: '/teacher/quizzes/new', label: 'Create Quiz', icon: 'create' },
  { to: '/teacher/sessions', label: 'Sessions', icon: 'play' },
  { to: '/teacher/results', label: 'Results', icon: 'trophy' },
  { to: '/teacher/profile', label: 'Profile', icon: 'user' },
  { to: '/teacher/settings', label: 'Settings', icon: 'settings' },
];

const STUDENT_NAV: NavItem[] = [
  { to: '/student', label: 'Home', icon: 'home' },
  { to: '/student/progress', label: 'My Progress', icon: 'progress' },
  { to: '/student/profile', label: 'Profile', icon: 'user' },
  { to: '/student/settings', label: 'Settings', icon: 'settings' },
];

export function Layout() {
  const { profile, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  if (!profile) return null;
  const isTeacher = profile.role === 'teacher';
  const links = isTeacher ? TEACHER_NAV : STUDENT_NAV;
  const homeTo = isTeacher ? '/teacher/dashboard' : '/student';

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to={homeTo} className="topbar-brand" aria-label="Mined home">
          <Logo size="sm" />
        </NavLink>
        <nav className="topbar-nav" aria-label="Main navigation">
          {links.map((l) => (
            <NavLink key={l.label} to={l.to} className={({ isActive }) => `topbar-link ${isActive ? 'active' : ''}`}>
              {l.label}
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
      <div className="app-body">
        <aside className="side-nav">
          <div className="side-nav-heading">{isTeacher ? 'Teacher workspace' : 'Student space'}</div>
          <nav className="side-nav-links" aria-label="Workspace navigation">
            {links.map((l) => {
              // "My Quizzes" should not light up while editing a quiz.
              const isQuizEditor = l.to === '/teacher/quizzes' && location.pathname.startsWith('/teacher/quizzes/');
              return (
                <NavLink
                  key={l.label}
                  to={l.to}
                  end={l.to === '/student' || l.to === '/teacher/quizzes/new'}
                  className={({ isActive }) => `side-nav-link ${isActive && !isQuizEditor ? 'active' : ''}`}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style={{ flexShrink: 0 }}>{ICONS[l.icon]}</svg>
                  <span>{l.label}</span>
                </NavLink>
              );
            })}
          </nav>
          <div className="side-nav-tip">
            <strong>{isTeacher ? 'Ready to teach?' : 'Ready to play?'}</strong>
            <span>{isTeacher ? 'Create a quiz, then run it live for your class.' : 'Enter the PIN from your teacher to join the quiz.'}</span>
          </div>
        </aside>
        <main className="app-main">
          <Outlet />
        </main>
      </div>
      <footer className="app-footer">Mined</footer>
    </div>
  );
}
