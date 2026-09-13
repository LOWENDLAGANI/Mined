// MINED — Registration step 1: "How will you use MINED?"
import { useNavigate, Link } from 'react-router-dom';

export function RoleSelect() {
  const nav = useNavigate();
  return (
    <div className="page-center">
      <div className="glass-card">
        <h1>How will you use MINED?</h1>
        <p className="muted" style={{ margin: '0 auto', maxWidth: 360 }}>
          Pick your role — it shapes your whole experience.
        </p>

        <div className="role-cards">
          <button className="role-card role-card--teacher" onClick={() => nav('/register/teacher')}>
            <div className="role-card-title">TEACHER</div>
            <div className="role-card-desc">“I create games and help students learn.”</div>
          </button>
          <button className="role-card role-card--student" onClick={() => nav('/register/student')}>
            <div className="role-card-title">STUDENT</div>
            <div className="role-card-desc">“I join games, learn and level up.”</div>
          </button>
        </div>

        <p className="muted" style={{ marginTop: 24, marginBottom: 0 }}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
