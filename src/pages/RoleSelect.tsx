// Mined — Registration step 1: choose how you'll use Mined.
import { useNavigate, Link } from 'react-router-dom';
import { Logo } from '../components/Logo';

export function RoleSelect() {
  const nav = useNavigate();
  return (
    <div className="page-center">
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <Logo size="lg" />
        </div>
        <h1>How will you use Mined?</h1>
        <p className="muted" style={{ marginTop: -6 }}>Pick a role to set up your account. This can’t be changed later.</p>

        <div className="role-cards">
          <button className="role-card role-card--teacher" onClick={() => nav('/register/teacher')}>
            <div className="role-card-title">Teacher</div>
            <div className="role-card-desc">Create quizzes, host live games, and review class results.</div>
          </button>
          <button className="role-card role-card--student" onClick={() => nav('/register/student')}>
            <div className="role-card-title">Student</div>
            <div className="role-card-desc">Join games with a code, answer questions, and earn XP.</div>
          </button>
        </div>

        <p className="muted" style={{ marginTop: 24, marginBottom: 0 }}>
          Already have an account? <Link to="/login">Log in</Link> · Just playing? <Link to="/join">Join a game</Link>
        </p>
      </div>
    </div>
  );
}
